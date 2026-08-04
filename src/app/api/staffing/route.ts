import { NextRequest } from 'next/server'
import { success } from '@/lib/api-response'
import { withAuth } from '@/lib/with-auth'
import { modulesPrisma } from '@/lib/prisma-modules'

/**
 * GET /api/staffing — Staffing dashboard metrics.
 *
 * Returns: active employees, by-office breakdown, capacity metrics,
 * upcoming leave, expiring documents, onboarding counts.
 */
export const GET = withAuth(async (_request: NextRequest, { profile }) => {
  const orgId = profile.organisationId

  // ── Active employees ───────────────────────────────────────
  let allProfiles: {
    id: string
    fullName: string
    email: string
    jobTitle: string | null
    status: string
    startDate: string | null
    officeId: string | null
    orgPermission: string
    office: { id: string; name: string } | null
    corporateRole: { id: string; title: string; department: string | null } | null
    employeeProfile: { annualLeaveAllocation: number; onboardingComplete: boolean } | null
  }[]

  try {
    allProfiles = await modulesPrisma.profile.findMany({
      where: { organisationId: orgId },
      select: {
        id: true,
        fullName: true,
        email: true,
        jobTitle: true,
        status: true,
        startDate: true,
        officeId: true,
        orgPermission: true,
        office: { select: { id: true, name: true } },
        corporateRole: { select: { id: true, title: true, department: true } },
        employeeProfile: {
          select: {
            annualLeaveAllocation: true,
            onboardingComplete: true,
          },
        },
      },
    })
  } catch {
    // employeeProfile relation may fail if table has no records or schema mismatch —
    // fall back to query without it
    const baseProfiles: {
      id: string
      fullName: string
      email: string
      jobTitle: string | null
      status: string
      startDate: string | null
      officeId: string | null
      orgPermission: string
      office: { id: string; name: string } | null
      corporateRole: { id: string; title: string; department: string | null } | null
    }[] = await modulesPrisma.profile.findMany({
      where: { organisationId: orgId },
      select: {
        id: true,
        fullName: true,
        email: true,
        jobTitle: true,
        status: true,
        startDate: true,
        officeId: true,
        orgPermission: true,
        office: { select: { id: true, name: true } },
        corporateRole: { select: { id: true, title: true, department: true } },
      },
    })
    allProfiles = baseProfiles.map((p) => ({
      ...p,
      employeeProfile: null,
    }))
  }

  const activeEmployees = allProfiles.filter(
    (p) => p.status === 'ACTIVE',
  )
  const onboardingEmployees = allProfiles.filter(
    (p) => p.status === 'ONBOARDING',
  )

  // ── By-office breakdown ────────────────────────────────────
  const byOffice: Record<string, { name: string; count: number }> = {}
  for (const p of activeEmployees) {
    const officeKey = p.officeId ?? 'unassigned'
    const officeName = p.office?.name ?? 'Unassigned'
    if (!byOffice[officeKey]) {
      byOffice[officeKey] = { name: officeName, count: 0 }
    }
    byOffice[officeKey].count++
  }

  // ── By-department breakdown ────────────────────────────────
  const byDepartment: Record<string, number> = {}
  for (const p of activeEmployees) {
    const dept = p.corporateRole?.department ?? 'Unassigned'
    byDepartment[dept] = (byDepartment[dept] ?? 0) + 1
  }

  // ── Capacity: project assignments ──────────────────────────
  const now = new Date()
  const weekStart = new Date(now)
  weekStart.setDate(now.getDate() - now.getDay() + 1) // Monday
  weekStart.setHours(0, 0, 0, 0)

  let currentAllocations: { profileId: string; _sum: { hoursAllocated: number | null } }[] = []
  try {
    currentAllocations = await modulesPrisma.resourceAllocation.groupBy({
      by: ['profileId'],
      where: {
        weekStarting: weekStart,
        profile: { organisationId: orgId },
      },
      _sum: { hoursAllocated: true },
    })
  } catch {
    // Table may not exist yet
  }

  const allocatedMap = new Map<string, number>()
  for (const a of currentAllocations) {
    allocatedMap.set(a.profileId, a._sum?.hoursAllocated ?? 0)
  }

  const standardWeeklyHours = 40
  let overAllocated = 0
  let underAllocated = 0
  let totalAllocatedHours = 0
  const totalCapacityHours = activeEmployees.length * standardWeeklyHours

  for (const emp of activeEmployees) {
    const allocated = allocatedMap.get(emp.id) ?? 0
    totalAllocatedHours += allocated
    if (allocated > standardWeeklyHours) overAllocated++
    if (allocated > 0 && allocated < standardWeeklyHours * 0.5) underAllocated++
  }

  const avgUtilisation =
    totalCapacityHours > 0
      ? Math.round((totalAllocatedHours / totalCapacityHours) * 100)
      : 0

  // ── Upcoming leave (next 30/60 days) ───────────────────────
  const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
  const in60Days = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000)

  let pendingLeave = 0
  let leaveNext30 = 0
  let leaveNext60 = 0
  try {
    pendingLeave = await modulesPrisma.leaveRequest.count({
      where: {
        profile: { organisationId: orgId },
        status: { in: ['SUBMITTED', 'UNDER_REVIEW', 'LINE_MANAGER_APPROVED'] },
      },
    })
    leaveNext30 = await modulesPrisma.leaveRequest.count({
      where: {
        profile: { organisationId: orgId },
        status: 'APPROVED',
        startDate: { gte: now, lte: in30Days },
      },
    })
    leaveNext60 = await modulesPrisma.leaveRequest.count({
      where: {
        profile: { organisationId: orgId },
        status: 'APPROVED',
        startDate: { gte: now, lte: in60Days },
      },
    })
  } catch {
    // Leave tables may not be available
  }

  // ── Expiring documents ─────────────────────────────────────
  let expiringDocs: { id: string; title: string; documentType: string; expiryDate: string; profile: { fullName: string } }[] = []
  try {
    expiringDocs = await modulesPrisma.hRDocument.findMany({
      where: {
        organisationId: orgId,
        expiryDate: { lte: in60Days, gte: now },
      },
      select: {
        id: true,
        title: true,
        documentType: true,
        expiryDate: true,
        profile: { select: { fullName: true } },
      },
      orderBy: { expiryDate: 'asc' },
      take: 20,
    })
  } catch {
    // Table may not exist yet
  }

  // ── Probation reviews due ──────────────────────────────────
  let probationsDue = 0
  try {
    probationsDue = await modulesPrisma.probationReview.count({
      where: {
        profile: { organisationId: orgId },
        completedDate: null,
        scheduledDate: { lte: in30Days },
      },
    })
  } catch {
    // Table may not exist yet
  }

  return success({
    metrics: {
      totalEmployees: allProfiles.length,
      activeEmployees: activeEmployees.length,
      onboarding: onboardingEmployees.length,
      avgUtilisation,
      overAllocated,
      underAllocated,
      totalCapacityHours,
      totalAllocatedHours,
      pendingLeave,
      leaveNext30,
      leaveNext60,
      expiringDocuments: expiringDocs.length,
      probationsDue,
    },
    byOffice: Object.values(byOffice),
    byDepartment,
    expiringDocs,
    employees: allProfiles.map((p) => ({
      id: p.id,
      fullName: p.fullName,
      email: p.email,
      jobTitle: p.jobTitle,
      status: p.status,
      startDate: p.startDate,
      officeId: p.officeId,
      orgPermission: p.orgPermission,
      office: p.office?.name ?? null,
      department: p.corporateRole?.department ?? null,
      role: p.corporateRole?.title ?? null,
      onboardingComplete: p.employeeProfile?.onboardingComplete ?? false,
      leaveAllocation: p.employeeProfile?.annualLeaveAllocation ?? 25,
    })),
  })
})

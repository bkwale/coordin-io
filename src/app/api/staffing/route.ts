import { NextRequest } from 'next/server'
import { success } from '@/lib/api-response'
import { withAuth } from '@/lib/with-auth'
import { modulesPrisma } from '@/lib/prisma-modules'
import {
  mapStaffingEmployee,
  toDirectoryEntry,
  hasStaffingDashboardAccess,
  canViewUtilisation,
} from '@/lib/staffing-utils'
import type { OrgPermission } from '@/generated/prisma/client'

/**
 * GET /api/staffing — Staffing dashboard.
 *
 * Permission (query-then-strip pattern):
 * - MEMBER: directory only — name, role, office, location. No metrics, no email, no leave data.
 * - MANAGER: directory + headcount metrics + byOffice/byDepartment. No utilisation/leave/HR metrics.
 * - HR+: full dashboard with all metrics, expiring docs, probation counts.
 */
export const GET = withAuth(async (_request: NextRequest, { profile }) => {
  const orgId = profile.organisationId
  const role = profile.orgPermission as OrgPermission

  const showDashboard = hasStaffingDashboardAccess(role)  // MANAGER+
  const showUtilisation = canViewUtilisation(role)          // HR+

  // ── Active employees ───────────────────────────────────────
  // Query includes office city/country for directory entries
  let allProfiles: {
    id: string
    fullName: string
    email: string
    jobTitle: string | null
    status: string
    startDate: string | null
    officeId: string | null
    orgPermission: string
    office: { id: string; name: string; city: string | null; country: string | null } | null
    department: string | null
    corporateRole: { id: string; name: string } | null
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
        department: true,
        office: { select: { id: true, name: true, city: true, country: true } },
        corporateRole: { select: { id: true, name: true } },
        employeeProfile: {
          select: {
            annualLeaveAllocation: true,
            onboardingComplete: true,
          },
        },
      },
    })
  } catch {
    // employeeProfile relation may fail — fall back without it
    const baseProfiles: {
      id: string
      fullName: string
      email: string
      jobTitle: string | null
      status: string
      startDate: string | null
      officeId: string | null
      orgPermission: string
      department: string | null
      office: { id: string; name: string; city: string | null; country: string | null } | null
      corporateRole: { id: string; name: string } | null
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
        department: true,
        office: { select: { id: true, name: true, city: true, country: true } },
        corporateRole: { select: { id: true, name: true } },
      },
    })
    allProfiles = baseProfiles.map((p) => ({
      ...p,
      department: p.department ?? null,
      employeeProfile: null,
    }))
  }

  // ── MEMBER: directory-only response ───────────────────────
  if (!showDashboard) {
    return success({
      directory: allProfiles
        .filter((p) => p.status === 'ACTIVE')
        .map((p) => toDirectoryEntry({
          id: p.id,
          fullName: p.fullName,
          jobTitle: p.jobTitle,
          office: p.office,
          department: p.department,
          corporateRole: p.corporateRole,
        })),
      directoryOnly: true,
    })
  }

  // ── MANAGER+ continues with full dashboard ────────────────
  const activeEmployees = allProfiles.filter((p) => p.status === 'ACTIVE')
  const onboardingEmployees = allProfiles.filter((p) => p.status === 'ONBOARDING')

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
    const dept = p.department ?? 'Unassigned'
    byDepartment[dept] = (byDepartment[dept] ?? 0) + 1
  }

  // Metrics that only HR+ can see (utilisation, leave, HR docs)
  let avgUtilisation = 0
  let overAllocated = 0
  let underAllocated = 0
  let totalAllocatedHours = 0
  let totalCapacityHours = 0
  let pendingLeave = 0
  let leaveNext30 = 0
  let leaveNext60 = 0
  let expiringDocs: { id: string; title: string; documentType: string; expiryDate: string; profile: { fullName: string } }[] = []
  let probationsDue = 0

  if (showUtilisation) {
    const now = new Date()
    const weekStart = new Date(now)
    weekStart.setDate(now.getDate() - now.getDay() + 1)
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
    } catch { /* Table may not exist yet */ }

    const allocatedMap = new Map<string, number>()
    for (const a of currentAllocations) {
      allocatedMap.set(a.profileId, a._sum?.hoursAllocated ?? 0)
    }

    const standardWeeklyHours = 40
    totalCapacityHours = activeEmployees.length * standardWeeklyHours

    for (const emp of activeEmployees) {
      const allocated = allocatedMap.get(emp.id) ?? 0
      totalAllocatedHours += allocated
      if (allocated > standardWeeklyHours) overAllocated++
      if (allocated > 0 && allocated < standardWeeklyHours * 0.5) underAllocated++
    }

    avgUtilisation = totalCapacityHours > 0
      ? Math.round((totalAllocatedHours / totalCapacityHours) * 100)
      : 0

    // Leave metrics
    const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
    const in60Days = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000)

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
    } catch { /* Leave tables may not be available */ }

    // Expiring documents
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
    } catch { /* Table may not exist yet */ }

    // Probation reviews
    try {
      probationsDue = await modulesPrisma.probationReview.count({
        where: {
          profile: { organisationId: orgId },
          completedDate: null,
          scheduledDate: { lte: in30Days },
        },
      })
    } catch { /* Table may not exist yet */ }
  }

  return success({
    metrics: {
      totalEmployees: allProfiles.length,
      activeEmployees: activeEmployees.length,
      onboarding: onboardingEmployees.length,
      // Utilisation metrics — zeroed for MANAGER, populated for HR+
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
    expiringDocs: showUtilisation ? expiringDocs : [],
    employees: allProfiles.map(mapStaffingEmployee),
  })
})

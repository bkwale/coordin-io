import { NextRequest } from 'next/server'
import { success } from '@/lib/api-response'
import { withAuth } from '@/lib/with-auth'
import { modulesPrisma } from '@/lib/prisma-modules'
import { recordAuditEvent } from '@/lib/audit'
import { optionalString, parseBody } from '@/lib/validation'
import { NotFoundError, PermissionError } from '@/lib/errors'

/**
 * GET /api/staffing/employees/[profileId] — Full employee profile detail.
 *
 * Returns personal details, emergency contact, HR documents,
 * project assignments, allocation history, probation reviews.
 */
export const GET = withAuth(async (request: NextRequest, { profile }) => {
  const profileId = request.url.match(/\/employees\/([^/?]+)/)?.[1]
  if (!profileId) throw new NotFoundError('Employee not found')

  const employee = await modulesPrisma.profile.findUnique({
    where: { id: profileId },
    include: {
      office: { select: { id: true, name: true, city: true, country: true } },
      corporateRole: { select: { id: true, title: true, department: true, level: true } },
      manager: { select: { id: true, fullName: true, jobTitle: true } },
      employeeProfile: true,
      projectMemberships: {
        include: {
          project: {
            select: {
              id: true,
              name: true,
              code: true,
              status: true,
              stage: true,
            },
          },
        },
      },
      leaveBalances: {
        take: 5,
        orderBy: { year: 'desc' },
      },
      trainingCompletions: {
        include: {
          module: { select: { id: true, title: true, category: true } },
        },
        orderBy: { completedAt: 'desc' },
      },
      cpdRecords: {
        take: 10,
        orderBy: { activityDate: 'desc' },
      },
      assetAssignments: {
        include: {
          asset: { select: { id: true, name: true, assetTag: true, category: true } },
        },
      },
    },
  })

  if (!employee) {
    throw new NotFoundError('Employee not found')
  }

  // Must be in same org
  if (employee.organisationId !== profile.organisationId) {
    throw new PermissionError('You do not have access to this employee')
  }

  // ── HR Documents (non-confidential, or admin/owner) ────────
  let hrDocuments: unknown[] = []
  try {
    const isAdmin = profile.orgPermission === 'ADMIN' || profile.orgPermission === 'OWNER'
    const isSelf = profileId === profile.id
    hrDocuments = await modulesPrisma.hRDocument.findMany({
      where: {
        profileId,
        ...(isAdmin || isSelf ? {} : { isConfidential: false }),
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })
  } catch {
    // Table may not exist yet
  }

  // ── Resource allocations ───────────────────────────────────
  let allocations: unknown[] = []
  try {
    allocations = await modulesPrisma.resourceAllocation.findMany({
      where: { profileId },
      include: {
        project: { select: { id: true, name: true, code: true } },
      },
      orderBy: { weekStarting: 'desc' },
      take: 52, // Last year of allocations
    })
  } catch {
    // Table may not exist yet
  }

  // ── Probation reviews ──────────────────────────────────────
  let probationReviews: unknown[] = []
  try {
    probationReviews = await modulesPrisma.probationReview.findMany({
      where: { profileId },
      orderBy: { scheduledDate: 'asc' },
    })
  } catch {
    // Table may not exist yet
  }

  // ── Confidential fields gating ─────────────────────────────
  const isAdmin = profile.orgPermission === 'ADMIN' || profile.orgPermission === 'OWNER'
  const isSelf = profileId === profile.id

  return success({
    employee: {
      id: employee.id,
      fullName: employee.fullName,
      email: employee.email,
      phone: employee.phone,
      jobTitle: employee.jobTitle,
      avatarUrl: employee.avatarUrl,
      orgPermission: employee.orgPermission,
      status: employee.status,
      startDate: employee.startDate,
      office: employee.office,
      role: employee.corporateRole,
      manager: employee.manager,
      emergencyContact: isSelf || isAdmin
        ? {
            name: employee.employeeProfile?.emergencyName ?? null,
            phone: employee.employeeProfile?.emergencyPhone ?? null,
            relation: employee.employeeProfile?.emergencyRelation ?? null,
          }
        : null,
      onboardingComplete: employee.employeeProfile?.onboardingComplete ?? false,
      mentorId: employee.employeeProfile?.mentorId ?? null,
      qualificationPathway: employee.employeeProfile?.qualificationPathway ?? null,
      leaveAllocation: employee.employeeProfile?.annualLeaveAllocation ?? 25,
    },
    projects: employee.projectMemberships.map((pm: {
      id: string
      role: string | null
      project: { id: string; name: string; code: string | null; status: string; stage: string }
    }) => ({
      membershipId: pm.id,
      role: pm.role,
      project: pm.project,
    })),
    leaveBalances: employee.leaveBalances,
    training: employee.trainingCompletions,
    cpd: employee.cpdRecords,
    assets: employee.assetAssignments,
    hrDocuments,
    allocations,
    probationReviews,
  })
})

/**
 * PATCH /api/staffing/employees/[profileId] — Update employee fields.
 *
 * Only admins/owners can update other employees.
 * Users can update their own emergency contact fields.
 */
export const PATCH = withAuth(async (request: NextRequest, { profile }) => {
  const profileId = request.url.match(/\/employees\/([^/?]+)/)?.[1]
  if (!profileId) throw new NotFoundError('Employee not found')

  const isAdmin = profile.orgPermission === 'ADMIN' || profile.orgPermission === 'OWNER'
  const isSelf = profileId === profile.id

  if (!isAdmin && !isSelf) {
    throw new PermissionError('Only admins can update other employees')
  }

  const body = await parseBody(request)

  // Fields that any user can update on their own profile
  const selfFields: Record<string, unknown> = {}
  const emergencyFields: Record<string, unknown> = {}

  if (isSelf || isAdmin) {
    const phone = optionalString(body.phone, 'phone', 50)
    if (phone !== undefined) selfFields.phone = phone

    const emergencyName = optionalString(body.emergencyName, 'emergencyName', 200)
    if (emergencyName !== undefined) emergencyFields.emergencyName = emergencyName

    const emergencyPhone = optionalString(body.emergencyPhone, 'emergencyPhone', 50)
    if (emergencyPhone !== undefined) emergencyFields.emergencyPhone = emergencyPhone

    const emergencyRelation = optionalString(body.emergencyRelation, 'emergencyRelation', 100)
    if (emergencyRelation !== undefined) emergencyFields.emergencyRelation = emergencyRelation
  }

  // Admin-only fields
  const adminFields: Record<string, unknown> = {}
  if (isAdmin) {
    const jobTitle = optionalString(body.jobTitle, 'jobTitle', 200)
    if (jobTitle !== undefined) adminFields.jobTitle = jobTitle

    if (body.officeId !== undefined) adminFields.officeId = body.officeId || null
    if (body.roleId !== undefined) adminFields.roleId = body.roleId || null
    if (body.managerId !== undefined) adminFields.managerId = body.managerId || null
    if (body.status !== undefined) adminFields.status = body.status
  }

  // Update profile
  const profileData = { ...selfFields, ...adminFields }
  if (Object.keys(profileData).length > 0) {
    await modulesPrisma.profile.update({
      where: { id: profileId },
      data: profileData,
    })
  }

  // Update employee profile emergency contact
  if (Object.keys(emergencyFields).length > 0) {
    await modulesPrisma.employeeProfile.upsert({
      where: { profileId },
      create: { profileId, ...emergencyFields },
      update: emergencyFields,
    })
  }

  await recordAuditEvent({
    organisationId: profile.organisationId,
    actorId: profile.id,
    action: 'staffing.employee_updated',
    entityType: 'profile',
    entityId: profileId,
    metadata: { fields: Object.keys({ ...profileData, ...emergencyFields }) },
  })

  return success({ updated: true })
})

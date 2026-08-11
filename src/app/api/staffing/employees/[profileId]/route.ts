import { NextRequest } from 'next/server'
import { success } from '@/lib/api-response'
import { withAuth } from '@/lib/with-auth'
import { modulesPrisma } from '@/lib/prisma-modules'
import { recordAuditEvent } from '@/lib/audit'
import { optionalString, parseBody } from '@/lib/validation'
import { NotFoundError, PermissionError, ValidationError } from '@/lib/errors'
import { hasFullStaffingAccess, canManageHR, toDirectoryEntry } from '@/lib/staffing-utils'
import { createNotification, NOTIFICATION_EVENTS } from '@/lib/notifications'
import type { OrgPermission } from '@/generated/prisma/client'

/**
 * GET /api/staffing/employees/[profileId] — Employee profile detail.
 *
 * Permission (query-then-strip pattern):
 * - HR+ or self: full profile with HR docs, allocations, probation, emergency contact
 * - MEMBER viewing someone else: directory-only fields (name, role, office, location)
 */
export const GET = withAuth(async (request: NextRequest, { profile }) => {
  const profileId = request.url.match(/\/employees\/([^/?]+)/)?.[1]
  if (!profileId) throw new NotFoundError('Employee not found')

  const employee = await modulesPrisma.profile.findUnique({
    where: { id: profileId },
    include: {
      office: { select: { id: true, name: true, city: true, country: true } },
      corporateRole: { select: { id: true, name: true, level: true } },
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
          training: { select: { id: true, title: true } },
        },
        orderBy: { completedAt: 'desc' },
      },
      cpdRecords: {
        take: 10,
        orderBy: { date: 'desc' },
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

  const role = profile.orgPermission as OrgPermission
  const hasHRAccess = hasFullStaffingAccess(role)
  const isSelf = profileId === profile.id

  // MEMBER viewing someone else → directory-only response
  if (!hasHRAccess && !isSelf) {
    return success({
      employee: toDirectoryEntry({
        id: employee.id,
        fullName: employee.fullName,
        jobTitle: employee.jobTitle,
        office: employee.office,
        department: employee.employeeProfile?.department ?? null,
        corporateRole: employee.corporateRole,
      }),
      directoryOnly: true,
    })
  }

  // ── HR Documents (non-confidential, or HR+/self) ──────────
  let hrDocuments: unknown[] = []
  try {
    hrDocuments = await modulesPrisma.hRDocument.findMany({
      where: {
        profileId,
        ...(hasHRAccess || isSelf ? {} : { isConfidential: false }),
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
      emergencyContact: isSelf || hasHRAccess
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
      projectRole: string | null
      project: { id: string; name: string; code: string | null; status: string; stage: string }
    }) => ({
      membershipId: pm.id,
      role: pm.projectRole,
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
 * Permission: HR+ can update any employee. Self can update own emergency contact/phone.
 * orgPermission changes: OWNER can set any level, ADMIN/HR can set up to MANAGER.
 */
export const PATCH = withAuth(async (request: NextRequest, { profile }) => {
  const profileId = request.url.match(/\/employees\/([^/?]+)/)?.[1]
  if (!profileId) throw new NotFoundError('Employee not found')

  const role = profile.orgPermission as OrgPermission
  const hasHRAccess = hasFullStaffingAccess(role)
  const isSelf = profileId === profile.id

  if (!hasHRAccess && !isSelf) {
    throw new PermissionError('Only HR managers and admins can update other employees')
  }

  const body = await parseBody(request)

  // Fields that any user can update on their own profile
  const selfFields: Record<string, unknown> = {}
  const emergencyFields: Record<string, unknown> = {}

  if (isSelf || hasHRAccess) {
    const phone = optionalString(body.phone, 'phone', 50)
    if (phone !== undefined) selfFields.phone = phone

    const emergencyName = optionalString(body.emergencyName, 'emergencyName', 200)
    if (emergencyName !== undefined) emergencyFields.emergencyName = emergencyName

    const emergencyPhone = optionalString(body.emergencyPhone, 'emergencyPhone', 50)
    if (emergencyPhone !== undefined) emergencyFields.emergencyPhone = emergencyPhone

    const emergencyRelation = optionalString(body.emergencyRelation, 'emergencyRelation', 100)
    if (emergencyRelation !== undefined) emergencyFields.emergencyRelation = emergencyRelation
  }

  // HR+-only fields
  const adminFields: Record<string, unknown> = {}
  if (hasHRAccess) {
    const jobTitle = optionalString(body.jobTitle, 'jobTitle', 200)
    if (jobTitle !== undefined) adminFields.jobTitle = jobTitle

    if (body.officeId !== undefined) adminFields.officeId = body.officeId || null
    if (body.roleId !== undefined) adminFields.roleId = body.roleId || null
    if (body.managerId !== undefined) adminFields.managerId = body.managerId || null
    if (body.status !== undefined) adminFields.status = body.status

    // orgPermission — with privilege escalation guard
    // OWNER can set any level. ADMIN/HR can set up to MANAGER (cannot promote to HR/ADMIN/OWNER).
    if (body.orgPermission !== undefined) {
      const validPermissions = ['OWNER', 'ADMIN', 'HR', 'MANAGER', 'MEMBER', 'VIEWER']
      const newPerm = body.orgPermission as string
      if (!validPermissions.includes(newPerm)) {
        throw new ValidationError(`Invalid permission level: ${newPerm}`)
      }
      const highPerms = ['OWNER', 'ADMIN', 'HR']
      if (highPerms.includes(newPerm) && role !== 'OWNER') {
        throw new PermissionError('Only the Practice Principal (Owner) can assign HR, Admin, or Owner roles')
      }
      // Prevent demoting OWNER unless you are OWNER
      if (role !== 'OWNER') {
        const target = await modulesPrisma.profile.findUnique({
          where: { id: profileId },
          select: { orgPermission: true },
        })
        if (target?.orgPermission === 'OWNER') {
          throw new PermissionError('Only owners can change another owner\'s role')
        }
      }
      // Prevent self-demotion for last OWNER
      if (isSelf && role === 'OWNER' && newPerm !== 'OWNER') {
        const ownerCount = await modulesPrisma.profile.count({
          where: { organisationId: profile.organisationId, orgPermission: 'OWNER' },
        })
        if (ownerCount <= 1) {
          throw new ValidationError('Cannot demote the last owner — assign another owner first')
        }
      }
      adminFields.orgPermission = newPerm
    }

    // department
    if (body.department !== undefined) {
      const dept = optionalString(body.department, 'department', 200)
      adminFields.department = dept || null
    }
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

  // Notify the employee about changes (only when HR updates someone else's profile)
  if (!isSelf && profileId && Object.keys(adminFields).length > 0) {
    const changedFields = Object.keys(adminFields)
    const summary = changedFields.includes('orgPermission')
      ? `Your role was updated to ${adminFields.orgPermission}`
      : `Your profile was updated (${changedFields.join(', ')})`
    await createNotification({
      profileId,
      type: NOTIFICATION_EVENTS.PROJECT_UPDATE,
      title: summary,
      linkUrl: `/staffing/employees/${profileId}`,
    }).catch(() => {})
  }

  return success({ updated: true })
})

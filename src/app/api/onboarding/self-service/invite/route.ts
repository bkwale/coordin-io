import { NextRequest } from 'next/server'
import { firmDefaults } from '@/lib/region-server'
import { success } from '@/lib/api-response'
import { withAuth } from '@/lib/with-auth'
import { modulesPrisma } from '@/lib/prisma-modules'
import { requireString } from '@/lib/validation'
import { NotFoundError, PermissionError, ConflictError } from '@/lib/errors'
import { recordAuditEvent } from '@/lib/audit'
import { createNotification, NOTIFICATION_EVENTS } from '@/lib/notifications'
import { sendSelfServiceOnboardingEmail } from '@/lib/email'
import { checkRateLimit, RateLimitPresets } from '@/lib/rate-limit'
import crypto from 'crypto'

import { selfServiceSteps, selfServiceStepFor, SELF_SERVICE_TITLES, isEmployeeType, type EmployeeType } from '@/lib/onboarding/seven-day'

// Invitation link lifetime. The seven-day window itself starts when the employee activates the link.
const INVITE_VALID_DAYS = 14

/**
 * POST /api/onboarding/self-service/invite — Send a self-service onboarding invitation.
 *
 * Creates an OnboardingSelfServiceToken, generates the self-service OnboardingTasks for the employee type,
 * and sends the branded email with a unique link.
 *
 * Body: { profileId, assignmentId? }
 * Auth: HR/Admin/Owner/Manager
 */
export const POST = withAuth(async (request: NextRequest, { profile }) => {
  // Rate limit invite sends to prevent spam
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  const rateLimitResponse = await checkRateLimit(`self-service-invite:${profile.id}:${ip}`, RateLimitPresets.standard)
  if (rateLimitResponse) return rateLimitResponse

  const isManager = ['ADMIN', 'OWNER', 'HR', 'MANAGER'].includes(profile.orgPermission)
  if (!isManager) {
    throw new PermissionError('Only managers, HR, and admins can send onboarding invitations')
  }

  const body = await request.json()
  const targetProfileId = requireString(body.profileId, 'profileId')
  const assignmentId = body.assignmentId ? String(body.assignmentId) : null

  // Verify target profile exists and is in the same org
  const targetProfile = await modulesPrisma.profile.findUnique({
    where: { id: targetProfileId },
    select: {
      id: true,
      organisationId: true,
      fullName: true,
      email: true,
      startDate: true,
      organisation: { select: { name: true } },
    },
  })

  if (!targetProfile || targetProfile.organisationId !== profile.organisationId) {
    throw new NotFoundError('Employee not found in your organisation')
  }

  if (!targetProfile.email) {
    throw new NotFoundError('Employee has no email address — cannot send invitation')
  }

  // Check for existing active (unexpired, unused, unrevoked) token
  const existingToken = await modulesPrisma.onboardingSelfServiceToken.findFirst({
    where: {
      profileId: targetProfileId,
      organisationId: profile.organisationId,
      usedAt: null,
      revokedAt: null,
      expiresAt: { gt: new Date() },
    },
  })
  if (existingToken) {
    throw new ConflictError('An active onboarding invitation already exists for this employee. Revoke it first to send a new one.')
  }

  let employeeType: EmployeeType = isEmployeeType(body.employeeType) ? body.employeeType : 'NEW'
  // Verify assignment if provided
  if (assignmentId) {
    const assignment = await modulesPrisma.onboardingAssignment.findFirst({
      where: { id: assignmentId, profileId: targetProfileId, organisationId: profile.organisationId },
    })
    if (!assignment) {
      throw new NotFoundError('Onboarding assignment not found')
    }
    if (isEmployeeType(assignment.employeeType)) employeeType = assignment.employeeType
  }
  // New starters get the full set; existing staff skip contracts/HMO and confirm payroll only when HR asks (Ayo 1.2)
  const firm = await firmDefaults(profile.organisationId)
  const steps = selfServiceSteps(employeeType, { includePayroll: body.includePayroll === true, includeHealthInsurance: firm.country === 'NG' || firm.country === null })

  // Generate secure token (32 bytes = 64 hex chars)
  const token = crypto.randomBytes(32).toString('hex')
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + INVITE_VALID_DAYS)

  // Create token + self-service tasks in a transaction
  const selfServiceToken = await modulesPrisma.$transaction(async (tx: typeof modulesPrisma) => {
    // Create the token
    const newToken = await tx.onboardingSelfServiceToken.create({
      data: {
        organisationId: profile.organisationId,
        profileId: targetProfileId,
        assignmentId,
        token,
        expiresAt,
        createdById: profile.id,
      },
    })

    // One task per self-service step. Reuse the matching task from the assignment's checklist where
    // there is one (so the employee does each thing once); otherwise create it.
    const legacyTasks: { id: string; title: string; claimed?: boolean }[] = assignmentId
      ? await tx.onboardingTask.findMany({
          where: { assignmentId, assigneeId: targetProfileId, selfServiceStep: null, status: { not: 'WAIVED' } },
          select: { id: true, title: true },
          orderBy: { sortOrder: 'asc' },
        })
      : []
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i]
      const dueDate = new Date(expiresAt) // Re-dated to the window deadline when the employee activates

      if (assignmentId) {
        // Already linked (new assignments set the step when tasks are created)
        const reused = await tx.onboardingTask.updateMany({
          where: { assignmentId, assigneeId: targetProfileId, selfServiceStep: step, status: { not: 'WAIVED' } },
          data: { isSelfService: true },
        })
        if (reused.count > 0) continue
        // Older assignments: link the matching checklist task by its wording, even if already completed
        const legacy = legacyTasks.find((t) => !t.claimed && selfServiceStepFor({ title: t.title, responsibleRole: 'EMPLOYEE' }) === step)
        if (legacy) {
          legacy.claimed = true
          await tx.onboardingTask.update({ where: { id: legacy.id }, data: { isSelfService: true, selfServiceStep: step } })
          continue
        }
      }

      await tx.onboardingTask.create({
        data: {
          assignmentId: assignmentId || undefined,
          assigneeId: targetProfileId,
          title: SELF_SERVICE_TITLES[employeeType][step] ?? step,
          stage: 'PRE_START',
          category: 'SELF_SERVICE',
          responsibleRole: 'EMPLOYEE',
          dueDate,
          status: 'PENDING',
          sortOrder: i + 100, // High sort order to not conflict with template tasks
          isSelfService: true,
          selfServiceStep: step,
        },
      })
    }

    return newToken
  })

  // Send the email
  const startDateStr = targetProfile.startDate
    ? new Date(targetProfile.startDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    : null

  const emailResult = await sendSelfServiceOnboardingEmail({
    healthInsurance: steps.includes('HMO_ENROLMENT'),
    to: targetProfile.email,
    employeeName: targetProfile.fullName || 'there',
    organisationName: targetProfile.organisation?.name || 'your organisation',
    senderName: profile.fullName || 'Your HR team',
    token,
    expiresAt,
    startDate: startDateStr,
  })

  // Create notification
  await createNotification({
    profileId: targetProfileId,
    type: NOTIFICATION_EVENTS.ONBOARDING_TASK_ASSIGNED,
    title: 'Complete your onboarding',
    body: 'You have been sent a self-service onboarding invitation. Check your email to get started.',
    linkUrl: '/onboarding',
  })

  await recordAuditEvent({
    organisationId: profile.organisationId,
    actorId: profile.id,
    action: 'self_service_onboarding.invited',
    entityType: 'OnboardingSelfServiceToken',
    entityId: selfServiceToken.id,
    metadata: {
      targetProfileId,
      assignmentId,
      emailSent: emailResult.success,
      expiresAt: expiresAt.toISOString(),
    },
  })

  return success({
    token: {
      id: selfServiceToken.id,
      profileId: targetProfileId,
      expiresAt,
      emailSent: emailResult.success,
      emailError: emailResult.error || null,
    },
  }, 201)
})

import { NextRequest } from 'next/server'
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

const SELF_SERVICE_STEPS = ['PERSONAL_DETAILS', 'BANK_DETAILS', 'HMO_ENROLMENT', 'DOCUMENT_UPLOAD'] as const

const STEP_TITLES: Record<string, string> = {
  PERSONAL_DETAILS: 'Confirm your personal details',
  BANK_DETAILS: 'Submit your bank details for payroll',
  HMO_ENROLMENT: 'Enrol in health insurance (HMO)',
  DOCUMENT_UPLOAD: 'Upload and confirm required documents',
}

/**
 * POST /api/onboarding/self-service/invite — Send a self-service onboarding invitation.
 *
 * Creates an OnboardingSelfServiceToken, generates 4 self-service OnboardingTasks,
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

  // Verify assignment if provided
  if (assignmentId) {
    const assignment = await modulesPrisma.onboardingAssignment.findFirst({
      where: { id: assignmentId, profileId: targetProfileId, organisationId: profile.organisationId },
    })
    if (!assignment) {
      throw new NotFoundError('Onboarding assignment not found')
    }
  }

  // Generate secure token (32 bytes = 64 hex chars)
  const token = crypto.randomBytes(32).toString('hex')
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + 7) // 7-day expiry

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

    // Create 4 self-service tasks (one per step)
    // If there's an assignment, attach to it; otherwise create standalone tasks
    for (let i = 0; i < SELF_SERVICE_STEPS.length; i++) {
      const step = SELF_SERVICE_STEPS[i]
      const dueDate = new Date(expiresAt) // Due when token expires

      await tx.onboardingTask.create({
        data: {
          assignmentId: assignmentId || undefined,
          assigneeId: targetProfileId,
          title: STEP_TITLES[step],
          stage: 'PRE_START',
          category: 'SELF_SERVICE',
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

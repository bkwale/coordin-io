import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { recordAuditEvent, AuditActions } from '@/lib/audit'
import { generateSecureToken } from '@/lib/tokens'
import { success } from '@/lib/api-response'
import { ValidationError, ConflictError } from '@/lib/errors'
import { withAuth } from '@/lib/with-auth'
import { sendInvitationEmail } from '@/lib/email'

/**
 * POST /api/invitations — Create a new employee invitation.
 * Only org admins/managers can create invitations.
 */
export const POST = withAuth(async (request: NextRequest, { profile }) => {
  // Permission check handled by withAuth({ requiredPermission: 'MANAGER' })

  const body = await request.json()
  const { email, fullName, jobTitle, officeId, roleId, managerId, startDate, annualLeave } = body

  if (!email || !fullName) {
    throw new ValidationError('Email and full name are required')
  }

  // Check for existing active invitation
  const existing = await prisma.invitation.findFirst({
    where: {
      email,
      organisationId: profile.organisationId,
      status: { in: ['PENDING', 'SENT'] },
    },
  })

  if (existing) {
    throw new ConflictError('An active invitation already exists for this email')
  }

  // Default expiry: 48 hours
  const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000)

  const invitation = await prisma.invitation.create({
    data: {
      organisationId: profile.organisationId,
      token: generateSecureToken(),
      email,
      fullName,
      jobTitle: jobTitle || null,
      officeId: officeId || null,
      roleId: roleId || null,
      managerId: managerId || null,
      startDate: startDate ? new Date(startDate) : null,
      annualLeave: annualLeave ?? null,
      expiresAt,
      createdById: profile.id,
    },
  })

  // Get org name and inviter name for the email
  const org = await prisma.organisation.findUnique({
    where: { id: profile.organisationId },
    select: { name: true },
  })

  // Send invitation email (non-blocking — don't fail the request if email fails)
  const emailResult = await sendInvitationEmail({
    to: email,
    inviteeName: fullName,
    organisationName: org?.name || 'your organisation',
    inviterName: profile.fullName,
    token: invitation.token,
    expiresAt: invitation.expiresAt,
  })

  // Update invitation status based on email delivery
  if (emailResult.success) {
    await prisma.invitation.update({
      where: { id: invitation.id },
      data: { status: 'SENT', sentAt: new Date() },
    })
  }

  // Audit trail
  await recordAuditEvent({
    organisationId: profile.organisationId,
    actorId: profile.id,
    action: AuditActions.INVITATION_CREATED,
    entityType: 'invitation',
    entityId: invitation.id,
    metadata: {
      email,
      fullName,
      emailSent: emailResult.success,
      emailError: emailResult.error || undefined,
    },
    ipAddress: request.headers.get('x-forwarded-for') || undefined,
  })

  return success({
    invitation,
    emailSent: emailResult.success,
    emailError: emailResult.error || undefined,
  }, 201)
}, { requiredPermission: 'MANAGER' })

/**
 * GET /api/invitations — List invitations for the organisation.
 * Only org admins/managers can view.
 */
export const GET = withAuth(async (_request: NextRequest, { profile }) => {
  const invitations = await prisma.invitation.findMany({
    where: { organisationId: profile.organisationId },
    orderBy: { createdAt: 'desc' },
    include: {
      createdBy: { select: { fullName: true } },
    },
  })

  return success({ invitations })
}, { requiredPermission: 'MANAGER' })

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { recordAuditEvent, AuditActions } from '@/lib/audit'
import { success } from '@/lib/api-response'
import { ValidationError, NotFoundError } from '@/lib/errors'
import { withAuth } from '@/lib/with-auth'
import { sendInvitationEmail } from '@/lib/email'

/**
 * POST /api/invitations/resend — Resend an existing invitation email.
 * Body: { invitationId: string }
 */
export const POST = withAuth(async (request: NextRequest, { profile }) => {
  const body = await request.json()
  const { invitationId } = body

  if (!invitationId) {
    throw new ValidationError('Invitation ID is required')
  }

  const invitation = await prisma.invitation.findFirst({
    where: {
      id: invitationId,
      organisationId: profile.organisationId,
    },
  })

  if (!invitation) {
    throw new NotFoundError('Invitation not found')
  }

  if (invitation.status === 'ACTIVATED' || invitation.status === 'REVOKED') {
    throw new ValidationError(`Cannot resend a ${invitation.status.toLowerCase()} invitation`)
  }

  // Extend expiry if it's already expired
  const now = new Date()
  const newExpiry = invitation.expiresAt < now
    ? new Date(Date.now() + 48 * 60 * 60 * 1000)
    : invitation.expiresAt

  const org = await prisma.organisation.findUnique({
    where: { id: profile.organisationId },
    select: { name: true },
  })

  const emailResult = await sendInvitationEmail({
    to: invitation.email,
    inviteeName: invitation.fullName,
    organisationName: org?.name || 'your organisation',
    inviterName: profile.fullName,
    token: invitation.token,
    expiresAt: newExpiry,
  })

  if (emailResult.success) {
    await prisma.invitation.update({
      where: { id: invitation.id },
      data: {
        status: 'SENT',
        sentAt: new Date(),
        expiresAt: newExpiry,
      },
    })
  }

  await recordAuditEvent({
    organisationId: profile.organisationId,
    actorId: profile.id,
    action: AuditActions.INVITATION_CREATED,
    entityType: 'invitation',
    entityId: invitation.id,
    metadata: {
      email: invitation.email,
      action: 'resend',
      emailSent: emailResult.success,
      emailError: emailResult.error || undefined,
    },
    ipAddress: request.headers.get('x-forwarded-for') || undefined,
  })

  return success({
    emailSent: emailResult.success,
    emailError: emailResult.error || undefined,
  })
}, { requiredPermission: 'MANAGER' })

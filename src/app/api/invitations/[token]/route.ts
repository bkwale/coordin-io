import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { success, error as apiError } from '@/lib/api-response'
import { NotFoundError } from '@/lib/errors'

/**
 * GET /api/invitations/:token — Validate an invitation token.
 * Public endpoint — no auth required (this is the link the employee clicks).
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params

    const invitation = await prisma.invitation.findUnique({
      where: { token },
      include: {
        organisation: { select: { name: true, logoUrl: true } },
      },
    })

    if (!invitation) {
      throw new NotFoundError('Invitation not found')
    }

    // Check if already used
    if (invitation.status === 'ACTIVATED') {
      return success({
        error: 'This invitation has already been used',
        status: 'activated',
      })
    }

    // Check if revoked
    if (invitation.status === 'REVOKED') {
      return success({
        error: 'This invitation has been revoked',
        status: 'revoked',
      })
    }

    // Check expiry
    if (new Date() > invitation.expiresAt) {
      // Mark as expired if not already
      if (invitation.status !== 'EXPIRED') {
        await prisma.invitation.update({
          where: { id: invitation.id },
          data: { status: 'EXPIRED' },
        })
      }
      return success({
        error: 'This invitation has expired',
        status: 'expired',
      })
    }

    // Return public invitation details (no sensitive data)
    return success({
      invitation: {
        email: invitation.email,
        fullName: invitation.fullName,
        jobTitle: invitation.jobTitle,
        organisationName: invitation.organisation.name,
        organisationLogo: invitation.organisation.logoUrl,
        expiresAt: invitation.expiresAt,
      },
    })
  } catch (err) {
    return apiError(err)
  }
}

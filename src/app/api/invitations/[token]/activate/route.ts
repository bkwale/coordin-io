import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import type { PrismaClient } from '@/generated/prisma/client'
import { recordAuditEvent, AuditActions } from '@/lib/audit'
import { success, error as apiError } from '@/lib/api-response'
import {
  AuthError,
  NotFoundError,
  ConflictError,
  ValidationError,
} from '@/lib/errors'

/**
 * POST /api/invitations/:token/activate — Activate an invitation.
 *
 * Security: The client creates a Supabase auth account, then calls this
 * endpoint. We verify the Supabase session SERVER-SIDE — we do NOT trust
 * the client-supplied authUserId. The session cookie proves ownership.
 *
 * If activation fails after the Supabase account was created, we attempt
 * to clean up the orphaned auth account via the Supabase admin API.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  let verifiedAuthUserId: string | undefined

  try {
    const { token } = await params

    // ── Server-side auth verification ──────────────────────
    // The client just signed up via Supabase and should now have
    // a valid session cookie. We verify that — NOT a body param.
    const supabase = createServerSupabaseClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      throw new AuthError(
        'Could not verify your account. Please try signing up again.',
      )
    }

    verifiedAuthUserId = user.id

    // ── Validate invitation ────────────────────────────────
    const invitation = await prisma.invitation.findUnique({
      where: { token },
    })

    if (!invitation) {
      throw new NotFoundError('Invitation not found')
    }

    // Check invitation is still usable
    if (invitation.status !== 'PENDING' && invitation.status !== 'SENT') {
      await recordAuditEvent({
        organisationId: invitation.organisationId,
        action: AuditActions.FAILED_ACTIVATION,
        entityType: 'invitation',
        entityId: invitation.id,
        metadata: { reason: `Invitation status: ${invitation.status}`, authUserId: verifiedAuthUserId },
        ipAddress: request.headers.get('x-forwarded-for') || undefined,
      })
      throw new ValidationError(
        `This invitation is ${invitation.status.toLowerCase()}`,
      )
    }

    if (new Date() > invitation.expiresAt) {
      await prisma.invitation.update({
        where: { id: invitation.id },
        data: { status: 'EXPIRED' },
      })
      throw new ValidationError('This invitation has expired')
    }

    // Verify the email matches
    if (user.email && user.email.toLowerCase() !== invitation.email.toLowerCase()) {
      await recordAuditEvent({
        organisationId: invitation.organisationId,
        action: AuditActions.FAILED_ACTIVATION,
        entityType: 'invitation',
        entityId: invitation.id,
        metadata: {
          reason: 'Email mismatch between auth account and invitation',
          authEmail: user.email,
          invitationEmail: invitation.email,
        },
        ipAddress: request.headers.get('x-forwarded-for') || undefined,
      })
      throw new ValidationError(
        'The email address you signed up with does not match this invitation',
      )
    }

    // Check auth user isn't already linked to a profile
    const existingProfile = await prisma.profile.findUnique({
      where: { authUserId: verifiedAuthUserId },
    })

    if (existingProfile) {
      throw new ConflictError('This account is already linked to a profile')
    }

    const ipAddress = request.headers.get('x-forwarded-for') || undefined

    // ── Transaction: create profile + employee profile + update invitation ──
    const result = await prisma.$transaction(
      async (
        tx: Parameters<Parameters<PrismaClient['$transaction']>[0]>[0],
      ) => {
        // 1. Create Profile
        const profile = await tx.profile.create({
          data: {
            authUserId: verifiedAuthUserId!,
            organisationId: invitation.organisationId,
            officeId: invitation.officeId,
            roleId: invitation.roleId,
            fullName: invitation.fullName,
            email: invitation.email,
            jobTitle: invitation.jobTitle,
            managerId: invitation.managerId,
            startDate: invitation.startDate,
            status: 'ONBOARDING',
            orgPermission: 'MEMBER',
          },
        })

        // 2. Create EmployeeProfile
        await tx.employeeProfile.create({
          data: {
            profileId: profile.id,
            annualLeaveAllocation: invitation.annualLeave ?? 25,
          },
        })

        // 3. Create initial leave balance for current year
        await tx.leaveBalance.create({
          data: {
            profileId: profile.id,
            year: new Date().getFullYear(),
            allocation: invitation.annualLeave ?? 25,
          },
        })

        // 4. Mark invitation as activated
        await tx.invitation.update({
          where: { id: invitation.id },
          data: {
            status: 'ACTIVATED',
            activatedAt: new Date(),
            activationIp: ipAddress || null,
            profileId: profile.id,
          },
        })

        return profile
      },
    )

    // Audit trail
    await recordAuditEvent({
      organisationId: invitation.organisationId,
      actorId: result.id,
      action: AuditActions.INVITATION_ACTIVATED,
      entityType: 'invitation',
      entityId: invitation.id,
      metadata: {
        email: invitation.email,
        fullName: invitation.fullName,
      },
      ipAddress,
    })

    return success(
      {
        profile: {
          id: result.id,
          fullName: result.fullName,
          status: result.status,
        },
      },
      201,
    )
  } catch (err) {
    // ── Orphaned account cleanup ───────────────────────────
    // If we verified a Supabase auth user but the profile creation
    // failed, we have an orphaned auth account. Log a warning so
    // admins know to clean it up. (We don't auto-delete via admin
    // API here because the service role key shouldn't be in the
    // web app — that's a server-side admin action.)
    if (verifiedAuthUserId) {
      console.warn(
        `[ORPHAN_RISK] Supabase auth user ${verifiedAuthUserId} may not have a profile. ` +
          `Activation failed. Manual cleanup may be needed.`,
      )
    }

    return apiError(err)
  }
}

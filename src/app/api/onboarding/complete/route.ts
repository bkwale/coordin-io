import type { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { success } from '@/lib/api-response'
import { ValidationError } from '@/lib/errors'
import { recordAuditEvent, AuditActions } from '@/lib/audit'
import { withAuth } from '@/lib/with-auth'

/**
 * POST /api/onboarding/complete — Finish onboarding.
 *
 * Validates that all mandatory policies are acknowledged and all
 * mandatory training is completed. If so, updates profile status
 * from ONBOARDING to ACTIVE.
 */
export const POST = withAuth(async (request: NextRequest, { profile }) => {
  const orgId = profile.organisationId

  // ── Check mandatory policies ──────────────────────────────
  const totalPolicies = await prisma.policyDocument.count({
    where: { organisationId: orgId, mandatory: true },
  })

  const acknowledgedPolicies = await prisma.policyAcknowledgement.count({
    where: {
      profileId: profile.id,
      acknowledged: true,
      policy: { organisationId: orgId, mandatory: true },
    },
  })

  // ── Check mandatory training ──────────────────────────────
  const totalTraining = await prisma.trainingItem.count({
    where: { mandatory: true },
  })

  const completedTraining = await prisma.trainingCompletion.count({
    where: {
      profileId: profile.id,
      completedAt: { not: null },
      training: { mandatory: true },
    },
  })

  // ── Gather missing items ──────────────────────────────────
  const missing: string[] = []

  if (totalPolicies > 0 && acknowledgedPolicies < totalPolicies) {
    missing.push(
      `${totalPolicies - acknowledgedPolicies} of ${totalPolicies} mandatory policies not acknowledged`,
    )
  }

  if (totalTraining > 0 && completedTraining < totalTraining) {
    missing.push(
      `${totalTraining - completedTraining} of ${totalTraining} mandatory training items not completed`,
    )
  }

  if (missing.length > 0) {
    throw new ValidationError('Onboarding is not complete', { missing })
  }

  // ── Update profile status ─────────────────────────────────
  const updatedProfile = await prisma.profile.update({
    where: { id: profile.id },
    data: { status: 'ACTIVE' },
  })

  // Update employee profile onboarding flag
  if (profile.employeeProfile) {
    await prisma.employeeProfile.update({
      where: { id: profile.employeeProfile.id },
      data: {
        onboardingComplete: true,
        onboardingCompletedAt: new Date(),
      },
    })
  }

  // Audit trail
  await recordAuditEvent({
    organisationId: orgId,
    actorId: profile.id,
    action: AuditActions.ONBOARDING_COMPLETED,
    entityType: 'profile',
    entityId: profile.id,
    metadata: {
      policiesAcknowledged: acknowledgedPolicies,
      trainingCompleted: completedTraining,
    },
    ipAddress: request.headers.get('x-forwarded-for') || undefined,
  })

  return success({
    status: updatedProfile.status,
    message: 'Onboarding complete — welcome to the team!',
  })
})

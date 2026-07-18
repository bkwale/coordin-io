import type { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { success } from '@/lib/api-response'
import { withAuth } from '@/lib/with-auth'

/**
 * GET /api/onboarding — Returns the current user's onboarding progress.
 *
 * Checks:
 * - welcome: always completed (they reached the page)
 * - policies: mandatory PolicyDocuments for org vs acknowledged
 * - training: mandatory TrainingItems vs completed
 * - profile: optional fields filled on Profile + EmployeeProfile
 */
export const GET = withAuth(async (_request: NextRequest, { profile }) => {
  const orgId = profile.organisationId

  // ── Policies ──────────────────────────────────────────────
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

  // ── Training ──────────────────────────────────────────────
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

  // ── Profile completeness ──────────────────────────────────
  const profileFields = [profile.phone, profile.avatarUrl] as const
  const employeeProfile = profile.employeeProfile
  const employeeFields = employeeProfile
    ? [employeeProfile.emergencyName, employeeProfile.emergencyPhone]
    : [null, null]

  const allFields = [...profileFields, ...employeeFields]
  const fieldsTotal = allFields.length
  const fieldsComplete = allFields.filter((f) => f !== null && f !== undefined && f !== '').length

  // ── Overall completeness ──────────────────────────────────
  const policiesDone = totalPolicies > 0 ? acknowledgedPolicies >= totalPolicies : true
  const trainingDone = totalTraining > 0 ? completedTraining >= totalTraining : true
  const overallComplete = policiesDone && trainingDone

  return success({
    status: profile.status,
    steps: {
      welcome: { completed: true },
      policies: {
        completed: policiesDone,
        total: totalPolicies,
        acknowledged: acknowledgedPolicies,
      },
      training: {
        completed: trainingDone,
        total: totalTraining,
        done: completedTraining,
      },
      profile: {
        completed: fieldsComplete === fieldsTotal,
        fieldsComplete,
        fieldsTotal,
      },
    },
    overallComplete,
  })
})

import { NextRequest } from 'next/server'
import { success } from '@/lib/api-response'
import { withAuth } from '@/lib/with-auth'
import { modulesPrisma } from '@/lib/prisma-modules'
import { recordAuditEvent } from '@/lib/audit'
import { requireString, optionalString, optionalDate, optionalNumber, parseBody } from '@/lib/validation'
import { NotFoundError, PermissionError } from '@/lib/errors'

/**
 * POST /api/staffing/training/completions — Record a training completion.
 *
 * Fields: trainingId, profileId, completedAt, score, certificateUrl
 */
export const POST = withAuth(async (request: NextRequest, { profile }) => {
  const isAdmin = profile.orgPermission === 'ADMIN' || profile.orgPermission === 'OWNER'
  const isManager = profile.orgPermission === 'MANAGER'

  if (!isAdmin && !isManager) {
    throw new PermissionError('Only admins and managers can record training completions')
  }

  const body = await parseBody(request)

  const trainingId = requireString(body.trainingId, 'trainingId')
  const targetProfileId = requireString(body.profileId, 'profileId')
  const completedAt = optionalDate(body.completedAt, 'completedAt') ?? new Date()
  const score = optionalNumber(body.score, 'score', { min: 0, max: 100 })
  const certificateUrl = optionalString(body.certificateUrl, 'certificateUrl', 2000)

  // Verify training item exists
  const trainingItem = await modulesPrisma.trainingItem.findUnique({
    where: { id: trainingId },
  })
  if (!trainingItem) {
    throw new NotFoundError('Training item not found')
  }

  // Verify target profile exists
  const targetProfile = await modulesPrisma.profile.findUnique({
    where: { id: targetProfileId },
    select: { id: true, organisationId: true, fullName: true },
  })
  if (!targetProfile || targetProfile.organisationId !== profile.organisationId) {
    throw new PermissionError('Employee not found in your organisation')
  }

  // Upsert: if a completion already exists, update it
  const completion = await modulesPrisma.trainingCompletion.upsert({
    where: {
      profileId_trainingId: {
        profileId: targetProfileId,
        trainingId,
      },
    },
    create: {
      profileId: targetProfileId,
      trainingId,
      completedAt,
      score,
      certificateUrl,
    },
    update: {
      completedAt,
      score,
      certificateUrl,
    },
    include: {
      profile: { select: { id: true, fullName: true } },
      training: { select: { id: true, title: true } },
    },
  })

  await recordAuditEvent({
    organisationId: profile.organisationId,
    actorId: profile.id,
    action: 'staffing.training_completion_recorded',
    entityType: 'training_completion',
    entityId: completion.id,
    metadata: {
      trainingId,
      profileId: targetProfileId,
      trainingTitle: trainingItem.title as string,
    },
  })

  return success({ completion }, 201)
})

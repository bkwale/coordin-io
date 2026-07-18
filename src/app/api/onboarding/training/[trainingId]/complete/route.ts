import type { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { success } from '@/lib/api-response'
import { NotFoundError, ConflictError } from '@/lib/errors'
import { recordAuditEvent, AuditActions } from '@/lib/audit'
import { withAuth } from '@/lib/with-auth'

/**
 * POST /api/onboarding/training/[trainingId]/complete
 *
 * Mark a training item as completed. Body: { score?: number }
 */
export const POST = withAuth(async (
  request: NextRequest,
  { profile },
) => {
  // Extract trainingId from URL
  const url = new URL(request.url)
  const segments = url.pathname.split('/')
  const trainingId = segments[segments.indexOf('training') + 1]

  if (!trainingId) {
    throw new NotFoundError('Training ID is required')
  }

  // Parse optional score from body
  let score: number | undefined
  try {
    const body = await request.json()
    score = body.score ?? undefined
  } catch {
    // Empty body is valid — score is optional
  }

  // Verify the training item exists and is mandatory
  const trainingItem = await prisma.trainingItem.findFirst({
    where: { id: trainingId, mandatory: true },
  })

  if (!trainingItem) {
    throw new NotFoundError('Training item not found')
  }

  // Check if already completed
  const existing = await prisma.trainingCompletion.findUnique({
    where: {
      profileId_trainingId: {
        profileId: profile.id,
        trainingId: trainingItem.id,
      },
    },
  })

  if (existing?.completedAt) {
    throw new ConflictError('Training item already completed')
  }

  // Create or update completion
  const completion = existing
    ? await prisma.trainingCompletion.update({
        where: { id: existing.id },
        data: {
          completedAt: new Date(),
          score: score ?? null,
        },
      })
    : await prisma.trainingCompletion.create({
        data: {
          profileId: profile.id,
          trainingId: trainingItem.id,
          completedAt: new Date(),
          score: score ?? null,
        },
      })

  // Audit trail
  await recordAuditEvent({
    organisationId: profile.organisationId,
    actorId: profile.id,
    action: AuditActions.ONBOARDING_ITEM_ACKNOWLEDGED,
    entityType: 'training_completion',
    entityId: completion.id,
    metadata: { trainingId: trainingItem.id, trainingTitle: trainingItem.title, score },
    ipAddress: request.headers.get('x-forwarded-for') || undefined,
  })

  return success({ completion })
})

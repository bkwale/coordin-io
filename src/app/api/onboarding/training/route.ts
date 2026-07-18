import type { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { success } from '@/lib/api-response'
import { withAuth } from '@/lib/with-auth'

/**
 * GET /api/onboarding/training — Returns mandatory training items
 * with the current user's completion status.
 */
export const GET = withAuth(async (_request: NextRequest, { profile }) => {
  const items = await prisma.trainingItem.findMany({
    where: { mandatory: true },
    orderBy: { createdAt: 'asc' },
    include: {
      completions: {
        where: { profileId: profile.id },
        take: 1,
      },
    },
  })

  const mapped = items.map((item) => {
    const completion = item.completions[0] ?? null
    return {
      id: item.id,
      title: item.title,
      description: item.description,
      mandatory: item.mandatory,
      durationMinutes: item.durationMinutes,
      contentUrl: item.contentUrl,
      completed: completion?.completedAt !== null && completion?.completedAt !== undefined,
      completedAt: completion?.completedAt ?? null,
      score: completion?.score ?? null,
    }
  })

  return success({ training: mapped })
})

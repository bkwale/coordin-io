import { NextRequest } from 'next/server'
import { success } from '@/lib/api-response'
import { withAuth } from '@/lib/with-auth'
import { modulesPrisma } from '@/lib/prisma-modules'
import { recordAuditEvent } from '@/lib/audit'
import { requireString, optionalString, requireDate, optionalDate, parseBody } from '@/lib/validation'
import { PermissionError } from '@/lib/errors'

/**
 * GET /api/staffing/probation — List probation reviews.
 *
 * Query params:
 * - profileId: filter by employee
 * - pending: 'true' to show only incomplete reviews
 */
export const GET = withAuth(async (request: NextRequest, { profile }) => {
  const url = new URL(request.url)
  const profileIdFilter = url.searchParams.get('profileId')
  const pendingOnly = url.searchParams.get('pending') === 'true'

  const isAdmin = profile.orgPermission === 'ADMIN' || profile.orgPermission === 'OWNER'

  const where: Record<string, unknown> = {
    profile: { organisationId: profile.organisationId },
  }

  if (profileIdFilter) {
    where.profileId = profileIdFilter
  } else if (!isAdmin) {
    // Non-admins see only their own
    where.profileId = profile.id
  }

  if (pendingOnly) {
    where.completedDate = null
  }

  const reviews = await modulesPrisma.probationReview.findMany({
    where,
    include: {
      profile: { select: { id: true, fullName: true, jobTitle: true, startDate: true } },
    },
    orderBy: { scheduledDate: 'asc' },
    take: 100,
  })

  return success({ reviews })
})

/**
 * POST /api/staffing/probation — Create a probation review.
 *
 * Admin/Owner only.
 */
export const POST = withAuth(async (request: NextRequest, { profile }) => {
  const isAdmin = profile.orgPermission === 'ADMIN' || profile.orgPermission === 'OWNER'
  if (!isAdmin) {
    throw new PermissionError('Only admins can create probation reviews')
  }

  const body = await parseBody(request)

  const targetProfileId = requireString(body.profileId, 'profileId')
  const reviewType = requireString(body.reviewType, 'reviewType', 50)

  const scheduledDate = requireDate(body.scheduledDate, 'scheduledDate')

  const objectives = optionalString(body.objectives, 'objectives', 5000)
  const feedback = optionalString(body.feedback, 'feedback', 5000)
  const outcome = optionalString(body.outcome, 'outcome', 50)

  // Verify profile in same org
  const targetProfile = await modulesPrisma.profile.findUnique({
    where: { id: targetProfileId },
    select: { organisationId: true },
  })
  if (!targetProfile || targetProfile.organisationId !== profile.organisationId) {
    throw new PermissionError('Employee not found in your organisation')
  }

  const completedDate = optionalDate(body.completedDate, 'completedDate')
  const nextReviewDate = optionalDate(body.nextReviewDate, 'nextReviewDate')

  const review = await modulesPrisma.probationReview.create({
    data: {
      profileId: targetProfileId,
      reviewType,
      scheduledDate,
      completedDate,
      reviewerId: body.reviewerId ?? profile.id,
      objectives: objectives ?? null,
      feedback: feedback ?? null,
      outcome: outcome ?? null,
      nextReviewDate,
    },
    include: {
      profile: { select: { id: true, fullName: true } },
    },
  })

  await recordAuditEvent({
    organisationId: profile.organisationId,
    actorId: profile.id,
    action: 'staffing.probation_review_created',
    entityType: 'probation_review',
    entityId: review.id,
    metadata: { targetProfileId, reviewType, scheduledDate: scheduledDate.toISOString() },
  })

  return success({ review }, 201)
})

import { NextRequest } from 'next/server'
import { success } from '@/lib/api-response'
import { withAuth } from '@/lib/with-auth'
import { modulesPrisma } from '@/lib/prisma-modules'
import { recordAuditEvent } from '@/lib/audit'
import { optionalString, optionalDate, parseBody } from '@/lib/validation'
import { PermissionError, NotFoundError } from '@/lib/errors'
import { canManageHR } from '@/lib/staffing-utils'
import { createNotification, NOTIFICATION_EVENTS } from '@/lib/notifications'
import type { OrgPermission } from '@/generated/prisma/client'

/**
 * GET /api/staffing/probation/[id] — Single probation review with profile info.
 *
 * Permission: HR+ sees any review; others see only their own.
 */
export const GET = withAuth(async (request: NextRequest, { profile }) => {
  const url = new URL(request.url)
  const id = url.pathname.split('/').pop()!

  const review = await modulesPrisma.probationReview.findUnique({
    where: { id },
    include: {
      profile: { select: { id: true, fullName: true, jobTitle: true, startDate: true } },
      goals: { orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] },
    },
  })

  if (!review) {
    throw new NotFoundError('Probation review not found')
  }

  // Verify same org
  const targetProfile = await modulesPrisma.profile.findUnique({
    where: { id: review.profileId },
    select: { organisationId: true },
  })
  if (!targetProfile || targetProfile.organisationId !== profile.organisationId) {
    throw new NotFoundError('Probation review not found')
  }

  const hasHRAccess = canManageHR(profile.orgPermission as OrgPermission)

  // Non-HR can only view their own reviews
  if (!hasHRAccess && review.profileId !== profile.id) {
    throw new PermissionError('You do not have access to this probation review')
  }

  return success({ review })
})

/**
 * PATCH /api/staffing/probation/[id] — Update a probation review.
 *
 * Permission: HR+ only (HR, ADMIN, OWNER).
 *
 * Accepts optional fields: feedback, objectives, outcome, completedDate,
 * nextReviewDate, reviewerId.
 *
 * When completedDate is set (review being completed), sends a notification
 * to the employee.
 */
export const PATCH = withAuth(async (request: NextRequest, { profile }) => {
  const url = new URL(request.url)
  const id = url.pathname.split('/').pop()!

  if (!canManageHR(profile.orgPermission as OrgPermission)) {
    throw new PermissionError('Only HR managers and admins can update probation reviews')
  }

  const existing = await modulesPrisma.probationReview.findUnique({
    where: { id },
    include: {
      profile: { select: { id: true, fullName: true, organisationId: true } },
    },
  })

  if (!existing) {
    throw new NotFoundError('Probation review not found')
  }

  // Verify review belongs to the same org
  const reviewProfile = existing.profile as { id: string; fullName: string; organisationId: string }
  if (reviewProfile.organisationId !== profile.organisationId) {
    throw new NotFoundError('Probation review not found')
  }

  const body = await parseBody(request)

  const feedback = optionalString(body.feedback, 'feedback', 5000)
  const objectives = optionalString(body.objectives, 'objectives', 5000)
  const outcome = optionalString(body.outcome, 'outcome', 50)
  const completedDate = optionalDate(body.completedDate, 'completedDate')
  const nextReviewDate = optionalDate(body.nextReviewDate, 'nextReviewDate')
  const reviewerId = optionalString(body.reviewerId, 'reviewerId', 100)

  const updateData: Record<string, unknown> = {}
  if (feedback !== null) updateData.feedback = feedback
  if (objectives !== null) updateData.objectives = objectives
  if (outcome !== null) updateData.outcome = outcome
  if (completedDate !== null) updateData.completedDate = completedDate
  if (nextReviewDate !== null) updateData.nextReviewDate = nextReviewDate
  if (reviewerId !== null) updateData.reviewerId = reviewerId

  const review = await modulesPrisma.probationReview.update({
    where: { id },
    data: updateData,
    include: {
      profile: { select: { id: true, fullName: true } },
    },
  })

  await recordAuditEvent({
    organisationId: profile.organisationId,
    actorId: profile.id,
    action: 'staffing.probation_review_updated',
    entityType: 'probation_review',
    entityId: id,
    metadata: { outcome: outcome ?? undefined },
  })

  // If review is being completed, notify the employee
  if (completedDate && existing.profileId !== profile.id) {
    await createNotification({
      profileId: existing.profileId,
      type: NOTIFICATION_EVENTS.PROBATION_REVIEW_SCHEDULED,
      title: `Your probation review has been completed`,
      linkUrl: `/staffing/employees/${existing.profileId}`,
    }).catch(() => {})
  }

  return success({ review })
})

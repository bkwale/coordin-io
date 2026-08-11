import type { NextRequest } from 'next/server'
import { modulesPrisma as prisma } from '@/lib/prisma-modules'
import { success } from '@/lib/api-response'
import { withProjectAccess } from '@/lib/with-project-access'
import { recordAuditEvent, AuditActions } from '@/lib/audit'
import { parseBody, optionalString, optionalEnum, optionalDate, optionalId } from '@/lib/validation'
import { NotFoundError } from '@/lib/errors'
import { createNotification, NOTIFICATION_EVENTS } from '@/lib/notifications'

const REVIEW_TYPES = [
  'INTERNAL', 'CLIENT', 'OPERATOR', 'ARCHITECTURE', 'INTERIORS',
  'STRUCTURE', 'MEP', 'FIRE', 'LANDSCAPE', 'SUSTAINABILITY',
  'ACCESSIBILITY', 'COMMERCIAL', 'MODEL_ROOM', 'SHOP_DRAWING',
] as const

const REVIEW_STATUSES = [
  'DRAFT', 'SCHEDULED', 'IN_PROGRESS', 'UNDER_REVIEW', 'COMPLETED', 'CLOSED',
] as const

/**
 * Extract reviewId from the URL path.
 */
function extractReviewId(request: NextRequest): string {
  const url = new URL(request.url)
  const segments = url.pathname.split('/')
  const reviewIdx = segments.indexOf('design-reviews')
  const reviewId = reviewIdx >= 0 ? segments[reviewIdx + 1] : undefined
  if (!reviewId) throw new NotFoundError('Review ID is required')
  return reviewId
}

/**
 * GET /api/projects/[id]/design-reviews/[reviewId] — Single design review with comments.
 */
export const GET = withProjectAccess(async (request: NextRequest, { projectId }) => {
  const reviewId = extractReviewId(request)

  const review = await (prisma as any).designReview.findFirst({
    where: { id: reviewId, projectId },
    include: {
      comments: {
        orderBy: { commentNumber: 'asc' },
      },
    },
  })

  if (!review) {
    throw new NotFoundError('Design review not found')
  }

  return success({ review })
})

/**
 * PATCH /api/projects/[id]/design-reviews/[reviewId] — Update a design review.
 */
export const PATCH = withProjectAccess(async (request: NextRequest, { projectId, profile }) => {
  const reviewId = extractReviewId(request)
  const body = await parseBody(request)

  const existing = await (prisma as any).designReview.findFirst({
    where: { id: reviewId, projectId },
  })

  if (!existing) {
    throw new NotFoundError('Design review not found')
  }

  const data: Record<string, unknown> = {}

  if (body.title !== undefined) {
    data.title = optionalString(body.title, 'Title', 500)
  }
  if (body.reviewType !== undefined) {
    data.reviewType = optionalEnum(body.reviewType, 'Review type', REVIEW_TYPES)
  }
  if (body.discipline !== undefined) {
    data.discipline = optionalString(body.discipline, 'Discipline', 100)
  }
  if (body.stage !== undefined) {
    data.stage = optionalString(body.stage, 'Stage', 100)
  }
  if (body.status !== undefined) {
    data.status = optionalEnum(body.status, 'Status', REVIEW_STATUSES)
  }
  if (body.scheduledDate !== undefined) {
    data.scheduledDate = optionalDate(body.scheduledDate, 'Scheduled date')
  }
  if (body.completedDate !== undefined) {
    data.completedDate = optionalDate(body.completedDate, 'Completed date')
  }
  if (body.leadReviewerId !== undefined) {
    data.leadReviewerId = optionalId(body.leadReviewerId, 'Lead reviewer ID')
  }
  if (body.summary !== undefined) {
    data.summary = optionalString(body.summary, 'Summary', 5000)
  }

  if (Object.keys(data).length === 0) {
    return success({ review: existing })
  }

  const review = await (prisma as any).designReview.update({
    where: { id: reviewId },
    data,
  })

  await recordAuditEvent({
    organisationId: profile.organisationId,
    actorId: profile.id,
    action: AuditActions.DESIGN_REVIEW_UPDATED,
    entityType: 'DesignReview',
    entityId: reviewId,
    metadata: { updatedFields: Object.keys(data) },
    ipAddress: request.headers.get('x-forwarded-for') || undefined,
  })

  // Notify on lead reviewer reassignment
  if (data.leadReviewerId && data.leadReviewerId !== profile.id && data.leadReviewerId !== existing.leadReviewerId) {
    await createNotification({
      profileId: data.leadReviewerId as string,
      type: NOTIFICATION_EVENTS.DOCUMENT_REVIEW_REQUESTED,
      title: `You were assigned as lead reviewer on: ${review.title}`,
      linkUrl: `/projects/${projectId}/design-reviews/${reviewId}`,
    }).catch(() => {})
  }
  // Notify lead reviewer on status change
  if (data.status && data.status !== existing.status && review.leadReviewerId && review.leadReviewerId !== profile.id) {
    await createNotification({
      profileId: review.leadReviewerId,
      type: NOTIFICATION_EVENTS.TASK_STATUS_CHANGED,
      title: `Design review "${review.title}" moved to ${data.status}`,
      linkUrl: `/projects/${projectId}/design-reviews/${reviewId}`,
    }).catch(() => {})
  }

  return success({ review })
})

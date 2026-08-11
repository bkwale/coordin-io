import type { NextRequest } from 'next/server'
import { modulesPrisma as prisma } from '@/lib/prisma-modules'
import { success } from '@/lib/api-response'
import { withProjectAccess } from '@/lib/with-project-access'
import { recordAuditEvent, AuditActions } from '@/lib/audit'
import { parseBody, requireString, optionalString, optionalEnum, optionalDate, optionalId } from '@/lib/validation'
import { NotFoundError } from '@/lib/errors'
import { createNotification, NOTIFICATION_EVENTS } from '@/lib/notifications'

const CLASSIFICATIONS = [
  'COMMENT', 'ACTION', 'DECISION', 'INFORMATION',
] as const

const SEVERITIES = [
  'MINOR', 'MAJOR', 'CRITICAL', 'OBSERVATION',
] as const

const COMMENT_STATUSES = [
  'OPEN', 'RESPONDED', 'ACCEPTED', 'REJECTED', 'REOPENED', 'CLOSED',
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
 * GET /api/projects/[id]/design-reviews/[reviewId]/comments — List comments for a review.
 *
 * Optional query params: ?status=, ?classification=, ?severity=
 */
export const GET = withProjectAccess(async (request: NextRequest, { projectId }) => {
  const reviewId = extractReviewId(request)

  // Verify review exists and belongs to this project
  const review = await (prisma as any).designReview.findFirst({
    where: { id: reviewId, projectId },
    select: { id: true },
  })

  if (!review) {
    throw new NotFoundError('Design review not found')
  }

  const url = new URL(request.url)
  const status = url.searchParams.get('status')
  const classification = url.searchParams.get('classification')
  const severity = url.searchParams.get('severity')

  const where: Record<string, unknown> = { reviewId }
  if (status && (COMMENT_STATUSES as readonly string[]).includes(status)) where.status = status
  if (classification && (CLASSIFICATIONS as readonly string[]).includes(classification)) where.classification = classification
  if (severity && (SEVERITIES as readonly string[]).includes(severity)) where.severity = severity

  const comments = await (prisma as any).designReviewComment.findMany({
    where,
    orderBy: { commentNumber: 'asc' },
  })

  return success({ comments })
})

/**
 * POST /api/projects/[id]/design-reviews/[reviewId]/comments — Create a comment.
 *
 * Auto-numbers by counting existing comments for the review + 1.
 */
export const POST = withProjectAccess(async (request: NextRequest, { profile, projectId }) => {
  const reviewId = extractReviewId(request)
  const body = await parseBody(request)

  // Verify review exists and belongs to this project
  const review = await (prisma as any).designReview.findFirst({
    where: { id: reviewId, projectId },
    select: { id: true, reviewNumber: true, leadReviewerId: true, title: true },
  })

  if (!review) {
    throw new NotFoundError('Design review not found')
  }

  const description = requireString(body.description, 'Description', 5000)
  const discipline = optionalString(body.discipline, 'Discipline', 100)
  const drawingRef = optionalString(body.drawingRef, 'Drawing reference', 200)
  const classification = optionalEnum(body.classification, 'Classification', CLASSIFICATIONS)
  const severity = optionalEnum(body.severity, 'Severity', SEVERITIES)
  const ownerId = optionalId(body.ownerId, 'Owner ID')
  const dueDate = optionalDate(body.dueDate, 'Due date')

  // Auto-number: count existing comments for this review
  const existingCount = await (prisma as any).designReviewComment.count({
    where: { reviewId },
  })
  const commentNumber = existingCount + 1

  const comment = await (prisma as any).designReviewComment.create({
    data: {
      reviewId,
      commentNumber,
      description,
      status: 'OPEN',
      discipline: discipline || null,
      drawingRef: drawingRef || null,
      classification: classification || null,
      severity: severity || null,
      ownerId: ownerId || null,
      dueDate,
      createdById: profile.id,
    },
  })

  await recordAuditEvent({
    organisationId: profile.organisationId,
    actorId: profile.id,
    action: AuditActions.DESIGN_REVIEW_COMMENT_CREATED,
    entityType: 'DesignReviewComment',
    entityId: comment.id,
    metadata: { reviewId, reviewNumber: review.reviewNumber, commentNumber, projectId },
    ipAddress: request.headers.get('x-forwarded-for') || undefined,
  })

  // Notify the design review lead about the new comment
  if (review.leadReviewerId && review.leadReviewerId !== profile.id) {
    await createNotification({
      profileId: review.leadReviewerId,
      type: NOTIFICATION_EVENTS.TASK_COMMENT,
      title: `New comment on design review: ${review.title || review.reviewNumber}`,
      linkUrl: `/projects/${projectId}/design-reviews/${reviewId}`,
    }).catch(() => {})
  }
  // Notify the comment owner if different from author and lead
  if (ownerId && ownerId !== profile.id && ownerId !== review.leadReviewerId) {
    await createNotification({
      profileId: ownerId,
      type: NOTIFICATION_EVENTS.TASK_ASSIGNED,
      title: `You were assigned a design review comment on: ${review.title || review.reviewNumber}`,
      linkUrl: `/projects/${projectId}/design-reviews/${reviewId}`,
    }).catch(() => {})
  }

  return success({ comment }, 201)
})

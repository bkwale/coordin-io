import type { NextRequest } from 'next/server'
import { modulesPrisma as prisma } from '@/lib/prisma-modules'
import { success } from '@/lib/api-response'
import { withProjectAccess } from '@/lib/with-project-access'
import { recordAuditEvent, AuditActions } from '@/lib/audit'
import { parseBody, requireString, optionalString, optionalEnum, optionalDate, optionalId } from '@/lib/validation'
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
 * GET /api/projects/[id]/design-reviews — List design reviews for a project.
 *
 * Optional query params: ?status=, ?reviewType=, ?discipline=
 */
export const GET = withProjectAccess(async (request: NextRequest, { projectId }) => {
  const url = new URL(request.url)
  const status = url.searchParams.get('status')
  const reviewType = url.searchParams.get('reviewType')
  const discipline = url.searchParams.get('discipline')

  const where: Record<string, unknown> = { projectId }
  if (status && (REVIEW_STATUSES as readonly string[]).includes(status)) where.status = status
  if (reviewType && (REVIEW_TYPES as readonly string[]).includes(reviewType)) where.reviewType = reviewType
  if (discipline) where.discipline = discipline

  const reviews = await (prisma as any).designReview.findMany({
    where,
    orderBy: { createdAt: 'desc' },
  })

  return success({ reviews })
})

/**
 * POST /api/projects/[id]/design-reviews — Create a new design review.
 *
 * Auto-numbers as DR-001, DR-002, etc.
 */
export const POST = withProjectAccess(async (request: NextRequest, { profile, projectId }) => {
  const body = await parseBody(request)

  const title = requireString(body.title, 'Title', 500)
  const reviewType = optionalEnum(body.reviewType, 'Review type', REVIEW_TYPES)
  const discipline = optionalString(body.discipline, 'Discipline', 100)
  const stage = optionalString(body.stage, 'Stage', 100)
  const scheduledDate = optionalDate(body.scheduledDate, 'Scheduled date')
  const leadReviewerId = optionalId(body.leadReviewerId, 'Lead reviewer ID')
  const summary = optionalString(body.summary, 'Summary', 5000)

  // Auto-number: count existing reviews for this project
  const existingCount = await (prisma as any).designReview.count({
    where: { projectId },
  })
  const reviewNumber = `DR-${String(existingCount + 1).padStart(3, '0')}`

  const review = await (prisma as any).designReview.create({
    data: {
      projectId,
      reviewNumber,
      title,
      status: 'DRAFT',
      reviewType: reviewType || null,
      discipline: discipline || null,
      stage: stage || null,
      scheduledDate,
      leadReviewerId: leadReviewerId || null,
      summary: summary || null,
      createdById: profile.id,
    },
  })

  await recordAuditEvent({
    organisationId: profile.organisationId,
    actorId: profile.id,
    action: AuditActions.DESIGN_REVIEW_CREATED,
    entityType: 'DesignReview',
    entityId: review.id,
    metadata: { reviewNumber, title, projectId },
    ipAddress: request.headers.get('x-forwarded-for') || undefined,
  })

  // Notify lead reviewer
  if (leadReviewerId && leadReviewerId !== profile.id) {
    await createNotification({
      profileId: leadReviewerId,
      type: NOTIFICATION_EVENTS.DOCUMENT_REVIEW_REQUESTED,
      title: `You were assigned as lead reviewer on: ${title}`,
      linkUrl: `/projects/${projectId}/design-reviews/${review.id}`,
    }).catch(() => {})
  }

  return success({ review }, 201)
})

import { NextRequest } from 'next/server'
import { success } from '@/lib/api-response'
import { withAuth } from '@/lib/with-auth'
import { modulesPrisma } from '@/lib/prisma-modules'
import { recordAuditEvent } from '@/lib/audit'
import { optionalString, optionalDate, parseBody } from '@/lib/validation'
import { PermissionError, NotFoundError, ValidationError } from '@/lib/errors'
import { normaliseOutcome, isFinalReview, statusAfterFinalReview } from '@/lib/staffing/probation'
import { canManageHR } from '@/lib/staffing-utils'
import { createNotification, NOTIFICATION_EVENTS } from '@/lib/notifications'
import type { OrgPermission } from '@/generated/prisma/client'
import { loadReviewForActor } from '@/lib/staffing/probation-access'
import { allowedActions } from '@/lib/staffing/probation-workflow'

/**
 * GET /api/staffing/probation/[id] — Single probation review with profile info.
 *
 * Permission: HR+ sees any review; others see only their own.
 */
export const GET = withAuth(async (request: NextRequest, { profile }) => {
  const id = new URL(request.url).pathname.split('/').pop()!
  // Line manager, HR/Admin, or the employee once finalised (PT 2026-11-05)
  const { review, actor } = await loadReviewForActor(id, profile)
  return success({ review, actor, allowedActions: allowedActions(review.workflowStatus, actor) })
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
  const rawOutcome = optionalString(body.outcome, 'outcome', 50)
  const outcome = rawOutcome === null ? null : normaliseOutcome(rawOutcome)
  if (rawOutcome !== null && outcome === null) throw new ValidationError('outcome must be Pass, Extend or Fail')
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

  // Completing a review needs an outcome (BUG-016c)
  const completing = completedDate !== null && !existing.completedDate
  if (completing && !(outcome ?? existing.outcome)) {
    throw new ValidationError('Choose an outcome (Pass, Extend or Fail) to complete the review')
  }

  // A final review outcome moves the employee's probation status: Pass → Confirmed, Extend → Extended.
  // Fail is left for HR to action.
  // The final decision is a review typed final/end-of-probation, or — for older records without one —
  // the last scheduled review for this employee (e.g. a 90-day review on a 3-month probation).
  let isFinal = isFinalReview(existing.reviewType)
  if (completing && !isFinal) {
    const later = await modulesPrisma.probationReview.count({
      where: { profileId: existing.profileId, id: { not: id }, scheduledDate: { gt: existing.scheduledDate } },
    })
    isFinal = later === 0
  }
  const newStatus = completing && isFinal ? statusAfterFinalReview(outcome ?? existing.outcome) : null

  const review = await modulesPrisma.$transaction(async (tx: typeof modulesPrisma) => {
    const r = await tx.probationReview.update({
      where: { id },
      data: updateData,
      include: {
        profile: { select: { id: true, fullName: true } },
      },
    })
    if (newStatus) {
      await tx.employeeProfile.upsert({
        where: { profileId: existing.profileId },
        create: { profileId: existing.profileId, probationStatus: newStatus },
        update: { probationStatus: newStatus },
      })
    }
    return r
  })

  await recordAuditEvent({
    organisationId: profile.organisationId,
    actorId: profile.id,
    action: 'staffing.probation_review_updated',
    entityType: 'probation_review',
    entityId: id,
    metadata: { outcome: outcome ?? undefined, completed: completing || undefined, probationStatus: newStatus ?? undefined },
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

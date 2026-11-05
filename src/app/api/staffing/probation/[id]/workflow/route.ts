import { NextRequest } from 'next/server'
import { success } from '@/lib/api-response'
import { withAuth } from '@/lib/with-auth'
import { modulesPrisma } from '@/lib/prisma-modules'
import { recordAuditEvent } from '@/lib/audit'
import { parseBody, optionalString } from '@/lib/validation'
import { PermissionError, ValidationError, ConflictError } from '@/lib/errors'
import { createNotification, NOTIFICATION_EVENTS } from '@/lib/notifications'
import { isFinalReview, statusAfterFinalReview } from '@/lib/staffing/probation'
import {
  allowedActions, nextStatus, normaliseAssessment, submissionProblems, validDecision,
  type WorkflowAction,
} from '@/lib/staffing/probation-workflow'
import { loadReviewForActor } from '@/lib/staffing/probation-access'

const ACTIONS: WorkflowAction[] = ['save', 'submit', 'return', 'finalise']

/**
 * POST /api/staffing/probation/[id]/workflow  { action: save | submit | return | finalise, ... }
 * Line manager (or HR) saves drafts and submits; HR returns (with reason) or finalises (with decision).
 */
export const POST = withAuth(async (request: NextRequest, { profile }) => {
  const id = new URL(request.url).pathname.split('/').slice(-2)[0]
  const body = await parseBody(request)
  const action = body.action as WorkflowAction
  if (!ACTIONS.includes(action)) throw new ValidationError('action must be save, submit, return or finalise')

  const { review, actor } = await loadReviewForActor(id, profile)
  if (!allowedActions(review.workflowStatus, actor).includes(action)) {
    if (actor.isSubject) throw new PermissionError('You cannot act on your own probation review')
    throw new ConflictError(`This review is "${review.workflowStatus.toLowerCase()}" — you can't ${action} it now`)
  }

  const now = new Date()
  const data: Record<string, unknown> = { workflowStatus: nextStatus(action) }

  if (action === 'save' || action === 'submit') {
    const assessment = body.assessment !== undefined ? normaliseAssessment(body.assessment) : normaliseAssessment(review.assessment)
    const rec = body.managerRecommendation !== undefined ? validDecision(body.managerRecommendation) : review.managerRecommendation
    if (body.managerRecommendation && !rec) throw new ValidationError('Recommendation must be Pass, Extend or Fail')
    data.assessment = assessment
    data.managerRecommendation = rec ?? null
    for (const f of ['feedback', 'objectives', 'employeeFeedback', 'improvementObjectives'] as const) {
      if (body[f] === '') { data[f] = null; continue } // an emptied box clears the saved text
      const v = optionalString(body[f] as unknown, f, 5000)
      if (v !== null) data[f] = v
    }
    if (Array.isArray(body.evidence)) {
      data.evidence = (body.evidence as Array<{ name?: unknown; url?: unknown }>)
        .filter((e) => typeof e?.url === 'string' && /^https?:\/\//.test(e.url as string))
        .slice(0, 20)
        .map((e) => ({ name: String(e.name ?? 'Evidence').slice(0, 200), url: String(e.url).slice(0, 1000) }))
    }
    if (!review.reviewerId) data.reviewerId = profile.id
    if (action === 'submit') {
      const problems = submissionProblems({ assessment, managerRecommendation: (rec as string | null) ?? null })
      if (problems.length) throw new ValidationError(`Before submitting: ${problems.join('; ')}`)
      data.submittedAt = now
      data.submittedById = profile.id
      data.returnReason = null
    }
  }

  if (action === 'return') {
    const reason = optionalString(body.reason as unknown, 'reason', 2000)
    if (!reason) throw new ValidationError('Say what needs changing')
    Object.assign(data, { returnedAt: now, returnedById: profile.id, returnReason: reason })
  }

  let newEmployeeStatus: string | null = null
  if (action === 'finalise') {
    // Separation of duties: whoever submitted the assessment doesn't also make the HR decision
    if (review.submittedById && review.submittedById === profile.id) {
      throw new PermissionError('Another HR colleague needs to finalise a review you submitted')
    }
    const decision = validDecision(body.decision)
    if (!decision) throw new ValidationError('Choose a decision: Pass, Extend or Fail')
    Object.assign(data, { hrDecision: decision, outcome: decision, completedDate: now, finalisedAt: now, finalisedById: profile.id })
    let isFinal = isFinalReview(review.reviewType)
    if (!isFinal) {
      const later = await modulesPrisma.probationReview.count({ where: { profileId: review.profileId, id: { not: id }, scheduledDate: { gt: review.scheduledDate } } })
      isFinal = later === 0
    }
    newEmployeeStatus = isFinal ? statusAfterFinalReview(decision) : null
  }

  // Optimistic concurrency: only move from the status we read
  const updated = await modulesPrisma.$transaction(async (tx: typeof modulesPrisma) => {
    // Lock on the exact version we read, so two people saving drafts can't silently overwrite each other
    const res = await tx.probationReview.updateMany({ where: { id, workflowStatus: review.workflowStatus, ...(review.updatedAt ? { updatedAt: review.updatedAt } : {}) }, data })
    if (res.count !== 1) throw new ConflictError('Someone else just changed this review — reload and try again')
    if (newEmployeeStatus) {
      await tx.employeeProfile.upsert({
        where: { profileId: review.profileId },
        create: { profileId: review.profileId, probationStatus: newEmployeeStatus },
        update: { probationStatus: newEmployeeStatus },
      })
    }
    return tx.probationReview.findUnique({ where: { id } })
  })

  await recordAuditEvent({
    organisationId: profile.organisationId,
    actorId: profile.id,
    action: `staffing.probation_review_${action === 'save' ? 'saved' : action === 'submit' ? 'submitted' : action === 'return' ? 'returned' : 'finalised'}`,
    entityType: 'probation_review',
    entityId: id,
    metadata: {
      employeeId: review.profileId, reviewType: review.reviewType, from: review.workflowStatus, to: data.workflowStatus,
      recommendation: data.managerRecommendation ?? undefined, decision: data.hrDecision ?? undefined,
      employeeProbationStatus: newEmployeeStatus ?? undefined,
    },
  })

  // Content-free notifications (Schneier): who needs to act, never the assessment itself
  const link = `/probation-reviews/${id}`
  const name = review.profile.fullName
  try {
    if (action === 'submit') {
      const hrUsers = await modulesPrisma.profile.findMany({
        where: { organisationId: profile.organisationId, status: 'ACTIVE', orgPermission: { in: ['HR', 'ADMIN', 'OWNER'] }, id: { not: review.profileId } },
        select: { id: true },
      })
      await Promise.all(hrUsers.map((u: { id: string }) => createNotification({ profileId: u.id, type: NOTIFICATION_EVENTS.PROBATION_REVIEW_DUE, title: `Probation review for ${name} is awaiting HR`, linkUrl: link })))
    } else if (action === 'return') {
      const to = review.submittedById ?? review.profile.managerId
      if (to) await createNotification({ profileId: to, type: NOTIFICATION_EVENTS.PROBATION_REVIEW_DUE, title: `Probation review for ${name} was returned for changes`, linkUrl: link })
    } else if (action === 'finalise') {
      await createNotification({ profileId: review.profileId, type: NOTIFICATION_EVENTS.PROBATION_REVIEW_SCHEDULED, title: 'Your probation review has been finalised', linkUrl: link })
      if (review.profile.managerId && review.profile.managerId !== profile.id) {
        await createNotification({ profileId: review.profile.managerId, type: NOTIFICATION_EVENTS.PROBATION_REVIEW_SCHEDULED, title: `Probation review for ${name} has been finalised`, linkUrl: link })
      }
    }
  } catch { /* notifications are best-effort */ }

  return success({ review: updated, allowedActions: allowedActions(String(data.workflowStatus), actor) })
})

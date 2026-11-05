import { NextRequest } from 'next/server'
import { success } from '@/lib/api-response'
import { withAuth } from '@/lib/with-auth'
import { modulesPrisma } from '@/lib/prisma-modules'
import { parseBody, optionalDate } from '@/lib/validation'
import { NotFoundError, PermissionError, ValidationError, ConflictError } from '@/lib/errors'
import { recordAuditEvent } from '@/lib/audit'
import { createNotification, NOTIFICATION_EVENTS } from '@/lib/notifications'
import { windowFor, extendedDueDate, normaliseWindowDays, windowState, daysRemaining, formatDueDate } from '@/lib/onboarding/seven-day'
import { notifyHR, openEmployeeTasks, applyWindowDates, completeFinalVerificationTasks } from '@/lib/onboarding/window-service'

const ACTIONS = ['start', 'extend', 'submit', 'verify'] as const
type Action = typeof ACTIONS[number]

/**
 * POST /api/onboarding/assignments/[assignmentId]/window
 *   { action: 'start', startDate? }  — HR starts the seven-day window (default: now)
 *   { action: 'extend', days }       — HR extends the deadline
 *   { action: 'submit' }             — the employee (or HR on their behalf) submits for verification
 *   { action: 'verify' }             — HR verifies a submitted onboarding
 */
export const POST = withAuth(async (request: NextRequest, { profile }) => {
  const assignmentId = new URL(request.url).pathname.split('/').slice(-2)[0]
  const body = await parseBody(request)
  const action = body.action as Action
  if (!ACTIONS.includes(action)) throw new ValidationError('action must be start, extend, submit or verify')

  const assignment = await modulesPrisma.onboardingAssignment.findFirst({
    where: { id: assignmentId, organisationId: profile.organisationId },
  })
  if (!assignment) throw new NotFoundError('Assignment not found')

  const isHR = ['HR', 'ADMIN', 'OWNER'].includes(profile.orgPermission)
  const isSubject = assignment.profileId === profile.id
  if (action === 'submit' ? !(isSubject || isHR) : !isHR) {
    throw new PermissionError(action === 'submit' ? 'Only the employee or HR can submit this onboarding' : 'Only HR can do this')
  }
  if (isSubject && action !== 'submit') throw new PermissionError('You cannot change or verify your own onboarding window')

  const now = new Date()
  const data: Record<string, unknown> = {}
  const meta: Record<string, unknown> = {}

  if (action === 'start') {
    if (assignment.submittedAt || assignment.verifiedAt) throw new ConflictError('This onboarding has already been submitted')
    const start = optionalDate(body.startDate, 'startDate') ?? now
    Object.assign(data, windowFor(start, assignment.windowDays ?? 7), { remindersSent: [], missedNotifiedAt: null })
    meta.startAt = start.toISOString()
  }

  if (action === 'extend') {
    if (assignment.verifiedAt) throw new ConflictError('This onboarding has already been verified')
    if (!assignment.windowDueAt) throw new ConflictError('The seven-day window has not started yet — start it first')
    const days = normaliseWindowDays(body.days)
    const due = extendedDueDate(assignment.windowDueAt, days, now)
    Object.assign(data, { windowDueAt: due, missedNotifiedAt: null })
    meta.days = days
    meta.from = assignment.windowDueAt
    meta.to = due.toISOString()
  }

  if (action === 'submit') {
    if (assignment.submittedAt) throw new ConflictError('Already submitted')
    const open = await openEmployeeTasks(assignment.id, assignment.profileId)
    if (open.length) throw new ValidationError(`Finish these first: ${open.slice(0, 5).join('; ')}${open.length > 5 ? ` and ${open.length - 5} more` : ''}`)
    data.submittedAt = now
  }

  if (action === 'verify') {
    if (!assignment.submittedAt) throw new ConflictError('The employee has not submitted their onboarding yet')
    if (assignment.verifiedAt) throw new ConflictError('Already verified')
    Object.assign(data, { verifiedAt: now, verifiedById: profile.id })
  }

  // All-or-nothing: the assignment update (optimistic on updatedAt), task due dates, the invitation
  // link and the final-verification tasks move together or not at all
  await modulesPrisma.$transaction(async (tx: typeof modulesPrisma) => {
    const res = await tx.onboardingAssignment.updateMany({
      where: { id: assignment.id, updatedAt: assignment.updatedAt },
      data,
    })
    if (res.count !== 1) throw new ConflictError('Someone else just changed this onboarding — reload and try again')
    if (action === 'extend' || action === 'start') {
      await applyWindowDates(tx, assignment.id, assignment.profileId, data.windowDueAt as Date)
    }
    if (action === 'submit' || action === 'verify') {
      await completeFinalVerificationTasks(tx, assignment.id, assignment.profileId, action, profile.id)
    }
  })

  await recordAuditEvent({
    organisationId: profile.organisationId,
    actorId: profile.id,
    action: `onboarding_window.${action === 'start' ? 'started' : action === 'extend' ? 'extended' : action === 'submit' ? 'submitted' : 'verified'}`,
    entityType: 'OnboardingAssignment',
    entityId: assignment.id,
    metadata: { employeeId: assignment.profileId, ...meta },
  })

  try {
    if (action === 'submit') {
      await notifyHR(profile.organisationId, assignment.profileId, 'An onboarding is ready for verification', '/onboarding/manage')
    } else if (action === 'verify') {
      await createNotification({ profileId: assignment.profileId, type: NOTIFICATION_EVENTS.ONBOARDING_TASK_ASSIGNED, title: 'Your onboarding has been verified by HR', linkUrl: '/onboarding' })
    } else if (action === 'extend' || action === 'start') {
      await createNotification({
        profileId: assignment.profileId,
        type: NOTIFICATION_EVENTS.ONBOARDING_TASK_DUE,
        title: `Your onboarding is due by ${formatDueDate(data.windowDueAt as Date)}`,
        linkUrl: '/onboarding',
      })
    }
  } catch { /* best-effort */ }

  const updated = await modulesPrisma.onboardingAssignment.findUnique({ where: { id: assignment.id } })
  return success({
    assignment: updated,
    window: {
      state: windowState(updated),
      daysRemaining: daysRemaining(updated),
    },
  })
})

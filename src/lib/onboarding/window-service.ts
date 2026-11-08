/**
 * I/O for the seven-day onboarding window: activation, submission, reminders and missed-deadline alerts.
 * Pure rules live in ./seven-day.ts.
 */
import { modulesPrisma } from '@/lib/prisma-modules'
import { firmTimezone } from '@/lib/region-server'
import { createNotification, NOTIFICATION_EVENTS } from '@/lib/notifications'
import { recordAuditEvent } from '@/lib/audit'
import { captureError } from '@/lib/error-reporting'
import { windowFor, reminderDue, missedNotificationDue, formatDueDate, daysRemaining as daysLeft, normaliseWindowDays } from './seven-day'

const DONE = ['COMPLETED', 'WAIVED']

/** Notify active HR/admin users (never the employee themselves). Content-free titles only. */
export async function notifyHR(organisationId: string, employeeId: string, title: string, linkUrl: string): Promise<number> {
  const hr = await modulesPrisma.profile.findMany({
    where: { organisationId, status: 'ACTIVE', orgPermission: { in: ['HR', 'ADMIN', 'OWNER'] }, id: { not: employeeId } },
    select: { id: true },
  })
  await Promise.all(hr.map((u: { id: string }) => createNotification({ profileId: u.id, type: NOTIFICATION_EVENTS.ONBOARDING_TASK_DUE, title, linkUrl })))
  return hr.length
}

type Tx = typeof modulesPrisma

/**
 * One rule for every way a window starts or moves (HR start, activation, extension, start-at-creation):
 * the employee's open tasks fall due at the window deadline, and their invitation link stays valid
 * until then. Call inside the same transaction as the assignment update.
 */
export async function applyWindowDates(tx: Tx, assignmentId: string, employeeId: string, windowDueAt: Date): Promise<void> {
  await tx.onboardingTask.updateMany({
    where: { assignmentId, assigneeId: employeeId, status: { notIn: DONE } },
    data: { dueDate: windowDueAt },
  })
  await tx.onboardingSelfServiceToken.updateMany({
    where: { assignmentId, revokedAt: null, completedAt: null, expiresAt: { lt: windowDueAt } },
    data: { expiresAt: windowDueAt },
  })
}

/** Recompute progress/status after tasks change (same rule as the task routes). */
export async function recalcAssignmentProgress(tx: Tx, assignmentId: string): Promise<void> {
  const tasks = await tx.onboardingTask.findMany({ where: { assignmentId }, select: { status: true } })
  const total = tasks.length
  const done = tasks.filter((t: { status: string }) => DONE.includes(t.status)).length
  const complete = total > 0 && done === total
  await tx.onboardingAssignment.update({
    where: { id: assignmentId },
    data: { progress: total ? Math.round((done / total) * 100) : 0, status: complete ? 'COMPLETED' : 'ACTIVE', completedAt: complete ? new Date() : null },
  })
}

/**
 * Close the "Final Verification" checklist tasks that the window actions themselves represent:
 * on submit, the employee's "submit onboarding" task; on verify, HR's "confirm requirements" task.
 */
export async function completeFinalVerificationTasks(tx: Tx, assignmentId: string, employeeId: string, stage: 'submit' | 'verify', actorId: string): Promise<void> {
  const now = new Date()
  await tx.onboardingTask.updateMany({
    where: stage === 'submit'
      ? { assignmentId, category: 'Final Verification', assigneeId: employeeId, status: { notIn: DONE } }
      : { assignmentId, category: 'Final Verification', NOT: { assigneeId: employeeId }, status: { notIn: DONE } },
    data: { status: 'COMPLETED', completedAt: now, completedById: actorId },
  })
  await recalcAssignmentProgress(tx, assignmentId)
}

export interface LinkWindow { started: boolean; days: number; startAt: string | null; dueAt: string | null; dueLabel: string | null; daysRemaining: number | null }

/** The seven-day window as the employee sees it on their invitation link (one source of truth). */
export async function windowForLink(assignmentId: string | null): Promise<LinkWindow | null> {
  if (!assignmentId) return null
  const a = await modulesPrisma.onboardingAssignment.findUnique({ where: { id: assignmentId }, select: { windowDays: true, windowStartAt: true, windowDueAt: true, organisationId: true } })
  if (!a) return null
  return {
    started: !!a.windowStartAt,
    days: normaliseWindowDays(a.windowDays ?? 7),
    startAt: a.windowStartAt ? new Date(a.windowStartAt).toISOString() : null,
    dueAt: a.windowDueAt ? new Date(a.windowDueAt).toISOString() : null,
    dueLabel: a.windowDueAt ? formatDueDate(a.windowDueAt, await firmTimezone(a.organisationId)) : null,
    daysRemaining: daysLeft({ windowDueAt: a.windowDueAt }),
  }
}

/** Titles of the employee's own tasks still open (the final "submit" step itself doesn't count). */
export async function openEmployeeTasks(assignmentId: string, employeeId: string): Promise<string[]> {
  const tasks = await modulesPrisma.onboardingTask.findMany({
    where: { assignmentId, assigneeId: employeeId, status: { notIn: DONE } },
    select: { title: true, category: true },
    orderBy: { sortOrder: 'asc' },
  })
  return tasks
    .filter((t: { category: string | null }) => t.category !== 'Final Verification')
    .map((t: { title: string }) => t.title)
}

/**
 * The employee opened their invitation: start the window if HR hasn't already, and make sure
 * the link stays valid until the deadline. Idempotent.
 */
export async function startWindowOnActivation(assignmentId: string | null, tokenId: string, now: Date = new Date()): Promise<void> {
  if (!assignmentId) return
  const a = await modulesPrisma.onboardingAssignment.findUnique({
    where: { id: assignmentId },
    select: { id: true, windowStartAt: true, windowDays: true, organisationId: true, profileId: true },
  })
  if (!a || a.windowStartAt) return
  const w = windowFor(now, a.windowDays ?? 7, await firmTimezone(a.organisationId))
  const started = await modulesPrisma.$transaction(async (tx: Tx) => {
    const res = await tx.onboardingAssignment.updateMany({ where: { id: a.id, windowStartAt: null }, data: w })
    if (res.count !== 1) return false
    await applyWindowDates(tx, a.id, a.profileId, w.windowDueAt)
    return true
  })
  if (!started) return
  void tokenId
  await recordAuditEvent({
    organisationId: a.organisationId, actorId: a.profileId, action: 'onboarding_window.started', entityType: 'OnboardingAssignment', entityId: a.id,
    metadata: { employeeId: a.profileId, startAt: w.windowStartAt.toISOString(), trigger: 'activation' },
  })
}

/** All self-service steps done: record the submission and tell HR. Idempotent. */
export async function markSubmittedFromSelfService(assignmentId: string | null, now: Date = new Date()): Promise<void> {
  if (!assignmentId) return
  const a = await modulesPrisma.onboardingAssignment.findUnique({ where: { id: assignmentId }, select: { id: true, organisationId: true, profileId: true, submittedAt: true } })
  if (!a || a.submittedAt) return
  const submitted = await modulesPrisma.$transaction(async (tx: Tx) => {
    const res = await tx.onboardingAssignment.updateMany({ where: { id: a.id, submittedAt: null }, data: { submittedAt: now } })
    if (res.count !== 1) return false
    await completeFinalVerificationTasks(tx, a.id, a.profileId, 'submit', a.profileId)
    return true
  })
  if (!submitted) return
  await recordAuditEvent({
    organisationId: a.organisationId, actorId: a.profileId, action: 'onboarding_window.submitted', entityType: 'OnboardingAssignment', entityId: a.id,
    metadata: { employeeId: a.profileId, trigger: 'self_service_complete' },
  })
  try { await notifyHR(a.organisationId, a.profileId, 'An onboarding is ready for verification', '/onboarding/manage') } catch { /* best-effort */ }
}

export interface ReminderRunResult { checked: number; reminded: number; missed: number; errors: number }

/** Daily: remind employees on days 3/5/7 of their window, and tell HR once when a window is missed. */
const PAGE = 200

export async function runOnboardingReminders(now: Date = new Date()): Promise<ReminderRunResult> {
  const result: ReminderRunResult = { checked: 0, reminded: 0, missed: 0, errors: 0 }
  // Only windows with something left to do: not yet submitted, and not already reported as missed.
  // Paged by id so a large backlog is never silently skipped.
  let cursor: string | undefined
  for (;;) {
    const page = await modulesPrisma.onboardingAssignment.findMany({
      where: { status: 'ACTIVE', windowStartAt: { not: null }, submittedAt: null, verifiedAt: null, missedNotifiedAt: null },
      select: {
        id: true, organisationId: true, profileId: true, windowStartAt: true, windowDueAt: true, windowDays: true,
        submittedAt: true, verifiedAt: true, remindersSent: true, missedNotifiedAt: true,
      },
      orderBy: { id: 'asc' },
      take: PAGE,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    })
    if (!page.length) break
    cursor = page[page.length - 1].id
    result.checked += page.length
    await processReminderPage(page, now, result)
    if (page.length < PAGE) break
  }
  return result
}

type ReminderRow = {
  id: string; organisationId: string; profileId: string; windowStartAt: Date | null; windowDueAt: Date | null; windowDays: number | null
  submittedAt: Date | null; verifiedAt: Date | null; remindersSent: number[] | null; missedNotifiedAt: Date | null
}

async function processReminderPage(open: ReminderRow[], now: Date, result: ReminderRunResult): Promise<void> {
  for (const a of open) {
    try {
      const day = reminderDue(a, now)
      if (day !== null) {
        // Claim the reminder first so a double run can't send it twice
        const claimed = await modulesPrisma.onboardingAssignment.updateMany({
          where: { id: a.id, NOT: { remindersSent: { has: day } } },
          data: { remindersSent: { push: day } },
        })
        if (claimed.count === 1) {
          const due = formatDueDate(a.windowDueAt as Date, await firmTimezone(a.organisationId))
          await createNotification({
            profileId: a.profileId,
            type: NOTIFICATION_EVENTS.ONBOARDING_TASK_DUE,
            title: `Reminder: please finish your onboarding by ${due}`,
            linkUrl: '/onboarding',
          })
          result.reminded++
        }
      }
      if (missedNotificationDue(a, now)) {
        const claimed = await modulesPrisma.onboardingAssignment.updateMany({ where: { id: a.id, missedNotifiedAt: null }, data: { missedNotifiedAt: now } })
        if (claimed.count === 1) {
          await notifyHR(a.organisationId, a.profileId, 'An employee has missed their onboarding deadline', '/onboarding/manage')
          await recordAuditEvent({
            organisationId: a.organisationId, action: 'onboarding_window.missed', entityType: 'OnboardingAssignment', entityId: a.id,
            metadata: { employeeId: a.profileId, dueAt: a.windowDueAt },
          })
          result.missed++
        }
      }
    } catch (e) {
      result.errors++
      console.warn('[onboarding-reminders] failed for assignment', a.id, e)
      captureError(e, { source: 'cron', route: '/api/cron/onboarding-reminders', organisationId: a.organisationId, extra: { assignmentId: a.id } })
    }
  }
}

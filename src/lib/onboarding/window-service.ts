/**
 * I/O for the seven-day onboarding window: activation, submission, reminders and missed-deadline alerts.
 * Pure rules live in ./seven-day.ts.
 */
import { modulesPrisma } from '@/lib/prisma-modules'
import { createNotification, NOTIFICATION_EVENTS } from '@/lib/notifications'
import { recordAuditEvent } from '@/lib/audit'
import { windowFor, reminderDue, missedNotificationDue } from './seven-day'

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
  const w = windowFor(now, a.windowDays ?? 7)
  const res = await modulesPrisma.onboardingAssignment.updateMany({ where: { id: a.id, windowStartAt: null }, data: w })
  if (res.count !== 1) return
  await modulesPrisma.onboardingSelfServiceToken.updateMany({
    where: { id: tokenId, expiresAt: { lt: w.windowDueAt } },
    data: { expiresAt: w.windowDueAt },
  })
  // The employee's own open tasks fall due at the end of the window
  await modulesPrisma.onboardingTask.updateMany({
    where: { assignmentId: a.id, assigneeId: a.profileId, status: { notIn: DONE }, OR: [{ dueDate: null }, { dueDate: { gt: w.windowDueAt } }, { isSelfService: true }] },
    data: { dueDate: w.windowDueAt },
  })
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
  const res = await modulesPrisma.onboardingAssignment.updateMany({ where: { id: a.id, submittedAt: null }, data: { submittedAt: now } })
  if (res.count !== 1) return
  await recordAuditEvent({
    organisationId: a.organisationId, actorId: a.profileId, action: 'onboarding_window.submitted', entityType: 'OnboardingAssignment', entityId: a.id,
    metadata: { employeeId: a.profileId, trigger: 'self_service_complete' },
  })
  try { await notifyHR(a.organisationId, a.profileId, 'An onboarding is ready for verification', '/onboarding/manage') } catch { /* best-effort */ }
}

export interface ReminderRunResult { checked: number; reminded: number; missed: number; errors: number }

/** Daily: remind employees on days 3/5/7 of their window, and tell HR once when a window is missed. */
export async function runOnboardingReminders(now: Date = new Date()): Promise<ReminderRunResult> {
  const open = await modulesPrisma.onboardingAssignment.findMany({
    where: { status: 'ACTIVE', windowStartAt: { not: null }, submittedAt: null, verifiedAt: null },
    select: {
      id: true, organisationId: true, profileId: true, windowStartAt: true, windowDueAt: true, windowDays: true,
      submittedAt: true, verifiedAt: true, remindersSent: true, missedNotifiedAt: true,
    },
    take: 500,
  })
  const result: ReminderRunResult = { checked: open.length, reminded: 0, missed: 0, errors: 0 }
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
          const due = new Date(a.windowDueAt as Date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })
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
    }
  }
  return result
}

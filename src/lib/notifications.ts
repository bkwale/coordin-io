import { prisma } from '@/lib/prisma'
import { Resend } from 'resend'

// ── Resend Client (shared) ──────────────────────────────
const resend = new Resend(process.env.RESEND_API_KEY)
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'Coordin.io <onboarding@resend.dev>'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://www.coordin.io'

// ── Notification Event Types ────────────────────────────

export const NOTIFICATION_EVENTS = {
  // Tasks
  TASK_ASSIGNED: 'task.assigned',
  TASK_STATUS_CHANGED: 'task.status_changed',
  TASK_OVERDUE: 'task.overdue',
  TASK_COMMENT: 'task.comment',

  // Documents
  DOCUMENT_REVIEW_REQUESTED: 'document.review_requested',
  DOCUMENT_REVIEWED: 'document.reviewed',
  DOCUMENT_ISSUED: 'document.issued',

  // Leave
  LEAVE_REQUESTED: 'leave.requested',
  LEAVE_DECISION: 'leave.decision',

  // Expenses
  EXPENSE_SUBMITTED: 'expense.submitted',
  EXPENSE_DECISION: 'expense.decision',

  // Timesheets
  TIMESHEET_SUBMITTED: 'timesheet.submitted',
  TIMESHEET_DECISION: 'timesheet.decision',

  // Onboarding
  ONBOARDING_TASK_ASSIGNED: 'onboarding.task_assigned',
  ONBOARDING_TASK_DUE: 'onboarding.task_due',

  // Probation
  PROBATION_REVIEW_SCHEDULED: 'probation.review_scheduled',
  PROBATION_REVIEW_DUE: 'probation.review_due',

  // Project
  PROJECT_UPDATE: 'project.update',
  PROJECT_HEALTH_CHANGED: 'project.health_changed',
  PROJECT_MILESTONE_DUE: 'project.milestone_due',

  // Mentions
  MENTION: 'mention',

  // Compliance
  COMPLIANCE_ACTION_DUE: 'compliance.action_due',

  // Training
  TRAINING_EXPIRING: 'training.expiring',
} as const

export type NotificationEvent = typeof NOTIFICATION_EVENTS[keyof typeof NOTIFICATION_EVENTS]

// ── Events that should also trigger email ───────────────

const EMAIL_EVENTS: Set<NotificationEvent> = new Set([
  NOTIFICATION_EVENTS.TASK_ASSIGNED,
  NOTIFICATION_EVENTS.DOCUMENT_REVIEW_REQUESTED,
  NOTIFICATION_EVENTS.LEAVE_REQUESTED,
  NOTIFICATION_EVENTS.LEAVE_DECISION,
  NOTIFICATION_EVENTS.EXPENSE_DECISION,
  NOTIFICATION_EVENTS.TIMESHEET_DECISION,
  NOTIFICATION_EVENTS.ONBOARDING_TASK_ASSIGNED,
  NOTIFICATION_EVENTS.PROBATION_REVIEW_SCHEDULED,
  NOTIFICATION_EVENTS.PROJECT_HEALTH_CHANGED,
  NOTIFICATION_EVENTS.MENTION,
])

// ── Core Interface ──────────────────────────────────────

interface CreateNotificationParams {
  profileId: string       // Who receives the notification
  type: NotificationEvent // Event type
  title: string           // Short title shown in bell dropdown
  body?: string           // Optional longer description
  linkUrl?: string        // Where clicking the notification navigates
  sendEmail?: boolean     // Force email on/off (overrides default)
}

interface CreateNotificationResult {
  notificationId: string
  emailSent: boolean
}

// ── Create Notification ─────────────────────────────────
/**
 * Central notification function. Every route that needs to notify a user
 * calls this instead of creating notifications directly.
 *
 * - Creates an in-app notification record
 * - Sends email for high-priority event types (configurable)
 * - Fails silently on email errors (notification still created)
 */
export async function createNotification(
  params: CreateNotificationParams,
): Promise<CreateNotificationResult> {
  const { profileId, type, title, body, linkUrl } = params

  // 1. Create in-app notification
  const notification = await prisma.notification.create({
    data: {
      profileId,
      type,
      title,
      body: body ?? null,
      linkUrl: linkUrl ?? null,
    },
  })

  // 2. Determine if email should be sent
  const shouldEmail = params.sendEmail ?? EMAIL_EVENTS.has(type)
  let emailSent = false

  if (shouldEmail) {
    try {
      // Look up user email
      const profile = await prisma.profile.findUnique({
        where: { id: profileId },
        select: { email: true, fullName: true },
      })

      if (profile?.email) {
        await resend.emails.send({
          from: FROM_EMAIL,
          to: profile.email,
          subject: title,
          html: buildNotificationEmail({
            recipientName: profile.fullName,
            title,
            body: body ?? '',
            linkUrl: linkUrl ? `${APP_URL}${linkUrl}` : undefined,
          }),
        })
        emailSent = true
      }
    } catch {
      // Email failure is non-fatal — the in-app notification was created
      console.error(`[notifications] Email send failed for ${type} to profile ${profileId}`)
    }
  }

  return { notificationId: notification.id, emailSent }
}

// ── Batch Create (notify multiple people) ───────────────

export async function createNotifications(
  recipients: Array<{ profileId: string }>,
  shared: Omit<CreateNotificationParams, 'profileId'>,
): Promise<void> {
  await Promise.allSettled(
    recipients.map(r =>
      createNotification({ ...shared, profileId: r.profileId }),
    ),
  )
}

// ── Email Template ──────────────────────────────────────

function buildNotificationEmail(params: {
  recipientName: string
  title: string
  body: string
  linkUrl?: string
}): string {
  const { recipientName, title, body, linkUrl } = params

  const actionButton = linkUrl
    ? `<p style="margin:24px 0"><a href="${linkUrl}" style="background:#2563eb;color:#fff;padding:10px 24px;border-radius:6px;text-decoration:none;font-weight:500;display:inline-block">View in Coordin.io</a></p>`
    : ''

  return `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:560px;margin:0 auto;padding:32px 24px">
      <div style="border-bottom:1px solid #e5e7eb;padding-bottom:16px;margin-bottom:24px">
        <strong style="font-size:18px;color:#111">Coordin.io</strong>
      </div>
      <p style="color:#374151;margin:0 0 8px">Hi ${recipientName},</p>
      <h2 style="color:#111;font-size:16px;font-weight:600;margin:16px 0 8px">${title}</h2>
      ${body ? `<p style="color:#4b5563;line-height:1.6;margin:0 0 16px">${body}</p>` : ''}
      ${actionButton}
      <div style="border-top:1px solid #e5e7eb;padding-top:16px;margin-top:32px">
        <p style="color:#9ca3af;font-size:12px;margin:0">This is an automated notification from Coordin.io. You can manage your notification preferences in Settings.</p>
      </div>
    </div>
  `
}

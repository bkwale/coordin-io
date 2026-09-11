import { prisma } from '@/lib/prisma'
import { recordAuditEvent, AuditActions } from '@/lib/audit'
import { createNotification, NOTIFICATION_EVENTS } from '@/lib/notifications'
import { createApprovalInstance } from '@/lib/approval-engine'
import { sendLeaveSubmissionEmail } from '@/lib/email'

/* ── Types ────────────────────────────────────────────────── */

interface LeaveRequestCore {
  id: string
  profileId: string
  leaveType: string
  days: number
  startDate: Date
  endDate: Date
  status: string
  approverId: string | null
  reason?: string | null
}

type IncludeRelations = {
  profile: { select: { id: true; fullName: true } }
  approver: { select: { id: true; fullName: true } }
}

/* ── Balance management ───────────────────────────────────── */

/**
 * Persist the leave status change, adjusting the annual leave balance
 * inside a transaction when approving or cancelling annual leave.
 */
export async function updateLeaveWithBalance(
  id: string,
  leaveRequest: LeaveRequestCore,
  newStatus: string,
  updateData: Record<string, unknown>,
  includeRelations: IncludeRelations,
) {
  // Approve annual leave — increment used days
  if (newStatus === 'APPROVED' && leaveRequest.leaveType === 'ANNUAL') {
    const year = leaveRequest.startDate.getFullYear()
    return prisma.$transaction(async (tx) => {
      const result = await tx.leaveRequest.update({
        where: { id },
        data: updateData,
        include: includeRelations,
      })
      await tx.leaveBalance.upsert({
        where: { profileId_year: { profileId: leaveRequest.profileId, year } },
        update: { used: { increment: leaveRequest.days } },
        create: {
          profileId: leaveRequest.profileId,
          year,
          allocation: 25,
          used: leaveRequest.days,
          carriedForward: 0,
        },
      })
      return result
    })
  }

  // Cancel previously approved annual leave — restore the balance
  if (newStatus === 'CANCELLED' && leaveRequest.leaveType === 'ANNUAL' && leaveRequest.status === 'APPROVED') {
    const year = leaveRequest.startDate.getFullYear()
    return prisma.$transaction(async (tx) => {
      const result = await tx.leaveRequest.update({
        where: { id },
        data: updateData,
        include: includeRelations,
      })
      await tx.leaveBalance.update({
        where: { profileId_year: { profileId: leaveRequest.profileId, year } },
        data: { used: { decrement: leaveRequest.days } },
      })
      return result
    })
  }

  // All other transitions — plain update
  return prisma.leaveRequest.update({
    where: { id },
    data: updateData,
    include: includeRelations,
  })
}

/* ── Audit ─────────────────────────────────────────────────── */

const LEAVE_AUDIT_MAP: Record<string, string> = {
  SUBMITTED: AuditActions.LEAVE_SUBMITTED,
  APPROVED: AuditActions.LEAVE_APPROVED,
  REJECTED: AuditActions.LEAVE_REJECTED,
  WITHDRAWN: AuditActions.LEAVE_WITHDRAWN,
  LINE_MANAGER_APPROVED: 'leave.line_manager_approved',
  HR_APPROVED: 'leave.hr_approved',
  UNDER_REVIEW: 'leave.info_requested',
  CANCELLED: 'leave.cancelled',
}

/**
 * Record an audit event for a leave status transition.
 */
export async function recordLeaveAudit(params: {
  organisationId: string
  actorId: string
  newStatus: string
  currentStatus: string
  entityId: string
  comment?: string | null
  ipAddress?: string
}) {
  const action = LEAVE_AUDIT_MAP[params.newStatus]
  if (!action) return

  await recordAuditEvent({
    organisationId: params.organisationId,
    actorId: params.actorId,
    action,
    entityType: 'leave_request',
    entityId: params.entityId,
    metadata: {
      from: params.currentStatus,
      to: params.newStatus,
      ...(params.comment ? { comment: params.comment } : {}),
    },
    ipAddress: params.ipAddress,
  })
}

/* ── Notifications ─────────────────────────────────────────── */

/**
 * Send in-app notifications and email for a leave status change.
 *
 * GDPR: reason is omitted from email for SICK leave — it remains
 * visible only in-app where access is already role-gated.
 */
export async function sendLeaveNotifications(params: {
  newStatus: string
  leaveRequest: LeaveRequestCore
  requesterName: string
  comment?: string | null
}) {
  const { newStatus, leaveRequest, requesterName, comment } = params

  // SUBMITTED → notify approver (in-app + email)
  if (newStatus === 'SUBMITTED' && leaveRequest.approverId) {
    await createNotification({
      profileId: leaveRequest.approverId,
      type: NOTIFICATION_EVENTS.LEAVE_REQUESTED,
      title: `${requesterName} submitted a leave request`,
      body: `${leaveRequest.leaveType} leave — ${leaveRequest.days} day(s)`,
      linkUrl: `/leave?role=approver`,
    }).catch(() => {})

    // Fire-and-forget email to approver/manager
    prisma.profile.findUnique({
      where: { id: leaveRequest.approverId },
      select: {
        fullName: true,
        email: true,
        organisation: { select: { name: true } },
      },
    }).then(async (approver: { fullName: string; email: string; organisation: { name: string } | null } | null) => {
      if (!approver?.email) return
      const fmtOpts = { day: 'numeric' as const, month: 'short' as const, year: 'numeric' as const }
      const startStr = leaveRequest.startDate.toLocaleDateString('en-GB', fmtOpts)
      const endStr = leaveRequest.endDate.toLocaleDateString('en-GB', fmtOpts)
      await sendLeaveSubmissionEmail({
        to: approver.email,
        managerName: approver.fullName ?? 'Manager',
        employeeName: requesterName,
        leaveType: leaveRequest.leaveType,
        startDate: startStr,
        endDate: endStr,
        days: leaveRequest.days,
        // GDPR: omit reason for SICK leave — sensitive health data
        reason: leaveRequest.leaveType === 'SICK' ? undefined : leaveRequest.reason,
        organisationName: approver.organisation?.name ?? 'your organisation',
      })
    }).catch((err: unknown) => console.error('[LEAVE] Email notification failed:', err))
  }

  // UNDER_REVIEW → notify requester that more info is needed
  if (newStatus === 'UNDER_REVIEW') {
    await createNotification({
      profileId: leaveRequest.profileId,
      type: NOTIFICATION_EVENTS.LEAVE_DECISION,
      title: 'More information requested for your leave request',
      body: comment ?? 'Your approver has requested additional information. Please review and re-submit.',
      linkUrl: `/leave`,
    }).catch(() => {})
  }

  // Approval/rejection decisions → notify requester
  if (['APPROVED', 'REJECTED', 'LINE_MANAGER_APPROVED', 'HR_APPROVED', 'CANCELLED'].includes(newStatus)) {
    await createNotification({
      profileId: leaveRequest.profileId,
      type: NOTIFICATION_EVENTS.LEAVE_DECISION,
      title: `Your leave request was ${newStatus.toLowerCase().replace(/_/g, ' ')}`,
      body: comment ?? undefined,
      linkUrl: `/leave`,
    }).catch(() => {})
  }
}

/* ── Approval engine orchestration ────────────────────────── */

/**
 * On SUBMITTED: cancel stale IN_PROGRESS instances and create a new one.
 */
export async function orchestrateLeaveApproval(params: {
  newStatus: string
  entityId: string
  organisationId: string
  submitterId: string
  leaveType: string
  submitterManagerId: string | null
}) {
  if (params.newStatus !== 'SUBMITTED') return

  // Cancel any existing IN_PROGRESS instance (e.g. re-submit after REQUEST_CHANGES)
  try {
    await prisma.approvalInstance.updateMany({
      where: { entityId: params.entityId, status: 'IN_PROGRESS' },
      data: { status: 'CANCELLED' },
    })
  } catch { /* non-critical — table may not exist yet */ }

  const requestType = params.leaveType === 'BUSINESS_TRAVEL' ? 'TRAVEL' : 'LEAVE'
  await createApprovalInstance({
    organisationId: params.organisationId,
    requestType: requestType as 'LEAVE' | 'TRAVEL',
    entityId: params.entityId,
    submitterId: params.submitterId,
    leaveType: params.leaveType,
    submitterManagerId: params.submitterManagerId,
  }).catch(() => {})
}

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { success } from '@/lib/api-response'
import { withAuth } from '@/lib/with-auth'
import { recordAuditEvent, AuditActions } from '@/lib/audit'
import { requireEnum, optionalString, parseBody } from '@/lib/validation'
import { validateLeaveTransition, isRequesterTransition, isApproverTransition, isAdminTransition } from '@/lib/request-transitions'
import { NotFoundError, PermissionError } from '@/lib/errors'
import { createNotification, NOTIFICATION_EVENTS } from '@/lib/notifications'
import type { RequestStatus } from '@/generated/prisma/client'

const REQUEST_STATUSES = [
  'DRAFT', 'SUBMITTED', 'UNDER_REVIEW',
  'LINE_MANAGER_APPROVED', 'HR_APPROVED',
  'APPROVED', 'REJECTED',
  'FULFILMENT_IN_PROGRESS', 'COMPLETED',
  'CANCELLED', 'WITHDRAWN',
] as const

/**
 * GET /api/leave/requests/[id] — Get a single leave request.
 */
export const GET = withAuth(async (request: NextRequest, { profile }) => {
  const id = request.url.match(/\/leave\/requests\/([^/?]+)/)?.[1]
  if (!id) throw new NotFoundError('Leave request not found')

  const leaveRequest = await prisma.leaveRequest.findUnique({
    where: { id },
    include: {
      profile: { select: { id: true, fullName: true, jobTitle: true, organisationId: true } },
      approver: { select: { id: true, fullName: true } },
    },
  })

  if (!leaveRequest) {
    throw new NotFoundError('Leave request not found')
  }

  // Must be owner, approver, or admin
  const isOwner = leaveRequest.profileId === profile.id
  const isApprover = leaveRequest.approverId === profile.id
  const isAdmin = profile.orgPermission === 'ADMIN' || profile.orgPermission === 'OWNER'
  const isManager = profile.orgPermission === 'MANAGER'

  if (!isOwner && !isApprover && !isAdmin && !isManager) {
    throw new PermissionError('You do not have access to this leave request')
  }

  return success({ leaveRequest })
})

/**
 * PATCH /api/leave/requests/[id] — Update leave request status.
 *
 * PRD S20 multi-stage approval workflow:
 * - Requester can: SUBMIT (DRAFT→SUBMITTED), WITHDRAW (DRAFT/SUBMITTED→WITHDRAWN)
 * - Line Manager can: LINE_MANAGER_APPROVED (SUBMITTED→LINE_MANAGER_APPROVED), REJECT
 * - HR/Admin can: HR_APPROVED (LINE_MANAGER_APPROVED→HR_APPROVED), APPROVE, REJECT
 * - Admin can: CANCEL approved leave
 */
export const PATCH = withAuth(async (request: NextRequest, { profile }) => {
  const id = request.url.match(/\/leave\/requests\/([^/?]+)/)?.[1]
  if (!id) throw new NotFoundError('Leave request not found')
  const body = await parseBody(request)

  const newStatus = requireEnum(body.status, 'Status', REQUEST_STATUSES)
  const comment = optionalString(body.comment, 'Comment', 1000)

  const leaveRequest = await prisma.leaveRequest.findUnique({
    where: { id },
    include: {
      profile: { select: { organisationId: true, managerId: true } },
    },
  })

  if (!leaveRequest) {
    throw new NotFoundError('Leave request not found')
  }

  // Org boundary check
  if (leaveRequest.profile.organisationId !== profile.organisationId) {
    throw new NotFoundError('Leave request not found')
  }

  const currentStatus = leaveRequest.status as RequestStatus

  // Validate the transition using leave-specific state machine
  validateLeaveTransition(currentStatus, newStatus)

  // Role-based access control
  const isOwner = leaveRequest.profileId === profile.id
  const isApproverUser = leaveRequest.approverId === profile.id
  const isAdmin = profile.orgPermission === 'ADMIN' || profile.orgPermission === 'OWNER'
  const isHR = profile.orgPermission === 'ADMIN' || profile.orgPermission === 'OWNER'
  const isLineManager = leaveRequest.profile.managerId === profile.id

  if (isRequesterTransition(newStatus) && !isOwner) {
    throw new PermissionError('Only the requester can perform this action')
  }

  // LINE_MANAGER_APPROVED requires being the line manager or admin
  if (newStatus === 'LINE_MANAGER_APPROVED' && !isLineManager && !isApproverUser && !isAdmin) {
    throw new PermissionError('Only the line manager or an admin can approve at this stage')
  }

  // HR_APPROVED requires HR/admin permission
  if (newStatus === 'HR_APPROVED' && !isHR) {
    throw new PermissionError('Only HR or an admin can approve at this stage')
  }

  // APPROVED (final) requires HR/admin permission
  if (newStatus === 'APPROVED' && !isHR && !isApproverUser) {
    throw new PermissionError('Only the assigned approver, HR, or an admin can give final approval')
  }

  // REJECTED can be done by line manager, approver, or admin
  if (newStatus === 'REJECTED' && !isLineManager && !isApproverUser && !isAdmin) {
    throw new PermissionError('Only the line manager, approver, or an admin can reject')
  }

  if (isAdminTransition(newStatus) && !isAdmin) {
    throw new PermissionError('Only an admin can perform this action')
  }

  // Build the update data
  const updateData: Record<string, unknown> = {
    status: newStatus,
    ...(comment ? { approvalComment: comment } : {}),
  }

  if (['APPROVED', 'REJECTED', 'LINE_MANAGER_APPROVED', 'HR_APPROVED'].includes(newStatus)) {
    updateData.approvedAt = new Date()
    if (!leaveRequest.approverId) {
      updateData.approverId = profile.id
    }
  }

  const includeRelations = {
    profile: { select: { id: true, fullName: true } },
    approver: { select: { id: true, fullName: true } },
  }

  let updated

  // If approving annual leave (final APPROVED), update the balance in a transaction
  if (newStatus === 'APPROVED' && leaveRequest.leaveType === 'ANNUAL') {
    const year = leaveRequest.startDate.getFullYear()

    updated = await prisma.$transaction(async (tx) => {
      // Update the leave request
      const result = await tx.leaveRequest.update({
        where: { id },
        data: updateData,
        include: includeRelations,
      })

      // Increment used days on the balance
      await tx.leaveBalance.upsert({
        where: {
          profileId_year: {
            profileId: leaveRequest.profileId,
            year,
          },
        },
        update: {
          used: { increment: leaveRequest.days },
        },
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
  } else if (newStatus === 'CANCELLED' && leaveRequest.leaveType === 'ANNUAL' && leaveRequest.status === 'APPROVED') {
    // Cancelling approved annual leave — restore the balance
    const year = leaveRequest.startDate.getFullYear()

    updated = await prisma.$transaction(async (tx) => {
      const result = await tx.leaveRequest.update({
        where: { id },
        data: updateData,
        include: includeRelations,
      })

      await tx.leaveBalance.update({
        where: {
          profileId_year: {
            profileId: leaveRequest.profileId,
            year,
          },
        },
        data: {
          used: { decrement: leaveRequest.days },
        },
      })

      return result
    })
  } else {
    updated = await prisma.leaveRequest.update({
      where: { id },
      data: updateData,
      include: includeRelations,
    })
  }

  // Audit
  const actionMap: Record<string, string> = {
    SUBMITTED: AuditActions.LEAVE_SUBMITTED,
    APPROVED: AuditActions.LEAVE_APPROVED,
    REJECTED: AuditActions.LEAVE_REJECTED,
    WITHDRAWN: AuditActions.LEAVE_WITHDRAWN,
    LINE_MANAGER_APPROVED: 'leave.line_manager_approved',
    HR_APPROVED: 'leave.hr_approved',
    CANCELLED: 'leave.cancelled',
  }
  if (actionMap[newStatus]) {
    await recordAuditEvent({
      organisationId: profile.organisationId,
      actorId: profile.id,
      action: actionMap[newStatus],
      entityType: 'leave_request',
      entityId: id,
      metadata: {
        from: currentStatus,
        to: newStatus,
        ...(comment ? { comment } : {}),
      },
      ipAddress: request.headers.get('x-forwarded-for') || undefined,
    })
  }

  // ── Notifications ──
  const requesterName = updated.profile?.fullName ?? 'Someone'
  if (newStatus === 'SUBMITTED' && leaveRequest.approverId) {
    await createNotification({
      profileId: leaveRequest.approverId,
      type: NOTIFICATION_EVENTS.LEAVE_REQUESTED,
      title: `${requesterName} submitted a leave request`,
      body: `${leaveRequest.leaveType} leave — ${leaveRequest.days} day(s)`,
      linkUrl: `/leave?role=approver`,
    }).catch(() => {})
  }
  if (['APPROVED', 'REJECTED', 'LINE_MANAGER_APPROVED', 'HR_APPROVED', 'CANCELLED'].includes(newStatus)) {
    await createNotification({
      profileId: leaveRequest.profileId,
      type: NOTIFICATION_EVENTS.LEAVE_DECISION,
      title: `Your leave request was ${newStatus.toLowerCase().replace(/_/g, ' ')}`,
      body: comment ?? undefined,
      linkUrl: `/leave`,
    }).catch(() => {})
  }

  return success({ leaveRequest: updated })
})

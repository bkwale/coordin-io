import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { success } from '@/lib/api-response'
import { withAuth } from '@/lib/with-auth'
import { requireEnum, optionalString, parseBody } from '@/lib/validation'
import { validateLeaveTransition, isRequesterTransition, isApproverTransition, isAdminTransition } from '@/lib/request-transitions'
import { NotFoundError, PermissionError } from '@/lib/errors'
import {
  updateLeaveWithBalance,
  recordLeaveAudit,
  sendLeaveNotifications,
  orchestrateLeaveApproval,
} from '@/lib/leave-service'
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

  // ── Validate transition + RBAC ──
  validateLeaveTransition(currentStatus, newStatus)

  const isOwner = leaveRequest.profileId === profile.id
  const isApproverUser = leaveRequest.approverId === profile.id
  const isAdmin = profile.orgPermission === 'ADMIN' || profile.orgPermission === 'OWNER'
  const isHR = profile.orgPermission === 'ADMIN' || profile.orgPermission === 'OWNER' || profile.orgPermission === 'HR'
  const isLineManager = leaveRequest.profile.managerId === profile.id

  if (isRequesterTransition(newStatus) && currentStatus !== 'UNDER_REVIEW' && !isOwner) {
    throw new PermissionError('Only the requester can perform this action')
  }
  if (newStatus === 'SUBMITTED' && currentStatus === 'UNDER_REVIEW' && !isOwner) {
    throw new PermissionError('Only the requester can re-submit after info request')
  }
  if (newStatus === 'UNDER_REVIEW' && !isLineManager && !isApproverUser && !isAdmin) {
    throw new PermissionError('Only the line manager, approver, or an admin can request more information')
  }
  if (newStatus === 'LINE_MANAGER_APPROVED' && !isLineManager && !isApproverUser && !isAdmin) {
    throw new PermissionError('Only the line manager or an admin can approve at this stage')
  }
  if (newStatus === 'HR_APPROVED' && !isHR) {
    throw new PermissionError('Only HR or an admin can approve at this stage')
  }
  if (newStatus === 'APPROVED' && !isHR && !isApproverUser) {
    throw new PermissionError('Only the assigned approver, HR, or an admin can give final approval')
  }
  if (newStatus === 'REJECTED' && !isLineManager && !isApproverUser && !isAdmin) {
    throw new PermissionError('Only the line manager, approver, or an admin can reject')
  }
  if (isAdminTransition(newStatus) && !isAdmin) {
    throw new PermissionError('Only an admin can perform this action')
  }

  // ── Build update data ──
  const updateData: Record<string, unknown> = {
    status: newStatus,
    ...(comment ? { approvalComment: comment } : {}),
  }

  if (['APPROVED', 'REJECTED', 'LINE_MANAGER_APPROVED', 'HR_APPROVED'].includes(newStatus)) {
    updateData.approvedAt = new Date()
    updateData.approverId = profile.id
  }

  const includeRelations = {
    profile: { select: { id: true, fullName: true } },
    approver: { select: { id: true, fullName: true } },
  } as const

  // ── Persist (with balance adjustment if needed) ──
  const updated = await updateLeaveWithBalance(id, leaveRequest, newStatus, updateData, includeRelations)

  // ── Side-effects (audit, notifications, approval engine) ──
  const requesterName = updated.profile?.fullName ?? 'Someone'

  await recordLeaveAudit({
    organisationId: profile.organisationId,
    actorId: profile.id,
    newStatus,
    currentStatus,
    entityId: id,
    comment,
    ipAddress: request.headers.get('x-forwarded-for') || undefined,
  })

  await sendLeaveNotifications({
    newStatus,
    leaveRequest,
    requesterName,
    comment,
  })

  await orchestrateLeaveApproval({
    newStatus,
    entityId: id,
    organisationId: profile.organisationId,
    submitterId: profile.id,
    leaveType: leaveRequest.leaveType,
    submitterManagerId: profile.managerId,
  })

  return success({ leaveRequest: updated })
})

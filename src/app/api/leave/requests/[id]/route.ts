import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { success } from '@/lib/api-response'
import { withAuth } from '@/lib/with-auth'
import { recordAuditEvent, AuditActions } from '@/lib/audit'
import { requireEnum, optionalString, parseBody } from '@/lib/validation'
import { validateRequestTransition, isRequesterTransition, isApproverTransition, isAdminTransition } from '@/lib/request-transitions'
import { NotFoundError, PermissionError } from '@/lib/errors'
import type { RequestStatus } from '@/generated/prisma/client'

const REQUEST_STATUSES = [
  'DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED',
  'FULFILMENT_IN_PROGRESS', 'COMPLETED', 'WITHDRAWN',
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

  if (!isOwner && !isApprover && !isAdmin) {
    throw new PermissionError('You do not have access to this leave request')
  }

  return success({ leaveRequest })
})

/**
 * PATCH /api/leave/requests/[id] — Update leave request status.
 *
 * Enforces the request state machine:
 * - Requester can: SUBMIT (DRAFT→SUBMITTED), WITHDRAW (DRAFT/SUBMITTED→WITHDRAWN)
 * - Approver can: REVIEW (SUBMITTED→UNDER_REVIEW), APPROVE, REJECT
 * - Admin can: FULFILMENT_IN_PROGRESS, COMPLETED
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
      profile: { select: { organisationId: true } },
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

  // Validate the transition
  validateRequestTransition(currentStatus, newStatus)

  // Role-based access control
  const isOwner = leaveRequest.profileId === profile.id
  const isApproverUser = leaveRequest.approverId === profile.id
  const isAdmin = profile.orgPermission === 'ADMIN' || profile.orgPermission === 'OWNER'

  if (isRequesterTransition(newStatus) && !isOwner) {
    throw new PermissionError('Only the requester can perform this action')
  }

  if (isApproverTransition(newStatus) && !isApproverUser && !isAdmin) {
    throw new PermissionError('Only the assigned approver or an admin can perform this action')
  }

  if (isAdminTransition(newStatus) && !isAdmin) {
    throw new PermissionError('Only an admin can perform this action')
  }

  // Build the update data
  const updateData: Record<string, unknown> = { status: newStatus }

  if (newStatus === 'APPROVED' || newStatus === 'REJECTED') {
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

  // If approving annual leave, update the balance in a transaction
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

  return success({ leaveRequest: updated })
})

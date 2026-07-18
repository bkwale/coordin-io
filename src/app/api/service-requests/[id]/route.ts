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
 * GET /api/service-requests/[id] — Get a single service request.
 */
export const GET = withAuth(async (request: NextRequest, { profile }) => {
  const id = request.url.match(/\/service-requests\/([^/?]+)/)?.[1]
  if (!id) throw new NotFoundError('Service request not found')

  const serviceRequest = await prisma.serviceRequest.findUnique({
    where: { id },
    include: {
      profile: { select: { id: true, fullName: true, jobTitle: true, organisationId: true } },
      approver: { select: { id: true, fullName: true } },
    },
  })

  if (!serviceRequest) {
    throw new NotFoundError('Service request not found')
  }

  const isOwner = serviceRequest.profileId === profile.id
  const isApprover = serviceRequest.approverId === profile.id
  const isAdmin = profile.orgPermission === 'ADMIN' || profile.orgPermission === 'OWNER'

  if (!isOwner && !isApprover && !isAdmin) {
    throw new PermissionError('You do not have access to this service request')
  }

  return success({ serviceRequest })
})

/**
 * PATCH /api/service-requests/[id] — Update service request status.
 *
 * Enforces the request state machine:
 * - Requester can: SUBMIT, WITHDRAW
 * - Approver/Admin can: UNDER_REVIEW, APPROVE, REJECT
 * - Admin can: FULFILMENT_IN_PROGRESS, COMPLETED
 */
export const PATCH = withAuth(async (request: NextRequest, { profile }) => {
  const id = request.url.match(/\/service-requests\/([^/?]+)/)?.[1]
  if (!id) throw new NotFoundError('Service request not found')
  const body = await parseBody(request)

  const newStatus = requireEnum(body.status, 'Status', REQUEST_STATUSES)
  const comment = optionalString(body.comment, 'Comment', 1000)

  const serviceRequest = await prisma.serviceRequest.findUnique({
    where: { id },
    include: {
      profile: { select: { organisationId: true } },
    },
  })

  if (!serviceRequest) {
    throw new NotFoundError('Service request not found')
  }

  // Org boundary
  if (serviceRequest.profile.organisationId !== profile.organisationId) {
    throw new NotFoundError('Service request not found')
  }

  const currentStatus = serviceRequest.status as RequestStatus

  // Validate transition
  validateRequestTransition(currentStatus, newStatus)

  // Role checks
  const isOwner = serviceRequest.profileId === profile.id
  const isApproverUser = serviceRequest.approverId === profile.id
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

  // Build update
  const updateData: Record<string, unknown> = { status: newStatus }

  if (newStatus === 'APPROVED' || newStatus === 'REJECTED') {
    updateData.approvedAt = new Date()
    if (!serviceRequest.approverId) {
      updateData.approverId = profile.id
    }
  }

  if (newStatus === 'COMPLETED') {
    updateData.completedAt = new Date()
  }

  const updated = await prisma.serviceRequest.update({
    where: { id },
    data: updateData,
    include: {
      profile: { select: { id: true, fullName: true } },
      approver: { select: { id: true, fullName: true } },
    },
  })

  // Audit
  const actionMap: Record<string, string> = {
    SUBMITTED: AuditActions.REQUEST_SUBMITTED,
    APPROVED: AuditActions.REQUEST_APPROVED,
    REJECTED: AuditActions.REQUEST_REJECTED,
    COMPLETED: AuditActions.REQUEST_COMPLETED,
    WITHDRAWN: AuditActions.REQUEST_WITHDRAWN,
  }
  if (actionMap[newStatus]) {
    await recordAuditEvent({
      organisationId: profile.organisationId,
      actorId: profile.id,
      action: actionMap[newStatus],
      entityType: 'service_request',
      entityId: id,
      metadata: {
        from: currentStatus,
        to: newStatus,
        requestType: serviceRequest.requestType,
        ...(comment ? { comment } : {}),
      },
      ipAddress: request.headers.get('x-forwarded-for') || undefined,
    })
  }

  return success({ serviceRequest: updated })
})

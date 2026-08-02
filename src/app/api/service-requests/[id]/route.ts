import { NextRequest } from 'next/server'
import { modulesPrisma } from '@/lib/prisma-modules'
import { success } from '@/lib/api-response'
import { withAuth } from '@/lib/with-auth'
import { recordAuditEvent, AuditActions } from '@/lib/audit'
import { formatAPIError, NotFoundError, PermissionError } from '@/lib/errors'
import {
  requireEnum,
  optionalString,
  optionalId,
  optionalNumber,
  optionalDate,
  parseBody,
} from '@/lib/validation'
import {
  validateRequestTransition,
  isRequesterTransition,
  isApproverTransition,
  isAdminTransition,
} from '@/lib/request-transitions'
import type { RequestStatus } from '@/generated/prisma/client'

const REQUEST_STATUSES = [
  'DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'LINE_MANAGER_APPROVED', 'HR_APPROVED',
  'APPROVED', 'REJECTED', 'FULFILMENT_IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'WITHDRAWN',
] as const

/**
 * GET /api/service-requests/[id] — Get a single service request.
 */
export const GET = withAuth(async (request: NextRequest, { profile }) => {
  const id = request.url.match(/\/service-requests\/([^/?]+)/)?.[1]
  if (!id) throw new NotFoundError('Service request not found')

  const serviceRequest = await modulesPrisma.serviceRequest.findUnique({
    where: { id },
    include: {
      profile: { select: { id: true, fullName: true, jobTitle: true, email: true, organisationId: true } },
      approver: { select: { id: true, fullName: true } },
      assignedTo: { select: { id: true, fullName: true } },
      project: { select: { id: true, name: true, code: true } },
      office: { select: { id: true, name: true } },
    },
  })

  if (!serviceRequest) {
    throw new NotFoundError('Service request not found')
  }

  // Org boundary check
  if (serviceRequest.organisationId !== profile.organisationId) {
    throw new NotFoundError('Service request not found')
  }

  const isOwner = serviceRequest.profileId === profile.id
  const isApprover = serviceRequest.approverId === profile.id
  const isAssignee = serviceRequest.assignedToId === profile.id
  const isAdmin = profile.orgPermission === 'ADMIN' || profile.orgPermission === 'OWNER'
  const isManager = profile.orgPermission === 'MANAGER'

  if (!isOwner && !isApprover && !isAssignee && !isAdmin && !isManager) {
    throw new PermissionError('You do not have access to this service request')
  }

  return success({ serviceRequest })
})

/**
 * PATCH /api/service-requests/[id] — Update service request.
 *
 * Supports:
 * - Status transitions (with role enforcement)
 * - Field updates (assignee, priority, fulfilment notes, rejection reason, etc.)
 */
export const PATCH = withAuth(async (request: NextRequest, { profile }) => {
  const id = request.url.match(/\/service-requests\/([^/?]+)/)?.[1]
  if (!id) throw new NotFoundError('Service request not found')
  const body = await parseBody(request)

  const serviceRequest = await modulesPrisma.serviceRequest.findUnique({
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

  const isOwner = serviceRequest.profileId === profile.id
  const isApproverUser = serviceRequest.approverId === profile.id
  const isAssignee = serviceRequest.assignedToId === profile.id
  const isAdmin = profile.orgPermission === 'ADMIN' || profile.orgPermission === 'OWNER'
  const isManager = profile.orgPermission === 'MANAGER'

  // Build update data
  const updateData: Record<string, unknown> = {}

  // ── Status transition ──────────────────────────────────
  if (body.status) {
    const newStatus = requireEnum(body.status, 'Status', REQUEST_STATUSES)
    const currentStatus = serviceRequest.status as RequestStatus

    // Validate transition
    validateRequestTransition(currentStatus, newStatus)

    // Role checks
    if (isRequesterTransition(newStatus) && !isOwner) {
      throw new PermissionError('Only the requester can perform this action')
    }

    if (isApproverTransition(newStatus) && !isApproverUser && !isAdmin && !isManager) {
      throw new PermissionError('Only the assigned approver or an admin can perform this action')
    }

    if (isAdminTransition(newStatus) && !isAdmin && !isManager) {
      throw new PermissionError('Only an admin or manager can perform this action')
    }

    updateData.status = newStatus

    if (newStatus === 'APPROVED' || newStatus === 'REJECTED') {
      updateData.approvedAt = new Date()
      if (!serviceRequest.approverId) {
        updateData.approverId = profile.id
      }
    }

    if (newStatus === 'REJECTED') {
      const reason = optionalString(body.rejectionReason, 'Rejection reason', 2000)
      if (reason) updateData.rejectionReason = reason
    }

    if (newStatus === 'COMPLETED') {
      updateData.completedAt = new Date()
    }
  }

  // ── Field updates (owner or admin) ─────────────────────
  if (!body.status) {
    if (!isOwner && !isAdmin && !isManager && !isAssignee) {
      throw new PermissionError('You do not have permission to update this request')
    }

    if (body.assignedToId !== undefined) {
      if (!isAdmin && !isManager) {
        throw new PermissionError('Only admins/managers can assign requests')
      }
      updateData.assignedToId = optionalId(body.assignedToId, 'Assigned to')
    }

    if (body.approverId !== undefined) {
      if (!isAdmin && !isManager) {
        throw new PermissionError('Only admins/managers can change the approver')
      }
      updateData.approverId = optionalId(body.approverId, 'Approver')
    }

    if (body.priority !== undefined) {
      updateData.priority = requireEnum(body.priority, 'Priority', ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const)
    }

    if (body.fulfilmentNotes !== undefined) {
      updateData.fulfilmentNotes = optionalString(body.fulfilmentNotes, 'Fulfilment notes', 4000)
    }

    if (body.estimatedCost !== undefined) {
      updateData.estimatedCost = optionalNumber(body.estimatedCost, 'Estimated cost', { min: 0 })
    }

    if (body.requiredByDate !== undefined) {
      updateData.requiredByDate = optionalDate(body.requiredByDate, 'Required by date')
    }

    if (body.location !== undefined) {
      updateData.location = optionalString(body.location, 'Location', 500)
    }

    if (body.budgetCode !== undefined) {
      updateData.budgetCode = optionalString(body.budgetCode, 'Budget code', 50)
    }

    if (body.serviceTarget !== undefined) {
      updateData.serviceTarget = optionalNumber(body.serviceTarget, 'Service target', { min: 1, max: 365 })
    }

    if (body.description !== undefined) {
      updateData.description = optionalString(body.description, 'Description', 4000)
    }

    if (body.category !== undefined) {
      updateData.category = optionalString(body.category, 'Category', 100)
    }
  }

  const updated = await modulesPrisma.serviceRequest.update({
    where: { id },
    data: updateData,
    include: {
      profile: { select: { id: true, fullName: true, jobTitle: true } },
      approver: { select: { id: true, fullName: true } },
      assignedTo: { select: { id: true, fullName: true } },
      project: { select: { id: true, name: true, code: true } },
      office: { select: { id: true, name: true } },
    },
  })

  // Audit
  if (body.status) {
    const actionMap: Record<string, string> = {
      SUBMITTED: AuditActions.REQUEST_SUBMITTED,
      APPROVED: AuditActions.REQUEST_APPROVED,
      REJECTED: AuditActions.REQUEST_REJECTED,
      COMPLETED: AuditActions.REQUEST_COMPLETED,
      WITHDRAWN: AuditActions.REQUEST_WITHDRAWN,
    }
    const statusStr = String(body.status)
    const auditAction = actionMap[statusStr] || `request.${statusStr.toLowerCase()}`
    await recordAuditEvent({
      organisationId: profile.organisationId,
      actorId: profile.id,
      action: auditAction,
      entityType: 'service_request',
      entityId: id,
      metadata: {
        from: serviceRequest.status,
        to: body.status,
        requestType: serviceRequest.requestType,
        requestNumber: serviceRequest.requestNumber,
      },
      ipAddress: request.headers.get('x-forwarded-for') || undefined,
    })
  }

  return success({ serviceRequest: updated })
})

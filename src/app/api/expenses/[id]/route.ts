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
 * GET /api/expenses/[id] — Get a single expense claim.
 */
export const GET = withAuth(async (request: NextRequest, { profile }) => {
  const id = request.url.match(/\/expenses\/([^/?]+)/)?.[1]
  if (!id) throw new NotFoundError('Expense claim not found')

  const claim = await prisma.expenseClaim.findUnique({
    where: { id },
    include: {
      profile: { select: { id: true, fullName: true, jobTitle: true, organisationId: true } },
      approver: { select: { id: true, fullName: true } },
    },
  })

  if (!claim) {
    throw new NotFoundError('Expense claim not found')
  }

  const isOwner = claim.profileId === profile.id
  const isApprover = claim.approverId === profile.id
  const isAdmin = profile.orgPermission === 'ADMIN' || profile.orgPermission === 'OWNER'

  if (!isOwner && !isApprover && !isAdmin) {
    throw new PermissionError('You do not have access to this expense claim')
  }

  return success({ claim })
})

/**
 * PATCH /api/expenses/[id] — Update expense claim status.
 *
 * Enforces the request state machine:
 * - Requester can: SUBMIT, WITHDRAW
 * - Approver/Admin can: UNDER_REVIEW, APPROVE, REJECT
 * - Admin can: FULFILMENT_IN_PROGRESS, COMPLETED
 */
export const PATCH = withAuth(async (request: NextRequest, { profile }) => {
  const id = request.url.match(/\/expenses\/([^/?]+)/)?.[1]
  if (!id) throw new NotFoundError('Expense claim not found')
  const body = await parseBody(request)

  const newStatus = requireEnum(body.status, 'Status', REQUEST_STATUSES)
  const comment = optionalString(body.comment, 'Comment', 1000)

  const claim = await prisma.expenseClaim.findUnique({
    where: { id },
    include: {
      profile: { select: { organisationId: true } },
    },
  })

  if (!claim) {
    throw new NotFoundError('Expense claim not found')
  }

  // Org boundary
  if (claim.profile.organisationId !== profile.organisationId) {
    throw new NotFoundError('Expense claim not found')
  }

  const currentStatus = claim.status as RequestStatus

  // Validate transition
  validateRequestTransition(currentStatus, newStatus)

  // Role checks
  const isOwner = claim.profileId === profile.id
  const isClaimApprover = claim.approverId === profile.id
  const isAdmin = profile.orgPermission === 'ADMIN' || profile.orgPermission === 'OWNER'

  if (isRequesterTransition(newStatus) && !isOwner) {
    throw new PermissionError('Only the claimant can perform this action')
  }

  if (isApproverTransition(newStatus) && !isClaimApprover && !isAdmin) {
    throw new PermissionError('Only the assigned approver or an admin can perform this action')
  }

  if (isAdminTransition(newStatus) && !isAdmin) {
    throw new PermissionError('Only an admin can perform this action')
  }

  // Build update
  const updateData: Record<string, unknown> = { status: newStatus }

  if (newStatus === 'APPROVED' || newStatus === 'REJECTED') {
    updateData.approvedAt = new Date()
    if (!claim.approverId) {
      updateData.approverId = profile.id
    }
  }

  const updated = await prisma.expenseClaim.update({
    where: { id },
    data: updateData,
    include: {
      profile: { select: { id: true, fullName: true } },
      approver: { select: { id: true, fullName: true } },
    },
  })

  // Audit
  const actionMap: Record<string, string> = {
    SUBMITTED: AuditActions.EXPENSE_SUBMITTED,
    APPROVED: AuditActions.EXPENSE_APPROVED,
    REJECTED: AuditActions.EXPENSE_REJECTED,
    WITHDRAWN: AuditActions.EXPENSE_WITHDRAWN,
  }
  if (actionMap[newStatus]) {
    await recordAuditEvent({
      organisationId: profile.organisationId,
      actorId: profile.id,
      action: actionMap[newStatus],
      entityType: 'expense_claim',
      entityId: id,
      metadata: {
        from: currentStatus,
        to: newStatus,
        amount: claim.amount,
        currency: claim.currency,
        ...(comment ? { comment } : {}),
      },
      ipAddress: request.headers.get('x-forwarded-for') || undefined,
    })
  }

  return success({ claim: updated })
})

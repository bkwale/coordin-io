import type { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { success } from '@/lib/api-response'
import { withAuth } from '@/lib/with-auth'
import { requireEnum, optionalString, parseBody } from '@/lib/validation'
import { processApprovalStep, forceApprove } from '@/lib/approval-engine'
import { recordAuditEvent, AuditActions } from '@/lib/audit'
import { NotFoundError, PermissionError } from '@/lib/errors'

function extractId(url: string): string {
  const id = url.match(/\/approvals\/([^/?]+)/)?.[1]
  if (!id) throw new NotFoundError('Approval ID is required')
  return id
}

/**
 * GET /api/approvals/[id] — Get approval instance detail with all steps.
 */
export const GET = withAuth(async (request: NextRequest, { profile }) => {
  const id = extractId(request.url)

  const instance = await prisma.approvalInstance.findFirst({
    where: {
      id,
      organisationId: profile.organisationId,
    },
    include: {
      steps: {
        orderBy: { stepOrder: 'asc' },
        include: {
          approver: { select: { id: true, fullName: true } },
          escalatedTo: { select: { id: true, fullName: true } },
        },
      },
      route: { select: { id: true, name: true, requestType: true } },
      submitter: { select: { id: true, fullName: true, email: true } },
    },
  })

  if (!instance) throw new NotFoundError('Approval not found')

  return success({ approval: instance })
})

/**
 * PATCH /api/approvals/[id] — Process an approval action (approve/reject/force-approve).
 */
export const PATCH = withAuth(async (request: NextRequest, { profile }) => {
  const id = extractId(request.url)
  const body = await parseBody(request)

  const action = requireEnum(body.action, 'Action', ['APPROVE', 'REJECT', 'FORCE_APPROVE'] as const)
  const comment = optionalString(body.comment, 'Comment', 2000) ?? undefined

  // Verify instance belongs to this org
  const instance = await prisma.approvalInstance.findFirst({
    where: { id, organisationId: profile.organisationId },
  })
  if (!instance) throw new NotFoundError('Approval not found')

  if (action === 'FORCE_APPROVE') {
    // Only ADMIN/OWNER can force-approve
    if (!['ADMIN', 'OWNER'].includes(profile.orgPermission)) {
      throw new PermissionError('Only administrators can force-approve')
    }
    await forceApprove(id, profile.id, comment)

    return success({
      instanceStatus: 'APPROVED',
      isComplete: true,
      message: 'Approval force-completed by administrator',
    })
  }

  const result = await processApprovalStep(id, profile.id, action, comment)

  // Record audit event
  await recordAuditEvent({
    organisationId: profile.organisationId,
    actorId: profile.id,
    action: action === 'APPROVE' ? AuditActions.APPROVAL_STEP_APPROVED : AuditActions.APPROVAL_STEP_REJECTED,
    entityType: 'ApprovalInstance',
    entityId: id,
    metadata: {
      action,
      comment,
      stepStatus: result.stepStatus,
      instanceStatus: result.instanceStatus,
      requestType: instance.requestType,
      entityId: instance.entityId,
    },
  })

  // If approval is complete (approved or rejected), update the source entity
  if (result.isComplete) {
    await updateSourceEntity(
      instance.requestType,
      instance.entityId,
      result.instanceStatus as 'APPROVED' | 'REJECTED',
    )

    await recordAuditEvent({
      organisationId: profile.organisationId,
      actorId: profile.id,
      action: AuditActions.APPROVAL_COMPLETED,
      entityType: 'ApprovalInstance',
      entityId: id,
      metadata: {
        finalStatus: result.instanceStatus,
        requestType: instance.requestType,
        entityId: instance.entityId,
      },
    })
  }

  return success({
    instanceStatus: result.instanceStatus,
    stepStatus: result.stepStatus,
    nextStepOrder: result.nextStepOrder,
    isComplete: result.isComplete,
  })
})

/**
 * When an approval workflow completes, update the source entity's status.
 */
async function updateSourceEntity(
  requestType: string,
  entityId: string,
  outcome: 'APPROVED' | 'REJECTED',
): Promise<void> {
  const newStatus = outcome === 'APPROVED' ? 'APPROVED' : 'REJECTED'

  switch (requestType) {
    case 'LEAVE':
      await prisma.leaveRequest.update({
        where: { id: entityId },
        data: { status: newStatus },
      }).catch((err) => console.error(`[approval] Failed to update leave request ${entityId}:`, err))
      break

    case 'EXPENSE':
      await prisma.expenseClaim.update({
        where: { id: entityId },
        data: { status: newStatus },
      }).catch((err) => console.error(`[approval] Failed to update expense ${entityId}:`, err))
      break

    case 'SERVICE_REQUEST':
      await prisma.serviceRequest.update({
        where: { id: entityId },
        data: { status: newStatus },
      }).catch((err) => console.error(`[approval] Failed to update service request ${entityId}:`, err))
      break

    case 'TRAVEL':
      await prisma.leaveRequest.update({
        where: { id: entityId },
        data: { status: newStatus },
      }).catch((err) => console.error(`[approval] Failed to update travel request ${entityId}:`, err))
      break
  }
}

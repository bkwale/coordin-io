import type { NextRequest } from 'next/server'
import { success } from '@/lib/api-response'
import { withAuth } from '@/lib/with-auth'
import { getPendingApprovalsForUser } from '@/lib/approval-engine'

/**
 * GET /api/approvals — List pending approvals for the current user.
 * Returns all approval step instances where the user is the assigned approver.
 */
export const GET = withAuth(async (_request: NextRequest, { profile }) => {
  const pendingSteps = await getPendingApprovalsForUser(
    profile.id,
    profile.organisationId,
  )

  // Enrich with entity details based on request type
  const approvals = pendingSteps.map((step) => ({
    stepId: step.id,
    instanceId: step.instance.id,
    stepOrder: step.stepOrder,
    label: step.label,
    requestType: step.instance.requestType,
    entityId: step.instance.entityId,
    submitter: step.instance.submitter,
    submittedAt: step.instance.createdAt,
    escalationDueAt: step.escalationDueAt,
  }))

  return success({ approvals, count: approvals.length })
})

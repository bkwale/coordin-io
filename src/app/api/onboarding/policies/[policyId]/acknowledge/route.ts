import type { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { success } from '@/lib/api-response'
import { NotFoundError } from '@/lib/errors'
import { recordAuditEvent, AuditActions } from '@/lib/audit'
import { withAuth } from '@/lib/with-auth'

/**
 * POST /api/onboarding/policies/[policyId]/acknowledge
 *
 * Acknowledge a specific policy document. Creates or updates the
 * PolicyAcknowledgement record with acknowledged=true.
 */
export const POST = withAuth(async (
  request: NextRequest,
  { profile },
) => {
  // Extract policyId from URL (withAuth wraps the handler, so route
  // params are not forwarded directly).
  const url = new URL(request.url)
  const segments = url.pathname.split('/')
  // URL: /api/onboarding/policies/[policyId]/acknowledge
  const policyIdFromUrl = segments[segments.indexOf('policies') + 1]

  if (!policyIdFromUrl) {
    throw new NotFoundError('Policy ID is required')
  }

  // Verify the policy exists and belongs to this org
  const policy = await prisma.policyDocument.findFirst({
    where: {
      id: policyIdFromUrl,
      organisationId: profile.organisationId,
    },
  })

  if (!policy) {
    throw new NotFoundError('Policy not found')
  }

  // Upsert the acknowledgement
  const acknowledgement = await prisma.policyAcknowledgement.upsert({
    where: {
      profileId_policyId_policyRevision: {
        profileId: profile.id,
        policyId: policy.id,
        policyRevision: policy.revision,
      },
    },
    update: {
      acknowledged: true,
      acknowledgedAt: new Date(),
    },
    create: {
      profileId: profile.id,
      policyId: policy.id,
      policyRevision: policy.revision,
      acknowledged: true,
      acknowledgedAt: new Date(),
    },
  })

  // Audit trail
  await recordAuditEvent({
    organisationId: profile.organisationId,
    actorId: profile.id,
    action: AuditActions.ONBOARDING_ITEM_ACKNOWLEDGED,
    entityType: 'policy_acknowledgement',
    entityId: acknowledgement.id,
    metadata: { policyId: policy.id, policyTitle: policy.title },
    ipAddress: request.headers.get('x-forwarded-for') || undefined,
  })

  return success({ acknowledgement })
})

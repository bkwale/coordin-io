import type { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { success } from '@/lib/api-response'
import { withAuth } from '@/lib/with-auth'

/**
 * GET /api/onboarding/policies — Returns mandatory policies for the
 * user's organisation, with their acknowledgement status.
 */
export const GET = withAuth(async (_request: NextRequest, { profile }) => {
  const policies = await prisma.policyDocument.findMany({
    where: {
      organisationId: profile.organisationId,
      mandatory: true,
    },
    orderBy: { effectiveDate: 'asc' },
    include: {
      acknowledgements: {
        where: { profileId: profile.id },
        take: 1,
      },
    },
  })

  const mapped = policies.map((policy) => {
    const ack = policy.acknowledgements[0] ?? null
    return {
      id: policy.id,
      title: policy.title,
      category: policy.category,
      revision: policy.revision,
      mandatory: policy.mandatory,
      content: policy.content,
      fileUrl: policy.fileUrl,
      acknowledged: ack?.acknowledged ?? false,
      acknowledgedAt: ack?.acknowledgedAt ?? null,
      openedAt: ack?.openedAt ?? null,
    }
  })

  return success({ policies: mapped })
})

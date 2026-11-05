import { modulesPrisma } from '@/lib/prisma-modules'
import { NotFoundError } from '@/lib/errors'
import { canManageHR } from '@/lib/staffing-utils'
import { canView, type Actor } from './probation-workflow'
import type { OrgPermission } from '@/generated/prisma/client'

/** Load a probation review and work out the caller's role on it. 404 (not 403) when they may not see it. */
export async function loadReviewForActor(id: string, profile: { id: string; organisationId: string; orgPermission: string }) {
  const review = await modulesPrisma.probationReview.findUnique({
    where: { id },
    include: {
      profile: { select: { id: true, fullName: true, jobTitle: true, startDate: true, organisationId: true, managerId: true } },
      goals: { orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] },
    },
  })
  if (!review || review.profile?.organisationId !== profile.organisationId) throw new NotFoundError('Probation review not found')
  const actor: Actor = {
    isHR: canManageHR(profile.orgPermission as OrgPermission),
    isLineManager: !!review.profile.managerId && review.profile.managerId === profile.id,
    isSubject: review.profileId === profile.id,
  }
  if (!canView(review.workflowStatus, actor)) throw new NotFoundError('Probation review not found')
  return { review, actor }
}


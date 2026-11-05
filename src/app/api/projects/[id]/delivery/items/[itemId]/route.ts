import { NextRequest } from 'next/server'
import { success } from '@/lib/api-response'
import { withProjectAccess } from '@/lib/with-project-access'
import { assertDeliveryWrite, canApproveDelivery } from '@/lib/delivery/access'
import { parseBody } from '@/lib/validation'
import { updateItem } from '@/lib/delivery/service'

/** PATCH — tick off / assign / date / link evidence. Approval steps need project lead or design lead. */
export const PATCH = withProjectAccess(async (request: NextRequest, { projectId, project, profile, membership }) => {
  const itemId = new URL(request.url).pathname.split('/').pop()!
  const access = await assertDeliveryWrite({ profile, projectId, membership }, 'ARCHITECT')
  const canApprove = canApproveDelivery(access)
  const item = await updateItem(projectId, itemId, await parseBody(request), { organisationId: project.organisationId, id: profile.id, canApprove })
  return success({ item })
}, { minProjectRole: 'ARCHITECT' })

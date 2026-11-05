import { NextRequest } from 'next/server'
import { success } from '@/lib/api-response'
import { withProjectAccess } from '@/lib/with-project-access'
import { assertDeliveryWrite } from '@/lib/delivery/access'
import { parseBody } from '@/lib/validation'
import { decideGate } from '@/lib/delivery/service'

/** POST — gate decision { decision: PASS|CONDITIONAL_PASS|HOLD, notes?, openItems? } (project lead). */
export const POST = withProjectAccess(async (request: NextRequest, { projectId, project, profile, membership }) => {
  await assertDeliveryWrite({ profile, projectId, membership }, 'PROJECT_LEAD')
  const stageId = new URL(request.url).pathname.split('/').slice(-2)[0]
  const stage = await decideGate(projectId, stageId, await parseBody(request), { organisationId: project.organisationId, id: profile.id })
  return success({ stage })
}, { minProjectRole: 'PROJECT_LEAD' })

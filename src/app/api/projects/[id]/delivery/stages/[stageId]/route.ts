import { NextRequest } from 'next/server'
import { success } from '@/lib/api-response'
import { withProjectAccess } from '@/lib/with-project-access'
import { parseBody } from '@/lib/validation'
import { updateStage } from '@/lib/delivery/service'

/** PATCH — stage dates, lead, start (project lead). Gate outcomes go through /decision. */
export const PATCH = withProjectAccess(async (request: NextRequest, { projectId, project, profile }) => {
  const stageId = new URL(request.url).pathname.split('/').pop()!
  const stage = await updateStage(projectId, stageId, await parseBody(request), { organisationId: project.organisationId, id: profile.id })
  return success({ stage })
}, { minProjectRole: 'PROJECT_LEAD' })

import { NextRequest } from 'next/server'
import { success } from '@/lib/api-response'
import { withProjectAccess } from '@/lib/with-project-access'
import { parseBody } from '@/lib/validation'
import { addItem } from '@/lib/delivery/service'

/** POST — add a deliverable/responsibility to a stage { stageId, title, kind?, responsibleParty?, assigneeId?, dueDate? }. */
export const POST = withProjectAccess(async (request: NextRequest, { projectId, project, profile }) => {
  const item = await addItem(projectId, await parseBody(request), { organisationId: project.organisationId, id: profile.id })
  return success({ item }, 201)
}, { minProjectRole: 'ARCHITECT' })

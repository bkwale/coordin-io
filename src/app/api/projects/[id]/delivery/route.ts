import { NextRequest } from 'next/server'
import { success } from '@/lib/api-response'
import { withProjectAccess } from '@/lib/with-project-access'
import { assertDeliveryWrite } from '@/lib/delivery/access'
import { parseBody } from '@/lib/validation'
import { applyFramework, getDelivery } from '@/lib/delivery/service'
import type { Framework } from '@/lib/delivery/types'

/** GET /api/projects/[id]/delivery — framework, stages/gates and their checklists (any project member). */
export const GET = withProjectAccess(async (_req: NextRequest, { projectId }) => success(await getDelivery(projectId)))

/** POST — apply a framework { framework: RIBA|CWA|CUSTOM, accorOverlay?, customStages? } (project lead). */
export const POST = withProjectAccess(async (request: NextRequest, { projectId, project, profile, membership }) => {
  await assertDeliveryWrite({ profile, projectId, membership }, 'PROJECT_LEAD')
  const body = await parseBody(request)
  const data = await applyFramework({
    projectId, organisationId: project.organisationId, actorId: profile.id,
    framework: String(body.framework) as Framework, accorOverlay: body.accorOverlay === true,
    customStages: Array.isArray(body.customStages) ? (body.customStages as { name: string; code?: string }[]) : undefined,
  })
  return success(data, 201)
}, { minProjectRole: 'PROJECT_LEAD' })

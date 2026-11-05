import type { NextRequest } from 'next/server'
import { withProjectAccess } from '@/lib/with-project-access'
import { success, error } from '@/lib/api-response'
import { ValidationError } from '@/lib/errors'
import { confirmProjectSetup } from '@/lib/ai/project-setup'

export const dynamic = 'force-dynamic'

/**
 * POST /api/projects/[id]/setup/confirm { runId, parameters, acceptedConditions: number[] }
 * The architect has reviewed every pre-filled value and typed the design numbers. Writes a new
 * ProjectProfile (sourceRunId), runs the engine, adds accepted municipal conditions as MUNICIPALITY items.
 */
export const POST = withProjectAccess(async (request: NextRequest, { projectId, profile, project, authUserId }) => {
  const body = await request.json().catch(() => ({}))
  const runId = typeof body.runId === 'string' ? body.runId : ''
  if (!runId) return error(new ValidationError('runId is required'))
  const acceptedBounds = Array.isArray(body.acceptedBounds) ? (body.acceptedBounds as unknown[]).filter((k): k is string => k === 'height' || k === 'storeys') : undefined
  const accepted = Array.isArray(body.acceptedConditions) ? (body.acceptedConditions as unknown[]).filter((n): n is number => typeof n === 'number') : []
  try {
    const result = await confirmProjectSetup({ projectId, organisationId: project.organisationId, runId, parameters: body.parameters, acceptedConditions: accepted, acceptedBounds, actorProfileId: profile.id, actorAuthUserId: authUserId })
    return success(result)
  } catch (e) { return error(e) }
}, { minProjectRole: 'PROJECT_LEAD' })

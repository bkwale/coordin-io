import type { NextRequest } from 'next/server'
import { withSuperAdmin } from '@/lib/with-super-admin'
import { checkRateLimit } from '@/lib/rate-limit'
import { success, error } from '@/lib/api-response'
import { ValidationError } from '@/lib/errors'
import { confirmPracticeSetup } from '@/lib/ai/confirm-practice'

export const dynamic = 'force-dynamic'

/**
 * POST /api/ai/practice-setup/confirm  { runId, organisationId, overrides?: { [moduleKey]: boolean } }
 * "Switch on Coordin": applies the run's module decisions as feature flags for the organisation.
 * Platform-admin for the demo surface; org-owner self-serve comes with the onboarding flow.
 */
export const POST = withSuperAdmin(async (request: NextRequest, { authUserId }) => {
  const limited = await checkRateLimit(`ai-confirm:${authUserId}`, { maxRequests: 10, windowMs: 60_000 })
  if (limited) return limited

  const body = await request.json().catch(() => ({}))
  const runId = typeof body.runId === 'string' ? body.runId.trim() : ''
  const organisationId = typeof body.organisationId === 'string' ? body.organisationId.trim() : ''
  if (!runId || !organisationId) return error(new ValidationError('runId and organisationId are required'))

  const overrides: Record<string, boolean> = {}
  if (body.overrides && typeof body.overrides === 'object') {
    for (const [k, v] of Object.entries(body.overrides as Record<string, unknown>)) {
      if (typeof v !== 'boolean' || !/^[a-z_]{2,40}$/.test(k)) return error(new ValidationError(`Invalid override for ${k}`))
      overrides[k] = v
    }
  }

  try {
    const result = await confirmPracticeSetup({ runId, organisationId, overrides, actorAuthUserId: authUserId })
    return success(result)
  } catch (e) {
    return error(e)
  }
})

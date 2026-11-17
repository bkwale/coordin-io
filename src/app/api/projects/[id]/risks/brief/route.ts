import { NextRequest, NextResponse } from 'next/server'
import { withProjectAccess } from '@/lib/with-project-access'
import { success, error } from '@/lib/api-response'
import { ValidationError } from '@/lib/errors'
import { checkRateLimit } from '@/lib/rate-limit'
import { isFeatureEnabled } from '@/lib/feature-flags'
import { parseBody } from '@/lib/validation'
import { aiAvailability } from '@/lib/ai/availability'
import { activeRiskSignals } from '@/lib/risk/active'
import { flagsHash } from '@/lib/ai/risk-brief-core'
import { latestBrief, writeBrief, parseBriefInput, type BriefMapping } from '@/lib/ai/risk-brief'

export const maxDuration = 60
export const dynamic = 'force-dynamic'

const guard = async (organisationId: string) => {
  if (!(await isFeatureEnabled(organisationId, 'ai_risk'))) throw new ValidationError('Risk analysis is not switched on for your practice.')
}

function shape(run: NonNullable<Awaited<ReturnType<typeof latestBrief>>>, hash: string) {
  const m = run.status === 'AWAITING_CONFIRMATION' ? (run.mapping as unknown as BriefMapping | null) : null
  const input = parseBriefInput(run.inputSummary)
  return {
    id: run.id, status: run.status, createdAt: run.createdAt, error: run.status === 'FAILED' ? run.error : null, language: input.language ?? 'en',
    // Written for exactly these flags? If not, the reader is told it is out of date.
    current: input.hash === hash,
    brief: m && m.kind === 'risk-brief' ? { headline: m.headline, overview: m.overview, priorities: m.priorities, notes: m.notes } : null,
  }
}

/** GET /api/projects/[id]/risks/brief — the newest AI brief for this project, and whether it still matches the flags. */
export const GET = withProjectAccess(async (_request: NextRequest, { projectId, profile }) => {
  await guard(profile.organisationId)
  const [{ active }, run] = await Promise.all([activeRiskSignals(projectId), latestBrief(projectId)])
  return NextResponse.json({ data: { brief: run ? shape(run, flagsHash(active)) : null } }, { headers: { 'cache-control': 'no-store' } })
})

/**
 * POST /api/projects/[id]/risks/brief — body { language?: 'en' | 'et' }
 * Has the AI rank and explain the flags being raised right now. It is given only the flags, and everything it writes is
 * checked against them. If a brief for exactly these flags already exists in that language, that one is returned.
 */
export const POST = withProjectAccess(async (request: NextRequest, { projectId, profile, project, authUserId }) => {
  try {
    await guard(profile.organisationId)
    const limited = await checkRateLimit(`ai-risk-brief:${authUserId}`, { maxRequests: 4, windowMs: 60_000 })
    if (limited) return limited
    const body = await parseBody(request).catch(() => ({} as Record<string, unknown>))
    const language = body.language === 'et' ? 'et' : 'en'

    const { active } = await activeRiskSignals(projectId)
    if (active.length === 0) throw new ValidationError('Nothing is flagged, so there is nothing to brief.')
    const hash = flagsHash(active)
    const existing = await latestBrief(projectId)
    if (existing && existing.status === 'AWAITING_CONFIRMATION') {
      const input = parseBriefInput(existing.inputSummary)
      if (input.hash === hash && input.language === language) return success({ brief: shape(existing, hash), reused: true })
    }

    const allowFallback = await isFeatureEnabled(profile.organisationId, 'ai_fallback').catch(() => false)
    const ai = await aiAvailability({ fallbackAllowed: allowFallback })
    if (!ai.available) return NextResponse.json({ error: ai.message, code: 'AI_UNAVAILABLE' }, { status: 503 })

    try {
      await writeBrief({ projectId, projectName: project.name, organisationId: project.organisationId, authUserId, profileId: profile.id, signals: active, language })
    } catch (e) {
      // A failed model call is recorded on the run with a plain message; budget and validation errors are thrown as they are
      const failed = await latestBrief(projectId)
      if (failed?.status === 'FAILED') return NextResponse.json({ error: failed.error ?? 'The AI could not write the brief.' }, { status: 502 })
      throw e
    }
    const run = await latestBrief(projectId)
    return success({ brief: run ? shape(run, hash) : null })
  } catch (e) {
    return error(e)
  }
})

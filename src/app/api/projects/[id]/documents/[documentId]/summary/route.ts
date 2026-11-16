import { NextRequest, NextResponse, after } from 'next/server'
import { withProjectAccess } from '@/lib/with-project-access'
import { success, error } from '@/lib/api-response'
import { ValidationError, PermissionError } from '@/lib/errors'
import { checkRateLimit } from '@/lib/rate-limit'
import { isFeatureEnabled } from '@/lib/feature-flags'
import { canPerform } from '@/lib/role-permissions'
import { parseBody } from '@/lib/validation'
import { aiAvailability } from '@/lib/ai/availability'
import { failIfStale } from '@/lib/ai/stale-runs'
import { executeSummary } from '@/lib/ai/summarise'
import { startSummary, latestSummary, parseRunInput, tasksMade } from '@/lib/ai/summary-service'
import type { OrgPermission } from '@/generated/prisma/client'

export const maxDuration = 300
export const dynamic = 'force-dynamic'

const LANGUAGES = ['same', 'et', 'en'] as const

function documentIdFrom(request: NextRequest): string {
  const m = new URL(request.url).pathname.match(/\/documents\/([^/]+)\/summary/)
  if (!m?.[1] || !/^[a-z0-9]{10,40}$/i.test(m[1])) throw new ValidationError('Unknown document')
  return m[1]
}

async function guard(profile: { organisationId: string; orgPermission: string }) {
  if (!(await isFeatureEnabled(profile.organisationId, 'ai_summaries'))) throw new ValidationError('Document summaries are not switched on for your practice.')
  // The summary quotes the document, so the reader must be allowed to read project documents
  if (!canPerform(profile.orgPermission as OrgPermission, 'documents', 'view_project')) throw new PermissionError('You do not have access to project documents')
}

/** GET /api/projects/[id]/documents/[documentId]/summary — the newest summary of this document, or null. */
export const GET = withProjectAccess(async (request: NextRequest, { projectId, profile }) => {
  await guard(profile)
  const documentId = documentIdFrom(request)
  const run = await latestSummary(projectId, documentId)
  if (!run) return NextResponse.json({ data: { run: null } }, { headers: { 'cache-control': 'no-store' } })
  // A run still going long after the function limit will never finish: say so
  Object.assign(run, await failIfStale(run))
  const input = parseRunInput(run.inputSummary)
  return NextResponse.json({
    data: {
      run: {
        id: run.id, status: run.status, stages: run.stages, mapping: run.status === 'AWAITING_CONFIRMATION' || run.status === 'APPLIED' ? run.mapping : null,
        error: run.error, errorKind: run.errorKind, createdAt: run.createdAt, latencyMs: run.latencyMs,
        revision: input.revision ?? null, pages: input.pages ?? null, language: input.language ?? 'same', tasks: tasksMade(run.citations),
      },
    },
  }, { headers: { 'cache-control': 'no-store' } })
})

/**
 * POST /api/projects/[id]/documents/[documentId]/summary — body { language?: 'same' | 'et' | 'en' }
 * Reads the latest stored file of the document and starts a summary in the background. Poll GET.
 */
export const POST = withProjectAccess(async (request: NextRequest, { projectId, profile, project, authUserId }) => {
  try {
    await guard(profile)
    const documentId = documentIdFrom(request)
    const limited = await checkRateLimit(`ai-summary:${authUserId}`, { maxRequests: 6, windowMs: 60_000 })
    if (limited) return limited

    const allowFallback = await isFeatureEnabled(profile.organisationId, 'ai_fallback').catch(() => false)
    const ai = await aiAvailability({ fallbackAllowed: allowFallback })
    if (!ai.available) return NextResponse.json({ error: ai.message, code: 'AI_UNAVAILABLE' }, { status: 503 })

    const body = await parseBody(request).catch(() => ({} as Record<string, unknown>))
    const language = (LANGUAGES as readonly string[]).includes(String(body.language)) ? (body.language as (typeof LANGUAGES)[number]) : 'same'

    // One at a time per document: a second click while one is running shows the one in progress
    const current = await latestSummary(projectId, documentId)
    if (current && (current.status === 'QUEUED' || current.status === 'RUNNING')) {
      const fresh = await failIfStale(current)
      if (fresh.status === 'QUEUED' || fresh.status === 'RUNNING') return success({ runId: current.id, alreadyRunning: true }, 202)
    }

    const { run, pages, truncated } = await startSummary({ projectId, organisationId: project.organisationId, authUserId, profileId: profile.id, documentId, language })
    after(async () => { try { await executeSummary(run.id, pages, { language, truncated, allowFallback }) } catch { /* recorded on the run */ } })
    return success({ runId: run.id, pages: pages.length }, 202)
  } catch (e) {
    return error(e)
  }
})

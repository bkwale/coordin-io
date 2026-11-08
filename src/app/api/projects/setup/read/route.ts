import { NextRequest, NextResponse, after } from 'next/server'
import { withAuth } from '@/lib/with-auth'
import { isFeatureEnabled } from '@/lib/feature-flags'
import { success, error } from '@/lib/api-response'
import { ValidationError } from '@/lib/errors'
import { checkRateLimit } from '@/lib/rate-limit'
import { startProjectSetup, executeProjectSetup, SETUP_DOCUMENT_KINDS, type SetupDocumentKind } from '@/lib/ai/project-setup'
import { IngestError, INGEST_LIMITS } from '@/lib/ai/document-ingest'
import { aiAvailability } from '@/lib/ai/availability'

export const maxDuration = 300
export const dynamic = 'force-dynamic'

/**
 * POST /api/projects/setup/read — "Start from a document" in the new-project wizard.
 * multipart/form-data: file (PDF) | text, kind. Same reader as a project's Regulatory page, but the project
 * doesn't exist yet: nothing is stored, the run has no project. POST /api/projects { setupRunId } links it;
 * the architect reviews and confirms it on the new project's Regulatory page.
 */
export const POST = withAuth(async (request: NextRequest, { profile, authUserId }) => {
  const limited = await checkRateLimit(`ai-setup:${authUserId}`, { maxRequests: 10, windowMs: 60_000 })
  if (limited) return limited
  const ai = await aiAvailability({ fallbackAllowed: await isFeatureEnabled(profile.organisationId, 'ai_fallback').catch(() => false) })
  if (!ai.available) return NextResponse.json({ error: ai.message, code: 'AI_UNAVAILABLE', manual: true }, { status: 503 })

  let form: FormData
  try { form = await request.formData() } catch { return error(new ValidationError('Could not read the upload')) }
  const kindRaw = String(form.get('kind') ?? 'planning_conditions')
  if (!(SETUP_DOCUMENT_KINDS as string[]).includes(kindRaw)) return error(new ValidationError('kind must be planning_conditions, decision_notice or brief'))
  const kind = kindRaw as SetupDocumentKind
  const file = form.get('file')
  const text = form.get('text')
  try {
    let fileInput: { name: string; bytes: Uint8Array; contentType: string } | null = null
    if (file instanceof File) {
      if (file.size > INGEST_LIMITS.maxBytes) return error(new ValidationError(`File is over ${INGEST_LIMITS.maxBytes / 1024 / 1024} MB. Paste the text instead, or compress the PDF.`))
      fileInput = { name: file.name.slice(0, 120) || 'document.pdf', bytes: new Uint8Array(await file.arrayBuffer()), contentType: file.type }
    }
    const { run, pages } = await startProjectSetup({
      projectId: null, organisationId: profile.organisationId, authorProfileId: profile.id, authUserId, kind,
      file: fileInput, text: typeof text === 'string' ? text : null,
    })
    after(async () => { try { await executeProjectSetup(run.id, kind, pages) } catch { /* recorded on the run */ } })
    return success({ runId: run.id, pages: pages.length }, 202)
  } catch (e) {
    if (e instanceof IngestError) return error(new ValidationError(`${e.message} (${e.failure})`))
    return error(e)
  }
}, { requiredPermission: 'MANAGER' })

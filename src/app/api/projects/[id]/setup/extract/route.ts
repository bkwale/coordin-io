import { NextRequest, after } from 'next/server'
import { withProjectAccess } from '@/lib/with-project-access'
import { success, error } from '@/lib/api-response'
import { ValidationError } from '@/lib/errors'
import { checkRateLimit } from '@/lib/rate-limit'
import { startProjectSetup, executeProjectSetup, type SetupDocumentKind } from '@/lib/ai/project-setup'
import { IngestError, INGEST_LIMITS } from '@/lib/ai/document-ingest'

export const maxDuration = 300
export const dynamic = 'force-dynamic'

/**
 * POST /api/projects/[id]/setup/extract
 * multipart/form-data: file (PDF) | text, kind: planning_conditions | brief
 * PROJECT_LEAD only (Schneier). The file is stored as a project Document and the run is created in the
 * same transaction; extraction runs in the background — poll /api/ai/runs/[id].
 */
export const POST = withProjectAccess(async (request: NextRequest, { projectId, profile, project, authUserId }) => {
  const limited = await checkRateLimit(`ai-setup:${authUserId}`, { maxRequests: 10, windowMs: 60_000 })
  if (limited) return limited

  let form: FormData
  try { form = await request.formData() } catch { return error(new ValidationError('Could not read the upload')) }
  const kindRaw = String(form.get('kind') ?? 'planning_conditions')
  if (kindRaw !== 'planning_conditions' && kindRaw !== 'brief') return error(new ValidationError('kind must be planning_conditions or brief'))
  const kind = kindRaw as SetupDocumentKind
  const file = form.get('file')
  const text = form.get('text')

  try {
    let fileInput: { name: string; bytes: Uint8Array; contentType: string } | null = null
    if (file instanceof File) {
      if (file.size > INGEST_LIMITS.maxBytes) return error(new ValidationError('File is over 20 MB'))
      fileInput = { name: file.name.slice(0, 120) || 'document.pdf', bytes: new Uint8Array(await file.arrayBuffer()), contentType: file.type }
    }
    const { run, document, pages } = await startProjectSetup({
      projectId, organisationId: project.organisationId, authorProfileId: profile.id, authUserId, kind,
      file: fileInput, text: typeof text === 'string' ? text : null,
    })
    after(async () => { try { await executeProjectSetup(run.id, kind, pages) } catch { /* recorded on the run */ } })
    return success({ runId: run.id, documentId: document?.id ?? null, pages: pages.length }, 202)
  } catch (e) {
    if (e instanceof IngestError) return error(new ValidationError(`${e.message} (${e.failure})`))
    return error(e)
  }
}, { minProjectRole: 'PROJECT_LEAD' })

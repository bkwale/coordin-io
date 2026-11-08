import type { NextRequest } from 'next/server'
import { withProjectAccess } from '@/lib/with-project-access'
import { assertProjectWrite } from '@/lib/project-write-access'
import { success, error } from '@/lib/api-response'
import { ValidationError } from '@/lib/errors'
import { attachSetupDocument } from '@/lib/ai/project-setup'
import { IngestError, INGEST_LIMITS } from '@/lib/ai/document-ingest'

export const dynamic = 'force-dynamic'

/** POST /api/projects/[id]/setup/attach — file the PDF read in the new-project wizard into this project's Documents. multipart: runId, file. */
export const POST = withProjectAccess(async (request: NextRequest, { projectId, profile, project, membership }) => {
  await assertProjectWrite({ profile, projectId, membership }, 'PROJECT_LEAD')
  let form: FormData
  try { form = await request.formData() } catch { return error(new ValidationError('Could not read the upload')) }
  const runId = String(form.get('runId') ?? '')
  const file = form.get('file')
  if (!runId || !(file instanceof File)) return error(new ValidationError('runId and file are required'))
  if (file.size > INGEST_LIMITS.maxBytes) return error(new ValidationError('File is too large'))
  try {
    const r = await attachSetupDocument({ projectId, organisationId: project.organisationId, runId, authorProfileId: profile.id, file: { name: file.name.slice(0, 120) || 'document.pdf', bytes: new Uint8Array(await file.arrayBuffer()), contentType: file.type } })
    return success(r)
  } catch (e) {
    if (e instanceof IngestError) return error(new ValidationError(e.message))
    return error(e)
  }
}, { minProjectRole: 'PROJECT_LEAD' })

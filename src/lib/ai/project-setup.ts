/**
 * Surface B — Project Setup from Documents.
 *  startProjectSetup  : store the file as a project Document, create the AIRun (one transaction — no orphan documents)
 *  executeProjectSetup: ingest → extract (Mistral, schema-only) → normalise → map (deterministic) → AWAITING_CONFIRMATION
 *  confirmProjectSetup: PROJECT_LEAD confirms parameters + accepted conditions → ProjectProfile (sourceRunId) + engine + MUNICIPALITY items → APPLIED
 */
import { createClient } from '@supabase/supabase-js'
import { prisma } from '@/lib/prisma'
import { createRun, runAI } from './pipeline'
import { pdfToPages, paginateText, capPages, IngestError } from './document-ingest'
import { PlanningConditionsSchema, normalisePlanningConditions } from './schemas-documents'
import { PLANNING_CONDITIONS_SYSTEM, PLANNING_CONDITIONS_PROMPT_VERSION, planningConditionsUser } from './prompts/planning-conditions'
import { mapPlanningConditions, pinDocumentNumber, type ProjectSetupMapping } from './map-project'
import { applyInjectionGuard } from './injection-guard'
import { applyProjectParameters, APPLY_TX_OPTIONS } from '@/lib/rules/apply'
import { ProjectParametersSchema } from '@/lib/rules/schema'
import { recordAuditEvent, AuditActions } from '@/lib/audit'
import { ValidationError, NotFoundError } from '@/lib/errors'

export type SetupDocumentKind = 'planning_conditions' | 'brief'

export interface StartProjectSetupInput {
  projectId: string
  organisationId: string
  authorProfileId: string
  authUserId: string
  kind: SetupDocumentKind
  file?: { name: string; bytes: Uint8Array; contentType: string } | null
  text?: string | null
}

/** Stores the document and creates the run atomically. Returns what the background step needs. */
export async function startProjectSetup(input: StartProjectSetupInput) {
  const { projectId, organisationId, authorProfileId, authUserId, kind } = input
  let pages: string[]
  let storage: { path: string; url: string; size: number } | null = null

  if (input.file) {
    pages = await pdfToPages(input.file.bytes) // throws IngestError
    storage = await uploadToStorage(organisationId, projectId, input.file)
  } else if (input.text && input.text.trim()) {
    pages = capPages(paginateText(input.text))
    if (pages.join('').length < 300) throw new IngestError('empty', 'Paste at least a few paragraphs of the document')
  } else {
    throw new ValidationError('A PDF file or pasted text is required')
  }

  const title = kind === 'planning_conditions' ? `Projekteerimistingimused${input.file ? ' — ' + input.file.name : ''}` : `Brief${input.file ? ' — ' + input.file.name : ''}`
  const { document, run } = await prisma.$transaction(async (tx) => {
    const document = storage
      ? await tx.document.create({
          data: {
            projectId, title, documentType: 'CERTIFICATE', discipline: 'Planning', securityLevel: 'INTERNAL', status: 'ISSUED', currentRevision: 'A',
            revisions: { create: { revision: 'A', authorId: authorProfileId, fileUrl: storage!.url, fileSize: storage!.size, status: 'ISSUED', issuePurpose: kind } },
          },
        })
      : null
    const run = await tx.aIRun.create({
      data: {
        surface: 'PROJECT_SETUP', organisationId, projectId, status: 'QUEUED', promptVersion: PLANNING_CONDITIONS_PROMPT_VERSION,
        inputHash: '', inputSummary: JSON.stringify({ kind, documentId: document?.id ?? null, fileName: input.file?.name ?? null, pages: pages.length, chars: pages.reduce((a, p) => a + p.length, 0) }),
        createdBy: authUserId, stages: [],
      },
    })
    return { document, run }
  })
  void createRun // (createRun is the non-transactional helper; we inline here to keep document+run atomic)
  return { run, document, pages }
}

export async function executeProjectSetup(runId: string, kind: SetupDocumentKind, pages: string[]) {
  if (kind !== 'planning_conditions') throw new Error('Brief extraction arrives in 3.B3')
  return runAI(runId, {
    surface: 'PROJECT_SETUP', createdBy: '', inputSummary: '', promptVersion: PLANNING_CONDITIONS_PROMPT_VERSION,
    maxTokens: 16_000,
    ingest: async (push) => {
      await push({ name: 'read', status: 'done', detail: `${pages.length} page${pages.length > 1 ? 's' : ''}, ${pages.reduce((a, p) => a + p.split(/\s+/).length, 0).toLocaleString()} words${pages.join('').length > 12_000 ? ' · long document' : ''}` })
      return { system: PLANNING_CONDITIONS_SYSTEM, user: planningConditionsUser(pages), inputForHash: pages.join('\n') }
    },
    schema: PlanningConditionsSchema,
    normalise: normalisePlanningConditions,
    // deterministic injection guard runs after the model, on the source pages — never trusts model warnings
    map: (pc) => applyInjectionGuard(mapPlanningConditions(pinDocumentNumber(pc, pages)), pages),
    confidenceOf: (pc) => {
      const fields = [pc.document.number, pc.document.issuedAt, pc.document.legalBasis, pc.site.ehrCode, pc.limits.maxHeight, pc.limits.maxStoreys]
      return fields.reduce((a, f) => a + (f?.confidence ?? 0), 0) / fields.length
    },
  })
}

export interface ConfirmProjectSetupInput {
  projectId: string
  organisationId: string
  runId: string
  parameters: unknown                 // full questionnaire as the architect confirmed it
  acceptedConditions: number[]        // indexes into mapping.conditions
  actorProfileId: string
  actorAuthUserId: string
}

export async function confirmProjectSetup(input: ConfirmProjectSetupInput) {
  const run = await prisma.aIRun.findUnique({ where: { id: input.runId } })
  if (!run || run.surface !== 'PROJECT_SETUP' || run.projectId !== input.projectId) throw new NotFoundError('Setup run not found for this project')
  if (run.status !== 'AWAITING_CONFIRMATION') throw new ValidationError(`Run is ${run.status.toLowerCase().replace('_', ' ')}`)
  const mapping = run.mapping as unknown as ProjectSetupMapping | null
  if (!mapping) throw new ValidationError('Run has no mapping')

  const parsed = ProjectParametersSchema.safeParse(input.parameters)
  if (!parsed.success) { const f = parsed.error.issues[0]; throw new ValidationError(`${f.path.join('.')}: ${f.message}`) }
  const params = parsed.data

  // Bounds are advisory; refuse a confirmed design value that breaches a municipal bound outright
  if (mapping.bounds.maxHeightM != null && params.height > mapping.bounds.maxHeightM) throw new ValidationError(`Height ${params.height} m exceeds the municipal maximum of ${mapping.bounds.maxHeightM} m`)
  if (mapping.bounds.maxStoreys != null && params.storeys > mapping.bounds.maxStoreys) throw new ValidationError(`${params.storeys} storeys exceeds the municipal maximum of ${mapping.bounds.maxStoreys}`)

  const accepted = Array.from(new Set(input.acceptedConditions.filter((i) => Number.isInteger(i) && i >= 0 && i < mapping.conditions.length)))
  const docInfo = (() => { try { return JSON.parse(run.inputSummary) as { documentId?: string | null } } catch { return {} } })()

  const result = await prisma.$transaction(async (tx) => {
    const applied = await applyProjectParameters(tx, { projectId: input.projectId, parameters: params, createdBy: input.actorProfileId, sourceRunId: run.id })
    // Replace this run's municipality items (idempotent on re-confirm), never touch RULE/ARCHITECT
    await tx.complianceItem.deleteMany({ where: { registerId: applied.registerId, origin: 'MUNICIPALITY', aiRunId: run.id } })
    const base = 100_000
    if (accepted.length) {
      await tx.complianceItem.createMany({
        data: accepted.map((i, n) => {
          const c = mapping.conditions[i]
          return {
            registerId: applied.registerId, origin: 'MUNICIPALITY' as const, section: 'municipal', requirement: c.topic ? `${c.topic}: ${c.text}`.slice(0, 500) : c.text.slice(0, 500),
            citation: c.citation, source: c.source, because: c.page ? `Page ${c.page} of the planning conditions` : null, confidence: c.mandatory ? 'high' : 'medium',
            ruleSetVersion: null, ruleId: null, aiRunId: run.id, sortOrder: base + n * 10, comments: c.mandatory ? null : 'Recommended, not mandatory',
          }
        }),
      })
    }
    await tx.aIRun.update({ where: { id: run.id }, data: { status: 'APPLIED', confirmedBy: input.actorAuthUserId, confirmedAt: new Date(), appliedAt: new Date() } })
    return applied
  }, APPLY_TX_OPTIONS)

  await recordAuditEvent({
    organisationId: input.organisationId, actorId: input.actorProfileId, action: AuditActions.AI_PROJECT_CONFIGURED, entityType: 'project', entityId: input.projectId,
    metadata: {
      sourceRunId: run.id, documentId: docInfo.documentId ?? null, promptVersion: run.promptVersion, model: run.model,
      profileVersion: result.profile.version, ruleSetVersion: result.ruleSetVersion, parameters: params as unknown as Record<string, unknown>,
      ruleItems: result.checklist.length, municipalAccepted: accepted.length, municipalRejected: mapping.conditions.length - accepted.length,
      citations: result.checklist.map((c) => `${c.ruleId} ${c.citation}`),
      added: result.diff.added.map((i) => i.ruleId), removed: result.diff.removed.map((i) => i.ruleId),
    },
  })

  return { profileVersion: result.profile.version, ruleSetVersion: result.ruleSetVersion, ruleItems: result.checklist.length, municipalItems: accepted.length, diff: { added: result.diff.added.map((i) => i.ruleId), removed: result.diff.removed.map((i) => i.ruleId) } }
}

async function uploadToStorage(organisationId: string, projectId: string, file: { name: string; bytes: Uint8Array; contentType: string }) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) throw new ValidationError('File storage is not configured')
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY)
  const path = `${organisationId}/${projectId}/setup/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
  const { error } = await admin.storage.from('documents').upload(path, Buffer.from(file.bytes), { contentType: 'application/pdf', upsert: false })
  if (error) throw new ValidationError(`Upload failed: ${error.message}`)
  const { data, error: signErr } = await admin.storage.from('documents').createSignedUrl(path, 365 * 24 * 60 * 60)
  if (signErr || !data?.signedUrl) throw new ValidationError('Uploaded but could not create an access link')
  return { path, url: data.signedUrl, size: file.bytes.byteLength }
}

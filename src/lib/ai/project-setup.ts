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
import { PlanningConditionsSchema, normalisePlanningConditions, BriefSchema, normaliseBrief, DecisionNoticeSchema, normaliseDecisionNotice } from './schemas-documents'
import { DECISION_NOTICE_PROMPT_VERSION, DECISION_NOTICE_SYSTEM, decisionNoticeUser } from './prompts/decision-notice'
import { PLANNING_CONDITIONS_SYSTEM, PLANNING_CONDITIONS_PROMPT_VERSION, planningConditionsUser } from './prompts/planning-conditions'
import { mapPlanningConditions, mapBrief, mapDecisionNotice, pinDocumentNumber, pinApplicationReference, verifyQuotes, type ProjectSetupMapping } from './map-project'
import { BRIEF_PROMPT_VERSION, BRIEF_SYSTEM, briefUser } from './prompts/brief'
import { applyInjectionGuard } from './injection-guard'
import { assertAiBudget } from './budget'
import { applyProjectParameters, APPLY_TX_OPTIONS } from '@/lib/rules/apply'
import { ProjectParametersSchema } from '@/lib/rules/schema'
import { recordAuditEvent, AuditActions } from '@/lib/audit'
import { ValidationError, NotFoundError } from '@/lib/errors'
import { fileLink } from '@/lib/storage-links'

export type SetupDocumentKind = 'planning_conditions' | 'brief' | 'decision_notice'
export const SETUP_DOCUMENT_KINDS: SetupDocumentKind[] = ['planning_conditions', 'brief', 'decision_notice']
const PROMPT_VERSION: Record<SetupDocumentKind, string> = { planning_conditions: PLANNING_CONDITIONS_PROMPT_VERSION, brief: BRIEF_PROMPT_VERSION, decision_notice: DECISION_NOTICE_PROMPT_VERSION }
const TITLE: Record<SetupDocumentKind, string> = { planning_conditions: 'Projekteerimistingimused', brief: 'Brief', decision_notice: 'Planning decision notice' }
/** How a document is cited in item text: "PT nr 2611802/03126" or "Decision 22/4128". */
export function docLabel(m: ProjectSetupMapping): string { return m.kind === 'decision_notice' ? `Decision ${m.document.number ?? '?'}` : `PT nr ${m.document.number ?? '?'}` }

export interface StartProjectSetupInput {
  projectId: string
  organisationId: string
  authorProfileId: string
  authUserId: string
  kind: SetupDocumentKind
  file?: { name: string; bytes: Uint8Array; contentType: string } | null
  text?: string | null
  /** Retry of a failed run: the document is already stored — link the new run to it instead of uploading a copy. */
  reuseDocumentId?: string | null
}

/** Stores the document and creates the run atomically. Returns what the background step needs. */
export async function startProjectSetup(input: StartProjectSetupInput) {
  const { projectId, organisationId, authorProfileId, authUserId, kind } = input
  let pages: string[]
  let storage: { path: string; url: string; size: number } | null = null

  // Spend cap first — before we parse, upload, or call any model
  await assertAiBudget(organisationId)

  if (input.file) {
    pages = await pdfToPages(input.file.bytes) // throws IngestError
    if (!input.reuseDocumentId) storage = await uploadToStorage(organisationId, projectId, input.file)
  } else if (input.text && input.text.trim()) {
    pages = capPages(paginateText(input.text))
    if (pages.join('').length < 300) throw new IngestError('empty', 'Paste at least a few paragraphs of the document')
  } else {
    throw new ValidationError('A PDF file or pasted text is required')
  }

  const title = `${TITLE[kind]}${input.file ? ' — ' + input.file.name : ''}`
  const { document, run } = await prisma.$transaction(async (tx) => {
    const document = storage
      ? await tx.document.create({
          data: {
            projectId, title, documentType: 'CERTIFICATE', discipline: 'Planning', securityLevel: 'INTERNAL', status: 'ISSUED', currentRevision: 'A',
            revisions: { create: { revision: 'A', authorId: authorProfileId, fileUrl: storage!.url, fileSize: storage!.size, status: 'ISSUED', issuePurpose: kind } },
          },
        })
      : input.reuseDocumentId
        ? await tx.document.findFirst({ where: { id: input.reuseDocumentId, projectId } })
        : null
    const run = await tx.aIRun.create({
      data: {
        surface: 'PROJECT_SETUP', organisationId, projectId, status: 'QUEUED', promptVersion: PROMPT_VERSION[kind],
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
  const readStage = async (push: (s: { name: string; status: 'done'; detail: string }) => Promise<void>) =>
    push({ name: 'read', status: 'done', detail: `${pages.length} page${pages.length > 1 ? 's' : ''}, ${pages.reduce((a, p) => a + p.split(/\s+/).length, 0).toLocaleString()} words${pages.join('').length > 12_000 ? ' · long document' : ''}` })

  if (kind === 'brief') {
    return runAI(runId, {
      surface: 'PROJECT_SETUP', createdBy: '', inputSummary: '', promptVersion: BRIEF_PROMPT_VERSION,
      maxTokens: 8_000,
      ingest: async (push) => { await readStage(push); return { system: BRIEF_SYSTEM, user: briefUser(pages), inputForHash: pages.join('\n') } },
      schema: BriefSchema,
      normalise: normaliseBrief,
      map: (b) => applyInjectionGuard(verifyQuotes(mapBrief(b), pages), pages),
      confidenceOf: (b) => {
        const f = [b.parameters.buildingType, b.parameters.workType, b.parameters.grossFloorArea, b.parameters.storeys]
        return f.reduce((a, x) => a + (x?.confidence ?? 0), 0) / f.length
      },
    })
  }

  if (kind === 'decision_notice') {
    return runAI(runId, {
      surface: 'PROJECT_SETUP', createdBy: '', inputSummary: '', promptVersion: DECISION_NOTICE_PROMPT_VERSION,
      maxTokens: 16_000,
      ingest: async (push) => { await readStage(push); return { system: DECISION_NOTICE_SYSTEM, user: decisionNoticeUser(pages), inputForHash: pages.join('\n') } },
      schema: DecisionNoticeSchema,
      normalise: normaliseDecisionNotice,
      map: (dn) => applyInjectionGuard(verifyQuotes(mapDecisionNotice(pinApplicationReference(dn, pages)), pages), pages),
      confidenceOf: (dn) => {
        const f = [dn.document.reference, dn.document.decisionDate, dn.document.decision, dn.document.authority]
        return f.reduce((a, x) => a + (x?.confidence ?? 0), 0) / f.length
      },
    })
  }

  return runAI(runId, {
    surface: 'PROJECT_SETUP', createdBy: '', inputSummary: '', promptVersion: PLANNING_CONDITIONS_PROMPT_VERSION,
    maxTokens: 16_000,
    ingest: async (push) => {
      await readStage(push)
      return { system: PLANNING_CONDITIONS_SYSTEM, user: planningConditionsUser(pages), inputForHash: pages.join('\n') }
    },
    schema: PlanningConditionsSchema,
    normalise: normalisePlanningConditions,
    // deterministic injection guard runs after the model, on the source pages — never trusts model warnings
    map: (pc) => applyInjectionGuard(verifyQuotes(mapPlanningConditions(pinDocumentNumber(pc, pages)), pages), pages),
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
  /** Limits the architect ticked in the review ('height' | 'storeys'). Undefined = enforce all (API callers). */
  acceptedBounds?: string[]
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

  // Enforce only the limits the architect accepted — a misread or tampered limit they rejected must not block them
  const enforce = (k: string) => input.acceptedBounds === undefined || input.acceptedBounds.includes(k)
  if (enforce('height') && mapping.bounds.maxHeightM != null && params.height > mapping.bounds.maxHeightM) throw new ValidationError(`Height ${params.height} m exceeds the municipal maximum of ${mapping.bounds.maxHeightM} m`)
  if (enforce('storeys') && mapping.bounds.maxStoreys != null && params.storeys > mapping.bounds.maxStoreys) throw new ValidationError(`${params.storeys} storeys exceeds the municipal maximum of ${mapping.bounds.maxStoreys}`)

  const accepted = Array.from(new Set(input.acceptedConditions.filter((i) => Number.isInteger(i) && i >= 0 && i < mapping.conditions.length)))
  const docInfo = (() => { try { return JSON.parse(run.inputSummary) as { documentId?: string | null } } catch { return {} } })()

  // An older planning-conditions document must not supersede a newer one that is already applied
  const carriesConditions = mapping.kind === 'planning_conditions' || mapping.kind === 'decision_notice'
  let replaces: string[] = []
  if (carriesConditions) {
    const others = await prisma.aIRun.findMany({
      where: { projectId: input.projectId, surface: 'PROJECT_SETUP', status: 'APPLIED', id: { not: run.id } },
      select: { id: true, mapping: true, createdAt: true },
    })
    const prior = others.map((o) => ({ id: o.id, createdAt: o.createdAt, mapping: o.mapping as unknown as ProjectSetupMapping | null }))
    replaces = supersededRunIds(mapping, prior)
    // An older document must not supersede a newer one about the same thing
    const newer = prior.find((o) => replaces.includes(o.id) && o.createdAt > run.createdAt)
    if (newer?.mapping) {
      const a = mapping.document.issuedAt, b = newer.mapping.document.issuedAt
      if (!a || !b || a <= b) throw new ValidationError(`A newer ${mapping.kind === 'decision_notice' ? 'decision notice' : 'planning-conditions document'} (${docLabel(newer.mapping)}) is already applied — upload this one again if it really replaces it`)
    }
  }

  const result = await prisma.$transaction(async (tx) => {
    // Claim the run atomically — two concurrent confirms must not both apply
    const claimed = await tx.aIRun.updateMany({ where: { id: run.id, status: 'AWAITING_CONFIRMATION' }, data: { status: 'APPLIED' } })
    if (claimed.count === 0) throw new ValidationError('This run was already applied')
    const applied = await applyProjectParameters(tx, { projectId: input.projectId, parameters: params, createdBy: input.actorProfileId, sourceRunId: run.id })
    // Replace this run's municipality items (idempotent on re-confirm), never touch RULE/ARCHITECT
    await tx.complianceItem.deleteMany({ where: { registerId: applied.registerId, origin: 'MUNICIPALITY', aiRunId: run.id } })
    // A newer planning-conditions document supersedes the previous one's conditions.
    // Untouched items go; items someone has worked on stay, flagged, so no work is lost. Briefs carry no conditions — leave PT items alone.
    if (replaces.length) {
      const older = { registerId: applied.registerId, origin: 'MUNICIPALITY' as const, aiRunId: { in: replaces } }
      await tx.complianceItem.deleteMany({ where: { ...older, status: 'NOT_STARTED' } })
      const kept = await tx.complianceItem.findMany({ where: older, select: { id: true, requirement: true } })
      const tag = `[Superseded by ${docLabel(mapping)}] `
      await Promise.all(kept.filter((k) => !k.requirement.startsWith('[Superseded')).map((k) => tx.complianceItem.update({ where: { id: k.id }, data: { requirement: (tag + k.requirement).slice(0, 500), confidence: 'stale' } })))
    }
    const base = 100_000
    if (accepted.length) {
      await tx.complianceItem.createMany({
        data: accepted.map((i, n) => {
          const c = mapping.conditions[i]
          return {
            registerId: applied.registerId, origin: 'MUNICIPALITY' as const, section: 'municipal', requirement: c.topic ? `${c.topic}: ${c.text}`.slice(0, 500) : c.text.slice(0, 500),
            citation: c.citation, source: c.source, because: `AI-extracted from ${c.page ? `page ${c.page} of ` : ''}the ${mapping.kind === 'decision_notice' ? 'decision notice' : 'planning conditions'} — check against the document`, confidence: 'ai',
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

/**
 * Which earlier runs' municipal items a newly confirmed document replaces.
 *  - Estonian PT: a new PT replaces every earlier PT for the project.
 *  - English decision notices: several run side by side (planning + listed building consent, outline + reserved matters,
 *    approvals of details). A notice replaces only an earlier upload of the same application, and a s73 variation
 *    replaces the permission it varies.
 */
export function supersededRunIds(mapping: ProjectSetupMapping, prior: Array<{ id: string; mapping: ProjectSetupMapping | null }>): string[] {
  if (mapping.kind === 'planning_conditions') return prior.filter((o) => o.mapping?.kind === 'planning_conditions').map((o) => o.id)
  if (mapping.kind !== 'decision_notice') return []
  const ref = mapping.document.number
  const varies = mapping.document.legalBasis === 'variation_of_condition' ? mapping.document.parent ?? null : null
  return prior.filter((o) => o.mapping?.kind === 'decision_notice' && o.mapping.document.number != null &&
    (o.mapping.document.number === ref || o.mapping.document.number === varies)).map((o) => o.id)
}

async function uploadToStorage(organisationId: string, projectId: string, file: { name: string; bytes: Uint8Array; contentType: string }) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) throw new ValidationError('File storage is not configured')
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY)
  const path = `${organisationId}/${projectId}/setup/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
  const { error } = await admin.storage.from('documents').upload(path, Buffer.from(file.bytes), { contentType: 'application/pdf', upsert: false })
  if (error) throw new ValidationError(`Upload failed: ${error.message}`)
  return { path, url: fileLink('documents', path), size: file.bytes.byteLength }
}

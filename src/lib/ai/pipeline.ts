/**
 * runAI — the one pipeline every AI surface uses.
 *   ingest → extract (LLM, typed) → map (deterministic) → awaiting confirmation → apply (audited)
 *
 * Writes an AIRun row and updates its `stages` as it goes so the UI can poll progress.
 */
import { createHash } from 'node:crypto'
import type { ZodTypeAny, z } from 'zod'
import { prisma } from '@/lib/prisma'
import { chat, parseJsonWithMeta } from './providers'
import { classifyAIError, AI_FAILURE_LABEL } from './failures'
import { captureError } from '@/lib/error-reporting'
import { isFeatureEnabled } from '@/lib/feature-flags'

export type Stage = { name: string; status: 'running' | 'done' | 'failed'; ms?: number; detail?: string; at: string }

export interface RunAIOptions<S extends ZodTypeAny> {
  surface: 'PRACTICE_SETUP' | 'PROJECT_SETUP' | 'EXTRACTION' | 'DRAFT'
  organisationId?: string | null
  projectId?: string | null
  createdBy: string
  inputSummary: string
  promptVersion: string
  /** Produces the raw text given to the model; may push stages (e.g. crawl). */
  ingest: (push: (s: Omit<Stage, 'at'>) => Promise<void>) => Promise<{ system: string; user: string; inputForHash: string }>
  schema: S
  /** Optional light normalisation before Zod parse. */
  /** Output token cap for this surface (default 8192). */
  maxTokens?: number
  normalise?: (raw: unknown) => unknown
  /** Optional deterministic enrichment after validation (e.g. registry facts overlay). May push a stage. */
  enrich?: (output: z.infer<S>, push: (s: Omit<Stage, 'at'>) => Promise<void>) => Promise<z.infer<S>>
  /** Deterministic mapping from validated output → config. */
  map?: (output: z.infer<S>) => unknown
  /** Aggregate confidence for the run. */
  confidenceOf?: (output: z.infer<S>) => number
}

export async function createRun(opts: Pick<RunAIOptions<any>, 'surface' | 'organisationId' | 'projectId' | 'createdBy' | 'inputSummary' | 'promptVersion'>) {
  return prisma.aIRun.create({
    data: {
      surface: opts.surface,
      organisationId: opts.organisationId ?? null,
      projectId: opts.projectId ?? null,
      createdBy: opts.createdBy,
      inputSummary: opts.inputSummary,
      promptVersion: opts.promptVersion,
      inputHash: '',
      status: 'QUEUED',
      stages: [],
    },
  })
}

export async function runAI<S extends ZodTypeAny>(runId: string, opts: RunAIOptions<S>) {
  const stages: Stage[] = []
  const t0 = Date.now()
  const push = async (s: Omit<Stage, 'at'>) => {
    const idx = s.name === 'fetch' ? -1 : stages.findIndex((x) => x.name === s.name)
    const entry: Stage = { ...s, at: new Date().toISOString() }
    if (idx >= 0) stages[idx] = entry
    else stages.push(entry)
    await prisma.aIRun.update({ where: { id: runId }, data: { stages: stages as any, status: 'RUNNING' } })
  }

  try {
    await push({ name: 'ingest', status: 'running' })
    const ti = Date.now()
    const { system, user, inputForHash } = await opts.ingest(push)
    await push({ name: 'ingest', status: 'done', ms: Date.now() - ti })

    const inputHash = createHash('sha256').update(inputForHash).digest('hex').slice(0, 16)

    await push({ name: 'extract', status: 'running', detail: 'reading with AI' })
    const te = Date.now()
    // Non-EU backup model only if this organisation opted in (Settings → Modules); personal data is masked first
    const orgId = opts.organisationId ?? (await prisma.aIRun.findUnique({ where: { id: runId }, select: { organisationId: true } }).catch(() => null))?.organisationId ?? null
    const allowFallback = orgId ? await isFeatureEnabled(orgId, 'ai_fallback').catch(() => false) : false
    const result = await chat({ system, user, json: true, maxTokens: opts.maxTokens, allowFallback })
    const { value: raw, repaired } = parseJsonWithMeta(result.text)
    const normalised = opts.normalise ? opts.normalise(raw) : raw
    const parsed = opts.schema.safeParse(normalised)
    if (!parsed.success) {
      const issues = parsed.error.issues.slice(0, 5).map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')
      throw new Error(`Model output failed validation: ${issues}`)
    }
    await push({ name: 'extract', status: 'done', ms: Date.now() - te, detail: `${result.provider}/${result.model}${result.provider === 'claude' ? ` · EU service down, backup used${result.masked ? ` · ${result.masked} personal details masked` : ''}` : ''}${repaired ? ' · output cut short' : ''}` })

    await push({ name: 'map', status: 'running' })
    let output = parsed.data
    if (opts.enrich) output = await opts.enrich(output, push)
    const tm = Date.now()
    let mapping = opts.map ? opts.map(output) : null
    // Output cut short at max_tokens and repaired: the tail (usually the last conditions) is missing. Never silent.
    if (repaired && mapping && typeof mapping === 'object' && Array.isArray((mapping as { warnings?: unknown }).warnings)) {
      mapping = { ...(mapping as object), warnings: ['The AI response was cut short — later items in the document may be missing. Check the document for anything not listed.', ...(mapping as { warnings: string[] }).warnings] } as typeof mapping
    }
    await push({ name: 'map', status: 'done', ms: Date.now() - tm })

    const confidence = opts.confidenceOf ? opts.confidenceOf(output) : null

    return prisma.aIRun.update({
      where: { id: runId },
      data: {
        status: 'AWAITING_CONFIRMATION',
        model: `${result.provider}/${result.model}`,
        inputHash,
        output: output as any,
        mapping: (mapping ?? undefined) as any,
        confidence,
        latencyMs: Date.now() - t0,
        tokensUsed: result.tokens,
        stages: stages as any,
      },
    })
  } catch (err) {
    // Never silent: the run says what happened in plain words, admins get the detail, reporting gets the rest.
    const f = classifyAIError(err)
    const last = stages.find((s) => s.status === 'running')
    if (last) { last.status = 'failed'; last.detail = AI_FAILURE_LABEL[f.kind] }
    const run = await prisma.aIRun.findUnique({ where: { id: runId }, select: { organisationId: true, projectId: true, surface: true } }).catch(() => null)
    const ref = f.report
      ? captureError(err, {
          source: 'ai', runId, organisationId: run?.organisationId ?? null, route: `ai:${run?.surface ?? opts.surface}`,
          code: `AI_${f.kind.toUpperCase()}`, extra: { kind: f.kind, stage: last?.name ?? null, promptVersion: opts.promptVersion, projectId: run?.projectId ?? null },
        }, f.report)
      : null
    try {
      await prisma.aIRun.update({
        where: { id: runId },
        data: {
          status: 'FAILED', error: (ref ? `${f.message} (Reference: ${ref})` : f.message).slice(0, 1000), errorKind: f.kind,
          errorDetail: `${ref ? `[${ref}] ` : ''}${f.detail}`.slice(0, 1000), latencyMs: Date.now() - t0, stages: stages as any,
        },
      })
    } catch (writeErr) {
      // Could not even record the failure (DB down) — the stale-run check will close it; make sure someone hears about it
      captureError(writeErr, { source: 'ai', runId, extra: { while: 'recording AI failure', kind: f.kind } })
    }
    throw err
  }
}

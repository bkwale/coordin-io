/**
 * Practice-setup confirm — "Switch on Coordin".
 * Takes an AWAITING_CONFIRMATION practice-setup run and applies its module decisions
 * (plus any architect overrides) as OrganisationFeature flags. Writes a versioned
 * PracticeProfile, marks the run APPLIED, audits every decision.
 *
 * Deterministic: no model call. The only judgement is the architect's overrides.
 */
import { prisma } from '@/lib/prisma'
import { FEATURE_REGISTRY, type FeatureKey } from '@/lib/feature-registry'
import { invalidateFeatureCache } from '@/lib/feature-flags'
import { recordAuditEvent, AuditActions } from '@/lib/audit'
import { ValidationError, NotFoundError } from '@/lib/errors'
import type { PracticeMapping, ModuleDecision } from './map-practice'

/** Mapper keys that mean something in the product but are named differently in the registry. */
export const MODULE_KEY_ALIAS: Record<string, FeatureKey> = {
  expenses: 'spend_management',
}

export type ConfirmPracticeInput = {
  runId: string
  organisationId: string
  /** Architect overrides, by mapper key: true = switch on, false = keep off. */
  overrides?: Record<string, boolean>
  actorAuthUserId: string
}

export type AppliedDecision = { key: string; featureKey: FeatureKey | null; on: boolean; source: 'ai' | 'architect'; reason: string; applied: boolean }

export type ConfirmPracticeResult = {
  runId: string
  organisationId: string
  profileVersion: number
  decisions: AppliedDecision[]
  appliedCount: number
  skippedKeys: string[]
}

/** Pure: merge mapper decisions with overrides and resolve registry keys. Exported for tests. */
export function resolveDecisions(modules: ModuleDecision[], overrides: Record<string, boolean> = {}): AppliedDecision[] {
  const seen = new Set<string>()
  const out: AppliedDecision[] = []
  for (const m of modules) {
    if (seen.has(m.key)) continue
    seen.add(m.key)
    const featureKey = (m.key in FEATURE_REGISTRY ? m.key : MODULE_KEY_ALIAS[m.key] ?? null) as FeatureKey | null
    const overridden = Object.prototype.hasOwnProperty.call(overrides, m.key)
    out.push({
      key: m.key,
      featureKey,
      on: overridden ? !!overrides[m.key] : m.on,
      source: overridden ? 'architect' : 'ai',
      reason: m.reason,
      applied: featureKey !== null,
    })
  }
  // Overrides for keys the mapper never mentioned (architect switching on something extra)
  for (const [key, on] of Object.entries(overrides)) {
    if (seen.has(key)) continue
    const featureKey = (key in FEATURE_REGISTRY ? key : MODULE_KEY_ALIAS[key] ?? null) as FeatureKey | null
    if (!featureKey) continue
    out.push({ key, featureKey, on, source: 'architect', reason: 'Added by the practice at confirmation', applied: true })
  }
  return out
}

export async function confirmPracticeSetup(input: ConfirmPracticeInput): Promise<ConfirmPracticeResult> {
  const { runId, organisationId, overrides = {}, actorAuthUserId } = input

  const run = await prisma.aIRun.findUnique({ where: { id: runId } })
  if (!run || run.surface !== 'PRACTICE_SETUP') throw new NotFoundError('Practice-setup run not found')
  if (run.status !== 'AWAITING_CONFIRMATION') throw new ValidationError(`Run is ${run.status.toLowerCase().replace('_', ' ')} — only runs awaiting confirmation can be applied`)
  if (run.organisationId && run.organisationId !== organisationId) throw new ValidationError('This run belongs to a different organisation')

  const org = await prisma.organisation.findUnique({ where: { id: organisationId }, select: { id: true } })
  if (!org) throw new NotFoundError('Organisation not found')

  const mapping = run.mapping as unknown as PracticeMapping | null
  if (!mapping?.modules?.length) throw new ValidationError('Run has no module decisions to apply')

  const decisions = resolveDecisions(mapping.modules, overrides)
  const actor = await prisma.profile.findFirst({ where: { authUserId: actorAuthUserId }, select: { id: true } })
  const now = new Date()

  const profileVersion = await prisma.$transaction(async (tx) => {
    for (const d of decisions) {
      if (!d.featureKey) continue
      await tx.organisationFeature.upsert({
        where: { organisationId_featureKey: { organisationId, featureKey: d.featureKey } },
        update: { enabled: d.on, enabledAt: d.on ? now : null, enabledBy: d.on ? actor?.id ?? null : null },
        create: { organisationId, featureKey: d.featureKey, enabled: d.on, enabledAt: d.on ? now : null, enabledBy: d.on ? actor?.id ?? null : null },
      })
    }
    const prev = await tx.practiceProfile.findFirst({ where: { organisationId }, orderBy: { version: 'desc' }, select: { version: true } })
    const version = (prev?.version ?? 0) + 1
    await tx.practiceProfile.create({
      data: { organisationId, version, data: (run.output ?? {}) as object, sourceRunId: run.id, createdBy: actor?.id ?? actorAuthUserId },
    })
    await tx.aIRun.update({
      where: { id: run.id },
      data: { status: 'APPLIED', organisationId, confirmedBy: actorAuthUserId, confirmedAt: now, appliedAt: now },
    })
    return version
  }, { maxWait: 10_000, timeout: 30_000 })

  await invalidateFeatureCache(organisationId)

  await recordAuditEvent({
    organisationId,
    actorId: actor?.id ?? undefined,
    action: AuditActions.AI_PRACTICE_CONFIGURED,
    entityType: 'organisation',
    entityId: organisationId,
    metadata: {
      runId: run.id,
      promptVersion: run.promptVersion,
      model: run.model,
      profileVersion,
      decisions: decisions.map((d) => ({ key: d.key, featureKey: d.featureKey, on: d.on, source: d.source, reason: d.reason })),
      overriddenKeys: Object.keys(overrides),
    },
  })

  return {
    runId: run.id,
    organisationId,
    profileVersion,
    decisions,
    appliedCount: decisions.filter((d) => d.applied).length,
    skippedKeys: decisions.filter((d) => !d.applied).map((d) => d.key),
  }
}

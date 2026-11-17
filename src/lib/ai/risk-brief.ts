/**
 * AI risk brief: the service behind "Write a brief" on the Risks screen.
 * One model call over the flags the fixed rules raised. The result is checked against those flags before it is stored,
 * and it is tied to the exact set of flags it was written for: when the flags change, the brief is shown as out of date.
 */
import { prisma } from '@/lib/prisma'
import { assertAiBudget } from './budget'
import { createRun, runAI } from './pipeline'
import { recordAuditEvent, AuditActions } from '@/lib/audit'
import { RISK_BRIEF_PROMPT_VERSION, RISK_BRIEF_SYSTEM, riskBriefUser, type BriefLanguage } from './prompts/risk-brief'
import { RiskBriefSchema, normaliseRiskBrief, checkBrief, flagsForModel, flagsHash, flagCounts, type CheckedBrief } from './risk-brief-core'
import type { RiskSignal } from '@/lib/risk/signals'

const KIND = 'risk-brief'
const MARKER = `"kind":"${KIND}"`

export interface BriefRunInput { kind: typeof KIND; hash: string; flags: number; language: BriefLanguage }
export interface BriefMapping extends CheckedBrief { kind: typeof KIND; hash: string; flags: number; language: BriefLanguage }

export function parseBriefInput(inputSummary: string | null): Partial<BriefRunInput> {
  try { const v = JSON.parse(inputSummary ?? ''); return v && typeof v === 'object' && v.kind === KIND ? v : {} } catch { return {} }
}

export async function latestBrief(projectId: string) {
  return prisma.aIRun.findFirst({
    where: { projectId, surface: 'DRAFT', inputSummary: { contains: MARKER } },
    orderBy: { createdAt: 'desc' },
    select: { id: true, status: true, mapping: true, error: true, errorKind: true, inputSummary: true, createdAt: true, createdBy: true },
  })
}

export async function writeBrief(input: { projectId: string; projectName: string; organisationId: string; authUserId: string; profileId: string; signals: RiskSignal[]; language: BriefLanguage }) {
  const { projectId, projectName, organisationId, authUserId, profileId, signals, language } = input
  await assertAiBudget(organisationId)
  const hash = flagsHash(signals)
  const summary: BriefRunInput = { kind: KIND, hash, flags: signals.length, language }
  const run = await createRun({ surface: 'DRAFT', organisationId, projectId, createdBy: authUserId, inputSummary: JSON.stringify(summary), promptVersion: RISK_BRIEF_PROMPT_VERSION })
  await recordAuditEvent({ organisationId, actorId: profileId, action: AuditActions.AI_RISK_BRIEF_RUN, entityType: 'project', entityId: projectId, metadata: { runId: run.id, flags: signals.length } }).catch(() => {})
  const flags = flagsForModel(signals)
  return runAI(run.id, {
    surface: 'DRAFT', organisationId, projectId, createdBy: authUserId, inputSummary: JSON.stringify(summary), promptVersion: RISK_BRIEF_PROMPT_VERSION,
    ingest: async () => ({ system: RISK_BRIEF_SYSTEM, user: riskBriefUser(projectName, flags, language, flagCounts(signals)), inputForHash: `${hash}:${language}` }),
    schema: RiskBriefSchema,
    normalise: normaliseRiskBrief,
    maxTokens: 2000,
    temperature: 0,
    map: (output): BriefMapping => ({ kind: KIND, hash, flags: signals.length, language, ...checkBrief(output, signals) }),
  })
}

/**
 * Probation review workflow (PT 2026-11-05).
 *
 *   SCHEDULED → DRAFT → SUBMITTED → FINALISED
 *                  ↑         │
 *                  └ RETURNED ┘
 *
 * The line manager (or HR acting for them) drafts and submits; HR returns with a reason or finalises.
 * Manager recommendation and HR decision are recorded separately (employment-status evidence).
 * A Fail decision never changes employment automatically — HR actions it.
 */
import { REVIEW_OUTCOMES, normaliseOutcome } from './probation'

export const WORKFLOW_STATUSES = ['SCHEDULED', 'DRAFT', 'SUBMITTED', 'RETURNED', 'FINALISED'] as const
export type WorkflowStatus = typeof WORKFLOW_STATUSES[number]
export type WorkflowAction = 'save' | 'submit' | 'return' | 'finalise'

export const WORKFLOW_LABELS: Record<WorkflowStatus, string> = {
  SCHEDULED: 'Not started',
  DRAFT: 'Draft',
  SUBMITTED: 'Awaiting HR',
  RETURNED: 'Returned for changes',
  FINALISED: 'Finalised',
}

/** Default assessment criteria (Ayo §2.3: integration, performance, technical ability, objectives). */
export const ASSESSMENT_CRITERIA = [
  { key: 'quality', label: 'Quality of work' },
  { key: 'technical', label: 'Technical ability' },
  { key: 'communication', label: 'Communication' },
  { key: 'teamwork', label: 'Teamwork & integration' },
  { key: 'reliability', label: 'Reliability & time-keeping' },
  { key: 'objectives', label: 'Progress against objectives' },
] as const

export type Criterion = { key: string; label: string; score: number | null; comment?: string | null }
export type Assessment = { criteria: Criterion[] }

export type Actor = { isHR: boolean; isLineManager: boolean; isSubject: boolean }

/** Which actions an actor may take from a given status. */
export function allowedActions(status: string, actor: Actor): WorkflowAction[] {
  const s = (WORKFLOW_STATUSES as readonly string[]).includes(status) ? (status as WorkflowStatus) : 'SCHEDULED'
  const canDraft = actor.isLineManager || actor.isHR
  const out: WorkflowAction[] = []
  if ((s === 'SCHEDULED' || s === 'DRAFT' || s === 'RETURNED') && canDraft && !actor.isSubject) out.push('save', 'submit')
  if (s === 'SUBMITTED' && actor.isHR && !actor.isSubject) out.push('return', 'finalise')
  return out
}

/** Who can open the review at all. The subject sees it only once finalised. */
export function canView(status: string, actor: Actor): boolean {
  // The subject only ever sees their own review once finalised — even if they are HR or a manager
  if (actor.isSubject) return status === 'FINALISED'
  return actor.isHR || actor.isLineManager
}

export function nextStatus(action: WorkflowAction): WorkflowStatus {
  return ({ save: 'DRAFT', submit: 'SUBMITTED', return: 'RETURNED', finalise: 'FINALISED' } as const)[action]
}

/** Normalise an incoming assessment: known criteria only, integer scores 1–5 or null, trimmed comments. */
export function normaliseAssessment(input: unknown): Assessment {
  const raw = (input && typeof input === 'object' && Array.isArray((input as Assessment).criteria)) ? (input as Assessment).criteria : []
  const byKey = new Map(raw.map((c) => [c?.key, c]))
  return {
    criteria: ASSESSMENT_CRITERIA.map(({ key, label }) => {
      const c = byKey.get(key)
      const n = Number(c?.score)
      const score = Number.isInteger(n) && n >= 1 && n <= 5 ? n : null
      const comment = typeof c?.comment === 'string' && c.comment.trim() ? c.comment.trim().slice(0, 2000) : null
      return { key, label, score, comment }
    }),
  }
}

export function averageScore(a: Assessment | null | undefined): number | null {
  const scores = (a?.criteria ?? []).map((c) => c.score).filter((s): s is number => typeof s === 'number')
  return scores.length ? Math.round((scores.reduce((x, y) => x + y, 0) / scores.length) * 10) / 10 : null
}

/** What must be present before submitting to HR. Returns human-readable problems (empty = OK). */
export function submissionProblems(r: { assessment: Assessment; managerRecommendation: string | null }): string[] {
  const problems: string[] = []
  const unscored = r.assessment.criteria.filter((c) => c.score === null).map((c) => c.label)
  if (unscored.length) problems.push(`Score every area (${unscored.join(', ')})`)
  if (!r.managerRecommendation) problems.push('Choose a recommendation (Pass, Extend or Fail)')
  return problems
}

export function validDecision(v: unknown): typeof REVIEW_OUTCOMES[number] | null {
  return normaliseOutcome(v)
}

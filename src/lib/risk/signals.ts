/**
 * Risk signals (AI roadmap, sprint 3). Fixed rules over a project's own records: no AI, no guessing.
 * Each signal says what is wrong, how serious, and which record it comes from. The AI brief (sprint 4)
 * ranks and explains these; it never adds facts of its own.
 *
 * Pure: give it the records and today's date, get the signals. The same input always gives the same output.
 */

export type RiskArea = 'schedule' | 'permits' | 'money' | 'approvals' | 'documents'
export type RiskSeverity = 'high' | 'medium' | 'low'
export type SignalKind =
  | 'TASK_OVERDUE' | 'TASK_BLOCKED' | 'TASK_DUE_SOON_UNOWNED'
  | 'MILESTONE_OVERDUE' | 'MILESTONE_AT_RISK'
  | 'CONDITION_OVERDUE' | 'CONDITION_DUE_SOON' | 'CONDITION_NOT_DISCHARGED'
  | 'PERMIT_DECISION_LATE' | 'PERMIT_EXPIRED' | 'PERMIT_EXPIRING'
  | 'REGULATORY_OVERDUE' | 'REGULATORY_ACTION_REQUIRED' | 'REGULATORY_UNOWNED'
  | 'HOURS_OVER_PLAN'
  | 'EXPENSE_WAITING' | 'DOCUMENT_REVIEW_WAITING' | 'TASK_REVIEW_WAITING'
  | 'DOCUMENT_FIGURES_DISAGREE'

export interface RiskSignal {
  /** Stable for the same record and rule, so a dismissal can be remembered (sprint 4). */
  id: string
  kind: SignalKind
  area: RiskArea
  severity: RiskSeverity
  title: string
  detail: string
  record: { type: 'task' | 'milestone' | 'planning_condition' | 'planning_application' | 'regulatory_item' | 'document' | 'project' | 'expense'; id: string; label: string }
  link: string
  /** The numbers and dates behind the signal, for the AI brief and for checking. */
  facts: Record<string, string | number | boolean | null>
}

export interface RiskThresholds {
  /** A task this many days late is high, whatever its priority. */
  taskHighAfterDays: number
  taskMediumAfterDays: number
  /** A task sitting in BLOCKED for this long is flagged. */
  blockedAfterDays: number
  /** "Due soon" window for unowned tasks and conditions. */
  dueSoonDays: number
  /** A milestone is "at risk" inside this window if its tasks are in trouble. */
  milestoneWindowDays: number
  /** Warn this long before a permission lapses. */
  permitExpiryWarningDays: number
  /** Hours are only compared with the plan once this many have been planned, so one odd week does not raise a flag. */
  hoursMinimumPlanned: number
  /** Logged hours this far over the plan to date are flagged (0.1 = 10%), and this far over are high. */
  hoursOverPlan: number
  hoursOverPlanHigh: number
  /** Something waiting for a decision this many days is flagged, and this many is high. */
  waitingDays: number
  waitingHighDays: number
}
export const DEFAULT_THRESHOLDS: RiskThresholds = { taskHighAfterDays: 14, taskMediumAfterDays: 3, blockedAfterDays: 5, dueSoonDays: 7, milestoneWindowDays: 14, permitExpiryWarningDays: 90, hoursMinimumPlanned: 20, hoursOverPlan: 0.1, hoursOverPlanHigh: 0.25, waitingDays: 5, waitingHighDays: 14 }

/* ── Input shapes: only the fields the rules read ───────────────────────────────── */

export interface TaskIn { id: string; title: string; status: string; priority: string; dueDate: Date | null; ownerId: string | null; milestoneId: string | null; archivedAt: Date | null; updatedAt: Date }
export interface MilestoneIn { id: string; title: string; status: string; dueDate: Date; completedDate: Date | null }
export interface ConditionIn { id: string; conditionNumber: number; description: string; conditionType: string | null; status: string; dueDate: Date | null; ownerId: string | null; submissionDate: Date | null; applicationRef: string | null }
export interface ApplicationIn { id: string; reference: string | null; authority: string; status: string; targetDecision: Date | null; decisionDate: Date | null; expiryDate: Date | null }
export interface RegulatoryItemIn { id: string; requirement: string; titleLocal: string | null; status: string; origin: string; dueDate: Date | null; ownerId: string | null; citation: string | null }
export interface DocumentContradictionIn { documentId: string; documentTitle: string; revision: string | null; runId: string; contradictions: Array<{ subject: string; a: { value: string; page: number | null }; b: { value: string; page: number | null } }> }

/** Hours planned (resource plan) and logged (timesheets) on the project, for weeks up to and including this one. */
export interface HoursIn { plannedToDate: number; loggedToDate: number; plannedTotal: number }
export interface ExpenseWaitingIn { id: string; description: string; amount: number; currency: string | null; status: string; submittedAt: Date | null }
export interface DocumentReviewWaitingIn { id: string; documentId: string; documentTitle: string; revision: string; requestedAt: Date }

export interface RiskInput {
  projectId: string
  tasks: TaskIn[]
  milestones: MilestoneIn[]
  conditions: ConditionIn[]
  applications: ApplicationIn[]
  regulatoryItems: RegulatoryItemIn[]
  documentContradictions: DocumentContradictionIn[]
  hours?: HoursIn | null
  expensesWaiting?: ExpenseWaitingIn[]
  documentReviewsWaiting?: DocumentReviewWaitingIn[]
}

/* ── Dates: whole days, in UTC, so "due today" is never "late" ──────────────────── */

const DAY = 86_400_000
const dayOf = (d: Date) => Math.floor(d.getTime() / DAY)
/** Whole days from `a` to `b` (positive when b is later). */
export const daysBetween = (a: Date, b: Date) => dayOf(b) - dayOf(a)
const iso = (d: Date) => d.toISOString().slice(0, 10)
const plural = (n: number, one: string, many = one + 's') => `${n} ${n === 1 ? one : many}`
const short = (s: string, n = 90) => (s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s)

const TASK_DONE = new Set(['COMPLETED'])
const MILESTONE_CLOSED = new Set(['COMPLETED', 'CANCELLED'])
const CONDITION_OPEN = new Set(['OUTSTANDING', 'SUBMISSION_PREPARED'])
const CONDITION_WAITING = new Set(['SUBMITTED', 'UNDER_REVIEW'])
const APPLICATION_AWAITING_DECISION = new Set(['SUBMITTED', 'VALIDATED', 'CONSULTATION', 'UNDER_ASSESSMENT', 'COMMITTEE', 'INVALID_INFORMATION_REQUIRED'])
const APPLICATION_GRANTED = new Set(['APPROVED', 'CONDITIONS_DISCHARGE'])
const REGULATORY_SETTLED = new Set(['COMPLIANT', 'CLOSED', 'NOT_APPLICABLE', 'APPROVED_WITH_CONDITION'])
const REGULATORY_PROBLEM = new Set(['NON_COMPLIANT', 'ACTION_REQUIRED'])

const openTask = (t: TaskIn) => !t.archivedAt && !TASK_DONE.has(t.status)

/* ── Schedule ───────────────────────────────────────────────────────────────────── */

export function taskSignals(input: Pick<RiskInput, 'projectId' | 'tasks'>, now: Date, th: RiskThresholds = DEFAULT_THRESHOLDS): RiskSignal[] {
  const out: RiskSignal[] = []
  for (const t of input.tasks) {
    if (!openTask(t)) continue
    const record = { type: 'task' as const, id: t.id, label: t.title }
    const link = `/tasks/${t.id}`
    const late = t.dueDate ? daysBetween(t.dueDate, now) : null
    const urgent = t.priority === 'HIGH' || t.priority === 'CRITICAL'

    if (late !== null && late > 0) {
      const severity: RiskSeverity = late >= th.taskHighAfterDays || urgent ? 'high' : late >= th.taskMediumAfterDays ? 'medium' : 'low'
      out.push({
        id: `TASK_OVERDUE:${t.id}`, kind: 'TASK_OVERDUE', area: 'schedule', severity, record, link,
        title: `Task ${plural(late, 'day')} late: ${short(t.title, 70)}`,
        detail: `Due ${iso(t.dueDate!)}, still ${t.status.toLowerCase().replace(/_/g, ' ')}${t.ownerId ? '' : ', and nobody owns it'}.`,
        facts: { dueDate: iso(t.dueDate!), daysLate: late, status: t.status, priority: t.priority, hasOwner: !!t.ownerId },
      })
    } else if (late !== null && late >= -th.dueSoonDays && !t.ownerId) {
      out.push({
        id: `TASK_DUE_SOON_UNOWNED:${t.id}`, kind: 'TASK_DUE_SOON_UNOWNED', area: 'schedule', severity: urgent ? 'high' : 'medium', record, link,
        title: `Due in ${plural(-late, 'day')} with no owner: ${short(t.title, 70)}`,
        detail: `Due ${iso(t.dueDate!)} and nobody is assigned.`,
        facts: { dueDate: iso(t.dueDate!), daysLeft: -late, priority: t.priority },
      })
    }

    if (t.status === 'BLOCKED') {
      const stuck = daysBetween(t.updatedAt, now)
      if (stuck >= th.blockedAfterDays) {
        out.push({
          id: `TASK_BLOCKED:${t.id}`, kind: 'TASK_BLOCKED', area: 'schedule', severity: urgent || stuck >= th.blockedAfterDays * 3 ? 'high' : 'medium', record, link,
          title: `Blocked for ${plural(stuck, 'day')}: ${short(t.title, 70)}`,
          detail: `Marked blocked and not touched since ${iso(t.updatedAt)}.`,
          facts: { daysBlocked: stuck, lastUpdated: iso(t.updatedAt), priority: t.priority },
        })
      }
    }
  }
  return out
}

export function milestoneSignals(input: Pick<RiskInput, 'projectId' | 'tasks' | 'milestones'>, now: Date, th: RiskThresholds = DEFAULT_THRESHOLDS): RiskSignal[] {
  const out: RiskSignal[] = []
  for (const m of input.milestones) {
    if (MILESTONE_CLOSED.has(m.status) || m.completedDate) continue
    const record = { type: 'milestone' as const, id: m.id, label: m.title }
    const link = `/projects/${input.projectId}/tasks`
    const linked = input.tasks.filter((t) => t.milestoneId === m.id && !t.archivedAt)
    const open = linked.filter((t) => !TASK_DONE.has(t.status))
    const late = daysBetween(m.dueDate, now)

    if (late > 0) {
      out.push({
        id: `MILESTONE_OVERDUE:${m.id}`, kind: 'MILESTONE_OVERDUE', area: 'schedule', severity: 'high', record, link,
        title: `Milestone ${plural(late, 'day')} late: ${short(m.title, 70)}`,
        detail: `Due ${iso(m.dueDate)}. ${linked.length === 0 ? 'No tasks are linked to it.' : `${open.length} of ${plural(linked.length, 'linked task')} still open.`}`,
        facts: { dueDate: iso(m.dueDate), daysLate: late, linkedTasks: linked.length, openTasks: open.length },
      })
      continue
    }
    if (-late > th.milestoneWindowDays || open.length === 0) continue
    const overdue = open.filter((t) => t.dueDate && daysBetween(t.dueDate, now) > 0).length
    const blocked = open.filter((t) => t.status === 'BLOCKED').length
    const notStarted = open.filter((t) => t.status === 'NOT_STARTED').length
    const mostlyUnstarted = notStarted * 2 > linked.length
    if (overdue === 0 && blocked === 0 && !mostlyUnstarted) continue
    const reasons = [overdue ? `${plural(overdue, 'task')} already late` : '', blocked ? `${blocked} blocked` : '', mostlyUnstarted ? `${notStarted} of ${linked.length} not started` : ''].filter(Boolean)
    out.push({
      id: `MILESTONE_AT_RISK:${m.id}`, kind: 'MILESTONE_AT_RISK', area: 'schedule', severity: -late <= th.dueSoonDays ? 'high' : 'medium', record, link,
      title: `Milestone in ${plural(-late, 'day')} looks at risk: ${short(m.title, 60)}`,
      detail: `Due ${iso(m.dueDate)}: ${reasons.join(', ')}.`,
      facts: { dueDate: iso(m.dueDate), daysLeft: -late, linkedTasks: linked.length, openTasks: open.length, overdueTasks: overdue, blockedTasks: blocked, notStartedTasks: notStarted },
    })
  }
  return out
}

/* ── Permits and regulations ────────────────────────────────────────────────────── */

export function permitSignals(input: Pick<RiskInput, 'projectId' | 'conditions' | 'applications'>, now: Date, th: RiskThresholds = DEFAULT_THRESHOLDS): RiskSignal[] {
  const out: RiskSignal[] = []
  const link = `/projects/${input.projectId}/planning`

  for (const c of input.conditions) {
    const label = `Condition ${c.conditionNumber}${c.applicationRef ? ` (${c.applicationRef})` : ''}`
    const record = { type: 'planning_condition' as const, id: c.id, label }
    const what = short(c.description, 80)
    if (c.status === 'NOT_DISCHARGED') {
      out.push({
        id: `CONDITION_NOT_DISCHARGED:${c.id}`, kind: 'CONDITION_NOT_DISCHARGED', area: 'permits', severity: 'high', record, link,
        title: `${label} was not discharged`, detail: `The authority did not accept the submission: ${what}`,
        facts: { status: c.status, conditionType: c.conditionType, submissionDate: c.submissionDate ? iso(c.submissionDate) : null },
      })
      continue
    }
    if (!CONDITION_OPEN.has(c.status) || !c.dueDate) continue
    const late = daysBetween(c.dueDate, now)
    if (late > 0) {
      out.push({
        id: `CONDITION_OVERDUE:${c.id}`, kind: 'CONDITION_OVERDUE', area: 'permits', severity: 'high', record, link,
        title: `${label} is ${plural(late, 'day')} late`, detail: `Due ${iso(c.dueDate)} and not submitted${c.ownerId ? '' : '; nobody owns it'}: ${what}`,
        facts: { dueDate: iso(c.dueDate), daysLate: late, status: c.status, conditionType: c.conditionType, hasOwner: !!c.ownerId },
      })
    } else if (-late <= th.dueSoonDays * 2) {
      out.push({
        id: `CONDITION_DUE_SOON:${c.id}`, kind: 'CONDITION_DUE_SOON', area: 'permits', severity: !c.ownerId || -late <= th.dueSoonDays ? 'high' : 'medium', record, link,
        title: `${label} is due in ${plural(-late, 'day')}`, detail: `Due ${iso(c.dueDate)}, not submitted yet${c.ownerId ? '' : ', and nobody owns it'}: ${what}`,
        facts: { dueDate: iso(c.dueDate), daysLeft: -late, status: c.status, conditionType: c.conditionType, hasOwner: !!c.ownerId },
      })
    }
  }

  for (const a of input.applications) {
    const label = a.reference ? `Application ${a.reference}` : `Application to ${a.authority}`
    const record = { type: 'planning_application' as const, id: a.id, label }
    if (APPLICATION_AWAITING_DECISION.has(a.status) && a.targetDecision && !a.decisionDate) {
      const late = daysBetween(a.targetDecision, now)
      if (late > 0) {
        out.push({
          id: `PERMIT_DECISION_LATE:${a.id}`, kind: 'PERMIT_DECISION_LATE', area: 'permits', severity: late >= 28 ? 'high' : 'medium', record, link,
          title: `Decision ${plural(late, 'day')} past its target: ${label}`, detail: `${a.authority} was due to decide by ${iso(a.targetDecision)}. Status: ${a.status.toLowerCase().replace(/_/g, ' ')}.`,
          facts: { targetDecision: iso(a.targetDecision), daysLate: late, status: a.status, authority: a.authority },
        })
      }
    }
    if (APPLICATION_GRANTED.has(a.status) && a.expiryDate) {
      const left = daysBetween(now, a.expiryDate)
      if (left < 0) {
        out.push({
          id: `PERMIT_EXPIRED:${a.id}`, kind: 'PERMIT_EXPIRED', area: 'permits', severity: 'high', record, link,
          title: `Permission lapsed ${plural(-left, 'day')} ago: ${label}`, detail: `It expired on ${iso(a.expiryDate)}.`,
          facts: { expiryDate: iso(a.expiryDate), daysSinceExpiry: -left, authority: a.authority },
        })
      } else if (left <= th.permitExpiryWarningDays) {
        out.push({
          id: `PERMIT_EXPIRING:${a.id}`, kind: 'PERMIT_EXPIRING', area: 'permits', severity: left <= 30 ? 'high' : 'medium', record, link,
          title: `Permission lapses in ${plural(left, 'day')}: ${label}`, detail: `It expires on ${iso(a.expiryDate)}.`,
          facts: { expiryDate: iso(a.expiryDate), daysLeft: left, authority: a.authority },
        })
      }
    }
  }
  return out
}

export function regulatorySignals(input: Pick<RiskInput, 'projectId' | 'regulatoryItems'>, now: Date, th: RiskThresholds = DEFAULT_THRESHOLDS): RiskSignal[] {
  const out: RiskSignal[] = []
  const unowned: RegulatoryItemIn[] = []
  const link = `/projects/${input.projectId}/regulatory`
  for (const r of input.regulatoryItems) {
    if (REGULATORY_SETTLED.has(r.status)) continue
    const name = short(r.titleLocal || r.requirement, 80)
    const record = { type: 'regulatory_item' as const, id: r.id, label: name }
    const fromAuthority = r.origin === 'MUNICIPALITY'
    const source = fromAuthority ? 'from the planning document' : r.citation ? `(${r.citation})` : ''

    if (REGULATORY_PROBLEM.has(r.status)) {
      out.push({
        id: `REGULATORY_ACTION_REQUIRED:${r.id}`, kind: 'REGULATORY_ACTION_REQUIRED', area: 'permits', severity: r.status === 'NON_COMPLIANT' ? 'high' : 'medium', record, link,
        title: `${r.status === 'NON_COMPLIANT' ? 'Marked non-compliant' : 'Action required'}: ${name}`, detail: `A requirement ${source} is marked ${r.status.toLowerCase().replace(/_/g, ' ')}.`.replace(/\s+/g, ' '),
        facts: { status: r.status, origin: r.origin, citation: r.citation, hasOwner: !!r.ownerId },
      })
      continue
    }
    const late = r.dueDate ? daysBetween(r.dueDate, now) : null
    if (late !== null && late > 0) {
      out.push({
        id: `REGULATORY_OVERDUE:${r.id}`, kind: 'REGULATORY_OVERDUE', area: 'permits', severity: fromAuthority || late >= th.taskHighAfterDays ? 'high' : 'medium', record, link,
        title: `Requirement ${plural(late, 'day')} late: ${name}`, detail: `Due ${iso(r.dueDate!)} ${source}, still ${r.status.toLowerCase().replace(/_/g, ' ')}.`.replace(/\s+/g, ' '),
        facts: { dueDate: iso(r.dueDate!), daysLate: late, status: r.status, origin: r.origin, citation: r.citation, hasOwner: !!r.ownerId },
      })
    } else if (fromAuthority && r.status === 'NOT_STARTED' && !r.ownerId && !r.dueDate) {
      unowned.push(r)
    }
  }
  // Conditions the authority set that nobody has picked up or dated are the kind that get forgotten. A planning
  // document can produce a dozen of them, so they are reported together: one flag, not twelve.
  if (unowned.length > 0) {
    const names = unowned.slice(0, 3).map((r) => short(r.titleLocal || r.requirement, 50))
    out.push({
      id: `REGULATORY_UNOWNED:${input.projectId}`, kind: 'REGULATORY_UNOWNED', area: 'permits', severity: 'low',
      record: { type: 'regulatory_item', id: input.projectId, label: `${plural(unowned.length, 'condition')} from the planning document` }, link,
      title: `${plural(unowned.length, 'condition')} from the planning document ${unowned.length === 1 ? 'has' : 'have'} no owner and no date`,
      detail: `Not started, nobody assigned: ${names.join('; ')}${unowned.length > 3 ? `; and ${unowned.length - 3} more` : ''}.`,
      facts: { count: unowned.length, itemIds: unowned.map((r) => r.id).join(',') },
    })
  }
  return out
}

/* ── Money ──────────────────────────────────────────────────────────────────────── */

const hrs = (n: number) => `${Math.round(n * 10) / 10} h`

/**
 * Hours logged against hours planned, to date. Coordin holds no charge-out rates, so this is about time, not money:
 * it says the team has spent more hours than the resource plan allowed by now, which is the early sign of a fee overrun.
 */
export function moneySignals(input: Pick<RiskInput, 'projectId' | 'hours'>, th: RiskThresholds = DEFAULT_THRESHOLDS): RiskSignal[] {
  const h = input.hours
  if (!h || h.plannedToDate < th.hoursMinimumPlanned) return []
  // rounded so that exactly 10% over is not pushed past the line by floating-point arithmetic
  const over = Math.round((h.loggedToDate / h.plannedToDate - 1) * 10_000) / 10_000
  if (over <= th.hoursOverPlan) return []
  const pct = Math.round(over * 100)
  return [{
    id: `HOURS_OVER_PLAN:${input.projectId}`, kind: 'HOURS_OVER_PLAN', area: 'money', severity: over > th.hoursOverPlanHigh ? 'high' : 'medium',
    record: { type: 'project', id: input.projectId, label: 'Resource plan' }, link: `/projects/${input.projectId}/resources`,
    title: `Hours are ${pct}% over the plan so far`,
    detail: `${hrs(h.loggedToDate)} logged against ${hrs(h.plannedToDate)} planned to date${h.plannedTotal > h.plannedToDate ? ` (${hrs(h.plannedTotal)} planned in all)` : ''}.`,
    facts: { loggedToDate: Math.round(h.loggedToDate * 10) / 10, plannedToDate: Math.round(h.plannedToDate * 10) / 10, plannedTotal: Math.round(h.plannedTotal * 10) / 10, percentOver: pct },
  }]
}

/* ── Things waiting for a decision ──────────────────────────────────────────────── */

export function approvalSignals(input: Pick<RiskInput, 'projectId' | 'tasks' | 'expensesWaiting' | 'documentReviewsWaiting'>, now: Date, th: RiskThresholds = DEFAULT_THRESHOLDS): RiskSignal[] {
  const out: RiskSignal[] = []
  const sev = (days: number): RiskSeverity => (days >= th.waitingHighDays ? 'high' : 'medium')

  for (const t of input.tasks) {
    if (t.archivedAt || t.status !== 'READY_FOR_REVIEW') continue
    const waiting = daysBetween(t.updatedAt, now)
    if (waiting < th.waitingDays) continue
    out.push({
      id: `TASK_REVIEW_WAITING:${t.id}`, kind: 'TASK_REVIEW_WAITING', area: 'approvals', severity: sev(waiting), record: { type: 'task', id: t.id, label: t.title }, link: `/tasks/${t.id}`,
      title: `Waiting ${plural(waiting, 'day')} for review: ${short(t.title, 70)}`, detail: `Marked ready for review and not touched since ${iso(t.updatedAt)}.`,
      facts: { daysWaiting: waiting, since: iso(t.updatedAt), priority: t.priority },
    })
  }
  for (const e of input.expensesWaiting ?? []) {
    if (!e.submittedAt) continue
    const waiting = daysBetween(e.submittedAt, now)
    if (waiting < th.waitingDays) continue
    out.push({
      id: `EXPENSE_WAITING:${e.id}`, kind: 'EXPENSE_WAITING', area: 'approvals', severity: sev(waiting), record: { type: 'expense', id: e.id, label: short(e.description, 60) }, link: '/expenses',
      title: `Expense waiting ${plural(waiting, 'day')} for approval: ${short(e.description, 60)}`, detail: `${e.currency ? e.currency + ' ' : ''}${e.amount.toFixed(2)}, submitted ${iso(e.submittedAt)}.`,
      facts: { daysWaiting: waiting, submittedAt: iso(e.submittedAt), amount: e.amount, currency: e.currency, status: e.status },
    })
  }
  for (const r of input.documentReviewsWaiting ?? []) {
    const waiting = daysBetween(r.requestedAt, now)
    if (waiting < th.waitingDays) continue
    out.push({
      id: `DOCUMENT_REVIEW_WAITING:${r.id}`, kind: 'DOCUMENT_REVIEW_WAITING', area: 'approvals', severity: sev(waiting), record: { type: 'document', id: r.documentId, label: r.documentTitle }, link: `/documents/${r.documentId}`,
      title: `Review waiting ${plural(waiting, 'day')}: ${short(r.documentTitle, 60)}`, detail: `Revision ${r.revision} was sent for review on ${iso(r.requestedAt)} and has no outcome yet.`,
      facts: { daysWaiting: waiting, requestedAt: iso(r.requestedAt), revision: r.revision },
    })
  }
  return out
}

/* ── Documents ──────────────────────────────────────────────────────────────────── */

export function documentSignals(input: Pick<RiskInput, 'projectId' | 'documentContradictions'>): RiskSignal[] {
  return input.documentContradictions.filter((d) => d.contradictions.length > 0).map((d) => {
    const first = d.contradictions[0]
    const page = (p: number | null) => (p ? ` (p. ${p})` : '')
    return {
      id: `DOCUMENT_FIGURES_DISAGREE:${d.documentId}`, kind: 'DOCUMENT_FIGURES_DISAGREE' as const, area: 'documents' as const, severity: 'medium' as const,
      record: { type: 'document' as const, id: d.documentId, label: d.documentTitle },
      link: `/projects/${input.projectId}/documents`,
      title: `Figures may disagree in "${short(d.documentTitle, 60)}"`,
      detail: `${first.subject}: ${first.a.value}${page(first.a.page)} against ${first.b.value}${page(first.b.page)}${d.contradictions.length > 1 ? `, and ${d.contradictions.length - 1} more` : ''}. Found by the AI summary; check both pages.`,
      facts: { count: d.contradictions.length, revision: d.revision, runId: d.runId, subject: first.subject, valueA: first.a.value, valueB: first.b.value },
    }
  })
}

/* ── All together ───────────────────────────────────────────────────────────────── */

const RANK: Record<RiskSeverity, number> = { high: 0, medium: 1, low: 2 }
const AREA_ORDER: RiskArea[] = ['permits', 'schedule', 'money', 'approvals', 'documents']

export function computeSignals(input: RiskInput, now: Date, th: RiskThresholds = DEFAULT_THRESHOLDS): RiskSignal[] {
  const all = [...permitSignals(input, now, th), ...regulatorySignals(input, now, th), ...milestoneSignals(input, now, th), ...taskSignals(input, now, th), ...moneySignals(input, th), ...approvalSignals(input, now, th), ...documentSignals(input)]
  return all.sort((a, b) => RANK[a.severity] - RANK[b.severity] || AREA_ORDER.indexOf(a.area) - AREA_ORDER.indexOf(b.area) || a.id.localeCompare(b.id))
}

export function countSignals(signals: RiskSignal[]) {
  const by = (s: RiskSeverity) => signals.filter((x) => x.severity === s).length
  return { total: signals.length, high: by('high'), medium: by('medium'), low: by('low'), byArea: Object.fromEntries(AREA_ORDER.map((a) => [a, signals.filter((x) => x.area === a).length])) as Record<RiskArea, number> }
}

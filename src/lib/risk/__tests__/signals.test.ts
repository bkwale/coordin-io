import { describe, it, expect } from 'vitest'
import { computeSignals, countSignals, taskSignals, milestoneSignals, permitSignals, regulatorySignals, documentSignals, moneySignals, approvalSignals, daysBetween, DEFAULT_THRESHOLDS, type TaskIn, type MilestoneIn, type ConditionIn, type ApplicationIn, type RegulatoryItemIn, type RiskInput } from '../signals'

const NOW = new Date('2026-11-16T10:30:00Z')
const d = (s: string) => new Date(`${s}T00:00:00Z`)
const P = 'proj1'
const task = (over: Partial<TaskIn> = {}): TaskIn => ({ id: 't1', title: 'Koostada eelprojekt', status: 'IN_PROGRESS', priority: 'MEDIUM', dueDate: null, ownerId: 'u1', milestoneId: null, archivedAt: null, updatedAt: d('2026-11-15'), ...over })
const milestone = (over: Partial<MilestoneIn> = {}): MilestoneIn => ({ id: 'm1', title: 'Eelprojekt valmis', status: 'UPCOMING', dueDate: d('2026-12-18'), completedDate: null, ...over })
const condition = (over: Partial<ConditionIn> = {}): ConditionIn => ({ id: 'c1', conditionNumber: 3, description: 'Submit materials schedule', conditionType: 'Pre-commencement', status: 'OUTSTANDING', dueDate: null, ownerId: 'u1', submissionDate: null, applicationRef: '22/4128', ...over })
const application = (over: Partial<ApplicationIn> = {}): ApplicationIn => ({ id: 'a1', reference: '22/4128', authority: 'Brent', status: 'UNDER_ASSESSMENT', targetDecision: null, decisionDate: null, expiryDate: null, ...over })
const reg = (over: Partial<RegulatoryItemIn> = {}): RegulatoryItemIn => ({ id: 'r1', requirement: 'Building permit', titleLocal: 'Ehitusluba', status: 'NOT_STARTED', origin: 'RULE', dueDate: null, ownerId: null, citation: '§ 38', ...over })
const kinds = (xs: Array<{ kind: string }>) => xs.map((x) => x.kind)

describe('days', () => {
  it('counts whole calendar days, whatever the time of day', () => {
    expect(daysBetween(d('2026-11-16'), NOW)).toBe(0)
    expect(daysBetween(new Date('2026-11-15T23:59:00Z'), NOW)).toBe(1)
    expect(daysBetween(d('2026-11-20'), NOW)).toBe(-4)
  })
})

describe('tasks', () => {
  const run = (t: TaskIn[]) => taskSignals({ projectId: P, tasks: t }, NOW)
  it('due today is not late; due yesterday is', () => {
    expect(run([task({ dueDate: d('2026-11-16') })])).toEqual([])
    const [s] = run([task({ dueDate: d('2026-11-15') })])
    expect(s).toMatchObject({ kind: 'TASK_OVERDUE', severity: 'low', id: 'TASK_OVERDUE:t1', link: '/tasks/t1', facts: { daysLate: 1, dueDate: '2026-11-15' } })
  })
  it('severity grows with lateness and with priority', () => {
    expect(run([task({ dueDate: d('2026-11-13') })])[0].severity).toBe('medium')
    expect(run([task({ dueDate: d('2026-11-02') })])[0].severity).toBe('high')
    expect(run([task({ dueDate: d('2026-11-15'), priority: 'CRITICAL' })])[0].severity).toBe('high')
  })
  it('completed and archived tasks never raise anything', () => {
    expect(run([task({ dueDate: d('2026-10-01'), status: 'COMPLETED' }), task({ id: 't2', dueDate: d('2026-10-01'), archivedAt: d('2026-10-05') })])).toEqual([])
  })
  it('a task with no due date is not late', () => expect(run([task()])).toEqual([]))
  it('due within a week with no owner is flagged; with an owner it is not', () => {
    expect(kinds(run([task({ dueDate: d('2026-11-20'), ownerId: null })]))).toEqual(['TASK_DUE_SOON_UNOWNED'])
    expect(run([task({ dueDate: d('2026-11-20') })])).toEqual([])
    expect(run([task({ dueDate: d('2026-11-30'), ownerId: null })])).toEqual([])
  })
  it('a late task with no owner says so, once (not two signals)', () => {
    const s = run([task({ dueDate: d('2026-11-10'), ownerId: null })])
    expect(kinds(s)).toEqual(['TASK_OVERDUE'])
    expect(s[0].detail).toMatch(/nobody owns it/)
  })
  it('blocked for five days or more is flagged; freshly blocked is not', () => {
    expect(run([task({ status: 'BLOCKED', updatedAt: d('2026-11-13') })])).toEqual([])
    const [s] = run([task({ status: 'BLOCKED', updatedAt: d('2026-11-10') })])
    expect(s).toMatchObject({ kind: 'TASK_BLOCKED', severity: 'medium', facts: { daysBlocked: 6 } })
    expect(run([task({ status: 'BLOCKED', updatedAt: d('2026-10-20') })])[0].severity).toBe('high')
  })
  it('late and blocked gives both signals for the same task', () => {
    expect(kinds(run([task({ status: 'BLOCKED', dueDate: d('2026-11-01'), updatedAt: d('2026-11-01') })])).sort()).toEqual(['TASK_BLOCKED', 'TASK_OVERDUE'])
  })
})

describe('milestones', () => {
  const run = (m: MilestoneIn[], t: TaskIn[] = []) => milestoneSignals({ projectId: P, milestones: m, tasks: t }, NOW)
  it('a late open milestone is high, with its open task count', () => {
    const [s] = run([milestone({ dueDate: d('2026-11-10') })], [task({ milestoneId: 'm1' }), task({ id: 't2', milestoneId: 'm1', status: 'COMPLETED' })])
    expect(s).toMatchObject({ kind: 'MILESTONE_OVERDUE', severity: 'high', facts: { daysLate: 6, linkedTasks: 2, openTasks: 1 } })
  })
  it('completed or cancelled milestones are ignored, even if the date has passed', () => {
    expect(run([milestone({ dueDate: d('2026-11-01'), status: 'COMPLETED' }), milestone({ id: 'm2', dueDate: d('2026-11-01'), status: 'CANCELLED' }), milestone({ id: 'm3', dueDate: d('2026-11-01'), completedDate: d('2026-10-30') })])).toEqual([])
  })
  it('due within two weeks with a late or blocked task is at risk', () => {
    const [s] = run([milestone({ dueDate: d('2026-11-25') })], [task({ milestoneId: 'm1', dueDate: d('2026-11-10') }), task({ id: 't2', milestoneId: 'm1' })])
    expect(s).toMatchObject({ kind: 'MILESTONE_AT_RISK', severity: 'medium', facts: { daysLeft: 9, overdueTasks: 1 } })
    expect(run([milestone({ dueDate: d('2026-11-20') })], [task({ milestoneId: 'm1', status: 'BLOCKED' })])[0].severity).toBe('high')
  })
  it('due soon with most tasks not started is at risk', () => {
    const tasks = [task({ milestoneId: 'm1', status: 'NOT_STARTED' }), task({ id: 't2', milestoneId: 'm1', status: 'NOT_STARTED' }), task({ id: 't3', milestoneId: 'm1' })]
    expect(kinds(run([milestone({ dueDate: d('2026-11-25') })], tasks))).toEqual(['MILESTONE_AT_RISK'])
  })
  it('due soon with healthy tasks, or far away, raises nothing', () => {
    expect(run([milestone({ dueDate: d('2026-11-25') })], [task({ milestoneId: 'm1' })])).toEqual([])
    expect(run([milestone({ dueDate: d('2026-12-18') })], [task({ milestoneId: 'm1', dueDate: d('2026-11-01') })])).toEqual([])
    expect(run([milestone({ dueDate: d('2026-11-25') })])).toEqual([])
  })
  it('tasks of other milestones do not count', () => {
    expect(run([milestone({ dueDate: d('2026-11-25') })], [task({ milestoneId: 'other', status: 'BLOCKED' })])).toEqual([])
  })
})

describe('planning conditions and applications', () => {
  const run = (c: ConditionIn[] = [], a: ApplicationIn[] = []) => permitSignals({ projectId: P, conditions: c, applications: a }, NOW)
  it('an outstanding condition past its date is high', () => {
    const [s] = run([condition({ dueDate: d('2026-11-01') })])
    expect(s).toMatchObject({ kind: 'CONDITION_OVERDUE', severity: 'high', link: '/projects/proj1/planning', facts: { daysLate: 15 } })
    expect(s.record.label).toBe('Condition 3 (22/4128)')
  })
  it('submitted or discharged conditions are not late, whatever the date', () => {
    expect(run([condition({ dueDate: d('2026-11-01'), status: 'SUBMITTED' }), condition({ id: 'c2', dueDate: d('2026-11-01'), status: 'DISCHARGED' }), condition({ id: 'c3', dueDate: d('2026-11-01'), status: 'UNDER_REVIEW' })])).toEqual([])
  })
  it('due within two weeks is flagged; high if within a week or nobody owns it', () => {
    expect(run([condition({ dueDate: d('2026-11-27') })])[0]).toMatchObject({ kind: 'CONDITION_DUE_SOON', severity: 'medium' })
    expect(run([condition({ dueDate: d('2026-11-20') })])[0].severity).toBe('high')
    expect(run([condition({ dueDate: d('2026-11-27'), ownerId: null })])[0].severity).toBe('high')
    expect(run([condition({ dueDate: d('2026-12-20') })])).toEqual([])
  })
  it('a condition the authority refused to discharge is high', () => {
    expect(run([condition({ status: 'NOT_DISCHARGED' })])[0]).toMatchObject({ kind: 'CONDITION_NOT_DISCHARGED', severity: 'high' })
  })
  it('a condition with no date raises nothing here', () => expect(run([condition()])).toEqual([]))
  it('a decision past its target date is flagged; high after four weeks', () => {
    expect(run([], [application({ targetDecision: d('2026-11-06') })])[0]).toMatchObject({ kind: 'PERMIT_DECISION_LATE', severity: 'medium', facts: { daysLate: 10 } })
    expect(run([], [application({ targetDecision: d('2026-10-01') })])[0].severity).toBe('high')
    expect(run([], [application({ targetDecision: d('2026-10-01'), decisionDate: d('2026-10-20') })])).toEqual([])
    expect(run([], [application({ targetDecision: d('2026-10-01'), status: 'PREPARING' })])).toEqual([])
  })
  it('a granted permission close to lapsing, or lapsed, is flagged', () => {
    expect(run([], [application({ status: 'APPROVED', expiryDate: d('2027-01-20') })])[0]).toMatchObject({ kind: 'PERMIT_EXPIRING', severity: 'medium', facts: { daysLeft: 65 } })
    expect(run([], [application({ status: 'APPROVED', expiryDate: d('2026-12-01') })])[0].severity).toBe('high')
    expect(run([], [application({ status: 'APPROVED', expiryDate: d('2026-11-01') })])[0]).toMatchObject({ kind: 'PERMIT_EXPIRED', severity: 'high' })
    expect(run([], [application({ status: 'APPROVED', expiryDate: d('2028-01-01') })])).toEqual([])
    expect(run([], [application({ status: 'REFUSED', expiryDate: d('2026-11-01') })])).toEqual([])
  })
})

describe('regulatory checklist', () => {
  const run = (r: RegulatoryItemIn[]) => regulatorySignals({ projectId: P, regulatoryItems: r }, NOW)
  it('a late requirement is medium; high if it came from the authority or is two weeks late', () => {
    expect(run([reg({ dueDate: d('2026-11-10') })])[0]).toMatchObject({ kind: 'REGULATORY_OVERDUE', severity: 'medium', link: '/projects/proj1/regulatory' })
    expect(run([reg({ dueDate: d('2026-11-10'), origin: 'MUNICIPALITY' })])[0].severity).toBe('high')
    expect(run([reg({ dueDate: d('2026-10-20') })])[0].severity).toBe('high')
  })
  it('settled items raise nothing', () => {
    for (const status of ['COMPLIANT', 'CLOSED', 'NOT_APPLICABLE', 'APPROVED_WITH_CONDITION']) expect(run([reg({ dueDate: d('2026-10-01'), status })])).toEqual([])
  })
  it('non-compliant is high, action required is medium', () => {
    expect(run([reg({ status: 'NON_COMPLIANT' })])[0]).toMatchObject({ kind: 'REGULATORY_ACTION_REQUIRED', severity: 'high' })
    expect(run([reg({ status: 'ACTION_REQUIRED' })])[0].severity).toBe('medium')
  })
  it('conditions from the planning document with no owner and no date are reported together, as one low flag', () => {
    const items = Array.from({ length: 14 }, (_, i) => reg({ id: `r${i}`, origin: 'MUNICIPALITY', titleLocal: null, requirement: `Tingimus ${i}` }))
    const s = run(items)
    expect(s).toHaveLength(1)
    expect(s[0]).toMatchObject({ kind: 'REGULATORY_UNOWNED', severity: 'low', id: 'REGULATORY_UNOWNED:proj1', facts: { count: 14 } })
    expect(s[0].title).toBe('14 conditions from the planning document have no owner and no date')
    expect(s[0].detail).toContain('Tingimus 0; Tingimus 1; Tingimus 2; and 11 more')
  })
  it('one such condition reads in the singular; rule items and owned ones are not counted', () => {
    expect(run([reg({ origin: 'MUNICIPALITY' })])[0].title).toBe('1 condition from the planning document has no owner and no date')
    expect(run([reg()])).toEqual([])
    expect(run([reg({ origin: 'MUNICIPALITY', ownerId: 'u1' })])).toEqual([])
    expect(run([reg({ origin: 'MUNICIPALITY', dueDate: d('2027-01-01') })])).toEqual([])
  })
  it('uses the local title when there is one', () => expect(run([reg({ status: 'NON_COMPLIANT' })])[0].title).toContain('Ehitusluba'))
})

describe('documents', () => {
  it('a summary that found figures disagreeing raises one signal per document', () => {
    const s = documentSignals({ projectId: P, documentContradictions: [
      { documentId: 'd1', documentTitle: 'Seletuskiri', revision: 'A', runId: 'run1', contradictions: [{ subject: 'katuse U-arv', a: { value: '0,10 W/(m2K)', page: 18 }, b: { value: '0,12 W/(m2K)', page: 53 } }, { subject: 'x', a: { value: '1', page: null }, b: { value: '2', page: null } }] },
      { documentId: 'd2', documentTitle: 'Clean', revision: 'A', runId: 'run2', contradictions: [] },
    ] })
    expect(s).toHaveLength(1)
    expect(s[0]).toMatchObject({ kind: 'DOCUMENT_FIGURES_DISAGREE', severity: 'medium', id: 'DOCUMENT_FIGURES_DISAGREE:d1', facts: { count: 2 } })
    expect(s[0].detail).toContain('0,10 W/(m2K) (p. 18) against 0,12 W/(m2K) (p. 53), and 1 more')
  })
})

describe('hours against the resource plan', () => {
  const run = (plannedToDate: number, loggedToDate: number, plannedTotal = 400) => moneySignals({ projectId: P, hours: { plannedToDate, loggedToDate, plannedTotal } })
  it('on or under plan, or just inside the tolerance, raises nothing', () => {
    expect(run(100, 80)).toEqual([])
    expect(run(100, 100)).toEqual([])
    expect(run(100, 110)).toEqual([])
  })
  it('more than 10% over is medium, more than 25% over is high', () => {
    expect(run(100, 118)[0]).toMatchObject({ kind: 'HOURS_OVER_PLAN', severity: 'medium', area: 'money', id: 'HOURS_OVER_PLAN:proj1', facts: { percentOver: 18, loggedToDate: 118, plannedToDate: 100 } })
    expect(run(100, 140)[0].severity).toBe('high')
    expect(run(100, 118)[0].detail).toBe('118 h logged against 100 h planned to date (400 h planned in all).')
  })
  it('too little planned so far to judge: nothing, however far over', () => expect(run(8, 30)).toEqual([]))
  it('no resource plan at all: nothing', () => {
    expect(moneySignals({ projectId: P, hours: null })).toEqual([])
    expect(moneySignals({ projectId: P })).toEqual([])
  })
})

describe('things waiting for a decision', () => {
  const run = (over: Partial<Parameters<typeof approvalSignals>[0]>) => approvalSignals({ projectId: P, tasks: [], ...over }, NOW)
  it('a task ready for review and untouched for five days is flagged; fourteen is high', () => {
    expect(run({ tasks: [task({ status: 'READY_FOR_REVIEW', updatedAt: d('2026-11-13') })] })).toEqual([])
    expect(run({ tasks: [task({ status: 'READY_FOR_REVIEW', updatedAt: d('2026-11-09') })] })[0]).toMatchObject({ kind: 'TASK_REVIEW_WAITING', severity: 'medium', area: 'approvals', facts: { daysWaiting: 7 } })
    expect(run({ tasks: [task({ status: 'READY_FOR_REVIEW', updatedAt: d('2026-10-30') })] })[0].severity).toBe('high')
    expect(run({ tasks: [task({ status: 'IN_PROGRESS', updatedAt: d('2026-10-01') })] })).toEqual([])
  })
  it('an expense waiting on this project is flagged with its amount', () => {
    const [s] = run({ expensesWaiting: [{ id: 'e1', description: 'Site visit travel', amount: 84.5, currency: 'EUR', status: 'SUBMITTED', submittedAt: d('2026-11-06') }] })
    expect(s).toMatchObject({ kind: 'EXPENSE_WAITING', severity: 'medium', facts: { daysWaiting: 10, amount: 84.5 } })
    expect(s.detail).toBe('EUR 84.50, submitted 2026-11-06.')
    expect(run({ expensesWaiting: [{ id: 'e2', description: 'x', amount: 1, currency: null, status: 'SUBMITTED', submittedAt: d('2026-11-14') }] })).toEqual([])
    expect(run({ expensesWaiting: [{ id: 'e3', description: 'x', amount: 1, currency: null, status: 'SUBMITTED', submittedAt: null }] })).toEqual([])
  })
  it('a document review with no outcome is flagged', () => {
    const [s] = run({ documentReviewsWaiting: [{ id: 'rv1', documentId: 'doc1', documentTitle: 'Eelprojekt', revision: 'B', requestedAt: d('2026-10-28') }] })
    expect(s).toMatchObject({ kind: 'DOCUMENT_REVIEW_WAITING', severity: 'high', link: '/documents/doc1', facts: { daysWaiting: 19, revision: 'B' } })
  })
})

describe('all together', () => {
  const input: RiskInput = {
    projectId: P,
    tasks: [task({ dueDate: d('2026-11-15') }), task({ id: 't2', dueDate: d('2026-11-01') })],
    milestones: [milestone({ dueDate: d('2026-11-10') })],
    conditions: [condition({ dueDate: d('2026-11-01') })],
    applications: [],
    regulatoryItems: [reg({ origin: 'MUNICIPALITY' })],
    documentContradictions: [{ documentId: 'd1', documentTitle: 'Spec', revision: 'A', runId: 'r', contradictions: [{ subject: 's', a: { value: '1 m', page: 1 }, b: { value: '2 m', page: 2 } }] }],
  }
  it('sorts high first, permits before schedule, and is the same every time', () => {
    const a = computeSignals(input, NOW), b = computeSignals(input, NOW)
    expect(a).toEqual(b)
    expect(a.map((s) => `${s.severity}:${s.kind}`)).toEqual(['high:CONDITION_OVERDUE', 'high:MILESTONE_OVERDUE', 'high:TASK_OVERDUE', 'medium:DOCUMENT_FIGURES_DISAGREE', 'low:REGULATORY_UNOWNED', 'low:TASK_OVERDUE'])
  })
  it('counts by severity and area', () => {
    expect(countSignals(computeSignals(input, NOW))).toEqual({ total: 6, high: 3, medium: 1, low: 2, byArea: { permits: 2, schedule: 3, money: 0, approvals: 0, documents: 1 } })
  })
  it('an empty project raises nothing', () => {
    expect(computeSignals({ projectId: P, tasks: [], milestones: [], conditions: [], applications: [], regulatoryItems: [], documentContradictions: [] }, NOW)).toEqual([])
  })
  it('every signal id is unique and names its record', () => {
    const s = computeSignals(input, NOW)
    expect(new Set(s.map((x) => x.id)).size).toBe(s.length)
    for (const x of s) expect(x.id.startsWith(`${x.kind}:`)).toBe(true)
  })
  it('thresholds can be changed', () => {
    const strict = { ...DEFAULT_THRESHOLDS, taskMediumAfterDays: 1 }
    expect(taskSignals({ projectId: P, tasks: [task({ dueDate: d('2026-11-15') })] }, NOW, strict)[0].severity).toBe('medium')
  })
})

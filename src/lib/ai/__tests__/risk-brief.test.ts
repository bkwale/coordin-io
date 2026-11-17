import { describe, it, expect } from 'vitest'
import { checkBrief, flagsHash, flagsForModel, normaliseRiskBrief, numbersIn, RiskBriefSchema } from '../risk-brief-core'
import { applyDismissals } from '@/lib/risk/dismissals'
import type { RiskSignal } from '@/lib/risk/signals'

const sig = (over: Partial<RiskSignal> = {}): RiskSignal => ({
  id: 'CONDITION_OVERDUE:c1', kind: 'CONDITION_OVERDUE', area: 'permits', severity: 'high', title: 'Condition 1 (PT-2611802/04417) is 10 days late',
  detail: 'Due 2026-11-07 and not submitted: Esitada haljastusprojekt', record: { type: 'planning_condition', id: 'c1', label: 'Condition 1' }, link: '/projects/p/planning',
  facts: { dueDate: '2026-11-07', daysLate: 10, hasOwner: true }, ...over,
})
const hours = sig({ id: 'HOURS_OVER_PLAN:p', kind: 'HOURS_OVER_PLAN', area: 'money', title: 'Hours are 30% over the plan so far', detail: '156 h logged against 120 h planned to date (168 h planned in all).', facts: { loggedToDate: 156, plannedToDate: 120, plannedTotal: 168, percentOver: 30 }, link: '/projects/p/resources' })
const late = sig({ id: 'TASK_OVERDUE:t1', kind: 'TASK_OVERDUE', area: 'schedule', severity: 'medium', title: 'Task 5 days late: Koostada CLT-kandeseinte skeem', detail: 'Due 2026-11-12, still in progress.', facts: { daysLate: 5 }, link: '/tasks/t1' })
const flags = [sig(), hours, late]

describe('what the AI brief may say', () => {
  const brief = (over = {}) => ({ headline: 'Permit condition late and hours over plan', overview: 'A planning condition is 10 days late and hours are 30% over the plan.', priorities: [{ signalId: 'CONDITION_OVERDUE:c1', why: 'It is 10 days past its date.', action: 'Submit the landscaping design to the authority.' }], ...over })

  it('keeps a brief whose every number and flag is real, and attaches the flag it points to', () => {
    const b = checkBrief(brief(), flags)
    expect(b.notes).toEqual([])
    expect(b.priorities[0]).toMatchObject({ signalId: 'CONDITION_OVERDUE:c1', severity: 'high', link: '/projects/p/planning', title: 'Condition 1 (PT-2611802/04417) is 10 days late' })
    expect(b.overview).toContain('30% over')
  })
  it('drops a priority for a flag that is not being raised', () => {
    const b = checkBrief(brief({ priorities: [{ signalId: 'TASK_OVERDUE:made-up', why: 'x', action: 'Do it.' }, { signalId: 'TASK_OVERDUE:t1', why: 'It is 5 days late.', action: 'Ask the owner for a new date.' }] }), flags)
    expect(b.priorities.map((p) => p.signalId)).toEqual(['TASK_OVERDUE:t1'])
    expect(b.notes[0]).toMatch(/1 point from the AI was left out/)
  })
  it('drops a priority that quotes a number its own flag does not contain', () => {
    const b = checkBrief(brief({ priorities: [{ signalId: 'CONDITION_OVERDUE:c1', why: 'It is 14 days late and risks a fine of 500 euros.', action: 'Submit it.' }] }), flags)
    expect(b.priorities).toEqual([])
    expect(b.notes).toHaveLength(1)
  })
  it('a number from another flag does not excuse it', () => {
    expect(checkBrief(brief({ priorities: [{ signalId: 'TASK_OVERDUE:t1', why: 'It is 10 days late.', action: 'Chase it.' }] }), flags).priorities).toEqual([])
  })
  it('the same flag listed twice is kept once', () => {
    const p = { signalId: 'TASK_OVERDUE:t1', why: 'Late.', action: 'Chase it.' }
    expect(checkBrief(brief({ priorities: [p, p] }), flags).priorities).toHaveLength(1)
  })
  it('an overview with an invented figure is replaced by a plain count, and says so', () => {
    const b = checkBrief(brief({ overview: 'The project is 45% likely to miss its permit date.' }), flags)
    expect(b.overview).toBe('3 flags: 2 high, 1 medium, 0 low.')
    expect(b.notes.join(' ')).toMatch(/replaced with a plain count/)
  })
  it('counts of flags are allowed in the overview', () => {
    expect(checkBrief(brief({ overview: 'There are 3 flags, 2 of them high.' }), flags).notes).toEqual([])
  })
  it('no flags: a made-up overview cannot survive', () => {
    const b = checkBrief(brief({ overview: 'There are 4 serious problems.', priorities: [] }), [])
    expect(b.overview).toBe('Nothing is flagged on this project.')
  })
})

describe('brief plumbing', () => {
  it('the hash changes when a flag changes or disappears, not when the order does', () => {
    expect(flagsHash(flags)).toBe(flagsHash([late, hours, sig()]))
    expect(flagsHash(flags)).not.toBe(flagsHash([sig(), hours]))
    expect(flagsHash(flags)).not.toBe(flagsHash([sig({ title: 'Condition 1 (PT-2611802/04417) is 11 days late' }), hours, late]))
  })
  it('the model sees ids, wording and facts, but not internal links', () => {
    const f = flagsForModel([sig()])[0]
    expect(Object.keys(f).sort()).toEqual(['area', 'detail', 'facts', 'severity', 'signalId', 'title'])
  })
  it('normaliser accepts loose shapes and drops incomplete priorities', () => {
    const v = RiskBriefSchema.safeParse(normaliseRiskBrief({ title: 'H', summary: 'O', top: [{ id: 'a', reason: 'w', next: 'do' }, { id: 'b' }, null] }))
    expect(v.success && v.data).toEqual({ headline: 'H', overview: 'O', priorities: [{ signalId: 'a', why: 'w', action: 'do' }] })
  })
  it('numbers: thousands, decimals, and unit digits ignored', () => {
    expect(numbersIn('1 745 m2 and 0,12 W/(m2K), R60, 30%')).toEqual(['1745', '0.12', '30'])
  })
})

describe('setting flags aside', () => {
  const row = (over = {}) => ({ signalId: 'TASK_OVERDUE:t1', severity: 'medium', reason: 'Client moved the date', dismissedBy: 'u1', dismissedAt: new Date('2026-11-17T10:00:00Z'), restoredAt: null, ...over })
  it('a dismissed flag leaves the active list and shows with its reason', () => {
    const r = applyDismissals(flags, [row()])
    expect(r.active.map((s) => s.id)).toEqual(['CONDITION_OVERDUE:c1', 'HOURS_OVER_PLAN:p'])
    expect(r.dismissed[0]).toMatchObject({ reason: 'Client moved the date', dismissedBy: 'u1' })
  })
  it('it comes back, marked, when it gets worse than when it was set aside', () => {
    const r = applyDismissals([{ ...late, severity: 'high' }], [row()])
    expect(r.active[0]).toMatchObject({ id: 'TASK_OVERDUE:t1', cameBack: true })
    expect(r.dismissed).toEqual([])
  })
  it('a restored dismissal no longer hides anything', () => {
    expect(applyDismissals(flags, [row({ restoredAt: new Date() })]).active).toHaveLength(3)
  })
  it('a dismissal for a flag that has gone away is simply not shown', () => {
    const r = applyDismissals([sig()], [row()])
    expect(r.active).toHaveLength(1)
    expect(r.dismissed).toEqual([])
  })
})

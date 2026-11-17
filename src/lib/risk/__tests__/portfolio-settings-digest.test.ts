import { describe, it, expect, vi } from 'vitest'
vi.mock('@/lib/prisma', () => ({ prisma: {} }))
vi.mock('@/lib/email', () => ({ sendRiskDigestEmail: vi.fn() }))
vi.mock('@/lib/error-reporting', () => ({ captureError: vi.fn() }))
vi.mock('@/lib/audit', () => ({ recordAuditEvent: vi.fn(), AuditActions: {} }))
import { DEFAULT_THRESHOLDS, computeSignals, type RiskSignal } from '../signals'
import { parseRiskSettings, validateThresholds, thresholdsToStore, THRESHOLD_FIELDS, toShown } from '../settings'
import { rankProjects, topSignals, totals } from '../portfolio'
import { buildDigest, digestProjects, wantsDigest, weekKey } from '../digest'

const c = (high: number, medium: number, low = 0) => ({ total: high + medium + low, high, medium, low })
const shownDefaults = () => Object.fromEntries(THRESHOLD_FIELDS.map((f) => [f.key, toShown(f.unit, DEFAULT_THRESHOLDS[f.key])]))

describe('risk settings', () => {
  it('nothing saved gives the defaults and the digest off', () => {
    for (const v of [null, undefined, {}, { risk: null }, { risk: 'x' }, 'junk']) expect(parseRiskSettings(v)).toEqual({ thresholds: DEFAULT_THRESHOLDS, weeklyDigest: false })
  })
  it('every default sits inside its own allowed range', () => {
    expect(validateThresholds(shownDefaults())).toEqual({ ok: true, thresholds: DEFAULT_THRESHOLDS })
  })
  it('saved values are used; other settings keys are ignored', () => {
    const s = parseRiskSettings({ country: 'EE', risk: { thresholds: { taskHighAfterDays: 21, hoursOverPlan: 0.15 }, weeklyDigest: true } })
    expect(s.thresholds).toEqual({ ...DEFAULT_THRESHOLDS, taskHighAfterDays: 21, hoursOverPlan: 0.15 })
    expect(s.weeklyDigest).toBe(true)
  })
  it('a stored value that is out of range, not a number, or unknown falls back to the default', () => {
    const s = parseRiskSettings({ risk: { thresholds: { taskHighAfterDays: 0, blockedAfterDays: 'soon', dueSoonDays: 9999, hoursOverPlan: -1, madeUp: 3 }, weeklyDigest: 'yes' } })
    expect(s).toEqual({ thresholds: DEFAULT_THRESHOLDS, weeklyDigest: false })
  })
  it('a stored pair that is the wrong way round is not used', () => {
    const s = parseRiskSettings({ risk: { thresholds: { taskMediumAfterDays: 20, taskHighAfterDays: 10 } } })
    expect([s.thresholds.taskMediumAfterDays, s.thresholds.taskHighAfterDays]).toEqual([DEFAULT_THRESHOLDS.taskMediumAfterDays, DEFAULT_THRESHOLDS.taskHighAfterDays])
  })
  it('percentages are typed as whole numbers and stored as fractions', () => {
    const v = validateThresholds({ ...shownDefaults(), hoursOverPlan: 15, hoursOverPlanHigh: 40 })
    expect(v.ok && [v.thresholds.hoursOverPlan, v.thresholds.hoursOverPlanHigh]).toEqual([0.15, 0.4])
  })
  it('rejects decimals, text, out-of-range values and pairs out of order, in plain words', () => {
    const bad = (over: object) => { const v = validateThresholds({ ...shownDefaults(), ...over }); return v.ok ? [] : v.problems }
    expect(bad({ dueSoonDays: 2.5 })[0]).toMatch(/whole number/)
    expect(bad({ dueSoonDays: 'soon' })[0]).toMatch(/whole number/)
    expect(bad({ blockedAfterDays: 0 })[0]).toMatch(/between 1 and 60/)
    expect(bad({ waitingDays: 20, waitingHighDays: 10 })[0]).toMatch(/must be more than/)
    expect(bad({ taskMediumAfterDays: 14, taskHighAfterDays: 14 })[0]).toMatch(/must be more than/)
  })
  it('only what differs from the defaults is stored', () => {
    expect(thresholdsToStore(DEFAULT_THRESHOLDS)).toEqual({})
    expect(thresholdsToStore({ ...DEFAULT_THRESHOLDS, dueSoonDays: 10 })).toEqual({ dueSoonDays: 10 })
  })
  it('a changed threshold changes what is flagged', () => {
    const NOW = new Date('2026-11-17T10:00:00Z')
    const input = { projectId: 'p', milestones: [], conditions: [], applications: [], regulatoryItems: [], documentContradictions: [], tasks: [{ id: 't', title: 'Late', status: 'IN_PROGRESS', priority: 'MEDIUM', dueDate: new Date('2026-11-07T00:00:00Z'), ownerId: 'u', milestoneId: null, archivedAt: null, updatedAt: NOW }] }
    expect(computeSignals(input, NOW, DEFAULT_THRESHOLDS)[0].severity).toBe('medium')
    expect(computeSignals(input, NOW, { ...DEFAULT_THRESHOLDS, taskHighAfterDays: 7 })[0].severity).toBe('high')
  })
})

describe('all projects', () => {
  it('worst first: high, then medium, then total, then name', () => {
    const rows = [{ name: 'Delta', counts: c(0, 0) }, { name: 'Beta', counts: c(1, 5) }, { name: 'Alfa', counts: c(1, 5) }, { name: 'Gamma', counts: c(0, 9) }, { name: 'Epsilon', counts: c(3, 0) }, { name: 'Zeta', counts: c(1, 5, 2) }]
    expect(rankProjects(rows).map((r) => r.name)).toEqual(['Epsilon', 'Zeta', 'Alfa', 'Beta', 'Gamma', 'Delta'])
  })
  it('the top flags are the most serious ones, with only what the list needs', () => {
    const s = (id: string, severity: RiskSignal['severity']) => ({ id, severity, area: 'schedule', title: id, link: `/x/${id}`, kind: 'TASK_OVERDUE', detail: 'd', record: { type: 'task', id, label: id }, facts: {} }) as RiskSignal
    const top = topSignals([s('a', 'low'), s('b', 'high'), s('c', 'medium'), s('d', 'high')], 3)
    expect(top.map((t) => t.id)).toEqual(['b', 'd', 'c'])
    expect(Object.keys(top[0]).sort()).toEqual(['area', 'id', 'link', 'severity', 'title'])
  })
  it('totals add up across projects', () => expect(totals([{ counts: c(1, 2, 3) }, { counts: c(4, 0, 1) }])).toEqual({ total: 11, high: 5, medium: 2, low: 4 }))
})

describe('weekly digest', () => {
  const project = (over = {}) => ({ id: 'p1', name: 'Kase korterelamu', counts: c(2, 1, 4), top: [{ id: 'a', severity: 'high' as const, area: 'permits' as const, title: 'Condition 1 is 10 days late', link: '/projects/p1/planning' }, { id: 'b', severity: 'medium' as const, area: 'schedule' as const, title: 'Task 5 days late: <b>Skeem</b> & co', link: '/tasks/t1' }], ...over })
  it('nothing high or medium means no email at all', () => {
    expect(buildDigest({ firstName: 'Mari', organisationName: 'Büroo', projects: [] })).toBeNull()
    expect(buildDigest({ firstName: 'Mari', organisationName: 'Büroo', projects: [project({ counts: c(0, 0, 6) })] })).toBeNull()
  })
  it('lists each flagged project with its counts, flags and a link to its Risks page', () => {
    const m = buildDigest({ firstName: 'Mari', organisationName: 'Testbüroo OÜ', projects: [project(), project({ id: 'p2', name: 'Männiku eramu', counts: c(0, 0, 2), top: [] })], appUrl: 'https://app.test' })!
    expect(m.subject).toBe('Risks this week: 2 high, 1 medium across 1 project')
    expect(m.text).toContain('Kase korterelamu: 2 high, 1 medium, 4 low')
    expect(m.text).toContain('…and 5 more')
    expect(m.text).toContain('https://app.test/projects/p1/risks')
    expect(m.text).not.toContain('Männiku')
    expect(m.text).toContain('No AI is used')
  })
  it('names from the project are escaped in the html', () => {
    const m = buildDigest({ firstName: '<i>Mari</i>', organisationName: 'A & B', projects: [project({ name: '<script>x</script>' })] })!
    expect(m.html).not.toContain('<script>')
    expect(m.html).not.toContain('<b>Skeem</b>')
    expect(m.html).toContain('&lt;b&gt;Skeem&lt;/b&gt; &amp; co')
    expect(m.html).toContain('A &amp; B')
  })
  it('the worst project comes first', () => {
    expect(digestProjects([project({ id: 'x', name: 'X', counts: c(0, 1) }), project({ id: 'y', name: 'Y', counts: c(3, 0) })]).map((p) => p.id)).toEqual(['y', 'x'])
  })
  it('every day of a week gives the same key, and the next Monday gives a new one', () => {
    expect(weekKey(new Date('2026-11-16T06:00:00Z'))).toBe('2026-11-16')
    expect(weekKey(new Date('2026-11-16T00:00:00Z'))).toBe('2026-11-16')
    expect(weekKey(new Date('2026-11-22T23:59:59Z'))).toBe('2026-11-16')
    expect(weekKey(new Date('2026-11-23T06:00:00Z'))).toBe('2026-11-23')
    expect(weekKey(new Date('2027-01-01T12:00:00Z'))).toBe('2026-12-28')
  })
  it('a test email says it is a test and who the real one goes to', () => {
    const m = buildDigest({ firstName: 'Wale', organisationName: 'Testbüroo OÜ', projects: [project()], test: true, scope: 'the projects you can see' })!
    expect(m.subject.startsWith('[Test] ')).toBe(true)
    expect(m.text).toContain('on the projects you can see at Testbüroo OÜ')
    expect(m.text).toContain('This is a test you sent to yourself')
  })
  it('a person gets it unless they switched its email off', () => {
    expect(wantsDigest(null)).toBe(true)
    expect(wantsDigest({})).toBe(true)
    expect(wantsDigest({ 'risk.digest': { inApp: false } })).toBe(true)
    expect(wantsDigest({ 'risk.digest': { email: false } })).toBe(false)
    expect(wantsDigest({ 'task.assigned': { email: false } })).toBe(true)
  })
})

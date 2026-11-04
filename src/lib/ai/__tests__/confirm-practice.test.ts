import { describe, it, expect, vi, beforeEach } from 'vitest'

/** Sprint 3.A — "Switch on Coordin": practice-setup confirm. */

type Row = Record<string, any>
const db = { runs: [] as Row[], orgs: [] as Row[], features: [] as Row[], profiles: [] as Row[], practiceProfiles: [] as Row[] }
const audit = vi.fn().mockResolvedValue(undefined)
const invalidate = vi.fn().mockResolvedValue(undefined)

const tx = {
  organisationFeature: {
    upsert: vi.fn(async ({ where, update, create }: Row) => {
      const k = where.organisationId_featureKey
      const ex = db.features.find((f) => f.organisationId === k.organisationId && f.featureKey === k.featureKey)
      if (ex) { Object.assign(ex, update); return ex }
      const row = { id: `f${db.features.length + 1}`, ...create }; db.features.push(row); return row
    }),
  },
  practiceProfile: {
    findFirst: vi.fn(async ({ where }: Row) => db.practiceProfiles.filter((p) => p.organisationId === where.organisationId).sort((a, b) => b.version - a.version)[0] ?? null),
    create: vi.fn(async ({ data }: Row) => { const r = { id: `pp${db.practiceProfiles.length + 1}`, ...data }; db.practiceProfiles.push(r); return r }),
  },
  aIRun: {
    update: vi.fn(async ({ where, data }: Row) => { const r = db.runs.find((x) => x.id === where.id)!; Object.assign(r, data); return r }),
  },
}

vi.mock('@/lib/prisma', () => ({
  prisma: {
    aIRun: { findUnique: vi.fn(async ({ where }: Row) => db.runs.find((r) => r.id === where.id) ?? null) },
    organisation: { findUnique: vi.fn(async ({ where }: Row) => db.orgs.find((o) => o.id === where.id) ?? null) },
    profile: { findFirst: vi.fn(async ({ where }: Row) => db.profiles.find((p) => p.authUserId === where.authUserId) ?? null) },
    $transaction: vi.fn(async (fn: (t: unknown) => Promise<unknown>) => fn(tx)),
  },
}))
vi.mock('@/lib/feature-flags', () => ({ invalidateFeatureCache: (...a: unknown[]) => invalidate(...a) }))
vi.mock('@/lib/audit', () => ({ recordAuditEvent: (...a: unknown[]) => audit(...a), AuditActions: { AI_PRACTICE_CONFIGURED: 'ai.practice_configured' } }))

const { confirmPracticeSetup, resolveDecisions, MODULE_KEY_ALIAS } = await import('@/lib/ai/confirm-practice')

const MODULES = [
  { key: 'projects', label: 'Projects', on: true, reason: '12 projects on the site' },
  { key: 'compliance', label: 'Compliance', on: true, reason: 'Estonian practice' },
  { key: 'timesheets', label: 'Timesheets', on: false, reason: 'Under 5 people' },
  { key: 'expenses', label: 'Expenses', on: true, reason: 'Travel to sites' },
  { key: 'cpd', label: 'CPD', on: true, reason: 'EAL members' },
  { key: 'heritage_conditions', label: 'Heritage', on: false, reason: 'No heritage work' },
]

function seedRun(over: Row = {}) {
  db.runs.push({ id: 'run-1', surface: 'PRACTICE_SETUP', status: 'AWAITING_CONFIRMATION', organisationId: null, promptVersion: 'v0.4', model: 'mistral-large-latest', output: { practice: { name: 'Salto' } }, mapping: { modules: MODULES }, ...over })
}

beforeEach(() => {
  db.runs = []; db.orgs = [{ id: 'org-1' }, { id: 'org-2' }]; db.features = []; db.practiceProfiles = []
  db.profiles = [{ id: 'prof-1', authUserId: 'auth-1' }]
  audit.mockClear(); invalidate.mockClear()
})

describe('resolveDecisions (pure)', () => {
  it('keeps AI decisions, maps aliases, marks unknown keys as not applied', () => {
    const d = resolveDecisions(MODULES)
    expect(d.find((x) => x.key === 'projects')).toMatchObject({ featureKey: 'projects', on: true, source: 'ai', applied: true })
    expect(d.find((x) => x.key === 'expenses')).toMatchObject({ featureKey: MODULE_KEY_ALIAS.expenses, applied: true })
    expect(d.find((x) => x.key === 'cpd')).toMatchObject({ featureKey: null, applied: false })
    expect(d.find((x) => x.key === 'heritage_conditions')).toMatchObject({ featureKey: null, applied: false })
  })
  it('architect overrides win and are marked as such', () => {
    const d = resolveDecisions(MODULES, { timesheets: true, projects: false })
    expect(d.find((x) => x.key === 'timesheets')).toMatchObject({ on: true, source: 'architect' })
    expect(d.find((x) => x.key === 'projects')).toMatchObject({ on: false, source: 'architect' })
  })
  it('overrides for keys the mapper never mentioned are added if they exist in the registry', () => {
    const d = resolveDecisions(MODULES, { invoicing: true, nonsense: true })
    expect(d.find((x) => x.key === 'invoicing')).toMatchObject({ featureKey: 'invoicing', on: true, source: 'architect', applied: true })
    expect(d.find((x) => x.key === 'nonsense')).toBeUndefined()
  })
  it('de-duplicates repeated mapper keys', () => {
    expect(resolveDecisions([...MODULES, MODULES[0]])).toHaveLength(MODULES.length)
  })
})

describe('confirmPracticeSetup', () => {
  it('applies flags, writes practice profile v1, marks run APPLIED, invalidates cache, audits every decision', async () => {
    seedRun()
    const r = await confirmPracticeSetup({ runId: 'run-1', organisationId: 'org-1', actorAuthUserId: 'auth-1' })
    expect(r.appliedCount).toBe(4)
    expect(r.skippedKeys).toEqual(['cpd', 'heritage_conditions'])
    expect(r.profileVersion).toBe(1)
    const on = db.features.filter((f) => f.enabled).map((f) => f.featureKey).sort()
    expect(on).toEqual(['compliance', 'projects', 'spend_management'])
    expect(db.features.find((f) => f.featureKey === 'timesheets')).toMatchObject({ enabled: false, enabledBy: null })
    expect(db.features.find((f) => f.featureKey === 'projects')).toMatchObject({ enabledBy: 'prof-1' })
    expect(db.runs[0]).toMatchObject({ status: 'APPLIED', organisationId: 'org-1', confirmedBy: 'auth-1' })
    expect(db.runs[0].appliedAt).toBeInstanceOf(Date)
    expect(db.practiceProfiles[0]).toMatchObject({ organisationId: 'org-1', version: 1, sourceRunId: 'run-1', createdBy: 'prof-1' })
    expect(invalidate).toHaveBeenCalledWith('org-1')
    const meta = audit.mock.calls[0][0].metadata
    expect(audit.mock.calls[0][0].action).toBe('ai.practice_configured')
    expect(meta.runId).toBe('run-1')
    expect(meta.decisions).toHaveLength(MODULES.length)
    expect(meta.decisions.every((d: Row) => typeof d.reason === 'string')).toBe(true)
  })

  it('overrides flip flags and are recorded as architect decisions', async () => {
    seedRun()
    await confirmPracticeSetup({ runId: 'run-1', organisationId: 'org-1', overrides: { timesheets: true }, actorAuthUserId: 'auth-1' })
    expect(db.features.find((f) => f.featureKey === 'timesheets')).toMatchObject({ enabled: true })
    const meta = audit.mock.calls[0][0].metadata
    expect(meta.overriddenKeys).toEqual(['timesheets'])
    expect(meta.decisions.find((d: Row) => d.key === 'timesheets').source).toBe('architect')
  })

  it('second confirmation for the same org bumps the practice profile version and updates existing flags in place', async () => {
    seedRun()
    await confirmPracticeSetup({ runId: 'run-1', organisationId: 'org-1', actorAuthUserId: 'auth-1' })
    db.runs.push({ ...db.runs[0], id: 'run-2', status: 'AWAITING_CONFIRMATION', organisationId: null })
    const r = await confirmPracticeSetup({ runId: 'run-2', organisationId: 'org-1', overrides: { projects: false }, actorAuthUserId: 'auth-1' })
    expect(r.profileVersion).toBe(2)
    expect(db.features.filter((f) => f.featureKey === 'projects')).toHaveLength(1)
    expect(db.features.find((f) => f.featureKey === 'projects')!.enabled).toBe(false)
  })

  it('refuses a run that is not awaiting confirmation', async () => {
    seedRun({ status: 'APPLIED' })
    await expect(confirmPracticeSetup({ runId: 'run-1', organisationId: 'org-1', actorAuthUserId: 'auth-1' })).rejects.toThrow(/applied/)
    expect(db.features).toHaveLength(0)
  })

  it('refuses to apply a run scoped to another organisation', async () => {
    seedRun({ organisationId: 'org-2' })
    await expect(confirmPracticeSetup({ runId: 'run-1', organisationId: 'org-1', actorAuthUserId: 'auth-1' })).rejects.toThrow(/different organisation/)
  })

  it('refuses unknown run, unknown org, and runs without decisions', async () => {
    await expect(confirmPracticeSetup({ runId: 'nope', organisationId: 'org-1', actorAuthUserId: 'auth-1' })).rejects.toThrow(/not found/)
    seedRun()
    await expect(confirmPracticeSetup({ runId: 'run-1', organisationId: 'org-x', actorAuthUserId: 'auth-1' })).rejects.toThrow(/Organisation not found/)
    db.runs[0].mapping = { modules: [] }
    await expect(confirmPracticeSetup({ runId: 'run-1', organisationId: 'org-1', actorAuthUserId: 'auth-1' })).rejects.toThrow(/no module decisions/)
  })

  it('works when the actor has no profile (platform admin outside any org)', async () => {
    seedRun(); db.profiles = []
    const r = await confirmPracticeSetup({ runId: 'run-1', organisationId: 'org-1', actorAuthUserId: 'auth-9' })
    expect(r.appliedCount).toBe(4)
    expect(db.features.find((f) => f.featureKey === 'projects')!.enabledBy).toBeNull()
    expect(db.practiceProfiles[0].createdBy).toBe('auth-9')
  })
})

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { buildStages, gateDecisionProblems, statusForDecision, stageProgress, ACCOR_OVERLAY } from '@/lib/delivery/frameworks'
import { CWA_GATES } from '@/lib/delivery/cwa-gates'

describe('delivery frameworks — catalogue', () => {
  it('CWA has G0–G10 straight from the guide, each with drawings, reports and exit criteria', () => {
    expect(CWA_GATES.map((g) => g.code)).toEqual(['G0', 'G1', 'G2', 'G3', 'G4', 'G5', 'G6', 'G7', 'G8', 'G9', 'G10'])
    for (const g of CWA_GATES) {
      for (const k of ['DRAWING', 'REPORT', 'EXIT_CRITERION']) expect(g.items.some((i) => i.kind === k)).toBe(true)
      expect(g.purpose).toBeTruthy()
    }
    expect(CWA_GATES[0].items.find((i) => i.kind === 'EXIT_CRITERION')!.title).toBe('Site is sufficiently understood to proceed')
  })
  it('CWA build adds the six-step approval chain to every gate; Accor only when asked', () => {
    const plain = buildStages('CWA')
    expect(plain.every((s) => s.items.filter((i) => i.kind === 'APPROVAL').length === 6)).toBe(true)
    expect(plain.some((s) => s.items.some((i) => i.kind === 'ACCOR'))).toBe(false)
    const hotel = buildStages('CWA', { accorOverlay: true })
    const accor = hotel.flatMap((s) => s.items.filter((i) => i.kind === 'ACCOR').map(() => s.code))
    expect(accor).toEqual(Object.keys(ACCOR_OVERLAY))
  })
  it('RIBA gives stages 0–7 with tasks; custom requires names and caps at 30', () => {
    const riba = buildStages('RIBA')
    expect(riba.map((s) => s.code)).toEqual(['0', '1', '2', '3', '4', '5', '6', '7'])
    expect(riba[2].items.length).toBeGreaterThan(0)
    expect(() => buildStages('CUSTOM', { customStages: [] })).toThrow(/at least one/)
    expect(() => buildStages('CUSTOM', { customStages: Array.from({ length: 31 }, (_, i) => ({ name: `S${i}` })) })).toThrow(/30/)
    expect(buildStages('CUSTOM', { customStages: [{ name: ' Design ' }, { name: '' }, { name: 'Build' }] }).map((s) => s.name)).toEqual(['Design', 'Build'])
  })
  it('building is a snapshot — changing the result never mutates the catalogue', () => {
    const built = buildStages('CWA')
    built[0].items.push({ kind: 'DELIVERABLE', title: 'x' })
    built[0].name = 'changed'
    expect(CWA_GATES[0].name).toBe('Brief & Feasibility')
    expect(CWA_GATES[0].items.some((i) => i.title === 'x')).toBe(false)
  })
})

describe('delivery frameworks — gate rules (guide p.9)', () => {
  const items = (exitOpen: number, leadDone: boolean) => [
    ...Array.from({ length: 2 }, (_, i) => ({ kind: 'EXIT_CRITERION', status: i < exitOpen ? 'OPEN' : 'DONE', title: `e${i}` })),
    { kind: 'APPROVAL', status: leadDone ? 'DONE' : 'OPEN', title: '5. CWA Design Lead approval' },
  ]
  it('PASS needs all exit criteria resolved and Design Lead approval (CWA)', () => {
    expect(gateDecisionProblems('CWA', items(1, true), 'PASS', {})).toHaveLength(1)
    expect(gateDecisionProblems('CWA', items(0, false), 'PASS', {})[0]).toMatch(/Design Lead/)
    expect(gateDecisionProblems('CWA', items(0, true), 'PASS', {})).toEqual([])
    expect(gateDecisionProblems('RIBA', items(0, false), 'PASS', {})).toEqual([])
  })
  it('CONDITIONAL_PASS needs open items, each with owner and date', () => {
    expect(gateDecisionProblems('CWA', items(0, true), 'CONDITIONAL_PASS', {})[0]).toMatch(/open-item list/)
    expect(gateDecisionProblems('CWA', items(1, true), 'CONDITIONAL_PASS', { openItems: [{ title: 'Fire strategy sign-off' }] })[0]).toMatch(/owner and a due date/)
    expect(gateDecisionProblems('CWA', items(1, true), 'CONDITIONAL_PASS', { openItems: [{ title: 'Fire strategy sign-off', assigneeId: 'p1', dueDate: '2026-12-01' }] })).toEqual([])
  })
  it('HOLD needs a reason', () => {
    expect(gateDecisionProblems('CWA', [], 'HOLD', {})).toHaveLength(1)
    expect(gateDecisionProblems('CWA', [], 'HOLD', { notes: 'Operator rejection' })).toEqual([])
  })
  it('maps decisions to stage status and computes progress', () => {
    expect(statusForDecision('CONDITIONAL_PASS')).toBe('CONDITIONAL')
    expect(stageProgress([{ status: 'DONE' }, { status: 'NOT_APPLICABLE' }, { status: 'OPEN' }, { status: 'OPEN' }])).toEqual({ total: 4, resolved: 2, pct: 50 })
  })
})

// ── Service (persistence rules) ─────────────────────────────
const db = vi.hoisted(() => {
  const m = () => ({ findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), createMany: vi.fn(), update: vi.fn(), updateMany: vi.fn(), deleteMany: vi.fn() })
  const prisma: any = { project: m(), deliveryStage: m(), deliveryStageItem: m(), projectMembership: { findUnique: vi.fn().mockResolvedValue({ removedAt: null }) } }
  prisma.$transaction = vi.fn(async (fn: any) => fn(prisma))
  return prisma
})
vi.mock('@/lib/prisma', () => ({ prisma: db }))
vi.mock('@/lib/audit', () => ({ recordAuditEvent: vi.fn().mockResolvedValue(undefined) }))
import { applyFramework, decideGate, updateItem } from '@/lib/delivery/service'

describe('delivery service', () => {
  const actor = { organisationId: 'org-1', id: 'lead-1' }
  beforeEach(() => {
    vi.clearAllMocks()
    db.$transaction.mockImplementation(async (fn: any) => fn(db))
    db.project.findUnique.mockResolvedValue({ deliveryFramework: 'CWA', accorOverlay: false, projectType: 'HOTEL' })
    db.deliveryStage.findMany.mockResolvedValue([])
    db.deliveryStage.create.mockImplementation(async ({ data }: any) => ({ id: `st-${data.code}`, ...data }))
    db.deliveryStage.updateMany.mockResolvedValue({ count: 1 })
  })

  it('applies CWA: 11 stages, items snapshotted with the template version', async () => {
    await applyFramework({ projectId: 'p1', organisationId: 'org-1', actorId: 'lead-1', framework: 'CWA', accorOverlay: true })
    expect(db.deliveryStage.create).toHaveBeenCalledTimes(11)
    expect(db.deliveryStage.create.mock.calls[0][0].data).toMatchObject({ framework: 'CWA', templateVersion: 'CWA-G-RevA', code: 'G0' })
    expect(db.project.update.mock.calls[0][0].data).toEqual({ deliveryFramework: 'CWA', accorOverlay: true })
  })

  it('refuses to replace stages once evidence or decisions exist', async () => {
    db.deliveryStage.findMany.mockResolvedValue([{ id: 's', decision: null, items: [{ id: 'done' }] }])
    await expect(applyFramework({ projectId: 'p1', organisationId: 'org-1', actorId: 'x', framework: 'RIBA' })).rejects.toThrow(/can no longer be replaced/)
    expect(db.deliveryStage.deleteMany).not.toHaveBeenCalled()
  })

  it('conditional pass on G2 creates owned open items and freezes the design baseline', async () => {
    db.deliveryStage.findUnique.mockResolvedValueOnce({ id: 'st', projectId: 'p1', framework: 'CWA', code: 'G2', decision: null,
      items: [{ kind: 'EXIT_CRITERION', status: 'OPEN', title: 'x' }, { kind: 'APPROVAL', status: 'DONE', title: '5. CWA Design Lead approval' }] })
    db.deliveryStage.findUnique.mockResolvedValueOnce({ id: 'st', items: [] })
    await decideGate('p1', 'st', { decision: 'CONDITIONAL_PASS', openItems: [{ title: 'Facade comment closure', assigneeId: 'u1', dueDate: '2026-12-01' }] }, actor)
    const upd = db.deliveryStage.updateMany.mock.calls[0][0]
    expect(upd.data).toMatchObject({ decision: 'CONDITIONAL_PASS', status: 'CONDITIONAL', designFreeze: true })
    expect(db.deliveryStageItem.createMany.mock.calls[0][0].data[0]).toMatchObject({ isOpenItem: true, assigneeId: 'u1', title: 'Open item: Facade comment closure' })
  })

  it('a gate in another project is not found; a passed gate cannot be re-decided', async () => {
    db.deliveryStage.findUnique.mockResolvedValueOnce({ id: 'st', projectId: 'other', items: [] })
    await expect(decideGate('p1', 'st', { decision: 'HOLD', notes: 'x' }, actor)).rejects.toThrow(/not found/)
    db.deliveryStage.findUnique.mockResolvedValueOnce({ id: 'st', projectId: 'p1', framework: 'CWA', code: 'G3', decision: 'PASS', items: [] })
    await expect(decideGate('p1', 'st', { decision: 'HOLD', notes: 'x' }, actor)).rejects.toThrow(/already been passed/)
  })

  it('approval steps can only be ticked by design lead or above', async () => {
    db.deliveryStageItem.findUnique.mockResolvedValue({ id: 'i', kind: 'APPROVAL', stage: { projectId: 'p1', designFreeze: false, code: 'G1' } })
    await expect(updateItem('p1', 'i', { status: 'DONE' }, { ...actor, canApprove: false })).rejects.toThrow(/design lead/)
    db.deliveryStageItem.update.mockResolvedValue({})
    await updateItem('p1', 'i', { status: 'DONE' }, { ...actor, canApprove: true })
    expect(db.deliveryStageItem.update.mock.calls[0][0].data).toMatchObject({ status: 'DONE', completedById: 'lead-1' })
  })

  it('evidence links must be http(s)', async () => {
    db.deliveryStageItem.findUnique.mockResolvedValue({ id: 'i', kind: 'DRAWING', stage: { projectId: 'p1', designFreeze: false, code: 'G1' } })
    await expect(updateItem('p1', 'i', { documentUrl: 'javascript:alert(1)' }, { ...actor, canApprove: false })).rejects.toThrow(/http/)
  })
})

describe('Estonian design stages (EVS 932)', () => {
  it('builds six stages with permit steps and no CWA approval chain or Accor items', async () => {
    const { buildStages } = await import('@/lib/delivery/frameworks')
    const s = buildStages('EVS', { accorOverlay: true })
    expect(s.map((x) => x.code)).toEqual(['E1', 'E2', 'E3', 'E4', 'E5', 'E6'])
    expect(s[1].items.some((i) => /building permit application/i.test(i.title))).toBe(true)
    expect(s[5].items.some((i) => /kasutusluba/i.test(i.title))).toBe(true)
    expect(s.flatMap((x) => x.items).some((i) => i.kind === 'APPROVAL' || i.kind === 'ACCOR')).toBe(false)
  })
})

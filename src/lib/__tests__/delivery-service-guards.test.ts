import { describe, it, expect, beforeEach, vi } from 'vitest'

const ctx = vi.hoisted(() => {
  const m = () => ({ findMany: vi.fn().mockResolvedValue([]), findUnique: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue({ id: 'new' }), createMany: vi.fn(), update: vi.fn().mockResolvedValue({}), updateMany: vi.fn().mockResolvedValue({ count: 1 }), deleteMany: vi.fn().mockResolvedValue({ count: 0 }) })
  const prisma: any = { deliveryStage: m(), deliveryStageItem: m(), projectMembership: m(), project: m() }
  prisma.$transaction = vi.fn(async (fn: any) => fn(prisma))
  return { prisma }
})
vi.mock('@/lib/prisma', () => ({ prisma: ctx.prisma }))
vi.mock('@/lib/audit', () => ({ recordAuditEvent: vi.fn().mockResolvedValue(undefined) }))
import { addItem, updateItem, applyFramework } from '@/lib/delivery/service'

const P = ctx.prisma
const actor = { organisationId: 'org-1', id: 'u1' }

describe('delivery service guards (QA 19–21)', () => {
  beforeEach(() => { vi.clearAllMocks(); P.$transaction.mockImplementation(async (fn: any) => fn(P)) })

  it('a passed gate\'s checklist can no longer change; its open items can', async () => {
    P.deliveryStageItem.findUnique.mockResolvedValue({ id: 'i1', kind: 'DRAWING', isOpenItem: false, stage: { projectId: 'p1', code: 'G2', designFreeze: true, decision: 'PASS' } })
    await expect(updateItem('p1', 'i1', { status: 'OPEN' }, { ...actor, canApprove: true })).rejects.toThrow(/G2 has been passed and the design is frozen/)
    P.deliveryStageItem.findUnique.mockResolvedValue({ id: 'i2', kind: 'DELIVERABLE', isOpenItem: true, stage: { projectId: 'p1', code: 'G2', designFreeze: true, decision: 'CONDITIONAL_PASS' } })
    await expect(updateItem('p1', 'i2', { status: 'DONE' }, { ...actor, canApprove: false })).resolves.toBeTruthy()
  })

  it('no new items on a passed gate', async () => {
    P.deliveryStage.findUnique.mockResolvedValue({ id: 's1', projectId: 'p1', code: 'G3', decision: 'PASS', items: [] })
    await expect(addItem('p1', { stageId: 's1', title: 'Late drawing' }, actor)).rejects.toThrow(/G3 has been passed/)
  })

  it('assignees must be project members; bad dates are a 400', async () => {
    P.deliveryStage.findUnique.mockResolvedValue({ id: 's1', projectId: 'p1', code: 'G3', decision: null, items: [] })
    P.projectMembership.findUnique.mockResolvedValue(null)
    await expect(addItem('p1', { stageId: 's1', title: 'X', assigneeId: 'stranger' }, actor)).rejects.toThrow(/member of this project/)
    P.projectMembership.findUnique.mockResolvedValue({ removedAt: null })
    await expect(addItem('p1', { stageId: 's1', title: 'X', assigneeId: 'm1', dueDate: 'not-a-date' }, actor)).rejects.toThrow(/not a valid date/)
    await expect(addItem('p1', { stageId: 's1', title: 'X', assigneeId: 'm1', dueDate: '2026-12-01' }, actor)).resolves.toBeTruthy()
  })

  it('re-applying a framework checks for decisions inside the transaction and refuses if one appears', async () => {
    P.deliveryStage.findMany.mockResolvedValue([{ id: 's1', decision: null, items: [] }, { id: 's2', decision: null, items: [] }])
    P.deliveryStage.deleteMany.mockResolvedValue({ count: 1 }) // one stage got a decision in between
    await expect(applyFramework({ projectId: 'p1', organisationId: 'org-1', actorId: 'u1', framework: 'RIBA' })).rejects.toThrow(/decision was just recorded/)
    expect(P.deliveryStage.deleteMany.mock.calls[0][0].where).toEqual({ projectId: 'p1', decision: null })
  })
})

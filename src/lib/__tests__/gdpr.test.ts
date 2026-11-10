import { describe, it, expect, vi, beforeEach } from 'vitest'

const tx = {
  profile: { update: vi.fn() },
  employeeProfile: { updateMany: vi.fn() },
  leaveRequest: { updateMany: vi.fn() },
  notification: { updateMany: vi.fn() },
  confidentialEmployeeData: { updateMany: vi.fn() },
  auditEvent: { create: vi.fn() },
}
const findFirst = vi.fn()
vi.mock('@/lib/prisma', () => ({
  prisma: {
    profile: { findFirst: (...a: unknown[]) => findFirst(...a), findMany: vi.fn().mockResolvedValue([]) },
    $transaction: (fn: (t: typeof tx) => unknown) => fn(tx),
  },
}))

import { anonymiseProfile, retentionDays } from '@/lib/gdpr'

const DAY = 86_400_000
const base = { id: 'prof_abc123', status: 'DEACTIVATED', email: 'ada@firm.ee', orgPermission: 'MEMBER' }

describe('anonymiseProfile', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('refuses someone still active', async () => {
    findFirst.mockResolvedValue({ ...base, status: 'ACTIVE', deactivatedAt: null })
    await expect(anonymiseProfile({ profileId: 'p', organisationId: 'o', actorId: 'a', reason: 'erasure_request' })).rejects.toThrow(/Deactivate/)
  })

  it('refuses retention before the period has passed', async () => {
    findFirst.mockResolvedValue({ ...base, deactivatedAt: new Date(Date.now() - 10 * DAY) })
    await expect(anonymiseProfile({ profileId: 'p', organisationId: 'o', actorId: 'a', reason: 'retention' })).rejects.toThrow(/retention period/)
  })

  it('anonymises after retention, clears bank and salary, and audits in the same transaction', async () => {
    findFirst.mockResolvedValue({ ...base, deactivatedAt: new Date(Date.now() - (retentionDays() + 1) * DAY) })
    await anonymiseProfile({ profileId: 'p', organisationId: 'o', actorId: 'a', reason: 'retention' })
    const upd = tx.profile.update.mock.calls[0][0].data
    expect(upd.fullName).toBe('Former employee abc123')
    expect(upd.email).toMatch(/@anonymised\.invalid$/)
    expect(upd.authUserId).toBeNull()
    expect(tx.confidentialEmployeeData.updateMany.mock.calls[0][0].data.bankAccountNumber).toBeNull()
    expect(tx.employeeProfile.updateMany.mock.calls[0][0].data.salary).toBeNull()
    expect(tx.auditEvent.create).toHaveBeenCalledOnce()
  })

  it('never anonymises an owner or an already-anonymised record', async () => {
    findFirst.mockResolvedValue({ ...base, orgPermission: 'OWNER', deactivatedAt: new Date(0) })
    await expect(anonymiseProfile({ profileId: 'p', organisationId: 'o', actorId: 'a', reason: 'erasure_request' })).rejects.toThrow(/owner/)
    findFirst.mockResolvedValue({ ...base, email: 'removed+x@anonymised.invalid', deactivatedAt: new Date(0) })
    await expect(anonymiseProfile({ profileId: 'p', organisationId: 'o', actorId: 'a', reason: 'erasure_request' })).rejects.toThrow(/already/)
  })
})

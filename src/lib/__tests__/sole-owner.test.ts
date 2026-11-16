import { describe, it, expect, vi } from 'vitest'
vi.mock('@/lib/prisma', () => ({ prisma: {} }))
vi.mock('@/lib/audit', () => ({ recordAuditEvent: vi.fn() }))
import { isSoleOwner } from '@/lib/sole-owner'

const db = (n: number | Error) => ({ profile: { count: vi.fn(async (_args: { where: Record<string, unknown> }) => { if (n instanceof Error) throw n; return n }) } })
const owner = { id: 'me', organisationId: 'org', orgPermission: 'OWNER', managerId: null }

describe('isSoleOwner', () => {
  it('is true only for an owner with nobody else who could approve', async () => {
    expect(await isSoleOwner(owner, db(0))).toBe(true)
    expect(await isSoleOwner(owner, db(1))).toBe(false)
  })
  it('never applies to admins, HR or anyone else', async () => {
    for (const role of ['ADMIN', 'HR', 'FINANCE', 'MANAGER', 'MEMBER']) {
      const d = db(0)
      expect(await isSoleOwner({ ...owner, orgPermission: role }, d)).toBe(false)
      expect(d.profile.count).not.toHaveBeenCalled()
    }
  })
  it('counts other active owners/admins and the line manager, in this firm only', async () => {
    const d = db(0)
    await isSoleOwner({ ...owner, managerId: 'boss' }, d)
    const where = d.profile.count.mock.calls[0][0].where
    expect(where.organisationId).toBe('org')
    expect(where.id).toEqual({ not: 'me' })
    expect(where.status).toBe('ACTIVE')
    expect(where.OR).toEqual([{ orgPermission: { in: ['OWNER', 'ADMIN'] } }, { id: 'boss' }])
  })
  it('says no if the lookup fails', async () => {
    expect(await isSoleOwner(owner, db(new Error('db down')))).toBe(false)
  })
})

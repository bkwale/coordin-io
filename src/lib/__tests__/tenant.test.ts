import { describe, it, expect, vi, beforeEach } from 'vitest'

const ctx = vi.hoisted(() => ({ profileFirst: vi.fn(), profileCount: vi.fn(), office: vi.fn(), role: vi.fn(), project: vi.fn() }))
vi.mock('@/lib/prisma', () => ({ prisma: {
  profile: { findFirst: ctx.profileFirst, count: ctx.profileCount },
  office: { findFirst: ctx.office }, corporateRole: { findFirst: ctx.role }, project: { findFirst: ctx.project },
} }))

import { assertOrgProfile, assertOrgProfiles, assertOrgOffice, assertNotSelf, assertCanGrant } from '../tenant'

beforeEach(() => { vi.clearAllMocks(); vi.spyOn(console, 'warn').mockImplementation(() => {}) })

describe('tenant guards', () => {
  it('refuses another firm\'s person as not found, scoped by organisation', async () => {
    ctx.profileFirst.mockResolvedValue(null)
    await expect(assertOrgProfile('p-other', 'org-1')).rejects.toThrow(/not found/)
    expect(ctx.profileFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'p-other', organisationId: 'org-1' } }))
    ctx.profileFirst.mockResolvedValue({ id: 'p1' })
    await expect(assertOrgProfile('p1', 'org-1')).resolves.toBeUndefined()
    await expect(assertOrgProfile(null, 'org-1')).resolves.toBeUndefined()
  })
  it('checks every id in a list', async () => {
    ctx.profileCount.mockResolvedValue(1)
    await expect(assertOrgProfiles(['a', 'b', 'a'], 'org-1')).rejects.toThrow()
    ctx.profileCount.mockResolvedValue(2)
    await expect(assertOrgProfiles(['a', 'b', 'a', null], 'org-1')).resolves.toBeUndefined()
  })
  it('checks offices', async () => {
    ctx.office.mockResolvedValue(null)
    await expect(assertOrgOffice('o1', 'org-1')).rejects.toThrow(/Office/)
  })
  it('blocks self-approval', () => {
    expect(() => assertNotSelf('p1', 'p1', 'approve your own leave for')).toThrow()
    expect(() => assertNotSelf('p1', 'p2', 'x')).not.toThrow()
  })
  it('caps what each role can grant', () => {
    expect(() => assertCanGrant('MANAGER', 'OWNER')).toThrow(/Owner/)
    expect(() => assertCanGrant('ADMIN', 'ADMIN')).toThrow()
    expect(() => assertCanGrant('HR', 'HR')).toThrow()
    expect(() => assertCanGrant('MANAGER', 'MEMBER')).not.toThrow()
    expect(() => assertCanGrant('MEMBER', 'MANAGER')).toThrow(/more access/)
    expect(() => assertCanGrant('OWNER', 'ADMIN')).not.toThrow()
    expect(() => assertCanGrant('ADMIN', 'BOGUS')).toThrow(/Invalid/)
  })
})

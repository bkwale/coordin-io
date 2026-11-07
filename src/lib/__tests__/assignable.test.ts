import { describe, it, expect, vi, beforeEach } from 'vitest'
const { findMany } = vi.hoisted(() => {
  const people = [
  { id: 'a', fullName: 'Ayo', status: 'ACTIVE', organisationId: 'org' },
  { id: 'm', fullName: 'Moyin', status: 'DEACTIVATED', organisationId: 'org' },
  { id: 'x', fullName: 'Other org', status: 'ACTIVE', organisationId: 'other' },
  ]
  return { findMany: vi.fn(async (args: any) => people.filter((p) => args.where.id.in.includes(p.id) && p.organisationId === args.where.organisationId)) }
})
vi.mock('@/lib/prisma', () => ({ prisma: { profile: { findMany } } }))
import { assertAssignable } from '../assignable'

describe('assertAssignable — leavers keep history but get no new work', () => {
  beforeEach(() => { findMany.mockClear() })
  it('allows active people and unassigning', async () => {
    await expect(assertAssignable('org', ['a', null, undefined])).resolves.toBeUndefined()
    await expect(assertAssignable('org', [null])).resolves.toBeUndefined()
    expect(findMany).toHaveBeenCalledTimes(1)
  })
  it('refuses a deactivated person by name', async () => {
    await expect(assertAssignable('org', ['m'])).rejects.toThrow(/Moyin has been deactivated/)
  })
  it('refuses someone from another organisation', async () => {
    await expect(assertAssignable('org', ['x'])).rejects.toThrow(/not in your organisation/)
  })
})

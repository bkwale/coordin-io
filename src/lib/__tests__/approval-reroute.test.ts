import { describe, it, expect, vi, beforeEach } from 'vitest'

const findFirst = vi.fn()
const findMany = vi.fn()
vi.mock('@/lib/prisma', () => ({ prisma: { profile: { findFirst: (...a: unknown[]) => findFirst(...a), findMany: (...a: unknown[]) => findMany(...a) } } }))

import { approverOtherThanSubmitter } from '@/lib/approval-engine'

const ctx = (over: Record<string, unknown> = {}) => ({ organisationId: 'org', submitterId: 'me', entityType: 'EXPENSE', entityId: 'e1', ...over }) as never

describe('approverOtherThanSubmitter', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('prefers the line manager', async () => {
    findFirst.mockResolvedValue({ id: 'boss' })
    expect(await approverOtherThanSubmitter(ctx({ submitterManagerId: 'boss' }))).toBe('boss')
  })

  it('falls back to the owner, then the longest-serving admin, never the submitter', async () => {
    findMany.mockResolvedValue([{ id: 'admin1', orgPermission: 'ADMIN' }, { id: 'owner', orgPermission: 'OWNER' }])
    expect(await approverOtherThanSubmitter(ctx())).toBe('owner')
    expect(findMany.mock.calls[0][0].where.id).toEqual({ not: 'me' })
    findMany.mockResolvedValue([{ id: 'admin1', orgPermission: 'ADMIN' }, { id: 'admin2', orgPermission: 'ADMIN' }])
    expect(await approverOtherThanSubmitter(ctx({ submitterManagerId: 'me' }))).toBe('admin1')
  })

  it('returns null when there is nobody else', async () => {
    findMany.mockResolvedValue([])
    expect(await approverOtherThanSubmitter(ctx())).toBeNull()
  })
})

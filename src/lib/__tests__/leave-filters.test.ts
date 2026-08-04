import { describe, it, expect } from 'vitest'
import { filterLeaveRequests } from '@/lib/leave-filters'

// Test data covering all statuses
const allRequests: Array<{ status: string }> = [
  { status: 'DRAFT' },
  { status: 'SUBMITTED' },
  { status: 'LINE_MANAGER_APPROVED' },
  { status: 'HR_APPROVED' },
  { status: 'APPROVED' },
  { status: 'REJECTED' },
  { status: 'CANCELLED' },
  { status: 'WITHDRAWN' },
]

describe('filterLeaveRequests', () => {
  it('ACTIVE filter excludes WITHDRAWN (Bug 8 case)', () => {
    const result = filterLeaveRequests(allRequests, 'ACTIVE')
    const statuses = result.map((r) => r.status)
    expect(statuses).not.toContain('WITHDRAWN')
  })

  it('ACTIVE filter excludes CANCELLED', () => {
    const result = filterLeaveRequests(allRequests, 'ACTIVE')
    const statuses = result.map((r) => r.status)
    expect(statuses).not.toContain('CANCELLED')
  })

  it('ACTIVE filter keeps DRAFT, SUBMITTED, APPROVED, REJECTED', () => {
    const result = filterLeaveRequests(allRequests, 'ACTIVE')
    const statuses = result.map((r) => r.status)
    expect(statuses).toContain('DRAFT')
    expect(statuses).toContain('SUBMITTED')
    expect(statuses).toContain('APPROVED')
    expect(statuses).toContain('REJECTED')
  })

  it('ALL filter returns everything including WITHDRAWN', () => {
    const result = filterLeaveRequests(allRequests, 'ALL')
    expect(result).toHaveLength(allRequests.length)
    expect(result.map((r) => r.status)).toContain('WITHDRAWN')
    expect(result.map((r) => r.status)).toContain('CANCELLED')
  })

  it('specific status filter returns only that status', () => {
    const result = filterLeaveRequests(allRequests, 'APPROVED')
    expect(result).toHaveLength(1)
    expect(result[0].status).toBe('APPROVED')
  })

  it('empty list returns empty for any filter', () => {
    expect(filterLeaveRequests([], 'ACTIVE')).toEqual([])
    expect(filterLeaveRequests([], 'ALL')).toEqual([])
    expect(filterLeaveRequests([], 'APPROVED')).toEqual([])
  })

  it('list with only WITHDRAWN and CANCELLED returns empty for ACTIVE', () => {
    const withdrawn: Array<{ status: string }> = [
      { status: 'WITHDRAWN' },
      { status: 'CANCELLED' },
    ]
    expect(filterLeaveRequests(withdrawn, 'ACTIVE')).toEqual([])
  })
})

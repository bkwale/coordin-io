import { describe, it, expect } from 'vitest'
import { validateLeaveTransition, getValidNextLeaveStatuses } from '@/lib/request-transitions'

describe('leave: withdrawing and cancelling', () => {
  it('lets a request be withdrawn at every stage before final approval', () => {
    for (const from of ['DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'LINE_MANAGER_APPROVED', 'HR_APPROVED'] as const) {
      expect(() => validateLeaveTransition(from, 'WITHDRAWN'), from).not.toThrow()
    }
  })
  it('approved leave is cancelled, not withdrawn', () => {
    expect(() => validateLeaveTransition('APPROVED', 'CANCELLED')).not.toThrow()
    expect(() => validateLeaveTransition('APPROVED', 'WITHDRAWN')).toThrow()
  })
  it('finished states stay finished', () => {
    for (const from of ['REJECTED', 'CANCELLED', 'WITHDRAWN'] as const) {
      expect(getValidNextLeaveStatuses(from)).toEqual([])
    }
  })
})

import { describe, it, expect } from 'vitest'
import {
  VALID_TRANSITIONS,
  LEAVE_TRANSITIONS,
  isValidRequestTransition,
  isValidLeaveTransition,
  validateRequestTransition,
  validateLeaveTransition,
  getValidNextRequestStatuses,
  getValidNextLeaveStatuses,
  isRequesterTransition,
  isApproverTransition,
  isAdminTransition,
  isTerminalRequestStatus,
  REQUEST_STATUS_LABELS,
  LEAVE_TYPE_LABELS,
} from '../request-transitions'

/* ── State machine structure ───────────────────────────── */

describe('Request status state machine', () => {
  it('has all 11 RequestStatus values', () => {
    const keys = Object.keys(VALID_TRANSITIONS)
    expect(keys).toHaveLength(11)
    expect(keys).toContain('DRAFT')
    expect(keys).toContain('SUBMITTED')
    expect(keys).toContain('UNDER_REVIEW')
    expect(keys).toContain('LINE_MANAGER_APPROVED')
    expect(keys).toContain('HR_APPROVED')
    expect(keys).toContain('APPROVED')
    expect(keys).toContain('REJECTED')
    expect(keys).toContain('FULFILMENT_IN_PROGRESS')
    expect(keys).toContain('COMPLETED')
    expect(keys).toContain('CANCELLED')
    expect(keys).toContain('WITHDRAWN')
  })

  it('DRAFT can go to SUBMITTED or WITHDRAWN', () => {
    expect(VALID_TRANSITIONS.DRAFT).toContain('SUBMITTED')
    expect(VALID_TRANSITIONS.DRAFT).toContain('WITHDRAWN')
    expect(VALID_TRANSITIONS.DRAFT).toHaveLength(2)
  })

  it('SUBMITTED can go to UNDER_REVIEW or WITHDRAWN', () => {
    expect(VALID_TRANSITIONS.SUBMITTED).toContain('UNDER_REVIEW')
    expect(VALID_TRANSITIONS.SUBMITTED).toContain('WITHDRAWN')
    expect(VALID_TRANSITIONS.SUBMITTED).toHaveLength(2)
  })

  it('UNDER_REVIEW can go to APPROVED or REJECTED', () => {
    expect(VALID_TRANSITIONS.UNDER_REVIEW).toContain('APPROVED')
    expect(VALID_TRANSITIONS.UNDER_REVIEW).toContain('REJECTED')
    expect(VALID_TRANSITIONS.UNDER_REVIEW).toHaveLength(2)
  })

  it('LINE_MANAGER_APPROVED can go to HR_APPROVED or REJECTED', () => {
    expect(VALID_TRANSITIONS.LINE_MANAGER_APPROVED).toContain('HR_APPROVED')
    expect(VALID_TRANSITIONS.LINE_MANAGER_APPROVED).toContain('REJECTED')
    expect(VALID_TRANSITIONS.LINE_MANAGER_APPROVED).toHaveLength(2)
  })

  it('HR_APPROVED can go to APPROVED or REJECTED', () => {
    expect(VALID_TRANSITIONS.HR_APPROVED).toContain('APPROVED')
    expect(VALID_TRANSITIONS.HR_APPROVED).toContain('REJECTED')
    expect(VALID_TRANSITIONS.HR_APPROVED).toHaveLength(2)
  })

  it('APPROVED can go to FULFILMENT_IN_PROGRESS or CANCELLED', () => {
    expect(VALID_TRANSITIONS.APPROVED).toContain('FULFILMENT_IN_PROGRESS')
    expect(VALID_TRANSITIONS.APPROVED).toContain('CANCELLED')
    expect(VALID_TRANSITIONS.APPROVED).toHaveLength(2)
  })

  it('FULFILMENT_IN_PROGRESS can go to COMPLETED', () => {
    expect(VALID_TRANSITIONS.FULFILMENT_IN_PROGRESS).toEqual(['COMPLETED'])
  })

  it('terminal states have no transitions', () => {
    expect(VALID_TRANSITIONS.REJECTED).toEqual([])
    expect(VALID_TRANSITIONS.COMPLETED).toEqual([])
    expect(VALID_TRANSITIONS.CANCELLED).toEqual([])
    expect(VALID_TRANSITIONS.WITHDRAWN).toEqual([])
  })
})

/* ── Leave-specific state machine ─────────────────────── */

describe('Leave status state machine (PRD S20)', () => {
  it('has all 11 RequestStatus keys', () => {
    expect(Object.keys(LEAVE_TRANSITIONS)).toHaveLength(11)
  })

  it('SUBMITTED can go to LINE_MANAGER_APPROVED, UNDER_REVIEW, REJECTED, or WITHDRAWN', () => {
    expect(LEAVE_TRANSITIONS.SUBMITTED).toContain('LINE_MANAGER_APPROVED')
    expect(LEAVE_TRANSITIONS.SUBMITTED).toContain('UNDER_REVIEW')
    expect(LEAVE_TRANSITIONS.SUBMITTED).toContain('REJECTED')
    expect(LEAVE_TRANSITIONS.SUBMITTED).toContain('WITHDRAWN')
    expect(LEAVE_TRANSITIONS.SUBMITTED).toHaveLength(4)
  })

  it('LINE_MANAGER_APPROVED can go to HR_APPROVED or REJECTED', () => {
    expect(LEAVE_TRANSITIONS.LINE_MANAGER_APPROVED).toContain('HR_APPROVED')
    expect(LEAVE_TRANSITIONS.LINE_MANAGER_APPROVED).toContain('REJECTED')
  })

  it('HR_APPROVED can go to APPROVED or REJECTED', () => {
    expect(LEAVE_TRANSITIONS.HR_APPROVED).toContain('APPROVED')
    expect(LEAVE_TRANSITIONS.HR_APPROVED).toContain('REJECTED')
  })

  it('APPROVED can only go to CANCELLED', () => {
    expect(LEAVE_TRANSITIONS.APPROVED).toEqual(['CANCELLED'])
  })

  it('validates leave-specific transitions', () => {
    expect(isValidLeaveTransition('SUBMITTED', 'LINE_MANAGER_APPROVED')).toBe(true)
    expect(isValidLeaveTransition('LINE_MANAGER_APPROVED', 'HR_APPROVED')).toBe(true)
    expect(isValidLeaveTransition('HR_APPROVED', 'APPROVED')).toBe(true)
    // Cannot skip stages
    expect(isValidLeaveTransition('SUBMITTED', 'APPROVED')).toBe(false)
    expect(isValidLeaveTransition('SUBMITTED', 'HR_APPROVED')).toBe(false)
  })

  it('getValidNextLeaveStatuses returns correct leave transitions', () => {
    expect(getValidNextLeaveStatuses('SUBMITTED')).toEqual(['LINE_MANAGER_APPROVED', 'UNDER_REVIEW', 'REJECTED', 'WITHDRAWN'])
    expect(getValidNextLeaveStatuses('APPROVED')).toEqual(['CANCELLED'])
  })
})

/* ── isValidRequestTransition ──────────────────────────── */

describe('isValidRequestTransition', () => {
  it('accepts DRAFT → SUBMITTED', () => {
    expect(isValidRequestTransition('DRAFT', 'SUBMITTED')).toBe(true)
  })

  it('accepts DRAFT → WITHDRAWN', () => {
    expect(isValidRequestTransition('DRAFT', 'WITHDRAWN')).toBe(true)
  })

  it('rejects DRAFT → APPROVED (skip)', () => {
    expect(isValidRequestTransition('DRAFT', 'APPROVED')).toBe(false)
  })

  it('rejects self-transition', () => {
    expect(isValidRequestTransition('DRAFT', 'DRAFT')).toBe(false)
  })

  it('rejects reverse APPROVED → SUBMITTED', () => {
    expect(isValidRequestTransition('APPROVED', 'SUBMITTED')).toBe(false)
  })

  it('rejects transition from terminal state', () => {
    expect(isValidRequestTransition('COMPLETED', 'DRAFT')).toBe(false)
    expect(isValidRequestTransition('REJECTED', 'SUBMITTED')).toBe(false)
    expect(isValidRequestTransition('WITHDRAWN', 'DRAFT')).toBe(false)
    expect(isValidRequestTransition('CANCELLED', 'DRAFT')).toBe(false)
  })
})

/* ── validateRequestTransition ─────────────────────────── */

describe('validateRequestTransition', () => {
  it('does not throw for valid transitions', () => {
    expect(() => validateRequestTransition('DRAFT', 'SUBMITTED')).not.toThrow()
    expect(() => validateRequestTransition('SUBMITTED', 'UNDER_REVIEW')).not.toThrow()
    expect(() => validateRequestTransition('UNDER_REVIEW', 'APPROVED')).not.toThrow()
  })

  it('throws for invalid transition', () => {
    expect(() => validateRequestTransition('DRAFT', 'APPROVED')).toThrow(/Cannot transition/)
  })

  it('throws for self-transition with "already" message', () => {
    expect(() => validateRequestTransition('SUBMITTED', 'SUBMITTED')).toThrow(/already/)
  })

  it('includes valid transitions in error message', () => {
    try {
      validateRequestTransition('DRAFT', 'COMPLETED')
    } catch (err) {
      expect((err as Error).message).toContain('SUBMITTED')
      expect((err as Error).message).toContain('WITHDRAWN')
    }
  })

  it('says "terminal state" for transitions from terminal', () => {
    try {
      validateRequestTransition('COMPLETED', 'DRAFT')
    } catch (err) {
      expect((err as Error).message).toContain('terminal state')
    }
  })
})

/* ── validateLeaveTransition ──────────────────────────── */

describe('validateLeaveTransition', () => {
  it('does not throw for valid leave transitions', () => {
    expect(() => validateLeaveTransition('DRAFT', 'SUBMITTED')).not.toThrow()
    expect(() => validateLeaveTransition('SUBMITTED', 'LINE_MANAGER_APPROVED')).not.toThrow()
    expect(() => validateLeaveTransition('LINE_MANAGER_APPROVED', 'HR_APPROVED')).not.toThrow()
    expect(() => validateLeaveTransition('HR_APPROVED', 'APPROVED')).not.toThrow()
  })

  it('throws for skipping stages', () => {
    expect(() => validateLeaveTransition('SUBMITTED', 'APPROVED')).toThrow(/Cannot transition/)
  })

  it('throws for self-transition', () => {
    expect(() => validateLeaveTransition('SUBMITTED', 'SUBMITTED')).toThrow(/already/)
  })
})

/* ── getValidNextRequestStatuses ───────────────────────── */

describe('getValidNextRequestStatuses', () => {
  it('returns correct next statuses for each status', () => {
    expect(getValidNextRequestStatuses('DRAFT')).toEqual(['SUBMITTED', 'WITHDRAWN'])
    expect(getValidNextRequestStatuses('SUBMITTED')).toEqual(['UNDER_REVIEW', 'WITHDRAWN'])
    expect(getValidNextRequestStatuses('UNDER_REVIEW')).toEqual(['APPROVED', 'REJECTED'])
    expect(getValidNextRequestStatuses('APPROVED')).toEqual(['FULFILMENT_IN_PROGRESS', 'CANCELLED'])
    expect(getValidNextRequestStatuses('COMPLETED')).toEqual([])
  })
})

/* ── Role-based transition checks ──────────────────────── */

describe('role-based transition checks', () => {
  it('SUBMITTED and WITHDRAWN are requester transitions', () => {
    expect(isRequesterTransition('SUBMITTED')).toBe(true)
    expect(isRequesterTransition('WITHDRAWN')).toBe(true)
    expect(isRequesterTransition('APPROVED')).toBe(false)
  })

  it('UNDER_REVIEW, APPROVED, REJECTED, LINE_MANAGER_APPROVED, HR_APPROVED are approver transitions', () => {
    expect(isApproverTransition('UNDER_REVIEW')).toBe(true)
    expect(isApproverTransition('APPROVED')).toBe(true)
    expect(isApproverTransition('REJECTED')).toBe(true)
    expect(isApproverTransition('LINE_MANAGER_APPROVED')).toBe(true)
    expect(isApproverTransition('HR_APPROVED')).toBe(true)
    expect(isApproverTransition('SUBMITTED')).toBe(false)
  })

  it('FULFILMENT_IN_PROGRESS, COMPLETED, CANCELLED are admin transitions', () => {
    expect(isAdminTransition('FULFILMENT_IN_PROGRESS')).toBe(true)
    expect(isAdminTransition('COMPLETED')).toBe(true)
    expect(isAdminTransition('CANCELLED')).toBe(true)
    expect(isAdminTransition('APPROVED')).toBe(false)
  })
})

/* ── Terminal status ───────────────────────────────────── */

describe('isTerminalRequestStatus', () => {
  it('REJECTED, COMPLETED, CANCELLED, WITHDRAWN are terminal', () => {
    expect(isTerminalRequestStatus('REJECTED')).toBe(true)
    expect(isTerminalRequestStatus('COMPLETED')).toBe(true)
    expect(isTerminalRequestStatus('CANCELLED')).toBe(true)
    expect(isTerminalRequestStatus('WITHDRAWN')).toBe(true)
  })

  it('DRAFT, SUBMITTED, UNDER_REVIEW, APPROVED are not terminal', () => {
    expect(isTerminalRequestStatus('DRAFT')).toBe(false)
    expect(isTerminalRequestStatus('SUBMITTED')).toBe(false)
    expect(isTerminalRequestStatus('UNDER_REVIEW')).toBe(false)
    expect(isTerminalRequestStatus('APPROVED')).toBe(false)
  })
})

/* ── No self-transitions ───────────────────────────────── */

describe('no self-transitions', () => {
  it('no status lists itself as a valid next status (generic)', () => {
    for (const [status, nextStatuses] of Object.entries(VALID_TRANSITIONS)) {
      expect(nextStatuses).not.toContain(status)
    }
  })

  it('no status lists itself as a valid next status (leave)', () => {
    for (const [status, nextStatuses] of Object.entries(LEAVE_TRANSITIONS)) {
      expect(nextStatuses).not.toContain(status)
    }
  })
})

/* ── Reachability ──────────────────────────────────────── */

describe('reachability', () => {
  it('generic non-terminal statuses can reach COMPLETED eventually', () => {
    const nonTerminal = ['DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'FULFILMENT_IN_PROGRESS'] as const

    for (const start of nonTerminal) {
      const visited = new Set<string>()
      const queue: string[] = [start]

      while (queue.length > 0) {
        const current = queue.shift()!
        if (visited.has(current)) continue
        visited.add(current)
        const next = VALID_TRANSITIONS[current as keyof typeof VALID_TRANSITIONS] ?? []
        queue.push(...next)
      }

      expect(visited.has('COMPLETED')).toBe(true)
    }
  })

  it('leave workflow can reach APPROVED from DRAFT', () => {
    const visited = new Set<string>()
    const queue: string[] = ['DRAFT']

    while (queue.length > 0) {
      const current = queue.shift()!
      if (visited.has(current)) continue
      visited.add(current)
      const next = LEAVE_TRANSITIONS[current as keyof typeof LEAVE_TRANSITIONS] ?? []
      queue.push(...next)
    }

    expect(visited.has('APPROVED')).toBe(true)
    expect(visited.has('LINE_MANAGER_APPROVED')).toBe(true)
    expect(visited.has('HR_APPROVED')).toBe(true)
  })
})

/* ── Labels ────────────────────────────────────────────── */

describe('labels', () => {
  it('has labels for all 11 request statuses', () => {
    expect(Object.keys(REQUEST_STATUS_LABELS)).toHaveLength(11)
    expect(REQUEST_STATUS_LABELS.DRAFT).toBe('Draft')
    expect(REQUEST_STATUS_LABELS.APPROVED).toBe('Approved')
    expect(REQUEST_STATUS_LABELS.WITHDRAWN).toBe('Withdrawn')
    expect(REQUEST_STATUS_LABELS.LINE_MANAGER_APPROVED).toBe('Manager approved')
    expect(REQUEST_STATUS_LABELS.HR_APPROVED).toBe('HR approved')
    expect(REQUEST_STATUS_LABELS.CANCELLED).toBe('Cancelled')
  })

  it('has labels for all 13 leave types', () => {
    expect(Object.keys(LEAVE_TYPE_LABELS)).toHaveLength(13)
    expect(LEAVE_TYPE_LABELS.ANNUAL).toBe('Annual leave')
    expect(LEAVE_TYPE_LABELS.SICK).toBe('Sick leave')
    expect(LEAVE_TYPE_LABELS.COMPASSIONATE).toBe('Compassionate leave')
    expect(LEAVE_TYPE_LABELS.UNPAID).toBe('Unpaid leave')
    expect(LEAVE_TYPE_LABELS.PUBLIC_HOLIDAY).toBe('Public holiday')
    expect(LEAVE_TYPE_LABELS.PARENTAL).toBe('Parental leave')
    expect(LEAVE_TYPE_LABELS.MATERNITY).toBe('Maternity leave')
    expect(LEAVE_TYPE_LABELS.PATERNITY).toBe('Paternity leave')
    expect(LEAVE_TYPE_LABELS.STUDY).toBe('Study leave')
    expect(LEAVE_TYPE_LABELS.CPD_TRAINING).toBe('CPD / Training')
    expect(LEAVE_TYPE_LABELS.TOIL).toBe('TOIL')
    expect(LEAVE_TYPE_LABELS.BUSINESS_TRAVEL).toBe('Business travel')
    expect(LEAVE_TYPE_LABELS.OTHER).toBe('Other')
  })
})

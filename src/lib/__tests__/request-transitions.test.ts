import { describe, it, expect } from 'vitest'
import {
  VALID_TRANSITIONS,
  isValidRequestTransition,
  validateRequestTransition,
  getValidNextRequestStatuses,
  isRequesterTransition,
  isApproverTransition,
  isAdminTransition,
  isTerminalRequestStatus,
  REQUEST_STATUS_LABELS,
  LEAVE_TYPE_LABELS,
} from '../request-transitions'

/* ── State machine structure ───────────────────────────── */

describe('Request status state machine', () => {
  it('has all 8 RequestStatus values', () => {
    const keys = Object.keys(VALID_TRANSITIONS)
    expect(keys).toHaveLength(8)
    expect(keys).toContain('DRAFT')
    expect(keys).toContain('SUBMITTED')
    expect(keys).toContain('UNDER_REVIEW')
    expect(keys).toContain('APPROVED')
    expect(keys).toContain('REJECTED')
    expect(keys).toContain('FULFILMENT_IN_PROGRESS')
    expect(keys).toContain('COMPLETED')
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

  it('APPROVED can go to FULFILMENT_IN_PROGRESS', () => {
    expect(VALID_TRANSITIONS.APPROVED).toEqual(['FULFILMENT_IN_PROGRESS'])
  })

  it('FULFILMENT_IN_PROGRESS can go to COMPLETED', () => {
    expect(VALID_TRANSITIONS.FULFILMENT_IN_PROGRESS).toEqual(['COMPLETED'])
  })

  it('terminal states have no transitions', () => {
    expect(VALID_TRANSITIONS.REJECTED).toEqual([])
    expect(VALID_TRANSITIONS.COMPLETED).toEqual([])
    expect(VALID_TRANSITIONS.WITHDRAWN).toEqual([])
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

/* ── getValidNextRequestStatuses ───────────────────────── */

describe('getValidNextRequestStatuses', () => {
  it('returns correct next statuses for each status', () => {
    expect(getValidNextRequestStatuses('DRAFT')).toEqual(['SUBMITTED', 'WITHDRAWN'])
    expect(getValidNextRequestStatuses('SUBMITTED')).toEqual(['UNDER_REVIEW', 'WITHDRAWN'])
    expect(getValidNextRequestStatuses('UNDER_REVIEW')).toEqual(['APPROVED', 'REJECTED'])
    expect(getValidNextRequestStatuses('APPROVED')).toEqual(['FULFILMENT_IN_PROGRESS'])
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

  it('UNDER_REVIEW, APPROVED, REJECTED are approver transitions', () => {
    expect(isApproverTransition('UNDER_REVIEW')).toBe(true)
    expect(isApproverTransition('APPROVED')).toBe(true)
    expect(isApproverTransition('REJECTED')).toBe(true)
    expect(isApproverTransition('SUBMITTED')).toBe(false)
  })

  it('FULFILMENT_IN_PROGRESS and COMPLETED are admin transitions', () => {
    expect(isAdminTransition('FULFILMENT_IN_PROGRESS')).toBe(true)
    expect(isAdminTransition('COMPLETED')).toBe(true)
    expect(isAdminTransition('APPROVED')).toBe(false)
  })
})

/* ── Terminal status ───────────────────────────────────── */

describe('isTerminalRequestStatus', () => {
  it('REJECTED, COMPLETED, WITHDRAWN are terminal', () => {
    expect(isTerminalRequestStatus('REJECTED')).toBe(true)
    expect(isTerminalRequestStatus('COMPLETED')).toBe(true)
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
  it('no status lists itself as a valid next status', () => {
    for (const [status, nextStatuses] of Object.entries(VALID_TRANSITIONS)) {
      expect(nextStatuses).not.toContain(status)
    }
  })
})

/* ── Reachability ──────────────────────────────────────── */

describe('reachability', () => {
  it('every non-terminal status can reach COMPLETED eventually', () => {
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
})

/* ── Labels ────────────────────────────────────────────── */

describe('labels', () => {
  it('has labels for all 8 request statuses', () => {
    expect(Object.keys(REQUEST_STATUS_LABELS)).toHaveLength(8)
    expect(REQUEST_STATUS_LABELS.DRAFT).toBe('Draft')
    expect(REQUEST_STATUS_LABELS.APPROVED).toBe('Approved')
    expect(REQUEST_STATUS_LABELS.WITHDRAWN).toBe('Withdrawn')
  })

  it('has labels for all leave types', () => {
    expect(LEAVE_TYPE_LABELS.ANNUAL).toBe('Annual leave')
    expect(LEAVE_TYPE_LABELS.SICK).toBe('Sick leave')
    expect(LEAVE_TYPE_LABELS.COMPASSIONATE).toBe('Compassionate leave')
    expect(LEAVE_TYPE_LABELS.UNPAID).toBe('Unpaid leave')
    expect(LEAVE_TYPE_LABELS.PUBLIC_HOLIDAY).toBe('Public holiday')
  })
})

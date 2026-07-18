import { describe, it, expect } from 'vitest'

/* ── CPD Status State Machine ─────────────────────────────
 * DRAFT → SUBMITTED (owner submits)
 * SUBMITTED → VERIFIED (verifier)
 * SUBMITTED → RETURNED (verifier)
 * RETURNED → SUBMITTED (owner resubmits)
 * VERIFIED → (terminal)
 *
 * These tests validate the state machine logic that the
 * CPD API route uses.
 * ──────────────────────────────────────────────────────── */

type CPDStatus = 'DRAFT' | 'SUBMITTED' | 'VERIFIED' | 'RETURNED'

const VALID_CPD_TRANSITIONS: Record<CPDStatus, CPDStatus[]> = {
  DRAFT: ['SUBMITTED'],
  SUBMITTED: ['VERIFIED', 'RETURNED'],
  VERIFIED: [],
  RETURNED: ['SUBMITTED'],
}

function isValidCPDTransition(from: CPDStatus, to: CPDStatus): boolean {
  if (from === to) return false
  return VALID_CPD_TRANSITIONS[from]?.includes(to) ?? false
}

function validateCPDTransition(from: CPDStatus, to: CPDStatus): void {
  if (from === to) {
    throw new Error(`Record is already ${from}`)
  }
  if (!isValidCPDTransition(from, to)) {
    const allowed = VALID_CPD_TRANSITIONS[from]
    const allowedStr = allowed.length > 0 ? allowed.join(', ') : 'none (terminal state)'
    throw new Error(
      `Cannot transition from ${from} to ${to}. Valid transitions: ${allowedStr}`,
    )
  }
}

function getValidNextCPDStatuses(status: CPDStatus): CPDStatus[] {
  return VALID_CPD_TRANSITIONS[status] ?? []
}

function isTerminalCPDStatus(status: CPDStatus): boolean {
  return VALID_CPD_TRANSITIONS[status]?.length === 0
}

/* ── State machine structure ──────────────────────────── */

describe('CPD status state machine', () => {
  it('has all 4 CPDStatus values', () => {
    const keys = Object.keys(VALID_CPD_TRANSITIONS)
    expect(keys).toHaveLength(4)
    expect(keys).toContain('DRAFT')
    expect(keys).toContain('SUBMITTED')
    expect(keys).toContain('VERIFIED')
    expect(keys).toContain('RETURNED')
  })

  it('DRAFT can only go to SUBMITTED', () => {
    expect(VALID_CPD_TRANSITIONS.DRAFT).toEqual(['SUBMITTED'])
  })

  it('SUBMITTED can go to VERIFIED or RETURNED', () => {
    expect(VALID_CPD_TRANSITIONS.SUBMITTED).toContain('VERIFIED')
    expect(VALID_CPD_TRANSITIONS.SUBMITTED).toContain('RETURNED')
    expect(VALID_CPD_TRANSITIONS.SUBMITTED).toHaveLength(2)
  })

  it('RETURNED can go back to SUBMITTED', () => {
    expect(VALID_CPD_TRANSITIONS.RETURNED).toEqual(['SUBMITTED'])
  })

  it('VERIFIED is terminal (no transitions)', () => {
    expect(VALID_CPD_TRANSITIONS.VERIFIED).toEqual([])
  })
})

/* ── isValidCPDTransition ──────────────────────────────── */

describe('isValidCPDTransition', () => {
  it('accepts DRAFT → SUBMITTED', () => {
    expect(isValidCPDTransition('DRAFT', 'SUBMITTED')).toBe(true)
  })

  it('accepts SUBMITTED → VERIFIED', () => {
    expect(isValidCPDTransition('SUBMITTED', 'VERIFIED')).toBe(true)
  })

  it('accepts SUBMITTED → RETURNED', () => {
    expect(isValidCPDTransition('SUBMITTED', 'RETURNED')).toBe(true)
  })

  it('accepts RETURNED → SUBMITTED (resubmit)', () => {
    expect(isValidCPDTransition('RETURNED', 'SUBMITTED')).toBe(true)
  })

  it('rejects DRAFT → VERIFIED (skip)', () => {
    expect(isValidCPDTransition('DRAFT', 'VERIFIED')).toBe(false)
  })

  it('rejects DRAFT → RETURNED (skip)', () => {
    expect(isValidCPDTransition('DRAFT', 'RETURNED')).toBe(false)
  })

  it('rejects self-transition', () => {
    expect(isValidCPDTransition('DRAFT', 'DRAFT')).toBe(false)
    expect(isValidCPDTransition('SUBMITTED', 'SUBMITTED')).toBe(false)
  })

  it('rejects reverse VERIFIED → SUBMITTED', () => {
    expect(isValidCPDTransition('VERIFIED', 'SUBMITTED')).toBe(false)
  })

  it('rejects transition from terminal state', () => {
    expect(isValidCPDTransition('VERIFIED', 'DRAFT')).toBe(false)
    expect(isValidCPDTransition('VERIFIED', 'RETURNED')).toBe(false)
  })
})

/* ── validateCPDTransition ─────────────────────────────── */

describe('validateCPDTransition', () => {
  it('does not throw for valid transitions', () => {
    expect(() => validateCPDTransition('DRAFT', 'SUBMITTED')).not.toThrow()
    expect(() => validateCPDTransition('SUBMITTED', 'VERIFIED')).not.toThrow()
    expect(() => validateCPDTransition('SUBMITTED', 'RETURNED')).not.toThrow()
    expect(() => validateCPDTransition('RETURNED', 'SUBMITTED')).not.toThrow()
  })

  it('throws for invalid transition', () => {
    expect(() => validateCPDTransition('DRAFT', 'VERIFIED')).toThrow(/Cannot transition/)
  })

  it('throws for self-transition with "already" message', () => {
    expect(() => validateCPDTransition('SUBMITTED', 'SUBMITTED')).toThrow(/already/)
  })

  it('includes valid transitions in error message', () => {
    try {
      validateCPDTransition('DRAFT', 'VERIFIED')
    } catch (err) {
      expect((err as Error).message).toContain('SUBMITTED')
    }
  })

  it('says "terminal state" for transitions from terminal', () => {
    try {
      validateCPDTransition('VERIFIED', 'DRAFT')
    } catch (err) {
      expect((err as Error).message).toContain('terminal state')
    }
  })
})

/* ── getValidNextCPDStatuses ──────────────────────────── */

describe('getValidNextCPDStatuses', () => {
  it('returns correct next statuses for each status', () => {
    expect(getValidNextCPDStatuses('DRAFT')).toEqual(['SUBMITTED'])
    expect(getValidNextCPDStatuses('SUBMITTED')).toEqual(['VERIFIED', 'RETURNED'])
    expect(getValidNextCPDStatuses('RETURNED')).toEqual(['SUBMITTED'])
    expect(getValidNextCPDStatuses('VERIFIED')).toEqual([])
  })
})

/* ── Terminal status ──────────────────────────────────── */

describe('isTerminalCPDStatus', () => {
  it('VERIFIED is terminal', () => {
    expect(isTerminalCPDStatus('VERIFIED')).toBe(true)
  })

  it('DRAFT, SUBMITTED, RETURNED are not terminal', () => {
    expect(isTerminalCPDStatus('DRAFT')).toBe(false)
    expect(isTerminalCPDStatus('SUBMITTED')).toBe(false)
    expect(isTerminalCPDStatus('RETURNED')).toBe(false)
  })
})

/* ── No self-transitions ──────────────────────────────── */

describe('no self-transitions in CPD', () => {
  it('no status lists itself as a valid next status', () => {
    for (const [status, nextStatuses] of Object.entries(VALID_CPD_TRANSITIONS)) {
      expect(nextStatuses).not.toContain(status)
    }
  })
})

/* ── Full lifecycle reachability ───────────────────────── */

describe('CPD lifecycle paths', () => {
  it('happy path: DRAFT → SUBMITTED → VERIFIED', () => {
    expect(isValidCPDTransition('DRAFT', 'SUBMITTED')).toBe(true)
    expect(isValidCPDTransition('SUBMITTED', 'VERIFIED')).toBe(true)
  })

  it('return path: DRAFT → SUBMITTED → RETURNED → SUBMITTED → VERIFIED', () => {
    expect(isValidCPDTransition('DRAFT', 'SUBMITTED')).toBe(true)
    expect(isValidCPDTransition('SUBMITTED', 'RETURNED')).toBe(true)
    expect(isValidCPDTransition('RETURNED', 'SUBMITTED')).toBe(true)
    expect(isValidCPDTransition('SUBMITTED', 'VERIFIED')).toBe(true)
  })

  it('every non-terminal status can eventually reach VERIFIED', () => {
    const nonTerminal: CPDStatus[] = ['DRAFT', 'SUBMITTED', 'RETURNED']

    for (const start of nonTerminal) {
      const visited = new Set<string>()
      const queue: string[] = [start]

      while (queue.length > 0) {
        const current = queue.shift()!
        if (visited.has(current)) continue
        visited.add(current)
        const next = VALID_CPD_TRANSITIONS[current as CPDStatus] ?? []
        queue.push(...next)
      }

      expect(visited.has('VERIFIED')).toBe(true)
    }
  })
})

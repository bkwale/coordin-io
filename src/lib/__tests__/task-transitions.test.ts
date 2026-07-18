import { describe, it, expect } from 'vitest'
import {
  isValidTransition,
  validateTaskTransition,
  getValidNextStatuses,
  isReviewerTransition,
  isTerminalStatus,
} from '@/lib/task-transitions'
import { ValidationError } from '@/lib/errors'

// ── Valid transitions ──────────────────────────────────────
describe('validateTaskTransition — valid transitions', () => {
  it('NOT_STARTED -> IN_PROGRESS', () => {
    expect(() => validateTaskTransition('NOT_STARTED', 'IN_PROGRESS')).not.toThrow()
  })

  it('IN_PROGRESS -> READY_FOR_REVIEW', () => {
    expect(() => validateTaskTransition('IN_PROGRESS', 'READY_FOR_REVIEW')).not.toThrow()
  })

  it('IN_PROGRESS -> BLOCKED', () => {
    expect(() => validateTaskTransition('IN_PROGRESS', 'BLOCKED')).not.toThrow()
  })

  it('BLOCKED -> IN_PROGRESS', () => {
    expect(() => validateTaskTransition('BLOCKED', 'IN_PROGRESS')).not.toThrow()
  })

  it('READY_FOR_REVIEW -> COMPLETED', () => {
    expect(() => validateTaskTransition('READY_FOR_REVIEW', 'COMPLETED')).not.toThrow()
  })

  it('READY_FOR_REVIEW -> CHANGES_REQUIRED', () => {
    expect(() => validateTaskTransition('READY_FOR_REVIEW', 'CHANGES_REQUIRED')).not.toThrow()
  })

  it('CHANGES_REQUIRED -> IN_PROGRESS', () => {
    expect(() => validateTaskTransition('CHANGES_REQUIRED', 'IN_PROGRESS')).not.toThrow()
  })
})

// ── Invalid transitions ────────────────────────────────────
describe('validateTaskTransition — invalid transitions', () => {
  it('NOT_STARTED -> COMPLETED (skip review)', () => {
    expect(() => validateTaskTransition('NOT_STARTED', 'COMPLETED')).toThrow(ValidationError)
  })

  it('NOT_STARTED -> READY_FOR_REVIEW (skip in-progress)', () => {
    expect(() => validateTaskTransition('NOT_STARTED', 'READY_FOR_REVIEW')).toThrow(ValidationError)
  })

  it('COMPLETED -> IN_PROGRESS (terminal state)', () => {
    expect(() => validateTaskTransition('COMPLETED', 'IN_PROGRESS')).toThrow(ValidationError)
  })

  it('COMPLETED -> NOT_STARTED (terminal state)', () => {
    expect(() => validateTaskTransition('COMPLETED', 'NOT_STARTED')).toThrow(ValidationError)
  })

  it('READY_FOR_REVIEW -> IN_PROGRESS (must go through CHANGES_REQUIRED)', () => {
    expect(() => validateTaskTransition('READY_FOR_REVIEW', 'IN_PROGRESS')).toThrow(ValidationError)
  })

  it('same status -> same status (no-op)', () => {
    expect(() => validateTaskTransition('IN_PROGRESS', 'IN_PROGRESS')).toThrow(ValidationError)
    expect(() => validateTaskTransition('NOT_STARTED', 'NOT_STARTED')).toThrow(ValidationError)
  })
})

// ── isValidTransition ──────────────────────────────────────
describe('isValidTransition', () => {
  it('returns true for valid transitions', () => {
    expect(isValidTransition('NOT_STARTED', 'IN_PROGRESS')).toBe(true)
    expect(isValidTransition('IN_PROGRESS', 'BLOCKED')).toBe(true)
  })

  it('returns false for invalid transitions', () => {
    expect(isValidTransition('NOT_STARTED', 'COMPLETED')).toBe(false)
    expect(isValidTransition('COMPLETED', 'IN_PROGRESS')).toBe(false)
  })

  it('returns false for same-status transitions', () => {
    expect(isValidTransition('IN_PROGRESS', 'IN_PROGRESS')).toBe(false)
  })
})

// ── getValidNextStatuses ───────────────────────────────────
describe('getValidNextStatuses', () => {
  it('COMPLETED returns empty array', () => {
    expect(getValidNextStatuses('COMPLETED')).toEqual([])
  })

  it('IN_PROGRESS returns READY_FOR_REVIEW and BLOCKED', () => {
    expect(getValidNextStatuses('IN_PROGRESS')).toEqual(['READY_FOR_REVIEW', 'BLOCKED'])
  })

  it('NOT_STARTED returns IN_PROGRESS only', () => {
    expect(getValidNextStatuses('NOT_STARTED')).toEqual(['IN_PROGRESS'])
  })
})

// ── isReviewerTransition ───────────────────────────────────
describe('isReviewerTransition', () => {
  it('COMPLETED -> true', () => {
    expect(isReviewerTransition('COMPLETED')).toBe(true)
  })

  it('CHANGES_REQUIRED -> true', () => {
    expect(isReviewerTransition('CHANGES_REQUIRED')).toBe(true)
  })

  it('IN_PROGRESS -> false', () => {
    expect(isReviewerTransition('IN_PROGRESS')).toBe(false)
  })
})

// ── isTerminalStatus ───────────────────────────────────────
describe('isTerminalStatus', () => {
  it('COMPLETED -> true', () => {
    expect(isTerminalStatus('COMPLETED')).toBe(true)
  })

  it('IN_PROGRESS -> false', () => {
    expect(isTerminalStatus('IN_PROGRESS')).toBe(false)
  })

  it('NOT_STARTED -> false', () => {
    expect(isTerminalStatus('NOT_STARTED')).toBe(false)
  })
})

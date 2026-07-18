import { describe, it, expect } from 'vitest'
import {
  isValidSnagTransition,
  validateSnagTransition,
  getValidNextSnagStatuses,
  isTerminalSnagStatus,
  SNAG_STATUS_LABELS,
  SNAG_CATEGORY_LABELS,
  SNAG_SEVERITY_LABELS,
} from '@/lib/snag-transitions'
import { ValidationError } from '@/lib/errors'
import type { SnagStatus, SnagCategory, SnagSeverity } from '@/generated/prisma/client'

const ALL_STATUSES: SnagStatus[] = [
  'OPEN', 'ASSIGNED', 'RECTIFICATION_SUBMITTED', 'VERIFICATION', 'CLOSED', 'REOPENED',
]

const ALL_CATEGORIES: SnagCategory[] = [
  'ARCHITECTURAL', 'MEP', 'STRUCTURAL', 'FIRE',
  'HEALTH_SAFETY', 'FINISH', 'FF_AND_E', 'EXTERNAL_WORKS',
]

const ALL_SEVERITIES: SnagSeverity[] = [
  'MINOR', 'MODERATE', 'MAJOR', 'SAFETY_CRITICAL',
]

// ── Structure ──────────────────────────────────────────────
describe('snag state machine structure', () => {
  it('has exactly 6 statuses defined', () => {
    // getValidNextSnagStatuses should return an array for each status
    for (const status of ALL_STATUSES) {
      const result = getValidNextSnagStatuses(status)
      expect(Array.isArray(result)).toBe(true)
    }
  })

  it('OPEN has exactly 1 valid transition (ASSIGNED)', () => {
    expect(getValidNextSnagStatuses('OPEN')).toEqual(['ASSIGNED'])
  })

  it('ASSIGNED has exactly 1 valid transition (RECTIFICATION_SUBMITTED)', () => {
    expect(getValidNextSnagStatuses('ASSIGNED')).toEqual(['RECTIFICATION_SUBMITTED'])
  })

  it('RECTIFICATION_SUBMITTED has exactly 1 valid transition (VERIFICATION)', () => {
    expect(getValidNextSnagStatuses('RECTIFICATION_SUBMITTED')).toEqual(['VERIFICATION'])
  })

  it('VERIFICATION has exactly 2 valid transitions (CLOSED, REOPENED)', () => {
    expect(getValidNextSnagStatuses('VERIFICATION')).toEqual(['CLOSED', 'REOPENED'])
  })

  it('REOPENED has exactly 1 valid transition (ASSIGNED)', () => {
    expect(getValidNextSnagStatuses('REOPENED')).toEqual(['ASSIGNED'])
  })

  it('CLOSED has 0 transitions (terminal)', () => {
    expect(getValidNextSnagStatuses('CLOSED')).toEqual([])
  })
})

// ── Valid transitions ──────────────────────────────────────
describe('validateSnagTransition - valid transitions', () => {
  it('OPEN -> ASSIGNED', () => {
    expect(() => validateSnagTransition('OPEN', 'ASSIGNED')).not.toThrow()
  })

  it('ASSIGNED -> RECTIFICATION_SUBMITTED', () => {
    expect(() => validateSnagTransition('ASSIGNED', 'RECTIFICATION_SUBMITTED')).not.toThrow()
  })

  it('RECTIFICATION_SUBMITTED -> VERIFICATION', () => {
    expect(() => validateSnagTransition('RECTIFICATION_SUBMITTED', 'VERIFICATION')).not.toThrow()
  })

  it('VERIFICATION -> CLOSED', () => {
    expect(() => validateSnagTransition('VERIFICATION', 'CLOSED')).not.toThrow()
  })

  it('VERIFICATION -> REOPENED', () => {
    expect(() => validateSnagTransition('VERIFICATION', 'REOPENED')).not.toThrow()
  })

  it('REOPENED -> ASSIGNED', () => {
    expect(() => validateSnagTransition('REOPENED', 'ASSIGNED')).not.toThrow()
  })
})

// ── Invalid transitions ────────────────────────────────────
describe('validateSnagTransition - invalid transitions', () => {
  it('OPEN -> CLOSED (skip entire flow)', () => {
    expect(() => validateSnagTransition('OPEN', 'CLOSED')).toThrow(ValidationError)
  })

  it('OPEN -> VERIFICATION (skip middle steps)', () => {
    expect(() => validateSnagTransition('OPEN', 'VERIFICATION')).toThrow(ValidationError)
  })

  it('OPEN -> RECTIFICATION_SUBMITTED (skip ASSIGNED)', () => {
    expect(() => validateSnagTransition('OPEN', 'RECTIFICATION_SUBMITTED')).toThrow(ValidationError)
  })

  it('ASSIGNED -> CLOSED (skip rectification + verification)', () => {
    expect(() => validateSnagTransition('ASSIGNED', 'CLOSED')).toThrow(ValidationError)
  })

  it('CLOSED -> OPEN (terminal state)', () => {
    expect(() => validateSnagTransition('CLOSED', 'OPEN')).toThrow(ValidationError)
  })

  it('CLOSED -> ASSIGNED (terminal state)', () => {
    expect(() => validateSnagTransition('CLOSED', 'ASSIGNED')).toThrow(ValidationError)
  })

  it('CLOSED -> REOPENED (terminal — must go through VERIFICATION)', () => {
    expect(() => validateSnagTransition('CLOSED', 'REOPENED')).toThrow(ValidationError)
  })

  it('REOPENED -> CLOSED (must go through ASSIGNED -> RECTIFICATION -> VERIFICATION)', () => {
    expect(() => validateSnagTransition('REOPENED', 'CLOSED')).toThrow(ValidationError)
  })
})

// ── Self-transitions blocked ───────────────────────────────
describe('self-transitions are blocked', () => {
  for (const status of ALL_STATUSES) {
    it(`${status} -> ${status} throws ValidationError`, () => {
      expect(() => validateSnagTransition(status, status)).toThrow(ValidationError)
    })
  }
})

// ── isValidSnagTransition ──────────────────────────────────
describe('isValidSnagTransition', () => {
  it('returns true for valid transitions', () => {
    expect(isValidSnagTransition('OPEN', 'ASSIGNED')).toBe(true)
    expect(isValidSnagTransition('VERIFICATION', 'CLOSED')).toBe(true)
    expect(isValidSnagTransition('VERIFICATION', 'REOPENED')).toBe(true)
    expect(isValidSnagTransition('REOPENED', 'ASSIGNED')).toBe(true)
  })

  it('returns false for invalid transitions', () => {
    expect(isValidSnagTransition('OPEN', 'CLOSED')).toBe(false)
    expect(isValidSnagTransition('CLOSED', 'OPEN')).toBe(false)
    expect(isValidSnagTransition('ASSIGNED', 'OPEN')).toBe(false)
  })

  it('returns false for self-transitions', () => {
    expect(isValidSnagTransition('OPEN', 'OPEN')).toBe(false)
    expect(isValidSnagTransition('CLOSED', 'CLOSED')).toBe(false)
  })
})

// ── Terminal state ─────────────────────────────────────────
describe('isTerminalSnagStatus', () => {
  it('CLOSED is terminal', () => {
    expect(isTerminalSnagStatus('CLOSED')).toBe(true)
  })

  it('OPEN is not terminal', () => {
    expect(isTerminalSnagStatus('OPEN')).toBe(false)
  })

  it('ASSIGNED is not terminal', () => {
    expect(isTerminalSnagStatus('ASSIGNED')).toBe(false)
  })

  it('RECTIFICATION_SUBMITTED is not terminal', () => {
    expect(isTerminalSnagStatus('RECTIFICATION_SUBMITTED')).toBe(false)
  })

  it('VERIFICATION is not terminal', () => {
    expect(isTerminalSnagStatus('VERIFICATION')).toBe(false)
  })

  it('REOPENED is not terminal', () => {
    expect(isTerminalSnagStatus('REOPENED')).toBe(false)
  })
})

// ── Reachability: OPEN can reach CLOSED ────────────────────
describe('reachability', () => {
  it('OPEN can reach CLOSED through the full path', () => {
    // OPEN -> ASSIGNED -> RECTIFICATION_SUBMITTED -> VERIFICATION -> CLOSED
    expect(isValidSnagTransition('OPEN', 'ASSIGNED')).toBe(true)
    expect(isValidSnagTransition('ASSIGNED', 'RECTIFICATION_SUBMITTED')).toBe(true)
    expect(isValidSnagTransition('RECTIFICATION_SUBMITTED', 'VERIFICATION')).toBe(true)
    expect(isValidSnagTransition('VERIFICATION', 'CLOSED')).toBe(true)
  })

  it('REOPENED can reach CLOSED through the re-inspection path', () => {
    // REOPENED -> ASSIGNED -> RECTIFICATION_SUBMITTED -> VERIFICATION -> CLOSED
    expect(isValidSnagTransition('REOPENED', 'ASSIGNED')).toBe(true)
    expect(isValidSnagTransition('ASSIGNED', 'RECTIFICATION_SUBMITTED')).toBe(true)
    expect(isValidSnagTransition('RECTIFICATION_SUBMITTED', 'VERIFICATION')).toBe(true)
    expect(isValidSnagTransition('VERIFICATION', 'CLOSED')).toBe(true)
  })

  it('VERIFICATION can loop through REOPENED cycle', () => {
    // VERIFICATION -> REOPENED -> ASSIGNED -> ... -> VERIFICATION
    expect(isValidSnagTransition('VERIFICATION', 'REOPENED')).toBe(true)
    expect(isValidSnagTransition('REOPENED', 'ASSIGNED')).toBe(true)
    expect(isValidSnagTransition('ASSIGNED', 'RECTIFICATION_SUBMITTED')).toBe(true)
    expect(isValidSnagTransition('RECTIFICATION_SUBMITTED', 'VERIFICATION')).toBe(true)
  })
})

// ── Labels ─────────────────────────────────────────────────
describe('labels', () => {
  it('has labels for all 6 statuses', () => {
    for (const status of ALL_STATUSES) {
      expect(SNAG_STATUS_LABELS[status]).toBeDefined()
      expect(typeof SNAG_STATUS_LABELS[status]).toBe('string')
      expect(SNAG_STATUS_LABELS[status].length).toBeGreaterThan(0)
    }
  })

  it('has labels for all 8 categories', () => {
    for (const category of ALL_CATEGORIES) {
      expect(SNAG_CATEGORY_LABELS[category]).toBeDefined()
      expect(typeof SNAG_CATEGORY_LABELS[category]).toBe('string')
      expect(SNAG_CATEGORY_LABELS[category].length).toBeGreaterThan(0)
    }
  })

  it('has labels for all 4 severities', () => {
    for (const severity of ALL_SEVERITIES) {
      expect(SNAG_SEVERITY_LABELS[severity]).toBeDefined()
      expect(typeof SNAG_SEVERITY_LABELS[severity]).toBe('string')
      expect(SNAG_SEVERITY_LABELS[severity].length).toBeGreaterThan(0)
    }
  })
})

// ── Error message quality ──────────────────────────────────
describe('error messages', () => {
  it('self-transition error mentions current status', () => {
    try {
      validateSnagTransition('OPEN', 'OPEN')
    } catch (err) {
      expect(err).toBeInstanceOf(ValidationError)
      expect((err as ValidationError).message).toContain('OPEN')
    }
  })

  it('invalid transition error lists valid targets', () => {
    try {
      validateSnagTransition('OPEN', 'CLOSED')
    } catch (err) {
      expect(err).toBeInstanceOf(ValidationError)
      expect((err as ValidationError).message).toContain('ASSIGNED')
    }
  })

  it('terminal state error mentions terminal', () => {
    try {
      validateSnagTransition('CLOSED', 'OPEN')
    } catch (err) {
      expect(err).toBeInstanceOf(ValidationError)
      expect((err as ValidationError).message).toContain('terminal')
    }
  })
})

import { describe, it, expect } from 'vitest'
import {
  calculateWorkingDays,
  isWorkingDay,
  calculateLeaveBalance,
  checkLeaveBalance,
  datesOverlap,
  findOverlappingRequest,
  validateLeaveRequest,
  formatDays,
} from '../leave-utils'

/* ── calculateWorkingDays ──────────────────────────────── */

describe('calculateWorkingDays', () => {
  it('counts Mon-Fri only', () => {
    // Mon 2026-01-05 to Fri 2026-01-09 = 5 working days
    const result = calculateWorkingDays(new Date('2026-01-05'), new Date('2026-01-09'))
    expect(result).toBe(5)
  })

  it('excludes weekends', () => {
    // Mon 2026-01-05 to Sun 2026-01-11 = 5 working days (Sat+Sun excluded)
    const result = calculateWorkingDays(new Date('2026-01-05'), new Date('2026-01-11'))
    expect(result).toBe(5)
  })

  it('returns 0 for weekend-only range', () => {
    // Sat 2026-01-10 to Sun 2026-01-11 = 0 working days
    const result = calculateWorkingDays(new Date('2026-01-10'), new Date('2026-01-11'))
    expect(result).toBe(0)
  })

  it('returns 0 when end is before start', () => {
    const result = calculateWorkingDays(new Date('2026-01-09'), new Date('2026-01-05'))
    expect(result).toBe(0)
  })

  it('returns 1 for single weekday', () => {
    // Mon 2026-01-05
    const result = calculateWorkingDays(new Date('2026-01-05'), new Date('2026-01-05'))
    expect(result).toBe(1)
  })

  it('returns 0 for single weekend day', () => {
    // Sat 2026-01-10
    const result = calculateWorkingDays(new Date('2026-01-10'), new Date('2026-01-10'))
    expect(result).toBe(0)
  })

  it('handles two-week span correctly', () => {
    // Mon 2026-01-05 to Fri 2026-01-16 = 10 working days
    const result = calculateWorkingDays(new Date('2026-01-05'), new Date('2026-01-16'))
    expect(result).toBe(10)
  })

  it('handles month boundary', () => {
    // Fri 2026-01-30 to Tue 2026-02-03 = 3 working days (Fri, Mon, Tue)
    const result = calculateWorkingDays(new Date('2026-01-30'), new Date('2026-02-03'))
    expect(result).toBe(3)
  })
})

/* ── isWorkingDay ──────────────────────────────────────── */

describe('isWorkingDay', () => {
  it('Mon-Fri are working days', () => {
    expect(isWorkingDay(new Date('2026-01-05'))).toBe(true) // Mon
    expect(isWorkingDay(new Date('2026-01-06'))).toBe(true) // Tue
    expect(isWorkingDay(new Date('2026-01-07'))).toBe(true) // Wed
    expect(isWorkingDay(new Date('2026-01-08'))).toBe(true) // Thu
    expect(isWorkingDay(new Date('2026-01-09'))).toBe(true) // Fri
  })

  it('Sat and Sun are not working days', () => {
    expect(isWorkingDay(new Date('2026-01-10'))).toBe(false) // Sat
    expect(isWorkingDay(new Date('2026-01-11'))).toBe(false) // Sun
  })
})

/* ── calculateLeaveBalance ─────────────────────────────── */

describe('calculateLeaveBalance', () => {
  it('calculates available correctly', () => {
    const result = calculateLeaveBalance(25, 5, 2, 3)
    expect(result.allocation).toBe(25)
    expect(result.used).toBe(5)
    expect(result.carriedForward).toBe(2)
    expect(result.pending).toBe(3)
    expect(result.available).toBe(19) // 25 + 2 - 5 - 3
  })

  it('clamps available to 0 when overdrawn', () => {
    const result = calculateLeaveBalance(25, 20, 0, 10)
    expect(result.available).toBe(0) // 25 - 20 - 10 = -5 → 0
  })

  it('includes carried forward in available', () => {
    const result = calculateLeaveBalance(25, 25, 5, 0)
    expect(result.available).toBe(5)
  })

  it('handles zero allocation', () => {
    const result = calculateLeaveBalance(0, 0, 0, 0)
    expect(result.available).toBe(0)
  })
})

/* ── checkLeaveBalance ─────────────────────────────────── */

describe('checkLeaveBalance', () => {
  it('sufficient when available > requested', () => {
    const result = checkLeaveBalance(20, 5)
    expect(result.sufficient).toBe(true)
    expect(result.shortfall).toBe(0)
  })

  it('sufficient when available equals requested', () => {
    const result = checkLeaveBalance(5, 5)
    expect(result.sufficient).toBe(true)
    expect(result.shortfall).toBe(0)
  })

  it('insufficient when requested > available', () => {
    const result = checkLeaveBalance(3, 5)
    expect(result.sufficient).toBe(false)
    expect(result.shortfall).toBe(2)
  })

  it('shortfall is 0 when available is 0 and requested is 0', () => {
    const result = checkLeaveBalance(0, 0)
    expect(result.sufficient).toBe(true)
    expect(result.shortfall).toBe(0)
  })
})

/* ── datesOverlap ──────────────────────────────────────── */

describe('datesOverlap', () => {
  it('detects full overlap', () => {
    const a = { startDate: new Date('2026-01-05'), endDate: new Date('2026-01-09') }
    const b = { startDate: new Date('2026-01-06'), endDate: new Date('2026-01-08') }
    expect(datesOverlap(a, b)).toBe(true)
  })

  it('detects partial overlap (start)', () => {
    const a = { startDate: new Date('2026-01-05'), endDate: new Date('2026-01-09') }
    const b = { startDate: new Date('2026-01-03'), endDate: new Date('2026-01-06') }
    expect(datesOverlap(a, b)).toBe(true)
  })

  it('detects partial overlap (end)', () => {
    const a = { startDate: new Date('2026-01-05'), endDate: new Date('2026-01-09') }
    const b = { startDate: new Date('2026-01-08'), endDate: new Date('2026-01-12') }
    expect(datesOverlap(a, b)).toBe(true)
  })

  it('detects overlap on boundary (same day)', () => {
    const a = { startDate: new Date('2026-01-05'), endDate: new Date('2026-01-09') }
    const b = { startDate: new Date('2026-01-09'), endDate: new Date('2026-01-12') }
    expect(datesOverlap(a, b)).toBe(true)
  })

  it('no overlap when ranges are separate', () => {
    const a = { startDate: new Date('2026-01-05'), endDate: new Date('2026-01-09') }
    const b = { startDate: new Date('2026-01-12'), endDate: new Date('2026-01-16') }
    expect(datesOverlap(a, b)).toBe(false)
  })
})

/* ── findOverlappingRequest ────────────────────────────── */

describe('findOverlappingRequest', () => {
  const existing = [
    { id: 'r1', startDate: new Date('2026-01-05'), endDate: new Date('2026-01-09') },
    { id: 'r2', startDate: new Date('2026-02-01'), endDate: new Date('2026-02-05') },
  ]

  it('finds overlapping request', () => {
    const proposed = { startDate: new Date('2026-01-08'), endDate: new Date('2026-01-12') }
    const result = findOverlappingRequest(proposed, existing)
    expect(result?.id).toBe('r1')
  })

  it('returns null when no overlap', () => {
    const proposed = { startDate: new Date('2026-01-12'), endDate: new Date('2026-01-16') }
    const result = findOverlappingRequest(proposed, existing)
    expect(result).toBeNull()
  })

  it('returns first overlap if multiple match', () => {
    const proposed = { startDate: new Date('2025-12-01'), endDate: new Date('2026-03-01') }
    const result = findOverlappingRequest(proposed, existing)
    expect(result?.id).toBe('r1')
  })
})

/* ── validateLeaveRequest ──────────────────────────────── */

describe('validateLeaveRequest', () => {
  it('calculates working days for valid request', () => {
    const result = validateLeaveRequest(new Date('2026-01-05'), new Date('2026-01-09'))
    expect(result.days).toBe(5)
  })

  it('throws if end is before start', () => {
    expect(() => validateLeaveRequest(new Date('2026-01-09'), new Date('2026-01-05'))).toThrow(/after/)
  })

  it('throws if range has zero working days (weekend only)', () => {
    expect(() => validateLeaveRequest(new Date('2026-01-10'), new Date('2026-01-11'))).toThrow(/working day/)
  })

  it('throws if request exceeds 25 days', () => {
    // ~6 weeks = ~30 working days
    expect(() => validateLeaveRequest(new Date('2026-01-05'), new Date('2026-02-13'))).toThrow(/25/)
  })

  it('allows exactly 25 working days', () => {
    // 5 weeks = exactly 25 working days: Mon Jan 5 - Fri Feb 6
    const result = validateLeaveRequest(new Date('2026-01-05'), new Date('2026-02-06'))
    expect(result.days).toBe(25)
  })
})

/* ── formatDays ────────────────────────────────────────── */

describe('formatDays', () => {
  it('singular for 1', () => {
    expect(formatDays(1)).toBe('1 day')
  })

  it('plural for > 1', () => {
    expect(formatDays(5)).toBe('5 days')
  })

  it('handles fractional days', () => {
    expect(formatDays(0.5)).toBe('0.5 days')
  })
})

import { describe, it, expect } from 'vitest'
import {
  requireString,
  optionalString,
  requireNumber,
  optionalNumber,
  requireDate,
  optionalDate,
  requireEnum,
  optionalEnum,
  requireId,
  optionalId,
  isValidId,
  parseBody,
} from '@/lib/validation'
import { ValidationError } from '@/lib/errors'

// ── requireString ─────────────────────────────────────────────

describe('requireString', () => {
  it('returns trimmed value for valid string', () => {
    expect(requireString('  hello  ', 'name')).toBe('hello')
  })

  it('throws ValidationError for empty string', () => {
    expect(() => requireString('', 'name')).toThrow(ValidationError)
    expect(() => requireString('', 'name')).toThrow('name cannot be empty')
  })

  it('throws ValidationError for whitespace-only string', () => {
    expect(() => requireString('   ', 'name')).toThrow(ValidationError)
    expect(() => requireString('   ', 'name')).toThrow('name cannot be empty')
  })

  it('throws ValidationError for null', () => {
    expect(() => requireString(null, 'name')).toThrow(ValidationError)
    expect(() => requireString(null, 'name')).toThrow('name is required')
  })

  it('throws ValidationError for undefined', () => {
    expect(() => requireString(undefined, 'name')).toThrow(ValidationError)
    expect(() => requireString(undefined, 'name')).toThrow('name is required')
  })

  it('throws ValidationError for number (wrong type)', () => {
    expect(() => requireString(42, 'name')).toThrow(ValidationError)
    expect(() => requireString(42, 'name')).toThrow('name is required')
  })

  it('throws ValidationError for string exceeding maxLength', () => {
    const long = 'a'.repeat(11)
    expect(() => requireString(long, 'name', 10)).toThrow(ValidationError)
    expect(() => requireString(long, 'name', 10)).toThrow('name must be 10 characters or fewer (got 11)')
  })

  it('passes for string at exactly maxLength', () => {
    const exact = 'a'.repeat(10)
    expect(requireString(exact, 'name', 10)).toBe(exact)
  })
})

// ── optionalString ────────────────────────────────────────────

describe('optionalString', () => {
  it('returns null for null', () => {
    expect(optionalString(null, 'notes')).toBeNull()
  })

  it('returns null for undefined', () => {
    expect(optionalString(undefined, 'notes')).toBeNull()
  })

  it('returns null for empty string', () => {
    expect(optionalString('', 'notes')).toBeNull()
  })

  it('returns trimmed value for valid string', () => {
    expect(optionalString('  hello  ', 'notes')).toBe('hello')
  })

  it('throws ValidationError for too-long string', () => {
    const long = 'a'.repeat(11)
    expect(() => optionalString(long, 'notes', 10)).toThrow(ValidationError)
    expect(() => optionalString(long, 'notes', 10)).toThrow('notes must be 10 characters or fewer (got 11)')
  })

  it('throws ValidationError for non-string type', () => {
    expect(() => optionalString(42, 'notes')).toThrow(ValidationError)
    expect(() => optionalString(42, 'notes')).toThrow('notes must be a string')
  })
})

// ── requireNumber ─────────────────────────────────────────────

describe('requireNumber', () => {
  it('returns valid number', () => {
    expect(requireNumber(42, 'hours')).toBe(42)
  })

  it('parses numeric string "42" and returns 42', () => {
    expect(requireNumber('42', 'hours')).toBe(42)
  })

  it('throws ValidationError for null', () => {
    expect(() => requireNumber(null, 'hours')).toThrow(ValidationError)
    expect(() => requireNumber(null, 'hours')).toThrow('hours is required')
  })

  it('throws ValidationError for "abc"', () => {
    expect(() => requireNumber('abc', 'hours')).toThrow(ValidationError)
    expect(() => requireNumber('abc', 'hours')).toThrow('hours must be a number')
  })

  it('throws ValidationError for number below min', () => {
    expect(() => requireNumber(3, 'hours', { min: 5 })).toThrow(ValidationError)
    expect(() => requireNumber(3, 'hours', { min: 5 })).toThrow('hours must be at least 5')
  })

  it('throws ValidationError for number above max', () => {
    expect(() => requireNumber(100, 'hours', { max: 40 })).toThrow(ValidationError)
    expect(() => requireNumber(100, 'hours', { max: 40 })).toThrow('hours must be at most 40')
  })

  it('throws ValidationError for NaN', () => {
    expect(() => requireNumber(NaN, 'hours')).toThrow(ValidationError)
    expect(() => requireNumber(NaN, 'hours')).toThrow('hours must be a number')
  })
})

// ── optionalNumber ────────────────────────────────────────────

describe('optionalNumber', () => {
  it('returns null for null', () => {
    expect(optionalNumber(null, 'bonus')).toBeNull()
  })

  it('returns null for undefined', () => {
    expect(optionalNumber(undefined, 'bonus')).toBeNull()
  })

  it('returns valid number', () => {
    expect(optionalNumber(42, 'bonus')).toBe(42)
  })

  it('throws ValidationError for NaN', () => {
    expect(() => optionalNumber(NaN, 'bonus')).toThrow(ValidationError)
    expect(() => optionalNumber(NaN, 'bonus')).toThrow('bonus must be a number')
  })

  it('throws ValidationError for number below min', () => {
    expect(() => optionalNumber(1, 'bonus', { min: 5 })).toThrow(ValidationError)
    expect(() => optionalNumber(1, 'bonus', { min: 5 })).toThrow('bonus must be at least 5')
  })

  it('throws ValidationError for number above max', () => {
    expect(() => optionalNumber(999, 'bonus', { max: 100 })).toThrow(ValidationError)
    expect(() => optionalNumber(999, 'bonus', { max: 100 })).toThrow('bonus must be at most 100')
  })
})

// ── requireDate ───────────────────────────────────────────────

describe('requireDate', () => {
  it('returns Date for valid ISO string', () => {
    const result = requireDate('2026-08-04T10:00:00.000Z', 'startDate')
    expect(result).toBeInstanceOf(Date)
    expect(result.toISOString()).toBe('2026-08-04T10:00:00.000Z')
  })

  it('returns correct Date for "2026-08-04"', () => {
    const result = requireDate('2026-08-04', 'startDate')
    expect(result).toBeInstanceOf(Date)
    expect(result.getFullYear()).toBe(2026)
    expect(result.getMonth()).toBe(7) // 0-indexed, August = 7
    expect(result.getDate()).toBe(4)
  })

  it('throws ValidationError for null', () => {
    expect(() => requireDate(null, 'startDate')).toThrow(ValidationError)
    expect(() => requireDate(null, 'startDate')).toThrow('startDate is required')
  })

  it('throws ValidationError for "not-a-date"', () => {
    expect(() => requireDate('not-a-date', 'startDate')).toThrow(ValidationError)
    expect(() => requireDate('not-a-date', 'startDate')).toThrow('startDate is not a valid date')
  })

  it('throws ValidationError for empty string', () => {
    expect(() => requireDate('', 'startDate')).toThrow(ValidationError)
    expect(() => requireDate('', 'startDate')).toThrow('startDate is not a valid date')
  })
})

// ── optionalDate ──────────────────────────────────────────────

describe('optionalDate', () => {
  it('returns null for null', () => {
    expect(optionalDate(null, 'endDate')).toBeNull()
  })

  it('returns null for undefined', () => {
    expect(optionalDate(undefined, 'endDate')).toBeNull()
  })

  it('returns Date for valid string', () => {
    const result = optionalDate('2026-12-31', 'endDate')
    expect(result).toBeInstanceOf(Date)
    expect(result!.getFullYear()).toBe(2026)
  })

  it('throws ValidationError for invalid date string', () => {
    expect(() => optionalDate('not-a-date', 'endDate')).toThrow(ValidationError)
    expect(() => optionalDate('not-a-date', 'endDate')).toThrow('endDate is not a valid date')
  })

  it('throws ValidationError for non-string type', () => {
    expect(() => optionalDate(12345, 'endDate')).toThrow(ValidationError)
    expect(() => optionalDate(12345, 'endDate')).toThrow('endDate must be a date string')
  })
})

// ── requireEnum ───────────────────────────────────────────────

describe('requireEnum', () => {
  const STATUSES = ['DRAFT', 'SUBMITTED', 'APPROVED'] as const

  it('returns valid enum value', () => {
    expect(requireEnum('DRAFT', 'status', STATUSES)).toBe('DRAFT')
  })

  it('throws ValidationError for invalid value with list of allowed values', () => {
    expect(() => requireEnum('INVALID', 'status', STATUSES)).toThrow(ValidationError)
    expect(() => requireEnum('INVALID', 'status', STATUSES)).toThrow(
      'status must be one of: DRAFT, SUBMITTED, APPROVED',
    )
  })

  it('throws ValidationError for null', () => {
    expect(() => requireEnum(null, 'status', STATUSES)).toThrow(ValidationError)
  })

  it('is case-sensitive: "draft" throws when "DRAFT" is expected', () => {
    expect(() => requireEnum('draft', 'status', STATUSES)).toThrow(ValidationError)
    expect(() => requireEnum('draft', 'status', STATUSES)).toThrow(
      'status must be one of: DRAFT, SUBMITTED, APPROVED',
    )
  })
})

// ── optionalEnum ──────────────────────────────────────────────

describe('optionalEnum', () => {
  const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH'] as const

  it('returns undefined for null', () => {
    expect(optionalEnum(null, 'priority', PRIORITIES)).toBeUndefined()
  })

  it('returns undefined for undefined', () => {
    expect(optionalEnum(undefined, 'priority', PRIORITIES)).toBeUndefined()
  })

  it('returns valid enum value', () => {
    expect(optionalEnum('HIGH', 'priority', PRIORITIES)).toBe('HIGH')
  })

  it('throws ValidationError for invalid value', () => {
    expect(() => optionalEnum('CRITICAL', 'priority', PRIORITIES)).toThrow(ValidationError)
  })
})

// ── isValidId ─────────────────────────────────────────────────

describe('isValidId', () => {
  it('returns true for valid UUID', () => {
    expect(isValidId('550e8400-e29b-41d4-a716-446655440000')).toBe(true)
  })

  it('returns true for valid CUID', () => {
    // CUIDs start with 'c' followed by 24+ lowercase alphanumeric chars
    expect(isValidId('clrec1234567890abcdefghij')).toBe(true)
  })

  it('returns false for empty string', () => {
    expect(isValidId('')).toBe(false)
  })

  it('returns false for random string', () => {
    expect(isValidId('not-an-id')).toBe(false)
  })

  it('returns false for number', () => {
    expect(isValidId(42)).toBe(false)
  })

  it('returns false for null', () => {
    expect(isValidId(null)).toBe(false)
  })

  it('returns false for undefined', () => {
    expect(isValidId(undefined)).toBe(false)
  })
})

// ── requireId ─────────────────────────────────────────────────

describe('requireId', () => {
  it('returns valid UUID', () => {
    const uuid = '550e8400-e29b-41d4-a716-446655440000'
    expect(requireId(uuid, 'projectId')).toBe(uuid)
  })

  it('returns valid CUID', () => {
    const cuid = 'clrec1234567890abcdefghij'
    expect(requireId(cuid, 'projectId')).toBe(cuid)
  })

  it('throws ValidationError for null', () => {
    expect(() => requireId(null, 'projectId')).toThrow(ValidationError)
    expect(() => requireId(null, 'projectId')).toThrow('projectId is required')
  })

  it('throws ValidationError for invalid format', () => {
    expect(() => requireId('not-valid', 'projectId')).toThrow(ValidationError)
    expect(() => requireId('not-valid', 'projectId')).toThrow('projectId must be a valid ID')
  })
})

// ── optionalId ────────────────────────────────────────────────

describe('optionalId', () => {
  it('returns null for null', () => {
    expect(optionalId(null, 'managerId')).toBeNull()
  })

  it('returns null for undefined', () => {
    expect(optionalId(undefined, 'managerId')).toBeNull()
  })

  it('returns valid UUID', () => {
    const uuid = '550e8400-e29b-41d4-a716-446655440000'
    expect(optionalId(uuid, 'managerId')).toBe(uuid)
  })

  it('throws ValidationError for invalid format', () => {
    expect(() => optionalId('bad-id', 'managerId')).toThrow(ValidationError)
    expect(() => optionalId('bad-id', 'managerId')).toThrow('managerId must be a valid ID')
  })
})

// ── parseBody ─────────────────────────────────────────────────

describe('parseBody', () => {
  it('parses valid JSON body', async () => {
    const body = JSON.stringify({ name: 'test' })
    const request = new Request('http://localhost/api/test', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body,
    })
    const result = await parseBody(request)
    expect(result).toEqual({ name: 'test' })
  })

  it('throws ValidationError for oversized body (content-length header)', async () => {
    const request = new Request('http://localhost/api/test', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'content-length': '999999',
      },
      body: '{}',
    })
    await expect(parseBody(request, 1024)).rejects.toThrow(ValidationError)
    await expect(parseBody(request, 1024)).rejects.toThrow('Request body too large')
  })

  it('throws ValidationError for invalid JSON', async () => {
    const request = new Request('http://localhost/api/test', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: 'not json {{{',
    })
    await expect(parseBody(request)).rejects.toThrow(ValidationError)
    await expect(parseBody(request)).rejects.toThrow('Invalid JSON body')
  })
})

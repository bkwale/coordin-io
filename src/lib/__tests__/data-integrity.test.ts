import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Import all state machine and business logic modules ──
import {
  isValidTransition,
  validateTaskTransition,
  getValidNextStatuses,
  isReviewerTransition,
  isTerminalStatus,
} from '@/lib/task-transitions'

import {
  isValidTimesheetTransition,
  validateTimesheetTransition,
  TIMESHEET_TRANSITIONS,
  MANAGER_STATUSES,
  OWNER_STATUSES,
} from '@/lib/timesheet-transitions'

import {
  isValidSnagTransition,
  validateSnagTransition,
  getValidNextSnagStatuses,
  isTerminalSnagStatus,
} from '@/lib/snag-transitions'

import {
  isValidRequestTransition,
  isValidLeaveTransition,
  validateRequestTransition,
  validateLeaveTransition,
  isTerminalRequestStatus,
  isRequesterTransition,
  isApproverTransition,
  VALID_TRANSITIONS as REQUEST_TRANSITIONS,
  LEAVE_TRANSITIONS,
} from '@/lib/request-transitions'

import {
  calculateWorkingDays,
  isWorkingDay,
  calculateLeaveBalance,
  checkLeaveBalance,
  datesOverlap,
  findOverlappingRequest,
  validateLeaveRequest,
  formatDays,
} from '@/lib/leave-utils'

import {
  AppError,
  AuthError,
  PermissionError,
  ValidationError,
  NotFoundError,
  ConflictError,
  DatabaseError,
  ExternalServiceError,
  RateLimitedError,
  ErrorCode,
  formatAPIError,
  fromPrismaError,
} from '@/lib/errors'

// Suppress console.error from logError
beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

// ── 1. Leave Balance Integrity ────────────────────────────

describe('Leave balance integrity', () => {
  describe('calculateWorkingDays', () => {
    it('Mon-Fri (5 day work week) returns 5', () => {
      // 2026-08-10 is Monday, 2026-08-14 is Friday
      const result = calculateWorkingDays(new Date('2026-08-10'), new Date('2026-08-14'))
      expect(result).toBe(5)
    })

    it('single working day returns 1', () => {
      // 2026-08-10 is Monday
      const result = calculateWorkingDays(new Date('2026-08-10'), new Date('2026-08-10'))
      expect(result).toBe(1)
    })

    it('weekend-only range returns 0', () => {
      // 2026-08-08 is Saturday, 2026-08-09 is Sunday
      const result = calculateWorkingDays(new Date('2026-08-08'), new Date('2026-08-09'))
      expect(result).toBe(0)
    })

    it('excludes weekends from count', () => {
      // Mon to next Mon (7 calendar days) = 6 working days
      const result = calculateWorkingDays(new Date('2026-08-10'), new Date('2026-08-17'))
      expect(result).toBe(6)
    })

    it('two full weeks = 10 working days', () => {
      // Mon 2026-08-10 to Fri 2026-08-21
      const result = calculateWorkingDays(new Date('2026-08-10'), new Date('2026-08-21'))
      expect(result).toBe(10)
    })

    it('returns 0 when end is before start', () => {
      const result = calculateWorkingDays(new Date('2026-08-14'), new Date('2026-08-10'))
      expect(result).toBe(0)
    })
  })

  describe('isWorkingDay', () => {
    it('Monday is a working day', () => {
      expect(isWorkingDay(new Date('2026-08-10'))).toBe(true) // Monday
    })

    it('Friday is a working day', () => {
      expect(isWorkingDay(new Date('2026-08-14'))).toBe(true) // Friday
    })

    it('Saturday is NOT a working day', () => {
      expect(isWorkingDay(new Date('2026-08-08'))).toBe(false) // Saturday
    })

    it('Sunday is NOT a working day', () => {
      expect(isWorkingDay(new Date('2026-08-09'))).toBe(false) // Sunday
    })
  })

  describe('calculateLeaveBalance', () => {
    it('available never goes negative', () => {
      // used > allocation + carriedForward
      const result = calculateLeaveBalance(10, 20, 0, 0)
      expect(result.available).toBe(0)
    })

    it('accounts for carried forward days', () => {
      const result = calculateLeaveBalance(25, 0, 5, 0)
      expect(result.available).toBe(30)
    })

    it('subtracts pending days', () => {
      const result = calculateLeaveBalance(25, 0, 0, 5)
      expect(result.available).toBe(20)
      expect(result.pending).toBe(5)
    })

    it('comprehensive balance calculation', () => {
      // 25 allocation + 3 carried forward - 10 used - 5 pending = 13
      const result = calculateLeaveBalance(25, 10, 3, 5)
      expect(result.allocation).toBe(25)
      expect(result.used).toBe(10)
      expect(result.carriedForward).toBe(3)
      expect(result.pending).toBe(5)
      expect(result.available).toBe(13)
    })
  })

  describe('checkLeaveBalance', () => {
    it('sufficient when available >= requested', () => {
      expect(checkLeaveBalance(10, 5)).toEqual({ sufficient: true, shortfall: 0 })
    })

    it('insufficient when available < requested', () => {
      expect(checkLeaveBalance(3, 5)).toEqual({ sufficient: false, shortfall: 2 })
    })

    it('exact match is sufficient', () => {
      expect(checkLeaveBalance(5, 5)).toEqual({ sufficient: true, shortfall: 0 })
    })

    it('zero balance means full shortfall', () => {
      expect(checkLeaveBalance(0, 3)).toEqual({ sufficient: false, shortfall: 3 })
    })
  })

  describe('formatDays', () => {
    it('formats 1 day as singular', () => {
      expect(formatDays(1)).toBe('1 day')
    })

    it('formats multiple days as plural', () => {
      expect(formatDays(5)).toBe('5 days')
    })

    it('formats half day', () => {
      expect(formatDays(0.5)).toBe('0.5 days')
    })
  })
})

// ── 2. Task State Machine Integrity ───────────────────────

describe('Task state machine integrity', () => {
  describe('ALL valid transitions', () => {
    it('NOT_STARTED -> IN_PROGRESS', () => {
      expect(isValidTransition('NOT_STARTED', 'IN_PROGRESS')).toBe(true)
    })

    it('IN_PROGRESS -> READY_FOR_REVIEW', () => {
      expect(isValidTransition('IN_PROGRESS', 'READY_FOR_REVIEW')).toBe(true)
    })

    it('IN_PROGRESS -> BLOCKED', () => {
      expect(isValidTransition('IN_PROGRESS', 'BLOCKED')).toBe(true)
    })

    it('BLOCKED -> IN_PROGRESS', () => {
      expect(isValidTransition('BLOCKED', 'IN_PROGRESS')).toBe(true)
    })

    it('READY_FOR_REVIEW -> COMPLETED', () => {
      expect(isValidTransition('READY_FOR_REVIEW', 'COMPLETED')).toBe(true)
    })

    it('READY_FOR_REVIEW -> CHANGES_REQUIRED', () => {
      expect(isValidTransition('READY_FOR_REVIEW', 'CHANGES_REQUIRED')).toBe(true)
    })

    it('CHANGES_REQUIRED -> IN_PROGRESS', () => {
      expect(isValidTransition('CHANGES_REQUIRED', 'IN_PROGRESS')).toBe(true)
    })
  })

  describe('ALL invalid transitions throw', () => {
    it('COMPLETED -> NOT_STARTED (reverse from terminal)', () => {
      expect(() => validateTaskTransition('COMPLETED', 'NOT_STARTED')).toThrow(ValidationError)
    })

    it('NOT_STARTED -> COMPLETED (skip to end)', () => {
      expect(() => validateTaskTransition('NOT_STARTED', 'COMPLETED')).toThrow(ValidationError)
    })

    it('NOT_STARTED -> READY_FOR_REVIEW (skip stages)', () => {
      expect(() => validateTaskTransition('NOT_STARTED', 'READY_FOR_REVIEW')).toThrow(ValidationError)
    })

    it('BLOCKED -> COMPLETED (skip review)', () => {
      expect(() => validateTaskTransition('BLOCKED', 'COMPLETED')).toThrow(ValidationError)
    })

    it('COMPLETED -> IN_PROGRESS (leave terminal)', () => {
      expect(() => validateTaskTransition('COMPLETED', 'IN_PROGRESS')).toThrow(ValidationError)
    })

    it('READY_FOR_REVIEW -> NOT_STARTED (backwards)', () => {
      expect(() => validateTaskTransition('READY_FOR_REVIEW', 'NOT_STARTED')).toThrow(ValidationError)
    })

    it('same-state transition throws with descriptive message', () => {
      expect(() => validateTaskTransition('IN_PROGRESS', 'IN_PROGRESS')).toThrow(
        'Task is already IN_PROGRESS',
      )
    })

    it('invalid transition includes valid options in error message', () => {
      try {
        validateTaskTransition('NOT_STARTED', 'COMPLETED')
      } catch (err) {
        expect(err).toBeInstanceOf(ValidationError)
        expect((err as ValidationError).message).toContain('IN_PROGRESS')
      }
    })

    it('terminal state error message says "none"', () => {
      try {
        validateTaskTransition('COMPLETED', 'NOT_STARTED')
      } catch (err) {
        expect((err as ValidationError).message).toContain('none (terminal state)')
      }
    })
  })

  describe('Reviewer-only transitions', () => {
    it('COMPLETED requires reviewer', () => {
      expect(isReviewerTransition('COMPLETED')).toBe(true)
    })

    it('CHANGES_REQUIRED requires reviewer', () => {
      expect(isReviewerTransition('CHANGES_REQUIRED')).toBe(true)
    })

    it('IN_PROGRESS does not require reviewer', () => {
      expect(isReviewerTransition('IN_PROGRESS')).toBe(false)
    })

    it('READY_FOR_REVIEW does not require reviewer', () => {
      expect(isReviewerTransition('READY_FOR_REVIEW')).toBe(false)
    })

    it('NOT_STARTED does not require reviewer', () => {
      expect(isReviewerTransition('NOT_STARTED')).toBe(false)
    })
  })

  describe('Terminal status checks', () => {
    it('COMPLETED is terminal', () => {
      expect(isTerminalStatus('COMPLETED')).toBe(true)
    })

    it('NOT_STARTED is not terminal', () => {
      expect(isTerminalStatus('NOT_STARTED')).toBe(false)
    })

    it('IN_PROGRESS is not terminal', () => {
      expect(isTerminalStatus('IN_PROGRESS')).toBe(false)
    })
  })

  describe('getValidNextStatuses', () => {
    it('NOT_STARTED -> [IN_PROGRESS]', () => {
      expect(getValidNextStatuses('NOT_STARTED')).toEqual(['IN_PROGRESS'])
    })

    it('IN_PROGRESS -> [READY_FOR_REVIEW, BLOCKED]', () => {
      expect(getValidNextStatuses('IN_PROGRESS')).toEqual(['READY_FOR_REVIEW', 'BLOCKED'])
    })

    it('COMPLETED -> [] (empty)', () => {
      expect(getValidNextStatuses('COMPLETED')).toEqual([])
    })
  })
})

// ── 3. Timesheet State Machine Integrity ──────────────────

describe('Timesheet state machine integrity', () => {
  describe('Valid transitions', () => {
    it('DRAFT -> SUBMITTED', () => {
      expect(isValidTimesheetTransition('DRAFT', 'SUBMITTED')).toBe(true)
    })

    it('SUBMITTED -> APPROVED', () => {
      expect(isValidTimesheetTransition('SUBMITTED', 'APPROVED')).toBe(true)
    })

    it('SUBMITTED -> REJECTED', () => {
      expect(isValidTimesheetTransition('SUBMITTED', 'REJECTED')).toBe(true)
    })

    it('SUBMITTED -> CHANGES_REQUIRED', () => {
      expect(isValidTimesheetTransition('SUBMITTED', 'CHANGES_REQUIRED')).toBe(true)
    })

    it('APPROVED -> LOCKED', () => {
      expect(isValidTimesheetTransition('APPROVED', 'LOCKED')).toBe(true)
    })

    it('APPROVED -> REOPENED', () => {
      expect(isValidTimesheetTransition('APPROVED', 'REOPENED')).toBe(true)
    })

    it('REJECTED -> DRAFT', () => {
      expect(isValidTimesheetTransition('REJECTED', 'DRAFT')).toBe(true)
    })

    it('CHANGES_REQUIRED -> DRAFT', () => {
      expect(isValidTimesheetTransition('CHANGES_REQUIRED', 'DRAFT')).toBe(true)
    })

    it('CHANGES_REQUIRED -> SUBMITTED', () => {
      expect(isValidTimesheetTransition('CHANGES_REQUIRED', 'SUBMITTED')).toBe(true)
    })

    it('LOCKED -> REOPENED', () => {
      expect(isValidTimesheetTransition('LOCKED', 'REOPENED')).toBe(true)
    })

    it('REOPENED -> DRAFT', () => {
      expect(isValidTimesheetTransition('REOPENED', 'DRAFT')).toBe(true)
    })

    it('REOPENED -> SUBMITTED', () => {
      expect(isValidTimesheetTransition('REOPENED', 'SUBMITTED')).toBe(true)
    })
  })

  describe('Invalid transitions throw', () => {
    it('DRAFT -> APPROVED (skip submission)', () => {
      expect(() => validateTimesheetTransition('DRAFT', 'APPROVED')).toThrow()
    })

    it('DRAFT -> REJECTED (skip submission)', () => {
      expect(() => validateTimesheetTransition('DRAFT', 'REJECTED')).toThrow()
    })

    it('SUBMITTED -> DRAFT (wrong direction)', () => {
      expect(isValidTimesheetTransition('SUBMITTED', 'DRAFT')).toBe(false)
    })

    it('APPROVED -> SUBMITTED (wrong direction)', () => {
      expect(isValidTimesheetTransition('APPROVED', 'SUBMITTED')).toBe(false)
    })

    it('LOCKED -> APPROVED (wrong direction)', () => {
      expect(isValidTimesheetTransition('LOCKED', 'APPROVED')).toBe(false)
    })
  })

  describe('Role-based status buckets', () => {
    it('manager statuses include CHANGES_REQUIRED, APPROVED, REJECTED, LOCKED', () => {
      expect(MANAGER_STATUSES).toContain('CHANGES_REQUIRED')
      expect(MANAGER_STATUSES).toContain('APPROVED')
      expect(MANAGER_STATUSES).toContain('REJECTED')
      expect(MANAGER_STATUSES).toContain('LOCKED')
    })

    it('owner statuses include SUBMITTED and DRAFT', () => {
      expect(OWNER_STATUSES).toContain('SUBMITTED')
      expect(OWNER_STATUSES).toContain('DRAFT')
    })

    it('manager and owner status sets do not overlap', () => {
      const overlap = MANAGER_STATUSES.filter((s) => OWNER_STATUSES.includes(s))
      expect(overlap).toEqual([])
    })
  })
})

// ── 4. Expense Claim State Machine ────────────────────────
// No dedicated expense-transitions.ts exists; expenses use the generic
// request-transitions.ts (DRAFT -> SUBMITTED -> UNDER_REVIEW -> APPROVED/REJECTED).

describe('Expense claim state machine (uses request-transitions)', () => {
  it('DRAFT -> SUBMITTED', () => {
    expect(isValidRequestTransition('DRAFT', 'SUBMITTED')).toBe(true)
  })

  it('SUBMITTED -> UNDER_REVIEW', () => {
    expect(isValidRequestTransition('SUBMITTED', 'UNDER_REVIEW')).toBe(true)
  })

  it('UNDER_REVIEW -> APPROVED', () => {
    expect(isValidRequestTransition('UNDER_REVIEW', 'APPROVED')).toBe(true)
  })

  it('UNDER_REVIEW -> REJECTED', () => {
    expect(isValidRequestTransition('UNDER_REVIEW', 'REJECTED')).toBe(true)
  })

  it('APPROVED -> FULFILMENT_IN_PROGRESS', () => {
    expect(isValidRequestTransition('APPROVED', 'FULFILMENT_IN_PROGRESS')).toBe(true)
  })

  it('FULFILMENT_IN_PROGRESS -> COMPLETED', () => {
    expect(isValidRequestTransition('FULFILMENT_IN_PROGRESS', 'COMPLETED')).toBe(true)
  })

  it('REJECTED is terminal', () => {
    expect(isTerminalRequestStatus('REJECTED')).toBe(true)
  })

  it('COMPLETED is terminal', () => {
    expect(isTerminalRequestStatus('COMPLETED')).toBe(true)
  })

  it('WITHDRAWN is terminal', () => {
    expect(isTerminalRequestStatus('WITHDRAWN')).toBe(true)
  })

  it('DRAFT is not terminal', () => {
    expect(isTerminalRequestStatus('DRAFT')).toBe(false)
  })
})

// ── 5. Snag State Machine Integrity ───────────────────────

describe('Snag state machine integrity', () => {
  describe('Valid transitions', () => {
    it('OPEN -> ASSIGNED', () => {
      expect(isValidSnagTransition('OPEN', 'ASSIGNED')).toBe(true)
    })

    it('ASSIGNED -> RECTIFICATION_SUBMITTED', () => {
      expect(isValidSnagTransition('ASSIGNED', 'RECTIFICATION_SUBMITTED')).toBe(true)
    })

    it('RECTIFICATION_SUBMITTED -> VERIFICATION', () => {
      expect(isValidSnagTransition('RECTIFICATION_SUBMITTED', 'VERIFICATION')).toBe(true)
    })

    it('VERIFICATION -> CLOSED', () => {
      expect(isValidSnagTransition('VERIFICATION', 'CLOSED')).toBe(true)
    })

    it('VERIFICATION -> REOPENED', () => {
      expect(isValidSnagTransition('VERIFICATION', 'REOPENED')).toBe(true)
    })

    it('REOPENED -> ASSIGNED', () => {
      expect(isValidSnagTransition('REOPENED', 'ASSIGNED')).toBe(true)
    })
  })

  describe('Invalid transitions throw', () => {
    it('OPEN -> CLOSED (skip all stages)', () => {
      expect(() => validateSnagTransition('OPEN' as any, 'CLOSED' as any)).toThrow(ValidationError)
    })

    it('CLOSED -> OPEN (terminal state)', () => {
      expect(() => validateSnagTransition('CLOSED' as any, 'OPEN' as any)).toThrow(ValidationError)
    })

    it('CLOSED -> anything (terminal)', () => {
      expect(() => validateSnagTransition('CLOSED' as any, 'ASSIGNED' as any)).toThrow(
        'none (terminal state)',
      )
    })

    it('same-state transition throws', () => {
      expect(() => validateSnagTransition('OPEN' as any, 'OPEN' as any)).toThrow(
        'Snag is already OPEN',
      )
    })

    it('ASSIGNED -> CLOSED (skip rectification and verification)', () => {
      expect(isValidSnagTransition('ASSIGNED' as any, 'CLOSED' as any)).toBe(false)
    })
  })

  describe('Terminal status', () => {
    it('CLOSED is terminal', () => {
      expect(isTerminalSnagStatus('CLOSED' as any)).toBe(true)
    })

    it('OPEN is not terminal', () => {
      expect(isTerminalSnagStatus('OPEN' as any)).toBe(false)
    })

    it('ASSIGNED is not terminal', () => {
      expect(isTerminalSnagStatus('ASSIGNED' as any)).toBe(false)
    })
  })

  describe('getValidNextSnagStatuses', () => {
    it('OPEN -> [ASSIGNED]', () => {
      expect(getValidNextSnagStatuses('OPEN' as any)).toEqual(['ASSIGNED'])
    })

    it('VERIFICATION -> [CLOSED, REOPENED]', () => {
      expect(getValidNextSnagStatuses('VERIFICATION' as any)).toEqual(['CLOSED', 'REOPENED'])
    })

    it('CLOSED -> [] (empty)', () => {
      expect(getValidNextSnagStatuses('CLOSED' as any)).toEqual([])
    })
  })
})

// ── 6. Error Class Integrity ──────────────────────────────

describe('Error class integrity', () => {
  const errorCases: Array<[string, AppError, number, ErrorCode]> = [
    ['AuthError', new AuthError(), 401, ErrorCode.AUTH_REQUIRED],
    ['PermissionError', new PermissionError(), 403, ErrorCode.PERMISSION_DENIED],
    ['ValidationError', new ValidationError(), 400, ErrorCode.VALIDATION_FAILED],
    ['NotFoundError', new NotFoundError(), 404, ErrorCode.NOT_FOUND],
    ['ConflictError', new ConflictError(), 409, ErrorCode.CONFLICT],
    ['DatabaseError', new DatabaseError(), 500, ErrorCode.DATABASE_ERROR],
    ['ExternalServiceError', new ExternalServiceError(), 502, ErrorCode.EXTERNAL_SERVICE_ERROR],
    ['RateLimitedError', new RateLimitedError(), 429, ErrorCode.RATE_LIMITED],
  ]

  describe('every subclass has the correct statusCode', () => {
    it.each(errorCases)('%s has statusCode %i', (_name, err, expectedStatus) => {
      expect(err.statusCode).toBe(expectedStatus)
    })
  })

  describe('every subclass has the correct code', () => {
    it.each(errorCases)('%s has code %s', (_name, err, _status, expectedCode) => {
      expect(err.code).toBe(expectedCode)
    })
  })

  describe('toJSON() always returns { error: string, code: string }', () => {
    it.each(errorCases)('%s.toJSON() has error and code', (_name, err) => {
      const json = err.toJSON()
      expect(typeof json.error).toBe('string')
      expect(json.error.length).toBeGreaterThan(0)
      expect(typeof json.code).toBe('string')
      expect(json.code.length).toBeGreaterThan(0)
    })
  })

  describe('all errors extend AppError', () => {
    it.each(errorCases)('%s instanceof AppError', (_name, err) => {
      expect(err).toBeInstanceOf(AppError)
    })

    it.each(errorCases)('%s instanceof Error', (_name, err) => {
      expect(err).toBeInstanceOf(Error)
    })
  })

  describe('fromPrismaError maps all known codes correctly', () => {
    function makePrismaError(code: string, meta?: Record<string, unknown>): Error {
      const err = new Error(`Prisma ${code}`)
      ;(err as any).code = code
      if (meta) (err as any).meta = meta
      return err
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const prismaMapping: Array<[string, any, number]> = [
      ['P2002', ConflictError, 409],
      ['P2025', NotFoundError, 404],
      ['P2003', ValidationError, 400],
      ['P2014', ValidationError, 400],
      ['P2021', DatabaseError, 500],
      ['P2022', DatabaseError, 500],
    ]

    it.each(prismaMapping)('P-code %s maps to status %i', (code, ErrorClass, expectedStatus) => {
      const result = fromPrismaError(makePrismaError(code))
      expect(result).toBeInstanceOf(ErrorClass)
      expect(result.statusCode).toBe(expectedStatus)
    })

    it('unknown P-code maps to DatabaseError (500)', () => {
      const result = fromPrismaError(makePrismaError('P9999'))
      expect(result).toBeInstanceOf(DatabaseError)
      expect(result.statusCode).toBe(500)
    })

    it('formatAPIError passes through toJSON result correctly', () => {
      const allErrors = [
        new AuthError('auth msg'),
        new PermissionError('perm msg'),
        new ValidationError('val msg'),
        new NotFoundError('nf msg'),
        new ConflictError('conflict msg'),
        new DatabaseError('db msg'),
      ]

      for (const err of allErrors) {
        const formatted = formatAPIError(err)
        expect(formatted.body.error).toBe(err.message)
        expect(formatted.body.code).toBe(err.code)
        expect(formatted.statusCode).toBe(err.statusCode)
      }
    })
  })
})

// ── 7. Overlap Detection Integrity ────────────────────────

describe('Date overlap detection integrity', () => {
  it('exact same range overlaps', () => {
    const range = { startDate: new Date('2026-08-10'), endDate: new Date('2026-08-14') }
    expect(datesOverlap(range, range)).toBe(true)
  })

  it('adjacent ranges do NOT overlap (a ends day before b starts)', () => {
    const a = { startDate: new Date('2026-08-10'), endDate: new Date('2026-08-11') }
    const b = { startDate: new Date('2026-08-12'), endDate: new Date('2026-08-14') }
    expect(datesOverlap(a, b)).toBe(false)
  })

  it('adjacent ranges that share a boundary DO overlap', () => {
    const a = { startDate: new Date('2026-08-10'), endDate: new Date('2026-08-12') }
    const b = { startDate: new Date('2026-08-12'), endDate: new Date('2026-08-14') }
    expect(datesOverlap(a, b)).toBe(true)
  })

  it('b fully inside a overlaps', () => {
    const a = { startDate: new Date('2026-08-10'), endDate: new Date('2026-08-20') }
    const b = { startDate: new Date('2026-08-12'), endDate: new Date('2026-08-14') }
    expect(datesOverlap(a, b)).toBe(true)
  })

  it('a fully inside b overlaps', () => {
    const a = { startDate: new Date('2026-08-12'), endDate: new Date('2026-08-14') }
    const b = { startDate: new Date('2026-08-10'), endDate: new Date('2026-08-20') }
    expect(datesOverlap(a, b)).toBe(true)
  })

  it('findOverlappingRequest returns null for empty list', () => {
    const proposed = { startDate: new Date('2026-08-10'), endDate: new Date('2026-08-14') }
    expect(findOverlappingRequest(proposed, [])).toBeNull()
  })
})

// ── 8. Leave Validation Edge Cases ────────────────────────

describe('Leave validation edge cases', () => {
  it('single Friday is 1 working day', () => {
    // 2026-08-14 is Friday
    const result = validateLeaveRequest(new Date('2026-08-14'), new Date('2026-08-14'))
    expect(result.days).toBe(1)
  })

  it('Fri to Mon is 2 working days (skips weekend)', () => {
    // Fri 2026-08-14 to Mon 2026-08-17
    const result = validateLeaveRequest(new Date('2026-08-14'), new Date('2026-08-17'))
    expect(result.days).toBe(2)
  })

  it('rejects weekend-only request', () => {
    expect(() =>
      validateLeaveRequest(new Date('2026-08-08'), new Date('2026-08-09')),
    ).toThrow(ValidationError)
  })

  it('rejects backwards date range', () => {
    expect(() =>
      validateLeaveRequest(new Date('2026-08-20'), new Date('2026-08-10')),
    ).toThrow('End date must be on or after start date')
  })
})

import { describe, it, expect } from 'vitest'
import { isValidTimesheetTransition, validateTimesheetTransition, TIMESHEET_TRANSITIONS } from '@/lib/timesheet-transitions'

describe('Timesheet state machine', () => {
  it('DRAFT -> SUBMITTED is valid', () => {
    expect(isValidTimesheetTransition('DRAFT', 'SUBMITTED')).toBe(true)
  })

  it('SUBMITTED -> APPROVED is valid', () => {
    expect(isValidTimesheetTransition('SUBMITTED', 'APPROVED')).toBe(true)
  })

  it('SUBMITTED -> REJECTED is valid', () => {
    expect(isValidTimesheetTransition('SUBMITTED', 'REJECTED')).toBe(true)
  })

  it('SUBMITTED -> CHANGES_REQUIRED is valid', () => {
    expect(isValidTimesheetTransition('SUBMITTED', 'CHANGES_REQUIRED')).toBe(
      true,
    )
  })

  it('DRAFT -> APPROVED is invalid (must go through SUBMITTED)', () => {
    expect(isValidTimesheetTransition('DRAFT', 'APPROVED')).toBe(false)
  })

  it('APPROVED -> DRAFT is invalid (must go through REOPENED)', () => {
    expect(isValidTimesheetTransition('APPROVED', 'DRAFT')).toBe(false)
  })

  it('APPROVED -> LOCKED is valid', () => {
    expect(isValidTimesheetTransition('APPROVED', 'LOCKED')).toBe(true)
  })

  it('LOCKED -> REOPENED is valid', () => {
    expect(isValidTimesheetTransition('LOCKED', 'REOPENED')).toBe(true)
  })

  it('REJECTED -> DRAFT is valid (can resubmit)', () => {
    expect(isValidTimesheetTransition('REJECTED', 'DRAFT')).toBe(true)
  })

  it('CHANGES_REQUIRED -> SUBMITTED is valid (resubmit after changes)', () => {
    expect(isValidTimesheetTransition('CHANGES_REQUIRED', 'SUBMITTED')).toBe(
      true,
    )
  })
})

describe('validateTimesheetTransition (throwing variant)', () => {
  it('does not throw for a valid transition', () => {
    expect(() => validateTimesheetTransition('DRAFT', 'SUBMITTED')).not.toThrow()
  })

  it('throws Error for an invalid transition', () => {
    expect(() => validateTimesheetTransition('DRAFT', 'APPROVED')).toThrow(Error)
  })

  it('error message includes from, to, and allowed statuses', () => {
    expect(() => validateTimesheetTransition('DRAFT', 'APPROVED')).toThrow(
      'Cannot transition from DRAFT to APPROVED. Allowed: SUBMITTED',
    )
  })

  it('unknown from status throws with "Allowed: none"', () => {
    expect(() => validateTimesheetTransition('NONEXISTENT', 'DRAFT')).toThrow(
      'Cannot transition from NONEXISTENT to DRAFT. Allowed: none',
    )
  })
})

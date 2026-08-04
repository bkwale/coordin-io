import { describe, it, expect } from 'vitest'
import { isValidTimesheetTransition } from '@/lib/timesheet-transitions'

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

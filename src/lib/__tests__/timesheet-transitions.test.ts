import { describe, it, expect } from 'vitest'

/**
 * Timesheet state machine extracted from
 * /api/timesheets/[weekId]/route.ts lines 9-17.
 *
 * Unlike request-transitions (which is a shared module),
 * the timesheet transitions are defined inline in the route file.
 * We replicate the map here for pure-logic testing.
 */
const VALID_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ['SUBMITTED'],
  SUBMITTED: ['CHANGES_REQUIRED', 'APPROVED', 'REJECTED'],
  CHANGES_REQUIRED: ['DRAFT', 'SUBMITTED'],
  APPROVED: ['LOCKED', 'REOPENED'],
  REJECTED: ['DRAFT'],
  LOCKED: ['REOPENED'],
  REOPENED: ['DRAFT', 'SUBMITTED'],
}

function isValidTimesheetTransition(from: string, to: string): boolean {
  return (VALID_TRANSITIONS[from] ?? []).includes(to)
}

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

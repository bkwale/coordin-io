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
} from '../request-transitions'

/**
 * Service Request state machine tests.
 *
 * ServiceRequest uses the SAME RequestStatus state machine as
 * LeaveRequest and ExpenseClaim. These tests verify that the
 * state machine correctly supports the ServiceRequest lifecycle:
 *
 * DRAFT → SUBMITTED → UNDER_REVIEW → APPROVED → FULFILMENT_IN_PROGRESS → COMPLETED
 *                                   → REJECTED
 *       → WITHDRAWN
 *             → WITHDRAWN
 */

describe('ServiceRequest uses RequestStatus state machine', () => {
  /* ── Valid lifecycle paths ───────────────────────── */

  it('supports happy path: DRAFT → SUBMITTED → UNDER_REVIEW → APPROVED → FULFILMENT → COMPLETED', () => {
    expect(isValidRequestTransition('DRAFT', 'SUBMITTED')).toBe(true)
    expect(isValidRequestTransition('SUBMITTED', 'UNDER_REVIEW')).toBe(true)
    expect(isValidRequestTransition('UNDER_REVIEW', 'APPROVED')).toBe(true)
    expect(isValidRequestTransition('APPROVED', 'FULFILMENT_IN_PROGRESS')).toBe(true)
    expect(isValidRequestTransition('FULFILMENT_IN_PROGRESS', 'COMPLETED')).toBe(true)
  })

  it('supports rejection path: SUBMITTED → UNDER_REVIEW → REJECTED', () => {
    expect(isValidRequestTransition('SUBMITTED', 'UNDER_REVIEW')).toBe(true)
    expect(isValidRequestTransition('UNDER_REVIEW', 'REJECTED')).toBe(true)
  })

  it('supports withdrawal from DRAFT', () => {
    expect(isValidRequestTransition('DRAFT', 'WITHDRAWN')).toBe(true)
  })

  it('supports withdrawal from SUBMITTED', () => {
    expect(isValidRequestTransition('SUBMITTED', 'WITHDRAWN')).toBe(true)
  })

  /* ── Invalid transitions ────────────────────────── */

  it('prevents skipping states: DRAFT → APPROVED', () => {
    expect(isValidRequestTransition('DRAFT', 'APPROVED')).toBe(false)
  })

  it('prevents reverse: APPROVED → SUBMITTED', () => {
    expect(isValidRequestTransition('APPROVED', 'SUBMITTED')).toBe(false)
  })

  it('prevents re-opening completed: COMPLETED → DRAFT', () => {
    expect(isValidRequestTransition('COMPLETED', 'DRAFT')).toBe(false)
  })

  /* ── Role-based transition checks for ServiceRequest ── */

  it('SUBMITTED is a requester transition (requester submits their own request)', () => {
    expect(isRequesterTransition('SUBMITTED')).toBe(true)
  })

  it('WITHDRAWN is a requester transition', () => {
    expect(isRequesterTransition('WITHDRAWN')).toBe(true)
  })

  it('UNDER_REVIEW is an approver transition', () => {
    expect(isApproverTransition('UNDER_REVIEW')).toBe(true)
  })

  it('APPROVED is an approver transition', () => {
    expect(isApproverTransition('APPROVED')).toBe(true)
  })

  it('REJECTED is an approver transition', () => {
    expect(isApproverTransition('REJECTED')).toBe(true)
  })

  it('FULFILMENT_IN_PROGRESS is an admin transition', () => {
    expect(isAdminTransition('FULFILMENT_IN_PROGRESS')).toBe(true)
  })

  it('COMPLETED is an admin transition', () => {
    expect(isAdminTransition('COMPLETED')).toBe(true)
  })

  /* ── Terminal states ────────────────────────────── */

  it('REJECTED, COMPLETED, WITHDRAWN are terminal for service requests', () => {
    expect(isTerminalRequestStatus('REJECTED')).toBe(true)
    expect(isTerminalRequestStatus('COMPLETED')).toBe(true)
    expect(isTerminalRequestStatus('WITHDRAWN')).toBe(true)
  })

  it('DRAFT and SUBMITTED are not terminal', () => {
    expect(isTerminalRequestStatus('DRAFT')).toBe(false)
    expect(isTerminalRequestStatus('SUBMITTED')).toBe(false)
  })

  /* ── Validation throws ──────────────────────────── */

  it('validateRequestTransition throws for DRAFT → COMPLETED', () => {
    expect(() => validateRequestTransition('DRAFT', 'COMPLETED')).toThrow(/Cannot transition/)
  })

  it('validateRequestTransition does not throw for valid ServiceRequest flow', () => {
    expect(() => validateRequestTransition('DRAFT', 'SUBMITTED')).not.toThrow()
    expect(() => validateRequestTransition('SUBMITTED', 'UNDER_REVIEW')).not.toThrow()
    expect(() => validateRequestTransition('UNDER_REVIEW', 'APPROVED')).not.toThrow()
  })

  it('getValidNextRequestStatuses returns correct options at each step', () => {
    expect(getValidNextRequestStatuses('DRAFT')).toEqual(['SUBMITTED', 'WITHDRAWN'])
    expect(getValidNextRequestStatuses('UNDER_REVIEW')).toEqual(['APPROVED', 'REJECTED'])
    expect(getValidNextRequestStatuses('REJECTED')).toEqual([])
  })
})

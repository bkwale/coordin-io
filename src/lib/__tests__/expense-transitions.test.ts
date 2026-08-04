import { describe, it, expect } from 'vitest'
import {
  validateRequestTransition,
  isValidRequestTransition,
  isRequesterTransition,
  isApproverTransition,
  isAdminTransition,
} from '@/lib/request-transitions'
import { ValidationError } from '@/lib/errors'

/**
 * Expense claim state machine tests.
 *
 * Expense claims use the generic request transition flow from
 * request-transitions.ts. This test suite verifies the key
 * transitions relevant to expense claim workflows.
 */
describe('Expense claim state machine', () => {
  it('DRAFT -> SUBMITTED is valid', () => {
    expect(isValidRequestTransition('DRAFT', 'SUBMITTED')).toBe(true)
  })

  it('SUBMITTED -> UNDER_REVIEW -> APPROVED is valid (two steps)', () => {
    expect(isValidRequestTransition('SUBMITTED', 'UNDER_REVIEW')).toBe(true)
    expect(isValidRequestTransition('UNDER_REVIEW', 'APPROVED')).toBe(true)
  })

  it('UNDER_REVIEW -> REJECTED is valid', () => {
    expect(isValidRequestTransition('UNDER_REVIEW', 'REJECTED')).toBe(true)
  })

  it('DRAFT -> APPROVED is invalid (cannot skip SUBMITTED)', () => {
    expect(isValidRequestTransition('DRAFT', 'APPROVED')).toBe(false)
  })

  it('APPROVED -> DRAFT is invalid (cannot go backwards)', () => {
    expect(isValidRequestTransition('APPROVED', 'DRAFT')).toBe(false)
  })

  it('WITHDRAWN -> SUBMITTED is invalid (terminal state)', () => {
    expect(isValidRequestTransition('WITHDRAWN', 'SUBMITTED')).toBe(false)
  })

  it('validateRequestTransition throws ValidationError for invalid transitions', () => {
    expect(() => validateRequestTransition('DRAFT', 'APPROVED')).toThrow(
      ValidationError,
    )
  })

  it('validateRequestTransition does not throw for valid transitions', () => {
    expect(() =>
      validateRequestTransition('DRAFT', 'SUBMITTED'),
    ).not.toThrow()
  })
})

describe('Expense role-based transition checks', () => {
  it('SUBMITTED is a requester transition', () => {
    expect(isRequesterTransition('SUBMITTED')).toBe(true)
  })

  it('WITHDRAWN is a requester transition', () => {
    expect(isRequesterTransition('WITHDRAWN')).toBe(true)
  })

  it('APPROVED is an approver transition', () => {
    expect(isApproverTransition('APPROVED')).toBe(true)
  })

  it('REJECTED is an approver transition', () => {
    expect(isApproverTransition('REJECTED')).toBe(true)
  })

  it('UNDER_REVIEW is an approver transition', () => {
    expect(isApproverTransition('UNDER_REVIEW')).toBe(true)
  })

  it('COMPLETED is an admin transition', () => {
    expect(isAdminTransition('COMPLETED')).toBe(true)
  })

  it('FULFILMENT_IN_PROGRESS is an admin transition', () => {
    expect(isAdminTransition('FULFILMENT_IN_PROGRESS')).toBe(true)
  })

  it('CANCELLED is an admin transition', () => {
    expect(isAdminTransition('CANCELLED')).toBe(true)
  })
})

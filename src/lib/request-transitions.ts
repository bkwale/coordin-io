import type { RequestStatus } from '@/generated/prisma/client'
import { ValidationError } from '@/lib/errors'

/**
 * Request status transition state machine.
 * Shared across LeaveRequest, ExpenseClaim, and ServiceRequest.
 *
 * Valid transitions:
 *   DRAFT → SUBMITTED (by requester)
 *   DRAFT → WITHDRAWN (by requester)
 *   SUBMITTED → UNDER_REVIEW (by approver)
 *   SUBMITTED → WITHDRAWN (by requester)
 *   UNDER_REVIEW → APPROVED | REJECTED (by approver)
 *   APPROVED → FULFILMENT_IN_PROGRESS (by admin/system)
 *   FULFILMENT_IN_PROGRESS → COMPLETED (by admin/system)
 *   REJECTED → (terminal)
 *   COMPLETED → (terminal)
 *   WITHDRAWN → (terminal)
 */

const VALID_TRANSITIONS: Record<RequestStatus, RequestStatus[]> = {
  DRAFT: ['SUBMITTED', 'WITHDRAWN'],
  SUBMITTED: ['UNDER_REVIEW', 'WITHDRAWN'],
  UNDER_REVIEW: ['APPROVED', 'REJECTED'],
  APPROVED: ['FULFILMENT_IN_PROGRESS'],
  REJECTED: [],
  FULFILMENT_IN_PROGRESS: ['COMPLETED'],
  COMPLETED: [],
  WITHDRAWN: [],
}

/**
 * Transitions only the requester (owner) can perform.
 */
const REQUESTER_TRANSITIONS: RequestStatus[] = ['SUBMITTED', 'WITHDRAWN']

/**
 * Transitions only an approver/manager can perform.
 */
const APPROVER_TRANSITIONS: RequestStatus[] = ['UNDER_REVIEW', 'APPROVED', 'REJECTED']

/**
 * Transitions that require ADMIN or MANAGER permission.
 */
const ADMIN_TRANSITIONS: RequestStatus[] = ['FULFILMENT_IN_PROGRESS', 'COMPLETED']

// ── Public API ────────────────────────────────────────────

/**
 * Check if a request status transition is valid.
 */
export function isValidRequestTransition(from: RequestStatus, to: RequestStatus): boolean {
  if (from === to) return false
  return VALID_TRANSITIONS[from].includes(to)
}

/**
 * Validate a request status transition. Throws ValidationError if invalid.
 */
export function validateRequestTransition(from: RequestStatus, to: RequestStatus): void {
  if (from === to) {
    throw new ValidationError(`Request is already ${from}`)
  }
  if (!isValidRequestTransition(from, to)) {
    const allowed = VALID_TRANSITIONS[from]
    const allowedStr = allowed.length > 0 ? allowed.join(', ') : 'none (terminal state)'
    throw new ValidationError(
      `Cannot transition from ${from} to ${to}. Valid transitions: ${allowedStr}`,
      { from, to, validTransitions: allowedStr },
    )
  }
}

/**
 * Get all valid next statuses for a given request status.
 */
export function getValidNextRequestStatuses(status: RequestStatus): RequestStatus[] {
  return VALID_TRANSITIONS[status] ?? []
}

/**
 * Check if a transition requires being the requester (owner).
 */
export function isRequesterTransition(to: RequestStatus): boolean {
  return REQUESTER_TRANSITIONS.includes(to)
}

/**
 * Check if a transition requires being an approver/manager.
 */
export function isApproverTransition(to: RequestStatus): boolean {
  return APPROVER_TRANSITIONS.includes(to)
}

/**
 * Check if a transition requires admin-level access.
 */
export function isAdminTransition(to: RequestStatus): boolean {
  return ADMIN_TRANSITIONS.includes(to)
}

/**
 * Check if a request is in a terminal state.
 */
export function isTerminalRequestStatus(status: RequestStatus): boolean {
  return VALID_TRANSITIONS[status]?.length === 0
}

/**
 * Human-readable labels for request statuses.
 */
export const REQUEST_STATUS_LABELS: Record<RequestStatus, string> = {
  DRAFT: 'Draft',
  SUBMITTED: 'Submitted',
  UNDER_REVIEW: 'Under review',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  FULFILMENT_IN_PROGRESS: 'In progress',
  COMPLETED: 'Completed',
  WITHDRAWN: 'Withdrawn',
}

/**
 * Human-readable labels for leave types.
 */
export const LEAVE_TYPE_LABELS: Record<string, string> = {
  ANNUAL: 'Annual leave',
  SICK: 'Sick leave',
  COMPASSIONATE: 'Compassionate leave',
  UNPAID: 'Unpaid leave',
  PUBLIC_HOLIDAY: 'Public holiday',
}

// Export the transitions map for testing
export { VALID_TRANSITIONS }

import type { RequestStatus } from '@/generated/prisma/client'
import { ValidationError } from '@/lib/errors'

/**
 * Request status transition state machine.
 * Shared across LeaveRequest, ExpenseClaim, and ServiceRequest.
 *
 * Generic valid transitions:
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
 *
 * Leave-specific transitions (PRD S20 multi-stage approval):
 *   DRAFT → SUBMITTED (by requester)
 *   DRAFT → WITHDRAWN (by requester)
 *   SUBMITTED → LINE_MANAGER_APPROVED | REJECTED | WITHDRAWN
 *   LINE_MANAGER_APPROVED → HR_APPROVED | REJECTED
 *   HR_APPROVED → APPROVED | REJECTED
 *   APPROVED → CANCELLED (by admin)
 *   REJECTED → (terminal)
 *   CANCELLED → (terminal)
 *   WITHDRAWN → (terminal)
 */

const VALID_TRANSITIONS: Record<RequestStatus, RequestStatus[]> = {
  DRAFT: ['SUBMITTED', 'WITHDRAWN'],
  SUBMITTED: ['UNDER_REVIEW', 'WITHDRAWN'],
  UNDER_REVIEW: ['APPROVED', 'REJECTED'],
  LINE_MANAGER_APPROVED: ['HR_APPROVED', 'REJECTED'],
  HR_APPROVED: ['APPROVED', 'REJECTED'],
  APPROVED: ['FULFILMENT_IN_PROGRESS', 'CANCELLED'],
  REJECTED: [],
  FULFILMENT_IN_PROGRESS: ['COMPLETED'],
  COMPLETED: [],
  CANCELLED: [],
  WITHDRAWN: [],
}

/**
 * Leave-specific multi-stage approval workflow.
 * PRD S20: DRAFT → SUBMITTED → LINE_MANAGER_APPROVED → HR_APPROVED → APPROVED
 */
const LEAVE_TRANSITIONS: Record<RequestStatus, RequestStatus[]> = {
  DRAFT: ['SUBMITTED', 'WITHDRAWN'],
  SUBMITTED: ['LINE_MANAGER_APPROVED', 'REJECTED', 'WITHDRAWN'],
  LINE_MANAGER_APPROVED: ['HR_APPROVED', 'REJECTED'],
  HR_APPROVED: ['APPROVED', 'REJECTED'],
  APPROVED: ['CANCELLED'],
  REJECTED: [],
  CANCELLED: [],
  WITHDRAWN: [],
  // Not used in leave flow but required by type
  UNDER_REVIEW: [],
  FULFILMENT_IN_PROGRESS: [],
  COMPLETED: [],
}

/**
 * Transitions only the requester (owner) can perform.
 */
const REQUESTER_TRANSITIONS: RequestStatus[] = ['SUBMITTED', 'WITHDRAWN']

/**
 * Transitions only an approver/manager can perform.
 */
const APPROVER_TRANSITIONS: RequestStatus[] = [
  'UNDER_REVIEW', 'APPROVED', 'REJECTED',
  'LINE_MANAGER_APPROVED', 'HR_APPROVED',
]

/**
 * Transitions that require ADMIN or MANAGER permission.
 */
const ADMIN_TRANSITIONS: RequestStatus[] = ['FULFILMENT_IN_PROGRESS', 'COMPLETED', 'CANCELLED']

// ── Public API ────────────────────────────────────────────

/**
 * Check if a request status transition is valid (generic flow).
 */
export function isValidRequestTransition(from: RequestStatus, to: RequestStatus): boolean {
  if (from === to) return false
  return VALID_TRANSITIONS[from]?.includes(to) ?? false
}

/**
 * Check if a leave request status transition is valid (PRD S20 flow).
 */
export function isValidLeaveTransition(from: RequestStatus, to: RequestStatus): boolean {
  if (from === to) return false
  return LEAVE_TRANSITIONS[from]?.includes(to) ?? false
}

/**
 * Validate a request status transition. Throws ValidationError if invalid.
 */
export function validateRequestTransition(from: RequestStatus, to: RequestStatus): void {
  if (from === to) {
    throw new ValidationError(`Request is already ${from}`)
  }
  if (!isValidRequestTransition(from, to)) {
    const allowed = VALID_TRANSITIONS[from] ?? []
    const allowedStr = allowed.length > 0 ? allowed.join(', ') : 'none (terminal state)'
    throw new ValidationError(
      `Cannot transition from ${from} to ${to}. Valid transitions: ${allowedStr}`,
      { from, to, validTransitions: allowedStr },
    )
  }
}

/**
 * Validate a leave-specific status transition (PRD S20 multi-stage).
 * Throws ValidationError if invalid.
 */
export function validateLeaveTransition(from: RequestStatus, to: RequestStatus): void {
  if (from === to) {
    throw new ValidationError(`Leave request is already ${from}`)
  }
  if (!isValidLeaveTransition(from, to)) {
    const allowed = LEAVE_TRANSITIONS[from] ?? []
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
 * Get all valid next statuses for a leave request (PRD S20 flow).
 */
export function getValidNextLeaveStatuses(status: RequestStatus): RequestStatus[] {
  return LEAVE_TRANSITIONS[status] ?? []
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
export const REQUEST_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Draft',
  SUBMITTED: 'Submitted',
  UNDER_REVIEW: 'Under review',
  LINE_MANAGER_APPROVED: 'Manager approved',
  HR_APPROVED: 'HR approved',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  FULFILMENT_IN_PROGRESS: 'In progress',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
  WITHDRAWN: 'Withdrawn',
}

/**
 * Human-readable labels for leave types (all 13 PRD S20 types).
 */
export const LEAVE_TYPE_LABELS: Record<string, string> = {
  ANNUAL: 'Annual leave',
  SICK: 'Sick leave',
  COMPASSIONATE: 'Compassionate leave',
  PARENTAL: 'Parental leave',
  MATERNITY: 'Maternity leave',
  PATERNITY: 'Paternity leave',
  STUDY: 'Study leave',
  CPD_TRAINING: 'CPD / Training',
  UNPAID: 'Unpaid leave',
  TOIL: 'TOIL',
  BUSINESS_TRAVEL: 'Business travel',
  PUBLIC_HOLIDAY: 'Public holiday',
  OTHER: 'Other',
}

// Export the transitions maps for testing
export { VALID_TRANSITIONS, LEAVE_TRANSITIONS }

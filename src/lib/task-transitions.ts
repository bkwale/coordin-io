import type { TaskStatus } from '@/generated/prisma/client'
import { ValidationError } from '@/lib/errors'

/**
 * Task status transition state machine.
 *
 * Valid transitions:
 *   NOT_STARTED → IN_PROGRESS
 *   IN_PROGRESS → READY_FOR_REVIEW | BLOCKED
 *   BLOCKED → IN_PROGRESS
 *   READY_FOR_REVIEW → COMPLETED | CHANGES_REQUIRED
 *   CHANGES_REQUIRED → IN_PROGRESS
 *
 * Invalid transitions throw ValidationError.
 */

const VALID_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  NOT_STARTED: ['IN_PROGRESS'],
  IN_PROGRESS: ['READY_FOR_REVIEW', 'BLOCKED'],
  BLOCKED: ['IN_PROGRESS'],
  READY_FOR_REVIEW: ['COMPLETED', 'CHANGES_REQUIRED'],
  CHANGES_REQUIRED: ['IN_PROGRESS'],
  COMPLETED: [], // Terminal state — no transitions out
}

/**
 * Check if a task status transition is valid.
 */
export function isValidTransition(from: TaskStatus, to: TaskStatus): boolean {
  if (from === to) return false // No-op transitions are invalid
  const allowed = VALID_TRANSITIONS[from]
  return allowed.includes(to)
}

/**
 * Validate a task status transition. Throws ValidationError if invalid.
 */
export function validateTaskTransition(from: TaskStatus, to: TaskStatus): void {
  if (from === to) {
    throw new ValidationError(`Task is already ${from}`)
  }
  if (!isValidTransition(from, to)) {
    const allowed = VALID_TRANSITIONS[from]
    const allowedStr = allowed.length > 0 ? allowed.join(', ') : 'none (terminal state)'
    throw new ValidationError(
      `Cannot transition from ${from} to ${to}. Valid transitions: ${allowedStr}`,
      { from, to, validTransitions: allowedStr },
    )
  }
}

/**
 * Get all valid next statuses for a given task status.
 */
export function getValidNextStatuses(status: TaskStatus): TaskStatus[] {
  return VALID_TRANSITIONS[status] ?? []
}

/**
 * Check if a status requires a reviewer action (not the task owner).
 */
export function isReviewerTransition(to: TaskStatus): boolean {
  return to === 'COMPLETED' || to === 'CHANGES_REQUIRED'
}

/**
 * Check if a task is in a terminal state.
 */
export function isTerminalStatus(status: TaskStatus): boolean {
  return VALID_TRANSITIONS[status]?.length === 0
}

/**
 * Valid timesheet status transitions.
 * The timesheet lifecycle: DRAFT → SUBMITTED → APPROVED → LOCKED
 * with branches for CHANGES_REQUIRED, REJECTED, and REOPENED.
 */
export const TIMESHEET_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ['SUBMITTED'],
  SUBMITTED: ['CHANGES_REQUIRED', 'APPROVED', 'REJECTED'],
  CHANGES_REQUIRED: ['DRAFT', 'SUBMITTED'],
  APPROVED: ['LOCKED', 'REOPENED'],
  REJECTED: ['DRAFT'],
  LOCKED: ['REOPENED'],
  REOPENED: ['DRAFT', 'SUBMITTED'],
}

export const MANAGER_STATUSES = ['CHANGES_REQUIRED', 'APPROVED', 'REJECTED', 'LOCKED']
export const OWNER_STATUSES = ['SUBMITTED', 'DRAFT']

/**
 * Check if a timesheet status transition is valid.
 */
export function isValidTimesheetTransition(from: string, to: string): boolean {
  return (TIMESHEET_TRANSITIONS[from] ?? []).includes(to)
}

/**
 * Validate a timesheet transition — throws if invalid.
 */
export function validateTimesheetTransition(from: string, to: string): void {
  if (!isValidTimesheetTransition(from, to)) {
    const allowed = TIMESHEET_TRANSITIONS[from] ?? []
    throw new Error(
      `Cannot transition from ${from} to ${to}. Allowed: ${allowed.join(', ') || 'none'}`,
    )
  }
}

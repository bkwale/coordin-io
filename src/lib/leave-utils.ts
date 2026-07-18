import { ValidationError } from '@/lib/errors'

/**
 * Leave calculation utilities.
 *
 * All calculations use calendar days excluding weekends (Saturday/Sunday).
 * Public holidays are NOT automatically excluded — they should be
 * requested as PUBLIC_HOLIDAY leave type separately.
 */

// ── Working days ──────────────────────────────────────────

/**
 * Calculate the number of working days (Mon-Fri) between two dates, inclusive.
 * Both start and end dates count if they are working days.
 */
export function calculateWorkingDays(startDate: Date, endDate: Date): number {
  if (endDate < startDate) return 0

  let count = 0
  const current = new Date(startDate)
  current.setHours(0, 0, 0, 0)

  const end = new Date(endDate)
  end.setHours(0, 0, 0, 0)

  while (current <= end) {
    const day = current.getDay()
    if (day !== 0 && day !== 6) {
      count++
    }
    current.setDate(current.getDate() + 1)
  }

  return count
}

/**
 * Check if a date is a working day (Mon-Fri).
 */
export function isWorkingDay(date: Date): boolean {
  const day = date.getDay()
  return day !== 0 && day !== 6
}

// ── Balance checks ────────────────────────────────────────

export interface LeaveBalanceSummary {
  allocation: number
  used: number
  carriedForward: number
  pending: number // Days in SUBMITTED/UNDER_REVIEW requests
  available: number // allocation + carriedForward - used - pending
}

/**
 * Calculate available leave from balance data and pending requests.
 */
export function calculateLeaveBalance(
  allocation: number,
  used: number,
  carriedForward: number,
  pendingDays: number,
): LeaveBalanceSummary {
  const available = allocation + carriedForward - used - pendingDays
  return {
    allocation,
    used,
    carriedForward,
    pending: pendingDays,
    available: Math.max(0, available),
  }
}

/**
 * Check if a user has enough leave balance for a request.
 * Returns the shortfall (0 if sufficient).
 */
export function checkLeaveBalance(
  available: number,
  requestedDays: number,
): { sufficient: boolean; shortfall: number } {
  const shortfall = Math.max(0, requestedDays - available)
  return { sufficient: shortfall === 0, shortfall }
}

// ── Overlap detection ─────────────────────────────────────

export interface DateRange {
  startDate: Date
  endDate: Date
}

/**
 * Check if two date ranges overlap.
 * Returns true if there is any overlap.
 */
export function datesOverlap(a: DateRange, b: DateRange): boolean {
  return a.startDate <= b.endDate && b.startDate <= a.endDate
}

/**
 * Check if a proposed leave request overlaps with any existing requests.
 * Returns the first overlapping request or null.
 */
export function findOverlappingRequest<T extends DateRange & { id: string }>(
  proposed: DateRange,
  existingRequests: T[],
): T | null {
  for (const existing of existingRequests) {
    if (datesOverlap(proposed, existing)) {
      return existing
    }
  }
  return null
}

// ── Validation ────────────────────────────────────────────

/**
 * Validate a leave request's dates and calculate days.
 * Throws ValidationError for invalid inputs.
 */
export function validateLeaveRequest(
  startDate: Date,
  endDate: Date,
): { days: number } {
  const now = new Date()
  now.setHours(0, 0, 0, 0)

  if (endDate < startDate) {
    throw new ValidationError('End date must be on or after start date')
  }

  const days = calculateWorkingDays(startDate, endDate)

  if (days === 0) {
    throw new ValidationError(
      'Leave request must include at least one working day (Mon-Fri)',
    )
  }

  if (days > 25) {
    throw new ValidationError(
      `Leave request cannot exceed 25 working days (got ${days}). For extended leave, please contact HR.`,
    )
  }

  return { days }
}

// ── Formatting ────────────────────────────────────────────

/**
 * Format a number of days as a human-readable string.
 */
export function formatDays(days: number): string {
  if (days === 1) return '1 day'
  if (Number.isInteger(days)) return `${days} days`
  return `${days} days` // e.g. "0.5 days" for half-days
}

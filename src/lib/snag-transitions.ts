import type { SnagStatus, SnagCategory, SnagSeverity } from '@/generated/prisma/client'
import { ValidationError } from '@/lib/errors'

/**
 * Snag status transition state machine.
 *
 * Valid transitions:
 *   OPEN → ASSIGNED
 *   ASSIGNED → RECTIFICATION_SUBMITTED
 *   RECTIFICATION_SUBMITTED → VERIFICATION
 *   VERIFICATION → CLOSED | REOPENED
 *   REOPENED → ASSIGNED
 *   CLOSED → (terminal)
 *
 * Invalid transitions throw ValidationError.
 */

const VALID_SNAG_TRANSITIONS: Record<SnagStatus, SnagStatus[]> = {
  OPEN: ['ASSIGNED'],
  ASSIGNED: ['RECTIFICATION_SUBMITTED'],
  RECTIFICATION_SUBMITTED: ['VERIFICATION'],
  VERIFICATION: ['CLOSED', 'REOPENED'],
  REOPENED: ['ASSIGNED'],
  CLOSED: [], // Terminal state — no transitions out
}

/**
 * Check if a snag status transition is valid.
 */
export function isValidSnagTransition(from: SnagStatus, to: SnagStatus): boolean {
  if (from === to) return false // No-op transitions are invalid
  const allowed = VALID_SNAG_TRANSITIONS[from]
  return allowed.includes(to)
}

/**
 * Validate a snag status transition. Throws ValidationError if invalid.
 */
export function validateSnagTransition(from: SnagStatus, to: SnagStatus): void {
  if (from === to) {
    throw new ValidationError(`Snag is already ${from}`)
  }
  if (!isValidSnagTransition(from, to)) {
    const allowed = VALID_SNAG_TRANSITIONS[from]
    const allowedStr = allowed.length > 0 ? allowed.join(', ') : 'none (terminal state)'
    throw new ValidationError(
      `Cannot transition from ${from} to ${to}. Valid transitions: ${allowedStr}`,
      { from, to, validTransitions: allowedStr },
    )
  }
}

/**
 * Get all valid next statuses for a given snag status.
 */
export function getValidNextSnagStatuses(status: SnagStatus): SnagStatus[] {
  return VALID_SNAG_TRANSITIONS[status] ?? []
}

/**
 * Check if a snag status is terminal (no further transitions).
 */
export function isTerminalSnagStatus(status: SnagStatus): boolean {
  return VALID_SNAG_TRANSITIONS[status]?.length === 0
}

/* ── Human-readable labels ──────────────────────────────── */

export const SNAG_STATUS_LABELS: Record<SnagStatus, string> = {
  OPEN: 'Open',
  ASSIGNED: 'Assigned',
  RECTIFICATION_SUBMITTED: 'Rectification submitted',
  VERIFICATION: 'Verification',
  CLOSED: 'Closed',
  REOPENED: 'Reopened',
}

export const SNAG_CATEGORY_LABELS: Record<SnagCategory, string> = {
  ARCHITECTURAL: 'Architectural',
  MEP: 'MEP',
  STRUCTURAL: 'Structural',
  FIRE: 'Fire',
  HEALTH_SAFETY: 'Health & Safety',
  FINISH: 'Finish',
  FF_AND_E: 'FF&E',
  EXTERNAL_WORKS: 'External works',
}

export const SNAG_SEVERITY_LABELS: Record<SnagSeverity, string> = {
  MINOR: 'Minor',
  MODERATE: 'Moderate',
  MAJOR: 'Major',
  SAFETY_CRITICAL: 'Safety critical',
}

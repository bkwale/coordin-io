import { ValidationError } from '@/lib/errors'

/**
 * Observation status transition state machine.
 *
 * Valid transitions:
 *   OPEN -> ASSIGNED
 *   ASSIGNED -> IN_PROGRESS
 *   IN_PROGRESS -> RESOLVED
 *   RESOLVED -> CLOSED | REOPENED
 *   REOPENED -> ASSIGNED
 *   CLOSED -> (terminal)
 *
 * Invalid transitions throw ValidationError.
 */

type ObservationStatus = 'OPEN' | 'ASSIGNED' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED' | 'REOPENED'

const VALID_OBSERVATION_TRANSITIONS: Record<ObservationStatus, ObservationStatus[]> = {
  OPEN: ['ASSIGNED'],
  ASSIGNED: ['IN_PROGRESS'],
  IN_PROGRESS: ['RESOLVED'],
  RESOLVED: ['CLOSED', 'REOPENED'],
  REOPENED: ['ASSIGNED'],
  CLOSED: [], // Terminal state
}

/**
 * Check if an observation status transition is valid.
 */
export function isValidObservationTransition(from: string, to: string): boolean {
  if (from === to) return false
  const allowed = VALID_OBSERVATION_TRANSITIONS[from as ObservationStatus]
  if (!allowed) return false
  return allowed.includes(to as ObservationStatus)
}

/**
 * Validate an observation status transition. Throws ValidationError if invalid.
 */
export function validateObservationTransition(from: string, to: string): void {
  if (from === to) {
    throw new ValidationError(`Observation is already ${from}`)
  }
  if (!isValidObservationTransition(from, to)) {
    const allowed = VALID_OBSERVATION_TRANSITIONS[from as ObservationStatus]
    const allowedStr = allowed && allowed.length > 0 ? allowed.join(', ') : 'none (terminal state)'
    throw new ValidationError(
      `Cannot transition from ${from} to ${to}. Valid transitions: ${allowedStr}`,
      { from, to, validTransitions: allowedStr },
    )
  }
}

/**
 * Get all valid next statuses for a given observation status.
 */
export function getValidNextObservationStatuses(status: string): string[] {
  return VALID_OBSERVATION_TRANSITIONS[status as ObservationStatus] ?? []
}

export const OBSERVATION_STATUS_LABELS: Record<string, string> = {
  OPEN: 'Open',
  ASSIGNED: 'Assigned',
  IN_PROGRESS: 'In progress',
  RESOLVED: 'Resolved',
  CLOSED: 'Closed',
  REOPENED: 'Reopened',
}

export const OBSERVATION_SEVERITY_LABELS: Record<string, string> = {
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High',
  CRITICAL: 'Critical',
}

export const OBSERVATION_CATEGORIES = [
  'Structural',
  'Services',
  'Finishes',
  'External',
  'Safety',
  'Quality',
] as const

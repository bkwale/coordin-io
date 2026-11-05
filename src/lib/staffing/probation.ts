/**
 * Probation — one definition used by every screen and count (COORD-BUG-016).
 *
 * The employee's probationStatus is the single source of truth:
 *  - in probation  = PROBATION or EXTENDED
 *  - closed        = CONFIRMED, COMPLETED, HISTORIC (completed before Coordin), NOT_APPLICABLE
 * Reviews for closed employees never count as pending or overdue.
 * Inconsistent records are flagged for HR to correct; we never guess dates.
 */
export const PROBATION_STATUS_OPTIONS = [
  { value: 'PROBATION', label: 'In probation' },
  { value: 'EXTENDED', label: 'Extended' },
  { value: 'CONFIRMED', label: 'Confirmed' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'HISTORIC', label: 'Completed (historic)' },
  { value: 'NOT_APPLICABLE', label: 'Not applicable' },
] as const

export const OPEN_PROBATION_STATUSES = ['PROBATION', 'EXTENDED'] as const
export const CLOSED_PROBATION_STATUSES = ['CONFIRMED', 'COMPLETED', 'HISTORIC', 'NOT_APPLICABLE'] as const
const ALL = PROBATION_STATUS_OPTIONS.map((o) => o.value) as readonly string[]

export const REVIEW_OUTCOMES = ['Pass', 'Extend', 'Fail'] as const

export function isValidProbationStatus(s: unknown): s is string { return typeof s === 'string' && ALL.includes(s) }
export function isInProbation(status: string | null | undefined): boolean {
  return !!status && (OPEN_PROBATION_STATUSES as readonly string[]).includes(status)
}
export function isProbationClosed(status: string | null | undefined): boolean {
  return !!status && (CLOSED_PROBATION_STATUSES as readonly string[]).includes(status)
}
export function probationStatusLabel(status: string | null | undefined): string {
  return PROBATION_STATUS_OPTIONS.find((o) => o.value === status)?.label ?? (status || 'Not set')
}

/** Normalise free-text outcomes (PASS, pass, Passed…) to Pass | Extend | Fail; null if unrecognised. */
export function normaliseOutcome(v: unknown): typeof REVIEW_OUTCOMES[number] | null {
  if (typeof v !== 'string') return null
  const s = v.trim().toLowerCase()
  if (s.startsWith('pass')) return 'Pass'
  if (s.startsWith('ext')) return 'Extend'
  if (s.startsWith('fail')) return 'Fail'
  return null
}

/** Is this review the end-of-probation decision? */
export function isFinalReview(reviewType: string): boolean {
  const t = reviewType.toLowerCase()
  return t === 'final' || t.includes('end-of-probation') || t.includes('end of probation')
}

/** Status the employee should move to after a final review outcome; null = leave for HR. */
export function statusAfterFinalReview(outcome: string | null): string | null {
  if (outcome === 'Pass') return 'CONFIRMED'
  if (outcome === 'Extend') return 'EXTENDED'
  return null
}

export type ProbationIssue = 'END_DATE_PASSED' | 'STARTS_BEFORE_EMPLOYMENT' | 'END_BEFORE_START' | 'MISSING_DATES'
export const ISSUE_LABELS: Record<ProbationIssue, string> = {
  END_DATE_PASSED: 'Probation end date has passed but status is still open — confirm, extend or mark historic',
  STARTS_BEFORE_EMPLOYMENT: 'Probation starts before the employment start date',
  END_BEFORE_START: 'Probation end date is before its start date',
  MISSING_DATES: 'In probation but start or end date is missing',
}

export function probationIssues(
  e: { probationStatus: string | null; probationStartDate: Date | string | null; probationEndDate: Date | string | null; employmentStartDate?: Date | string | null },
  now: Date = new Date(),
): ProbationIssue[] {
  const d = (x: Date | string | null | undefined) => (x ? new Date(x) : null)
  const start = d(e.probationStartDate), end = d(e.probationEndDate), emp = d(e.employmentStartDate)
  const day = (x: Date) => x.toISOString().slice(0, 10)
  const out: ProbationIssue[] = []
  if (start && end && day(end) < day(start)) out.push('END_BEFORE_START')
  if (start && emp && day(start) < day(emp)) out.push('STARTS_BEFORE_EMPLOYMENT')
  if (isInProbation(e.probationStatus)) {
    if (!start || !end) out.push('MISSING_DATES')
    else if (day(end) < day(now)) out.push('END_DATE_PASSED')
  }
  return out
}

/** Prisma `profile` filter: exclude employees whose probation is closed (null status or no employment record still counts). */
export function notClosedProfileFilter(organisationId: string) {
  return {
    organisationId,
    NOT: { employeeProfile: { is: { probationStatus: { in: [...CLOSED_PROBATION_STATUSES] } } } },
  }
}

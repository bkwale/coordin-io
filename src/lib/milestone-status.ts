/**
 * Milestone status calculation — pure function, fully testable.
 *
 * Rules (from build plan):
 * - All linked tasks NOT_STARTED → "Not Started" (UPCOMING)
 * - Any linked task IN_PROGRESS / BLOCKED / READY_FOR_REVIEW / CHANGES_REQUIRED → "In Progress" (DUE)
 * - All linked tasks COMPLETED → "Completed" (COMPLETED)
 * - Due date passed + not all complete → "Overdue" (OVERDUE)
 * - Manual override (CANCELLED or explicit status) takes precedence
 */

export type TaskStatusForCalc =
  | 'NOT_STARTED'
  | 'IN_PROGRESS'
  | 'BLOCKED'
  | 'READY_FOR_REVIEW'
  | 'CHANGES_REQUIRED'
  | 'COMPLETED'

export type MilestoneCalcStatus = 'UPCOMING' | 'DUE' | 'OVERDUE' | 'COMPLETED' | 'CANCELLED'

export interface MilestoneCalcInput {
  /** Current manual/stored status — if CANCELLED, always stays CANCELLED */
  currentStatus: string
  /** Due date of the milestone */
  dueDate: Date
  /** Statuses of all linked tasks (empty array = no linked tasks) */
  taskStatuses: TaskStatusForCalc[]
  /** Reference date for overdue check (default: now) */
  now?: Date
}

/**
 * Calculate milestone status from linked task statuses.
 * Returns the computed status string.
 */
export function calculateMilestoneStatus(input: MilestoneCalcInput): MilestoneCalcStatus {
  const { currentStatus, dueDate, taskStatuses, now = new Date() } = input

  // Manual override: CANCELLED always wins
  if (currentStatus === 'CANCELLED') return 'CANCELLED'

  // No linked tasks — fall back to date-based logic
  if (taskStatuses.length === 0) {
    // If manually completed, keep it
    if (currentStatus === 'COMPLETED') return 'COMPLETED'
    // Check overdue by date
    if (now > dueDate) return 'OVERDUE'
    return 'UPCOMING'
  }

  const allCompleted = taskStatuses.every((s) => s === 'COMPLETED')
  const allNotStarted = taskStatuses.every((s) => s === 'NOT_STARTED')
  const isPastDue = now > dueDate

  if (allCompleted) return 'COMPLETED'
  if (isPastDue) return 'OVERDUE'
  if (allNotStarted) return 'UPCOMING'

  // At least one task is in progress / blocked / review
  return 'DUE'
}

/**
 * Build a summary object for milestone task progress.
 */
export interface MilestoneTaskSummary {
  total: number
  completed: number
  inProgress: number
  blocked: number
  notStarted: number
  percentage: number
}

export function buildMilestoneTaskSummary(taskStatuses: TaskStatusForCalc[]): MilestoneTaskSummary {
  const total = taskStatuses.length
  if (total === 0) {
    return { total: 0, completed: 0, inProgress: 0, blocked: 0, notStarted: 0, percentage: 0 }
  }

  const completed = taskStatuses.filter((s) => s === 'COMPLETED').length
  const inProgress = taskStatuses.filter((s) =>
    s === 'IN_PROGRESS' || s === 'READY_FOR_REVIEW' || s === 'CHANGES_REQUIRED'
  ).length
  const blocked = taskStatuses.filter((s) => s === 'BLOCKED').length
  const notStarted = taskStatuses.filter((s) => s === 'NOT_STARTED').length

  return {
    total,
    completed,
    inProgress,
    blocked,
    notStarted,
    percentage: Math.round((completed / total) * 100),
  }
}

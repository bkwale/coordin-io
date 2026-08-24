import { describe, it, expect } from 'vitest'
import {
  calculateMilestoneStatus,
  buildMilestoneTaskSummary,
  type TaskStatusForCalc,
  type MilestoneCalcInput,
} from '@/lib/milestone-status'

describe('calculateMilestoneStatus', () => {
  const pastDate = new Date('2024-01-01')
  const futureDate = new Date('2030-12-31')
  const now = new Date('2026-08-24')

  function calc(overrides: Partial<MilestoneCalcInput>): string {
    return calculateMilestoneStatus({
      currentStatus: 'UPCOMING',
      dueDate: futureDate,
      taskStatuses: [],
      now,
      ...overrides,
    })
  }

  // ── No linked tasks ───────────────────────────────────
  it('returns UPCOMING when no tasks and due date is in the future', () => {
    expect(calc({ taskStatuses: [] })).toBe('UPCOMING')
  })

  it('returns OVERDUE when no tasks and due date has passed', () => {
    expect(calc({ dueDate: pastDate })).toBe('OVERDUE')
  })

  it('preserves COMPLETED when no tasks and manually set to COMPLETED', () => {
    expect(calc({ currentStatus: 'COMPLETED' })).toBe('COMPLETED')
  })

  // ── CANCELLED always wins ─────────────────────────────
  it('returns CANCELLED regardless of tasks or date', () => {
    expect(calc({
      currentStatus: 'CANCELLED',
      taskStatuses: ['IN_PROGRESS', 'COMPLETED'],
      dueDate: pastDate,
    })).toBe('CANCELLED')
  })

  // ── All tasks NOT_STARTED ─────────────────────────────
  it('returns UPCOMING when all tasks NOT_STARTED and due date is future', () => {
    expect(calc({
      taskStatuses: ['NOT_STARTED', 'NOT_STARTED', 'NOT_STARTED'],
    })).toBe('UPCOMING')
  })

  it('returns OVERDUE when all tasks NOT_STARTED but due date passed', () => {
    expect(calc({
      taskStatuses: ['NOT_STARTED', 'NOT_STARTED'],
      dueDate: pastDate,
    })).toBe('OVERDUE')
  })

  // ── All tasks COMPLETED ───────────────────────────────
  it('returns COMPLETED when all tasks are COMPLETED', () => {
    expect(calc({
      taskStatuses: ['COMPLETED', 'COMPLETED', 'COMPLETED'],
    })).toBe('COMPLETED')
  })

  it('returns COMPLETED when all tasks COMPLETED even if past due', () => {
    expect(calc({
      taskStatuses: ['COMPLETED', 'COMPLETED'],
      dueDate: pastDate,
    })).toBe('COMPLETED')
  })

  // ── Mixed statuses ────────────────────────────────────
  it('returns DUE when some tasks IN_PROGRESS and due date is future', () => {
    expect(calc({
      taskStatuses: ['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED'],
    })).toBe('DUE')
  })

  it('returns DUE when tasks are BLOCKED but due date is future', () => {
    expect(calc({
      taskStatuses: ['BLOCKED', 'NOT_STARTED'],
    })).toBe('DUE')
  })

  it('returns DUE when tasks are READY_FOR_REVIEW', () => {
    expect(calc({
      taskStatuses: ['READY_FOR_REVIEW', 'COMPLETED'],
    })).toBe('DUE')
  })

  it('returns DUE when tasks have CHANGES_REQUIRED', () => {
    expect(calc({
      taskStatuses: ['CHANGES_REQUIRED', 'NOT_STARTED'],
    })).toBe('DUE')
  })

  it('returns OVERDUE when mixed statuses and due date passed', () => {
    expect(calc({
      taskStatuses: ['IN_PROGRESS', 'NOT_STARTED'],
      dueDate: pastDate,
    })).toBe('OVERDUE')
  })

  // ── Single task edge cases ────────────────────────────
  it('returns COMPLETED for single COMPLETED task', () => {
    expect(calc({ taskStatuses: ['COMPLETED'] })).toBe('COMPLETED')
  })

  it('returns UPCOMING for single NOT_STARTED task', () => {
    expect(calc({ taskStatuses: ['NOT_STARTED'] })).toBe('UPCOMING')
  })

  it('returns DUE for single IN_PROGRESS task', () => {
    expect(calc({ taskStatuses: ['IN_PROGRESS'] })).toBe('DUE')
  })
})

describe('buildMilestoneTaskSummary', () => {
  it('returns zeros for empty array', () => {
    const result = buildMilestoneTaskSummary([])
    expect(result).toEqual({
      total: 0,
      completed: 0,
      inProgress: 0,
      blocked: 0,
      notStarted: 0,
      percentage: 0,
    })
  })

  it('counts all categories correctly', () => {
    const statuses: TaskStatusForCalc[] = [
      'NOT_STARTED',
      'IN_PROGRESS',
      'BLOCKED',
      'READY_FOR_REVIEW',
      'CHANGES_REQUIRED',
      'COMPLETED',
      'COMPLETED',
    ]
    const result = buildMilestoneTaskSummary(statuses)
    expect(result.total).toBe(7)
    expect(result.completed).toBe(2)
    expect(result.inProgress).toBe(3) // IN_PROGRESS + READY_FOR_REVIEW + CHANGES_REQUIRED
    expect(result.blocked).toBe(1)
    expect(result.notStarted).toBe(1)
    expect(result.percentage).toBe(29) // 2/7 = ~28.6, rounded to 29
  })

  it('returns 100% when all completed', () => {
    const result = buildMilestoneTaskSummary(['COMPLETED', 'COMPLETED', 'COMPLETED'])
    expect(result.percentage).toBe(100)
    expect(result.completed).toBe(3)
    expect(result.total).toBe(3)
  })

  it('returns 0% when none completed', () => {
    const result = buildMilestoneTaskSummary(['NOT_STARTED', 'IN_PROGRESS'])
    expect(result.percentage).toBe(0)
    expect(result.completed).toBe(0)
  })

  it('handles single task', () => {
    const result = buildMilestoneTaskSummary(['BLOCKED'])
    expect(result.total).toBe(1)
    expect(result.blocked).toBe(1)
    expect(result.percentage).toBe(0)
  })
})

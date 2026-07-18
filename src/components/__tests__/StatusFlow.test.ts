import { describe, it, expect } from 'vitest'
import { VALID_TRANSITIONS, STATUS_META, type TaskStatus } from '../StatusFlow'

/**
 * Tests for the StatusFlow component's data model and state machine.
 *
 * These tests verify the frontend's transition map mirrors the server-side
 * state machine exactly, ensuring the UI only shows valid actions.
 */

/* ── Server-side truth (from src/lib/task-transitions.ts) ─ */

const SERVER_TRANSITIONS: Record<string, string[]> = {
  NOT_STARTED: ['IN_PROGRESS'],
  IN_PROGRESS: ['READY_FOR_REVIEW', 'BLOCKED'],
  BLOCKED: ['IN_PROGRESS'],
  READY_FOR_REVIEW: ['COMPLETED', 'CHANGES_REQUIRED'],
  CHANGES_REQUIRED: ['IN_PROGRESS'],
  COMPLETED: [],
}

describe('StatusFlow state machine', () => {
  it('has the same status keys as the server', () => {
    const clientKeys = Object.keys(VALID_TRANSITIONS).sort()
    const serverKeys = Object.keys(SERVER_TRANSITIONS).sort()
    expect(clientKeys).toEqual(serverKeys)
  })

  it('has the same transitions as the server for every status', () => {
    for (const [status, serverNext] of Object.entries(SERVER_TRANSITIONS)) {
      const clientNext = VALID_TRANSITIONS[status as TaskStatus]
      expect(clientNext.sort()).toEqual([...serverNext].sort())
    }
  })

  it('NOT_STARTED can only go to IN_PROGRESS', () => {
    expect(VALID_TRANSITIONS.NOT_STARTED).toEqual(['IN_PROGRESS'])
  })

  it('IN_PROGRESS can go to READY_FOR_REVIEW or BLOCKED', () => {
    expect(VALID_TRANSITIONS.IN_PROGRESS).toContain('READY_FOR_REVIEW')
    expect(VALID_TRANSITIONS.IN_PROGRESS).toContain('BLOCKED')
    expect(VALID_TRANSITIONS.IN_PROGRESS).toHaveLength(2)
  })

  it('BLOCKED can only go back to IN_PROGRESS', () => {
    expect(VALID_TRANSITIONS.BLOCKED).toEqual(['IN_PROGRESS'])
  })

  it('READY_FOR_REVIEW can go to COMPLETED or CHANGES_REQUIRED', () => {
    expect(VALID_TRANSITIONS.READY_FOR_REVIEW).toContain('COMPLETED')
    expect(VALID_TRANSITIONS.READY_FOR_REVIEW).toContain('CHANGES_REQUIRED')
    expect(VALID_TRANSITIONS.READY_FOR_REVIEW).toHaveLength(2)
  })

  it('CHANGES_REQUIRED can only go back to IN_PROGRESS', () => {
    expect(VALID_TRANSITIONS.CHANGES_REQUIRED).toEqual(['IN_PROGRESS'])
  })

  it('COMPLETED is a terminal state with no transitions', () => {
    expect(VALID_TRANSITIONS.COMPLETED).toEqual([])
  })
})

describe('STATUS_META labels', () => {
  it('has metadata for every valid status', () => {
    const statuses: TaskStatus[] = ['NOT_STARTED', 'IN_PROGRESS', 'BLOCKED', 'READY_FOR_REVIEW', 'CHANGES_REQUIRED', 'COMPLETED']
    for (const status of statuses) {
      const meta = STATUS_META[status]
      expect(meta).toBeDefined()
      expect(meta.label).toBeTruthy()
      expect(meta.color).toBeTruthy()
      expect(meta.bgColor).toBeTruthy()
      expect(meta.dotColor).toBeTruthy()
    }
  })

  it('labels are human-readable (not raw enum values)', () => {
    expect(STATUS_META.NOT_STARTED.label).toBe('Not started')
    expect(STATUS_META.IN_PROGRESS.label).toBe('In progress')
    expect(STATUS_META.READY_FOR_REVIEW.label).toBe('In review')
    expect(STATUS_META.COMPLETED.label).toBe('Completed')
    expect(STATUS_META.BLOCKED.label).toBe('Blocked')
    expect(STATUS_META.CHANGES_REQUIRED.label).toBe('Changes needed')
  })
})

describe('Reviewer-only transitions', () => {
  const REVIEWER_ONLY: TaskStatus[] = ['COMPLETED', 'CHANGES_REQUIRED']

  it('COMPLETED and CHANGES_REQUIRED are only reachable from READY_FOR_REVIEW', () => {
    for (const [fromStatus, nextStatuses] of Object.entries(VALID_TRANSITIONS)) {
      for (const reviewerOnlyStatus of REVIEWER_ONLY) {
        if (nextStatuses.includes(reviewerOnlyStatus)) {
          expect(fromStatus).toBe('READY_FOR_REVIEW')
        }
      }
    }
  })

  it('no other status can transition to COMPLETED', () => {
    const canReachCompleted = Object.entries(VALID_TRANSITIONS)
      .filter(([_, next]) => next.includes('COMPLETED'))
      .map(([from]) => from)

    expect(canReachCompleted).toEqual(['READY_FOR_REVIEW'])
  })
})

describe('No self-transitions', () => {
  it('no status lists itself as a valid next status', () => {
    for (const [status, nextStatuses] of Object.entries(VALID_TRANSITIONS)) {
      expect(nextStatuses).not.toContain(status)
    }
  })
})

describe('Reachability', () => {
  it('every non-terminal status can reach COMPLETED eventually', () => {
    const statuses: TaskStatus[] = ['NOT_STARTED', 'IN_PROGRESS', 'BLOCKED', 'READY_FOR_REVIEW', 'CHANGES_REQUIRED']

    for (const start of statuses) {
      const visited = new Set<string>()
      const queue = [start]

      while (queue.length > 0) {
        const current = queue.shift()!
        if (visited.has(current)) continue
        visited.add(current)
        const next = VALID_TRANSITIONS[current as TaskStatus] ?? []
        queue.push(...next)
      }

      expect(visited.has('COMPLETED')).toBe(true)
    }
  })
})

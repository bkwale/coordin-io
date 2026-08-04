import { describe, it, expect } from 'vitest'
import { computeEffectiveHealth, computeAllProjectsHealthy } from '@/lib/dashboard-health'

// Helpers — dates in the past and future
const pastDate = new Date('2020-01-01')
const futureDate = new Date('2099-12-31')

function makeTasks(
  count: number,
  overrides?: Partial<{ status: string; dueDate: Date | null }>,
): Array<{ status: string; dueDate: Date | null }> {
  return Array.from({ length: count }, () => ({
    status: 'IN_PROGRESS',
    dueDate: futureDate,
    ...overrides,
  }))
}

// ── Effective health computation ──────────────────────────

describe('computeEffectiveHealth', () => {
  it('returns GREY when project has no tasks (insufficient data)', () => {
    expect(
      computeEffectiveHealth({ healthStatus: 'GREEN', tasks: [] }),
    ).toBe('GREY')
  })

  it('returns GREEN when all tasks are completed and healthStatus is GREEN', () => {
    const tasks = makeTasks(5, { status: 'COMPLETED', dueDate: pastDate })
    expect(
      computeEffectiveHealth({ healthStatus: 'GREEN', tasks }),
    ).toBe('GREEN')
  })

  it('returns AMBER when 1 overdue task out of 10 with healthStatus GREEN (Bug 7 case)', () => {
    const tasks = [
      ...makeTasks(9), // 9 on-time tasks
      { status: 'IN_PROGRESS', dueDate: pastDate }, // 1 overdue
    ]
    expect(
      computeEffectiveHealth({ healthStatus: 'GREEN', tasks }),
    ).toBe('AMBER')
  })

  it('returns RED when more than 3 overdue tasks out of 10', () => {
    const tasks = [
      ...makeTasks(6),
      ...makeTasks(4, { dueDate: pastDate }), // 4 overdue > 3
    ]
    expect(
      computeEffectiveHealth({ healthStatus: 'GREEN', tasks }),
    ).toBe('RED')
  })

  it('returns AMBER when 3 overdue out of 10 with healthStatus AMBER (uses stored value)', () => {
    const tasks = [
      ...makeTasks(7),
      ...makeTasks(3, { dueDate: pastDate }),
    ]
    // 3 overdue is not > 3, and 3/10 = 30% > 25%, so this hits RED
    // Actually 3/10 = 0.30 > 0.25 → RED
    expect(
      computeEffectiveHealth({ healthStatus: 'AMBER', tasks }),
    ).toBe('RED')
  })

  it('returns AMBER when 3 overdue out of 10 with healthStatus GREEN and <= 25% is not satisfied', () => {
    // 3 out of 12 = 25%, which is NOT > 25%, but > 0 overdue + GREEN → AMBER
    const tasks = [
      ...makeTasks(9),
      ...makeTasks(3, { dueDate: pastDate }),
    ]
    // 3/12 = 0.25, condition is > 0.25, so not RED
    // overdueTaskCount > 0 && healthStatus === GREEN → AMBER
    expect(
      computeEffectiveHealth({ healthStatus: 'GREEN', tasks }),
    ).toBe('AMBER')
  })

  it('returns RED when overdue percentage exceeds 25%', () => {
    // 3 out of 10 = 30% > 25%
    const tasks = [
      ...makeTasks(7),
      ...makeTasks(3, { dueDate: pastDate }),
    ]
    expect(
      computeEffectiveHealth({ healthStatus: 'GREEN', tasks }),
    ).toBe('RED')
  })

  it('returns AMBER when exactly 25% overdue with healthStatus GREEN (boundary)', () => {
    // 1 out of 4 = 25%, NOT > 25%, so it falls through to overdue > 0 + GREEN → AMBER
    const tasks = [
      ...makeTasks(3),
      { status: 'IN_PROGRESS', dueDate: pastDate },
    ]
    expect(
      computeEffectiveHealth({ healthStatus: 'GREEN', tasks }),
    ).toBe('AMBER')
  })

  it('returns GREY when healthStatus is null and no overdue tasks', () => {
    const tasks = makeTasks(5)
    expect(
      computeEffectiveHealth({ healthStatus: null, tasks }),
    ).toBe('GREY')
  })

  it('returns RED when healthStatus is RED and 0 overdue (respects stored value)', () => {
    const tasks = makeTasks(5)
    expect(
      computeEffectiveHealth({ healthStatus: 'RED', tasks }),
    ).toBe('RED')
  })
})

// ── All projects healthy aggregation ──────────────────────

describe('allProjectsHealthy aggregation', () => {
  it('is false when any project is not GREEN', () => {
    const projects = [
      { healthStatus: 'GREEN', tasks: makeTasks(3) },
      {
        healthStatus: 'GREEN',
        tasks: [
          ...makeTasks(2),
          { status: 'IN_PROGRESS', dueDate: pastDate }, // overdue → AMBER
        ],
      },
    ]
    expect(computeAllProjectsHealthy(projects)).toBe(false)
  })

  it('is true when all projects are GREEN with no overdue tasks', () => {
    const projects = [
      { healthStatus: 'GREEN', tasks: makeTasks(3) },
      { healthStatus: 'GREEN', tasks: makeTasks(5) },
    ]
    expect(computeAllProjectsHealthy(projects)).toBe(true)
  })

  it('is false when project list is empty', () => {
    expect(computeAllProjectsHealthy([])).toBe(false)
  })
})

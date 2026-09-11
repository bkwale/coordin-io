import { describe, it, expect } from 'vitest'
import {
  buildProjectTaskNumberMap,
  buildMilestoneNumberMap,
  buildMilestoneTaskPositionMap,
  formatProjectTaskNumber,
  formatMilestoneTaskNumber,
} from '@/lib/task-numbering'

describe('buildProjectTaskNumberMap', () => {
  it('assigns 1-based sequential positions', () => {
    const tasks = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]
    const map = buildProjectTaskNumberMap(tasks)
    expect(map.get('a')).toBe(1)
    expect(map.get('b')).toBe(2)
    expect(map.get('c')).toBe(3)
  })

  it('returns empty map for no tasks', () => {
    const map = buildProjectTaskNumberMap([])
    expect(map.size).toBe(0)
  })
})

describe('buildMilestoneNumberMap', () => {
  it('assigns 1-based sequential positions to milestones', () => {
    const milestones = [{ id: 'm1' }, { id: 'm2' }, { id: 'm3' }]
    const map = buildMilestoneNumberMap(milestones)
    expect(map.get('m1')).toBe(1)
    expect(map.get('m2')).toBe(2)
    expect(map.get('m3')).toBe(3)
  })
})

describe('buildMilestoneTaskPositionMap', () => {
  it('assigns positions within each milestone independently', () => {
    const tasks = [
      { id: 't1', milestoneId: 'm1' },
      { id: 't2', milestoneId: 'm1' },
      { id: 't3', milestoneId: 'm2' },
      { id: 't4', milestoneId: 'm1' },
      { id: 't5', milestoneId: 'm2' },
    ]
    const map = buildMilestoneTaskPositionMap(tasks)
    // m1 tasks: t1=1, t2=2, t4=3
    expect(map.get('t1')).toBe(1)
    expect(map.get('t2')).toBe(2)
    expect(map.get('t4')).toBe(3)
    // m2 tasks: t3=1, t5=2
    expect(map.get('t3')).toBe(1)
    expect(map.get('t5')).toBe(2)
  })

  it('ignores tasks with null milestoneId', () => {
    const tasks = [
      { id: 't1', milestoneId: 'm1' },
      { id: 't2', milestoneId: null },
      { id: 't3', milestoneId: 'm1' },
    ]
    const map = buildMilestoneTaskPositionMap(tasks)
    expect(map.get('t1')).toBe(1)
    expect(map.get('t3')).toBe(2)
    expect(map.has('t2')).toBe(false)
  })

  it('returns empty map for no tasks', () => {
    const map = buildMilestoneTaskPositionMap([])
    expect(map.size).toBe(0)
  })
})

describe('formatProjectTaskNumber', () => {
  it('formats with 3-digit zero-padding', () => {
    expect(formatProjectTaskNumber('CWA', 1)).toBe('CWA-001')
    expect(formatProjectTaskNumber('CWA', 42)).toBe('CWA-042')
    expect(formatProjectTaskNumber('CWA', 999)).toBe('CWA-999')
  })

  it('handles large numbers beyond 3 digits', () => {
    expect(formatProjectTaskNumber('T', 1234)).toBe('T-1234')
  })
})

describe('formatMilestoneTaskNumber', () => {
  it('formats as CODE-MNN-TNN', () => {
    expect(formatMilestoneTaskNumber('GZP', 5, 3)).toBe('GZP-M05-T03')
    expect(formatMilestoneTaskNumber('CWA', 1, 1)).toBe('CWA-M01-T01')
    expect(formatMilestoneTaskNumber('CWA', 12, 99)).toBe('CWA-M12-T99')
  })

  it('returns null when milestonePosition is undefined', () => {
    expect(formatMilestoneTaskNumber('CWA', undefined, 3)).toBeNull()
  })

  it('returns null when taskPosition is undefined', () => {
    expect(formatMilestoneTaskNumber('CWA', 5, undefined)).toBeNull()
  })

  it('returns null when both are undefined', () => {
    expect(formatMilestoneTaskNumber('CWA', undefined, undefined)).toBeNull()
  })

  it('handles large numbers beyond 2 digits', () => {
    expect(formatMilestoneTaskNumber('T', 100, 200)).toBe('T-M100-T200')
  })
})

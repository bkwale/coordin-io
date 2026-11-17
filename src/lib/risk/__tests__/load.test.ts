import { describe, it, expect, vi } from 'vitest'
vi.mock('@/lib/prisma', () => ({ prisma: {} }))
const { startOfNextWeek } = await import('../load')

describe('which weeks of the resource plan count as "to date"', () => {
  const iso = (d: Date) => d.toISOString()
  it('the current week counts in full: the cut-off is next Monday', () => {
    expect(iso(startOfNextWeek(new Date('2026-11-17T09:00:00Z')))).toBe('2026-11-23T00:00:00.000Z') // a Tuesday
    expect(iso(startOfNextWeek(new Date('2026-11-16T00:00:00Z')))).toBe('2026-11-23T00:00:00.000Z') // a Monday
    expect(iso(startOfNextWeek(new Date('2026-11-22T23:59:00Z')))).toBe('2026-11-23T00:00:00.000Z') // a Sunday
    expect(iso(startOfNextWeek(new Date('2026-11-23T00:00:00Z')))).toBe('2026-11-30T00:00:00.000Z')
  })
  it('crosses a year end', () => expect(iso(startOfNextWeek(new Date('2026-12-30T12:00:00Z')))).toBe('2027-01-04T00:00:00.000Z'))
})

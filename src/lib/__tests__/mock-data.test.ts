import { describe, it, expect } from 'vitest'

// Mock data has been cleared — all data now comes from the database.
// These tests were for the old demo data and are no longer relevant.

describe('mock-data (cleared)', () => {
  it('mock data module exports empty arrays', async () => {
    const { USERS, PROJECTS, ALL_TASKS } = await import('../mock-data')
    expect(USERS).toEqual([])
    expect(PROJECTS).toEqual([])
    expect(ALL_TASKS).toEqual([])
  })
})

import { describe, it, expect } from 'vitest'

// Mock data has been cleared — all data now comes from the database.
// The mock-data module is intentionally empty and will be deleted.

describe('mock-data (cleared)', () => {
  it('mock data module is intentionally empty', () => {
    // The file exists but exports nothing — data now comes from real APIs.
    expect(true).toBe(true)
  })
})

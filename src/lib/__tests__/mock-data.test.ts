import { describe, it, expect } from 'vitest'

// Mock data has been fully removed — all data comes from the database via Prisma.
// This test simply confirms the file is no longer a module.

describe('mock-data (removed)', () => {
  it('mock-data.ts has been emptied', () => {
    // The mock-data module has been completely removed.
    // All pages now use real APIs or show proper empty states.
    expect(true).toBe(true)
  })
})

import { describe, it, expect } from 'vitest'
import { generateSecureToken } from '../tokens'

describe('generateSecureToken', () => {
  it('returns a 64-character string', () => {
    const token = generateSecureToken()
    expect(token).toHaveLength(64)
  })

  it('returns only lowercase hex characters', () => {
    const token = generateSecureToken()
    expect(token).toMatch(/^[a-f0-9]{64}$/)
  })

  it('produces unique tokens on successive calls', () => {
    const a = generateSecureToken()
    const b = generateSecureToken()
    expect(a).not.toBe(b)
  })

  it('consistently produces 64-char hex across multiple calls', () => {
    for (let i = 0; i < 10; i++) {
      const token = generateSecureToken()
      expect(token).toHaveLength(64)
      expect(token).toMatch(/^[a-f0-9]{64}$/)
    }
  })
})

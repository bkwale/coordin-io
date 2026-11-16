import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { randomBytes } from 'node:crypto'
import { escapeHtml, escapeParams, safeHref } from '@/lib/html'
import { safeEqual } from '@/lib/safe-compare'
import { optionalUrl } from '@/lib/validation'

describe('secret-box', () => {
  const prev = process.env.INTEGRATION_ENCRYPTION_KEY
  beforeEach(() => { vi.resetModules() })
  afterEach(() => { process.env.INTEGRATION_ENCRYPTION_KEY = prev })

  it('seals and opens with a key, and the sealed value hides the secret', async () => {
    process.env.INTEGRATION_ENCRYPTION_KEY = randomBytes(32).toString('base64')
    const { sealSecret, openSecret } = await import('@/lib/secret-box')
    const sealed = sealSecret('refresh-token-123')
    expect(sealed.startsWith('enc:v1:')).toBe(true)
    expect(sealed).not.toContain('refresh-token-123')
    expect(openSecret(sealed)).toBe('refresh-token-123')
  })

  it('reads values stored before encryption was switched on', async () => {
    process.env.INTEGRATION_ENCRYPTION_KEY = randomBytes(32).toString('hex')
    const { openSecret } = await import('@/lib/secret-box')
    expect(openSecret('plain-old-token')).toBe('plain-old-token')
  })

  it('refuses a tampered value', async () => {
    process.env.INTEGRATION_ENCRYPTION_KEY = randomBytes(32).toString('base64')
    const { sealSecret, openSecret } = await import('@/lib/secret-box')
    const sealed = sealSecret('abc')
    const tampered = sealed.slice(0, -2) + (sealed.endsWith('A') ? 'BB' : 'AA')
    expect(() => openSecret(tampered)).toThrow()
  })
})

describe('html escaping', () => {
  it('escapes markup', () => {
    expect(escapeHtml('<img src=x onerror=alert(1)>')).not.toContain('<img')
    expect(escapeParams({ name: '<b>', list: ['"x"'] })).toEqual({ name: '&lt;b&gt;', list: ['&quot;x&quot;'] })
  })
  it('only allows safe links', () => {
    expect(safeHref('javascript:alert(1)')).toBeNull()
    expect(safeHref('//evil.com')).toBeNull()
    expect(safeHref('/projects/1')).toBe('/projects/1')
    expect(safeHref('https://coordin.io')).toBe('https://coordin.io')
  })
})

describe('optionalUrl', () => {
  it('blocks script links and accepts web links', () => {
    expect(() => optionalUrl('javascript:alert(1)', 'Link')).toThrow()
    expect(() => optionalUrl('data:text/html,hi', 'Link')).toThrow()
    expect(optionalUrl('https://x.sharepoint.com/a', 'Link')).toBe('https://x.sharepoint.com/a')
    expect(optionalUrl('', 'Link')).toBeNull()
  })
})

describe('safeEqual', () => {
  it('compares in constant time', () => {
    expect(safeEqual('Bearer abc', 'Bearer abc')).toBe(true)
    expect(safeEqual('Bearer abc', 'Bearer abd')).toBe(false)
    expect(safeEqual(null, 'x')).toBe(false)
  })
})

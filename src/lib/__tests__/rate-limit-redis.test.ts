import { describe, it, expect, vi, beforeEach } from 'vitest'

/** Security: the limiter must count globally (Redis), not per serverless instance, and must not take the site down if Redis fails. */
const store = new Map<string, number>()
let mode: 'ok' | 'error' | 'hang' | 'off' = 'ok'
const fakeRedis = {
  incr: vi.fn(async (k: string) => {
    if (mode === 'error') throw new Error('ECONNRESET')
    if (mode === 'hang') return new Promise<number>(() => {})
    const n = (store.get(k) ?? 0) + 1; store.set(k, n); return n
  }),
  pexpire: vi.fn(async () => 1),
}
vi.mock('@/lib/cache', () => ({ getRedis: () => (mode === 'off' ? null : fakeRedis) }))
import { checkRateLimit } from '@/lib/rate-limit'

describe('rate limiter (Redis-backed)', () => {
  beforeEach(() => { store.clear(); mode = 'ok'; fakeRedis.incr.mockClear(); fakeRedis.pexpire.mockClear(); vi.spyOn(console, 'warn').mockImplementation(() => {}) })

  it('allows up to the limit, then returns 429 with Retry-After', async () => {
    for (let i = 0; i < 3; i++) expect(await checkRateLimit('ai:user1', { maxRequests: 3, windowMs: 60_000 })).toBeNull()
    const res = await checkRateLimit('ai:user1', { maxRequests: 3, windowMs: 60_000 })
    expect(res?.status).toBe(429)
    expect(Number(res?.headers.get('Retry-After'))).toBeGreaterThan(0)
  })
  it('counts in Redis, so every instance shares one count', async () => {
    await checkRateLimit('ai:user2', { maxRequests: 5 })
    await checkRateLimit('ai:user2', { maxRequests: 5 })
    expect([...store.values()]).toEqual([2])
    expect([...store.keys()][0]).toMatch(/^rl:ai:user2:\d+$/)
  })
  it('sets an expiry only when the window opens', async () => {
    await checkRateLimit('k3'); await checkRateLimit('k3')
    expect(fakeRedis.pexpire).toHaveBeenCalledTimes(1)
  })
  it('keys are separate per user', async () => {
    expect(await checkRateLimit('a', { maxRequests: 1 })).toBeNull()
    expect(await checkRateLimit('b', { maxRequests: 1 })).toBeNull()
  })
  it('falls back to the per-instance counter if Redis errors — site stays up, warning logged', async () => {
    mode = 'error'
    expect(await checkRateLimit('fb1', { maxRequests: 1 })).toBeNull()
    expect((await checkRateLimit('fb1', { maxRequests: 1 }))?.status).toBe(429)
    expect(console.warn).toHaveBeenCalledWith(expect.stringMatching(/Redis unavailable/), expect.anything())
  })
  it('falls back if Redis hangs (does not hold the request)', async () => {
    mode = 'hang'
    const t0 = Date.now()
    expect(await checkRateLimit('fb2', { maxRequests: 5 })).toBeNull()
    expect(Date.now() - t0).toBeLessThan(2_000)
  })
  it('works with no Redis configured (local/tests)', async () => {
    mode = 'off'
    expect(await checkRateLimit('fb3', { maxRequests: 1 })).toBeNull()
    expect((await checkRateLimit('fb3', { maxRequests: 1 }))?.status).toBe(429)
  })
})

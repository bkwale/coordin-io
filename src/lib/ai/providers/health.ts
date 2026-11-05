/**
 * Circuit breaker per AI provider. After 3 outage-type failures (down, timeout, busy) within 5 minutes,
 * the provider is treated as down for 2 minutes: requests fail fast with a clear message instead of
 * making people wait 2½ minutes for a timeout. One success closes it again.
 * Shared across instances through Upstash Redis when configured; per-instance memory otherwise.
 */
import { getRedis } from '@/lib/cache'
import type { AIProvider } from '../failures'

export const BREAKER_THRESHOLD = 3
export const FAILURE_WINDOW_S = 300
export const OPEN_FOR_S = 120

const mem = new Map<string, { fails: number; firstAt: number; openUntil: number }>()

const failKey = (p: AIProvider) => `ai:breaker:${p}:fails`
const openKey = (p: AIProvider) => `ai:breaker:${p}:open`

export async function isProviderOpen(p: AIProvider, now = Date.now()): Promise<boolean> {
  const redis = getRedis()
  if (redis) {
    try { return (await redis.get(openKey(p))) != null } catch { /* fall back to memory */ }
  }
  return (mem.get(p)?.openUntil ?? 0) > now
}

/** Returns true when this failure tripped the breaker (so the caller can report the outage once). */
export async function recordProviderFailure(p: AIProvider, now = Date.now()): Promise<boolean> {
  const redis = getRedis()
  if (redis) {
    try {
      const fails = await redis.incr(failKey(p))
      if (fails === 1) await redis.expire(failKey(p), FAILURE_WINDOW_S)
      if (fails >= BREAKER_THRESHOLD) {
        const set = await redis.set(openKey(p), String(now), { ex: OPEN_FOR_S, nx: true })
        return set === 'OK'
      }
      return false
    } catch { /* fall back to memory */ }
  }
  const cur = mem.get(p)
  const s = !cur || now - cur.firstAt > FAILURE_WINDOW_S * 1000 ? { fails: 0, firstAt: now, openUntil: cur?.openUntil ?? 0 } : cur
  s.fails++
  let tripped = false
  if (s.fails >= BREAKER_THRESHOLD && s.openUntil <= now) { s.openUntil = now + OPEN_FOR_S * 1000; tripped = true }
  mem.set(p, s)
  return tripped
}

export async function recordProviderSuccess(p: AIProvider): Promise<void> {
  const redis = getRedis()
  if (redis) {
    try { await redis.del(failKey(p), openKey(p)); return } catch { /* fall back */ }
  }
  mem.delete(p)
}

/** For the status endpoint and tests. */
export async function providerStatus(): Promise<Record<AIProvider, 'ok' | 'down'>> {
  const [m, c] = await Promise.all([isProviderOpen('mistral'), isProviderOpen('claude')])
  return { mistral: m ? 'down' : 'ok', claude: c ? 'down' : 'ok' }
}

export function __resetBreakerForTests() { mem.clear() }

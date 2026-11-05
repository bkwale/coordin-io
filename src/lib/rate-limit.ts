import { NextResponse } from 'next/server'
import { getRedis } from '@/lib/cache'

/**
 * Rate limiter — GLOBAL across all serverless instances via Upstash Redis (fixed window, INCR + PEXPIRE).
 *
 * Vercel runs many instances; an in-memory counter only counted per instance and reset on every cold
 * start, so "10/min" was really "10/min per instance". Redis gives one shared count.
 *
 * If Redis is not configured, errors, or takes longer than REDIS_TIMEOUT_MS, we fall back to the
 * in-memory counter (the site stays up) and log a warning so the gap is visible (Hightower/Majors).
 *
 * Default: 100 requests per 60-second window per key.
 */
const REDIS_TIMEOUT_MS = 400

interface RateLimitEntry {
  count: number
  resetAt: number // ms timestamp
}

const store = new Map<string, RateLimitEntry>()

// Cleanup stale entries every 5 minutes
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000

let lastCleanup = Date.now()

function cleanup() {
  const now = Date.now()
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return
  lastCleanup = now
  for (const [key, entry] of store) {
    if (now > entry.resetAt) {
      store.delete(key)
    }
  }
}

interface RateLimitOptions {
  /** Maximum requests per window. Default: 100 */
  maxRequests?: number
  /** Window duration in milliseconds. Default: 60_000 (1 minute) */
  windowMs?: number
  /**
   * Brute-force-sensitive routes (invitation token lookup, onboarding verification): if Redis is
   * configured but unreachable, refuse with 503 instead of falling back to the per-instance counter.
   * Better a few minutes' outage than an unlimited guessing window (Schneier, PT 5 Nov).
   */
  failClosed?: boolean
}

/**
 * Check rate limit for a user. Returns null if allowed,
 * or a NextResponse with 429 status if rate limited.
 */
export async function checkRateLimit(
  userId: string,
  opts: RateLimitOptions = {},
): Promise<NextResponse | null> {
  const maxRequests = opts.maxRequests ?? 100
  const windowMs = opts.windowMs ?? 60_000
  const redis = getRedis()
  if (redis) {
    try {
      const now = Date.now()
      const windowStart = Math.floor(now / windowMs) * windowMs
      const key = `rl:${userId}:${windowStart}`
      // The window start is part of the key, so even if PEXPIRE never lands nobody is locked out beyond this window.
      let timer: ReturnType<typeof setTimeout> | undefined
      const count = await Promise.race([
        (async () => {
          const n = await redis.incr(key)
          if (n === 1) await redis.pexpire(key, windowMs + 1_000)
          return n
        })(),
        new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('redis timeout')), REDIS_TIMEOUT_MS) }),
      ]).finally(() => clearTimeout(timer))
      if (count > maxRequests) {
        console.warn('[RateLimit] limited', { key: userId, count, maxRequests })
        return limitedResponse(maxRequests, windowStart + windowMs, now)
      }
      return null
    } catch (e) {
      if (opts.failClosed) {
        console.error('[RateLimit] Redis unavailable — failing CLOSED', { key: userId, error: e instanceof Error ? e.message : String(e) })
        return NextResponse.json({ ok: false, error: { code: 'TEMPORARILY_UNAVAILABLE', message: 'This is temporarily unavailable. Please try again in a few minutes.' } }, { status: 503, headers: { 'Retry-After': '60' } })
      }
      console.warn('[RateLimit] Redis unavailable — falling back to per-instance counter', { error: e instanceof Error ? e.message : String(e) })
    }
  }
  return checkRateLimitLocal(userId, opts)
}

/** Per-instance fallback (and the only limiter when Redis isn't configured, e.g. tests/local). */
export function checkRateLimitLocal(
  userId: string,
  opts: RateLimitOptions = {},
): NextResponse | null {
  const maxRequests = opts.maxRequests ?? 100
  const windowMs = opts.windowMs ?? 60_000

  cleanup()

  const now = Date.now()
  const key = userId

  let entry = store.get(key)

  // If no entry or window expired, start fresh
  if (!entry || now > entry.resetAt) {
    entry = { count: 1, resetAt: now + windowMs }
    store.set(key, entry)
    return null // allowed
  }

  // Window still active — increment
  entry.count++

  if (entry.count > maxRequests) {
    return limitedResponse(maxRequests, entry.resetAt, now)
  }

  return null // allowed
}

function limitedResponse(maxRequests: number, resetAt: number, now: number): NextResponse {
  {
    const retryAfterSeconds = Math.max(1, Math.ceil((resetAt - now) / 1000))
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: 'RATE_LIMITED',
          message: `Too many requests. Try again in ${retryAfterSeconds}s.`,
        },
      },
      {
        status: 429,
        headers: {
          'Retry-After': String(retryAfterSeconds),
          'X-RateLimit-Limit': String(maxRequests),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(Math.ceil(resetAt / 1000)),
        },
      },
    )
  }
}

/**
 * Rate limit configuration presets.
 */
export const RateLimitPresets = {
  /** Standard: 100 req/min — for most endpoints */
  standard: { maxRequests: 100, windowMs: 60_000 },
  /** Strict: 20 req/min — for mutation-heavy endpoints */
  strict: { maxRequests: 20, windowMs: 60_000 },
  /** Auth: 10 req/min — for login/activation */
  auth: { maxRequests: 10, windowMs: 60_000 },
} as const

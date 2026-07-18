import { NextResponse } from 'next/server'

/**
 * In-memory per-user rate limiter using sliding window counters.
 *
 * Designed for single-instance deployment (Vercel serverless).
 * For multi-instance, swap with Redis-backed limiter.
 *
 * Default: 100 requests per 60-second window per user.
 */

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
}

/**
 * Check rate limit for a user. Returns null if allowed,
 * or a NextResponse with 429 status if rate limited.
 */
export function checkRateLimit(
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
    const retryAfterSeconds = Math.ceil((entry.resetAt - now) / 1000)
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
          'X-RateLimit-Reset': String(Math.ceil(entry.resetAt / 1000)),
        },
      },
    )
  }

  return null // allowed
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

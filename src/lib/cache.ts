import { Redis } from '@upstash/redis'

// ---------------------------------------------------------------------------
// Upstash Redis cache — graceful degradation when not configured
// ---------------------------------------------------------------------------

let redis: Redis | null = null

function getRedis(): Redis | null {
  if (redis) return redis
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return null
  redis = new Redis({ url, token })
  return redis
}

// Default TTLs in seconds
export const CACHE_TTL = {
  DASHBOARD: 30,        // 30s — dashboard is hit often, data changes infrequently
  STAFFING_LIST: 60,    // 1min — employee list rarely changes mid-session
  STAFFING_DETAIL: 30,  // 30s — individual profile
  PERMISSIONS: 300,     // 5min — role/permission lookups are very stable
} as const

/**
 * Fetch-through cache. Returns cached value if present, otherwise calls `fetcher`,
 * stores the result, and returns it. Gracefully falls back to direct fetch if
 * Redis is not configured or errors.
 */
export async function cached<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlSeconds: number = 30,
): Promise<T> {
  const r = getRedis()
  if (!r) return fetcher()

  try {
    const hit = await r.get<T>(key)
    if (hit !== null && hit !== undefined) return hit

    const data = await fetcher()
    // Fire-and-forget — don't block the response on cache write
    r.set(key, data, { ex: ttlSeconds }).catch(() => {})
    return data
  } catch {
    // Redis down — fall through to direct fetch
    return fetcher()
  }
}

/**
 * Invalidate one or more cache keys. Accepts a single key or a glob pattern.
 * Silently no-ops if Redis is not configured.
 */
export async function invalidateCache(...keys: string[]): Promise<void> {
  const r = getRedis()
  if (!r || keys.length === 0) return

  try {
    // For patterns (containing *), use scan + delete
    const exactKeys: string[] = []
    for (const k of keys) {
      if (k.includes('*')) {
        // Scan for matching keys — Upstash supports SCAN
        let cursor = 0
        do {
          const [nextCursor, found] = await r.scan(cursor, { match: k, count: 100 })
          cursor = typeof nextCursor === 'number' ? nextCursor : Number(nextCursor)
          exactKeys.push(...found)
        } while (cursor !== 0)
      } else {
        exactKeys.push(k)
      }
    }
    if (exactKeys.length > 0) {
      await r.del(...exactKeys)
    }
  } catch {
    // Redis down — nothing to do
  }
}

// ---------------------------------------------------------------------------
// Cache key builders — centralised to avoid typos
// ---------------------------------------------------------------------------

export const cacheKey = {
  dashboard: (profileId: string) => `dash:${profileId}`,
  staffingList: (orgId: string, tier: string) => `staff:list:${orgId}:${tier}`,
  staffingDetail: (orgId: string, profileId: string, tier: string) => `staff:detail:${orgId}:${profileId}:${tier}`,
  permissions: (profileId: string) => `perm:${profileId}`,
  // Patterns for bulk invalidation
  dashboardAll: () => `dash:*`,
  staffingAll: (orgId: string) => `staff:*:${orgId}*`,
  orgAll: (orgId: string) => `*:${orgId}*`,
} as const

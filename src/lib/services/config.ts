/**
 * Services layer configuration + shared types.
 *
 * - isSupabaseConfigured(): determines demo mode vs live
 * - getOrgId(): fetches current user's organisation_id for inserts
 * - ServiceResult<T>: consistent return shape across all services
 * - QueryOptions: shared pagination + DI client parameter
 */

import type { SupabaseClient } from '@supabase/supabase-js'

// ── ServiceResult type ────────────────────────────────────

/**
 * Every service function returns this shape.
 * Consumers can check `error` to decide whether to show an error state.
 * In demo mode, `data` contains mock data and `error` is null.
 * On Supabase error, `data` is the empty/null default and `error` describes the issue.
 */
export type ServiceResult<T> = {
  data: T
  error: string | null
}

// ── Query options (DI + pagination) ───────────────────────

export type QueryOptions = {
  /** Supabase client instance — pass server client from Server Components. */
  client?: SupabaseClient
  /** Maximum rows to return. Defaults vary by service (typically 100). */
  limit?: number
  /** Offset for pagination. Defaults to 0. */
  offset?: number
}

// ── Supabase configuration check ──────────────────────────

let _isConfigured: boolean | null = null

export function isSupabaseConfigured(): boolean {
  if (_isConfigured !== null) return _isConfigured

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  _isConfigured =
    typeof url === 'string' &&
    url.length > 0 &&
    !url.includes('YOUR_PROJECT') &&
    typeof key === 'string' &&
    key.length > 0 &&
    !key.includes('your-anon-key')

  return _isConfigured
}

/** Reset the cached check — useful for testing */
export function resetConfigCache() {
  _isConfigured = null
}

// ── Organisation ID helper ────────────────────────────────

/**
 * Fetches the current user's organisation_id from their profile.
 * Required for every org-scoped insert (projects, tasks, quotes, etc.).
 *
 * Accepts an optional SupabaseClient for server-side usage.
 * Returns null if not authenticated or in demo mode.
 */
export async function getOrgId(
  client?: SupabaseClient
): Promise<string | null> {
  if (!isSupabaseConfigured()) return null

  // Lazy-import to avoid circular deps — we can't import createClient at module level
  // because profiles.ts imports from config.ts
  const resolvedClient = client ?? (await getDefaultClient())
  if (!resolvedClient) return null

  const {
    data: { user },
  } = await resolvedClient.auth.getUser()
  if (!user) return null

  const { data: profile } = await resolvedClient
    .from('profiles')
    .select('organisation_id')
    .eq('id', user.id)
    .single()

  return profile?.organisation_id ?? null
}

// ── Default client resolver ───────────────────────────────

/**
 * Lazily imports and creates the browser Supabase client.
 * Used when no client is passed via DI.
 */
async function getDefaultClient(): Promise<SupabaseClient | null> {
  try {
    const { createClient } = await import('@/lib/supabase/client')
    return createClient()
  } catch {
    return null
  }
}

/**
 * Resolve the Supabase client: use the injected one, or fall back to browser client.
 * Exported so every service can use the same pattern.
 */
export async function resolveClient(
  injected?: SupabaseClient
): Promise<SupabaseClient> {
  if (injected) return injected
  const client = await getDefaultClient()
  if (!client) throw new Error('No Supabase client available')
  return client
}

import {
  isSupabaseConfigured,
  resolveClient,
  type ServiceResult,
  type QueryOptions,
} from './config'
import { createServiceLogger } from './logger'
import { isCircuitOpen, recordFailure, recordSuccess, queryTimeout } from './resilience'
import { USERS } from '@/lib/mock-data'
import type { User } from '@/lib/types'

const log = createServiceLogger('profiles')

// ── Column selection ──────────────────────────────────────

const PROFILE_COLUMNS = [
  'id', 'organisation_id', 'full_name', 'email', 'role',
  'avatar_url', 'is_active', 'created_at', 'updated_at',
].join(', ')

// ── Queries ────────────────────────────────────────────────

export async function getProfiles(
  opts?: QueryOptions
): Promise<ServiceResult<User[]>> {
  if (!isSupabaseConfigured()) return { data: USERS, error: null }
  if (isCircuitOpen()) {
    log.warn('getProfiles', 'Circuit open — returning empty')
    return { data: [], error: 'Service temporarily unavailable' }
  }

  try {
    const client = await resolveClient(opts?.client)
    const { signal, clear } = queryTimeout()
    const { data, error } = await client
      .from('profiles')
      .select(PROFILE_COLUMNS)
      .eq('is_active', true)
      .order('full_name', { ascending: true })
      .range(opts?.offset ?? 0, (opts?.offset ?? 0) + (opts?.limit ?? 100) - 1)
      .abortSignal(signal)
    clear()

    if (error) {
      recordFailure()
      log.error('getProfiles', error.message, { code: error.code })
      return { data: [], error: error.message }
    }

    recordSuccess()
    return { data: (data ?? []).map(mapRow), error: null }
  } catch (err) {
    recordFailure()
    const msg = err instanceof Error ? err.message : 'Unknown error'
    log.error('getProfiles', msg)
    return { data: [], error: msg }
  }
}

export async function getProfile(
  id: string,
  opts?: { client?: QueryOptions['client'] }
): Promise<ServiceResult<User | null>> {
  if (!isSupabaseConfigured()) {
    return { data: USERS.find(u => u.id === id) ?? null, error: null }
  }
  if (isCircuitOpen()) {
    return { data: null, error: 'Service temporarily unavailable' }
  }

  try {
    const client = await resolveClient(opts?.client)
    const { signal, clear } = queryTimeout()
    const { data, error } = await client
      .from('profiles')
      .select(PROFILE_COLUMNS)
      .eq('id', id)
      .abortSignal(signal)
      .single()
    clear()

    if (error) {
      recordFailure()
      log.error('getProfile', error.message, { code: error.code })
      return { data: null, error: error.message }
    }

    recordSuccess()
    return { data: data ? mapRow(data) : null, error: null }
  } catch (err) {
    recordFailure()
    const msg = err instanceof Error ? err.message : 'Unknown error'
    log.error('getProfile', msg)
    return { data: null, error: msg }
  }
}

export async function getCurrentProfile(
  opts?: { client?: QueryOptions['client'] }
): Promise<ServiceResult<User | null>> {
  if (!isSupabaseConfigured()) {
    // In demo mode, return the practice owner
    return { data: USERS[0] ?? null, error: null }
  }

  try {
    const client = await resolveClient(opts?.client)
    const {
      data: { user },
    } = await client.auth.getUser()
    if (!user) return { data: null, error: 'Not authenticated' }

    return getProfile(user.id, { client })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    log.error('getCurrentProfile', msg)
    return { data: null, error: msg }
  }
}

// ── Mutations ──────────────────────────────────────────────

export async function updateProfile(
  id: string,
  updates: Partial<User>,
  opts?: { client?: QueryOptions['client'] }
): Promise<ServiceResult<User | null>> {
  if (!isSupabaseConfigured()) return { data: null, error: null }

  try {
    const client = await resolveClient(opts?.client)
    const payload: Record<string, unknown> = {}
    if (updates.name !== undefined) payload.full_name = updates.name
    if (updates.email !== undefined) payload.email = updates.email
    if (updates.role !== undefined) payload.role = updates.role
    if (updates.avatar_url !== undefined) payload.avatar_url = updates.avatar_url

    const { signal, clear } = queryTimeout()
    const { data, error } = await client
      .from('profiles')
      .update(payload)
      .eq('id', id)
      .select(PROFILE_COLUMNS)
      .abortSignal(signal)
      .single()
    clear()

    if (error) {
      log.error('updateProfile', error.message, { code: error.code })
      return { data: null, error: error.message }
    }

    return { data: data ? mapRow(data) : null, error: null }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    log.error('updateProfile', msg)
    return { data: null, error: msg }
  }
}

// ── Row mapper ─────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapRow(row: any): User {
  return {
    id: row.id,
    name: row.full_name ?? '',
    email: row.email ?? '',
    role: row.role ?? 'team_member',
    avatar_url: row.avatar_url ?? undefined,
    created_at: row.created_at ?? '',
    updated_at: row.updated_at ?? '',
  }
}

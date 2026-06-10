import {
  isSupabaseConfigured,
  resolveClient,
  type ServiceResult,
  type QueryOptions,
} from './config'
import { createServiceLogger } from './logger'
import { isCircuitOpen, recordFailure, recordSuccess, queryTimeout } from './resilience'

const log = createServiceLogger('waitlist')

// ── Types ─────────────────────────────────────────────────

export interface WaitlistEntry {
  id: string
  email: string
  company_name?: string
  team_size?: string
  source?: string
  created_at: string
}

// ── Column selection ──────────────────────────────────────

const WAITLIST_COLUMNS = 'id, email, company_name, team_size, source, created_at'

// ── Queries ────────────────────────────────────────────────

export async function getWaitlistEntries(
  opts?: QueryOptions
): Promise<ServiceResult<WaitlistEntry[]>> {
  if (!isSupabaseConfigured()) return { data: [], error: null }
  if (isCircuitOpen()) {
    log.warn('getWaitlistEntries', 'Circuit open — returning empty')
    return { data: [], error: 'Service temporarily unavailable' }
  }

  try {
    const client = await resolveClient(opts?.client)
    const { signal, clear } = queryTimeout()
    const { data, error } = await client
      .from('waitlist')
      .select(WAITLIST_COLUMNS)
      .order('created_at', { ascending: false })
      .range(opts?.offset ?? 0, (opts?.offset ?? 0) + (opts?.limit ?? 100) - 1)
      .abortSignal(signal)
    clear()

    if (error) {
      recordFailure()
      log.error('getWaitlistEntries', error.message, { code: error.code })
      return { data: [], error: error.message }
    }

    recordSuccess()
    return { data: (data ?? []).map(mapRow), error: null }
  } catch (err) {
    recordFailure()
    const msg = err instanceof Error ? err.message : 'Unknown error'
    log.error('getWaitlistEntries', msg)
    return { data: [], error: msg }
  }
}

// ── Mutations ──────────────────────────────────────────────

export async function addToWaitlist(
  entry: {
    email: string
    company_name?: string
    team_size?: string
    source?: string
  },
  opts?: { client?: QueryOptions['client'] }
): Promise<ServiceResult<WaitlistEntry | null>> {
  if (!isSupabaseConfigured()) {
    // In demo mode, log and return a fake entry
    log.info('addToWaitlist', `Demo mode — waitlist signup: ${entry.email}`)
    return {
      data: {
        id: `demo-${Date.now()}`,
        email: entry.email,
        company_name: entry.company_name,
        team_size: entry.team_size,
        source: entry.source,
        created_at: new Date().toISOString(),
      },
      error: null,
    }
  }

  try {
    const client = await resolveClient(opts?.client)
    const { signal, clear } = queryTimeout()
    const { data, error } = await client
      .from('waitlist')
      .insert({
        email: entry.email,
        company_name: entry.company_name,
        team_size: entry.team_size,
        source: entry.source ?? 'website',
      })
      .select(WAITLIST_COLUMNS)
      .abortSignal(signal)
      .single()
    clear()

    if (error) {
      // Duplicate email is expected — not a real error
      if (error.code === '23505') {
        log.info('addToWaitlist', `Email already on waitlist: ${entry.email}`)
        return { data: null, error: null }
      }
      log.error('addToWaitlist', error.message, { code: error.code })
      return { data: null, error: error.message }
    }

    return { data: data ? mapRow(data) : null, error: null }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    log.error('addToWaitlist', msg)
    return { data: null, error: msg }
  }
}

// ── Row mapper ─────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapRow(row: any): WaitlistEntry {
  return {
    id: row.id,
    email: row.email ?? '',
    company_name: row.company_name ?? undefined,
    team_size: row.team_size ?? undefined,
    source: row.source ?? undefined,
    created_at: row.created_at ?? '',
  }
}

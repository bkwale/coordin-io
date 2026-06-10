import {
  isSupabaseConfigured,
  resolveClient,
  getOrgId,
  type ServiceResult,
  type QueryOptions,
} from './config'
import { createServiceLogger } from './logger'
import { isCircuitOpen, recordFailure, recordSuccess, queryTimeout } from './resilience'
import { LEAVE_RECORDS } from '@/lib/mock-data'
import type { LeaveRecord } from '@/lib/types'

const log = createServiceLogger('leave')

// ── Column selection ──────────────────────────────────────

const LEAVE_COLUMNS = [
  'id', 'organisation_id', 'user_id', 'leave_type', 'status',
  'start_date', 'end_date', 'days', 'half_day_start', 'half_day_end',
  'notes', 'approved_by_user_id', 'approved_at', 'created_at', 'updated_at',
].join(', ')

// ── Queries ────────────────────────────────────────────────

export async function getLeaveRecords(
  opts?: QueryOptions
): Promise<ServiceResult<LeaveRecord[]>> {
  if (!isSupabaseConfigured()) return { data: LEAVE_RECORDS, error: null }
  if (isCircuitOpen()) {
    log.warn('getLeaveRecords', 'Circuit open — returning empty')
    return { data: [], error: 'Service temporarily unavailable' }
  }

  try {
    const client = await resolveClient(opts?.client)
    const { signal, clear } = queryTimeout()
    const { data, error } = await client
      .from('leave_records')
      .select(LEAVE_COLUMNS)
      .order('start_date', { ascending: false })
      .range(opts?.offset ?? 0, (opts?.offset ?? 0) + (opts?.limit ?? 100) - 1)
      .abortSignal(signal)
    clear()

    if (error) {
      recordFailure()
      log.error('getLeaveRecords', error.message, { code: error.code })
      return { data: [], error: error.message }
    }

    recordSuccess()
    return { data: (data ?? []).map(mapRow), error: null }
  } catch (err) {
    recordFailure()
    const msg = err instanceof Error ? err.message : 'Unknown error'
    log.error('getLeaveRecords', msg)
    return { data: [], error: msg }
  }
}

export async function getLeaveByUser(
  userId: string,
  opts?: QueryOptions
): Promise<ServiceResult<LeaveRecord[]>> {
  if (!isSupabaseConfigured()) {
    return { data: LEAVE_RECORDS.filter(lr => lr.user_id === userId), error: null }
  }
  if (isCircuitOpen()) {
    return { data: [], error: 'Service temporarily unavailable' }
  }

  try {
    const client = await resolveClient(opts?.client)
    const { signal, clear } = queryTimeout()
    const { data, error } = await client
      .from('leave_records')
      .select(LEAVE_COLUMNS)
      .eq('user_id', userId)
      .order('start_date', { ascending: false })
      .range(opts?.offset ?? 0, (opts?.offset ?? 0) + (opts?.limit ?? 100) - 1)
      .abortSignal(signal)
    clear()

    if (error) {
      recordFailure()
      log.error('getLeaveByUser', error.message, { code: error.code })
      return { data: [], error: error.message }
    }

    recordSuccess()
    return { data: (data ?? []).map(mapRow), error: null }
  } catch (err) {
    recordFailure()
    const msg = err instanceof Error ? err.message : 'Unknown error'
    log.error('getLeaveByUser', msg)
    return { data: [], error: msg }
  }
}

export async function getPendingLeave(
  opts?: QueryOptions
): Promise<ServiceResult<LeaveRecord[]>> {
  if (!isSupabaseConfigured()) {
    return { data: LEAVE_RECORDS.filter(lr => lr.status === 'pending'), error: null }
  }
  if (isCircuitOpen()) {
    return { data: [], error: 'Service temporarily unavailable' }
  }

  try {
    const client = await resolveClient(opts?.client)
    const { signal, clear } = queryTimeout()
    const { data, error } = await client
      .from('leave_records')
      .select(LEAVE_COLUMNS)
      .eq('status', 'pending')
      .order('start_date', { ascending: true })
      .range(opts?.offset ?? 0, (opts?.offset ?? 0) + (opts?.limit ?? 100) - 1)
      .abortSignal(signal)
    clear()

    if (error) {
      recordFailure()
      log.error('getPendingLeave', error.message, { code: error.code })
      return { data: [], error: error.message }
    }

    recordSuccess()
    return { data: (data ?? []).map(mapRow), error: null }
  } catch (err) {
    recordFailure()
    const msg = err instanceof Error ? err.message : 'Unknown error'
    log.error('getPendingLeave', msg)
    return { data: [], error: msg }
  }
}

// ── Mutations ──────────────────────────────────────────────

export async function createLeaveRequest(
  leave: Omit<LeaveRecord, 'id' | 'created_at'>,
  opts?: { client?: QueryOptions['client'] }
): Promise<ServiceResult<LeaveRecord | null>> {
  if (!isSupabaseConfigured()) return { data: null, error: null }

  try {
    const client = await resolveClient(opts?.client)
    const orgId = await getOrgId(client)
    if (!orgId) {
      log.error('createLeaveRequest', 'Could not resolve organisation_id')
      return { data: null, error: 'Could not resolve organisation' }
    }

    const { signal, clear } = queryTimeout()
    const { data, error } = await client
      .from('leave_records')
      .insert({
        organisation_id: orgId,
        user_id: leave.user_id,
        leave_type: leave.leave_type,
        status: leave.status ?? 'pending',
        start_date: leave.start_date,
        end_date: leave.end_date,
        days: leave.days,
        half_day_start: leave.half_day_start ?? false,
        half_day_end: leave.half_day_end ?? false,
        notes: leave.notes,
      })
      .select(LEAVE_COLUMNS)
      .abortSignal(signal)
      .single()
    clear()

    if (error) {
      log.error('createLeaveRequest', error.message, { code: error.code })
      return { data: null, error: error.message }
    }

    return { data: data ? mapRow(data) : null, error: null }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    log.error('createLeaveRequest', msg)
    return { data: null, error: msg }
  }
}

export async function updateLeaveStatus(
  id: string,
  status: 'approved' | 'declined' | 'cancelled',
  approvedBy?: string,
  opts?: { client?: QueryOptions['client'] }
): Promise<ServiceResult<LeaveRecord | null>> {
  if (!isSupabaseConfigured()) return { data: null, error: null }

  try {
    const client = await resolveClient(opts?.client)
    const payload: Record<string, unknown> = { status }
    if (approvedBy) {
      payload.approved_by_user_id = approvedBy
      payload.approved_at = new Date().toISOString()
    }

    const { signal, clear } = queryTimeout()
    const { data, error } = await client
      .from('leave_records')
      .update(payload)
      .eq('id', id)
      .select(LEAVE_COLUMNS)
      .abortSignal(signal)
      .single()
    clear()

    if (error) {
      log.error('updateLeaveStatus', error.message, { code: error.code })
      return { data: null, error: error.message }
    }

    return { data: data ? mapRow(data) : null, error: null }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    log.error('updateLeaveStatus', msg)
    return { data: null, error: msg }
  }
}

// ── Row mapper ─────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapRow(row: any): LeaveRecord {
  return {
    id: row.id,
    user_id: row.user_id ?? '',
    leave_type: row.leave_type ?? 'holiday',
    status: row.status ?? 'pending',
    start_date: row.start_date ?? '',
    end_date: row.end_date ?? '',
    days: Number(row.days) || 0,
    half_day_start: row.half_day_start ?? false,
    half_day_end: row.half_day_end ?? false,
    notes: row.notes ?? undefined,
    approved_by_user_id: row.approved_by_user_id ?? undefined,
    approved_at: row.approved_at ?? undefined,
    created_at: row.created_at ?? '',
  }
}

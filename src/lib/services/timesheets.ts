import {
  isSupabaseConfigured,
  resolveClient,
  getOrgId,
  type ServiceResult,
  type QueryOptions,
} from './config'
import { createServiceLogger } from './logger'
import { isCircuitOpen, recordFailure, recordSuccess, queryTimeout } from './resilience'
import { TIMESHEET_ENTRIES } from '@/lib/mock-data'
import type { TimesheetEntry } from '@/lib/types'

const log = createServiceLogger('timesheets')

// ── Column selection ──────────────────────────────────────

const TIMESHEET_COLUMNS = [
  'id', 'organisation_id', 'user_id', 'project_id', 'task_id',
  'date', 'hours', 'description', 'notes', 'stage', 'task_category',
  'billable', 'status', 'submitted_at', 'approved_by', 'approved_at',
  'created_at',
].join(', ')

// ── Queries ────────────────────────────────────────────────

export async function getTimesheetEntries(
  opts?: QueryOptions
): Promise<ServiceResult<TimesheetEntry[]>> {
  if (!isSupabaseConfigured()) return { data: TIMESHEET_ENTRIES, error: null }
  if (isCircuitOpen()) {
    log.warn('getTimesheetEntries', 'Circuit open — returning empty')
    return { data: [], error: 'Service temporarily unavailable' }
  }

  try {
    const client = await resolveClient(opts?.client)
    const { signal, clear } = queryTimeout()
    const { data, error } = await client
      .from('timesheet_entries')
      .select(TIMESHEET_COLUMNS)
      .order('date', { ascending: false })
      .range(opts?.offset ?? 0, (opts?.offset ?? 0) + (opts?.limit ?? 100) - 1)
      .abortSignal(signal)
    clear()

    if (error) {
      recordFailure()
      log.error('getTimesheetEntries', error.message, { code: error.code })
      return { data: [], error: error.message }
    }

    recordSuccess()
    return { data: (data ?? []).map(mapRow), error: null }
  } catch (err) {
    recordFailure()
    const msg = err instanceof Error ? err.message : 'Unknown error'
    log.error('getTimesheetEntries', msg)
    return { data: [], error: msg }
  }
}

export async function getTimesheetsByUser(
  userId: string,
  opts?: QueryOptions
): Promise<ServiceResult<TimesheetEntry[]>> {
  if (!isSupabaseConfigured()) {
    return { data: TIMESHEET_ENTRIES.filter(t => t.user_id === userId), error: null }
  }
  if (isCircuitOpen()) {
    return { data: [], error: 'Service temporarily unavailable' }
  }

  try {
    const client = await resolveClient(opts?.client)
    const { signal, clear } = queryTimeout()
    const { data, error } = await client
      .from('timesheet_entries')
      .select(TIMESHEET_COLUMNS)
      .eq('user_id', userId)
      .order('date', { ascending: false })
      .range(opts?.offset ?? 0, (opts?.offset ?? 0) + (opts?.limit ?? 100) - 1)
      .abortSignal(signal)
    clear()

    if (error) {
      recordFailure()
      log.error('getTimesheetsByUser', error.message, { code: error.code })
      return { data: [], error: error.message }
    }

    recordSuccess()
    return { data: (data ?? []).map(mapRow), error: null }
  } catch (err) {
    recordFailure()
    const msg = err instanceof Error ? err.message : 'Unknown error'
    log.error('getTimesheetsByUser', msg)
    return { data: [], error: msg }
  }
}

export async function getTimesheetsByProject(
  projectId: string,
  opts?: QueryOptions
): Promise<ServiceResult<TimesheetEntry[]>> {
  if (!isSupabaseConfigured()) {
    return { data: TIMESHEET_ENTRIES.filter(t => t.project_id === projectId), error: null }
  }
  if (isCircuitOpen()) {
    return { data: [], error: 'Service temporarily unavailable' }
  }

  try {
    const client = await resolveClient(opts?.client)
    const { signal, clear } = queryTimeout()
    const { data, error } = await client
      .from('timesheet_entries')
      .select(TIMESHEET_COLUMNS)
      .eq('project_id', projectId)
      .order('date', { ascending: false })
      .range(opts?.offset ?? 0, (opts?.offset ?? 0) + (opts?.limit ?? 100) - 1)
      .abortSignal(signal)
    clear()

    if (error) {
      recordFailure()
      log.error('getTimesheetsByProject', error.message, { code: error.code })
      return { data: [], error: error.message }
    }

    recordSuccess()
    return { data: (data ?? []).map(mapRow), error: null }
  } catch (err) {
    recordFailure()
    const msg = err instanceof Error ? err.message : 'Unknown error'
    log.error('getTimesheetsByProject', msg)
    return { data: [], error: msg }
  }
}

export async function getTimesheetsByWeek(
  userId: string,
  weekStart: string,
  opts?: { client?: QueryOptions['client'] }
): Promise<ServiceResult<TimesheetEntry[]>> {
  if (!isSupabaseConfigured()) {
    const start = new Date(weekStart)
    const end = new Date(start)
    end.setDate(end.getDate() + 7)
    return {
      data: TIMESHEET_ENTRIES.filter(
        t =>
          t.user_id === userId &&
          t.date >= weekStart &&
          t.date < end.toISOString().split('T')[0]
      ),
      error: null,
    }
  }
  if (isCircuitOpen()) {
    return { data: [], error: 'Service temporarily unavailable' }
  }

  try {
    const client = await resolveClient(opts?.client)
    const end = new Date(weekStart)
    end.setDate(end.getDate() + 7)
    const weekEnd = end.toISOString().split('T')[0]

    const { signal, clear } = queryTimeout()
    const { data, error } = await client
      .from('timesheet_entries')
      .select(TIMESHEET_COLUMNS)
      .eq('user_id', userId)
      .gte('date', weekStart)
      .lt('date', weekEnd)
      .order('date', { ascending: true })
      .abortSignal(signal)
    clear()

    if (error) {
      recordFailure()
      log.error('getTimesheetsByWeek', error.message, { code: error.code })
      return { data: [], error: error.message }
    }

    recordSuccess()
    return { data: (data ?? []).map(mapRow), error: null }
  } catch (err) {
    recordFailure()
    const msg = err instanceof Error ? err.message : 'Unknown error'
    log.error('getTimesheetsByWeek', msg)
    return { data: [], error: msg }
  }
}

// ── Mutations ──────────────────────────────────────────────

export async function createTimesheetEntry(
  entry: Omit<TimesheetEntry, 'id' | 'created_at'>,
  opts?: { client?: QueryOptions['client'] }
): Promise<ServiceResult<TimesheetEntry | null>> {
  if (!isSupabaseConfigured()) return { data: null, error: null }

  try {
    const client = await resolveClient(opts?.client)
    const orgId = await getOrgId(client)
    if (!orgId) {
      log.error('createTimesheetEntry', 'Could not resolve organisation_id')
      return { data: null, error: 'Could not resolve organisation' }
    }

    const { signal, clear } = queryTimeout()
    const { data, error } = await client
      .from('timesheet_entries')
      .insert({
        organisation_id: orgId,
        user_id: entry.user_id,
        project_id: entry.project_id,
        task_id: entry.task_id,
        date: entry.date,
        hours: entry.hours,
        description: entry.description,
        stage: entry.stage,
        task_category: entry.task_category,
        billable: entry.billable,
        status: entry.status ?? 'draft',
      })
      .select(TIMESHEET_COLUMNS)
      .abortSignal(signal)
      .single()
    clear()

    if (error) {
      log.error('createTimesheetEntry', error.message, { code: error.code })
      return { data: null, error: error.message }
    }

    return { data: data ? mapRow(data) : null, error: null }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    log.error('createTimesheetEntry', msg)
    return { data: null, error: msg }
  }
}

export async function updateTimesheetEntry(
  id: string,
  updates: Partial<TimesheetEntry>,
  opts?: { client?: QueryOptions['client'] }
): Promise<ServiceResult<TimesheetEntry | null>> {
  if (!isSupabaseConfigured()) return { data: null, error: null }

  try {
    const client = await resolveClient(opts?.client)
    const payload: Record<string, unknown> = {}
    if (updates.hours !== undefined) payload.hours = updates.hours
    if (updates.description !== undefined) payload.description = updates.description
    if (updates.status !== undefined) payload.status = updates.status
    if (updates.billable !== undefined) payload.billable = updates.billable
    if (updates.approved_by !== undefined) payload.approved_by = updates.approved_by

    const { signal, clear } = queryTimeout()
    const { data, error } = await client
      .from('timesheet_entries')
      .update(payload)
      .eq('id', id)
      .select(TIMESHEET_COLUMNS)
      .abortSignal(signal)
      .single()
    clear()

    if (error) {
      log.error('updateTimesheetEntry', error.message, { code: error.code })
      return { data: null, error: error.message }
    }

    return { data: data ? mapRow(data) : null, error: null }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    log.error('updateTimesheetEntry', msg)
    return { data: null, error: msg }
  }
}

// ── Row mapper ─────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapRow(row: any): TimesheetEntry {
  return {
    id: row.id,
    user_id: row.user_id ?? '',
    project_id: row.project_id ?? '',
    task_id: row.task_id ?? undefined,
    date: row.date ?? '',
    hours: Number(row.hours) || 0,
    description: row.description ?? undefined,
    notes: row.notes ?? undefined,
    stage: row.stage ?? 0,
    project_stage: undefined,
    task_category: row.task_category ?? 'admin_cpd_office',
    billable: row.billable ?? true,
    status: row.status ?? 'draft',
    submitted_at: row.submitted_at ?? undefined,
    approved_by: row.approved_by ?? undefined,
    approved_at: row.approved_at ?? undefined,
    created_at: row.created_at ?? '',
  }
}

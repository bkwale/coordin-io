import {
  isSupabaseConfigured,
  resolveClient,
  getOrgId,
  type ServiceResult,
  type QueryOptions,
} from './config'
import { createServiceLogger } from './logger'
import { isCircuitOpen, recordFailure, recordSuccess, queryTimeout } from './resilience'
import { ALL_TASKS } from '@/lib/mock-data'
import type { Task } from '@/lib/types'

const log = createServiceLogger('tasks')

// ── Column selection ──────────────────────────────────────

const TASK_COLUMNS = [
  'id', 'organisation_id', 'project_id', 'title', 'description',
  'stage', 'status', 'owner_id', 'due_date', 'required_flag',
  'created_at', 'updated_at',
].join(', ')

// ── Queries ────────────────────────────────────────────────

export async function getTasks(
  opts?: QueryOptions
): Promise<ServiceResult<Task[]>> {
  if (!isSupabaseConfigured()) return { data: ALL_TASKS, error: null }
  if (isCircuitOpen()) {
    log.warn('getTasks', 'Circuit open — returning empty')
    return { data: [], error: 'Service temporarily unavailable' }
  }

  try {
    const client = await resolveClient(opts?.client)
    const { signal, clear } = queryTimeout()
    const { data, error } = await client
      .from('tasks')
      .select(TASK_COLUMNS)
      .order('created_at', { ascending: false })
      .range(opts?.offset ?? 0, (opts?.offset ?? 0) + (opts?.limit ?? 100) - 1)
      .abortSignal(signal)
    clear()

    if (error) {
      recordFailure()
      log.error('getTasks', error.message, { code: error.code })
      return { data: [], error: error.message }
    }

    recordSuccess()
    return { data: (data ?? []).map(mapRow), error: null }
  } catch (err) {
    recordFailure()
    const msg = err instanceof Error ? err.message : 'Unknown error'
    log.error('getTasks', msg)
    return { data: [], error: msg }
  }
}

export async function getTasksByProject(
  projectId: string,
  opts?: QueryOptions
): Promise<ServiceResult<Task[]>> {
  if (!isSupabaseConfigured()) {
    return { data: ALL_TASKS.filter(t => t.project_id === projectId), error: null }
  }
  if (isCircuitOpen()) {
    return { data: [], error: 'Service temporarily unavailable' }
  }

  try {
    const client = await resolveClient(opts?.client)
    const { signal, clear } = queryTimeout()
    const { data, error } = await client
      .from('tasks')
      .select(TASK_COLUMNS)
      .eq('project_id', projectId)
      .order('stage', { ascending: true })
      .order('created_at', { ascending: true })
      .range(opts?.offset ?? 0, (opts?.offset ?? 0) + (opts?.limit ?? 200) - 1)
      .abortSignal(signal)
    clear()

    if (error) {
      recordFailure()
      log.error('getTasksByProject', error.message, { code: error.code })
      return { data: [], error: error.message }
    }

    recordSuccess()
    return { data: (data ?? []).map(mapRow), error: null }
  } catch (err) {
    recordFailure()
    const msg = err instanceof Error ? err.message : 'Unknown error'
    log.error('getTasksByProject', msg)
    return { data: [], error: msg }
  }
}

export async function getTask(
  id: string,
  opts?: { client?: QueryOptions['client'] }
): Promise<ServiceResult<Task | null>> {
  if (!isSupabaseConfigured()) {
    return { data: ALL_TASKS.find(t => t.id === id) ?? null, error: null }
  }
  if (isCircuitOpen()) {
    return { data: null, error: 'Service temporarily unavailable' }
  }

  try {
    const client = await resolveClient(opts?.client)
    const { signal, clear } = queryTimeout()
    const { data, error } = await client
      .from('tasks')
      .select(TASK_COLUMNS)
      .eq('id', id)
      .abortSignal(signal)
      .single()
    clear()

    if (error) {
      recordFailure()
      log.error('getTask', error.message, { code: error.code })
      return { data: null, error: error.message }
    }

    recordSuccess()
    return { data: data ? mapRow(data) : null, error: null }
  } catch (err) {
    recordFailure()
    const msg = err instanceof Error ? err.message : 'Unknown error'
    log.error('getTask', msg)
    return { data: null, error: msg }
  }
}

export async function getOverdueTasks(
  opts?: QueryOptions
): Promise<ServiceResult<Task[]>> {
  if (!isSupabaseConfigured()) {
    const now = new Date().toISOString().split('T')[0]
    return {
      data: ALL_TASKS.filter(t => t.due_date && t.due_date < now && t.status !== 'done'),
      error: null,
    }
  }
  if (isCircuitOpen()) {
    return { data: [], error: 'Service temporarily unavailable' }
  }

  try {
    const client = await resolveClient(opts?.client)
    const today = new Date().toISOString().split('T')[0]
    const { signal, clear } = queryTimeout()
    const { data, error } = await client
      .from('tasks')
      .select(TASK_COLUMNS)
      .lt('due_date', today)
      .neq('status', 'done')
      .order('due_date', { ascending: true })
      .range(opts?.offset ?? 0, (opts?.offset ?? 0) + (opts?.limit ?? 100) - 1)
      .abortSignal(signal)
    clear()

    if (error) {
      recordFailure()
      log.error('getOverdueTasks', error.message, { code: error.code })
      return { data: [], error: error.message }
    }

    recordSuccess()
    return { data: (data ?? []).map(mapRow), error: null }
  } catch (err) {
    recordFailure()
    const msg = err instanceof Error ? err.message : 'Unknown error'
    log.error('getOverdueTasks', msg)
    return { data: [], error: msg }
  }
}

// ── Mutations ──────────────────────────────────────────────

export async function createTask(
  task: Omit<Task, 'id' | 'created_at' | 'updated_at'>,
  opts?: { client?: QueryOptions['client'] }
): Promise<ServiceResult<Task | null>> {
  if (!isSupabaseConfigured()) return { data: null, error: null }

  try {
    const client = await resolveClient(opts?.client)
    const orgId = await getOrgId(client)
    if (!orgId) {
      log.error('createTask', 'Could not resolve organisation_id')
      return { data: null, error: 'Could not resolve organisation' }
    }

    const { signal, clear } = queryTimeout()
    const { data, error } = await client
      .from('tasks')
      .insert({
        organisation_id: orgId,
        project_id: task.project_id,
        title: task.title,
        description: task.description,
        stage: task.stage,
        status: task.status,
        owner_id: task.owner_user_id,
        due_date: task.due_date,
        required_flag: task.required_flag,
      })
      .select(TASK_COLUMNS)
      .abortSignal(signal)
      .single()
    clear()

    if (error) {
      log.error('createTask', error.message, { code: error.code })
      return { data: null, error: error.message }
    }

    return { data: data ? mapRow(data) : null, error: null }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    log.error('createTask', msg)
    return { data: null, error: msg }
  }
}

export async function updateTask(
  id: string,
  updates: Partial<Task>,
  opts?: { client?: QueryOptions['client'] }
): Promise<ServiceResult<Task | null>> {
  if (!isSupabaseConfigured()) return { data: null, error: null }

  try {
    const client = await resolveClient(opts?.client)
    const payload: Record<string, unknown> = {}
    if (updates.title !== undefined) payload.title = updates.title
    if (updates.description !== undefined) payload.description = updates.description
    if (updates.stage !== undefined) payload.stage = updates.stage
    if (updates.status !== undefined) payload.status = updates.status
    if (updates.owner_user_id !== undefined) payload.owner_id = updates.owner_user_id
    if (updates.due_date !== undefined) payload.due_date = updates.due_date

    const { signal, clear } = queryTimeout()
    const { data, error } = await client
      .from('tasks')
      .update(payload)
      .eq('id', id)
      .select(TASK_COLUMNS)
      .abortSignal(signal)
      .single()
    clear()

    if (error) {
      log.error('updateTask', error.message, { code: error.code })
      return { data: null, error: error.message }
    }

    return { data: data ? mapRow(data) : null, error: null }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    log.error('updateTask', msg)
    return { data: null, error: msg }
  }
}

// ── Row mapper ─────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapRow(row: any): Task {
  return {
    id: row.id,
    project_id: row.project_id,
    title: row.title,
    description: row.description ?? undefined,
    stage: row.stage ?? 0,
    status: row.status ?? 'not_started',
    owner_user_id: row.owner_id ?? undefined,
    due_date: row.due_date ?? undefined,
    required_flag: row.required_flag ?? false,
    created_at: row.created_at ?? '',
    updated_at: row.updated_at ?? '',
  }
}

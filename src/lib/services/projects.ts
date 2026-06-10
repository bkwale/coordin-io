import {
  isSupabaseConfigured,
  resolveClient,
  getOrgId,
  type ServiceResult,
  type QueryOptions,
} from './config'
import { createServiceLogger } from './logger'
import { isCircuitOpen, recordFailure, recordSuccess, queryTimeout } from './resilience'
import { PROJECTS } from '@/lib/mock-data'
import type { Project } from '@/lib/types'

const log = createServiceLogger('projects')

// ── Column selection ──────────────────────────────────────

const PROJECT_COLUMNS = [
  'id', 'organisation_id', 'name', 'client', 'description',
  'start_date', 'target_completion_date', 'current_stage', 'status',
  'project_lead_id', 'created_by_id', 'created_at', 'updated_at',
].join(', ')

// ── Queries ────────────────────────────────────────────────

export async function getProjects(
  opts?: QueryOptions
): Promise<ServiceResult<Project[]>> {
  if (!isSupabaseConfigured()) return { data: PROJECTS, error: null }
  if (isCircuitOpen()) {
    log.warn('getProjects', 'Circuit open — returning empty')
    return { data: [], error: 'Service temporarily unavailable' }
  }

  try {
    const client = await resolveClient(opts?.client)
    const { signal, clear } = queryTimeout()
    const { data, error } = await client
      .from('projects')
      .select(PROJECT_COLUMNS)
      .order('updated_at', { ascending: false })
      .range(opts?.offset ?? 0, (opts?.offset ?? 0) + (opts?.limit ?? 100) - 1)
      .abortSignal(signal)
    clear()

    if (error) {
      recordFailure()
      log.error('getProjects', error.message, { code: error.code })
      return { data: [], error: error.message }
    }

    recordSuccess()
    return { data: (data ?? []).map(mapRow), error: null }
  } catch (err) {
    recordFailure()
    const msg = err instanceof Error ? err.message : 'Unknown error'
    log.error('getProjects', msg)
    return { data: [], error: msg }
  }
}

export async function getProject(
  id: string,
  opts?: { client?: QueryOptions['client'] }
): Promise<ServiceResult<Project | null>> {
  if (!isSupabaseConfigured()) {
    return { data: PROJECTS.find(p => p.id === id) ?? null, error: null }
  }
  if (isCircuitOpen()) {
    return { data: null, error: 'Service temporarily unavailable' }
  }

  try {
    const client = await resolveClient(opts?.client)
    const { signal, clear } = queryTimeout()
    const { data, error } = await client
      .from('projects')
      .select(PROJECT_COLUMNS)
      .eq('id', id)
      .abortSignal(signal)
      .single()
    clear()

    if (error) {
      recordFailure()
      log.error('getProject', error.message, { code: error.code })
      return { data: null, error: error.message }
    }

    recordSuccess()
    return { data: data ? mapRow(data) : null, error: null }
  } catch (err) {
    recordFailure()
    const msg = err instanceof Error ? err.message : 'Unknown error'
    log.error('getProject', msg)
    return { data: null, error: msg }
  }
}

export async function getProjectsByStatus(
  status: string,
  opts?: QueryOptions
): Promise<ServiceResult<Project[]>> {
  if (!isSupabaseConfigured()) {
    return { data: PROJECTS.filter(p => p.status === status), error: null }
  }
  if (isCircuitOpen()) {
    return { data: [], error: 'Service temporarily unavailable' }
  }

  try {
    const client = await resolveClient(opts?.client)
    const { signal, clear } = queryTimeout()
    const { data, error } = await client
      .from('projects')
      .select(PROJECT_COLUMNS)
      .eq('status', status)
      .order('updated_at', { ascending: false })
      .range(opts?.offset ?? 0, (opts?.offset ?? 0) + (opts?.limit ?? 100) - 1)
      .abortSignal(signal)
    clear()

    if (error) {
      recordFailure()
      log.error('getProjectsByStatus', error.message, { code: error.code })
      return { data: [], error: error.message }
    }

    recordSuccess()
    return { data: (data ?? []).map(mapRow), error: null }
  } catch (err) {
    recordFailure()
    const msg = err instanceof Error ? err.message : 'Unknown error'
    log.error('getProjectsByStatus', msg)
    return { data: [], error: msg }
  }
}

// ── Mutations ──────────────────────────────────────────────

export async function createProject(
  project: Omit<Project, 'id' | 'created_at' | 'updated_at' | 'last_activity_at'>,
  opts?: { client?: QueryOptions['client'] }
): Promise<ServiceResult<Project | null>> {
  if (!isSupabaseConfigured()) return { data: null, error: null }

  try {
    const client = await resolveClient(opts?.client)
    const orgId = await getOrgId(client)
    if (!orgId) {
      log.error('createProject', 'Could not resolve organisation_id')
      return { data: null, error: 'Could not resolve organisation' }
    }

    const { signal, clear } = queryTimeout()
    const { data, error } = await client
      .from('projects')
      .insert({
        organisation_id: orgId,
        name: project.name,
        client: project.client,
        description: project.description,
        start_date: project.start_date,
        target_completion_date: project.target_completion_date,
        current_stage: project.current_stage,
        status: project.status,
        project_lead_id: project.project_lead_user_id,
        created_by_id: project.created_by_user_id,
      })
      .select(PROJECT_COLUMNS)
      .abortSignal(signal)
      .single()
    clear()

    if (error) {
      log.error('createProject', error.message, { code: error.code })
      return { data: null, error: error.message }
    }

    return { data: data ? mapRow(data) : null, error: null }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    log.error('createProject', msg)
    return { data: null, error: msg }
  }
}

export async function updateProject(
  id: string,
  updates: Partial<Project>,
  opts?: { client?: QueryOptions['client'] }
): Promise<ServiceResult<Project | null>> {
  if (!isSupabaseConfigured()) return { data: null, error: null }

  try {
    const client = await resolveClient(opts?.client)
    const payload: Record<string, unknown> = {}
    if (updates.name !== undefined) payload.name = updates.name
    if (updates.client !== undefined) payload.client = updates.client
    if (updates.description !== undefined) payload.description = updates.description
    if (updates.start_date !== undefined) payload.start_date = updates.start_date
    if (updates.target_completion_date !== undefined) payload.target_completion_date = updates.target_completion_date
    if (updates.current_stage !== undefined) payload.current_stage = updates.current_stage
    if (updates.status !== undefined) payload.status = updates.status
    if (updates.project_lead_user_id !== undefined) payload.project_lead_id = updates.project_lead_user_id

    const { signal, clear } = queryTimeout()
    const { data, error } = await client
      .from('projects')
      .update(payload)
      .eq('id', id)
      .select(PROJECT_COLUMNS)
      .abortSignal(signal)
      .single()
    clear()

    if (error) {
      log.error('updateProject', error.message, { code: error.code })
      return { data: null, error: error.message }
    }

    return { data: data ? mapRow(data) : null, error: null }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    log.error('updateProject', msg)
    return { data: null, error: msg }
  }
}

// ── Row mapper ─────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapRow(row: any): Project {
  return {
    id: row.id,
    name: row.name,
    client: row.client,
    description: row.description ?? undefined,
    start_date: row.start_date ?? '',
    target_completion_date: row.target_completion_date ?? undefined,
    current_stage: row.current_stage ?? 0,
    status: row.status ?? 'active',
    project_lead_user_id: row.project_lead_id ?? undefined,
    created_by_user_id: row.created_by_id ?? '',
    created_at: row.created_at ?? '',
    updated_at: row.updated_at ?? '',
    last_activity_at: row.updated_at ?? '',
  }
}

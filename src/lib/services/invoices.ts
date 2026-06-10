import {
  isSupabaseConfigured,
  resolveClient,
  getOrgId,
  type ServiceResult,
  type QueryOptions,
} from './config'
import { createServiceLogger } from './logger'
import { isCircuitOpen, recordFailure, recordSuccess, queryTimeout } from './resilience'
import { INVOICES } from '@/lib/mock-data'
import type { Invoice } from '@/lib/types'

const log = createServiceLogger('invoices')

// ── Column selection ──────────────────────────────────────

const INVOICE_COLUMNS = [
  'id', 'organisation_id', 'invoice_number', 'project_id', 'client',
  'quote_id', 'amount', 'vat_amount', 'total_amount', 'status',
  'description', 'issued_date', 'due_date', 'paid_date',
  'payment_reference', 'created_at', 'updated_at',
].join(', ')

// ── Queries ────────────────────────────────────────────────

export async function getInvoices(
  opts?: QueryOptions
): Promise<ServiceResult<Invoice[]>> {
  if (!isSupabaseConfigured()) return { data: INVOICES, error: null }
  if (isCircuitOpen()) {
    log.warn('getInvoices', 'Circuit open — returning empty')
    return { data: [], error: 'Service temporarily unavailable' }
  }

  try {
    const client = await resolveClient(opts?.client)
    const { signal, clear } = queryTimeout()
    const { data, error } = await client
      .from('invoices')
      .select(INVOICE_COLUMNS)
      .order('created_at', { ascending: false })
      .range(opts?.offset ?? 0, (opts?.offset ?? 0) + (opts?.limit ?? 100) - 1)
      .abortSignal(signal)
    clear()

    if (error) {
      recordFailure()
      log.error('getInvoices', error.message, { code: error.code })
      return { data: [], error: error.message }
    }

    recordSuccess()
    return { data: (data ?? []).map(mapRow), error: null }
  } catch (err) {
    recordFailure()
    const msg = err instanceof Error ? err.message : 'Unknown error'
    log.error('getInvoices', msg)
    return { data: [], error: msg }
  }
}

export async function getInvoice(
  id: string,
  opts?: { client?: QueryOptions['client'] }
): Promise<ServiceResult<Invoice | null>> {
  if (!isSupabaseConfigured()) {
    return { data: INVOICES.find(inv => inv.id === id) ?? null, error: null }
  }
  if (isCircuitOpen()) {
    return { data: null, error: 'Service temporarily unavailable' }
  }

  try {
    const client = await resolveClient(opts?.client)
    const { signal, clear } = queryTimeout()
    const { data, error } = await client
      .from('invoices')
      .select(INVOICE_COLUMNS)
      .eq('id', id)
      .abortSignal(signal)
      .single()
    clear()

    if (error) {
      recordFailure()
      log.error('getInvoice', error.message, { code: error.code })
      return { data: null, error: error.message }
    }

    recordSuccess()
    return { data: data ? mapRow(data) : null, error: null }
  } catch (err) {
    recordFailure()
    const msg = err instanceof Error ? err.message : 'Unknown error'
    log.error('getInvoice', msg)
    return { data: null, error: msg }
  }
}

export async function getInvoicesByProject(
  projectId: string,
  opts?: QueryOptions
): Promise<ServiceResult<Invoice[]>> {
  if (!isSupabaseConfigured()) {
    return { data: INVOICES.filter(inv => inv.project_id === projectId), error: null }
  }
  if (isCircuitOpen()) {
    return { data: [], error: 'Service temporarily unavailable' }
  }

  try {
    const client = await resolveClient(opts?.client)
    const { signal, clear } = queryTimeout()
    const { data, error } = await client
      .from('invoices')
      .select(INVOICE_COLUMNS)
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })
      .range(opts?.offset ?? 0, (opts?.offset ?? 0) + (opts?.limit ?? 100) - 1)
      .abortSignal(signal)
    clear()

    if (error) {
      recordFailure()
      log.error('getInvoicesByProject', error.message, { code: error.code })
      return { data: [], error: error.message }
    }

    recordSuccess()
    return { data: (data ?? []).map(mapRow), error: null }
  } catch (err) {
    recordFailure()
    const msg = err instanceof Error ? err.message : 'Unknown error'
    log.error('getInvoicesByProject', msg)
    return { data: [], error: msg }
  }
}

export async function getOverdueInvoices(
  opts?: QueryOptions
): Promise<ServiceResult<Invoice[]>> {
  if (!isSupabaseConfigured()) {
    return { data: INVOICES.filter(inv => inv.status === 'overdue'), error: null }
  }
  if (isCircuitOpen()) {
    return { data: [], error: 'Service temporarily unavailable' }
  }

  try {
    const client = await resolveClient(opts?.client)
    const { signal, clear } = queryTimeout()
    const { data, error } = await client
      .from('invoices')
      .select(INVOICE_COLUMNS)
      .eq('status', 'overdue')
      .order('due_date', { ascending: true })
      .range(opts?.offset ?? 0, (opts?.offset ?? 0) + (opts?.limit ?? 100) - 1)
      .abortSignal(signal)
    clear()

    if (error) {
      recordFailure()
      log.error('getOverdueInvoices', error.message, { code: error.code })
      return { data: [], error: error.message }
    }

    recordSuccess()
    return { data: (data ?? []).map(mapRow), error: null }
  } catch (err) {
    recordFailure()
    const msg = err instanceof Error ? err.message : 'Unknown error'
    log.error('getOverdueInvoices', msg)
    return { data: [], error: msg }
  }
}

// ── Mutations ──────────────────────────────────────────────

export async function createInvoice(
  invoice: Omit<Invoice, 'id' | 'created_at' | 'updated_at'>,
  opts?: { client?: QueryOptions['client'] }
): Promise<ServiceResult<Invoice | null>> {
  if (!isSupabaseConfigured()) return { data: null, error: null }

  try {
    const client = await resolveClient(opts?.client)
    const orgId = await getOrgId(client)
    if (!orgId) {
      log.error('createInvoice', 'Could not resolve organisation_id')
      return { data: null, error: 'Could not resolve organisation' }
    }

    const { signal, clear } = queryTimeout()
    const { data, error } = await client
      .from('invoices')
      .insert({
        organisation_id: orgId,
        invoice_number: invoice.invoice_number,
        project_id: invoice.project_id,
        quote_id: invoice.quote_id,
        client: invoice.client,
        description: invoice.description,
        amount: invoice.amount,
        vat_amount: invoice.vat_amount,
        total_amount: invoice.total_amount,
        status: invoice.status ?? 'draft',
        due_date: invoice.due_date,
      })
      .select(INVOICE_COLUMNS)
      .abortSignal(signal)
      .single()
    clear()

    if (error) {
      log.error('createInvoice', error.message, { code: error.code })
      return { data: null, error: error.message }
    }

    return { data: data ? mapRow(data) : null, error: null }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    log.error('createInvoice', msg)
    return { data: null, error: msg }
  }
}

export async function updateInvoiceStatus(
  id: string,
  status: string,
  extras?: { paid_date?: string; payment_reference?: string },
  opts?: { client?: QueryOptions['client'] }
): Promise<ServiceResult<Invoice | null>> {
  if (!isSupabaseConfigured()) return { data: null, error: null }

  try {
    const client = await resolveClient(opts?.client)
    const payload: Record<string, unknown> = { status }
    if (extras?.paid_date) payload.paid_date = extras.paid_date
    if (extras?.payment_reference) payload.payment_reference = extras.payment_reference

    const { signal, clear } = queryTimeout()
    const { data, error } = await client
      .from('invoices')
      .update(payload)
      .eq('id', id)
      .select(INVOICE_COLUMNS)
      .abortSignal(signal)
      .single()
    clear()

    if (error) {
      log.error('updateInvoiceStatus', error.message, { code: error.code })
      return { data: null, error: error.message }
    }

    return { data: data ? mapRow(data) : null, error: null }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    log.error('updateInvoiceStatus', msg)
    return { data: null, error: msg }
  }
}

// ── Row mapper ─────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapRow(row: any): Invoice {
  return {
    id: row.id,
    invoice_number: row.invoice_number ?? '',
    project_id: row.project_id ?? '',
    client: row.client ?? '',
    quote_id: row.quote_id ?? undefined,
    amount: Number(row.amount) || 0,
    vat_amount: Number(row.vat_amount) || 0,
    total_amount: Number(row.total_amount) || 0,
    status: row.status ?? 'draft',
    issued_date: row.issued_date ?? undefined,
    due_date: row.due_date ?? '',
    paid_date: row.paid_date ?? undefined,
    payment_reference: row.payment_reference ?? undefined,
    xero_synced: false,
    description: row.description ?? '',
    line_items: [],
    created_at: row.created_at ?? '',
    updated_at: row.updated_at ?? '',
  }
}

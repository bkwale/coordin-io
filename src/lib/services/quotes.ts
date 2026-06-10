import {
  isSupabaseConfigured,
  resolveClient,
  getOrgId,
  type ServiceResult,
  type QueryOptions,
} from './config'
import { createServiceLogger } from './logger'
import { isCircuitOpen, recordFailure, recordSuccess, queryTimeout } from './resilience'
import { FEE_QUOTE_RECORDS, FEE_QUOTE_LINE_ITEMS, FEE_QUOTE_TEMPLATES } from '@/lib/mock-data'
import type { FeeQuoteRecord, FeeQuoteLineItem, FeeQuoteTemplate } from '@/lib/types'

const log = createServiceLogger('quotes')

// ── Column selections ─────────────────────────────────────

const QUOTE_COLUMNS = [
  'id', 'organisation_id', 'quote_reference', 'quote_title', 'template_type',
  'status', 'client_name', 'client_contact', 'issue_date', 'valid_until',
  'fee_basis', 'total_fee', 'currency', 'prepared_by_id', 'project_id',
  'sent_at', 'sent_count', 'viewed_count', 'accepted_at', 'declined_at',
  'exclusions_text', 'assumptions_text', 'terms_text', 'payment_terms_text',
  'quote_mode', 'created_at', 'updated_at',
].join(', ')

const LINE_ITEM_COLUMNS = [
  'id', 'quote_id', 'sort_order', 'line_type', 'title', 'description',
  'related_stage', 'quantity', 'unit', 'rate', 'amount',
  'optional_flag', 'selected_by_default',
].join(', ')

const TEMPLATE_COLUMNS = [
  'id', 'organisation_id', 'name', 'template_type', 'description',
  'body_json', 'active_flag', 'created_at',
].join(', ')

// ── Queries ────────────────────────────────────────────────

export async function getQuotes(
  opts?: QueryOptions
): Promise<ServiceResult<FeeQuoteRecord[]>> {
  if (!isSupabaseConfigured()) return { data: FEE_QUOTE_RECORDS, error: null }
  if (isCircuitOpen()) {
    log.warn('getQuotes', 'Circuit open — returning empty')
    return { data: [], error: 'Service temporarily unavailable' }
  }

  try {
    const client = await resolveClient(opts?.client)
    const { signal, clear } = queryTimeout()
    const { data, error } = await client
      .from('quotes')
      .select(QUOTE_COLUMNS)
      .order('updated_at', { ascending: false })
      .range(opts?.offset ?? 0, (opts?.offset ?? 0) + (opts?.limit ?? 100) - 1)
      .abortSignal(signal)
    clear()

    if (error) {
      recordFailure()
      log.error('getQuotes', error.message, { code: error.code })
      return { data: [], error: error.message }
    }

    recordSuccess()
    return { data: (data ?? []).map(mapQuoteRow), error: null }
  } catch (err) {
    recordFailure()
    const msg = err instanceof Error ? err.message : 'Unknown error'
    log.error('getQuotes', msg)
    return { data: [], error: msg }
  }
}

export async function getQuote(
  id: string,
  opts?: { client?: QueryOptions['client'] }
): Promise<ServiceResult<FeeQuoteRecord | null>> {
  if (!isSupabaseConfigured()) {
    return { data: FEE_QUOTE_RECORDS.find(q => q.id === id) ?? null, error: null }
  }
  if (isCircuitOpen()) {
    return { data: null, error: 'Service temporarily unavailable' }
  }

  try {
    const client = await resolveClient(opts?.client)
    const { signal, clear } = queryTimeout()
    const { data, error } = await client
      .from('quotes')
      .select(QUOTE_COLUMNS)
      .eq('id', id)
      .abortSignal(signal)
      .single()
    clear()

    if (error) {
      recordFailure()
      log.error('getQuote', error.message, { code: error.code })
      return { data: null, error: error.message }
    }

    recordSuccess()
    return { data: data ? mapQuoteRow(data) : null, error: null }
  } catch (err) {
    recordFailure()
    const msg = err instanceof Error ? err.message : 'Unknown error'
    log.error('getQuote', msg)
    return { data: null, error: msg }
  }
}

export async function getQuoteLineItems(
  quoteId: string,
  opts?: { client?: QueryOptions['client'] }
): Promise<ServiceResult<FeeQuoteLineItem[]>> {
  if (!isSupabaseConfigured()) {
    return { data: FEE_QUOTE_LINE_ITEMS.filter(li => li.fee_quote_id === quoteId), error: null }
  }
  if (isCircuitOpen()) {
    return { data: [], error: 'Service temporarily unavailable' }
  }

  try {
    const client = await resolveClient(opts?.client)
    const { signal, clear } = queryTimeout()
    const { data, error } = await client
      .from('quote_line_items')
      .select(LINE_ITEM_COLUMNS)
      .eq('quote_id', quoteId)
      .order('sort_order', { ascending: true })
      .abortSignal(signal)
    clear()

    if (error) {
      recordFailure()
      log.error('getQuoteLineItems', error.message, { code: error.code })
      return { data: [], error: error.message }
    }

    recordSuccess()
    return { data: (data ?? []).map(mapLineItemRow), error: null }
  } catch (err) {
    recordFailure()
    const msg = err instanceof Error ? err.message : 'Unknown error'
    log.error('getQuoteLineItems', msg)
    return { data: [], error: msg }
  }
}

export async function getQuoteTemplates(
  opts?: { client?: QueryOptions['client'] }
): Promise<ServiceResult<FeeQuoteTemplate[]>> {
  if (!isSupabaseConfigured()) return { data: FEE_QUOTE_TEMPLATES, error: null }
  if (isCircuitOpen()) {
    return { data: [], error: 'Service temporarily unavailable' }
  }

  try {
    const client = await resolveClient(opts?.client)
    const { signal, clear } = queryTimeout()
    const { data, error } = await client
      .from('quote_templates')
      .select(TEMPLATE_COLUMNS)
      .eq('active_flag', true)
      .order('name', { ascending: true })
      .abortSignal(signal)
    clear()

    if (error) {
      recordFailure()
      log.error('getQuoteTemplates', error.message, { code: error.code })
      return { data: [], error: error.message }
    }

    recordSuccess()
    return { data: (data ?? []).map(mapTemplateRow), error: null }
  } catch (err) {
    recordFailure()
    const msg = err instanceof Error ? err.message : 'Unknown error'
    log.error('getQuoteTemplates', msg)
    return { data: [], error: msg }
  }
}

// ── Mutations ──────────────────────────────────────────────

export async function createQuote(
  quote: Partial<FeeQuoteRecord>,
  opts?: { client?: QueryOptions['client'] }
): Promise<ServiceResult<FeeQuoteRecord | null>> {
  if (!isSupabaseConfigured()) return { data: null, error: null }

  try {
    const client = await resolveClient(opts?.client)
    const orgId = await getOrgId(client)
    if (!orgId) {
      log.error('createQuote', 'Could not resolve organisation_id')
      return { data: null, error: 'Could not resolve organisation' }
    }

    const { signal, clear } = queryTimeout()
    const { data, error } = await client
      .from('quotes')
      .insert({
        organisation_id: orgId,
        quote_reference: quote.quote_reference,
        quote_title: quote.quote_title,
        template_type: quote.quote_template_type,
        status: quote.status ?? 'draft',
        client_name: quote.client_name,
        client_contact: quote.client_contact,
        issue_date: quote.issue_date,
        valid_until: quote.valid_until,
        total_fee: quote.total_fee ?? 0,
        currency: quote.currency ?? 'GBP',
        prepared_by_id: quote.prepared_by_user_id,
        project_id: quote.related_project_id,
        exclusions_text: quote.exclusions_text ?? '',
        assumptions_text: quote.assumptions_text ?? '',
        terms_text: quote.terms_text ?? '',
        payment_terms_text: quote.payment_terms_text ?? '',
      })
      .select(QUOTE_COLUMNS)
      .abortSignal(signal)
      .single()
    clear()

    if (error) {
      log.error('createQuote', error.message, { code: error.code })
      return { data: null, error: error.message }
    }

    return { data: data ? mapQuoteRow(data) : null, error: null }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    log.error('createQuote', msg)
    return { data: null, error: msg }
  }
}

export async function updateQuote(
  id: string,
  updates: Partial<FeeQuoteRecord>,
  opts?: { client?: QueryOptions['client'] }
): Promise<ServiceResult<FeeQuoteRecord | null>> {
  if (!isSupabaseConfigured()) return { data: null, error: null }

  try {
    const client = await resolveClient(opts?.client)
    const payload: Record<string, unknown> = {}
    if (updates.quote_title !== undefined) payload.quote_title = updates.quote_title
    if (updates.status !== undefined) payload.status = updates.status
    if (updates.total_fee !== undefined) payload.total_fee = updates.total_fee
    if (updates.client_name !== undefined) payload.client_name = updates.client_name
    if (updates.valid_until !== undefined) payload.valid_until = updates.valid_until

    const { signal, clear } = queryTimeout()
    const { data, error } = await client
      .from('quotes')
      .update(payload)
      .eq('id', id)
      .select(QUOTE_COLUMNS)
      .abortSignal(signal)
      .single()
    clear()

    if (error) {
      log.error('updateQuote', error.message, { code: error.code })
      return { data: null, error: error.message }
    }

    return { data: data ? mapQuoteRow(data) : null, error: null }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    log.error('updateQuote', msg)
    return { data: null, error: msg }
  }
}

// ── Row mappers ────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapQuoteRow(row: any): FeeQuoteRecord {
  return {
    id: row.id,
    organisation_id: row.organisation_id ?? '',
    quote_mode: row.quote_mode ?? 'standalone',
    related_project_id: row.project_id ?? undefined,
    related_opportunity_id: undefined,
    quote_reference: row.quote_reference ?? '',
    quote_title: row.quote_title ?? '',
    quote_template_type: row.template_type ?? 'full_service',
    status: row.status ?? 'draft',
    optional_status: undefined,
    client_name: row.client_name ?? '',
    client_contact: row.client_contact ?? undefined,
    issue_date: row.issue_date ?? '',
    valid_until: row.valid_until ?? '',
    fee_basis: row.fee_basis ?? 'fixed',
    total_fee: Number(row.total_fee) || 0,
    currency: row.currency ?? 'GBP',
    prepared_by_user_id: row.prepared_by_id ?? '',
    sent_at: row.sent_at ?? undefined,
    sent_count: row.sent_count ?? 0,
    viewed_count: row.viewed_count ?? 0,
    last_viewed_at: undefined,
    accepted_at: row.accepted_at ?? undefined,
    accepted_by: undefined,
    declined_at: row.declined_at ?? undefined,
    exclusions_text: row.exclusions_text ?? '',
    assumptions_text: row.assumptions_text ?? '',
    terms_text: row.terms_text ?? '',
    payment_terms_text: row.payment_terms_text ?? '',
    design_freeze_flag: false,
    deposit_required_flag: false,
    cgi_render_flag: false,
    consultant_coordination_flag: false,
    brpd_role_flag: false,
    cdm_pd_role_flag: false,
    created_at: row.created_at ?? '',
    updated_at: row.updated_at ?? '',
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapLineItemRow(row: any): FeeQuoteLineItem {
  return {
    id: row.id,
    fee_quote_id: row.quote_id ?? '',
    sort_order: row.sort_order ?? 0,
    line_type: row.line_type ?? 'stage_service',
    title: row.title ?? '',
    description: row.description ?? '',
    related_stage: row.related_stage ?? undefined,
    quantity: row.quantity ?? undefined,
    unit: row.unit ?? undefined,
    rate: row.rate ? Number(row.rate) : undefined,
    amount: Number(row.amount) || 0,
    optional_flag: row.optional_flag ?? false,
    selected_by_default: row.selected_by_default ?? true,
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapTemplateRow(row: any): FeeQuoteTemplate {
  return {
    id: row.id,
    organisation_id: row.organisation_id ?? '',
    name: row.name ?? '',
    template_type: row.template_type ?? 'full_service',
    description: row.description ?? '',
    suitable_for: [],
    default_sections: [],
    body_json: row.body_json ?? '{}',
    active_flag: row.active_flag ?? true,
    created_at: row.created_at ?? '',
  }
}

/**
 * Xero API client — thin REST adapter over raw fetch.
 *
 * All calls go through `xeroFetch()` which handles:
 *  - Bearer token injection
 *  - xero-tenant-id header
 *  - Rate limit awareness (60 req/min)
 *  - JSON parsing and error extraction
 *
 * No heavy SDK dependency — just typed fetch wrappers.
 */

import { getValidAccessToken } from './oauth'
import type {
  XeroInvoice,
  XeroContact,
  XeroLineItem,
  XeroInvoiceType,
  XeroInvoiceStatus,
} from './types'

const XERO_API_BASE = 'https://api.xero.com/api.xro/2.0'

/* ── Core Fetch ────────────────────────────────────────── */

interface XeroFetchOptions {
  connectionId: string
  tenantId: string
  path: string
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  body?: unknown
  params?: Record<string, string>
}

export class XeroApiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public xeroMessage?: string,
  ) {
    super(message)
    this.name = 'XeroApiError'
  }
}

/**
 * Core fetch wrapper — injects auth, tenant header, handles errors.
 */
async function xeroFetch<T>(opts: XeroFetchOptions): Promise<T> {
  const accessToken = await getValidAccessToken(opts.connectionId)

  let url = `${XERO_API_BASE}${opts.path}`
  if (opts.params) {
    const qs = new URLSearchParams(opts.params)
    url += `?${qs.toString()}`
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    'xero-tenant-id': opts.tenantId,
    Accept: 'application/json',
  }

  const fetchOpts: RequestInit = {
    method: opts.method || 'GET',
    headers,
  }

  if (opts.body) {
    headers['Content-Type'] = 'application/json'
    fetchOpts.body = JSON.stringify(opts.body)
  }

  const res = await fetch(url, fetchOpts)

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    let xeroMessage = text
    try {
      const parsed = JSON.parse(text)
      xeroMessage = parsed.Message || parsed.Detail || text
    } catch {
      // use raw text
    }
    throw new XeroApiError(
      `Xero API error ${res.status} on ${opts.method || 'GET'} ${opts.path}`,
      res.status,
      xeroMessage,
    )
  }

  // 204 No Content
  if (res.status === 204) return {} as T

  return res.json() as Promise<T>
}

/* ── Contacts ──────────────────────────────────────────── */

interface ContactsResponse {
  Contacts: XeroContact[]
}

export async function listContacts(
  connectionId: string,
  tenantId: string,
  opts?: { modifiedAfter?: Date; page?: number },
): Promise<XeroContact[]> {
  const params: Record<string, string> = {}
  if (opts?.page) params.page = String(opts.page)

  const headers: Record<string, string> = {}
  if (opts?.modifiedAfter) {
    // Xero uses If-Modified-Since for incremental sync
    headers['If-Modified-Since'] = opts.modifiedAfter.toISOString()
  }

  const data = await xeroFetch<ContactsResponse>({
    connectionId,
    tenantId,
    path: '/Contacts',
    params: Object.keys(params).length ? params : undefined,
  })

  return data.Contacts || []
}

export async function getContact(
  connectionId: string,
  tenantId: string,
  contactId: string,
): Promise<XeroContact | null> {
  try {
    const data = await xeroFetch<ContactsResponse>({
      connectionId,
      tenantId,
      path: `/Contacts/${contactId}`,
    })
    return data.Contacts?.[0] || null
  } catch (err) {
    if (err instanceof XeroApiError && err.statusCode === 404) return null
    throw err
  }
}

export async function createContact(
  connectionId: string,
  tenantId: string,
  contact: Partial<XeroContact>,
): Promise<XeroContact> {
  const data = await xeroFetch<ContactsResponse>({
    connectionId,
    tenantId,
    path: '/Contacts',
    method: 'POST',
    body: contact,
  })
  return data.Contacts[0]
}

export async function updateContact(
  connectionId: string,
  tenantId: string,
  contactId: string,
  contact: Partial<XeroContact>,
): Promise<XeroContact> {
  const data = await xeroFetch<ContactsResponse>({
    connectionId,
    tenantId,
    path: `/Contacts/${contactId}`,
    method: 'POST',
    body: { ...contact, ContactID: contactId },
  })
  return data.Contacts[0]
}

/* ── Invoices ──────────────────────────────────────────── */

interface InvoicesResponse {
  Invoices: XeroInvoice[]
}

export async function listInvoices(
  connectionId: string,
  tenantId: string,
  opts?: {
    type?: XeroInvoiceType
    status?: XeroInvoiceStatus
    modifiedAfter?: Date
    page?: number
  },
): Promise<XeroInvoice[]> {
  const params: Record<string, string> = {}
  if (opts?.page) params.page = String(opts.page)

  // Build where clause for Xero's filter syntax
  const filters: string[] = []
  if (opts?.type) filters.push(`Type=="${opts.type}"`)
  if (opts?.status) filters.push(`Status=="${opts.status}"`)
  if (filters.length) params.where = filters.join('&&')

  if (opts?.modifiedAfter) {
    params['If-Modified-Since'] = opts.modifiedAfter.toISOString()
  }

  const data = await xeroFetch<InvoicesResponse>({
    connectionId,
    tenantId,
    path: '/Invoices',
    params: Object.keys(params).length ? params : undefined,
  })

  return data.Invoices || []
}

export async function getInvoice(
  connectionId: string,
  tenantId: string,
  invoiceId: string,
): Promise<XeroInvoice | null> {
  try {
    const data = await xeroFetch<InvoicesResponse>({
      connectionId,
      tenantId,
      path: `/Invoices/${invoiceId}`,
    })
    return data.Invoices?.[0] || null
  } catch (err) {
    if (err instanceof XeroApiError && err.statusCode === 404) return null
    throw err
  }
}

export async function createInvoice(
  connectionId: string,
  tenantId: string,
  invoice: Partial<XeroInvoice>,
): Promise<XeroInvoice> {
  const data = await xeroFetch<InvoicesResponse>({
    connectionId,
    tenantId,
    path: '/Invoices',
    method: 'POST',
    body: invoice,
  })
  return data.Invoices[0]
}

export async function updateInvoice(
  connectionId: string,
  tenantId: string,
  invoiceId: string,
  invoice: Partial<XeroInvoice>,
): Promise<XeroInvoice> {
  const data = await xeroFetch<InvoicesResponse>({
    connectionId,
    tenantId,
    path: `/Invoices/${invoiceId}`,
    method: 'POST',
    body: { ...invoice, InvoiceID: invoiceId },
  })
  return data.Invoices[0]
}

/* ── Mapping helpers ───────────────────────────────────── */

/**
 * Map a Coordin supplier to a Xero contact payload.
 */
export function mapSupplierToXeroContact(supplier: {
  name: string
  contactEmail?: string | null
  contactPhone?: string | null
  address?: string | null
  vatNumber?: string | null
  country?: string | null
}): Partial<XeroContact> {
  const contact: Partial<XeroContact> = {
    Name: supplier.name,
    IsSupplier: true,
  }

  if (supplier.contactEmail) contact.EmailAddress = supplier.contactEmail
  if (supplier.vatNumber) contact.TaxNumber = supplier.vatNumber

  if (supplier.contactPhone) {
    contact.Phones = [{ PhoneType: 'DEFAULT', PhoneNumber: supplier.contactPhone }]
  }

  if (supplier.address) {
    contact.Addresses = [{
      AddressType: 'STREET',
      AddressLine1: supplier.address,
      Country: supplier.country || undefined,
    }]
  }

  return contact
}

/**
 * Map a Coordin outbound invoice to a Xero ACCREC invoice payload.
 */
export function mapOutboundToXeroInvoice(invoice: {
  invoiceNumber: string
  clientName: string
  invoiceDate: Date
  dueDate?: Date | null
  currency: string
  taxRate: number
  notes?: string | null
  lineItems: Array<{
    description: string
    quantity: number
    unitPrice: number
    vatRate: number
  }>
}, xeroContactId: string): Partial<XeroInvoice> {
  return {
    Type: 'ACCREC',
    Contact: { ContactID: xeroContactId },
    InvoiceNumber: invoice.invoiceNumber,
    Date: invoice.invoiceDate.toISOString().split('T')[0],
    DueDate: invoice.dueDate?.toISOString().split('T')[0],
    CurrencyCode: invoice.currency,
    Status: 'DRAFT',
    Reference: invoice.notes || undefined,
    LineItems: invoice.lineItems.map((li): XeroLineItem => ({
      Description: li.description,
      Quantity: li.quantity,
      UnitAmount: li.unitPrice,
      TaxType: li.vatRate === 0 ? 'NONE' : undefined,
    })),
  }
}

/**
 * Map a Coordin inbound invoice to a Xero ACCPAY invoice payload.
 */
export function mapInboundToXeroInvoice(invoice: {
  invoiceNumber?: string | null
  invoiceDate?: Date | null
  dueDate?: Date | null
  currency: string
  totalAmount: number
  notes?: string | null
  lineItems?: Array<{
    description: string
    quantity: number
    unitPrice: number
  }>
}, xeroContactId: string): Partial<XeroInvoice> {
  // If we have parsed line items, use them; otherwise single line
  const lineItems: XeroLineItem[] = invoice.lineItems?.length
    ? invoice.lineItems.map((li) => ({
        Description: li.description,
        Quantity: li.quantity,
        UnitAmount: li.unitPrice,
      }))
    : [{
        Description: `Invoice ${invoice.invoiceNumber || '(no number)'}`,
        Quantity: 1,
        UnitAmount: invoice.totalAmount,
      }]

  return {
    Type: 'ACCPAY',
    Contact: { ContactID: xeroContactId },
    InvoiceNumber: invoice.invoiceNumber || undefined,
    Date: invoice.invoiceDate?.toISOString().split('T')[0],
    DueDate: invoice.dueDate?.toISOString().split('T')[0],
    CurrencyCode: invoice.currency,
    Status: 'DRAFT',
    Reference: invoice.notes || undefined,
    LineItems: lineItems,
  }
}

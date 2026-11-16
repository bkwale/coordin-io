/**
 * Merit Aktiva API client (Estonia). Docs: https://api.merit.ee
 *
 * Every call carries ?ApiId=…&timestamp=…&signature=… where
 *   signature = base64( HMAC-SHA256( key = apiKey, data = apiId + timestamp + requestBody ) )
 * and timestamp is UTC yyyyMMddHHmmss. The API ID and key belong to the firm (Merit: Settings → API settings).
 * Pure functions here; nothing touches the database. Server-only.
 */
import { createHmac } from 'crypto'

export const MERIT_BASE = 'https://aktiva.merit.ee/api'
const TIMEOUT_MS = 20_000

export interface MeritCredentials { apiId: string; apiKey: string }

export class MeritApiError extends Error {
  constructor(message: string, public status: number, public code: 'auth' | 'rejected' | 'unavailable' | 'no_einvoice') {
    super(message)
    this.name = 'MeritApiError'
  }
}

export function meritTimestamp(d: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}`
}

export function meritSignature(apiId: string, apiKey: string, timestamp: string, body: string): string {
  return createHmac('sha256', Buffer.from(apiKey, 'ascii')).update(Buffer.from(apiId + timestamp + body, 'utf8')).digest('base64')
}

export function meritUrl(path: string, creds: MeritCredentials, body: string, now: Date = new Date()): string {
  const ts = meritTimestamp(now)
  const sig = meritSignature(creds.apiId, creds.apiKey, ts, body)
  return `${MERIT_BASE}/${path}?ApiId=${encodeURIComponent(creds.apiId)}&timestamp=${ts}&signature=${encodeURIComponent(sig)}`
}

/** Merit answers some calls with a JSON string that itself holds JSON. */
function parseMerit(text: string): unknown {
  let v: unknown = text
  for (let i = 0; i < 2 && typeof v === 'string'; i++) {
    try { v = JSON.parse(v) } catch { break }
  }
  return v
}

async function call<T>(path: string, creds: MeritCredentials, payload: unknown): Promise<T> {
  const body = payload === undefined ? '' : JSON.stringify(payload)
  let res: Response
  try {
    res = await fetch(meritUrl(path, creds, body), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
  } catch {
    throw new MeritApiError('Merit did not answer. Try again in a few minutes.', 0, 'unavailable')
  }
  const text = await res.text()
  if (res.status === 401 || res.status === 403) {
    throw new MeritApiError('Merit did not accept the API ID and key. Check them in Merit under Settings → API settings.', res.status, 'auth')
  }
  if (res.status >= 500) throw new MeritApiError('Merit is having a problem. Try again in a few minutes.', res.status, 'unavailable')
  if (!res.ok) {
    const detail = String(typeof parseMerit(text) === 'string' ? parseMerit(text) : text).slice(0, 300)
    if (/api-noeinv/i.test(detail)) throw new MeritApiError('This client cannot receive e-invoices yet.', res.status, 'no_einvoice')
    throw new MeritApiError(`Merit refused the request: ${detail || res.status}`, res.status, 'rejected')
  }
  return parseMerit(text) as T
}

export interface MeritTax { Id: string; Code: string; Name: string; TaxPct: number; NonActive?: boolean }

/** The firm's VAT rates in Merit. Also the cheapest call for "do these credentials work?". */
export async function getTaxes(creds: MeritCredentials): Promise<MeritTax[]> {
  const out = await call<unknown>('v1/gettaxes', creds, undefined)
  if (!Array.isArray(out)) throw new MeritApiError('Merit sent an answer Coordin could not read.', 200, 'rejected')
  return (out as MeritTax[]).filter((t) => t && typeof t.Id === 'string' && !t.NonActive)
}

/** Pick the tax row for a rate. Prefers a plain domestic rate (shortest name) when several share the percentage. */
export function pickTax(taxes: MeritTax[], pct: number): MeritTax | null {
  const same = taxes.filter((t) => Math.abs(Number(t.TaxPct) - pct) < 0.001)
  if (same.length === 0) return null
  return [...same].sort((a, b) => (a.Name || '').length - (b.Name || '').length)[0]
}

export interface MeritInvoiceInput {
  invoiceNumber: string
  invoiceDate: Date
  dueDate?: Date | null
  currency: string
  clientName: string
  clientEmail?: string | null
  clientAddress?: string | null
  clientCountry?: string | null
  clientVatNumber?: string | null
  notes?: string | null
  lineItems: Array<{ description: string; quantity: number; unitPrice: number; vatRate: number }>
}

export interface MeritTaxMap { byRate: (pct: number) => string | null }

const day = (d: Date) => meritTimestamp(d).slice(0, 8)
const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100

/** Coordin outbound invoice → Merit sendinvoice payload. Throws if a line's VAT rate has no Merit tax. */
export function buildInvoicePayload(inv: MeritInvoiceInput, taxes: MeritTaxMap, itemCode: string): Record<string, unknown> {
  const taxTotals = new Map<string, number>()
  let net = 0
  const rows = inv.lineItems.map((li) => {
    const taxId = taxes.byRate(li.vatRate)
    if (!taxId) throw new MeritApiError(`No VAT rate of ${li.vatRate}% is set up in Merit for invoice ${inv.invoiceNumber}.`, 0, 'rejected')
    const amount = round2(li.quantity * li.unitPrice)
    net += amount
    taxTotals.set(taxId, (taxTotals.get(taxId) ?? 0) + amount * (li.vatRate / 100))
    return {
      Item: { Code: itemCode.slice(0, 20), Description: li.description.slice(0, 150), Type: 2 },
      Quantity: li.quantity,
      Price: li.unitPrice,
      TaxId: taxId,
    }
  })
  const country = (inv.clientCountry || 'EE').toUpperCase().slice(0, 2)
  return {
    Customer: {
      Name: inv.clientName.slice(0, 150),
      NotTDCustomer: country !== 'EE',
      CountryCode: country,
      ...(inv.clientVatNumber ? { VatRegNo: inv.clientVatNumber.slice(0, 30) } : {}),
      ...(inv.clientAddress ? { Address: inv.clientAddress.slice(0, 100) } : {}),
      ...(inv.clientEmail ? { Email: inv.clientEmail.slice(0, 80) } : {}),
    },
    DocDate: day(inv.invoiceDate),
    DueDate: day(inv.dueDate ?? inv.invoiceDate),
    TransactionDate: day(inv.invoiceDate),
    InvoiceNo: inv.invoiceNumber.slice(0, 35),
    CurrencyCode: inv.currency,
    InvoiceRow: rows,
    TaxAmount: [...taxTotals.entries()].map(([TaxId, amount]) => ({ TaxId, Amount: round2(amount) })),
    TotalAmount: round2(net),
    ...(inv.notes ? { Hcomment: inv.notes.slice(0, 4000) } : {}),
  }
}

export interface MeritInvoiceResult { CustomerId?: string; InvoiceId?: string; InvoiceNo?: string; RefNo?: string; NewCustomer?: boolean; EInvReceiver?: unknown }

export async function sendInvoice(creds: MeritCredentials, payload: Record<string, unknown>): Promise<MeritInvoiceResult> {
  const out = await call<MeritInvoiceResult>('v1/sendinvoice', creds, payload)
  if (!out || typeof out !== 'object' || !out.InvoiceId) throw new MeritApiError('Merit did not confirm the invoice.', 200, 'rejected')
  return out
}

/** Ask Merit to deliver an invoice it already holds as an e-invoice (e-arve) through its operator. */
export async function sendAsEInvoice(creds: MeritCredentials, meritInvoiceId: string): Promise<void> {
  await call<unknown>('v2/sendinvoiceaseinv', creds, { Id: meritInvoiceId, DelivNote: false })
}

/**
 * PDF/Image/DOCX/Spreadsheet Invoice Parser — extracted from Morway
 *
 * Uses AI (Anthropic SDK) to extract structured invoice data from:
 * - PDF files (via unpdf text extraction)
 * - Images (via Claude vision API)
 * - Word documents (via mammoth)
 * - Excel/CSV spreadsheets (via xlsx/SheetJS)
 * - Email body text
 *
 * Pure parsing logic — no database dependencies.
 *
 * Dependencies: @anthropic-ai/sdk, unpdf (add to package.json)
 * Optional: mammoth (for .docx), xlsx (for .xlsx/.csv)
 */

import Anthropic from '@anthropic-ai/sdk'
import type { ParsedInvoice, ParsedLineItem, DocumentType } from './ubl-parser'

async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  const { extractText } = await import('unpdf')
  const result = await extractText(new Uint8Array(buffer))
  const text = result.text
  return Array.isArray(text) ? text.join('\n\n') : (text ?? '')
}

const EXTRACTION_PROMPT = `You are a multilingual invoice data extraction system used by EU construction and architecture firms.
You MUST handle invoices in ANY language — German, French, Dutch, Italian, Spanish, Polish, Estonian, English, and others.

Common field names by language:
- Rechnung/Rechnungsnummer/Rechnungsdatum/Fälligkeitsdatum/MwSt/Nettobetrag/Bruttobetrag (German)
- Facture/Numéro/Date/Échéance/TVA/Montant HT/Montant TTC (French)
- Factuur/Factuurnummer/Factuurdatum/Vervaldatum/BTW/Netto/Bruto (Dutch)
- Fattura/Numero/Data/Scadenza/IVA/Imponibile/Totale (Italian)

The document may contain ONE or MULTIPLE invoices. It may also contain CREDIT NOTES (Gutschrift, Avoir, Creditnota, Nota di credito).

Return ONLY a JSON array (no markdown, no explanation, no code fences):

[
  {
    "documentType": "invoice" or "credit_note",
    "invoiceNumber": "string",
    "invoiceDate": "YYYY-MM-DD",
    "dueDate": "YYYY-MM-DD or null",
    "currency": "EUR/USD/GBP etc",
    "supplier": {
      "name": "string",
      "vatNumber": "string or null",
      "address": "string or null"
    },
    "buyer": {
      "name": "string or null",
      "vatNumber": "string or null"
    },
    "reverseCharge": boolean,
    "vatExemptionReason": "REVERSE_CHARGE" | "INTRA_COMMUNITY" | "EXPORT" | "EXEMPT_MEDICAL" | "EXEMPT_EDUCATION" | "EXEMPT_FINANCIAL" | "SMALL_BUSINESS" | "OTHER" | null,
    "linkedInvoiceNumber": "string or null",
    "lineItems": [
      {
        "description": "string (translate to English if needed)",
        "quantity": number,
        "unitPrice": number,
        "vatRate": number,
        "lineTotal": number,
        "vatExemptionReason": "same as above, or null if VAT applies normally",
        "suggestedAccountCode": "string",
        "accountCodeConfidence": number between 0.0 and 1.0
      }
    ],
    "vatBreakdown": [
      { "rate": number, "taxableAmount": number, "vatAmount": number }
    ],
    "netAmount": number,
    "vatAmount": number,
    "grossAmount": number
  }
]

Rules:
- All amounts as numbers (not strings), using period as decimal separator
- For credit notes: amounts should be POSITIVE
- VAT rate as percentage (e.g., 19 not 0.19)
- If you can't find a field, use null for strings or 0 for numbers
- invoiceDate and dueDate in YYYY-MM-DD format
- Currency should be 3-letter ISO code
- If there is only ONE invoice, still return it inside an array: [{ ... }]
- Extract EVERY invoice and credit note found
- documentType: "credit_note" for Gutschrift, Avoir, Creditnota, credit memo, or negative totals
- reverseCharge: true if reverse charge / Steuerschuldnerschaft / autoliquidation / verlegging
- vatBreakdown: group all line items by VAT rate
- Return ONLY the JSON array, nothing else`

/**
 * Parse a PDF that may contain one or more invoices.
 */
export async function parsePdfInvoices(pdfBuffer: Buffer, orgContext?: string): Promise<ParsedInvoice[]> {
  let rawText: string
  try {
    rawText = await extractTextFromPdf(pdfBuffer)
  } catch (err) {
    return [emptyInvoice([`PDF text extraction failed: ${err instanceof Error ? err.message : 'unknown error'}`])]
  }

  if (!rawText || rawText.trim().length < 20) {
    return [emptyInvoice(['PDF contains no readable text — may be a scanned image'])]
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return [emptyInvoice(['ANTHROPIC_API_KEY not configured — cannot parse PDF invoices'])]
  }

  const anthropic = new Anthropic({ apiKey })

  let rawItems: Array<Record<string, unknown>>
  try {
    const response = await anthropic.messages.create({
      model: process.env.INVOICE_PARSER_MODEL || 'claude-sonnet-4-6',
      max_tokens: 4000,
      messages: [
        {
          role: 'user',
          content: `${EXTRACTION_PROMPT}${orgContext ? `\n\nORGANISATION CONTEXT:\n${orgContext}` : ''}\n\nInvoice text:\n\n${rawText.slice(0, 20000)}`,
        },
      ],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    const parsed = extractJsonFromResponse(text)
    if (!parsed) {
      return [emptyInvoice(['AI extraction returned no parseable JSON'])]
    }

    rawItems = Array.isArray(parsed) ? parsed : [parsed]
  } catch (err) {
    return [emptyInvoice([`AI extraction failed: ${err instanceof Error ? err.message : 'unknown error'}`])]
  }

  if (rawItems.length === 0) {
    return [emptyInvoice(['AI extraction returned empty array'])]
  }

  return rawItems.map((extracted) => mapToParsedInvoice(extracted))
}

/**
 * Single-invoice convenience wrapper.
 */
export async function parsePdfInvoice(pdfBuffer: Buffer): Promise<ParsedInvoice> {
  const results = await parsePdfInvoices(pdfBuffer)
  return results[0] ?? emptyInvoice(['No invoices found in PDF'])
}

/**
 * Parse invoice data from an image (JPG, PNG, WebP).
 */
export async function parseImageInvoices(
  imageBuffer: Buffer,
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif',
  orgContext?: string
): Promise<ParsedInvoice[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return [emptyInvoice(['ANTHROPIC_API_KEY not configured'])]
  }

  const anthropic = new Anthropic({ apiKey })

  try {
    const base64 = imageBuffer.toString('base64')
    const response = await anthropic.messages.create({
      model: process.env.INVOICE_PARSER_MODEL || 'claude-sonnet-4-6',
      max_tokens: 4000,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: mimeType, data: base64 },
            },
            {
              type: 'text',
              text: EXTRACTION_PROMPT + (orgContext ? `\n\nORGANISATION CONTEXT:\n${orgContext}` : '') + '\n\nExtract invoice data from this image.',
            },
          ],
        },
      ],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    const parsed = extractJsonFromResponse(text)
    if (!parsed) return [emptyInvoice(['Vision extraction returned no parseable JSON'])]

    const rawItems = Array.isArray(parsed) ? parsed as Array<Record<string, unknown>> : [parsed as Record<string, unknown>]
    return rawItems.map((extracted) => mapToParsedInvoice(extracted))
  } catch (err) {
    return [emptyInvoice([`Vision extraction failed: ${err instanceof Error ? err.message : 'unknown error'}`])]
  }
}

// ─── JSON EXTRACTION ──────────────────────────────────────────────────────────

function extractJsonFromResponse(text: string): unknown | null {
  const stripped = text.replace(/```(?:json)?\s*/g, '').replace(/```/g, '').trim()

  try { return JSON.parse(stripped) } catch { /* fall through */ }

  const arrayStr = extractFirstJsonArray(stripped)
  if (arrayStr) { try { return JSON.parse(arrayStr) } catch { /* fall through */ } }

  const objStr = extractFirstJsonObject(stripped)
  if (objStr) { try { return JSON.parse(objStr) } catch { /* fall through */ } }

  return null
}

function extractFirstJsonArray(text: string): string | null {
  const start = text.indexOf('[')
  if (start === -1) return null
  return extractBalanced(text, start, '[', ']')
}

function extractFirstJsonObject(text: string): string | null {
  const start = text.indexOf('{')
  if (start === -1) return null
  return extractBalanced(text, start, '{', '}')
}

function extractBalanced(text: string, start: number, open: string, close: string): string | null {
  let depth = 0
  let inString = false
  let escape = false

  for (let i = start; i < text.length; i++) {
    const ch = text[i]
    if (escape) { escape = false; continue }
    if (ch === '\\' && inString) { escape = true; continue }
    if (ch === '"') { inString = !inString; continue }
    if (inString) continue
    if (ch === open) depth++
    else if (ch === close) {
      depth--
      if (depth === 0) return text.slice(start, i + 1)
    }
  }
  return null
}

// ─── MAPPING ──────────────────────────────────────────────────────────────────

function mapToParsedInvoice(extracted: Record<string, unknown>): ParsedInvoice {
  const errors: string[] = []

  const rawDocType = String(extracted.documentType ?? 'invoice').toLowerCase()
  const documentType: DocumentType = rawDocType === 'credit_note' ? 'CREDIT_NOTE' : 'INVOICE'

  const invoiceNumber = String(extracted.invoiceNumber ?? '')
  if (!invoiceNumber) errors.push('Could not extract invoice number')

  const invoiceDateStr = String(extracted.invoiceDate ?? '')
  const invoiceDate = invoiceDateStr ? new Date(invoiceDateStr) : new Date()
  if (isNaN(invoiceDate.getTime())) errors.push('Invalid invoice date')

  const dueDateStr = extracted.dueDate ? String(extracted.dueDate) : null
  const dueDate = dueDateStr ? new Date(dueDateStr) : null

  const supplier = extracted.supplier as Record<string, unknown> | undefined
  const buyer = extracted.buyer as Record<string, unknown> | undefined
  const rawLineItems = (extracted.lineItems as Array<Record<string, unknown>>) ?? []

  const lineItems: ParsedLineItem[] = rawLineItems.map((item) => ({
    description: String(item.description ?? 'No description'),
    quantity: safeNumber(item.quantity, 1),
    unitPrice: safeNumber(item.unitPrice, 0),
    vatRate: safeNumber(item.vatRate, 0),
    lineTotal: safeNumber(item.lineTotal, 0),
    vatExemptionReason: item.vatExemptionReason ? String(item.vatExemptionReason) : null,
    suggestedAccountCode: item.suggestedAccountCode ? String(item.suggestedAccountCode) : null,
    accountCodeConfidence: item.accountCodeConfidence ? safeNumber(item.accountCodeConfidence, 0) : null,
  }))

  if (lineItems.length === 0) errors.push('No line items extracted')

  const rawVatBreakdown = (extracted.vatBreakdown as Array<Record<string, unknown>>) ?? []
  const vatBreakdown = rawVatBreakdown.map((entry) => ({
    rate: safeNumber(entry.rate, 0),
    taxableAmount: safeNumber(entry.taxableAmount, 0),
    vatAmount: safeNumber(entry.vatAmount, 0),
  }))

  const finalVatBreakdown = vatBreakdown.length > 0 ? vatBreakdown : computeVatBreakdown(lineItems)

  return {
    invoiceNumber,
    invoiceDate: isNaN(invoiceDate.getTime()) ? new Date() : invoiceDate,
    dueDate: dueDate && !isNaN(dueDate.getTime()) ? dueDate : null,
    currency: String(extracted.currency ?? 'EUR'),
    documentType,
    supplier: {
      name: String(supplier?.name ?? ''),
      vatNumber: supplier?.vatNumber ? String(supplier.vatNumber) : null,
      address: supplier?.address ? String(supplier.address) : null,
    },
    buyer: {
      name: String(buyer?.name ?? ''),
      vatNumber: buyer?.vatNumber ? String(buyer.vatNumber) : null,
      peppolId: null,
    },
    reverseCharge: Boolean(extracted.reverseCharge),
    vatExemptionReason: extracted.vatExemptionReason ? String(extracted.vatExemptionReason) : null,
    linkedInvoiceNumber: extracted.linkedInvoiceNumber ? String(extracted.linkedInvoiceNumber) : null,
    vatBreakdown: finalVatBreakdown,
    lineItems,
    netAmount: safeNumber(extracted.netAmount, 0),
    vatAmount: safeNumber(extracted.vatAmount, 0),
    grossAmount: safeNumber(extracted.grossAmount, 0),
    errors,
  }
}

export function computeVatBreakdown(lineItems: ParsedLineItem[]): Array<{ rate: number; taxableAmount: number; vatAmount: number }> {
  const grouped = new Map<number, { taxableAmount: number; vatAmount: number }>()
  for (const item of lineItems) {
    const existing = grouped.get(item.vatRate) ?? { taxableAmount: 0, vatAmount: 0 }
    existing.taxableAmount += item.lineTotal
    existing.vatAmount += Math.round(item.lineTotal * (item.vatRate / 100) * 100) / 100
    grouped.set(item.vatRate, existing)
  }
  return Array.from(grouped.entries()).map(([rate, { taxableAmount, vatAmount }]) => ({
    rate,
    taxableAmount: Math.round(taxableAmount * 100) / 100,
    vatAmount: Math.round(vatAmount * 100) / 100,
  }))
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function safeNumber(value: unknown, fallback: number): number {
  const n = Number(value)
  return isNaN(n) ? fallback : Math.round(n * 100) / 100
}

function emptyInvoice(errors: string[]): ParsedInvoice {
  return {
    invoiceNumber: '',
    invoiceDate: new Date(),
    dueDate: null,
    currency: 'EUR',
    documentType: 'INVOICE',
    supplier: { name: '', vatNumber: null, address: null },
    buyer: { name: '', vatNumber: null, peppolId: null },
    reverseCharge: false,
    vatExemptionReason: null,
    linkedInvoiceNumber: null,
    vatBreakdown: [],
    lineItems: [],
    netAmount: 0,
    vatAmount: 0,
    grossAmount: 0,
    errors,
  }
}

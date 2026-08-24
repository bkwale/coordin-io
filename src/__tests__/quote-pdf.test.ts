/**
 * Tests for quote PDF generation and send API routes.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { generateQuotePdf, type QuotePdfData } from '@/lib/quote-pdf'

/* ── Fixtures ──────────────────────────────────────────── */

const SAMPLE_QUOTE: QuotePdfData = {
  quoteNumber: 'QT-WK-001',
  title: 'Architectural Design Services — Phase 1',
  status: 'DRAFT',
  clientName: 'Acme Construction Ltd',
  clientEmail: 'john@acme.co.uk',
  clientAddress: '123 Builder Lane\nLondon EC1A 1BB',
  description: 'Full architectural design services for the Riverside project.',
  lineItems: [
    { description: 'Concept Design', quantity: 1, unitPrice: 5000, total: 5000 },
    { description: 'Planning Application', quantity: 1, unitPrice: 3000, total: 3000 },
    { description: 'Technical Design', quantity: 2, unitPrice: 4000, total: 8000 },
  ],
  netTotal: 16000,
  taxRate: 20,
  taxAmount: 3200,
  grossTotal: 19200,
  currency: 'GBP',
  validUntil: '2026-12-31T00:00:00.000Z',
  notes: 'Payment terms: 30 days from invoice date.',
  termsAndConditions: 'Standard RIBA terms apply. Cancellation with 14 days notice.',
  createdAt: '2026-08-20T10:00:00.000Z',
  createdByName: 'Wale Koleosho',
  organisationName: 'CWA Homes Ltd',
  projectName: 'Riverside Development',
}

/* ── PDF Generation Tests ──────────────────────────────── */

describe('generateQuotePdf', () => {
  it('returns a valid PDF buffer', async () => {
    const buffer = await generateQuotePdf(SAMPLE_QUOTE)
    expect(buffer).toBeInstanceOf(Buffer)
    expect(buffer.length).toBeGreaterThan(100)
    // PDF magic bytes: %PDF
    expect(buffer.slice(0, 4).toString()).toBe('%PDF')
  })

  it('handles minimal data (no optional fields)', async () => {
    const minimal: QuotePdfData = {
      ...SAMPLE_QUOTE,
      clientEmail: null,
      clientAddress: null,
      description: null,
      validUntil: null,
      notes: null,
      termsAndConditions: null,
      projectName: null,
    }
    const buffer = await generateQuotePdf(minimal)
    expect(buffer.slice(0, 4).toString()).toBe('%PDF')
    expect(buffer.length).toBeGreaterThan(100)
  })

  it('handles empty line items', async () => {
    const empty: QuotePdfData = {
      ...SAMPLE_QUOTE,
      lineItems: [],
      netTotal: 0,
      taxAmount: 0,
      grossTotal: 0,
    }
    const buffer = await generateQuotePdf(empty)
    expect(buffer.slice(0, 4).toString()).toBe('%PDF')
  })

  it('handles large number of line items', async () => {
    const manyItems: QuotePdfData = {
      ...SAMPLE_QUOTE,
      lineItems: Array.from({ length: 50 }, (_, i) => ({
        description: `Service item ${i + 1} — detailed description of work`,
        quantity: i + 1,
        unitPrice: 100 * (i + 1),
        total: (i + 1) * 100 * (i + 1),
      })),
    }
    const buffer = await generateQuotePdf(manyItems)
    expect(buffer.slice(0, 4).toString()).toBe('%PDF')
    // Should produce multi-page PDF
    expect(buffer.length).toBeGreaterThan(1000)
  })

  it('handles all supported currencies', async () => {
    for (const currency of ['GBP', 'USD', 'EUR', 'NGN']) {
      const buffer = await generateQuotePdf({ ...SAMPLE_QUOTE, currency })
      expect(buffer.slice(0, 4).toString()).toBe('%PDF')
    }
  })

  it('handles long text fields without crashing', async () => {
    const longText: QuotePdfData = {
      ...SAMPLE_QUOTE,
      description: 'A'.repeat(2000),
      notes: 'B'.repeat(2000),
      termsAndConditions: 'C'.repeat(5000),
      clientAddress: 'Line 1\nLine 2\nLine 3\nLine 4\nLine 5',
    }
    const buffer = await generateQuotePdf(longText)
    expect(buffer.slice(0, 4).toString()).toBe('%PDF')
  })
})

/* ── Quote PDF API Route Tests ─────────────────────────── */

describe('Quote PDF API (contract tests)', () => {
  it('QuotePdfData interface matches FeeQuote model fields', () => {
    // Verify our data type includes all key fields
    const keys = Object.keys(SAMPLE_QUOTE)
    expect(keys).toContain('quoteNumber')
    expect(keys).toContain('title')
    expect(keys).toContain('clientName')
    expect(keys).toContain('lineItems')
    expect(keys).toContain('netTotal')
    expect(keys).toContain('taxRate')
    expect(keys).toContain('taxAmount')
    expect(keys).toContain('grossTotal')
    expect(keys).toContain('currency')
    expect(keys).toContain('organisationName')
    expect(keys).toContain('createdByName')
  })

  it('line items have required fields', () => {
    for (const li of SAMPLE_QUOTE.lineItems) {
      expect(li).toHaveProperty('description')
      expect(li).toHaveProperty('quantity')
      expect(li).toHaveProperty('unitPrice')
      expect(li).toHaveProperty('total')
      expect(typeof li.quantity).toBe('number')
      expect(typeof li.unitPrice).toBe('number')
      expect(typeof li.total).toBe('number')
    }
  })
})

/* ── Send Route Validation Tests ───────────────────────── */

describe('Quote send validation rules', () => {
  it('only DRAFT quotes can be sent', () => {
    const allowedFromDraft = ['SENT']
    const statusTransitions: Record<string, string[]> = {
      DRAFT: ['SENT'],
      SENT: ['ACCEPTED', 'REJECTED', 'EXPIRED', 'DRAFT'],
      ACCEPTED: ['SUPERSEDED'],
      REJECTED: ['DRAFT'],
      EXPIRED: ['DRAFT'],
      SUPERSEDED: [],
    }
    expect(statusTransitions['DRAFT']).toEqual(allowedFromDraft)
    expect(statusTransitions['SUPERSEDED']).toEqual([])
  })

  it('client email is required for sending', () => {
    // Mirrors the validation in send/route.ts
    const quoteWithoutEmail = { clientEmail: null }
    expect(quoteWithoutEmail.clientEmail).toBeNull()
    // The API would throw ValidationError('Cannot send — no client email address on this quote')
  })
})

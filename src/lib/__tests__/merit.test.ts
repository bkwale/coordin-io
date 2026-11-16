import { describe, it, expect } from 'vitest'
import { meritSignature, meritTimestamp, meritUrl, pickTax, buildInvoicePayload, MeritApiError, type MeritTax } from '@/lib/integrations/merit/client'

describe('Merit request signing', () => {
  it('timestamp is UTC yyyyMMddHHmmss', () => {
    expect(meritTimestamp(new Date(Date.UTC(2024, 5, 24, 20, 59, 2)))).toBe('20240624205902')
  })
  it('signature is base64 HMAC-SHA256 of apiId + timestamp + body, keyed by the API key', () => {
    // RFC 4231 test case 2 shape: key "Jefe", data "what do ya want for nothing?"
    expect(meritSignature('what do ya want ', 'Jefe', 'for nothing?', '')).toBe('W9zBRr9gdU5qBCQmCJV1x1oAPwidJzmDnexYuWTsOEM=')
  })
  it('the body is part of the signature', () => {
    expect(meritSignature('id', 'key', '20240624205902', '{"a":1}')).not.toBe(meritSignature('id', 'key', '20240624205902', '{"a":2}'))
  })
  it('url-encodes the signature and never includes the key', () => {
    const url = meritUrl('v1/gettaxes', { apiId: 'my-id', apiKey: 'super-secret-key' }, '', new Date(Date.UTC(2026, 10, 16, 9, 0, 0)))
    expect(url).toContain('https://aktiva.merit.ee/api/v1/gettaxes?ApiId=my-id&timestamp=20261116090000&signature=')
    expect(url).not.toContain('super-secret-key')
    expect(url.split('signature=')[1]).not.toMatch(/[+/=]/)
  })
})

const taxes: MeritTax[] = [
  { Id: 't24x', Code: '24EU', Name: '24% ühendusesisene käive', TaxPct: 24 },
  { Id: 't24', Code: '24', Name: '24% käibemaks', TaxPct: 24 },
  { Id: 't0', Code: '0', Name: '0%', TaxPct: 0 },
]

describe('Merit VAT matching', () => {
  it('finds the rate and prefers the plain one', () => expect(pickTax(taxes, 24)?.Id).toBe('t24'))
  it('returns null when the rate is not set up', () => expect(pickTax(taxes, 22)).toBeNull())
})

describe('Merit invoice payload', () => {
  const inv = {
    invoiceNumber: 'INV-2026-014', invoiceDate: new Date(Date.UTC(2026, 10, 16)), dueDate: new Date(Date.UTC(2026, 10, 30)), currency: 'EUR',
    clientName: 'Kodu Arendus OÜ', clientEmail: 'arved@kodu.example', clientAddress: 'Telliskivi 60, Tallinn', clientCountry: 'EE', clientVatNumber: 'EE100000001', notes: null,
    lineItems: [
      { description: 'Eelprojekt', quantity: 1, unitPrice: 4200, vatRate: 24 },
      { description: 'Lisatöö, 3 h', quantity: 3, unitPrice: 85.5, vatRate: 24 },
      { description: 'Riigilõiv', quantity: 1, unitPrice: 150, vatRate: 0 },
    ],
  }
  const byRate = (pct: number) => pickTax(taxes, pct)?.Id ?? null

  it('maps header, rows and VAT grouped by tax', () => {
    const p = buildInvoicePayload(inv, { byRate }, 'TEENUS') as Record<string, any>
    expect(p.InvoiceNo).toBe('INV-2026-014')
    expect(p.DocDate).toBe('20261116')
    expect(p.DueDate).toBe('20261130')
    expect(p.CurrencyCode).toBe('EUR')
    expect(p.Customer).toMatchObject({ Name: 'Kodu Arendus OÜ', CountryCode: 'EE', NotTDCustomer: false, VatRegNo: 'EE100000001' })
    expect(p.InvoiceRow).toHaveLength(3)
    expect(p.InvoiceRow[0]).toMatchObject({ Quantity: 1, Price: 4200, TaxId: 't24', Item: { Code: 'TEENUS', Type: 2 } })
    expect(p.TotalAmount).toBe(4606.5)
    expect(p.TaxAmount).toEqual([{ TaxId: 't24', Amount: 1069.56 }, { TaxId: 't0', Amount: 0 }])
  })
  it('foreign clients are flagged as such', () => {
    const p = buildInvoicePayload({ ...inv, clientCountry: 'fi' }, { byRate }, 'TEENUS') as Record<string, any>
    expect(p.Customer).toMatchObject({ CountryCode: 'FI', NotTDCustomer: true })
  })
  it('refuses a VAT rate Merit does not have, naming the invoice', () => {
    const bad = { ...inv, lineItems: [{ description: 'x', quantity: 1, unitPrice: 1, vatRate: 22 }] }
    expect(() => buildInvoicePayload(bad, { byRate }, 'TEENUS')).toThrow(MeritApiError)
    expect(() => buildInvoicePayload(bad, { byRate }, 'TEENUS')).toThrow(/22%.*INV-2026-014/)
  })
  it('cuts long text to Merit limits', () => {
    const p = buildInvoicePayload({ ...inv, clientName: 'A'.repeat(300), lineItems: [{ description: 'B'.repeat(400), quantity: 1, unitPrice: 1, vatRate: 0 }] }, { byRate }, 'X'.repeat(40)) as Record<string, any>
    expect(p.Customer.Name).toHaveLength(150)
    expect(p.InvoiceRow[0].Item.Description).toHaveLength(150)
    expect(p.InvoiceRow[0].Item.Code).toHaveLength(20)
  })
})

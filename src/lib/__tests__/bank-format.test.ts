import { describe, it, expect } from 'vitest'
import { normaliseIban, normaliseSortCode, validateBank, bankFormatFor } from '../bank-format'

describe('bank formats', () => {
  it('checks IBANs with mod-97', () => {
    expect(normaliseIban('EE38 2200 2210 2014 5685')).toBe('EE382200221020145685')
    expect(normaliseIban('EE38 2200 2210 2014 5686')).toBeNull()
    expect(normaliseIban('GB29 NWBK 6016 1331 9268 19')).toBe('GB29NWBK60161331926819')
    expect(normaliseIban('EE3822002210')).toBeNull()
  })
  it('formats UK sort codes', () => {
    expect(normaliseSortCode('20-00-00')).toBe('200000')
    expect(normaliseSortCode('20 00 0')).toBeNull()
  })
  it('validates per country', () => {
    expect(validateBank('iban', { accountNumber: 'EE382200221020145685', bankCode: 'HABAEE2X' })).toMatchObject({ ok: true, bankCode: 'HABAEE2X' })
    expect(validateBank('iban', { accountNumber: '1234567890' }).ok).toBe(false)
    expect(validateBank('uk_sort_code', { accountNumber: '31926819', sortCode: '60-16-13' })).toMatchObject({ ok: true, sortCode: '601613' })
    expect(validateBank('uk_sort_code', { accountNumber: '3192681', sortCode: '601613' }).ok).toBe(false)
    expect(validateBank('nuban', { accountNumber: '0123456789', bankCode: '058' }).ok).toBe(true)
  })
  it('picks the format from the office, then the firm', () => {
    expect(bankFormatFor('United Kingdom', 'NG')).toBe('uk_sort_code')
    expect(bankFormatFor(null, 'NG')).toBe('nuban')
    expect(bankFormatFor('EE', null)).toBe('iban')
    expect(bankFormatFor(null, null)).toBe('iban')
  })
})

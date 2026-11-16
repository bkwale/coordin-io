import { describe, it, expect } from 'vitest'
import { parseDocumentDate } from '../summary-dates'

describe('deadline as written → date, only when unambiguous', () => {
  it('reads the common exact forms', () => {
    expect(parseDocumentDate('15.12.2026')).toBe('2026-12-15')
    expect(parseDocumentDate('5/1/2027')).toBe('2027-01-05')
    expect(parseDocumentDate('2026-11-30')).toBe('2026-11-30')
    expect(parseDocumentDate('4 Dec 2026')).toBe('2026-12-04')
    expect(parseDocumentDate('30 November 2026')).toBe('2026-11-30')
    expect(parseDocumentDate('4. detsember 2026')).toBe('2026-12-04')
    expect(parseDocumentDate('9. jaanuar 2027 a.')).toBe('2027-01-09')
  })
  it('returns nothing for wording that is not a date', () => {
    for (const s of ['within 14 days', 'enne ehitusloa taotlemist', 'prior to commencement', '2027. aasta veebruaris', 'Q1 2027', '', null, '15.12', '15.12.26']) expect(parseDocumentDate(s)).toBeNull()
  })
  it('refuses dates that do not exist', () => {
    expect(parseDocumentDate('31.02.2027')).toBeNull()
    expect(parseDocumentDate('15.13.2026')).toBeNull()
  })
})

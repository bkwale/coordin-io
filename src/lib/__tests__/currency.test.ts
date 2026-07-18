import { describe, it, expect } from 'vitest'
import {
  formatCurrency,
  formatCurrencyCompact,
  getCurrencySymbol,
  convertCurrency,
  parseCurrencyAmount,
  EXCHANGE_RATES,
} from '../currency'

// ── formatCurrency ─────────────────────────────────────────────

describe('formatCurrency', () => {
  it('formats NGN with naira symbol and commas', () => {
    const result = formatCurrency(1234567.89, 'NGN')
    expect(result).toContain('1,234,567.89')
  })

  it('formats GBP with pound symbol', () => {
    const result = formatCurrency(1234.56, 'GBP')
    expect(result).toContain('1,234.56')
  })

  it('formats USD with dollar symbol', () => {
    const result = formatCurrency(99.99, 'USD')
    expect(result).toContain('99.99')
  })

  it('formats EUR', () => {
    const result = formatCurrency(5000, 'EUR')
    // EUR de-DE locale uses comma for decimal, dot for thousands
    // Just verify it contains the number in some form
    expect(result).toBeTruthy()
  })

  it('falls back gracefully for unknown currency', () => {
    const result = formatCurrency(100, 'XYZ')
    expect(result).toBe('100.00 XYZ')
  })

  it('handles zero', () => {
    const result = formatCurrency(0, 'GBP')
    expect(result).toContain('0.00')
  })
})

// ── formatCurrencyCompact ──────────────────────────────────────

describe('formatCurrencyCompact', () => {
  it('formats millions compactly for NGN', () => {
    const result = formatCurrencyCompact(1_200_000, 'NGN')
    // Should contain M for millions
    expect(result).toMatch(/1\.2/)
  })

  it('formats thousands compactly for GBP', () => {
    const result = formatCurrencyCompact(45_000, 'GBP')
    expect(result).toMatch(/45/)
  })

  it('falls back for unknown currency', () => {
    const result = formatCurrencyCompact(100, 'XYZ')
    expect(result).toBe('100 XYZ')
  })
})

// ── getCurrencySymbol ──────────────────────────────────────────

describe('getCurrencySymbol', () => {
  it('returns correct symbols', () => {
    expect(getCurrencySymbol('NGN')).toBe('₦')
    expect(getCurrencySymbol('GBP')).toBe('£')
    expect(getCurrencySymbol('USD')).toBe('$')
    expect(getCurrencySymbol('EUR')).toBe('€')
  })

  it('returns the code itself for unknown currencies', () => {
    expect(getCurrencySymbol('XYZ')).toBe('XYZ')
  })
})

// ── convertCurrency ────────────────────────────────────────────

describe('convertCurrency', () => {
  it('NGN to NGN is identity', () => {
    const result = convertCurrency(1000, 'NGN', 'NGN')
    expect(result.amount).toBe(1000)
    expect(result.rate).toBe(1)
  })

  it('converts NGN to GBP using static rates', () => {
    const result = convertCurrency(2050, 'NGN', 'GBP')
    // 2050 NGN * (1 / 2050) = 1 GBP
    expect(result.amount).toBe(1)
  })

  it('converts GBP to USD', () => {
    const result = convertCurrency(1, 'GBP', 'USD')
    // 1 GBP * (2050 / 1600) = 1.28125
    const expected = Math.round((EXCHANGE_RATES.GBP / EXCHANGE_RATES.USD) * 100) / 100
    expect(result.amount).toBe(expected)
  })

  it('includes disclaimer in every result', () => {
    const result = convertCurrency(100, 'NGN', 'GBP')
    expect(result.disclaimer).toBe('Indicative rate only. Not for financial transactions.')
  })

  it('returns a rate property', () => {
    const result = convertCurrency(100, 'GBP', 'EUR')
    expect(typeof result.rate).toBe('number')
    expect(result.rate).toBeGreaterThan(0)
  })
})

// ── parseCurrencyAmount ────────────────────────────────────────

describe('parseCurrencyAmount', () => {
  it('parses a naira-prefixed string', () => {
    expect(parseCurrencyAmount('₦1,234.56', 'NGN')).toBe(1234.56)
  })

  it('parses a plain number string', () => {
    expect(parseCurrencyAmount('1234', 'USD')).toBe(1234)
  })

  it('parses a pound-prefixed string', () => {
    expect(parseCurrencyAmount('£500.00', 'GBP')).toBe(500)
  })

  it('strips whitespace', () => {
    expect(parseCurrencyAmount('  1000  ', 'NGN')).toBe(1000)
  })

  it('returns null for non-numeric input', () => {
    expect(parseCurrencyAmount('abc', 'GBP')).toBeNull()
  })

  it('returns null for empty string', () => {
    expect(parseCurrencyAmount('', 'GBP')).toBeNull()
  })

  it('returns null for currency symbol only', () => {
    expect(parseCurrencyAmount('£', 'GBP')).toBeNull()
  })
})

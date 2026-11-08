/**
 * Bank details by country. Estonia (and the rest of SEPA): IBAN + optional BIC. UK: sort code + 8-digit account.
 * Nigeria: 10-digit NUBAN, checked with Paystack. Client-safe.
 */
import { countryCode, COUNTRIES, type BankFormat, type CountryCode } from '@/lib/region'

export type { BankFormat }

export function bankFormatFor(officeCountry: string | null | undefined, firmCountry: CountryCode | null | undefined): BankFormat {
  const c = countryCode(officeCountry) ?? firmCountry ?? null
  return c ? COUNTRIES[c].bankFormat : 'iban'
}

/** IBAN check digits (ISO 13616 mod-97). Spaces allowed; returns the compact upper-case IBAN or null. */
export function normaliseIban(v: string): string | null {
  const iban = v.replace(/\s+/g, '').toUpperCase()
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(iban)) return null
  if (iban.startsWith('EE') && iban.length !== 20) return null
  if (iban.startsWith('GB') && iban.length !== 22) return null
  const rearranged = iban.slice(4) + iban.slice(0, 4)
  let rem = 0
  for (const ch of rearranged) {
    const d = /[A-Z]/.test(ch) ? String(ch.charCodeAt(0) - 55) : ch
    for (const x of d) rem = (rem * 10 + Number(x)) % 97
  }
  return rem === 1 ? iban : null
}

export function normaliseBic(v: string): string | null {
  const b = v.replace(/\s+/g, '').toUpperCase()
  return /^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(b) ? b : null
}

export function normaliseSortCode(v: string): string | null {
  const d = v.replace(/[\s-]/g, '')
  return /^\d{6}$/.test(d) ? d : null // stored as 6 digits, like existing records
}

export interface BankInput { accountNumber?: string | null; sortCode?: string | null; bankCode?: string | null }

/** Validates for the format; returns the cleaned values or an error message people can act on. */
export function validateBank(format: BankFormat, input: BankInput): { ok: true; accountNumber: string; sortCode: string | null; bankCode: string | null } | { ok: false; error: string } {
  const acc = (input.accountNumber ?? '').trim()
  if (format === 'iban') {
    const iban = normaliseIban(acc)
    if (!iban) return { ok: false, error: 'Enter a valid IBAN (Estonian IBANs start with EE and have 20 characters)' }
    const bic = input.bankCode ? normaliseBic(input.bankCode) : null
    if (input.bankCode && !bic) return { ok: false, error: 'BIC/SWIFT should look like HABAEE2X' }
    return { ok: true, accountNumber: iban, sortCode: null, bankCode: bic }
  }
  if (format === 'uk_sort_code') {
    const sc = normaliseSortCode(input.sortCode ?? '')
    if (!sc) return { ok: false, error: 'Sort code must be 6 digits, e.g. 20-00-00' }
    const digits = acc.replace(/\s/g, '')
    if (!/^\d{8}$/.test(digits)) return { ok: false, error: 'UK account numbers are 8 digits' }
    return { ok: true, accountNumber: digits, sortCode: sc, bankCode: null }
  }
  const nuban = acc.replace(/\s/g, '')
  if (!/^\d{10}$/.test(nuban)) return { ok: false, error: 'Account number must be exactly 10 digits (NUBAN)' }
  return { ok: true, accountNumber: nuban, sortCode: null, bankCode: (input.bankCode ?? '').trim() || null }
}

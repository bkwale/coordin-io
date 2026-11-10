/** Paystack "resolve account number" — the only source of truth for a verified Nigerian account name. Server-only. */
import { getBankByCode } from '@/lib/nigerian-banks'

export type ResolveResult = { verified: true; accountName: string; accountNumber: string; bankName: string; bankCode: string } | { verified: false; error: string }

export async function resolveNigerianAccount(accountNumber: string, bankCode: string): Promise<ResolveResult> {
  if (!/^\d{10}$/.test(accountNumber)) return { verified: false, error: 'Account number must be exactly 10 digits' }
  const bank = getBankByCode(bankCode)
  if (!bank) return { verified: false, error: 'Invalid bank code' }
  const key = process.env.PAYSTACK_SECRET_KEY
  if (!key) return { verified: false, error: 'Bank verification is not configured. Please contact your administrator.' }
  const url = `https://api.paystack.co/bank/resolve?account_number=${encodeURIComponent(accountNumber)}&bank_code=${encodeURIComponent(bankCode)}`
  try {
    const response = await fetch(url, { headers: { Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(10_000) })
    const result = await response.json().catch(() => ({}))
    if (!response.ok || !result.status) return { verified: false, error: result.message || 'Could not verify account number. Please check and try again.' }
    return { verified: true, accountName: result.data.account_name, accountNumber: result.data.account_number, bankName: bank.name, bankCode: bank.code }
  } catch {
    return { verified: false, error: 'Bank verification is unavailable right now. Try again shortly.' }
  }
}

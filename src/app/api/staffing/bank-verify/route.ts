import { NextRequest } from 'next/server'
import { success } from '@/lib/api-response'
import { withAuth } from '@/lib/with-auth'
import { requireString, parseBody } from '@/lib/validation'
import { ValidationError } from '@/lib/errors'
import { getBankByCode } from '@/lib/nigerian-banks'

/**
 * POST /api/staffing/bank-verify
 *
 * Verifies a Nigerian bank account number using Paystack's
 * "Resolve Account Number" API. Returns the account name.
 *
 * Body: { accountNumber: string, bankCode: string }
 * Response: { verified: true, accountName: string, bankName: string }
 *
 * Requires PAYSTACK_SECRET_KEY env var.
 */
export const POST = withAuth(async (request: NextRequest) => {
  const body = await parseBody(request)

  const accountNumber = requireString(body.accountNumber as unknown, 'accountNumber', 10)
  const bankCode = requireString(body.bankCode as unknown, 'bankCode', 10)

  // Validate account number is 10 digits (NUBAN standard)
  if (!/^\d{10}$/.test(accountNumber)) {
    throw new ValidationError('Account number must be exactly 10 digits')
  }

  // Validate bank code exists
  const bank = getBankByCode(bankCode)
  if (!bank) {
    throw new ValidationError('Invalid bank code')
  }

  const paystackKey = process.env.PAYSTACK_SECRET_KEY
  if (!paystackKey) {
    throw new ValidationError(
      'Bank verification is not configured. Please contact your administrator.'
    )
  }

  // Call Paystack Resolve Account Number API
  const url = `https://api.paystack.co/bank/resolve?account_number=${accountNumber}&bank_code=${bankCode}`

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${paystackKey}`,
      'Content-Type': 'application/json',
    },
  })

  const result = await response.json()

  if (!response.ok || !result.status) {
    return success({
      verified: false,
      error: result.message || 'Could not verify account number. Please check and try again.',
    })
  }

  return success({
    verified: true,
    accountName: result.data.account_name,
    accountNumber: result.data.account_number,
    bankName: bank.name,
    bankCode: bank.code,
  })
})

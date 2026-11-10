import { NextRequest } from 'next/server'
import { success } from '@/lib/api-response'
import { withAuth } from '@/lib/with-auth'
import { requireString, parseBody } from '@/lib/validation'
import { ValidationError } from '@/lib/errors'
import { checkRateLimit } from '@/lib/rate-limit'
import { resolveNigerianAccount } from '@/lib/paystack'

/**
 * POST /api/staffing/bank-verify — check a Nigerian account number with Paystack and return the holder's name.
 * Body: { accountNumber, bankCode }. Limited to 5 checks a minute per user so it can't be used to look people up.
 */
export const POST = withAuth(async (request: NextRequest, { authUserId }) => {
  const limited = await checkRateLimit(`bank-verify:${authUserId}`, { maxRequests: 5, windowMs: 60_000 })
  if (limited) return limited
  const body = await parseBody(request)
  const accountNumber = requireString(body.accountNumber as unknown, 'accountNumber', 10)
  const bankCode = requireString(body.bankCode as unknown, 'bankCode', 10)
  const r = await resolveNigerianAccount(accountNumber, bankCode)
  if (!r.verified && /10 digits|Invalid bank code|not configured/.test(r.error)) throw new ValidationError(r.error)
  return success(r)
})

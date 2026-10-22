import { NextRequest } from 'next/server'
import { success } from '@/lib/api-response'
import { withAuth } from '@/lib/with-auth'
import { NIGERIAN_BANKS } from '@/lib/nigerian-banks'

/**
 * GET /api/staffing/banks
 *
 * Returns the list of Nigerian banks for the dropdown.
 * Any authenticated user can fetch this.
 */
export const GET = withAuth(async (_request: NextRequest) => {
  return success({
    banks: NIGERIAN_BANKS.map((b) => ({
      name: b.name,
      code: b.code,
    })),
  })
})

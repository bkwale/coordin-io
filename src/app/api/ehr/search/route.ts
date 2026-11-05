import { withAuth } from '@/lib/with-auth'
import { success, error } from '@/lib/api-response'
import { ValidationError } from '@/lib/errors'
import { checkRateLimit } from '@/lib/rate-limit'
import { searchBuildings, fetchBuilding, EhrError, EHR_CODE } from '@/lib/ehr/client'

export const dynamic = 'force-dynamic'

/**
 * GET /api/ehr/search?q=  — server-side proxy to the public Ehitisregister.
 * q = 9-digit EHR code (exact lookup) or a building name (the only public search key).
 * 10/min per user; results cached globally (search 1 h, records 24 h).
 */
export const GET = withAuth(async (request, { profile }) => {
  const limited = await checkRateLimit(`ehr:${profile.id}`, { maxRequests: 10, windowMs: 60_000 })
  if (limited) return limited
  const q = (new URL(request.url).searchParams.get('q') ?? '').trim()
  if (q.length < 3) return error(new ValidationError('Type at least 3 characters, or a 9-digit EHR code'))
  try {
    if (EHR_CODE.test(q)) {
      const b = await fetchBuilding(q)
      return success({ results: [{ ehrCode: b.ehrCode, name: b.name, address: b.address, useLabel: b.useLabel, storeys: b.storeysAbove, heritage: b.heritage ?? [] }] })
    }
    return success({ results: await searchBuildings(q) })
  } catch (e) {
    if (e instanceof EhrError && e.reason === 'not_found') return success({ results: [] })
    if (e instanceof EhrError) return error(new ValidationError(e.message))
    return error(e)
  }
})

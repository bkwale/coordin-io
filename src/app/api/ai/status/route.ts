import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/with-auth'
import { aiAvailability } from '@/lib/ai/availability'

export const dynamic = 'force-dynamic'

/** GET /api/ai/status — is AI reading available right now? Lets the UI offer the manual path before an upload. */
export const GET = withAuth(async () => {
  return NextResponse.json({ data: await aiAvailability() }, { headers: { 'cache-control': 'no-store' } })
})

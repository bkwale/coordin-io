import { NextResponse } from 'next/server'
import { isFeatureEnabled } from '@/lib/feature-flags'
import { withAuth } from '@/lib/with-auth'
import { aiAvailability } from '@/lib/ai/availability'

export const dynamic = 'force-dynamic'

/** GET /api/ai/status — is AI reading available right now? Lets the UI offer the manual path before an upload. */
export const GET = withAuth(async (_req, { profile }) => {
  const fallbackAllowed = await isFeatureEnabled(profile.organisationId, 'ai_fallback').catch(() => false)
  return NextResponse.json({ data: await aiAvailability({ fallbackAllowed }) }, { headers: { 'cache-control': 'no-store' } })
})

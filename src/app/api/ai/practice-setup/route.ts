import { NextRequest, NextResponse, after } from 'next/server'
import { withSuperAdmin } from '@/lib/with-super-admin'
import { checkRateLimit } from '@/lib/rate-limit'
import { startPracticeSetup, executePracticeSetup } from '@/lib/ai/practice-setup'
import { normaliseUrl } from '@/lib/ai/crawl'

export const maxDuration = 300
export const dynamic = 'force-dynamic'

/**
 * POST /api/ai/practice-setup  { url }
 * Platform-admin demo surface for Sprint 1. Creates an AIRun, kicks off
 * crawl → extract → map in the background (after()), returns the run id to poll.
 */
export const POST = withSuperAdmin(async (request: NextRequest, { authUserId }) => {
  const limited = checkRateLimit(`ai:${authUserId}`, { maxRequests: 10, windowMs: 60_000 })
  if (limited) return limited

  const body = await request.json().catch(() => ({}))
  const raw = typeof body.url === 'string' ? body.url.trim() : ''
  if (!raw) return NextResponse.json({ error: 'url is required', code: 'VALIDATION' }, { status: 400 })

  let url: string
  try { url = normaliseUrl(raw).toString() } catch { return NextResponse.json({ error: 'Not a valid URL', code: 'VALIDATION' }, { status: 400 }) }

  const run = await startPracticeSetup({ url, createdBy: authUserId })

  after(async () => {
    try { await executePracticeSetup(run.id, url) } catch { /* recorded on the run */ }
  })

  return NextResponse.json({ data: { id: run.id, status: run.status, url } }, { status: 202 })
})

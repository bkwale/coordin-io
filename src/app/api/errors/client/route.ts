import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit } from '@/lib/rate-limit'
import { captureError } from '@/lib/error-reporting'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getProfileByAuthId } from '@/lib/permissions'
import { clientIp } from '@/lib/demo-guard'

export const dynamic = 'force-dynamic'

const MAX_BODY = 8_000

/**
 * POST /api/errors/client  { message, stack?, digest?, path? }
 * Browser crashes caught by the error boundaries. Anonymous allowed (a crash can happen before sign-in),
 * rate-limited per IP, size-capped, and never echoes anything back except the reference.
 */
export async function POST(request: NextRequest) {
  const limited = await checkRateLimit(`client-errors:${clientIp(request)}`, { maxRequests: 20, windowMs: 60_000 })
  if (limited) return limited

  const raw = await request.text().catch(() => '')
  if (!raw || raw.length > MAX_BODY) return NextResponse.json({ error: 'Invalid report', code: 'VALIDATION' }, { status: 400 })
  let body: { message?: unknown; stack?: unknown; digest?: unknown; path?: unknown }
  try { body = JSON.parse(raw) } catch { return NextResponse.json({ error: 'Invalid report', code: 'VALIDATION' }, { status: 400 }) }

  const str = (v: unknown, n: number) => (typeof v === 'string' ? v.slice(0, n) : null)
  const message = str(body.message, 500) || 'Unknown client error'
  const err = new Error(message)
  err.name = 'ClientError'
  err.stack = str(body.stack, 4000) ?? undefined
  // Path only — never the query string (it can carry tokens)
  const path = (str(body.path, 300) ?? '').split('?')[0].replace(/\/(welcome|activate|invite)\/[^/]+/g, '/$1/:token')

  // Attach who, when signed in (best effort — never fail the report on auth)
  let who: { profileId?: string; organisationId?: string } = {}
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) { const p = await getProfileByAuthId(user.id); if (p) who = { profileId: p.id, organisationId: p.organisationId } }
  } catch { /* anonymous */ }

  const ref = captureError(err, { source: 'client', route: path || null, ...who, extra: { digest: str(body.digest, 64), userAgent: request.headers.get('user-agent')?.slice(0, 200) ?? null } })
  return NextResponse.json({ data: { ref } }, { status: 202 })
}

import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit } from '@/lib/rate-limit'
import { signDemoStart } from '@/lib/demo-cookie'
import { DEMO_COOKIE } from '@/lib/demo-timer'

export const dynamic = 'force-dynamic'

const cookieOpts = { path: '/', httpOnly: true, sameSite: 'lax' as const, secure: process.env.NODE_ENV === 'production' }

/** POST — start a 10-minute read-only demo. Issues the signed HttpOnly cookie. 20 starts/hour per IP. */
export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  const limited = await checkRateLimit(`demo-start:${ip}`, { maxRequests: 20, windowMs: 60 * 60_000 })
  if (limited) return limited
  const start = Date.now()
  const res = NextResponse.json({ data: { start } })
  res.cookies.set(DEMO_COOKIE, await signDemoStart(start), { ...cookieOpts, maxAge: 660 })
  return res
}

/** DELETE — end the demo (the browser can't clear an HttpOnly cookie itself). */
export async function DELETE() {
  const res = NextResponse.json({ data: { ended: true } })
  res.cookies.set(DEMO_COOKIE, '', { ...cookieOpts, maxAge: 0 })
  return res
}

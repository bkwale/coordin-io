/**
 * Binds an OAuth "state" to the browser that started the flow. The start route sets an HttpOnly cookie
 * holding a hash of the state; the callback only proceeds when the cookie matches. Stops a connect link
 * started by one person being completed in someone else's browser.
 */
import { createHash, timingSafeEqual } from 'node:crypto'
import type { NextRequest, NextResponse } from 'next/server'

const MAX_AGE = 600 // seconds, same window as the pending connection row

function cookieName(provider: 'xero' | 'microsoft') {
  return `coordin_oauth_${provider}`
}

function hash(state: string) {
  return createHash('sha256').update(state).digest('hex')
}

export function bindOAuthState(res: NextResponse, provider: 'xero' | 'microsoft', state: string): NextResponse {
  res.cookies.set(cookieName(provider), hash(state), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/api/integrations',
    maxAge: MAX_AGE,
  })
  return res
}

export function oauthStateMatches(req: NextRequest, provider: 'xero' | 'microsoft', state: string): boolean {
  const got = req.cookies.get(cookieName(provider))?.value ?? ''
  const want = hash(state)
  if (got.length !== want.length) return false
  return timingSafeEqual(Buffer.from(got), Buffer.from(want))
}

export function clearOAuthState(res: NextResponse, provider: 'xero' | 'microsoft'): NextResponse {
  res.cookies.set(cookieName(provider), '', { path: '/api/integrations', maxAge: 0 })
  return res
}

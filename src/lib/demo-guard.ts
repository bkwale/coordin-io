/**
 * The anonymous public demo (/demo-access, no login) is READ-ONLY.
 * Anyone on the internet can start it, so it must never write data, send email, upload files or
 * spend AI budget. People who should try things for real (e.g. a pilot studio) get their own
 * sandbox organisation and a real login instead — see scripts/seed-test-studio.sql.
 */
import { NextResponse, type NextRequest } from 'next/server'
import { checkRateLimit } from '@/lib/rate-limit'

const SAFE = new Set(['GET', 'HEAD', 'OPTIONS'])

export function isDemoWrite(request: Pick<NextRequest, 'method'>): boolean {
  return !SAFE.has((request.method ?? 'GET').toUpperCase())
}

export function demoWriteRefused(request: Pick<NextRequest, 'method' | 'url'>): NextResponse {
  let path = ''
  try { path = new URL(request.url).pathname } catch { /* ignore */ }
  console.warn('[DemoGuard] refused demo write', { method: request.method, path })
  return NextResponse.json(
    { error: 'The demo is read-only. Book a walkthrough and we’ll set up a studio where you can try everything.', code: 'DEMO_READ_ONLY' },
    { status: 403 },
  )
}

/**
 * Demo visitors skip the per-user limit in withAuth (that check runs after the demo branch), so a script
 * could hammer demo reads against the shared database. Cap demo traffic per IP (Treynor Sloss, PT 5 Nov).
 */
export const DEMO_READS_PER_MINUTE = 120
export function clientIp(request: Pick<NextRequest, 'headers'>): string {
  return request.headers.get('x-real-ip')?.trim() || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
}
export async function demoReadLimit(request: Pick<NextRequest, 'headers'>) {
  return checkRateLimit(`demo-read:${clientIp(request)}`, { maxRequests: DEMO_READS_PER_MINUTE, windowMs: 60_000 })
}

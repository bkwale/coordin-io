/**
 * The anonymous public demo (/demo-access, no login) is READ-ONLY.
 * Anyone on the internet can start it, so it must never write data, send email, upload files or
 * spend AI budget. People who should try things for real (e.g. a pilot studio) get their own
 * sandbox organisation and a real login instead — see scripts/seed-test-studio.sql.
 */
import { NextResponse, type NextRequest } from 'next/server'

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

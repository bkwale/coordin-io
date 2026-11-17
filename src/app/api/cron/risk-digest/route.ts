import { captureErrorAndWait } from '@/lib/error-reporting'
import { safeEqual } from '@/lib/safe-compare'
import { NextRequest, NextResponse } from 'next/server'
import { runWeeklyRiskDigest } from '@/lib/risk/digest'

export const maxDuration = 300

/**
 * Mondays 06:00 UTC: the weekly risk digest to project leads, for firms that have risk analysis on and have switched
 * the digest on in Settings. Protected by CRON_SECRET (Vercel Cron sends it as a Bearer token).
 */
export async function POST(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    console.error('[cron/risk-digest] CRON_SECRET env var not configured')
    return NextResponse.json({ error: 'Not configured' }, { status: 500 })
  }
  if (!safeEqual(request.headers.get('authorization'), `Bearer ${cronSecret}`)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const result = await runWeeklyRiskDigest()
    console.log(`[CRON] Risk digest: ${result.organisations} firms, ${result.projects} projects, ${result.sent} sent, ${result.errors} errors`)
    return NextResponse.json({ ok: true, ...result, timestamp: new Date().toISOString() })
  } catch (err) {
    const ref = await captureErrorAndWait(err, { source: 'cron', route: '/api/cron/risk-digest' })
    return NextResponse.json({ ok: false, error: 'Risk digest run failed', ref }, { status: 500 })
  }
}

// Vercel Cron uses GET
export async function GET(request: NextRequest) {
  return POST(request)
}

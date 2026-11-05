import { captureErrorAndWait } from '@/lib/error-reporting'
import { NextRequest, NextResponse } from 'next/server'
import { runOnboardingReminders } from '@/lib/onboarding/window-service'

/**
 * Daily: onboarding reminders on days 3, 5 and 7 of the seven-day window, and a one-off HR alert
 * when a window is missed. Protected by CRON_SECRET (Vercel Cron sends it as a Bearer token).
 */
export async function POST(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    console.error('[cron/onboarding-reminders] CRON_SECRET env var not configured')
    return NextResponse.json({ error: 'Not configured' }, { status: 500 })
  }
  if (request.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const result = await runOnboardingReminders()
    console.log(`[CRON] Onboarding reminders: ${result.checked} checked, ${result.reminded} reminded, ${result.missed} missed, ${result.errors} errors`)
    return NextResponse.json({ ok: true, ...result, timestamp: new Date().toISOString() })
  } catch (err) {
    console.error('[cron/onboarding-reminders] Failed:', err)
    const ref = await captureErrorAndWait(err, { source: 'cron', route: '/api/cron/onboarding-reminders' })
    return NextResponse.json({ ok: false, error: 'Reminder run failed', ref }, { status: 500 })
  }
}

// Vercel Cron uses GET
export async function GET(request: NextRequest) {
  return POST(request)
}

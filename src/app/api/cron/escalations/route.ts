import { NextRequest, NextResponse } from 'next/server'
import { processEscalations } from '@/lib/approval-escalation'

/**
 * POST /api/cron/escalations — Process overdue approval escalations.
 *
 * Designed to be called by Vercel Cron or an external scheduler.
 * Protected by a shared secret in the CRON_SECRET env var.
 */
export async function POST(request: NextRequest) {
  // Verify cron secret — require it to be set
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    console.error('[cron/escalations] CRON_SECRET env var not configured')
    return NextResponse.json({ error: 'Not configured' }, { status: 500 })
  }

  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await processEscalations()
    return NextResponse.json({
      ok: true,
      ...result,
      timestamp: new Date().toISOString(),
    })
  } catch (err) {
    console.error('[cron/escalations] Failed:', err)
    return NextResponse.json(
      { ok: false, error: 'Escalation processing failed' },
      { status: 500 },
    )
  }
}

// Also support GET for Vercel Cron (which uses GET by default)
export async function GET(request: NextRequest) {
  return POST(request)
}

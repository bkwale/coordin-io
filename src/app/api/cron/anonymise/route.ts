import { NextResponse, type NextRequest } from 'next/server'
import { safeEqual } from '@/lib/safe-compare'
import { anonymiseProfile, profilesDueForAnonymisation, retentionDays } from '@/lib/gdpr'

export const dynamic = 'force-dynamic'

/**
 * POST /api/cron/anonymise — anonymises people deactivated longer than the retention period.
 * Dry run (lists who is due) unless GDPR_AUTO_ANONYMISE=on. Not scheduled by default.
 */
export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) return NextResponse.json({ error: 'Not configured' }, { status: 500 })
  if (!safeEqual(request.headers.get('authorization'), `Bearer ${secret}`)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const due = await profilesDueForAnonymisation()
  const live = process.env.GDPR_AUTO_ANONYMISE === 'on'
  let done = 0, failed = 0
  if (live) {
    for (const p of due) {
      try { await anonymiseProfile({ profileId: p.id, organisationId: p.organisationId, actorId: null, reason: 'retention' }); done++ } catch { failed++ }
    }
  }
  console.log(`[CRON] anonymise: ${due.length} due, ${live ? `${done} anonymised, ${failed} failed` : 'dry run'}`)
  return NextResponse.json({ ok: true, live, retentionDays: retentionDays(), due: due.length, anonymised: done, failed })
}

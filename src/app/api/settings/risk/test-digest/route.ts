import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/with-auth'
import { ValidationError, PermissionError } from '@/lib/errors'
import { canPerform } from '@/lib/role-permissions'
import { isFeatureEnabled } from '@/lib/feature-flags'
import { checkRateLimit } from '@/lib/rate-limit'
import { recordAuditEvent, AuditActions } from '@/lib/audit'
import { sendTestDigest } from '@/lib/risk/digest'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * POST /api/settings/risk/test-digest — send the weekly risk email, once, to the administrator who asked. Nobody else
 * receives anything, and it does not use up the week's real digest.
 */
export const POST = withAuth(async (_request: NextRequest, { profile, authUserId }) => {
  if (!(await isFeatureEnabled(profile.organisationId, 'ai_risk'))) throw new ValidationError('Risk analysis is not switched on for your practice.')
  if (!canPerform(profile.orgPermission, 'settings', 'edit_org_settings')) throw new PermissionError('Only an administrator can send a test')
  const limited = await checkRateLimit(`risk-test-digest:${authUserId}`, { maxRequests: 3, windowMs: 10 * 60_000 })
  if (limited) return limited

  const r = await sendTestDigest({ organisationId: profile.organisationId, profileId: profile.id, seeAll: canPerform(profile.orgPermission, 'projects', 'view_all') })
  if (!r.sent) {
    if (r.reason === 'nothing_flagged') return NextResponse.json({ data: { sent: false, message: 'Nothing high or medium is flagged on your projects, so there is no email to send. That is also what happens on a Monday: no flags, no email.' } })
    if (r.reason === 'no_address') throw new ValidationError('Your profile has no email address.')
    return NextResponse.json({ error: 'The email could not be sent. Try again in a minute.' }, { status: 502 })
  }
  await recordAuditEvent({ organisationId: profile.organisationId, actorId: profile.id, action: AuditActions.RISK_DIGEST_TEST, entityType: 'organisation', entityId: profile.organisationId, metadata: { subject: r.subject } }).catch(() => {})
  return NextResponse.json({ data: { sent: true, message: `Sent to ${r.to}. It should arrive within a minute.` } })
})

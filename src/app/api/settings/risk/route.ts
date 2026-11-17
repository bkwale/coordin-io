import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/with-auth'
import { prisma } from '@/lib/prisma'
import { ValidationError, PermissionError } from '@/lib/errors'
import { canPerform } from '@/lib/role-permissions'
import { isFeatureEnabled } from '@/lib/feature-flags'
import { parseBody } from '@/lib/validation'
import { recordAuditEvent, AuditActions } from '@/lib/audit'
import { DEFAULT_THRESHOLDS } from '@/lib/risk/signals'
import { parseRiskSettings, validateThresholds, thresholdsToStore, THRESHOLD_FIELDS, toShown } from '@/lib/risk/settings'

export const dynamic = 'force-dynamic'

const shown = (t: Record<string, number>) => Object.fromEntries(THRESHOLD_FIELDS.map((f) => [f.key, toShown(f.unit, t[f.key])]))

async function guard(profile: { organisationId: string; orgPermission: string }, action: 'view_org_settings' | 'edit_org_settings') {
  if (!(await isFeatureEnabled(profile.organisationId, 'ai_risk'))) throw new ValidationError('Risk analysis is not switched on for your practice.')
  if (!canPerform(profile.orgPermission as never, 'settings', action)) throw new PermissionError(action === 'edit_org_settings' ? 'Only an administrator can change the risk settings' : 'You do not have access to the risk settings')
}

/** GET /api/settings/risk — the firm's risk thresholds (as shown: days, hours, percent), the defaults, and the digest switch. */
export const GET = withAuth(async (_request: NextRequest, { profile }) => {
  await guard(profile, 'view_org_settings')
  const org = await prisma.organisation.findUnique({ where: { id: profile.organisationId }, select: { settings: true } })
  const s = parseRiskSettings(org?.settings)
  return NextResponse.json({
    data: {
      thresholds: shown(s.thresholds as never), defaults: shown(DEFAULT_THRESHOLDS as never), weeklyDigest: s.weeklyDigest,
      fields: THRESHOLD_FIELDS, canEdit: canPerform(profile.orgPermission, 'settings', 'edit_org_settings'),
    },
  }, { headers: { 'cache-control': 'no-store' } })
})

/**
 * PATCH /api/settings/risk — body { thresholds?: {key: number…}, weeklyDigest?: boolean, reset?: true }
 * Administrators only. Values are checked against fixed ranges; a change is audited with before and after.
 */
export const PATCH = withAuth(async (request: NextRequest, { profile }) => {
  await guard(profile, 'edit_org_settings')
  const body = await parseBody(request)
  const org = await prisma.organisation.findUnique({ where: { id: profile.organisationId }, select: { settings: true } })
  const all = (org?.settings && typeof org.settings === 'object' ? org.settings : {}) as Record<string, unknown>
  const before = parseRiskSettings(all)

  let thresholds = before.thresholds
  if (body.reset === true) thresholds = { ...DEFAULT_THRESHOLDS }
  else if (body.thresholds !== undefined) {
    // What is not sent keeps its current value, not the default
    const merged = { ...shown(before.thresholds as never), ...(body.thresholds && typeof body.thresholds === 'object' ? (body.thresholds as object) : {}) }
    const v = validateThresholds(merged)
    if (!v.ok) throw new ValidationError(v.problems.join(' '))
    thresholds = v.thresholds
  }
  if (body.weeklyDigest !== undefined && typeof body.weeklyDigest !== 'boolean') throw new ValidationError('Weekly digest must be on or off.')
  const weeklyDigest = typeof body.weeklyDigest === 'boolean' ? body.weeklyDigest : before.weeklyDigest

  // Merged into settings: nothing else stored there changes
  await prisma.organisation.update({ where: { id: profile.organisationId }, data: { settings: { ...all, risk: { thresholds: thresholdsToStore(thresholds), weeklyDigest } } as never } })
  const changed = THRESHOLD_FIELDS.filter((f) => before.thresholds[f.key] !== thresholds[f.key]).map((f) => ({ key: f.key, from: toShown(f.unit, before.thresholds[f.key]), to: toShown(f.unit, thresholds[f.key]) }))
  if (changed.length || weeklyDigest !== before.weeklyDigest) {
    await recordAuditEvent({ organisationId: profile.organisationId, actorId: profile.id, action: AuditActions.RISK_SETTINGS_UPDATED, entityType: 'organisation', entityId: profile.organisationId, metadata: { changed, weeklyDigest: weeklyDigest !== before.weeklyDigest ? { from: before.weeklyDigest, to: weeklyDigest } : undefined } })
  }
  return NextResponse.json({ data: { thresholds: shown(thresholds as never), weeklyDigest } })
})

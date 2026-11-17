import { NextRequest } from 'next/server'
import { withProjectAccess } from '@/lib/with-project-access'
import { assertProjectWrite } from '@/lib/project-write-access'
import { success } from '@/lib/api-response'
import { ValidationError, NotFoundError } from '@/lib/errors'
import { isFeatureEnabled } from '@/lib/feature-flags'
import { parseBody, requireString } from '@/lib/validation'
import { prisma } from '@/lib/prisma'
import { recordAuditEvent, AuditActions } from '@/lib/audit'
import { activeRiskSignals } from '@/lib/risk/active'

export const dynamic = 'force-dynamic'

const signalIdOf = (v: unknown) => {
  const s = requireString(v, 'Flag', 200)
  if (!/^[A-Z_]+:[A-Za-z0-9_-]+$/.test(s)) throw new ValidationError('Unknown flag')
  return s
}

/**
 * POST /api/projects/[id]/risks/dismiss — body { signalId, reason }
 * Set a flag aside. Project lead or above: hiding a risk is a decision, so it needs a reason and it is audited.
 * Only a flag that is being raised right now can be set aside.
 */
export const POST = withProjectAccess(async (request: NextRequest, { projectId, profile, membership }) => {
  if (!(await isFeatureEnabled(profile.organisationId, 'ai_risk'))) throw new ValidationError('Risk analysis is not switched on for your practice.')
  await assertProjectWrite({ profile, projectId, membership }, 'PROJECT_LEAD')
  const body = await parseBody(request)
  const signalId = signalIdOf(body.signalId)
  const reason = requireString(body.reason, 'Reason', 500).trim()
  if (reason.length < 3) throw new ValidationError('Say briefly why this is being set aside.')

  const { all: signals } = await activeRiskSignals(projectId, profile.organisationId)
  const signal = signals.find((s) => s.id === signalId)
  if (!signal) throw new NotFoundError('That flag is no longer being raised.')

  const data = { kind: signal.kind, severity: signal.severity, title: signal.title, reason, dismissedBy: profile.id, dismissedAt: new Date(), restoredAt: null, restoredBy: null }
  await prisma.riskDismissal.upsert({ where: { projectId_signalId: { projectId, signalId } }, create: { projectId, signalId, ...data }, update: data })
  await recordAuditEvent({ organisationId: profile.organisationId, actorId: profile.id, action: AuditActions.RISK_DISMISSED, entityType: 'project', entityId: projectId, metadata: { signalId, kind: signal.kind, severity: signal.severity, title: signal.title, reason } })
  return success({ dismissed: true })
})

/** DELETE /api/projects/[id]/risks/dismiss?signalId=… — bring a flag back. The record of the dismissal is kept. */
export const DELETE = withProjectAccess(async (request: NextRequest, { projectId, profile, membership }) => {
  if (!(await isFeatureEnabled(profile.organisationId, 'ai_risk'))) throw new ValidationError('Risk analysis is not switched on for your practice.')
  await assertProjectWrite({ profile, projectId, membership }, 'PROJECT_LEAD')
  const signalId = signalIdOf(new URL(request.url).searchParams.get('signalId'))
  const res = await prisma.riskDismissal.updateMany({ where: { projectId, signalId, restoredAt: null }, data: { restoredAt: new Date(), restoredBy: profile.id } })
  if (res.count === 0) throw new NotFoundError('That flag is not set aside.')
  await recordAuditEvent({ organisationId: profile.organisationId, actorId: profile.id, action: AuditActions.RISK_RESTORED, entityType: 'project', entityId: projectId, metadata: { signalId } })
  return success({ restored: true })
})

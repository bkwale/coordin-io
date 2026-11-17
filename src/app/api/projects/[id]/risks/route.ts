import { NextRequest, NextResponse } from 'next/server'
import { withProjectAccess } from '@/lib/with-project-access'
import { ValidationError } from '@/lib/errors'
import { isFeatureEnabled } from '@/lib/feature-flags'
import { prisma } from '@/lib/prisma'
import { activeRiskSignals } from '@/lib/risk/active'
import { countActive } from '@/lib/risk/dismissals'

export const dynamic = 'force-dynamic'

/**
 * GET /api/projects/[id]/risks — what looks wrong on this project right now, from its own records.
 * Fixed rules, no AI. Any member of the project can read it: every flag points at a record they can already see.
 * Flags someone has set aside come back separately, with who and why.
 */
export const GET = withProjectAccess(async (_request: NextRequest, { projectId, profile }) => {
  if (!(await isFeatureEnabled(profile.organisationId, 'ai_risk'))) throw new ValidationError('Risk analysis is not switched on for your practice.')
  const { active, dismissed, generatedAt } = await activeRiskSignals(projectId, profile.organisationId)
  const ids = [...new Set(dismissed.map((d) => d.dismissedBy))]
  const people = ids.length ? await prisma.profile.findMany({ where: { id: { in: ids }, organisationId: profile.organisationId }, select: { id: true, fullName: true } }) : []
  const name = (id: string) => people.find((p) => p.id === id)?.fullName ?? 'Someone'
  return NextResponse.json({
    data: { signals: active, dismissed: dismissed.map((d) => ({ ...d, dismissedByName: name(d.dismissedBy) })), counts: countActive(active), generatedAt },
  }, { headers: { 'cache-control': 'no-store' } })
})

import { NextRequest, NextResponse } from 'next/server'
import { withProjectAccess } from '@/lib/with-project-access'
import { ValidationError } from '@/lib/errors'
import { isFeatureEnabled } from '@/lib/feature-flags'
import { projectRiskSignals } from '@/lib/risk/load'

export const dynamic = 'force-dynamic'

/**
 * GET /api/projects/[id]/risks — what looks wrong on this project right now, from its own records.
 * Fixed rules, no AI. Any member of the project can read it: every signal points at a record they can already see.
 */
export const GET = withProjectAccess(async (_request: NextRequest, { projectId, profile }) => {
  if (!(await isFeatureEnabled(profile.organisationId, 'ai_risk'))) throw new ValidationError('Risk analysis is not switched on for your practice.')
  const result = await projectRiskSignals(projectId)
  return NextResponse.json({ data: result }, { headers: { 'cache-control': 'no-store' } })
})

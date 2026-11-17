import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/with-auth'
import { ValidationError } from '@/lib/errors'
import { canPerform } from '@/lib/role-permissions'
import { isFeatureEnabled } from '@/lib/feature-flags'
import { portfolioRisks } from '@/lib/risk/portfolio'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * GET /api/risks — risk across the projects the caller can see, worst first.
 * Same visibility as the project list: everyone in the firm's projects for those who may view all, otherwise only the
 * projects the person is on. Fixed rules, no AI.
 */
export const GET = withAuth(async (_request: NextRequest, { profile }) => {
  if (!(await isFeatureEnabled(profile.organisationId, 'ai_risk'))) throw new ValidationError('Risk analysis is not switched on for your practice.')
  const result = await portfolioRisks({ organisationId: profile.organisationId, profileId: profile.id, seeAll: canPerform(profile.orgPermission, 'projects', 'view_all') })
  return NextResponse.json({
    data: { ...result, projects: result.projects.map(({ signals: _signals, ...p }) => p) },
  }, { headers: { 'cache-control': 'no-store' } })
})

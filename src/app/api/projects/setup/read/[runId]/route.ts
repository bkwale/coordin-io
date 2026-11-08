import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/with-auth'
import { prisma } from '@/lib/prisma'
import { failIfStale } from '@/lib/ai/stale-runs'

export const dynamic = 'force-dynamic'

/** GET /api/projects/setup/read/[runId] — poll a wizard reading. Only the person who started it, before the project exists. */
export const GET = withAuth(async (request: NextRequest, { profile, authUserId }) => {
  const runId = new URL(request.url).pathname.split('/').pop() ?? ''
  const run = await prisma.aIRun.findFirst({
    where: { id: runId, organisationId: profile.organisationId, projectId: null, surface: 'PROJECT_SETUP', createdBy: authUserId },
    select: { id: true, status: true, stages: true, mapping: true, confidence: true, error: true, errorKind: true, createdAt: true },
  })
  if (!run) return NextResponse.json({ error: 'Reading not found', code: 'NOT_FOUND' }, { status: 404 })
  Object.assign(run, await failIfStale(run))
  return NextResponse.json({ data: run }, { headers: { 'cache-control': 'no-store' } })
}, { requiredPermission: 'MANAGER' })

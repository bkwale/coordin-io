import { NextResponse, type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withProjectAccess } from '@/lib/with-project-access'

export const dynamic = 'force-dynamic'

/** GET /api/projects/[id]/setup/runs — the newest document reading still waiting for someone to confirm (so it reappears after a reload). */
export const GET = withProjectAccess(async (_request: NextRequest, { projectId }) => {
  const since = new Date(Date.now() - 30 * 86_400_000)
  const run = await prisma.aIRun.findFirst({
    where: { projectId, surface: 'PROJECT_SETUP', status: 'AWAITING_CONFIRMATION', createdAt: { gte: since } },
    orderBy: { createdAt: 'desc' },
    select: { id: true },
  })
  return NextResponse.json({ data: run ? { runId: run.id } : null }, { headers: { 'cache-control': 'no-store' } })
})

import { NextRequest, NextResponse } from 'next/server'
import { withSuperAdmin } from '@/lib/with-super-admin'
import { prisma } from '@/lib/prisma'
import { failIfStale } from '@/lib/ai/stale-runs'

export const dynamic = 'force-dynamic'

function idFrom(request: NextRequest): string {
  const parts = new URL(request.url).pathname.split('/').filter(Boolean)
  return parts[parts.length - 1] || ''
}

/** GET /api/ai/runs/[id] — poll a run's status, stages, output and mapping. */
export const GET = withSuperAdmin(async (request: NextRequest) => {
  const id = idFrom(request)
  const run = await prisma.aIRun.findUnique({ where: { id } })
  if (!run) return NextResponse.json({ error: 'Run not found', code: 'NOT_FOUND' }, { status: 404 })
  // Practice-setup runs can be killed mid-way too; never leave the page spinning
  const current = await failIfStale(run)
  return NextResponse.json({ data: current }, { headers: { 'cache-control': 'no-store' } })
})

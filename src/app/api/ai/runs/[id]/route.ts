import { NextRequest, NextResponse } from 'next/server'
import { withSuperAdmin } from '@/lib/with-super-admin'
import { prisma } from '@/lib/prisma'

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
  return NextResponse.json({ data: run }, { headers: { 'cache-control': 'no-store' } })
})

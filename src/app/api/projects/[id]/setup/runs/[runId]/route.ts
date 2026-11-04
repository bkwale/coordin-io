import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withProjectAccess } from '@/lib/with-project-access'

export const dynamic = 'force-dynamic'

/** GET /api/projects/[id]/setup/runs/[runId] — poll a project-setup run (any project member). */
export const GET = withProjectAccess(async (request: NextRequest, { projectId }) => {
  const runId = new URL(request.url).pathname.split('/').pop() ?? ''
  const run = await prisma.aIRun.findFirst({ where: { id: runId, projectId, surface: 'PROJECT_SETUP' }, select: { id: true, status: true, stages: true, mapping: true, confidence: true, error: true, latencyMs: true, model: true, inputSummary: true, createdAt: true } })
  if (!run) return NextResponse.json({ error: 'Run not found', code: 'NOT_FOUND' }, { status: 404 })
  let documentUrl: string | null = null
  try {
    const { documentId } = JSON.parse(run.inputSummary) as { documentId?: string | null }
    if (documentId) { const rev = await prisma.documentRevision.findFirst({ where: { documentId }, orderBy: { createdAt: 'desc' }, select: { fileUrl: true } }); documentUrl = rev?.fileUrl ?? null }
  } catch { /* no document */ }
  return NextResponse.json({ data: { ...run, documentUrl } }, { headers: { 'cache-control': 'no-store' } })
})

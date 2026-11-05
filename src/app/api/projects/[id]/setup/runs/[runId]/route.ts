import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withProjectAccess } from '@/lib/with-project-access'

export const dynamic = 'force-dynamic'

export const STALE_AFTER_MS = 6 * 60_000

/** GET /api/projects/[id]/setup/runs/[runId] — poll a project-setup run (any project member). */
export const GET = withProjectAccess(async (request: NextRequest, { projectId }) => {
  const runId = new URL(request.url).pathname.split('/').pop() ?? ''
  const run = await prisma.aIRun.findFirst({ where: { id: runId, projectId, surface: 'PROJECT_SETUP' }, select: { id: true, status: true, stages: true, mapping: true, confidence: true, error: true, latencyMs: true, model: true, inputSummary: true, createdAt: true } })
  if (!run) return NextResponse.json({ error: 'Run not found', code: 'NOT_FOUND' }, { status: 404 })
  // The function that runs the AI is killed at 300 s. A run still QUEUED/RUNNING after 6 min will never finish — say so.
  if ((run.status === 'QUEUED' || run.status === 'RUNNING') && Date.now() - run.createdAt.getTime() > STALE_AFTER_MS) {
    const msg = 'This took too long and was stopped. The AI service may be busy — try again, or fill the questionnaire by hand.'
    await prisma.aIRun.updateMany({ where: { id: run.id, status: { in: ['QUEUED', 'RUNNING'] } }, data: { status: 'FAILED', error: msg } })
    run.status = 'FAILED'; run.error = msg
  }
  let documentUrl: string | null = null
  try {
    const { documentId } = JSON.parse(run.inputSummary) as { documentId?: string | null }
    if (documentId) { const rev = await prisma.documentRevision.findFirst({ where: { documentId }, orderBy: { createdAt: 'desc' }, select: { fileUrl: true } }); documentUrl = rev?.fileUrl ?? null }
  } catch { /* no document */ }
  return NextResponse.json({ data: { ...run, documentUrl } }, { headers: { 'cache-control': 'no-store' } })
})

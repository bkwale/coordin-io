import { prisma } from '@/lib/prisma'
import { AI_FAILURE_MESSAGE } from './failures'
import { captureError } from '@/lib/error-reporting'

/**
 * Functions that run the AI are killed at 300 s. A run still QUEUED/RUNNING well after that will
 * never finish, so pollers mark it FAILED with a clear message instead of spinning forever.
 */
export const STALE_AFTER_MS = 6 * 60_000

export const STALE_MESSAGE = AI_FAILURE_MESSAGE.stale

export function isStale(run: { status: string; createdAt: Date }, now: number = Date.now()): boolean {
  return (run.status === 'QUEUED' || run.status === 'RUNNING') && now - run.createdAt.getTime() > STALE_AFTER_MS
}

/** If the run is stale, mark it FAILED (only if it is still running) and return the updated fields. */
export async function failIfStale<T extends { id: string; status: string; createdAt: Date; error: string | null }>(run: T): Promise<T> {
  if (!isStale(run)) return run
  const res = await prisma.aIRun.updateMany({
    where: { id: run.id, status: { in: ['QUEUED', 'RUNNING'] } },
    data: { status: 'FAILED', error: STALE_MESSAGE, errorKind: 'stale', errorDetail: 'Still QUEUED/RUNNING after the function time limit — the background job was killed or never started' },
  })
  // Only the poll that actually closed it reports it (no duplicate rows from repeated polling)
  if (res.count === 1) captureError(new Error('AI run stopped: still running after the time limit'), { source: 'ai', runId: run.id, code: 'AI_STALE', extra: { kind: 'stale' } }, 'warning')
  return { ...run, status: 'FAILED', error: STALE_MESSAGE, errorKind: 'stale' }
}

import { prisma } from '@/lib/prisma'

/**
 * Functions that run the AI are killed at 300 s. A run still QUEUED/RUNNING well after that will
 * never finish, so pollers mark it FAILED with a clear message instead of spinning forever.
 */
export const STALE_AFTER_MS = 6 * 60_000

export const STALE_MESSAGE = 'This took too long and was stopped. The AI service may be busy — try again, or fill it in by hand.'

export function isStale(run: { status: string; createdAt: Date }, now: number = Date.now()): boolean {
  return (run.status === 'QUEUED' || run.status === 'RUNNING') && now - run.createdAt.getTime() > STALE_AFTER_MS
}

/** If the run is stale, mark it FAILED (only if it is still running) and return the updated fields. */
export async function failIfStale<T extends { id: string; status: string; createdAt: Date; error: string | null }>(run: T): Promise<T> {
  if (!isStale(run)) return run
  await prisma.aIRun.updateMany({ where: { id: run.id, status: { in: ['QUEUED', 'RUNNING'] } }, data: { status: 'FAILED', error: STALE_MESSAGE } })
  return { ...run, status: 'FAILED', error: STALE_MESSAGE }
}

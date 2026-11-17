import { prisma } from '@/lib/prisma'
import { projectRiskSignals } from './load'
import { applyDismissals } from './dismissals'

/** The flags being raised on a project right now, minus the ones someone has set aside. */
export async function activeRiskSignals(projectId: string) {
  const [{ signals, generatedAt }, rows] = await Promise.all([
    projectRiskSignals(projectId),
    prisma.riskDismissal.findMany({ where: { projectId }, select: { signalId: true, severity: true, reason: true, dismissedBy: true, dismissedAt: true, restoredAt: true } }),
  ])
  return { ...applyDismissals(signals, rows), generatedAt }
}

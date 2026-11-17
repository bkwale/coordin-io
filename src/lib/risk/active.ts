import { prisma } from '@/lib/prisma'
import { projectRiskSignals } from './load'
import { applyDismissals } from './dismissals'
import { parseRiskSettings, type RiskSettings } from './settings'

/** A firm's risk settings (thresholds, weekly digest). Defaults when nothing is saved. */
export async function riskSettingsFor(organisationId: string): Promise<RiskSettings> {
  const org = await prisma.organisation.findUnique({ where: { id: organisationId }, select: { settings: true } })
  return parseRiskSettings(org?.settings)
}

/** The flags being raised on a project right now, with the firm's thresholds, minus the ones someone has set aside. */
export async function activeRiskSignals(projectId: string, organisationId: string, opts: { now?: Date; settings?: RiskSettings } = {}) {
  const now = opts.now ?? new Date()
  const settings = opts.settings ?? (await riskSettingsFor(organisationId))
  const [{ signals, generatedAt }, rows] = await Promise.all([
    projectRiskSignals(projectId, now, settings.thresholds),
    prisma.riskDismissal.findMany({ where: { projectId }, select: { signalId: true, severity: true, reason: true, dismissedBy: true, dismissedAt: true, restoredAt: true } }),
  ])
  return { ...applyDismissals(signals, rows), all: signals, generatedAt }
}

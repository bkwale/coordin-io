/** Risk across every project a person can see. Fixed rules only: no AI is called here. */
import { prisma } from '@/lib/prisma'
import { activeRiskSignals, riskSettingsFor } from './active'
import { countActive } from './dismissals'
import type { RiskSignal } from './signals'
import type { RiskSettings } from './settings'

export const PORTFOLIO_MAX_PROJECTS = 60
const SEVERITY_ORDER = { high: 0, medium: 1, low: 2 } as const

export interface ProjectRisk {
  id: string; name: string; code: string | null; stage: string | null
  counts: { total: number; high: number; medium: number; low: number }
  /** The worst few flags, for the list. The project's own Risks page has them all. */
  top: Array<Pick<RiskSignal, 'id' | 'severity' | 'area' | 'title' | 'link'>>
  failed?: boolean
}

/** Worst first: most high flags, then most medium, then most in total, then by name so the order never jumps about. */
export function rankProjects<T extends { name: string; counts: { total: number; high: number; medium: number } }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => b.counts.high - a.counts.high || b.counts.medium - a.counts.medium || b.counts.total - a.counts.total || a.name.localeCompare(b.name))
}

export function topSignals(signals: RiskSignal[], n = 3): ProjectRisk['top'] {
  return [...signals].sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]).slice(0, n).map((s) => ({ id: s.id, severity: s.severity, area: s.area, title: s.title, link: s.link }))
}

export function totals(rows: Array<{ counts: ProjectRisk['counts'] }>) {
  return rows.reduce((t, r) => ({ total: t.total + r.counts.total, high: t.high + r.counts.high, medium: t.medium + r.counts.medium, low: t.low + r.counts.low }), { total: 0, high: 0, medium: 0, low: 0 })
}

async function inBatches<T, R>(items: T[], size: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = []
  for (let i = 0; i < items.length; i += size) out.push(...(await Promise.all(items.slice(i, i + size).map(fn))))
  return out
}

/**
 * Every live project the person may see (all of the firm's for those who can view all, otherwise the ones they are on),
 * with its active flags counted. A project whose records could not be read is returned marked, never silently dropped.
 */
export async function portfolioRisks(input: { organisationId: string; profileId: string | null; seeAll: boolean; now?: Date; settings?: RiskSettings; top?: number }) {
  const now = input.now ?? new Date()
  const settings = input.settings ?? (await riskSettingsFor(input.organisationId))
  const where = {
    organisationId: input.organisationId,
    status: { notIn: ['ARCHIVED', 'COMPLETED'] as never[] },
    ...(input.seeAll || !input.profileId ? {} : { memberships: { some: { profileId: input.profileId, removedAt: null } } }),
  }
  const [projects, totalProjects] = await Promise.all([
    prisma.project.findMany({ where, select: { id: true, name: true, code: true, stage: true }, orderBy: { updatedAt: 'desc' }, take: PORTFOLIO_MAX_PROJECTS }),
    prisma.project.count({ where }),
  ])
  const rows = await inBatches(projects, 4, async (p): Promise<ProjectRisk & { signals: RiskSignal[] }> => {
    try {
      const { active } = await activeRiskSignals(p.id, input.organisationId, { now, settings })
      return { id: p.id, name: p.name, code: p.code, stage: p.stage ? String(p.stage) : null, counts: countActive(active), top: topSignals(active, input.top ?? 3), signals: active }
    } catch {
      return { id: p.id, name: p.name, code: p.code, stage: p.stage ? String(p.stage) : null, counts: { total: 0, high: 0, medium: 0, low: 0 }, top: [], signals: [], failed: true }
    }
  })
  return { projects: rankProjects(rows), totals: totals(rows), shown: projects.length, totalProjects, generatedAt: now.toISOString() }
}

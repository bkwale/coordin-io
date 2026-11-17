/** Which flags are showing and which have been set aside. Pure: no database here. */
import type { RiskSignal, RiskSeverity } from './signals'

export interface DismissalRow { signalId: string; severity: string; reason: string; dismissedBy: string; dismissedAt: Date; restoredAt: Date | null }
export interface DismissedSignal { signal: RiskSignal; reason: string; dismissedBy: string; dismissedAt: string }

const RANK: Record<string, number> = { low: 0, medium: 1, high: 2 }

/**
 * A flag stays set aside until the thing it describes is fixed (then it simply stops being raised) or until it
 * gets worse than it was when someone set it aside. "Medium" dismissed, now "high": it comes back, marked.
 */
export function applyDismissals(signals: RiskSignal[], rows: DismissalRow[]): { active: Array<RiskSignal & { cameBack?: boolean }>; dismissed: DismissedSignal[] } {
  const live = new Map(rows.filter((r) => !r.restoredAt).map((r) => [r.signalId, r]))
  const active: Array<RiskSignal & { cameBack?: boolean }> = []
  const dismissed: DismissedSignal[] = []
  for (const s of signals) {
    const d = live.get(s.id)
    if (!d) { active.push(s); continue }
    if ((RANK[s.severity] ?? 0) > (RANK[d.severity] ?? 0)) { active.push({ ...s, cameBack: true }); continue }
    dismissed.push({ signal: s, reason: d.reason, dismissedBy: d.dismissedBy, dismissedAt: d.dismissedAt.toISOString() })
  }
  return { active, dismissed }
}

export function countActive(signals: Array<{ severity: RiskSeverity }>) {
  const by = (s: RiskSeverity) => signals.filter((x) => x.severity === s).length
  return { total: signals.length, high: by('high'), medium: by('medium'), low: by('low') }
}

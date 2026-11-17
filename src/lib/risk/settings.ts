/**
 * Per-firm risk settings, kept inside organisations.settings.risk (no new table).
 * Anything missing or out of range falls back to the default, so a bad value can never switch the rules off.
 */
import { DEFAULT_THRESHOLDS, type RiskThresholds } from './signals'

export interface RiskSettings { thresholds: RiskThresholds; weeklyDigest: boolean }

/** What an admin may change, with the range each value is allowed. Percentages are whole numbers on screen. */
export const THRESHOLD_FIELDS: Array<{ key: keyof RiskThresholds; label: string; help: string; unit: 'days' | 'hours' | 'percent'; min: number; max: number }> = [
  { key: 'taskMediumAfterDays', label: 'Late task becomes medium after', help: 'Before this it is low.', unit: 'days', min: 1, max: 30 },
  { key: 'taskHighAfterDays', label: 'Late task becomes high after', help: 'High-priority tasks are high as soon as they are late.', unit: 'days', min: 2, max: 90 },
  { key: 'blockedAfterDays', label: 'Blocked task is flagged after', help: 'Days a task sits in Blocked.', unit: 'days', min: 1, max: 60 },
  { key: 'dueSoonDays', label: '"Due soon" means within', help: 'For conditions, and tasks with no owner.', unit: 'days', min: 1, max: 30 },
  { key: 'milestoneWindowDays', label: 'Check milestones due within', help: 'A milestone this close with late or blocked tasks is flagged.', unit: 'days', min: 3, max: 60 },
  { key: 'permitExpiryWarningDays', label: 'Warn before a permission lapses', help: 'Days before the expiry date.', unit: 'days', min: 14, max: 365 },
  { key: 'hoursMinimumPlanned', label: 'Compare hours once this many are planned', help: 'Stops one odd week raising a flag.', unit: 'hours', min: 0, max: 500 },
  { key: 'hoursOverPlan', label: 'Hours over plan are flagged at', help: 'Logged hours above the plan to date.', unit: 'percent', min: 1, max: 100 },
  { key: 'hoursOverPlanHigh', label: 'Hours over plan are high at', help: 'Must be above the line before.', unit: 'percent', min: 2, max: 200 },
  { key: 'waitingDays', label: 'Waiting for a decision is flagged after', help: 'Reviews and expenses nobody has decided.', unit: 'days', min: 1, max: 30 },
  { key: 'waitingHighDays', label: 'Waiting for a decision is high after', help: 'Must be above the line before.', unit: 'days', min: 2, max: 90 },
]

/** Pairs where the second must be larger than the first, or the "high" level could never be reached in order. */
const ORDERED: Array<[keyof RiskThresholds, keyof RiskThresholds]> = [['taskMediumAfterDays', 'taskHighAfterDays'], ['hoursOverPlan', 'hoursOverPlanHigh'], ['waitingDays', 'waitingHighDays']]

const toStored = (unit: string, n: number) => (unit === 'percent' ? Math.round(n) / 100 : Math.round(n))
export const toShown = (unit: string, n: number) => (unit === 'percent' ? Math.round(n * 100) : n)

function inRange(key: keyof RiskThresholds, stored: unknown): stored is number {
  const f = THRESHOLD_FIELDS.find((x) => x.key === key)
  if (!f || typeof stored !== 'number' || !Number.isFinite(stored)) return false
  const shown = toShown(f.unit, stored)
  return shown >= f.min && shown <= f.max
}

/** Read settings from the organisation's settings JSON. Never throws; unknown keys are ignored. */
export function parseRiskSettings(orgSettings: unknown): RiskSettings {
  const risk = (orgSettings && typeof orgSettings === 'object' ? (orgSettings as Record<string, unknown>).risk : null) as { thresholds?: Record<string, unknown>; weeklyDigest?: unknown } | null
  const thresholds: RiskThresholds = { ...DEFAULT_THRESHOLDS }
  const saved = risk?.thresholds && typeof risk.thresholds === 'object' ? risk.thresholds : {}
  for (const f of THRESHOLD_FIELDS) if (inRange(f.key, saved[f.key])) thresholds[f.key] = saved[f.key] as number
  // A saved pair that is out of order is not used: both go back to the default
  for (const [a, b] of ORDERED) if (thresholds[b] <= thresholds[a]) { thresholds[a] = DEFAULT_THRESHOLDS[a]; thresholds[b] = DEFAULT_THRESHOLDS[b] }
  return { thresholds, weeklyDigest: risk?.weeklyDigest === true }
}

/**
 * Check what an admin typed (values as shown on screen: whole days, hours, percent). Returns the thresholds to store,
 * or the list of problems in plain words.
 */
export function validateThresholds(input: unknown): { ok: true; thresholds: RiskThresholds } | { ok: false; problems: string[] } {
  const body = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>
  const problems: string[] = []
  const out: RiskThresholds = { ...DEFAULT_THRESHOLDS }
  for (const f of THRESHOLD_FIELDS) {
    const v = body[f.key]
    if (v === undefined || v === null || v === '') continue // not sent: default
    const n = typeof v === 'number' ? v : Number(v)
    if (!Number.isFinite(n) || !Number.isInteger(n)) { problems.push(`${f.label}: enter a whole number.`); continue }
    if (n < f.min || n > f.max) { problems.push(`${f.label}: must be between ${f.min} and ${f.max}.`); continue }
    out[f.key] = toStored(f.unit, n)
  }
  if (problems.length === 0) for (const [a, b] of ORDERED) if (out[b] <= out[a]) {
    const fa = THRESHOLD_FIELDS.find((x) => x.key === a)!, fb = THRESHOLD_FIELDS.find((x) => x.key === b)!
    problems.push(`"${fb.label}" must be more than "${fa.label}".`)
  }
  return problems.length ? { ok: false, problems } : { ok: true, thresholds: out }
}

/** Only the values that differ from the defaults are stored, so a later change to a default reaches firms that never touched it. */
export function thresholdsToStore(t: RiskThresholds): Partial<RiskThresholds> {
  const out: Partial<RiskThresholds> = {}
  for (const f of THRESHOLD_FIELDS) if (t[f.key] !== DEFAULT_THRESHOLDS[f.key]) out[f.key] = t[f.key]
  return out
}

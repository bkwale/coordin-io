/**
 * Onboarding stages — single source of truth (COORD-BUG-015).
 *
 * New items use the four core stages. Older CWA templates/assignments also contain PRE_START,
 * FIRST_WEEK and FIRST_MONTH; screens that hard-coded the four core stages hid those items
 * (46 template items shown as 36; 14 assignment tasks invisible to HR, so assignments could never
 * complete). Every screen now renders every stage present in the data, in a sensible order,
 * with a readable label. Unknown future stages still render (never silently hidden).
 */
export const CORE_STAGES = ['BEFORE_START', 'DAY_ONE', 'ROLE_SPECIFIC', 'PROBATION'] as const
export type CoreStage = typeof CORE_STAGES[number]

/** Chronological order including legacy stages. */
export const STAGE_ORDER = ['PRE_START', 'BEFORE_START', 'DAY_ONE', 'FIRST_WEEK', 'FIRST_MONTH', 'ROLE_SPECIFIC', 'PROBATION'] as const

const META: Record<string, { label: string; color: string }> = {
  PRE_START: { label: 'Pre-start', color: 'bg-sky-100 text-sky-800' },
  BEFORE_START: { label: 'Before Start', color: 'bg-blue-100 text-blue-800' },
  DAY_ONE: { label: 'Day One', color: 'bg-green-100 text-green-800' },
  FIRST_WEEK: { label: 'First Week', color: 'bg-emerald-100 text-emerald-800' },
  FIRST_MONTH: { label: 'First Month', color: 'bg-teal-100 text-teal-800' },
  ROLE_SPECIFIC: { label: 'Role Specific', color: 'bg-purple-100 text-purple-800' },
  PROBATION: { label: 'Probation', color: 'bg-amber-100 text-amber-800' },
}

export function stageMeta(stage: string): { key: string; label: string; color: string } {
  const m = META[stage]
  if (m) return { key: stage, ...m }
  const label = stage.toLowerCase().replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase())
  return { key: stage, label, color: 'bg-gray-100 text-gray-700' }
}

/**
 * Stages to render: the four core stages always (so empty ones still show as drop targets),
 * plus every other stage present in the data, in chronological order, unknown ones last.
 */
export function orderedStages(present: Iterable<string>): string[] {
  const set = new Set(present)
  const ordered = (STAGE_ORDER as readonly string[]).filter((s) => (CORE_STAGES as readonly string[]).includes(s) || set.has(s))
  const unknown = [...set].filter((s) => !(STAGE_ORDER as readonly string[]).includes(s)).sort()
  return [...ordered, ...unknown]
}

/** Stages accepted when creating or editing items/tasks. Legacy stages stay valid so existing items can be edited. */
export const VALID_STAGES: readonly string[] = STAGE_ORDER
export function isValidStage(s: unknown): s is string { return typeof s === 'string' && VALID_STAGES.includes(s) }

/**
 * One badge per task (Wale, 5 Nov). The stored status and a computed "overdue" flag used to show
 * as two badges ("PENDING" + "OVERDUE"). Overdue now replaces Pending / In progress.
 */
const TASK_STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pending', IN_PROGRESS: 'In progress', OVERDUE: 'Overdue', COMPLETED: 'Completed', WAIVED: 'Waived',
}
export function taskDisplayStatus(status: string, dueDate: string | Date | null | undefined, now: Date = new Date()): { key: string; label: string } {
  const done = status === 'COMPLETED' || status === 'WAIVED'
  const late = !done && !!dueDate && (() => {
    const d = new Date(dueDate); d.setHours(0, 0, 0, 0)
    const n = new Date(now); n.setHours(0, 0, 0, 0)
    return d < n
  })()
  const key = late ? 'OVERDUE' : status
  return { key, label: TASK_STATUS_LABELS[key] ?? status }
}

/**
 * Seven-day onboarding framework (Ayo, Coordin bug report 10, sections 1.2–1.6).
 *
 * - Two employee types: NEW (joining CWA) and EXISTING (already employed, joining Coordin).
 * - One core template applied to everyone; items can be limited to NEW or EXISTING staff.
 * - Role add-on templates merged into the same assignment, without duplicating core tasks.
 * - A seven-day window for the employee's own (self-service) tasks only. It starts when the
 *   employee activates the invitation, or on a date HR picks. Reminders on days 3, 5 and 7;
 *   HR is told when it is missed; HR can extend it.
 * - Six operational categories, each task owned by the right person (not all with HR).
 *
 * Pure functions only — routes and the cron do the I/O.
 */

export const EMPLOYEE_TYPES = ['NEW', 'EXISTING'] as const
export type EmployeeType = typeof EMPLOYEE_TYPES[number]
export const EMPLOYEE_TYPE_LABELS: Record<EmployeeType, string> = {
  NEW: 'New employee',
  EXISTING: 'Existing employee joining Coordin',
}
export function isEmployeeType(v: unknown): v is EmployeeType {
  return typeof v === 'string' && (EMPLOYEE_TYPES as readonly string[]).includes(v)
}

export const APPLIES_TO = ['ALL', 'NEW', 'EXISTING'] as const
export type AppliesTo = typeof APPLIES_TO[number]
export function isAppliesTo(v: unknown): v is AppliesTo {
  return typeof v === 'string' && (APPLIES_TO as readonly string[]).includes(v)
}
export function itemApplies(appliesTo: string | null | undefined, type: EmployeeType): boolean {
  return !appliesTo || appliesTo === 'ALL' || appliesTo === type
}

export const TEMPLATE_KINDS = ['CORE', 'ADDON'] as const
export type TemplateKind = typeof TEMPLATE_KINDS[number]

export const RESPONSIBLE_ROLES = ['EMPLOYEE', 'HR', 'MANAGER', 'IT', 'ACCOUNTS'] as const
export type ResponsibleRole = typeof RESPONSIBLE_ROLES[number]
export const RESPONSIBLE_LABELS: Record<string, string> = {
  EMPLOYEE: 'Employee', HR: 'HR', MANAGER: 'Line manager', IT: 'IT', ACCOUNTS: 'Accounts',
}

/** Ayo 1.4 — the six operational categories. */
export const ONBOARDING_CATEGORIES = [
  'Employee Details', 'Employment Documents', 'Payroll', 'IT & Equipment', 'Induction & Training', 'Final Verification',
] as const

export const DEFAULT_WINDOW_DAYS = 7
export const MAX_WINDOW_DAYS = 60
export const REMINDER_DAYS = [3, 5, 7] as const

const DAY_MS = 24 * 60 * 60 * 1000

export function addDays(d: Date, days: number): Date {
  return new Date(d.getTime() + days * DAY_MS)
}

/** Fallback time zone for deadlines when the caller doesn't pass the firm's (see firmTimezone in region-server). */
export const ORG_TIMEZONE = process.env.ORG_TIMEZONE || 'Africa/Lagos'

/** Offset (ms) of `tz` from UTC at instant `d`. */
function tzOffsetMs(d: Date, tz: string): number {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
    .formatToParts(d).reduce<Record<string, number>>((acc, p) => { if (p.type !== 'literal') acc[p.type] = Number(p.value); return acc }, {})
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second)
  return asUtc - Math.floor(d.getTime() / 1000) * 1000
}

/** 23:59:59 on the calendar day of `d` in `tz`, as a UTC instant. */
export function endOfDayIn(d: Date, tz: string = ORG_TIMEZONE): Date {
  const off = tzOffsetMs(d, tz)
  const local = new Date(d.getTime() + off) // wall-clock time expressed as if UTC
  const endLocal = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate(), 23, 59, 59)
  return new Date(endLocal - off)
}

/** "12 November" in the organisation's time zone. */
export function formatDueDate(d: Date | string, tz: string = ORG_TIMEZONE): string {
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', timeZone: tz })
}

/** Clamp a requested window length to something sensible. */
export function normaliseWindowDays(v: unknown): number {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN
  if (!Number.isFinite(n)) return DEFAULT_WINDOW_DAYS
  return Math.min(MAX_WINDOW_DAYS, Math.max(1, Math.round(n)))
}

export type WindowState = 'NOT_STARTED' | 'OPEN' | 'OVERDUE' | 'SUBMITTED' | 'VERIFIED'

export interface WindowFields {
  windowStartAt: Date | string | null
  windowDueAt: Date | string | null
  submittedAt: Date | string | null
  verifiedAt: Date | string | null
}

const toDate = (v: Date | string | null | undefined) => (v ? new Date(v) : null)

export function windowState(a: WindowFields, now: Date = new Date()): WindowState {
  if (a.verifiedAt) return 'VERIFIED'
  if (a.submittedAt) return 'SUBMITTED'
  const due = toDate(a.windowDueAt)
  if (!toDate(a.windowStartAt) || !due) return 'NOT_STARTED'
  return now.getTime() > due.getTime() ? 'OVERDUE' : 'OPEN'
}

/** Days left until the deadline, rounded up (negative = days overdue). Null if not started. */
export function daysRemaining(a: Pick<WindowFields, 'windowDueAt'>, now: Date = new Date()): number | null {
  const due = toDate(a.windowDueAt)
  if (!due) return null
  const diff = due.getTime() - now.getTime()
  return diff >= 0 ? Math.ceil(diff / DAY_MS) : -Math.ceil(-diff / DAY_MS)
}

/** Which day of the window "now" is in (day 1 = the first 24 hours). Null if not started. */
export function windowDay(a: Pick<WindowFields, 'windowStartAt'>, now: Date = new Date()): number | null {
  const start = toDate(a.windowStartAt)
  if (!start) return null
  return Math.floor((now.getTime() - start.getTime()) / DAY_MS) + 1
}

/**
 * The reminder to send now, if any: the latest of days 3/5/7 that has been reached and not yet sent.
 * Days that were missed (e.g. the cron didn't run) collapse into one reminder rather than a burst.
 */
export function reminderDue(
  a: WindowFields & { remindersSent?: number[] | null; windowDays?: number | null },
  now: Date = new Date(),
): number | null {
  if (windowState(a, now) !== 'OPEN') return null
  const day = windowDay(a, now)
  if (day === null) return null
  // Window length from the actual dates, so an extended window keeps reminding on its new schedule
  const start = toDate(a.windowStartAt), due = toDate(a.windowDueAt)
  const length = start && due ? Math.max(1, Math.round((due.getTime() - start.getTime()) / DAY_MS)) : (a.windowDays ?? DEFAULT_WINDOW_DAYS)
  // Scale 3/5/7 to the window length so an extended or custom window still reminds sensibly
  const scaled = REMINDER_DAYS.map((d) => Math.max(1, Math.round((d / DEFAULT_WINDOW_DAYS) * length)))
  const sent = new Set(a.remindersSent ?? [])
  const reached = scaled.filter((d) => d <= day && !sent.has(d))
  return reached.length ? reached[reached.length - 1] : null
}

/** HR should be told once when the window has been missed. */
export function missedNotificationDue(a: WindowFields & { missedNotifiedAt?: Date | string | null }, now: Date = new Date()): boolean {
  return windowState(a, now) === 'OVERDUE' && !a.missedNotifiedAt
}

/**
 * Window start/due for a given start date and length. Day 1 is the start day; the deadline is the
 * end of day N in the organisation's time zone (a 16:00 activation doesn't expire at 16:00 on day 7).
 */
export function windowFor(start: Date, days: number, tz: string = ORG_TIMEZONE): { windowStartAt: Date; windowDueAt: Date } {
  return { windowStartAt: start, windowDueAt: endOfDayIn(addDays(start, normaliseWindowDays(days) - 1), tz) }
}

/** Extending a window: end of day on (later of current due, now) + extra days. */
export function extendedDueDate(currentDue: Date | string | null, extraDays: number, now: Date = new Date(), tz: string = ORG_TIMEZONE): Date {
  const base = toDate(currentDue)
  const from = base && base.getTime() > now.getTime() ? base : now
  return endOfDayIn(addDays(from, normaliseWindowDays(extraDays)), tz)
}

// ── Self-service steps per employee type (Ayo 1.2) ─────────────────────────

export type SelfServiceStep =
  | 'PERSONAL_DETAILS' | 'EMERGENCY_CONTACTS' | 'BANK_DETAILS' | 'HMO_ENROLMENT'
  | 'DOCUMENT_UPLOAD' | 'POLICY_ACKNOWLEDGEMENT' | 'EQUIPMENT_REQUEST'

export const SELF_SERVICE_TITLES: Record<EmployeeType, Partial<Record<SelfServiceStep, string>>> = {
  NEW: {
    PERSONAL_DETAILS: 'Provide your contact details and address',
    EMERGENCY_CONTACTS: 'Add your emergency contacts',
    BANK_DETAILS: 'Provide your bank and payroll details',
    HMO_ENROLMENT: 'Enrol in health insurance (HMO)',
    DOCUMENT_UPLOAD: 'Review and sign your employment documents',
    POLICY_ACKNOWLEDGEMENT: 'Acknowledge company policies',
    EQUIPMENT_REQUEST: 'Confirm your IT equipment',
  },
  EXISTING: {
    PERSONAL_DETAILS: 'Check your personal and employment details',
    EMERGENCY_CONTACTS: 'Update your emergency contacts',
    BANK_DETAILS: 'Confirm your payroll details',
    POLICY_ACKNOWLEDGEMENT: 'Acknowledge new or updated policies',
    EQUIPMENT_REQUEST: 'Confirm equipment already issued to you',
  },
}

/**
 * Steps the employee completes themselves. Existing staff skip contracts and HMO enrolment,
 * and only confirm payroll when HR says it is needed.
 */
export function selfServiceSteps(type: EmployeeType, opts: { includePayroll?: boolean; includeHealthInsurance?: boolean } = {}): SelfServiceStep[] {
  if (type === 'NEW') {
    // Private health insurance (HMO) enrolment is a Nigerian practice; elsewhere it's not part of onboarding
    const hmo: SelfServiceStep[] = opts.includeHealthInsurance === false ? [] : ['HMO_ENROLMENT']
    return ['PERSONAL_DETAILS', 'EMERGENCY_CONTACTS', 'BANK_DETAILS', ...hmo, 'DOCUMENT_UPLOAD', 'POLICY_ACKNOWLEDGEMENT', 'EQUIPMENT_REQUEST']
  }
  const steps: SelfServiceStep[] = ['PERSONAL_DETAILS', 'EMERGENCY_CONTACTS']
  if (opts.includePayroll) steps.push('BANK_DETAILS')
  steps.push('POLICY_ACKNOWLEDGEMENT', 'EQUIPMENT_REQUEST')
  return steps
}

// ── Building tasks from core + add-on templates (Ayo 1.6) ─────────────────

export interface TemplateItemLike {
  id: string
  stage: string
  category: string | null
  title: string
  daysFromStart: number
  responsibleRole: string | null
  sortOrder: number
  appliesTo?: string | null
  notifyEmployee?: boolean
  actionRequired?: boolean
  acknowledgementRequired?: boolean
}

export interface TemplateLike { id: string; name: string; items: TemplateItemLike[] }

const normTitle = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

/** Probation tasks don't belong to existing staff whose probation is already settled. */
const isProbationItem = (i: TemplateItemLike) => i.stage === 'PROBATION'

export interface PlannedTask {
  templateItemId: string
  sourceTemplateId: string
  title: string
  stage: string
  category: string | null
  responsibleRole: string | null
  assigneeId: string | null
  dueDate: Date
  sortOrder: number
  notifyEmployee: boolean
  actionRequired: boolean
  acknowledgementRequired: boolean
  selfServiceStep: SelfServiceStep | null
}

/**
 * Link an employee-owned template task to the self-service step that fulfils it, so the employee
 * does each thing once (via their invitation link) instead of seeing it twice. Keyword-based so
 * HR can reword titles without breaking the link.
 */
export function selfServiceStepFor(item: { title: string; responsibleRole: string | null }): SelfServiceStep | null {
  if (item.responsibleRole !== 'EMPLOYEE') return null
  const t = item.title.toLowerCase()
  if (/emergency/.test(t)) return 'EMERGENCY_CONTACTS'
  if (/\b(bank|payroll)\b/.test(t)) return 'BANK_DETAILS'
  if (/\b(hmo|health insurance)\b/.test(t)) return 'HMO_ENROLMENT'
  if (/\bpolic(y|ies)\b/.test(t)) return 'POLICY_ACKNOWLEDGEMENT'
  if (/equipment/.test(t)) return 'EQUIPMENT_REQUEST'
  if (/\b(contract|sign)\b/.test(t)) return 'DOCUMENT_UPLOAD'
  if (/\b(personal|residential|contact details|address)\b/.test(t)) return 'PERSONAL_DETAILS'
  return null
}

/**
 * Turn a core template plus add-ons into the assignment's task list.
 * - Items limited to the other employee type are dropped.
 * - EXISTING staff get no probation-stage tasks.
 * - Add-on items whose title matches a core item (or an earlier add-on) are dropped — no duplicates.
 * - Employee-owned tasks are due within the seven-day window (never later than its end);
 *   internal tasks keep their own day offsets.
 */
export function planTasks(args: {
  core: TemplateLike
  addOns?: TemplateLike[]
  employeeType: EmployeeType
  employeeId: string
  startDate: Date
  windowDays?: number
}): PlannedTask[] {
  const { core, addOns = [], employeeType, employeeId, startDate } = args
  const windowEnd = addDays(startDate, normaliseWindowDays(args.windowDays ?? DEFAULT_WINDOW_DAYS))
  const seen = new Set<string>()
  const out: PlannedTask[] = []
  const sources: TemplateLike[] = [core, ...addOns.filter((t) => t.id !== core.id)]
  sources.forEach((tpl, tplIndex) => {
    for (const item of [...tpl.items].sort((a, b) => a.sortOrder - b.sortOrder)) {
      if (!itemApplies(item.appliesTo, employeeType)) continue
      if (employeeType === 'EXISTING' && isProbationItem(item)) continue
      const key = normTitle(item.title)
      if (seen.has(key)) continue
      seen.add(key)
      const isEmployee = item.responsibleRole === 'EMPLOYEE'
      let due = addDays(startDate, item.daysFromStart)
      if (isEmployee && due.getTime() > windowEnd.getTime()) due = windowEnd
      out.push({
        templateItemId: item.id,
        sourceTemplateId: tpl.id,
        title: item.title,
        stage: item.stage,
        category: item.category,
        responsibleRole: item.responsibleRole,
        assigneeId: isEmployee ? employeeId : null,
        dueDate: due,
        sortOrder: tplIndex * 1000 + item.sortOrder,
        notifyEmployee: !!item.notifyEmployee,
        actionRequired: !!item.actionRequired,
        acknowledgementRequired: !!item.acknowledgementRequired,
        selfServiceStep: selfServiceStepFor(item),
      })
    }
  })
  return out
}

/** Who can see a task: employees see only the tasks assigned to them (Ayo 1.4). */
export function visibleToEmployee(task: { assigneeId: string | null }, employeeId: string): boolean {
  return task.assigneeId === employeeId
}

// ── Document statuses (Ayo 1.5) ─────────────────────────────────────────────

export const DOCUMENT_STATUSES = ['ASSIGNED', 'VIEWED', 'ACKNOWLEDGED', 'AWAITING_SIGNATURE', 'COMPLETED'] as const
export const DOCUMENT_STATUS_LABELS: Record<string, string> = {
  ASSIGNED: 'Assigned', VIEWED: 'Viewed', ACKNOWLEDGED: 'Acknowledged', AWAITING_SIGNATURE: 'Awaiting signature', COMPLETED: 'Completed',
  // Older values recorded before the five-status model
  NOT_SENT: 'Not sent', SENT: 'Assigned',
}
export function documentStatusLabel(s: string | null | undefined): string {
  if (!s) return '—'
  return DOCUMENT_STATUS_LABELS[s] ?? s
}

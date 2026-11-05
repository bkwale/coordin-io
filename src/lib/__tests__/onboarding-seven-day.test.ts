import { describe, it, expect } from 'vitest'
import {
  itemApplies, windowState, daysRemaining, reminderDue, missedNotificationDue, extendedDueDate, windowFor,
  selfServiceSteps, planTasks, selfServiceStepFor, normaliseWindowDays, ONBOARDING_CATEGORIES, documentStatusLabel, addDays,
} from '@/lib/onboarding/seven-day'
import { CORE_TEMPLATE, ADDON_TEMPLATES } from '@/lib/onboarding/default-templates'

const D = (s: string) => new Date(s)
const start = D('2026-11-02T09:00:00Z')
const open = { ...windowFor(start, 7), submittedAt: null, verifiedAt: null }

describe('seven-day window', () => {
  it('state moves NOT_STARTED → OPEN → OVERDUE, and submission/verification win', () => {
    expect(windowState({ windowStartAt: null, windowDueAt: null, submittedAt: null, verifiedAt: null })).toBe('NOT_STARTED')
    expect(windowState(open, D('2026-11-05T09:00:00Z'))).toBe('OPEN')
    expect(windowState(open, D('2026-11-10T09:00:00Z'))).toBe('OVERDUE')
    expect(windowState({ ...open, submittedAt: D('2026-11-10T00:00:00Z') }, D('2026-11-12T00:00:00Z'))).toBe('SUBMITTED')
    expect(windowState({ ...open, submittedAt: start, verifiedAt: start })).toBe('VERIFIED')
  })

  it('days remaining rounds up and goes negative when overdue', () => {
    expect(daysRemaining(open, D('2026-11-02T09:00:00Z'))).toBe(7)
    expect(daysRemaining(open, D('2026-11-08T21:00:00Z'))).toBe(1)
    expect(daysRemaining(open, D('2026-11-10T10:00:00Z'))).toBe(-2)
    expect(daysRemaining({ windowDueAt: null })).toBeNull()
  })

  it('reminds on days 3, 5 and 7 — once each, and missed days collapse into one reminder', () => {
    expect(reminderDue({ ...open, remindersSent: [] }, D('2026-11-03T10:00:00Z'))).toBeNull() // day 2
    expect(reminderDue({ ...open, remindersSent: [] }, D('2026-11-04T10:00:00Z'))).toBe(3)
    expect(reminderDue({ ...open, remindersSent: [3] }, D('2026-11-04T12:00:00Z'))).toBeNull()
    expect(reminderDue({ ...open, remindersSent: [3] }, D('2026-11-06T10:00:00Z'))).toBe(5)
    expect(reminderDue({ ...open, remindersSent: [] }, D('2026-11-08T10:00:00Z'))).toBe(7) // cron missed days 3 and 5
    expect(reminderDue({ ...open, remindersSent: [], submittedAt: start }, D('2026-11-08T10:00:00Z'))).toBeNull()
  })

  it('a longer window scales the reminder days', () => {
    const w14 = { ...windowFor(start, 14), submittedAt: null, verifiedAt: null, windowDays: 14, remindersSent: [] }
    expect(reminderDue(w14, D('2026-11-05T10:00:00Z'))).toBeNull() // day 4
    expect(reminderDue(w14, D('2026-11-08T10:00:00Z'))).toBe(6) // day 7 of 14 → scaled day-3 reminder
  })

  it('HR is told once when the window is missed', () => {
    expect(missedNotificationDue(open, D('2026-11-05T00:00:00Z'))).toBe(false)
    expect(missedNotificationDue(open, D('2026-11-10T00:00:00Z'))).toBe(true)
    expect(missedNotificationDue({ ...open, missedNotifiedAt: D('2026-11-10T00:00:00Z') }, D('2026-11-11T00:00:00Z'))).toBe(false)
  })

  it('extending adds days to the later of the current deadline and now', () => {
    const now = D('2026-11-05T00:00:00Z')
    expect(extendedDueDate(open.windowDueAt, 3, now).toISOString()).toBe(addDays(open.windowDueAt, 3).toISOString())
    const late = D('2026-11-20T00:00:00Z')
    expect(extendedDueDate(open.windowDueAt, 3, late).toISOString()).toBe(addDays(late, 3).toISOString())
  })

  it('window length is clamped', () => {
    expect(normaliseWindowDays(undefined)).toBe(7)
    expect(normaliseWindowDays(0)).toBe(1)
    expect(normaliseWindowDays('500')).toBe(60)
  })
})

describe('employee types', () => {
  it('items can target new or existing staff', () => {
    expect(itemApplies('ALL', 'EXISTING')).toBe(true)
    expect(itemApplies(null, 'NEW')).toBe(true)
    expect(itemApplies('NEW', 'EXISTING')).toBe(false)
    expect(itemApplies('EXISTING', 'EXISTING')).toBe(true)
  })

  it('existing staff skip contracts and HMO; payroll only when HR asks', () => {
    expect(selfServiceSteps('NEW')).toHaveLength(7)
    const ex = selfServiceSteps('EXISTING')
    expect(ex).not.toContain('DOCUMENT_UPLOAD')
    expect(ex).not.toContain('HMO_ENROLMENT')
    expect(ex).not.toContain('BANK_DETAILS')
    expect(selfServiceSteps('EXISTING', { includePayroll: true })).toContain('BANK_DETAILS')
  })
})

const tpl = (id: string, items: Array<Partial<{ title: string; stage: string; responsibleRole: string; appliesTo: string; daysFromStart: number }>>) => ({
  id, name: id,
  items: items.map((i, n) => ({ id: `${id}-${n}`, stage: 'DAY_ONE', category: null, title: `t${n}`, daysFromStart: 1, responsibleRole: 'HR', sortOrder: n, appliesTo: 'ALL', ...i })),
})

describe('planTasks', () => {
  const core = tpl('core', [
    { title: 'Sign employment contract', responsibleRole: 'EMPLOYEE', appliesTo: 'NEW', daysFromStart: 3 },
    { title: 'Confirm equipment already issued', responsibleRole: 'EMPLOYEE', appliesTo: 'EXISTING' },
    { title: 'Complete Coordin training', responsibleRole: 'EMPLOYEE', daysFromStart: 20 },
    { title: '90-day review', stage: 'PROBATION', responsibleRole: 'MANAGER', daysFromStart: 90 },
    { title: 'Create accounts', responsibleRole: 'IT', daysFromStart: 30 },
  ])
  const addon = tpl('addon', [{ title: 'Complete  Coordin training!', responsibleRole: 'EMPLOYEE' }, { title: 'CAD standards', responsibleRole: 'MANAGER' }])

  it('new starters get NEW + ALL items, probation included', () => {
    const t = planTasks({ core, employeeType: 'NEW', employeeId: 'e1', startDate: start })
    expect(t.map((x) => x.title)).toEqual(['Sign employment contract', 'Complete Coordin training', '90-day review', 'Create accounts'])
  })

  it('existing staff get no NEW-only items and no probation tasks', () => {
    const t = planTasks({ core, employeeType: 'EXISTING', employeeId: 'e1', startDate: start })
    expect(t.map((x) => x.title)).toEqual(['Confirm equipment already issued', 'Complete Coordin training', 'Create accounts'])
  })

  it('employee tasks are due inside the window; internal tasks keep their own dates', () => {
    const t = planTasks({ core, employeeType: 'NEW', employeeId: 'e1', startDate: start })
    const training = t.find((x) => x.title === 'Complete Coordin training')!
    expect(training.dueDate.toISOString()).toBe(addDays(start, 7).toISOString())
    expect(training.assigneeId).toBe('e1')
    const it_ = t.find((x) => x.title === 'Create accounts')!
    expect(it_.dueDate.toISOString()).toBe(addDays(start, 30).toISOString())
    expect(it_.assigneeId).toBeNull()
  })

  it('add-ons merge in without duplicating core tasks, and record their source', () => {
    const t = planTasks({ core, addOns: [addon], employeeType: 'NEW', employeeId: 'e1', startDate: start })
    expect(t.filter((x) => /coordin training/i.test(x.title))).toHaveLength(1)
    const cad = t.find((x) => x.title === 'CAD standards')!
    expect(cad.sourceTemplateId).toBe('addon')
    expect(cad.sortOrder).toBeGreaterThan(Math.max(...t.filter((x) => x.sourceTemplateId === 'core').map((x) => x.sortOrder)))
  })

  it('links employee tasks to the self-service step that fulfils them', () => {
    expect(selfServiceStepFor({ title: 'Enter emergency contact details', responsibleRole: 'EMPLOYEE' })).toBe('EMERGENCY_CONTACTS')
    expect(selfServiceStepFor({ title: 'Submit bank and payroll details', responsibleRole: 'EMPLOYEE' })).toBe('BANK_DETAILS')
    expect(selfServiceStepFor({ title: 'Review and sign employment contract', responsibleRole: 'EMPLOYEE' })).toBe('DOCUMENT_UPLOAD')
    expect(selfServiceStepFor({ title: 'Verify payroll information', responsibleRole: 'ACCOUNTS' })).toBeNull()
    expect(selfServiceStepFor({ title: 'Complete the Coordin introduction and training', responsibleRole: 'EMPLOYEE' })).toBeNull()
  })
})

describe('standard templates (draft for CWA)', () => {
  it('every core item sits in one of the six categories with a named owner', () => {
    for (const i of CORE_TEMPLATE.items) {
      expect(ONBOARDING_CATEGORIES).toContain(i.category)
      expect(['EMPLOYEE', 'HR', 'MANAGER', 'IT', 'ACCOUNTS']).toContain(i.responsibleRole)
    }
    // Not everything sits with HR (Ayo 1.4)
    expect(new Set(CORE_TEMPLATE.items.map((i) => i.responsibleRole)).size).toBeGreaterThanOrEqual(4)
  })

  it('new-starter employee tasks map onto all seven self-service steps; existing staff never re-sign contracts', () => {
    const steps = new Set(CORE_TEMPLATE.items.filter((i) => i.appliesTo !== 'EXISTING').map((i) => selfServiceStepFor(i)).filter(Boolean))
    for (const s of ['PERSONAL_DETAILS', 'EMERGENCY_CONTACTS', 'BANK_DETAILS', 'DOCUMENT_UPLOAD', 'POLICY_ACKNOWLEDGEMENT', 'EQUIPMENT_REQUEST']) expect(steps).toContain(s)
    const existing = planTasks({ core: { id: 'c', name: 'c', items: CORE_TEMPLATE.items.map((i, n) => ({ ...i, id: `c${n}`, sortOrder: n })) }, employeeType: 'EXISTING', employeeId: 'e', startDate: start })
    expect(existing.some((t) => /contract/i.test(t.title))).toBe(false)
    expect(existing.some((t) => /payroll|bank/i.test(t.title))).toBe(false)
  })

  it('five role add-ons, none duplicating a core title', () => {
    expect(ADDON_TEMPLATES).toHaveLength(5)
    const core = new Set(CORE_TEMPLATE.items.map((i) => i.title.toLowerCase()))
    for (const a of ADDON_TEMPLATES) for (const i of a.items) expect(core.has(i.title.toLowerCase())).toBe(false)
  })

  it('document status labels cover the five-status model and older values', () => {
    expect(documentStatusLabel('AWAITING_SIGNATURE')).toBe('Awaiting signature')
    expect(documentStatusLabel('SENT')).toBe('Assigned')
    expect(documentStatusLabel(null)).toBe('—')
  })
})

import { taskDisplayStatus } from '@/lib/onboarding/stages'
describe('one status badge per task', () => {
  const now = new Date('2026-11-05T12:00:00Z')
  it('overdue replaces pending / in progress; done never shows overdue', () => {
    expect(taskDisplayStatus('PENDING', '2026-10-23', now)).toEqual({ key: 'OVERDUE', label: 'Overdue' })
    expect(taskDisplayStatus('IN_PROGRESS', '2026-10-27', now).key).toBe('OVERDUE')
    expect(taskDisplayStatus('PENDING', '2026-11-06', now)).toEqual({ key: 'PENDING', label: 'Pending' })
    expect(taskDisplayStatus('PENDING', '2026-11-05', now).key).toBe('PENDING') // due today is not late
    expect(taskDisplayStatus('COMPLETED', '2026-10-01', now).label).toBe('Completed')
    expect(taskDisplayStatus('WAIVED', '2026-10-01', now).label).toBe('Waived')
    expect(taskDisplayStatus('IN_PROGRESS', null, now).label).toBe('In progress')
  })
})

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createMockProfile, createMockRequest } from '../helpers/test-utils'

const ctx = vi.hoisted(() => {
  const m = () => ({
    findMany: vi.fn().mockResolvedValue([]), findFirst: vi.fn().mockResolvedValue(null), findUnique: vi.fn().mockResolvedValue(null),
    updateMany: vi.fn().mockResolvedValue({ count: 1 }), update: vi.fn().mockResolvedValue({}), create: vi.fn().mockResolvedValue({ id: 'new-1' }),
    createMany: vi.fn().mockResolvedValue({ count: 0 }), count: vi.fn().mockResolvedValue(0), upsert: vi.fn().mockResolvedValue({}),
  })
  const prisma: any = { onboardingAssignment: m(), onboardingTask: m(), onboardingSelfServiceToken: m(), onboardingTemplate: m(), profile: m(), probationReview: m(), employeeProfile: m() }
  prisma.$transaction = vi.fn(async (fn: any) => fn(prisma))
  return { prisma, profileRef: { current: null as any }, notify: vi.fn().mockResolvedValue({}), audit: vi.fn().mockResolvedValue(undefined) }
})
vi.mock('@/lib/prisma-modules', () => ({ modulesPrisma: ctx.prisma }))
vi.mock('@/lib/prisma', () => ({ prisma: ctx.prisma }))
vi.mock('@/lib/audit', () => ({ recordAuditEvent: (...a: unknown[]) => ctx.audit(...a) }))
vi.mock('@/lib/org-settings', () => ({ getEffectiveProbationMonths: vi.fn().mockResolvedValue(3) }))
vi.mock('@/lib/notifications', () => ({ createNotification: (...a: unknown[]) => ctx.notify(...a), NOTIFICATION_EVENTS: { ONBOARDING_TASK_DUE: 'due', ONBOARDING_TASK_ASSIGNED: 'assigned' } }))
vi.mock('@/lib/with-auth', () => ({
  withAuth: (handler: any) => async (req: any) => {
    try { return await handler(req, { authUserId: 'a', profile: ctx.profileRef.current }) }
    catch (err: any) { return new Response(JSON.stringify({ error: err.message }), { status: err?.statusCode ?? 500 }) }
  },
}))
import { POST as WINDOW } from '@/app/api/onboarding/assignments/[assignmentId]/window/route'
import { POST as ASSIGN } from '@/app/api/onboarding/assignments/route'
import { runOnboardingReminders } from '@/lib/onboarding/window-service'

const P = ctx.prisma
const as = (id: string, orgPermission = 'MEMBER') => { ctx.profileRef.current = createMockProfile({ id, organisationId: 'org-1', orgPermission }) }
const updatedAt = new Date('2026-11-05T10:00:00Z')
const assignment = (over: Record<string, unknown> = {}) => ({
  id: 'as-1', profileId: 'emp-1', organisationId: 'org-1', windowDays: 7, windowStartAt: null, windowDueAt: null,
  submittedAt: null, verifiedAt: null, updatedAt, ...over,
})
const win = (body: Record<string, unknown>) => WINDOW(createMockRequest({ method: 'POST', url: 'http://localhost/api/onboarding/assignments/as-1/window', body }))

describe('onboarding window route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    P.onboardingAssignment.findFirst.mockResolvedValue(assignment())
    P.onboardingAssignment.findUnique.mockResolvedValue(assignment())
    P.onboardingAssignment.updateMany.mockResolvedValue({ count: 1 })
    P.onboardingTask.findMany.mockResolvedValue([])
  })

  it('only HR can start, extend or verify', async () => {
    as('mgr-1', 'MANAGER')
    expect((await win({ action: 'start' })).status).toBe(403)
    expect((await win({ action: 'verify' })).status).toBe(403)
    expect(P.onboardingAssignment.updateMany).not.toHaveBeenCalled()
  })

  it('HR starts the seven-day window and the employee is told the deadline', async () => {
    as('hr-1', 'HR')
    const res = await win({ action: 'start', startDate: '2026-11-06T09:00:00.000Z' })
    expect(res.status).toBe(200)
    const data = P.onboardingAssignment.updateMany.mock.calls[0][0].data
    expect(data.windowStartAt.toISOString()).toBe('2026-11-06T09:00:00.000Z')
    expect(data.windowDueAt.toISOString()).toBe('2026-11-13T09:00:00.000Z')
    expect(P.onboardingAssignment.updateMany.mock.calls[0][0].where).toEqual({ id: 'as-1', updatedAt })
    expect(ctx.notify.mock.calls[0][0].profileId).toBe('emp-1')
  })

  it('extend needs a started window; then moves the deadline, re-dates open employee tasks and the invite link', async () => {
    as('hr-1', 'HR')
    expect((await win({ action: 'extend', days: 3 })).status).toBe(409)
    P.onboardingAssignment.findFirst.mockResolvedValue(assignment({ windowStartAt: new Date('2026-11-01'), windowDueAt: new Date('2026-11-08T00:00:00Z') }))
    const res = await win({ action: 'extend', days: 3 })
    expect(res.status).toBe(200)
    const due = P.onboardingAssignment.updateMany.mock.calls[0][0].data.windowDueAt as Date
    expect(due.getTime()).toBeGreaterThan(new Date('2026-11-08T00:00:00Z').getTime())
    expect(P.onboardingTask.updateMany.mock.calls[0][0].where).toMatchObject({ assignmentId: 'as-1', assigneeId: 'emp-1' })
    expect(P.onboardingSelfServiceToken.updateMany.mock.calls[0][0].data).toEqual({ expiresAt: due })
  })

  it('the employee can submit only when their own tasks are done', async () => {
    as('emp-1')
    P.onboardingTask.findMany.mockResolvedValue([{ title: 'Enter emergency contact details', category: 'Employee Details' }, { title: 'Submit onboarding', category: 'Final Verification' }])
    const blocked = await win({ action: 'submit' })
    expect(blocked.status).toBe(400)
    expect((await blocked.json()).error).toMatch(/emergency contact/)
    P.onboardingTask.findMany.mockResolvedValue([{ title: 'Submit onboarding', category: 'Final Verification' }])
    P.profile.findMany.mockResolvedValue([{ id: 'hr-1' }])
    const ok = await win({ action: 'submit' })
    expect(ok.status).toBe(200)
    expect(P.onboardingAssignment.updateMany.mock.calls[0][0].data.submittedAt).toBeInstanceOf(Date)
    expect(ctx.notify.mock.calls[0][0].profileId).toBe('hr-1')
  })

  it('another employee cannot submit someone else’s onboarding', async () => {
    as('emp-2')
    expect((await win({ action: 'submit' })).status).toBe(403)
  })

  it('HR verifies only after submission; nobody verifies their own', async () => {
    as('hr-1', 'HR')
    expect((await win({ action: 'verify' })).status).toBe(409)
    P.onboardingAssignment.findFirst.mockResolvedValue(assignment({ submittedAt: new Date() }))
    const res = await win({ action: 'verify' })
    expect(res.status).toBe(200)
    expect(P.onboardingAssignment.updateMany.mock.calls[0][0].data).toMatchObject({ verifiedById: 'hr-1' })
    P.onboardingAssignment.findFirst.mockResolvedValue(assignment({ profileId: 'hr-1', submittedAt: new Date() }))
    expect((await win({ action: 'verify' })).status).toBe(403)
  })

  it('a concurrent change is refused rather than overwritten', async () => {
    as('hr-1', 'HR')
    P.onboardingAssignment.updateMany.mockResolvedValue({ count: 0 })
    expect((await win({ action: 'start' })).status).toBe(409)
  })
})

describe('reminder run', () => {
  beforeEach(() => { vi.clearAllMocks(); P.onboardingAssignment.updateMany.mockResolvedValue({ count: 1 }) })
  const row = (startIso: string, over: Record<string, unknown> = {}) => {
    const s = new Date(startIso)
    return { id: 'as-1', organisationId: 'org-1', profileId: 'emp-1', windowStartAt: s, windowDueAt: new Date(s.getTime() + 7 * 864e5), windowDays: 7, submittedAt: null, verifiedAt: null, remindersSent: [], missedNotifiedAt: null, ...over }
  }

  it('sends the day-3 reminder once (claimed before sending)', async () => {
    P.onboardingAssignment.findMany.mockResolvedValue([row('2026-11-02T09:00:00Z')])
    const r = await runOnboardingReminders(new Date('2026-11-04T10:00:00Z'))
    expect(r).toMatchObject({ checked: 1, reminded: 1, missed: 0 })
    expect(P.onboardingAssignment.updateMany.mock.calls[0][0]).toMatchObject({ data: { remindersSent: { push: 3 } } })
    expect(ctx.notify.mock.calls[0][0].profileId).toBe('emp-1')
  })

  it('does not double-send when another run already claimed it', async () => {
    P.onboardingAssignment.findMany.mockResolvedValue([row('2026-11-02T09:00:00Z')])
    P.onboardingAssignment.updateMany.mockResolvedValue({ count: 0 })
    const r = await runOnboardingReminders(new Date('2026-11-04T10:00:00Z'))
    expect(r.reminded).toBe(0)
    expect(ctx.notify).not.toHaveBeenCalled()
  })

  it('tells HR once when the window is missed', async () => {
    P.onboardingAssignment.findMany.mockResolvedValue([row('2026-11-01T09:00:00Z', { remindersSent: [3, 5, 7] })])
    P.profile.findMany.mockResolvedValue([{ id: 'hr-1' }, { id: 'hr-2' }])
    const r = await runOnboardingReminders(new Date('2026-11-09T10:00:00Z'))
    expect(r.missed).toBe(1)
    expect(ctx.notify.mock.calls.map((c) => c[0].profileId)).toEqual(['hr-1', 'hr-2'])
    expect(JSON.stringify(ctx.notify.mock.calls)).not.toMatch(/emp-1/)
  })
})

describe('assignment creation', () => {
  const core = { id: 'core', name: 'Core', organisationId: 'org-1', isActive: true, items: [
    { id: 'i1', stage: 'BEFORE_START', category: 'Employment Documents', title: 'Review and sign employment contract', daysFromStart: 5, responsibleRole: 'EMPLOYEE', sortOrder: 0, appliesTo: 'NEW' },
    { id: 'i2', stage: 'DAY_ONE', category: 'IT & Equipment', title: 'Confirm equipment already issued to you', daysFromStart: 5, responsibleRole: 'EMPLOYEE', sortOrder: 1, appliesTo: 'EXISTING' },
    { id: 'i3', stage: 'PROBATION', category: null, title: '90-day check-in', daysFromStart: 90, responsibleRole: 'MANAGER', sortOrder: 2, appliesTo: 'ALL' },
  ] }
  const assign = (body: Record<string, unknown>) => ASSIGN(createMockRequest({ method: 'POST', url: 'http://localhost/api/onboarding/assignments', body }))
  beforeEach(() => {
    vi.clearAllMocks()
    as('hr-1', 'HR')
    P.onboardingTemplate.findFirst.mockResolvedValue(core)
    P.onboardingTemplate.findMany.mockResolvedValue([])
    P.profile.findUnique.mockResolvedValue({ id: 'emp-1', organisationId: 'org-1', fullName: 'Ada' })
    P.onboardingAssignment.findFirst.mockResolvedValue(null)
    P.onboardingAssignment.create.mockResolvedValue({ id: 'as-1' })
    P.onboardingAssignment.findUnique.mockResolvedValue({ id: 'as-1', tasks: [] })
    P.probationReview.count.mockResolvedValue(0)
    P.employeeProfile.findUnique.mockResolvedValue(null)
  })

  it('existing employee: existing-only tasks, no probation tasks, no probation reviews', async () => {
    const res = await assign({ templateId: 'core', profileId: 'emp-1', startDate: '2026-11-09', employeeType: 'EXISTING' })
    expect(res.status).toBe(201)
    expect(P.onboardingAssignment.create.mock.calls[0][0].data).toMatchObject({ employeeType: 'EXISTING', windowDays: 7 })
    const titles = P.onboardingTask.createMany.mock.calls[0][0].data.map((t: { title: string }) => t.title)
    expect(titles).toEqual(['Confirm equipment already issued to you'])
    expect(P.probationReview.create).not.toHaveBeenCalled()
    expect(P.employeeProfile.upsert).not.toHaveBeenCalled()
  })

  it('new employee: contract + probation tasks, self-service link set, probation reviews generated', async () => {
    const res = await assign({ templateId: 'core', profileId: 'emp-1', startDate: '2026-11-09' })
    expect(res.status).toBe(201)
    const tasks = P.onboardingTask.createMany.mock.calls[0][0].data
    expect(tasks.map((t: { title: string }) => t.title)).toEqual(['Review and sign employment contract', '90-day check-in'])
    expect(tasks[0]).toMatchObject({ assigneeId: 'emp-1', responsibleRole: 'EMPLOYEE', selfServiceStep: 'DOCUMENT_UPLOAD', sourceTemplateId: 'core' })
    expect(P.probationReview.create).toHaveBeenCalled()
  })

  it('rejects an unknown employee type and missing add-ons', async () => {
    expect((await assign({ templateId: 'core', profileId: 'emp-1', startDate: '2026-11-09', employeeType: 'CONTRACTOR' })).status).toBe(400)
    expect((await assign({ templateId: 'core', profileId: 'emp-1', startDate: '2026-11-09', addOnTemplateIds: ['nope'] })).status).toBe(404)
    expect(P.onboardingAssignment.create).not.toHaveBeenCalled()
  })
})

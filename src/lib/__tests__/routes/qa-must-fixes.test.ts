import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createMockProfile, createMockRequest } from '../helpers/test-utils'
import { canView } from '@/lib/staffing/probation-workflow'

const ctx = vi.hoisted(() => {
  const m = () => ({
    findMany: vi.fn().mockResolvedValue([]), findFirst: vi.fn().mockResolvedValue(null), findUnique: vi.fn().mockResolvedValue(null),
    updateMany: vi.fn().mockResolvedValue({ count: 1 }), update: vi.fn().mockResolvedValue({}), count: vi.fn().mockResolvedValue(0),
    create: vi.fn().mockResolvedValue({}), upsert: vi.fn().mockResolvedValue({}),
  })
  const prisma: any = { policyDocument: m(), policyAcknowledgement: m(), onboardingTask: m(), onboardingSelfServiceToken: m(), onboardingAssignment: m(), profile: m(), employeeProfile: m(), bankDetail: m(), projectMembership: m() }
  prisma.$transaction = vi.fn(async (fn: any) => fn(prisma))
  return { prisma, profileRef: { current: null as any }, submitted: vi.fn().mockResolvedValue(undefined), membership: vi.fn() }
})
vi.mock('@/lib/prisma-modules', () => ({ modulesPrisma: ctx.prisma }))
vi.mock('@/lib/prisma', () => ({ prisma: ctx.prisma }))
vi.mock('@/lib/audit', () => ({ recordAuditEvent: vi.fn().mockResolvedValue(undefined) }))
vi.mock('@/lib/notifications', () => ({ createNotification: vi.fn().mockResolvedValue({}), NOTIFICATION_EVENTS: { ONBOARDING_TASK_ASSIGNED: 'a', ONBOARDING_TASK_DUE: 'd' } }))
vi.mock('@/lib/rate-limit', () => ({ checkRateLimit: vi.fn().mockResolvedValue(null), RateLimitPresets: { auth: {}, api: {} } }))
vi.mock('@/lib/onboarding/window-service', () => ({ markSubmittedFromSelfService: (...a: unknown[]) => ctx.submitted(...a) }))
vi.mock('@/lib/permissions', async (orig) => ({ ...(await orig<any>()), getProjectMembership: (...a: unknown[]) => ctx.membership(...a) }))
vi.mock('@/lib/with-auth', () => ({
  withAuth: (handler: any) => async (req: any) => {
    try { return await handler(req, { authUserId: 'a', profile: ctx.profileRef.current }) }
    catch (err: any) { return new Response(JSON.stringify({ error: err.message }), { status: err?.statusCode ?? 500 }) }
  },
}))
import { POST as STEP } from '@/app/api/onboarding/self-service/steps/route'
import { PATCH as TASKS } from '@/app/api/onboarding/assignments/[assignmentId]/tasks/route'
import { assertDeliveryWrite, canApproveDelivery } from '@/lib/delivery/access'

const P = ctx.prisma
const token = 'a'.repeat(64)
const as = (id: string, orgPermission = 'MEMBER') => { ctx.profileRef.current = createMockProfile({ id, organisationId: 'org-1', orgPermission }) }

describe('QA must-fix 1+2: self-service steps', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    P.onboardingSelfServiceToken.findUnique.mockResolvedValue({ id: 't1', profileId: 'emp-1', organisationId: 'org-1', assignmentId: 'as-1', expiresAt: new Date(Date.now() + 864e5), revokedAt: null, completedAt: null })
    P.onboardingTask.findFirst.mockResolvedValue({ id: 'task-1', status: 'PENDING' })
  })
  const step = () => STEP(createMockRequest({ method: 'POST', url: 'http://localhost/api/onboarding/self-service/steps', body: { token, step: 'POLICY_ACKNOWLEDGEMENT', data: { acknowledgedPolicies: ['pol-1'] } } }))

  it('looks up only open tasks on this invitation’s assignment', async () => {
    await step()
    expect(P.onboardingTask.findFirst.mock.calls[0][0].where).toMatchObject({ assigneeId: 'emp-1', assignmentId: 'as-1', selfServiceStep: 'POLICY_ACKNOWLEDGEMENT', status: { notIn: ['COMPLETED', 'WAIVED'] } })
  })

  it('finishing the last step records the submission against the assignment', async () => {
    P.onboardingTask.count.mockResolvedValue(0)
    const res = await step()
    expect(res.status).toBe(200)
    expect(P.onboardingTask.count.mock.calls.at(-1)[0].where).toMatchObject({ assignmentId: 'as-1' })
    expect(ctx.submitted).toHaveBeenCalledWith('as-1')
  })

  it('an already-completed copy gives 409, not a stuck 404', async () => {
    P.onboardingTask.findFirst.mockResolvedValue(null)
    P.onboardingTask.count.mockResolvedValue(1)
    expect((await step()).status).toBe(409)
  })
})

describe('QA must-fix 3: probation visibility', () => {
  it('the subject never sees an unfinished review, even as HR or manager', () => {
    expect(canView('SUBMITTED', { isHR: true, isLineManager: false, isSubject: true })).toBe(false)
    expect(canView('DRAFT', { isHR: false, isLineManager: true, isSubject: true })).toBe(false)
    expect(canView('FINALISED', { isHR: true, isLineManager: false, isSubject: true })).toBe(true)
    expect(canView('DRAFT', { isHR: true, isLineManager: false, isSubject: false })).toBe(true)
  })
})

describe('QA must-fix 6: delivery writes', () => {
  beforeEach(() => vi.clearAllMocks())
  it('HR/Finance with no project membership cannot record gate decisions', async () => {
    ctx.membership.mockResolvedValue(null)
    await expect(assertDeliveryWrite({ profile: { id: 'hr-1', orgPermission: 'HR' }, projectId: 'p1', membership: null }, 'PROJECT_LEAD')).rejects.toThrow(/project lead/)
    await expect(assertDeliveryWrite({ profile: { id: 'f-1', orgPermission: 'FINANCE' }, projectId: 'p1', membership: null }, 'ARCHITECT')).rejects.toThrow()
  })
  it('org admins and project leads can; only DESIGN_LEAD+ members approve', async () => {
    ctx.membership.mockResolvedValue(null)
    const admin = await assertDeliveryWrite({ profile: { id: 'ad', orgPermission: 'ADMIN' }, projectId: 'p1', membership: null }, 'PROJECT_LEAD')
    expect(canApproveDelivery(admin)).toBe(false)
    const lead = await assertDeliveryWrite({ profile: { id: 'pl', orgPermission: 'MEMBER' }, projectId: 'p1', membership: { projectRole: 'PROJECT_LEAD' as any, removedAt: null } }, 'PROJECT_LEAD')
    expect(canApproveDelivery(lead)).toBe(true)
    const arch = await assertDeliveryWrite({ profile: { id: 'ar', orgPermission: 'MEMBER' }, projectId: 'p1', membership: { projectRole: 'ARCHITECT' as any, removedAt: null } }, 'ARCHITECT')
    expect(canApproveDelivery(arch)).toBe(false)
  })
  it('HR who is also a project member keeps their project rights', async () => {
    ctx.membership.mockResolvedValue({ projectRole: 'PROJECT_LEAD', removedAt: null })
    await expect(assertDeliveryWrite({ profile: { id: 'hr-1', orgPermission: 'HR' }, projectId: 'p1', membership: null }, 'PROJECT_LEAD')).resolves.toBeTruthy()
  })
})

describe('QA must-fix 7 + should-fix 8: onboarding task rights', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    P.onboardingAssignment.findFirst.mockResolvedValue({ id: 'as-1', profileId: 'hr-1', organisationId: 'org-1' })
    P.onboardingTask.findFirst.mockResolvedValue({ id: 'k1', assigneeId: null, status: 'PENDING', selfServiceStep: null, templateItem: null, title: 'HR check' })
  })
  const patch = (body: Record<string, unknown>) => TASKS(createMockRequest({ method: 'PATCH', url: 'http://localhost/api/onboarding/assignments/as-1/tasks', body: { taskId: 'k1', ...body } }))

  it('HR cannot complete or approve HR tasks on their own onboarding', async () => {
    as('hr-1', 'HR')
    expect((await patch({ status: 'COMPLETED' })).status).toBe(403)
    expect(P.onboardingTask.update).not.toHaveBeenCalled()
  })

  it('a manager who is not the line manager cannot edit someone else’s onboarding', async () => {
    as('mgr-9', 'MANAGER')
    P.profile.findUnique.mockResolvedValue({ managerId: 'mgr-1' })
    expect((await patch({ status: 'COMPLETED' })).status).toBe(403)
  })

  it('the employee cannot mark a document signed or skip a form-backed step', async () => {
    as('hr-1', 'MEMBER')
    P.onboardingTask.findFirst.mockResolvedValue({ id: 'k1', assigneeId: 'hr-1', status: 'PENDING', selfServiceStep: 'BANK_DETAILS', templateItem: null, title: 'Bank' })
    expect((await patch({ status: 'COMPLETED' })).status).toBe(403)
    P.onboardingTask.findFirst.mockResolvedValue({ id: 'k1', assigneeId: 'hr-1', status: 'PENDING', selfServiceStep: null, templateItem: null, title: 'Contract' })
    expect((await patch({ documentStatus: 'COMPLETED' })).status).toBe(403)
  })
})

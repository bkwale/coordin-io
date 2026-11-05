import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createMockProfile, createMockRequest } from '../helpers/test-utils'
import { ASSESSMENT_CRITERIA } from '@/lib/staffing/probation-workflow'

const ctx = vi.hoisted(() => {
  const m = () => ({ findMany: vi.fn().mockResolvedValue([]), findUnique: vi.fn().mockResolvedValue(null), updateMany: vi.fn().mockResolvedValue({ count: 1 }), upsert: vi.fn().mockResolvedValue({}), count: vi.fn().mockResolvedValue(0) })
  const prisma: any = { probationReview: m(), profile: m(), employeeProfile: m() }
  prisma.$transaction = vi.fn(async (fn: any) => fn(prisma))
  return { prisma, profileRef: { current: null as any }, notify: vi.fn().mockResolvedValue({}) }
})
vi.mock('@/lib/prisma-modules', () => ({ modulesPrisma: ctx.prisma }))
vi.mock('@/lib/prisma', () => ({ prisma: ctx.prisma }))
vi.mock('@/lib/audit', () => ({ recordAuditEvent: vi.fn().mockResolvedValue(undefined) }))
vi.mock('@/lib/notifications', () => ({ createNotification: (...a: unknown[]) => ctx.notify(...a), NOTIFICATION_EVENTS: { PROBATION_REVIEW_DUE: 'due', PROBATION_REVIEW_SCHEDULED: 'sched' } }))
vi.mock('@/lib/with-auth', () => ({
  withAuth: (handler: any) => async (req: any) => {
    try { return await handler(req, { authUserId: 'a', profile: ctx.profileRef.current }) }
    catch (err: any) { return new Response(JSON.stringify({ error: err.message }), { status: err?.statusCode ?? 500 }) }
  },
}))
import { POST } from '@/app/api/staffing/probation/[id]/workflow/route'

const P = ctx.prisma
const url = 'http://localhost/api/staffing/probation/rev-1/workflow'
const full = { criteria: ASSESSMENT_CRITERIA.map((c) => ({ key: c.key, score: 4 })) }
const review = (over: Record<string, unknown> = {}) => ({
  id: 'rev-1', profileId: 'emp-1', reviewType: 'final', scheduledDate: new Date('2026-12-01'), workflowStatus: 'SCHEDULED',
  assessment: null, managerRecommendation: null, reviewerId: null, submittedById: null,
  profile: { id: 'emp-1', fullName: 'Ada', organisationId: 'org-1', managerId: 'mgr-1' }, goals: [], ...over,
})
const call = (body: Record<string, unknown>) => POST(createMockRequest({ method: 'POST', url, body }))

describe('probation workflow route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    P.$transaction.mockImplementation(async (fn: any) => fn(P))
    P.probationReview.updateMany.mockResolvedValue({ count: 1 })
    P.probationReview.findUnique.mockResolvedValue(review())
  })
  const as = (id: string, orgPermission = 'MEMBER') => { ctx.profileRef.current = createMockProfile({ id, organisationId: 'org-1', orgPermission }) }

  it('line manager saves a draft', async () => {
    as('mgr-1')
    const res = await call({ action: 'save', assessment: full, feedback: 'Good start' })
    expect(res.status).toBe(200)
    expect(P.probationReview.updateMany.mock.calls[0][0]).toMatchObject({ where: { id: 'rev-1', workflowStatus: 'SCHEDULED' }, data: { workflowStatus: 'DRAFT', feedback: 'Good start' } })
  })

  it('submit is refused until every area is scored and a recommendation chosen', async () => {
    as('mgr-1')
    const res = await call({ action: 'submit', assessment: { criteria: [{ key: 'quality', score: 3 }] } })
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/Score every area.*recommendation/)
    expect(P.probationReview.updateMany).not.toHaveBeenCalled()
  })

  it('complete submission goes to HR and notifies HR users only', async () => {
    as('mgr-1')
    P.profile.findMany.mockResolvedValue([{ id: 'hr-1' }, { id: 'hr-2' }])
    const res = await call({ action: 'submit', assessment: full, managerRecommendation: 'pass' })
    expect(res.status).toBe(200)
    expect(P.probationReview.updateMany.mock.calls[0][0].data).toMatchObject({ workflowStatus: 'SUBMITTED', managerRecommendation: 'Pass', submittedById: 'mgr-1' })
    expect(ctx.notify).toHaveBeenCalledTimes(2)
    expect(JSON.stringify(ctx.notify.mock.calls)).not.toMatch(/score|Pass/) // content-free
  })

  it('HR returns with a reason; a reason is required', async () => {
    as('hr-1', 'HR')
    P.probationReview.findUnique.mockResolvedValue(review({ workflowStatus: 'SUBMITTED', submittedById: 'mgr-1' }))
    expect((await call({ action: 'return' })).status).toBe(400)
    const res = await call({ action: 'return', reason: 'Add evidence for technical ability' })
    expect(res.status).toBe(200)
    expect(P.probationReview.updateMany.mock.calls[0][0].data).toMatchObject({ workflowStatus: 'RETURNED', returnReason: 'Add evidence for technical ability' })
    expect(ctx.notify.mock.calls[0][0].profileId).toBe('mgr-1')
  })

  it('HR finalises the final review with Pass → employee confirmed', async () => {
    as('hr-1', 'HR')
    P.probationReview.findUnique.mockResolvedValue(review({ workflowStatus: 'SUBMITTED' }))
    const res = await call({ action: 'finalise', decision: 'Pass' })
    expect(res.status).toBe(200)
    expect(P.probationReview.updateMany.mock.calls[0][0].data).toMatchObject({ workflowStatus: 'FINALISED', hrDecision: 'Pass', outcome: 'Pass' })
    expect(P.employeeProfile.upsert.mock.calls[0][0].update).toEqual({ probationStatus: 'CONFIRMED' })
  })

  it('a manager cannot finalise; HR cannot finalise a draft', async () => {
    as('mgr-1')
    P.probationReview.findUnique.mockResolvedValue(review({ workflowStatus: 'SUBMITTED' }))
    expect((await call({ action: 'finalise', decision: 'Pass' })).status).toBe(409)
    as('hr-1', 'HR')
    P.probationReview.findUnique.mockResolvedValue(review({ workflowStatus: 'DRAFT' }))
    expect((await call({ action: 'finalise', decision: 'Pass' })).status).toBe(409)
  })

  it('the employee cannot see or act on their own unfinished review; strangers get 404', async () => {
    as('emp-1')
    expect((await call({ action: 'save' })).status).toBe(404)
    as('someone-else')
    expect((await call({ action: 'save' })).status).toBe(404)
  })

  it('reviews from another organisation are invisible', async () => {
    as('mgr-1')
    P.probationReview.findUnique.mockResolvedValue(review({ profile: { id: 'emp-1', fullName: 'Ada', organisationId: 'org-2', managerId: 'mgr-1' } }))
    expect((await call({ action: 'save' })).status).toBe(404)
  })

  it('concurrent change is detected (optimistic lock)', async () => {
    as('mgr-1')
    P.probationReview.updateMany.mockResolvedValue({ count: 0 })
    expect((await call({ action: 'save', assessment: full })).status).toBe(409)
  })
})

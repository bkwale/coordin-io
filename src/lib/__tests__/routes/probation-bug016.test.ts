import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createMockProfile, createMockRequest } from '../helpers/test-utils'
import {
  probationIssues, isInProbation, isProbationClosed, normaliseOutcome, isFinalReview,
  statusAfterFinalReview, isValidProbationStatus, notClosedProfileFilter,
} from '@/lib/staffing/probation'

const ctx = vi.hoisted(() => {
  const m = () => ({
    findMany: vi.fn().mockResolvedValue([]),
    findUnique: vi.fn().mockResolvedValue(null),
    findFirst: vi.fn().mockResolvedValue(null),
    create: vi.fn().mockImplementation(({ data }: any) => Promise.resolve({ id: 'new-id', ...data })),
    update: vi.fn().mockImplementation(({ data }: any) => Promise.resolve({ id: 'rev-1', ...data })),
    upsert: vi.fn().mockImplementation(({ create }: any) => Promise.resolve({ id: 'ep-1', ...create })),
    count: vi.fn().mockResolvedValue(0),
  })
  const prisma: any = { profile: m(), probationReview: m(), employeeProfile: m() }
  prisma.$transaction = vi.fn(async (fn: any) => fn(prisma))
  return { prisma, profileRef: { current: null as any } }
})

vi.mock('@/lib/prisma-modules', () => ({ modulesPrisma: ctx.prisma }))
vi.mock('@/lib/prisma', () => ({ prisma: ctx.prisma }))
vi.mock('@/lib/audit', () => ({ recordAuditEvent: vi.fn().mockResolvedValue(undefined) }))
vi.mock('@/lib/notifications', () => ({ createNotification: vi.fn().mockResolvedValue(undefined), NOTIFICATION_EVENTS: {} }))
vi.mock('@/lib/with-auth', () => ({
  withAuth: (handler: any) => async (req: any) => {
    try { return await handler(req, { authUserId: 'auth-1', profile: ctx.profileRef.current }) }
    catch (err: any) {
      return new Response(JSON.stringify({ error: err.message, code: err.code }), { status: err?.statusCode ?? 500 })
    }
  },
}))

import { GET as getProbation, POST as postProbation } from '@/app/api/staffing/probation/route'
import { PATCH as patchReview } from '@/app/api/staffing/probation/[id]/route'

const P = ctx.prisma

describe('probation module (BUG-016)', () => {
  const now = new Date('2026-11-05')
  it('one definition: PROBATION and EXTENDED are in probation; closed statuses are not', () => {
    expect(isInProbation('PROBATION')).toBe(true)
    expect(isInProbation('EXTENDED')).toBe(true)
    for (const s of ['CONFIRMED', 'COMPLETED', 'HISTORIC', 'NOT_APPLICABLE']) {
      expect(isInProbation(s)).toBe(false)
      expect(isProbationClosed(s)).toBe(true)
    }
    expect(isInProbation(null)).toBe(false)
  })
  it('accepts the new historic and not-applicable statuses, rejects junk', () => {
    expect(isValidProbationStatus('HISTORIC')).toBe(true)
    expect(isValidProbationStatus('NOT_APPLICABLE')).toBe(true)
    expect(isValidProbationStatus('probation')).toBe(false)
  })
  it('flags an open probation whose end date has passed', () => {
    expect(probationIssues({ probationStatus: 'PROBATION', probationStartDate: '2026-01-01', probationEndDate: '2026-04-01' }, now)).toContain('END_DATE_PASSED')
  })
  it('does not flag a passed end date once probation is closed', () => {
    expect(probationIssues({ probationStatus: 'HISTORIC', probationStartDate: '2026-01-01', probationEndDate: '2026-04-01' }, now)).toEqual([])
  })
  it('flags probation that starts before employment', () => {
    expect(probationIssues({ probationStatus: 'PROBATION', probationStartDate: '2025-12-01', probationEndDate: '2027-03-01', employmentStartDate: '2026-02-01' }, now)).toEqual(['STARTS_BEFORE_EMPLOYMENT'])
  })
  it('flags end before start and missing dates', () => {
    expect(probationIssues({ probationStatus: 'COMPLETED', probationStartDate: '2026-05-01', probationEndDate: '2026-04-01' }, now)).toEqual(['END_BEFORE_START'])
    expect(probationIssues({ probationStatus: 'PROBATION', probationStartDate: null, probationEndDate: null }, now)).toEqual(['MISSING_DATES'])
  })
  it('normalises outcomes and maps final outcomes to status', () => {
    expect(normaliseOutcome('PASS')).toBe('Pass')
    expect(normaliseOutcome('extended')).toBe('Extend')
    expect(normaliseOutcome('maybe')).toBeNull()
    expect(isFinalReview('final')).toBe(true)
    expect(isFinalReview('End-of-Probation')).toBe(true)
    expect(isFinalReview('30-day')).toBe(false)
    expect(statusAfterFinalReview('Pass')).toBe('CONFIRMED')
    expect(statusAfterFinalReview('Extend')).toBe('EXTENDED')
    expect(statusAfterFinalReview('Fail')).toBeNull()
  })
  it('pending filter excludes closed employees but keeps those without a record', () => {
    const f = notClosedProfileFilter('org-1') as any
    expect(f.organisationId).toBe('org-1')
    expect(f.NOT.employeeProfile.is.probationStatus.in).toEqual(['CONFIRMED', 'COMPLETED', 'HISTORIC', 'NOT_APPLICABLE'])
  })
})

describe('probation routes (BUG-016)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    P.$transaction.mockImplementation(async (fn: any) => fn(P))
    ctx.profileRef.current = createMockProfile({ orgPermission: 'HR' })
  })

  it('pending list excludes reviews for closed probations', async () => {
    const res = await getProbation(createMockRequest({ method: 'GET', url: 'http://localhost/api/staffing/probation?pending=true' }))
    expect(res.status).toBe(200)
    const where = P.probationReview.findMany.mock.calls[0][0].where
    expect(where.completedDate).toBeNull()
    expect(where.profile.NOT.employeeProfile.is.probationStatus.in).toContain('HISTORIC')
  })

  it('HR list returns employees by status and flags records to fix', async () => {
    P.employeeProfile.findMany.mockResolvedValue([
      { profileId: 'a', probationStatus: 'PROBATION', probationStartDate: new Date('2026-01-01'), probationEndDate: new Date('2026-04-01'), probationLength: 3, profile: { fullName: 'Ada', jobTitle: null, startDate: new Date('2026-01-01') } },
      { profileId: 'b', probationStatus: 'CONFIRMED', probationStartDate: new Date('2025-01-01'), probationEndDate: new Date('2025-04-01'), probationLength: 3, profile: { fullName: 'Ben', jobTitle: null, startDate: new Date('2025-01-01') } },
      { profileId: 'c', probationStatus: 'PROBATION', probationStartDate: new Date('2026-10-01'), probationEndDate: new Date('2027-04-01'), probationLength: 6, profile: { fullName: 'Cleo', jobTitle: null, startDate: new Date('2026-10-01') } },
    ])
    const res = await getProbation(createMockRequest({ method: 'GET', url: 'http://localhost/api/staffing/probation?pending=true' }))
    const body = await res.json()
    const emps = body.data.employees
    expect(emps.map((e: any) => e.profileId)).toEqual(['a', 'c'])
    expect(emps[0].issues.map((i: any) => i.code)).toEqual(['END_DATE_PASSED'])
    expect(emps[1].issues).toEqual([])
  })

  it('refuses a second open review of the same type (duplicate guard)', async () => {
    P.profile.findUnique.mockResolvedValue({ organisationId: ctx.profileRef.current.organisationId })
    P.probationReview.findFirst.mockResolvedValue({ id: 'old', scheduledDate: new Date('2026-12-01') })
    const res = await postProbation(createMockRequest({
      method: 'POST', url: 'http://localhost/api/staffing/probation',
      body: { profileId: 'emp-1', reviewType: '30-day', scheduledDate: '2026-12-01' },
    }))
    expect(res.status).toBe(409)
    expect(P.probationReview.create).not.toHaveBeenCalled()
  })

  it('rejects an unknown outcome', async () => {
    P.profile.findUnique.mockResolvedValue({ organisationId: ctx.profileRef.current.organisationId })
    const res = await postProbation(createMockRequest({
      method: 'POST', url: 'http://localhost/api/staffing/probation',
      body: { profileId: 'emp-1', reviewType: '30-day', scheduledDate: '2026-12-01', outcome: 'Maybe' },
    }))
    expect(res.status).toBe(400)
  })

  const existing = (over: Record<string, unknown> = {}) => ({
    id: 'rev-1', profileId: 'emp-1', reviewType: 'final', scheduledDate: new Date('2026-10-16'), completedDate: null, outcome: null,
    profile: { id: 'emp-1', fullName: 'Ada', organisationId: ctx.profileRef.current.organisationId }, ...over,
  })

  it('completing a review requires an outcome', async () => {
    P.probationReview.findUnique.mockResolvedValue(existing())
    const res = await patchReview(createMockRequest({ method: 'PATCH', url: 'http://localhost/api/staffing/probation/rev-1', body: { completedDate: '2026-11-05' } }))
    expect(res.status).toBe(400)
    expect(P.probationReview.update).not.toHaveBeenCalled()
  })

  it('final review Pass completes the review and confirms the employee', async () => {
    P.probationReview.findUnique.mockResolvedValue(existing())
    const res = await patchReview(createMockRequest({ method: 'PATCH', url: 'http://localhost/api/staffing/probation/rev-1', body: { completedDate: '2026-11-05', outcome: 'Pass', feedback: 'Strong start' } }))
    expect(res.status).toBe(200)
    expect(P.probationReview.update.mock.calls[0][0].data).toMatchObject({ outcome: 'Pass', feedback: 'Strong start' })
    expect(P.employeeProfile.upsert.mock.calls[0][0].update).toEqual({ probationStatus: 'CONFIRMED' })
  })

  it('a 30-day review Pass does not change the probation status', async () => {
    P.probationReview.findUnique.mockResolvedValue(existing({ reviewType: '30-day' }))
    P.probationReview.count.mockResolvedValue(2) // later reviews exist
    const res = await patchReview(createMockRequest({ method: 'PATCH', url: 'http://localhost/api/staffing/probation/rev-1', body: { completedDate: '2026-11-05', outcome: 'Pass' } }))
    expect(res.status).toBe(200)
    expect(P.employeeProfile.upsert).not.toHaveBeenCalled()
  })

  it('older records: the last scheduled review (a 90-day on a 3-month probation) is the final decision', async () => {
    P.probationReview.findUnique.mockResolvedValue(existing({ reviewType: '90-day' }))
    P.probationReview.count.mockResolvedValue(0) // nothing scheduled after it
    const res = await patchReview(createMockRequest({ method: 'PATCH', url: 'http://localhost/api/staffing/probation/rev-1', body: { completedDate: '2026-11-05', outcome: 'Pass' } }))
    expect(res.status).toBe(200)
    expect(P.employeeProfile.upsert.mock.calls[0][0].update).toEqual({ probationStatus: 'CONFIRMED' })
  })

  it('final review Fail leaves the status for HR to action', async () => {
    P.probationReview.findUnique.mockResolvedValue(existing())
    const res = await patchReview(createMockRequest({ method: 'PATCH', url: 'http://localhost/api/staffing/probation/rev-1', body: { completedDate: '2026-11-05', outcome: 'Fail' } }))
    expect(res.status).toBe(200)
    expect(P.employeeProfile.upsert).not.toHaveBeenCalled()
  })
})

import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  createMockProfile,
  createAdminProfile,
  createManagerProfile,
  createMockRequest,
} from '../helpers/test-utils'

// ---------------------------------------------------------------------------
// vi.hoisted — values available to vi.mock factories (runs before imports)
// ---------------------------------------------------------------------------

const ctx = vi.hoisted(() => {
  const m = () => ({
    findMany: vi.fn().mockResolvedValue([]),
    findUnique: vi.fn().mockResolvedValue(null),
    findFirst: vi.fn().mockResolvedValue(null),
    create: vi.fn().mockImplementation(({ data }: any) => Promise.resolve({ id: 'mock-id', ...data })),
    update: vi.fn().mockImplementation(({ data }: any) => Promise.resolve({ id: 'mock-id', ...data })),
    delete: vi.fn().mockResolvedValue({ id: 'mock-id' }),
    count: vi.fn().mockResolvedValue(0),
    groupBy: vi.fn().mockResolvedValue([]),
    upsert: vi.fn().mockImplementation(({ create }: any) => Promise.resolve({ id: 'mock-id', ...create })),
    updateMany: vi.fn().mockResolvedValue({ count: 0 }),
    deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
  })

  return {
    prisma: {
      profile: m(),
      project: m(),
      task: m(),
      leaveRequest: m(),
      leaveBalance: m(),
      expenseClaim: m(),
      notification: m(),
      projectMembership: m(),
      policyDocument: m(),
      policyAcknowledgement: m(),
      trainingItem: m(),
      trainingCompletion: m(),
      employeeProfile: m(),
      hRDocument: m(),
      resourceAllocation: m(),
      probationReview: m(),
      timesheetWeek: m(),
      timesheetEntry: m(),
      auditEvent: m(),
      $transaction: vi.fn(),
    },
    profileRef: { current: null as any },
  }
})

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@/lib/prisma-modules', () => ({ modulesPrisma: ctx.prisma }))

vi.mock('@/lib/with-auth', () => ({
  withAuth: (handler: any) => {
    return async (req: any) => {
      try {
        return await handler(req, { authUserId: 'auth-1', profile: ctx.profileRef.current })
      } catch (err: any) {
        if (err?.statusCode) {
          const body: Record<string, unknown> = { error: err.message, code: err.code }
          if (err.metadata && Object.keys(err.metadata).length > 0) body.details = err.metadata
          return new Response(JSON.stringify(body), { status: err.statusCode, headers: { 'content-type': 'application/json' } })
        }
        return new Response(JSON.stringify({ error: 'Unexpected error' }), { status: 500, headers: { 'content-type': 'application/json' } })
      }
    }
  },
}))

vi.mock('@/lib/notifications', () => ({
  createNotification: vi.fn().mockResolvedValue(undefined),
  NOTIFICATION_EVENTS: {
    TIMESHEET_SUBMITTED: 'timesheet.submitted',
    TIMESHEET_DECISION: 'timesheet.decision',
  },
}))

import { GET, PATCH } from '@/app/api/timesheets/[weekId]/route'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const mockPrisma = ctx.prisma

function makeTimesheetWeek(overrides: Record<string, unknown> = {}) {
  return {
    id: 'week-1',
    profileId: 'profile-1',
    organisationId: 'org-1',
    weekStarting: new Date('2026-08-03'),
    status: 'DRAFT',
    totalHours: 0,
    billableHours: 0,
    submittedAt: null,
    approvedById: null,
    approvedAt: null,
    rejectionReason: null,
    comments: null,
    profile: {
      id: 'profile-1',
      fullName: 'Test User',
      jobTitle: 'Architect',
      avatarUrl: null,
      managerId: 'manager-1',
      organisationId: 'org-1',
    },
    entries: [],
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// GET tests
// ---------------------------------------------------------------------------

describe('GET /api/timesheets/[weekId]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ctx.profileRef.current = createMockProfile()
  })

  it('returns the timesheet week with entries for the owner', async () => {
    const week = makeTimesheetWeek()
    mockPrisma.timesheetWeek.findUnique.mockResolvedValue(week)

    const req = createMockRequest({ url: 'http://localhost/api/timesheets/week-1' })
    const res = await GET(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.data.week.id).toBe('week-1')
    expect(json.data.week.status).toBe('DRAFT')
  })

  it('returns 404 when timesheet does not exist', async () => {
    mockPrisma.timesheetWeek.findUnique.mockResolvedValue(null)

    const req = createMockRequest({ url: 'http://localhost/api/timesheets/nonexistent' })
    const res = await GET(req)

    expect(res.status).toBe(404)
  })

  it('rejects access for non-owner, non-manager, non-admin', async () => {
    ctx.profileRef.current = createMockProfile({ id: 'outsider', orgPermission: 'MEMBER' })
    const week = makeTimesheetWeek({
      profileId: 'someone-else',
      profile: {
        id: 'someone-else',
        fullName: 'Other User',
        managerId: 'some-manager',
        organisationId: 'org-1',
      },
    })
    mockPrisma.timesheetWeek.findUnique.mockResolvedValue(week)

    const req = createMockRequest({ url: 'http://localhost/api/timesheets/week-1' })
    const res = await GET(req)

    expect(res.status).toBe(403)
  })

  it('allows manager to view their direct reports timesheet', async () => {
    ctx.profileRef.current = createManagerProfile()
    const week = makeTimesheetWeek({
      profileId: 'subordinate-1',
      profile: {
        id: 'subordinate-1',
        fullName: 'Subordinate',
        managerId: 'manager-1',
        organisationId: 'org-1',
      },
    })
    mockPrisma.timesheetWeek.findUnique.mockResolvedValue(week)

    const req = createMockRequest({ url: 'http://localhost/api/timesheets/week-1' })
    const res = await GET(req)

    expect(res.status).toBe(200)
  })

  it('allows admin to view any timesheet in the org', async () => {
    ctx.profileRef.current = createAdminProfile()
    const week = makeTimesheetWeek({
      profileId: 'someone-else',
      profile: {
        id: 'someone-else',
        fullName: 'Other',
        managerId: 'some-other-manager',
        organisationId: 'org-1',
      },
    })
    mockPrisma.timesheetWeek.findUnique.mockResolvedValue(week)

    const req = createMockRequest({ url: 'http://localhost/api/timesheets/week-1' })
    const res = await GET(req)

    expect(res.status).toBe(200)
  })

  it('returns 404 for timesheet from a different org', async () => {
    const week = makeTimesheetWeek({ organisationId: 'other-org' })
    mockPrisma.timesheetWeek.findUnique.mockResolvedValue(week)

    const req = createMockRequest({ url: 'http://localhost/api/timesheets/week-1' })
    const res = await GET(req)

    expect(res.status).toBe(404)
  })
})

// ---------------------------------------------------------------------------
// PATCH tests
// ---------------------------------------------------------------------------

describe('PATCH /api/timesheets/[weekId]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ctx.profileRef.current = createMockProfile()
  })

  it('rejects invalid status transition (DRAFT -> APPROVED)', async () => {
    const week = makeTimesheetWeek({
      status: 'DRAFT',
      profile: { id: 'profile-1', organisationId: 'org-1', managerId: 'manager-1' },
      entries: [],
    })
    mockPrisma.timesheetWeek.findUnique.mockResolvedValue(week)

    const req = createMockRequest({
      method: 'PATCH',
      url: 'http://localhost/api/timesheets/week-1',
      body: { status: 'APPROVED' },
    })
    const res = await PATCH(req)
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toContain('Cannot transition from DRAFT to APPROVED')
  })

  it('allows valid transition DRAFT -> SUBMITTED by owner', async () => {
    const week = makeTimesheetWeek({
      status: 'DRAFT',
      profile: { id: 'profile-1', organisationId: 'org-1', managerId: 'manager-1' },
      entries: [
        { hours: 8, isBillable: true },
        { hours: 8, isBillable: false },
      ],
    })
    mockPrisma.timesheetWeek.findUnique.mockResolvedValue(week)
    mockPrisma.timesheetWeek.update.mockResolvedValue({
      ...week,
      status: 'SUBMITTED',
      totalHours: 16,
      billableHours: 8,
      profile: { id: 'profile-1', fullName: 'Test User' },
      entries: [],
    })

    const req = createMockRequest({
      method: 'PATCH',
      url: 'http://localhost/api/timesheets/week-1',
      body: { status: 'SUBMITTED' },
    })
    const res = await PATCH(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.data.week.status).toBe('SUBMITTED')

    const updateCall = mockPrisma.timesheetWeek.update.mock.calls[0][0]
    expect(updateCall.data.totalHours).toBe(16)
    expect(updateCall.data.billableHours).toBe(8)
    expect(updateCall.data.submittedAt).toBeDefined()
  })

  it('rejects SUBMITTED with 0 hours', async () => {
    const week = makeTimesheetWeek({
      status: 'DRAFT',
      profile: { id: 'profile-1', organisationId: 'org-1', managerId: 'manager-1' },
      entries: [],
    })
    mockPrisma.timesheetWeek.findUnique.mockResolvedValue(week)

    const req = createMockRequest({
      method: 'PATCH',
      url: 'http://localhost/api/timesheets/week-1',
      body: { status: 'SUBMITTED' },
    })
    const res = await PATCH(req)
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toContain('0 hours')
  })

  it('enforces OWNER_STATUSES — non-owner cannot submit', async () => {
    ctx.profileRef.current = createMockProfile({ id: 'not-the-owner', orgPermission: 'MEMBER' })
    const week = makeTimesheetWeek({
      profileId: 'someone-else',
      status: 'DRAFT',
      profile: {
        id: 'someone-else',
        organisationId: 'org-1',
        managerId: 'some-manager',
      },
      entries: [{ hours: 8, isBillable: true }],
    })
    mockPrisma.timesheetWeek.findUnique.mockResolvedValue(week)

    const req = createMockRequest({
      method: 'PATCH',
      url: 'http://localhost/api/timesheets/week-1',
      body: { status: 'SUBMITTED' },
    })
    const res = await PATCH(req)
    const json = await res.json()

    expect(res.status).toBe(403)
    expect(json.error).toContain('owner')
  })

  it('enforces MANAGER_STATUSES — non-manager cannot approve', async () => {
    ctx.profileRef.current = createMockProfile({ id: 'profile-1', orgPermission: 'MEMBER' })
    const week = makeTimesheetWeek({
      profileId: 'profile-1',
      status: 'SUBMITTED',
      profile: {
        id: 'profile-1',
        organisationId: 'org-1',
        managerId: 'some-other-manager',
      },
    })
    mockPrisma.timesheetWeek.findUnique.mockResolvedValue(week)

    const req = createMockRequest({
      method: 'PATCH',
      url: 'http://localhost/api/timesheets/week-1',
      body: { status: 'APPROVED' },
    })
    const res = await PATCH(req)
    const json = await res.json()

    expect(res.status).toBe(403)
    expect(json.error).toContain('manager or admin')
  })

  it('allows manager to approve their subordinate timesheet', async () => {
    ctx.profileRef.current = createManagerProfile()
    const week = makeTimesheetWeek({
      profileId: 'subordinate-1',
      status: 'SUBMITTED',
      profile: {
        id: 'subordinate-1',
        organisationId: 'org-1',
        managerId: 'manager-1',
      },
      entries: [],
    })
    mockPrisma.timesheetWeek.findUnique.mockResolvedValue(week)
    mockPrisma.timesheetWeek.update.mockResolvedValue({
      ...week,
      status: 'APPROVED',
      profile: { id: 'subordinate-1', fullName: 'Sub' },
      entries: [],
    })

    const req = createMockRequest({
      method: 'PATCH',
      url: 'http://localhost/api/timesheets/week-1',
      body: { status: 'APPROVED' },
    })
    const res = await PATCH(req)

    expect(res.status).toBe(200)

    const updateCall = mockPrisma.timesheetWeek.update.mock.calls[0][0]
    expect(updateCall.data.approvedById).toBe('manager-1')
    expect(updateCall.data.approvedAt).toBeDefined()
  })

  it('allows admin to approve any timesheet', async () => {
    ctx.profileRef.current = createAdminProfile()
    const week = makeTimesheetWeek({
      profileId: 'anyone',
      status: 'SUBMITTED',
      profile: {
        id: 'anyone',
        organisationId: 'org-1',
        managerId: 'some-manager',
      },
      entries: [],
    })
    mockPrisma.timesheetWeek.findUnique.mockResolvedValue(week)
    mockPrisma.timesheetWeek.update.mockResolvedValue({
      ...week,
      status: 'APPROVED',
      profile: { id: 'anyone', fullName: 'Anyone' },
      entries: [],
    })

    const req = createMockRequest({
      method: 'PATCH',
      url: 'http://localhost/api/timesheets/week-1',
      body: { status: 'APPROVED' },
    })
    const res = await PATCH(req)

    expect(res.status).toBe(200)
  })

  it('requires rejectionReason when status is CHANGES_REQUIRED', async () => {
    ctx.profileRef.current = createManagerProfile()
    const week = makeTimesheetWeek({
      profileId: 'sub-1',
      status: 'SUBMITTED',
      profile: {
        id: 'sub-1',
        organisationId: 'org-1',
        managerId: 'manager-1',
      },
      entries: [],
    })
    mockPrisma.timesheetWeek.findUnique.mockResolvedValue(week)

    const req = createMockRequest({
      method: 'PATCH',
      url: 'http://localhost/api/timesheets/week-1',
      body: { status: 'CHANGES_REQUIRED' },
    })
    const res = await PATCH(req)
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toContain('reason is required')
  })

  it('requires rejectionReason when status is REJECTED', async () => {
    ctx.profileRef.current = createManagerProfile()
    const week = makeTimesheetWeek({
      profileId: 'sub-1',
      status: 'SUBMITTED',
      profile: {
        id: 'sub-1',
        organisationId: 'org-1',
        managerId: 'manager-1',
      },
      entries: [],
    })
    mockPrisma.timesheetWeek.findUnique.mockResolvedValue(week)

    const req = createMockRequest({
      method: 'PATCH',
      url: 'http://localhost/api/timesheets/week-1',
      body: { status: 'REJECTED' },
    })
    const res = await PATCH(req)
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toContain('reason is required')
  })

  it('accepts CHANGES_REQUIRED with a rejectionReason', async () => {
    ctx.profileRef.current = createManagerProfile()
    const week = makeTimesheetWeek({
      profileId: 'sub-1',
      status: 'SUBMITTED',
      profile: {
        id: 'sub-1',
        organisationId: 'org-1',
        managerId: 'manager-1',
      },
      entries: [],
    })
    mockPrisma.timesheetWeek.findUnique.mockResolvedValue(week)
    mockPrisma.timesheetWeek.update.mockResolvedValue({
      ...week,
      status: 'CHANGES_REQUIRED',
      rejectionReason: 'Missing Friday entries',
      profile: { id: 'sub-1', fullName: 'Sub' },
      entries: [],
    })

    const req = createMockRequest({
      method: 'PATCH',
      url: 'http://localhost/api/timesheets/week-1',
      body: { status: 'CHANGES_REQUIRED', rejectionReason: 'Missing Friday entries' },
    })
    const res = await PATCH(req)

    expect(res.status).toBe(200)
    const updateCall = mockPrisma.timesheetWeek.update.mock.calls[0][0]
    expect(updateCall.data.rejectionReason).toBe('Missing Friday entries')
  })

  it('clears rejectionReason when resubmitting (DRAFT or SUBMITTED)', async () => {
    const week = makeTimesheetWeek({
      status: 'CHANGES_REQUIRED',
      rejectionReason: 'Old reason',
      profile: {
        id: 'profile-1',
        organisationId: 'org-1',
        managerId: 'manager-1',
      },
      entries: [],
    })
    mockPrisma.timesheetWeek.findUnique.mockResolvedValue(week)
    mockPrisma.timesheetWeek.update.mockResolvedValue({
      ...week,
      status: 'DRAFT',
      rejectionReason: null,
      profile: { id: 'profile-1', fullName: 'Test User' },
      entries: [],
    })

    const req = createMockRequest({
      method: 'PATCH',
      url: 'http://localhost/api/timesheets/week-1',
      body: { status: 'DRAFT' },
    })
    const res = await PATCH(req)

    expect(res.status).toBe(200)
    const updateCall = mockPrisma.timesheetWeek.update.mock.calls[0][0]
    expect(updateCall.data.rejectionReason).toBeNull()
  })

  it('rejects when status is missing from body', async () => {
    mockPrisma.timesheetWeek.findUnique.mockResolvedValue(makeTimesheetWeek({
      profile: { id: 'profile-1', organisationId: 'org-1', managerId: 'manager-1' },
      entries: [],
    }))

    const req = createMockRequest({
      method: 'PATCH',
      url: 'http://localhost/api/timesheets/week-1',
      body: {},
    })
    const res = await PATCH(req)
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toContain('Status is required')
  })

  it('returns 404 for timesheet from a different organisation', async () => {
    const week = makeTimesheetWeek({
      profile: {
        id: 'profile-1',
        organisationId: 'different-org',
        managerId: 'manager-1',
      },
      entries: [],
    })
    mockPrisma.timesheetWeek.findUnique.mockResolvedValue(week)

    const req = createMockRequest({
      method: 'PATCH',
      url: 'http://localhost/api/timesheets/week-1',
      body: { status: 'SUBMITTED' },
    })
    const res = await PATCH(req)

    expect(res.status).toBe(404)
  })
})

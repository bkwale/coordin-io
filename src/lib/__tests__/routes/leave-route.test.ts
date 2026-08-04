import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  createMockProfile,
  createAdminProfile,
  createManagerProfile,
  createMockRequest,
  createMockLeaveRequest,
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

vi.mock('@/lib/prisma', () => ({ prisma: ctx.prisma }))

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

vi.mock('@/lib/audit', () => ({
  recordAuditEvent: vi.fn().mockResolvedValue(undefined),
  AuditActions: { LEAVE_REQUESTED: 'leave.requested' },
}))

import { GET, POST } from '@/app/api/leave/requests/route'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const mockPrisma = ctx.prisma

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GET /api/leave/requests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ctx.profileRef.current = createMockProfile({ managerId: 'manager-1' })
    mockPrisma.leaveRequest.findMany.mockResolvedValue([])
  })

  it('returns own leave requests by default', async () => {
    const mockLeave = createMockLeaveRequest({
      profile: { id: 'profile-1', fullName: 'Test User', jobTitle: 'Architect' },
      approver: { id: 'manager-1', fullName: 'Manager' },
    })
    mockPrisma.leaveRequest.findMany.mockResolvedValue([mockLeave])

    const req = createMockRequest({ url: 'http://localhost/api/leave/requests' })
    const res = await GET(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.data.requests).toHaveLength(1)
    expect(json.data.requests[0].id).toBe('leave-1')

    const findManyCall = mockPrisma.leaveRequest.findMany.mock.calls[0][0]
    expect(findManyCall.where.profileId).toBe('profile-1')
  })

  it('returns approval queue when role=approver', async () => {
    ctx.profileRef.current = createManagerProfile()
    mockPrisma.leaveRequest.findMany.mockResolvedValue([])

    const req = createMockRequest({ url: 'http://localhost/api/leave/requests?role=approver' })
    const res = await GET(req)

    expect(res.status).toBe(200)
    const findManyCall = mockPrisma.leaveRequest.findMany.mock.calls[0][0]
    expect(findManyCall.where.approverId).toBe('manager-1')
    expect(findManyCall.where.status.in).toEqual(['SUBMITTED', 'UNDER_REVIEW', 'LINE_MANAGER_APPROVED'])
  })

  it('admin with ?all=true sees all org requests', async () => {
    ctx.profileRef.current = createAdminProfile()
    mockPrisma.leaveRequest.findMany.mockResolvedValue([])

    const req = createMockRequest({ url: 'http://localhost/api/leave/requests?all=true' })
    await GET(req)

    const findManyCall = mockPrisma.leaveRequest.findMany.mock.calls[0][0]
    expect(findManyCall.where.profile.organisationId).toBe('org-1')
    expect(findManyCall.where.profileId).toBeUndefined()
  })

  it('non-admin with ?all=true falls through to own requests', async () => {
    ctx.profileRef.current = createMockProfile({ orgPermission: 'MEMBER' })
    mockPrisma.leaveRequest.findMany.mockResolvedValue([])

    const req = createMockRequest({ url: 'http://localhost/api/leave/requests?all=true' })
    await GET(req)

    const findManyCall = mockPrisma.leaveRequest.findMany.mock.calls[0][0]
    expect(findManyCall.where.profileId).toBe('profile-1')
  })

  it('filters by year from query parameter', async () => {
    mockPrisma.leaveRequest.findMany.mockResolvedValue([])

    const req = createMockRequest({ url: 'http://localhost/api/leave/requests?year=2025' })
    const res = await GET(req)
    const json = await res.json()

    expect(json.data.year).toBe(2025)
    const findManyCall = mockPrisma.leaveRequest.findMany.mock.calls[0][0]
    const startGte = findManyCall.where.startDate.gte as Date
    expect(startGte.getFullYear()).toBe(2025)
  })
})

describe('POST /api/leave/requests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ctx.profileRef.current = createMockProfile({ managerId: 'manager-1' })
    mockPrisma.leaveRequest.findMany.mockResolvedValue([])
    mockPrisma.leaveRequest.create.mockImplementation(({ data }: any) =>
      Promise.resolve({
        id: 'new-leave-1',
        ...data,
        profile: { id: 'profile-1', fullName: 'Test User' },
        approver: { id: 'manager-1', fullName: 'Manager' },
      }),
    )
  })

  it('creates a leave request in DRAFT status', async () => {
    const req = createMockRequest({
      method: 'POST',
      url: 'http://localhost/api/leave/requests',
      body: {
        leaveType: 'ANNUAL',
        startDate: '2026-09-07',
        endDate: '2026-09-11',
      },
    })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(201)
    expect(json.data.leaveRequest.status).toBe('DRAFT')
    expect(json.data.leaveRequest.leaveType).toBe('ANNUAL')

    const createCall = mockPrisma.leaveRequest.create.mock.calls[0][0]
    expect(createCall.data.status).toBe('DRAFT')
    expect(createCall.data.profileId).toBe('profile-1')
    expect(createCall.data.approverId).toBe('manager-1')
  })

  it('rejects invalid leave type', async () => {
    const req = createMockRequest({
      method: 'POST',
      url: 'http://localhost/api/leave/requests',
      body: {
        leaveType: 'INVALID_TYPE',
        startDate: '2026-09-07',
        endDate: '2026-09-11',
      },
    })
    const res = await POST(req)

    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toContain('Leave type')
  })

  it('rejects missing startDate', async () => {
    const req = createMockRequest({
      method: 'POST',
      url: 'http://localhost/api/leave/requests',
      body: {
        leaveType: 'ANNUAL',
        endDate: '2026-09-11',
      },
    })
    const res = await POST(req)

    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toContain('Start date')
  })

  it('rejects when dates overlap with existing request', async () => {
    mockPrisma.leaveRequest.findMany.mockResolvedValue([
      {
        id: 'existing-1',
        startDate: new Date('2026-09-08'),
        endDate: new Date('2026-09-10'),
      },
    ])

    const req = createMockRequest({
      method: 'POST',
      url: 'http://localhost/api/leave/requests',
      body: {
        leaveType: 'ANNUAL',
        startDate: '2026-09-07',
        endDate: '2026-09-11',
      },
    })
    const res = await POST(req)

    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toContain('overlaps')
  })

  it('supports half-day requests', async () => {
    const req = createMockRequest({
      method: 'POST',
      url: 'http://localhost/api/leave/requests',
      body: {
        leaveType: 'ANNUAL',
        startDate: '2026-09-07',
        endDate: '2026-09-07',
        halfDay: true,
        halfDayPeriod: 'AM',
      },
    })
    const res = await POST(req)

    expect(res.status).toBe(201)
    const createCall = mockPrisma.leaveRequest.create.mock.calls[0][0]
    expect(createCall.data.halfDay).toBe(true)
    expect(createCall.data.halfDayPeriod).toBe('AM')
    expect(createCall.data.days).toBe(0.5)
  })

  it('sets approverId to managerId from profile', async () => {
    ctx.profileRef.current = createMockProfile({ managerId: 'my-manager-id' })

    const req = createMockRequest({
      method: 'POST',
      url: 'http://localhost/api/leave/requests',
      body: {
        leaveType: 'SICK',
        startDate: '2026-09-07',
        endDate: '2026-09-07',
      },
    })
    await POST(req)

    const createCall = mockPrisma.leaveRequest.create.mock.calls[0][0]
    expect(createCall.data.approverId).toBe('my-manager-id')
  })
})

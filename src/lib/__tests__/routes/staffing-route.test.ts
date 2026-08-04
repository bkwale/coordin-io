import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  createMockProfile,
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

import { GET } from '@/app/api/staffing/route'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const mockPrisma = ctx.prisma

function makeStaffingProfile(overrides: Record<string, unknown> = {}) {
  return {
    id: 'emp-1',
    fullName: 'Alice Smith',
    email: 'alice@example.com',
    jobTitle: 'Engineer',
    status: 'ACTIVE',
    startDate: '2025-01-15',
    officeId: 'office-1',
    orgPermission: 'MEMBER',
    office: { id: 'office-1', name: 'London Office' },
    corporateRole: { id: 'role-1', title: 'Senior Engineer', department: 'Engineering' },
    employeeProfile: { annualLeaveAllocation: 28, onboardingComplete: true },
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GET /api/staffing', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ctx.profileRef.current = createMockProfile({ orgPermission: 'ADMIN' })

    mockPrisma.profile.findMany.mockResolvedValue([makeStaffingProfile()])
    mockPrisma.resourceAllocation.groupBy.mockResolvedValue([])
    mockPrisma.leaveRequest.count.mockResolvedValue(0)
    mockPrisma.hRDocument.findMany.mockResolvedValue([])
    mockPrisma.probationReview.count.mockResolvedValue(0)
  })

  it('returns employees mapped to flat shape (office as string)', async () => {
    const req = createMockRequest({ url: 'http://localhost/api/staffing' })
    const res = await GET(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    const emp = json.data.employees[0]
    expect(emp.office).toBe('London Office')
    expect(emp.department).toBe('Engineering')
    expect(emp.role).toBe('Senior Engineer')
    expect(emp.onboardingComplete).toBe(true)
    expect(emp.leaveAllocation).toBe(28)
  })

  it('returns correct metrics for a single active employee', async () => {
    const req = createMockRequest({ url: 'http://localhost/api/staffing' })
    const res = await GET(req)
    const json = await res.json()

    expect(json.data.metrics.totalEmployees).toBe(1)
    expect(json.data.metrics.activeEmployees).toBe(1)
    expect(json.data.metrics.onboarding).toBe(0)
  })

  it('counts onboarding employees separately', async () => {
    mockPrisma.profile.findMany.mockResolvedValue([
      makeStaffingProfile(),
      makeStaffingProfile({ id: 'emp-2', status: 'ONBOARDING', fullName: 'Bob New' }),
    ])

    const req = createMockRequest({ url: 'http://localhost/api/staffing' })
    const res = await GET(req)
    const json = await res.json()

    expect(json.data.metrics.totalEmployees).toBe(2)
    expect(json.data.metrics.activeEmployees).toBe(1)
    expect(json.data.metrics.onboarding).toBe(1)
  })

  it('returns byOffice breakdown with counts', async () => {
    mockPrisma.profile.findMany.mockResolvedValue([
      makeStaffingProfile(),
      makeStaffingProfile({ id: 'emp-2', fullName: 'Bob Builder' }),
      makeStaffingProfile({
        id: 'emp-3',
        fullName: 'Charlie Remote',
        officeId: null,
        office: null,
      }),
    ])

    const req = createMockRequest({ url: 'http://localhost/api/staffing' })
    const res = await GET(req)
    const json = await res.json()

    const offices = json.data.byOffice as Array<{ name: string; count: number }>
    const london = offices.find((o) => o.name === 'London Office')
    const unassigned = offices.find((o) => o.name === 'Unassigned')
    expect(london?.count).toBe(2)
    expect(unassigned?.count).toBe(1)
  })

  it('returns byDepartment breakdown', async () => {
    mockPrisma.profile.findMany.mockResolvedValue([
      makeStaffingProfile(),
      makeStaffingProfile({
        id: 'emp-2',
        corporateRole: { id: 'role-2', title: 'PM', department: 'Management' },
      }),
    ])

    const req = createMockRequest({ url: 'http://localhost/api/staffing' })
    const res = await GET(req)
    const json = await res.json()

    expect(json.data.byDepartment.Engineering).toBe(1)
    expect(json.data.byDepartment.Management).toBe(1)
  })

  it('handles null employeeProfile gracefully via try-catch fallback', async () => {
    mockPrisma.profile.findMany
      .mockRejectedValueOnce(new Error('relation does not exist'))
      .mockResolvedValueOnce([
        {
          id: 'emp-1',
          fullName: 'Alice Smith',
          email: 'alice@example.com',
          jobTitle: 'Engineer',
          status: 'ACTIVE',
          startDate: '2025-01-15',
          officeId: 'office-1',
          orgPermission: 'MEMBER',
          office: { id: 'office-1', name: 'London Office' },
          corporateRole: { id: 'role-1', title: 'Senior Engineer', department: 'Engineering' },
        },
      ])

    const req = createMockRequest({ url: 'http://localhost/api/staffing' })
    const res = await GET(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    const emp = json.data.employees[0]
    expect(emp.onboardingComplete).toBe(false)
    expect(emp.leaveAllocation).toBe(25)
  })

  it('handles null office and corporateRole with safe defaults', async () => {
    mockPrisma.profile.findMany.mockResolvedValue([
      makeStaffingProfile({
        officeId: null,
        office: null,
        corporateRole: null,
        employeeProfile: null,
      }),
    ])

    const req = createMockRequest({ url: 'http://localhost/api/staffing' })
    const res = await GET(req)
    const json = await res.json()

    const emp = json.data.employees[0]
    expect(emp.office).toBeNull()
    expect(emp.department).toBeNull()
    expect(emp.role).toBeNull()
    expect(emp.onboardingComplete).toBe(false)
    expect(emp.leaveAllocation).toBe(25)
  })

  it('returns capacity metrics from resource allocations', async () => {
    mockPrisma.profile.findMany.mockResolvedValue([
      makeStaffingProfile({ id: 'emp-1' }),
      makeStaffingProfile({ id: 'emp-2', fullName: 'Bob' }),
    ])
    mockPrisma.resourceAllocation.groupBy.mockResolvedValue([
      { profileId: 'emp-1', _sum: { hoursAllocated: 45 } },
      { profileId: 'emp-2', _sum: { hoursAllocated: 15 } },
    ])

    const req = createMockRequest({ url: 'http://localhost/api/staffing' })
    const res = await GET(req)
    const json = await res.json()

    expect(json.data.metrics.overAllocated).toBe(1)
    expect(json.data.metrics.underAllocated).toBe(1)
    expect(json.data.metrics.totalCapacityHours).toBe(80)
    expect(json.data.metrics.totalAllocatedHours).toBe(60)
    expect(json.data.metrics.avgUtilisation).toBe(75)
  })
})

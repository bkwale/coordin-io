import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  createMockProfile,
  createMockRequest,
} from '../helpers/test-utils'

// ---------------------------------------------------------------------------
// vi.hoisted — shared mock state
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
      cPDRecord: m(),
      assetAssignment: m(),
      $transaction: vi.fn(),
    },
    profileRef: { current: null as any },
  }
})

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@/lib/prisma-modules', () => ({ modulesPrisma: ctx.prisma }))
vi.mock('@/lib/prisma', () => ({ prisma: ctx.prisma }))
vi.mock('@/lib/audit', () => ({
  recordAuditEvent: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('@/lib/notifications', () => ({
  createNotification: vi.fn().mockResolvedValue(undefined),
  NOTIFICATION_EVENTS: {},
}))

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

// ---------------------------------------------------------------------------
// Route imports
// ---------------------------------------------------------------------------

import { GET as getAllocations } from '@/app/api/staffing/allocations/route'
import { GET as getEmployee } from '@/app/api/staffing/employees/[profileId]/route'
import { GET as getHRDocs, POST as postHRDoc } from '@/app/api/staffing/hr-documents/route'
import { GET as getProbation, POST as postProbation } from '@/app/api/staffing/probation/route'
import { GET as getTraining, POST as postTraining } from '@/app/api/staffing/training/route'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const mockPrisma = ctx.prisma

function makeEmployee(overrides: Record<string, unknown> = {}) {
  return {
    id: 'emp-1',
    fullName: 'Alice Smith',
    email: 'alice@example.com',
    phone: '+447700900000',
    jobTitle: 'Engineer',
    avatarUrl: null,
    status: 'ACTIVE',
    startDate: '2025-01-15',
    officeId: 'office-1',
    orgPermission: 'MEMBER',
    organisationId: 'org-1',
    office: { id: 'office-1', name: 'London', city: 'London', country: 'UK', level: null },
    corporateRole: { id: 'role-1', name: 'Senior Engineer', level: 1 },
    manager: { id: 'mgr-1', fullName: 'Manager Bob', jobTitle: 'PM' },
    department: 'Engineering',
    employeeProfile: {
      department: 'Engineering',
      onboardingComplete: true,
      annualLeaveAllocation: 28,
      emergencyName: 'John Smith',
      emergencyPhone: '+447700900001',
      emergencyRelation: 'Spouse',
      mentorId: null,
      qualificationPathway: null,
      salary: 65000,
      workingHours: 40,
      availabilityStatus: 'IN_OFFICE',
    },
    projectMemberships: [],
    leaveBalances: [],
    trainingCompletions: [],
    cpdRecords: [],
    assetAssignments: [],
    ...overrides,
  }
}

// =====================================================================
// GET /api/staffing/allocations — MEMBER blocked, MANAGER+ allowed
// =====================================================================

describe('GET /api/staffing/allocations — access control', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 403 for MEMBER role', async () => {
    ctx.profileRef.current = createMockProfile({ orgPermission: 'MEMBER' })
    const req = createMockRequest({ url: 'http://localhost/api/staffing/allocations' })
    const res = await getAllocations(req)

    expect(res.status).toBe(403)
    const json = await res.json()
    expect(json.error).toMatch(/managers and above/i)
  })

  it('returns 403 for VIEWER role', async () => {
    ctx.profileRef.current = createMockProfile({ orgPermission: 'VIEWER' })
    const req = createMockRequest({ url: 'http://localhost/api/staffing/allocations' })
    const res = await getAllocations(req)

    expect(res.status).toBe(403)
  })

  it('returns 200 for MANAGER role', async () => {
    ctx.profileRef.current = createMockProfile({ orgPermission: 'MANAGER' })

    mockPrisma.resourceAllocation.findMany.mockResolvedValue([])
    mockPrisma.profile.findMany.mockResolvedValue([])
    mockPrisma.project.findMany.mockResolvedValue([])
    mockPrisma.leaveRequest.findMany.mockResolvedValue([])

    const req = createMockRequest({ url: 'http://localhost/api/staffing/allocations' })
    const res = await getAllocations(req)

    expect(res.status).toBe(200)
  })

  it('returns 200 for HR role', async () => {
    ctx.profileRef.current = createMockProfile({ orgPermission: 'HR' })

    mockPrisma.resourceAllocation.findMany.mockResolvedValue([])
    mockPrisma.profile.findMany.mockResolvedValue([])
    mockPrisma.project.findMany.mockResolvedValue([])
    mockPrisma.leaveRequest.findMany.mockResolvedValue([])

    const req = createMockRequest({ url: 'http://localhost/api/staffing/allocations' })
    const res = await getAllocations(req)

    expect(res.status).toBe(200)
  })
})

// =====================================================================
// GET /api/staffing/employees/[profileId] — directory-only for non-HR
// =====================================================================

describe('GET /api/staffing/employees/[profileId] — access control', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPrisma.profile.findUnique.mockResolvedValue(makeEmployee())
  })

  it('MEMBER viewing another person gets directory-only response', async () => {
    ctx.profileRef.current = createMockProfile({ orgPermission: 'MEMBER', id: 'other-user' })

    const req = createMockRequest({ url: 'http://localhost/api/staffing/employees/emp-1' })
    const res = await getEmployee(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.data.directoryOnly).toBe(true)

    // Directory fields present
    expect(json.data.employee.fullName).toBe('Alice Smith')
    expect(json.data.employee.office).toBe('London')

    // Sensitive fields absent
    expect(json.data.employee).not.toHaveProperty('email')
    expect(json.data.employee).not.toHaveProperty('phone')
    expect(json.data.employee).not.toHaveProperty('salary')
    expect(json.data.projects).toBeUndefined()
    expect(json.data.hrDocuments).toBeUndefined()
    expect(json.data.allocations).toBeUndefined()
  })

  it('MEMBER viewing SELF gets full response', async () => {
    ctx.profileRef.current = createMockProfile({ orgPermission: 'MEMBER', id: 'emp-1' })

    const req = createMockRequest({ url: 'http://localhost/api/staffing/employees/emp-1' })
    const res = await getEmployee(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.data.directoryOnly).toBeUndefined()
    expect(json.data.employee.email).toBe('alice@example.com')
    expect(json.data.projects).toBeDefined()
  })

  it('HR gets full response for any employee', async () => {
    ctx.profileRef.current = createMockProfile({ orgPermission: 'HR', id: 'hr-user' })

    const req = createMockRequest({ url: 'http://localhost/api/staffing/employees/emp-1' })
    const res = await getEmployee(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.data.directoryOnly).toBeUndefined()
    expect(json.data.employee.email).toBe('alice@example.com')
    expect(json.data.projects).toBeDefined()
  })

  it('ADMIN gets full response for any employee', async () => {
    ctx.profileRef.current = createMockProfile({ orgPermission: 'ADMIN', id: 'admin-user' })

    const req = createMockRequest({ url: 'http://localhost/api/staffing/employees/emp-1' })
    const res = await getEmployee(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.data.directoryOnly).toBeUndefined()
    expect(json.data.employee.email).toBe('alice@example.com')
  })

  it('MANAGER viewing another person gets directory-only response', async () => {
    ctx.profileRef.current = createMockProfile({ orgPermission: 'MANAGER', id: 'mgr-user' })

    const req = createMockRequest({ url: 'http://localhost/api/staffing/employees/emp-1' })
    const res = await getEmployee(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.data.directoryOnly).toBe(true)
    expect(json.data.employee).not.toHaveProperty('email')
  })
})

// =====================================================================
// GET/POST /api/staffing/hr-documents — HR+ only
// =====================================================================

describe('GET /api/staffing/hr-documents — access control', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('MEMBER can only see own non-confidential docs', async () => {
    ctx.profileRef.current = createMockProfile({ orgPermission: 'MEMBER' })
    mockPrisma.hRDocument.findMany.mockResolvedValue([])

    const req = createMockRequest({ url: 'http://localhost/api/staffing/hr-documents' })
    const res = await getHRDocs(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    // The route should filter — not return 403 (MEMBER sees own docs)
  })

  it('HR can see all documents', async () => {
    ctx.profileRef.current = createMockProfile({ orgPermission: 'HR' })
    mockPrisma.hRDocument.findMany.mockResolvedValue([])

    const req = createMockRequest({ url: 'http://localhost/api/staffing/hr-documents' })
    const res = await getHRDocs(req)

    expect(res.status).toBe(200)
  })
})

describe('POST /api/staffing/hr-documents — access control', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('MEMBER cannot create HR documents', async () => {
    ctx.profileRef.current = createMockProfile({ orgPermission: 'MEMBER' })

    const req = createMockRequest({
      method: 'POST',
      url: 'http://localhost/api/staffing/hr-documents',
      body: { title: 'Test', profileId: 'emp-1', documentType: 'CONTRACT' },
    })
    const res = await postHRDoc(req)

    expect(res.status).toBe(403)
    const json = await res.json()
    expect(json.error).toMatch(/HR managers/i)
  })

  it('MANAGER cannot create HR documents', async () => {
    ctx.profileRef.current = createMockProfile({ orgPermission: 'MANAGER' })

    const req = createMockRequest({
      method: 'POST',
      url: 'http://localhost/api/staffing/hr-documents',
      body: { title: 'Test', profileId: 'emp-1', documentType: 'CONTRACT' },
    })
    const res = await postHRDoc(req)

    expect(res.status).toBe(403)
  })

  it('HR can create HR documents', async () => {
    ctx.profileRef.current = createMockProfile({ orgPermission: 'HR' })
    mockPrisma.profile.findUnique.mockResolvedValue({ id: 'emp-1', organisationId: 'org-1' })
    mockPrisma.hRDocument.create.mockResolvedValue({ id: 'doc-1' })

    const req = createMockRequest({
      method: 'POST',
      url: 'http://localhost/api/staffing/hr-documents',
      body: { title: 'Contract', profileId: 'emp-1', documentType: 'CONTRACT' },
    })
    const res = await postHRDoc(req)

    expect(res.status).toBe(201)
  })
})

// =====================================================================
// POST /api/staffing/probation — HR+ only
// =====================================================================

describe('POST /api/staffing/probation — access control', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('MEMBER cannot create probation reviews', async () => {
    ctx.profileRef.current = createMockProfile({ orgPermission: 'MEMBER' })

    const req = createMockRequest({
      method: 'POST',
      url: 'http://localhost/api/staffing/probation',
      body: { profileId: 'emp-1', scheduledDate: '2026-09-01', reviewType: '3_MONTH' },
    })
    const res = await postProbation(req)

    expect(res.status).toBe(403)
  })

  it('MANAGER cannot create probation reviews', async () => {
    ctx.profileRef.current = createMockProfile({ orgPermission: 'MANAGER' })

    const req = createMockRequest({
      method: 'POST',
      url: 'http://localhost/api/staffing/probation',
      body: { profileId: 'emp-1', scheduledDate: '2026-09-01', reviewType: '3_MONTH' },
    })
    const res = await postProbation(req)

    expect(res.status).toBe(403)
  })

  it('HR can create probation reviews', async () => {
    ctx.profileRef.current = createMockProfile({ orgPermission: 'HR' })
    mockPrisma.profile.findUnique.mockResolvedValue({ id: 'emp-1', organisationId: 'org-1' })
    mockPrisma.probationReview.create.mockResolvedValue({ id: 'prob-1' })

    const req = createMockRequest({
      method: 'POST',
      url: 'http://localhost/api/staffing/probation',
      body: { profileId: 'emp-1', scheduledDate: '2026-09-01', reviewType: '3_MONTH' },
    })
    const res = await postProbation(req)

    expect(res.status).toBe(201)
  })
})

// =====================================================================
// POST /api/staffing/training — HR+ only
// =====================================================================

describe('POST /api/staffing/training — access control', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('MEMBER cannot create training items', async () => {
    ctx.profileRef.current = createMockProfile({ orgPermission: 'MEMBER' })

    const req = createMockRequest({
      method: 'POST',
      url: 'http://localhost/api/staffing/training',
      body: { title: 'Fire Safety', category: 'COMPLIANCE' },
    })
    const res = await postTraining(req)

    expect(res.status).toBe(403)
  })

  it('MANAGER cannot create training items', async () => {
    ctx.profileRef.current = createMockProfile({ orgPermission: 'MANAGER' })

    const req = createMockRequest({
      method: 'POST',
      url: 'http://localhost/api/staffing/training',
      body: { title: 'Fire Safety', category: 'COMPLIANCE' },
    })
    const res = await postTraining(req)

    expect(res.status).toBe(403)
  })

  it('HR can create training items', async () => {
    ctx.profileRef.current = createMockProfile({ orgPermission: 'HR' })
    mockPrisma.trainingItem.create.mockResolvedValue({ id: 'train-1' })

    const req = createMockRequest({
      method: 'POST',
      url: 'http://localhost/api/staffing/training',
      body: { title: 'Fire Safety', category: 'COMPLIANCE' },
    })
    const res = await postTraining(req)

    expect(res.status).toBe(201)
  })
})

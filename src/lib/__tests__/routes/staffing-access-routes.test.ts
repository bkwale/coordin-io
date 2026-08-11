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

// Mock Supabase client for upload route
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    storage: {
      from: vi.fn(() => ({
        upload: vi.fn().mockResolvedValue({ error: null }),
        createSignedUrl: vi.fn().mockResolvedValue({
          data: { signedUrl: 'https://example.com/signed-url' },
          error: null,
        }),
      })),
    },
  })),
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
import { GET as getEmployee, PATCH as patchEmployee } from '@/app/api/staffing/employees/[profileId]/route'
import { GET as getEmployeeProfile, PATCH as patchEmployeeProfile } from '@/app/api/staffing/employees/[profileId]/profile/route'
import { GET as getHRDocs, POST as postHRDoc } from '@/app/api/staffing/hr-documents/route'
import { GET as getProbation, POST as postProbation } from '@/app/api/staffing/probation/route'
import { GET as getTraining, POST as postTraining } from '@/app/api/staffing/training/route'
import { GET as getTrainingDetail, PATCH as patchTraining, DELETE as deleteTraining } from '@/app/api/staffing/training/[id]/route'
import { POST as postTrainingCompletion } from '@/app/api/staffing/training/completions/route'
import { POST as postHRDocUpload } from '@/app/api/staffing/hr-documents/upload/route'
import { recordAuditEvent } from '@/lib/audit'

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

// =====================================================================
// Crispin #1: PATCH employee routes — write-path access control
// =====================================================================

describe('PATCH /api/staffing/employees/[profileId] — access control', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Target employee exists in same org
    mockPrisma.profile.findUnique.mockResolvedValue({
      id: 'emp-1',
      organisationId: 'org-1',
    })
  })

  it('MEMBER cannot PATCH another employee', async () => {
    ctx.profileRef.current = createMockProfile({ orgPermission: 'MEMBER', id: 'other-user' })

    const req = createMockRequest({
      method: 'PATCH',
      url: 'http://localhost/api/staffing/employees/emp-1',
      body: { jobTitle: 'Senior Engineer' },
    })
    const res = await patchEmployee(req)

    expect(res.status).toBe(403)
    const json = await res.json()
    expect(json.error).toMatch(/HR managers/i)
  })

  it('MANAGER cannot PATCH another employee', async () => {
    ctx.profileRef.current = createMockProfile({ orgPermission: 'MANAGER', id: 'mgr-user' })

    const req = createMockRequest({
      method: 'PATCH',
      url: 'http://localhost/api/staffing/employees/emp-1',
      body: { jobTitle: 'Senior Engineer' },
    })
    const res = await patchEmployee(req)

    expect(res.status).toBe(403)
  })

  it('MEMBER can PATCH own profile (self-edit)', async () => {
    ctx.profileRef.current = createMockProfile({ orgPermission: 'MEMBER', id: 'emp-1' })

    const req = createMockRequest({
      method: 'PATCH',
      url: 'http://localhost/api/staffing/employees/emp-1',
      body: { phone: '+447700900099' },
    })
    const res = await patchEmployee(req)

    expect(res.status).toBe(200)
  })

  it('HR can PATCH any employee', async () => {
    ctx.profileRef.current = createMockProfile({ orgPermission: 'HR', id: 'hr-user' })

    const req = createMockRequest({
      method: 'PATCH',
      url: 'http://localhost/api/staffing/employees/emp-1',
      body: { jobTitle: 'Lead Engineer', status: 'ACTIVE' },
    })
    const res = await patchEmployee(req)

    expect(res.status).toBe(200)
  })

  it('ADMIN can PATCH any employee', async () => {
    ctx.profileRef.current = createMockProfile({ orgPermission: 'ADMIN', id: 'admin-user' })

    const req = createMockRequest({
      method: 'PATCH',
      url: 'http://localhost/api/staffing/employees/emp-1',
      body: { jobTitle: 'VP Engineering' },
    })
    const res = await patchEmployee(req)

    expect(res.status).toBe(200)
  })
})

describe('PATCH /api/staffing/employees/[profileId]/profile — access control', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPrisma.profile.findUnique.mockResolvedValue({
      id: 'emp-1',
      organisationId: 'org-1',
    })
  })

  it('MEMBER cannot PATCH another employee profile (salary etc)', async () => {
    ctx.profileRef.current = createMockProfile({ orgPermission: 'MEMBER', id: 'other-user' })

    const req = createMockRequest({
      method: 'PATCH',
      url: 'http://localhost/api/staffing/employees/emp-1/profile',
      body: { salary: 100000 },
    })
    const res = await patchEmployeeProfile(req)

    expect(res.status).toBe(403)
  })

  it('MANAGER cannot PATCH another employee profile', async () => {
    ctx.profileRef.current = createMockProfile({ orgPermission: 'MANAGER', id: 'mgr-user' })

    const req = createMockRequest({
      method: 'PATCH',
      url: 'http://localhost/api/staffing/employees/emp-1/profile',
      body: { salary: 100000 },
    })
    const res = await patchEmployeeProfile(req)

    expect(res.status).toBe(403)
  })

  it('MEMBER can PATCH own profile (emergency contact, phone)', async () => {
    ctx.profileRef.current = createMockProfile({ orgPermission: 'MEMBER', id: 'emp-1' })

    const req = createMockRequest({
      method: 'PATCH',
      url: 'http://localhost/api/staffing/employees/emp-1/profile',
      body: { emergencyName: 'Jane Doe', emergencyPhone: '+44123456' },
    })
    const res = await patchEmployeeProfile(req)

    expect(res.status).toBe(200)
  })

  it('HR can PATCH any employee profile including salary', async () => {
    ctx.profileRef.current = createMockProfile({ orgPermission: 'HR', id: 'hr-user' })

    const req = createMockRequest({
      method: 'PATCH',
      url: 'http://localhost/api/staffing/employees/emp-1/profile',
      body: { salary: 75000, department: 'Engineering' },
    })
    const res = await patchEmployeeProfile(req)

    expect(res.status).toBe(200)
  })
})

// =====================================================================
// Crispin #2: Salary audit event verification
// =====================================================================

describe('GET /api/staffing/employees/[profileId]/profile — salary audit', () => {
  const employeeWithSalary = {
    id: 'emp-1',
    fullName: 'Alice Smith',
    email: 'alice@example.com',
    phone: '+447700900000',
    jobTitle: 'Engineer',
    avatarUrl: null,
    status: 'ACTIVE',
    startDate: '2025-01-15',
    orgPermission: 'MEMBER',
    organisationId: 'org-1',
    office: { id: 'o1', name: 'London', city: 'London', country: 'UK' },
    corporateRole: { id: 'r1', name: 'Engineer', level: 1 },
    manager: null,
    employeeProfile: {
      salary: 65000,
      salaryFrequency: 'ANNUAL',
      salaryCurrency: 'GBP',
      department: 'Engineering',
      annualLeaveAllocation: 28,
      onboardingComplete: true,
      workingHours: 40,
      availabilityStatus: 'IN_OFFICE',
      emergencyName: null,
      emergencyPhone: null,
      emergencyRelation: null,
      contractType: null,
      employmentType: null,
      probationEndDate: null,
      benefits: null,
      hmoProvider: null,
      hmoPlan: null,
      dependants: null,
      pensionProvider: null,
      pensionContribution: null,
      workingPattern: null,
      noticePeriod: null,
      mentorId: null,
      qualificationPathway: null,
    },
    projectMemberships: [],
    leaveBalances: [],
    trainingCompletions: [],
    assetAssignments: [],
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockPrisma.profile.findUnique.mockResolvedValue(employeeWithSalary)
    mockPrisma.hRDocument.findMany.mockResolvedValue([])
    mockPrisma.resourceAllocation.findMany.mockResolvedValue([])
    mockPrisma.leaveRequest.count.mockResolvedValue(0)
    mockPrisma.cPDRecord.findMany.mockResolvedValue([])
  })

  it('fires audit event when HR views another employee salary', async () => {
    ctx.profileRef.current = createMockProfile({ orgPermission: 'HR', id: 'hr-user' })

    const req = createMockRequest({ url: 'http://localhost/api/staffing/employees/emp-1/profile' })
    const res = await getEmployeeProfile(req)

    expect(res.status).toBe(200)
    expect(recordAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'staffing.salary_data_accessed',
        entityId: 'emp-1',
        metadata: expect.objectContaining({ accessedBy: 'HR' }),
      }),
    )
  })

  it('does NOT fire audit event when viewing own salary', async () => {
    ctx.profileRef.current = createMockProfile({ orgPermission: 'HR', id: 'emp-1' })

    const req = createMockRequest({ url: 'http://localhost/api/staffing/employees/emp-1/profile' })
    const res = await getEmployeeProfile(req)

    expect(res.status).toBe(200)
    expect(recordAuditEvent).not.toHaveBeenCalledWith(
      expect.objectContaining({ action: 'staffing.salary_data_accessed' }),
    )
  })

  it('does NOT fire audit event when employee has no salary', async () => {
    mockPrisma.profile.findUnique.mockResolvedValue({
      ...employeeWithSalary,
      employeeProfile: { ...employeeWithSalary.employeeProfile, salary: null },
    })
    ctx.profileRef.current = createMockProfile({ orgPermission: 'ADMIN', id: 'admin-user' })

    const req = createMockRequest({ url: 'http://localhost/api/staffing/employees/emp-1/profile' })
    const res = await getEmployeeProfile(req)

    expect(res.status).toBe(200)
    expect(recordAuditEvent).not.toHaveBeenCalledWith(
      expect.objectContaining({ action: 'staffing.salary_data_accessed' }),
    )
  })
})

// =====================================================================
// Crispin #3: Training completions — MANAGER allowed (combined guard)
// =====================================================================

describe('POST /api/staffing/training/completions — access control', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('MEMBER cannot record training completions', async () => {
    ctx.profileRef.current = createMockProfile({ orgPermission: 'MEMBER' })

    const req = createMockRequest({
      method: 'POST',
      url: 'http://localhost/api/staffing/training/completions',
      body: { trainingId: 'train-1', profileId: 'emp-1' },
    })
    const res = await postTrainingCompletion(req)

    expect(res.status).toBe(403)
  })

  it('MANAGER can record training completions (combined guard)', async () => {
    ctx.profileRef.current = createMockProfile({ orgPermission: 'MANAGER' })
    mockPrisma.trainingItem.findUnique.mockResolvedValue({ id: 'train-1', title: 'Fire Safety' })
    mockPrisma.profile.findUnique.mockResolvedValue({ id: 'emp-1', organisationId: 'org-1', fullName: 'Alice' })
    mockPrisma.trainingCompletion.upsert.mockResolvedValue({
      id: 'comp-1',
      profileId: 'emp-1',
      trainingId: 'train-1',
      profile: { id: 'emp-1', fullName: 'Alice' },
      training: { id: 'train-1', title: 'Fire Safety' },
    })

    const req = createMockRequest({
      method: 'POST',
      url: 'http://localhost/api/staffing/training/completions',
      body: { trainingId: 'train-1', profileId: 'emp-1' },
    })
    const res = await postTrainingCompletion(req)

    expect(res.status).toBe(201)
  })

  it('HR can record training completions', async () => {
    ctx.profileRef.current = createMockProfile({ orgPermission: 'HR' })
    mockPrisma.trainingItem.findUnique.mockResolvedValue({ id: 'train-1', title: 'Fire Safety' })
    mockPrisma.profile.findUnique.mockResolvedValue({ id: 'emp-1', organisationId: 'org-1', fullName: 'Alice' })
    mockPrisma.trainingCompletion.upsert.mockResolvedValue({
      id: 'comp-1',
      profileId: 'emp-1',
      trainingId: 'train-1',
      profile: { id: 'emp-1', fullName: 'Alice' },
      training: { id: 'train-1', title: 'Fire Safety' },
    })

    const req = createMockRequest({
      method: 'POST',
      url: 'http://localhost/api/staffing/training/completions',
      body: { trainingId: 'train-1', profileId: 'emp-1' },
    })
    const res = await postTrainingCompletion(req)

    expect(res.status).toBe(201)
  })
})

// =====================================================================
// Crispin #4: Training DELETE + PATCH — HR only / MANAGER+
// =====================================================================

describe('DELETE /api/staffing/training/[id] — access control', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPrisma.trainingItem.findUnique.mockResolvedValue({ id: 'train-1', title: 'Fire Safety', description: '{}' })
  })

  it('MEMBER cannot delete training items', async () => {
    ctx.profileRef.current = createMockProfile({ orgPermission: 'MEMBER' })

    const req = createMockRequest({
      method: 'DELETE',
      url: 'http://localhost/api/staffing/training/train-1',
    })
    const res = await deleteTraining(req)

    expect(res.status).toBe(403)
  })

  it('MANAGER cannot delete training items', async () => {
    ctx.profileRef.current = createMockProfile({ orgPermission: 'MANAGER' })

    const req = createMockRequest({
      method: 'DELETE',
      url: 'http://localhost/api/staffing/training/train-1',
    })
    const res = await deleteTraining(req)

    expect(res.status).toBe(403)
  })

  it('HR can delete training items', async () => {
    ctx.profileRef.current = createMockProfile({ orgPermission: 'HR' })

    const req = createMockRequest({
      method: 'DELETE',
      url: 'http://localhost/api/staffing/training/train-1',
    })
    const res = await deleteTraining(req)

    expect(res.status).toBe(200)
  })
})

describe('PATCH /api/staffing/training/[id] — access control', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPrisma.trainingItem.findUnique.mockResolvedValue({ id: 'train-1', title: 'Fire Safety', description: '{}' })
    mockPrisma.trainingItem.update.mockResolvedValue({ id: 'train-1', title: 'Updated' })
  })

  it('MEMBER cannot update training items', async () => {
    ctx.profileRef.current = createMockProfile({ orgPermission: 'MEMBER' })

    const req = createMockRequest({
      method: 'PATCH',
      url: 'http://localhost/api/staffing/training/train-1',
      body: { title: 'Updated Title' },
    })
    const res = await patchTraining(req)

    expect(res.status).toBe(403)
  })

  it('MANAGER can update training items (combined guard)', async () => {
    ctx.profileRef.current = createMockProfile({ orgPermission: 'MANAGER' })

    const req = createMockRequest({
      method: 'PATCH',
      url: 'http://localhost/api/staffing/training/train-1',
      body: { title: 'Updated Title' },
    })
    const res = await patchTraining(req)

    expect(res.status).toBe(200)
  })

  it('HR can update training items', async () => {
    ctx.profileRef.current = createMockProfile({ orgPermission: 'HR' })

    const req = createMockRequest({
      method: 'PATCH',
      url: 'http://localhost/api/staffing/training/train-1',
      body: { title: 'Updated Title' },
    })
    const res = await patchTraining(req)

    expect(res.status).toBe(200)
  })
})

// =====================================================================
// Crispin #5: Cross-org isolation
// =====================================================================

describe('Cross-org isolation — access control', () => {
  it('HR in org-A cannot view employee in org-B', async () => {
    ctx.profileRef.current = createMockProfile({ orgPermission: 'HR', id: 'hr-user', organisationId: 'org-A' })

    // Employee belongs to org-B
    mockPrisma.profile.findUnique.mockResolvedValue({
      ...makeEmployee(),
      organisationId: 'org-B',
    })

    const req = createMockRequest({ url: 'http://localhost/api/staffing/employees/emp-1' })
    const res = await getEmployee(req)

    expect(res.status).toBe(403)
    const json = await res.json()
    expect(json.error).toMatch(/do not have access/i)
  })

  it('ADMIN in org-A cannot view employee profile in org-B', async () => {
    ctx.profileRef.current = createMockProfile({ orgPermission: 'ADMIN', id: 'admin-user', organisationId: 'org-A' })

    mockPrisma.profile.findUnique.mockResolvedValue({
      ...makeEmployee(),
      organisationId: 'org-B',
    })

    const req = createMockRequest({ url: 'http://localhost/api/staffing/employees/emp-1/profile' })
    const res = await getEmployeeProfile(req)

    expect(res.status).toBe(403)
    const json = await res.json()
    expect(json.error).toMatch(/do not have access/i)
  })

  it('HR in org-A cannot PATCH employee in org-B', async () => {
    ctx.profileRef.current = createMockProfile({ orgPermission: 'HR', id: 'hr-user', organisationId: 'org-A' })

    mockPrisma.profile.findUnique.mockResolvedValue({
      id: 'emp-1',
      organisationId: 'org-B',
    })

    const req = createMockRequest({
      method: 'PATCH',
      url: 'http://localhost/api/staffing/employees/emp-1/profile',
      body: { salary: 100000 },
    })
    const res = await patchEmployeeProfile(req)

    expect(res.status).toBe(403)
  })
})

// =====================================================================
// Crispin #6: withAuth requiredPermission double-gate
// =====================================================================

describe('withAuth requiredPermission enforcement note', () => {
  // The test mock bypasses withAuth's requiredPermission check.
  // In production, allocations POST has { requiredPermission: 'ADMIN' }
  // PLUS an inline hasStaffingDashboardAccess guard.
  // We verify the inline guard works correctly here.
  // The withAuth enforcement is tested separately via the real middleware in integration tests.

  it('allocations POST inline guard blocks MEMBER even without withAuth gate', async () => {
    ctx.profileRef.current = createMockProfile({ orgPermission: 'MEMBER' })

    const req = createMockRequest({
      method: 'POST',
      url: 'http://localhost/api/staffing/allocations',
      body: {
        profileId: 'emp-1',
        projectId: 'proj-1',
        weekStarting: '2026-08-03',
        hoursAllocated: 20,
      },
    })

    // Import POST handler
    const { POST: postAllocation } = await import('@/app/api/staffing/allocations/route')
    const res = await postAllocation(req)

    expect(res.status).toBe(403)
  })

  it('allocations POST inline guard allows MANAGER', async () => {
    ctx.profileRef.current = createMockProfile({ orgPermission: 'MANAGER' })

    mockPrisma.profile.findUnique.mockResolvedValue({ id: 'emp-1', organisationId: 'org-1' })
    mockPrisma.project.findUnique.mockResolvedValue({ id: 'proj-1', organisationId: 'org-1' })
    mockPrisma.resourceAllocation.upsert.mockResolvedValue({
      id: 'alloc-1',
      profile: { id: 'emp-1', fullName: 'Alice' },
      project: { id: 'proj-1', name: 'Test', code: 'T1' },
    })

    const req = createMockRequest({
      method: 'POST',
      url: 'http://localhost/api/staffing/allocations',
      body: {
        profileId: 'emp-1',
        projectId: 'proj-1',
        weekStarting: '2026-08-03',
        hoursAllocated: 20,
      },
    })

    const { POST: postAllocation } = await import('@/app/api/staffing/allocations/route')
    const res = await postAllocation(req)

    expect(res.status).toBe(200)
  })
})

// =====================================================================
// POST /api/staffing/hr-documents/upload — MEMBER blocked, HR+ allowed
// (Crispin gap: formData-based upload route with Supabase storage)
// =====================================================================

describe('POST /api/staffing/hr-documents/upload — access control', () => {
  function makeFormDataRequest(role: string) {
    ctx.profileRef.current = createMockProfile({
      orgPermission: role,
      organisationId: 'org-1',
      id: 'caller-1',
    })

    // Build a real FormData with a file
    const file = new File(['hello'], 'test.pdf', { type: 'application/pdf' })
    const formData = new FormData()
    formData.append('file', file)
    formData.append('profileId', 'emp-1')

    return new Request('http://localhost/api/staffing/hr-documents/upload', {
      method: 'POST',
      body: formData,
    })
  }

  it('MEMBER → 403', async () => {
    const req = makeFormDataRequest('MEMBER')
    const res = await postHRDocUpload(req as any)
    expect(res.status).toBe(403)
  })

  it('MANAGER → 403', async () => {
    const req = makeFormDataRequest('MANAGER')
    const res = await postHRDocUpload(req as any)
    expect(res.status).toBe(403)
  })

  it('VIEWER → 403', async () => {
    const req = makeFormDataRequest('VIEWER')
    const res = await postHRDocUpload(req as any)
    expect(res.status).toBe(403)
  })

  it('HR → not 403 (permission granted)', async () => {
    const req = makeFormDataRequest('HR')
    const res = await postHRDocUpload(req as any)
    // May return 400 (missing SUPABASE_SERVICE_ROLE_KEY in test env) but NOT 403
    expect(res.status).not.toBe(403)
  })

  it('ADMIN → not 403 (permission granted)', async () => {
    const req = makeFormDataRequest('ADMIN')
    const res = await postHRDocUpload(req as any)
    expect(res.status).not.toBe(403)
  })

  it('OWNER → not 403 (permission granted)', async () => {
    const req = makeFormDataRequest('OWNER')
    const res = await postHRDocUpload(req as any)
    expect(res.status).not.toBe(403)
  })
})

// =====================================================================
// GET /api/staffing/training/[id] — MEMBER data-based permission
// (Crispin gap: MEMBER can only see training if they have a completion)
// =====================================================================

describe('GET /api/staffing/training/[id] — MEMBER with/without completion', () => {
  const trainingId = 'training-1'
  const memberId = 'member-1'

  beforeEach(() => {
    ctx.profileRef.current = createMockProfile({
      orgPermission: 'MEMBER',
      organisationId: 'org-1',
      id: memberId,
    })
  })

  it('MEMBER without completion → 403', async () => {
    // Training exists but MEMBER has no completion record
    mockPrisma.trainingItem.findUnique.mockResolvedValueOnce({
      id: trainingId,
      title: 'Fire Safety',
      description: null,
      mandatory: true,
      durationMinutes: 60,
      contentUrl: null,
      createdAt: new Date(),
      completions: [], // no completions at all
    })

    const req = createMockRequest({ method: 'GET', url: `http://localhost/api/staffing/training/${trainingId}` })
    const res = await getTrainingDetail(req)
    expect(res.status).toBe(403)
  })

  it('MEMBER with completion → 200', async () => {
    // Training exists and MEMBER has a completion record
    mockPrisma.trainingItem.findUnique.mockResolvedValueOnce({
      id: trainingId,
      title: 'Fire Safety',
      description: null,
      mandatory: true,
      durationMinutes: 60,
      contentUrl: null,
      createdAt: new Date(),
      completions: [
        {
          id: 'comp-1',
          profileId: memberId, // matches the caller
          completedAt: new Date(),
          profile: { id: memberId, fullName: 'Test Member', jobTitle: 'Engineer' },
        },
      ],
    })

    const req = createMockRequest({ method: 'GET', url: `http://localhost/api/staffing/training/${trainingId}` })
    const res = await getTrainingDetail(req)
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.data.record.id).toBe(trainingId)
  })

  it('MANAGER → 200 (dashboard access, no completion needed)', async () => {
    ctx.profileRef.current = createMockProfile({
      orgPermission: 'MANAGER',
      organisationId: 'org-1',
      id: 'mgr-1',
    })

    mockPrisma.trainingItem.findUnique.mockResolvedValueOnce({
      id: trainingId,
      title: 'Fire Safety',
      description: null,
      mandatory: true,
      durationMinutes: 60,
      contentUrl: null,
      createdAt: new Date(),
      completions: [], // no completions — but MANAGER still gets in via hasStaffingDashboardAccess
    })

    const req = createMockRequest({ method: 'GET', url: `http://localhost/api/staffing/training/${trainingId}` })
    const res = await getTrainingDetail(req)
    expect(res.status).toBe(200)
  })

  it('MEMBER with other users completion only → 403', async () => {
    // Training exists but only another user has completed it
    mockPrisma.trainingItem.findUnique.mockResolvedValueOnce({
      id: trainingId,
      title: 'Fire Safety',
      description: null,
      mandatory: true,
      durationMinutes: 60,
      contentUrl: null,
      createdAt: new Date(),
      completions: [
        {
          id: 'comp-2',
          profileId: 'other-user', // NOT the caller
          completedAt: new Date(),
          profile: { id: 'other-user', fullName: 'Other Person', jobTitle: 'Designer' },
        },
      ],
    })

    const req = createMockRequest({ method: 'GET', url: `http://localhost/api/staffing/training/${trainingId}` })
    const res = await getTrainingDetail(req)
    expect(res.status).toBe(403)
  })
})

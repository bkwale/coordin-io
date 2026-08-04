import { vi } from 'vitest'
import { NextRequest } from 'next/server'

// ---------------------------------------------------------------------------
// 1. Mock Prisma Factory
// ---------------------------------------------------------------------------

function createModelMock() {
  return {
    findMany: vi.fn().mockResolvedValue([]),
    findUnique: vi.fn().mockResolvedValue(null),
    findFirst: vi.fn().mockResolvedValue(null),
    create: vi
      .fn()
      .mockImplementation(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve({ id: 'mock-id', ...data }),
      ),
    update: vi
      .fn()
      .mockImplementation(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve({ id: 'mock-id', ...data }),
      ),
    delete: vi.fn().mockResolvedValue({ id: 'mock-id' }),
    count: vi.fn().mockResolvedValue(0),
    groupBy: vi.fn().mockResolvedValue([]),
    upsert: vi
      .fn()
      .mockImplementation(({ create }: { create: Record<string, unknown> }) =>
        Promise.resolve({ id: 'mock-id', ...create }),
      ),
    updateMany: vi.fn().mockResolvedValue({ count: 0 }),
    deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
  }
}

export type MockModel = ReturnType<typeof createModelMock>

export function createMockPrisma() {
  const mockPrisma = {
    profile: createModelMock(),
    project: createModelMock(),
    task: createModelMock(),
    leaveRequest: createModelMock(),
    leaveBalance: createModelMock(),
    expenseClaim: createModelMock(),
    notification: createModelMock(),
    projectMembership: createModelMock(),
    policyDocument: createModelMock(),
    policyAcknowledgement: createModelMock(),
    trainingItem: createModelMock(),
    trainingCompletion: createModelMock(),
    employeeProfile: createModelMock(),
    hRDocument: createModelMock(),
    resourceAllocation: createModelMock(),
    probationReview: createModelMock(),
    timesheetWeek: createModelMock(),
    timesheetEntry: createModelMock(),
    auditEvent: createModelMock(),
    // Transaction support
    $transaction: vi.fn().mockImplementation(async (fn: unknown) => {
      if (typeof fn === 'function') return fn(mockPrisma)
      return Promise.all(fn as Promise<unknown>[])
    }),
  }
  return mockPrisma
}

export type MockPrisma = ReturnType<typeof createMockPrisma>

// ---------------------------------------------------------------------------
// 2. Factory Functions
// ---------------------------------------------------------------------------

export function createMockProfile(overrides: Record<string, unknown> = {}) {
  return {
    id: 'profile-1',
    authUserId: 'auth-1',
    fullName: 'Test User',
    email: 'test@example.com',
    jobTitle: 'Architect',
    status: 'ACTIVE',
    organisationId: 'org-1',
    orgPermission: 'MEMBER',
    managerId: null,
    officeId: null,
    office: null,
    corporateRole: null,
    employeeProfile: null,
    organisation: { name: 'Test Org', id: 'org-1' },
    ...overrides,
  }
}

export function createAdminProfile(overrides: Record<string, unknown> = {}) {
  return createMockProfile({ orgPermission: 'ADMIN', ...overrides })
}

export function createManagerProfile(overrides: Record<string, unknown> = {}) {
  return createMockProfile({
    orgPermission: 'MANAGER',
    id: 'manager-1',
    ...overrides,
  })
}

export function createMockProject(overrides: Record<string, unknown> = {}) {
  return {
    id: 'project-1',
    name: 'Test Project',
    code: 'TP-001',
    organisationId: 'org-1',
    stage: 'CONCEPT',
    healthStatus: 'GREEN',
    status: 'ACTIVE',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

export function createMockTask(overrides: Record<string, unknown> = {}) {
  return {
    id: 'task-1',
    title: 'Test Task',
    projectId: 'project-1',
    ownerId: 'profile-1',
    reviewerId: null,
    status: 'NOT_STARTED',
    priority: 'MEDIUM',
    dueDate: null,
    completedAt: null,
    estimatedHours: null,
    ...overrides,
  }
}

export function createMockLeaveRequest(
  overrides: Record<string, unknown> = {},
) {
  return {
    id: 'leave-1',
    profileId: 'profile-1',
    leaveType: 'ANNUAL',
    startDate: new Date('2026-08-10'),
    endDate: new Date('2026-08-14'),
    days: 5,
    halfDay: false,
    halfDayPeriod: null,
    status: 'DRAFT',
    reason: null,
    approverId: 'manager-1',
    approvedAt: null,
    approvalComment: null,
    profile: { organisationId: 'org-1', managerId: 'manager-1' },
    ...overrides,
  }
}

export function createMockExpenseClaim(
  overrides: Record<string, unknown> = {},
) {
  return {
    id: 'expense-1',
    profileId: 'profile-1',
    amount: 150.0,
    currency: 'GBP',
    description: 'Site visit travel',
    category: 'TRAVEL',
    status: 'DRAFT',
    approverId: 'manager-1',
    approvedAt: null,
    receiptUrl: null,
    profile: { organisationId: 'org-1' },
    ...overrides,
  }
}

export function createMockTimesheetWeek(
  overrides: Record<string, unknown> = {},
) {
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
      organisationId: 'org-1',
      managerId: 'manager-1',
    },
    entries: [],
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// 3. Request Builder
// ---------------------------------------------------------------------------

export function createMockRequest(
  options: {
    method?: string
    url?: string
    body?: unknown
    headers?: Record<string, string>
  } = {},
): NextRequest {
  const { method = 'GET', url = 'http://localhost/api/test', body, headers = {} } = options

  const reqHeaders: Record<string, string> = { ...headers }
  let reqBody: string | undefined

  if (body !== undefined && method !== 'GET' && method !== 'HEAD') {
    reqHeaders['Content-Type'] = 'application/json'
    reqBody = JSON.stringify(body)
  }

  // NextRequest's init type narrows signal to exclude null, which makes
  // the standard RequestInit incompatible. Cast via unknown (test-only).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new NextRequest(url, {
    method,
    headers: reqHeaders,
    body: reqBody,
  } as any)
}

// ---------------------------------------------------------------------------
// 4. Auth Bypass Helper
// ---------------------------------------------------------------------------

/**
 * Returns a mock implementation of the withAuth module.
 *
 * Usage in test files:
 *
 * ```ts
 * import { createMockPrisma, createMockProfile, mockAuthMiddleware } from './helpers/test-utils'
 *
 * const mockPrisma = createMockPrisma()
 * const profile = createMockProfile()
 *
 * vi.mock('@/lib/auth', () => mockAuthMiddleware(mockPrisma))
 * vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma }))
 * ```
 *
 * Then in each test, set `currentProfile` via the returned setter:
 *
 * ```ts
 * const { setCurrentProfile } = await import('@/lib/auth')
 * setCurrentProfile(profile)
 * ```
 */
export function mockAuthMiddleware(mockPrisma: MockPrisma) {
  let currentProfile: ReturnType<typeof createMockProfile> | null = null

  return {
    setCurrentProfile: (profile: ReturnType<typeof createMockProfile> | null) => {
      currentProfile = profile
    },
    withAuth: (
      handler: (
        req: NextRequest,
        context: { profile: ReturnType<typeof createMockProfile>; prisma: MockPrisma },
      ) => Promise<Response>,
    ) => {
      return async (req: NextRequest, routeContext?: unknown) => {
        if (!currentProfile) {
          return Response.json({ error: 'Unauthorized' }, { status: 401 })
        }
        return handler(req, { profile: currentProfile, prisma: mockPrisma })
      }
    },
  }
}

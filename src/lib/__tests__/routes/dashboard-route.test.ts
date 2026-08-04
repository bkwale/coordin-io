import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  createMockProfile,
  createAdminProfile,
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
      project: m(),
      task: m(),
      profile: m(),
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

// Import route AFTER mocks
import { GET } from '@/app/api/dashboard/route'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const mockPrisma = ctx.prisma
const futureDate = new Date('2099-12-31')
const pastDate = new Date('2020-01-01')

function makeTask(overrides: Record<string, unknown> = {}) {
  return {
    id: 'task-1',
    ownerId: 'profile-1',
    reviewerId: null,
    status: 'IN_PROGRESS',
    dueDate: futureDate,
    ...overrides,
  }
}

function makeProject(overrides: Record<string, unknown> = {}) {
  return {
    id: 'project-1',
    name: 'Test Project',
    code: 'TP-001',
    stage: 'CONCEPT',
    healthStatus: 'GREEN',
    status: 'ACTIVE',
    organisationId: 'org-1',
    updatedAt: new Date(),
    tasks: [],
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GET /api/dashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ctx.profileRef.current = createMockProfile()
    mockPrisma.project.findMany.mockResolvedValue([])
    mockPrisma.task.findMany.mockResolvedValue([])
    mockPrisma.task.count.mockResolvedValue(0)
  })

  it('returns profile summary from the authenticated profile', async () => {
    const req = createMockRequest({ url: 'http://localhost/api/dashboard' })
    const res = await GET(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.data.profile).toEqual({
      fullName: 'Test User',
      jobTitle: 'Architect',
      status: 'ACTIVE',
      organisationName: 'Test Org',
    })
  })

  it('returns empty projects array when user has no projects', async () => {
    const req = createMockRequest({ url: 'http://localhost/api/dashboard' })
    const res = await GET(req)
    const json = await res.json()

    expect(json.data.projects).toEqual([])
    expect(json.data.stats.allProjectsHealthy).toBe(false)
  })

  it('returns project summaries with effectiveHealth computed from tasks', async () => {
    const project = makeProject({
      tasks: [
        makeTask({ status: 'IN_PROGRESS', dueDate: futureDate }),
        makeTask({ id: 'task-2', status: 'IN_PROGRESS', dueDate: futureDate }),
      ],
    })
    mockPrisma.project.findMany.mockResolvedValue([project])

    const req = createMockRequest({ url: 'http://localhost/api/dashboard' })
    const res = await GET(req)
    const json = await res.json()

    expect(json.data.projects).toHaveLength(1)
    expect(json.data.projects[0].effectiveHealth).toBe('GREEN')
    expect(json.data.projects[0].id).toBe('project-1')
    expect(json.data.projects[0].name).toBe('Test Project')
  })

  it('computes effectiveHealth as AMBER when overdue tasks exist with GREEN stored health', async () => {
    // 1 overdue out of 5 = 20% (under 25% threshold), so AMBER not RED
    const project = makeProject({
      tasks: [
        makeTask({ id: 't1', status: 'IN_PROGRESS', dueDate: futureDate }),
        makeTask({ id: 't2', status: 'IN_PROGRESS', dueDate: futureDate }),
        makeTask({ id: 't3', status: 'IN_PROGRESS', dueDate: futureDate }),
        makeTask({ id: 't4', status: 'IN_PROGRESS', dueDate: futureDate }),
        makeTask({ id: 't5', status: 'IN_PROGRESS', dueDate: pastDate }), // 1 overdue
      ],
    })
    mockPrisma.project.findMany.mockResolvedValue([project])

    const req = createMockRequest({ url: 'http://localhost/api/dashboard' })
    const res = await GET(req)
    const json = await res.json()

    expect(json.data.projects[0].effectiveHealth).toBe('AMBER')
  })

  it('sets allProjectsHealthy to true when all projects are GREEN', async () => {
    const project = makeProject({
      tasks: [makeTask({ status: 'IN_PROGRESS', dueDate: futureDate })],
    })
    mockPrisma.project.findMany.mockResolvedValue([project])

    const req = createMockRequest({ url: 'http://localhost/api/dashboard' })
    const res = await GET(req)
    const json = await res.json()

    expect(json.data.stats.allProjectsHealthy).toBe(true)
  })

  it('sets allProjectsHealthy to false when any project is not GREEN', async () => {
    const projects = [
      makeProject({
        tasks: [makeTask({ status: 'IN_PROGRESS', dueDate: futureDate })],
      }),
      makeProject({
        id: 'project-2',
        name: 'Project 2',
        tasks: [makeTask({ id: 'task-3', status: 'IN_PROGRESS', dueDate: pastDate })],
      }),
    ]
    mockPrisma.project.findMany.mockResolvedValue(projects)

    const req = createMockRequest({ url: 'http://localhost/api/dashboard' })
    const res = await GET(req)
    const json = await res.json()

    expect(json.data.stats.allProjectsHealthy).toBe(false)
  })

  it('counts myTaskCount only for non-completed tasks owned by user', async () => {
    const project = makeProject({
      tasks: [
        makeTask({ ownerId: 'profile-1', status: 'IN_PROGRESS' }),
        makeTask({ id: 't2', ownerId: 'profile-1', status: 'COMPLETED' }),
        makeTask({ id: 't3', ownerId: 'other-user', status: 'IN_PROGRESS' }),
      ],
    })
    mockPrisma.project.findMany.mockResolvedValue([project])

    const req = createMockRequest({ url: 'http://localhost/api/dashboard' })
    const res = await GET(req)
    const json = await res.json()

    expect(json.data.projects[0].myTaskCount).toBe(1)
  })

  it('counts inReviewTaskCount for tasks where user is the reviewer', async () => {
    const project = makeProject({
      tasks: [
        makeTask({ status: 'READY_FOR_REVIEW', reviewerId: 'profile-1' }),
        makeTask({ id: 't2', status: 'READY_FOR_REVIEW', reviewerId: 'someone-else' }),
        makeTask({ id: 't3', status: 'IN_PROGRESS', reviewerId: 'profile-1' }),
      ],
    })
    mockPrisma.project.findMany.mockResolvedValue([project])

    const req = createMockRequest({ url: 'http://localhost/api/dashboard' })
    const res = await GET(req)
    const json = await res.json()

    expect(json.data.projects[0].inReviewTaskCount).toBe(1)
  })

  it('returns stats from task.count calls', async () => {
    mockPrisma.task.count
      .mockResolvedValueOnce(10)
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(5)

    const req = createMockRequest({ url: 'http://localhost/api/dashboard' })
    const res = await GET(req)
    const json = await res.json()

    expect(json.data.stats.totalTasks).toBe(10)
    expect(json.data.stats.overdueTasks).toBe(2)
    expect(json.data.stats.inReviewTasks).toBe(3)
    expect(json.data.stats.completedThisWeek).toBe(5)
  })

  it('returns urgent tasks mapped to the expected shape', async () => {
    mockPrisma.task.findMany.mockResolvedValue([
      {
        id: 'urgent-1',
        title: 'Fix critical bug',
        status: 'IN_PROGRESS',
        priority: 'CRITICAL',
        dueDate: pastDate,
        estimatedHours: 4,
        project: { id: 'project-1', name: 'Test Project', code: 'TP-001' },
      },
    ])

    const req = createMockRequest({ url: 'http://localhost/api/dashboard' })
    const res = await GET(req)
    const json = await res.json()

    expect(json.data.urgentTasks).toHaveLength(1)
    expect(json.data.urgentTasks[0]).toEqual({
      id: 'urgent-1',
      title: 'Fix critical bug',
      projectId: 'project-1',
      projectName: 'Test Project',
      projectCode: 'TP-001',
      status: 'IN_PROGRESS',
      priority: 'CRITICAL',
      dueDate: pastDate.toISOString(),
      estimatedHours: 4,
    })
  })

  it('admin sees all org projects (no membership filter)', async () => {
    ctx.profileRef.current = createAdminProfile()
    mockPrisma.project.findMany.mockResolvedValue([])

    const req = createMockRequest({ url: 'http://localhost/api/dashboard' })
    await GET(req)

    const findManyCall = mockPrisma.project.findMany.mock.calls[0][0]
    expect(findManyCall.where).toEqual({ organisationId: 'org-1' })
  })

  it('member sees only projects they are a member of', async () => {
    ctx.profileRef.current = createMockProfile({ orgPermission: 'MEMBER' })
    mockPrisma.project.findMany.mockResolvedValue([])

    const req = createMockRequest({ url: 'http://localhost/api/dashboard' })
    await GET(req)

    const findManyCall = mockPrisma.project.findMany.mock.calls[0][0]
    expect(findManyCall.where.memberships).toBeDefined()
    expect(findManyCall.where.memberships.some.profileId).toBe('profile-1')
  })
})

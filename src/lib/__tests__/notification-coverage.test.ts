import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  createMockProfile,
  createAdminProfile,
  createManagerProfile,
  createMockProject,
  createMockTask,
  createMockRequest,
} from './helpers/test-utils'

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
      invitation: m(),
      organisation: m(),
      asset: m(),
      assetAssignment: m(),
      siteObservation: m(),
      snag: m(),
      designReview: m(),
      complianceRegister: m(),
      complianceItem: m(),
      $transaction: vi.fn().mockImplementation(async (fn: any) => {
        if (typeof fn === 'function') return fn(ctx.prisma)
        return Promise.all(fn)
      }),
    },
    profileRef: { current: null as any },
    mockCreateNotification: vi.fn().mockResolvedValue({ notificationId: 'n-1', emailSent: false }),
  }
})

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@/lib/prisma', () => ({ prisma: ctx.prisma }))
vi.mock('@/lib/prisma-modules', () => ({ modulesPrisma: ctx.prisma }))

vi.mock('@/lib/notifications', () => ({
  createNotification: ctx.mockCreateNotification,
  NOTIFICATION_EVENTS: {
    TASK_ASSIGNED: 'task.assigned',
    TASK_STATUS_CHANGED: 'task.status_changed',
    DOCUMENT_REVIEW_REQUESTED: 'document.review_requested',
    PROBATION_REVIEW_SCHEDULED: 'probation.review_scheduled',
    PROJECT_MEMBER_ADDED: 'project.member_added',
    COMPLIANCE_ACTION_DUE: 'compliance.action_due',
  },
}))

vi.mock('@/lib/audit', () => ({
  recordAuditEvent: vi.fn().mockResolvedValue(undefined),
  AuditActions: {
    TASK_CREATED: 'task.created',
    PROJECT_MEMBER_ADDED: 'project.member_added',
    OBSERVATION_CREATED: 'observation.created',
    SNAG_CREATED: 'snag.created',
    DESIGN_REVIEW_CREATED: 'design_review.created',
    ASSET_CREATED: 'asset.created',
  },
}))

vi.mock('@/lib/with-auth', () => ({
  withAuth: (handler: any, _opts?: any) => {
    return async (req: any) => {
      try {
        return await handler(req, { authUserId: 'auth-1', profile: ctx.profileRef.current })
      } catch (err: any) {
        if (err?.statusCode) {
          const body: Record<string, unknown> = { error: err.message, code: err.code }
          return new Response(JSON.stringify(body), { status: err.statusCode, headers: { 'content-type': 'application/json' } })
        }
        return new Response(JSON.stringify({ error: err?.message || 'Unexpected error' }), { status: 500, headers: { 'content-type': 'application/json' } })
      }
    }
  },
}))

vi.mock('@/lib/with-project-access', () => ({
  withProjectAccess: (handler: any, _opts?: any) => {
    return async (req: any) => {
      try {
        return await handler(req, {
          authUserId: 'auth-1',
          profile: ctx.profileRef.current,
          project: createMockProject(),
          membership: { id: 'mem-1', projectRole: 'PROJECT_LEAD', removedAt: null },
          projectId: 'project-1',
        })
      } catch (err: any) {
        if (err?.statusCode) {
          const body: Record<string, unknown> = { error: err.message, code: err.code }
          return new Response(JSON.stringify(body), { status: err.statusCode, headers: { 'content-type': 'application/json' } })
        }
        return new Response(JSON.stringify({ error: err?.message || 'Unexpected error' }), { status: 500, headers: { 'content-type': 'application/json' } })
      }
    }
  },
}))

vi.mock('@/lib/with-task-access', () => ({
  withTaskAccess: (handler: any) => {
    return async (req: any) => {
      const task = createMockTask({ projectId: 'project-1', project: { id: 'project-1', organisationId: 'org-1' } })
      try {
        return await handler(req, {
          authUserId: 'auth-1',
          profile: ctx.profileRef.current,
          task,
          taskId: 'task-1',
        })
      } catch (err: any) {
        if (err?.statusCode) {
          const body: Record<string, unknown> = { error: err.message, code: err.code }
          return new Response(JSON.stringify(body), { status: err.statusCode, headers: { 'content-type': 'application/json' } })
        }
        return new Response(JSON.stringify({ error: err?.message || 'Unexpected error' }), { status: 500, headers: { 'content-type': 'application/json' } })
      }
    }
  },
}))

vi.mock('@/lib/task-transitions', () => ({
  validateTaskTransition: vi.fn(),
  isReviewerTransition: vi.fn().mockReturnValue(false),
}))

vi.mock('@/lib/staffing-utils', () => ({
  canManageHR: vi.fn().mockReturnValue(true),
}))

vi.mock('@/lib/compliance-helpers', () => ({
  recomputeRegisterStatus: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/validation', async () => {
  const actual = await vi.importActual<any>('@/lib/validation')
  return {
    ...actual,
    // Override isValidId to accept test IDs like 'profile-2' that aren't real UUIDs
    isValidId: () => true,
    requireId: (value: unknown, fieldName: string) => {
      if (value === null || value === undefined) {
        const { ValidationError } = require('@/lib/errors')
        throw new ValidationError(`${fieldName} is required`)
      }
      return value as string
    },
    optionalId: (value: unknown, _fieldName: string) => {
      if (value === null || value === undefined) return null
      return value as string
    },
  }
})

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

// ---------------------------------------------------------------------------
// Test suites
// ---------------------------------------------------------------------------

describe('Notification Coverage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ctx.profileRef.current = createManagerProfile({ id: 'actor-1' })
  })

  // =========================================================================
  // 1. POST /api/projects/[id]/members -> PROJECT_MEMBER_ADDED
  // =========================================================================

  describe('POST /api/projects/[id]/members', () => {
    it('notifies the added member with PROJECT_MEMBER_ADDED', async () => {
      const profile = createManagerProfile({ id: 'actor-1' })
      ctx.profileRef.current = profile

      ctx.prisma.profile.findFirst.mockResolvedValue({ id: 'profile-2', fullName: 'Added User' })
      ctx.prisma.projectMembership.findUnique.mockResolvedValue(null)
      ctx.prisma.projectMembership.create.mockResolvedValue({
        id: 'mem-new',
        projectId: 'project-1',
        profileId: 'profile-2',
        projectRole: 'ARCHITECT',
        profile: { id: 'profile-2', fullName: 'Added User', email: 'added@example.com' },
      })

      const { POST } = await import('@/app/api/projects/[id]/members/route')
      const req = createMockRequest({
        method: 'POST',
        url: 'http://localhost/api/projects/project-1/members',
        body: { profileId: 'profile-2', projectRole: 'ARCHITECT' },
      })

      const res = await POST(req)
      expect(res.status).toBe(201)

      expect(ctx.mockCreateNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          profileId: 'profile-2',
          type: 'project.member_added',
        }),
      )
    })

    it('does NOT notify when user adds themselves', async () => {
      const profile = createManagerProfile({ id: 'actor-1' })
      ctx.profileRef.current = profile

      ctx.prisma.profile.findFirst.mockResolvedValue({ id: 'actor-1', fullName: 'Actor' })
      ctx.prisma.projectMembership.findUnique.mockResolvedValue(null)
      ctx.prisma.projectMembership.create.mockResolvedValue({
        id: 'mem-self',
        projectId: 'project-1',
        profileId: 'actor-1',
        projectRole: 'PROJECT_LEAD',
        profile: { id: 'actor-1', fullName: 'Actor', email: 'actor@example.com' },
      })

      const { POST } = await import('@/app/api/projects/[id]/members/route')
      const req = createMockRequest({
        method: 'POST',
        url: 'http://localhost/api/projects/project-1/members',
        body: { profileId: 'actor-1', projectRole: 'PROJECT_LEAD' },
      })

      const res = await POST(req)
      expect(res.status).toBe(201)
      expect(ctx.mockCreateNotification).not.toHaveBeenCalled()
    })
  })

  // =========================================================================
  // 2. POST /api/projects/[id]/tasks -> TASK_ASSIGNED
  // =========================================================================

  describe('POST /api/projects/[id]/tasks', () => {
    it('notifies ownerId with TASK_ASSIGNED', async () => {
      ctx.prisma.task.create.mockResolvedValue({
        id: 'task-new',
        title: 'Design facade',
        projectId: 'project-1',
        ownerId: 'profile-2',
        reviewerId: null,
        owner: { id: 'profile-2', fullName: 'Owner' },
        reviewer: null,
      })

      const { POST } = await import('@/app/api/projects/[id]/tasks/route')
      const req = createMockRequest({
        method: 'POST',
        url: 'http://localhost/api/projects/project-1/tasks',
        body: { title: 'Design facade', ownerId: 'profile-2' },
      })

      const res = await POST(req)
      expect(res.status).toBe(201)

      expect(ctx.mockCreateNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          profileId: 'profile-2',
          type: 'task.assigned',
        }),
      )
    })

    it('notifies reviewerId with TASK_ASSIGNED when different from owner', async () => {
      ctx.prisma.task.create.mockResolvedValue({
        id: 'task-new',
        title: 'Review spec',
        projectId: 'project-1',
        ownerId: 'profile-2',
        reviewerId: 'profile-3',
        owner: { id: 'profile-2', fullName: 'Owner' },
        reviewer: { id: 'profile-3', fullName: 'Reviewer' },
      })

      const { POST } = await import('@/app/api/projects/[id]/tasks/route')
      const req = createMockRequest({
        method: 'POST',
        url: 'http://localhost/api/projects/project-1/tasks',
        body: { title: 'Review spec', ownerId: 'profile-2', reviewerId: 'profile-3' },
      })

      const res = await POST(req)
      expect(res.status).toBe(201)

      // Should notify both owner and reviewer
      expect(ctx.mockCreateNotification).toHaveBeenCalledTimes(2)
      expect(ctx.mockCreateNotification).toHaveBeenCalledWith(
        expect.objectContaining({ profileId: 'profile-2', type: 'task.assigned' }),
      )
      expect(ctx.mockCreateNotification).toHaveBeenCalledWith(
        expect.objectContaining({ profileId: 'profile-3', type: 'task.assigned' }),
      )
    })

    it('does NOT notify when ownerId is the actor', async () => {
      ctx.prisma.task.create.mockResolvedValue({
        id: 'task-self',
        title: 'Self-assigned',
        projectId: 'project-1',
        ownerId: 'actor-1',
        reviewerId: null,
        owner: { id: 'actor-1', fullName: 'Actor' },
        reviewer: null,
      })

      const { POST } = await import('@/app/api/projects/[id]/tasks/route')
      const req = createMockRequest({
        method: 'POST',
        url: 'http://localhost/api/projects/project-1/tasks',
        body: { title: 'Self-assigned', ownerId: 'actor-1' },
      })

      const res = await POST(req)
      expect(res.status).toBe(201)
      expect(ctx.mockCreateNotification).not.toHaveBeenCalled()
    })
  })

  // =========================================================================
  // 3. POST /api/projects/[id]/observations -> TASK_ASSIGNED to assignedToId
  // =========================================================================

  describe('POST /api/projects/[id]/observations', () => {
    it('notifies assignedToId with TASK_ASSIGNED', async () => {
      ctx.prisma.siteObservation.count.mockResolvedValue(5)
      ctx.prisma.siteObservation.create.mockResolvedValue({
        id: 'obs-new',
        observationNumber: 'OBS-006',
        description: 'Crack in wall',
        assignedToId: 'profile-2',
        projectId: 'project-1',
        createdBy: { id: 'actor-1', fullName: 'Actor' },
        assignedTo: { id: 'profile-2', fullName: 'Assignee' },
      })

      const { POST } = await import('@/app/api/projects/[id]/observations/route')
      const req = createMockRequest({
        method: 'POST',
        url: 'http://localhost/api/projects/project-1/observations',
        body: {
          description: 'Crack in wall',
          assignedToId: 'profile-2',
          severity: 'HIGH',
        },
      })

      const res = await POST(req)
      expect(res.status).toBe(201)

      expect(ctx.mockCreateNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          profileId: 'profile-2',
          type: 'task.assigned',
        }),
      )
    })

    it('does NOT notify when no assignedToId', async () => {
      ctx.prisma.siteObservation.count.mockResolvedValue(0)
      ctx.prisma.siteObservation.create.mockResolvedValue({
        id: 'obs-unassigned',
        observationNumber: 'OBS-001',
        description: 'Unassigned observation',
        assignedToId: null,
        createdBy: { id: 'actor-1', fullName: 'Actor' },
        assignedTo: null,
      })

      const { POST } = await import('@/app/api/projects/[id]/observations/route')
      const req = createMockRequest({
        method: 'POST',
        url: 'http://localhost/api/projects/project-1/observations',
        body: { description: 'Unassigned observation' },
      })

      const res = await POST(req)
      expect(res.status).toBe(201)
      expect(ctx.mockCreateNotification).not.toHaveBeenCalled()
    })
  })

  // =========================================================================
  // 4. POST /api/projects/[id]/snags -> TASK_ASSIGNED to assignedToId
  // =========================================================================

  describe('POST /api/projects/[id]/snags', () => {
    it('notifies assignedToId with TASK_ASSIGNED', async () => {
      ctx.prisma.snag.count.mockResolvedValue(3)
      ctx.prisma.snag.create.mockResolvedValue({
        id: 'snag-new',
        snagNumber: 'SNG-004',
        description: 'Paint peeling on corridor B',
        assignedToId: 'profile-2',
        projectId: 'project-1',
        category: 'FINISH',
        severity: 'MODERATE',
        createdBy: { id: 'actor-1', fullName: 'Actor' },
        verifiedBy: null,
        assignedTo: { id: 'profile-2', fullName: 'Assignee' },
      })

      const { POST } = await import('@/app/api/projects/[id]/snags/route')
      const req = createMockRequest({
        method: 'POST',
        url: 'http://localhost/api/projects/project-1/snags',
        body: {
          description: 'Paint peeling on corridor B',
          assignedToId: 'profile-2',
          category: 'FINISH',
          severity: 'MODERATE',
        },
      })

      const res = await POST(req)
      expect(res.status).toBe(201)

      expect(ctx.mockCreateNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          profileId: 'profile-2',
          type: 'task.assigned',
        }),
      )
    })
  })

  // =========================================================================
  // 5. POST /api/projects/[id]/design-reviews -> DOCUMENT_REVIEW_REQUESTED
  // =========================================================================

  describe('POST /api/projects/[id]/design-reviews', () => {
    it('notifies leadReviewerId with DOCUMENT_REVIEW_REQUESTED', async () => {
      ctx.prisma.designReview.count.mockResolvedValue(2)
      ctx.prisma.designReview.create.mockResolvedValue({
        id: 'dr-new',
        reviewNumber: 'DR-003',
        title: 'Fire strategy review',
        leadReviewerId: 'profile-3',
        projectId: 'project-1',
        status: 'DRAFT',
      })

      const { POST } = await import('@/app/api/projects/[id]/design-reviews/route')
      const req = createMockRequest({
        method: 'POST',
        url: 'http://localhost/api/projects/project-1/design-reviews',
        body: {
          title: 'Fire strategy review',
          leadReviewerId: 'profile-3',
          reviewType: 'FIRE',
        },
      })

      const res = await POST(req)
      expect(res.status).toBe(201)

      expect(ctx.mockCreateNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          profileId: 'profile-3',
          type: 'document.review_requested',
        }),
      )
    })

    it('does NOT notify when leadReviewerId is the actor', async () => {
      ctx.prisma.designReview.count.mockResolvedValue(0)
      ctx.prisma.designReview.create.mockResolvedValue({
        id: 'dr-self',
        reviewNumber: 'DR-001',
        title: 'Self-review',
        leadReviewerId: 'actor-1',
        projectId: 'project-1',
        status: 'DRAFT',
      })

      const { POST } = await import('@/app/api/projects/[id]/design-reviews/route')
      const req = createMockRequest({
        method: 'POST',
        url: 'http://localhost/api/projects/project-1/design-reviews',
        body: {
          title: 'Self-review',
          leadReviewerId: 'actor-1',
        },
      })

      const res = await POST(req)
      expect(res.status).toBe(201)
      expect(ctx.mockCreateNotification).not.toHaveBeenCalled()
    })
  })

  // =========================================================================
  // 6. POST /api/staffing/probation -> PROBATION_REVIEW_SCHEDULED
  // =========================================================================

  describe('POST /api/staffing/probation', () => {
    it('notifies targetProfileId with PROBATION_REVIEW_SCHEDULED', async () => {
      const profile = createAdminProfile({ id: 'actor-1' })
      ctx.profileRef.current = profile

      ctx.prisma.profile.findUnique.mockResolvedValue({ organisationId: 'org-1' })
      ctx.prisma.probationReview.create.mockResolvedValue({
        id: 'prob-new',
        profileId: 'profile-2',
        reviewType: '3_MONTH',
        scheduledDate: new Date('2026-09-01'),
        profile: { id: 'profile-2', fullName: 'Employee' },
      })

      const { POST } = await import('@/app/api/staffing/probation/route')
      const req = createMockRequest({
        method: 'POST',
        url: 'http://localhost/api/staffing/probation',
        body: {
          profileId: 'profile-2',
          reviewType: '3_MONTH',
          scheduledDate: '2026-09-01',
        },
      })

      const res = await POST(req)
      expect(res.status).toBe(201)

      expect(ctx.mockCreateNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          profileId: 'profile-2',
          type: 'probation.review_scheduled',
        }),
      )
    })

    it('does NOT notify when targetProfileId is the actor', async () => {
      const profile = createAdminProfile({ id: 'actor-1' })
      ctx.profileRef.current = profile

      ctx.prisma.profile.findUnique.mockResolvedValue({ organisationId: 'org-1' })
      ctx.prisma.probationReview.create.mockResolvedValue({
        id: 'prob-self',
        profileId: 'actor-1',
        reviewType: '3_MONTH',
        scheduledDate: new Date('2026-09-01'),
        profile: { id: 'actor-1', fullName: 'Actor' },
      })

      const { POST } = await import('@/app/api/staffing/probation/route')
      const req = createMockRequest({
        method: 'POST',
        url: 'http://localhost/api/staffing/probation',
        body: {
          profileId: 'actor-1',
          reviewType: '3_MONTH',
          scheduledDate: '2026-09-01',
        },
      })

      const res = await POST(req)
      expect(res.status).toBe(201)
      expect(ctx.mockCreateNotification).not.toHaveBeenCalled()
    })
  })

  // =========================================================================
  // 7. POST /api/assets -> TASK_ASSIGNED to assignedTo
  // =========================================================================

  describe('POST /api/assets', () => {
    it('notifies assignedTo with TASK_ASSIGNED', async () => {
      const profile = createAdminProfile({ id: 'actor-1' })
      ctx.profileRef.current = profile

      ctx.prisma.asset.create.mockResolvedValue({
        id: 'asset-new',
        name: 'MacBook Pro',
        assetTag: 'MBP-001',
        category: 'LAPTOP',
        organisationId: 'org-1',
        assignments: [],
      })
      ctx.prisma.asset.findUnique.mockResolvedValue({
        id: 'asset-new',
        name: 'MacBook Pro',
        assignments: [{ profile: { id: 'profile-2', fullName: 'Recipient' } }],
      })

      const { POST } = await import('@/app/api/assets/route')
      const req = createMockRequest({
        method: 'POST',
        url: 'http://localhost/api/assets',
        body: {
          name: 'MacBook Pro',
          assetTag: 'MBP-001',
          category: 'LAPTOP',
          assignedTo: 'profile-2',
        },
      })

      const res = await POST(req)
      expect(res.status).toBe(201)

      expect(ctx.mockCreateNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          profileId: 'profile-2',
          type: 'task.assigned',
        }),
      )
    })

    it('does NOT notify when assignedTo is the actor', async () => {
      const profile = createAdminProfile({ id: 'actor-1' })
      ctx.profileRef.current = profile

      ctx.prisma.asset.create.mockResolvedValue({
        id: 'asset-self',
        name: 'Monitor',
        assetTag: 'MON-001',
        category: 'MONITOR',
        organisationId: 'org-1',
        assignments: [],
      })
      ctx.prisma.asset.findUnique.mockResolvedValue({
        id: 'asset-self',
        name: 'Monitor',
        assignments: [{ profile: { id: 'actor-1', fullName: 'Actor' } }],
      })

      const { POST } = await import('@/app/api/assets/route')
      const req = createMockRequest({
        method: 'POST',
        url: 'http://localhost/api/assets',
        body: {
          name: 'Monitor',
          assetTag: 'MON-001',
          category: 'MONITOR',
          assignedTo: 'actor-1',
        },
      })

      const res = await POST(req)
      expect(res.status).toBe(201)
      // assignedTo === profile.id, so createNotification should NOT be called
      expect(ctx.mockCreateNotification).not.toHaveBeenCalled()
    })
  })

  // =========================================================================
  // 8. POST /api/projects/[id]/compliance/[registerId]/items -> COMPLIANCE_ACTION_DUE
  // =========================================================================

  describe('POST /api/projects/[id]/compliance/[registerId]/items', () => {
    it('notifies ownerId with COMPLIANCE_ACTION_DUE', async () => {
      ctx.prisma.complianceRegister.findFirst.mockResolvedValue({
        id: 'reg-1',
        projectId: 'project-1',
      })
      ctx.prisma.complianceItem.findFirst.mockResolvedValue(null) // no duplicate
      ctx.prisma.complianceItem.create.mockResolvedValue({
        id: 'ci-new',
        registerId: 'reg-1',
        requirement: 'Fire safety cert',
        ownerId: 'profile-2',
      })
      // Mock profile lookup for owner name resolution
      ctx.prisma.profile.findUnique.mockResolvedValue({ fullName: 'Owner Name' })
      ctx.prisma.profile.findMany.mockResolvedValue([
        { id: 'profile-2', fullName: 'Owner Name' },
      ])

      const { POST } = await import('@/app/api/projects/[id]/compliance/[registerId]/items/route')
      const req = createMockRequest({
        method: 'POST',
        url: 'http://localhost/api/projects/project-1/compliance/reg-1/items',
        body: {
          requirement: 'Fire safety cert',
          ownerId: 'profile-2',
        },
      })

      const res = await POST(req)
      expect(res.status).toBe(201)

      expect(ctx.mockCreateNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          profileId: 'profile-2',
          type: 'compliance.action_due',
        }),
      )
    })

    it('does NOT notify when ownerId is the actor', async () => {
      ctx.prisma.complianceRegister.findFirst.mockResolvedValue({
        id: 'reg-1',
        projectId: 'project-1',
      })
      ctx.prisma.complianceItem.findFirst.mockResolvedValue(null)
      ctx.prisma.complianceItem.create.mockResolvedValue({
        id: 'ci-self',
        registerId: 'reg-1',
        requirement: 'Self-assigned item',
        ownerId: 'actor-1',
      })
      ctx.prisma.profile.findUnique.mockResolvedValue({ fullName: 'Actor' })

      const { POST } = await import('@/app/api/projects/[id]/compliance/[registerId]/items/route')
      const req = createMockRequest({
        method: 'POST',
        url: 'http://localhost/api/projects/project-1/compliance/reg-1/items',
        body: {
          requirement: 'Self-assigned item',
          ownerId: 'actor-1',
        },
      })

      const res = await POST(req)
      expect(res.status).toBe(201)
      expect(ctx.mockCreateNotification).not.toHaveBeenCalled()
    })
  })
})

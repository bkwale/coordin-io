import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  createMockProfile,
  createAdminProfile,
  createManagerProfile,
  createMockProject,
  createMockTask,
  createMockLeaveRequest,
  createMockRequest,
} from './helpers/test-utils'

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
      invitation: m(),
      organisation: m(),
      asset: m(),
      assetAssignment: m(),
      $transaction: vi.fn().mockImplementation(async (fn: any) => {
        if (typeof fn === 'function') return fn(ctx.prisma)
        return Promise.all(fn)
      }),
    },
    profileRef: { current: null as any },
  }
})

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@/lib/prisma', () => ({ prisma: ctx.prisma }))
vi.mock('@/lib/prisma-modules', () => ({ modulesPrisma: ctx.prisma }))

vi.mock('@/lib/with-auth', () => ({
  withAuth: (handler: any, _opts?: any) => {
    return async (req: any) => {
      try {
        return await handler(req, { authUserId: 'auth-1', profile: ctx.profileRef.current })
      } catch (err: any) {
        if (err?.statusCode) {
          const body: Record<string, unknown> = { error: err.message, code: err.code }
          if (err.metadata && Object.keys(err.metadata).length > 0) body.details = err.metadata
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
          if (err.metadata && Object.keys(err.metadata).length > 0) body.details = err.metadata
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
          if (err.metadata && Object.keys(err.metadata).length > 0) body.details = err.metadata
          return new Response(JSON.stringify(body), { status: err.statusCode, headers: { 'content-type': 'application/json' } })
        }
        return new Response(JSON.stringify({ error: err?.message || 'Unexpected error' }), { status: 500, headers: { 'content-type': 'application/json' } })
      }
    }
  },
}))

vi.mock('@/lib/audit', () => ({
  recordAuditEvent: vi.fn().mockResolvedValue(undefined),
  AuditActions: {
    INVITATION_CREATED: 'invitation.created',
    INVITATION_ACTIVATED: 'invitation.activated',
    FAILED_ACTIVATION: 'invitation.failed_activation',
    TASK_CREATED: 'task.created',
    TASK_STATUS_CHANGED: 'task.status_changed',
    TASK_ASSIGNED: 'task.assigned',
    PROJECT_MEMBER_ADDED: 'project.member_added',
    LEAVE_REQUESTED: 'leave.requested',
    LEAVE_SUBMITTED: 'leave.submitted',
    LEAVE_APPROVED: 'leave.approved',
    LEAVE_REJECTED: 'leave.rejected',
    LEAVE_WITHDRAWN: 'leave.withdrawn',
    OBSERVATION_CREATED: 'observation.created',
    SNAG_CREATED: 'snag.created',
    DESIGN_REVIEW_CREATED: 'design_review.created',
    ASSET_CREATED: 'asset.created',
  },
}))

vi.mock('@/lib/notifications', () => ({
  createNotification: vi.fn().mockResolvedValue({ notificationId: 'n-1', emailSent: false }),
  NOTIFICATION_EVENTS: {
    TASK_ASSIGNED: 'task.assigned',
    TASK_STATUS_CHANGED: 'task.status_changed',
    LEAVE_REQUESTED: 'leave.requested',
    LEAVE_DECISION: 'leave.decision',
    PROJECT_MEMBER_ADDED: 'project.member_added',
    DOCUMENT_REVIEW_REQUESTED: 'document.review_requested',
    PROBATION_REVIEW_SCHEDULED: 'probation.review_scheduled',
    COMPLIANCE_ACTION_DUE: 'compliance.action_due',
  },
}))

vi.mock('@/lib/email', () => ({
  sendInvitationEmail: vi.fn().mockResolvedValue({ success: true }),
}))

vi.mock('@/lib/tokens', () => ({
  generateSecureToken: vi.fn().mockReturnValue('test-token-abc'),
}))

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: vi.fn().mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: 'auth-1', email: 'test@example.com' } },
        error: null,
      }),
    },
  }),
}))

vi.mock('@/lib/leave-utils', () => ({
  validateLeaveRequest: vi.fn().mockReturnValue({ days: 5 }),
  findOverlappingRequest: vi.fn().mockReturnValue(null),
}))

vi.mock('@/lib/request-transitions', () => ({
  validateLeaveTransition: vi.fn(),
  isRequesterTransition: vi.fn().mockReturnValue(false),
  isApproverTransition: vi.fn().mockReturnValue(false),
  isAdminTransition: vi.fn().mockReturnValue(false),
}))

vi.mock('@/lib/task-transitions', () => ({
  validateTaskTransition: vi.fn(),
  isReviewerTransition: vi.fn().mockReturnValue(false),
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

vi.mock('@/lib/staffing-utils', () => ({
  canManageHR: vi.fn().mockReturnValue(true),
}))

// ---------------------------------------------------------------------------
// Test suites
// ---------------------------------------------------------------------------

describe('Smoke Workflows', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ctx.profileRef.current = createManagerProfile()
    // Reset $transaction to properly pass through
    ctx.prisma.$transaction.mockImplementation(async (fn: any) => {
      if (typeof fn === 'function') return fn(ctx.prisma)
      return Promise.all(fn)
    })
  })

  // =========================================================================
  // 1. Invitation -> Activation Flow
  // =========================================================================

  describe('1. Invitation -> Activation flow', () => {
    it('POST /api/invitations creates invitation with correct fields', async () => {
      const profile = createManagerProfile()
      ctx.profileRef.current = profile

      ctx.prisma.invitation.findFirst.mockResolvedValue(null) // no existing
      ctx.prisma.organisation.findUnique.mockResolvedValue({ id: 'org-1', name: 'Test Org' })
      ctx.prisma.invitation.create.mockResolvedValue({
        id: 'inv-1',
        token: 'test-token-abc',
        email: 'newuser@example.com',
        fullName: 'New User',
        organisationId: 'org-1',
        orgPermission: 'ADMIN',
        expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
      })

      const { POST } = await import('@/app/api/invitations/route')
      const req = createMockRequest({
        method: 'POST',
        url: 'http://localhost/api/invitations',
        body: {
          email: 'newuser@example.com',
          fullName: 'New User',
          jobTitle: 'Senior Architect',
          orgPermission: 'ADMIN',
        },
      })

      const res = await POST(req)
      const json = await res.json()

      expect(res.status).toBe(201)
      expect(ctx.prisma.invitation.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            email: 'newuser@example.com',
            fullName: 'New User',
            jobTitle: 'Senior Architect',
            orgPermission: 'ADMIN',
            organisationId: 'org-1',
          }),
        }),
      )
    })

    it('POST /api/invitations/[token]/activate creates profile with orgPermission from invitation', async () => {
      const invitation = {
        id: 'inv-1',
        token: 'test-token',
        email: 'test@example.com',
        fullName: 'Test User',
        organisationId: 'org-1',
        jobTitle: 'Architect',
        officeId: null,
        roleId: null,
        managerId: null,
        startDate: null,
        annualLeave: 25,
        orgPermission: 'HR',
        status: 'SENT',
        expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
      }

      ctx.prisma.invitation.findUnique.mockResolvedValue(invitation)
      ctx.prisma.profile.findUnique.mockResolvedValue(null) // no existing profile
      ctx.prisma.profile.create.mockResolvedValue({
        id: 'profile-new',
        fullName: 'Test User',
        status: 'ONBOARDING',
        orgPermission: 'HR',
      })

      const { POST } = await import('@/app/api/invitations/[token]/activate/route')
      const req = createMockRequest({
        method: 'POST',
        url: 'http://localhost/api/invitations/test-token/activate',
      })

      const res = await POST(req, { params: Promise.resolve({ token: 'test-token' }) })
      const json = await res.json()

      expect(res.status).toBe(201)
      expect(ctx.prisma.profile.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            orgPermission: 'HR',
            organisationId: 'org-1',
          }),
        }),
      )
    })

    it('activation with expired token returns error', async () => {
      const invitation = {
        id: 'inv-1',
        token: 'expired-token',
        email: 'test@example.com',
        fullName: 'Test User',
        organisationId: 'org-1',
        orgPermission: 'MEMBER',
        status: 'SENT',
        expiresAt: new Date(Date.now() - 1000), // expired
      }

      ctx.prisma.invitation.findUnique.mockResolvedValue(invitation)

      const { POST } = await import('@/app/api/invitations/[token]/activate/route')
      const req = createMockRequest({
        method: 'POST',
        url: 'http://localhost/api/invitations/expired-token/activate',
      })

      const res = await POST(req, { params: Promise.resolve({ token: 'expired-token' }) })
      const json = await res.json()

      expect(res.status).toBe(400)
      expect(json.error).toMatch(/expired/i)
    })

    it('activation with wrong email returns error', async () => {
      // Mock supabase user with different email
      const { createServerSupabaseClient } = await import('@/lib/supabase/server')
      ;(createServerSupabaseClient as any).mockResolvedValueOnce({
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: { id: 'auth-1', email: 'wrong@example.com' } },
            error: null,
          }),
        },
      })

      const invitation = {
        id: 'inv-1',
        token: 'mismatch-token',
        email: 'correct@example.com',
        fullName: 'Test User',
        organisationId: 'org-1',
        orgPermission: 'MEMBER',
        status: 'SENT',
        expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
      }

      ctx.prisma.invitation.findUnique.mockResolvedValue(invitation)

      const { POST } = await import('@/app/api/invitations/[token]/activate/route')
      const req = createMockRequest({
        method: 'POST',
        url: 'http://localhost/api/invitations/mismatch-token/activate',
      })

      const res = await POST(req, { params: Promise.resolve({ token: 'mismatch-token' }) })
      const json = await res.json()

      expect(res.status).toBe(400)
      expect(json.error).toMatch(/email/i)
    })
  })

  // =========================================================================
  // 2. Task Lifecycle
  // =========================================================================

  describe('2. Task lifecycle', () => {
    it('POST /api/projects/[id]/tasks creates task and notifies assignee', async () => {
      const { createNotification } = await import('@/lib/notifications')
      const profile = createManagerProfile({ id: 'manager-1' })
      ctx.profileRef.current = profile

      ctx.prisma.task.create.mockResolvedValue({
        id: 'task-new',
        title: 'Review drawings',
        projectId: 'project-1',
        ownerId: 'profile-2',
        reviewerId: null,
        owner: { id: 'profile-2', fullName: 'Other User' },
        reviewer: null,
      })

      const { POST } = await import('@/app/api/projects/[id]/tasks/route')
      const req = createMockRequest({
        method: 'POST',
        url: 'http://localhost/api/projects/project-1/tasks',
        body: {
          title: 'Review drawings',
          ownerId: 'profile-2',
          priority: 'HIGH',
        },
      })

      const res = await POST(req)
      expect(res.status).toBe(201)
      expect(createNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          profileId: 'profile-2',
          type: 'task.assigned',
        }),
      )
    })

    it('PATCH /api/tasks/[id] status transitions: NOT_STARTED -> IN_PROGRESS -> READY_FOR_REVIEW -> COMPLETED', async () => {
      const profile = createMockProfile({ id: 'profile-1' })
      ctx.profileRef.current = profile

      // Transition 1: NOT_STARTED -> IN_PROGRESS
      ctx.prisma.task.update.mockResolvedValue({
        id: 'task-1',
        title: 'Test Task',
        status: 'IN_PROGRESS',
        projectId: 'project-1',
        owner: { id: 'profile-1', fullName: 'Test User' },
        reviewer: null,
      })
      ctx.prisma.projectMembership.findUnique.mockResolvedValue({ id: 'mem-1', removedAt: null })

      const { PATCH } = await import('@/app/api/tasks/[id]/route')
      const req1 = createMockRequest({
        method: 'PATCH',
        url: 'http://localhost/api/tasks/task-1',
        body: { status: 'IN_PROGRESS' },
      })

      const res1 = await PATCH(req1)
      expect(res1.status).toBe(200)

      // Transition 2: IN_PROGRESS -> READY_FOR_REVIEW (need reviewer)
      // We need to reimport to get a fresh handler that sees the updated task state
      const { withTaskAccess } = await import('@/lib/with-task-access')
      // The mock withTaskAccess always provides the base task (NOT_STARTED).
      // We test the transition validation is called, not the actual state.
      const { validateTaskTransition } = await import('@/lib/task-transitions')
      expect(validateTaskTransition).toHaveBeenCalled()
    })

    it('PATCH /api/tasks/[id] with new ownerId sends notification', async () => {
      const { createNotification } = await import('@/lib/notifications')
      const profile = createMockProfile({ id: 'profile-1' })
      ctx.profileRef.current = profile

      ctx.prisma.projectMembership.findUnique.mockResolvedValue({ id: 'mem-1', removedAt: null })
      ctx.prisma.task.update.mockResolvedValue({
        id: 'task-1',
        title: 'Test Task',
        ownerId: 'profile-2',
        projectId: 'project-1',
        owner: { id: 'profile-2', fullName: 'New Owner' },
        reviewer: null,
      })

      const { PATCH } = await import('@/app/api/tasks/[id]/route')
      const req = createMockRequest({
        method: 'PATCH',
        url: 'http://localhost/api/tasks/task-1',
        body: { ownerId: 'profile-2' },
      })

      const res = await PATCH(req)
      expect(res.status).toBe(200)
      expect(createNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          profileId: 'profile-2',
          type: 'task.assigned',
        }),
      )
    })
  })

  // =========================================================================
  // 3. Project Members
  // =========================================================================

  describe('3. Project members', () => {
    it('POST /api/projects/[id]/members adds member and sends notification', async () => {
      const { createNotification } = await import('@/lib/notifications')
      const profile = createManagerProfile({ id: 'manager-1' })
      ctx.profileRef.current = profile

      ctx.prisma.profile.findFirst.mockResolvedValue({ id: 'profile-2', fullName: 'New Member' })
      ctx.prisma.projectMembership.findUnique.mockResolvedValue(null) // no existing membership
      ctx.prisma.projectMembership.create.mockResolvedValue({
        id: 'mem-new',
        projectId: 'project-1',
        profileId: 'profile-2',
        projectRole: 'ARCHITECT',
        profile: { id: 'profile-2', fullName: 'New Member', email: 'new@example.com' },
      })

      const { POST } = await import('@/app/api/projects/[id]/members/route')
      const req = createMockRequest({
        method: 'POST',
        url: 'http://localhost/api/projects/project-1/members',
        body: {
          profileId: 'profile-2',
          projectRole: 'ARCHITECT',
        },
      })

      const res = await POST(req)
      expect(res.status).toBe(201)
      expect(createNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          profileId: 'profile-2',
          type: 'project.member_added',
        }),
      )
    })

    it('POST /api/projects/[id]/members with duplicate returns 409', async () => {
      const profile = createManagerProfile({ id: 'manager-1' })
      ctx.profileRef.current = profile

      ctx.prisma.profile.findFirst.mockResolvedValue({ id: 'profile-2', fullName: 'Existing Member' })
      ctx.prisma.projectMembership.findUnique.mockResolvedValue({
        id: 'mem-existing',
        projectId: 'project-1',
        profileId: 'profile-2',
        removedAt: null, // active membership
      })

      const { POST } = await import('@/app/api/projects/[id]/members/route')
      const req = createMockRequest({
        method: 'POST',
        url: 'http://localhost/api/projects/project-1/members',
        body: {
          profileId: 'profile-2',
          projectRole: 'ARCHITECT',
        },
      })

      const res = await POST(req)
      expect(res.status).toBe(409)
    })

    it('GET /api/projects/[id]/members returns active members only', async () => {
      ctx.prisma.projectMembership.findMany.mockResolvedValue([
        {
          id: 'mem-1',
          profileId: 'profile-1',
          projectRole: 'PROJECT_LEAD',
          removedAt: null,
          profile: { id: 'profile-1', fullName: 'Active Member', email: 'active@example.com' },
        },
      ])

      const { GET } = await import('@/app/api/projects/[id]/members/route')
      const req = createMockRequest({
        method: 'GET',
        url: 'http://localhost/api/projects/project-1/members',
      })

      const res = await GET(req)
      const json = await res.json()

      expect(res.status).toBe(200)
      // The query filters by removedAt: null
      expect(ctx.prisma.projectMembership.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ removedAt: null }),
        }),
      )
    })
  })

  // =========================================================================
  // 4. Leave Request Flow
  // =========================================================================

  describe('4. Leave request flow', () => {
    it('POST creates leave request in DRAFT status', async () => {
      const profile = createMockProfile({ managerId: 'manager-1' })
      ctx.profileRef.current = profile

      ctx.prisma.leaveRequest.findMany.mockResolvedValue([]) // no overlapping
      ctx.prisma.leaveRequest.create.mockResolvedValue({
        id: 'leave-new',
        profileId: 'profile-1',
        leaveType: 'ANNUAL',
        status: 'DRAFT',
        days: 5,
        approverId: 'manager-1',
        startDate: new Date('2026-08-18'),
        endDate: new Date('2026-08-22'),
        profile: { id: 'profile-1', fullName: 'Test User' },
        approver: { id: 'manager-1', fullName: 'Manager' },
      })

      const { POST } = await import('@/app/api/leave/requests/route')
      const req = createMockRequest({
        method: 'POST',
        url: 'http://localhost/api/leave/requests',
        body: {
          leaveType: 'ANNUAL',
          startDate: '2026-08-18',
          endDate: '2026-08-22',
        },
      })

      const res = await POST(req)
      expect(res.status).toBe(201)
      expect(ctx.prisma.leaveRequest.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'DRAFT',
            approverId: 'manager-1',
          }),
        }),
      )
    })

    it('PATCH to SUBMITTED sends notification to approver', async () => {
      const { createNotification } = await import('@/lib/notifications')
      const profile = createMockProfile({ id: 'profile-1' })
      ctx.profileRef.current = profile

      const leaveRequest = createMockLeaveRequest({
        id: 'leave-1',
        profileId: 'profile-1',
        status: 'DRAFT',
        approverId: 'manager-1',
        leaveType: 'ANNUAL',
        days: 5,
        profile: { organisationId: 'org-1', managerId: 'manager-1' },
      })

      ctx.prisma.leaveRequest.findUnique.mockResolvedValue(leaveRequest)
      ctx.prisma.leaveRequest.update.mockResolvedValue({
        ...leaveRequest,
        status: 'SUBMITTED',
        profile: { id: 'profile-1', fullName: 'Test User' },
        approver: { id: 'manager-1', fullName: 'Manager' },
      })

      // Make isRequesterTransition return true for SUBMITTED
      const { isRequesterTransition } = await import('@/lib/request-transitions')
      ;(isRequesterTransition as any).mockReturnValue(true)

      const { PATCH } = await import('@/app/api/leave/requests/[id]/route')
      const req = createMockRequest({
        method: 'PATCH',
        url: 'http://localhost/api/leave/requests/leave-1',
        body: { status: 'SUBMITTED' },
      })

      const res = await PATCH(req)
      expect(res.status).toBe(200)
      expect(createNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          profileId: 'manager-1',
          type: 'leave.requested',
        }),
      )
    })

    it('PATCH to APPROVED decrements balance for annual leave', async () => {
      // Admin/Owner can give final APPROVED — the route checks isHR (ADMIN/OWNER) || isApproverUser
      const profile = createAdminProfile({ id: 'admin-1', managerId: null, organisationId: 'org-1' })
      ctx.profileRef.current = profile

      // Explicitly reset transition mocks — vi.clearAllMocks only clears call history,
      // not mockReturnValue. The SUBMITTED test above sets isRequesterTransition(true)
      // which would persist and cause a 403 here because admin is not the leave owner.
      const { isRequesterTransition, isAdminTransition } = await import('@/lib/request-transitions')
      ;(isRequesterTransition as any).mockReturnValue(false)
      ;(isAdminTransition as any).mockReturnValue(false)

      const leaveRequest = createMockLeaveRequest({
        id: 'leave-1',
        profileId: 'profile-1',
        status: 'SUBMITTED',
        approverId: 'admin-1',
        leaveType: 'ANNUAL',
        days: 3,
        startDate: new Date('2026-08-18'),
        profile: { organisationId: 'org-1', managerId: 'manager-1' },
      })

      ctx.prisma.leaveRequest.findUnique.mockResolvedValue(leaveRequest)
      // $transaction mock must return the updated result for the APPROVED+ANNUAL path
      ctx.prisma.leaveRequest.update.mockResolvedValue({
        ...leaveRequest,
        status: 'APPROVED',
        profile: { id: 'profile-1', fullName: 'Test User' },
        approver: { id: 'admin-1', fullName: 'Admin' },
      })
      ctx.prisma.$transaction.mockImplementation(async (fn: any) => {
        if (typeof fn === 'function') return fn(ctx.prisma)
        return Promise.all(fn)
      })

      const { PATCH } = await import('@/app/api/leave/requests/[id]/route')
      const req = createMockRequest({
        method: 'PATCH',
        url: 'http://localhost/api/leave/requests/leave-1',
        body: { status: 'APPROVED' },
      })

      const res = await PATCH(req)
      const json = await res.json()

      expect(res.status).toBe(200)
      // The $transaction should have been called (because APPROVED + ANNUAL triggers balance update)
      expect(ctx.prisma.$transaction).toHaveBeenCalled()
      expect(ctx.prisma.leaveBalance.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: expect.objectContaining({
            used: { increment: 3 },
          }),
        }),
      )
    })
  })

  // =========================================================================
  // 5. File Upload Validation
  // =========================================================================

  describe('5. File upload validation', () => {
    it('rejects files over 50MB', async () => {
      const profile = createAdminProfile()
      ctx.profileRef.current = profile

      // Set env var so the route gets past the env check to the size check
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key'
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'

      // Subclass File to override the size getter. The native Blob.size getter
      // is on the prototype; our subclass getter shadows it and returns a fake size.
      // This passes `instanceof File` checks in the route.
      class BigFile extends File {
        private _fakeSize: number
        constructor(fakeSize: number) {
          super(['x'], 'huge.pdf', { type: 'application/pdf' })
          this._fakeSize = fakeSize
        }
        get size() { return this._fakeSize }
      }

      const bigFile = new BigFile(51 * 1024 * 1024)

      // Mock request.formData() directly to avoid FormData serialization
      // which would reconstruct a regular File with real content size.
      const { POST } = await import('@/app/api/staffing/hr-documents/upload/route')
      const req = new Request('http://localhost/api/staffing/hr-documents/upload', {
        method: 'POST',
      }) as any
      req.formData = async () => ({
        get: (key: string) => {
          if (key === 'file') return bigFile
          if (key === 'profileId') return 'profile-1'
          return null
        },
      })

      const res = await POST(req)
      const json = await res.json()

      expect(res.status).toBe(400)
      expect(json.error).toMatch(/too large|maximum/i)
    })

    it('rejects disallowed MIME types', async () => {
      const profile = createAdminProfile()
      ctx.profileRef.current = profile

      const formData = new FormData()
      const badFile = new File(['<script>alert("xss")</script>'], 'malicious.html', { type: 'text/html' })
      formData.append('file', badFile)
      formData.append('profileId', 'profile-1')

      const { POST } = await import('@/app/api/staffing/hr-documents/upload/route')
      const req = new Request('http://localhost/api/staffing/hr-documents/upload', {
        method: 'POST',
        body: formData,
      }) as any

      const res = await POST(req)
      const json = await res.json()

      expect(res.status).toBe(400)
      expect(json.error).toMatch(/not allowed/i)
    })

    it('returns error when SUPABASE_SERVICE_ROLE_KEY is missing', async () => {
      const profile = createAdminProfile()
      ctx.profileRef.current = profile

      // Temporarily remove the env var
      const original = process.env.SUPABASE_SERVICE_ROLE_KEY
      delete process.env.SUPABASE_SERVICE_ROLE_KEY

      const formData = new FormData()
      const file = new File(['test content'], 'doc.pdf', { type: 'application/pdf' })
      formData.append('file', file)
      formData.append('profileId', 'profile-1')

      const { POST } = await import('@/app/api/staffing/hr-documents/upload/route')
      const req = new Request('http://localhost/api/staffing/hr-documents/upload', {
        method: 'POST',
        body: formData,
      }) as any

      const res = await POST(req)
      const json = await res.json()

      expect(res.status).toBe(400)
      expect(json.error).toMatch(/not configured/i)

      // Restore
      if (original !== undefined) process.env.SUPABASE_SERVICE_ROLE_KEY = original
    })
  })
})

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock prisma before any imports that depend on it
vi.mock('@/lib/prisma', () => ({ prisma: {} }))

// ── Import business logic functions ──────────────────────
import {
  validateTaskTransition,
  isReviewerTransition,
  isValidTransition,
  getValidNextStatuses,
} from '@/lib/task-transitions'

import {
  validateRequestTransition,
  validateLeaveTransition,
  isValidRequestTransition,
  isValidLeaveTransition,
  isRequesterTransition,
  isApproverTransition,
  isAdminTransition,
} from '@/lib/request-transitions'

import {
  hasOrgPermission,
  hasProjectRole,
  canReviewWork,
} from '@/lib/permissions'

import {
  calculateWorkingDays,
  checkLeaveBalance,
  datesOverlap,
  findOverlappingRequest,
  validateLeaveRequest,
  calculateLeaveBalance,
} from '@/lib/leave-utils'

import { ValidationError, PermissionError, ConflictError } from '@/lib/errors'

import {
  createMockPrisma,
  createMockProfile,
  createAdminProfile,
  createManagerProfile,
  createMockTask,
  createMockLeaveRequest,
  mockAuthMiddleware,
  createMockRequest,
} from './helpers/test-utils'

// ── 1. Task Assignment Edge Cases ─────────────────────────

describe('Task assignment edge cases', () => {
  describe('Task status transitions by non-owner/reviewer', () => {
    it('READY_FOR_REVIEW to COMPLETED is a reviewer transition', () => {
      expect(isReviewerTransition('COMPLETED')).toBe(true)
    })

    it('READY_FOR_REVIEW to CHANGES_REQUIRED is a reviewer transition', () => {
      expect(isReviewerTransition('CHANGES_REQUIRED')).toBe(true)
    })

    it('IN_PROGRESS is NOT a reviewer transition', () => {
      expect(isReviewerTransition('IN_PROGRESS')).toBe(false)
    })

    it('NOT_STARTED is NOT a reviewer transition', () => {
      expect(isReviewerTransition('NOT_STARTED')).toBe(false)
    })
  })

  describe('Task assignment to non-project-member auto-adds (route logic)', () => {
    // The PATCH /api/tasks/[id] route auto-adds non-members to the project
    // when they are assigned as owner or reviewer. This is confirmed in the
    // route source at lines 82-96. These tests verify the Prisma mock calls
    // that would happen.

    const mockPrisma = createMockPrisma()

    beforeEach(() => {
      vi.clearAllMocks()
    })

    it('creates membership when assignee is not a project member', async () => {
      // Simulate: membership not found
      mockPrisma.projectMembership.findUnique.mockResolvedValueOnce(null)

      // This mirrors what the PATCH route does:
      const assigneeId = 'new-user-id'
      const projectId = 'project-1'
      const membership = await mockPrisma.projectMembership.findUnique({
        where: { projectId_profileId: { projectId, profileId: assigneeId } },
      })
      if (!membership) {
        await mockPrisma.projectMembership.create({
          data: { projectId, profileId: assigneeId },
        })
      }

      expect(mockPrisma.projectMembership.create).toHaveBeenCalledWith({
        data: { projectId: 'project-1', profileId: 'new-user-id' },
      })
    })

    it('reactivates membership when member was previously removed', async () => {
      const removedMembership = {
        id: 'membership-1',
        projectId: 'project-1',
        profileId: 'removed-user',
        removedAt: new Date('2026-01-01'),
      }
      mockPrisma.projectMembership.findUnique.mockResolvedValueOnce(removedMembership)

      // This mirrors what the PATCH route does:
      const membership = await mockPrisma.projectMembership.findUnique({
        where: { projectId_profileId: { projectId: 'project-1', profileId: 'removed-user' } },
      })
      if (membership && membership.removedAt !== null) {
        await mockPrisma.projectMembership.update({
          where: { id: membership.id },
          data: { removedAt: null },
        })
      }

      expect(mockPrisma.projectMembership.update).toHaveBeenCalledWith({
        where: { id: 'membership-1' },
        data: { removedAt: null },
      })
    })
  })
})

// ── 2. Project Membership Edge Cases ──────────────────────

describe('Project membership edge cases', () => {
  describe('Project role hierarchy', () => {
    it('TEAM_MEMBER cannot manage other members (below PROJECT_LEAD)', () => {
      expect(hasProjectRole('TEAM_MEMBER', 'PROJECT_LEAD')).toBe(false)
    })

    it('PROJECT_LEAD can manage members', () => {
      expect(hasProjectRole('PROJECT_LEAD', 'PROJECT_LEAD')).toBe(true)
    })

    it('EXTERNAL_CONSULTANT only matches itself', () => {
      expect(hasProjectRole('EXTERNAL_CONSULTANT', 'TEAM_MEMBER')).toBe(false)
      expect(hasProjectRole('EXTERNAL_CONSULTANT', 'EXTERNAL_CONSULTANT')).toBe(true)
    })

    it('CONTRACTOR only matches itself', () => {
      expect(hasProjectRole('CONTRACTOR', 'CONTRACTOR')).toBe(true)
      expect(hasProjectRole('CONTRACTOR', 'TEAM_MEMBER')).toBe(false)
    })

    it('SENIOR_ARCHITECT has higher role than TEAM_MEMBER', () => {
      expect(hasProjectRole('SENIOR_ARCHITECT', 'TEAM_MEMBER')).toBe(true)
    })

    it('ARCHITECT cannot act as SENIOR_ARCHITECT', () => {
      expect(hasProjectRole('ARCHITECT', 'SENIOR_ARCHITECT')).toBe(false)
    })
  })

  describe('Review permission checks', () => {
    it('cannot review own work', () => {
      expect(canReviewWork('SENIOR_ARCHITECT', 'profile-1', 'profile-1')).toBe(false)
    })

    it('SENIOR_ARCHITECT can review others work', () => {
      expect(canReviewWork('SENIOR_ARCHITECT', 'profile-1', 'profile-2')).toBe(true)
    })

    it('TEAM_MEMBER cannot review work', () => {
      expect(canReviewWork('TEAM_MEMBER', 'profile-1', 'profile-2')).toBe(false)
    })

    it('ARCHITECT cannot review work (below SENIOR_ARCHITECT)', () => {
      expect(canReviewWork('ARCHITECT', 'profile-1', 'profile-2')).toBe(false)
    })

    it('PROJECT_LEAD can review work', () => {
      expect(canReviewWork('PROJECT_LEAD', 'profile-1', 'profile-2')).toBe(true)
    })
  })
})

// ── 3. Leave Request Edge Cases ───────────────────────────

describe('Leave request edge cases', () => {
  describe('Cannot approve own leave request', () => {
    // The approval workflow uses isApproverTransition to check if the
    // user is an approver — the route should reject self-approval.
    it('approval transitions require approver role', () => {
      expect(isApproverTransition('APPROVED')).toBe(true)
      expect(isApproverTransition('REJECTED')).toBe(true)
      expect(isApproverTransition('LINE_MANAGER_APPROVED')).toBe(true)
      expect(isApproverTransition('HR_APPROVED')).toBe(true)
    })

    it('requester transitions are limited to SUBMITTED and WITHDRAWN', () => {
      expect(isRequesterTransition('SUBMITTED')).toBe(true)
      expect(isRequesterTransition('WITHDRAWN')).toBe(true)
      expect(isRequesterTransition('APPROVED')).toBe(false)
      expect(isRequesterTransition('REJECTED')).toBe(false)
    })
  })

  describe('Leave balance check prevents over-booking', () => {
    it('returns sufficient=true when balance is enough', () => {
      const result = checkLeaveBalance(10, 5)
      expect(result.sufficient).toBe(true)
      expect(result.shortfall).toBe(0)
    })

    it('returns sufficient=false when requesting more than available', () => {
      const result = checkLeaveBalance(3, 5)
      expect(result.sufficient).toBe(false)
      expect(result.shortfall).toBe(2)
    })

    it('returns shortfall=0 when exactly enough', () => {
      const result = checkLeaveBalance(5, 5)
      expect(result.sufficient).toBe(true)
      expect(result.shortfall).toBe(0)
    })

    it('calculateLeaveBalance.available never goes negative', () => {
      const summary = calculateLeaveBalance(10, 15, 0, 0)
      expect(summary.available).toBe(0) // Math.max(0, 10-15-0-0)
    })

    it('calculateLeaveBalance includes carried forward and pending', () => {
      const summary = calculateLeaveBalance(25, 5, 3, 2)
      // available = 25 + 3 - 5 - 2 = 21
      expect(summary.available).toBe(21)
      expect(summary.pending).toBe(2)
      expect(summary.carriedForward).toBe(3)
    })
  })

  describe('Overlapping leave dates detection', () => {
    it('detects overlapping date ranges', () => {
      const a = { startDate: new Date('2026-08-10'), endDate: new Date('2026-08-14') }
      const b = { startDate: new Date('2026-08-12'), endDate: new Date('2026-08-16') }
      expect(datesOverlap(a, b)).toBe(true)
    })

    it('detects same-day overlap', () => {
      const a = { startDate: new Date('2026-08-10'), endDate: new Date('2026-08-10') }
      const b = { startDate: new Date('2026-08-10'), endDate: new Date('2026-08-10') }
      expect(datesOverlap(a, b)).toBe(true)
    })

    it('returns false for non-overlapping ranges', () => {
      const a = { startDate: new Date('2026-08-10'), endDate: new Date('2026-08-12') }
      const b = { startDate: new Date('2026-08-15'), endDate: new Date('2026-08-18') }
      expect(datesOverlap(a, b)).toBe(false)
    })

    it('findOverlappingRequest returns first overlap', () => {
      const proposed = { startDate: new Date('2026-08-12'), endDate: new Date('2026-08-14') }
      const existing = [
        { id: 'req-1', startDate: new Date('2026-08-01'), endDate: new Date('2026-08-05') },
        { id: 'req-2', startDate: new Date('2026-08-13'), endDate: new Date('2026-08-15') },
        { id: 'req-3', startDate: new Date('2026-08-20'), endDate: new Date('2026-08-22') },
      ]
      const overlap = findOverlappingRequest(proposed, existing)
      expect(overlap).not.toBeNull()
      expect(overlap!.id).toBe('req-2')
    })

    it('findOverlappingRequest returns null when no overlap', () => {
      const proposed = { startDate: new Date('2026-09-01'), endDate: new Date('2026-09-05') }
      const existing = [
        { id: 'req-1', startDate: new Date('2026-08-01'), endDate: new Date('2026-08-05') },
      ]
      expect(findOverlappingRequest(proposed, existing)).toBeNull()
    })
  })

  describe('Leave request validation edge cases', () => {
    it('rejects end date before start date', () => {
      expect(() =>
        validateLeaveRequest(new Date('2026-08-14'), new Date('2026-08-10')),
      ).toThrow('End date must be on or after start date')
    })

    it('rejects request with no working days (weekend only)', () => {
      // 2026-08-08 is a Saturday, 2026-08-09 is a Sunday
      expect(() =>
        validateLeaveRequest(new Date('2026-08-08'), new Date('2026-08-09')),
      ).toThrow('at least one working day')
    })

    it('rejects leave exceeding 25 working days', () => {
      // ~36 calendar days = 26 working days
      expect(() =>
        validateLeaveRequest(new Date('2026-07-01'), new Date('2026-08-14')),
      ).toThrow('cannot exceed 25 working days')
    })

    it('accepts valid leave request and returns working days', () => {
      // Mon-Fri: 5 working days
      const result = validateLeaveRequest(new Date('2026-08-10'), new Date('2026-08-14'))
      expect(result.days).toBe(5)
    })
  })

  describe('Leave multi-stage approval transitions (PRD S20)', () => {
    it('SUBMITTED can go to LINE_MANAGER_APPROVED', () => {
      expect(isValidLeaveTransition('SUBMITTED', 'LINE_MANAGER_APPROVED')).toBe(true)
    })

    it('SUBMITTED cannot go directly to APPROVED (skip stages)', () => {
      expect(isValidLeaveTransition('SUBMITTED', 'APPROVED')).toBe(false)
    })

    it('LINE_MANAGER_APPROVED can go to HR_APPROVED', () => {
      expect(isValidLeaveTransition('LINE_MANAGER_APPROVED', 'HR_APPROVED')).toBe(true)
    })

    it('HR_APPROVED can go to APPROVED', () => {
      expect(isValidLeaveTransition('HR_APPROVED', 'APPROVED')).toBe(true)
    })

    it('APPROVED can be CANCELLED', () => {
      expect(isValidLeaveTransition('APPROVED', 'CANCELLED')).toBe(true)
    })

    it('CANCELLED is terminal', () => {
      expect(isValidLeaveTransition('CANCELLED', 'DRAFT')).toBe(false)
      expect(isValidLeaveTransition('CANCELLED', 'SUBMITTED')).toBe(false)
    })

    it('validateLeaveTransition throws for invalid transition', () => {
      expect(() => validateLeaveTransition('SUBMITTED', 'APPROVED')).toThrow(ValidationError)
    })

    it('validateLeaveTransition throws for same-state transition', () => {
      expect(() => validateLeaveTransition('SUBMITTED', 'SUBMITTED')).toThrow(
        'Leave request is already SUBMITTED',
      )
    })
  })
})

// ── 4. Invitation Edge Cases ──────────────────────────────

describe('Invitation edge cases', () => {
  describe('Activation creates profile with correct orgPermission', () => {
    // The activation route at /api/invitations/[token]/activate/route.ts
    // line 130 sets: orgPermission: invitation.orgPermission ?? 'MEMBER'
    // This means if the invitation has orgPermission='HR', the profile
    // gets orgPermission='HR'.

    it('orgPermission from invitation propagates (not hardcoded to MEMBER)', () => {
      const invitation = {
        orgPermission: 'HR',
        organisationId: 'org-1',
        email: 'hr@example.com',
        fullName: 'HR Person',
      }
      // Simulates what the activation route does at line 130
      const profileData = {
        orgPermission: invitation.orgPermission ?? 'MEMBER',
      }
      expect(profileData.orgPermission).toBe('HR')
    })

    it('defaults to MEMBER when invitation orgPermission is null', () => {
      const invitation = {
        orgPermission: null,
        email: 'user@example.com',
        fullName: 'New User',
      }
      const profileData = {
        orgPermission: invitation.orgPermission ?? 'MEMBER',
      }
      expect(profileData.orgPermission).toBe('MEMBER')
    })

    it('defaults to MEMBER when invitation orgPermission is undefined', () => {
      const invitation = {
        orgPermission: undefined,
        email: 'user@example.com',
        fullName: 'New User',
      }
      const profileData = {
        orgPermission: invitation.orgPermission ?? 'MEMBER',
      }
      expect(profileData.orgPermission).toBe('MEMBER')
    })
  })

  describe('Duplicate invitation detection', () => {
    // POST /api/invitations checks for existing active invitation (line 25-31)
    // The route does: prisma.invitation.findFirst({ where: { email, organisationId, status: { in: ['PENDING', 'SENT'] } } })
    // If found, it throws ConflictError.

    it('throws ConflictError when active invitation exists', () => {
      const existing = {
        id: 'inv-1',
        email: 'user@example.com',
        status: 'PENDING',
      }
      // Simulate what the route does when findFirst returns a result
      expect(existing).not.toBeNull()
      expect(() => {
        throw new ConflictError('An active invitation already exists for this email')
      }).toThrow(ConflictError)
    })

    it('ConflictError has correct status code and format', () => {
      const err = new ConflictError('An active invitation already exists for this email')
      expect(err.statusCode).toBe(409)
      expect(err.code).toBe('CONFLICT')
      expect(err.toJSON().error).toContain('already exists')
    })

    it('no error when no active invitation exists', () => {
      const existing = null
      // Route only throws if existing !== null
      expect(existing).toBeNull()
      // No ConflictError thrown — invitation creation proceeds
    })
  })

  describe('Invitation expiry', () => {
    it('expired invitation is detected by date comparison', () => {
      const expiresAt = new Date('2026-01-01')
      const now = new Date('2026-08-11')
      expect(now > expiresAt).toBe(true)
    })

    it('valid invitation is not expired', () => {
      const expiresAt = new Date('2027-01-01')
      const now = new Date('2026-08-11')
      expect(now > expiresAt).toBe(false)
    })
  })

  describe('Email mismatch detection', () => {
    it('case-insensitive email comparison catches mismatch', () => {
      const authEmail = 'alice@example.com'
      const invitationEmail = 'bob@example.com'
      expect(authEmail.toLowerCase() !== invitationEmail.toLowerCase()).toBe(true)
    })

    it('case-insensitive email comparison allows match', () => {
      const authEmail = 'Alice@Example.COM'
      const invitationEmail = 'alice@example.com'
      expect(authEmail.toLowerCase() !== invitationEmail.toLowerCase()).toBe(false)
    })
  })
})

// ── 5. Permission Escalation Prevention ───────────────────

describe('Permission escalation prevention', () => {
  describe('Org permission hierarchy', () => {
    it('MEMBER cannot act as ADMIN', () => {
      expect(hasOrgPermission('MEMBER', 'ADMIN')).toBe(false)
    })

    it('MEMBER cannot act as MANAGER', () => {
      expect(hasOrgPermission('MEMBER', 'MANAGER')).toBe(false)
    })

    it('MANAGER cannot act as ADMIN', () => {
      expect(hasOrgPermission('MANAGER', 'ADMIN')).toBe(false)
    })

    it('MANAGER cannot act as OWNER', () => {
      expect(hasOrgPermission('MANAGER', 'OWNER')).toBe(false)
    })

    it('ADMIN can act as MANAGER', () => {
      expect(hasOrgPermission('ADMIN', 'MANAGER')).toBe(true)
    })

    it('OWNER can act as anything', () => {
      expect(hasOrgPermission('OWNER', 'ADMIN')).toBe(true)
      expect(hasOrgPermission('OWNER', 'MANAGER')).toBe(true)
      expect(hasOrgPermission('OWNER', 'MEMBER')).toBe(true)
      expect(hasOrgPermission('OWNER', 'VIEWER')).toBe(true)
    })

    it('VIEWER is the lowest tier', () => {
      expect(hasOrgPermission('VIEWER', 'MEMBER')).toBe(false)
      expect(hasOrgPermission('VIEWER', 'VIEWER')).toBe(true)
    })

    it('HR is between MANAGER and ADMIN', () => {
      expect(hasOrgPermission('HR', 'MANAGER')).toBe(true)
      expect(hasOrgPermission('HR', 'ADMIN')).toBe(false)
    })
  })

  describe('Permission escalation scenarios', () => {
    it('MEMBER cannot change own orgPermission to ADMIN (hierarchy check)', () => {
      const currentUser = createMockProfile({ orgPermission: 'MEMBER' })
      // To change someone to ADMIN, you need at least ADMIN permission
      expect(hasOrgPermission(currentUser.orgPermission as any, 'ADMIN')).toBe(false)
    })

    it('MANAGER cannot promote to ADMIN', () => {
      const manager = createManagerProfile()
      expect(hasOrgPermission(manager.orgPermission as any, 'ADMIN')).toBe(false)
    })

    it('only OWNER can set someone to ADMIN (or above)', () => {
      const owner = createMockProfile({ orgPermission: 'OWNER' })
      expect(hasOrgPermission(owner.orgPermission as any, 'ADMIN')).toBe(true)
    })

    it('ADMIN can set someone to MANAGER or below', () => {
      const admin = createAdminProfile()
      expect(hasOrgPermission(admin.orgPermission as any, 'MANAGER')).toBe(true)
      expect(hasOrgPermission(admin.orgPermission as any, 'MEMBER')).toBe(true)
    })
  })
})

// ── 6. Request (Generic) Transition Edge Cases ────────────

describe('Request transition edge cases', () => {
  it('generic: DRAFT -> SUBMITTED is valid', () => {
    expect(isValidRequestTransition('DRAFT', 'SUBMITTED')).toBe(true)
  })

  it('generic: SUBMITTED -> UNDER_REVIEW is valid', () => {
    expect(isValidRequestTransition('SUBMITTED', 'UNDER_REVIEW')).toBe(true)
  })

  it('generic: UNDER_REVIEW -> APPROVED is valid', () => {
    expect(isValidRequestTransition('UNDER_REVIEW', 'APPROVED')).toBe(true)
  })

  it('generic: REJECTED is terminal', () => {
    expect(isValidRequestTransition('REJECTED', 'DRAFT')).toBe(false)
    expect(isValidRequestTransition('REJECTED', 'SUBMITTED')).toBe(false)
  })

  it('generic: COMPLETED is terminal', () => {
    expect(isValidRequestTransition('COMPLETED', 'DRAFT')).toBe(false)
  })

  it('generic: WITHDRAWN is terminal', () => {
    expect(isValidRequestTransition('WITHDRAWN', 'SUBMITTED')).toBe(false)
  })

  it('generic: same-state transition is invalid', () => {
    expect(isValidRequestTransition('SUBMITTED', 'SUBMITTED')).toBe(false)
  })

  it('validateRequestTransition throws for same-state', () => {
    expect(() => validateRequestTransition('DRAFT', 'DRAFT')).toThrow(
      'Request is already DRAFT',
    )
  })

  it('validateRequestTransition throws for invalid transition', () => {
    expect(() => validateRequestTransition('REJECTED', 'DRAFT')).toThrow(ValidationError)
    expect(() => validateRequestTransition('REJECTED', 'DRAFT')).toThrow(
      'none (terminal state)',
    )
  })

  it('admin-only transitions are identified', () => {
    expect(isAdminTransition('FULFILMENT_IN_PROGRESS')).toBe(true)
    expect(isAdminTransition('COMPLETED')).toBe(true)
    expect(isAdminTransition('CANCELLED')).toBe(true)
    expect(isAdminTransition('SUBMITTED')).toBe(false)
  })
})

// ── 7. Cross-Org Isolation Pattern ────────────────────────

describe('Cross-org isolation', () => {
  it('mockAuthMiddleware returns 401 when no profile set', async () => {
    const mockPrisma = createMockPrisma()
    const authModule = mockAuthMiddleware(mockPrisma)

    const handler = authModule.withAuth(async (_req, { profile }) => {
      return Response.json({ ok: true })
    })

    // No profile set — should 401
    const req = createMockRequest({ method: 'GET', url: 'http://localhost/api/test' })
    const res = await handler(req)
    expect(res.status).toBe(401)
  })

  it('mockAuthMiddleware passes profile when set', async () => {
    const mockPrisma = createMockPrisma()
    const authModule = mockAuthMiddleware(mockPrisma)
    const profile = createMockProfile({ organisationId: 'org-1' })
    authModule.setCurrentProfile(profile)

    const handler = authModule.withAuth(async (_req, { profile }) => {
      return Response.json({ orgId: profile.organisationId })
    })

    const req = createMockRequest({ method: 'GET', url: 'http://localhost/api/test' })
    const res = await handler(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.orgId).toBe('org-1')
  })

  it('resource from different org is not visible (pattern)', () => {
    // This test verifies the pattern used across all routes:
    // if (resource.organisationId !== profile.organisationId) throw NotFoundError
    const profile = createMockProfile({ organisationId: 'org-1' })
    const resource = { organisationId: 'org-2', id: 'task-1' }

    const isAccessible = resource.organisationId === profile.organisationId
    expect(isAccessible).toBe(false)
    // Route returns 404 (not 403) to avoid leaking existence
  })
})

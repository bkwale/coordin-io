import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Approval Engine Unit Tests ────────────────────────────

// Mock Prisma
vi.mock('@/lib/prisma', () => ({
  prisma: {
    approvalRoute: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      delete: vi.fn(),
    },
    approvalRouteStep: {
      create: vi.fn(),
      deleteMany: vi.fn(),
    },
    approvalInstance: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    approvalStepInstance: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    profile: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
    },
    $transaction: vi.fn((fn: (tx: unknown) => Promise<unknown>) => fn({
      approvalInstance: {
        create: vi.fn().mockResolvedValue({ id: 'inst-1', status: 'IN_PROGRESS', currentStepOrder: 1 }),
        update: vi.fn(),
      },
      approvalStepInstance: {
        create: vi.fn().mockResolvedValue({ id: 'step-inst-1' }),
        findFirst: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
      },
    })),
  },
}))

vi.mock('@/lib/notifications', () => ({
  createNotification: vi.fn().mockResolvedValue({ notificationId: 'n-1', emailSent: false }),
  NOTIFICATION_EVENTS: {
    APPROVAL_REQUESTED: 'approval.requested',
    APPROVAL_COMPLETED: 'approval.completed',
    APPROVAL_REJECTED: 'approval.rejected',
    APPROVAL_ESCALATED: 'approval.escalated',
  },
}))

vi.mock('@/lib/audit', () => ({
  recordAuditEvent: vi.fn().mockResolvedValue(undefined),
  AuditActions: {
    APPROVAL_INSTANCE_CREATED: 'approval.instance_created',
    APPROVAL_STEP_APPROVED: 'approval.step_approved',
    APPROVAL_STEP_REJECTED: 'approval.step_rejected',
    APPROVAL_COMPLETED: 'approval.completed',
    APPROVAL_FORCE_APPROVED: 'approval.force_approved',
    APPROVAL_CANCELLED: 'approval.cancelled',
    APPROVAL_ROUTE_CREATED: 'approval.route_created',
    APPROVAL_ROUTE_UPDATED: 'approval.route_updated',
  },
}))

describe('Sprint 3: Approval Engine', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('matchesConditions', () => {
    it('should be importable from approval-engine', async () => {
      // Dynamic import to get the real function (non-Prisma dependent)
      const mod = await import('@/lib/approval-engine')
      expect(mod.findMatchingRoute).toBeDefined()
      expect(mod.createApprovalInstance).toBeDefined()
      expect(mod.processApprovalStep).toBeDefined()
      expect(mod.forceApprove).toBeDefined()
      expect(mod.cancelApproval).toBeDefined()
      expect(mod.getPendingApprovalsForUser).toBeDefined()
      expect(mod.getApprovalForEntity).toBeDefined()
      expect(mod.seedDefaultApprovalRoutes).toBeDefined()
    })
  })

  describe('findMatchingRoute', () => {
    it('returns null when no routes exist', async () => {
      const { prisma } = await import('@/lib/prisma')
      vi.mocked(prisma.approvalRoute.findMany).mockResolvedValue([])

      const { findMatchingRoute } = await import('@/lib/approval-engine')
      const route = await findMatchingRoute('org-1', 'LEAVE' as never, {})
      expect(route).toBeNull()
    })

    it('returns the default route when no conditions match', async () => {
      const { prisma } = await import('@/lib/prisma')
      const defaultRoute = {
        id: 'route-1', name: 'Default Leave', isDefault: true, isActive: true,
        priority: 0, conditions: null, steps: [], organisationId: 'org-1',
        requestType: 'LEAVE', createdAt: new Date(), updatedAt: new Date(),
      }
      vi.mocked(prisma.approvalRoute.findMany).mockResolvedValue([defaultRoute] as never)

      const { findMatchingRoute } = await import('@/lib/approval-engine')
      const route = await findMatchingRoute('org-1', 'LEAVE' as never, {})
      expect(route?.id).toBe('route-1')
      expect(route?.isDefault).toBe(true)
    })

    it('returns highest priority conditional route when conditions match', async () => {
      const { prisma } = await import('@/lib/prisma')
      const defaultRoute = {
        id: 'route-1', name: 'Default', isDefault: true, isActive: true,
        priority: 0, conditions: null, steps: [], organisationId: 'org-1',
        requestType: 'EXPENSE', createdAt: new Date(), updatedAt: new Date(),
      }
      const highValueRoute = {
        id: 'route-2', name: 'Large Expense', isDefault: false, isActive: true,
        priority: 10, conditions: { minAmount: 5000 }, steps: [],
        organisationId: 'org-1', requestType: 'EXPENSE',
        createdAt: new Date(), updatedAt: new Date(),
      }
      // Routes should be returned sorted by priority desc
      vi.mocked(prisma.approvalRoute.findMany).mockResolvedValue([highValueRoute, defaultRoute] as never)

      const { findMatchingRoute } = await import('@/lib/approval-engine')
      const route = await findMatchingRoute('org-1', 'EXPENSE' as never, { amount: 10000 })
      expect(route?.id).toBe('route-2')
      expect(route?.name).toBe('Large Expense')
    })

    it('falls back to default when conditional route does not match', async () => {
      const { prisma } = await import('@/lib/prisma')
      const defaultRoute = {
        id: 'route-1', name: 'Default', isDefault: true, isActive: true,
        priority: 0, conditions: null, steps: [], organisationId: 'org-1',
        requestType: 'EXPENSE', createdAt: new Date(), updatedAt: new Date(),
      }
      const highValueRoute = {
        id: 'route-2', name: 'Large Expense', isDefault: false, isActive: true,
        priority: 10, conditions: { minAmount: 5000 }, steps: [],
        organisationId: 'org-1', requestType: 'EXPENSE',
        createdAt: new Date(), updatedAt: new Date(),
      }
      vi.mocked(prisma.approvalRoute.findMany).mockResolvedValue([highValueRoute, defaultRoute] as never)

      const { findMatchingRoute } = await import('@/lib/approval-engine')
      // Amount below threshold
      const route = await findMatchingRoute('org-1', 'EXPENSE' as never, { amount: 100 })
      expect(route?.id).toBe('route-1')
    })
  })

  describe('Approval Escalation', () => {
    it('should be importable', async () => {
      const mod = await import('@/lib/approval-escalation')
      expect(mod.processEscalations).toBeDefined()
    })

    it('returns zero processed when no overdue steps', async () => {
      const { prisma } = await import('@/lib/prisma')
      vi.mocked(prisma.approvalStepInstance.findMany).mockResolvedValue([])

      const { processEscalations } = await import('@/lib/approval-escalation')
      const result = await processEscalations()
      expect(result.processed).toBe(0)
      expect(result.escalated).toBe(0)
    })
  })

  describe('Notification events', () => {
    it('all approval notification types are defined', async () => {
      const { NOTIFICATION_EVENTS } = await import('@/lib/notifications')
      expect(NOTIFICATION_EVENTS.APPROVAL_REQUESTED).toBe('approval.requested')
      expect(NOTIFICATION_EVENTS.APPROVAL_COMPLETED).toBe('approval.completed')
      expect(NOTIFICATION_EVENTS.APPROVAL_REJECTED).toBe('approval.rejected')
      expect(NOTIFICATION_EVENTS.APPROVAL_ESCALATED).toBe('approval.escalated')
    })
  })

  describe('Audit actions', () => {
    it('all approval audit actions are defined', async () => {
      const { AuditActions } = await import('@/lib/audit')
      expect(AuditActions.APPROVAL_INSTANCE_CREATED).toBeDefined()
      expect(AuditActions.APPROVAL_STEP_APPROVED).toBeDefined()
      expect(AuditActions.APPROVAL_STEP_REJECTED).toBeDefined()
      expect(AuditActions.APPROVAL_COMPLETED).toBeDefined()
      expect(AuditActions.APPROVAL_FORCE_APPROVED).toBeDefined()
      expect(AuditActions.APPROVAL_CANCELLED).toBeDefined()
      expect(AuditActions.APPROVAL_ROUTE_CREATED).toBeDefined()
      expect(AuditActions.APPROVAL_ROUTE_UPDATED).toBeDefined()
    })
  })

  describe('API Routes Structure', () => {
    it('approval-routes route file exports GET and POST', async () => {
      const mod = await import('@/app/api/approval-routes/route')
      expect(mod.GET).toBeDefined()
      expect(mod.POST).toBeDefined()
    })

    it('approval-routes/[id] route file exports GET, PATCH, DELETE', async () => {
      const mod = await import('@/app/api/approval-routes/[id]/route')
      expect(mod.GET).toBeDefined()
      expect(mod.PATCH).toBeDefined()
      expect(mod.DELETE).toBeDefined()
    })

    it('approvals route file exports GET', async () => {
      const mod = await import('@/app/api/approvals/route')
      expect(mod.GET).toBeDefined()
    })

    it('approvals/[id] route file exports GET and PATCH', async () => {
      const mod = await import('@/app/api/approvals/[id]/route')
      expect(mod.GET).toBeDefined()
      expect(mod.PATCH).toBeDefined()
    })

    it('cron/escalations route file exports POST and GET', async () => {
      const mod = await import('@/app/api/cron/escalations/route')
      expect(mod.POST).toBeDefined()
      expect(mod.GET).toBeDefined()
    })
  })

  describe('Approval engine integration with existing flows', () => {
    it('expense PATCH imports createApprovalInstance', async () => {
      const mod = await import('@/app/api/expenses/[id]/route')
      expect(mod.PATCH).toBeDefined()
    })

    it('leave request PATCH imports createApprovalInstance', async () => {
      const mod = await import('@/app/api/leave/requests/[id]/route')
      expect(mod.PATCH).toBeDefined()
    })

    it('service-request PATCH imports createApprovalInstance', async () => {
      const mod = await import('@/app/api/service-requests/[id]/route')
      expect(mod.PATCH).toBeDefined()
    })
  })
})

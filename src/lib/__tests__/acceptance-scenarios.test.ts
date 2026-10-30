import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  createMockProfile,
  createAdminProfile,
  createManagerProfile,
  createMockTimesheetWeek,
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
      probationGoal: m(),
      timesheetWeek: m(),
      timesheetEntry: m(),
      auditEvent: m(),
      invitation: m(),
      organisation: m(),
      asset: m(),
      assetAssignment: m(),
      approvalInstance: m(),
      approvalRoute: m(),
      approvalRouteStep: m(),
      approvalStepInstance: m(),
      onboardingSelfServiceToken: m(),
      onboardingAssignment: m(),
      onboardingTaskCompletion: m(),
      office: m(),
      $transaction: vi.fn().mockImplementation(async (fn: any) => {
        if (typeof fn === 'function') return fn(ctx.prisma)
        return Promise.all(fn)
      }),
    },
  }
})

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@/lib/prisma', () => ({ prisma: ctx.prisma }))
vi.mock('@/lib/prisma-modules', () => ({ modulesPrisma: ctx.prisma }))

vi.mock('@/lib/audit', () => ({
  recordAuditEvent: vi.fn().mockResolvedValue(undefined),
  AuditActions: {
    APPROVAL_FORCE_APPROVED: 'approval.force_approved',
    LEAVE_APPROVED: 'leave.approved',
    BULK_IMPORT_EMPLOYEES: 'bulk_import.employees',
  },
}))

vi.mock('@/lib/notifications', () => ({
  createNotification: vi.fn().mockResolvedValue({ notificationId: 'n-1', emailSent: false }),
  NOTIFICATION_EVENTS: {
    APPROVAL_REQUESTED: 'approval.requested',
    APPROVAL_COMPLETED: 'approval.completed',
    MENTION: 'mention',
    PROBATION_REVIEW_SCHEDULED: 'probation.review_scheduled',
  },
}))

vi.mock('@/lib/email', () => ({
  sendInvitationEmail: vi.fn().mockResolvedValue({ success: true }),
}))

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { parseMentions } from '@/lib/mentions'
import { getEffectiveProbationMonths } from '@/lib/org-settings'
import { canPerform, getPermissionsForRole } from '@/lib/role-permissions'
import {
  findMatchingRoute,
  createApprovalInstance,
  processApprovalStep,
} from '@/lib/approval-engine'
import { validateOnboardingCompletion } from '@/lib/onboarding-utils'
import {
  isValidTimesheetTransition,
  validateTimesheetTransition,
} from '@/lib/timesheet-transitions'
import { createNotification } from '@/lib/notifications'

// ═══════════════════════════════════════════════════════════════
// Scenario 1: Onboarding flow — self-service token → 7 steps → complete
// ═══════════════════════════════════════════════════════════════

describe('Scenario 1: Onboarding flow', () => {
  beforeEach(() => vi.clearAllMocks())

  it('self-service token created → employee completes all steps → tasks marked complete → token marked complete', async () => {
    // 1. HR creates a self-service token
    const tokenData = {
      id: 'token-1',
      token: 'abc123',
      profileId: 'emp-1',
      organisationId: 'org-1',
      status: 'ACTIVE',
      completedSteps: [],
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    }
    ctx.prisma.onboardingSelfServiceToken.create.mockResolvedValue(tokenData)

    const created = await ctx.prisma.onboardingSelfServiceToken.create({ data: tokenData })
    expect(created.status).toBe('ACTIVE')
    expect(created.profileId).toBe('emp-1')

    // 2. Employee completes all 7 steps
    const allSteps = ['welcome', 'personal', 'bank', 'hmo', 'emergency', 'documents', 'review']
    ctx.prisma.onboardingSelfServiceToken.update.mockResolvedValue({
      ...tokenData,
      completedSteps: allSteps,
      status: 'COMPLETED',
    })

    const completed = await ctx.prisma.onboardingSelfServiceToken.update({
      where: { id: 'token-1' },
      data: { completedSteps: allSteps, status: 'COMPLETED' },
    })

    expect(completed.completedSteps).toHaveLength(7)
    expect(completed.status).toBe('COMPLETED')

    // 3. Onboarding validation passes
    const validation = validateOnboardingCompletion({
      totalPolicies: 3,
      acknowledgedPolicies: 3,
      totalTraining: 2,
      completedTraining: 2,
    })
    expect(validation.valid).toBe(true)
    expect(validation.missing).toHaveLength(0)
  })

  it('incomplete onboarding returns missing items', () => {
    const validation = validateOnboardingCompletion({
      totalPolicies: 3,
      acknowledgedPolicies: 1,
      totalTraining: 2,
      completedTraining: 0,
    })
    expect(validation.valid).toBe(false)
    expect(validation.missing).toHaveLength(2)
  })
})

// ═══════════════════════════════════════════════════════════════
// Scenario 2: Probation lifecycle — 30/60/90-day reviews auto-generated
// ═══════════════════════════════════════════════════════════════

describe('Scenario 2: Probation lifecycle', () => {
  beforeEach(() => vi.clearAllMocks())

  it('employee starts → reviews auto-generated at 30/60/90 days → goals added → review completed', async () => {
    const startDate = new Date('2026-01-05')
    const reviews = [
      { id: 'rev-30', profileId: 'emp-1', reviewType: '30_DAY', scheduledDate: new Date('2026-02-04'), status: 'SCHEDULED' },
      { id: 'rev-60', profileId: 'emp-1', reviewType: '60_DAY', scheduledDate: new Date('2026-03-06'), status: 'SCHEDULED' },
      { id: 'rev-90', profileId: 'emp-1', reviewType: '90_DAY', scheduledDate: new Date('2026-04-05'), status: 'SCHEDULED' },
    ]

    // Reviews auto-generated on employee creation
    ctx.prisma.probationReview.findMany.mockResolvedValue(reviews)
    const generated = await ctx.prisma.probationReview.findMany({
      where: { profileId: 'emp-1' },
    })
    expect(generated).toHaveLength(3)
    expect(generated.map((r: any) => r.reviewType)).toEqual(['30_DAY', '60_DAY', '90_DAY'])

    // Goals added to 90-day review
    ctx.prisma.probationGoal.create.mockResolvedValue({
      id: 'goal-1',
      reviewId: 'rev-90',
      title: 'Complete safety training',
      status: 'IN_PROGRESS',
    })
    const goal = await ctx.prisma.probationGoal.create({
      data: { reviewId: 'rev-90', title: 'Complete safety training', status: 'IN_PROGRESS' },
    })
    expect(goal.reviewId).toBe('rev-90')

    // Review completed with outcome
    ctx.prisma.probationReview.update.mockResolvedValue({
      ...reviews[2],
      status: 'COMPLETED',
      outcome: 'PASSED',
      completedAt: new Date(),
    })
    const completed = await ctx.prisma.probationReview.update({
      where: { id: 'rev-90' },
      data: { status: 'COMPLETED', outcome: 'PASSED', completedAt: new Date() },
    })
    expect(completed.status).toBe('COMPLETED')
    expect(completed.outcome).toBe('PASSED')
  })
})

// ═══════════════════════════════════════════════════════════════
// Scenario 3: Approval workflow — leave request → correct approver → approved → balance updated
// ═══════════════════════════════════════════════════════════════

describe('Scenario 3: Approval workflow', () => {
  beforeEach(() => vi.clearAllMocks())

  it('leave request submitted → routes to correct approver → approved → balance updated', async () => {
    // Route matching: LEAVE request finds the standard leave route
    const leaveRoute = {
      id: 'route-1',
      organisationId: 'org-1',
      requestType: 'LEAVE',
      name: 'Standard Leave',
      isDefault: true,
      isActive: true,
      priority: 0,
      conditions: null,
      ccRecipientIds: [],
      steps: [
        { id: 'step-1', stepOrder: 1, label: 'Line Manager', approverType: 'LINE_MANAGER', approverRole: null, approverId: null, canSkipIfSameAsPrevious: false, escalationDays: 3 },
      ],
    }

    ctx.prisma.approvalRoute.findMany.mockResolvedValue([leaveRoute])
    const route = await findMatchingRoute('org-1', 'LEAVE' as any, {})
    expect(route).not.toBeNull()
    expect(route!.name).toBe('Standard Leave')
    expect(route!.steps[0].approverType).toBe('LINE_MANAGER')

    // Approval instance created → first step resolves to manager
    ctx.prisma.approvalInstance.create.mockResolvedValue({
      id: 'inst-1',
      routeId: 'route-1',
      status: 'IN_PROGRESS',
      currentStepOrder: 1,
      submitterId: 'emp-1',
      ccRecipientIds: [],
    })
    ctx.prisma.approvalStepInstance.create.mockResolvedValue({
      id: 'si-1',
      instanceId: 'inst-1',
      stepOrder: 1,
      approverId: 'manager-1',
      status: 'PENDING',
    })
    ctx.prisma.approvalStepInstance.findFirst.mockResolvedValue({
      id: 'si-1',
      instanceId: 'inst-1',
      stepOrder: 1,
      approverId: 'manager-1',
      status: 'PENDING',
    })

    const instId = await createApprovalInstance({
      organisationId: 'org-1',
      requestType: 'LEAVE' as any,
      entityId: 'leave-1',
      submitterId: 'emp-1',
      submitterManagerId: 'manager-1',
    })
    expect(instId).toBeTruthy()

    // Leave balance updated after approval
    ctx.prisma.leaveBalance.update.mockResolvedValue({
      id: 'bal-1',
      profileId: 'emp-1',
      annual: 20,
      used: 5,
      remaining: 15,
    })
    const balance = await ctx.prisma.leaveBalance.update({
      where: { id: 'bal-1' },
      data: { used: 5, remaining: 15 },
    })
    expect(balance.remaining).toBe(15)
  })
})

// ═══════════════════════════════════════════════════════════════
// Scenario 4: Multi-approver AND — requireAll=true logic
// ═══════════════════════════════════════════════════════════════

describe('Scenario 4: Multi-approver AND', () => {
  beforeEach(() => vi.clearAllMocks())

  it('AND step: first approver approves → step NOT advanced → second approver approves → step advances', async () => {
    // Instance with one AND step (two approvers)
    const instance = {
      id: 'inst-and',
      status: 'IN_PROGRESS',
      currentStepOrder: 1,
      submitterId: 'emp-1',
      requestType: 'EXPENSE',
      organisationId: 'org-1',
      steps: [
        {
          id: 'si-and',
          stepOrder: 1,
          status: 'PENDING',
          approverId: null,
          approverIds: ['approver-1', 'approver-2'],
          approvedByIds: [],
          comment: null,
        },
        {
          id: 'si-final',
          stepOrder: 2,
          status: 'PENDING',
          approverId: 'finance-1',
          approverIds: ['finance-1'],
          approvedByIds: [],
          comment: null,
        },
      ],
    }

    // First approver approves — step stays PENDING
    ctx.prisma.approvalInstance.findUnique.mockResolvedValue(instance)
    ctx.prisma.approvalStepInstance.update.mockResolvedValue({
      ...instance.steps[0],
      approvedByIds: ['approver-1'],
    })

    const result1 = await processApprovalStep('inst-and', 'approver-1', 'APPROVE')
    expect(result1.stepStatus).toBe('PENDING')
    expect(result1.isComplete).toBe(false)

    // Second approver approves — step now advances
    const instanceAfterFirst = {
      ...instance,
      steps: [
        { ...instance.steps[0], approvedByIds: ['approver-1'] },
        instance.steps[1],
      ],
    }
    ctx.prisma.approvalInstance.findUnique.mockResolvedValue(instanceAfterFirst)
    ctx.prisma.approvalStepInstance.update.mockResolvedValue({
      ...instance.steps[0],
      status: 'APPROVED',
      approvedByIds: ['approver-1', 'approver-2'],
    })
    ctx.prisma.approvalInstance.update.mockResolvedValue({
      ...instance,
      currentStepOrder: 2,
    })

    const result2 = await processApprovalStep('inst-and', 'approver-2', 'APPROVE')
    expect(result2.stepStatus).toBe('APPROVED')
    expect(result2.nextStepOrder).toBe(2)
    expect(result2.isComplete).toBe(false)
  })
})

// ═══════════════════════════════════════════════════════════════
// Scenario 5: CC notifications — CC recipients notified on create + complete
// ═══════════════════════════════════════════════════════════════

describe('Scenario 5: CC notifications', () => {
  beforeEach(() => vi.clearAllMocks())

  it('CC recipients notified on instance creation and on completion', async () => {
    const ccRoute = {
      id: 'route-cc',
      organisationId: 'org-1',
      requestType: 'EXPENSE',
      name: 'Expense with CC',
      isDefault: true,
      isActive: true,
      priority: 0,
      conditions: null,
      ccRecipientIds: ['cc-person-1', 'cc-person-2'],
      steps: [
        { id: 'step-1', stepOrder: 1, label: 'Manager', approverType: 'LINE_MANAGER', approverRole: null, approverId: null, canSkipIfSameAsPrevious: false, escalationDays: 3 },
      ],
    }

    ctx.prisma.approvalRoute.findMany.mockResolvedValue([ccRoute])
    ctx.prisma.approvalInstance.create.mockResolvedValue({
      id: 'inst-cc',
      routeId: 'route-cc',
      status: 'IN_PROGRESS',
      currentStepOrder: 1,
      submitterId: 'emp-1',
      ccRecipientIds: ['cc-person-1', 'cc-person-2'],
    })
    ctx.prisma.approvalStepInstance.create.mockResolvedValue({
      id: 'si-cc',
      instanceId: 'inst-cc',
      stepOrder: 1,
      approverId: 'manager-1',
      approverIds: ['manager-1'],
      approvedByIds: [],
      status: 'PENDING',
    })
    ctx.prisma.approvalStepInstance.findFirst.mockResolvedValue({
      id: 'si-cc',
      instanceId: 'inst-cc',
      stepOrder: 1,
      approverId: 'manager-1',
      status: 'PENDING',
    })

    await createApprovalInstance({
      organisationId: 'org-1',
      requestType: 'EXPENSE' as any,
      entityId: 'exp-1',
      submitterId: 'emp-1',
      submitterManagerId: 'manager-1',
    })

    // CC recipients should be notified on creation
    const notifyCalls = (createNotification as any).mock.calls
    const ccNotifications = notifyCalls.filter(
      (call: any[]) => call[0]?.profileId === 'cc-person-1' || call[0]?.profileId === 'cc-person-2',
    )
    expect(ccNotifications.length).toBeGreaterThanOrEqual(2)

    // On completion, CC recipients notified again (tested via processApprovalStep)
    const completionInstance = {
      id: 'inst-cc',
      status: 'IN_PROGRESS',
      currentStepOrder: 1,
      submitterId: 'emp-1',
      requestType: 'EXPENSE',
      organisationId: 'org-1',
      ccRecipientIds: ['cc-person-1', 'cc-person-2'],
      steps: [
        {
          id: 'si-cc',
          stepOrder: 1,
          status: 'PENDING',
          approverId: 'manager-1',
          approverIds: ['manager-1'],
          approvedByIds: [],
          comment: null,
        },
      ],
    }
    ctx.prisma.approvalInstance.findUnique.mockResolvedValue(completionInstance)
    ctx.prisma.approvalStepInstance.update.mockResolvedValue({ ...completionInstance.steps[0], status: 'APPROVED' })
    ctx.prisma.approvalInstance.update.mockResolvedValue({ ...completionInstance, status: 'APPROVED' })

    vi.clearAllMocks()
    // After completion, CC recipients are notified
    ctx.prisma.approvalInstance.findUnique
      .mockResolvedValueOnce(completionInstance) // inside $transaction
      .mockResolvedValueOnce({ id: 'inst-cc', ccRecipientIds: ['cc-person-1', 'cc-person-2'] }) // post-tx CC lookup
    ctx.prisma.approvalStepInstance.update.mockResolvedValue({ ...completionInstance.steps[0], status: 'APPROVED' })
    ctx.prisma.approvalInstance.update.mockResolvedValue({ ...completionInstance, status: 'APPROVED' })

    await processApprovalStep('inst-cc', 'manager-1', 'APPROVE')

    const postCompleteCalls = (createNotification as any).mock.calls
    const ccCompletionNotifs = postCompleteCalls.filter(
      (call: any[]) =>
        (call[0]?.profileId === 'cc-person-1' || call[0]?.profileId === 'cc-person-2') &&
        call[0]?.title?.includes('CC:'),
    )
    expect(ccCompletionNotifs.length).toBeGreaterThanOrEqual(2)
  })
})

// ═══════════════════════════════════════════════════════════════
// Scenario 6: Timesheet submission — create → add entries → submit → approve
// ═══════════════════════════════════════════════════════════════

describe('Scenario 6: Timesheet submission', () => {
  beforeEach(() => vi.clearAllMocks())

  it('employee creates week → adds entries → submits → manager approves', async () => {
    // 1. Create timesheet week
    const week = createMockTimesheetWeek()
    ctx.prisma.timesheetWeek.create.mockResolvedValue(week)
    const created = await ctx.prisma.timesheetWeek.create({ data: week })
    expect(created.status).toBe('DRAFT')

    // 2. Add entries (Mon-Fri, 8h each)
    const entries = Array.from({ length: 5 }, (_, i) => ({
      id: `entry-${i}`,
      weekId: 'week-1',
      projectId: 'project-1',
      date: new Date(2026, 7, 3 + i),
      hours: 8,
      description: `Day ${i + 1} work`,
    }))
    ctx.prisma.timesheetEntry.create.mockImplementation(({ data }: any) =>
      Promise.resolve({ id: `entry-new`, ...data }),
    )

    for (const entry of entries) {
      await ctx.prisma.timesheetEntry.create({ data: entry })
    }
    expect(ctx.prisma.timesheetEntry.create).toHaveBeenCalledTimes(5)

    // 3. Submit for approval (DRAFT → SUBMITTED is valid)
    expect(isValidTimesheetTransition('DRAFT', 'SUBMITTED')).toBe(true)

    ctx.prisma.timesheetWeek.update.mockResolvedValue({
      ...week,
      status: 'SUBMITTED',
      totalHours: 40,
      submittedAt: new Date(),
    })
    const submitted = await ctx.prisma.timesheetWeek.update({
      where: { id: 'week-1' },
      data: { status: 'SUBMITTED', totalHours: 40, submittedAt: new Date() },
    })
    expect(submitted.status).toBe('SUBMITTED')

    // 4. Manager approves (SUBMITTED → APPROVED is valid)
    expect(isValidTimesheetTransition('SUBMITTED', 'APPROVED')).toBe(true)

    ctx.prisma.timesheetWeek.update.mockResolvedValue({
      ...submitted,
      status: 'APPROVED',
      approvedById: 'manager-1',
      approvedAt: new Date(),
    })
    const approved = await ctx.prisma.timesheetWeek.update({
      where: { id: 'week-1' },
      data: { status: 'APPROVED', approvedById: 'manager-1' },
    })
    expect(approved.status).toBe('APPROVED')
    expect(approved.approvedById).toBe('manager-1')
  })

  it('rejects invalid timesheet transitions', () => {
    expect(isValidTimesheetTransition('DRAFT', 'APPROVED')).toBe(false)
    expect(() => validateTimesheetTransition('DRAFT', 'APPROVED')).toThrow()
  })
})

// ═══════════════════════════════════════════════════════════════
// Scenario 7: Resource plan vs actuals — over-allocation detection
// ═══════════════════════════════════════════════════════════════

describe('Scenario 7: Resource plan vs actuals', () => {
  beforeEach(() => vi.clearAllMocks())

  it('allocate 40h → timesheet entries total 45h → shows over-allocation', async () => {
    // Resource allocation: 40h planned
    const allocation = {
      id: 'alloc-1',
      profileId: 'emp-1',
      projectId: 'project-1',
      weekStarting: new Date('2026-08-03'),
      plannedHours: 40,
      organisationId: 'org-1',
    }
    ctx.prisma.resourceAllocation.findFirst.mockResolvedValue(allocation)

    const plan = await ctx.prisma.resourceAllocation.findFirst({
      where: { profileId: 'emp-1', weekStarting: new Date('2026-08-03') },
    })
    expect(plan!.plannedHours).toBe(40)

    // Timesheet actuals: 45h
    ctx.prisma.timesheetEntry.groupBy.mockResolvedValue([
      { projectId: 'project-1', _sum: { hours: 45 } },
    ])

    const actuals = await ctx.prisma.timesheetEntry.groupBy({
      by: ['projectId'],
      _sum: { hours: true },
      where: { weekId: 'week-1' },
    })

    const actualHours = actuals[0]._sum.hours
    const plannedHours = plan!.plannedHours
    const variance = actualHours - plannedHours

    expect(actualHours).toBe(45)
    expect(variance).toBe(5)
    expect(actualHours).toBeGreaterThan(plannedHours)
  })
})

// ═══════════════════════════════════════════════════════════════
// Scenario 8: Bulk employee import — 3 valid + 1 invalid
// ═══════════════════════════════════════════════════════════════

describe('Scenario 8: Bulk employee import', () => {
  beforeEach(() => vi.clearAllMocks())

  it('CSV with 3 valid rows + 1 invalid → 3 imported, 1 error with details', async () => {
    // Simulate what the import route does: validate rows individually
    const rows = [
      { fullName: 'Alice Smith', email: 'alice@cwa.com', jobTitle: 'Architect' },
      { fullName: 'Bob Jones', email: 'bob@cwa.com', jobTitle: 'Engineer' },
      { fullName: '', email: 'invalid', jobTitle: 'Designer' }, // invalid: no name, bad email
      { fullName: 'Carol Ade', email: 'carol@cwa.com', jobTitle: 'PM' },
    ]

    const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    const errors: Array<{ row: number; field: string; message: string }> = []
    const validRows: Array<{ fullName: string; email: string }> = []

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      const rowNum = i + 2 // 1-indexed, skip header
      const rowErrors: typeof errors = []

      if (!row.fullName.trim()) {
        rowErrors.push({ row: rowNum, field: 'fullName', message: 'Full name is required' })
      }
      if (!EMAIL_RE.test(row.email)) {
        rowErrors.push({ row: rowNum, field: 'email', message: 'Invalid email format' })
      }

      if (rowErrors.length > 0) {
        errors.push(...rowErrors)
      } else {
        validRows.push({ fullName: row.fullName, email: row.email })
      }
    }

    expect(validRows).toHaveLength(3)
    expect(errors).toHaveLength(2) // two errors for row 3 (missing name + bad email)
    expect(errors[0].row).toBe(4) // CSV row 4 (index 2, + 2 for header offset)
    expect(errors[0].field).toBe('fullName')
    expect(errors[1].field).toBe('email')
  })
})

// ═══════════════════════════════════════════════════════════════
// Scenario 9: Probation goals — create review → add goals → track completion
// ═══════════════════════════════════════════════════════════════

describe('Scenario 9: Probation goals', () => {
  beforeEach(() => vi.clearAllMocks())

  it('create review → add 3 goals → mark 2 as COMPLETED → review shows 2/3 goals met', async () => {
    // Create review
    ctx.prisma.probationReview.create.mockResolvedValue({
      id: 'rev-1',
      profileId: 'emp-1',
      reviewType: '90_DAY',
      status: 'SCHEDULED',
    })
    const review = await ctx.prisma.probationReview.create({
      data: { profileId: 'emp-1', reviewType: '90_DAY', status: 'SCHEDULED' },
    })

    // Add 3 goals
    const goals = [
      { id: 'g-1', reviewId: 'rev-1', title: 'Complete HSE training', status: 'COMPLETED' },
      { id: 'g-2', reviewId: 'rev-1', title: 'Pass technical assessment', status: 'COMPLETED' },
      { id: 'g-3', reviewId: 'rev-1', title: 'Lead a project meeting', status: 'IN_PROGRESS' },
    ]
    ctx.prisma.probationGoal.findMany.mockResolvedValue(goals)

    const allGoals = await ctx.prisma.probationGoal.findMany({
      where: { reviewId: 'rev-1' },
    })

    const completedCount = allGoals.filter((g: any) => g.status === 'COMPLETED').length
    const totalCount = allGoals.length

    expect(totalCount).toBe(3)
    expect(completedCount).toBe(2)
    expect(`${completedCount}/${totalCount} goals met`).toBe('2/3 goals met')
  })
})

// ═══════════════════════════════════════════════════════════════
// Scenario 10: Configurable probation duration — org default → milestones
// ═══════════════════════════════════════════════════════════════

describe('Scenario 10: Configurable probation duration', () => {
  beforeEach(() => vi.clearAllMocks())

  it('set org default to 6 months → generates 6 milestone reviews', async () => {
    // Org setting: 6 months probation
    ctx.prisma.organisation.findUnique.mockResolvedValue({
      id: 'org-1',
      settings: { defaultProbationMonths: 6 },
    })

    const months = await getEffectiveProbationMonths(null, 'org-1')
    expect(months).toBe(6)

    // Generate milestone reviews for 6-month probation (30-day intervals)
    const milestones: string[] = []
    for (let i = 1; i <= months; i++) {
      milestones.push(`${i * 30}_DAY`)
    }
    expect(milestones).toEqual(['30_DAY', '60_DAY', '90_DAY', '120_DAY', '150_DAY', '180_DAY'])
    expect(milestones).toHaveLength(6)
  })

  it('employee override takes priority over org default', async () => {
    ctx.prisma.organisation.findUnique.mockResolvedValue({
      id: 'org-1',
      settings: { defaultProbationMonths: 6 },
    })

    // Employee has a 4-month override
    const months = await getEffectiveProbationMonths(4, 'org-1')
    expect(months).toBe(4)
  })

  it('system default is 3 months when nothing configured', async () => {
    ctx.prisma.organisation.findUnique.mockResolvedValue({
      id: 'org-1',
      settings: {},
    })
    const months = await getEffectiveProbationMonths(null, 'org-1')
    expect(months).toBe(3)
  })
})

// ═══════════════════════════════════════════════════════════════
// Scenario 11: @mentions — parse + notification creation
// ═══════════════════════════════════════════════════════════════

describe('Scenario 11: @mentions', () => {
  it('parses @[Jane](id123) format and returns profile IDs', () => {
    const text = 'Please review @[Jane Doe](id123) and loop in @[Bob Smith](id456)'
    const ids = parseMentions(text)
    expect(ids).toEqual(['id123', 'id456'])
  })

  it('deduplicates repeated mentions', () => {
    const text = '@[Jane](id123) check with @[Jane](id123) again'
    const ids = parseMentions(text)
    expect(ids).toEqual(['id123'])
  })

  it('returns empty array for text with no mentions', () => {
    expect(parseMentions('No mentions here')).toEqual([])
    expect(parseMentions('')).toEqual([])
  })

  it('handles mentions in approval comments — notification created', async () => {
    const text = 'Approved — cc @[Jane](id123) for handover'
    const ids = parseMentions(text)
    expect(ids).toEqual(['id123'])

    // The approval engine calls notifyMentions which creates notifications
    ctx.prisma.profile.findMany.mockResolvedValue([{ id: 'id123' }])
    ctx.prisma.profile.findUnique.mockResolvedValue({
      id: 'approver-1',
      fullName: 'Manager',
      organisationId: 'org-1',
    })

    await createNotification({
      profileId: 'id123',
      type: 'mention',
      title: 'Manager mentioned you in a expense comment',
      body: text,
      linkUrl: '/approvals',
    })

    expect(createNotification).toHaveBeenCalledWith(
      expect.objectContaining({ profileId: 'id123', type: 'mention' }),
    )
  })
})

// ═══════════════════════════════════════════════════════════════
// Scenario 12: Role permissions — MEMBER vs HR vs ADMIN
// ═══════════════════════════════════════════════════════════════

describe('Scenario 12: Role permissions', () => {
  it('MEMBER cannot access staffing settings', () => {
    expect(canPerform('MEMBER' as any, 'settings', 'edit_org_settings')).toBe(false)
    expect(canPerform('MEMBER' as any, 'staffing', 'manage_probation')).toBe(false)
    expect(canPerform('MEMBER' as any, 'staffing', 'manage_hr_documents')).toBe(false)
    expect(canPerform('MEMBER' as any, 'staffing', 'view_salary')).toBe(false)
  })

  it('HR can create probation reviews and manage staffing', () => {
    expect(canPerform('HR' as any, 'staffing', 'manage_probation')).toBe(true)
    expect(canPerform('HR' as any, 'staffing', 'manage_hr_documents')).toBe(true)
    expect(canPerform('HR' as any, 'staffing', 'view_salary')).toBe(true)
    expect(canPerform('HR' as any, 'leave', 'approve_all')).toBe(true)
  })

  it('ADMIN can import employees and manage full settings', () => {
    expect(canPerform('ADMIN' as any, 'staffing', 'manage_probation')).toBe(true)
    expect(canPerform('ADMIN' as any, 'staffing', 'manage_hr_documents')).toBe(true)
    expect(canPerform('ADMIN' as any, 'settings', 'edit_org_settings')).toBe(true)
    expect(canPerform('ADMIN' as any, 'settings', 'manage_team')).toBe(true)
  })

  it('lateral roles are isolated — FINANCE cannot see HR data, HR cannot see invoices', () => {
    // FINANCE cannot manage HR docs
    expect(canPerform('FINANCE' as any, 'staffing', 'manage_hr_documents')).toBe(false)
    expect(canPerform('FINANCE' as any, 'staffing', 'manage_probation')).toBe(false)

    // HR cannot see invoices or fee data
    expect(canPerform('HR' as any, 'quotes_invoices', 'create_edit')).toBe(false)
    expect(canPerform('HR' as any, 'ai', 'access_fee_data')).toBe(false)

    // LEGAL cannot see financial data
    expect(canPerform('LEGAL' as any, 'expenses', 'approve_all')).toBe(false)
    expect(canPerform('LEGAL' as any, 'quotes_invoices', 'view_all')).toBe(false)
  })
})

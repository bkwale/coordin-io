import { prisma } from '@/lib/prisma'
import { createNotification, NOTIFICATION_EVENTS } from '@/lib/notifications'
import { recordAuditEvent, AuditActions } from '@/lib/audit'
import type {
  ApprovalRequestType,
  ApproverType,
  ApprovalStepStatus,
} from '@/generated/prisma/client'

// ── Types ────────────────────────────────────────────────────

export interface ApprovalRouteConditions {
  minAmount?: number
  maxAmount?: number
  department?: string
  leaveType?: string
}

export interface ResolvedApprover {
  profileId: string
  label: string
}

interface SubmitContext {
  organisationId: string
  requestType: ApprovalRequestType
  entityId: string
  submitterId: string
  /** Amount for condition matching (expenses, travel) */
  amount?: number
  /** Department for condition matching */
  department?: string
  /** Leave type for condition matching */
  leaveType?: string
  /** Submitter's managerId for LINE_MANAGER resolution */
  submitterManagerId?: string | null
  /** Project manager ID for PROJECT_MANAGER resolution */
  projectManagerId?: string | null
}

// ── Route Matching ───────────────────────────────────────────

/**
 * Find the best matching approval route for a given request.
 * Priority: highest priority matching route, then default route.
 */
export async function findMatchingRoute(
  organisationId: string,
  requestType: ApprovalRequestType,
  context: { amount?: number; department?: string; leaveType?: string },
) {
  const routes = await prisma.approvalRoute.findMany({
    where: {
      organisationId,
      requestType,
      isActive: true,
    },
    include: {
      steps: { orderBy: { stepOrder: 'asc' } },
    },
    orderBy: { priority: 'desc' },
  })

  if (routes.length === 0) return null

  // Try conditional routes first (highest priority)
  for (const route of routes) {
    if (!route.isDefault && route.conditions) {
      const conds = route.conditions as ApprovalRouteConditions
      if (matchesConditions(conds, context)) {
        return route
      }
    }
  }

  // Fall back to default route
  return routes.find((r) => r.isDefault) ?? routes[0]
}

function matchesConditions(
  conditions: ApprovalRouteConditions,
  context: { amount?: number; department?: string; leaveType?: string },
): boolean {
  if (conditions.minAmount != null && (context.amount ?? 0) < conditions.minAmount) {
    return false
  }
  if (conditions.maxAmount != null && (context.amount ?? 0) > conditions.maxAmount) {
    return false
  }
  if (conditions.department && context.department !== conditions.department) {
    return false
  }
  if (conditions.leaveType && context.leaveType !== conditions.leaveType) {
    return false
  }
  return true
}

// ── Approver Resolution ──────────────────────────────────────

/**
 * Resolve who the actual approver should be for a route step.
 */
async function resolveApprover(
  step: { approverType: ApproverType; approverRole: string | null; approverId: string | null },
  context: SubmitContext,
): Promise<string | null> {
  switch (step.approverType) {
    case 'LINE_MANAGER':
      return context.submitterManagerId ?? null

    case 'PROJECT_MANAGER':
      return context.projectManagerId ?? null

    case 'SPECIFIC_PERSON':
      return step.approverId ?? null

    case 'ROLE': {
      if (!step.approverRole) return null
      // Find the first active person with this org role
      const person = await prisma.profile.findFirst({
        where: {
          organisationId: context.organisationId,
          orgPermission: step.approverRole as any,
          status: 'ACTIVE',
        },
        select: { id: true },
        orderBy: { createdAt: 'asc' },
      })
      return person?.id ?? null
    }

    default:
      return null
  }
}

// ── Create Approval Instance ─────────────────────────────────

/**
 * Create an approval instance for a submitted request.
 * Returns the instance ID, or null if no matching route found.
 */
export async function createApprovalInstance(
  context: SubmitContext,
): Promise<string | null> {
  const route = await findMatchingRoute(context.organisationId, context.requestType, {
    amount: context.amount,
    department: context.department,
    leaveType: context.leaveType,
  })

  if (!route || route.steps.length === 0) return null

  // Create instance + all step instances in a transaction
  const instance = await prisma.$transaction(async (tx) => {
    const inst = await tx.approvalInstance.create({
      data: {
        organisationId: context.organisationId,
        routeId: route.id,
        requestType: context.requestType,
        entityId: context.entityId,
        submitterId: context.submitterId,
        currentStepOrder: 1,
        status: 'IN_PROGRESS',
      },
    })

    // Create step instances
    let previousApproverId: string | null = null
    for (const step of route.steps) {
      const approverId = await resolveApprover(step, context)

      // Skip if same as previous and canSkipIfSameAsPrevious is true
      const shouldSkip = step.canSkipIfSameAsPrevious &&
        approverId != null &&
        approverId === previousApproverId

      const escalationDueAt = step.escalationDays
        ? new Date(Date.now() + step.escalationDays * 24 * 60 * 60 * 1000)
        : null

      await tx.approvalStepInstance.create({
        data: {
          instanceId: inst.id,
          stepOrder: step.stepOrder,
          label: step.label,
          approverId,
          status: shouldSkip ? 'SKIPPED' : 'PENDING',
          escalationDueAt: shouldSkip ? null : (step.stepOrder === 1 ? escalationDueAt : null),
        },
      })

      previousApproverId = approverId
    }

    return inst
  })

  // Notify the first non-skipped step's approver
  const firstStep = await prisma.approvalStepInstance.findFirst({
    where: {
      instanceId: instance.id,
      status: 'PENDING',
    },
    orderBy: { stepOrder: 'asc' },
  })

  if (firstStep?.approverId) {
    await createNotification({
      profileId: firstStep.approverId,
      type: NOTIFICATION_EVENTS.APPROVAL_REQUESTED,
      title: `Approval required: ${context.requestType.toLowerCase().replace('_', ' ')}`,
      body: `A ${context.requestType.toLowerCase().replace('_', ' ')} request needs your approval.`,
      linkUrl: `/approvals`,
    })
  }

  return instance.id
}

// ── Process Approval Step ────────────────────────────────────

export type ApprovalAction = 'APPROVE' | 'REJECT'

export interface ProcessResult {
  instanceStatus: string
  stepStatus: ApprovalStepStatus
  nextStepOrder: number | null
  isComplete: boolean
}

/**
 * Process an approval action (approve or reject) on the current step.
 * Wrapped in an interactive $transaction to prevent TOCTOU races.
 */
export async function processApprovalStep(
  instanceId: string,
  approverId: string,
  action: ApprovalAction,
  comment?: string,
): Promise<ProcessResult> {
  const result = await prisma.$transaction(async (tx) => {
    const instance = await tx.approvalInstance.findUnique({
      where: { id: instanceId },
      include: {
        steps: { orderBy: { stepOrder: 'asc' } },
      },
    })

    if (!instance) {
      throw new Error('Approval instance not found')
    }

    if (instance.status !== 'IN_PROGRESS') {
      throw new Error(`Approval is already ${instance.status}`)
    }

    // Find the current pending step
    const currentStep = instance.steps.find(
      (s) => s.status === 'PENDING' && s.stepOrder === instance.currentStepOrder,
    )

    // If current step was skipped, find next pending
    const effectiveStep = currentStep ?? instance.steps.find((s) => s.status === 'PENDING')

    if (!effectiveStep) {
      throw new Error('No pending step found')
    }

    // Verify the approver matches (or is admin)
    if (effectiveStep.approverId && effectiveStep.approverId !== approverId) {
      const approverProfile = await tx.profile.findUnique({
        where: { id: approverId },
        select: { orgPermission: true },
      })
      if (!approverProfile || !['ADMIN', 'OWNER'].includes(approverProfile.orgPermission)) {
        throw new Error('You are not the assigned approver for this step')
      }
    }

    const now = new Date()

    if (action === 'REJECT') {
      await tx.approvalStepInstance.update({
        where: { id: effectiveStep.id },
        data: { status: 'REJECTED', comment, actionedAt: now },
      })
      await tx.approvalInstance.update({
        where: { id: instanceId },
        data: { status: 'REJECTED', completedAt: now },
      })

      return {
        instanceStatus: 'REJECTED' as const,
        stepStatus: 'REJECTED' as ApprovalStepStatus,
        nextStepOrder: null,
        isComplete: true,
        _submitterId: instance.submitterId,
        _requestType: instance.requestType,
        _nextApproverId: null as string | null,
      }
    }

    // APPROVE — advance to next step or complete
    const nextPendingStep = instance.steps.find(
      (s) => s.stepOrder > effectiveStep.stepOrder && s.status === 'PENDING',
    )

    if (nextPendingStep) {
      await tx.approvalStepInstance.update({
        where: { id: effectiveStep.id },
        data: { status: 'APPROVED', comment, actionedAt: now },
      })
      await tx.approvalInstance.update({
        where: { id: instanceId },
        data: { currentStepOrder: nextPendingStep.stepOrder },
      })

      return {
        instanceStatus: 'IN_PROGRESS' as const,
        stepStatus: 'APPROVED' as ApprovalStepStatus,
        nextStepOrder: nextPendingStep.stepOrder,
        isComplete: false,
        _submitterId: instance.submitterId,
        _requestType: instance.requestType,
        _nextApproverId: nextPendingStep.approverId,
      }
    }

    // No more steps — approval complete
    await tx.approvalStepInstance.update({
      where: { id: effectiveStep.id },
      data: { status: 'APPROVED', comment, actionedAt: now },
    })
    await tx.approvalInstance.update({
      where: { id: instanceId },
      data: { status: 'APPROVED', completedAt: now },
    })

    return {
      instanceStatus: 'APPROVED' as const,
      stepStatus: 'APPROVED' as ApprovalStepStatus,
      nextStepOrder: null,
      isComplete: true,
      _submitterId: instance.submitterId,
      _requestType: instance.requestType,
      _nextApproverId: null as string | null,
    }
  })

  // Notifications outside the transaction (non-critical)
  if (result._nextApproverId) {
    await createNotification({
      profileId: result._nextApproverId,
      type: NOTIFICATION_EVENTS.APPROVAL_REQUESTED,
      title: `Approval required (step ${result.nextStepOrder})`,
      body: `A ${result._requestType.toLowerCase().replace('_', ' ')} request needs your approval.`,
      linkUrl: `/approvals`,
    }).catch(() => {})
  }

  if (result.isComplete && result.instanceStatus === 'APPROVED') {
    await createNotification({
      profileId: result._submitterId,
      type: NOTIFICATION_EVENTS.APPROVAL_COMPLETED,
      title: `Request approved`,
      body: `Your ${result._requestType.toLowerCase().replace('_', ' ')} request has been fully approved.`,
      linkUrl: `/approvals`,
    }).catch(() => {})
  }

  return {
    instanceStatus: result.instanceStatus,
    stepStatus: result.stepStatus,
    nextStepOrder: result.nextStepOrder,
    isComplete: result.isComplete,
  }
}

// ── Force Approve (Admin) ────────────────────────────────────

/**
 * Admin force-approve: skip all remaining steps and approve the instance.
 */
export async function forceApprove(
  instanceId: string,
  adminId: string,
  comment?: string,
): Promise<void> {
  const instance = await prisma.approvalInstance.findUnique({
    where: { id: instanceId },
    include: { steps: true },
  })

  if (!instance || instance.status !== 'IN_PROGRESS') {
    throw new Error('Cannot force-approve: instance not found or not in progress')
  }

  // Verify org isolation: admin must belong to the same org
  const admin = await prisma.profile.findUnique({
    where: { id: adminId },
    select: { organisationId: true },
  })
  if (!admin || admin.organisationId !== instance.organisationId) {
    throw new Error('Cannot force-approve: admin not in same organisation')
  }

  const now = new Date()

  await prisma.$transaction([
    // Mark all pending steps as skipped
    prisma.approvalStepInstance.updateMany({
      where: {
        instanceId,
        status: 'PENDING',
      },
      data: {
        status: 'SKIPPED',
        comment: `Force-approved by admin: ${comment ?? ''}`.trim(),
        actionedAt: now,
      },
    }),
    // Complete the instance
    prisma.approvalInstance.update({
      where: { id: instanceId },
      data: {
        status: 'APPROVED',
        completedAt: now,
      },
    }),
  ])

  // Notify submitter
  await createNotification({
    profileId: instance.submitterId,
    type: NOTIFICATION_EVENTS.APPROVAL_COMPLETED,
    title: `Request approved (admin override)`,
    body: `Your ${instance.requestType.toLowerCase().replace('_', ' ')} request has been approved by an administrator.`,
    linkUrl: `/approvals`,
  })

  await recordAuditEvent({
    organisationId: instance.organisationId,
    actorId: adminId,
    action: AuditActions.APPROVAL_FORCE_APPROVED,
    entityType: 'ApprovalInstance',
    entityId: instanceId,
    metadata: { comment, requestType: instance.requestType, entityId: instance.entityId },
  })
}

// ── Cancel Approval ──────────────────────────────────────────

/**
 * Cancel an in-progress approval instance (e.g. when request is withdrawn).
 */
export async function cancelApproval(instanceId: string): Promise<void> {
  await prisma.$transaction([
    prisma.approvalStepInstance.updateMany({
      where: { instanceId, status: 'PENDING' },
      data: { status: 'SKIPPED', actionedAt: new Date() },
    }),
    prisma.approvalInstance.update({
      where: { id: instanceId },
      data: { status: 'CANCELLED', completedAt: new Date() },
    }),
  ])
}

// ── Query Helpers ────────────────────────────────────────────

/**
 * Get pending approvals for a specific approver.
 */
export async function getPendingApprovalsForUser(
  approverId: string,
  organisationId: string,
) {
  return prisma.approvalStepInstance.findMany({
    where: {
      approverId,
      status: 'PENDING',
      instance: {
        organisationId,
        status: 'IN_PROGRESS',
      },
    },
    include: {
      instance: {
        select: {
          id: true,
          requestType: true,
          entityId: true,
          submitterId: true,
          currentStepOrder: true,
          createdAt: true,
          submitter: {
            select: { id: true, fullName: true, email: true },
          },
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  })
}

/**
 * Get the approval instance for a specific entity.
 */
export async function getApprovalForEntity(
  entityId: string,
  requestType: ApprovalRequestType,
  organisationId?: string,
) {
  return prisma.approvalInstance.findFirst({
    where: { entityId, requestType, ...(organisationId ? { organisationId } : {}) },
    include: {
      steps: {
        orderBy: { stepOrder: 'asc' },
        include: {
          approver: { select: { id: true, fullName: true } },
        },
      },
      route: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'desc' },
  })
}

// ── Seed Default Routes ──────────────────────────────────────

/**
 * Create default approval routes for a new organisation.
 */
export async function seedDefaultApprovalRoutes(organisationId: string): Promise<void> {
  const defaults: Array<{
    requestType: ApprovalRequestType
    name: string
    isDefault: boolean
    priority: number
    conditions: ApprovalRouteConditions | null
    steps: Array<{
      stepOrder: number
      label: string
      approverType: ApproverType
      approverRole?: string
      canSkipIfSameAsPrevious?: boolean
      escalationDays?: number
    }>
  }> = [
    {
      requestType: 'LEAVE',
      name: 'Standard Leave',
      isDefault: true,
      priority: 0,
      conditions: null,
      steps: [
        { stepOrder: 1, label: 'Line Manager Review', approverType: 'LINE_MANAGER', escalationDays: 3 },
        { stepOrder: 2, label: 'HR Review', approverType: 'ROLE', approverRole: 'HR', escalationDays: 5 },
      ],
    },
    {
      requestType: 'EXPENSE',
      name: 'Standard Expense',
      isDefault: true,
      priority: 0,
      conditions: null,
      steps: [
        { stepOrder: 1, label: 'Line Manager Approval', approverType: 'LINE_MANAGER', escalationDays: 3 },
        { stepOrder: 2, label: 'Finance Review', approverType: 'ROLE', approverRole: 'FINANCE', escalationDays: 5 },
      ],
    },
    {
      requestType: 'EXPENSE',
      name: 'Large Expense (>5000)',
      isDefault: false,
      priority: 10,
      conditions: { minAmount: 5000 },
      steps: [
        { stepOrder: 1, label: 'Line Manager Approval', approverType: 'LINE_MANAGER', escalationDays: 2 },
        { stepOrder: 2, label: 'Commercial Manager Approval', approverType: 'ROLE', approverRole: 'COMMERCIAL', canSkipIfSameAsPrevious: true, escalationDays: 3 },
        { stepOrder: 3, label: 'Finance Review', approverType: 'ROLE', approverRole: 'FINANCE', escalationDays: 5 },
      ],
    },
    {
      requestType: 'TRAVEL',
      name: 'Travel Approval',
      isDefault: true,
      priority: 0,
      conditions: null,
      steps: [
        { stepOrder: 1, label: 'Line Manager / Design Lead', approverType: 'LINE_MANAGER', escalationDays: 2 },
        { stepOrder: 2, label: 'Finance Review', approverType: 'ROLE', approverRole: 'FINANCE', escalationDays: 3 },
      ],
    },
    {
      requestType: 'SERVICE_REQUEST',
      name: 'Standard Service Request',
      isDefault: true,
      priority: 0,
      conditions: null,
      steps: [
        { stepOrder: 1, label: 'Line Manager Approval', approverType: 'LINE_MANAGER', escalationDays: 3 },
      ],
    },
  ]

  for (const route of defaults) {
    const created = await prisma.approvalRoute.create({
      data: {
        organisationId,
        requestType: route.requestType,
        name: route.name,
        isDefault: route.isDefault,
        priority: route.priority,
        conditions: route.conditions ? (route.conditions as any) : undefined,
      },
    })

    for (const step of route.steps) {
      await prisma.approvalRouteStep.create({
        data: {
          routeId: created.id,
          stepOrder: step.stepOrder,
          label: step.label,
          approverType: step.approverType,
          approverRole: step.approverRole ?? null,
          canSkipIfSameAsPrevious: step.canSkipIfSameAsPrevious ?? false,
          escalationDays: step.escalationDays ?? null,
        },
      })
    }
  }
}

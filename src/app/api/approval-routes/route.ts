import type { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { success } from '@/lib/api-response'
import { withAuth } from '@/lib/with-auth'
import { requireString, requireEnum, optionalString, optionalNumber, parseBody } from '@/lib/validation'
import { recordAuditEvent, AuditActions } from '@/lib/audit'
import { PermissionError } from '@/lib/errors'

const REQUEST_TYPES = ['LEAVE', 'EXPENSE', 'SERVICE_REQUEST', 'TRAVEL'] as const

const ALLOWED_CONDITION_KEYS = new Set(['minAmount', 'maxAmount', 'department', 'leaveType'])

/**
 * Validate conditions JSON matches the ApprovalRouteConditions shape.
 * Rejects unknown keys and ensures value types are correct.
 */
function validateConditions(raw: unknown): Record<string, unknown> | null {
  if (!raw || typeof raw !== 'object') return null
  const obj = raw as Record<string, unknown>
  const result: Record<string, unknown> = {}
  for (const [key, val] of Object.entries(obj)) {
    if (!ALLOWED_CONDITION_KEYS.has(key)) {
      throw new Error(`Unknown condition key: ${key}. Allowed: ${[...ALLOWED_CONDITION_KEYS].join(', ')}`)
    }
    if ((key === 'minAmount' || key === 'maxAmount') && val != null) {
      if (typeof val !== 'number' || val < 0) throw new Error(`${key} must be a non-negative number`)
    }
    if ((key === 'department' || key === 'leaveType') && val != null) {
      if (typeof val !== 'string') throw new Error(`${key} must be a string`)
    }
    if (val != null) result[key] = val
  }
  return Object.keys(result).length > 0 ? result : null
}

/**
 * GET /api/approval-routes — List approval routes for the organisation.
 * Requires ADMIN or OWNER.
 */
export const GET = withAuth(async (_request: NextRequest, { profile }) => {
  if (!['ADMIN', 'OWNER'].includes(profile.orgPermission)) {
    throw new PermissionError('Only administrators can manage approval routes')
  }

  const routes = await prisma.approvalRoute.findMany({
    where: { organisationId: profile.organisationId },
    include: {
      steps: { orderBy: { stepOrder: 'asc' } },
    },
    orderBy: [{ requestType: 'asc' }, { priority: 'desc' }],
  })

  return success({ routes })
})

/**
 * POST /api/approval-routes — Create a new approval route.
 * Requires ADMIN or OWNER.
 */
export const POST = withAuth(async (request: NextRequest, { profile }) => {
  if (!['ADMIN', 'OWNER'].includes(profile.orgPermission)) {
    throw new PermissionError('Only administrators can create approval routes')
  }

  const body = await parseBody(request)

  const name = requireString(body.name, 'Name', 200)
  const requestType = requireEnum(body.requestType, 'Request type', REQUEST_TYPES)
  const isDefault = body.isDefault === true
  const priority = optionalNumber(body.priority, 'Priority', { min: 0, max: 100 }) ?? 0
  const conditions = validateConditions(body.conditions)

  // Validate steps
  const steps = body.steps
  if (!Array.isArray(steps) || steps.length === 0) {
    throw new Error('At least one approval step is required')
  }
  if (steps.length > 20) {
    throw new Error('Maximum 20 approval steps per route')
  }

  const route = await prisma.$transaction(async (tx) => {
    // If setting as default, unset existing default for this type
    if (isDefault) {
      await tx.approvalRoute.updateMany({
        where: {
          organisationId: profile.organisationId,
          requestType,
          isDefault: true,
        },
        data: { isDefault: false },
      })
    }

    const created = await tx.approvalRoute.create({
      data: {
        organisationId: profile.organisationId,
        requestType,
        name,
        isDefault,
        priority,
        conditions: conditions as any,
      },
    })

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i]
      await tx.approvalRouteStep.create({
        data: {
          routeId: created.id,
          stepOrder: i + 1,
          label: optionalString(step.label, 'Step label', 200) ?? `Step ${i + 1}`,
          approverType: requireEnum(step.approverType, 'Approver type', [
            'LINE_MANAGER', 'PROJECT_MANAGER', 'ROLE', 'SPECIFIC_PERSON',
          ] as const),
          approverRole: optionalString(step.approverRole, 'Approver role', 50) ?? null,
          approverId: step.approverId ?? null,
          canSkipIfSameAsPrevious: step.canSkipIfSameAsPrevious === true,
          escalationDays: optionalNumber(step.escalationDays, 'Escalation days', { min: 1, max: 30 }) ?? null,
        },
      })
    }

    return tx.approvalRoute.findUnique({
      where: { id: created.id },
      include: { steps: { orderBy: { stepOrder: 'asc' } } },
    })
  })

  await recordAuditEvent({
    organisationId: profile.organisationId,
    actorId: profile.id,
    action: AuditActions.APPROVAL_ROUTE_CREATED,
    entityType: 'ApprovalRoute',
    entityId: route!.id,
    metadata: { name, requestType, stepCount: steps.length },
  })

  return success({ route }, 201)
})

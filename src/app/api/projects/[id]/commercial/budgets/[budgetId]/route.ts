import type { NextRequest } from 'next/server'
import { commercialPrisma as prisma } from '@/lib/prisma-commercial'
import { success } from '@/lib/api-response'
import { withProjectAccess } from '@/lib/with-project-access'
import { recordAuditEvent, AuditActions } from '@/lib/audit'
import { parseBody, optionalString, optionalEnum } from '@/lib/validation'
import { NotFoundError, PermissionError } from '@/lib/errors'
import { hasOrgPermission } from '@/lib/permissions'
// TODO: Add createNotification when Budget model gets createdById field

const BUDGET_STATUSES = ['DRAFT', 'SUBMITTED', 'APPROVED', 'SUPERSEDED'] as const

/**
 * Extract budgetId from the URL path.
 */
function extractBudgetId(request: NextRequest): string {
  const url = new URL(request.url)
  const segments = url.pathname.split('/')
  const budgetsIdx = segments.indexOf('budgets')
  const budgetId = budgetsIdx >= 0 ? segments[budgetsIdx + 1] : undefined
  if (!budgetId) throw new NotFoundError('Budget ID is required')
  return budgetId
}

/**
 * GET /api/projects/[id]/commercial/budgets/[budgetId] — Single budget with cost plan lines.
 */
export const GET = withProjectAccess(async (request: NextRequest, { projectId }) => {
  const budgetId = extractBudgetId(request)

  const budget = await prisma.budget.findFirst({
    where: { id: budgetId, projectId },
    include: {
      costPlanLines: {
        orderBy: { sortOrder: 'asc' },
      },
    },
  })

  if (!budget) {
    throw new NotFoundError('Budget not found')
  }

  return success({ budget })
})

/**
 * PATCH /api/projects/[id]/commercial/budgets/[budgetId] — Update budget fields or approve.
 *
 * Approval requires MANAGER+ org permission.
 */
export const PATCH = withProjectAccess(async (request: NextRequest, { projectId, profile }) => {
  const budgetId = extractBudgetId(request)
  const body = await parseBody(request)

  const existing = await prisma.budget.findFirst({
    where: { id: budgetId, projectId },
  })

  if (!existing) {
    throw new NotFoundError('Budget not found')
  }

  const data: Record<string, unknown> = {}

  if ('name' in body) data.name = optionalString(body.name, 'Budget name', 200) ?? undefined
  if ('notes' in body) data.notes = optionalString(body.notes, 'Notes', 5000)

  if ('status' in body) {
    const newStatus = optionalEnum(body.status, 'Status', BUDGET_STATUSES)

    // Approval requires MANAGER+ permission
    if (newStatus === 'APPROVED') {
      if (!hasOrgPermission(profile.orgPermission, 'MANAGER')) {
        throw new PermissionError('Budget approval requires Manager permission or above')
      }
      data.status = 'APPROVED'
      data.approvedBy = profile.id
      data.approvedAt = new Date()
    } else if (newStatus) {
      data.status = newStatus
    }
  }

  const budget = await prisma.budget.update({
    where: { id: budgetId },
    data,
    include: {
      costPlanLines: {
        orderBy: { sortOrder: 'asc' },
      },
    },
  })

  const action = data.status === 'APPROVED'
    ? AuditActions.BUDGET_APPROVED
    : AuditActions.BUDGET_UPDATED

  await recordAuditEvent({
    organisationId: profile.organisationId,
    actorId: profile.id,
    action,
    entityType: 'Budget',
    entityId: budgetId,
    metadata: { updatedFields: Object.keys(data) },
  })

  return success({ budget })
})

/**
 * DELETE /api/projects/[id]/commercial/budgets/[budgetId] — Delete a draft budget.
 *
 * Only DRAFT budgets can be deleted. Approved/submitted budgets must be superseded instead.
 */
export const DELETE = withProjectAccess(async (request: NextRequest, { projectId, profile }) => {
  const budgetId = extractBudgetId(request)

  const existing = await prisma.budget.findFirst({
    where: { id: budgetId, projectId },
  })

  if (!existing) {
    throw new NotFoundError('Budget not found')
  }

  if (existing.status !== 'DRAFT') {
    throw new PermissionError(
      'Only draft budgets can be deleted. Approved or submitted budgets must be superseded.',
    )
  }

  // Cascade will delete cost plan lines
  await prisma.budget.delete({
    where: { id: budgetId },
  })

  await recordAuditEvent({
    organisationId: profile.organisationId,
    actorId: profile.id,
    action: AuditActions.BUDGET_DELETED,
    entityType: 'Budget',
    entityId: budgetId,
    metadata: { name: existing.name, totalAmount: existing.totalAmount },
  })

  return success({ deleted: true })
}, { minProjectRole: 'PROJECT_LEAD' })

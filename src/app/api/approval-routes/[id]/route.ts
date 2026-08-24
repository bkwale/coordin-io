import type { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { success } from '@/lib/api-response'
import { withAuth } from '@/lib/with-auth'
import { optionalString, optionalNumber, parseBody } from '@/lib/validation'
import { recordAuditEvent, AuditActions } from '@/lib/audit'
import { NotFoundError, PermissionError } from '@/lib/errors'

function extractId(url: string): string {
  const id = url.match(/\/approval-routes\/([^/?]+)/)?.[1]
  if (!id) throw new NotFoundError('Route ID is required')
  return id
}

/**
 * GET /api/approval-routes/[id] — Get a single approval route with steps.
 */
export const GET = withAuth(async (request: NextRequest, { profile }) => {
  if (!['ADMIN', 'OWNER'].includes(profile.orgPermission)) {
    throw new PermissionError('Only administrators can view approval routes')
  }

  const id = extractId(request.url)

  const route = await prisma.approvalRoute.findFirst({
    where: { id, organisationId: profile.organisationId },
    include: { steps: { orderBy: { stepOrder: 'asc' } } },
  })

  if (!route) throw new NotFoundError('Approval route not found')

  return success({ route })
})

/**
 * PATCH /api/approval-routes/[id] — Update an approval route.
 */
export const PATCH = withAuth(async (request: NextRequest, { profile }) => {
  if (!['ADMIN', 'OWNER'].includes(profile.orgPermission)) {
    throw new PermissionError('Only administrators can update approval routes')
  }

  const id = extractId(request.url)
  const body = await parseBody(request)

  const existing = await prisma.approvalRoute.findFirst({
    where: { id, organisationId: profile.organisationId },
  })
  if (!existing) throw new NotFoundError('Approval route not found')

  const data: Record<string, unknown> = {}

  if ('name' in body) data.name = optionalString(body.name, 'Name', 200)
  if ('isDefault' in body) data.isDefault = body.isDefault === true
  if ('isActive' in body) data.isActive = body.isActive === true
  if ('priority' in body) data.priority = optionalNumber(body.priority, 'Priority', { min: 0, max: 100 }) ?? 0
  if ('conditions' in body) data.conditions = body.conditions && typeof body.conditions === 'object' ? body.conditions as any : null

  // Wrap default-unsetting + update in a transaction to avoid race
  const route = await prisma.$transaction(async (tx) => {
    if (data.isDefault === true && !existing.isDefault) {
      await tx.approvalRoute.updateMany({
        where: {
          organisationId: profile.organisationId,
          requestType: existing.requestType,
          isDefault: true,
          id: { not: id },
        },
        data: { isDefault: false },
      })
    }

    return tx.approvalRoute.update({
      where: { id },
      data,
      include: { steps: { orderBy: { stepOrder: 'asc' } } },
    })
  })

  await recordAuditEvent({
    organisationId: profile.organisationId,
    actorId: profile.id,
    action: AuditActions.APPROVAL_ROUTE_UPDATED,
    entityType: 'ApprovalRoute',
    entityId: id,
    metadata: { updatedFields: Object.keys(data) },
  })

  return success({ route })
})

/**
 * DELETE /api/approval-routes/[id] — Delete an approval route.
 * Cannot delete if there are in-progress instances using this route.
 */
export const DELETE = withAuth(async (request: NextRequest, { profile }) => {
  if (!['ADMIN', 'OWNER'].includes(profile.orgPermission)) {
    throw new PermissionError('Only administrators can delete approval routes')
  }

  const id = extractId(request.url)

  const existing = await prisma.approvalRoute.findFirst({
    where: { id, organisationId: profile.organisationId },
  })
  if (!existing) throw new NotFoundError('Approval route not found')

  // Check for active instances
  const activeCount = await prisma.approvalInstance.count({
    where: { routeId: id, status: 'IN_PROGRESS' },
  })

  if (activeCount > 0) {
    throw new Error(`Cannot delete route with ${activeCount} active approval(s). Deactivate it instead.`)
  }

  await prisma.$transaction([
    prisma.approvalRouteStep.deleteMany({ where: { routeId: id } }),
    prisma.approvalRoute.delete({ where: { id } }),
  ])

  await recordAuditEvent({
    organisationId: profile.organisationId,
    actorId: profile.id,
    action: AuditActions.APPROVAL_ROUTE_UPDATED,
    entityType: 'ApprovalRoute',
    entityId: id,
    metadata: { action: 'deleted', name: existing.name },
  })

  return success({ deleted: true })
})

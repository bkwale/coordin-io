import { NextRequest } from 'next/server'
import { modulesPrisma } from '@/lib/prisma-modules'
import { success } from '@/lib/api-response'
import { withAuth } from '@/lib/with-auth'
import { requireString, optionalString, optionalNumber, parseBody } from '@/lib/validation'
import { NotFoundError, PermissionError } from '@/lib/errors'

/**
 * Extract the service request ID from the URL.
 */
function getRequestId(url: string): string {
  const match = url.match(/\/service-requests\/([^/]+)\/items/)
  return match?.[1] ?? ''
}

/**
 * Verify the service request exists and the user has access.
 * Returns the service request.
 */
async function verifyAccess(
  url: string,
  profile: { id: string; organisationId: string; orgPermission: string }
) {
  const requestId = getRequestId(url)
  if (!requestId) throw new NotFoundError('Service request not found')

  const sr = await modulesPrisma.serviceRequest.findUnique({
    where: { id: requestId },
    select: {
      id: true,
      profileId: true,
      organisationId: true,
      status: true,
      assignedToId: true,
      approverId: true,
    },
  })

  if (!sr || sr.organisationId !== profile.organisationId) {
    throw new NotFoundError('Service request not found')
  }

  const isOwner = sr.profileId === profile.id
  const isAdmin = profile.orgPermission === 'ADMIN' || profile.orgPermission === 'OWNER'
  const isManager = profile.orgPermission === 'MANAGER'
  const isAssignee = sr.assignedToId === profile.id
  const isApprover = sr.approverId === profile.id

  if (!isOwner && !isAdmin && !isManager && !isAssignee && !isApprover) {
    throw new PermissionError('You do not have access to this service request')
  }

  return { sr, isOwner, isAdmin, isManager }
}

/**
 * GET /api/service-requests/[id]/items — List all line items.
 */
export const GET = withAuth(async (request: NextRequest, { profile }) => {
  const { sr } = await verifyAccess(request.url, profile)

  const items = await modulesPrisma.serviceRequestItem.findMany({
    where: { serviceRequestId: sr.id },
    orderBy: { sortOrder: 'asc' },
  })

  return success({ items })
})

/**
 * POST /api/service-requests/[id]/items — Add a line item.
 *
 * Only the requester (owner) or admin/manager can add items.
 * Items can only be added while the request is in DRAFT status.
 */
export const POST = withAuth(async (request: NextRequest, { profile }) => {
  const { sr, isOwner, isAdmin, isManager } = await verifyAccess(request.url, profile)

  if (!isOwner && !isAdmin && !isManager) {
    throw new PermissionError('Only the requester or an admin can add items')
  }

  if (sr.status !== 'DRAFT') {
    throw new PermissionError('Items can only be added while the request is in DRAFT status')
  }

  const body = await parseBody(request)

  const description = requireString(body.description, 'Description', 500)
  const quantity = optionalNumber(body.quantity, 'Quantity', { min: 1, max: 10000 }) ?? 1
  const unitCost = optionalNumber(body.unitCost, 'Unit cost', { min: 0 })
  const currency = optionalString(body.currency, 'Currency', 10)
  const category = optionalString(body.category, 'Category', 200)
  const notes = optionalString(body.notes, 'Notes', 2000)

  // Get max sort order
  const maxItem = await modulesPrisma.serviceRequestItem.findFirst({
    where: { serviceRequestId: sr.id },
    orderBy: { sortOrder: 'desc' },
    select: { sortOrder: true },
  })

  const item = await modulesPrisma.serviceRequestItem.create({
    data: {
      serviceRequestId: sr.id,
      description,
      quantity: Math.round(quantity),
      unitCost: unitCost ?? null,
      currency: currency || 'GBP',
      category: category || null,
      notes: notes || null,
      sortOrder: (maxItem?.sortOrder ?? 0) + 1,
    },
  })

  // Update the parent request's estimatedCost as sum of items
  await recalculateTotal(sr.id)

  return success({ item }, 201)
})

/**
 * PATCH /api/service-requests/[id]/items — Update or delete a line item.
 *
 * Body: { itemId, ...fields } or { itemId, _delete: true }
 */
export const PATCH = withAuth(async (request: NextRequest, { profile }) => {
  const { sr, isOwner, isAdmin, isManager } = await verifyAccess(request.url, profile)

  if (!isOwner && !isAdmin && !isManager) {
    throw new PermissionError('Only the requester or an admin can update items')
  }

  if (sr.status !== 'DRAFT') {
    throw new PermissionError('Items can only be modified while the request is in DRAFT status')
  }

  const body = await parseBody(request)
  const itemId = requireString(body.itemId, 'itemId')

  const item = await modulesPrisma.serviceRequestItem.findFirst({
    where: { id: itemId, serviceRequestId: sr.id },
  })
  if (!item) {
    throw new NotFoundError('Item not found')
  }

  // Delete
  if (body._delete === true) {
    await modulesPrisma.serviceRequestItem.delete({ where: { id: itemId } })
    await recalculateTotal(sr.id)
    return success({ deleted: true })
  }

  // Update
  const updateData: Record<string, unknown> = {}
  if (body.description !== undefined) {
    updateData.description = requireString(body.description, 'Description', 500)
  }
  if (body.quantity !== undefined) {
    const q = optionalNumber(body.quantity, 'Quantity', { min: 1, max: 10000 })
    if (q !== null) updateData.quantity = Math.round(q)
  }
  if (body.unitCost !== undefined) {
    updateData.unitCost = optionalNumber(body.unitCost, 'Unit cost', { min: 0 })
  }
  if (body.currency !== undefined) {
    updateData.currency = optionalString(body.currency, 'Currency', 10) || 'GBP'
  }
  if (body.category !== undefined) {
    updateData.category = optionalString(body.category, 'Category', 200) || null
  }
  if (body.notes !== undefined) {
    updateData.notes = optionalString(body.notes, 'Notes', 2000) || null
  }

  const updated = await modulesPrisma.serviceRequestItem.update({
    where: { id: itemId },
    data: updateData,
  })

  await recalculateTotal(sr.id)

  return success({ item: updated })
})

/**
 * Recalculate the parent service request's estimatedCost from item totals.
 */
async function recalculateTotal(serviceRequestId: string) {
  const items = await modulesPrisma.serviceRequestItem.findMany({
    where: { serviceRequestId },
    select: { quantity: true, unitCost: true },
  })

  const total = items.reduce((sum: number, i: { quantity: number; unitCost: number | null }) => {
    return sum + (i.unitCost ? i.quantity * i.unitCost : 0)
  }, 0)

  await modulesPrisma.serviceRequest.update({
    where: { id: serviceRequestId },
    data: { estimatedCost: total > 0 ? total : null },
  })
}

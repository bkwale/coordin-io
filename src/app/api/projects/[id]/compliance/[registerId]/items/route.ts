import type { NextRequest } from 'next/server'
import { modulesPrisma as prisma } from '@/lib/prisma-modules'
import { success } from '@/lib/api-response'
import { withProjectAccess } from '@/lib/with-project-access'
import { parseBody, requireString, optionalString, optionalDate, optionalNumber, optionalId } from '@/lib/validation'

import { NotFoundError, ConflictError } from '@/lib/errors'
import { recomputeRegisterStatus } from '@/lib/compliance-helpers'

/**
 * Extract registerId from the URL path.
 */
function extractRegisterId(request: NextRequest): string {
  const url = new URL(request.url)
  const segments = url.pathname.split('/')
  const complianceIdx = segments.indexOf('compliance')
  const registerId = complianceIdx >= 0 ? segments[complianceIdx + 1] : undefined
  if (!registerId) {
    throw new NotFoundError('Register ID is required')
  }
  return registerId
}

/**
 * GET /api/projects/[id]/compliance/[registerId]/items — List items for a compliance register.
 * Supports query params: status, section
 */
export const GET = withProjectAccess(async (request: NextRequest, { projectId }) => {
  const registerId = extractRegisterId(request)
  const url = new URL(request.url)
  const status = url.searchParams.get('status')
  const section = url.searchParams.get('section')

  // Verify register belongs to the project
  const register = await (prisma as any).complianceRegister.findFirst({
    where: { id: registerId, projectId },
  })
  if (!register) {
    throw new NotFoundError('Compliance register not found')
  }

  const where: Record<string, unknown> = { registerId }
  if (status) where.status = status
  if (section) where.section = section

  const items = await (prisma as any).complianceItem.findMany({
    where,
    orderBy: [
      { sortOrder: 'asc' },
      { createdAt: 'asc' },
    ],
  })

  // Resolve owner names from profile IDs
  const ownerIds = [...new Set(items.map((i: Record<string, unknown>) => i.ownerId).filter(Boolean))] as string[]
  let ownerMap: Record<string, string> = {}
  if (ownerIds.length > 0) {
    const { prisma: mainPrisma } = await import('@/lib/prisma')
    const profiles = await mainPrisma.profile.findMany({
      where: { id: { in: ownerIds } },
      select: { id: true, fullName: true },
    })
    ownerMap = Object.fromEntries(profiles.map((p: { id: string; fullName: string }) => [p.id, p.fullName]))
  }

  const enrichedItems = items.map((item: Record<string, unknown>) => ({
    ...item,
    owner: item.ownerId ? ownerMap[item.ownerId as string] || null : null,
  }))

  return success({ items: enrichedItems })
})

/**
 * POST /api/projects/[id]/compliance/[registerId]/items — Create a compliance item.
 */
export const POST = withProjectAccess(async (request: NextRequest, { projectId }) => {
  const registerId = extractRegisterId(request)
  const body = await parseBody(request)

  // Verify register belongs to the project
  const register = await (prisma as any).complianceRegister.findFirst({
    where: { id: registerId, projectId },
  })
  if (!register) {
    throw new NotFoundError('Compliance register not found')
  }

  const requirement = requireString(body.requirement, 'Requirement', 5000)

  // Bug #1 fix: prevent duplicate requirements within the same register
  const existing = await (prisma as any).complianceItem.findFirst({
    where: { registerId, requirement },
  })
  if (existing) {
    throw new ConflictError('A compliance item with this requirement already exists in this register')
  }

  const section = optionalString(body.section, 'Section', 200)
  const source = optionalString(body.source, 'Source', 500)
  const version = optionalString(body.version, 'Version', 100)
  const ownerId = optionalId(body.ownerId, 'Owner ID')
  const dueDate = optionalDate(body.dueDate, 'Due date')
  const evidence = optionalString(body.evidence, 'Evidence', 5000)
  const comments = optionalString(body.comments, 'Comments', 5000)
  const sortOrder = optionalNumber(body.sortOrder, 'Sort order') ?? 0

  const item = await (prisma as any).complianceItem.create({
    data: {
      registerId,
      requirement,
      section,
      source,
      version,
      ownerId,
      dueDate,
      evidence,
      comments,
      sortOrder,
    },
  })

  // Recompute parent register's overallStatus from item-level data
  await recomputeRegisterStatus(prisma as any, registerId)

  // Resolve owner name for the response
  let ownerName: string | null = null
  if (item.ownerId) {
    const { prisma: mainPrisma } = await import('@/lib/prisma')
    const ownerProfile = await mainPrisma.profile.findUnique({
      where: { id: item.ownerId },
      select: { fullName: true },
    })
    ownerName = ownerProfile?.fullName || null
  }

  return success({ item: { ...item, owner: ownerName } }, 201)
})

/**
 * PATCH /api/projects/[id]/compliance/[registerId]/items — Update a compliance item.
 * Expects { itemId, ...fields } in the body.
 */
export const PATCH = withProjectAccess(async (request: NextRequest, { projectId }) => {
  const registerId = extractRegisterId(request)
  const body = await parseBody(request)

  const register = await (prisma as any).complianceRegister.findFirst({
    where: { id: registerId, projectId },
  })
  if (!register) {
    throw new NotFoundError('Compliance register not found')
  }

  const itemId = requireString(body.itemId, 'Item ID', 100)
  const existing = await (prisma as any).complianceItem.findFirst({
    where: { id: itemId, registerId },
  })
  if (!existing) {
    throw new NotFoundError('Compliance item not found')
  }

  const data: Record<string, unknown> = {}
  if ('status' in body) data.status = body.status
  if ('section' in body) data.section = optionalString(body.section, 'Section', 200)
  if ('source' in body) data.source = optionalString(body.source, 'Source', 500)
  if ('version' in body) data.version = optionalString(body.version, 'Version', 100)
  if ('ownerId' in body) data.ownerId = optionalId(body.ownerId, 'Owner ID')
  if ('dueDate' in body) data.dueDate = optionalDate(body.dueDate, 'Due date')
  if ('evidence' in body) data.evidence = optionalString(body.evidence, 'Evidence', 5000)
  if ('comments' in body) data.comments = optionalString(body.comments, 'Comments', 5000)

  const item = await (prisma as any).complianceItem.update({
    where: { id: itemId },
    data,
  })

  // Recompute register status after any item change
  await recomputeRegisterStatus(prisma as any, registerId)

  // Resolve owner name for the response
  let patchOwnerName: string | null = null
  if (item.ownerId) {
    const { prisma: mainPrisma } = await import('@/lib/prisma')
    const ownerProfile = await mainPrisma.profile.findUnique({
      where: { id: item.ownerId },
      select: { fullName: true },
    })
    patchOwnerName = ownerProfile?.fullName || null
  }

  return success({ item: { ...item, owner: patchOwnerName } })
})

/**
 * DELETE /api/projects/[id]/compliance/[registerId]/items — Delete a compliance item.
 * Expects { itemId } in the body.
 */
export const DELETE = withProjectAccess(async (request: NextRequest, { projectId }) => {
  const registerId = extractRegisterId(request)
  const body = await parseBody(request)

  const register = await (prisma as any).complianceRegister.findFirst({
    where: { id: registerId, projectId },
  })
  if (!register) {
    throw new NotFoundError('Compliance register not found')
  }

  const itemId = requireString(body.itemId, 'Item ID', 100)
  const existing = await (prisma as any).complianceItem.findFirst({
    where: { id: itemId, registerId },
  })
  if (!existing) {
    throw new NotFoundError('Compliance item not found')
  }

  await (prisma as any).complianceItem.delete({ where: { id: itemId } })

  // Recompute register status after deletion
  await recomputeRegisterStatus(prisma as any, registerId)

  return success({ deleted: true })
})

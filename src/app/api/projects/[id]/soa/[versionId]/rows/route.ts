import { NextRequest } from 'next/server'
import { modulesPrisma } from '@/lib/prisma-modules'
import { success } from '@/lib/api-response'
import { withProjectAccess } from '@/lib/with-project-access'
import { recordAuditEvent, AuditActions } from '@/lib/audit'
import { NotFoundError, ValidationError } from '@/lib/errors'
import {
  requireString, optionalString, optionalNumber, optionalEnum, parseBody,
} from '@/lib/validation'

const SPACE_CATEGORIES = [
  'GUEST_ACCOMMODATION', 'FOH', 'BOH', 'CIRCULATION', 'EXTERNAL',
] as const

const ROW_STATUSES = ['DRAFT', 'REVIEWED', 'APPROVED', 'QUERY'] as const

const REQUIREMENTS = [
  'CLIENT_BRIEF', 'OPERATOR', 'STANDARD', 'ACCESSIBILITY', 'CWA', 'CUSTOM',
] as const

/**
 * Extract versionId from URL path.
 */
function extractVersionId(request: NextRequest): string {
  const url = new URL(request.url)
  const segments = url.pathname.split('/')
  const soaIdx = segments.indexOf('soa')
  const versionId = soaIdx >= 0 ? segments[soaIdx + 1] : undefined
  if (!versionId) throw new NotFoundError('SOA version not found')
  return versionId
}

/**
 * Extract rowId from URL (for PATCH/DELETE when row ID is in query params).
 */
function extractRowId(request: NextRequest): string | null {
  const url = new URL(request.url)
  return url.searchParams.get('rowId')
}

/**
 * Verify that a version belongs to this project.
 */
async function verifyVersion(versionId: string, projectId: string) {
  const version = await modulesPrisma.sOAVersion.findFirst({
    where: { id: versionId, projectId },
  })
  if (!version) throw new NotFoundError('SOA version not found')
  return version
}

/**
 * GET /api/projects/[id]/soa/[versionId]/rows — List all rows for an SOA version.
 * Includes calculated summary totals.
 */
export const GET = withProjectAccess(async (request: NextRequest, { projectId }) => {
  const versionId = extractVersionId(request)
  await verifyVersion(versionId, projectId)

  const rows = await modulesPrisma.sOARow.findMany({
    where: { versionId },
    orderBy: { sortOrder: 'asc' },
  })

  // Calculate summary totals
  let totalQuantity = 0
  let totalTargetArea = 0
  let totalCurrentArea = 0

  for (const row of rows) {
    const qty = row.quantity ?? 0
    totalQuantity += qty
    totalTargetArea += qty * (row.targetArea ?? 0)
    totalCurrentArea += qty * (row.currentArea ?? 0)
  }

  return success({
    rows,
    summary: {
      totalRows: rows.length,
      totalQuantity,
      totalTargetArea: Math.round(totalTargetArea * 100) / 100,
      totalCurrentArea: Math.round(totalCurrentArea * 100) / 100,
    },
  })
})

/**
 * POST /api/projects/[id]/soa/[versionId]/rows — Add a row to an SOA version.
 * Auto-calculates sort order. Fields: spaceCategory, roomType, code, quantity,
 * targetArea, currentArea, requirement, requirementSource, comment.
 */
export const POST = withProjectAccess(async (request: NextRequest, { projectId, profile }) => {
  const versionId = extractVersionId(request)
  await verifyVersion(versionId, projectId)

  const body = await parseBody(request)

  const spaceCategory = requireString(body.spaceCategory, 'Space category', 100)
  if (!SPACE_CATEGORIES.includes(spaceCategory as typeof SPACE_CATEGORIES[number])) {
    throw new ValidationError(`Space category must be one of: ${SPACE_CATEGORIES.join(', ')}`)
  }
  const roomType = requireString(body.roomType, 'Room type', 200)
  const code = optionalString(body.code, 'Code', 50)
  const quantity = optionalNumber(body.quantity, 'Quantity', { min: 0 }) ?? 1
  const targetArea = optionalNumber(body.targetArea, 'Target area', { min: 0 })
  const currentArea = optionalNumber(body.currentArea, 'Current area', { min: 0 })
  const requirement = optionalEnum(body.requirement, 'Requirement', REQUIREMENTS)
  const requirementSource = optionalString(body.requirementSource, 'Requirement source', 500)
  const comment = optionalString(body.comment, 'Comment', 2000)

  // Get next sort order
  const lastRow = await modulesPrisma.sOARow.findFirst({
    where: { versionId },
    orderBy: { sortOrder: 'desc' },
    select: { sortOrder: true },
  })
  const nextSort = (lastRow?.sortOrder ?? -1) + 1

  const row = await modulesPrisma.sOARow.create({
    data: {
      versionId,
      spaceCategory,
      roomType,
      code,
      quantity,
      targetArea,
      currentArea,
      requirement: requirement ?? null,
      requirementSource,
      comment,
      sortOrder: nextSort,
      status: 'DRAFT',
    },
  })

  await recordAuditEvent({
    organisationId: profile.organisationId,
    actorId: profile.id,
    action: AuditActions.PROJECT_UPDATED,
    entityType: 'SOARow',
    entityId: row.id,
    metadata: { roomType, spaceCategory, versionId },
  })

  return success({ row }, 201)
}, { minProjectRole: 'PROJECT_LEAD' })

/**
 * PATCH /api/projects/[id]/soa/[versionId]/rows?rowId=... — Update a row.
 * Recalculates totals on the response.
 */
export const PATCH = withProjectAccess(async (request: NextRequest, { projectId, profile }) => {
  const versionId = extractVersionId(request)
  await verifyVersion(versionId, projectId)

  const rowId = extractRowId(request)
  if (!rowId) throw new ValidationError('rowId query parameter is required')

  const existing = await modulesPrisma.sOARow.findFirst({
    where: { id: rowId, versionId },
  })
  if (!existing) throw new NotFoundError('SOA row not found')

  const body = await parseBody(request)
  const data: Record<string, unknown> = {}

  if ('spaceCategory' in body) {
    const sc = requireString(body.spaceCategory, 'Space category', 100)
    if (!SPACE_CATEGORIES.includes(sc as typeof SPACE_CATEGORIES[number])) {
      throw new ValidationError(`Space category must be one of: ${SPACE_CATEGORIES.join(', ')}`)
    }
    data.spaceCategory = sc
  }
  if ('roomType' in body) data.roomType = requireString(body.roomType, 'Room type', 200)
  if ('code' in body) data.code = optionalString(body.code, 'Code', 50)
  if ('quantity' in body) data.quantity = optionalNumber(body.quantity, 'Quantity', { min: 0 }) ?? 1
  if ('targetArea' in body) data.targetArea = optionalNumber(body.targetArea, 'Target area', { min: 0 })
  if ('currentArea' in body) data.currentArea = optionalNumber(body.currentArea, 'Current area', { min: 0 })
  if ('requirement' in body) data.requirement = optionalEnum(body.requirement, 'Requirement', REQUIREMENTS) ?? null
  if ('requirementSource' in body) data.requirementSource = optionalString(body.requirementSource, 'Requirement source', 500)
  if ('comment' in body) data.comment = optionalString(body.comment, 'Comment', 2000)
  if ('status' in body) data.status = optionalEnum(body.status, 'Status', ROW_STATUSES) ?? existing.status
  if ('sortOrder' in body) data.sortOrder = optionalNumber(body.sortOrder, 'Sort order', { min: 0 }) ?? existing.sortOrder

  const row = await modulesPrisma.sOARow.update({
    where: { id: rowId },
    data,
  })

  await recordAuditEvent({
    organisationId: profile.organisationId,
    actorId: profile.id,
    action: AuditActions.PROJECT_UPDATED,
    entityType: 'SOARow',
    entityId: rowId,
    metadata: { updatedFields: Object.keys(data) },
  })

  return success({ row })
}, { minProjectRole: 'PROJECT_LEAD' })

/**
 * DELETE /api/projects/[id]/soa/[versionId]/rows?rowId=... — Remove a row.
 */
export const DELETE = withProjectAccess(async (request: NextRequest, { projectId, profile }) => {
  const versionId = extractVersionId(request)
  await verifyVersion(versionId, projectId)

  const rowId = extractRowId(request)
  if (!rowId) throw new ValidationError('rowId query parameter is required')

  const existing = await modulesPrisma.sOARow.findFirst({
    where: { id: rowId, versionId },
  })
  if (!existing) throw new NotFoundError('SOA row not found')

  await modulesPrisma.sOARow.delete({ where: { id: rowId } })

  await recordAuditEvent({
    organisationId: profile.organisationId,
    actorId: profile.id,
    action: AuditActions.PROJECT_UPDATED,
    entityType: 'SOARow',
    entityId: rowId,
    metadata: { deleted: true, roomType: existing.roomType },
  })

  return success({ deleted: true })
}, { minProjectRole: 'PROJECT_LEAD' })

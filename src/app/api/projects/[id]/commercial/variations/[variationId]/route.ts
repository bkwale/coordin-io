import type { NextRequest } from 'next/server'
import { commercialPrisma as prisma } from '@/lib/prisma-commercial'
import { success } from '@/lib/api-response'
import { withProjectAccess } from '@/lib/with-project-access'
import { recordAuditEvent, AuditActions } from '@/lib/audit'
import { parseBody, optionalString, optionalEnum, optionalNumber, optionalId } from '@/lib/validation'
import { NotFoundError, PermissionError } from '@/lib/errors'
import { hasOrgPermission } from '@/lib/permissions'

const VARIATION_REASONS = [
  'DESIGN_CHANGE', 'CLIENT_INSTRUCTION', 'SITE_CONDITION',
  'REGULATORY', 'VALUE_ENGINEERING', 'OMISSION', 'OTHER',
] as const

const VARIATION_STATUSES = [
  'DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED',
  'REJECTED', 'IMPLEMENTED', 'CLOSED',
] as const

/**
 * Extract variationId from the URL path.
 */
function extractVariationId(request: NextRequest): string {
  const url = new URL(request.url)
  const segments = url.pathname.split('/')
  const idx = segments.indexOf('variations')
  const variationId = idx >= 0 ? segments[idx + 1] : undefined
  if (!variationId) throw new NotFoundError('Variation ID is required')
  return variationId
}

/**
 * GET /api/projects/[id]/commercial/variations/[variationId] — Single variation detail.
 */
export const GET = withProjectAccess(async (request: NextRequest, { projectId }) => {
  const variationId = extractVariationId(request)

  const variation = await prisma.variation.findFirst({
    where: { id: variationId, projectId },
  })

  if (!variation) {
    throw new NotFoundError('Variation not found')
  }

  return success({ variation })
})

/**
 * PATCH /api/projects/[id]/commercial/variations/[variationId] — Update or approve a variation.
 *
 * Approval requires MANAGER+ org permission.
 */
export const PATCH = withProjectAccess(async (request: NextRequest, { projectId, profile }) => {
  const variationId = extractVariationId(request)
  const body = await parseBody(request)

  const existing = await prisma.variation.findFirst({
    where: { id: variationId, projectId },
  })

  if (!existing) {
    throw new NotFoundError('Variation not found')
  }

  const data: Record<string, unknown> = {}

  if ('title' in body) data.title = optionalString(body.title, 'Title', 200) ?? undefined
  if ('description' in body) data.description = optionalString(body.description, 'Description', 5000) ?? undefined
  if ('reason' in body) data.reason = optionalEnum(body.reason, 'Reason', VARIATION_REASONS)
  if ('initiatedBy' in body) data.initiatedBy = optionalString(body.initiatedBy, 'Initiated by', 200)
  if ('amount' in body) data.amount = optionalNumber(body.amount, 'Amount')
  if ('timeImpactDays' in body) {
    const days = optionalNumber(body.timeImpactDays, 'Time impact (days)', { min: 0 })
    data.timeImpactDays = days ? Math.round(days) : null
  }
  if ('linkedDocumentId' in body) data.linkedDocumentId = optionalId(body.linkedDocumentId, 'Linked document ID')
  if ('linkedTaskId' in body) data.linkedTaskId = optionalId(body.linkedTaskId, 'Linked task ID')
  if ('notes' in body) data.notes = optionalString(body.notes, 'Notes', 5000)

  if ('status' in body) {
    const newStatus = optionalEnum(body.status, 'Status', VARIATION_STATUSES)

    if (newStatus === 'APPROVED') {
      if (!hasOrgPermission(profile.orgPermission, 'MANAGER')) {
        throw new PermissionError('Variation approval requires Manager permission or above')
      }
      data.status = 'APPROVED'
      data.approvedBy = profile.id
      data.approvedAt = new Date()
    } else if (newStatus) {
      data.status = newStatus
    }
  }

  const variation = await prisma.variation.update({
    where: { id: variationId },
    data,
  })

  const action = data.status === 'APPROVED'
    ? AuditActions.VARIATION_APPROVED
    : AuditActions.VARIATION_UPDATED

  await recordAuditEvent({
    organisationId: profile.organisationId,
    actorId: profile.id,
    action,
    entityType: 'Variation',
    entityId: variationId,
    metadata: { updatedFields: Object.keys(data) },
  })

  return success({ variation })
})

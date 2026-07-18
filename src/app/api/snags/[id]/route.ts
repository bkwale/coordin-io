import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { recordAuditEvent, AuditActions } from '@/lib/audit'
import { success } from '@/lib/api-response'
import { withAuth } from '@/lib/with-auth'
import { NotFoundError, PermissionError, ValidationError } from '@/lib/errors'
import { optionalString, optionalEnum, optionalDate, parseBody } from '@/lib/validation'
import { validateSnagTransition } from '@/lib/snag-transitions'
import { canViewProject } from '@/lib/permissions'
import type { OrgPermission, SnagStatus, SnagCategory, SnagSeverity } from '@/generated/prisma/client'

const SNAG_CATEGORIES: readonly SnagCategory[] = [
  'ARCHITECTURAL', 'MEP', 'STRUCTURAL', 'FIRE',
  'HEALTH_SAFETY', 'FINISH', 'FF_AND_E', 'EXTERNAL_WORKS',
] as const

const SNAG_SEVERITIES: readonly SnagSeverity[] = [
  'MINOR', 'MODERATE', 'MAJOR', 'SAFETY_CRITICAL',
] as const

const SNAG_STATUSES: readonly SnagStatus[] = [
  'OPEN', 'ASSIGNED', 'RECTIFICATION_SUBMITTED', 'VERIFICATION', 'CLOSED', 'REOPENED',
] as const

/**
 * Load snag + verify org boundary + project membership.
 */
async function loadSnagWithAccess(request: NextRequest, profileId: string, orgId: string, orgPermission: string) {
  const id = request.url.match(/\/snags\/([^/?]+)/)?.[1]
  if (!id) throw new NotFoundError('Snag not found')

  const snag = await prisma.snag.findUnique({
    where: { id },
    include: {
      createdBy: { select: { id: true, fullName: true } },
      verifiedBy: { select: { id: true, fullName: true } },
      project: { select: { id: true, organisationId: true, name: true } },
    },
  })

  if (!snag || snag.project.organisationId !== orgId) {
    throw new NotFoundError('Snag not found')
  }

  // Check project membership (admins bypass)
  const canAccess = await canViewProject(profileId, snag.projectId, orgPermission as OrgPermission)
  if (!canAccess) {
    throw new PermissionError('You do not have access to this snag')
  }

  return { snag, snagId: id }
}

/**
 * GET /api/snags/[id] — Single snag detail.
 */
export const GET = withAuth(async (request, { profile }) => {
  const { snag } = await loadSnagWithAccess(
    request, profile.id, profile.organisationId, profile.orgPermission,
  )

  return success({ snag })
})

/**
 * PATCH /api/snags/[id] — Update snag fields and/or status transition.
 *
 * Status transitions:
 * - ASSIGNED requires setting responsibleOrg
 * - RECTIFICATION_SUBMITTED can include rectificationPhotoUrls
 * - VERIFICATION → CLOSED: sets verifiedById, verifiedAt, closedAt
 * - VERIFICATION → REOPENED: clears verifiedBy, verifiedAt, closedAt
 * - Field updates (description, severity, targetDate etc.) only allowed when OPEN or ASSIGNED
 */
export const PATCH = withAuth(async (request, { profile }) => {
  const { snag: currentSnag, snagId } = await loadSnagWithAccess(
    request, profile.id, profile.organisationId, profile.orgPermission,
  )

  const body = await parseBody(request)

  const data: Record<string, unknown> = {}

  // Status transition
  const newStatus = optionalEnum(body.status, 'Status', SNAG_STATUSES)

  if (newStatus && newStatus !== currentSnag.status) {
    validateSnagTransition(currentSnag.status as SnagStatus, newStatus as SnagStatus)

    data.status = newStatus

    // ASSIGNED requires responsibleOrg
    if (newStatus === 'ASSIGNED') {
      const responsibleOrg = body.responsibleOrg
        ? optionalString(body.responsibleOrg as string, 'Responsible organisation', 200)
        : currentSnag.responsibleOrg
      if (!responsibleOrg) {
        throw new ValidationError('Responsible organisation is required when assigning a snag')
      }
      data.responsibleOrg = responsibleOrg
    }

    // RECTIFICATION_SUBMITTED: allow rectification photos
    if (newStatus === 'RECTIFICATION_SUBMITTED' && Array.isArray(body.rectificationPhotoUrls)) {
      const rectificationPhotoUrls: string[] = []
      for (const url of body.rectificationPhotoUrls) {
        if (typeof url === 'string' && url.trim().length > 0) {
          rectificationPhotoUrls.push(url.trim())
        }
      }
      data.rectificationPhotoUrls = rectificationPhotoUrls
    }

    // CLOSED: set verification + close
    if (newStatus === 'CLOSED') {
      data.verifiedById = profile.id
      data.verifiedAt = new Date()
      data.closedAt = new Date()
    }

    // VERIFICATION: set verifier (the person performing verification)
    if (newStatus === 'VERIFICATION') {
      data.verifiedById = profile.id
      data.verifiedAt = new Date()
    }

    // REOPENED: clear verification data
    if (newStatus === 'REOPENED') {
      data.verifiedById = null
      data.verifiedAt = null
      data.closedAt = null
    }
  }

  // Field updates only allowed when OPEN or ASSIGNED
  const currentStatus = (newStatus || currentSnag.status) as SnagStatus
  const canUpdateFields = currentSnag.status === 'OPEN' || currentSnag.status === 'ASSIGNED'

  if ('description' in body) {
    if (!canUpdateFields) throw new ValidationError('Description can only be updated when snag is OPEN or ASSIGNED')
    data.description = optionalString(body.description, 'Description', 5000)
  }
  if ('category' in body) {
    if (!canUpdateFields) throw new ValidationError('Category can only be updated when snag is OPEN or ASSIGNED')
    data.category = optionalEnum(body.category, 'Category', SNAG_CATEGORIES)
  }
  if ('severity' in body) {
    if (!canUpdateFields) throw new ValidationError('Severity can only be updated when snag is OPEN or ASSIGNED')
    data.severity = optionalEnum(body.severity, 'Severity', SNAG_SEVERITIES)
  }
  if ('block' in body) {
    if (!canUpdateFields) throw new ValidationError('Block can only be updated when snag is OPEN or ASSIGNED')
    data.block = optionalString(body.block, 'Block', 100)
  }
  if ('floor' in body) {
    if (!canUpdateFields) throw new ValidationError('Floor can only be updated when snag is OPEN or ASSIGNED')
    data.floor = optionalString(body.floor, 'Floor', 100)
  }
  if ('room' in body) {
    if (!canUpdateFields) throw new ValidationError('Room can only be updated when snag is OPEN or ASSIGNED')
    data.room = optionalString(body.room, 'Room', 100)
  }
  if ('element' in body) {
    if (!canUpdateFields) throw new ValidationError('Element can only be updated when snag is OPEN or ASSIGNED')
    data.element = optionalString(body.element, 'Element', 200)
  }
  if ('drawingRef' in body) {
    if (!canUpdateFields) throw new ValidationError('Drawing reference can only be updated when snag is OPEN or ASSIGNED')
    data.drawingRef = optionalString(body.drawingRef, 'Drawing reference', 200)
  }
  if ('specRef' in body) {
    if (!canUpdateFields) throw new ValidationError('Spec reference can only be updated when snag is OPEN or ASSIGNED')
    data.specRef = optionalString(body.specRef, 'Spec reference', 200)
  }
  if ('targetDate' in body) {
    if (!canUpdateFields) throw new ValidationError('Target date can only be updated when snag is OPEN or ASSIGNED')
    data.targetDate = optionalDate(body.targetDate, 'Target date')
  }
  // responsibleOrg updates outside of ASSIGNED transition
  if ('responsibleOrg' in body && !('status' in body)) {
    if (!canUpdateFields) throw new ValidationError('Responsible organisation can only be updated when snag is OPEN or ASSIGNED')
    data.responsibleOrg = optionalString(body.responsibleOrg, 'Responsible organisation', 200)
  }

  const snag = await prisma.snag.update({
    where: { id: snagId },
    data,
    include: {
      createdBy: { select: { id: true, fullName: true } },
      verifiedBy: { select: { id: true, fullName: true } },
      project: { select: { id: true, organisationId: true, name: true } },
    },
  })

  // Audit: status change
  if (newStatus && newStatus !== currentSnag.status) {
    const auditActionMap: Record<string, string> = {
      ASSIGNED: AuditActions.SNAG_ASSIGNED,
      RECTIFICATION_SUBMITTED: AuditActions.SNAG_RECTIFICATION,
      VERIFICATION: AuditActions.SNAG_VERIFIED,
      CLOSED: AuditActions.SNAG_CLOSED,
      REOPENED: AuditActions.SNAG_REOPENED,
    }

    await recordAuditEvent({
      organisationId: profile.organisationId,
      actorId: profile.id,
      action: auditActionMap[newStatus] || `site.snag_${newStatus.toLowerCase()}`,
      entityType: 'snag',
      entityId: snag.id,
      metadata: { from: currentSnag.status, to: newStatus },
      ipAddress: request.headers.get('x-forwarded-for') || undefined,
    })
  }

  return success({ snag })
})

import { NextRequest } from 'next/server'
import { modulesPrisma } from '@/lib/prisma-modules'
import { recordAuditEvent, AuditActions } from '@/lib/audit'
import { success } from '@/lib/api-response'
import { withProjectAccess } from '@/lib/with-project-access'
import { NotFoundError, ValidationError } from '@/lib/errors'
import {
  optionalString, optionalEnum, optionalDate, optionalId, parseBody,
} from '@/lib/validation'
import { validateSnagTransition } from '@/lib/snag-transitions'
import { createNotification, NOTIFICATION_EVENTS } from '@/lib/notifications'

const SNAG_CATEGORIES = [
  'ARCHITECTURAL', 'MEP', 'STRUCTURAL', 'FIRE',
  'HEALTH_SAFETY', 'FINISH', 'FF_AND_E', 'EXTERNAL_WORKS',
] as const

const SNAG_SEVERITIES = ['MINOR', 'MODERATE', 'MAJOR', 'SAFETY_CRITICAL'] as const

const SNAG_STATUSES = [
  'OPEN', 'ASSIGNED', 'RECTIFICATION_SUBMITTED', 'VERIFICATION', 'CLOSED', 'REOPENED',
] as const

/**
 * Extract snagId from URL path.
 */
function extractSnagId(request: NextRequest): string {
  const url = new URL(request.url)
  const segments = url.pathname.split('/')
  const snagIdx = segments.indexOf('snags')
  const snagId = snagIdx >= 0 ? segments[snagIdx + 1] : undefined
  if (!snagId) throw new NotFoundError('Snag not found')
  return snagId
}

/**
 * GET /api/projects/[id]/snags/[snagId] — Single snag detail.
 */
export const GET = withProjectAccess(async (request: NextRequest, { projectId }) => {
  const snagId = extractSnagId(request)

  const snag = await modulesPrisma.snag.findFirst({
    where: { id: snagId, projectId },
    include: {
      createdBy: { select: { id: true, fullName: true } },
      verifiedBy: { select: { id: true, fullName: true } },
      assignedTo: { select: { id: true, fullName: true } },
    },
  })

  if (!snag) {
    throw new NotFoundError('Snag not found')
  }

  return success({ snag })
})

/**
 * PATCH /api/projects/[id]/snags/[snagId] — Update snag fields and/or status transition.
 *
 * Status workflow:
 *   OPEN -> ASSIGNED (requires responsibleOrg or assignedToId)
 *   ASSIGNED -> RECTIFICATION_SUBMITTED (can include rectificationPhotoUrls)
 *   RECTIFICATION_SUBMITTED -> VERIFICATION
 *   VERIFICATION -> CLOSED (sets verifiedById, verifiedAt, closedAt)
 *   VERIFICATION -> REOPENED (clears verification, requires reopenReason)
 *   REOPENED -> ASSIGNED
 *   CLOSED -> (terminal)
 *
 * Field updates only allowed when OPEN or ASSIGNED.
 */
export const PATCH = withProjectAccess(async (request: NextRequest, { profile, projectId }) => {
  const snagId = extractSnagId(request)

  const currentSnag = await modulesPrisma.snag.findFirst({
    where: { id: snagId, projectId },
  })

  if (!currentSnag) {
    throw new NotFoundError('Snag not found')
  }

  const body = await parseBody(request)
  const data: Record<string, unknown> = {}

  // Status transition
  const newStatus = optionalEnum(body.status, 'Status', SNAG_STATUSES)

  if (newStatus && newStatus !== currentSnag.status) {
    validateSnagTransition(currentSnag.status, newStatus)

    data.status = newStatus

    // ASSIGNED requires responsibleOrg or assignedToId
    if (newStatus === 'ASSIGNED') {
      const responsibleOrg = body.responsibleOrg
        ? optionalString(body.responsibleOrg as string, 'Responsible organisation', 200)
        : currentSnag.responsibleOrg
      if (!responsibleOrg && !body.assignedToId && !currentSnag.assignedToId) {
        throw new ValidationError('Responsible organisation or assignee is required when assigning a snag')
      }
      if (responsibleOrg) data.responsibleOrg = responsibleOrg
      if (body.assignedToId) {
        data.assignedToId = optionalId(body.assignedToId, 'Assigned to')
      }
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

    // VERIFICATION: set verifier
    if (newStatus === 'VERIFICATION') {
      data.verifiedById = profile.id
      data.verifiedAt = new Date()
    }

    // REOPENED: clear verification data, require reason
    if (newStatus === 'REOPENED') {
      data.verifiedById = null
      data.verifiedAt = null
      data.closedAt = null
      if (body.reopenReason) {
        data.reopenReason = optionalString(body.reopenReason, 'Reopen reason', 2000)
      }
    }
  }

  // Field updates only allowed when OPEN or ASSIGNED
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
  // assignedToId updates outside of status transition
  if ('assignedToId' in body && !('status' in body)) {
    data.assignedToId = optionalId(body.assignedToId, 'Assigned to') || null
  }

  const snag = await modulesPrisma.snag.update({
    where: { id: snagId },
    data,
    include: {
      createdBy: { select: { id: true, fullName: true } },
      verifiedBy: { select: { id: true, fullName: true } },
      assignedTo: { select: { id: true, fullName: true } },
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
      metadata: {
        snagNumber: snag.snagNumber,
        from: currentSnag.status,
        to: newStatus,
        ...(newStatus === 'REOPENED' && body.reopenReason ? { reopenReason: body.reopenReason } : {}),
      },
      ipAddress: request.headers.get('x-forwarded-for') || undefined,
    })
  }

  // Notify on reassignment
  if (data.assignedToId && data.assignedToId !== profile.id && data.assignedToId !== currentSnag.assignedToId) {
    await createNotification({
      profileId: data.assignedToId as string,
      type: NOTIFICATION_EVENTS.TASK_ASSIGNED,
      title: `You were assigned snag ${snag.snagNumber}`,
      linkUrl: `/projects/${projectId}/snags/${snagId}`,
    }).catch(() => {})
  }
  // Notify assignee on status change
  if (newStatus && newStatus !== currentSnag.status && snag.assignedToId && snag.assignedToId !== profile.id) {
    await createNotification({
      profileId: snag.assignedToId,
      type: NOTIFICATION_EVENTS.TASK_STATUS_CHANGED,
      title: `Snag ${snag.snagNumber} moved to ${newStatus}`,
      linkUrl: `/projects/${projectId}/snags/${snagId}`,
    }).catch(() => {})
  }

  return success({ snag })
})

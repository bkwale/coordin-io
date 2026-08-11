import { NextRequest } from 'next/server'
import { modulesPrisma } from '@/lib/prisma-modules'
import { recordAuditEvent, AuditActions } from '@/lib/audit'
import { success } from '@/lib/api-response'
import { withProjectAccess } from '@/lib/with-project-access'
import { NotFoundError, ValidationError } from '@/lib/errors'
import {
  optionalString, optionalEnum, optionalDate, optionalNumber, optionalId,
  parseBody,
} from '@/lib/validation'
import { validateObservationTransition } from '@/lib/observation-transitions'
import { createNotification, NOTIFICATION_EVENTS } from '@/lib/notifications'

const OBSERVATION_SEVERITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const
const OBSERVATION_STATUSES = ['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED', 'REOPENED'] as const

/**
 * Extract observationId from URL path.
 */
function extractObservationId(request: NextRequest): string {
  const url = new URL(request.url)
  const segments = url.pathname.split('/')
  const obsIdx = segments.indexOf('observations')
  const observationId = obsIdx >= 0 ? segments[obsIdx + 1] : undefined
  if (!observationId) throw new NotFoundError('Observation not found')
  return observationId
}

/**
 * GET /api/projects/[id]/observations/[observationId] — Single observation detail.
 */
export const GET = withProjectAccess(async (request: NextRequest, { projectId }) => {
  const observationId = extractObservationId(request)

  const observation = await modulesPrisma.siteObservation.findFirst({
    where: { id: observationId, projectId },
    include: {
      createdBy: { select: { id: true, fullName: true } },
      assignedTo: { select: { id: true, fullName: true } },
    },
  })

  if (!observation) {
    throw new NotFoundError('Observation not found')
  }

  return success({ observation })
})

/**
 * PATCH /api/projects/[id]/observations/[observationId] — Update observation.
 *
 * Supports:
 * - Field updates (description, location, category, severity, etc.)
 * - Status transitions (OPEN -> ASSIGNED -> IN_PROGRESS -> RESOLVED -> CLOSED/REOPENED)
 * - Assignment (sets assignedToId)
 * - Response (sets response text)
 */
export const PATCH = withProjectAccess(async (request: NextRequest, { profile, projectId }) => {
  const observationId = extractObservationId(request)

  const current = await modulesPrisma.siteObservation.findFirst({
    where: { id: observationId, projectId },
  })

  if (!current) {
    throw new NotFoundError('Observation not found')
  }

  const body = await parseBody(request)
  const data: Record<string, unknown> = {}

  // Status transition
  const newStatus = optionalEnum(body.status, 'Status', OBSERVATION_STATUSES)

  if (newStatus && newStatus !== current.status) {
    validateObservationTransition(current.status, newStatus)
    data.status = newStatus

    // ASSIGNED requires assignedToId
    if (newStatus === 'ASSIGNED') {
      const assigneeId = body.assignedToId
        ? optionalId(body.assignedToId, 'Assigned to')
        : current.assignedToId
      if (!assigneeId) {
        throw new ValidationError('An assignee is required when setting status to ASSIGNED')
      }
      data.assignedToId = assigneeId
    }

    // RESOLVED: record response if provided
    if (newStatus === 'RESOLVED' && body.response) {
      data.response = optionalString(body.response, 'Response', 5000)
    }

    // CLOSED: set closedAt
    if (newStatus === 'CLOSED') {
      data.closedAt = new Date()
    }

    // REOPENED: clear closedAt
    if (newStatus === 'REOPENED') {
      data.closedAt = null
    }
  }

  // Field updates (allowed when OPEN, ASSIGNED, or IN_PROGRESS)
  const canUpdateFields = ['OPEN', 'ASSIGNED', 'IN_PROGRESS'].includes(current.status)

  if ('description' in body) {
    if (!canUpdateFields) throw new ValidationError('Description can only be updated when observation is OPEN, ASSIGNED, or IN_PROGRESS')
    data.description = optionalString(body.description, 'Description', 5000)
  }
  if ('category' in body) {
    if (!canUpdateFields) throw new ValidationError('Category can only be updated when observation is OPEN, ASSIGNED, or IN_PROGRESS')
    data.category = optionalString(body.category, 'Category', 100)
  }
  if ('discipline' in body) {
    if (!canUpdateFields) throw new ValidationError('Discipline can only be updated when observation is OPEN, ASSIGNED, or IN_PROGRESS')
    data.discipline = optionalString(body.discipline, 'Discipline', 100)
  }
  if ('severity' in body) {
    if (!canUpdateFields) throw new ValidationError('Severity can only be updated when observation is OPEN, ASSIGNED, or IN_PROGRESS')
    data.severity = optionalEnum(body.severity, 'Severity', OBSERVATION_SEVERITIES)
  }
  if ('actionRequired' in body) {
    if (!canUpdateFields) throw new ValidationError('Action required can only be updated when observation is OPEN, ASSIGNED, or IN_PROGRESS')
    data.actionRequired = optionalString(body.actionRequired, 'Action required', 5000)
  }
  if ('drawingRef' in body) {
    if (!canUpdateFields) throw new ValidationError('Drawing reference can only be updated when observation is OPEN, ASSIGNED, or IN_PROGRESS')
    data.drawingRef = optionalString(body.drawingRef, 'Drawing reference', 200)
  }
  if ('specRef' in body) {
    if (!canUpdateFields) throw new ValidationError('Spec reference can only be updated when observation is OPEN, ASSIGNED, or IN_PROGRESS')
    data.specRef = optionalString(body.specRef, 'Spec reference', 200)
  }
  if ('block' in body) {
    if (!canUpdateFields) throw new ValidationError('Block can only be updated when observation is OPEN, ASSIGNED, or IN_PROGRESS')
    data.block = optionalString(body.block, 'Block', 100)
  }
  if ('floor' in body) {
    if (!canUpdateFields) throw new ValidationError('Floor can only be updated when observation is OPEN, ASSIGNED, or IN_PROGRESS')
    data.floor = optionalString(body.floor, 'Floor', 100)
  }
  if ('room' in body) {
    if (!canUpdateFields) throw new ValidationError('Room can only be updated when observation is OPEN, ASSIGNED, or IN_PROGRESS')
    data.room = optionalString(body.room, 'Room', 100)
  }
  if ('dueDate' in body) {
    data.dueDate = optionalDate(body.dueDate, 'Due date')
  }
  if ('response' in body && !newStatus) {
    data.response = optionalString(body.response, 'Response', 5000)
  }

  // assignedToId update outside of status transition
  if ('assignedToId' in body && !('status' in body)) {
    data.assignedToId = optionalId(body.assignedToId, 'Assigned to') || null
  }

  // photoUrls
  if (Array.isArray(body.photoUrls)) {
    const photoUrls: string[] = []
    for (const url of body.photoUrls) {
      if (typeof url === 'string' && url.trim().length > 0) {
        photoUrls.push(url.trim())
      }
    }
    data.photoUrls = photoUrls
  }

  // Geo
  if ('latitude' in body) data.latitude = optionalNumber(body.latitude, 'Latitude', { min: -90, max: 90 })
  if ('longitude' in body) data.longitude = optionalNumber(body.longitude, 'Longitude', { min: -180, max: 180 })

  const observation = await modulesPrisma.siteObservation.update({
    where: { id: observationId },
    data,
    include: {
      createdBy: { select: { id: true, fullName: true } },
      assignedTo: { select: { id: true, fullName: true } },
    },
  })

  // Audit status transitions
  if (newStatus && newStatus !== current.status) {
    const auditActionMap: Record<string, string> = {
      ASSIGNED: AuditActions.OBSERVATION_ASSIGNED,
      IN_PROGRESS: AuditActions.OBSERVATION_UPDATED,
      RESOLVED: AuditActions.OBSERVATION_RESOLVED,
      CLOSED: AuditActions.OBSERVATION_CLOSED,
      REOPENED: AuditActions.OBSERVATION_REOPENED,
    }

    await recordAuditEvent({
      organisationId: profile.organisationId,
      actorId: profile.id,
      action: auditActionMap[newStatus] || AuditActions.OBSERVATION_UPDATED,
      entityType: 'siteObservation',
      entityId: observation.id,
      metadata: { from: current.status, to: newStatus },
      ipAddress: request.headers.get('x-forwarded-for') || undefined,
    })
  } else if (Object.keys(data).length > 0) {
    await recordAuditEvent({
      organisationId: profile.organisationId,
      actorId: profile.id,
      action: AuditActions.OBSERVATION_UPDATED,
      entityType: 'siteObservation',
      entityId: observation.id,
      metadata: { updatedFields: Object.keys(data) },
      ipAddress: request.headers.get('x-forwarded-for') || undefined,
    })
  }

  // Notify on reassignment
  if (data.assignedToId && data.assignedToId !== profile.id && data.assignedToId !== current.assignedToId) {
    await createNotification({
      profileId: data.assignedToId as string,
      type: NOTIFICATION_EVENTS.TASK_ASSIGNED,
      title: `You were assigned observation ${current.observationNumber}`,
      linkUrl: `/projects/${projectId}/observations/${observationId}`,
    }).catch(() => {})
  }
  // Notify assignee on status change
  if (newStatus && newStatus !== current.status && observation.assignedToId && observation.assignedToId !== profile.id) {
    await createNotification({
      profileId: observation.assignedToId,
      type: NOTIFICATION_EVENTS.TASK_STATUS_CHANGED,
      title: `Observation ${current.observationNumber} moved to ${newStatus}`,
      linkUrl: `/projects/${projectId}/observations/${observationId}`,
    }).catch(() => {})
  }

  return success({ observation })
})

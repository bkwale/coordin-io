import { NextRequest } from 'next/server'
import { modulesPrisma } from '@/lib/prisma-modules'
import { success } from '@/lib/api-response'
import { withAuth } from '@/lib/with-auth'
import { recordAuditEvent, AuditActions } from '@/lib/audit'
import { NotFoundError, PermissionError, ValidationError } from '@/lib/errors'
import { optionalString, optionalNumber, optionalEnum, optionalDate, optionalId, parseBody } from '@/lib/validation'
import { canViewProject } from '@/lib/permissions'
import { validateObservationTransition } from '@/lib/observation-transitions'
import type { OrgPermission } from '@/generated/prisma/client'

const OBSERVATION_SEVERITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const
const OBSERVATION_STATUSES = ['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED', 'REOPENED'] as const

/**
 * Load observation + verify org boundary + project membership.
 */
async function loadObservationWithAccess(request: NextRequest, profileId: string, orgId: string, orgPermission: string) {
  const id = request.url.match(/\/observations\/([^/?]+)/)?.[1]
  if (!id) throw new NotFoundError('Observation not found')

  const observation = await modulesPrisma.siteObservation.findUnique({
    where: { id },
    include: {
      createdBy: { select: { id: true, fullName: true } },
      assignedTo: { select: { id: true, fullName: true } },
      project: { select: { id: true, organisationId: true, name: true } },
    },
  })

  if (!observation || observation.project.organisationId !== orgId) {
    throw new NotFoundError('Observation not found')
  }

  // Check project membership (admins bypass)
  const canAccess = await canViewProject(profileId, observation.projectId, orgPermission as OrgPermission)
  if (!canAccess) {
    throw new PermissionError('You do not have access to this observation')
  }

  return { observation, observationId: id }
}

/**
 * GET /api/observations/[id] — Single observation detail.
 */
export const GET = withAuth(async (request, { profile }) => {
  const { observation } = await loadObservationWithAccess(
    request, profile.id, profile.organisationId, profile.orgPermission,
  )

  return success({ observation })
})

/**
 * PATCH /api/observations/[id] — Update observation fields and/or status.
 */
export const PATCH = withAuth(async (request, { profile }) => {
  const { observation: current, observationId } = await loadObservationWithAccess(
    request, profile.id, profile.organisationId, profile.orgPermission,
  )

  const body = await parseBody(request)
  const data: Record<string, unknown> = {}

  // Status transition
  const newStatus = optionalEnum(body.status, 'Status', OBSERVATION_STATUSES)

  if (newStatus && newStatus !== current.status) {
    validateObservationTransition(current.status, newStatus)
    data.status = newStatus

    if (newStatus === 'ASSIGNED' && body.assignedToId) {
      data.assignedToId = optionalId(body.assignedToId, 'Assigned to')
    }
    if (newStatus === 'RESOLVED' && body.response) {
      data.response = optionalString(body.response, 'Response', 5000)
    }
    if (newStatus === 'CLOSED') {
      data.closedAt = new Date()
    }
    if (newStatus === 'REOPENED') {
      data.closedAt = null
    }
  }

  // Field updates
  if ('description' in body) data.description = optionalString(body.description, 'Description', 5000)
  if ('category' in body) data.category = optionalString(body.category, 'Category', 100)
  if ('discipline' in body) data.discipline = optionalString(body.discipline, 'Discipline', 100)
  if ('severity' in body) data.severity = optionalEnum(body.severity, 'Severity', OBSERVATION_SEVERITIES)
  if ('actionRequired' in body) data.actionRequired = optionalString(body.actionRequired, 'Action required', 5000)
  if ('block' in body) data.block = optionalString(body.block, 'Block', 100)
  if ('floor' in body) data.floor = optionalString(body.floor, 'Floor', 100)
  if ('room' in body) data.room = optionalString(body.room, 'Room', 100)
  if ('drawingRef' in body) data.drawingRef = optionalString(body.drawingRef, 'Drawing reference', 200)
  if ('specRef' in body) data.specRef = optionalString(body.specRef, 'Spec reference', 200)
  if ('dueDate' in body) data.dueDate = optionalDate(body.dueDate, 'Due date')
  if ('response' in body && !newStatus) data.response = optionalString(body.response, 'Response', 5000)
  if ('latitude' in body) data.latitude = optionalNumber(body.latitude, 'Latitude', { min: -90, max: 90 })
  if ('longitude' in body) data.longitude = optionalNumber(body.longitude, 'Longitude', { min: -180, max: 180 })

  if (Array.isArray(body.photoUrls)) {
    const photoUrls: string[] = []
    for (const url of body.photoUrls) {
      if (typeof url === 'string' && url.trim().length > 0) {
        photoUrls.push(url.trim())
      }
    }
    data.photoUrls = photoUrls
  }

  const observation = await modulesPrisma.siteObservation.update({
    where: { id: observationId },
    data,
    include: {
      createdBy: { select: { id: true, fullName: true } },
      assignedTo: { select: { id: true, fullName: true } },
      project: { select: { id: true, organisationId: true, name: true } },
    },
  })

  const auditAction = newStatus && newStatus !== current.status
    ? AuditActions.OBSERVATION_UPDATED
    : 'site.observation_updated'

  await recordAuditEvent({
    organisationId: profile.organisationId,
    actorId: profile.id,
    action: auditAction,
    entityType: 'siteObservation',
    entityId: observationId,
    metadata: newStatus
      ? { from: current.status, to: newStatus }
      : { updatedFields: Object.keys(data) },
    ipAddress: request.headers.get('x-forwarded-for') || undefined,
  })

  return success({ observation })
})

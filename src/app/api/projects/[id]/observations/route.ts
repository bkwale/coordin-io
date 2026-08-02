import { NextRequest } from 'next/server'
import { modulesPrisma } from '@/lib/prisma-modules'
import { recordAuditEvent, AuditActions } from '@/lib/audit'
import { success } from '@/lib/api-response'
import { withProjectAccess } from '@/lib/with-project-access'
import {
  requireString, optionalString, optionalNumber, optionalEnum, optionalDate,
  optionalId, parseBody,
} from '@/lib/validation'

const OBSERVATION_SEVERITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const
const OBSERVATION_STATUSES = ['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED', 'REOPENED'] as const
const OBSERVATION_CATEGORIES = [
  'Structural', 'Services', 'Finishes', 'External', 'Safety', 'Quality',
] as const

/**
 * GET /api/projects/[id]/observations — List site observations for a project.
 *
 * Optional query params: ?status=, ?severity=, ?category=, ?assignee=, ?block=, ?floor=
 */
export const GET = withProjectAccess(async (request: NextRequest, { projectId }) => {
  const url = new URL(request.url)
  const status = url.searchParams.get('status')
  const severity = url.searchParams.get('severity')
  const category = url.searchParams.get('category')
  const assignee = url.searchParams.get('assignee')
  const block = url.searchParams.get('block')
  const floor = url.searchParams.get('floor')

  const where: Record<string, unknown> = { projectId }
  if (status && OBSERVATION_STATUSES.includes(status as any)) where.status = status
  if (severity && OBSERVATION_SEVERITIES.includes(severity as any)) where.severity = severity
  if (category) where.category = category
  if (assignee) where.assignedToId = assignee
  if (block) where.block = block
  if (floor) where.floor = floor

  const observations = await modulesPrisma.siteObservation.findMany({
    where,
    include: {
      createdBy: { select: { id: true, fullName: true } },
      assignedTo: { select: { id: true, fullName: true } },
    },
    orderBy: [
      { severity: 'desc' },
      { createdAt: 'desc' },
    ],
  })

  return success({ observations })
})

/**
 * POST /api/projects/[id]/observations — Create a site observation.
 * Any project member can create observations.
 * Auto-generates observationNumber as OBS-001, OBS-002, etc.
 */
export const POST = withProjectAccess(async (request: NextRequest, { profile, projectId }) => {
  const body = await parseBody(request)

  const description = requireString(body.description, 'Description', 5000)
  const block = optionalString(body.block, 'Block', 100)
  const floor = optionalString(body.floor, 'Floor', 100)
  const room = optionalString(body.room, 'Room', 100)
  const category = optionalString(body.category, 'Category', 100)
  const discipline = optionalString(body.discipline, 'Discipline', 100)
  const severity = optionalEnum(body.severity, 'Severity', OBSERVATION_SEVERITIES) || 'LOW'
  const actionRequired = optionalString(body.actionRequired, 'Action required', 5000)
  const drawingRef = optionalString(body.drawingRef, 'Drawing reference', 200)
  const specRef = optionalString(body.specRef, 'Spec reference', 200)
  const assignedToId = optionalId(body.assignedToId, 'Assigned to')
  const dueDate = optionalDate(body.dueDate, 'Due date')
  const weather = optionalString(body.weather, 'Weather', 200)
  const labourOnSite = optionalNumber(body.labourOnSite, 'Labour on site', { min: 0, max: 99999 })
  const latitude = optionalNumber(body.latitude, 'Latitude', { min: -90, max: 90 })
  const longitude = optionalNumber(body.longitude, 'Longitude', { min: -180, max: 180 })

  // photoUrls: optional string array
  const photoUrls: string[] = []
  if (Array.isArray(body.photoUrls)) {
    for (const url of body.photoUrls) {
      if (typeof url === 'string' && url.trim().length > 0) {
        photoUrls.push(url.trim())
      }
    }
  }

  // Auto-generate observation number: OBS-001, OBS-002, etc.
  const count = await modulesPrisma.siteObservation.count({ where: { projectId } })
  const observationNumber = `OBS-${String(count + 1).padStart(3, '0')}`

  // Determine initial status
  const status = assignedToId ? 'ASSIGNED' : 'OPEN'

  const observation = await modulesPrisma.siteObservation.create({
    data: {
      projectId,
      createdById: profile.id,
      observationNumber,
      description,
      block: block || null,
      floor: floor || null,
      room: room || null,
      category: category || null,
      discipline: discipline || null,
      severity,
      actionRequired: actionRequired || null,
      drawingRef: drawingRef || null,
      specRef: specRef || null,
      assignedToId: assignedToId || null,
      dueDate,
      status,
      weather: weather || null,
      labourOnSite,
      photoUrls,
      latitude,
      longitude,
    },
    include: {
      createdBy: { select: { id: true, fullName: true } },
      assignedTo: { select: { id: true, fullName: true } },
    },
  })

  await recordAuditEvent({
    organisationId: profile.organisationId,
    actorId: profile.id,
    action: AuditActions.OBSERVATION_CREATED,
    entityType: 'siteObservation',
    entityId: observation.id,
    metadata: {
      observationNumber,
      description: observation.description,
      severity,
      projectId,
    },
    ipAddress: request.headers.get('x-forwarded-for') || undefined,
  })

  return success({ observation }, 201)
})

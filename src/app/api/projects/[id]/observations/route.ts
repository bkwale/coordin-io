import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { recordAuditEvent, AuditActions } from '@/lib/audit'
import { success } from '@/lib/api-response'
import { withProjectAccess } from '@/lib/with-project-access'
import { requireString, optionalString, optionalNumber, parseBody } from '@/lib/validation'

/**
 * GET /api/projects/[id]/observations — List site observations for a project.
 *
 * Optional query params: ?block=, ?floor=
 */
export const GET = withProjectAccess(async (request: NextRequest, { projectId }) => {
  const url = new URL(request.url)
  const block = url.searchParams.get('block')
  const floor = url.searchParams.get('floor')

  const where: Record<string, unknown> = { projectId }
  if (block) where.block = block
  if (floor) where.floor = floor

  const observations = await prisma.siteObservation.findMany({
    where,
    include: {
      createdBy: { select: { id: true, fullName: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  return success({ observations })
})

/**
 * POST /api/projects/[id]/observations — Create a site observation.
 * Any project member can create observations.
 */
export const POST = withProjectAccess(async (request: NextRequest, { profile, projectId }) => {
  const body = await parseBody(request)

  const description = requireString(body.description, 'Description', 5000)
  const block = optionalString(body.block, 'Block', 100)
  const floor = optionalString(body.floor, 'Floor', 100)
  const room = optionalString(body.room, 'Room', 100)
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

  const observation = await prisma.siteObservation.create({
    data: {
      projectId,
      createdById: profile.id,
      description,
      block: block || null,
      floor: floor || null,
      room: room || null,
      photoUrls,
      latitude,
      longitude,
    },
    include: {
      createdBy: { select: { id: true, fullName: true } },
    },
  })

  await recordAuditEvent({
    organisationId: profile.organisationId,
    actorId: profile.id,
    action: AuditActions.OBSERVATION_CREATED,
    entityType: 'siteObservation',
    entityId: observation.id,
    metadata: { description: observation.description, projectId },
    ipAddress: request.headers.get('x-forwarded-for') || undefined,
  })

  return success({ observation }, 201)
})

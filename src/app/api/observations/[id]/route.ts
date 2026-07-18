import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { success } from '@/lib/api-response'
import { withAuth } from '@/lib/with-auth'
import { recordAuditEvent } from '@/lib/audit'
import { NotFoundError, PermissionError } from '@/lib/errors'
import { optionalString, optionalNumber, parseBody } from '@/lib/validation'
import { canViewProject } from '@/lib/permissions'
import type { OrgPermission } from '@/generated/prisma/client'

/**
 * Load observation + verify org boundary + project membership.
 */
async function loadObservationWithAccess(request: NextRequest, profileId: string, orgId: string, orgPermission: string) {
  const id = request.url.match(/\/observations\/([^/?]+)/)?.[1]
  if (!id) throw new NotFoundError('Observation not found')

  const observation = await prisma.siteObservation.findUnique({
    where: { id },
    include: {
      createdBy: { select: { id: true, fullName: true } },
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
 * PATCH /api/observations/[id] — Update observation description/location.
 */
export const PATCH = withAuth(async (request, { profile }) => {
  const { observationId } = await loadObservationWithAccess(
    request, profile.id, profile.organisationId, profile.orgPermission,
  )

  const body = await parseBody(request)

  const data: Record<string, unknown> = {}

  if ('description' in body) data.description = optionalString(body.description, 'Description', 5000)
  if ('block' in body) data.block = optionalString(body.block, 'Block', 100)
  if ('floor' in body) data.floor = optionalString(body.floor, 'Floor', 100)
  if ('room' in body) data.room = optionalString(body.room, 'Room', 100)
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

  const observation = await prisma.siteObservation.update({
    where: { id: observationId },
    data,
    include: {
      createdBy: { select: { id: true, fullName: true } },
      project: { select: { id: true, organisationId: true, name: true } },
    },
  })

  await recordAuditEvent({
    organisationId: profile.organisationId,
    actorId: profile.id,
    action: 'site.observation_updated',
    entityType: 'siteObservation',
    entityId: observationId,
    metadata: { updatedFields: Object.keys(data) },
    ipAddress: request.headers.get('x-forwarded-for') || undefined,
  })

  return success({ observation })
})

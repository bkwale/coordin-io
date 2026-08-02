import type { NextRequest } from 'next/server'
import { modulesPrisma as prisma } from '@/lib/prisma-modules'
import { success } from '@/lib/api-response'
import { withProjectAccess } from '@/lib/with-project-access'
import { recordAuditEvent, AuditActions } from '@/lib/audit'
import { parseBody, optionalString } from '@/lib/validation'
import { NotFoundError } from '@/lib/errors'

/**
 * Extract drawingId from the URL path.
 */
function extractDrawingId(request: NextRequest): string {
  const url = new URL(request.url)
  const segments = url.pathname.split('/')
  const drawingsIdx = segments.indexOf('drawings')
  const drawingId = drawingsIdx >= 0 ? segments[drawingsIdx + 1] : undefined
  if (!drawingId) {
    throw new NotFoundError('Drawing ID is required')
  }
  return drawingId
}

/**
 * GET /api/projects/[id]/drawings/[drawingId] — Get a single drawing with all revisions.
 */
export const GET = withProjectAccess(async (request: NextRequest, { projectId }) => {
  const drawingId = extractDrawingId(request)

  const drawing = await prisma.drawing.findFirst({
    where: {
      id: drawingId,
      projectId,
    },
    include: {
      revisions: {
        orderBy: { createdAt: 'desc' },
      },
    },
  })

  if (!drawing) {
    throw new NotFoundError('Drawing not found')
  }

  return success({ drawing })
})

/**
 * PATCH /api/projects/[id]/drawings/[drawingId] — Update drawing metadata.
 */
export const PATCH = withProjectAccess(async (request: NextRequest, { projectId, profile }) => {
  const drawingId = extractDrawingId(request)
  const body = await parseBody(request)

  // Verify drawing exists and belongs to this project
  const existing = await prisma.drawing.findFirst({
    where: { id: drawingId, projectId },
  })

  if (!existing) {
    throw new NotFoundError('Drawing not found')
  }

  // Build update data — only include fields that were provided
  const updateData: Record<string, unknown> = {}

  const title = optionalString(body.title, 'Title', 500)
  if (title !== null) updateData.title = title

  const discipline = optionalString(body.discipline, 'Discipline', 100)
  if (discipline !== null) updateData.discipline = discipline

  const originator = optionalString(body.originator, 'Originator', 200)
  if (originator !== null) updateData.originator = originator

  const building = optionalString(body.building, 'Building', 100)
  if (building !== null) updateData.building = building

  const block = optionalString(body.block, 'Block', 100)
  if (block !== null) updateData.block = block

  const level = optionalString(body.level, 'Level', 100)
  if (level !== null) updateData.level = level

  const zone = optionalString(body.zone, 'Zone', 100)
  if (zone !== null) updateData.zone = zone

  const drawingType = optionalString(body.drawingType, 'Drawing type', 100)
  if (drawingType !== null) updateData.drawingType = drawingType

  const role = optionalString(body.role, 'Role', 50)
  if (role !== null) updateData.role = role

  const sequence = optionalString(body.sequence, 'Sequence', 50)
  if (sequence !== null) updateData.sequence = sequence

  const externalLink = optionalString(body.externalLink, 'External link', 2000)
  if (externalLink !== null) updateData.externalLink = externalLink

  if (typeof body.isCurrent === 'boolean') {
    updateData.isCurrent = body.isCurrent
  }

  if (Object.keys(updateData).length === 0) {
    return success({ drawing: existing })
  }

  const drawing = await prisma.drawing.update({
    where: { id: drawingId },
    data: updateData,
    include: {
      revisions: {
        orderBy: { createdAt: 'desc' },
      },
    },
  })

  await recordAuditEvent({
    organisationId: profile.organisationId,
    actorId: profile.id,
    action: AuditActions.DRAWING_UPDATED,
    entityType: 'Drawing',
    entityId: drawing.id,
    metadata: { fields: Object.keys(updateData) },
  })

  return success({ drawing })
})

import type { NextRequest } from 'next/server'
import { modulesPrisma as prisma } from '@/lib/prisma-modules'
import { success } from '@/lib/api-response'
import { withProjectAccess } from '@/lib/with-project-access'
import { recordAuditEvent, AuditActions } from '@/lib/audit'
import { parseBody, requireString, optionalString, optionalEnum } from '@/lib/validation'

const DISCIPLINES = [
  'Architecture', 'Structure', 'Mechanical', 'Electrical', 'Plumbing',
  'Civil', 'Landscape', 'Interior', 'Fire', 'Acoustic',
] as const

const DRAWING_TYPES = [
  'Plan', 'Section', 'Elevation', 'Detail', 'Schedule',
  'Diagram', 'Assembly', 'General Arrangement', 'Layout',
] as const

const DRAWING_STATUSES = [
  'WORK_IN_PROGRESS', 'SHARED', 'PUBLISHED', 'SUPERSEDED', 'ARCHIVED',
] as const

/**
 * GET /api/projects/[id]/drawings — List drawings for the project.
 * Supports query params: discipline, status, search, drawingType
 */
export const GET = withProjectAccess(async (request: NextRequest, { projectId }) => {
  const url = new URL(request.url)
  const discipline = url.searchParams.get('discipline')
  const status = url.searchParams.get('status')
  const search = url.searchParams.get('search')
  const drawingType = url.searchParams.get('drawingType')

  // Build where clause
  const where: Record<string, unknown> = { projectId }

  if (discipline) {
    where.discipline = discipline
  }

  if (drawingType) {
    where.drawingType = drawingType
  }

  if (search) {
    where.OR = [
      { drawingNumber: { contains: search, mode: 'insensitive' } },
      { title: { contains: search, mode: 'insensitive' } },
      { originator: { contains: search, mode: 'insensitive' } },
    ]
  }

  // If status filter, join through revisions to find latest revision matching status
  const revisionWhere: Record<string, unknown> = {}
  if (status && DRAWING_STATUSES.includes(status as typeof DRAWING_STATUSES[number])) {
    revisionWhere.status = status
    revisionWhere.superseded = false
  }

  const drawings = await prisma.drawing.findMany({
    where,
    include: {
      revisions: {
        where: Object.keys(revisionWhere).length > 0
          ? revisionWhere
          : { superseded: false },
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
    orderBy: { drawingNumber: 'asc' },
  })

  // If filtering by status, only return drawings that have matching revisions
  const filtered = status
    ? drawings.filter((d: { revisions: unknown[] }) => d.revisions.length > 0)
    : drawings

  return success({ drawings: filtered })
})

/**
 * POST /api/projects/[id]/drawings — Create a new drawing with optional initial revision.
 */
export const POST = withProjectAccess(async (request: NextRequest, { projectId, profile }) => {
  const body = await parseBody(request)

  const drawingNumber = requireString(body.drawingNumber, 'Drawing number', 100)
  const title = requireString(body.title, 'Title', 500)
  const discipline = optionalString(body.discipline, 'Discipline', 100)
  const originator = optionalString(body.originator, 'Originator', 200)
  const building = optionalString(body.building, 'Building', 100)
  const block = optionalString(body.block, 'Block', 100)
  const level = optionalString(body.level, 'Level', 100)
  const zone = optionalString(body.zone, 'Zone', 100)
  const drawingType = optionalString(body.drawingType, 'Drawing type', 100)
  const role = optionalString(body.role, 'Role', 50)
  const sequence = optionalString(body.sequence, 'Sequence', 50)
  const externalLink = optionalString(body.externalLink, 'External link', 2000)

  // Build the create data
  const drawingData: Record<string, unknown> = {
    projectId,
    drawingNumber,
    title,
    discipline,
    originator,
    building,
    block,
    level,
    zone,
    drawingType,
    role,
    sequence,
    externalLink,
  }

  // If initial revision info provided, create it alongside the drawing
  const initialRevision = body.revision as string | undefined
  if (initialRevision) {
    const revisionCode = requireString(initialRevision, 'Revision code', 20)
    const revDescription = optionalString(body.revisionDescription, 'Revision description', 2000)
    const revStatus = optionalEnum(body.revisionStatus, 'Revision status', DRAWING_STATUSES) ?? 'WORK_IN_PROGRESS'
    const suitability = optionalString(body.suitability, 'Suitability', 10)
    const purposeOfIssue = optionalString(body.purposeOfIssue, 'Purpose of issue', 200)
    const author = optionalString(body.author, 'Author', 200)

    drawingData.revisions = {
      create: {
        revision: revisionCode,
        description: revDescription,
        status: revStatus,
        suitability,
        purposeOfIssue,
        author,
      },
    }
  }

  const drawing = await prisma.drawing.create({
    data: drawingData,
    include: {
      revisions: {
        orderBy: { createdAt: 'desc' },
      },
    },
  })

  await recordAuditEvent({
    organisationId: profile.organisationId,
    actorId: profile.id,
    action: AuditActions.DRAWING_CREATED,
    entityType: 'Drawing',
    entityId: drawing.id,
    metadata: { drawingNumber, title, discipline },
  })

  return success({ drawing }, 201)
})

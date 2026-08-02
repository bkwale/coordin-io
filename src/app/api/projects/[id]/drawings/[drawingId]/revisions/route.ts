import type { NextRequest } from 'next/server'
import { modulesPrisma as prisma } from '@/lib/prisma-modules'
import { success } from '@/lib/api-response'
import { withProjectAccess } from '@/lib/with-project-access'
import { recordAuditEvent, AuditActions } from '@/lib/audit'
import { parseBody, requireString, optionalString, optionalEnum, optionalNumber } from '@/lib/validation'
import { NotFoundError } from '@/lib/errors'

const DRAWING_STATUSES = [
  'WORK_IN_PROGRESS', 'SHARED', 'PUBLISHED', 'SUPERSEDED', 'ARCHIVED',
] as const

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
 * GET /api/projects/[id]/drawings/[drawingId]/revisions — List all revisions for a drawing.
 */
export const GET = withProjectAccess(async (request: NextRequest, { projectId }) => {
  const drawingId = extractDrawingId(request)

  // Verify drawing exists and belongs to this project
  const drawing = await prisma.drawing.findFirst({
    where: { id: drawingId, projectId },
    select: { id: true },
  })

  if (!drawing) {
    throw new NotFoundError('Drawing not found')
  }

  const revisions = await prisma.drawingRevision.findMany({
    where: { drawingId },
    orderBy: { createdAt: 'desc' },
  })

  return success({ revisions })
})

/**
 * POST /api/projects/[id]/drawings/[drawingId]/revisions — Add a new revision.
 * Automatically supersedes previous revisions.
 */
export const POST = withProjectAccess(async (request: NextRequest, { projectId, profile }) => {
  const drawingId = extractDrawingId(request)
  const body = await parseBody(request)

  // Verify drawing exists and belongs to this project
  const drawing = await prisma.drawing.findFirst({
    where: { id: drawingId, projectId },
    select: { id: true, drawingNumber: true },
  })

  if (!drawing) {
    throw new NotFoundError('Drawing not found')
  }

  const revision = requireString(body.revision, 'Revision code', 20)
  const description = optionalString(body.description, 'Description', 2000)
  const status = optionalEnum(body.status, 'Status', DRAWING_STATUSES) ?? 'WORK_IN_PROGRESS'
  const suitability = optionalString(body.suitability, 'Suitability', 10)
  const purposeOfIssue = optionalString(body.purposeOfIssue, 'Purpose of issue', 200)
  const author = optionalString(body.author, 'Author', 200)
  const checker = optionalString(body.checker, 'Checker', 200)
  const approver = optionalString(body.approver, 'Approver', 200)
  const fileUrl = optionalString(body.fileUrl, 'File URL', 2000)
  const fileSize = optionalNumber(body.fileSize, 'File size', { min: 0 })
  const comments = optionalString(body.comments, 'Comments', 5000)
  const transmittalRef = optionalString(body.transmittalRef, 'Transmittal reference', 100)

  const issueDateStr = body.issueDate as string | undefined
  const issueDate = issueDateStr ? new Date(issueDateStr) : null

  // Use a transaction: supersede previous revisions, then create the new one
  const result = await prisma.$transaction(async (tx: typeof prisma) => {
    // Supersede all existing non-superseded revisions
    await tx.drawingRevision.updateMany({
      where: { drawingId, superseded: false },
      data: { superseded: true, status: 'SUPERSEDED' },
    })

    // Create the new revision
    const newRevision = await tx.drawingRevision.create({
      data: {
        drawingId,
        revision,
        description,
        status,
        suitability,
        purposeOfIssue,
        author,
        checker,
        approver,
        issueDate,
        fileUrl,
        fileSize,
        comments,
        transmittalRef,
      },
    })

    return newRevision
  })

  await recordAuditEvent({
    organisationId: profile.organisationId,
    actorId: profile.id,
    action: AuditActions.DRAWING_REVISION_CREATED,
    entityType: 'DrawingRevision',
    entityId: result.id,
    metadata: { drawingId, drawingNumber: drawing.drawingNumber, revision },
  })

  return success({ revision: result }, 201)
})

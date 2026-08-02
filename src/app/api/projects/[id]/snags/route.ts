import { NextRequest } from 'next/server'
import { modulesPrisma } from '@/lib/prisma-modules'
import { recordAuditEvent, AuditActions } from '@/lib/audit'
import { success } from '@/lib/api-response'
import { withProjectAccess } from '@/lib/with-project-access'
import {
  requireString, optionalString, optionalEnum, optionalDate, optionalId,
  parseBody,
} from '@/lib/validation'

const SNAG_CATEGORIES = [
  'ARCHITECTURAL', 'MEP', 'STRUCTURAL', 'FIRE',
  'HEALTH_SAFETY', 'FINISH', 'FF_AND_E', 'EXTERNAL_WORKS',
] as const

const SNAG_SEVERITIES = ['MINOR', 'MODERATE', 'MAJOR', 'SAFETY_CRITICAL'] as const

const SNAG_STATUSES = [
  'OPEN', 'ASSIGNED', 'RECTIFICATION_SUBMITTED', 'VERIFICATION', 'CLOSED', 'REOPENED',
] as const

/**
 * GET /api/projects/[id]/snags — List snags for a project.
 *
 * Optional query params: ?status=, ?severity=, ?category=, ?contractor=, ?block=
 */
export const GET = withProjectAccess(async (request: NextRequest, { projectId }) => {
  const url = new URL(request.url)
  const status = url.searchParams.get('status')
  const category = url.searchParams.get('category')
  const severity = url.searchParams.get('severity')
  const contractor = url.searchParams.get('contractor')
  const block = url.searchParams.get('block')
  const assignee = url.searchParams.get('assignee')

  const where: Record<string, unknown> = { projectId }
  if (status && SNAG_STATUSES.includes(status as any)) where.status = status
  if (category && SNAG_CATEGORIES.includes(category as any)) where.category = category
  if (severity && SNAG_SEVERITIES.includes(severity as any)) where.severity = severity
  if (contractor) where.responsibleOrg = contractor
  if (block) where.block = block
  if (assignee) where.assignedToId = assignee

  const snags = await modulesPrisma.snag.findMany({
    where,
    include: {
      createdBy: { select: { id: true, fullName: true } },
      verifiedBy: { select: { id: true, fullName: true } },
      assignedTo: { select: { id: true, fullName: true } },
    },
    orderBy: [
      { severity: 'desc' },
      { createdAt: 'desc' },
    ],
  })

  return success({ snags })
})

/**
 * POST /api/projects/[id]/snags — Create a new snag.
 * New snags always start in OPEN status.
 * Auto-generates snagNumber as SNG-001, SNG-002, etc.
 */
export const POST = withProjectAccess(async (request: NextRequest, { profile, projectId }) => {
  const body = await parseBody(request)

  const description = requireString(body.description, 'Description', 5000)
  const category = optionalEnum(body.category, 'Category', SNAG_CATEGORIES) || 'ARCHITECTURAL'
  const severity = optionalEnum(body.severity, 'Severity', SNAG_SEVERITIES) || 'MINOR'
  const block = optionalString(body.block, 'Block', 100)
  const floor = optionalString(body.floor, 'Floor', 100)
  const room = optionalString(body.room, 'Room', 100)
  const element = optionalString(body.element, 'Element', 200)
  const drawingRef = optionalString(body.drawingRef, 'Drawing reference', 200)
  const specRef = optionalString(body.specRef, 'Spec reference', 200)
  const responsibleOrg = optionalString(body.responsibleOrg, 'Responsible organisation', 200)
  const assignedToId = optionalId(body.assignedToId, 'Assigned to')
  const targetDate = optionalDate(body.targetDate, 'Target date')

  // photoUrls: optional string array
  const photoUrls: string[] = []
  if (Array.isArray(body.photoUrls)) {
    for (const url of body.photoUrls) {
      if (typeof url === 'string' && url.trim().length > 0) {
        photoUrls.push(url.trim())
      }
    }
  }

  // Auto-generate snag number: SNG-001, SNG-002, etc.
  const count = await modulesPrisma.snag.count({ where: { projectId } })
  const snagNumber = `SNG-${String(count + 1).padStart(3, '0')}`

  const snag = await modulesPrisma.snag.create({
    data: {
      projectId,
      createdById: profile.id,
      snagNumber,
      description,
      category,
      severity,
      status: 'OPEN',
      block: block || null,
      floor: floor || null,
      room: room || null,
      element: element || null,
      drawingRef: drawingRef || null,
      specRef: specRef || null,
      responsibleOrg: responsibleOrg || null,
      assignedToId: assignedToId || null,
      targetDate,
      photoUrls,
    },
    include: {
      createdBy: { select: { id: true, fullName: true } },
      verifiedBy: { select: { id: true, fullName: true } },
      assignedTo: { select: { id: true, fullName: true } },
    },
  })

  await recordAuditEvent({
    organisationId: profile.organisationId,
    actorId: profile.id,
    action: AuditActions.SNAG_CREATED,
    entityType: 'snag',
    entityId: snag.id,
    metadata: {
      snagNumber,
      description: snag.description,
      category: snag.category,
      severity: snag.severity,
      projectId,
    },
    ipAddress: request.headers.get('x-forwarded-for') || undefined,
  })

  return success({ snag }, 201)
})

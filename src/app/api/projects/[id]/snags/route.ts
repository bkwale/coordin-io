import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { recordAuditEvent, AuditActions } from '@/lib/audit'
import { success } from '@/lib/api-response'
import { withProjectAccess } from '@/lib/with-project-access'
import {
  requireString, optionalString, optionalEnum, optionalDate, parseBody,
} from '@/lib/validation'
import type { SnagCategory, SnagSeverity, SnagStatus } from '@/generated/prisma/client'

const SNAG_CATEGORIES: readonly SnagCategory[] = [
  'ARCHITECTURAL', 'MEP', 'STRUCTURAL', 'FIRE',
  'HEALTH_SAFETY', 'FINISH', 'FF_AND_E', 'EXTERNAL_WORKS',
] as const

const SNAG_SEVERITIES: readonly SnagSeverity[] = [
  'MINOR', 'MODERATE', 'MAJOR', 'SAFETY_CRITICAL',
] as const

const SNAG_STATUSES: readonly SnagStatus[] = [
  'OPEN', 'ASSIGNED', 'RECTIFICATION_SUBMITTED', 'VERIFICATION', 'CLOSED', 'REOPENED',
] as const

/**
 * GET /api/projects/[id]/snags — List snags for a project.
 *
 * Optional query params: ?status=, ?category=, ?severity=, ?block=
 */
export const GET = withProjectAccess(async (request: NextRequest, { projectId }) => {
  const url = new URL(request.url)
  const status = url.searchParams.get('status')
  const category = url.searchParams.get('category')
  const severity = url.searchParams.get('severity')
  const block = url.searchParams.get('block')

  const where: Record<string, unknown> = { projectId }
  if (status && SNAG_STATUSES.includes(status as SnagStatus)) where.status = status
  if (category && SNAG_CATEGORIES.includes(category as SnagCategory)) where.category = category
  if (severity && SNAG_SEVERITIES.includes(severity as SnagSeverity)) where.severity = severity
  if (block) where.block = block

  const snags = await prisma.snag.findMany({
    where,
    include: {
      createdBy: { select: { id: true, fullName: true } },
      verifiedBy: { select: { id: true, fullName: true } },
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
 */
export const POST = withProjectAccess(async (request: NextRequest, { profile, projectId }) => {
  const body = await parseBody(request)

  const description = requireString(body.description, 'Description', 5000)
  const category = optionalEnum(body.category, 'Category', SNAG_CATEGORIES) as SnagCategory | undefined
  const severity = optionalEnum(body.severity, 'Severity', SNAG_SEVERITIES) as SnagSeverity | undefined
  const block = optionalString(body.block, 'Block', 100)
  const floor = optionalString(body.floor, 'Floor', 100)
  const room = optionalString(body.room, 'Room', 100)
  const element = optionalString(body.element, 'Element', 200)
  const drawingRef = optionalString(body.drawingRef, 'Drawing reference', 200)
  const specRef = optionalString(body.specRef, 'Spec reference', 200)
  const responsibleOrg = optionalString(body.responsibleOrg, 'Responsible organisation', 200)
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

  const snag = await prisma.snag.create({
    data: {
      projectId,
      createdById: profile.id,
      description,
      category: category || 'ARCHITECTURAL',
      severity: severity || 'MINOR',
      status: 'OPEN',
      block: block || null,
      floor: floor || null,
      room: room || null,
      element: element || null,
      drawingRef: drawingRef || null,
      specRef: specRef || null,
      responsibleOrg: responsibleOrg || null,
      targetDate,
      photoUrls,
    },
    include: {
      createdBy: { select: { id: true, fullName: true } },
      verifiedBy: { select: { id: true, fullName: true } },
    },
  })

  await recordAuditEvent({
    organisationId: profile.organisationId,
    actorId: profile.id,
    action: AuditActions.SNAG_CREATED,
    entityType: 'snag',
    entityId: snag.id,
    metadata: { description: snag.description, category: snag.category, severity: snag.severity, projectId },
    ipAddress: request.headers.get('x-forwarded-for') || undefined,
  })

  return success({ snag }, 201)
})

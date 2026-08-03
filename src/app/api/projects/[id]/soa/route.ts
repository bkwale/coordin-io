import { NextRequest } from 'next/server'
import { modulesPrisma } from '@/lib/prisma-modules'
import { success } from '@/lib/api-response'
import { withProjectAccess } from '@/lib/with-project-access'
import { recordAuditEvent, AuditActions } from '@/lib/audit'
import {
  optionalString, parseBody,
} from '@/lib/validation'

const SOA_STATUSES = ['DRAFT', 'UNDER_REVIEW', 'APPROVED', 'SUPERSEDED'] as const

/**
 * GET /api/projects/[id]/soa — List SOA versions for a project.
 * Includes row count per version. Ordered by versionNumber desc.
 */
export const GET = withProjectAccess(async (_request: NextRequest, { projectId }) => {
  const versions = await modulesPrisma.sOAVersion.findMany({
    where: { projectId },
    include: {
      _count: { select: { rows: true } },
    },
    orderBy: { versionNumber: 'desc' },
  })

  return success({ versions })
})

/**
 * POST /api/projects/[id]/soa — Create a new SOA version.
 * Auto-increments versionNumber. Sets previous active versions to SUPERSEDED.
 */
export const POST = withProjectAccess(async (request: NextRequest, { projectId, profile }) => {
  const body = await parseBody(request)

  const name = optionalString(body.name, 'Version name', 200)
  const changeReason = optionalString(body.changeReason, 'Change reason', 2000)

  // Get current max version number
  const latest = await modulesPrisma.sOAVersion.findFirst({
    where: { projectId },
    orderBy: { versionNumber: 'desc' },
    select: { versionNumber: true, id: true },
  })

  const nextVersionNumber = (latest?.versionNumber ?? 0) + 1

  // Mark previous DRAFT versions as SUPERSEDED
  await modulesPrisma.sOAVersion.updateMany({
    where: { projectId, status: 'DRAFT' },
    data: { status: 'SUPERSEDED' },
  })

  // Create new version
  const version = await modulesPrisma.sOAVersion.create({
    data: {
      projectId,
      versionNumber: nextVersionNumber,
      name: name || `Version ${nextVersionNumber}`,
      status: 'DRAFT',
      changeReason,
    },
  })

  // If copying from previous version, copy rows
  if (latest?.id && body.copyFromPrevious) {
    const previousRows = await modulesPrisma.sOARow.findMany({
      where: { versionId: latest.id },
      orderBy: { sortOrder: 'asc' },
    })

    if (previousRows.length > 0) {
      await modulesPrisma.sOARow.createMany({
        data: previousRows.map((row: Record<string, unknown>) => ({
          versionId: version.id,
          spaceCategory: row.spaceCategory as string,
          roomType: row.roomType as string,
          code: row.code as string | null,
          quantity: row.quantity as number,
          targetArea: row.targetArea as number | null,
          currentArea: row.currentArea as number | null,
          requirement: row.requirement as string | null,
          requirementSource: row.requirementSource as string | null,
          status: 'DRAFT',
          comment: row.comment as string | null,
          sortOrder: row.sortOrder as number,
        })),
      })
    }
  }

  await recordAuditEvent({
    organisationId: profile.organisationId,
    actorId: profile.id,
    action: AuditActions.PROJECT_UPDATED,
    entityType: 'SOAVersion',
    entityId: version.id,
    metadata: { versionNumber: nextVersionNumber, name: version.name },
  })

  return success({ version }, 201)
}, { minProjectRole: 'PROJECT_LEAD' })

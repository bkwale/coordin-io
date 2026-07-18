import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { success } from '@/lib/api-response'
import { withAuth } from '@/lib/with-auth'
import { recordAuditEvent, AuditActions } from '@/lib/audit'
import { requireString, optionalString, requireEnum, parseBody } from '@/lib/validation'
import { PermissionError } from '@/lib/errors'

const COMPETENCY_LEVELS = ['BEGINNER', 'DEVELOPING', 'COMPETENT', 'PROFICIENT', 'EXPERT'] as const

/**
 * GET /api/competency — List competency records.
 *
 * Returns own records by default.
 * ?profileId=xxx for manager to view a report's records.
 */
export const GET = withAuth(async (request: NextRequest, { profile }) => {
  const url = new URL(request.url)
  const targetProfileId = url.searchParams.get('profileId')

  let where: Record<string, unknown>

  if (targetProfileId) {
    // Verify the requester is the target's manager or an admin
    const isAdmin = profile.orgPermission === 'ADMIN' || profile.orgPermission === 'OWNER'
    if (!isAdmin) {
      const targetProfile = await prisma.profile.findUnique({
        where: { id: targetProfileId },
        select: { managerId: true, organisationId: true },
      })
      if (!targetProfile || targetProfile.organisationId !== profile.organisationId || targetProfile.managerId !== profile.id) {
        throw new PermissionError('You do not have access to this employee\'s competency records')
      }
      where = { profileId: targetProfileId }
    } else {
      where = { profileId: targetProfileId }
    }
  } else {
    where = { profileId: profile.id }
  }

  const records = await prisma.competencyRecord.findMany({
    where,
    orderBy: { createdAt: 'desc' },
  })

  return success({ records })
})

/**
 * POST /api/competency — Create/assess a competency record.
 */
export const POST = withAuth(async (request: NextRequest, { profile }) => {
  const body = await parseBody(request)

  const area = requireString(body.area, 'Area', 200)
  const level = requireEnum(body.level, 'Level', COMPETENCY_LEVELS)
  const notes = optionalString(body.notes, 'Notes', 2000)

  const record = await prisma.competencyRecord.create({
    data: {
      profileId: profile.id,
      area,
      level,
      notes,
      assessedAt: new Date(),
    },
  })

  await recordAuditEvent({
    organisationId: profile.organisationId,
    actorId: profile.id,
    action: AuditActions.COMPETENCY_ASSESSED,
    entityType: 'competency_record',
    entityId: record.id,
    metadata: { area, level },
    ipAddress: request.headers.get('x-forwarded-for') || undefined,
  })

  return success({ record }, 201)
})

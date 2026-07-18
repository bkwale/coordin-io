import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { success } from '@/lib/api-response'
import { withAuth } from '@/lib/with-auth'
import { recordAuditEvent, AuditActions } from '@/lib/audit'
import { optionalString, optionalEnum, parseBody } from '@/lib/validation'
import { NotFoundError, PermissionError } from '@/lib/errors'

const COMPETENCY_LEVELS = ['BEGINNER', 'DEVELOPING', 'COMPETENT', 'PROFICIENT', 'EXPERT'] as const

/**
 * GET /api/competency/[id] — Get a single competency record.
 */
export const GET = withAuth(async (request: NextRequest, { profile }) => {
  const id = request.url.match(/\/competency\/([^/?]+)/)?.[1]
  if (!id) throw new NotFoundError('Competency record not found')

  const record = await prisma.competencyRecord.findUnique({
    where: { id },
  })

  if (!record) {
    throw new NotFoundError('Competency record not found')
  }

  // The CompetencyRecord doesn't have a direct profile relation with org,
  // so check ownership or admin. If the profileId doesn't match, verify admin.
  if (record.profileId !== profile.id) {
    const isAdmin = profile.orgPermission === 'ADMIN' || profile.orgPermission === 'OWNER'
    if (!isAdmin) {
      throw new PermissionError('You do not have access to this competency record')
    }
  }

  return success({ record })
})

/**
 * PATCH /api/competency/[id] — Update competency level/notes.
 */
export const PATCH = withAuth(async (request: NextRequest, { profile }) => {
  const id = request.url.match(/\/competency\/([^/?]+)/)?.[1]
  if (!id) throw new NotFoundError('Competency record not found')
  const body = await parseBody(request)

  const record = await prisma.competencyRecord.findUnique({
    where: { id },
  })

  if (!record) {
    throw new NotFoundError('Competency record not found')
  }

  // Only owner or admin can update
  const isOwner = record.profileId === profile.id
  const isAdmin = profile.orgPermission === 'ADMIN' || profile.orgPermission === 'OWNER'

  if (!isOwner && !isAdmin) {
    throw new PermissionError('You do not have permission to update this record')
  }

  const updateData: Record<string, unknown> = {}
  const newLevel = optionalEnum(body.level, 'Level', COMPETENCY_LEVELS)
  if (newLevel) {
    updateData.level = newLevel
    updateData.assessedAt = new Date()
  }
  if (body.notes !== undefined) {
    updateData.notes = optionalString(body.notes, 'Notes', 2000)
  }

  const updated = await prisma.competencyRecord.update({
    where: { id },
    data: updateData,
  })

  await recordAuditEvent({
    organisationId: profile.organisationId,
    actorId: profile.id,
    action: AuditActions.COMPETENCY_UPDATED,
    entityType: 'competency_record',
    entityId: id,
    metadata: { ...(newLevel ? { level: newLevel } : {}) },
    ipAddress: request.headers.get('x-forwarded-for') || undefined,
  })

  return success({ record: updated })
})

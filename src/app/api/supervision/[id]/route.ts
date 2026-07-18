import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { success } from '@/lib/api-response'
import { withAuth } from '@/lib/with-auth'
import { recordAuditEvent, AuditActions } from '@/lib/audit'
import { optionalString, parseBody } from '@/lib/validation'
import { NotFoundError, PermissionError } from '@/lib/errors'

/**
 * GET /api/supervision/[id] — Get a single supervision record.
 */
export const GET = withAuth(async (request: NextRequest, { profile }) => {
  const id = request.url.match(/\/supervision\/([^/?]+)/)?.[1]
  if (!id) throw new NotFoundError('Supervision record not found')

  const record = await prisma.supervisionRecord.findUnique({
    where: { id },
    include: {
      employee: { select: { id: true, fullName: true, jobTitle: true, organisationId: true } },
      supervisor: { select: { id: true, fullName: true } },
    },
  })

  if (!record) {
    throw new NotFoundError('Supervision record not found')
  }

  // Must be employee, supervisor, or admin
  const isEmployee = record.employeeId === profile.id
  const isSupervisor = record.supervisorId === profile.id
  const isAdmin = profile.orgPermission === 'ADMIN' || profile.orgPermission === 'OWNER'

  if (!isEmployee && !isSupervisor && !isAdmin) {
    throw new PermissionError('You do not have access to this supervision record')
  }

  // Org boundary
  if (record.employee.organisationId !== profile.organisationId) {
    throw new NotFoundError('Supervision record not found')
  }

  return success({ record })
})

/**
 * PATCH /api/supervision/[id] — Update supervision record notes/objectives/feedback.
 *
 * Only the supervisor or an admin can update.
 */
export const PATCH = withAuth(async (request: NextRequest, { profile }) => {
  const id = request.url.match(/\/supervision\/([^/?]+)/)?.[1]
  if (!id) throw new NotFoundError('Supervision record not found')
  const body = await parseBody(request)

  const record = await prisma.supervisionRecord.findUnique({
    where: { id },
    include: {
      employee: { select: { organisationId: true } },
    },
  })

  if (!record) {
    throw new NotFoundError('Supervision record not found')
  }

  // Org boundary
  if (record.employee.organisationId !== profile.organisationId) {
    throw new NotFoundError('Supervision record not found')
  }

  const isSupervisor = record.supervisorId === profile.id
  const isAdmin = profile.orgPermission === 'ADMIN' || profile.orgPermission === 'OWNER'

  if (!isSupervisor && !isAdmin) {
    throw new PermissionError('Only the supervisor or an admin can update this record')
  }

  const updateData: Record<string, unknown> = {}
  if (body.notes !== undefined) updateData.notes = optionalString(body.notes, 'Notes', 5000)
  if (body.objectives !== undefined) updateData.objectives = optionalString(body.objectives, 'Objectives', 5000)
  if (body.feedback !== undefined) updateData.feedback = optionalString(body.feedback, 'Feedback', 5000)

  const updated = await prisma.supervisionRecord.update({
    where: { id },
    data: updateData,
    include: {
      employee: { select: { id: true, fullName: true } },
      supervisor: { select: { id: true, fullName: true } },
    },
  })

  await recordAuditEvent({
    organisationId: profile.organisationId,
    actorId: profile.id,
    action: AuditActions.SUPERVISION_UPDATED,
    entityType: 'supervision_record',
    entityId: id,
    metadata: {},
    ipAddress: request.headers.get('x-forwarded-for') || undefined,
  })

  return success({ record: updated })
})

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { success } from '@/lib/api-response'
import { withAuth } from '@/lib/with-auth'
import { recordAuditEvent, AuditActions } from '@/lib/audit'
import { requireEnum, optionalString, optionalDate, parseBody } from '@/lib/validation'
import { NotFoundError, PermissionError, ValidationError } from '@/lib/errors'
import type { CPDStatus } from '@/generated/prisma/client'

const CPD_STATUSES = ['DRAFT', 'SUBMITTED', 'VERIFIED', 'RETURNED'] as const

const VALID_CPD_TRANSITIONS: Record<CPDStatus, CPDStatus[]> = {
  DRAFT: ['SUBMITTED'],
  SUBMITTED: ['VERIFIED', 'RETURNED'],
  VERIFIED: [],
  RETURNED: ['SUBMITTED'],
}

/**
 * GET /api/cpd/[id] — Get a single CPD record.
 */
export const GET = withAuth(async (request: NextRequest, { profile }) => {
  const id = request.url.match(/\/cpd\/([^/?]+)/)?.[1]
  if (!id) throw new NotFoundError('CPD record not found')

  const record = await prisma.cPDRecord.findUnique({
    where: { id },
    include: {
      profile: { select: { id: true, fullName: true, jobTitle: true, organisationId: true } },
      verifiedBy: { select: { id: true, fullName: true } },
    },
  })

  if (!record) {
    throw new NotFoundError('CPD record not found')
  }

  // Org boundary
  if (record.profile.organisationId !== profile.organisationId) {
    throw new NotFoundError('CPD record not found')
  }

  return success({ record })
})

/**
 * PATCH /api/cpd/[id] — Update CPD record.
 *
 * If `status` is provided, performs a status transition.
 * If no `status`, updates editable fields (only in DRAFT).
 */
export const PATCH = withAuth(async (request: NextRequest, { profile }) => {
  const id = request.url.match(/\/cpd\/([^/?]+)/)?.[1]
  if (!id) throw new NotFoundError('CPD record not found')
  const body = await parseBody(request)

  const record = await prisma.cPDRecord.findUnique({
    where: { id },
    include: {
      profile: { select: { organisationId: true, managerId: true } },
    },
  })

  if (!record) {
    throw new NotFoundError('CPD record not found')
  }

  // Org boundary
  if (record.profile.organisationId !== profile.organisationId) {
    throw new NotFoundError('CPD record not found')
  }

  const isOwner = record.profileId === profile.id
  const isManager = record.profile.managerId === profile.id
  const isAdmin = profile.orgPermission === 'ADMIN' || profile.orgPermission === 'OWNER'

  // Status transition
  if (body.status !== undefined) {
    const newStatus = requireEnum(body.status, 'Status', CPD_STATUSES)
    const currentStatus = record.status as CPDStatus
    const comment = optionalString(body.comment, 'Comment', 1000)

    // Validate transition
    if (currentStatus === newStatus) {
      throw new ValidationError(`Record is already ${currentStatus}`)
    }
    if (!VALID_CPD_TRANSITIONS[currentStatus].includes(newStatus)) {
      const allowed = VALID_CPD_TRANSITIONS[currentStatus]
      const allowedStr = allowed.length > 0 ? allowed.join(', ') : 'none (terminal state)'
      throw new ValidationError(
        `Cannot transition from ${currentStatus} to ${newStatus}. Valid transitions: ${allowedStr}`,
      )
    }

    // Role checks
    if (newStatus === 'SUBMITTED' && !isOwner) {
      throw new PermissionError('Only the record owner can submit')
    }
    if ((newStatus === 'VERIFIED' || newStatus === 'RETURNED') && !isManager && !isAdmin) {
      throw new PermissionError('Only a manager or admin can verify or return a CPD record')
    }

    const updateData: Record<string, unknown> = { status: newStatus }

    if (newStatus === 'VERIFIED') {
      updateData.verifiedById = profile.id
      updateData.verifiedAt = new Date()
    }

    const updated = await prisma.cPDRecord.update({
      where: { id },
      data: updateData,
      include: {
        profile: { select: { id: true, fullName: true } },
        verifiedBy: { select: { id: true, fullName: true } },
      },
    })

    // Audit
    const actionMap: Record<string, string> = {
      SUBMITTED: AuditActions.CPD_SUBMITTED,
      VERIFIED: AuditActions.CPD_VERIFIED,
      RETURNED: AuditActions.CPD_RETURNED,
    }
    if (actionMap[newStatus]) {
      await recordAuditEvent({
        organisationId: profile.organisationId,
        actorId: profile.id,
        action: actionMap[newStatus],
        entityType: 'cpd_record',
        entityId: id,
        metadata: {
          from: currentStatus,
          to: newStatus,
          ...(comment ? { comment } : {}),
        },
        ipAddress: request.headers.get('x-forwarded-for') || undefined,
      })
    }

    return success({ record: updated })
  }

  // Field update (DRAFT only)
  if (record.status !== 'DRAFT') {
    throw new ValidationError('Can only edit fields while in DRAFT status')
  }
  if (!isOwner) {
    throw new PermissionError('Only the record owner can edit')
  }

  const updateData: Record<string, unknown> = {}
  if (body.title !== undefined) updateData.title = optionalString(body.title, 'Title', 200) ?? record.title
  if (body.provider !== undefined) updateData.provider = optionalString(body.provider, 'Provider', 200)
  if (body.topic !== undefined) updateData.topic = optionalString(body.topic, 'Topic', 500)
  if (body.learningOutcome !== undefined) updateData.learningOutcome = optionalString(body.learningOutcome, 'Learning outcome', 2000)
  if (body.evidenceUrl !== undefined) updateData.evidenceUrl = optionalString(body.evidenceUrl, 'Evidence URL', 2000)
  if (body.date !== undefined) {
    const d = optionalDate(body.date, 'Date')
    if (d) updateData.date = d
  }
  if (body.durationHours !== undefined) {
    if (typeof body.durationHours !== 'number' || isNaN(body.durationHours) || body.durationHours <= 0) {
      throw new ValidationError('Duration hours must be a positive number')
    }
    updateData.durationHours = body.durationHours
  }

  const updated = await prisma.cPDRecord.update({
    where: { id },
    data: updateData,
    include: {
      profile: { select: { id: true, fullName: true } },
      verifiedBy: { select: { id: true, fullName: true } },
    },
  })

  return success({ record: updated })
})

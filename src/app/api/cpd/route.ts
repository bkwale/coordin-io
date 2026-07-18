import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { success } from '@/lib/api-response'
import { withAuth } from '@/lib/with-auth'
import { recordAuditEvent, AuditActions } from '@/lib/audit'
import { requireString, optionalString, optionalDate, parseBody } from '@/lib/validation'
import { ValidationError } from '@/lib/errors'

/**
 * GET /api/cpd — List CPD records.
 *
 * Returns the current user's own CPD records.
 * Admins can see all org records (?all=true).
 */
export const GET = withAuth(async (request: NextRequest, { profile }) => {
  const url = new URL(request.url)
  const showAll = url.searchParams.get('all') === 'true'

  let where: Record<string, unknown>

  if (showAll && (profile.orgPermission === 'ADMIN' || profile.orgPermission === 'OWNER')) {
    where = {
      profile: { organisationId: profile.organisationId },
    }
  } else {
    where = { profileId: profile.id }
  }

  const records = await prisma.cPDRecord.findMany({
    where,
    include: {
      profile: { select: { id: true, fullName: true, jobTitle: true } },
      verifiedBy: { select: { id: true, fullName: true } },
    },
    orderBy: { date: 'desc' },
  })

  return success({ records })
})

/**
 * POST /api/cpd — Create a new CPD record.
 *
 * Creates in DRAFT status.
 */
export const POST = withAuth(async (request: NextRequest, { profile }) => {
  const body = await parseBody(request)

  const title = requireString(body.title, 'Title', 200)
  const provider = optionalString(body.provider, 'Provider', 200)
  const topic = optionalString(body.topic, 'Topic', 500)
  const learningOutcome = optionalString(body.learningOutcome, 'Learning outcome', 2000)
  const evidenceUrl = optionalString(body.evidenceUrl, 'Evidence URL', 2000)

  // Parse date
  const dateStr = body.date
  if (!dateStr || typeof dateStr !== 'string') {
    throw new ValidationError('Date is required')
  }
  const date = new Date(dateStr)
  if (isNaN(date.getTime())) {
    throw new ValidationError('Date is not a valid date')
  }

  // Validate duration hours
  const durationHours = body.durationHours
  if (durationHours === null || durationHours === undefined || typeof durationHours !== 'number' || isNaN(durationHours)) {
    throw new ValidationError('Duration hours is required and must be a number')
  }
  if (durationHours <= 0) {
    throw new ValidationError('Duration hours must be greater than zero')
  }
  if (durationHours > 1000) {
    throw new ValidationError('Duration hours exceeds maximum allowed (1000)')
  }

  const record = await prisma.cPDRecord.create({
    data: {
      profileId: profile.id,
      title,
      provider,
      date,
      durationHours,
      topic,
      learningOutcome,
      evidenceUrl,
      status: 'DRAFT',
    },
    include: {
      profile: { select: { id: true, fullName: true } },
      verifiedBy: { select: { id: true, fullName: true } },
    },
  })

  await recordAuditEvent({
    organisationId: profile.organisationId,
    actorId: profile.id,
    action: AuditActions.CPD_CREATED,
    entityType: 'cpd_record',
    entityId: record.id,
    metadata: { title, durationHours },
    ipAddress: request.headers.get('x-forwarded-for') || undefined,
  })

  return success({ record }, 201)
})

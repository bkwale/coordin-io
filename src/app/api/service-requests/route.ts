import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { success } from '@/lib/api-response'
import { withAuth } from '@/lib/with-auth'
import { recordAuditEvent, AuditActions } from '@/lib/audit'
import { requireString, optionalString, requireEnum, parseBody } from '@/lib/validation'

const SERVICE_REQUEST_TYPES = [
  'IT_SUPPORT', 'EQUIPMENT', 'PPE', 'SOFTWARE_LICENCE', 'TRAINING',
  'BOOKS_STANDARDS', 'TRAVEL', 'FLIGHTS_ACCOMMODATION', 'OFFICE_SUPPLIES',
] as const

/**
 * GET /api/service-requests — List service requests.
 *
 * Returns the current user's own service requests.
 * Managers see requests pending their approval (?role=approver).
 * Admins can see all org requests (?all=true).
 */
export const GET = withAuth(async (request: NextRequest, { profile }) => {
  const url = new URL(request.url)
  const role = url.searchParams.get('role')
  const showAll = url.searchParams.get('all') === 'true'

  let where: Record<string, unknown>

  if (showAll && (profile.orgPermission === 'ADMIN' || profile.orgPermission === 'OWNER')) {
    where = {
      profile: { organisationId: profile.organisationId },
    }
  } else if (role === 'approver') {
    where = {
      approverId: profile.id,
      status: { in: ['SUBMITTED', 'UNDER_REVIEW'] },
    }
  } else {
    where = { profileId: profile.id }
  }

  const requests = await prisma.serviceRequest.findMany({
    where,
    include: {
      profile: { select: { id: true, fullName: true, jobTitle: true } },
      approver: { select: { id: true, fullName: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  return success({ requests })
})

/**
 * POST /api/service-requests — Create a new service request.
 *
 * Creates in DRAFT status.
 */
export const POST = withAuth(async (request: NextRequest, { profile }) => {
  const body = await parseBody(request)

  const requestType = requireEnum(body.requestType, 'Request type', SERVICE_REQUEST_TYPES)
  const title = requireString(body.title, 'Title', 200)
  const description = optionalString(body.description, 'Description', 2000)

  const managerId = profile.managerId || null

  const serviceRequest = await prisma.serviceRequest.create({
    data: {
      profileId: profile.id,
      requestType,
      title,
      description,
      status: 'DRAFT',
      approverId: managerId,
    },
    include: {
      profile: { select: { id: true, fullName: true } },
      approver: { select: { id: true, fullName: true } },
    },
  })

  await recordAuditEvent({
    organisationId: profile.organisationId,
    actorId: profile.id,
    action: AuditActions.REQUEST_CREATED,
    entityType: 'service_request',
    entityId: serviceRequest.id,
    metadata: { requestType, title },
    ipAddress: request.headers.get('x-forwarded-for') || undefined,
  })

  return success({ serviceRequest }, 201)
})

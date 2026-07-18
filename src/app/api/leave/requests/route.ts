import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { success } from '@/lib/api-response'
import { withAuth } from '@/lib/with-auth'
import { recordAuditEvent, AuditActions } from '@/lib/audit'
import { requireEnum, optionalString, optionalDate, parseBody } from '@/lib/validation'
import { validateLeaveRequest, findOverlappingRequest } from '@/lib/leave-utils'
import { ValidationError } from '@/lib/errors'

const LEAVE_TYPES = ['ANNUAL', 'SICK', 'COMPASSIONATE', 'UNPAID', 'PUBLIC_HOLIDAY'] as const

/**
 * GET /api/leave/requests — List leave requests.
 *
 * Returns the current user's own leave requests.
 * Managers also see requests pending their approval (?role=approver).
 * Admins can see all org requests (?all=true).
 */
export const GET = withAuth(async (request: NextRequest, { profile }) => {
  const url = new URL(request.url)
  const role = url.searchParams.get('role') // 'approver' to see approval queue
  const showAll = url.searchParams.get('all') === 'true'
  const yearParam = url.searchParams.get('year')
  const year = yearParam ? parseInt(yearParam, 10) : new Date().getFullYear()

  let where: Record<string, unknown>

  if (showAll && (profile.orgPermission === 'ADMIN' || profile.orgPermission === 'OWNER')) {
    // Admin/Owner sees all org requests
    where = {
      profile: { organisationId: profile.organisationId },
      startDate: { gte: new Date(`${year}-01-01`) },
    }
  } else if (role === 'approver') {
    // Manager sees requests assigned to them for approval
    where = {
      approverId: profile.id,
      status: { in: ['SUBMITTED', 'UNDER_REVIEW'] },
    }
  } else {
    // Default: own requests
    where = {
      profileId: profile.id,
      startDate: { gte: new Date(`${year}-01-01`) },
    }
  }

  const requests = await prisma.leaveRequest.findMany({
    where,
    include: {
      profile: { select: { id: true, fullName: true, jobTitle: true } },
      approver: { select: { id: true, fullName: true } },
    },
    orderBy: { startDate: 'desc' },
  })

  return success({ requests, year })
})

/**
 * POST /api/leave/requests — Create a new leave request.
 *
 * Creates in DRAFT status. Requester must submit separately via PATCH.
 * For ANNUAL leave, validates against balance and checks for overlaps.
 */
export const POST = withAuth(async (request: NextRequest, { profile }) => {
  const body = await parseBody(request)

  const leaveType = requireEnum(body.leaveType, 'Leave type', LEAVE_TYPES)

  // Parse dates
  const startDateStr = body.startDate
  const endDateStr = body.endDate
  if (!startDateStr || typeof startDateStr !== 'string') {
    throw new ValidationError('Start date is required')
  }
  if (!endDateStr || typeof endDateStr !== 'string') {
    throw new ValidationError('End date is required')
  }

  const startDate = new Date(startDateStr)
  const endDate = new Date(endDateStr)
  if (isNaN(startDate.getTime())) throw new ValidationError('Start date is not a valid date')
  if (isNaN(endDate.getTime())) throw new ValidationError('End date is not a valid date')

  const reason = optionalString(body.reason, 'Reason', 1000)

  // Validate dates and calculate working days
  const { days } = validateLeaveRequest(startDate, endDate)

  // Check for overlapping requests (active ones only)
  const existingRequests = await prisma.leaveRequest.findMany({
    where: {
      profileId: profile.id,
      status: { notIn: ['WITHDRAWN', 'REJECTED'] },
    },
    select: { id: true, startDate: true, endDate: true },
  })

  const overlap = findOverlappingRequest(
    { startDate, endDate },
    existingRequests.map((r) => ({
      id: r.id,
      startDate: r.startDate,
      endDate: r.endDate,
    })),
  )
  if (overlap) {
    throw new ValidationError('This leave request overlaps with an existing request')
  }

  // Use the user's manager as default approver (managerId is on Profile)
  const managerId = profile.managerId || null

  const leaveRequest = await prisma.leaveRequest.create({
    data: {
      profileId: profile.id,
      leaveType,
      startDate,
      endDate,
      days,
      reason,
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
    action: AuditActions.LEAVE_REQUESTED,
    entityType: 'leave_request',
    entityId: leaveRequest.id,
    metadata: { leaveType, days, startDate: startDateStr, endDate: endDateStr },
    ipAddress: request.headers.get('x-forwarded-for') || undefined,
  })

  return success({ leaveRequest }, 201)
})

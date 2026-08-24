import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { success } from '@/lib/api-response'
import { withAuth } from '@/lib/with-auth'
import { recordAuditEvent, AuditActions } from '@/lib/audit'
import { requireEnum, optionalString, parseBody } from '@/lib/validation'
import { validateLeaveRequest, findOverlappingRequest } from '@/lib/leave-utils'
import { ValidationError } from '@/lib/errors'

const LEAVE_TYPES = [
  'ANNUAL', 'SICK', 'COMPASSIONATE', 'PARENTAL', 'MATERNITY', 'PATERNITY',
  'STUDY', 'CPD_TRAINING', 'UNPAID', 'TOIL', 'BUSINESS_TRAVEL',
  'PUBLIC_HOLIDAY', 'OTHER',
] as const

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

  // BUG-16: Additional filters
  const leaveTypeFilter = url.searchParams.get('leaveType')
  const departmentFilter = url.searchParams.get('department')
  const officeIdFilter = url.searchParams.get('officeId')
  const managerIdFilter = url.searchParams.get('managerId')
  const dateFromFilter = url.searchParams.get('dateFrom')
  const dateToFilter = url.searchParams.get('dateTo')

  let where: Record<string, unknown>

  if (showAll && (profile.orgPermission === 'ADMIN' || profile.orgPermission === 'OWNER')) {
    // Admin/Owner sees all org requests
    where = {
      profile: { organisationId: profile.organisationId },
      startDate: { gte: new Date(`${year}-01-01`) },
    }
  } else if (role === 'approver') {
    // Manager sees requests assigned to them for approval
    // PRD S20: includes SUBMITTED, LINE_MANAGER_APPROVED for multi-stage
    where = {
      approverId: profile.id,
      status: { in: ['SUBMITTED', 'UNDER_REVIEW', 'LINE_MANAGER_APPROVED'] },
    }
  } else {
    // Default: own requests
    where = {
      profileId: profile.id,
      startDate: { gte: new Date(`${year}-01-01`) },
    }
  }

  // Apply additional filters (BUG-16)
  if (leaveTypeFilter) {
    where.leaveType = leaveTypeFilter
  }
  if (dateFromFilter) {
    where.startDate = { ...(where.startDate as Record<string, unknown> ?? {}), gte: new Date(dateFromFilter) }
  }
  if (dateToFilter) {
    where.endDate = { ...(where.endDate as Record<string, unknown> ?? {}), lte: new Date(dateToFilter) }
  }

  // Profile-level filters (department, office, manager) — nest into profile where clause
  const profileFilters: Record<string, unknown> = {}
  if (departmentFilter) profileFilters.department = departmentFilter
  if (officeIdFilter) profileFilters.officeId = officeIdFilter
  if (managerIdFilter) profileFilters.managerId = managerIdFilter

  if (Object.keys(profileFilters).length > 0) {
    const existing = (where.profile as Record<string, unknown>) ?? {}
    where.profile = { ...existing, ...profileFilters }
  }

  const requests = await prisma.leaveRequest.findMany({
    where,
    include: {
      profile: {
        select: {
          id: true, fullName: true, jobTitle: true,
          department: true, officeId: true, managerId: true,
          office: { select: { id: true, name: true } },
        },
      },
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
 * PRD S20: supports all 13 leave types + half-day requests.
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

  // Half-day support (PRD S20)
  const halfDay = body.halfDay === true
  const halfDayPeriod = halfDay ? (body.halfDayPeriod === 'PM' ? 'PM' : 'AM') : null

  // Validate dates and calculate working days
  const { days: workingDays } = validateLeaveRequest(startDate, endDate)

  // Half-day adjusts the count
  const days = halfDay ? 0.5 : workingDays

  // Check for overlapping requests (active ones only)
  const existingRequests = await prisma.leaveRequest.findMany({
    where: {
      profileId: profile.id,
      status: { notIn: ['WITHDRAWN', 'REJECTED', 'CANCELLED'] },
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
      halfDay,
      halfDayPeriod,
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
    metadata: { leaveType, days, halfDay, startDate: startDateStr, endDate: endDateStr },
    ipAddress: request.headers.get('x-forwarded-for') || undefined,
  })

  return success({ leaveRequest }, 201)
})

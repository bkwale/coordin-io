import { NextRequest } from 'next/server'
import { modulesPrisma } from '@/lib/prisma-modules'
import { success } from '@/lib/api-response'
import { withAuth } from '@/lib/with-auth'
import { parseBody } from '@/lib/validation'
import { ValidationError, ConflictError } from '@/lib/errors'

/**
 * GET /api/timesheets — List timesheet weeks.
 *
 * Default: current user's weeks (most recent first).
 * ?role=manager — team timesheets for direct reports.
 * ?status=SUBMITTED — filter by status.
 */
export const GET = withAuth(async (request: NextRequest, { profile }) => {
  const url = new URL(request.url)
  const role = url.searchParams.get('role')
  const statusFilter = url.searchParams.get('status')
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'))
  const pageSize = Math.min(52, Math.max(1, parseInt(url.searchParams.get('pageSize') || '12')))

  let where: Record<string, unknown> = {}

  if (role === 'manager') {
    // Manager view: show timesheets for direct reports
    const isManager = profile.orgPermission === 'ADMIN' || profile.orgPermission === 'OWNER' || profile.orgPermission === 'MANAGER'
    if (!isManager) {
      return success({ weeks: [], total: 0 })
    }

    const reportIds = await modulesPrisma.profile.findMany({
      where: {
        managerId: profile.id,
        organisationId: profile.organisationId,
        status: 'ACTIVE',
      },
      select: { id: true },
    })

    const ids = reportIds.map((r: { id: string }) => r.id)

    // Admins/owners see all org timesheets in manager view
    if (profile.orgPermission === 'ADMIN' || profile.orgPermission === 'OWNER') {
      where = { organisationId: profile.organisationId }
    } else {
      where = { profileId: { in: ids } }
    }
  } else {
    // My timesheets
    where = { profileId: profile.id }
  }

  if (statusFilter) {
    where.status = statusFilter
  }

  const [weeks, total] = await Promise.all([
    modulesPrisma.timesheetWeek.findMany({
      where,
      include: {
        profile: { select: { id: true, fullName: true, jobTitle: true, avatarUrl: true } },
        entries: { select: { id: true, hours: true, isBillable: true, date: true, projectId: true } },
      },
      orderBy: { weekStarting: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    modulesPrisma.timesheetWeek.count({ where }),
  ])

  return success({
    weeks,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  })
})

/**
 * POST /api/timesheets — Create a timesheet week.
 *
 * Body: { weekStarting: "2026-07-27" } (must be a Monday)
 */
export const POST = withAuth(async (request: NextRequest, { profile }) => {
  const body = await parseBody(request)

  const weekStartingRaw = body.weekStarting
  if (!weekStartingRaw || typeof weekStartingRaw !== 'string') {
    throw new ValidationError('weekStarting is required (YYYY-MM-DD format, must be a Monday)')
  }

  const weekStarting = new Date(weekStartingRaw + 'T00:00:00.000Z')
  if (isNaN(weekStarting.getTime())) {
    throw new ValidationError('weekStarting is not a valid date')
  }

  // Verify it's a Monday (getUTCDay: 0=Sun, 1=Mon)
  if (weekStarting.getUTCDay() !== 1) {
    throw new ValidationError('weekStarting must be a Monday')
  }

  // Check for existing week
  const existing = await modulesPrisma.timesheetWeek.findUnique({
    where: {
      profileId_weekStarting: {
        profileId: profile.id,
        weekStarting,
      },
    },
  })

  if (existing) {
    throw new ConflictError('A timesheet already exists for this week')
  }

  const week = await modulesPrisma.timesheetWeek.create({
    data: {
      profileId: profile.id,
      organisationId: profile.organisationId,
      weekStarting,
      status: 'DRAFT',
    },
    include: {
      profile: { select: { id: true, fullName: true } },
      entries: true,
    },
  })

  return success({ week }, 201)
})

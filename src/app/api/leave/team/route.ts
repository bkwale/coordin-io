import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { success } from '@/lib/api-response'
import { withAuth } from '@/lib/with-auth'
import { PermissionError } from '@/lib/errors'

/**
 * GET /api/leave/team — Get team leave for calendar view.
 *
 * Managers see their direct reports' approved/pending leave.
 * Admins see all org leave.
 *
 * Query params:
 *   month: 1-12 (default: current month)
 *   year: YYYY (default: current year)
 */
export const GET = withAuth(async (request: NextRequest, { profile }) => {
  const url = new URL(request.url)
  const now = new Date()
  const month = parseInt(url.searchParams.get('month') || String(now.getMonth() + 1), 10)
  const year = parseInt(url.searchParams.get('year') || String(now.getFullYear()), 10)

  // BUG-16: Additional filters
  const departmentFilter = url.searchParams.get('department')
  const officeIdFilter = url.searchParams.get('officeId')
  const leaveTypeFilter = url.searchParams.get('leaveType')

  const isAdmin = profile.orgPermission === 'ADMIN' || profile.orgPermission === 'OWNER'
  const isHR = profile.orgPermission === 'HR'
  const isManager = profile.orgPermission === 'MANAGER' || isAdmin || isHR

  if (!isManager) {
    throw new PermissionError('Only managers and admins can view team leave')
  }

  // Calculate date range for the requested month
  const startOfMonth = new Date(year, month - 1, 1)
  const endOfMonth = new Date(year, month, 0, 23, 59, 59)

  // Build the where clause
  const where: Record<string, unknown> = {
    startDate: { lte: endOfMonth },
    endDate: { gte: startOfMonth },
    status: {
      in: [
        'SUBMITTED', 'LINE_MANAGER_APPROVED', 'HR_APPROVED',
        'APPROVED', 'UNDER_REVIEW',
      ],
    },
  }

  if (leaveTypeFilter) {
    where.leaveType = leaveTypeFilter
  }

  // Build profile filters
  const profileFilters: Record<string, unknown> = {
    organisationId: profile.organisationId,
  }
  if (!isAdmin && !isHR) {
    profileFilters.managerId = profile.id
  }
  if (departmentFilter) profileFilters.department = departmentFilter
  if (officeIdFilter) profileFilters.officeId = officeIdFilter

  where.profile = profileFilters

  const teamLeave = await prisma.leaveRequest.findMany({
    where,
    include: {
      profile: {
        select: {
          id: true,
          fullName: true,
          jobTitle: true,
          avatarUrl: true,
          department: true,
          officeId: true,
          office: { select: { id: true, name: true } },
        },
      },
    },
    orderBy: { startDate: 'asc' },
  })

  // Also return the team member list for the calendar
  const teamMembersWhere: Record<string, unknown> = {
    organisationId: profile.organisationId,
    status: 'ACTIVE' as const,
  }
  if (!isAdmin && !isHR) {
    teamMembersWhere.managerId = profile.id
  }
  if (departmentFilter) teamMembersWhere.department = departmentFilter
  if (officeIdFilter) teamMembersWhere.officeId = officeIdFilter

  const teamMembers = await prisma.profile.findMany({
    where: teamMembersWhere,
    select: {
      id: true,
      fullName: true,
      jobTitle: true,
      avatarUrl: true,
      department: true,
    },
    orderBy: { fullName: 'asc' },
  })

  // Return public holidays for the month
  const holidays = await prisma.publicHoliday.findMany({
    where: {
      organisationId: profile.organisationId,
      date: { gte: startOfMonth, lte: endOfMonth },
    },
    include: {
      office: { select: { id: true, name: true } },
    },
    orderBy: { date: 'asc' },
  })

  return success({
    teamLeave,
    teamMembers,
    holidays,
    month,
    year,
  })
})

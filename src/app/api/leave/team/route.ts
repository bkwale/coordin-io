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

  const isAdmin = profile.orgPermission === 'ADMIN' || profile.orgPermission === 'OWNER'
  const isManager = profile.orgPermission === 'MANAGER' || isAdmin

  if (!isManager) {
    throw new PermissionError('Only managers and admins can view team leave')
  }

  // Calculate date range for the requested month
  const startOfMonth = new Date(year, month - 1, 1)
  const endOfMonth = new Date(year, month, 0, 23, 59, 59)

  // Build the where clause
  const where: Record<string, unknown> = {
    // Leave that overlaps with the requested month
    startDate: { lte: endOfMonth },
    endDate: { gte: startOfMonth },
    // Only show approved, pending, or in-progress leave
    status: {
      in: [
        'SUBMITTED', 'LINE_MANAGER_APPROVED', 'HR_APPROVED',
        'APPROVED', 'UNDER_REVIEW',
      ],
    },
  }

  if (isAdmin) {
    // Admin sees all org leave
    where.profile = { organisationId: profile.organisationId }
  } else {
    // Manager sees their direct reports' leave
    where.profile = {
      managerId: profile.id,
      organisationId: profile.organisationId,
    }
  }

  const teamLeave = await prisma.leaveRequest.findMany({
    where,
    include: {
      profile: {
        select: {
          id: true,
          fullName: true,
          jobTitle: true,
          avatarUrl: true,
        },
      },
    },
    orderBy: { startDate: 'asc' },
  })

  // Also return the team member list for the calendar
  const teamMembersWhere = isAdmin
    ? { organisationId: profile.organisationId, status: 'ACTIVE' as const }
    : { managerId: profile.id, organisationId: profile.organisationId, status: 'ACTIVE' as const }

  const teamMembers = await prisma.profile.findMany({
    where: teamMembersWhere,
    select: {
      id: true,
      fullName: true,
      jobTitle: true,
      avatarUrl: true,
    },
    orderBy: { fullName: 'asc' },
  })

  return success({
    teamLeave,
    teamMembers,
    month,
    year,
  })
})

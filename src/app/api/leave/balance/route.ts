import { prisma } from '@/lib/prisma'
import { success } from '@/lib/api-response'
import { withAuth } from '@/lib/with-auth'
import { calculateLeaveBalance } from '@/lib/leave-utils'

/**
 * GET /api/leave/balance — Get current user's leave balance for this year.
 *
 * Returns allocation, used, carried forward, pending days, and available balance.
 * If no balance record exists for the current year, returns defaults from EmployeeProfile.
 */
export const GET = withAuth(async (_request, { profile }) => {
  const year = new Date().getFullYear()

  // Get or default the balance record
  const balance = await prisma.leaveBalance.findUnique({
    where: {
      profileId_year: {
        profileId: profile.id,
        year,
      },
    },
  })

  // Get allocation from employee profile (default 25)
  const employeeProfile = await prisma.employeeProfile.findUnique({
    where: { profileId: profile.id },
    select: { annualLeaveAllocation: true },
  })

  const allocation = balance?.allocation ?? employeeProfile?.annualLeaveAllocation ?? 25
  const used = balance?.used ?? 0
  const carriedForward = balance?.carriedForward ?? 0

  // Count pending days (SUBMITTED or UNDER_REVIEW leave requests for ANNUAL type)
  const pendingRequests = await prisma.leaveRequest.findMany({
    where: {
      profileId: profile.id,
      leaveType: 'ANNUAL',
      status: { in: ['SUBMITTED', 'UNDER_REVIEW'] },
      startDate: {
        gte: new Date(`${year}-01-01`),
      },
      endDate: {
        lte: new Date(`${year}-12-31`),
      },
    },
    select: { days: true },
  })

  const pendingDays = pendingRequests.reduce((sum, r) => sum + r.days, 0)

  const summary = calculateLeaveBalance(allocation, used, carriedForward, pendingDays)

  return success({
    year,
    ...summary,
  })
})

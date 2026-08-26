import type { NextRequest } from 'next/server'
import { modulesPrisma } from '@/lib/prisma-modules'
import { success } from '@/lib/api-response'
import { withAuth } from '@/lib/with-auth'
import { requireString, optionalString, parseBody } from '@/lib/validation'
import { PermissionError, ValidationError } from '@/lib/errors'

/**
 * GET /api/blackout-dates — List blackout dates for the organisation.
 *
 * Query params:
 *   year: YYYY (default: current year) — filters to blackout dates overlapping that year
 */
export const GET = withAuth(async (request: NextRequest, { profile }) => {
  const url = new URL(request.url)
  const year = parseInt(url.searchParams.get('year') || String(new Date().getFullYear()), 10)

  const startOfYear = new Date(year, 0, 1)
  const endOfYear = new Date(year, 11, 31, 23, 59, 59)

  const blackoutDates = await modulesPrisma.blackoutDate.findMany({
    where: {
      organisationId: profile.organisationId,
      startDate: { lte: endOfYear },
      endDate: { gte: startOfYear },
    },
    include: {
      createdBy: { select: { id: true, fullName: true } },
    },
    orderBy: { startDate: 'asc' },
  })

  return success({ blackoutDates, year })
})

/**
 * POST /api/blackout-dates — Create a blackout date.
 * Requires ADMIN, OWNER, or HR.
 */
export const POST = withAuth(async (request: NextRequest, { profile }) => {
  if (!['ADMIN', 'OWNER', 'HR'].includes(profile.orgPermission)) {
    throw new PermissionError('Only administrators or HR can manage blackout dates')
  }

  const body = await parseBody(request)

  const name = requireString(body.name, 'Name', 200)
  const startDateStr = requireString(body.startDate, 'Start date', 20)
  const endDateStr = requireString(body.endDate, 'End date', 20)
  const reason = optionalString(body.reason, 'Reason', 500) ?? null

  const startDate = new Date(startDateStr)
  const endDate = new Date(endDateStr)

  if (isNaN(startDate.getTime())) throw new ValidationError('Invalid start date')
  if (isNaN(endDate.getTime())) throw new ValidationError('Invalid end date')
  if (endDate < startDate) throw new ValidationError('End date must be on or after start date')

  const blackoutDate = await modulesPrisma.blackoutDate.create({
    data: {
      organisationId: profile.organisationId,
      name,
      startDate,
      endDate,
      reason,
      createdById: profile.id,
    },
    include: {
      createdBy: { select: { id: true, fullName: true } },
    },
  })

  return success({ blackoutDate }, 201)
})

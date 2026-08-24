import type { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { success } from '@/lib/api-response'
import { withAuth } from '@/lib/with-auth'
import { requireString, optionalString, parseBody } from '@/lib/validation'
import { PermissionError, ValidationError } from '@/lib/errors'

/**
 * GET /api/public-holidays — List public holidays for the organisation.
 *
 * Query params:
 *   year: YYYY (default: current year)
 *   officeId: filter by office
 */
export const GET = withAuth(async (request: NextRequest, { profile }) => {
  const url = new URL(request.url)
  const year = parseInt(url.searchParams.get('year') || String(new Date().getFullYear()), 10)
  const officeIdFilter = url.searchParams.get('officeId')

  const startOfYear = new Date(year, 0, 1)
  const endOfYear = new Date(year, 11, 31, 23, 59, 59)

  const where = officeIdFilter
    ? {
        AND: [
          { organisationId: profile.organisationId },
          { date: { gte: startOfYear, lte: endOfYear } },
          { OR: [{ officeId: officeIdFilter }, { officeId: null }] },
        ],
      }
    : {
        organisationId: profile.organisationId,
        date: { gte: startOfYear, lte: endOfYear },
      }

  const holidays = await prisma.publicHoliday.findMany({
    where,
    include: {
      office: { select: { id: true, name: true } },
    },
    orderBy: { date: 'asc' },
  })

  return success({ holidays, year })
})

/**
 * POST /api/public-holidays — Create a public holiday.
 * Requires ADMIN, OWNER, or HR.
 */
export const POST = withAuth(async (request: NextRequest, { profile }) => {
  if (!['ADMIN', 'OWNER', 'HR'].includes(profile.orgPermission)) {
    throw new PermissionError('Only administrators or HR can manage public holidays')
  }

  const body = await parseBody(request)

  const name = requireString(body.name, 'Name', 200)
  const dateStr = requireString(body.date, 'Date', 20)
  const date = new Date(dateStr)
  if (isNaN(date.getTime())) throw new ValidationError('Invalid date')

  const country = optionalString(body.country, 'Country', 10) ?? 'GB'
  const officeId = optionalString(body.officeId, 'Office ID', 50) ?? null
  const isRecurring = body.isRecurring === true

  // If officeId provided, verify it belongs to the org
  if (officeId) {
    const office = await prisma.office.findFirst({
      where: { id: officeId, organisationId: profile.organisationId },
    })
    if (!office) throw new Error('Office not found')
  }

  const holiday = await prisma.publicHoliday.create({
    data: {
      organisationId: profile.organisationId,
      officeId,
      name,
      date,
      isRecurring,
      country,
    },
    include: {
      office: { select: { id: true, name: true } },
    },
  })

  return success({ holiday }, 201)
})

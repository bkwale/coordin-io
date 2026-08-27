import type { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { success } from '@/lib/api-response'
import { withAuth } from '@/lib/with-auth'
import { optionalString, parseBody } from '@/lib/validation'
import { NotFoundError, PermissionError, ValidationError } from '@/lib/errors'

function extractId(url: string): string {
  const id = url.match(/\/public-holidays\/([^/?]+)/)?.[1]
  if (!id) throw new NotFoundError('Holiday ID is required')
  return id
}

/**
 * PATCH /api/public-holidays/[id] — Update a public holiday.
 * Requires ADMIN, OWNER, or HR.
 */
export const PATCH = withAuth(async (request: NextRequest, { profile }) => {
  if (!['ADMIN', 'OWNER', 'HR'].includes(profile.orgPermission)) {
    throw new PermissionError('Only administrators or HR can manage public holidays')
  }

  const id = extractId(request.url)
  const body = await parseBody(request)

  const existing = await prisma.publicHoliday.findFirst({
    where: { id, organisationId: profile.organisationId },
  })
  if (!existing) throw new NotFoundError('Public holiday not found')

  const data: Record<string, unknown> = {}

  if ('name' in body) data.name = optionalString(body.name, 'Name', 200) ?? existing.name
  if ('date' in body) {
    const d = new Date(body.date as string)
    if (isNaN(d.getTime())) throw new ValidationError('Invalid date')
    data.date = d
  }
  if ('country' in body) data.country = optionalString(body.country, 'Country', 10) ?? existing.country
  if ('isRecurring' in body) data.isRecurring = body.isRecurring === true
  if ('type' in body) {
    const validTypes = ['PUBLIC_HOLIDAY', 'BLACKOUT_DATE', 'COMPANY_CLOSURE']
    if (typeof body.type === 'string' && validTypes.includes(body.type)) {
      data.type = body.type
    }
  }
  if ('officeId' in body) {
    const newOfficeId = body.officeId as string | null
    if (newOfficeId) {
      const office = await prisma.office.findFirst({
        where: { id: newOfficeId, organisationId: profile.organisationId },
      })
      if (!office) throw new Error('Office not found')
    }
    data.officeId = newOfficeId
  }

  const holiday = await prisma.publicHoliday.update({
    where: { id },
    data,
    include: {
      office: { select: { id: true, name: true } },
    },
  })

  return success({ holiday })
})

/**
 * DELETE /api/public-holidays/[id] — Delete a public holiday.
 * Requires ADMIN, OWNER, or HR.
 */
export const DELETE = withAuth(async (request: NextRequest, { profile }) => {
  if (!['ADMIN', 'OWNER', 'HR'].includes(profile.orgPermission)) {
    throw new PermissionError('Only administrators or HR can manage public holidays')
  }

  const id = extractId(request.url)

  const existing = await prisma.publicHoliday.findFirst({
    where: { id, organisationId: profile.organisationId },
  })
  if (!existing) throw new NotFoundError('Public holiday not found')

  await prisma.publicHoliday.delete({ where: { id } })

  return success({ deleted: true })
})

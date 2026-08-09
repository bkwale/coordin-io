import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/with-auth'
import { prisma } from '@/lib/prisma'
import { ValidationError, PermissionError, NotFoundError } from '@/lib/errors'
import { canPerform } from '@/lib/role-permissions'
import { parseBody, requireString, optionalString } from '@/lib/validation'

/** GET /api/settings/offices — List offices for the org */
export const GET = withAuth(async (_request: NextRequest, { profile }) => {
  const offices = await prisma.office.findMany({
    where: { organisationId: profile.organisationId },
    orderBy: [{ isHeadOffice: 'desc' }, { name: 'asc' }],
    select: {
      id: true,
      name: true,
      city: true,
      country: true,
      isHeadOffice: true,
      _count: { select: { profiles: true } },
    },
  })

  return NextResponse.json({
    offices: offices.map((o: { id: string; name: string; city: string; country: string; isHeadOffice: boolean; _count: { profiles: number } }) => ({
      id: o.id,
      name: o.name,
      city: o.city,
      country: o.country,
      isHeadOffice: o.isHeadOffice,
      memberCount: o._count.profiles,
    })),
  })
})

/** POST /api/settings/offices — Create a new office */
export const POST = withAuth(async (request: NextRequest, { profile }) => {
  if (!canPerform(profile.orgPermission, 'settings', 'edit_org_settings')) {
    throw new PermissionError('Only the Practice Principal can manage offices')
  }

  const body = await parseBody(request)
  const name = requireString(body.name, 'Office name', 200)
  const city = requireString(body.city, 'City', 200)
  const country = optionalString(body.country, 'Country', 200) || 'NG'
  const isHeadOffice = body.isHeadOffice === true

  // If setting as head office, unset any existing head office
  if (isHeadOffice) {
    await prisma.office.updateMany({
      where: { organisationId: profile.organisationId, isHeadOffice: true },
      data: { isHeadOffice: false },
    })
  }

  const office = await prisma.office.create({
    data: {
      organisationId: profile.organisationId,
      name,
      city,
      country,
      isHeadOffice,
    },
  })

  return NextResponse.json({ office }, { status: 201 })
})

/** PATCH /api/settings/offices — Update an existing office */
export const PATCH = withAuth(async (request: NextRequest, { profile }) => {
  if (!canPerform(profile.orgPermission, 'settings', 'edit_org_settings')) {
    throw new PermissionError('Only the Practice Principal can manage offices')
  }

  const body = await parseBody(request)
  const officeId = requireString(body.id, 'Office ID', 100)

  const existing = await prisma.office.findFirst({
    where: { id: officeId, organisationId: profile.organisationId },
  })
  if (!existing) {
    throw new NotFoundError('Office not found')
  }

  const data: Record<string, unknown> = {}
  if ('name' in body) data.name = requireString(body.name, 'Office name', 200)
  if ('city' in body) data.city = requireString(body.city, 'City', 200)
  if ('country' in body) data.country = optionalString(body.country, 'Country', 200)

  // Handle head office toggle
  if ('isHeadOffice' in body && body.isHeadOffice === true) {
    // Unset any existing head office first
    await prisma.office.updateMany({
      where: { organisationId: profile.organisationId, isHeadOffice: true },
      data: { isHeadOffice: false },
    })
    data.isHeadOffice = true
  } else if ('isHeadOffice' in body && body.isHeadOffice === false) {
    data.isHeadOffice = false
  }

  const updated = await prisma.office.update({
    where: { id: officeId },
    data,
  })

  return NextResponse.json({ office: updated })
})

/** DELETE /api/settings/offices — Delete an office (only if no members assigned) */
export const DELETE = withAuth(async (request: NextRequest, { profile }) => {
  if (!canPerform(profile.orgPermission, 'settings', 'edit_org_settings')) {
    throw new PermissionError('Only the Practice Principal can manage offices')
  }

  const body = await parseBody(request)
  const officeId = requireString(body.id, 'Office ID', 100)

  const existing = await prisma.office.findFirst({
    where: { id: officeId, organisationId: profile.organisationId },
    include: { _count: { select: { profiles: true } } },
  })
  if (!existing) {
    throw new NotFoundError('Office not found')
  }

  if (existing._count.profiles > 0) {
    throw new ValidationError(`Cannot delete office with ${existing._count.profiles} assigned member(s). Reassign them first.`)
  }

  await prisma.office.delete({ where: { id: officeId } })

  return NextResponse.json({ deleted: true })
})

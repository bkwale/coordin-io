import { NextRequest, NextResponse } from 'next/server'
import { orgCountry, countryCode } from '@/lib/region'
import { withAuth } from '@/lib/with-auth'
import { prisma } from '@/lib/prisma'
import { ValidationError, PermissionError } from '@/lib/errors'
import { canPerform } from '@/lib/role-permissions'

/** GET /api/settings/organisation — Get current user's organisation details */
export const GET = withAuth(async (_request: NextRequest, { profile }) => {
  if (!canPerform(profile.orgPermission, 'settings', 'view_org_settings')) {
    throw new PermissionError('Only Project Leads and above can view organisation settings')
  }
  const org = await prisma.organisation.findUnique({
    where: { id: profile.organisationId },
    include: {
      offices: { orderBy: { name: 'asc' } },
    },
  })

  if (!org) {
    return NextResponse.json({ error: 'Organisation not found' }, { status: 404 })
  }

  return NextResponse.json({
    id: org.id,
    name: org.name,
    slug: org.slug,
    logoUrl: org.logoUrl,
    defaultCurrency: org.defaultCurrency,
    currencies: org.currencies,
    country: orgCountry(org),
    offices: org.offices.map((o: any) => ({
      id: o.id,
      name: o.name,
      city: o.city,
      country: o.country,
      isHeadOffice: o.isHeadOffice,
    })),
    createdAt: org.createdAt,
  })
})

/** PATCH /api/settings/organisation — Update organisation details */
export const PATCH = withAuth(
  async (request: NextRequest, { profile }) => {
    if (!canPerform(profile.orgPermission, 'settings', 'edit_org_settings')) {
      throw new PermissionError('Only the Practice Principal can edit organisation settings')
    }

    const body = await request.json()
    const { name, logoUrl, defaultCurrency, currencies } = body
    const country = body.country === undefined ? undefined : countryCode(typeof body.country === 'string' ? body.country : null)
    if (body.country !== undefined && body.country !== null && body.country !== '' && !country) throw new ValidationError('Country must be Estonia, United Kingdom or Nigeria')

    if (name !== undefined && (typeof name !== 'string' || name.trim().length === 0)) {
      throw new ValidationError('Organisation name is required')
    }

    if (name !== undefined && name.length > 200) {
      throw new ValidationError('Organisation name must be under 200 characters')
    }

    const validCurrencies = ['NGN', 'GBP', 'USD', 'EUR']

    if (defaultCurrency !== undefined && !validCurrencies.includes(defaultCurrency)) {
      throw new ValidationError(`Currency must be one of: ${validCurrencies.join(', ')}`)
    }

    if (currencies !== undefined) {
      if (!Array.isArray(currencies) || currencies.some((c: string) => !validCurrencies.includes(c))) {
        throw new ValidationError(`Currencies must be an array of: ${validCurrencies.join(', ')}`)
      }
    }

    const updateData: Record<string, unknown> = {}
    if (name !== undefined) updateData.name = name.trim()
    if (logoUrl !== undefined) updateData.logoUrl = logoUrl
    if (defaultCurrency !== undefined) updateData.defaultCurrency = defaultCurrency
    if (currencies !== undefined) updateData.currencies = currencies
    if (body.country !== undefined) {
      // The firm's country drives defaults (questionnaire, VAT, stages). Merged into settings — nothing else there changes.
      const current = await prisma.organisation.findUnique({ where: { id: profile.organisationId }, select: { settings: true } })
      const prev = (current?.settings && typeof current.settings === 'object' ? current.settings : {}) as Record<string, unknown>
      updateData.settings = { ...prev, country: country ?? null }
    }

    const updated = await prisma.organisation.update({
      where: { id: profile.organisationId },
      data: updateData,
    })

    return NextResponse.json({
      id: updated.id,
      name: updated.name,
      slug: updated.slug,
      logoUrl: updated.logoUrl,
      defaultCurrency: updated.defaultCurrency,
      currencies: updated.currencies,
      country: countryCode((updated.settings as { country?: string } | null)?.country ?? null),
    })
  },
)

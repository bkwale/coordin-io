import type { NextRequest } from 'next/server'
import { withAuth } from '@/lib/with-auth'
import { prisma } from '@/lib/prisma'
import { success } from '@/lib/api-response'
import { orgCountry, COUNTRIES, firmCurrency } from '@/lib/region'

export const dynamic = 'force-dynamic'

/** GET /api/org/region — the firm's country defaults (currency, VAT, time zone, rule set). Any signed-in member. */
export const GET = withAuth(async (_request: NextRequest, { profile }) => {
  const org = await prisma.organisation.findUnique({
    where: { id: profile.organisationId },
    select: { settings: true, defaultCurrency: true, offices: { select: { country: true, isHeadOffice: true } } },
  })
  const country = orgCountry(org)
  const p = country ? COUNTRIES[country] : null
  return success({
    country,
    currency: firmCurrency(org, country),
    vatRate: p?.vatRate ?? null,
    timezone: p?.timezone ?? null,
    jurisdiction: p?.jurisdiction ?? null,
    stageFramework: p?.stageFramework ?? null,
  })
})

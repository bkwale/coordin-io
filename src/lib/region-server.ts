/** Country defaults that need the database. Pure rules live in ./region. */
import { prisma } from '@/lib/prisma'
import { orgCountry, resolveCurrency, firmCurrency, vatRateFor, COUNTRIES, type CountryCode, type CurrencyCode } from '@/lib/region'

export async function firmDefaults(organisationId: string): Promise<{ country: CountryCode | null; currency: CurrencyCode; vatRate: number | null }> {
  const org = await prisma.organisation.findUnique({ where: { id: organisationId }, select: { settings: true, defaultCurrency: true, offices: { select: { country: true, isHeadOffice: true } } } })
  const country = orgCountry(org)
  return { country, currency: firmCurrency(org, country), vatRate: vatRateFor(country) }
}

/** Currency for a new commercial record on a project: the project's, else the firm's. */
export async function projectCurrency(projectId: string): Promise<CurrencyCode> {
  const p = await prisma.project.findUnique({ where: { id: projectId }, select: { currency: true, organisationId: true } })
  if (p?.currency) return resolveCurrency(p.currency)
  return p ? (await firmDefaults(p.organisationId)).currency : 'EUR'
}

/** The firm's time zone for deadlines: Settings → Regional, else its country, else the server default. */
export async function firmTimezone(organisationId: string): Promise<string> {
  try {
    const org = await prisma.organisation.findUnique({ where: { id: organisationId }, select: { settings: true, defaultCurrency: true, offices: { select: { country: true, isHeadOffice: true } } } })
    const s = (org?.settings && typeof org.settings === 'object' ? org.settings : {}) as { regional?: { timezone?: string } }
    if (s.regional?.timezone) return s.regional.timezone
    const c = orgCountry(org)
    if (c) return COUNTRIES[c].timezone
  } catch { /* fall through */ }
  return process.env.ORG_TIMEZONE || 'Europe/London'
}

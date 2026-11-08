/** Country defaults that need the database. Pure rules live in ./region. */
import { prisma } from '@/lib/prisma'
import { orgCountry, resolveCurrency, currencyForCountry, vatRateFor, type CountryCode, type CurrencyCode } from '@/lib/region'

export async function firmDefaults(organisationId: string): Promise<{ country: CountryCode | null; currency: CurrencyCode; vatRate: number | null }> {
  const org = await prisma.organisation.findUnique({ where: { id: organisationId }, select: { settings: true, defaultCurrency: true, offices: { select: { country: true, isHeadOffice: true } } } })
  const country = orgCountry(org)
  return { country, currency: resolveCurrency(org?.defaultCurrency, currencyForCountry(country)), vatRate: vatRateFor(country) }
}

/** Currency for a new commercial record on a project: the project's, else the firm's. */
export async function projectCurrency(projectId: string): Promise<CurrencyCode> {
  const p = await prisma.project.findUnique({ where: { id: projectId }, select: { currency: true, organisationId: true } })
  if (p?.currency) return resolveCurrency(p.currency)
  return p ? (await firmDefaults(p.organisationId)).currency : 'EUR'
}

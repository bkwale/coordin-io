/**
 * UK Companies House public API. Needs COMPANIES_HOUSE_API_KEY (free; register at developer.company-information.service.gov.uk).
 * Officers endpoint returns names and roles; no personal identifiers are stored.
 */
import type { CompanyFacts, CompanySearchHit } from './types'

const BASE = 'https://api.company-information.service.gov.uk'
function auth() {
  const key = process.env.COMPANIES_HOUSE_API_KEY
  if (!key) throw new Error('Companies House lookup is not configured (COMPANIES_HOUSE_API_KEY)')
  return { Authorization: 'Basic ' + Buffer.from(`${key}:`).toString('base64'), Accept: 'application/json' }
}

export async function searchCompaniesHouse(q: string): Promise<CompanySearchHit[]> {
  const res = await fetch(`${BASE}/search/companies?q=${encodeURIComponent(q)}&items_per_page=10`, { headers: auth(), signal: AbortSignal.timeout(10_000) })
  if (!res.ok) throw new Error(`Companies House search failed (${res.status})`)
  const body = (await res.json()) as { items?: Array<{ company_number: string; title: string; company_status: string; address_snippet?: string }> }
  return (body.items ?? []).map((i) => ({ jurisdiction: 'GB', registryCode: i.company_number, name: i.title, address: i.address_snippet ?? null, status: i.company_status }))
}

export async function getCompaniesHouseCompany(number: string): Promise<CompanyFacts | null> {
  const n = number.toUpperCase().trim()
  if (!/^[A-Z0-9]{8}$/.test(n)) throw new Error('UK company number is 8 characters')
  const [cRes, oRes] = await Promise.all([
    fetch(`${BASE}/company/${n}`, { headers: auth(), signal: AbortSignal.timeout(10_000) }),
    fetch(`${BASE}/company/${n}/officers?items_per_page=20`, { headers: auth(), signal: AbortSignal.timeout(10_000) }),
  ])
  if (cRes.status === 404) return null
  if (!cRes.ok) throw new Error(`Companies House lookup failed (${cRes.status})`)
  const c = (await cRes.json()) as any
  const o = oRes.ok ? ((await oRes.json()) as any) : { items: [] }
  const sic: string | undefined = c.sic_codes?.[0]
  const addr = c.registered_office_address ?? {}
  const address = [addr.address_line_1, addr.address_line_2, addr.locality, addr.postal_code].filter(Boolean).join(', ') || null
  return {
    jurisdiction: 'GB', registryCode: c.company_number, legalName: c.company_name,
    historicalNames: (c.previous_company_names ?? []).map((p: any) => p.name),
    status: c.company_status === 'active' ? 'active' : /dissolved/.test(c.company_status) ? 'dissolved' : /liquidation/.test(c.company_status) ? 'liquidation' : 'other',
    statusRaw: c.company_status, legalForm: c.type ?? null, registeredAt: c.date_of_creation ?? null,
    address, city: addr.locality ?? null, postcode: addr.postal_code ?? null,
    activity: sic ? { code: sic, label: SIC_LABELS[sic] ?? '', scheme: 'SIC' } : null,
    isArchitecturePractice: !!sic && sic.startsWith('7111'),
    board: (o.items ?? []).filter((x: any) => !x.resigned_on && /director|member|partner/i.test(x.officer_role ?? '')).map((x: any) => x.name).slice(0, 10),
    capital: null, sourceUrl: `https://find-and-update.company-information.service.gov.uk/company/${c.company_number}`, fetchedAt: new Date().toISOString(),
  }
}

const SIC_LABELS: Record<string, string> = { '71111': 'Architectural activities', '71112': 'Urban planning and landscape architectural activities', '71121': 'Engineering design activities for industrial process and production', '71122': 'Engineering related scientific and technical consulting activities', '74100': 'Specialised design activities' }

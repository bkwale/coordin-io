/**
 * Country defaults in one place. Coordin serves practices in Estonia, the UK and Nigeria (CWA);
 * everything that differs by country — currency, VAT, time zone, rule set, stage framework,
 * address wording, bank format — is read from here, never hard-coded in a page.
 * Client-safe: no database access.
 */

export type CountryCode = 'EE' | 'GB' | 'NG'
export type RuleJurisdiction = 'EE' | 'GB'
export type CurrencyCode = 'EUR' | 'GBP' | 'NGN' | 'USD'
export type StageFramework = 'EVS_932' | 'RIBA' | 'NIGERIAN_CWA' | 'INTERNATIONAL' | 'DESIGN_BUILD' | 'CUSTOM'
export type BankFormat = 'iban' | 'uk_sort_code' | 'nuban'

export interface CountryProfile {
  code: CountryCode
  name: string
  currency: CurrencyCode
  /** Standard VAT rate, percent. EE 24% from 1 July 2025; GB 20%; NG 7.5%. */
  vatRate: number
  timezone: string
  /** Rule set on the Regulatory page, or null where Coordin has none yet. */
  jurisdiction: RuleJurisdiction | null
  stageFramework: StageFramework
  bankFormat: BankFormat
  phonePrefix: string
  regionLabel: string
  placeholders: { region: string; city: string; postcode: string; planningAuthority: string; buildingControl: string; address: string }
  /** Hint under the planning-authority field. */
  planningHint: string
}

export const COUNTRIES: Record<CountryCode, CountryProfile> = {
  EE: {
    code: 'EE', name: 'Estonia', currency: 'EUR', vatRate: 24, timezone: 'Europe/Tallinn', jurisdiction: 'EE', stageFramework: 'EVS_932', bankFormat: 'iban', phonePrefix: '+372',
    regionLabel: 'County (maakond)',
    placeholders: { region: 'e.g. Harju maakond', city: 'e.g. Tallinn', postcode: 'e.g. 10111', planningAuthority: 'e.g. Tallinna Linnaplaneerimise Amet', buildingControl: 'e.g. Tallinna Linnaplaneerimise Amet (ehitusluba)', address: 'e.g. Narva mnt 5, Tallinn' },
    planningHint: 'The local government that issues planning conditions and the building permit',
  },
  GB: {
    code: 'GB', name: 'United Kingdom', currency: 'GBP', vatRate: 20, timezone: 'Europe/London', jurisdiction: 'GB', stageFramework: 'RIBA', bankFormat: 'uk_sort_code', phonePrefix: '+44',
    regionLabel: 'County',
    placeholders: { region: 'e.g. Greater Manchester', city: 'e.g. Manchester', postcode: 'e.g. M1 1AE', planningAuthority: 'e.g. Manchester City Council', buildingControl: 'e.g. Registered building control approver or local authority', address: 'e.g. 12 Ancoats Yard, Manchester' },
    planningHint: 'UK local planning authority for this site',
  },
  NG: {
    code: 'NG', name: 'Nigeria', currency: 'NGN', vatRate: 7.5, timezone: 'Africa/Lagos', jurisdiction: null, stageFramework: 'NIGERIAN_CWA', bankFormat: 'nuban', phonePrefix: '+234',
    regionLabel: 'State',
    placeholders: { region: 'e.g. Lagos State', city: 'e.g. Lagos', postcode: 'e.g. 101233', planningAuthority: 'e.g. Lagos State Physical Planning Permit Authority', buildingControl: 'e.g. LASBCA', address: 'e.g. 5 Admiralty Way, Lekki' },
    planningHint: 'Nigerian state planning authority or FCT equivalent',
  },
}

/** Order shown in country pickers. */
export const COUNTRY_OPTIONS: CountryCode[] = ['EE', 'GB', 'NG']

/** Any stored country text ("Estonia", "EE", "England", "United Kingdom", "Nigeria", "NG") → code, or null. */
export function countryCode(v: string | null | undefined): CountryCode | null {
  const t = (v ?? '').trim().toLowerCase()
  if (!t) return null
  if (t === 'ee' || t.startsWith('eston') || t === 'eesti') return 'EE'
  if (t === 'gb' || t === 'uk' || t.startsWith('england') || t.startsWith('united kingdom') || t.startsWith('great britain')) return 'GB'
  if (t === 'ng' || t.startsWith('nigeria')) return 'NG'
  return null
}

export function countryProfile(v: string | null | undefined): CountryProfile | null {
  const c = countryCode(v)
  return c ? COUNTRIES[c] : null
}

const CURRENCY_COUNTRY: Partial<Record<string, CountryCode>> = { NGN: 'NG', GBP: 'GB' }

/**
 * The firm's home country: an explicit settings.country, a sandbox region, the head office, then its currency.
 * EUR alone is not enough to say Estonia — returns null rather than guess.
 */
export function orgCountry(org: { settings?: unknown; defaultCurrency?: string | null; offices?: Array<{ country?: string | null; isHeadOffice?: boolean | null }> | null } | null | undefined): CountryCode | null {
  if (!org) return null
  const s = (org.settings && typeof org.settings === 'object' ? org.settings : {}) as Record<string, unknown>
  const explicit = countryCode(typeof s.country === 'string' ? s.country : null)
  if (explicit) return explicit
  const sb = s.sandbox as { region?: string; convertedAt?: string | null } | undefined
  const fromSandbox = sb && !sb.convertedAt ? countryCode(sb.region) : null
  if (fromSandbox) return fromSandbox
  const offices = org.offices ?? []
  const head = offices.find((o) => o.isHeadOffice) ?? offices[0]
  const fromOffice = countryCode(head?.country)
  if (fromOffice) return fromOffice
  return CURRENCY_COUNTRY[org.defaultCurrency ?? ''] ?? null
}

/**
 * Which rule set a project's questionnaire opens on. Both stay selectable — this only picks the start.
 * Order: the project's own jurisdiction/country → the firm's country.
 */
export function defaultJurisdiction(input: { projectJurisdiction?: string | null; siteCountry?: string | null; orgCountry?: CountryCode | null }): RuleJurisdiction | null {
  for (const v of [input.projectJurisdiction, input.siteCountry]) {
    const c = countryCode(v)
    if (c) return COUNTRIES[c].jurisdiction
  }
  return input.orgCountry ? COUNTRIES[input.orgCountry].jurisdiction : null
}

/** Currency for a new record: what was sent → the project's → the firm's → by firm country → EUR. */
export function resolveCurrency(...candidates: Array<string | null | undefined>): CurrencyCode {
  for (const c of candidates) if (c === 'EUR' || c === 'GBP' || c === 'NGN' || c === 'USD') return c
  return 'EUR'
}

/**
 * The firm's currency. organisations.default_currency is NOT NULL with an old NGN default, so a stored NGN on a
 * non-Nigerian firm is treated as "never chosen" and the country's currency wins.
 */
export function firmCurrency(org: { defaultCurrency?: string | null } | null | undefined, country: CountryCode | null | undefined): CurrencyCode {
  if (org?.defaultCurrency === 'NGN' && country && country !== 'NG') return COUNTRIES[country].currency
  return resolveCurrency(org?.defaultCurrency, country ? COUNTRIES[country].currency : null)
}

/** Standard VAT rate for a firm/country; null = unknown (caller asks the user). */
export function vatRateFor(country: CountryCode | null | undefined): number | null {
  return country ? COUNTRIES[country].vatRate : null
}

/** Default currency when a firm is created for a country. */
export function currencyForCountry(country: CountryCode | null | undefined): CurrencyCode | null {
  return country ? COUNTRIES[country].currency : null
}

/* ── Planning / permits wording by country ─────────────────── */

export interface PlanningProfile {
  /** Page title. */
  title: string
  /** Suggested application types (the field stays free text). */
  applicationTypes: string[]
  placeholders: { authority: string; type: string; reference: string; portal: string; consultant: string; trigger: string; submission: string }
  /** Country wording for the shared status list; anything not listed keeps the default label. */
  statusLabels: Partial<Record<string, string>>
  conditionTypeLabels: Partial<Record<string, string>>
  /** What the document the AI reads is called here, or null if Coordin has no reader for this country. */
  sourceDocument: string | null
}

const GB_PLANNING: PlanningProfile = {
  title: 'Planning Applications',
  applicationTypes: ['Full planning', 'Outline planning', 'Reserved matters', 'Householder', 'Listed building consent', 'Prior approval', 'Lawful development certificate', 'Discharge of conditions', 'Variation of condition (s73)', 'Non-material amendment (s96A)'],
  placeholders: { authority: 'e.g. London Borough of Camden', type: 'e.g. Full planning, Listed building consent', reference: 'e.g. 2026/1234/FUL', portal: 'https://planning.authority.gov.uk/...', consultant: 'e.g. Smith Planning Ltd', trigger: 'e.g. Before superstructure', submission: 'e.g. Drainage strategy report' },
  statusLabels: {},
  conditionTypeLabels: {},
  sourceDocument: 'planning decision notice',
}

export const PLANNING: Record<CountryCode, PlanningProfile> = {
  GB: GB_PLANNING,
  EE: {
    title: 'Permits & Planning',
    applicationTypes: ['Projekteerimistingimused (design conditions)', 'Detailplaneering (detailed plan)', 'Ehitusteatis (building notice)', 'Ehitusluba (building permit)', 'Kasutusteatis (use notice)', 'Kasutusluba (use permit)', 'Muinsuskaitse kooskõlastus (heritage approval)'],
    placeholders: { authority: 'e.g. Tallinna Linnaplaneerimise Amet', type: 'e.g. Ehitusluba (building permit)', reference: 'e.g. EHR application number', portal: 'https://livekluster.ehr.ee/...', consultant: 'e.g. planning or heritage consultant', trigger: 'e.g. Before construction starts', submission: 'e.g. Tuleohutuse osa (fire safety part)' },
    statusLabels: {
      PRE_APPLICATION: 'Pre-application / eelnõu', SUBMITTED: 'Submitted in EHR', INVALID_INFORMATION_REQUIRED: 'Returned — more information needed',
      VALIDATED: 'Accepted for processing (menetluses)', CONSULTATION: 'Public display / opinions', COMMITTEE: 'Coordination with agencies (kooskõlastamine)',
      APPROVED: 'Granted', APPEAL: 'Challenge (vaie)', CONDITIONS_DISCHARGE: 'Meeting conditions',
    },
    conditionTypeLabels: { PRE_COMMENCEMENT: 'Before construction starts', PRE_OCCUPATION: 'Before the use permit' },
    sourceDocument: 'planning conditions (projekteerimistingimused)',
  },
  NG: {
    title: 'Planning Applications',
    applicationTypes: ['Planning permit', 'Development permit', 'Building plan approval', 'Environmental impact assessment', 'Certificate of completion and fitness for habitation'],
    placeholders: { authority: COUNTRIES.NG.placeholders.planningAuthority, type: 'e.g. Planning permit, Building plan approval', reference: 'e.g. LASPPPA/2026/1234', portal: 'https://...', consultant: 'e.g. town planning consultant', trigger: 'e.g. Before superstructure', submission: 'e.g. Drainage strategy report' },
    statusLabels: {},
    conditionTypeLabels: {},
    sourceDocument: null,
  },
}

/** Planning wording for a country; unknown country gets the neutral UK-English set. */
export function planningProfile(country: CountryCode | null | undefined): PlanningProfile {
  return country ? PLANNING[country] : GB_PLANNING
}

/**
 * Hotel-only parts of a project (schedule of accommodation, operator, room keys).
 * Nigerian firms and projects of unknown country keep them on every project, as before.
 */
export function showsHospitality(input: { country: CountryCode | null | undefined; projectType?: string | null }): boolean {
  if (!input.country || input.country === 'NG') return true
  return input.projectType === 'HOTEL' || input.projectType === 'RESORT'
}

/* ── Leave rules by country ────────────────────────────────── */

export interface LeaveRules {
  /** 'working' counts Mon–Fri; 'calendar' counts every day (Estonia: Töölepingu seadus § 55). */
  dayBasis: 'working' | 'calendar'
  /** Annual allowance used when a person has none set. */
  annualDays: number
  /** Public holidays inside annual leave are not counted as leave (Estonia: TLS § 68). */
  skipPublicHolidays: boolean
  /** Longest single request before HR must be involved. */
  maxRequestDays: number
}

const DEFAULT_LEAVE: LeaveRules = { dayBasis: 'working', annualDays: 25, skipPublicHolidays: false, maxRequestDays: 25 }
const EE_LEAVE: LeaveRules = { dayBasis: 'calendar', annualDays: 28, skipPublicHolidays: true, maxRequestDays: 35 }

/** Leave rules for a firm's country. Only Estonia differs today; everyone else keeps working days and 25. */
export function leaveRules(country: CountryCode | null | undefined): LeaveRules {
  return country === 'EE' ? EE_LEAVE : DEFAULT_LEAVE
}

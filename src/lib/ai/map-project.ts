/**
 * Deterministic map: extracted planning conditions → questionnaire pre-fill + municipal conditions.
 * Limits are BOUNDS, not design values (Suleyman): the architect types the design number; we show "≤ 6.5 m per PT".
 * Every pre-filled field carries its page and quote so the ConfirmationReview can open the PDF there.
 */
import type { PlanningConditions, PagedField } from './schemas-documents'
import type { ProjectParameters } from '@/lib/rules'

export type PrefillKind = 'value' | 'bound'
export interface Prefill<T = unknown> {
  key: keyof ProjectParameters
  value: T
  kind: PrefillKind
  /** For bounds: the comparison shown to the architect, e.g. "≤ 6.5 m". */
  label: string
  because: string
  confidence: number
  page: number | null
  quote: string | null
  /** Numeric limits are never pre-accepted (Suleyman). */
  preAccept: boolean
}

export interface MunicipalCondition {
  topic: string
  text: string
  page: number | null
  mandatory: boolean
  citation: string   // "PT nr 2611802/03126 p.4"
  source: string     // "Viljandi Vallavalitsus"
}

export interface ProjectSetupMapping {
  kind: 'planning_conditions'
  document: { number: string | null; issuer: string | null; issuedAt: string | null; validUntil: string | null; legalBasis: string | null; ehrCode: string | null; address: string | null }
  prefills: Prefill[]
  conditions: MunicipalCondition[]
  bounds: { maxHeightM: number | null; maxStoreys: number | null; maxFootprint: { value: number; unit: string } | null; minSetbackM: number | null }
  warnings: string[]
  /** Set by applyInjectionGuard when the document contains text addressed to an AI system. */
  suspicious?: { pages: number[]; excerpts: string[]; dropped: string[]; droppedConditions: number }
}

const v = <T,>(f: PagedField<T> | undefined | null): T | null => (f && f.value !== undefined ? f.value : null)
const meta = (f: PagedField<unknown> | undefined | null) => ({ confidence: f?.confidence ?? 0, page: f?.page ?? null, quote: f?.quote ?? null })

/** Estonian building use codes (EHR) → questionnaire building type. */
export function buildingTypeFromUseCode(code: string | null | undefined): ProjectParameters['buildingType'] | null {
  if (!code) return null
  if (/^1110[1-3]/.test(code) || code === '11101') return 'detached_house'      // üksikelamu
  if (code.startsWith('1110')) return 'detached_house'
  if (code.startsWith('1112')) return 'semi_detached'                           // kahe korteriga / ridaelamu 11211? keep simple
  if (code.startsWith('1121')) return 'terraced'
  if (code.startsWith('112')) return 'apartment_block'
  if (code.startsWith('12')) return 'non_residential'
  return 'other'
}

export function mapPlanningConditions(pc: PlanningConditions): ProjectSetupMapping {
  const prefills: Prefill[] = []
  const warnings: string[] = [...(pc.warnings ?? [])]
  const docNo = v(pc.document.number)
  const issuer = v(pc.document.issuer)
  const cite = (page: number | null) => `PT nr ${docNo ?? '?'}${page ? ` p.${page}` : ''}`

  // jurisdiction: PT documents are Estonian
  prefills.push({ key: 'jurisdiction', value: 'EE', kind: 'value', label: 'Estonia', because: 'Projekteerimistingimused are issued under Ehitusseadustik', confidence: 1, page: null, quote: null, preAccept: true })

  // building type from use code
  const use = pc.building.useCodes?.[0]
  const bt = buildingTypeFromUseCode(use?.code)
  if (bt) prefills.push({ key: 'buildingType', value: bt, kind: 'value', label: bt.replace('_', ' '), because: `Use code ${use!.code}${use!.label ? ` (${use!.label})` : ''}`, confidence: 0.9, page: null, quote: use!.label ?? use!.code, preAccept: true })

  // work type
  const act = v(pc.building.plannedActivity)
  if (act && act !== 'other') prefills.push({ key: 'workType', value: act, kind: 'value', label: act.replace('_', ' '), because: 'Kavandatav tegevus', ...meta(pc.building.plannedActivity), preAccept: (pc.building.plannedActivity.confidence ?? 0) >= 0.8 })

  // detailed plan from legal basis
  const basis = v(pc.document.legalBasis)
  if (basis === 'EhS_26') prefills.push({ key: 'detailedPlanExists', value: false, kind: 'value', label: 'No detailed plan', because: 'Issued under EhS § 26 — detailplaneeringu koostamise kohustuse puudumisel', ...meta(pc.document.legalBasis), preAccept: true })
  if (basis === 'EhS_27') prefills.push({ key: 'detailedPlanExists', value: true, kind: 'value', label: 'Detailed plan in force', because: 'Issued under EhS § 27 — detailplaneeringu olemasolul', ...meta(pc.document.legalBasis), preAccept: true })

  // county from site
  const county = v(pc.site.county)
  if (county) prefills.push({ key: 'county', value: county.replace(/ maakond$/i, ''), kind: 'value', label: county, because: 'Site address', ...meta(pc.site.county), preAccept: (pc.site.county.confidence ?? 0) >= 0.8 })

  // heritage
  const her = v(pc.heritage)
  if (her?.applies) prefills.push({ key: 'heritage', value: true, kind: 'value', label: 'Heritage applies', because: her.note ?? 'Muinsuskaitse nõuded', ...meta(pc.heritage), preAccept: false })

  // sewage → urban area
  const sew = v(pc.utilities.sewage)
  if (sew && /ühis|tsentraal|municipal|public/i.test(sew)) prefills.push({ key: 'urbanArea', value: true, kind: 'value', label: 'Municipal water/sewage', because: sew.slice(0, 120), ...meta(pc.utilities.sewage), preAccept: false })

  // BOUNDS — never pre-accepted, never written as design values
  const h = v(pc.limits.maxHeight)
  const maxHeightM = h?.value != null && (h.unit == null || /^m$/i.test(h.unit)) ? h.value : null
  if (maxHeightM != null) prefills.push({ key: 'height', value: maxHeightM, kind: 'bound', label: `≤ ${maxHeightM} m`, because: `Maximum height per ${cite(pc.limits.maxHeight.page ?? null)}`, ...meta(pc.limits.maxHeight), preAccept: false })
  else if (h?.value != null) warnings.push(`Max height given in "${h.unit}" — not applied`)

  const st = v(pc.limits.maxStoreys)
  if (st != null) prefills.push({ key: 'storeys', value: st, kind: 'bound', label: `≤ ${st} storeys`, because: `Maximum storeys per ${cite(pc.limits.maxStoreys.page ?? null)}`, ...meta(pc.limits.maxStoreys), preAccept: false })

  const fp = v(pc.limits.maxFootprint)
  const sb = v(pc.limits.minSetback)

  // municipal conditions
  const conditions: MunicipalCondition[] = (pc.conditions ?? []).map((c) => ({
    topic: c.topic, text: c.text, page: c.page, mandatory: c.mandatory, citation: cite(c.page), source: issuer ?? 'Municipality',
  }))
  // limits that are conditions in their own right
  if (fp?.value != null) conditions.unshift({ topic: 'Ehitisealune pind', text: `Maximum footprint ${fp.value}${fp.unit ?? ''}`, page: pc.limits.maxFootprint.page ?? null, mandatory: true, citation: cite(pc.limits.maxFootprint.page ?? null), source: issuer ?? 'Municipality' })
  if (sb?.value != null) conditions.unshift({ topic: 'Kaugus kinnistu piirist', text: `Minimum setback ${sb.value}${sb.unit ?? ' m'}`, page: pc.limits.minSetback.page ?? null, mandatory: true, citation: cite(pc.limits.minSetback.page ?? null), source: issuer ?? 'Municipality' })
  for (const s of pc.surveysRequired ?? []) conditions.push({ topic: 'Uuring', text: s.name, page: s.page, mandatory: s.mandatory, citation: cite(s.page), source: issuer ?? 'Municipality' })
  const validUntil = v(pc.document.validUntil)
  if (validUntil) conditions.push({ topic: 'Kehtivus', text: `Planning conditions valid until ${validUntil}`, page: pc.document.validUntil.page ?? null, mandatory: true, citation: cite(pc.document.validUntil.page ?? null), source: issuer ?? 'Municipality' })

  if (!docNo) warnings.push('Document number not found — citations will read "PT nr ?"')
  if (pc.document.kind !== 'planning_conditions') warnings.push('This may not be a planning-conditions document')

  return {
    kind: 'planning_conditions',
    document: { number: docNo, issuer, issuedAt: v(pc.document.issuedAt), validUntil, legalBasis: basis, ehrCode: v(pc.site.ehrCode), address: v(pc.site.address) },
    prefills,
    conditions: dedupe(conditions),
    bounds: { maxHeightM, maxStoreys: st, maxFootprint: fp?.value != null ? { value: fp.value, unit: fp.unit ?? '' } : null, minSetbackM: sb?.value != null ? sb.value : null },
    warnings,
  }
}

function dedupe(items: MunicipalCondition[]): MunicipalCondition[] {
  const seen = new Set<string>()
  return items.filter((c) => { const k = c.text.toLowerCase().replace(/\s+/g, ' ').slice(0, 80); if (seen.has(k)) return false; seen.add(k); return true }).slice(0, 80)
}

const PT_NUMBER = /projekteerimistingimus\w*\s+nr\.?\s*([0-9][0-9/.\-]*[0-9])/gi

/**
 * Pin document.number to the "Projekteerimistingimused nr X" phrase when the document states it
 * exactly one way. Models confuse it with the decision number ("korraldus nr 2-3/999"), which
 * real documents also carry. 9/10 real PDFs state it; when absent or ambiguous the model's value stands.
 */
export function pinDocumentNumber(pc: PlanningConditions, pages: string[]): PlanningConditions {
  const found = new Map<string, { page: number; quote: string }>()
  pages.forEach((text, i) => {
    for (const m of text.matchAll(PT_NUMBER)) if (!found.has(m[1])) found.set(m[1], { page: i + 1, quote: m[0].replace(/\s+/g, ' ') })
  })
  if (found.size !== 1) return pc
  const [[number, src]] = [...found]
  if (pc.document.number?.value === number) return pc
  return { ...pc, document: { ...pc.document, number: { value: number, confidence: 0.95, page: src.page, quote: src.quote } } }
}

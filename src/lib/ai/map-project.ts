/**
 * Deterministic map: extracted planning conditions → questionnaire pre-fill + municipal conditions.
 * Limits are BOUNDS, not design values (Suleyman): the architect types the design number; we show "≤ 6.5 m per PT".
 * Every pre-filled field carries its page and quote so the ConfirmationReview can open the PDF there.
 */
import type { PlanningConditions, PagedField, Brief, DecisionNotice } from './schemas-documents'
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
  /** England decision notices: when the condition bites (pre-commencement, pre-occupation …). */
  timing?: string
  /** Computed by Coordin (deadline, plans list), not quoted from the document — always counts as verified. */
  derived?: boolean
  /** Set by verifyQuotes: the condition's wording was found in the document. Only verified conditions are pre-ticked. */
  verified?: boolean
}

export interface ProjectSetupMapping {
  kind: 'planning_conditions' | 'brief' | 'decision_notice'
  document: { number: string | null; issuer: string | null; issuedAt: string | null; validUntil: string | null; legalBasis: string | null; ehrCode: string | null; address: string | null; projectName?: string | null; client?: string | null; parent?: string | null }
  prefills: Prefill[]
  conditions: MunicipalCondition[]
  bounds: { maxHeightM: number | null; maxStoreys: number | null; maxFootprint: { value: number; unit: string } | null; minSetbackM: number | null }
  warnings: string[]
  /** Set by applyInjectionGuard when the document contains text addressed to an AI system. */
  suspicious?: { pages: number[]; excerpts: string[]; dropped: string[]; droppedConditions: number }
}

const v = <T,>(f: PagedField<T> | undefined | null): T | null => (f && f.value !== undefined ? f.value : null)
const meta = (f: PagedField<unknown> | undefined | null) => ({ confidence: f?.confidence ?? 0, page: f?.page ?? null, quote: f?.quote ?? null })

/**
 * Estonian building use codes → questionnaire building type.
 * Source: "Ehitise kasutamise otstarvete loetelu" (MKM määrus nr 51, 02.06.2015, Lisa 1; amended 2025):
 *   11101 Üksikelamu · 11102 Ridaelamu või kaksikelamu sektsioon (own roof + ground-level entrance) · 11103 Suvila, aiamaja
 *   11212 Kahe korteriga elamu · 11221 Ridaelamu · 11222 Muu kolme või enama korteriga elamu
 *   113xx Hoolekandeasutused / ühiselamud · 12xxx Mitteelamud · 2xxxx Rajatised
 * 11102 is terraced unless the label says kaksikelamu without ridaelamu (the official label names both).
 */
export function buildingTypeFromUseCode(code: string | null | undefined, label?: string | null): ProjectParameters['buildingType'] | null {
  if (!code) return null
  const c = String(code).trim()
  if (!/^\d{5}$/.test(c)) return null
  switch (c) {
    case '11101': return 'detached_house'
    case '11103': return 'detached_house'
    // The official label names both ("Ridaelamu või kaksikelamu sektsioon") — only a label that says kaksikelamu alone means semi-detached
    case '11102': return label && /kaksik/i.test(label) && !/ridaelamu/i.test(label) ? 'semi_detached' : 'terraced'
    case '11212': return 'semi_detached'        // two dwellings in one building
    case '11221': return 'terraced'             // row house as a whole building
    case '11222': return 'apartment_block'
  }
  if (c.startsWith('1121')) return 'semi_detached'
  if (c.startsWith('1122')) return 'apartment_block'
  if (c.startsWith('113')) return 'non_residential' // care homes, dormitories
  if (c.startsWith('12')) return 'non_residential'
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
  const bt = buildingTypeFromUseCode(use?.code, use?.label)
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
  if (validUntil && /^\d{4}-\d{2}-\d{2}/.test(validUntil) && validUntil.slice(0, 10) < new Date().toISOString().slice(0, 10)) {
    warnings.push(`These planning conditions expired on ${validUntil.slice(0, 10)} — check whether new conditions have been issued before relying on them`)
  }
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

const AREA_UNIT = /^(m2|m²|m\^2|ruutmeetrit?|sq\.? ?m|sqm)$/i
const LABEL_BT: Record<string, string> = { detached_house: 'Detached house', semi_detached: 'Semi-detached', terraced: 'Terraced', apartment_block: 'Apartment block', non_residential: 'Non-residential', other: 'Other' }
const LABEL_WT: Record<string, string> = { new_build: 'New build', extension: 'Extension', reconstruction: 'Reconstruction', change_of_use: 'Change of use', demolition: 'Demolition' }

/**
 * Client brief → questionnaire pre-fill. A brief is design INTENT, not law: values are proposals,
 * pre-accepted only when the model quoted the brief with confidence >= 0.8. No bounds, no municipal conditions.
 */
export function mapBrief(b: Brief): ProjectSetupMapping {
  const prefills: Prefill[] = []
  const warnings: string[] = [...(b.warnings ?? [])]
  const p = b.parameters
  const ok = (f: PagedField<unknown> | undefined) => (f?.confidence ?? 0) >= 0.8 && !!f?.quote
  const add = (key: keyof ProjectParameters, value: unknown, label: string, because: string, f: PagedField<unknown>) =>
    prefills.push({ key, value, kind: 'value', label, because, ...meta(f), preAccept: ok(f) })

  const bt = v(p.buildingType); if (bt) add('buildingType', bt, LABEL_BT[bt] ?? bt, 'Client brief', p.buildingType)
  const wt = v(p.workType); if (wt) add('workType', wt, LABEL_WT[wt] ?? wt, 'Client brief', p.workType)

  const gfa = v(p.grossFloorArea)
  if (gfa?.value != null) {
    if (gfa.unit == null || AREA_UNIT.test(gfa.unit.trim())) add('grossFloorArea', gfa.value, `${gfa.value} m²`, 'Requested floor area', p.grossFloorArea)
    else warnings.push(`Floor area given in "${gfa.unit}" — not applied`)
  }
  const h = v(p.height)
  if (h?.value != null) {
    if (h.unit == null || /^m$/i.test(h.unit.trim())) add('height', h.value, `${h.value} m`, 'Requested height', p.height)
    else warnings.push(`Height given in "${h.unit}" — not applied`)
  }
  const st = v(p.storeys); if (st != null) add('storeys', st, `${st} storeys`, 'Requested storeys', p.storeys)
  const ap = v(p.apartments); if (ap != null) add('apartments', ap, `${ap} apartments`, 'Requested apartments', p.apartments)
  const pk = v(p.parkingSpaces); if (pk != null) add('parkingSpaces', pk, `${pk} spaces`, 'Requested parking', p.parkingSpaces)

  const flags: Array<[keyof ProjectParameters, string, string]> = [
    ['timberStructure', 'Timber structure', 'Not timber'], ['heritage', 'Heritage applies', 'No heritage'],
    ['detailedPlanExists', 'Detailed plan in force', 'No detailed plan'], ['districtHeatingAvailable', 'District heating', 'No district heating'],
    ['urbanArea', 'Urban area', 'Not urban'],
  ]
  for (const [key, yes, no] of flags) {
    const f = (p as Record<string, PagedField<boolean>>)[key as string]
    const val = v(f); if (val != null) add(key, val, val ? yes : no, 'Client brief', f)
  }
  const county = v(b.project.county)
  if (county) add('county', county.replace(/ maakond$/i, ''), county, 'Site address in brief', b.project.county)

  if (prefills.length === 0) warnings.push('Nothing in this document maps to the questionnaire — is it a client brief?')
  return {
    kind: 'brief',
    document: { number: null, issuer: v(b.project.client), issuedAt: null, validUntil: null, legalBasis: null, ehrCode: null, address: v(b.project.address), projectName: v(b.project.name), client: v(b.project.client) },
    prefills,
    conditions: [],
    bounds: { maxHeightM: null, maxStoreys: null, maxFootprint: null, minSetbackM: null },
    warnings,
  }
}

/** Share of the quote's words (4+ letters) that occur in the document. Models stitch adjacent phrases into one quote. */
function wordCoverage(q: string, doc: string): number {
  const words = q.split(/[^\p{L}\p{N}§]+/u).filter((w) => w.length >= 4)
  if (words.length === 0) return 0
  return words.filter((w) => doc.includes(w)).length / words.length
}

const squash = (s: string) => s.toLowerCase().normalize('NFKC').replace(/[\s ]+/g, ' ').replace(/[“”„"«»]/g, '"').trim()

/**
 * Models report ~100% confidence on almost everything, so confidence alone can't decide pre-acceptance.
 * Deterministic check: a pre-filled value is only pre-ticked if its quote actually occurs in the document text.
 * Unverifiable quotes keep the row (the architect may still accept it) but untick it and cap confidence.
 */
export function verifyQuotes(mapping: ProjectSetupMapping, pages: string[]): ProjectSetupMapping {
  const doc = squash(pages.join('\n'))
  let unverified = 0
  const prefills = mapping.prefills.map((p) => {
    if (!p.quote) return p
    const q = squash(p.quote).replace(/…$/, '')
    if (q.length < 3 || doc.includes(q) || wordCoverage(q, doc) >= 0.85) return p
    unverified++
    return { ...p, preAccept: false, confidence: Math.min(p.confidence, 0.5), because: `${p.because} — quote not found in the document, check it` }
  })
  // Conditions: page citations must exist, and only wording found in the document counts as verified
  let badPages = 0, unverifiedConds = 0
  const conditions = mapping.conditions.map((c) => {
    let { page, citation } = c
    if (page != null && (page < 1 || page > pages.length)) { page = null; citation = citation.replace(/ p\.\d+$/, ''); badPages++ }
    const t = squash(c.text)
    const verified = !!c.derived || (t.length >= 3 && (doc.includes(t) || wordCoverage(t, doc) >= 0.6))
    if (!verified) unverifiedConds++
    return { ...c, page, citation, verified }
  })
  const warnings = [...mapping.warnings]
  if (unverified) warnings.push(`${unverified} value${unverified > 1 ? 's' : ''} cite text that isn't in the document — left unticked`)
  if (unverifiedConds) warnings.push(`${unverifiedConds} condition${unverifiedConds > 1 ? 's' : ''} couldn't be matched to the document wording — left unticked, check against the PDF`)
  if (badPages) warnings.push(`${badPages} citation${badPages > 1 ? 's' : ''} pointed to a page that isn't in the document — page removed`)
  return { ...mapping, prefills, conditions, warnings }
}

/* ─────────────────────────── England: planning decision notices ─────────────────────────── */

const TIMING_LABEL: Record<string, string> = {
  time_limit: 'Time limit', approved_plans: 'Approved plans', pre_commencement: 'Before commencement', pre_superstructure: 'Before above-ground works',
  pre_occupation: 'Before occupation', compliance: 'Ongoing', other: 'Condition',
}
const TIME_LIMIT = /\b(begun|commenced|begin|start(ed)?)\b.{0,40}\b(not later than|before|within)\b.{0,40}\b(expiration of )?(three|five|\d) years\b/i
const APPROVED_PLANS = /\b(in accordance with the following (approved )?(plans|drawings?|documents)|relates to the following (approved )?plans|carried out in accordance with the (approved|submitted) plans)/i
const PRE_COMMENCEMENT = /\b((development|works?)\b[^.]{0,80}\b(shall|must|will) not (commence|begin|start|take place)|no (part of the )?development\b[^.]{0,60}\b(shall|must|will) (take place|commence|begin|start)|prior to (the )?commencement|prior to (the )?development commencing|before (the )?(development|works?) (commences?|begins?|starts?)|no development (shall|must|will) (take place|commence|begin|start)|prior to any (works|development) (commencing|starting))/i
const PRE_OCCUPATION = /\b(prior to (the )?(first )?(occupation|use)\b|before (the )?(first )?occupation|shall not be occupied (unless|until))/i
const PRE_SUPER = /\b(above[- ]ground works|superstructure|damp[- ]proof course|external walling)/i

/** Decision date + N years, minus a day — "begun not later than the expiration of three years beginning with the date of this permission". */
export function commencementDeadline(decisionDate: string | null, years: number | null): string | null {
  if (!decisionDate || !/^\d{4}-\d{2}-\d{2}/.test(decisionDate) || !years || years < 1 || years > 10) return null
  const d = new Date(decisionDate.slice(0, 10) + 'T00:00:00Z')
  if (Number.isNaN(d.getTime())) return null
  d.setUTCFullYear(d.getUTCFullYear() + Math.round(years))
  d.setUTCDate(d.getUTCDate() - 1)
  return d.toISOString().slice(0, 10)
}

/** The model's timing label is a hint; the wording decides when it clearly says "prior to commencement" etc. */
export function conditionTiming(text: string, modelTiming: string): string {
  // A trigger in the wording beats any label — a pre-commencement obligation must never hide behind "approved plans"
  if (PRE_COMMENCEMENT.test(text)) return 'pre_commencement'
  if (PRE_SUPER.test(text) && /\b(prior to|before|until)\b/i.test(text)) return 'pre_superstructure'
  if (PRE_OCCUPATION.test(text)) return 'pre_occupation'
  if (modelTiming === 'time_limit' || modelTiming === 'approved_plans') return modelTiming
  // Only relabel what the model left unclassified
  if (modelTiming === 'other' || modelTiming === 'compliance') {
    if (TIME_LIMIT.test(text)) return 'time_limit'
    if (APPROVED_PLANS.test(text)) return 'approved_plans'
  }
  return modelTiming
}

/** Things in conditions that change the Building Regulations checklist — found deterministically, never trusted from the model. */
export function conditionSignals(texts: string[]): { m42: boolean; m43: boolean; waterLitres: number | null; bng: boolean; pdRemoved: boolean } {
  const all = texts.join('\n')
  const water = all.match(/(\d{2,3})\s*litres?\s*(?:or less\s*)?(?:per|\/)\s*(?:person|head)/i)
  return {
    m42: /M4\s*\(\s*2\s*\)/i.test(all),
    m43: /M4\s*\(\s*3\s*\)/i.test(all),
    waterLitres: water ? parseInt(water[1], 10) : null,
    bng: /biodiversity gain plan|biodiversity net gain|\bBNG\b/i.test(all),
    pdRemoved: texts.some((t) => /permitted development/i.test(t) && /\b(notwithstanding|no (extensions?|buildings?|alterations?|development)|shall not)\b/i.test(t)),
  }
}

export function mapDecisionNotice(dn: DecisionNotice): ProjectSetupMapping {
  const prefills: Prefill[] = []
  const warnings: string[] = [...(dn.warnings ?? [])]
  const ref = v(dn.document.reference)
  const lpa = v(dn.document.authority)
  const decision = v(dn.document.decision)
  const appType = v(dn.document.applicationType)
  const decided = v(dn.document.decisionDate)
  const cite = (n: number | null, page: number | null) => `${ref ?? 'Decision ?'}${n != null ? ` condition ${n}` : ''}${page ? ` p.${page}` : ''}`
  const source = lpa ?? 'Local planning authority'
  const ok = (f: PagedField<unknown> | undefined) => (f?.confidence ?? 0) >= 0.8 && !!f?.quote

  prefills.push({ key: 'jurisdiction', value: 'GB', kind: 'value', label: 'England', because: 'Decision issued under the Town and Country Planning Act 1990', confidence: 1, page: null, quote: null, preAccept: true })
  const wt = v(dn.proposal.workType)
  if (wt) prefills.push({ key: 'workType', value: wt, kind: 'value', label: LABEL_WT[wt] ?? wt, because: 'Proposal description', ...meta(dn.proposal.workType), preAccept: ok(dn.proposal.workType) })
  const bt = v(dn.proposal.buildingType)
  if (bt && bt !== 'other') prefills.push({ key: 'buildingType', value: bt, kind: 'value', label: LABEL_BT[bt] ?? bt, because: 'Proposal description', ...meta(dn.proposal.buildingType), preAccept: ok(dn.proposal.buildingType) })
  const dw = v(dn.proposal.dwellings)
  if (dw != null && dw > 1) prefills.push({ key: 'apartments', value: dw, kind: 'value', label: `${dw} dwellings`, because: 'Proposal description', ...meta(dn.proposal.dwellings), preAccept: ok(dn.proposal.dwellings) })
  const st = v(dn.proposal.storeys)
  if (st != null && st > 0) prefills.push({ key: 'storeys', value: st, kind: 'value', label: `${st} storeys`, because: 'Proposal description', ...meta(dn.proposal.storeys), preAccept: ok(dn.proposal.storeys) })

  const conditions: MunicipalCondition[] = []
  const refused = decision === 'refused' || decision === 'prior_approval_refused' || decision === 'certificate_refused'
  if (refused) {
    warnings.push('This application was REFUSED — there is no permission to build. Reasons for refusal are listed so a resubmission can address them.')
    for (const r of dn.refusalReasons ?? []) conditions.push({ topic: `Reason for refusal${r.number != null ? ` ${r.number}` : ''}`, text: r.text, page: r.page, mandatory: false, citation: `${ref ?? 'Decision ?'} reason ${r.number ?? '?'}`, source, timing: 'refusal' })
  } else {
    for (const c of dn.conditions ?? []) {
      let timing = conditionTiming(c.text, c.timing)
      if (timing === 'other' && !/\buntil\b/i.test(c.text)) timing = 'compliance'
      conditions.push({ topic: c.heading?.trim() || TIMING_LABEL[timing] || 'Condition', text: c.text, page: c.page, mandatory: true, citation: cite(c.number, c.page), source, timing })
    }
  }

  // Derived: commencement deadline. Default 3 years (s.91) when a time-limit condition exists but the number was missed.
  // Only for permissions that start their own clock: s73 variations keep the original limit (s73(5)); reserved matters and
  // discharges run off the parent; outline's limit is for applying for reserved matters (s.92).
  const hasTimeLimit = (dn.conditions ?? []).some((c) => conditionTiming(c.text, c.timing) === 'time_limit')
  const years = v(dn.timeLimitYears) ?? (hasTimeLimit ? 3 : null)
  const ownClock = !refused && (appType === 'full' || appType === 'householder' || appType === 'listed_building_consent' || appType === 'outline' || appType === 'other' || appType === null)
  const dateTrusted = (dn.document.decisionDate.confidence ?? 0) >= 0.8 && !!dn.document.decisionDate.quote
  const deadline = ownClock && dateTrusted ? commencementDeadline(decided, years) : null
  if (ownClock && years && !dateTrusted) warnings.push('The decision date could not be confirmed from the notice — work out the commencement deadline by hand')
  if (deadline && appType === 'outline') {
    conditions.unshift({ topic: 'Reserved matters deadline', text: `Apply for approval of all reserved matters no later than ${deadline} (${years} years from the outline decision on ${decided!.slice(0, 10)}). Development must then begin within the period set by the outline conditions (normally 2 years from the final reserved-matters approval).`, page: dn.timeLimitYears.page ?? null, mandatory: true, citation: cite(null, dn.timeLimitYears.page ?? null), source, timing: 'time_limit', derived: true })
    if (deadline < new Date().toISOString().slice(0, 10)) warnings.push(`The reserved-matters deadline was ${deadline} — unless reserved matters were applied for in time, this outline permission has lapsed`)
  } else if (deadline) {
    conditions.unshift({ topic: 'Commencement deadline', text: `Begin development no later than ${deadline} (${years} years from the decision on ${decided!.slice(0, 10)}), or the permission lapses. Discharge all pre-commencement conditions first.`, page: dn.timeLimitYears.page ?? null, mandatory: true, citation: cite(null, dn.timeLimitYears.page ?? null), source, timing: 'time_limit', derived: true })
    if (deadline < new Date().toISOString().slice(0, 10)) warnings.push(`The time limit expired on ${deadline} — unless development lawfully began before then, this permission has lapsed`)
  }
  if (!refused && appType === 'variation_of_condition') warnings.push('A section 73 variation cannot extend the time limit — the commencement deadline is the original permission\'s')

  // Derived: approved plans, as one item the architect can tick against the drawing register
  const plans = dn.approvedPlans ?? []
  if (plans.length && !refused) conditions.push({ topic: 'Approved plans', text: `Build in accordance with the ${plans.length} approved drawing${plans.length > 1 ? 's' : ''}/documents: ${plans.map((p) => p.ref).join('; ')}`.slice(0, 1200), page: null, mandatory: true, citation: cite(null, null), source, timing: 'approved_plans', derived: true })

  const sig = conditionSignals((dn.conditions ?? []).map((c) => c.text))
  if (!refused) {
    if (sig.m43) warnings.push('A condition requires M4(3) wheelchair user dwellings — check AD M Vol 1 Category 3 applies to the units named')
    else if (sig.m42) warnings.push('A condition requires M4(2) accessible and adaptable dwellings — this replaces the M4(1) default')
    if (sig.waterLitres) warnings.push(`A condition sets a water use target of ${sig.waterLitres} litres/person/day — design to the optional requirement G2 (Building Regulations reg 36(2)(b))`)
    if (sig.bng) warnings.push('A condition refers to biodiversity net gain — a Biodiversity Gain Plan must be approved before development begins')
    if (sig.pdRemoved) warnings.push('A condition removes permitted development rights — later extensions will need a planning application')
    const pre = conditions.filter((c) => c.timing === 'pre_commencement').length
    if (pre) warnings.push(`${pre} pre-commencement condition${pre > 1 ? 's' : ''} must be discharged before any work starts`)
  }
  if (appType === 'reserved_matters' || appType === 'approval_of_details' || appType === 'variation_of_condition') {
    const parent = v(dn.document.parentPermission)
    warnings.push(`This decision depends on an earlier permission${parent ? ` (${parent})` : ''} — its conditions still apply. Upload that decision notice too.`)
  }
  if (!ref) warnings.push('Application reference not found — citations will read "Decision ?"')
  if (dn.document.kind !== 'decision_notice') warnings.push('This may not be a planning decision notice')
  if (!refused && (dn.conditions ?? []).length === 0 && appType !== 'approval_of_details' && appType !== 'lawful_development_certificate') warnings.push('No conditions were found — check the notice; most permissions carry at least a time limit')

  return {
    kind: 'decision_notice',
    document: { number: ref, issuer: lpa, issuedAt: decided, validUntil: deadline, legalBasis: appType, ehrCode: null, address: v(dn.site.address), parent: v(dn.document.parentPermission) },
    prefills,
    conditions: dedupe(conditions),
    bounds: { maxHeightM: null, maxStoreys: null, maxFootprint: null, minSetbackM: null },
    warnings,
  }
}

const APP_REF = /\b(?:application\s*(?:no\.?|number|ref(?:erence)?\.?)|our\s*ref\.?|ref\.?)\s*:?\s*([A-Z]{0,4}\d{1,4}[A-Z0-9]*(?:\/[A-Z0-9.\-]+)+)/gi

/** Pin document.reference to the "Application No:" phrase when the notice states one reference only. */
export function pinApplicationReference(dn: DecisionNotice, pages: string[]): DecisionNotice {
  const found = new Map<string, { page: number; quote: string }>()
  pages.forEach((text, i) => { for (const m of text.matchAll(APP_REF)) if (!found.has(m[1])) found.set(m[1], { page: i + 1, quote: m[0].replace(/\s+/g, ' ') }) })
  const parent = dn.document.parentPermission?.value
  if (parent) found.delete(parent)
  if (found.size !== 1) return dn
  const [[reference, src]] = [...found]
  if (dn.document.reference?.value === reference) return dn
  return { ...dn, document: { ...dn.document, reference: { value: reference, confidence: 0.95, page: src.page, quote: src.quote } } }
}

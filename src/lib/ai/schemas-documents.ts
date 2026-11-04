import { z } from 'zod'

/**
 * Sprint 3 — document extraction schemas.
 * Every value is page-sourced: { value, confidence, page, quote }.
 * Numbers carry their unit as extracted, never assumed (Karpathy).
 */
export const Paged = <T extends z.ZodTypeAny>(inner: T) =>
  z.object({
    value: inner.nullable(),
    confidence: z.number().min(0).max(1),
    page: z.number().int().min(1).nullable().optional(),
    quote: z.string().max(300).nullable().optional(),
  })
export type PagedField<T> = { value: T | null; confidence: number; page?: number | null; quote?: string | null }

const Num = z.number()
const NumWithUnit = z.object({ value: Num.nullable(), unit: z.string().max(12).nullable() })

export const PlanningConditionsSchema = z.object({
  document: z.object({
    kind: z.enum(['planning_conditions', 'other']),
    number: Paged(z.string()),
    issuedAt: Paged(z.string()),          // ISO date if determinable
    issuer: Paged(z.string()),            // e.g. "Viljandi Vallavalitsus"
    validUntil: Paged(z.string()),
    legalBasis: Paged(z.enum(['EhS_26', 'EhS_27', 'EhS_99', 'other'])), // §26 no detailed plan, §27 detailed plan exists, §99 roads/utilities
    applicationNumber: Paged(z.string()).optional(),
  }),
  site: z.object({
    ehrCode: Paged(z.string()),
    address: Paged(z.string()),
    cadastralUnit: Paged(z.string()),
    county: Paged(z.string()),
    municipality: Paged(z.string()),
    landUse: Paged(z.string()),           // e.g. "elamumaa 100%"
  }),
  building: z.object({
    plannedActivity: Paged(z.enum(['new_build', 'extension', 'reconstruction', 'change_of_use', 'demolition', 'other'])),
    useCodes: z.array(z.object({ code: z.string(), label: z.string().nullable(), share: z.string().nullable() })).max(10),
    buildingName: Paged(z.string()),
  }),
  limits: z.object({
    maxFootprint: Paged(NumWithUnit),     // may be m² or % of plot
    maxHeight: Paged(NumWithUnit),
    maxStoreys: Paged(Num),
    minSetback: Paged(NumWithUnit),
    roofNote: Paged(z.string()),
    architecturalNote: Paged(z.string()),
  }),
  utilities: z.object({
    water: Paged(z.string()),
    sewage: Paged(z.string()),
    electricity: Paged(z.string()),
    heating: Paged(z.string()),
    access: Paged(z.string()),
  }),
  surveysRequired: z.array(z.object({ name: z.string(), page: z.number().int().nullable(), mandatory: z.boolean() })).max(20),
  heritage: Paged(z.object({ applies: z.boolean(), note: z.string().nullable() })),
  environment: Paged(z.string()),
  fireSafety: Paged(z.string()),
  conditions: z.array(z.object({
    topic: z.string().max(80),
    text: z.string().max(1200),
    page: z.number().int().nullable(),
    mandatory: z.boolean(),
  })).max(60),
  language: z.enum(['et', 'en', 'pl', 'other']),
  warnings: z.array(z.string().max(200)).max(10),
})
export type PlanningConditions = z.infer<typeof PlanningConditionsSchema>

export const BriefSchema = z.object({
  project: z.object({
    name: Paged(z.string()),
    client: Paged(z.string()),
    address: Paged(z.string()),
    county: Paged(z.string()),
  }),
  parameters: z.object({
    buildingType: Paged(z.enum(['detached_house', 'apartment_block', 'semi_detached', 'terraced', 'non_residential', 'other'])),
    workType: Paged(z.enum(['new_build', 'extension', 'reconstruction', 'change_of_use', 'demolition'])),
    grossFloorArea: Paged(NumWithUnit),
    height: Paged(NumWithUnit),
    storeys: Paged(Num),
    apartments: Paged(Num),
    parkingSpaces: Paged(Num),
    timberStructure: Paged(z.boolean()),
    heritage: Paged(z.boolean()),
    detailedPlanExists: Paged(z.boolean()),
    districtHeatingAvailable: Paged(z.boolean()),
    urbanArea: Paged(z.boolean()),
  }),
  language: z.enum(['et', 'en', 'pl', 'other']),
  warnings: z.array(z.string().max(200)).max(10),
})
export type Brief = z.infer<typeof BriefSchema>

/** Coerce what Estonian documents actually produce: decimal commas, numbers-as-strings, wrapped enums. */
export function normalisePlanningConditions(raw: unknown): unknown {
  const r = (typeof raw === 'object' && raw) ? JSON.parse(JSON.stringify(raw)) : {}
  const num = (v: unknown): number | null => {
    if (typeof v === 'number') return v
    if (typeof v === 'string') { const n = parseFloat(v.replace(/\s/g, '').replace(',', '.')); return Number.isFinite(n) ? n : null }
    return null
  }
  const unwrap = (v: any) => (v && typeof v === 'object' && 'value' in v && !('unit' in v) ? v.value : v)
  if (r.document) {
    r.document.kind = unwrap(r.document.kind) ?? 'other'
    if (!['planning_conditions', 'other'].includes(r.document.kind)) r.document.kind = 'other'
  }
  if (r.limits) {
    for (const k of ['maxFootprint', 'maxHeight', 'minSetback']) {
      const f = r.limits[k]
      if (f && typeof f === 'object') {
        if (f.value && typeof f.value === 'object') f.value = { value: num(f.value.value), unit: f.value.unit ?? null }
        else if (f.value !== null && f.value !== undefined) f.value = { value: num(f.value), unit: null }
      }
    }
    if (r.limits.maxStoreys && typeof r.limits.maxStoreys === 'object') r.limits.maxStoreys.value = num(r.limits.maxStoreys.value)
    // Model cited the evidence but left the number out: derive from the quote (deterministic, flagged lower confidence)
    const st = r.limits.maxStoreys
    if (st && typeof st === 'object' && st.value === null && typeof st.quote === 'string') {
      const m = st.quote.match(/korruste arv:?\s*(?:kuni\s*)?(\d)/i) || st.quote.match(/kuni\s*(\d)\s*korrus/i) || st.quote.match(/(ühe|kahe|kolme|nelja)korruseline/i)
      if (m) { const w: Record<string, number> = { ühe: 1, kahe: 2, kolme: 3, nelja: 4 }; st.value = w[m[1]?.toLowerCase()] ?? parseInt(m[1], 10); st.confidence = Math.min(st.confidence ?? 0.5, 0.7); st.derived = true }
    }
    const h = r.limits.maxHeight
    if (h && typeof h === 'object' && (h.value === null || h.value?.value === null) && typeof h.quote === 'string') {
      const m = h.quote.match(/kõrgus[^\d]{0,30}(\d+[,.]?\d*)\s*m\b/i)
      if (m) { h.value = { value: num(m[1]), unit: 'm' }; h.confidence = Math.min(h.confidence ?? 0.5, 0.7); h.derived = true }
    }
  }
  for (const k of ['language']) if (r[k] && typeof r[k] === 'object') r[k] = unwrap(r[k])
  // Walk every Paged leaf: default confidence, clamp quote length, drop non-numeric pages
  const walk = (o: any) => {
    if (!o || typeof o !== 'object') return
    if (Array.isArray(o)) { o.forEach(walk); return }
    if ('value' in o && !('unit' in o)) {
      if (typeof o.confidence !== 'number') o.confidence = o.value === null || o.value === undefined ? 0 : 0.5
      if (typeof o.quote === 'string' && o.quote.length > 300) o.quote = o.quote.slice(0, 297) + '…'
      if (o.page !== undefined && o.page !== null && (typeof o.page !== 'number' || !Number.isInteger(o.page) || o.page < 1)) o.page = null
      if (o.value === undefined) o.value = null
    }
    for (const v of Object.values(o)) walk(v)
  }
  walk(r)
  // String-typed Paged fields: the model sometimes answers true/false/number — keep as text, never drop
  const stringy = [...['number','issuedAt','issuer','validUntil','applicationNumber'].map((k) => ['document', k]), ...['ehrCode','address','cadastralUnit','county','municipality','landUse'].map((k) => ['site', k]), ['building','buildingName'], ['limits','roofNote'], ['limits','architecturalNote'], ...['water','sewage','electricity','heating','access'].map((k) => ['utilities', k])]
  for (const [a, b] of stringy) { const f = r[a]?.[b]; if (f && typeof f === 'object' && f.value !== null && f.value !== undefined && typeof f.value !== 'string') f.value = String(f.value) }
  for (const k of ['environment', 'fireSafety']) { const f = r[k]; if (f && typeof f === 'object' && f.value !== null && f.value !== undefined && typeof f.value !== 'string') f.value = String(f.value) }
  if (!Array.isArray(r.warnings)) r.warnings = []
  r.warnings = r.warnings.filter((w: unknown) => typeof w === 'string').map((w: string) => w.slice(0, 200)).slice(0, 10)
  if (!Array.isArray(r.conditions)) r.conditions = []
  r.conditions = r.conditions.map((c: any) => ({ ...c, topic: String(c?.topic ?? '').slice(0, 80), text: String(c?.text ?? '').slice(0, 1200), mandatory: c?.mandatory !== false, page: Number.isInteger(c?.page) ? c.page : null })).slice(0, 60)
  if (!Array.isArray(r.surveysRequired)) r.surveysRequired = []
  if (r.building && !Array.isArray(r.building.useCodes)) r.building.useCodes = []
  if (r.building) r.building.useCodes = r.building.useCodes.filter((u: any) => u && (typeof u.code === 'string' || typeof u.code === 'number')).map((u: any) => ({ code: String(u.code), label: u.label == null ? null : String(u.label), share: u.share == null ? null : String(u.share) })).slice(0, 10)
  r.surveysRequired = r.surveysRequired.map((x: any) => {
    const name = typeof x === 'string' ? x : x?.name && typeof x.name === 'object' ? (x.name.value ?? x.name.text ?? null) : x?.name
    return name ? { name: String(name).slice(0, 120), page: Number.isInteger(x?.page) ? x.page : null, mandatory: x?.mandatory !== false } : null
  }).filter(Boolean).slice(0, 20)
  return r
}

import { describe, it, expect } from 'vitest'
import { PlanningConditionsSchema, normalisePlanningConditions } from '@/lib/ai/schemas-documents'

const paged = (value: unknown, extra: Record<string, unknown> = {}) => ({ value, confidence: 0.9, page: 2, quote: 'q', ...extra })
function base(over: Record<string, unknown> = {}) {
  return {
    document: { kind: 'planning_conditions', number: paged('2611802/03126'), issuedAt: paged('2026-07-08'), issuer: paged('Viljandi Vallavalitsus'), validUntil: paged('2031-07-08'), legalBasis: paged('EhS_26') },
    site: { ehrCode: paged('121458489'), address: paged('Rahetsema tee 23'), cadastralUnit: paged('89001:001:1093'), county: paged('Viljandi'), municipality: paged('Viljandi vald'), landUse: paged('elamumaa 100%') },
    building: { plannedActivity: paged('new_build'), useCodes: [{ code: '11101', label: 'Üksikelamu', share: '1/1' }], buildingName: paged('Üksikelamu') },
    limits: { maxFootprint: paged({ value: 15, unit: '%' }), maxHeight: paged({ value: 6.5, unit: 'm' }), maxStoreys: paged(2), minSetback: paged({ value: 4, unit: 'm' }), roofNote: paged(null), architecturalNote: paged('x') },
    utilities: { water: paged('x'), sewage: paged('x'), electricity: paged('x'), heating: paged(null), access: paged(null) },
    surveysRequired: [{ name: 'geodeetiline', page: 5, mandatory: true }],
    heritage: paged({ applies: false, note: null }),
    environment: paged('x'), fireSafety: paged('x'),
    conditions: [{ topic: 'Kõrgus', text: 'kuni 6,5 m', page: 5, mandatory: true }],
    language: 'et', warnings: [],
    ...over,
  }
}

describe('normalisePlanningConditions — what Estonian documents actually produce', () => {
  it('passes a clean document through unchanged', () => {
    expect(PlanningConditionsSchema.safeParse(normalisePlanningConditions(base())).success).toBe(true)
  })
  it('coerces decimal commas and numbers-as-strings, keeps units', () => {
    const r = normalisePlanningConditions(base({ limits: { ...base().limits, maxHeight: paged({ value: '6,5', unit: 'm' }), maxStoreys: paged('2') } })) as any
    expect(r.limits.maxHeight.value).toEqual({ value: 6.5, unit: 'm' })
    expect(r.limits.maxStoreys.value).toBe(2)
    expect(PlanningConditionsSchema.safeParse(r).success).toBe(true)
  })
  it('unwraps a wrapped enum, defaults missing confidence, clamps long quotes/warnings', () => {
    const d = base({ warnings: ['w'.repeat(500)] }) as any
    d.document.kind = { value: 'planning_conditions', confidence: 1 }
    d.limits.maxStoreys = { value: null, page: null }
    d.fireSafety = paged('x', { quote: 'y'.repeat(400) })
    const r = normalisePlanningConditions(d) as any
    expect(r.document.kind).toBe('planning_conditions')
    expect(r.limits.maxStoreys.confidence).toBe(0)
    expect(r.fireSafety.quote.length).toBeLessThanOrEqual(300)
    expect(r.warnings[0].length).toBe(200)
    expect(PlanningConditionsSchema.safeParse(r).success).toBe(true)
  })
  it('stringifies booleans/numbers in string fields; drops useCodes without a code; unwraps survey name objects', () => {
    const d = base() as any
    d.utilities.water = paged(true)
    d.building.useCodes = [{ code: null, label: 'x', share: null }, { code: 12744, label: null, share: null }]
    d.surveysRequired = [{ name: { value: 'radoon' }, page: 3, mandatory: true }, 'müra']
    const r = normalisePlanningConditions(d) as any
    expect(r.utilities.water.value).toBe('true')
    expect(r.building.useCodes).toEqual([{ code: '12744', label: null, share: null }])
    expect(r.surveysRequired.map((s: any) => s.name)).toEqual(['radoon', 'müra'])
    expect(PlanningConditionsSchema.safeParse(r).success).toBe(true)
  })
  it('derives storeys/height from the quote when the model left value null, with capped confidence', () => {
    const d = base() as any
    d.limits.maxStoreys = paged(null, { quote: 'Korruste arv: kuni 2', confidence: 0.95 })
    d.limits.maxHeight = paged(null, { quote: 'Ehitise kõrgus (m) kuni 8 m ja kuni 2 korrust', confidence: 0.95 })
    const r = normalisePlanningConditions(d) as any
    expect(r.limits.maxStoreys).toMatchObject({ value: 2, confidence: 0.7, derived: true })
    expect(r.limits.maxHeight).toMatchObject({ value: { value: 8, unit: 'm' }, confidence: 0.7, derived: true })
    const w = normalisePlanningConditions({ ...base(), limits: { ...base().limits, maxStoreys: paged(null, { quote: 'projekteerida kahekorruseline koolihoone' }) } }) as any
    expect(w.limits.maxStoreys.value).toBe(2)
  })
  it('does not derive when the quote has no number', () => {
    const r = normalisePlanningConditions({ ...base(), limits: { ...base().limits, maxStoreys: paged(null, { quote: 'korruselisus lahendada projektiga' }) } }) as any
    expect(r.limits.maxStoreys.value).toBeNull()
  })
})

import { describe, it, expect, vi } from 'vitest'
vi.mock('@/lib/prisma', () => ({ prisma: {} }))
vi.mock('@/lib/prisma-modules', () => ({ modulesPrisma: {} }))
import { DecisionNoticeSchema, normaliseDecisionNotice, type DecisionNotice } from '../schemas-documents'
import { mapDecisionNotice, conditionTiming, commencementDeadline, conditionSignals, pinApplicationReference, verifyQuotes } from '../map-project'
import { decisionNoticeUser, DECISION_NOTICE_SYSTEM } from '../prompts/decision-notice'
import { supersededRunIds } from '../project-setup'
import { mapPlanningConditions } from '../map-project'

/**
 * Fixtures are cut down from public English decision notices:
 *  - Brent 22/4128 (full, 28 conditions, 13 pre-commencement)
 *  - North Yorkshire (Craven) ZA25/26701/HH (householder, grouped headings)
 *  - Copeland 4/22/2120/0R1 (reserved matters on outline 4/21/2470/0O1)
 *  - Camden 2024/2028/P (householder refusal)
 */
const P = <T,>(value: T | null, quote: string | null = null, page: number | null = 1, confidence = 0.95) => ({ value, confidence: value === null ? 0 : confidence, page: value === null ? null : page, quote })
const cond = (number: number, text: string, timing: DecisionNotice['conditions'][number]['timing'] = 'other', page = 2, heading: string | null = null) => ({ number, heading, text, reason: null, page, timing })

const brent = (): DecisionNotice => ({
  document: {
    kind: 'decision_notice', reference: P('22/4128', 'Application No: 22/4128'), authority: P('London Borough of Brent', 'BRENT COUNCIL'),
    decisionDate: P('2023-06-13', 'Date: 13/06/2023'), decision: P('granted' as const, 'hereby GRANT permission'), applicationType: P('full' as const, null), parentPermission: P(null),
  },
  site: { address: P('776 & 778, Harrow Road, Wembley, HA0 2HE', '776 & 778, Harrow Road, Wembley, HA0 2HE'), postcode: P('HA0 2HE', 'HA0 2HE') },
  proposal: {
    description: P('Demolition of 2 existing dwellings and construction of 4x new three storey dwellinghouses', 'Demolition of 2 existing dwellings'),
    workType: P('new_build' as const, 'Demolition of 2 existing dwellings and construction of 4x new three storey dwellinghouses'),
    buildingType: P('terraced' as const, '4x new three storey dwellinghouses', 1, 0.6),
    dwellings: P(4, '4x new three storey dwellinghouses'), storeys: P(3, 'three storey dwellinghouses'),
  },
  approvedPlans: [{ ref: '1463-001 Rev. B', title: null }, { ref: '1463-101 Rev. G', title: null }, { ref: 'Fire Statement', title: null }],
  conditions: [
    cond(1, 'The development to which this permission relates must be begun not later than the expiration of three years beginning on the date of this permission.', 'other'),
    cond(2, 'The development hereby permitted shall be carried out in accordance with the following approved drawing(s) and/or document(s):', 'other'),
    cond(3, 'No extensions or buildings shall be constructed within the curtilage of the dwellinghouses subject of this application, notwithstanding the provisions of Classes A, B, D, E & F of Part 1 Schedule 2 of the Town & Country Planning (General Permitted Development) Order 2015', 'other'),
    cond(4, 'The development hereby approved shall be designed so that mains water consumption does not exceed a target of 105 litres or less per person per day', 'other', 3),
    cond(5, 'The works shall be carried out in accordance with the approved Flood Risk Assessment Drainage Strategy prior to occupation of the development', 'other', 3),
    cond(10, 'Prior to the commencement of the development a Construction Method Statement shall be submitted to and approved in writing by the Local Planning Authority', 'other', 3),
    cond(11, 'Prior to development commencing, a Construction Ecological Management Plan shall be submitted to and approved in writing by the Local Planning Authority', 'other', 3),
    cond(16, 'No piling shall take place until a Piling Method Statement has been submitted to and approved in writing by the local planning authority', 'other', 4),
    cond(21, 'Details of materials for all external work shall be submitted to and approved in writing by the Local Planning Authority prior to commencement (but excluding demolition, site preparation and the laying of foundations).', 'other', 4),
    cond(28, 'Prior to first occupation of the development hereby approved, details of measures to prevent vehicle parking within the curtilage shall be submitted', 'other', 5),
  ],
  refusalReasons: [],
  timeLimitYears: P(3, 'expiration of three years', 2),
  language: 'en',
  warnings: [],
})

const camdenRefusal = (): DecisionNotice => ({
  ...brent(),
  document: { ...brent().document, reference: P('2024/2028/P', 'Application ref: 2024/2028/P'), authority: P('London Borough of Camden', 'London Borough of Camden'), decisionDate: P('2025-02-06', 'Date: 6 February 2025'), decision: P('refused' as const, 'Householder Application Refused'), applicationType: P('householder' as const, 'Householder Application') },
  proposal: { ...brent().proposal, workType: P('extension' as const, 'Erection of a part single part two storey rear extension'), buildingType: P('semi_detached' as const, 'pair of semi-detached properties'), dwellings: P(null), storeys: P(2, 'two storey') },
  approvedPlans: [{ ref: 'LP-01', title: null }],
  conditions: [],
  refusalReasons: [{ number: 1, text: 'The proposed extension, by reason of its height, bulk and siting would be harmful to the character and appearance of the host building', page: 1 }],
  timeLimitYears: P(null),
})

const copelandRM = (): DecisionNotice => ({
  ...brent(),
  document: { ...brent().document, reference: P('4/22/2120/0R1', 'APPLICATION No: 4/22/2120/0R1'), authority: P('Copeland Borough Council', null), decisionDate: P('2022-07-21', '21st July 2022'), decision: P('granted' as const, 'APPROVAL OF RESERVED MATTERS HAS BEEN GRANTED'), applicationType: P('reserved_matters' as const, 'APPROVAL OF RESERVED MATTERS'), parentPermission: P('4/21/2470/0O1', 'OUTLINE APPROVAL 4/21/2470/0O1') },
  conditions: [
    cond(1, 'The development must be carried out in accordance with the plans submitted and in accordance with the conditions attached to the outline planning permission.', 'compliance', 1),
    cond(3, 'No superstructure must be erected until samples and details of the materials to be used in the construction of the external surfaces have been submitted to and approved in writing', 'pre_superstructure', 2),
    cond(5, 'The drainage of the development hereby approved, must be carried out in accordance with the following approved documents. Prior to the first occupation of the proposed development, the drainage schemes must be completed', 'pre_occupation', 3),
  ],
  timeLimitYears: P(null),
})

describe('decision notices — condition timing', () => {
  it('reads the trigger from the wording when the model left it unclassified', () => {
    expect(conditionTiming(brent().conditions[0].text, 'other')).toBe('time_limit')
    expect(conditionTiming(brent().conditions[1].text, 'other')).toBe('approved_plans')
    expect(conditionTiming(brent().conditions[4].text, 'other')).toBe('pre_occupation')
    expect(conditionTiming(brent().conditions[5].text, 'other')).toBe('pre_commencement')
    expect(conditionTiming(brent().conditions[6].text, 'other')).toBe('pre_commencement')
    expect(conditionTiming(brent().conditions[8].text, 'other')).toBe('pre_commencement')
    expect(conditionTiming(brent().conditions[9].text, 'compliance')).toBe('pre_occupation')
  })
  it('never overrides a trigger the model found with "approved plans"', () => {
    expect(conditionTiming(copelandRM().conditions[2].text, 'pre_occupation')).toBe('pre_occupation')
  })
  it('recognises above-ground / superstructure triggers', () => {
    expect(conditionTiming('Prior to any above ground works, details of biodiversity enhancements shall be submitted', 'other')).toBe('pre_superstructure')
  })
})

describe('decision notices — commencement deadline', () => {
  it('is the day before the anniversary ("beginning with the date of this permission")', () => {
    expect(commencementDeadline('2023-06-13', 3)).toBe('2026-06-12')
    expect(commencementDeadline('2025-06-20', 3)).toBe('2028-06-19')
    expect(commencementDeadline('2024-02-29', 3)).toBe('2027-02-28')
  })
  it('refuses nonsense', () => {
    expect(commencementDeadline(null, 3)).toBeNull()
    expect(commencementDeadline('13/06/2023', 3)).toBeNull()
    expect(commencementDeadline('2023-06-13', 0)).toBeNull()
    expect(commencementDeadline('2023-06-13', 50)).toBeNull()
  })
})

describe('decision notices — signals that change the Building Regs checklist', () => {
  it('finds M4(2), M4(3), water targets, BNG and removed PD rights', () => {
    const s = conditionSignals(['units shall be built to Part M4 (2)', 'flat 3 to M4(3)', 'not exceed 110 litres per person per day', 'A Biodiversity Gain Plan shall be submitted', 'notwithstanding the provisions of the General Permitted Development Order 2015 no extensions'])
    expect(s).toEqual({ m42: true, m43: true, waterLitres: 110, bng: true, pdRemoved: true })
    expect(conditionSignals(['materials to match the existing'])).toEqual({ m42: false, m43: false, waterLitres: null, bng: false, pdRemoved: false })
  })
})

describe('decision notices — mapper', () => {
  it('maps a full permission: England, deadline first, every condition cited, plans as one item', () => {
    const m = mapDecisionNotice(brent())
    expect(m.kind).toBe('decision_notice')
    expect(m.prefills.find((p) => p.key === 'jurisdiction')).toMatchObject({ value: 'GB', preAccept: true })
    expect(m.prefills.find((p) => p.key === 'workType')).toMatchObject({ value: 'new_build', preAccept: true })
    expect(m.prefills.find((p) => p.key === 'buildingType')).toMatchObject({ value: 'terraced', preAccept: false }) // 0.6 confidence
    expect(m.prefills.find((p) => p.key === 'apartments')?.value).toBe(4)
    expect(m.conditions[0]).toMatchObject({ topic: 'Commencement deadline', timing: 'time_limit', mandatory: true })
    expect(m.conditions[0].text).toContain('2026-06-12')
    expect(m.document).toMatchObject({ number: '22/4128', issuer: 'London Borough of Brent', validUntil: '2026-06-12', legalBasis: 'full' })
    const c10 = m.conditions.find((c) => c.citation === '22/4128 condition 10 p.3')!
    expect(c10).toMatchObject({ timing: 'pre_commencement', source: 'London Borough of Brent', topic: 'Before commencement' })
    expect(m.conditions.find((c) => c.topic === 'Approved plans' && c.citation === '22/4128')?.text).toContain('1463-101 Rev. G')
    expect(m.bounds).toEqual({ maxHeightM: null, maxStoreys: null, maxFootprint: null, minSetbackM: null })
    expect(m.warnings.join(' ')).toMatch(/105 litres/)
    expect(m.warnings.join(' ')).toMatch(/removes permitted development/)
    expect(m.warnings.join(' ')).toMatch(/3 pre-commencement conditions/)
    expect(m.warnings.join(' ')).toMatch(/time limit expired on 2026-06-12/) // decided June 2023
  })

  it('a refusal carries reasons (not mandatory), no deadline, no plans item, and says so loudly', () => {
    const m = mapDecisionNotice(camdenRefusal())
    expect(m.conditions).toHaveLength(1)
    expect(m.conditions[0]).toMatchObject({ topic: 'Reason for refusal 1', mandatory: false, timing: 'refusal', citation: '2024/2028/P reason 1' })
    expect(m.document.validUntil).toBeNull()
    expect(m.warnings[0]).toMatch(/REFUSED/)
  })

  it('reserved matters: no invented deadline, asks for the outline permission', () => {
    const m = mapDecisionNotice(copelandRM())
    expect(m.conditions.some((c) => c.topic === 'Commencement deadline')).toBe(false)
    expect(m.warnings.join(' ')).toMatch(/earlier permission \(4\/21\/2470\/0O1\)/)
    expect(m.conditions.map((c) => c.timing)).toEqual(['compliance', 'pre_superstructure', 'pre_occupation', 'approved_plans'])
  })

  it('defaults to 3 years when the time-limit condition exists but the number was missed', () => {
    const dn = brent(); dn.timeLimitYears = P(null)
    expect(mapDecisionNotice(dn).document.validUntil).toBe('2026-06-12')
  })

  it('warns when a permission has no conditions at all', () => {
    const dn = brent(); dn.conditions = []
    expect(mapDecisionNotice(dn).warnings.join(' ')).toMatch(/No conditions were found/)
  })
})

describe('decision notices — reference pinning and quote verification', () => {
  const pages = ['BRENT COUNCIL\nApplication No: 22/4128\nI refer to your application', 'SCHEDULE "B"\nApplication No: 22/4128\nCONDITIONS']
  it('pins the reference to the "Application No" phrase', () => {
    const dn = brent(); dn.document.reference = P('1463-101', 'drawing')
    expect(pinApplicationReference(dn, pages).document.reference).toMatchObject({ value: '22/4128', page: 1 })
  })
  it('ignores the parent permission and leaves ambiguous documents alone', () => {
    const dn = copelandRM()
    const rm = pinApplicationReference({ ...dn, document: { ...dn.document, reference: P(null) } }, ['APPLICATION No: 4/22/2120/0R1 PURSUANT TO OUTLINE APPROVAL Ref: 4/21/2470/0O1'])
    expect(rm.document.reference.value).toBe('4/22/2120/0R1')
    const two = pinApplicationReference(brent(), ['Application No: 22/4128', 'Application No: 22/9999'])
    expect(two.document.reference.value).toBe('22/4128')
    expect(two.document.reference.quote).toBe('Application No: 22/4128') // unchanged, model value kept
  })
  it('conditions whose wording is not in the document are left unverified', () => {
    const m = verifyQuotes(mapDecisionNotice(brent()), ['Prior to the commencement of the development a Construction Method Statement shall be submitted to and approved in writing by the Local Planning Authority'])
    expect(m.conditions.find((c) => c.citation.startsWith('22/4128 condition 10'))?.verified).toBe(true)
    expect(m.conditions.find((c) => c.citation.startsWith('22/4128 condition 28'))?.verified).toBe(false)
  })
})

describe('decision notices — normaliser and schema', () => {
  it('coerces what models actually return', () => {
    const raw = {
      document: { reference: '22/4128', authority: { value: 'Brent' }, decisionDate: { value: '2023-06-13', confidence: 2 }, decision: { value: { value: 'granted' } }, applicationType: 'planning permission', parentPermission: null },
      site: { address: 'x' },
      proposal: { workType: { value: 'other' }, buildingType: 'house', dwellings: { value: 'four' }, storeys: { value: '3 storeys' } },
      approvedPlans: ['1463-001 Rev. B', { reference: 'BP/5' }, {}],
      conditions: ['Prior to commencement ...', { number: '4', text: 'water', timing: 'weird', page: 0 }, { number: 5 }],
      refusalReasons: 'none',
      timeLimitYears: { value: 'three' },
      language: { value: 'en' },
    }
    const out = DecisionNoticeSchema.parse(normaliseDecisionNotice(raw))
    expect(out.document.kind).toBe('decision_notice') // decision + reference present, kind omitted
    expect(out.document.authority.value).toBe('Brent')
    expect(out.document.decisionDate.confidence).toBe(1)
    expect(out.document.decision.value).toBe('granted')
    expect(out.document.applicationType.value).toBe('other')
    expect(out.proposal.workType.value).toBeNull()
    expect(out.proposal.buildingType.value).toBe('other')
    expect(out.proposal.dwellings.value).toBe(4)
    expect(out.proposal.storeys.value).toBe(3)
    expect(out.timeLimitYears.value).toBe(3)
    expect(out.approvedPlans.map((p) => p.ref)).toEqual(['1463-001 Rev. B', 'BP/5'])
    expect(out.conditions).toHaveLength(2)
    expect(out.conditions[1]).toMatchObject({ number: 4, timing: 'other', page: null })
    expect(out.refusalReasons).toEqual([])
  })
  it('an explicit "other" kind is kept, and the mapper warns', () => {
    const out = DecisionNoticeSchema.parse(normaliseDecisionNotice({ document: { kind: 'other', reference: '1', decision: 'granted' } }))
    expect(out.document.kind).toBe('other')
    expect(mapDecisionNotice(out).warnings.join(' ')).toMatch(/may not be a planning decision notice/)
  })
  it('the prompt treats the document as data and marks pages', () => {
    expect(DECISION_NOTICE_SYSTEM).toMatch(/untrusted DATA/)
    expect(decisionNoticeUser(['a', 'b'])).toContain('<<PAGE 2>>\nb')
  })
})

describe('decision notices — review fixes', () => {
  it('common English pre-commencement phrasings are caught whatever the model said', () => {
    for (const t of ['Development shall not commence until a drainage scheme has been approved', 'No development, other than demolition, shall take place until a CEMP has been approved', 'No part of the development shall commence until details are approved', 'The works shall not begin until the surveys are approved', 'Before development commences, a tree protection plan shall be submitted']) {
      expect(conditionTiming(t, 'compliance'), t).toBe('pre_commencement')
      expect(conditionTiming(t, 'approved_plans'), t).toBe('pre_commencement')
    }
  })
  it('a s73 variation and reserved matters get no deadline of their own; outline gets a reserved-matters deadline', () => {
    const s73 = brent(); s73.document.applicationType = P('variation_of_condition' as const, 'Variation of condition 2'); s73.document.parentPermission = P('21/1000', '21/1000')
    const m73 = mapDecisionNotice(s73)
    expect(m73.document.validUntil).toBeNull()
    expect(m73.warnings.join(' ')).toMatch(/cannot extend the time limit/)
    const outline = brent(); outline.document.applicationType = P('outline' as const, 'Outline')
    const mo = mapDecisionNotice(outline)
    expect(mo.conditions[0]).toMatchObject({ topic: 'Reserved matters deadline', derived: true })
    expect(mo.warnings.join(' ')).not.toMatch(/time limit expired/)
  })
  it('an unconfirmed decision date gives no deadline, and says so', () => {
    const dn = brent(); dn.document.decisionDate = P('2023-06-13', null, 1, 0.5)
    const m = mapDecisionNotice(dn)
    expect(m.document.validUntil).toBeNull()
    expect(m.warnings.join(' ')).toMatch(/could not be confirmed/)
  })
  it('derived items (deadline, plans list) count as verified', () => {
    const m = verifyQuotes(mapDecisionNotice(brent()), ['unrelated text'])
    expect(m.conditions.filter((c) => c.derived).every((c) => c.verified)).toBe(true)
  })
  it('permitted-development removal needs both phrases in the same condition', () => {
    expect(conditionSignals(['No details shall be submitted', 'permitted development rights are noted']).pdRemoved).toBe(false)
  })
})

describe('which earlier documents a confirmed one replaces', () => {
  const dnRun = (id: string, number: string, legalBasis = 'full', parent: string | null = null) => ({ id, mapping: { ...mapDecisionNotice(brent()), document: { ...mapDecisionNotice(brent()).document, number, legalBasis, parent } } })
  const ptRun = (id: string) => ({ id, mapping: mapPlanningConditions({ document: { kind: 'planning_conditions', number: { value: '1', confidence: 1 }, issuedAt: { value: null, confidence: 0 }, issuer: { value: null, confidence: 0 }, validUntil: { value: null, confidence: 0 }, legalBasis: { value: null, confidence: 0 } }, site: { ehrCode: { value: null, confidence: 0 }, address: { value: null, confidence: 0 }, cadastralUnit: { value: null, confidence: 0 }, county: { value: null, confidence: 0 }, municipality: { value: null, confidence: 0 }, landUse: { value: null, confidence: 0 } }, building: { plannedActivity: { value: null, confidence: 0 }, useCodes: [], buildingName: { value: null, confidence: 0 } }, limits: { maxFootprint: { value: null, confidence: 0 }, maxHeight: { value: null, confidence: 0 }, maxStoreys: { value: null, confidence: 0 }, minSetback: { value: null, confidence: 0 }, roofNote: { value: null, confidence: 0 }, architecturalNote: { value: null, confidence: 0 } }, utilities: { water: { value: null, confidence: 0 }, sewage: { value: null, confidence: 0 }, electricity: { value: null, confidence: 0 }, heating: { value: null, confidence: 0 }, access: { value: null, confidence: 0 } }, surveysRequired: [], heritage: { value: null, confidence: 0 }, environment: { value: null, confidence: 0 }, fireSafety: { value: null, confidence: 0 }, conditions: [], language: 'et', warnings: [] } as any) })
  const prior = [dnRun('lbc', '22/4129/LBC'), dnRun('same', '22/4128'), dnRun('outline', '21/1000'), ptRun('pt')]
  it('a decision notice replaces only an earlier upload of the same application', () => {
    expect(supersededRunIds(dnRun('new', '22/4128').mapping, prior)).toEqual(['same'])
  })
  it('a s73 variation also replaces the permission it varies', () => {
    expect(supersededRunIds(dnRun('new', '23/0500', 'variation_of_condition', '21/1000').mapping, prior)).toEqual(['outline'])
  })
  it('reserved matters leave the outline alone', () => {
    expect(supersededRunIds(dnRun('new', '23/0600', 'reserved_matters', '21/1000').mapping, prior)).toEqual([])
  })
  it('an Estonian PT still replaces every earlier PT, and nothing else', () => {
    expect(supersededRunIds(ptRun('new').mapping, prior)).toEqual(['pt'])
  })
})

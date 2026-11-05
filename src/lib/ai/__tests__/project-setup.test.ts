import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/** Sprint 3.B2 — ingest guards, PT → parameters mapper, confirm contract. */

const FIX = (f: string) => new Uint8Array(readFileSync(resolve(__dirname, 'fixtures', f)))

// ── Ingest ──────────────────────────────────────────────────
import { sniffPdf, paginateText, capPages, cleanText, pdfToPages, IngestError, INGEST_LIMITS } from '@/lib/ai/document-ingest'

describe('document ingest', () => {
  it('sniffs PDF bytes, not the declared mime type', () => {
    expect(sniffPdf(FIX('pt-national-synthetic.pdf'))).toBe(true)
    expect(sniffPdf(new TextEncoder().encode('%PDX-1.4 nope'))).toBe(false)
    expect(sniffPdf(new TextEncoder().encode('<html>'))).toBe(false)
  })
  it('rejects non-PDF bytes and oversize files with typed failures', async () => {
    await expect(pdfToPages(new TextEncoder().encode('<html>just html</html>'))).rejects.toMatchObject({ failure: 'not_pdf' })
    const big = new Uint8Array(INGEST_LIMITS.maxBytes + 1); big.set([0x25, 0x50, 0x44, 0x46, 0x2d])
    await expect(pdfToPages(big)).rejects.toMatchObject({ failure: 'too_large' })
  })
  it('extracts page-split text from a real PDF', async () => {
    const pages = await pdfToPages(FIX('pt-national-synthetic.pdf'))
    expect(pages).toHaveLength(3)
    expect(pages[0]).toMatch(/Projekteerimistingimused nr 2699999\/00001/)
    expect(pages[1]).toMatch(/Ehitisregistri kood 120000001/)
    expect(pages[2]).toMatch(/kuni 7,5 m/)
  })
  it('fails a scanned PDF (no text layer) with a message the architect can act on', async () => {
    await expect(pdfToPages(FIX('scan-no-text.pdf'))).rejects.toSatisfy((e: unknown) => e instanceof IngestError && e.failure === 'no_text_layer' && /digital original/.test(e.message))
  })
  it('paginates pasted text, strips control chars, caps total chars', () => {
    expect(cleanText('a\u0000b\u0007c  \nd\n\n\n\ne')).toBe('abc\nd\n\ne')
    const pages = paginateText('line\n'.repeat(3000))
    expect(pages.length).toBeGreaterThan(2)
    expect(pages.every((p) => p.length <= 4000)).toBe(true)
    const capped = capPages(['x'.repeat(50_000), 'y'.repeat(50_000)])
    expect(capped.join('').length).toBe(INGEST_LIMITS.maxChars)
  })
})

// ── Mapper ──────────────────────────────────────────────────
import { mapPlanningConditions, buildingTypeFromUseCode } from '@/lib/ai/map-project'
import type { PlanningConditions } from '@/lib/ai/schemas-documents'

const P = <T,>(value: T, page: number | null = 3, confidence = 0.95, quote: string | null = 'q') => ({ value, confidence, page, quote })
function pt(over: Partial<PlanningConditions> = {}): PlanningConditions {
  return {
    document: { kind: 'planning_conditions', number: P('2699999/00001', 1), issuedAt: P('2026-03-02', 1), issuer: P('Näidise Vallavalitsus', 1), validUntil: P('2031-03-02', 1), legalBasis: P('EhS_26' as const, 2) },
    site: { ehrCode: P('120000001', 2), address: P('Kase tee 7', 2), cadastralUnit: P(null as string | null, null, 0), county: P('Näidise maakond', 2), municipality: P('Näidise vald', 2), landUse: P('elamumaa 100%', 3) },
    building: { plannedActivity: P('new_build' as const, 3), useCodes: [{ code: '11101', label: 'Üksikelamu', share: '1/1' }], buildingName: P('Üksikelamu', 2) },
    limits: { maxFootprint: P({ value: 15, unit: '%' }), maxHeight: P({ value: 7.5, unit: 'm' }), maxStoreys: P(2), minSetback: P({ value: 4, unit: 'm' }), roofNote: P(null as string | null, null, 0), architecturalNote: P('x') },
    utilities: { water: P('tehniliste tingimuste kohaselt'), sewage: P('lokaalne kogumismahuti'), electricity: P(null as string | null, null, 0), heating: P(null as string | null, null, 0), access: P(null as string | null, null, 0) },
    surveysRequired: [{ name: 'Geodeetiline alusplaan', page: 3, mandatory: true }, { name: 'Radooniuuring', page: 3, mandatory: false }],
    heritage: P({ applies: false, note: null }),
    environment: P('kehtestatud normide kohaselt'), fireSafety: P('TP3'),
    conditions: [{ topic: 'Arhitektuur', text: 'Sobituda piirkonna hoonestuslaadiga', page: 3, mandatory: true }, { topic: 'Katus', text: 'Katusekalde erinevused alla 5 kraadi ei ole lubatud', page: 3, mandatory: true }],
    language: 'et', warnings: [],
    ...over,
  }
}

describe('mapPlanningConditions', () => {
  const m = mapPlanningConditions(pt())
  const by = (k: string) => m.prefills.find((p) => p.key === k)
  it('maps use code, legal basis, county, activity to VALUE prefills', () => {
    expect(by('buildingType')).toMatchObject({ value: 'detached_house', kind: 'value', preAccept: true })
    expect(by('detailedPlanExists')).toMatchObject({ value: false, kind: 'value', preAccept: true })
    expect(by('county')).toMatchObject({ value: 'Näidise', kind: 'value' })
    expect(by('workType')).toMatchObject({ value: 'new_build', kind: 'value' })
    expect(by('jurisdiction')).toMatchObject({ value: 'EE' })
  })
  it('height and storeys are BOUNDS, never pre-accepted, labelled with ≤ (Suleyman)', () => {
    expect(by('height')).toMatchObject({ value: 7.5, kind: 'bound', label: '≤ 7.5 m', preAccept: false })
    expect(by('storeys')).toMatchObject({ value: 2, kind: 'bound', label: '≤ 2 storeys', preAccept: false })
    expect(m.bounds).toEqual({ maxHeightM: 7.5, maxStoreys: 2, maxFootprint: { value: 15, unit: '%' }, minSetbackM: 4 })
  })
  it('a high-confidence limit is still not pre-accepted', () => {
    const hi = mapPlanningConditions(pt({ limits: { ...pt().limits, maxHeight: P({ value: 7.5, unit: 'm' }, 3, 1) } }))
    expect(hi.prefills.find((p) => p.key === 'height')!.preAccept).toBe(false)
  })
  it('footprint in % stays %, and a height in a non-metre unit is not applied', () => {
    const w = mapPlanningConditions(pt({ limits: { ...pt().limits, maxHeight: P({ value: 25, unit: 'ft' }) } }))
    expect(w.bounds.maxHeightM).toBeNull()
    expect(w.warnings.some((x) => /ft/.test(x))).toBe(true)
  })
  it('conditions cite document number + page; footprint, setback, surveys and validity become conditions; duplicates removed', () => {
    const texts = m.conditions.map((c) => c.text)
    expect(m.conditions.every((c) => c.citation.startsWith('PT nr 2699999/00001'))).toBe(true)
    expect(m.conditions.find((c) => c.topic === 'Katus')!.citation).toBe('PT nr 2699999/00001 p.3')
    expect(texts).toContain('Maximum footprint 15%')
    expect(texts).toContain('Minimum setback 4m')
    expect(texts).toContain('Radooniuuring')
    expect(m.conditions.find((c) => c.text === 'Radooniuuring')!.mandatory).toBe(false)
    expect(texts.some((t) => /valid until 2031-03-02/.test(t))).toBe(true)
    expect(m.conditions.every((c) => c.source === 'Näidise Vallavalitsus')).toBe(true)
    const dup = mapPlanningConditions(pt({ conditions: [...pt().conditions, pt().conditions[0]] }))
    expect(dup.conditions.filter((c) => c.topic === 'Arhitektuur')).toHaveLength(1)
  })
  it('warns when document number is missing or kind is not planning conditions', () => {
    const w = mapPlanningConditions(pt({ document: { ...pt().document, kind: 'other', number: P(null as string | null, null, 0) } }))
    expect(w.warnings.join(' ')).toMatch(/Document number not found/)
    expect(w.warnings.join(' ')).toMatch(/may not be a planning-conditions/)
    expect(w.conditions[0].citation).toMatch(/^PT nr \?/)
  })
  it('use code table', () => {
    expect(buildingTypeFromUseCode('11101')).toBe('detached_house')
    expect(buildingTypeFromUseCode('11221')).toBe('apartment_block')
    expect(buildingTypeFromUseCode('12744')).toBe('non_residential')
    expect(buildingTypeFromUseCode(null)).toBeNull()
  })
})

// ── Confirm (service) ────────────────────────────────────────
type Row = Record<string, any>
const db = { runs: [] as Row[], items: [] as Row[], registers: [] as Row[], profiles: [] as Row[] }
const audit = vi.fn().mockResolvedValue(undefined)
const applied = { calls: [] as Row[] }

vi.mock('@/lib/rules/apply', () => ({
  APPLY_TX_OPTIONS: {},
  applyProjectParameters: vi.fn(async (_tx: unknown, input: Row) => {
    applied.calls.push(input)
    let reg = db.registers[0]
    if (!reg) { reg = { id: 'reg-1', projectId: input.projectId }; db.registers.push(reg) }
    db.profiles.push({ version: db.profiles.length + 1, sourceRunId: input.sourceRunId })
    return { profile: { id: 'p', version: db.profiles.length }, registerId: reg.id, checklist: [{ ruleId: 'EE.X', citation: '§ 1' }], ruleSetVersion: 'EE-1.0', diff: { added: [], removed: [], unchanged: [] } }
  }),
}))
const tx = {
  complianceItem: {
    deleteMany: vi.fn(async ({ where }: Row) => { const b = db.items.length; db.items = db.items.filter((i) => !(i.registerId === where.registerId && i.origin === where.origin && i.aiRunId === where.aiRunId)); return { count: b - db.items.length } }),
    createMany: vi.fn(async ({ data }: Row) => { for (const d of data) db.items.push({ id: `i${db.items.length + 1}`, ...d }); return { count: data.length } }),
  },
  aIRun: { update: vi.fn(async ({ where, data }: Row) => { const r = db.runs.find((x) => x.id === where.id)!; Object.assign(r, data); return r }) },
}
vi.mock('@/lib/prisma', () => ({ prisma: { aIRun: { findUnique: vi.fn(async ({ where }: Row) => db.runs.find((r) => r.id === where.id) ?? null) }, $transaction: vi.fn(async (fn: (t: unknown) => Promise<unknown>) => fn(tx)) } }))
vi.mock('@/lib/audit', () => ({ recordAuditEvent: (...a: unknown[]) => audit(...a), AuditActions: { AI_PROJECT_CONFIGURED: 'ai.project_configured' } }))

const { confirmProjectSetup } = await import('@/lib/ai/project-setup')
const PARAMS = { jurisdiction: 'EE', buildingType: 'detached_house', workType: 'new_build', grossFloorArea: 160, height: 7, storeys: 2, heatedArea: 150, enclosedNetArea: 150, detailedPlanExists: false }
const seed = (over: Row = {}) => { db.runs.push({ id: 'run-1', surface: 'PROJECT_SETUP', projectId: 'proj-1', status: 'AWAITING_CONFIRMATION', promptVersion: 'pt-0.2', model: 'mistral/x', inputSummary: JSON.stringify({ documentId: 'doc-1' }), mapping: mapPlanningConditions(pt()), ...over }) }
const base = { projectId: 'proj-1', organisationId: 'org-1', runId: 'run-1', actorProfileId: 'prof-1', actorAuthUserId: 'auth-1' }

beforeEach(() => { db.runs = []; db.items = []; db.registers = []; db.profiles = []; applied.calls = []; audit.mockClear() })

describe('confirmProjectSetup', () => {
  it('writes profile with sourceRunId, accepted conditions as MUNICIPALITY items citing the PT, marks run APPLIED, audits', async () => {
    seed()
    const r = await confirmProjectSetup({ ...base, parameters: PARAMS, acceptedConditions: [0, 1, 2] })
    expect(applied.calls[0]).toMatchObject({ sourceRunId: 'run-1', createdBy: 'prof-1' })
    expect(r.municipalItems).toBe(3)
    expect(db.items).toHaveLength(3)
    expect(db.items.every((i) => i.origin === 'MUNICIPALITY' && i.aiRunId === 'run-1' && i.ruleId === null && /^PT nr 2699999\/00001/.test(i.citation))).toBe(true)
    expect(db.runs[0]).toMatchObject({ status: 'APPLIED', confirmedBy: 'auth-1' })
    const meta = audit.mock.calls[0][0].metadata
    expect(meta).toMatchObject({ sourceRunId: 'run-1', documentId: 'doc-1', municipalAccepted: 3 })
    expect(meta.municipalRejected).toBe(mapPlanningConditions(pt()).conditions.length - 3)
  })
  it('re-confirming the same run replaces its municipal items (idempotent) and leaves other origins alone', async () => {
    seed()
    db.items.push({ id: 'rule-1', registerId: 'reg-1', origin: 'RULE', aiRunId: null }, { id: 'arch-1', registerId: 'reg-1', origin: 'ARCHITECT', aiRunId: null })
    db.registers.push({ id: 'reg-1', projectId: 'proj-1' })
    await confirmProjectSetup({ ...base, parameters: PARAMS, acceptedConditions: [0, 1] })
    db.runs[0].status = 'AWAITING_CONFIRMATION'
    await confirmProjectSetup({ ...base, parameters: PARAMS, acceptedConditions: [0] })
    expect(db.items.filter((i) => i.origin === 'MUNICIPALITY')).toHaveLength(1)
    expect(db.items.find((i) => i.id === 'rule-1')).toBeTruthy()
    expect(db.items.find((i) => i.id === 'arch-1')).toBeTruthy()
  })
  it('refuses a design value that breaches a municipal bound', async () => {
    seed()
    await expect(confirmProjectSetup({ ...base, parameters: { ...PARAMS, height: 9 }, acceptedConditions: [] })).rejects.toThrow(/exceeds the municipal maximum of 7.5 m/)
    await expect(confirmProjectSetup({ ...base, parameters: { ...PARAMS, storeys: 3 }, acceptedConditions: [] })).rejects.toThrow(/exceeds the municipal maximum of 2/)
    expect(applied.calls).toHaveLength(0)
  })
  it('ignores out-of-range condition indexes; validates parameters; refuses wrong project / status', async () => {
    seed()
    const r = await confirmProjectSetup({ ...base, parameters: PARAMS, acceptedConditions: [0, 99, -1, 0] })
    expect(r.municipalItems).toBe(1)
    db.runs[0].status = 'AWAITING_CONFIRMATION'
    await expect(confirmProjectSetup({ ...base, parameters: { ...PARAMS, storeys: -1 }, acceptedConditions: [] })).rejects.toThrow(/storeys/)
    await expect(confirmProjectSetup({ ...base, projectId: 'other', parameters: PARAMS, acceptedConditions: [] })).rejects.toThrow(/not found/)
    db.runs[0].status = 'APPLIED'
    await expect(confirmProjectSetup({ ...base, parameters: PARAMS, acceptedConditions: [] })).rejects.toThrow(/applied/)
  })
})

// ── Document number pin (S3.B2 test PDF finding) ─────────────
import { pinDocumentNumber } from '@/lib/ai/map-project'
describe('pinDocumentNumber', () => {
  const pc = (number: string | null) => ({ document: { number: { value: number, confidence: 0.9, page: 1, quote: null } } }) as any
  it('replaces a decision number with the stated PT number, citing its page', () => {
    const out = pinDocumentNumber(pc('2-3/999'), ['KORRALDUS nr 2-3/999', 'Projekteerimistingimused nr 2699999/00042.'])
    expect(out.document.number).toMatchObject({ value: '2699999/00042', page: 2, confidence: 0.95 })
  })
  it('leaves the model value when the phrase is absent', () => {
    const p = pc('TE-1538-1')
    expect(pinDocumentNumber(p, ['Projekteerimistingimuste andmine, otsus TE-1538-1'])).toBe(p)
  })
  it('does not guess when the document states two different numbers', () => {
    const p = pc('2-3/999')
    expect(pinDocumentNumber(p, ['Projekteerimistingimused nr 111/1', 'projekteerimistingimuste nr 222/2'])).toBe(p)
  })
})

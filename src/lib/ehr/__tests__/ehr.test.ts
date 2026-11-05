import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/** S3.C — Ehitisregister client, mapping, and questionnaire merge. Fixture: Tallinna Linnateater (public building). */
vi.mock('@/lib/cache', () => ({ cached: (_k: string, f: () => Promise<unknown>) => f() }))
import { normaliseBuilding, fetchBuilding, EhrError } from '@/lib/ehr/client'
import { ehrToValues, fetchedLabel } from '@/lib/ehr/map'
import { mergeValues } from '@/lib/ai/merge-values'

const RAW = JSON.parse(readFileSync(resolve(__dirname, 'fixtures/building-101029474.json'), 'utf8'))
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

describe('normaliseBuilding', () => {
  it('keeps building facts with numbers parsed, county from EHAK code, primary address', () => {
    const b = normaliseBuilding(RAW, new Date('2026-11-05T10:00:00Z'))
    expect(b).toMatchObject({
      ehrCode: '101029474', name: 'Tallinna Linnateater', state: 'Olemas', kind: 'building',
      useCode: '12611', county: 'Harju', heightM: 23.4, storeysAbove: 6, storeysBelow: 2,
      footprintM2: 4159.3, enclosedNetAreaM2: 9819.2, heatedAreaM2: 9819.2, cadastralUnits: ['78401:101:2050'],
    })
    expect(b.address).toBe('Harju maakond, Tallinn, Kesklinna linnaosa, Laboratooriumi tn 12')
    expect(b.heritage).toBeNull()
  })
  it('never carries owner data or geometry', () => {
    const s = JSON.stringify(normaliseBuilding(RAW))
    expect(s).not.toMatch(/omanik|owner|ehitiseKujud|koordinaat/i)
  })
  it('throws not_found for an empty payload', () => {
    expect(() => normaliseBuilding({})).toThrow(EhrError)
  })
})

describe('ehrToValues', () => {
  it('maps to questionnaire keys with attribution', () => {
    const b = { ...normaliseBuilding(RAW, new Date('2026-11-05T10:00:00Z')), heritage: ['Ehitis on mälestis'] }
    const v = Object.fromEntries(ehrToValues(b).map((x) => [x.key, x]))
    expect(v.buildingType.value).toBe('non_residential')
    expect(v.storeys.value).toBe(6)
    expect(v.height.value).toBe(23.4)
    expect(v.heatedArea.value).toBe(9819.2)
    expect(v.county.value).toBe('Harju')
    expect(v.heritage.value).toBe(true)
    expect(v.grossFloorArea).toBeUndefined()   // the register has no gross area — never invent one
    expect(fetchedLabel(b)).toBe('Ehitisregister, fetched 05.11.2026')
    expect(v.height.attribution).toBe('Ehitisregister, fetched 05.11.2026')
  })
})

describe('fetchBuilding', () => {
  beforeEach(() => vi.restoreAllMocks())
  it('rejects a cadastral number before calling the register', async () => {
    const f = vi.spyOn(globalThis, 'fetch')
    await expect(fetchBuilding('78401:101:2050')).rejects.toMatchObject({ reason: 'invalid_code' })
    expect(f).not.toHaveBeenCalled()
  })
  it('maps "Building Not Found!" to not_found', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(json(400, { message: 'Building Not Found!' }))
    await expect(fetchBuilding('999999999')).rejects.toMatchObject({ reason: 'not_found' })
  })
  it('adds heritage from search when the record matches; tolerates search failure', async () => {
    const f = vi.spyOn(globalThis, 'fetch')
    f.mockResolvedValueOnce(json(200, RAW)).mockResolvedValueOnce(json(200, { data: [{ ehrCode: '101029474', heritage: [{ name: 'Ehitis on mälestis' }] }] }))
    expect((await fetchBuilding('101029474')).heritage).toEqual(['Ehitis on mälestis'])
    f.mockResolvedValueOnce(json(200, RAW)).mockResolvedValueOnce(json(503, {}))
    expect((await fetchBuilding('101029474')).heritage).toBeNull()
  })
  it('reports the register being down as unavailable', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new TypeError('fetch failed'))
    await expect(fetchBuilding('101029474')).rejects.toMatchObject({ reason: 'unavailable' })
  })
})

describe('mergeValues (document / EHR → questionnaire)', () => {
  const form = { grossFloorArea: 160, heatedArea: 150, enclosedNetArea: 150, storeys: 2 }
  it('gross from a brief drags heated + enclosed along (was the 3.B3 bug)', () => {
    const r = mergeValues(form, { grossFloorArea: 2400 }, { heated: false, enclosed: false })
    expect(r.form).toMatchObject({ grossFloorArea: 2400, heatedArea: 2160, enclosedNetArea: 2160 })
  })
  it('explicit register areas win and stay put on later gross changes', () => {
    const r1 = mergeValues(form, { heatedArea: 9819.2 }, { heated: false, enclosed: false })
    expect(r1.edited).toEqual({ heated: true, enclosed: false })
    const r2 = mergeValues(r1.form, { grossFloorArea: 12000 }, r1.edited)
    expect(r2.form).toMatchObject({ heatedArea: 9819.2, enclosedNetArea: 10800 })
  })
  it('respects areas the architect already typed', () => {
    const r = mergeValues(form, { grossFloorArea: 300 }, { heated: true, enclosed: true })
    expect(r.form).toMatchObject({ heatedArea: 150, enclosedNetArea: 150 })
  })
})

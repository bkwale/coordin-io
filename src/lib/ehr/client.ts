/**
 * Ehitisregister (Estonian building register) — public, keyless endpoints only.
 * Probe notes: private/ai-samples/ehr-probe-2026-11-04.md
 *   GET  /api/building/v3/buildingData?ehr_code=NNN        → full record
 *   POST /api/building/v2/buildingSearchPageable {buildingName|owner} → rows incl. heritage flags
 * Data minimisation: we keep building facts only — never owner names or geometry.
 * Every value shown to the architect carries "Ehitisregister, fetched DD.MM.YYYY".
 */
import { cached } from '@/lib/cache'

const BASE = 'https://livekluster.ehr.ee'
const TIMEOUT_MS = 10_000
export const EHR_CODE = /^\d{9}$/

export class EhrError extends Error {
  constructor(public reason: 'invalid_code' | 'not_found' | 'unavailable', message: string) { super(message); this.name = 'EhrError' }
}

export interface EhrBuilding {
  ehrCode: string
  name: string | null
  state: string | null              // "Olemas", "Kavandatav", "Ehitamisel"…
  kind: 'building' | 'structure' | null
  useCode: string | null            // EHR kasutusotstarve code, e.g. 11101, 12611
  useLabel: string | null
  address: string | null            // primary full address
  addresses: string[]
  cadastralUnits: string[]
  county: string | null             // "Harju" (no "maakond")
  heightM: number | null
  storeysAbove: number | null
  storeysBelow: number | null
  footprintM2: number | null        // ehitisealune pind
  enclosedNetAreaM2: number | null  // suletud netopind
  heatedAreaM2: number | null       // köetav pind
  volumeM3: number | null
  firstUse: string | null           // ISO date
  heritage: string[] | null         // e.g. ["Ehitis on mälestis"]; null = unknown
  fetchedAt: string                 // ISO
}

// EHAK county codes (2017 reform)
const COUNTY: Record<string, string> = {
  '37': 'Harju', '39': 'Hiiu', '45': 'Ida-Viru', '50': 'Jõgeva', '52': 'Järva', '56': 'Lääne', '60': 'Lääne-Viru',
  '64': 'Põlva', '68': 'Pärnu', '71': 'Rapla', '74': 'Saare', '79': 'Tartu', '81': 'Valga', '84': 'Viljandi', '87': 'Võru',
}

const n = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null
  const x = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.'))
  return Number.isFinite(x) ? x : null
}
const s = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null)
const arr = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : v && typeof v === 'object' ? [v as T] : [])

/** Pure: raw buildingData JSON → EhrBuilding. Exported for tests. */
export function normaliseBuilding(raw: unknown, fetchedAt = new Date()): EhrBuilding {
  const e = (raw as { ehitis?: Record<string, any> })?.ehitis
  if (!e?.ehitiseAndmed) throw new EhrError('not_found', 'Building not found in Ehitisregister')
  const a = e.ehitiseAndmed ?? {}
  const p = e.ehitisePohiandmed ?? {}
  const uses = arr<any>(e.ehitiseKasutusotstarbed?.kasutusotstarve)
  const addrs = arr<any>(e.ehitiseAadressid?.aadress).filter((x) => x?.olekviit?.olek !== 'L').map((x) => s(x?.taisaadress)).filter((x): x is string => !!x)
  const cadastral = arr<any>(e.ehitiseKatastriyksused?.ehitiseKatastriyksus).map((x) => s(x?.katastritunnus)).filter((x): x is string => !!x)
  const primary = s(a.taisaadress)?.split('//')[0].trim() ?? addrs[0] ?? null
  const countyFromAddr = primary?.match(/^([\p{L}-]+) maakond/u)?.[1] ?? null
  const mainUse = uses.find((u) => u?.kaosId === a.kaosIdPeamine) ?? uses[0]
  return {
    ehrCode: String(a.ehrKood),
    name: s(a.nimetus),
    state: s(a.seisundTxt),
    kind: a.rajatisHoone === 'H' ? 'building' : a.rajatisHoone === 'R' ? 'structure' : null,
    useCode: s(a.kaosKood) ?? s(mainUse?.kaosKood),
    useLabel: s(a.kaosIdTxt) ?? s(mainUse?.kaosIdTxt),
    address: primary,
    addresses: Array.from(new Set(addrs)).slice(0, 10),
    cadastralUnits: Array.from(new Set(cadastral)).slice(0, 10),
    county: COUNTY[String(p.maakond ?? '')] ?? countyFromAddr,
    heightM: n(p.korgus),
    storeysAbove: n(p.maxKorrusteArv),
    storeysBelow: n(p.maaalusteKorrusteArv),
    footprintM2: n(p.ehitisalunePind),
    enclosedNetAreaM2: n(p.suletud_netopind),
    heatedAreaM2: n(p.koetavPind),
    volumeM3: n(p.mahtBruto) ?? n(p.maht),
    firstUse: s(p.kavKasutusKp)?.slice(0, 10) ?? s(a.esmaneKasutus)?.slice(0, 10) ?? null,
    heritage: null,
    fetchedAt: fetchedAt.toISOString(),
  }
}

async function call(path: string, init?: RequestInit): Promise<Response> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  try {
    return await fetch(`${BASE}${path}`, { ...init, signal: ctrl.signal, headers: { accept: 'application/json', ...(init?.headers ?? {}) }, cache: 'no-store' })
  } catch {
    throw new EhrError('unavailable', 'Ehitisregister did not respond — try again in a minute')
  } finally { clearTimeout(t) }
}

export interface EhrSearchRow { ehrCode: string; name: string | null; address: string | null; useLabel: string | null; storeys: number | null; heritage: string[] }

/** Search by building name (the only public search key besides owner). Cached 1 h globally. */
export async function searchBuildings(query: string): Promise<EhrSearchRow[]> {
  const q = query.trim().slice(0, 80)
  if (q.length < 3) return []
  return cached(`ehr:search:${q.toLowerCase()}`, async () => {
    const res = await call('/api/building/v2/buildingSearchPageable', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ page: 1, pageSize: 10, buildingName: q }) })
    if (!res.ok) throw new EhrError('unavailable', `Ehitisregister search failed (${res.status})`)
    const body = (await res.json()) as { data?: any[] }
    return (body.data ?? []).map((r) => ({
      ehrCode: String(r.ehrCode),
      name: s(r.buildingName),
      address: s(Array.isArray(r.buildingAddress) ? r.buildingAddress[0] : r.buildingAddress),
      useLabel: s(r.purposeOfUse?.value),
      storeys: n(r.floorCount),
      heritage: arr<any>(r.heritage).map((h) => s(h?.name)).filter((x): x is string => !!x),
    }))
  }, 3600)
}

/** Full building record by 9-digit EHR code. Cached 24 h globally (the register changes slowly). */
export async function fetchBuilding(ehrCode: string): Promise<EhrBuilding> {
  const code = ehrCode.trim()
  if (!EHR_CODE.test(code)) throw new EhrError('invalid_code', 'An EHR code is 9 digits (e.g. 101029474) — not the cadastral number')
  return cached(`ehr:building:${code}`, async () => {
    const res = await call(`/api/building/v3/buildingData?ehr_code=${code}`)
    if (res.status === 400 || res.status === 404) {
      const body = await res.json().catch(() => ({}))
      if (/not found/i.test(String(body?.message ?? ''))) throw new EhrError('not_found', `No building with EHR code ${code}`)
      throw new EhrError('invalid_code', `Ehitisregister rejected code ${code}`)
    }
    if (!res.ok) throw new EhrError('unavailable', `Ehitisregister error (${res.status})`)
    const b = normaliseBuilding(await res.json())
    // Heritage lives only in search results — best effort, never blocks the link
    if (b.name) {
      try { const rows = await searchBuildings(b.name); const hit = rows.find((r) => r.ehrCode === code); if (hit) b.heritage = hit.heritage } catch { /* keep null = unknown */ }
    }
    return b
  }, 86_400)
}

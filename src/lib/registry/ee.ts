/**
 * Estonian Äriregister (e-Business Register) — keyless public endpoints.
 * Search: /est/api/autocomplete?q=   Card: /est/company/<regCode>/<slug> (HTML, parsed).
 * Personal ID codes appear next to board members on the card; they are deliberately not captured.
 */
import type { CompanyFacts, CompanySearchHit } from './types'

const BASE = 'https://ariregister.rik.ee'
const UA = 'Coordin.io registry lookup (+https://www.coordin.io)'

export async function searchAriregister(q: string): Promise<CompanySearchHit[]> {
  const res = await fetch(`${BASE}/est/api/autocomplete?q=${encodeURIComponent(q)}`, { headers: { Accept: 'application/json', 'User-Agent': UA }, signal: AbortSignal.timeout(10_000) })
  if (!res.ok) throw new Error(`Äriregister search failed (${res.status})`)
  const body = (await res.json()) as { status: string; data?: Array<{ reg_code: number; name: string; legal_address?: string; status?: string }> }
  return (body.data ?? []).slice(0, 10).map((d) => ({ jurisdiction: 'EE', registryCode: String(d.reg_code), name: d.name, address: d.legal_address ?? null, status: d.status === 'R' ? 'active' : String(d.status ?? '') }))
}

export async function getAriregisterCompany(regCode: string): Promise<CompanyFacts | null> {
  if (!/^\d{8}$/.test(regCode)) throw new Error('Estonian registry code is 8 digits')
  const url = `${BASE}/est/company/${regCode}/x`
  const res = await fetch(url, { headers: { Accept: 'text/html', 'User-Agent': UA }, signal: AbortSignal.timeout(15_000) })
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`Äriregister card failed (${res.status})`)
  return parseAriregisterCard(await res.text(), regCode, url)
}

/** Exported for tests — parses the company card HTML into facts. */
export function parseAriregisterCard(htmlText: string, regCode: string, sourceUrl: string): CompanyFacts | null {
  const txt = htmlToCells(htmlText)
  const get = (label: string, after = 1) => { const i = txt.indexOf(label); if (i < 0) return null; const cells = txt.slice(i + label.length).split('|').map((s) => s.trim()).filter(Boolean); return cells[after - 1] ?? null }
  const rawTitle = htmlText.match(/<title>([^<]+)<\/title>/)?.[1] ?? ''
  const legalName = (rawTitle.split(/\s*(?:&vert;|\||–|-)\s*e-?[Ää]riregister/i)[0].split(/\s*&vert;\s*|\s*\|\s*/)[0] || get('Ärinimi') || '').replace(/&amp;/g, '&').trim() || null
  if (!legalName) return null
  const statusRaw = get('Staatus') ?? ''
  const regLine = txt.match(/Registrisse kantud \((\d{2})\.(\d{2})\.(\d{4})\)/)
  const emtak = txt.match(/\|(\d{5}) - ([^|]+)\|NACE kood\|([\d.]+)/)
  const addressCell = get('Aadress')
  const cap = txt.match(/Osakapital on\|([^|]+)\|/)
  // board: names appear right before an 11-digit personal code; capture the name, discard the code
  const board = Array.from(txt.matchAll(/\|([A-ZÄÖÜÕŠŽ][\p{L}\-']+(?: [A-ZÄÖÜÕŠŽ][\p{L}\-']+){1,3})\|(?:\d{11})\|Juhatuse liige\|/gu)).map((m) => m[1])
  const historical = Array.from(new Set(Array.from(txt.matchAll(/Ärinimi\|([^|]+)\|/g)).map((m) => m[1].trim()).filter((n) => n !== legalName)))
  const postcode = addressCell?.match(/\b(\d{5})\b/)?.[1] ?? null
  const city = addressCell?.split(',').map((s) => s.trim())[1] ?? null
  return {
    jurisdiction: 'EE', registryCode: regCode, legalName, historicalNames: historical,
    status: /Registrisse kantud/.test(statusRaw) ? 'active' : /Kustutatud/.test(statusRaw) ? 'dissolved' : /Likvideerimisel/.test(statusRaw) ? 'liquidation' : 'other',
    statusRaw, legalForm: get('Õiguslik vorm'),
    registeredAt: regLine ? `${regLine[3]}-${regLine[2]}-${regLine[1]}` : null,
    address: addressCell, city, postcode,
    activity: emtak ? { code: emtak[1], label: emtak[2].trim(), scheme: 'EMTAK' } : null,
    isArchitecturePractice: !!emtak && emtak[1].startsWith('711'),
    board: Array.from(new Set(board)).slice(0, 10),
    capital: cap ? cap[1].trim() : null,
    sourceUrl, fetchedAt: new Date().toISOString(),
  }
}

function htmlToCells(h: string): string {
  const noScript = h.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<style[\s\S]*?<\/style>/g, '')
  const cells = noScript.replace(/<[^>]+>/g, '|').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'").replace(/&ouml;/g, 'ö').replace(/&auml;/g, 'ä').replace(/&uuml;/g, 'ü').replace(/&otilde;/g, 'õ')
  return cells.replace(/\s+/g, ' ').replace(/\|[\s|]*\|/g, '|').replace(/\s*\|\s*/g, '|')
}

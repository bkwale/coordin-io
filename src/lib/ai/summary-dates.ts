/**
 * A deadline exactly as a document wrote it → a calendar date, only when it is unambiguous.
 * "15.12.2026", "15/12/2026", "2026-12-15", "4 Dec 2026", "4. detsember 2026". Anything else ("within 14 days",
 * "enne ehitusloa taotlemist") returns null: the person picks the date. Never guesses a year or a day.
 */
const MONTHS: Record<string, number> = {
  jan: 1, january: 1, jaanuar: 1, feb: 2, february: 2, veebruar: 2, mar: 3, march: 3, märts: 3, apr: 4, april: 4, aprill: 4,
  may: 5, mai: 5, jun: 6, june: 6, juuni: 6, jul: 7, july: 7, juuli: 7, aug: 8, august: 8, sep: 9, sept: 9, september: 9,
  oct: 10, october: 10, okt: 10, oktoober: 10, nov: 11, november: 11, dec: 12, december: 12, dets: 12, detsember: 12,
}

function iso(y: number, m: number, d: number): string | null {
  if (y < 2000 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return null
  const dt = new Date(Date.UTC(y, m - 1, d))
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

export function parseDocumentDate(text: string | null | undefined): string | null {
  if (!text) return null
  const s = text.trim().toLowerCase()
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (m) return iso(+m[1], +m[2], +m[3])
  // Day first, as written in Estonia and the UK. A US-style date would be read wrongly, so only dots and slashes with a 4-digit year count.
  m = s.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})\.?$/)
  if (m) return iso(+m[3], +m[2], +m[1])
  m = s.match(/^(\d{1,2})\.?\s+([a-zäöüõ]+)\.?\s+(\d{4})\.?(?:\s*a\.?)?$/)
  if (m && MONTHS[m[2]]) return iso(+m[3], MONTHS[m[2]], +m[1])
  return null
}

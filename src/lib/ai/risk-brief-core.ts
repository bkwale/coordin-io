/**
 * AI risk brief (AI roadmap, sprint 4): the parts with no database and no model call in them.
 * The model ranks and explains flags that the fixed rules raised. Everything it returns is checked against those
 * flags: an unknown flag id is dropped, and a sentence containing a number that is in no flag is dropped too.
 */
import { createHash } from 'node:crypto'
import { z } from 'zod'
import type { RiskSignal } from '@/lib/risk/signals'

export const RiskBriefSchema = z.object({
  headline: z.string().min(1).max(200),
  overview: z.string().min(1).max(1500),
  priorities: z.array(z.object({ signalId: z.string().min(1).max(200), why: z.string().min(1).max(500), action: z.string().min(1).max(500) })).max(8),
})
export type RiskBriefRaw = z.infer<typeof RiskBriefSchema>

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '')

export function normaliseRiskBrief(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object') return raw
  const o = raw as Record<string, unknown>
  const list = Array.isArray(o.priorities) ? o.priorities : Array.isArray(o.top) ? o.top : []
  return {
    headline: str(o.headline ?? o.title, 200),
    overview: str(o.overview ?? o.summary, 1500),
    priorities: list.map((p) => {
      const x = (p && typeof p === 'object' ? p : {}) as Record<string, unknown>
      return { signalId: str(x.signalId ?? x.id, 200), why: str(x.why ?? x.reason, 500), action: str(x.action ?? x.next, 500) }
    }).filter((p) => p.signalId && p.why && p.action).slice(0, 8),
  }
}

/** What the model is shown for each flag: enough to explain it, nothing it could leak that the reader cannot already see. */
export function flagsForModel(signals: RiskSignal[]): Array<Record<string, unknown>> {
  return signals.map((s) => ({ signalId: s.id, severity: s.severity, area: s.area, title: s.title, detail: s.detail, facts: s.facts }))
}

/** Changes whenever the set of flags, or anything they say, changes. A brief written for another hash is out of date. */
export function flagsHash(signals: RiskSignal[]): string {
  const stable = [...signals].sort((a, b) => a.id.localeCompare(b.id)).map((s) => [s.id, s.severity, s.title, s.detail])
  return createHash('sha256').update(JSON.stringify(stable)).digest('hex').slice(0, 20)
}

/** Numbers in a piece of text, written with a dot. A digit glued to a letter is part of a name or unit (m2, R60), not a number. */
export function numbersIn(text: string): string[] {
  return (text.replace(/(\d)[\s ](?=\d{3}(?!\d))/g, '$1').replace(/(?<=\p{L})\d+/gu, '').match(/\d+(?:[.,]\d+)?/g) ?? []).map((n) => String(Number(n.replace(',', '.'))))
}

export interface CheckedBrief {
  headline: string
  overview: string
  priorities: Array<{ signalId: string; why: string; action: string; title: string; severity: string; link: string }>
  /** What the check removed, in plain words. Shown to the reader. */
  notes: string[]
}

/**
 * Keep only what the flags support.
 *  - a priority naming a flag that is not being raised: dropped
 *  - a priority whose wording has a number that is not in its own flag: dropped
 *  - a headline or overview with a number that is in no flag (and is not a count of flags): replaced by a plain count
 */
export function checkBrief(raw: RiskBriefRaw, signals: RiskSignal[]): CheckedBrief {
  const byId = new Map(signals.map((s) => [s.id, s]))
  const numsOf = (s: RiskSignal) => new Set(numbersIn(`${s.title} ${s.detail} ${Object.values(s.facts).filter((v) => v !== null).join(' ')}`))
  const high = signals.filter((s) => s.severity === 'high').length, medium = signals.filter((s) => s.severity === 'medium').length, low = signals.filter((s) => s.severity === 'low').length
  const all = new Set<string>([String(signals.length), String(high), String(medium), String(low), String(high + medium)])
  for (const s of signals) for (const n of numsOf(s)) all.add(n)
  for (const area of new Set(signals.map((s) => s.area))) all.add(String(signals.filter((s) => s.area === area).length))

  const notes: string[] = []
  const seen = new Set<string>()
  let dropped = 0
  const priorities: CheckedBrief['priorities'] = []
  for (const p of raw.priorities) {
    const s = byId.get(p.signalId)
    if (!s || seen.has(s.id)) { dropped++; continue }
    const own = numsOf(s)
    if (numbersIn(`${p.why} ${p.action}`).some((n) => !own.has(n))) { dropped++; continue }
    seen.add(s.id)
    priorities.push({ signalId: s.id, why: p.why, action: p.action, title: s.title, severity: s.severity, link: s.link })
  }
  if (dropped) notes.push(`${dropped} point${dropped > 1 ? 's' : ''} from the AI ${dropped > 1 ? 'were' : 'was'} left out because ${dropped > 1 ? 'they' : 'it'} did not match the flags below.`)

  const plain = signals.length === 0 ? 'Nothing is flagged on this project.' : `${signals.length} flag${signals.length > 1 ? 's' : ''}: ${high} high, ${medium} medium, ${low} low.`
  const supported = (text: string) => numbersIn(text).every((n) => all.has(n))
  let headline = raw.headline, overview = raw.overview
  if (!supported(headline)) headline = plain
  if (!supported(overview)) { overview = plain; notes.push('The AI overview mentioned a figure that is not in the flags, so it was replaced with a plain count.') }
  return { headline, overview, priorities, notes }
}

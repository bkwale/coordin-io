/**
 * Deterministic prompt-injection guard for uploaded documents (Schneier, S3.B2 live test).
 *
 * The live test showed the model will quote a hostile sentence ("…the maximum height is 99 m") as the
 * source of a limit. A quote check alone can't catch that — the text IS in the document. So we find
 * paragraphs addressed to an AI system without asking the model, then:
 *   1. drop every prefill / condition whose quote or text comes from such a paragraph,
 *   2. un-pre-accept everything else and cap confidence,
 *   3. tell the architect, with page numbers.
 */
import type { ProjectSetupMapping } from './map-project'

const PATTERNS: RegExp[] = [
  /\b(ignore|disregard|forget|override)\b[^.\n]{0,40}\b(previous|prior|above|earlier|all|your)\b[^.\n]{0,20}\b(instructions?|prompts?|rules?)\b/i,
  /\b(system|developer)\s+(notice|prompt|message|instruction)/i,
  /\b(to|for|attention)\s+(the\s+)?(ai|a\.i\.|llm|language model|assistant|chatbot|model)\b/i,
  /\byou are (now )?(an?|the) (ai|assistant|language model)\b/i,
  /\b(api[\s-]?keys?|system prompt)\b/i,
  /\bset (every|all) confidence/i,
  // Estonian
  /\b(eira|ignoreeri)\w*\b[^.\n]{0,40}\bjuhis/i,
  /\btehisintellekt\w*\b[^.\n]{0,40}\b(juhis|käsk)/i,
]

export interface InjectionHit { page: number; excerpt: string; paragraph: string }

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim()

const CLAUSE_START = /^\s*(\d+(\.\d+)*\.?\s|[-•–]\s)/
const HEADING = /^[\p{Lu}\d\s.,:;()–-]{4,}$/u

/**
 * Split a page into blocks: a new block starts at a blank line, a numbered clause ("1.4.", "2.")
 * or an ALL-CAPS heading. PDF text rarely has blank lines between paragraphs, so splitting on blank
 * lines alone made a whole page "hostile" and discarded the genuine limits next to the injection.
 */
export function segmentBlocks(text: string): string[] {
  const blocks: string[] = []
  let cur: string[] = []
  const flush = () => { if (cur.length) blocks.push(cur.join('\n')); cur = [] }
  for (const line of text.split('\n')) {
    if (!line.trim()) { flush(); continue }
    if (CLAUSE_START.test(line) || HEADING.test(line.trim()) || PATTERNS.some((re) => re.test(line))) flush()
    cur.push(line)
  }
  flush()
  return blocks
}

/** Blocks that contain text addressed to an AI system. */
export function findInjection(pages: string[]): InjectionHit[] {
  const hits: InjectionHit[] = []
  pages.forEach((text, i) => {
    for (const para of segmentBlocks(text)) {
      const m = PATTERNS.map((re) => para.match(re)).find(Boolean)
      if (m) hits.push({ page: i + 1, excerpt: ((m.index ?? 0) < 120 ? para.slice(0, 160) : '…' + para.slice((m.index ?? 0) - 20, (m.index ?? 0) + 140)).replace(/\s+/g, ' ').trim(), paragraph: norm(para) })
    }
  })
  return hits
}

function fromHostile(snippet: string | null | undefined, hits: InjectionHit[]): boolean {
  if (!snippet) return false
  const s = norm(snippet)
  if (PATTERNS.some((re) => re.test(s))) return true
  if (s.length < 12) return false
  const probe = s.slice(0, 60)
  return hits.some((h) => h.paragraph.includes(probe) || (s.length > h.paragraph.length && s.includes(h.paragraph.slice(0, 60))))
}

export function applyInjectionGuard(mapping: ProjectSetupMapping, pages: string[]): ProjectSetupMapping {
  const hits = findInjection(pages)
  if (hits.length === 0) return mapping

  const dropped: string[] = []
  const prefills = mapping.prefills.filter((p) => {
    const bad = fromHostile(p.quote, hits) || fromHostile(p.because, hits)
    if (bad) dropped.push(p.key)
    return !bad
  }).map((p) => ({ ...p, preAccept: false, confidence: Math.min(p.confidence, 0.5) }))

  const conditions = mapping.conditions.filter((c) => !fromHostile(c.text, hits))
  const droppedConditions = mapping.conditions.length - conditions.length

  const bounds = { ...mapping.bounds }
  if (dropped.includes('height')) bounds.maxHeightM = null
  if (dropped.includes('storeys')) bounds.maxStoreys = null

  const pagesHit = [...new Set(hits.map((h) => h.page))].sort((a, b) => a - b)
  const warning = `This document contains text addressed to an AI system (p.${pagesHit.join(', p.')}). ` +
    (dropped.length || droppedConditions ? `Discarded ${[dropped.length ? `values: ${dropped.join(', ')}` : '', droppedConditions ? `${droppedConditions} condition(s)` : ''].filter(Boolean).join('; ')} taken from that text. ` : '') +
    'Nothing is pre-accepted — check every value against the document.'

  return {
    ...mapping,
    prefills,
    conditions,
    bounds,
    warnings: [warning, ...mapping.warnings.filter((w) => !/instruction|api key|system prompt|manipulat/i.test(w))],
    suspicious: { pages: pagesHit, excerpts: hits.slice(0, 3).map((h) => h.excerpt), dropped, droppedConditions },
  }
}

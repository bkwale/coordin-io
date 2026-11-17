/**
 * Document summaries (AI roadmap, sprint 1): the engine. No database here, so it can be tested and run on its own.
 *   read (PDF / Word / text) → strip text addressed to an AI → short document: one call
 *                                                            → long document: notes per section, then combine
 *   → check every quote and page against the document → AIRun (output + mapping)
 * The model only ever sees document text and returns the schema. Nothing it returns is trusted until the
 * deterministic check has matched its quotes to the pages.
 */
import { chat, parseJsonWithMeta } from './providers'
import { pdfToPages, paginateText, capPages, sniffPdf, cleanText, IngestError, SUMMARY_LIMITS } from './document-ingest'
import { docxToPages, sniffZip } from './docx'
import { stripInjectionFromPages } from './injection-guard'
import { SectionNotesSchema, normaliseNotes, ContradictionsSchema, normaliseContradictions, type DocumentSummary, type SectionNotes, type SummaryDocType } from './schemas-summary'
import { SUMMARY_SYSTEM, SECTION_NOTES_SYSTEM, COMBINE_SYSTEM, CONTRADICTION_SYSTEM, CONFIRM_CONTRADICTION_SYSTEM, confirmContradictionUser, summaryUser, sectionNotesUser, combineUser, contradictionDocumentUser, contradictionFiguresUser, type SummaryLanguage } from './prompts/summary'

/**
 * Up to this many characters goes to the model in one call; beyond it the document is read in sections.
 * Kept low on purpose: on the test set a model reading 45,000 characters in one go missed planted decisions
 * that it found when the same document was read in sections.
 */
export const SINGLE_CALL_CHARS = 12_000
export const SECTION_CHARS = 12_000
export const SECTION_CHARS_MAX = 40_000
/** Up to this size the contradiction check reads the document itself; beyond it, the figures noted per section. */
export const CONTRADICTION_DOCUMENT_CHARS = 60_000
/** Aim for at most this many sections, so a long document still finishes inside the time limit. */
const TARGET_SECTIONS = 8
/** All sections of a normal document go out together: one wait, not several. */
const SECTION_CONCURRENCY = 8

/** Section size for a document: small sections for recall, growing with the document to keep the count down. */
export function sectionSize(totalChars: number): number {
  return Math.min(SECTION_CHARS_MAX, Math.max(SECTION_CHARS, Math.ceil(totalChars / TARGET_SECTIONS)))
}

export interface NumberedPage { n: number; text: string }
export interface ReadDocument { pages: string[]; format: 'pdf' | 'docx' | 'text'; truncated: boolean }

/** Bytes → pages of text, by what the file actually is (not its name or declared type). */
export async function readDocumentPages(bytes: Uint8Array, fileName = ''): Promise<ReadDocument> {
  if (bytes.byteLength > SUMMARY_LIMITS.maxBytes) throw new IngestError('too_large', `File is over ${Math.round(SUMMARY_LIMITS.maxBytes / 1024 / 1024)} MB.`)
  if (sniffPdf(bytes)) {
    const pages = await pdfToPages(bytes, SUMMARY_LIMITS)
    return { pages, format: 'pdf', truncated: pages.length >= SUMMARY_LIMITS.maxPages || pages.join('').length >= SUMMARY_LIMITS.maxChars }
  }
  if (sniffZip(bytes)) {
    const all = docxToPages(bytes)
    const pages = capPages(all, SUMMARY_LIMITS.maxChars)
    return { pages, format: 'docx', truncated: pages.join('').length < all.join('').length }
  }
  if (/\.(txt|md)$/i.test(fileName)) {
    const text = new TextDecoder('utf-8', { fatal: false }).decode(bytes)
    const all = paginateText(text)
    if (all.join('').length < SUMMARY_LIMITS.minChars) throw new IngestError('empty', 'The file has almost no text in it.')
    const pages = capPages(all, SUMMARY_LIMITS.maxChars)
    return { pages, format: 'text', truncated: pages.join('').length < all.join('').length }
  }
  throw new IngestError('not_pdf', 'Only PDF and Word (.docx) files can be summarised.')
}

const STOPWORDS = { et: new Set(['ja', 'on', 'ei', 'ning', 'või', 'kui', 'mis', 'et', 'tuleb', 'peab', 'kuni', 'ning', 'oma', 'selle', 'see']), en: new Set(['the', 'and', 'of', 'is', 'to', 'shall', 'with', 'for', 'be', 'are', 'this', 'that', 'in', 'by', 'not']) }

/**
 * The language the summary is written in when the user did not choose one. Decided by counting common words, not
 * by the model: on a long English document full of Estonian names, the model wrote the summary in Estonian.
 * Returns 'same' when the text is not clearly Estonian or English (the model then decides).
 */
export function resolveLanguage(requested: SummaryLanguage, pages: string[]): SummaryLanguage {
  if (requested !== 'same') return requested
  let et = 0, en = 0
  for (const w of pages.join(' ').slice(0, 200_000).toLowerCase().split(/[^\p{L}]+/u)) { if (STOPWORDS.et.has(w)) et++; else if (STOPWORDS.en.has(w)) en++ }
  if (et + en < 40) return 'same'
  return et > en * 2 ? 'et' : en > et * 2 ? 'en' : 'same'
}

/** Consecutive pages grouped into sections of about `maxChars`. A single oversized page becomes its own section. */
export function chunkPages(pages: NumberedPage[], maxChars = SECTION_CHARS): NumberedPage[][] {
  const out: NumberedPage[][] = []
  let cur: NumberedPage[] = [], size = 0
  for (const p of pages) {
    if (cur.length && size + p.text.length > maxChars) { out.push(cur); cur = []; size = 0 }
    cur.push(p); size += p.text.length
  }
  if (cur.length) out.push(cur)
  return out
}

/* ── Checking what the model said against the document ───────────────────────────────── */

const squash = (s: string) => cleanText(s).toLowerCase().replace(/\s+/g, ' ').replace(/[“”„"«»]/g, '"').replace(/[‘’‚']/g, "'").replace(/[‐‑‒–—]/g, '-').trim()
function wordCoverage(q: string, doc: string): number {
  const words = q.split(/[^\p{L}\p{N}§]+/u).filter((w) => w.length >= 4)
  if (words.length < 3) return 0
  return words.filter((w) => doc.includes(w)).length / words.length
}

export interface CheckedItem { text: string; page: number | null; quote: string | null; verified: boolean }
export interface CheckedAction extends CheckedItem { owner: string | null; due: string | null }
export interface ContradictionSide { value: string; page: number | null; quote: string | null }
export interface CheckedContradiction { subject: string; a: ContradictionSide; b: ContradictionSide }
export interface SummaryMapping {
  kind: 'summary'
  title: string | null
  documentType: SummaryDocType
  language: string
  summary: string
  keyPoints: CheckedItem[]
  decisions: CheckedItem[]
  actions: CheckedAction[]
  openQuestions: CheckedItem[]
  /** The same thing given two different values. Listed only when both quotes are in the document. */
  contradictions: CheckedContradiction[]
  warnings: string[]
  coverage: { pages: number; sections: number; truncated: boolean; unverified: number }
}

/**
 * A quote counts only if it is in the document. Found on the cited page: verified. Found on another page: the page
 * is corrected. Not found anywhere: kept, flagged unverified, so the reader knows to check it. No quote: unverified.
 */
export function checkItem<T extends { text: string; page: number | null; quote: string | null }>(item: T, squashedPages: string[]): T & { verified: boolean } {
  let page = item.page != null && item.page >= 1 && item.page <= squashedPages.length ? item.page : null
  const q = item.quote ? squash(item.quote).replace(/(\.\.\.|…)$/, '').trim() : ''
  if (q.length < 8) return { ...item, page, verified: false }
  // A quote shortened with "[...]" or "…" counts only if every piece is on the same page, in order
  const pieces = q.split(/\s*(?:\[\s*(?:\.\.\.|…)\s*\]|\.\.\.|…)\s*/).map((x) => x.trim()).filter((x) => x.length >= 8)
  if (pieces.length === 0) return { ...item, page, verified: false }
  const on = (i: number) => { let from = 0; for (const piece of pieces) { const at = squashedPages[i].indexOf(piece, from); if (at < 0) return false; from = at + piece.length } return true }
  if (page != null && on(page - 1)) return { ...item, page, verified: true }
  // neighbours first (a sentence can run over a page break), then anywhere
  const order = page != null ? [page, page - 2, ...squashedPages.keys()] : [...squashedPages.keys()]
  for (const i of order) if (i >= 0 && i < squashedPages.length && on(i)) return { ...item, page: i + 1, verified: true }
  // quote split across a page break
  if (pieces.length === 1 && page != null && page < squashedPages.length && (squashedPages[page - 1] + ' ' + squashedPages[page]).includes(q)) return { ...item, page, verified: true }
  // near-exact (the PDF text layer dropped or added a character)
  if (pieces.length === 1 && page != null && wordCoverage(q, squashedPages[page - 1]) >= 0.9) return { ...item, page, verified: true }
  return { ...item, page, verified: false }
}

/** True when a quote says the same thing as one already shown: one contains the other (after tidying), and it is long enough to mean something. */
export function repeats(quote: string | null, others: Array<string | null>): boolean {
  const q = quote ? squash(quote) : ''
  if (q.length < 20) return false
  return others.some((o) => { const t = o ? squash(o) : ''; return t.length >= 20 && (q.includes(t) || t.includes(q)) })
}

export function checkSummary(s: DocumentSummary, pages: string[], extra: { sections: number; truncated: boolean; engineWarnings?: string[]; contradictions?: CheckedContradiction[] }): SummaryMapping {
  const sp = pages.map(squash)
  const decisions = s.decisions.map((x) => checkItem(x, sp))
  const actions = s.actions.map((x) => checkItem(x, sp))
  const openQuestions = s.openQuestions.map((x) => checkItem(x, sp))
  // A key point that only repeats a decision, action, open question or a flagged contradiction is left out:
  // the reader already sees it in its own section
  const elsewhere = [...decisions, ...actions, ...openQuestions].map((x) => x.quote).concat((extra.contradictions ?? []).flatMap((c) => [c.a.quote, c.b.quote]))
  const keyPoints = s.keyPoints.map((x) => checkItem(x, sp)).filter((x) => !repeats(x.quote, elsewhere))
  const unverified = [...keyPoints, ...decisions, ...actions, ...openQuestions].filter((x) => !x.verified).length
  const warnings = [...(extra.engineWarnings ?? []), ...s.warnings]
  if (unverified) warnings.push(`${unverified} item${unverified > 1 ? 's' : ''} could not be matched to the wording of the document. They are marked: check them against the file.`)
  if (extra.truncated) warnings.unshift(`This document is longer than Coordin reads in one go. Only the first ${pages.length} pages are covered.`)
  return { kind: 'summary', title: s.title, documentType: s.documentType, language: s.language, summary: s.summary, keyPoints, decisions, actions, openQuestions, contradictions: extra.contradictions ?? [], warnings, coverage: { pages: pages.length, sections: extra.sections, truncated: extra.truncated, unverified } }
}

/* ── Running it ─────────────────────────────────────────────────────────────────────── */

async function inBatches<T, R>(items: T[], size: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const out: R[] = []
  for (let i = 0; i < items.length; i += size) out.push(...(await Promise.all(items.slice(i, i + size).map((x, j) => fn(x, i + j)))))
  return out
}

/** Notes on one section. One retry; a section that still fails is reported, never silently dropped. */
export async function sectionNotes(section: NumberedPage[], part: number, parts: number, language: SummaryLanguage, allowFallback: boolean): Promise<{ notes: SectionNotes | null; tokens: number }> {
  let tokens = 0
  for (let attempt = 0; attempt < 2; attempt++) {
    const r = await chat({ system: SECTION_NOTES_SYSTEM, user: sectionNotesUser(section, part, parts, language), json: true, temperature: 0, maxTokens: 6000, allowFallback })
    tokens += r.tokens
    try {
      const parsed = SectionNotesSchema.safeParse(normaliseNotes(parseJsonWithMeta(r.text).value))
      if (parsed.success) return { notes: parsed.data, tokens }
    } catch { /* unparseable: try once more */ }
  }
  return { notes: null, tokens }
}

export const CONTRADICTION_CHECK_FAILED = 'The check for figures that disagree could not be run on this document. Do not rely on its absence.'

/** Numbers in a value or quote. A digit glued to a letter is part of a unit or a name (m2, m3, n50), not a number. */
const numbersIn = (v: string): string[] => (v.replace(/(\d)[\s\u00a0](?=\d{3}(?!\d))/g, '$1').replace(/(?<=\p{L})\d+/gu, '').match(/\d+(?:[.,]\d+)?/g) ?? []).map((n) => n.replace(',', '.'))
/** The unit of a value: what is left after the number, lower-cased, without spaces ("W/(m2K)", "m2", "m"). */
const unitOf = (v: string) => v.replace(/[\d\s\u00a0.,≤≥<>=~±]|ligikaudu|approximately|approx\.?|umbes|about|ca\.?/gi, '').replace(/[²³⁻¹]/g, '').toLowerCase()

/**
 * Keep a reported contradiction only if: both quotes are in the document; each side is ONE number, with the same
 * unit; the two numbers differ; and each quote contains its number. Anything else is the model guessing, and a
 * false alarm here costs trust. The same pair reported twice is listed once.
 */
export function checkContradictions(list: Array<{ subject: string; a: ContradictionSide; b: ContradictionSide }>, rawPages: string[]): CheckedContradiction[] {
  const sp = rawPages.map(squash)
  const out: CheckedContradiction[] = []
  const seen = new Set<string>()
  for (const c of list) {
    const na = numbersIn(c.a.value), nb = numbersIn(c.b.value)
    if (na.length !== 1 || nb.length !== 1 || na[0] === nb[0] || Number(na[0]) === Number(nb[0])) continue
    if (unitOf(c.a.value) !== unitOf(c.b.value)) continue
    const a = checkItem({ text: c.subject, page: c.a.page, quote: c.a.quote }, sp), b = checkItem({ text: c.subject, page: c.b.page, quote: c.b.quote }, sp)
    if (!a.verified || !b.verified) continue
    const holds = (n: string, quote: string | null) => numbersIn(quote ?? '').includes(n)
    if (!holds(na[0], c.a.quote) || !holds(nb[0], c.b.quote)) continue
    if (squash(c.a.quote ?? '') === squash(c.b.quote ?? '')) continue
    const key = `${unitOf(c.a.value)}|${[na[0], nb[0]].sort().join('|')}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push({ subject: c.subject, a: { value: c.a.value, page: a.page, quote: c.a.quote }, b: { value: c.b.value, page: b.page, quote: c.b.quote } })
  }
  return out
}

/** The passage a quote sits in: the quote with the text just before and after it, so a reader can tell what the value describes. */
export function around(rawPages: string[], page: number | null, quote: string | null): string {
  const text = page != null ? cleanText(rawPages[page - 1] ?? '').replace(/\s+/g, ' ') : ''
  const q = cleanText(quote ?? '').replace(/\s+/g, ' ')
  const at = q.length >= 8 ? text.toLowerCase().indexOf(q.toLowerCase().slice(0, 40)) : -1
  if (at < 0) return q
  return text.slice(Math.max(0, at - 200), at + q.length + 300)
}

/**
 * The second pass, then a second opinion: each candidate is shown again on its own with both quotes and kept only
 * if the model confirms the two values describe the same property of the same thing. A failure of the first call
 * never fails the summary (it becomes a warning); if the second opinion fails, the candidates are kept.
 */
export async function findContradictions(user: string, rawPages: string[], allowFallback: boolean): Promise<{ found: CheckedContradiction[]; tokens: number; failed: boolean }> {
  let tokens = 0
  let candidates: CheckedContradiction[]
  try {
    const r = await chat({ system: CONTRADICTION_SYSTEM, user, json: true, temperature: 0, maxTokens: 3000, allowFallback })
    tokens += r.tokens
    const parsed = ContradictionsSchema.safeParse(normaliseContradictions(parseJsonWithMeta(r.text).value))
    if (!parsed.success) return { found: [], tokens, failed: true }
    candidates = checkContradictions(parsed.data.contradictions, rawPages)
  } catch {
    return { found: [], tokens, failed: true }
  }
  if (candidates.length === 0) return { found: [], tokens, failed: false }
  try {
    const withContext = candidates.map((c) => ({ subject: c.subject, a: { value: c.a.value, quote: around(rawPages, c.a.page, c.a.quote) }, b: { value: c.b.value, quote: around(rawPages, c.b.page, c.b.quote) } }))
    const r = await chat({ system: CONFIRM_CONTRADICTION_SYSTEM, user: confirmContradictionUser(withContext), json: true, temperature: 0, maxTokens: 600, allowFallback })
    tokens += r.tokens
    const v = parseJsonWithMeta(r.text).value as { confirmed?: unknown } | null
    const ok = Array.isArray(v?.confirmed) ? new Set(v!.confirmed.map((n) => Number(n))) : null
    if (ok) return { found: candidates.filter((_, i) => ok.has(i + 1)), tokens, failed: false }
  } catch { /* keep the candidates */ }
  return { found: candidates, tokens, failed: false }
}

/** What will be sent: pages with AI-addressed text removed, grouped into sections. */
export interface SummaryPlan { rawPages: string[]; pages: NumberedPage[]; sections: NumberedPage[][]; engineWarnings: string[]; contradictions: CheckedContradiction[]; /** The contradiction check, running alongside the final call. */ pending?: Promise<{ found: CheckedContradiction[]; tokens: number; failed: boolean }> }

export function planSummary(rawPages: string[]): SummaryPlan {
  const engineWarnings: string[] = []
  // Text addressed to an AI is removed before the model sees it; quotes are still checked against the original pages
  const stripped = stripInjectionFromPages(rawPages.map((text, i) => ({ n: i + 1, text })))
  if (stripped.removed) engineWarnings.push(`${stripped.removed} passage${stripped.removed > 1 ? 's' : ''} in this document addressed an AI system and ${stripped.removed > 1 ? 'were' : 'was'} ignored.`)
  const pages: NumberedPage[] = stripped.pages.filter((p) => p.text.trim())
  const chars = pages.reduce((a, p) => a + p.text.length, 0)
  return { rawPages, pages, sections: chars <= SINGLE_CALL_CHARS ? [pages] : chunkPages(pages, sectionSize(chars)), engineWarnings, contradictions: [] }
}

/**
 * The prompt for the final call. Short document: the document itself. Long document: notes are taken on each
 * section first (model calls happen here), and the final call combines them.
 */
export async function finalPrompt(plan: SummaryPlan, requested: SummaryLanguage, allowFallback: boolean, onProgress?: (done: number, total: number) => Promise<void> | void): Promise<{ system: string; user: string; tokens: number }> {
  const { pages, sections, rawPages } = plan
  const language = resolveLanguage(requested, rawPages)
  if (sections.length === 1) {
    plan.pending = findContradictions(contradictionDocumentUser(pages), rawPages, allowFallback)
    return { system: SUMMARY_SYSTEM, user: summaryUser(pages, language), tokens: 0 }
  }
  // The check for figures that disagree reads the whole document when it fits one call, and starts now, alongside the notes
  if (pages.reduce((n, p) => n + p.text.length, 0) <= CONTRADICTION_DOCUMENT_CHARS) plan.pending = findContradictions(contradictionDocumentUser(pages), rawPages, allowFallback)
  let done = 0, tokens = 0
  const notes = await inBatches(sections, SECTION_CONCURRENCY, async (section, i) => {
    const r = await sectionNotes(section, i + 1, sections.length, language, allowFallback)
    tokens += r.tokens; done++
    await onProgress?.(done, sections.length)
    return { from: section[0].n, to: section[section.length - 1].n, notes: r.notes }
  })
  const failed = notes.filter((n) => !n.notes)
  if (failed.length > Math.max(1, Math.floor(sections.length / 3))) throw new Error(`Model output failed validation: ${failed.length} of ${sections.length} sections could not be read`)
  for (const f of failed) plan.engineWarnings.push(`Pages ${f.from}–${f.to} could not be read by the AI and are not covered. Read them yourself.`)
  const figures = notes.flatMap((n) => n.notes?.figures ?? [])
  // A document too long to check in one go is checked from the figures noted in each section
  if (!plan.pending && figures.length > 1) plan.pending = findContradictions(contradictionFiguresUser(JSON.stringify(figures)), rawPages, allowFallback)
  // figures are for the contradiction check only; the combine step does not need them
  const notesJson = JSON.stringify(notes.filter((n) => n.notes).map((n) => { const { figures: _f, ...rest } = n.notes!; return { pages: `${n.from}-${n.to}`, ...rest } }))
  return { system: COMBINE_SYSTEM, user: combineUser(notesJson, rawPages.length, pages[0]?.text ?? '', language), tokens }
}

/** Wait for the contradiction check started by finalPrompt and record its result on the plan. Returns tokens used. */
export async function settleContradictions(plan: SummaryPlan): Promise<number> {
  if (!plan.pending) return 0
  const c = await plan.pending
  plan.pending = undefined
  plan.contradictions = c.found
  if (c.failed) plan.engineWarnings.push(CONTRADICTION_CHECK_FAILED)
  return c.tokens
}

/** Share of cited items whose quote is in the document (1 when there is nothing to check). */
export function verifiedShare(s: DocumentSummary, rawPages: string[]): number {
  const sp = rawPages.map(squash)
  const all = [...s.keyPoints, ...s.decisions, ...s.actions]
  return all.length ? all.filter((x) => checkItem(x, sp).verified).length / all.length : 1
}

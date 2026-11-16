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
import { SectionNotesSchema, normaliseNotes, type DocumentSummary, type SectionNotes, type SummaryDocType } from './schemas-summary'
import { SUMMARY_SYSTEM, SECTION_NOTES_SYSTEM, COMBINE_SYSTEM, summaryUser, sectionNotesUser, combineUser, type SummaryLanguage } from './prompts/summary'

/** Up to this many characters goes to the model in one call; beyond it the document is read in sections. */
export const SINGLE_CALL_CHARS = 48_000
export const SECTION_CHARS = 40_000
const SECTION_CONCURRENCY = 3

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
export interface SummaryMapping {
  kind: 'summary'
  title: string | null
  documentType: SummaryDocType
  language: string
  summary: string
  keyPoints: CheckedItem[]
  decisions: CheckedItem[]
  actions: CheckedAction[]
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
  const on = (i: number) => squashedPages[i].includes(q)
  if (page != null && on(page - 1)) return { ...item, page, verified: true }
  // neighbours first (a sentence can run over a page break), then anywhere
  const order = page != null ? [page, page - 2, ...squashedPages.keys()] : [...squashedPages.keys()]
  for (const i of order) if (i >= 0 && i < squashedPages.length && on(i)) return { ...item, page: i + 1, verified: true }
  // quote split across a page break
  if (page != null && page < squashedPages.length && (squashedPages[page - 1] + ' ' + squashedPages[page]).includes(q)) return { ...item, page, verified: true }
  // near-exact (the PDF text layer dropped or added a character)
  if (page != null && wordCoverage(q, squashedPages[page - 1]) >= 0.9) return { ...item, page, verified: true }
  return { ...item, page, verified: false }
}

export function checkSummary(s: DocumentSummary, pages: string[], extra: { sections: number; truncated: boolean; engineWarnings?: string[] }): SummaryMapping {
  const sp = pages.map(squash)
  const keyPoints = s.keyPoints.map((x) => checkItem(x, sp))
  const decisions = s.decisions.map((x) => checkItem(x, sp))
  const actions = s.actions.map((x) => checkItem(x, sp))
  const unverified = [...keyPoints, ...decisions, ...actions].filter((x) => !x.verified).length
  const warnings = [...(extra.engineWarnings ?? []), ...s.warnings]
  if (unverified) warnings.push(`${unverified} item${unverified > 1 ? 's' : ''} could not be matched to the wording of the document. They are marked: check them against the file.`)
  if (extra.truncated) warnings.unshift(`This document is longer than Coordin reads in one go. Only the first ${pages.length} pages are covered.`)
  return { kind: 'summary', title: s.title, documentType: s.documentType, language: s.language, summary: s.summary, keyPoints, decisions, actions, warnings, coverage: { pages: pages.length, sections: extra.sections, truncated: extra.truncated, unverified } }
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
    const r = await chat({ system: SECTION_NOTES_SYSTEM, user: sectionNotesUser(section, part, parts, language), json: true, maxTokens: 6000, allowFallback })
    tokens += r.tokens
    try {
      const parsed = SectionNotesSchema.safeParse(normaliseNotes(parseJsonWithMeta(r.text).value))
      if (parsed.success) return { notes: parsed.data, tokens }
    } catch { /* unparseable: try once more */ }
  }
  return { notes: null, tokens }
}

/** What will be sent: pages with AI-addressed text removed, grouped into sections. */
export interface SummaryPlan { rawPages: string[]; pages: NumberedPage[]; sections: NumberedPage[][]; engineWarnings: string[] }

export function planSummary(rawPages: string[]): SummaryPlan {
  const engineWarnings: string[] = []
  // Text addressed to an AI is removed before the model sees it; quotes are still checked against the original pages
  const stripped = stripInjectionFromPages(rawPages.map((text, i) => ({ n: i + 1, text })))
  if (stripped.removed) engineWarnings.push(`${stripped.removed} passage${stripped.removed > 1 ? 's' : ''} in this document addressed an AI system and ${stripped.removed > 1 ? 'were' : 'was'} ignored.`)
  const pages: NumberedPage[] = stripped.pages.filter((p) => p.text.trim())
  const chars = pages.reduce((a, p) => a + p.text.length, 0)
  return { rawPages, pages, sections: chars <= SINGLE_CALL_CHARS ? [pages] : chunkPages(pages), engineWarnings }
}

/**
 * The prompt for the final call. Short document: the document itself. Long document: notes are taken on each
 * section first (model calls happen here), and the final call combines them.
 */
export async function finalPrompt(plan: SummaryPlan, language: SummaryLanguage, allowFallback: boolean, onProgress?: (done: number, total: number) => Promise<void> | void): Promise<{ system: string; user: string; tokens: number }> {
  const { pages, sections, rawPages } = plan
  if (sections.length === 1) return { system: SUMMARY_SYSTEM, user: summaryUser(pages, language), tokens: 0 }
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
  const notesJson = JSON.stringify(notes.filter((n) => n.notes).map((n) => ({ pages: `${n.from}-${n.to}`, ...n.notes })))
  return { system: COMBINE_SYSTEM, user: combineUser(notesJson, rawPages.length, pages[0]?.text ?? '', language), tokens }
}

/** Share of cited items whose quote is in the document (1 when there is nothing to check). */
export function verifiedShare(s: DocumentSummary, rawPages: string[]): number {
  const sp = rawPages.map(squash)
  const all = [...s.keyPoints, ...s.decisions, ...s.actions]
  return all.length ? all.filter((x) => checkItem(x, sp).verified).length / all.length : 1
}

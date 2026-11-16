/** Document summaries: what the model must return, and a forgiving normaliser in front of the strict schema. */
import { z } from 'zod'

export const SUMMARY_DOC_TYPES = ['specification', 'report', 'minutes', 'letter', 'contract', 'permit', 'other'] as const
export type SummaryDocType = (typeof SUMMARY_DOC_TYPES)[number]

const Cited = z.object({
  text: z.string().min(1).max(600),
  page: z.number().int().positive().nullable(),
  quote: z.string().max(400).nullable(),
})
const Action = Cited.extend({
  owner: z.string().max(120).nullable(),
  due: z.string().max(60).nullable(), // as written in the document; never computed
})

export const DocumentSummarySchema = z.object({
  title: z.string().max(300).nullable(),
  documentType: z.enum(SUMMARY_DOC_TYPES),
  language: z.string().max(8),
  summary: z.string().min(1).max(2500),
  keyPoints: z.array(Cited).max(12),
  decisions: z.array(Cited).max(30),
  actions: z.array(Action).max(40),
  openQuestions: z.array(Cited).max(20),
  warnings: z.array(z.string().max(400)).max(10),
})
export type DocumentSummary = z.infer<typeof DocumentSummarySchema>

/** Notes taken from one section of a long document (the "map" step). */
export const SectionNotesSchema = z.object({
  gist: z.string().max(1500),
  points: z.array(Cited).max(15),
  decisions: z.array(Cited).max(20),
  actions: z.array(Action).max(25),
  openQuestions: z.array(Cited).max(15),
  figures: z.array(z.object({ subject: z.string().max(200), value: z.string().max(120), page: z.number().int().positive().nullable(), quote: z.string().max(400).nullable() })).max(60),
})
export type SectionNotes = z.infer<typeof SectionNotesSchema>

const str = (v: unknown, max: number): string | null => {
  if (v == null) return null
  const s = String(typeof v === 'object' ? (v as { value?: unknown }).value ?? '' : v).trim()
  return s ? s.slice(0, max) : null
}
const pageOf = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : parseInt(String(v ?? '').replace(/[^\d]/g, ''), 10)
  return Number.isInteger(n) && n > 0 ? n : null
}
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : [])

function cited(v: unknown) {
  if (typeof v === 'string') return v.trim() ? { text: v.trim().slice(0, 600), page: null, quote: null } : null
  if (!v || typeof v !== 'object') return null
  const o = v as Record<string, unknown>
  const text = str(o.text ?? o.point ?? o.decision ?? o.action ?? o.task, 600)
  return text ? { text, page: pageOf(o.page), quote: str(o.quote, 400) } : null
}
function action(v: unknown) {
  const c = cited(v)
  if (!c) return null
  const o = (typeof v === 'object' && v ? v : {}) as Record<string, unknown>
  return { ...c, owner: str(o.owner ?? o.who ?? o.responsible, 120), due: str(o.due ?? o.deadline ?? o.dueDate, 60) }
}
function figure(v: unknown) {
  if (!v || typeof v !== 'object') return null
  const o = v as Record<string, unknown>
  const subject = str(o.subject ?? o.what, 200), value = str(o.value, 120)
  return subject && value ? { subject, value, page: pageOf(o.page), quote: str(o.quote, 400) } : null
}
const keep = <T,>(xs: Array<T | null>, max: number): T[] => xs.filter((x): x is T => x !== null).slice(0, max)

export function normaliseSummary(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object') return raw
  const o = raw as Record<string, unknown>
  const type = String(o.documentType ?? o.type ?? 'other').toLowerCase().trim()
  return {
    title: str(o.title, 300),
    documentType: (SUMMARY_DOC_TYPES as readonly string[]).includes(type) ? type : 'other',
    language: String(o.language ?? 'other').toLowerCase().slice(0, 8),
    summary: str(o.summary, 2500) ?? '',
    keyPoints: keep(arr(o.keyPoints ?? o.points).map(cited), 12),
    decisions: keep(arr(o.decisions).map(cited), 30),
    actions: keep(arr(o.actions ?? o.actionItems).map(action), 40),
    openQuestions: keep(arr(o.openQuestions ?? o.open_questions ?? o.questions).map(cited), 20),
    warnings: keep(arr(o.warnings).map((w) => str(w, 400)), 10),
  }
}

export function normaliseNotes(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object') return raw
  const o = raw as Record<string, unknown>
  return {
    gist: str(o.gist ?? o.summary, 1500) ?? '',
    points: keep(arr(o.points ?? o.keyPoints).map(cited), 15),
    decisions: keep(arr(o.decisions).map(cited), 20),
    actions: keep(arr(o.actions ?? o.actionItems).map(action), 25),
    openQuestions: keep(arr(o.openQuestions ?? o.open_questions ?? o.questions).map(cited), 15),
    figures: keep(arr(o.figures).map(figure), 60),
  }
}

/** Two places where the document gives different values for the same thing. */
const Side = z.object({ value: z.string().min(1).max(120), page: z.number().int().positive().nullable(), quote: z.string().max(400).nullable() })
export const ContradictionsSchema = z.object({ contradictions: z.array(z.object({ subject: z.string().min(1).max(200), a: Side, b: Side })).max(12) })
export type Contradictions = z.infer<typeof ContradictionsSchema>

export function normaliseContradictions(raw: unknown): unknown {
  const list = Array.isArray(raw) ? raw : arr((raw as Record<string, unknown> | null)?.contradictions ?? (raw as Record<string, unknown> | null)?.conflicts)
  const side = (v: unknown) => {
    if (!v || typeof v !== 'object') return null
    const o = v as Record<string, unknown>
    const value = str(o.value, 120)
    return value ? { value, page: pageOf(o.page), quote: str(o.quote, 400) } : null
  }
  return {
    contradictions: keep(list.map((c) => {
      if (!c || typeof c !== 'object') return null
      const o = c as Record<string, unknown>
      const subject = str(o.subject ?? o.what, 200), a = side(o.a ?? o.first), b = side(o.b ?? o.second)
      return subject && a && b ? { subject, a, b } : null
    }), 12),
  }
}

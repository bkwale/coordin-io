/** Summary → tasks: the parts with no database in them. */
import type { SummaryMapping } from './summary-core'
import type { SummaryLanguage } from './prompts/summary'

export interface SummaryRunInput { kind: 'summary'; documentId: string; revisionId: string; revision: string; title: string; pages: number; language: SummaryLanguage; truncated: boolean; format: string }

export function parseRunInput(inputSummary: string): Partial<SummaryRunInput> & { rejected?: boolean } {
  try { const v = JSON.parse(inputSummary); return v && typeof v === 'object' ? v : {} } catch { return {} }
}

/** Tasks already made from a run: action index → task id. Stored on the run so a second click cannot duplicate them. */
export function tasksMade(citations: unknown): Record<string, string> {
  const t = citations && typeof citations === 'object' ? (citations as { tasks?: unknown }).tasks : null
  return t && typeof t === 'object' ? Object.fromEntries(Object.entries(t as Record<string, unknown>).filter(([, v]) => typeof v === 'string')) as Record<string, string> : {}
}

export interface TaskPick { index: number; ownerId: string | null; dueDate: Date | null }

/** The task text for one action: what to do, and exactly where the document says it. Nothing the document did not say. */
export function taskDraft(action: SummaryMapping['actions'][number], documentTitle: string): { title: string; description: string } {
  const lines = [`From the document "${documentTitle}"${action.page ? `, page ${action.page}` : ''}.`]
  if (action.quote) lines.push(`Document wording: "${action.quote}"`)
  if (action.owner) lines.push(`Named in the document: ${action.owner}`)
  if (action.due) lines.push(`Deadline in the document: ${action.due}`)
  if (!action.verified) lines.push('The wording could not be matched to the document. Check it against the file.')
  lines.push('Created from an AI summary and confirmed by a person.')
  return { title: action.text.slice(0, 500), description: lines.join('\n').slice(0, 5000) }
}


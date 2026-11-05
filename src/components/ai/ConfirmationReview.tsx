'use client'

/**
 * One generic review surface for anything the AI pre-fills: rows of {label, value, confidence, page, quote},
 * each accepted / edited / rejected by a human. Numeric bounds are shown as "≤ 6.5 m" and never pre-accepted.
 * "p.4" opens the source document at that page (Fadell: it must open the page, or it's decoration).
 */
import { useState } from 'react'
import { Check, X, ExternalLink, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface ReviewRow {
  id: string
  label: string
  /** Display value (already formatted). */
  display: string
  kind: 'value' | 'bound'
  confidence: number
  page: number | null
  quote: string | null
  because: string
  preAccept: boolean
}

export interface ConditionRow {
  id: string
  topic: string
  text: string
  page: number | null
  mandatory: boolean
  citation: string
}

export function ConfirmationReview({ rows, conditions, documentUrl, accepted, onToggle, acceptedConditions, onToggleCondition, showConditions = true }: {
  rows: ReviewRow[]
  conditions: ConditionRow[]
  documentUrl: string | null
  accepted: Set<string>
  onToggle: (id: string, on: boolean) => void
  acceptedConditions: Set<string>
  onToggleCondition: (id: string, on: boolean) => void
  /** Briefs carry no municipal conditions. */
  showConditions?: boolean
}) {
  const [showQuote, setShowQuote] = useState<string | null>(null)
  const pageLink = (page: number | null) => {
    if (!page) return null
    const href = documentUrl ? `${documentUrl}#page=${page}` : null
    const el = <span className="font-mono text-[10px] px-1.5 py-0.5 rounded border border-surface-300 text-ink-500 bg-white">p.{page}</span>
    return href ? <a href={href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 hover:text-accent-600" title={`Open the document at page ${page}`}>{el}<ExternalLink className="w-3 h-3" /></a> : el
  }
  const conf = (c: number) => (
    <span className={cn('text-[10px] px-1.5 py-0.5 rounded border shrink-0', c >= 0.8 ? 'bg-green-50 text-green-700 border-green-200' : c >= 0.5 ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-red-50 text-red-700 border-red-200')}>
      {c >= 0.8 ? 'high' : c >= 0.5 ? 'medium' : <span className="flex items-center gap-1"><AlertTriangle className="w-3 h-3" />verify</span>}
    </span>
  )

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-surface-200 bg-white">
        <div className="px-4 py-3 border-b border-surface-100">
          <div className="text-[13px] font-semibold text-ink-900">Pre-filled from the document</div>
          <div className="text-[11px] text-ink-400">Accept each value or leave it off.{showConditions && ' Limits marked ≤ are municipal bounds — type your design value in the questionnaire; it must stay within them.'}</div>
        </div>
        <ul>
          {rows.map((r) => {
            const on = accepted.has(r.id)
            return (
              <li key={r.id} className={cn('px-4 py-2.5 border-b border-surface-100 last:border-0 flex items-start gap-3', on ? 'bg-accent-50/30' : '')}>
                <button type="button" onClick={() => onToggle(r.id, !on)} className={cn('mt-0.5 w-5 h-5 rounded border flex items-center justify-center shrink-0', on ? 'bg-accent-500 border-accent-500 text-white' : 'border-surface-300 text-transparent hover:border-accent-400')} aria-label={on ? 'Reject' : 'Accept'}>
                  <Check className="w-3.5 h-3.5" />
                </button>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[12px] text-ink-500">{r.label}</span>
                    <span className={cn('text-[13px] font-medium', r.kind === 'bound' ? 'text-amber-800' : 'text-ink-900')}>{r.display}</span>
                    {r.kind === 'bound' && <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">bound</span>}
                    {conf(r.confidence)}
                    {pageLink(r.page)}
                  </div>
                  <div className="text-[11px] text-ink-400 mt-0.5">{r.because}{r.quote && <button type="button" onClick={() => setShowQuote(showQuote === r.id ? null : r.id)} className="ml-2 underline decoration-dotted hover:text-ink-700">{showQuote === r.id ? 'hide quote' : 'show quote'}</button>}</div>
                  {showQuote === r.id && r.quote && <blockquote className="mt-1 text-[11px] text-ink-600 border-l-2 border-accent-200 pl-2 italic">“{r.quote}”</blockquote>}
                </div>
              </li>
            )
          })}
          {rows.length === 0 && <li className="px-4 py-3 text-[12px] text-ink-400">Nothing could be pre-filled from this document.</li>}
        </ul>
      </section>

      {showConditions && <section className="rounded-xl border border-surface-200 bg-white">
        <div className="px-4 py-3 border-b border-surface-100 flex items-center justify-between">
          <div>
            <div className="text-[13px] font-semibold text-ink-900">Municipal conditions <span className="text-[11px] text-ink-400 font-normal">{acceptedConditions.size} of {conditions.length} selected</span></div>
            <div className="text-[11px] text-ink-400">Each becomes a checklist item citing the document and page. Untick anything that is not an obligation.</div>
          </div>
          <div className="flex gap-1">
            <button type="button" onClick={() => conditions.forEach((c) => onToggleCondition(c.id, true))} className="text-[11px] px-2 py-1 rounded border border-surface-300 text-ink-600 hover:border-accent-400">All</button>
            <button type="button" onClick={() => conditions.forEach((c) => onToggleCondition(c.id, false))} className="text-[11px] px-2 py-1 rounded border border-surface-300 text-ink-600 hover:border-accent-400">None</button>
          </div>
        </div>
        <ul>
          {conditions.map((c) => {
            const on = acceptedConditions.has(c.id)
            return (
              <li key={c.id} className={cn('px-4 py-2.5 border-b border-surface-100 last:border-0 flex items-start gap-3', !on && 'opacity-60')}>
                <button type="button" onClick={() => onToggleCondition(c.id, !on)} className={cn('mt-0.5 w-5 h-5 rounded border flex items-center justify-center shrink-0', on ? 'bg-accent-500 border-accent-500 text-white' : 'border-surface-300 text-transparent hover:border-accent-400')} aria-label={on ? 'Exclude' : 'Include'}>
                  {on ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
                </button>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] text-ink-900"><span className="font-medium">{c.topic}</span>{c.topic ? ' — ' : ''}{c.text}</div>
                  <div className="text-[11px] text-ink-400 mt-0.5 flex items-center gap-2 flex-wrap"><span className="font-mono">{c.citation}</span>{pageLink(c.page)}{!c.mandatory && <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface-100 text-ink-500 border border-surface-200">recommended</span>}</div>
                </div>
              </li>
            )
          })}
          {conditions.length === 0 && <li className="px-4 py-3 text-[12px] text-ink-400">No conditions found.</li>}
        </ul>
      </section>}
    </div>
  )
}

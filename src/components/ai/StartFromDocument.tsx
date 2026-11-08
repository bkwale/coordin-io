'use client'

/**
 * New-project wizard, first step: drop in the document that starts the project — Estonian planning
 * conditions, an English decision notice, or a client brief. The AI reads it, the wizard fills in, and the
 * full review (every value with its source quote, every municipal condition) waits on the new project's
 * Regulatory page. Nothing is confirmed here.
 */
import { useEffect, useRef, useState } from 'react'
import { FileUp, Loader2, Check, X, AlertTriangle, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ProjectSetupMapping } from '@/lib/ai/map-project'
import { readingSummary } from '@/lib/ai/wizard-prefill'

type Kind = 'planning_conditions' | 'decision_notice' | 'brief'
type Stage = { name: string; status: 'running' | 'done' | 'failed'; ms?: number; detail?: string }
type Run = { id: string; status: string; stages: Stage[]; mapping: ProjectSetupMapping | null; error: string | null }
export interface WizardReading { runId: string; mapping: ProjectSetupMapping; file: File | null }

const POLL_MS = 1500
const GIVE_UP_MS = 8 * 60_000
const STAGE_LABEL: Record<string, string> = { read: 'Reading the document', extract: 'Finding the facts', map: 'Matching to the rules' }

export function StartFromDocument({ jurisdiction, onRead, onSkip }: {
  /** EE → planning conditions, GB → decision notice; null → brief only. */
  jurisdiction: 'EE' | 'GB' | null
  onRead: (r: WizardReading) => void
  onSkip: () => void
}) {
  const official: Kind | null = jurisdiction === 'GB' ? 'decision_notice' : jurisdiction === 'EE' ? 'planning_conditions' : null
  const [kind, setKind] = useState<Kind>(official ?? 'brief')
  useEffect(() => { setKind(official ?? 'brief') }, [official])
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [run, setRun] = useState<Run | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const lastFile = useRef<File | null>(null)
  const poll = useRef<ReturnType<typeof setInterval> | null>(null)
  useEffect(() => () => { if (poll.current) clearInterval(poll.current) }, [])

  function stop(message?: string) {
    if (poll.current) clearInterval(poll.current)
    poll.current = null
    setBusy(false)
    if (message) setErr(message)
  }

  async function submit(file: File | null) {
    setErr(null); setRun(null); setBusy(true)
    lastFile.current = file
    const fd = new FormData()
    fd.set('kind', kind)
    if (file) fd.set('file', file); else fd.set('text', text)
    try {
      const res = await fetch('/api/projects/setup/read', { method: 'POST', body: fd })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) return stop(body.error || 'Could not read that document.')
      const id = body.data.runId as string
      const started = Date.now()
      let fails = 0
      poll.current = setInterval(async () => {
        if (Date.now() - started > GIVE_UP_MS) return stop('This is taking far too long. Carry on by hand — you can add the document on the Regulatory page later.')
        const r = await fetch(`/api/projects/setup/read/${id}`, { cache: 'no-store' }).catch(() => null)
        if (!r || !r.ok) { if (++fails >= 5) stop('Lost contact with Coordin. Check your connection and try again, or carry on by hand.'); return }
        fails = 0
        const { data } = (await r.json()) as { data: Run }
        setRun(data)
        if (data.status === 'FAILED') stop()
        if (data.status === 'AWAITING_CONFIRMATION' && data.mapping) {
          stop()
          onRead({ runId: data.id, mapping: data.mapping, file: lastFile.current })
        }
      }, POLL_MS)
    } catch { stop('Could not reach Coordin. Check your connection and try again, or carry on by hand.') }
  }

  const m = run?.status === 'AWAITING_CONFIRMATION' ? run.mapping : null
  const summary = m ? readingSummary(m) : null
  const docName = kind === 'decision_notice' ? 'planning decision notice' : kind === 'planning_conditions' ? 'planning conditions (projekteerimistingimused)' : 'client brief'

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-accent-200 bg-gradient-to-br from-accent-50/60 to-white p-4 sm:p-5">
        <div className="flex items-center gap-2 text-sm font-semibold text-ink-900"><Sparkles className="w-4 h-4 text-accent-600" /> Start from a document</div>
        <p className="text-[13px] text-ink-500 mt-1">
          Drop in the document that started this project. Coordin reads it and fills in the project for you — you check everything before anything is saved.
        </p>

        {!m && (
          <div className="mt-4 space-y-3">
            <div className="flex gap-1 p-0.5 rounded-md bg-surface-100 text-[12px]">
              {([...(official ? [[official, official === 'decision_notice' ? 'Decision notice' : 'Planning conditions (PT)']] : []), ['brief', 'Client brief']] as Array<[Kind, string]>).map(([k, label]) => (
                <button key={k} type="button" disabled={busy} onClick={() => setKind(k)} className={cn('flex-1 px-2 py-1.5 rounded', kind === k ? 'bg-white shadow-sm text-ink-900 font-medium' : 'text-ink-500 hover:text-ink-700')}>{label}</button>
              ))}
            </div>
            <input ref={fileRef} type="file" accept="application/pdf" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) submit(f); e.target.value = '' }} />
            <button type="button" disabled={busy} onClick={() => fileRef.current?.click()} className="w-full flex items-center justify-center gap-2 px-3 py-6 rounded-lg border-2 border-dashed border-surface-300 bg-white text-[13px] text-ink-500 hover:border-accent-400 disabled:opacity-60">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileUp className="w-4 h-4" />} {busy ? 'Reading…' : `Choose the ${docName} (PDF)`}
            </button>
            {!busy && (
              <details className="text-[12px] text-ink-500">
                <summary className="cursor-pointer">Or paste the text</summary>
                <textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} placeholder="Paste the document text…" className="mt-2 w-full text-[12px] px-2.5 py-1.5 rounded-md border border-surface-300" />
                <button type="button" disabled={text.trim().length < 300} onClick={() => submit(null)} className="mt-1 px-3 py-1.5 rounded-md bg-accent-500 text-white text-[12px] font-medium disabled:opacity-40">Read pasted text</button>
              </details>
            )}
          </div>
        )}

        {run && run.stages.length > 0 && !m && (
          <div className="mt-3 space-y-1">
            {run.stages.map((s) => (
              <div key={s.name} className="flex items-center gap-2 text-[12px]">
                {s.status === 'running' ? <Loader2 className="w-3.5 h-3.5 animate-spin text-accent-500" /> : s.status === 'done' ? <Check className="w-3.5 h-3.5 text-green-600" /> : <X className="w-3.5 h-3.5 text-red-600" />}
                <span className="text-ink-700">{STAGE_LABEL[s.name] ?? s.name}</span>
                {s.detail && <span className="text-ink-400 truncate">· {s.detail}</span>}
              </div>
            ))}
          </div>
        )}

        {(err || run?.status === 'FAILED') && (
          <div role="alert" className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-800 flex gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <div>{err ?? run?.error ?? 'Something went wrong while reading this.'} Nothing has been saved.</div>
          </div>
        )}

        {m && summary && (
          <div className="mt-4 rounded-lg border border-green-200 bg-white p-3 text-[13px]">
            <div className="flex items-center gap-2 font-medium text-green-800"><Check className="w-4 h-4" /> Read. The next steps are filled in from it.</div>
            {summary.facts.length > 0 && <ul className="mt-2 space-y-0.5 text-ink-700">{summary.facts.map((f) => <li key={f}>· {f}</li>)}</ul>}
            {(summary.conditions > 0 || summary.limits > 0) && (
              <div className="mt-2 text-ink-500">
                Also found {summary.conditions > 0 && <b>{summary.conditions} condition{summary.conditions === 1 ? '' : 's'}</b>}{summary.conditions > 0 && summary.limits > 0 && ' and '}{summary.limits > 0 && <b>{summary.limits} limit{summary.limits === 1 ? '' : 's'}</b>}. You’ll review them, with the source line for each, on the project’s Regulatory page straight after you create it.
              </div>
            )}
          </div>
        )}
      </div>

      <button type="button" onClick={onSkip} className="text-[13px] text-ink-500 hover:text-ink-800 underline underline-offset-2">
        {m ? 'Continue' : 'No document — fill in by hand'}
      </button>
    </div>
  )
}

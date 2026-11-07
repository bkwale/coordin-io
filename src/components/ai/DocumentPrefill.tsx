'use client'

/**
 * "Pre-fill from a document" — drop a planning-conditions PDF (or paste text), watch the stages,
 * review every value in ConfirmationReview, then confirm. On confirm the parent receives the merged
 * parameters and the run id; the server writes the profile + municipal items.
 */
import { useEffect, useRef, useState } from 'react'
import { FileUp, Loader2, Check, X, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ConfirmationReview, type ReviewRow, type ConditionRow } from './ConfirmationReview'

type Stage = { name: string; status: 'running' | 'done' | 'failed'; ms?: number; detail?: string }
type Prefill = { key: string; value: unknown; kind: 'value' | 'bound'; label: string; because: string; confidence: number; page: number | null; quote: string | null; preAccept: boolean }
type Kind = 'planning_conditions' | 'brief' | 'decision_notice'
type Mapping = { kind?: Kind; document: { number: string | null; issuer: string | null; issuedAt: string | null; validUntil: string | null; projectName?: string | null; client?: string | null; ehrCode?: string | null }; prefills: Prefill[]; conditions: Array<{ topic: string; text: string; page: number | null; mandatory: boolean; citation: string; verified?: boolean }>; bounds: { maxHeightM: number | null; maxStoreys: number | null }; warnings: string[]; suspicious?: { pages: number[]; excerpts: string[] } }
type Run = { id: string; status: string; stages: Stage[]; mapping: Mapping | null; error: string | null; errorKind?: string | null; documentUrl: string | null }
type AIStatus = { available: boolean; message: string | null }

const POLL_MS = 1500
/** The server closes runs after 6 min; stop polling a little later whatever happens. */
const POLL_GIVE_UP_MS = 8 * 60_000
const POLL_MAX_FAILS = 5

const LABELS: Record<string, string> = { jurisdiction: 'Jurisdiction', buildingType: 'Building type', workType: 'Work', detailedPlanExists: 'Detailed plan', county: 'County', heritage: 'Heritage', urbanArea: 'Urban area', height: 'Height', storeys: 'Storeys', grossFloorArea: 'Gross floor area', apartments: 'Apartments', parkingSpaces: 'Parking', timberStructure: 'Structure', districtHeatingAvailable: 'District heating' }

export function DocumentPrefill({ projectId, jurisdiction = 'EE', onApplyValues, onPending, onEhrCode }: {
  projectId: string
  /** Which official document the reader offers: Estonian PT or an English decision notice. */
  jurisdiction?: string
  /** Called with accepted VALUE prefills (never bounds) so the questionnaire fills in before the architect confirms. bounds = null means "leave existing bounds alone" (briefs carry none). */
  onApplyValues: (values: Record<string, unknown>, bounds: { maxHeightM: number | null; maxStoreys: number | null } | null) => void
  /** The run awaiting confirmation + selected condition indexes; null when nothing is pending. The page's Generate button confirms it. */
  onPending: (p: { runId: string; acceptedConditions: number[] } | null) => void
  /** EHR code found in the document, so the Ehitisregister panel can offer to link it. */
  onEhrCode?: (code: string | null) => void
}) {
  const [open, setOpen] = useState(false)
  const official: Kind = jurisdiction === 'GB' ? 'decision_notice' : 'planning_conditions'
  const [kind, setKind] = useState<Kind>(official)
  const firstOfficial = useRef(official)
  useEffect(() => {
    setKind((k) => (k === 'brief' ? k : official))
    // A run read under the other country's rules is not relevant any more
    if (firstOfficial.current !== official) { firstOfficial.current = official; if (pollRef.current) clearInterval(pollRef.current); pollRef.current = null; setRun(null); setBusy(false); onPending(null) }
  }, [official]) // eslint-disable-line react-hooks/exhaustive-deps
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [run, setRun] = useState<Run | null>(null)
  const [err, setErr] = useState<{ message: string; ref?: string; manual?: boolean } | null>(null)
  const [aiStatus, setAiStatus] = useState<AIStatus | null>(null)
  const lastFile = useRef<File | null>(null)
  const [accepted, setAccepted] = useState<Set<string>>(new Set())
  const [acceptedConds, setAcceptedConds] = useState<Set<string>>(new Set())
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current) }, [])
  // Before anyone uploads: is AI reading available right now? If not, say so and point to the manual path.
  useEffect(() => {
    if (!open) return
    fetch('/api/ai/status', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).then((b) => setAiStatus(b?.data ?? null)).catch(() => setAiStatus(null))
  }, [open])

  function stopPolling(message?: string) {
    if (pollRef.current) clearInterval(pollRef.current)
    pollRef.current = null
    setBusy(false)
    if (message) setErr({ message, manual: true })
  }

  async function submit(file: File | null, retryOf?: string) {
    setErr(null); setRun(null); setBusy(true)
    if (file) lastFile.current = file
    const fd = new FormData()
    fd.set('kind', kind)
    if (file) fd.set('file', file); else fd.set('text', text)
    if (retryOf) fd.set('retryOf', retryOf)
    try {
      const res = await fetch(`/api/projects/${projectId}/setup/extract`, { method: 'POST', body: fd })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) { setErr({ message: body.error || 'Could not start', ref: body.ref, manual: body.manual || res.status >= 500 }); setBusy(false); return }
      const id = body.data.runId as string
      if (pollRef.current) clearInterval(pollRef.current)
      const startedAt = Date.now()
      let fails = 0
      pollRef.current = setInterval(async () => {
        if (Date.now() - startedAt > POLL_GIVE_UP_MS) return stopPolling('This is taking much longer than it should. Nothing in your project has changed — fill in the details by hand, or try again later.')
        let r: Response
        try { r = await fetch(`/api/projects/${projectId}/setup/runs/${id}`, { cache: 'no-store' }) } catch { r = new Response(null, { status: 599 }) }
        if (!r.ok) {
          if (++fails >= POLL_MAX_FAILS) stopPolling('Lost contact with Coordin while reading the document. Check your connection, then try again — or fill in the details by hand.')
          return
        }
        fails = 0
        const { data } = (await r.json()) as { data: Run }
        setRun(data)
        if (data.status === 'AWAITING_CONFIRMATION' || data.status === 'FAILED' || data.status === 'APPLIED') {
          if (pollRef.current) clearInterval(pollRef.current)
          setBusy(false)
          if (data.status === 'AWAITING_CONFIRMATION' && data.mapping) {
            const pre = new Set(data.mapping.prefills.filter((p) => p.preAccept).map((p) => p.key))
            setAccepted(pre)
            // Only conditions whose wording was found in the document are pre-ticked — and none if the
            // document contained text addressed to an AI (the architect ticks each one deliberately)
            setAcceptedConds(new Set(data.mapping.suspicious || (data.mapping.document.validUntil && data.mapping.document.validUntil.slice(0, 10) < new Date().toISOString().slice(0, 10)) ? [] : data.mapping.conditions.flatMap((c, i) => (c.verified && (data.mapping!.kind !== 'decision_notice' || c.mandatory) ? [String(i)] : []))))
          }
        }
      }, POLL_MS)
    } catch { setErr({ message: 'Could not reach Coordin. Check your connection and try again — or fill in the details by hand.', manual: true }); setBusy(false) }
  }

  const canRetry = run?.status === 'FAILED' && run.errorKind !== 'config' && run.errorKind !== 'input' && (lastFile.current || text.trim().length >= 300)
  function retry() { if (run) submit(lastFile.current, run.id) }
  function fillByHand() { setOpen(false); setRun(null); setErr(null) }

  const m = run?.mapping ?? null
  const rows: ReviewRow[] = (m?.prefills ?? []).map((p) => ({ id: p.key, label: LABELS[p.key] ?? p.key, display: p.kind === 'bound' ? p.label : String(p.value === true ? 'Yes' : p.value === false ? 'No' : p.label), kind: p.kind, confidence: p.confidence, page: p.page, quote: p.quote, because: p.because, preAccept: p.preAccept }))
  const conds: ConditionRow[] = (m?.conditions ?? []).map((c, i) => ({ id: String(i), ...c }))

  function applyToForm() {
    if (!m) return
    const values: Record<string, unknown> = {}
    for (const p of m.prefills) if (p.kind === 'value' && accepted.has(p.key)) values[p.key] = p.value
    onApplyValues(values, m.kind === 'brief' || m.kind === 'decision_notice' ? null : { maxHeightM: accepted.has('height') ? m.bounds.maxHeightM : null, maxStoreys: accepted.has('storeys') ? m.bounds.maxStoreys : null })
  }

  // expose confirm to the parent via a window-free pattern: parent calls confirm through onConfirmed after generate
  useEffect(() => { if (run?.status === 'AWAITING_CONFIRMATION' && m) applyToForm() /* eslint-disable-line react-hooks/exhaustive-deps */ }, [accepted, run?.status])
  useEffect(() => {
    const code = run?.mapping?.document.ehrCode
    if (run?.status === 'AWAITING_CONFIRMATION' && code && /^\d{9}$/.test(code)) onEhrCode?.(code)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run?.id, run?.status])
  useEffect(() => {
    if (run?.status === 'AWAITING_CONFIRMATION') onPending({ runId: run.id, acceptedConditions: Array.from(acceptedConds).map(Number) })
    else onPending(null)
    return () => onPending(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run?.id, run?.status, acceptedConds])

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="w-full mb-3 flex items-center gap-2 px-3 py-2.5 rounded-lg border border-dashed border-accent-300 bg-accent-50/40 text-[12px] text-accent-700 hover:border-accent-500">
        <FileUp className="w-4 h-4" /> Pre-fill from a document — planning conditions or client brief (PDF)
      </button>
    )
  }

  return (
    <div className="mb-3 rounded-lg border border-accent-200 bg-white p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-[12px] font-semibold text-ink-900">Pre-fill from a document</div>
        <button type="button" onClick={() => { setOpen(false); setRun(null) }} className="text-ink-400 hover:text-ink-700"><X className="w-4 h-4" /></button>
      </div>
      {aiStatus && !aiStatus.available && (
        <div role="status" className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded px-2 py-1.5 flex gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <div>{aiStatus.message} <button type="button" onClick={fillByHand} className="underline font-medium">Fill in by hand</button></div>
        </div>
      )}
      {!run && (
        <>
          <div className="flex gap-1 p-0.5 rounded-md bg-surface-100 text-[11px]">
            {([[official, official === 'decision_notice' ? 'Planning decision notice' : 'Planning conditions (PT)'], ['brief', 'Client brief']] as const).map(([k, label]) => (
              <button key={k} type="button" disabled={busy} onClick={() => setKind(k)} className={cn('flex-1 px-2 py-1 rounded', kind === k ? 'bg-white shadow-sm text-ink-900 font-medium' : 'text-ink-500 hover:text-ink-700')}>{label}</button>
            ))}
          </div>
          <div className="text-[10px] text-ink-400">{kind === 'brief' ? 'What the client wants — values become proposals you confirm. No limits or municipal conditions come from a brief.' : kind === 'decision_notice' ? 'The council’s decision notice — every condition becomes a checklist item, with the commencement deadline and pre-commencement conditions flagged.' : 'The municipality’s projekteerimistingimused — limits become bounds, obligations become checklist items.'}</div>
          <input ref={fileRef} type="file" accept="application/pdf" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) submit(f) }} />
          <button type="button" disabled={busy} onClick={() => fileRef.current?.click()} className="w-full flex items-center justify-center gap-2 px-3 py-4 rounded-lg border-2 border-dashed border-surface-300 text-[12px] text-ink-500 hover:border-accent-400">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileUp className="w-4 h-4" />} {kind === 'brief' ? 'Drop the client brief PDF here or click' : kind === 'decision_notice' ? 'Drop the decision notice PDF here or click' : 'Drop the projekteerimistingimused PDF here or click'}
          </button>
          <div className="text-[10px] text-ink-300 text-center">or paste the text</div>
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} placeholder="Paste the document text…" className="w-full text-[12px] px-2.5 py-1.5 rounded-md border border-surface-300" />
          <button type="button" disabled={busy || text.trim().length < 300} onClick={() => submit(null)} className="w-full px-3 py-2 rounded-lg bg-accent-500 text-white text-[12px] font-medium disabled:opacity-40">Extract from pasted text</button>
          {err && <FailureNote message={err.message} reference={err.ref} onManual={err.manual ? fillByHand : undefined} />}
        </>
      )}
      {run && (
        <div className="space-y-1">
          {run.stages.map((s) => (
            <div key={s.name} className="flex items-center gap-2 text-[11px]">
              {s.status === 'running' ? <Loader2 className="w-3 h-3 animate-spin text-accent-500" /> : s.status === 'done' ? <Check className="w-3 h-3 text-green-600" /> : <X className="w-3 h-3 text-red-600" />}
              <span className="font-mono text-ink-500">{s.name}</span>
              <span className="text-ink-400">{s.detail}</span>
              {s.ms != null && <span className="ml-auto text-ink-300">{(s.ms / 1000).toFixed(1)}s</span>}
            </div>
          ))}
          {run.status === 'FAILED' && (
            <FailureNote
              message={run.error ?? 'Something went wrong while reading this.'}
              documentSaved={!!run.documentUrl}
              onRetry={canRetry ? retry : undefined}
              onManual={fillByHand}
              busy={busy}
            />
          )}
          {err && run.status !== 'FAILED' && <FailureNote message={err.message} onManual={fillByHand} />}
          {run.status === 'AWAITING_CONFIRMATION' && m && (
            <div className="mt-2">
              {m.kind === 'decision_notice' && <div className="text-[11px] text-ink-500 mb-2">Decision <b>{m.document.number ?? '?'}</b>{m.document.issuer ? ` · ${m.document.issuer}` : ''}{m.document.issuedAt ? ` · ${m.document.issuedAt.slice(0, 10)}` : ''}{m.document.validUntil ? ` · begin by ${m.document.validUntil}` : ''}</div>}
              {m.kind === 'planning_conditions' && m.document.number && <div className="text-[11px] text-ink-500 mb-2">PT nr <b>{m.document.number}</b>{m.document.issuer ? ` · ${m.document.issuer}` : ''}{m.document.validUntil ? ` · valid until ${m.document.validUntil}` : ''}</div>}
              {m.kind === 'brief' && (m.document.projectName || m.document.client) && <div className="text-[11px] text-ink-500 mb-2">Brief{m.document.projectName ? <> · <b>{m.document.projectName}</b></> : null}{m.document.client ? ` · ${m.document.client}` : ''}</div>}
              {m.suspicious && (
                <div className="text-[11px] text-red-800 bg-red-50 border border-red-300 rounded px-2 py-1.5 mb-2 flex gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <div><b>Possible tampering.</b> Text on p.{m.suspicious.pages.join(', p.')} is addressed to an AI system, not to you. Values from it were discarded and nothing is pre-ticked. Check this document came from the municipality.{m.suspicious.excerpts[0] && <div className="mt-1 italic text-red-700">“{m.suspicious.excerpts[0]}”</div>}</div>
                </div>
              )}
              {m.warnings.length > 0 && <div className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded px-2 py-1 mb-2">{m.warnings.join(' · ')}</div>}
              <ConfirmationReview showConditions={m.kind !== 'brief'} rows={rows} conditions={conds} documentUrl={run.documentUrl} accepted={accepted} onToggle={(id, on) => setAccepted((s) => { const n = new Set(s); on ? n.add(id) : n.delete(id); return n })} acceptedConditions={acceptedConds} onToggleCondition={(id, on) => setAcceptedConds((s) => { const n = new Set(s); on ? n.add(id) : n.delete(id); return n })} />
              <div className="text-[11px] text-ink-400 mt-2">{m.kind === 'brief' ? <>Accepted values are now in the questionnaire. Check them, fill anything missing, then press <b>Generate checklist</b>.</> : m.kind === 'decision_notice' ? <>Accepted values are now in the questionnaire. Answer the England questions, then press <b>Generate checklist</b> — the {acceptedConds.size} selected conditions will be added as planning-condition items.</> : <>Accepted values are now in the questionnaire. Type your design height and storeys within the bounds, then press <b>Generate checklist</b> — the {acceptedConds.size} selected conditions will be added as municipal items.</>}</div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/** One way of saying "this didn't work": what happened, that nothing changed, and what to do next. */
function FailureNote({ message, reference, documentSaved, onRetry, onManual, busy }: { message: string; reference?: string; documentSaved?: boolean; onRetry?: () => void; onManual?: () => void; busy?: boolean }) {
  return (
    <div role="alert" className="mt-1 rounded-md border border-red-200 bg-red-50 px-2.5 py-2 text-[11px] text-red-800 space-y-1.5">
      <div className="flex gap-1.5"><AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" /><div>{message}{reference && <span className="block text-red-600/80 mt-0.5">Reference: <span className="font-mono">{reference}</span></span>}</div></div>
      {documentSaved && <div className="text-red-700/80">Your document is saved in the project’s Documents.</div>}
      {(onRetry || onManual) && (
        <div className="flex gap-2 pt-0.5">
          {onRetry && <button type="button" disabled={busy} onClick={onRetry} className="px-2.5 py-1 rounded bg-white border border-red-300 font-medium hover:bg-red-100 disabled:opacity-50">Try again</button>}
          {onManual && <button type="button" onClick={onManual} className="px-2.5 py-1 rounded bg-white border border-surface-300 text-ink-700 font-medium hover:bg-surface-50">Fill in by hand</button>}
        </div>
      )}
    </div>
  )
}

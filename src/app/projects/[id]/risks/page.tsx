'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronRight, Loader2, RefreshCw, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'

type Severity = 'high' | 'medium' | 'low'
interface Signal { id: string; kind: string; area: string; severity: Severity; title: string; detail: string; link: string; record: { label: string }; cameBack?: boolean }
interface Dismissed { signal: Signal; reason: string; dismissedByName: string; dismissedAt: string }
interface Brief { id: string; status: string; createdAt: string; current: boolean; language: 'en' | 'et'; error: string | null; brief: { headline: string; overview: string; notes: string[]; priorities: Array<{ signalId: string; why: string; action: string; title: string; severity: Severity; link: string }> } | null }
interface Data { signals: Signal[]; dismissed: Dismissed[]; counts: { total: number; high: number; medium: number; low: number }; generatedAt: string }

const errText = (d: { error?: unknown }, fallback: string) => (typeof d.error === 'string' ? d.error : (d.error as { message?: string } | undefined)?.message) || fallback
const SEVERITY: Record<Severity, { label: string; dot: string; text: string }> = {
  high: { label: 'High', dot: 'bg-red-500', text: 'text-red-700' },
  medium: { label: 'Medium', dot: 'bg-amber-500', text: 'text-amber-700' },
  low: { label: 'Low', dot: 'bg-ink-300', text: 'text-ink-500' },
}
const AREA: Record<string, string> = { permits: 'Permits', schedule: 'Schedule', money: 'Hours', approvals: 'Waiting', documents: 'Documents' }

export default function ProjectRisksPage() {
  const projectId = useParams().id as string
  const [data, setData] = useState<Data | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState<string | null>(null) // flag whose "set aside" form is open
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [showDismissed, setShowDismissed] = useState(false)
  const [brief, setBrief] = useState<Brief | null>(null)
  const [writing, setWriting] = useState(false)
  const [briefError, setBriefError] = useState<string | null>(null)
  const [language, setLanguage] = useState<'en' | 'et'>('en')

  const loadBrief = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/risks/brief`, { cache: 'no-store' })
      const d = await res.json().catch(() => ({}))
      if (res.ok) { setBrief(d.data?.brief ?? null); if (d.data?.brief?.language) setLanguage(d.data.brief.language) }
    } catch { /* the flags below still show */ }
  }, [projectId])
  const writeBrief = async () => {
    setWriting(true); setBriefError(null)
    try {
      const res = await fetch(`/api/projects/${projectId}/risks/brief`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ language }) })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(errText(d, 'The AI could not write the brief.'))
      setBrief(d.data?.brief ?? null)
    } catch (e) { setBriefError(e instanceof Error ? e.message : 'The AI could not write the brief.') } finally { setWriting(false) }
  }

  const load = useCallback(async () => {
    setError(null)
    try {
      const res = await fetch(`/api/projects/${projectId}/risks`, { cache: 'no-store' })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(errText(d, 'Could not load the risks.'))
      setData(d.data)
      loadBrief()
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not load the risks.') } finally { setLoading(false) }
  }, [projectId, loadBrief])
  useEffect(() => { load() }, [load])

  const dismiss = async (id: string) => {
    setBusy(id); setError(null)
    try {
      const res = await fetch(`/api/projects/${projectId}/risks/dismiss`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ signalId: id, reason }) })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(errText(d, 'Could not set this aside.'))
      setOpen(null); setReason(''); await load()
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not set this aside.') } finally { setBusy(null) }
  }
  const restore = async (id: string) => {
    setBusy(id); setError(null)
    try {
      const res = await fetch(`/api/projects/${projectId}/risks/dismiss?signalId=${encodeURIComponent(id)}`, { method: 'DELETE' })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(errText(d, 'Could not bring this back.'))
      await load()
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not bring this back.') } finally { setBusy(null) }
  }

  if (loading) return <div className="flex items-center gap-2 text-[13px] text-ink-500"><Loader2 className="h-4 w-4 animate-spin" /> Checking the project…</div>

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-[18px] font-semibold text-ink-900">Risks</h2>
          <p className="mt-0.5 text-[12px] text-ink-500">What looks wrong on this project right now, worked out from its own tasks, milestones, permits, hours and documents. Each one links to the record behind it.</p>
        </div>
        <button onClick={() => { setLoading(true); load() }} className="inline-flex items-center gap-1.5 rounded-lg border border-ink-100 px-3 py-1.5 text-[12px] font-medium text-ink-600 hover:bg-surface-50"><RefreshCw className="h-3.5 w-3.5" /> Check again</button>
      </div>

      {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-[12px] text-red-800">{error}</div>}

      {data && (
        <>
          <div className="grid grid-cols-3 gap-3">
            {(['high', 'medium', 'low'] as Severity[]).map((s) => (
              <div key={s} className="rounded-xl border border-ink-100 bg-white px-4 py-3">
                <p className="flex items-center gap-2 text-[11px] font-medium text-ink-500"><span className={cn('h-2 w-2 rounded-full', SEVERITY[s].dot)} />{SEVERITY[s].label}</p>
                <p className="mt-1 text-[22px] font-semibold text-ink-900">{data.counts[s]}</p>
              </div>
            ))}
          </div>

          {data.signals.length > 0 && (
            <section aria-label="AI brief" className="rounded-xl border border-accent-100 bg-accent-50/40 px-5 py-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="flex items-center gap-2 text-[12px] font-semibold text-ink-800"><Sparkles className="h-4 w-4 text-accent-600" /> AI brief</p>
                <div className="flex items-center gap-2">
                  <label htmlFor="brief-language" className="sr-only">Language of the brief</label>
                  <select id="brief-language" value={language} onChange={(e) => setLanguage(e.target.value as 'en' | 'et')} disabled={writing} className="rounded-lg border border-ink-100 bg-white px-2 py-1 text-[11px] text-ink-700">
                    <option value="en">English</option>
                    <option value="et">Eesti</option>
                  </select>
                  <button onClick={writeBrief} disabled={writing} className="inline-flex items-center gap-1.5 rounded-lg bg-ink-900 px-3 py-1.5 text-[12px] font-medium text-white hover:bg-ink-800 disabled:opacity-50">
                    {writing && <Loader2 className="h-3.5 w-3.5 animate-spin" />}{writing ? 'Writing…' : brief?.brief ? 'Write again' : 'Write a brief'}
                  </button>
                </div>
              </div>
              {briefError && <p role="alert" className="mt-2 text-[12px] text-red-700">{briefError}</p>}
              {!brief?.brief && !writing && !briefError && <p className="mt-2 text-[12px] text-ink-500">Has the AI put the flags below in order and say what to do first. It is shown only these flags and adds nothing of its own.</p>}
              {brief?.brief && (
                <div className={cn('mt-3', writing && 'opacity-50')}>
                  {!brief.current && <p className="mb-2 inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800"><AlertTriangle className="h-3 w-3" /> The flags have changed since this was written</p>}
                  <p className="text-[14px] font-semibold text-ink-900">{brief.brief.headline}</p>
                  <p className="mt-1 text-[13px] leading-relaxed text-ink-700">{brief.brief.overview}</p>
                  {brief.brief.priorities.length > 0 && (
                    <ol className="mt-3 space-y-2.5">
                      {brief.brief.priorities.map((p, i) => (
                        <li key={p.signalId} className="flex items-start gap-3">
                          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white text-[11px] font-semibold text-ink-700 ring-1 ring-ink-100">{i + 1}</span>
                          <div className="min-w-0 flex-1">
                            <p className="flex items-center gap-2 text-[12px] font-medium text-ink-900"><span className={cn('h-2 w-2 shrink-0 rounded-full', SEVERITY[p.severity]?.dot)} />{p.title}</p>
                            <p className="mt-0.5 text-[12px] text-ink-600">{p.why}</p>
                            <p className="mt-0.5 text-[12px] font-medium text-ink-800">Next: {p.action}</p>
                          </div>
                          <Link href={p.link} className="shrink-0 rounded-lg border border-ink-100 bg-white px-2.5 py-1 text-[11px] font-medium text-ink-600 hover:bg-surface-50">Open</Link>
                        </li>
                      ))}
                    </ol>
                  )}
                  {brief.brief.notes.map((n) => <p key={n} className="mt-2 text-[11px] text-amber-800">{n}</p>)}
                  <p className="mt-3 text-[11px] text-ink-400">Written by AI {new Date(brief.createdAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })} from the flags below only. Check the record before acting.</p>
                </div>
              )}
            </section>
          )}

          {data.signals.length === 0 ? (
            <div className="rounded-xl border border-ink-100 bg-white p-10 text-center">
              <CheckCircle2 className="mx-auto mb-3 h-9 w-9 text-emerald-500" />
              <p className="text-[14px] font-medium text-ink-700">Nothing is flagged</p>
              <p className="mt-1 text-[12px] text-ink-400">No late tasks or milestones, no permit or condition dates at risk, hours within plan. This only knows what has been entered in Coordin.</p>
            </div>
          ) : (
            <ul className="divide-y divide-ink-50 overflow-hidden rounded-xl border border-ink-100 bg-white">
              {data.signals.map((s) => (
                <li key={s.id} className="px-5 py-3.5">
                  <div className="flex items-start gap-3">
                    <span className={cn('mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full', SEVERITY[s.severity].dot)} aria-label={`${SEVERITY[s.severity].label} severity`} />
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-medium text-ink-900">{s.title}</p>
                      <p className="mt-0.5 text-[12px] text-ink-500">{s.detail}</p>
                      <p className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px]">
                        <span className="rounded-full bg-surface-100 px-2 py-0.5 font-medium text-ink-500">{AREA[s.area] ?? s.area}</span>
                        <span className={cn('font-medium', SEVERITY[s.severity].text)}>{SEVERITY[s.severity].label}</span>
                        {s.cameBack && <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 font-medium text-amber-800"><AlertTriangle className="h-3 w-3" /> Set aside earlier, now worse</span>}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Link href={s.link} className="rounded-lg border border-ink-100 px-2.5 py-1 text-[11px] font-medium text-ink-600 hover:border-accent-200 hover:bg-accent-50 hover:text-accent-700">Open</Link>
                      <button onClick={() => { setOpen(open === s.id ? null : s.id); setReason('') }} className="rounded-lg px-2 py-1 text-[11px] font-medium text-ink-400 hover:text-ink-700">Set aside</button>
                    </div>
                  </div>
                  {open === s.id && (
                    <form className="ml-5 mt-3 flex flex-wrap items-center gap-2" onSubmit={(e) => { e.preventDefault(); dismiss(s.id) }}>
                      <label htmlFor={`reason-${s.id}`} className="sr-only">Why is this being set aside?</label>
                      <input id={`reason-${s.id}`} autoFocus value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} placeholder="Why is this not a concern? (kept on record)" className="min-w-[16rem] flex-1 rounded-lg border border-surface-300 px-3 py-1.5 text-[12px] text-ink-900 focus:outline-none focus:ring-2 focus:ring-accent-200" />
                      <button type="submit" disabled={busy === s.id || reason.trim().length < 3} className="inline-flex items-center gap-1.5 rounded-lg bg-ink-900 px-3 py-1.5 text-[12px] font-medium text-white hover:bg-ink-800 disabled:opacity-50">{busy === s.id && <Loader2 className="h-3.5 w-3.5 animate-spin" />}Set aside</button>
                      <button type="button" onClick={() => setOpen(null)} className="px-2 py-1.5 text-[12px] font-medium text-ink-500 hover:text-ink-700">Cancel</button>
                    </form>
                  )}
                </li>
              ))}
            </ul>
          )}

          {data.dismissed.length > 0 && (
            <div>
              <button onClick={() => setShowDismissed((v) => !v)} className="inline-flex items-center gap-1 text-[12px] font-medium text-ink-500 hover:text-ink-700" aria-expanded={showDismissed}>
                {showDismissed ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />} Set aside ({data.dismissed.length})
              </button>
              {showDismissed && (
                <ul className="mt-2 divide-y divide-ink-50 overflow-hidden rounded-xl border border-ink-100 bg-surface-50">
                  {data.dismissed.map((d) => (
                    <li key={d.signal.id} className="flex items-start justify-between gap-3 px-5 py-3">
                      <div className="min-w-0">
                        <p className="text-[12px] font-medium text-ink-700">{d.signal.title}</p>
                        <p className="mt-0.5 text-[11px] text-ink-500">“{d.reason}” · {d.dismissedByName}, {new Date(d.dismissedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                      </div>
                      <button onClick={() => restore(d.signal.id)} disabled={busy === d.signal.id} className="shrink-0 rounded-lg border border-ink-100 bg-white px-2.5 py-1 text-[11px] font-medium text-ink-600 hover:bg-surface-100 disabled:opacity-50">Bring back</button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <p className="text-[11px] text-ink-400">Checked {new Date(data.generatedAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}. Fixed rules, no AI: the same records always give the same result.</p>
        </>
      )}
    </div>
  )
}

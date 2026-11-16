'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { X, Loader2, Sparkles, AlertTriangle, CheckCircle2, RefreshCw } from 'lucide-react'
import { parseDocumentDate } from '@/lib/ai/summary-dates'

interface Item { text: string; page: number | null; quote: string | null; verified: boolean }
interface ActionItem extends Item { owner: string | null; due: string | null }
interface Side { value: string; page: number | null; quote: string | null }
interface Mapping {
  title: string | null; documentType: string; language: string; summary: string
  keyPoints: Item[]; decisions: Item[]; actions: ActionItem[]; openQuestions?: Item[]
  contradictions?: Array<{ subject: string; a: Side; b: Side }>
  warnings: string[]; coverage: { pages: number; sections: number; truncated: boolean; unverified: number }
}
interface Stage { name: string; status: 'running' | 'done' | 'failed'; detail?: string }
interface Run {
  id: string; status: 'QUEUED' | 'RUNNING' | 'AWAITING_CONFIRMATION' | 'APPLIED' | 'FAILED'
  stages: Stage[]; mapping: Mapping | null; error: string | null; createdAt: string
  revision: string | null; pages: number | null; tasks: Record<string, string>
}
interface Member { id: string; fullName: string }
type Language = 'same' | 'et' | 'en'

const errText = (d: { error?: unknown }, fallback: string) => (typeof d.error === 'string' ? d.error : (d.error as { message?: string } | undefined)?.message) || fallback
const STAGE_LABEL: Record<string, string> = { read: 'Reading the file', ingest: 'Preparing', sections: 'Reading section by section', extract: 'Writing the summary', map: 'Checking every quote against the document' }
const TYPE_LABEL: Record<string, string> = { specification: 'Specification', report: 'Report', minutes: 'Minutes', letter: 'Letter', contract: 'Contract', permit: 'Permit', other: 'Document' }

function Page({ n }: { n: number | null }) {
  return n ? <span className="ml-1.5 whitespace-nowrap text-[10px] font-medium text-ink-400">p. {n}</span> : null
}

function Row({ item, children }: { item: Item; children?: React.ReactNode }) {
  return (
    <li className="py-2">
      <p className="text-[13px] text-ink-800 leading-snug">
        {item.text}
        <Page n={item.page} />
        {!item.verified && <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-800">Not matched to the document: check</span>}
      </p>
      {item.quote && <p className="mt-0.5 text-[11px] italic text-ink-400 leading-snug">“{item.quote}”</p>}
      {children}
    </li>
  )
}

function Section({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <section className="mt-6">
      <h3 className="text-[11px] font-semibold uppercase tracking-wide text-ink-400">{title} <span className="font-normal">({count})</span></h3>
      {count === 0 ? <p className="mt-2 text-[12px] text-ink-400">None found in this document.</p> : children}
    </section>
  )
}

/** Slide-over: summarise one project document, read the result, and turn chosen actions into tasks. */
export function DocumentSummaryPanel({ projectId, document, onClose }: { projectId: string; document: { id: string; title: string }; onClose: () => void }) {
  const base = `/api/projects/${projectId}/documents/${document.id}/summary`
  const [run, setRun] = useState<Run | null>(null)
  const [loading, setLoading] = useState(true)
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [language, setLanguage] = useState<Language>('same')
  const [members, setMembers] = useState<Member[]>([])
  const [picks, setPicks] = useState<Record<number, { on: boolean; ownerId: string; dueDate: string }>>({})
  const [creating, setCreating] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const closeRef = useRef<HTMLButtonElement>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch(base, { cache: 'no-store' })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) { setError(errText(d, 'Could not load the summary.')); return null }
      setRun(d.data?.run ?? null)
      return (d.data?.run ?? null) as Run | null
    } catch { setError('Could not reach Coordin. Check your connection.'); return null } finally { setLoading(false) }
  }, [base])

  useEffect(() => { load(); closeRef.current?.focus() }, [load])
  useEffect(() => {
    fetch(`/api/projects/${projectId}/members`).then((r) => (r.ok ? r.json() : null)).then((d) => {
      const list = (d?.data?.members ?? []) as Array<{ profile?: { id: string; fullName: string } }>
      setMembers(list.filter((m) => m.profile).map((m) => ({ id: m.profile!.id, fullName: m.profile!.fullName })))
    }).catch(() => {})
  }, [projectId])

  // While a run is going, ask again every 3 seconds
  const busy = run?.status === 'QUEUED' || run?.status === 'RUNNING'
  useEffect(() => {
    if (!busy) return
    const t = setInterval(() => { load() }, 3000)
    return () => clearInterval(t)
  }, [busy, load])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // Start each action unticked, with the document's own deadline filled in only when it is an exact date
  const actions = run?.mapping?.actions
  useEffect(() => {
    if (!actions) return
    setPicks(Object.fromEntries(actions.map((a, i) => [i, { on: false, ownerId: '', dueDate: parseDocumentDate(a.due) ?? '' }])))
  }, [run?.id, actions])

  const start = async () => {
    setStarting(true); setError(null); setNotice(null)
    try {
      const res = await fetch(base, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ language }) })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(errText(d, 'Could not start the summary.'))
      await load()
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not start the summary.') } finally { setStarting(false) }
  }

  const chosen = Object.entries(picks).filter(([i, p]) => p.on && !run?.tasks[i])
  const createTasks = async () => {
    if (!run || chosen.length === 0) return
    setCreating(true); setError(null); setNotice(null)
    try {
      const res = await fetch(`${base}/tasks`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ runId: run.id, items: chosen.map(([i, p]) => ({ index: Number(i), ownerId: p.ownerId || null, dueDate: p.dueDate || null })) }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(errText(d, 'Could not create the tasks.'))
      const n = (d.data?.created ?? []).length
      setNotice(n === 1 ? '1 task created.' : `${n} tasks created.`)
      await load()
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not create the tasks.') } finally { setCreating(false) }
  }

  const m = run?.mapping ?? null
  const done = run?.status === 'AWAITING_CONFIRMATION' || run?.status === 'APPLIED'
  const select = 'rounded-lg border border-surface-300 bg-white px-2 py-1.5 text-[12px] text-ink-800 focus:outline-none focus:ring-2 focus:ring-accent-200'

  const startControls = (again?: boolean) => (
    <div className="flex flex-wrap items-center gap-2">
      <label className="text-[12px] text-ink-500" htmlFor="summary-language">Write the summary in</label>
      <select id="summary-language" className={select} value={language} onChange={(e) => setLanguage(e.target.value as Language)}>
        <option value="same">the document’s language</option>
        <option value="et">Estonian</option>
        <option value="en">English</option>
      </select>
      <button onClick={start} disabled={starting} className="inline-flex items-center gap-1.5 rounded-lg bg-ink-900 px-3 py-1.5 text-[12px] font-medium text-white hover:bg-ink-800 disabled:opacity-50">
        {starting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : again ? <RefreshCw className="h-3.5 w-3.5" /> : <Sparkles className="h-3.5 w-3.5" />}
        {again ? 'Summarise again' : 'Summarise'}
      </button>
    </div>
  )

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label={`Summary of ${document.title}`}>
      <button className="absolute inset-0 bg-ink-900/30" onClick={onClose} aria-label="Close summary" tabIndex={-1} />
      <div className="relative flex h-full w-full max-w-2xl flex-col bg-white shadow-xl">
        <header className="flex items-start justify-between gap-4 border-b border-surface-200 px-6 py-4">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-400">AI summary</p>
            <h2 className="truncate text-[16px] font-semibold text-ink-900">{document.title}</h2>
            {run && done && <p className="mt-0.5 text-[11px] text-ink-400">Revision {run.revision ?? '—'} · {run.pages ?? m?.coverage.pages ?? '?'} pages · {new Date(run.createdAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}</p>}
          </div>
          <button ref={closeRef} onClick={onClose} className="rounded-lg p-1.5 text-ink-400 hover:bg-surface-100 hover:text-ink-700" aria-label="Close"><X className="h-4 w-4" /></button>
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {error && <div role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-[12px] text-red-800">{error}</div>}
          {notice && <div role="status" className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-[12px] text-emerald-800">{notice}</div>}

          {loading ? (
            <div className="flex items-center gap-2 text-[13px] text-ink-500"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
          ) : !run ? (
            <div>
              <p className="text-[13px] text-ink-700">Coordin reads the latest file of this document and writes a short summary, with the decisions, the actions and who they are for, open questions, and any figures that disagree.</p>
              <p className="mt-2 text-[12px] text-ink-500">Every item shows the page it came from. Nothing becomes a task until you choose it. It usually takes one to three minutes.</p>
              <div className="mt-4">{startControls()}</div>
            </div>
          ) : busy ? (
            <div aria-live="polite">
              <p className="text-[13px] font-medium text-ink-800">Reading the document. This usually takes one to three minutes.</p>
              <p className="mt-1 text-[12px] text-ink-500">You can close this panel and come back: it keeps going.</p>
              <ul className="mt-4 space-y-2">
                {(run.stages ?? []).map((s) => (
                  <li key={s.name} className="flex items-center gap-2 text-[12px] text-ink-600">
                    {s.status === 'done' ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> : s.status === 'failed' ? <AlertTriangle className="h-3.5 w-3.5 text-red-600" /> : <Loader2 className="h-3.5 w-3.5 animate-spin text-ink-400" />}
                    <span>{STAGE_LABEL[s.name] ?? s.name}{s.detail && s.name !== 'extract' ? ` · ${s.detail}` : ''}</span>
                  </li>
                ))}
                {(run.stages ?? []).length === 0 && <li className="flex items-center gap-2 text-[12px] text-ink-600"><Loader2 className="h-3.5 w-3.5 animate-spin text-ink-400" /> Starting…</li>}
              </ul>
            </div>
          ) : run.status === 'FAILED' ? (
            <div>
              <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-[12px] text-red-800">{run.error || 'The summary could not be made.'}</div>
              <p className="mt-3 text-[12px] text-ink-500">Nothing was saved. You can try again.</p>
              <div className="mt-3">{startControls(true)}</div>
            </div>
          ) : m ? (
            <div>
              <p className="rounded-lg bg-surface-50 px-3 py-2 text-[11px] text-ink-500">Written by AI from the file. Each item was checked against the document’s wording, but read the pages cited before you rely on it.</p>

              {m.warnings.length > 0 && (
                <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
                  <p className="flex items-center gap-1.5 text-[12px] font-semibold text-amber-900"><AlertTriangle className="h-3.5 w-3.5" /> Before you rely on this</p>
                  <ul className="mt-1.5 list-disc space-y-1 pl-5 text-[12px] text-amber-900">{m.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>
                </div>
              )}

              <section className="mt-5">
                <h3 className="text-[11px] font-semibold uppercase tracking-wide text-ink-400">{TYPE_LABEL[m.documentType] ?? 'Document'}{m.title ? ` · ${m.title}` : ''}</h3>
                <p className="mt-2 text-[14px] leading-relaxed text-ink-900">{m.summary}</p>
              </section>

              {(m.contradictions?.length ?? 0) > 0 && (
                <section className="mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
                  <h3 className="text-[12px] font-semibold text-red-900">Figures that may disagree ({m.contradictions!.length})</h3>
                  <p className="mt-0.5 text-[11px] text-red-800">The same thing seems to be given two values. Check both pages: now and then this check pairs up two different things.</p>
                  <ul className="mt-2 space-y-3">
                    {m.contradictions!.map((c, i) => (
                      <li key={i} className="text-[12px] text-red-900">
                        <p className="font-medium">{c.subject}</p>
                        <p className="mt-0.5">{c.a.value}<Page n={c.a.page} /> <span className="mx-1 text-red-400">against</span> {c.b.value}<Page n={c.b.page} /></p>
                        {c.a.quote && <p className="mt-0.5 text-[11px] italic text-red-700">“{c.a.quote}”</p>}
                        {c.b.quote && <p className="text-[11px] italic text-red-700">“{c.b.quote}”</p>}
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              <Section title="Key points" count={m.keyPoints.length}><ul className="mt-1 divide-y divide-surface-100">{m.keyPoints.map((x, i) => <Row key={i} item={x} />)}</ul></Section>
              <Section title="Decisions" count={m.decisions.length}><ul className="mt-1 divide-y divide-surface-100">{m.decisions.map((x, i) => <Row key={i} item={x} />)}</ul></Section>
              <Section title="Open questions" count={m.openQuestions?.length ?? 0}><ul className="mt-1 divide-y divide-surface-100">{(m.openQuestions ?? []).map((x, i) => <Row key={i} item={x} />)}</ul></Section>

              <Section title="Actions" count={m.actions.length}>
                <p className="mt-2 text-[12px] text-ink-500">Tick the ones you want as tasks. Choose who in your team takes each one: the name in the document is shown for reference and is not assigned for you.</p>
                <ul className="mt-1 divide-y divide-surface-100">
                  {m.actions.map((a, i) => {
                    const taskId = run.tasks[String(i)]
                    const p = picks[i] ?? { on: false, ownerId: '', dueDate: '' }
                    return (
                      <Row key={i} item={a}>
                        <p className="mt-1 text-[11px] text-ink-500">In the document: {a.owner ?? 'no one named'} · {a.due ?? 'no deadline'}</p>
                        {taskId ? (
                          <p className="mt-1.5 inline-flex items-center gap-1.5 text-[12px] font-medium text-emerald-700"><CheckCircle2 className="h-3.5 w-3.5" /> Task created · <Link className="underline" href={`/projects/${projectId}/tasks/${taskId}`}>open</Link></p>
                        ) : (
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <label className="inline-flex items-center gap-1.5 text-[12px] text-ink-700">
                              <input type="checkbox" checked={p.on} onChange={(e) => setPicks((s) => ({ ...s, [i]: { ...p, on: e.target.checked } }))} />
                              Make a task
                            </label>
                            {p.on && (
                              <>
                                <select aria-label="Who takes this task" className={select} value={p.ownerId} onChange={(e) => setPicks((s) => ({ ...s, [i]: { ...p, ownerId: e.target.value } }))}>
                                  <option value="">No one yet</option>
                                  {members.map((mem) => <option key={mem.id} value={mem.id}>{mem.fullName}</option>)}
                                </select>
                                <input type="date" aria-label="Due date" className={select} value={p.dueDate} onChange={(e) => setPicks((s) => ({ ...s, [i]: { ...p, dueDate: e.target.value } }))} />
                              </>
                            )}
                          </div>
                        )}
                      </Row>
                    )
                  })}
                </ul>
              </Section>

              <div className="mt-8 border-t border-surface-200 pt-4">
                <p className="mb-2 text-[11px] text-ink-400">A new revision of the file needs a new summary.</p>
                {startControls(true)}
              </div>
            </div>
          ) : null}
        </div>

        {done && m && m.actions.length > 0 && (
          <footer className="flex items-center justify-between gap-3 border-t border-surface-200 px-6 py-3">
            <span className="text-[12px] text-ink-500">{chosen.length === 0 ? 'No actions ticked' : `${chosen.length} action${chosen.length === 1 ? '' : 's'} ticked`}</span>
            <button onClick={createTasks} disabled={creating || chosen.length === 0} className="inline-flex items-center gap-1.5 rounded-lg bg-accent-600 px-3 py-1.5 text-[12px] font-medium text-white hover:bg-accent-700 disabled:opacity-50">
              {creating && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {chosen.length <= 1 ? 'Create task' : `Create ${chosen.length} tasks`}
            </button>
          </footer>
        )}
      </div>
    </div>
  )
}

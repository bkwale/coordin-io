'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'

type Severity = 'high' | 'medium' | 'low'
interface Counts { total: number; high: number; medium: number; low: number }
interface ProjectRow { id: string; name: string; code: string | null; stage: string | null; counts: Counts; top: Array<{ id: string; severity: Severity; area: string; title: string; link: string }>; failed?: boolean }
interface Data { projects: ProjectRow[]; totals: Counts; shown: number; totalProjects: number; generatedAt: string }

const DOT: Record<Severity, string> = { high: 'bg-red-500', medium: 'bg-amber-500', low: 'bg-ink-300' }
const LABEL: Record<Severity, string> = { high: 'High', medium: 'Medium', low: 'Low' }
const errText = (d: { error?: unknown }, fallback: string) => (typeof d.error === 'string' ? d.error : (d.error as { message?: string } | undefined)?.message) || fallback

export default function AllProjectsRisksPage() {
  const [data, setData] = useState<Data | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [onlyFlagged, setOnlyFlagged] = useState(true)

  const load = useCallback(async () => {
    setError(null)
    try {
      const res = await fetch('/api/risks', { cache: 'no-store' })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(errText(d, 'Could not load the risks.'))
      setData(d.data)
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not load the risks.') } finally { setLoading(false) }
  }, [])
  useEffect(() => { load() }, [load])

  if (loading) return <div className="flex items-center gap-2 text-[13px] text-ink-500"><Loader2 className="h-4 w-4 animate-spin" /> Checking your projects…</div>

  const rows = data ? (onlyFlagged ? data.projects.filter((p) => p.counts.total > 0 || p.failed) : data.projects) : []
  const clear = data ? data.projects.filter((p) => p.counts.total === 0 && !p.failed).length : 0

  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-[1.75rem] text-ink-900">Risks</h1>
          <p className="mt-1 text-[13px] text-ink-500">Every project you can see, worst first. Worked out from each project&apos;s own tasks, milestones, permits, hours and documents.</p>
        </div>
        <button onClick={() => { setLoading(true); load() }} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-ink-100 bg-white px-3 py-1.5 text-[12px] font-medium text-ink-600 hover:bg-surface-50"><RefreshCw className="h-3.5 w-3.5" /> Check again</button>
      </div>

      {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-[12px] text-red-800">{error}</div>}

      {data && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {(['high', 'medium', 'low'] as Severity[]).map((s) => (
              <div key={s} className="rounded-xl border border-ink-100 bg-white px-4 py-3">
                <p className="flex items-center gap-2 text-[11px] font-medium text-ink-500"><span className={cn('h-2 w-2 rounded-full', DOT[s])} />{LABEL[s]}</p>
                <p className="mt-1 text-[22px] font-semibold text-ink-900">{data.totals[s]}</p>
              </div>
            ))}
            <div className="rounded-xl border border-ink-100 bg-white px-4 py-3">
              <p className="text-[11px] font-medium text-ink-500">Projects with nothing flagged</p>
              <p className="mt-1 text-[22px] font-semibold text-ink-900">{clear} <span className="text-[13px] font-normal text-ink-400">of {data.shown}</span></p>
            </div>
          </div>

          {data.totalProjects > data.shown && <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-[12px] text-amber-900">Showing the {data.shown} most recently updated of {data.totalProjects} live projects. Older ones are not checked here; open the project to see its risks.</p>}

          {data.projects.length === 0 ? (
            <div className="rounded-xl border border-ink-100 bg-white p-10 text-center text-[13px] text-ink-500">You are not on any live projects.</div>
          ) : (
            <>
              <label className="flex items-center gap-2 text-[12px] text-ink-600">
                <input type="checkbox" checked={onlyFlagged} onChange={(e) => setOnlyFlagged(e.target.checked)} className="rounded border-ink-200" />
                Only projects with something flagged
              </label>
              {rows.length === 0 ? (
                <div className="rounded-xl border border-ink-100 bg-white p-10 text-center">
                  <CheckCircle2 className="mx-auto mb-3 h-9 w-9 text-emerald-500" />
                  <p className="text-[14px] font-medium text-ink-700">Nothing is flagged on any project</p>
                  <p className="mt-1 text-[12px] text-ink-400">This only knows what has been entered in Coordin.</p>
                </div>
              ) : (
                <ul className="space-y-3">
                  {rows.map((p) => (
                    <li key={p.id} className="rounded-xl border border-ink-100 bg-white px-5 py-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="min-w-0">
                          <Link href={`/projects/${p.id}/risks`} className="text-[14px] font-semibold text-ink-900 hover:text-accent-700">{p.name}</Link>
                          {p.code && <span className="ml-2 text-[11px] text-ink-400">{p.code}</span>}
                        </div>
                        <div className="flex items-center gap-3 text-[12px]">
                          {(['high', 'medium', 'low'] as Severity[]).map((s) => (
                            <span key={s} className={cn('inline-flex items-center gap-1.5', p.counts[s] === 0 ? 'text-ink-300' : 'font-medium text-ink-700')}><span className={cn('h-2 w-2 rounded-full', p.counts[s] === 0 ? 'bg-ink-100' : DOT[s])} />{p.counts[s]} {LABEL[s].toLowerCase()}</span>
                          ))}
                          <Link href={`/projects/${p.id}/risks`} className="rounded-lg border border-ink-100 px-2.5 py-1 text-[11px] font-medium text-ink-600 hover:border-accent-200 hover:bg-accent-50 hover:text-accent-700">Open</Link>
                        </div>
                      </div>
                      {p.failed && <p className="mt-2 inline-flex items-center gap-1.5 text-[12px] text-amber-800"><AlertTriangle className="h-3.5 w-3.5" /> This project could not be checked just now. Open it to see its risks.</p>}
                      {p.top.length > 0 && (
                        <ul className="mt-3 space-y-1.5 border-t border-ink-50 pt-3">
                          {p.top.map((s) => (
                            <li key={s.id} className="flex items-start gap-2.5 text-[12px] text-ink-700">
                              <span className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', DOT[s.severity])} aria-label={`${LABEL[s.severity]} severity`} />
                              <Link href={s.link} className="hover:text-accent-700 hover:underline">{s.title}</Link>
                            </li>
                          ))}
                          {p.counts.total > p.top.length && <li className="pl-[18px] text-[11px] text-ink-400">and {p.counts.total - p.top.length} more</li>}
                        </ul>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
          <p className="text-[11px] text-ink-400">Checked {new Date(data.generatedAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}. Fixed rules, no AI. Flags someone has set aside are not counted.</p>
        </>
      )}
    </div>
  )
}

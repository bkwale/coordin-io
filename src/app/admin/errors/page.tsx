'use client'

import { Suspense, useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Bug, Search, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react'

type Group = {
  fingerprint: string; count: number; firstSeen: string; lastSeen: string
  ref?: string; level?: string; source?: string; route?: string | null; method?: string | null; statusCode?: number | null
  code?: string | null; message?: string; organisationName?: string | null; release?: string | null
}
type AIInfo = { available: boolean; reason: string; message: string | null; providers: Record<string, 'ok' | 'down'>; configured: Record<string, boolean>; sentry: boolean; alertEmail: boolean }
type EventDetail = {
  ref: string; level: string; source: string; route: string | null; method: string | null; statusCode: number | null; code: string | null
  message: string; stack: string | null; organisationName: string | null; profileId: string | null; runId: string | null
  context: unknown; release: string | null; createdAt: string
}

const SOURCES = ['', 'api', 'ai', 'client', 'cron', 'background']
const fmt = (d: string) => new Date(d).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

export default function AdminErrorsPage() {
  return <Suspense fallback={null}><ErrorsView /></Suspense>
}

function ErrorsView() {
  const params = useSearchParams()
  const [days, setDays] = useState(7)
  const [source, setSource] = useState('')
  const [data, setData] = useState<{ total: number; groups: Group[]; ai: AIInfo } | null>(null)
  const [loading, setLoading] = useState(true)
  const [refInput, setRefInput] = useState(params.get('ref') ?? '')
  const [detail, setDetail] = useState<{ event: EventDetail; sameKind: number } | null>(null)
  const [detailErr, setDetailErr] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/admin/errors?days=${days}${source ? `&source=${source}` : ''}`, { cache: 'no-store' })
      .then((r) => r.json()).then((b) => setData(b.data ?? null)).finally(() => setLoading(false))
  }, [days, source])

  const lookup = useCallback(async (ref: string) => {
    setDetailErr(null); setDetail(null)
    if (!ref.trim()) return
    const r = await fetch(`/api/admin/errors?ref=${encodeURIComponent(ref.trim())}`, { cache: 'no-store' })
    const b = await r.json().catch(() => ({}))
    if (!r.ok) setDetailErr(typeof b.error === 'string' ? b.error : 'Not found')
    else setDetail(b.data)
  }, [])
  useEffect(() => { const r = params.get('ref'); if (r) lookup(r) }, [params, lookup])

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">Errors</h1>
        <span className="text-sm text-slate-400">{data ? `${data.total} in the last ${days} days` : ''}</span>
      </div>

      {data?.ai && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-6">
          <StatusCard label="AI reading" ok={data.ai.available} text={data.ai.available ? 'Available' : data.ai.reason === 'not_configured' ? 'Not configured' : 'Down — failing fast'} />
          <StatusCard label="Mistral (primary)" ok={data.ai.configured.mistral && data.ai.providers.mistral === 'ok'} text={!data.ai.configured.mistral ? 'No key' : data.ai.providers.mistral === 'ok' ? 'OK' : 'Marked down'} />
          <StatusCard label="Claude (fallback)" ok={data.ai.configured.claude ? data.ai.providers.claude === 'ok' : null} text={!data.ai.configured.claude ? 'Off' : data.ai.providers.claude === 'ok' ? 'OK' : 'Marked down'} />
          <StatusCard label="Alerts" ok={data.ai.alertEmail || data.ai.sentry ? true : null} text={[data.ai.alertEmail && 'Email', data.ai.sentry && 'Sentry'].filter(Boolean).join(' + ') || 'Log + this page only'} />
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 p-4 mb-6">
        <form onSubmit={(e) => { e.preventDefault(); lookup(refInput) }} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input value={refInput} onChange={(e) => setRefInput(e.target.value)} placeholder="Look up a reference a user quoted, e.g. ERR-7K2M9QXA" className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-200 font-mono" />
          </div>
          <button className="px-4 py-2 rounded-lg bg-slate-900 text-white text-sm">Look up</button>
        </form>
        {detailErr && <p className="text-sm text-red-600 mt-3">{detailErr}</p>}
        {detail && (
          <div className="mt-4 text-sm space-y-2">
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-slate-500">
              <span className="font-mono text-slate-900">{detail.event.ref}</span>
              <span>{fmt(detail.event.createdAt)}</span>
              <span>{detail.event.source}{detail.event.route ? ` · ${detail.event.method ?? ''} ${detail.event.route}` : ''}</span>
              {detail.event.statusCode && <span>HTTP {detail.event.statusCode}</span>}
              {detail.event.code && <span>{detail.event.code}</span>}
              {detail.event.organisationName && <span>{detail.event.organisationName}</span>}
              {detail.event.release && <span>build {detail.event.release}</span>}
              <span>{detail.sameKind} of this kind in total</span>
            </div>
            <p className="text-slate-900">{detail.event.message}</p>
            {detail.event.runId && <p className="text-slate-500">AI run: <span className="font-mono">{detail.event.runId}</span></p>}
            {detail.event.context != null && <pre className="text-xs bg-slate-50 rounded p-2 overflow-auto">{JSON.stringify(detail.event.context, null, 2)}</pre>}
            {detail.event.stack && <pre className="text-xs bg-slate-50 rounded p-2 overflow-auto max-h-64">{detail.event.stack}</pre>}
          </div>
        )}
      </div>

      <div className="flex gap-2 mb-3 text-sm">
        <select value={days} onChange={(e) => setDays(Number(e.target.value))} className="px-3 py-1.5 rounded-lg border border-slate-200">
          {[1, 7, 30, 90].map((d) => <option key={d} value={d}>Last {d} day{d > 1 ? 's' : ''}</option>)}
        </select>
        <select value={source} onChange={(e) => setSource(e.target.value)} className="px-3 py-1.5 rounded-lg border border-slate-200">
          {SOURCES.map((s) => <option key={s} value={s}>{s ? s : 'All sources'}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="bg-white rounded-xl border border-slate-200 p-8 animate-pulse">{[1, 2, 3].map((i) => <div key={i} className="h-4 bg-slate-200 rounded w-full mb-4" />)}</div>
      ) : !data?.groups.length ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <Bug className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-500">No errors in this period</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 text-left text-xs text-slate-500">
              <tr><th className="px-4 py-2">What</th><th className="px-4 py-2">Where</th><th className="px-4 py-2 text-right">Count</th><th className="px-4 py-2">Last seen</th><th className="px-4 py-2">Latest ref</th></tr>
            </thead>
            <tbody>
              {data.groups.map((g) => (
                <tr key={g.fingerprint} className="border-b border-slate-100 last:border-0 align-top">
                  <td className="px-4 py-2.5 max-w-md">
                    <span className={g.level === 'warning' ? 'text-amber-600' : 'text-red-600'}>●</span>{' '}
                    <span className="text-slate-900">{g.message}</span>
                    {g.code && <span className="ml-2 text-xs text-slate-400">{g.code}</span>}
                  </td>
                  <td className="px-4 py-2.5 text-slate-500 text-xs">{g.source}{g.route ? <><br />{g.method ? `${g.method} ` : ''}{g.route}</> : null}{g.organisationName ? <><br />{g.organisationName}</> : null}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{g.count}</td>
                  <td className="px-4 py-2.5 text-slate-500 text-xs whitespace-nowrap">{fmt(g.lastSeen)}<br /><span className="text-slate-400">first {fmt(g.firstSeen)}</span></td>
                  <td className="px-4 py-2.5"><button onClick={() => { if (g.ref) { setRefInput(g.ref); lookup(g.ref) } }} className="font-mono text-xs text-indigo-600 hover:underline">{g.ref}</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function StatusCard({ label, ok, text }: { label: string; ok: boolean | null; text: string }) {
  const Icon = ok === null ? AlertTriangle : ok ? CheckCircle2 : XCircle
  const colour = ok === null ? 'text-slate-400' : ok ? 'text-green-600' : 'text-red-600'
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <div className="text-xs text-slate-500 mb-1">{label}</div>
      <div className={`flex items-center gap-1.5 text-sm font-medium ${colour}`}><Icon className="w-4 h-4" />{text}</div>
    </div>
  )
}

'use client'

/**
 * Link the project to its Ehitisregister building record (public register).
 * Every value carries "Ehitisregister, fetched DD.MM.YYYY". Values reach the questionnaire only
 * when the architect clicks "Use these values".
 */
import { useEffect, useState } from 'react'
import { Building2, Loader2, Search, Link2, Unlink, Check, AlertTriangle } from 'lucide-react'

type Building = {
  ehrCode: string; name: string | null; state: string | null; useCode: string | null; useLabel: string | null
  address: string | null; cadastralUnits: string[]; county: string | null; heightM: number | null
  storeysAbove: number | null; storeysBelow: number | null; footprintM2: number | null
  enclosedNetAreaM2: number | null; heatedAreaM2: number | null; firstUse: string | null; heritage: string[] | null
}
type Value = { key: string; value: unknown; label: string; attribution: string }
type View = { building: Building | null; attribution: string | null; values: Value[] }
type Row = { ehrCode: string; name: string | null; address: string | null; useLabel: string | null; storeys: number | null; heritage: string[] }

export function EhrLink({ projectId, suggestedCode, onApply }: {
  projectId: string
  /** EHR code found in an uploaded planning-conditions document. */
  suggestedCode?: string | null
  onApply: (values: Record<string, unknown>) => void
}) {
  const [view, setView] = useState<View | null>(null)
  const [q, setQ] = useState('')
  const [rows, setRows] = useState<Row[] | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [applied, setApplied] = useState(false)

  useEffect(() => {
    fetch(`/api/projects/${projectId}/ehr`, { cache: 'no-store' }).then((r) => r.json()).then((b) => setView(b.data ?? null)).catch(() => setView({ building: null, attribution: null, values: [] }))
  }, [projectId])

  async function search() {
    setErr(null); setBusy('search'); setRows(null)
    try {
      const r = await fetch(`/api/ehr/search?q=${encodeURIComponent(q.trim())}`)
      const b = await r.json()
      if (!r.ok) throw new Error(b.error || 'Search failed')
      setRows(b.data.results)
    } catch (e) { setErr(e instanceof Error ? e.message : 'Search failed') } finally { setBusy(null) }
  }

  async function link(code: string) {
    setErr(null); setBusy(code); setApplied(false)
    try {
      const r = await fetch(`/api/projects/${projectId}/ehr`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ehrCode: code }) })
      const b = await r.json()
      if (!r.ok) throw new Error(b.error || 'Could not link')
      setView(b.data); setRows(null); setQ('')
    } catch (e) { setErr(e instanceof Error ? e.message : 'Could not link') } finally { setBusy(null) }
  }

  async function unlink() {
    setErr(null); setBusy('unlink')
    try {
      const r = await fetch(`/api/projects/${projectId}/ehr`, { method: 'DELETE' })
      const b = await r.json()
      if (!r.ok) throw new Error(b.error || 'Could not unlink')
      setView(b.data); setApplied(false)
    } catch (e) { setErr(e instanceof Error ? e.message : 'Could not unlink') } finally { setBusy(null) }
  }

  function apply() {
    if (!view) return
    onApply(Object.fromEntries(view.values.map((v) => [v.key, v.value])))
    setApplied(true)
  }

  if (!view) return null
  const b = view.building
  const fact = (label: string, v: string | number | null | undefined) => (v === null || v === undefined || v === '' ? null : <div className="flex justify-between gap-2"><span className="text-ink-400">{label}</span><span className="text-ink-800 text-right">{v}</span></div>)

  return (
    <div className="mb-3 rounded-lg border border-surface-200 bg-white p-3 space-y-2">
      <div className="flex items-center gap-2">
        <Building2 className="w-4 h-4 text-accent-600" />
        <div className="text-[12px] font-semibold text-ink-900">Ehitisregister building</div>
        {b && <span className="ml-auto font-mono text-[10px] text-ink-400">EHR {b.ehrCode}</span>}
      </div>

      {b ? (
        <>
          <div className="text-[12px] text-ink-800"><b>{b.name ?? 'Unnamed building'}</b>{b.state ? <span className="text-ink-400"> · {b.state}</span> : null}</div>
          <div className="text-[11px] space-y-0.5">
            {fact('Address', b.address)}
            {fact('Use', b.useLabel ? `${b.useLabel}${b.useCode ? ` (${b.useCode})` : ''}` : null)}
            {fact('Storeys', b.storeysAbove != null ? `${b.storeysAbove} above${b.storeysBelow ? `, ${b.storeysBelow} below` : ''}` : null)}
            {fact('Height', b.heightM != null ? `${b.heightM} m` : null)}
            {fact('Footprint', b.footprintM2 != null ? `${b.footprintM2} m²` : null)}
            {fact('Enclosed net', b.enclosedNetAreaM2 != null ? `${b.enclosedNetAreaM2} m²` : null)}
            {fact('Heated', b.heatedAreaM2 != null ? `${b.heatedAreaM2} m²` : null)}
            {fact('Cadastral', b.cadastralUnits.join(', ') || null)}
            {fact('Heritage', b.heritage === null ? 'not shown by the public register' : b.heritage.length ? b.heritage.join('; ') : 'none recorded')}
          </div>
          <div className="text-[10px] text-ink-400 italic">{view.attribution}. Register data describes the building as recorded — check it matches your design.</div>
          <div className="flex gap-2">
            <button type="button" onClick={apply} disabled={view.values.length === 0} className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-md bg-accent-500 text-white text-[11px] font-medium disabled:opacity-40">
              {applied ? <><Check className="w-3 h-3" /> Applied to questionnaire</> : <>Use these values ({view.values.length})</>}
            </button>
            <button type="button" onClick={unlink} disabled={busy === 'unlink'} className="flex items-center gap-1 px-2 py-1.5 rounded-md border border-surface-300 text-[11px] text-ink-600 hover:border-red-300 hover:text-red-700">
              {busy === 'unlink' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Unlink className="w-3 h-3" />} Unlink
            </button>
          </div>
        </>
      ) : (
        <>
          {suggestedCode && (
            <div className="flex items-center gap-2 text-[11px] bg-accent-50 border border-accent-200 rounded px-2 py-1.5">
              <span className="flex-1">The planning conditions mention EHR code <b className="font-mono">{suggestedCode}</b>.</span>
              <button type="button" onClick={() => link(suggestedCode)} disabled={!!busy} className="flex items-center gap-1 px-2 py-1 rounded bg-accent-500 text-white font-medium">
                {busy === suggestedCode ? <Loader2 className="w-3 h-3 animate-spin" /> : <Link2 className="w-3 h-3" />} Link it
              </button>
            </div>
          )}
          <div className="flex gap-1">
            <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && q.trim().length >= 3) search() }} placeholder="EHR code (9 digits) or building name" className="flex-1 text-[12px] px-2.5 py-1.5 rounded-md border border-surface-300" />
            <button type="button" onClick={search} disabled={q.trim().length < 3 || !!busy} className="px-2.5 py-1.5 rounded-md border border-surface-300 text-ink-600 disabled:opacity-40">
              {busy === 'search' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
            </button>
          </div>
          <div className="text-[10px] text-ink-400">The public register can be searched by EHR code or building name only — not by address.</div>
          {rows && rows.length === 0 && <div className="text-[11px] text-ink-400">No building found.</div>}
          {rows && rows.length > 0 && (
            <ul className="divide-y divide-surface-100 border border-surface-200 rounded-md">
              {rows.map((r) => (
                <li key={r.ehrCode} className="px-2 py-1.5 flex items-center gap-2 text-[11px]">
                  <div className="flex-1 min-w-0">
                    <div className="text-ink-800 truncate"><b>{r.name ?? 'Unnamed'}</b> <span className="font-mono text-ink-400">{r.ehrCode}</span></div>
                    <div className="text-ink-400 truncate">{[r.address, r.useLabel, r.storeys != null ? `${r.storeys} storeys` : null].filter(Boolean).join(' · ')}</div>
                  </div>
                  <button type="button" onClick={() => link(r.ehrCode)} disabled={!!busy} className="flex items-center gap-1 px-2 py-1 rounded border border-accent-300 text-accent-700 hover:bg-accent-50">
                    {busy === r.ehrCode ? <Loader2 className="w-3 h-3 animate-spin" /> : <Link2 className="w-3 h-3" />} Link
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
      {err && <div className="text-[11px] text-red-700 flex items-center gap-1"><AlertTriangle className="w-3 h-3" />{err}</div>}
    </div>
  )
}

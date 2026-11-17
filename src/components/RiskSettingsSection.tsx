'use client'

import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'

interface Field { key: string; label: string; help: string; unit: 'days' | 'hours' | 'percent'; min: number; max: number }
interface Data { thresholds: Record<string, number>; defaults: Record<string, number>; weeklyDigest: boolean; fields: Field[]; canEdit: boolean }

const UNIT = { days: 'days', hours: 'hours', percent: '%' }
const errText = (d: { error?: unknown }, fallback: string) => (typeof d.error === 'string' ? d.error : (d.error as { message?: string } | undefined)?.message) || fallback

export function RiskSettingsSection() {
  const [data, setData] = useState<Data | null>(null)
  const [values, setValues] = useState<Record<string, string>>({})
  const [digest, setDigest] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const apply = (d: Pick<Data, 'thresholds' | 'weeklyDigest'>) => { setValues(Object.fromEntries(Object.entries(d.thresholds).map(([k, v]) => [k, String(v)]))); setDigest(d.weeklyDigest) }

  useEffect(() => {
    fetch('/api/settings/risk', { cache: 'no-store' })
      .then(async (r) => { const d = await r.json().catch(() => ({})); if (!r.ok) throw new Error(errText(d, 'Could not load the risk settings.')); return d.data as Data })
      .then((d) => { setData(d); apply(d) })
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load the risk settings.'))
      .finally(() => setLoading(false))
  }, [])

  const save = async (body: Record<string, unknown>) => {
    setSaving(true); setError(null); setSaved(false)
    try {
      const res = await fetch('/api/settings/risk', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(errText(d, 'Could not save.'))
      apply(d.data); setData((prev) => (prev ? { ...prev, ...d.data } : prev)); setSaved(true)
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not save.') } finally { setSaving(false) }
  }

  if (loading) return <div className="flex items-center gap-2 text-[13px] text-ink-500"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
  if (!data) return <p className="text-[13px] text-ink-600">{error ?? 'Risk analysis is not switched on for your practice.'}</p>

  const dirty = data.fields.some((f) => values[f.key] !== String(data.thresholds[f.key])) || digest !== data.weeklyDigest
  const changedFromDefault = data.fields.some((f) => data.thresholds[f.key] !== data.defaults[f.key])

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-[18px] font-semibold text-ink-900">Risk</h2>
        <p className="mt-1 text-[13px] text-ink-500">When Coordin raises a flag on a project, and how serious it counts as. These apply to every project in the practice.{!data.canEdit && ' Only an administrator can change them.'}</p>
      </div>

      {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-[12px] text-red-800">{error}</div>}

      <div className="divide-y divide-ink-50 rounded-xl border border-ink-100">
        {data.fields.map((f) => (
          <div key={f.key} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <label htmlFor={`risk-${f.key}`} className="min-w-0 flex-1">
              <span className="block text-[13px] font-medium text-ink-800">{f.label}</span>
              <span className="block text-[11px] text-ink-400">{f.help} Default {data.defaults[f.key]} {UNIT[f.unit]}.</span>
            </label>
            <div className="flex items-center gap-2">
              <input id={`risk-${f.key}`} type="number" inputMode="numeric" min={f.min} max={f.max} step={1} disabled={!data.canEdit || saving} value={values[f.key] ?? ''} onChange={(e) => { setValues((v) => ({ ...v, [f.key]: e.target.value })); setSaved(false) }} className="w-20 rounded-lg border border-surface-300 px-2.5 py-1.5 text-right text-[13px] text-ink-900 focus:outline-none focus:ring-2 focus:ring-accent-200 disabled:bg-surface-50 disabled:text-ink-400" />
              <span className="w-10 text-[12px] text-ink-500">{UNIT[f.unit]}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-ink-100 px-4 py-3">
        <label className="flex items-start gap-3">
          <input type="checkbox" checked={digest} disabled={!data.canEdit || saving} onChange={(e) => { setDigest(e.target.checked); setSaved(false) }} className="mt-1 rounded border-ink-200" />
          <span>
            <span className="block text-[13px] font-medium text-ink-800">Weekly risk email</span>
            <span className="block text-[11px] text-ink-400">Every Monday morning, each project lead gets one email listing the high and medium flags on the projects they lead. Nothing is sent to anyone with nothing flagged. Each person can switch it off for themselves under Notifications.</span>
          </span>
        </label>
      </div>

      {data.canEdit && (
        <div className="flex flex-wrap items-center gap-3">
          <button onClick={() => save({ thresholds: Object.fromEntries(data.fields.map((f) => [f.key, values[f.key] === '' ? null : Number(values[f.key])])), weeklyDigest: digest })} disabled={saving || !dirty} className="inline-flex items-center gap-1.5 rounded-lg bg-ink-900 px-4 py-2 text-[13px] font-medium text-white hover:bg-ink-800 disabled:opacity-50">{saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}Save</button>
          {changedFromDefault && <button onClick={() => save({ reset: true })} disabled={saving} className="text-[12px] font-medium text-ink-500 hover:text-ink-700">Put the numbers back to the defaults</button>}
          {saved && <span role="status" className="text-[12px] text-emerald-700">Saved</span>}
        </div>
      )}
    </div>
  )
}

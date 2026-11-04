'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import { ShieldCheck, Loader2, Plus, Check, AlertTriangle, Info, RefreshCw, ChevronDown, ChevronRight, Scale } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useToast } from '@/components/Toast'

/* ── Types ──────────────────────────────────────────────── */
type Params = {
  jurisdiction: 'EE' | 'GB' | 'PL' | 'ES'
  buildingType: 'detached_house' | 'apartment_block' | 'semi_detached' | 'terraced' | 'non_residential' | 'other'
  workType: 'new_build' | 'extension' | 'reconstruction' | 'change_of_use' | 'demolition'
  grossFloorArea: number; height: number; storeys: number
  apartments?: number; parkingSpaces?: number; heatedArea?: number; enclosedNetArea?: number
  timberStructure?: boolean; heritage?: boolean; protectedArea?: boolean
  detailedPlanExists?: boolean; detailedPlanAgeYears?: number
  nearMajorRoad?: boolean; districtHeatingAvailable?: boolean; urbanArea?: boolean
  seasonalUseOnly?: boolean; temporary?: boolean; placeOfWorship?: boolean; county?: string
}
type Item = { id: string; ruleId: string | null; requirement: string; titleLocal: string | null; citation: string | null; source: string | null; because: string | null; confidence: string | null; comments: string | null; status: string; section: string | null; addedByArchitect: boolean; ruleSetVersion: string | null }
type Data = { profile: { version: number; parameters: Params; ruleSetVersion: string | null; createdAt: string } | null; register: { id: string; name: string; templateVersion: string | null; updatedAt: string } | null; grouped: Record<string, Item[]>; added: Item[]; disciplineLabels: Record<string, { en: string; et: string }>; counts: { generated: number; added: number } }

const DEFAULTS: Params = { jurisdiction: 'EE', buildingType: 'detached_house', workType: 'new_build', grossFloorArea: 160, height: 7, storeys: 2, heatedArea: 150, enclosedNetArea: 150, detailedPlanExists: false, urbanArea: false }

const EE_COUNTIES = ['Harju', 'Tartu', 'Ida-Viru', 'Pärnu', 'Lääne-Viru', 'Viljandi', 'Rapla', 'Võru', 'Saare', 'Jõgeva', 'Järva', 'Valga', 'Põlva', 'Lääne', 'Hiiu']

export default function RegulatoryPage() {
  const params = useParams()
  const projectId = params.id as string
  const { toast } = useToast()
  const [data, setData] = useState<Data | null>(null)
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)
  const [form, setForm] = useState<Params>(DEFAULTS)
  const [diff, setDiff] = useState<{ added: string[]; removed: string[] } | null>(null)
  const [open, setOpen] = useState<Record<string, boolean>>({})
  const [lang, setLang] = useState<'en' | 'et'>('en')
  const [adding, setAdding] = useState(false)
  const [newItem, setNewItem] = useState({ requirement: '', section: 'other', citation: '' })

  const load = useCallback(async () => {
    const res = await fetch(`/api/projects/${projectId}/regulatory`, { cache: 'no-store' })
    if (!res.ok) { setLoading(false); return }
    const { data } = await res.json()
    setData(data)
    if (data.profile?.parameters) setForm({ ...DEFAULTS, ...data.profile.parameters })
    setLoading(false)
  }, [projectId])
  useEffect(() => { load() }, [load])

  const set = <K extends keyof Params>(k: K, v: Params[K]) => setForm((f) => ({ ...f, [k]: v }))
  const isBlock = form.buildingType === 'apartment_block'

  async function generate() {
    setRunning(true); setDiff(null)
    try {
      const res = await fetch(`/api/projects/${projectId}/regulatory`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ parameters: form }) })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || 'Could not generate')
      setDiff(body.data.diff)
      toast(`Checklist generated — ${Object.values(body.data.grouped as Record<string, unknown[]>).reduce((a, l) => a + l.length, 0)} obligations from ${body.data.ruleSetVersion}`, 'success')
      await load()
    } catch (e) { toast(e instanceof Error ? e.message : 'Failed', 'error') }
    finally { setRunning(false) }
  }

  async function addItem() {
    if (!newItem.requirement.trim()) return
    const res = await fetch(`/api/projects/${projectId}/regulatory/items`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(newItem) })
    if (!res.ok) { toast('Could not add', 'error'); return }
    toast('Added — thank you, this helps improve the rule set', 'success')
    setNewItem({ requirement: '', section: 'other', citation: '' }); setAdding(false); await load()
  }

  const total = data ? data.counts.generated + data.counts.added : 0
  const disciplines = useMemo(() => Object.keys(data?.grouped ?? {}), [data])

  return (
    <div className="flex gap-6 items-start">
      {/* ── Questionnaire ─────────────────────────────────── */}
      <aside className="w-[340px] shrink-0 rounded-xl border border-surface-200 bg-white p-5 sticky top-4">
        <div className="flex items-center gap-2 mb-1"><Scale className="w-4 h-4 text-accent-600" /><h2 className="text-[14px] font-semibold text-ink-900">Project parameters</h2></div>
        <p className="text-[11px] text-ink-400 mb-4">Answer what you know. The engine only uses deterministic rules — no AI judgement.</p>

        <Field label="Jurisdiction"><Select value={form.jurisdiction} onChange={(v) => set('jurisdiction', v as Params['jurisdiction'])} options={[['EE', 'Estonia — Ehitusseadustik'], ['GB', 'UK (rule set coming)'], ['PL', 'Poland (rule set coming)']]} /></Field>
        <Field label="Building type"><Select value={form.buildingType} onChange={(v) => set('buildingType', v as Params['buildingType'])} options={[['detached_house', 'Detached house'], ['semi_detached', 'Semi-detached'], ['terraced', 'Terraced'], ['apartment_block', 'Apartment block'], ['non_residential', 'Non-residential'], ['other', 'Other']]} /></Field>
        <Field label="Work"><Select value={form.workType} onChange={(v) => set('workType', v as Params['workType'])} options={[['new_build', 'New build'], ['extension', 'Extension'], ['reconstruction', 'Reconstruction'], ['change_of_use', 'Change of use'], ['demolition', 'Demolition']]} /></Field>
        <div className="grid grid-cols-3 gap-2">
          <Field label="Gross m²"><Num value={form.grossFloorArea} onChange={(v) => set('grossFloorArea', v)} /></Field>
          <Field label="Height m"><Num value={form.height} onChange={(v) => set('height', v)} step={0.1} /></Field>
          <Field label="Storeys"><Num value={form.storeys} onChange={(v) => set('storeys', v)} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Heated m²"><Num value={form.heatedArea ?? 0} onChange={(v) => set('heatedArea', v)} /></Field>
          <Field label="Enclosed net m²"><Num value={form.enclosedNetArea ?? 0} onChange={(v) => set('enclosedNetArea', v)} /></Field>
        </div>
        {isBlock && <div className="grid grid-cols-2 gap-2">
          <Field label="Apartments"><Num value={form.apartments ?? 0} onChange={(v) => set('apartments', v)} /></Field>
          <Field label="Parking spaces"><Num value={form.parkingSpaces ?? 0} onChange={(v) => set('parkingSpaces', v)} /></Field>
        </div>}
        {!isBlock && <Field label="Parking spaces"><Num value={form.parkingSpaces ?? 0} onChange={(v) => set('parkingSpaces', v)} /></Field>}

        <div className="mt-3 space-y-1.5">
          <Toggle label="Detailed plan (detailplaneering) in force" value={!!form.detailedPlanExists} onChange={(v) => set('detailedPlanExists', v)} />
          {form.detailedPlanExists && <Field label="Plan age (years)"><Num value={form.detailedPlanAgeYears ?? 0} onChange={(v) => set('detailedPlanAgeYears', v)} /></Field>}
          <Toggle label="Urban area (municipal water/sewage)" value={!!form.urbanArea} onChange={(v) => set('urbanArea', v)} />
          <Toggle label="District heating available" value={!!form.districtHeatingAvailable} onChange={(v) => set('districtHeatingAvailable', v)} />
          <Toggle label="Timber structure" value={!!form.timberStructure} onChange={(v) => set('timberStructure', v)} />
          <Toggle label="Heritage / monument" value={!!form.heritage} onChange={(v) => set('heritage', v)} />
          <Toggle label="Protected area" value={!!form.protectedArea} onChange={(v) => set('protectedArea', v)} />
          <Toggle label="Near major road / airport" value={!!form.nearMajorRoad} onChange={(v) => set('nearMajorRoad', v)} />
          <Toggle label="Seasonal use only (< 4 months/yr)" value={!!form.seasonalUseOnly} onChange={(v) => set('seasonalUseOnly', v)} />
          <Toggle label="Temporary (≤ 2 years)" value={!!form.temporary} onChange={(v) => set('temporary', v)} />
        </div>
        {form.jurisdiction === 'EE' && <Field label="County"><Select value={form.county ?? ''} onChange={(v) => set('county', v || undefined)} options={[['', '—'], ...EE_COUNTIES.map((c) => [c, c] as [string, string])]} /></Field>}

        <button onClick={generate} disabled={running} className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-accent-500 text-white text-[13px] font-medium hover:bg-accent-600 disabled:opacity-50">
          {running ? <Loader2 className="w-4 h-4 animate-spin" /> : data?.register ? <RefreshCw className="w-4 h-4" /> : <ShieldCheck className="w-4 h-4" />}
          {data?.register ? 'Re-run checklist' : 'Generate checklist'}
        </button>
        {data?.profile && <p className="mt-2 text-[11px] text-ink-400">Profile v{data.profile.version} · {new Date(data.profile.createdAt).toLocaleDateString()}</p>}
      </aside>

      {/* ── Checklist ─────────────────────────────────────── */}
      <main className="flex-1 min-w-0">
        {loading ? <div className="text-[13px] text-ink-400 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" />Loading…</div> : !data?.register ? (
          <div className="rounded-xl border border-dashed border-surface-300 p-10 text-center">
            <ShieldCheck className="w-6 h-6 text-accent-300 mx-auto mb-2" />
            <p className="text-[14px] font-medium text-ink-900">No regulatory checklist yet</p>
            <p className="text-[12px] text-ink-400 mt-1 max-w-sm mx-auto">Fill in the parameters and generate. Every obligation will carry its legal citation and the rule-set version it came from.</p>
          </div>
        ) : (
          <>
            {/* Non-dismissible notice — Suleyman requirement */}
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-[12px] text-amber-900 flex gap-2 mb-4">
              <Info className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <span className="font-medium">Generated from {data.register.templateVersion} on {new Date(data.register.updatedAt).toLocaleDateString()}</span> from the parameters you entered. This is an organiser, not a legal opinion: it does not replace your professional judgement, the municipality’s design conditions, or the detailed plan. If something is missing, add it below — that feeds back into the rule set.
              </div>
            </div>

            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-[15px] font-semibold text-ink-900">{data.register.name}</h2>
                <p className="text-[11px] text-ink-400">{data.counts.generated} obligations from the rule set · {data.counts.added} added by the practice{diff && (diff.added.length || diff.removed.length) ? ` · since last run: +${diff.added.length} / −${diff.removed.length}` : ''}</p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setLang(lang === 'en' ? 'et' : 'en')} className="text-[11px] px-2 py-1 rounded-md border border-surface-300 text-ink-500 hover:text-ink-900">{lang === 'en' ? 'ET' : 'EN'}</button>
                <button onClick={() => setAdding(true)} className="flex items-center gap-1 text-[12px] px-3 py-1.5 rounded-md border border-surface-300 text-ink-700 hover:border-accent-400"><Plus className="w-3.5 h-3.5" />Add missing item</button>
              </div>
            </div>

            {adding && (
              <div className="rounded-lg border border-accent-200 bg-accent-50/40 p-3 mb-4 space-y-2">
                <input value={newItem.requirement} onChange={(e) => setNewItem({ ...newItem, requirement: e.target.value })} placeholder="What did the engine miss? (e.g. Local noise bylaw — construction hours 7–19)" className="w-full text-[13px] px-3 py-2 rounded-md border border-surface-300 bg-white" />
                <div className="flex gap-2">
                  <select value={newItem.section} onChange={(e) => setNewItem({ ...newItem, section: e.target.value })} className="text-[12px] px-2 py-1.5 rounded-md border border-surface-300 bg-white">{Object.entries(data.disciplineLabels).map(([k, l]) => <option key={k} value={k}>{l.en}</option>)}<option value="other">Other</option></select>
                  <input value={newItem.citation} onChange={(e) => setNewItem({ ...newItem, citation: e.target.value })} placeholder="Citation (optional)" className="flex-1 text-[12px] px-3 py-1.5 rounded-md border border-surface-300 bg-white" />
                  <button onClick={addItem} className="text-[12px] px-3 py-1.5 rounded-md bg-accent-500 text-white">Add</button>
                  <button onClick={() => setAdding(false)} className="text-[12px] px-3 py-1.5 rounded-md text-ink-500">Cancel</button>
                </div>
              </div>
            )}

            <div className="space-y-3">
              {disciplines.map((d) => {
                const items = data.grouped[d]
                const isOpen = open[d] ?? true
                return (
                  <section key={d} className="rounded-xl border border-surface-200 bg-white">
                    <button onClick={() => setOpen({ ...open, [d]: !isOpen })} className="w-full flex items-center gap-2 px-4 py-3 text-left">
                      {isOpen ? <ChevronDown className="w-4 h-4 text-ink-400" /> : <ChevronRight className="w-4 h-4 text-ink-400" />}
                      <span className="text-[13px] font-semibold text-ink-900">{data.disciplineLabels[d]?.[lang] ?? d}</span>
                      <span className="text-[11px] text-ink-400">{items.length}</span>
                      {diff?.added.some((id) => items.some((i) => i.ruleId === id)) && <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded bg-green-50 text-green-700 border border-green-200">new</span>}
                    </button>
                    {isOpen && <ul className="border-t border-surface-100">
                      {items.map((i) => <Row key={i.id} item={i} lang={lang} isNew={!!diff?.added.includes(i.ruleId ?? '')} />)}
                    </ul>}
                  </section>
                )
              })}
              {data.added.length > 0 && (
                <section className="rounded-xl border border-accent-200 bg-white">
                  <div className="px-4 py-3 text-[13px] font-semibold text-ink-900">Added by the practice <span className="text-[11px] text-ink-400 font-normal">{data.added.length}</span></div>
                  <ul className="border-t border-surface-100">{data.added.map((i) => <Row key={i.id} item={i} lang={lang} />)}</ul>
                </section>
              )}
            </div>
            <p className="mt-4 text-[11px] text-ink-300">{total} items · rule set {data.register.templateVersion} · every item’s citation and version is recorded in the audit trail.</p>
          </>
        )}
      </main>
    </div>
  )
}

function Row({ item, lang, isNew }: { item: Item; lang: 'en' | 'et'; isNew?: boolean }) {
  const title = lang === 'et' && item.titleLocal ? item.titleLocal : item.requirement
  const conf = item.confidence
  return (
    <li className={cn('px-4 py-2.5 flex gap-3 items-start border-b border-surface-100 last:border-0', isNew && 'bg-green-50/40')}>
      <span className={cn('mt-1 w-4 h-4 rounded flex items-center justify-center shrink-0', item.status === 'COMPLIANT' ? 'bg-green-100 text-green-700' : 'bg-surface-100 text-ink-300')}><Check className="w-3 h-3" /></span>
      <div className="flex-1 min-w-0">
        <div className="text-[13px] text-ink-900">{title}{item.addedByArchitect && <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-accent-50 text-accent-700 border border-accent-100">practice</span>}</div>
        {(item.because || item.comments) && <div className="text-[11px] text-ink-500 mt-0.5">{item.because}{item.because && item.comments ? ' · ' : ''}{item.comments}</div>}
        <div className="text-[11px] text-ink-400 mt-0.5 font-mono">{item.citation}{item.source ? ` — ${item.source}` : ''}</div>
      </div>
      {conf && conf !== 'architect' && (
        <span title={`Dataset confidence: ${conf}`} className={cn('text-[10px] px-1.5 py-0.5 rounded border shrink-0', conf === 'high' ? 'bg-green-50 text-green-700 border-green-200' : conf === 'medium' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-red-50 text-red-700 border-red-200')}>
          {conf === 'low' ? <span className="flex items-center gap-1"><AlertTriangle className="w-3 h-3" />verify</span> : conf}
        </span>
      )}
    </li>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block mb-2"><span className="block text-[11px] text-ink-500 mb-1">{label}</span>{children}</label> }
function Select({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: [string, string][] }) { return <select value={value} onChange={(e) => onChange(e.target.value)} className="w-full text-[13px] px-2.5 py-1.5 rounded-md border border-surface-300 bg-white">{options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select> }
function Num({ value, onChange, step = 1 }: { value: number; onChange: (v: number) => void; step?: number }) { return <input type="number" step={step} min={0} value={Number.isFinite(value) ? value : 0} onChange={(e) => onChange(parseFloat(e.target.value) || 0)} className="w-full text-[13px] px-2.5 py-1.5 rounded-md border border-surface-300 bg-white" /> }
function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return <button type="button" onClick={() => onChange(!value)} className="w-full flex items-center justify-between text-[12px] text-ink-700 py-1"><span>{label}</span><span className={cn('w-8 h-4.5 rounded-full relative transition-colors', value ? 'bg-accent-500' : 'bg-surface-300')}><span className={cn('absolute top-0.5 w-3.5 h-3.5 rounded-full bg-white transition-all', value ? 'left-4' : 'left-0.5')} /></span></button>
}

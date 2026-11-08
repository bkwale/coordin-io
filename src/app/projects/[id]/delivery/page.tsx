'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import { CheckCircle2, Circle, MinusCircle, Lock, AlertTriangle, PauseCircle, Loader2, Plus, Link2 } from 'lucide-react'
import { useToast } from '@/components/Toast'
import { SkeletonRow } from '@/components/Skeleton'

type Item = {
  id: string; kind: string; title: string; responsibleParty: string | null; assigneeId: string | null
  dueDate: string | null; status: 'OPEN' | 'DONE' | 'NOT_APPLICABLE'; isOpenItem: boolean; documentUrl: string | null
}
type Stage = {
  id: string; code: string; name: string; outcome: string | null; purpose: string | null; framework: string; templateVersion: string
  status: string; designFreeze: boolean; decision: string | null; decisionNotes: string | null; decidedAt: string | null
  plannedStart: string | null; plannedEnd: string | null; items: Item[]; progress: { total: number; resolved: number; pct: number }
}
type Delivery = { framework: string | null; accorOverlay: boolean; projectType: string | null; country?: string | null; firmCountry?: string | null; stages: Stage[]; catalogue: { frameworks: Record<string, string>; itemKinds: Record<string, string> } }
type Member = { profile: { id: string; fullName: string } }

const STATUS_STYLE: Record<string, string> = {
  NOT_STARTED: 'bg-white border-ink-200 text-ink-500', IN_PROGRESS: 'bg-blue-50 border-blue-300 text-blue-800',
  PASSED: 'bg-green-50 border-green-400 text-green-800', CONDITIONAL: 'bg-amber-50 border-amber-400 text-amber-800', HOLD: 'bg-red-50 border-red-400 text-red-800',
}
const STATUS_LABEL: Record<string, string> = { NOT_STARTED: 'Not started', IN_PROGRESS: 'In progress', PASSED: 'Passed', CONDITIONAL: 'Conditional pass', HOLD: 'On hold' }
const KIND_ORDER = ['EXIT_CRITERION', 'DRAWING', 'REPORT', 'DELIVERABLE', 'ACCOR', 'APPROVAL']

export default function DeliveryPage() {
  const { id: projectId } = useParams<{ id: string }>()
  const { toast } = useToast()
  const [data, setData] = useState<Delivery | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [setup, setSetup] = useState({ framework: 'CWA', accorOverlay: false, custom: 'Stage 1\nStage 2\nStage 3' })
  const [decision, setDecision] = useState<{ open: boolean; kind: 'PASS' | 'CONDITIONAL_PASS' | 'HOLD'; notes: string; items: { title: string; assigneeId: string; dueDate: string }[] }>({ open: false, kind: 'PASS', notes: '', items: [] })
  const [newItem, setNewItem] = useState({ title: '', assigneeId: '', dueDate: '' })

  const load = useCallback(async () => {
    const res = await fetch(`/api/projects/${projectId}/delivery`)
    const json = await res.json().catch(() => ({}))
    if (!res.ok) { toast(json.error || 'Failed to load delivery stages', 'error'); return }
    setData(json.data)
    setSelected((cur) => cur ?? json.data.stages.find((s: Stage) => s.status !== 'PASSED')?.id ?? json.data.stages[0]?.id ?? null)
    // Start on the framework for the project's country: Estonian stages in Estonia, RIBA in the UK, CWA's guide for CWA
    const d = json.data as Delivery
    // CWA (Nigerian firm) always starts on its own guide, wherever the project is
    const preferred = d.firmCountry === 'NG' || d.firmCountry == null ? 'CWA' : (d.country ?? d.firmCountry) === 'EE' ? 'EVS' : 'RIBA'
    setSetup((s) => ({ ...s, framework: preferred, accorOverlay: preferred === 'CWA' && (d.projectType === 'HOTEL' || d.projectType === 'RESORT') }))
  }, [projectId, toast])
  useEffect(() => {
    load()
    fetch(`/api/projects/${projectId}/members`).then((r) => r.json()).then((j) => setMembers(j.data?.members ?? [])).catch(() => {})
  }, [load, projectId])

  const stage = useMemo(() => data?.stages.find((s) => s.id === selected) ?? null, [data, selected])
  const nameOf = (pid: string | null) => members.find((m) => m.profile.id === pid)?.profile.fullName ?? null

  async function call(url: string, method: string, body: unknown, ok: string) {
    setBusy(true)
    try {
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || 'Something went wrong')
      toast(ok, 'success')
      await load()
      return true
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Something went wrong', 'error')
      return false
    } finally { setBusy(false) }
  }

  if (!data) return <div className="p-6 space-y-3"><SkeletonRow className="h-10" /><SkeletonRow className="h-40" /></div>

  // ── No framework yet: choose one ─────────────────────────
  if (!data.stages.length) {
    return (
      <div className="p-4 sm:p-6 max-w-3xl space-y-4">
        <div>
          <h2 className="text-[18px] font-semibold text-ink-900">Delivery framework</h2>
          <p className="text-[13px] text-ink-500 mt-1">Choose how this project's stages and gates are managed. Each stage gets its deliverables, responsibilities and approvals.</p>
        </div>
        <div className="grid gap-2">
          {((data.firmCountry === 'NG' || data.firmCountry == null) ? (['CWA', 'RIBA', 'EVS', 'CUSTOM'] as const) : (data.country ?? data.firmCountry) === 'EE' ? (['EVS', 'RIBA', 'CUSTOM'] as const) : (['RIBA', 'EVS', 'CUSTOM'] as const)).map((f) => (
            <label key={f} className={`flex items-start gap-3 p-3 border rounded-xl cursor-pointer ${setup.framework === f ? 'border-ink-900 bg-ink-25' : 'border-ink-200 bg-white'}`}>
              <input type="radio" className="mt-1" checked={setup.framework === f} onChange={() => setSetup({ ...setup, framework: f })} />
              <div>
                <div className="text-[14px] font-medium text-ink-900">{data.catalogue.frameworks[f]}</div>
                <div className="text-[12px] text-ink-500">
                  {f === 'CWA' && 'G0 Brief & Feasibility → G10 Handover. Drawings, reports, exit criteria and the six-step CWA approval chain from the Project Delivery Guide Rev A.'}
                  {f === 'RIBA' && 'Stages 0–7, Strategic Definition to Use, with core tasks per stage.'}
                  {f === 'EVS' && 'Eskiisprojekt → eelprojekt → põhiprojekt → tööprojekt, then construction and occupancy permit — with the building-register steps at each stage.'}
                  {f === 'CUSTOM' && 'Name your own stages; add deliverables as you go.'}
                </div>
              </div>
            </label>
          ))}
        </div>
        {setup.framework === 'CWA' && (
          <label className="flex items-center gap-2 text-[13px] text-ink-700">
            <input type="checkbox" checked={setup.accorOverlay} onChange={(e) => setSetup({ ...setup, accorOverlay: e.target.checked })} />
            Include Accor approval milestones (hotel projects)
          </label>
        )}
        {setup.framework === 'CUSTOM' && (
          <textarea rows={6} value={setup.custom} onChange={(e) => setSetup({ ...setup, custom: e.target.value })} className="w-full px-3 py-2 border border-ink-200 rounded-lg text-[13px]" placeholder="One stage per line" />
        )}
        <button disabled={busy} onClick={() => call(`/api/projects/${projectId}/delivery`, 'POST', {
          framework: setup.framework, accorOverlay: setup.accorOverlay,
          customStages: setup.framework === 'CUSTOM' ? setup.custom.split('\n').map((n) => ({ name: n })).filter((s) => s.name.trim()) : undefined,
        }, 'Framework applied')} className="px-4 py-2 rounded-lg bg-ink-900 text-white text-[13px] font-medium disabled:opacity-50">
          {busy ? 'Applying…' : 'Apply framework'}
        </button>
        <p className="text-[11px] text-ink-400">Project leads only. You can switch framework until the first item is completed or gate decision recorded.</p>
      </div>
    )
  }

  const grouped = stage ? KIND_ORDER.map((k) => ({ kind: k, items: stage.items.filter((i) => i.kind === k) })).filter((g) => g.items.length) : []
  const decided = !!stage && (stage.decision === 'PASS' || stage.decision === 'CONDITIONAL_PASS')

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-[18px] font-semibold text-ink-900">{data.catalogue.frameworks[data.framework ?? ''] ?? 'Delivery stages'}</h2>
          <p className="text-[12px] text-ink-400">{data.stages[0]?.templateVersion}{data.accorOverlay && ' · Accor milestones included'} · A gate is an evidence-based decision, not a percentage estimate.</p>
        </div>
      </div>

      {/* Gate strip */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {data.stages.map((s) => (
          <button key={s.id} onClick={() => setSelected(s.id)} title={`${s.name} — ${STATUS_LABEL[s.status]}`}
            className={`shrink-0 min-w-[92px] text-left px-2.5 py-2 rounded-lg border text-[11px] ${STATUS_STYLE[s.status] ?? STATUS_STYLE.NOT_STARTED} ${selected === s.id ? 'ring-2 ring-ink-900' : ''}`}>
            <div className="flex items-center justify-between font-semibold text-[12px]">{s.framework === 'RIBA' ? `Stage ${s.code}` : s.code}{s.designFreeze && <Lock className="w-3 h-3" />}</div>
            <div className="truncate max-w-[120px]">{s.name}</div>
            <div className="mt-1 h-1 bg-black/10 rounded-full overflow-hidden"><div className="h-full bg-current opacity-60" style={{ width: `${s.progress.pct}%` }} /></div>
          </button>
        ))}
      </div>

      {stage && (
        <div className="grid lg:grid-cols-[1fr_320px] gap-4">
          <div className="space-y-4">
            <div className="bg-white border border-ink-200 rounded-xl p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h3 className="text-[16px] font-semibold text-ink-900">{stage.framework === 'RIBA' ? `Stage ${stage.code}` : stage.code} — {stage.name}</h3>
                  {stage.purpose && <p className="text-[13px] text-ink-600 mt-1">{stage.purpose}</p>}
                  {stage.outcome && <p className="text-[12px] text-ink-500 mt-1">Stage outcome: <span className="font-medium">{stage.outcome}</span></p>}
                </div>
                <span className={`px-2.5 py-1 rounded-full text-[12px] font-medium border ${STATUS_STYLE[stage.status]}`}>{STATUS_LABEL[stage.status]}</span>
              </div>
              {stage.designFreeze && <p className="mt-2 text-[12px] text-ink-700 flex items-center gap-1"><Lock className="w-3.5 h-3.5" />Design baseline frozen — changes need a change request, impact assessment and approval.</p>}
              {stage.decisionNotes && <p className="mt-2 text-[12px] text-ink-600">Decision notes: {stage.decisionNotes}</p>}
            </div>

            {grouped.map((g) => (
              <div key={g.kind} className="bg-white border border-ink-200 rounded-xl">
                <div className="px-4 py-2.5 border-b border-ink-100 text-[13px] font-semibold text-ink-800">{data.catalogue.itemKinds[g.kind] ?? g.kind}</div>
                <ul className="divide-y divide-ink-100">
                  {g.items.map((it) => (
                    <li key={it.id} className="px-4 py-2.5 flex items-start gap-3">
                      <button disabled={busy} aria-label="Toggle done" onClick={() => call(`/api/projects/${projectId}/delivery/items/${it.id}`, 'PATCH', { status: it.status === 'DONE' ? 'OPEN' : 'DONE' }, it.status === 'DONE' ? 'Reopened' : 'Marked done')} className="mt-0.5">
                        {it.status === 'DONE' ? <CheckCircle2 className="w-4 h-4 text-green-600" /> : it.status === 'NOT_APPLICABLE' ? <MinusCircle className="w-4 h-4 text-ink-300" /> : <Circle className="w-4 h-4 text-ink-300" />}
                      </button>
                      <div className="flex-1 min-w-0">
                        <div className={`text-[13px] ${it.status !== 'OPEN' ? 'text-ink-400 line-through' : 'text-ink-800'} ${it.isOpenItem ? 'font-medium' : ''}`}>{it.title}</div>
                        <div className="text-[11px] text-ink-400 flex flex-wrap gap-x-3">
                          {it.responsibleParty && <span>{it.responsibleParty}</span>}
                          {nameOf(it.assigneeId) && <span>Owner: {nameOf(it.assigneeId)}</span>}
                          {it.dueDate && <span>Due {new Date(it.dueDate).toLocaleDateString()}</span>}
                          {it.documentUrl && <a href={it.documentUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 inline-flex items-center gap-0.5"><Link2 className="w-3 h-3" />Evidence</a>}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <select aria-label="Owner" value={it.assigneeId ?? ''} onChange={(e) => call(`/api/projects/${projectId}/delivery/items/${it.id}`, 'PATCH', { assigneeId: e.target.value || null }, 'Owner updated')} className="text-[11px] border border-ink-200 rounded px-1 py-0.5 max-w-[110px]">
                          <option value="">Owner…</option>
                          {members.map((m) => <option key={m.profile.id} value={m.profile.id}>{m.profile.fullName}</option>)}
                        </select>
                        {it.status === 'OPEN' && <button className="text-[11px] text-ink-400 hover:text-ink-600 px-1" onClick={() => call(`/api/projects/${projectId}/delivery/items/${it.id}`, 'PATCH', { status: 'NOT_APPLICABLE' }, 'Marked not applicable')}>N/A</button>}
                        <button className="text-[11px] text-ink-400 hover:text-ink-600 px-1" onClick={() => { const u = prompt('Evidence link (SharePoint / document URL)', it.documentUrl ?? 'https://'); if (u !== null) call(`/api/projects/${projectId}/delivery/items/${it.id}`, 'PATCH', { documentUrl: u.trim() || null }, 'Evidence linked') }}>Link</button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ))}

            <div className="bg-white border border-ink-200 rounded-xl p-3 flex flex-wrap gap-2 items-center">
              <input value={newItem.title} onChange={(e) => setNewItem({ ...newItem, title: e.target.value })} placeholder="Add a deliverable or responsibility" className="flex-1 min-w-[200px] px-3 py-1.5 border border-ink-200 rounded-lg text-[13px]" />
              <select value={newItem.assigneeId} onChange={(e) => setNewItem({ ...newItem, assigneeId: e.target.value })} className="px-2 py-1.5 border border-ink-200 rounded-lg text-[13px]">
                <option value="">Owner</option>{members.map((m) => <option key={m.profile.id} value={m.profile.id}>{m.profile.fullName}</option>)}
              </select>
              <input type="date" value={newItem.dueDate} onChange={(e) => setNewItem({ ...newItem, dueDate: e.target.value })} className="px-2 py-1.5 border border-ink-200 rounded-lg text-[13px]" />
              <button disabled={busy || !newItem.title.trim()} onClick={async () => { if (await call(`/api/projects/${projectId}/delivery/items`, 'POST', { stageId: stage.id, title: newItem.title, assigneeId: newItem.assigneeId || undefined, dueDate: newItem.dueDate || undefined }, 'Added')) setNewItem({ title: '', assigneeId: '', dueDate: '' }) }} className="flex items-center gap-1 px-3 py-1.5 text-[13px] border border-ink-200 rounded-lg disabled:opacity-50"><Plus className="w-4 h-4" />Add</button>
            </div>
          </div>

          {/* Side: progress + gate decision */}
          <div className="space-y-3">
            <div className="bg-white border border-ink-200 rounded-xl p-4">
              <div className="text-[12px] text-ink-500">Evidence resolved</div>
              <div className="text-2xl font-semibold text-ink-900">{stage.progress.resolved}/{stage.progress.total}</div>
              <div className="mt-2 h-1.5 bg-ink-100 rounded-full overflow-hidden"><div className="h-full bg-ink-800" style={{ width: `${stage.progress.pct}%` }} /></div>
              {stage.status === 'NOT_STARTED' && <button disabled={busy} onClick={() => call(`/api/projects/${projectId}/delivery/stages/${stage.id}`, 'PATCH', { status: 'IN_PROGRESS' }, 'Stage started')} className="mt-3 w-full px-3 py-1.5 text-[13px] border border-ink-200 rounded-lg">Start this stage</button>}
            </div>

            {!decided && (
              <div className="bg-white border border-ink-200 rounded-xl p-4 space-y-2">
                <div className="text-[13px] font-semibold text-ink-900">Gate decision</div>
                <div className="grid grid-cols-3 gap-1">
                  {([['PASS', 'Pass', CheckCircle2], ['CONDITIONAL_PASS', 'Conditional', AlertTriangle], ['HOLD', 'Hold', PauseCircle]] as const).map(([k, label, Icon]) => (
                    <button key={k} onClick={() => setDecision({ ...decision, open: true, kind: k })} className={`flex flex-col items-center gap-1 py-2 rounded-lg border text-[11px] ${decision.open && decision.kind === k ? 'border-ink-900 bg-ink-25' : 'border-ink-200'}`}><Icon className="w-4 h-4" />{label}</button>
                  ))}
                </div>
                {decision.open && (
                  <div className="space-y-2 pt-1">
                    {decision.kind === 'CONDITIONAL_PASS' && (
                      <div className="space-y-1.5">
                        <div className="text-[11px] text-ink-500">Open items — each needs an owner and a date</div>
                        {decision.items.map((o, i) => (
                          <div key={i} className="space-y-1 p-2 bg-ink-25 rounded-lg">
                            <input value={o.title} onChange={(e) => setDecision({ ...decision, items: decision.items.map((x, j) => j === i ? { ...x, title: e.target.value } : x) })} placeholder="What remains open" className="w-full px-2 py-1 border border-ink-200 rounded text-[12px]" />
                            <div className="flex gap-1">
                              <select value={o.assigneeId} onChange={(e) => setDecision({ ...decision, items: decision.items.map((x, j) => j === i ? { ...x, assigneeId: e.target.value } : x) })} className="flex-1 px-1 py-1 border border-ink-200 rounded text-[12px]">
                                <option value="">Owner</option>{members.map((m) => <option key={m.profile.id} value={m.profile.id}>{m.profile.fullName}</option>)}
                              </select>
                              <input type="date" value={o.dueDate} onChange={(e) => setDecision({ ...decision, items: decision.items.map((x, j) => j === i ? { ...x, dueDate: e.target.value } : x) })} className="px-1 py-1 border border-ink-200 rounded text-[12px]" />
                            </div>
                          </div>
                        ))}
                        <button onClick={() => setDecision({ ...decision, items: [...decision.items, { title: '', assigneeId: '', dueDate: '' }] })} className="text-[12px] text-blue-600">+ Add open item</button>
                      </div>
                    )}
                    <textarea rows={3} value={decision.notes} onChange={(e) => setDecision({ ...decision, notes: e.target.value })} placeholder={decision.kind === 'HOLD' ? 'Why is the gate on hold? (required)' : 'Decision notes (optional)'} className="w-full px-2 py-1.5 border border-ink-200 rounded-lg text-[12px]" />
                    <button disabled={busy} onClick={async () => {
                      if (await call(`/api/projects/${projectId}/delivery/stages/${stage.id}/decision`, 'POST', { decision: decision.kind, notes: decision.notes, openItems: decision.items }, 'Gate decision recorded')) setDecision({ open: false, kind: 'PASS', notes: '', items: [] })
                    }} className="w-full px-3 py-2 rounded-lg bg-ink-900 text-white text-[13px] font-medium disabled:opacity-50 flex items-center justify-center gap-1">
                      {busy && <Loader2 className="w-4 h-4 animate-spin" />}Record decision
                    </button>
                    <p className="text-[11px] text-ink-400">Project leads only. Pass needs every exit criterion resolved{stage.framework === 'CWA' && ' and the Design Lead approval recorded'}.</p>
                  </div>
                )}
              </div>
            )}
            {decided && (
              <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-[12px] text-green-800">
                Gate {stage.decision === 'PASS' ? 'passed' : 'conditionally passed'}{stage.decidedAt && ` on ${new Date(stage.decidedAt).toLocaleDateString()}`}.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

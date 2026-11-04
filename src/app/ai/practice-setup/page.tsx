'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import {
  Sparkles, Globe, Check, X, Loader2, AlertTriangle, Users, FolderKanban, ShieldCheck,
  HardHat, Plug, Blocks, ArrowUp, Download, RotateCcw, ArrowLeft, ClipboardCheck, Clock,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ── Types mirrored from the API ───────────────────────────────────────────────
type Stage = { name: string; status: 'running' | 'done' | 'failed'; ms?: number; detail?: string; at: string }
type Sourced<T> = { value: T | null; confidence: number; source?: any }
type Person = { name: string; role?: string | null; chartered?: string | null; partner?: boolean; onLeave?: boolean }
type Profile = {
  practice: Record<string, Sourced<any>>
  people: Person[]
  projectMix: Sourced<Record<string, number>>
  procurement: Sourced<string[]>
  municipalities: Sourced<string[]>
  activeProjects: Sourced<{ name: string; status?: string | null; year?: number | null }[]>
  heritageWork: Sourced<boolean>
  statedCapabilities: Sourced<string[]>
  signals: Record<string, Sourced<any> | undefined>
}
type Module = { key: string; label: string; on: boolean; reason: string; evidence?: string }
type Mapping = {
  headline: { name: string; city: string | null; country: string | null; founded: number | null; teamSize: number; partners: string[]; chartered: number }
  jurisdiction: string
  complianceFramework: string | null
  complianceLabel?: string | null
  stageConvention: string | null
  stageLabel?: string | null
  currency?: string | null
  authorityTerm?: string
  modules: Module[]
  municipalityProfiles: string[]
  integrations: { key: string; label: string; reason: string }[]
  followUpQuestions: { id: string; question: string; options: string[] }[]
  warnings: string[]
}
type Run = { id: string; status: string; stages: Stage[]; output?: Profile | null; mapping?: Mapping | null; error?: string | null; latencyMs?: number | null; model?: string | null; tokensUsed?: number | null; inputSummary: string }

type Msg =
  | { kind: 'ai'; text: string }
  | { kind: 'user'; text: string }
  | { kind: 'build'; title: string; lines: { text: string; status: 'running' | 'done' | 'failed'; ms?: number }[] }
  | { kind: 'chips'; qid: string; options: string[] }
  | { kind: 'error'; text: string }

const STAGE_LABEL: Record<string, string> = { ingest: 'Reading the website', fetch: 'Fetched', read: 'Read', extract: 'Understanding the practice', map: 'Choosing Coordin modules' }

function hostOf(u: string) { try { return new URL(u).hostname.replace(/^www\./, '') } catch { return u } }
function srcText(s: any): string | null {
  if (!s) return null
  if (typeof s === 'string') return s
  return [s.url, s.quote].filter(Boolean).join(' — ') || null
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function PracticeSetupDemo() {
  const [url, setUrl] = useState('')
  const [input, setInput] = useState('')
  const [run, setRun] = useState<Run | null>(null)
  const [msgs, setMsgs] = useState<Msg[]>([
    { kind: 'ai', text: 'Give me a practice’s website and I’ll set up Coordin for them — watch it come together on the right. Team, projects, municipalities, compliance, modules. Then I’ll ask a few questions a website can’t answer.' },
  ])
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [overrides, setOverrides] = useState<Record<string, boolean>>({})
  const [orgs, setOrgs] = useState<Array<{ id: string; name: string }>>([])
  const [orgId, setOrgId] = useState('')
  const [applying, setApplying] = useState(false)
  const [applied, setApplied] = useState<{ organisationId: string; appliedCount: number; skippedKeys: string[]; profileVersion: number } | null>(null)
  useEffect(() => {
    fetch('/api/admin/organisations').then((r) => (r.ok ? r.json() : null)).then((b) => {
      const list = (b?.data ?? b ?? []) as Array<{ id: string; name: string }>
      if (Array.isArray(list)) setOrgs(list.map((o) => ({ id: o.id, name: o.name })))
    }).catch(() => {})
  }, [])

  async function switchOn() {
    if (!run || !orgId) return
    setApplying(true)
    try {
      const res = await fetch('/api/ai/practice-setup/confirm', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ runId: run.id, organisationId: orgId, overrides }) })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || 'Could not apply')
      setApplied(body.data)
      setRun((r) => (r ? { ...r, status: 'APPLIED' } : r))
      push({ kind: 'ai', text: `Done — ${body.data.appliedCount} modules applied to ${orgs.find((o) => o.id === orgId)?.name ?? 'the workspace'} (practice profile v${body.data.profileVersion}).${body.data.skippedKeys.length ? ` Noted but not switchable yet: ${body.data.skippedKeys.join(', ')}.` : ''} Every decision is in the audit trail.` })
    } catch (e) { push({ kind: 'ai', text: `Couldn’t switch on: ${e instanceof Error ? e.message : 'unknown error'}` }) }
    finally { setApplying(false) }
  }
  const [qIndex, setQIndex] = useState(-1)
  const [busy, setBusy] = useState(false)
  const chatEnd = useRef<HTMLDivElement>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const finalisedRef = useRef<string | null>(null)

  useEffect(() => { chatEnd.current?.scrollIntoView({ behavior: 'smooth' }) }, [msgs])

  const push = useCallback((m: Msg) => setMsgs((prev) => [...prev, m]), [])
  const replaceBuild = useCallback((title: string, lines: Msg extends { kind: 'build' } ? never : any) => {
    setMsgs((prev) => {
      const idx = prev.findIndex((m) => m.kind === 'build' && m.title === title)
      const next: Msg = { kind: 'build', title, lines }
      if (idx === -1) return [...prev, next]
      const copy = prev.slice(); copy[idx] = next; return copy
    })
  }, [])

  // ── Start a run ─────────────────────────────────────────────────────────────
  /** "salto.ee" → website · "11038879" → Äriregister · "gb:12345678" / "SC123456" → Companies House · "salto.ee 11038879" → both */
  function parseStart(raw: string): { url?: string; registryCode?: string; jurisdiction?: 'EE' | 'GB' } {
    const parts = raw.trim().split(/\s+/)
    const out: { url?: string; registryCode?: string; jurisdiction?: 'EE' | 'GB' } = {}
    for (const p of parts) {
      const gb = p.match(/^(?:gb:|uk:)?([A-Z]{2}\d{6}|\d{8})$/i)
      if (/^\d{8}$/.test(p) && !out.registryCode) { out.registryCode = p; out.jurisdiction = 'EE'; continue }
      if (gb && /^(gb:|uk:)/i.test(p) || (gb && /^[A-Z]{2}\d{6}$/i.test(p))) { out.registryCode = gb[1].toUpperCase(); out.jurisdiction = 'GB'; continue }
      if (/[a-z]/i.test(p) && /\./.test(p)) out.url = p
    }
    return out
  }

  async function start(raw: string) {
    const u = raw.trim()
    if (!u || busy) return
    const input = parseStart(u)
    if (!input.url && !input.registryCode) { push({ kind: 'ai', text: 'Give me a website (salto.ee), an Estonian registry code (8 digits), or a UK company number (gb:12345678).' }); return }
    setBusy(true); setRun(null); setAnswers({}); setQIndex(-1); setUrl(input.url ?? `${input.jurisdiction}:${input.registryCode}`); finalisedRef.current = null
    push({ kind: 'user', text: u })
    replaceBuild('BUILDING', [{ text: input.url ? `Reading ${hostOf(input.url)}` : `Looking up ${input.jurisdiction === 'GB' ? 'Companies House' : 'Äriregister'} ${input.registryCode}`, status: 'running' }])
    try {
      const res = await fetch('/api/ai/practice-setup', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(input) })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || 'Could not start')
      const id = body.data.id as string
      if (pollRef.current) clearInterval(pollRef.current)
      pollRef.current = setInterval(() => poll(id), 1500)
    } catch (e) {
      setBusy(false)
      replaceBuild('BUILDING', [{ text: `Reading ${hostOf(u)}`, status: 'failed' }])
      push({ kind: 'error', text: e instanceof Error ? e.message : 'Something went wrong' })
    }
  }

  async function poll(id: string) {
    try {
      const res = await fetch(`/api/ai/runs/${id}`, { cache: 'no-store' })
      if (!res.ok) return
      const { data } = (await res.json()) as { data: Run }
      setRun(data)
      const byName = new Map<string, Stage>()
      for (const st of data.stages || []) byName.set(st.name === 'fetch' ? `fetch:${st.detail}` : st.name, st)
      const lines = Array.from(byName.values()).map((s) => ({
        text: s.name === 'fetch' ? `Fetched ${s.detail}` : s.name === 'read' ? `Read ${s.detail}` : `${STAGE_LABEL[s.name] || s.name}${s.detail && s.name !== 'extract' ? ` — ${s.detail}` : ''}`,
        status: s.status, ms: s.ms,
      }))
      replaceBuild('BUILDING', lines.length ? lines : [{ text: `Reading ${hostOf(data.inputSummary)}`, status: 'running' }])
      if (data.status === 'AWAITING_CONFIRMATION' || data.status === 'FAILED') {
        if (pollRef.current) clearInterval(pollRef.current)
        if (finalisedRef.current === data.id) return
        finalisedRef.current = data.id
        setBusy(false)
        if (data.status === 'FAILED') {
          push({ kind: 'error', text: data.error || 'Could not read that site.' })
          push({ kind: 'ai', text: 'I couldn’t read that one. Try another URL, or we can set up manually.' })
        } else if (data.mapping) {
          const h = data.mapping.headline
          push({ kind: 'ai', text: `${h.name}${h.city ? `, ${h.city}` : ''}${h.founded ? `, since ${h.founded}` : ''}. ${h.teamSize ? `${h.teamSize} people` : 'Team not listed'}${h.partners.length ? ` — ${h.partners.slice(0, 3).join(', ')} as partners` : ''}. ${data.mapping.municipalityProfiles.length ? `Working across ${data.mapping.municipalityProfiles.length} ${data.mapping.authorityTerm || 'municipalities'}.` : ''} Everything on the right is yours to change.` })
          setTimeout(() => askNext(data.mapping!, 0), 900)
        }
      }
    } catch { /* keep polling */ }
  }

  function askNext(m: Mapping, i: number) {
    const q = m.followUpQuestions[i]
    if (!q) { push({ kind: 'ai', text: 'That’s everything I need. Press “Switch on Coordin” on the right to apply these modules to a workspace.' }); setQIndex(99); return }
    setQIndex(i)
    push({ kind: 'ai', text: q.question })
    push({ kind: 'chips', qid: q.id, options: q.options })
  }

  function answer(qid: string, text: string) {
    setMsgs((prev) => prev.filter((m) => !(m.kind === 'chips' && m.qid === qid)))
    push({ kind: 'user', text })
    const next = { ...answers, [qid]: text }
    setAnswers(next)
    const label: Record<string, string> = { fee_approver: 'Updating Approvals', timesheet_cadence: 'Updating Timesheets', accounting: 'Updating Integrations', files: 'Updating Integrations', ehr_import: 'Ehitisregister import', municipalities: 'Updating Compliance', active: 'Updating Site' }
    replaceBuild(`ADJUSTING · ${qid}`, [{ text: label[qid] || 'Updating', status: 'done' }])
    if (run?.mapping) setTimeout(() => askNext(run.mapping!, qIndex + 1), 600)
  }

  function reset() {
    if (pollRef.current) clearInterval(pollRef.current)
    setRun(null); setUrl(''); setAnswers({}); setOverrides({}); setApplied(null); setQIndex(-1); setBusy(false)
    setMsgs([{ kind: 'ai', text: 'Reset. Give me another practice’s website.' }])
  }

  function exportRun() {
    if (!run) return
    const blob = new Blob([JSON.stringify({ run, answers }, null, 2)], { type: 'application/json' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `coordin-practice-setup-${hostOf(run.inputSummary)}.json`; a.click()
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const t = input.trim(); setInput('')
    if (!t) return
    if (t === '/reset') return reset()
    if (!run || run.status === 'FAILED') return start(t)
    // free-text answer to the current question
    const q = run.mapping?.followUpQuestions[qIndex]
    if (q) answer(q.id, t)
    else start(t)
  }

  const profile = run?.output ?? null
  const mapping = run?.mapping ?? null
  const ready = run?.status === 'AWAITING_CONFIRMATION' && !!profile && !!mapping

  return (
    <div className="h-screen w-screen flex bg-surface-50 text-ink-900 overflow-hidden">
      {/* ── Left: conversation ─────────────────────────────────────────────── */}
      <aside className="w-[380px] shrink-0 flex flex-col border-r border-surface-200 bg-white">
        <div className="px-5 pt-5 pb-3 flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-accent-500 flex items-center justify-center"><Sparkles className="w-4 h-4 text-white" /></div>
          <div>
            <div className="text-[15px] font-semibold leading-tight">Let’s set up your practice</div>
            <div className="text-[11px] text-ink-400">Coordin AI · practice setup</div>
          </div>
          <div className="ml-auto flex items-center gap-1">
            {run && <button onClick={exportRun} title="Export run" className="p-1.5 rounded-md text-ink-400 hover:text-ink-900 hover:bg-surface-100"><Download className="w-4 h-4" /></button>}
            <button onClick={reset} title="Reset" className="p-1.5 rounded-md text-ink-400 hover:text-ink-900 hover:bg-surface-100"><RotateCcw className="w-4 h-4" /></button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-2 space-y-3">
          {msgs.map((m, i) => <Message key={i} m={m} onChip={answer} />)}
          <div ref={chatEnd} />
        </div>

        <form onSubmit={submit} className="p-3 border-t border-surface-200">
          <div className="flex items-center gap-2 rounded-xl border border-surface-300 bg-white px-3 py-2 focus-within:border-accent-400">
            <Globe className="w-4 h-4 text-ink-300" />
            <input value={input} onChange={(e) => setInput(e.target.value)} placeholder={run && qIndex >= 0 && qIndex < 99 ? 'Type your answer… or /reset' : 'practice-website.ee  ·  or registry code 11038879  ·  or both'} className="flex-1 bg-transparent outline-none text-[14px] placeholder:text-ink-300" disabled={busy} />
            <button type="submit" disabled={busy || !input.trim()} className="w-8 h-8 rounded-full bg-accent-500 text-white flex items-center justify-center disabled:opacity-40">{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowUp className="w-4 h-4" />}</button>
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px] text-ink-300">
            <Link href="/admin" className="flex items-center gap-1 hover:text-ink-700"><ArrowLeft className="w-3 h-3" /> Admin</Link>
            {run?.latencyMs ? <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{(run.latencyMs / 1000).toFixed(1)}s · {run.model?.split('/')[1] || ''}</span> : null}
          </div>
        </form>
      </aside>

      {/* ── Right: the workspace, building ──────────────────────────────────── */}
      <main className="flex-1 p-6 overflow-hidden">
        <div className="h-full rounded-2xl border border-surface-300 bg-white shadow-sm flex flex-col overflow-hidden">
          <div className="h-11 flex items-center gap-3 px-4 border-b border-surface-200 bg-surface-50">
            <div className="flex gap-1.5"><span className="w-3 h-3 rounded-full bg-red-400" /><span className="w-3 h-3 rounded-full bg-amber-400" /><span className="w-3 h-3 rounded-full bg-green-400" /></div>
            <div className="flex-1 h-7 rounded-md bg-white border border-surface-200 text-[12px] text-ink-400 flex items-center px-3 font-mono">
              {mapping ? `${slug(mapping.headline.name)}.coordin.io` : 'your-practice.coordin.io'}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-6">
            {!ready && (
              <div className="h-full flex flex-col items-center justify-center text-center text-ink-300">
                {busy ? <Loader2 className="w-6 h-6 animate-spin text-accent-400 mb-3" /> : <Sparkles className="w-6 h-6 text-accent-300 mb-3" />}
                <p className="text-[13px]">{busy ? 'Reading the practice…' : 'Your workspace appears here as we talk.'}</p>
              </div>
            )}
            {ready && (
              <>
                <div className={cn('mb-4 rounded-xl border px-4 py-3 flex flex-wrap items-center gap-3', applied ? 'border-green-200 bg-green-50' : 'border-accent-200 bg-accent-50/50')}>
                  <div className="flex-1 min-w-[200px]">
                    <div className="text-[13px] font-semibold text-ink-900">{applied ? 'Coordin is switched on' : 'Switch on Coordin'}</div>
                    <div className="text-[11px] text-ink-500">{applied ? `${applied.appliedCount} modules applied · profile v${applied.profileVersion} · audited` : 'Tap any module tile below to change the decision, pick the workspace, then apply. Nothing is written until you do.'}</div>
                  </div>
                  {!applied && (
                    <>
                      <select value={orgId} onChange={(e) => setOrgId(e.target.value)} className="text-[12px] px-2.5 py-1.5 rounded-md border border-surface-300 bg-white max-w-[220px]">
                        <option value="">Workspace…</option>
                        {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                      </select>
                      <button onClick={switchOn} disabled={!orgId || applying || run?.status !== 'AWAITING_CONFIRMATION'} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent-500 text-white text-[13px] font-medium hover:bg-accent-600 disabled:opacity-50">
                        {applying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}Switch on Coordin
                      </button>
                    </>
                  )}
                </div>
                <Workspace profile={profile!} mapping={mapping!} answers={answers} overrides={overrides} onToggle={applied ? undefined : (key, on) => setOverrides((o) => ({ ...o, [key]: on }))} />
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}

function slug(s: string) { return s.toLowerCase().replace(/arhitektid|architects|arhitektuur|oü|ltd/gi, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'practice' }

// ── Chat message ──────────────────────────────────────────────────────────────
function Message({ m, onChip }: { m: Msg; onChip: (qid: string, text: string) => void }) {
  if (m.kind === 'user') return <div className="flex justify-end"><div className="max-w-[85%] rounded-2xl rounded-br-sm bg-accent-500 text-white px-3.5 py-2 text-[13px] break-all">{m.text}</div></div>
  if (m.kind === 'ai') return <div className="flex gap-2"><div className="w-6 h-6 rounded-md bg-accent-100 flex items-center justify-center shrink-0 mt-0.5"><Sparkles className="w-3 h-3 text-accent-600" /></div><div className="text-[13px] leading-relaxed text-ink-700">{m.text}</div></div>
  if (m.kind === 'error') return <div className="ml-8 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-700 flex gap-2"><AlertTriangle className="w-4 h-4 shrink-0" />{m.text}</div>
  if (m.kind === 'chips') return <div className="ml-8 flex flex-wrap gap-1.5">{m.options.map((o) => <button key={o} onClick={() => onChip(m.qid, o)} className="rounded-full border border-surface-300 bg-white px-3 py-1.5 text-[12px] text-ink-700 hover:border-accent-400 hover:text-accent-700 transition-colors">{o}</button>)}</div>
  return (
    <div className="ml-8 rounded-xl border border-surface-200 bg-surface-50 px-3 py-2">
      <div className="text-[10px] font-mono tracking-wider text-accent-600 flex items-center gap-1 mb-1"><Sparkles className="w-3 h-3" />{m.title}</div>
      <div className="space-y-1">
        {m.lines.map((l, i) => (
          <div key={i} className="flex items-center gap-2 text-[12px] text-ink-700">
            {l.status === 'done' ? <Check className="w-3.5 h-3.5 text-green-600" /> : l.status === 'failed' ? <X className="w-3.5 h-3.5 text-red-500" /> : <Loader2 className="w-3.5 h-3.5 animate-spin text-accent-500" />}
            <span className="flex-1 truncate">{l.text}</span>
            {l.ms != null && <span className="text-[10px] text-ink-300 font-mono">{l.ms >= 1000 ? `${(l.ms / 1000).toFixed(1)}s` : `${l.ms}ms`}</span>}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Workspace panels (real extracted data) ───────────────────────────────────
function Workspace({ profile, mapping, answers, overrides = {}, onToggle }: { profile: Profile; mapping: Mapping; answers: Record<string, string>; overrides?: Record<string, boolean>; onToggle?: (key: string, on: boolean) => void }) {
  const h = mapping.headline
  const active = profile.activeProjects?.value || []
  const mix = profile.projectMix?.value || {}
  const munis = mapping.municipalityProfiles
  const effective = mapping.modules.map((m) => ({ ...m, on: Object.prototype.hasOwnProperty.call(overrides, m.key) ? overrides[m.key] : m.on, overridden: Object.prototype.hasOwnProperty.call(overrides, m.key) }))
  const on = effective.filter((m) => m.on)
  const off = effective.filter((m) => !m.on)
  const [shown, setShown] = useState(0)
  useEffect(() => { setShown(0); const t = setInterval(() => setShown((s) => (s >= 8 ? (clearInterval(t), s) : s + 1)), 220); return () => clearInterval(t) }, [profile])

  const panels: { key: string; node: React.ReactNode }[] = [
    { key: 'head', node: (
      <Panel icon={<Sparkles className="w-4 h-4" />} title={h.name} sub={[h.city, h.country, h.founded ? `since ${h.founded}` : null].filter(Boolean).join(' · ')}>
        <div className="grid grid-cols-4 gap-3">
          <Stat label="Team" value={h.teamSize || '—'} />
          <Stat label="Partners" value={h.partners.length || '—'} hint={h.partners.slice(0, 3).join(', ')} />
          <Stat label="Chartered" value={h.chartered || '—'} />
          <Stat label={cap(mapping.authorityTerm || 'Municipalities')} value={munis.length || '—'} />
        </div>
        {mapping.warnings.length > 0 && <div className="mt-3 flex flex-wrap gap-1.5">{mapping.warnings.map((w) => <span key={w} className="text-[11px] px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200">{w}</span>)}</div>}
      </Panel>) },
    { key: 'team', node: (
      <Panel icon={<Users className="w-4 h-4" />} title="Team" sub={`${profile.people.length} people found on the website`}>
        <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
          {profile.people.map((p) => (
            <div key={p.name} className="flex items-center gap-2 text-[13px]">
              <span className="w-7 h-7 rounded-full bg-surface-100 text-ink-500 text-[11px] flex items-center justify-center font-medium">{initials(p.name)}</span>
              <span className="font-medium text-ink-900">{p.name}</span>
              <span className="text-ink-400 truncate">{p.role}</span>
              {p.partner && <Tag>partner</Tag>}
              {p.chartered && <Tag tone="accent">{shortChartered(p.chartered)}</Tag>}
              {p.onLeave && <Tag tone="amber">on leave</Tag>}
            </div>
          ))}
          {!profile.people.length && <div className="text-[12px] text-ink-300">No team page found.</div>}
        </div>
      </Panel>) },
    { key: 'projects', node: (
      <Panel icon={<FolderKanban className="w-4 h-4" />} title="Projects" sub={active.length ? `${active.length} under construction` : 'Portfolio mix from the website'}>
        {active.length > 0 && <div className="space-y-1.5 mb-4">{active.map((a) => <div key={a.name} className="flex items-center justify-between rounded-lg border border-surface-200 px-3 py-2 text-[13px]"><span className="font-medium">{a.name}</span><span className="flex items-center gap-2 text-[11px] text-ink-400"><HardHat className="w-3.5 h-3.5 text-amber-500" />{a.status || 'active'}{a.year ? ` · ${a.year}` : ''}</span></div>)}</div>}
        <MixBars mix={mix} />
      </Panel>) },
    { key: 'compliance', node: (
      <Panel icon={<ShieldCheck className="w-4 h-4" />} title="Compliance" sub={[mapping.complianceLabel || 'Framework to confirm', mapping.stageLabel].filter(Boolean).join(' · ')}>
        {munis.length > 0 ? <div className="flex flex-wrap gap-1.5">{munis.map((m) => <span key={m} className="text-[12px] px-2.5 py-1 rounded-md bg-accent-50 text-accent-700 border border-accent-100">{m}</span>)}</div> : <div className="text-[12px] text-ink-300">{answers.municipalities ? `Municipalities: ${answers.municipalities}` : 'No locations found in project titles — I’ll ask.'}</div>}
        {profile.heritageWork?.value && <div className="mt-3 text-[12px] text-ink-500 flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-green-600" />Heritage conditions enabled — {srcText(profile.heritageWork.source)?.split(' — ').pop()?.slice(0, 90)}</div>}
      </Panel>) },
    ...(answers.fee_approver ? [{ key: 'approvals', node: (
      <Panel icon={<ClipboardCheck className="w-4 h-4" />} title="Approvals" sub="Fee quotes">
        <div className="text-[13px]">Fee quotes → <span className="font-medium">{answers.fee_approver}</span>{answers.timesheet_cadence ? <> · Timesheets → <span className="font-medium">{answers.timesheet_cadence}</span></> : null}</div>
      </Panel>) }] : []),
    { key: 'modules', node: (
      <Panel icon={<Blocks className="w-4 h-4" />} title="Modules" sub={`${on.length} switched on · ${off.length} off`}>
        <div className="grid grid-cols-3 gap-2">
          {on.map((m) => <ModuleTile key={m.key} m={m} onToggle={onToggle} />)}
          {off.map((m) => <ModuleTile key={m.key} m={m} onToggle={onToggle} />)}
        </div>
      </Panel>) },
    { key: 'integrations', node: (
      <Panel icon={<Plug className="w-4 h-4" />} title="Integrations" sub="Suggested">
        <div className="flex flex-wrap gap-2">
          {mapping.integrations.map((i) => <div key={i.key} className={cn('rounded-lg border px-3 py-2 text-[12px]', answers.accounting && i.label === answers.accounting ? 'border-accent-400 bg-accent-50' : 'border-surface-200')}><div className="font-medium text-ink-900">{i.label}</div><div className="text-ink-400">{i.reason}</div></div>)}
          {answers.accounting && !mapping.integrations.some((i) => i.label === answers.accounting) && <div className="rounded-lg border border-accent-400 bg-accent-50 px-3 py-2 text-[12px]"><div className="font-medium">{answers.accounting}</div><div className="text-ink-400">from your answer</div></div>}
          {answers.files && <div className="rounded-lg border border-accent-400 bg-accent-50 px-3 py-2 text-[12px]"><div className="font-medium">{answers.files}</div><div className="text-ink-400">project files</div></div>}
        </div>
      </Panel>) },
  ]

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      {panels.slice(0, shown).map((p) => <div key={p.key} className="animate-slide-up">{p.node}</div>)}
    </div>
  )
}

function Panel({ icon, title, sub, children }: { icon: React.ReactNode; title: string; sub?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-surface-200 bg-white p-5">
      <div className="flex items-center gap-2 mb-3">
        <span className="w-7 h-7 rounded-md bg-surface-100 text-ink-500 flex items-center justify-center">{icon}</span>
        <div><div className="text-[14px] font-semibold text-ink-900">{title}</div>{sub && <div className="text-[11px] text-ink-400">{sub}</div>}</div>
      </div>
      {children}
    </section>
  )
}
function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return <div className="rounded-lg bg-surface-50 px-3 py-2"><div className="text-[11px] text-ink-400">{label}</div><div className="text-[20px] font-semibold text-ink-900 leading-tight">{value}</div>{hint && <div className="text-[11px] text-ink-500 truncate">{hint}</div>}</div>
}
function Tag({ children, tone = 'ink' }: { children: React.ReactNode; tone?: 'ink' | 'accent' | 'amber' }) {
  return <span className={cn('text-[10px] px-1.5 py-0.5 rounded border', tone === 'accent' ? 'bg-accent-50 text-accent-700 border-accent-100' : tone === 'amber' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-surface-100 text-ink-500 border-surface-200')}>{children}</span>
}
function ModuleTile({ m, onToggle }: { m: Module & { overridden?: boolean }; onToggle?: (key: string, on: boolean) => void }) {
  const Tag = onToggle ? 'button' : 'div'
  return (
    <Tag type={onToggle ? 'button' : undefined} onClick={onToggle ? () => onToggle(m.key, !m.on) : undefined} title={onToggle ? (m.on ? 'Tap to switch off' : 'Tap to switch on') : undefined} className={cn('text-left w-full rounded-lg border px-3 py-2 transition-colors', m.on ? 'border-accent-200 bg-accent-50/60' : 'border-surface-200 bg-surface-50 opacity-60', onToggle && 'hover:border-accent-400 cursor-pointer', m.overridden && 'ring-1 ring-amber-300')}>
      <div className="flex items-center gap-1.5 text-[12px] font-medium text-ink-900">{m.on ? <Check className="w-3.5 h-3.5 text-accent-600" /> : <X className="w-3.5 h-3.5 text-ink-300" />}{m.label}{m.overridden && <span className="ml-auto text-[10px] text-amber-700">changed by you</span>}</div>
      <div className="text-[11px] text-ink-400 leading-snug mt-0.5">{m.reason}{m.evidence ? ` · ${m.evidence}` : ''}</div>
    </Tag>
  )
}
function MixBars({ mix }: { mix: Record<string, number> }) {
  const labels: Record<string, string> = { public: 'Public', residentialMulti: 'Apartments', residentialSingle: 'Villas', commercial: 'Commercial', interiors: 'Interiors', masterplan: 'Masterplan', heritage: 'Heritage', installations: 'Installations' }
  const entries = Object.entries(mix).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1])
  const max = Math.max(1, ...entries.map(([, n]) => n))
  if (!entries.length) return <div className="text-[12px] text-ink-300">No project list found.</div>
  return <div className="space-y-1">{entries.map(([k, n]) => <div key={k} className="flex items-center gap-2 text-[12px]"><span className="w-24 text-ink-500">{labels[k] || k}</span><div className="flex-1 h-2 rounded bg-surface-100 overflow-hidden"><div className="h-full bg-accent-400" style={{ width: `${(n / max) * 100}%` }} /></div><span className="w-6 text-right text-ink-500">{n}</span></div>)}</div>
}
function cap(s: string) { return s.charAt(0).toUpperCase() + s.slice(1) }
function initials(n: string) { return n.split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase() }
function shortChartered(c: string) {
  const l = c.toLowerCase()
  if (/volitatud|diplomeeritud|chartered architect \d/.test(l)) { const m = c.match(/(\d)/); return m ? `VA ${m[1]}` : 'chartered' }
  if (/riba/.test(l)) return 'RIBA'
  if (/arb/.test(l)) return 'ARB'
  if (/iarp/.test(l)) return 'IARP'
  if (/uprawnienia/.test(l)) return 'uprawnienia'
  if (/eal/.test(l)) return 'EAL'
  return c.length > 14 ? 'chartered' : c
}

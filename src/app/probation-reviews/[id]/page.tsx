'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Save, Send, RotateCcw, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react'
import { useToast } from '@/components/Toast'
import { SkeletonRow } from '@/components/Skeleton'
import { ASSESSMENT_CRITERIA, WORKFLOW_LABELS, averageScore, type Assessment, type WorkflowStatus } from '@/lib/staffing/probation-workflow'
import { REVIEW_OUTCOMES } from '@/lib/staffing/probation'

type Review = {
  id: string; reviewType: string; scheduledDate: string; workflowStatus: WorkflowStatus
  objectives: string | null; feedback: string | null; employeeFeedback: string | null; improvementObjectives: string | null
  managerRecommendation: string | null; hrDecision: string | null; returnReason: string | null
  assessment: Assessment | null; evidence: { name: string; url: string }[] | null
  submittedAt: string | null; finalisedAt: string | null
  profile: { id: string; fullName: string; jobTitle: string | null; startDate: string | null }
}
type Action = 'save' | 'submit' | 'return' | 'finalise'

const STATUS_STYLE: Record<WorkflowStatus, string> = {
  SCHEDULED: 'bg-gray-100 text-gray-700', DRAFT: 'bg-blue-100 text-blue-800', SUBMITTED: 'bg-amber-100 text-amber-800',
  RETURNED: 'bg-red-100 text-red-800', FINALISED: 'bg-green-100 text-green-800',
}
const fmt = (d: string | null) => (d ? new Date(d).toLocaleDateString() : '—')

export default function ProbationReviewPage() {
  const { id } = useParams<{ id: string }>()
  const { toast } = useToast()
  const [review, setReview] = useState<Review | null>(null)
  const [actions, setActions] = useState<Action[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<Action | null>(null)
  const [form, setForm] = useState({
    scores: {} as Record<string, number | null>, comments: {} as Record<string, string>,
    objectives: '', feedback: '', employeeFeedback: '', improvementObjectives: '', managerRecommendation: '',
    evidenceName: '', evidenceUrl: '', evidence: [] as { name: string; url: string }[],
    reason: '', decision: '',
  })

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/staffing/probation/${id}`)
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || 'This review is not available to you')
      const r: Review = json.data.review
      setReview(r)
      setActions(json.data.allowedActions ?? [])
      const crit = r.assessment?.criteria ?? []
      setForm((f) => ({
        ...f,
        scores: Object.fromEntries(ASSESSMENT_CRITERIA.map((c) => [c.key, crit.find((x) => x.key === c.key)?.score ?? null])),
        comments: Object.fromEntries(ASSESSMENT_CRITERIA.map((c) => [c.key, crit.find((x) => x.key === c.key)?.comment ?? ''])),
        objectives: r.objectives ?? '', feedback: r.feedback ?? '', employeeFeedback: r.employeeFeedback ?? '',
        improvementObjectives: r.improvementObjectives ?? '', managerRecommendation: r.managerRecommendation ?? '',
        evidence: r.evidence ?? [], reason: '', decision: r.managerRecommendation ?? '',
      }))
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [id])
  useEffect(() => { load() }, [load])

  const editable = actions.includes('save')
  const hrActions = actions.includes('finalise')

  async function act(action: Action) {
    setBusy(action)
    try {
      const payload: Record<string, unknown> = { action }
      if (action === 'save' || action === 'submit') {
        Object.assign(payload, {
          assessment: { criteria: ASSESSMENT_CRITERIA.map((c) => ({ key: c.key, label: c.label, score: form.scores[c.key] ?? null, comment: form.comments[c.key] || null })) },
          objectives: form.objectives, feedback: form.feedback, employeeFeedback: form.employeeFeedback,
          improvementObjectives: form.improvementObjectives, managerRecommendation: form.managerRecommendation || undefined,
          evidence: form.evidence,
        })
      }
      if (action === 'return') payload.reason = form.reason
      if (action === 'finalise') payload.decision = form.decision
      const res = await fetch(`/api/staffing/probation/${id}/workflow`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || 'Could not save')
      toast({ save: 'Draft saved', submit: 'Submitted to HR', return: 'Returned to the manager', finalise: 'Review finalised' }[action], 'success')
      await load()
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not save', 'error')
    } finally {
      setBusy(null)
    }
  }

  if (loading) return <div className="max-w-4xl mx-auto p-6 space-y-3"><SkeletonRow className="h-8 w-64" /><SkeletonRow className="h-40" /></div>
  if (error || !review) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <Link href="/onboarding/manage" className="text-[13px] text-ink-500 flex items-center gap-1 mb-4"><ArrowLeft className="w-4 h-4" />Back</Link>
        <div className="bg-white border border-ink-200 rounded-xl p-8 text-center text-[13px] text-ink-500">{error ?? 'Not found'}</div>
      </div>
    )
  }

  const avg = averageScore({ criteria: ASSESSMENT_CRITERIA.map((c) => ({ key: c.key, label: c.label, score: form.scores[c.key] ?? null })) })
  const area = 'w-full px-3 py-2 border border-ink-200 rounded-lg text-[13px] disabled:bg-ink-25 disabled:text-ink-600'

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-4">
      <Link href="/onboarding/manage" className="text-[13px] text-ink-500 hover:text-ink-700 flex items-center gap-1"><ArrowLeft className="w-4 h-4" />Probation</Link>

      <div className="bg-white border border-ink-200 rounded-xl p-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[20px] font-semibold text-ink-900">{review.profile.fullName} — {review.reviewType} review</h1>
          <p className="text-[12px] text-ink-500 mt-1">
            {review.profile.jobTitle ?? 'Role not set'} · Started {fmt(review.profile.startDate)} · Scheduled {fmt(review.scheduledDate)}
            {review.submittedAt && <> · Submitted {fmt(review.submittedAt)}</>}{review.finalisedAt && <> · Finalised {fmt(review.finalisedAt)}</>}
          </p>
        </div>
        <span className={`px-2.5 py-1 rounded-full text-[12px] font-medium ${STATUS_STYLE[review.workflowStatus] ?? STATUS_STYLE.SCHEDULED}`}>{WORKFLOW_LABELS[review.workflowStatus] ?? review.workflowStatus}</span>
      </div>

      {review.workflowStatus === 'RETURNED' && review.returnReason && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex gap-2 text-[13px] text-red-800">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" /><div><span className="font-semibold">HR returned this review:</span> {review.returnReason}</div>
        </div>
      )}
      {review.workflowStatus === 'FINALISED' && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-[13px] text-green-800 flex gap-2">
          <CheckCircle2 className="w-4 h-4 mt-0.5" />HR decision: <span className="font-semibold">{review.hrDecision ?? '—'}</span>
          {review.managerRecommendation && <span className="text-green-700">(manager recommended {review.managerRecommendation})</span>}
        </div>
      )}

      <section className="bg-white border border-ink-200 rounded-xl p-4 space-y-3">
        <h2 className="text-[14px] font-semibold text-ink-900">Objectives agreed</h2>
        <textarea rows={3} disabled={!editable} value={form.objectives} onChange={(e) => setForm({ ...form, objectives: e.target.value })} className={area} placeholder="Responsibilities, expectations and goals for this period" />
      </section>

      <section className="bg-white border border-ink-200 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[14px] font-semibold text-ink-900">Performance assessment</h2>
          <span className="text-[12px] text-ink-500">Average {avg ?? '—'} / 5</span>
        </div>
        <div className="divide-y divide-ink-100">
          {ASSESSMENT_CRITERIA.map((c) => (
            <div key={c.key} className="py-3 grid sm:grid-cols-[200px_1fr] gap-2 items-start">
              <div className="text-[13px] text-ink-800">{c.label}</div>
              <div className="space-y-2">
                <div className="flex gap-1" role="radiogroup" aria-label={c.label}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button key={n} type="button" disabled={!editable} aria-pressed={form.scores[c.key] === n}
                      onClick={() => setForm({ ...form, scores: { ...form.scores, [c.key]: n } })}
                      className={`w-9 h-8 rounded-md text-[13px] border ${form.scores[c.key] === n ? 'bg-ink-900 text-white border-ink-900' : 'bg-white border-ink-200 text-ink-700'} disabled:opacity-70`}>{n}</button>
                  ))}
                  <span className="text-[11px] text-ink-400 self-center ml-2">1 = below expectations · 5 = exceptional</span>
                </div>
                <input disabled={!editable} value={form.comments[c.key] ?? ''} onChange={(e) => setForm({ ...form, comments: { ...form.comments, [c.key]: e.target.value } })} className={area} placeholder="Comment (optional)" />
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-white border border-ink-200 rounded-xl p-4 grid sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-[12px] font-medium text-ink-600 mb-1">Manager feedback</label>
          <textarea rows={4} disabled={!editable} value={form.feedback} onChange={(e) => setForm({ ...form, feedback: e.target.value })} className={area} />
        </div>
        <div>
          <label className="block text-[12px] font-medium text-ink-600 mb-1">Employee's own feedback</label>
          <textarea rows={4} disabled={!editable} value={form.employeeFeedback} onChange={(e) => setForm({ ...form, employeeFeedback: e.target.value })} className={area} placeholder="Recorded in the review meeting" />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-[12px] font-medium text-ink-600 mb-1">Improvement objectives</label>
          <textarea rows={3} disabled={!editable} value={form.improvementObjectives} onChange={(e) => setForm({ ...form, improvementObjectives: e.target.value })} className={area} />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-[12px] font-medium text-ink-600 mb-1">Evidence (links)</label>
          <ul className="space-y-1 mb-2">
            {form.evidence.map((e, i) => (
              <li key={i} className="flex items-center justify-between text-[13px]">
                <a href={e.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline truncate">{e.name}</a>
                {editable && <button className="text-[12px] text-red-600" onClick={() => setForm({ ...form, evidence: form.evidence.filter((_, j) => j !== i) })}>Remove</button>}
              </li>
            ))}
            {!form.evidence.length && <li className="text-[12px] text-ink-400">None attached</li>}
          </ul>
          {editable && (
            <div className="flex gap-2">
              <input value={form.evidenceName} onChange={(e) => setForm({ ...form, evidenceName: e.target.value })} className={area} placeholder="Name" />
              <input value={form.evidenceUrl} onChange={(e) => setForm({ ...form, evidenceUrl: e.target.value })} className={area} placeholder="https:// (SharePoint link)" />
              <button type="button" className="px-3 text-[12px] border border-ink-200 rounded-lg" onClick={() => {
                if (!/^https?:\/\//.test(form.evidenceUrl)) { toast('Use a full https:// link', 'error'); return }
                setForm({ ...form, evidence: [...form.evidence, { name: form.evidenceName || 'Evidence', url: form.evidenceUrl }], evidenceName: '', evidenceUrl: '' })
              }}>Add</button>
            </div>
          )}
        </div>
        <div>
          <label className="block text-[12px] font-medium text-ink-600 mb-1">Manager recommendation</label>
          <select disabled={!editable} value={form.managerRecommendation} onChange={(e) => setForm({ ...form, managerRecommendation: e.target.value })} className={area}>
            <option value="">Select…</option>
            {REVIEW_OUTCOMES.map((o) => <option key={o} value={o}>{o === 'Pass' ? 'Pass — confirm' : o === 'Extend' ? 'Extend probation' : 'Fail'}</option>)}
          </select>
        </div>
      </section>

      {editable && (
        <div className="flex flex-wrap gap-2 justify-end">
          <button onClick={() => act('save')} disabled={!!busy} className="flex items-center gap-1.5 px-4 py-2 text-[13px] font-medium border border-ink-200 rounded-lg bg-white hover:bg-ink-25 disabled:opacity-50">
            {busy === 'save' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}Save draft
          </button>
          <button onClick={() => act('submit')} disabled={!!busy} className="flex items-center gap-1.5 px-4 py-2 text-[13px] font-medium rounded-lg bg-ink-900 text-white hover:bg-ink-800 disabled:opacity-50">
            {busy === 'submit' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}Submit to HR
          </button>
        </div>
      )}

      {hrActions && (
        <section className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
          <h2 className="text-[14px] font-semibold text-ink-900">HR decision</h2>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[12px] font-medium text-ink-600 mb-1">Decision</label>
              <select value={form.decision} onChange={(e) => setForm({ ...form, decision: e.target.value })} className={area}>
                <option value="">Select…</option>
                {REVIEW_OUTCOMES.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
              <p className="text-[11px] text-ink-500 mt-1">On the final review, Pass confirms the employee and Extend extends probation. Fail is recorded; HR actions it separately.</p>
            </div>
            <div>
              <label className="block text-[12px] font-medium text-ink-600 mb-1">Or return to the manager — what needs changing?</label>
              <textarea rows={2} value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} className={area} />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => act('return')} disabled={!!busy || !form.reason.trim()} className="flex items-center gap-1.5 px-4 py-2 text-[13px] font-medium border border-ink-200 rounded-lg bg-white disabled:opacity-50">
              <RotateCcw className="w-4 h-4" />Return for changes
            </button>
            <button onClick={() => act('finalise')} disabled={!!busy || !form.decision} className="flex items-center gap-1.5 px-4 py-2 text-[13px] font-medium rounded-lg bg-green-700 text-white disabled:opacity-50">
              <CheckCircle2 className="w-4 h-4" />Finalise review
            </button>
          </div>
        </section>
      )}
    </div>
  )
}

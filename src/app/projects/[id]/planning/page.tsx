'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import {
  Plus, Filter, Loader2, AlertTriangle, RefreshCw, X,
  Calendar, ExternalLink, FileCheck, Clock,
  CheckCircle2, ChevronDown, ChevronRight,
  Hash, User, Building2, Landmark, PoundSterling,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useToast } from '@/components/Toast'
import { useApiMutation } from '@/hooks/use-api'
import { SkeletonRow } from '@/components/Skeleton'

/* ── Types ────────────────────────────────────────────────── */

type PlanningTab = 'applications' | 'conditions'

type ApplicationStatus =
  | 'FEASIBILITY' | 'PRE_APPLICATION' | 'PREPARING' | 'SUBMITTED'
  | 'INVALID_INFORMATION_REQUIRED' | 'VALIDATED' | 'CONSULTATION'
  | 'UNDER_ASSESSMENT' | 'COMMITTEE' | 'APPROVED' | 'REFUSED'
  | 'WITHDRAWN' | 'APPEAL' | 'CONDITIONS_DISCHARGE' | 'CLOSED'

type ConditionStatus =
  | 'OUTSTANDING' | 'SUBMISSION_PREPARED' | 'SUBMITTED'
  | 'UNDER_REVIEW' | 'DISCHARGED' | 'PARTIALLY_DISCHARGED'
  | 'NOT_DISCHARGED' | 'APPEALED'

type ConditionType = 'PRE_COMMENCEMENT' | 'PRE_OCCUPATION' | 'ONGOING' | 'COMPLIANCE' | 'INFORMATIVE'

interface PlanningCondition {
  id: string; conditionNumber: number; conditionType: ConditionType
  description: string; triggerStage: string | null; dueDate: string | null
  status: ConditionStatus; submissionRequired: string | null
  submittedDate: string | null; dischargedDate: string | null
  comments: string | null; createdAt: string
}

interface PlanningApplication {
  id: string; reference: string | null; authority: string
  applicationType: string; description: string; status: ApplicationStatus
  submissionDate: string | null; validationDate: string | null
  targetDecision: string | null; decisionDate: string | null
  consultant: string | null; caseOfficer: string | null
  fee: number | null; currency: string; portalLink: string | null
  comments: string | null; createdAt: string
  _count: { conditions: number }
}

interface AppFormState {
  authority: string; applicationType: string; description: string
  reference: string; consultant: string; caseOfficer: string
  fee: string; currency: string; submissionDate: string
  targetDecision: string; portalLink: string; comments: string
}

interface CondFormState {
  description: string; conditionType: ConditionType
  triggerStage: string; submissionRequired: string
  dueDate: string; comments: string
}

/* ── Labels & metadata ────────────────────────────────────── */

const APP_STATUS_LABELS: Record<string, string> = {
  FEASIBILITY: 'Feasibility', PRE_APPLICATION: 'Pre-application', PREPARING: 'Preparing',
  SUBMITTED: 'Submitted', INVALID_INFORMATION_REQUIRED: 'Invalid / Info required',
  VALIDATED: 'Validated', CONSULTATION: 'Consultation', UNDER_ASSESSMENT: 'Under assessment',
  COMMITTEE: 'Committee', APPROVED: 'Approved', REFUSED: 'Refused', WITHDRAWN: 'Withdrawn',
  APPEAL: 'Appeal', CONDITIONS_DISCHARGE: 'Conditions discharge', CLOSED: 'Closed',
}

type BadgeMeta = { color: string; bg: string; dot: string }
const meta = (color: string, bg: string, dot: string): BadgeMeta => ({ color, bg, dot })

const APP_STATUS_META: Record<string, BadgeMeta> = {
  FEASIBILITY: meta('text-slate-700', 'bg-slate-50', 'bg-slate-500'),
  PRE_APPLICATION: meta('text-gray-700', 'bg-gray-50', 'bg-gray-500'),
  PREPARING: meta('text-blue-700', 'bg-blue-50', 'bg-blue-500'),
  SUBMITTED: meta('text-indigo-700', 'bg-indigo-50', 'bg-indigo-500'),
  INVALID_INFORMATION_REQUIRED: meta('text-red-700', 'bg-red-50', 'bg-red-500'),
  VALIDATED: meta('text-cyan-700', 'bg-cyan-50', 'bg-cyan-500'),
  CONSULTATION: meta('text-purple-700', 'bg-purple-50', 'bg-purple-500'),
  UNDER_ASSESSMENT: meta('text-yellow-700', 'bg-yellow-50', 'bg-yellow-500'),
  COMMITTEE: meta('text-orange-700', 'bg-orange-50', 'bg-orange-500'),
  APPROVED: meta('text-green-700', 'bg-green-50', 'bg-green-500'),
  REFUSED: meta('text-red-700', 'bg-red-50', 'bg-red-500'),
  WITHDRAWN: meta('text-gray-700', 'bg-gray-50', 'bg-gray-500'),
  APPEAL: meta('text-amber-700', 'bg-amber-50', 'bg-amber-500'),
  CONDITIONS_DISCHARGE: meta('text-teal-700', 'bg-teal-50', 'bg-teal-500'),
  CLOSED: meta('text-slate-700', 'bg-slate-50', 'bg-slate-500'),
}

const COND_STATUS_LABELS: Record<string, string> = {
  OUTSTANDING: 'Outstanding', SUBMISSION_PREPARED: 'Submission prepared',
  SUBMITTED: 'Submitted', UNDER_REVIEW: 'Under review', DISCHARGED: 'Discharged',
  PARTIALLY_DISCHARGED: 'Partially discharged', NOT_DISCHARGED: 'Not discharged', APPEALED: 'Appealed',
}

const COND_STATUS_META: Record<string, BadgeMeta> = {
  OUTSTANDING: meta('text-red-700', 'bg-red-50', 'bg-red-500'),
  SUBMISSION_PREPARED: meta('text-blue-700', 'bg-blue-50', 'bg-blue-500'),
  SUBMITTED: meta('text-indigo-700', 'bg-indigo-50', 'bg-indigo-500'),
  UNDER_REVIEW: meta('text-yellow-700', 'bg-yellow-50', 'bg-yellow-500'),
  DISCHARGED: meta('text-green-700', 'bg-green-50', 'bg-green-500'),
  PARTIALLY_DISCHARGED: meta('text-teal-700', 'bg-teal-50', 'bg-teal-500'),
  NOT_DISCHARGED: meta('text-red-700', 'bg-red-50', 'bg-red-500'),
  APPEALED: meta('text-amber-700', 'bg-amber-50', 'bg-amber-500'),
}

const COND_TYPE_LABELS: Record<string, string> = {
  PRE_COMMENCEMENT: 'Pre-commencement', PRE_OCCUPATION: 'Pre-occupation',
  ONGOING: 'Ongoing', COMPLIANCE: 'Compliance', INFORMATIVE: 'Informative',
}

const CURRENCIES = ['GBP', 'NGN', 'USD', 'EUR'] as const

const ALL_APP_STATUSES: ApplicationStatus[] = [
  'FEASIBILITY', 'PRE_APPLICATION', 'PREPARING', 'SUBMITTED',
  'INVALID_INFORMATION_REQUIRED', 'VALIDATED', 'CONSULTATION',
  'UNDER_ASSESSMENT', 'COMMITTEE', 'APPROVED', 'REFUSED',
  'WITHDRAWN', 'APPEAL', 'CONDITIONS_DISCHARGE', 'CLOSED',
]

const ALL_COND_STATUSES: ConditionStatus[] = [
  'OUTSTANDING', 'SUBMISSION_PREPARED', 'SUBMITTED', 'UNDER_REVIEW',
  'DISCHARGED', 'PARTIALLY_DISCHARGED', 'NOT_DISCHARGED', 'APPEALED',
]

const ALL_COND_TYPES: ConditionType[] = [
  'PRE_COMMENCEMENT', 'PRE_OCCUPATION', 'ONGOING', 'COMPLIANCE', 'INFORMATIVE',
]

/* ── Helpers ──────────────────────────────────────────────── */

function fmtDate(d: string | null | undefined): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function fmtCurrency(amount: number | null | undefined, currency: string): string {
  if (amount == null) return '—'
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(amount)
}

const EMPTY_APP: AppFormState = {
  authority: '', applicationType: '', description: '', reference: '',
  consultant: '', caseOfficer: '', fee: '', currency: 'GBP',
  submissionDate: '', targetDecision: '', portalLink: '', comments: '',
}

const EMPTY_COND: CondFormState = {
  description: '', conditionType: 'PRE_COMMENCEMENT',
  triggerStage: '', submissionRequired: '', dueDate: '', comments: '',
}

const inputCls = 'w-full px-3 py-2 text-[13px] border border-ink-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-300 focus:border-accent-400 placeholder:text-ink-300'
const inputSmCls = 'w-full px-3 py-2 text-[12px] border border-ink-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-300 focus:border-accent-400 placeholder:text-ink-300'
const labelCls = 'block text-[11px] font-medium text-ink-500 mb-1'

/* ── Condition card (shared) ──────────────────────────────── */

function ConditionCard({ cond }: { cond: PlanningCondition }) {
  const m = COND_STATUS_META[cond.status] || COND_STATUS_META.OUTSTANDING
  return (
    <div className="bg-white rounded-lg border border-ink-100 px-4 py-3">
      <div className="flex items-start gap-3">
        <span className="text-[12px] font-mono text-ink-400 mt-0.5 shrink-0 w-6 text-right">
          {cond.conditionNumber}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-ink-50 text-ink-600 text-[10px] font-medium">
              {COND_TYPE_LABELS[cond.conditionType] || cond.conditionType}
            </span>
            <span className={cn('inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium', m.bg, m.color)}>
              <span className={cn('w-1.5 h-1.5 rounded-full', m.dot)} />
              {COND_STATUS_LABELS[cond.status] || cond.status}
            </span>
          </div>
          <p className="text-[12px] text-ink-700 mt-1.5">{cond.description}</p>
          <div className="flex items-center gap-3 mt-2 flex-wrap">
            {cond.triggerStage && <span className="text-[10px] text-ink-400">Trigger: {cond.triggerStage}</span>}
            {cond.dueDate && (
              <span className="flex items-center gap-1 text-[10px] text-ink-400">
                <Clock className="w-3 h-3" /> Due {fmtDate(cond.dueDate)}
              </span>
            )}
            {cond.submissionRequired && <span className="text-[10px] text-ink-400">Submission: {cond.submissionRequired}</span>}
            {cond.submittedDate && (
              <span className="flex items-center gap-1 text-[10px] text-emerald-600">
                <CheckCircle2 className="w-3 h-3" /> Submitted {fmtDate(cond.submittedDate)}
              </span>
            )}
            {cond.dischargedDate && (
              <span className="flex items-center gap-1 text-[10px] text-green-600">
                <CheckCircle2 className="w-3 h-3" /> Discharged {fmtDate(cond.dischargedDate)}
              </span>
            )}
          </div>
          {cond.comments && <p className="text-[10px] text-ink-400 mt-1.5 italic">{cond.comments}</p>}
        </div>
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════
   Page
   ══════════════════════════════════════════════════════════════ */

export default function PlanningApplicationsPage() {
  const { id } = useParams<{ id: string }>()
  const { toast } = useToast()

  const [tab, setTab] = useState<PlanningTab>('applications')
  const [applications, setApplications] = useState<PlanningApplication[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [statusFilter, setStatusFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [condStatusFilter, setCondStatusFilter] = useState('')

  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [conditions, setConditions] = useState<PlanningCondition[]>([])
  const [loadingConditions, setLoadingConditions] = useState(false)

  const [showCreateForm, setShowCreateForm] = useState(false)
  const [appForm, setAppForm] = useState<AppFormState>(EMPTY_APP)
  const { mutate: createApplication, loading: creating, error: createError, clearError: clearCreateError } =
    useApiMutation<PlanningApplication>(`/api/projects/${id}/planning`, 'POST')

  const [showCondForm, setShowCondForm] = useState(false)
  const [condForm, setCondForm] = useState<CondFormState>(EMPTY_COND)
  const [creatingCond, setCreatingCond] = useState(false)

  /* ── Fetch ──────────────────────────────────────────────── */

  const fetchApplications = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const params = new URLSearchParams()
      if (statusFilter) params.set('status', statusFilter)
      const res = await fetch(`/api/projects/${id}/planning?${params}`)
      if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b.error?.message || `Failed to load (${res.status})`) }
      const json = await res.json()
      if (json.data) setApplications(json.data.applications || [])
    } catch (err) { setError(err instanceof Error ? err.message : 'Something went wrong') }
    finally { setLoading(false) }
  }, [id, statusFilter])

  useEffect(() => { fetchApplications() }, [fetchApplications])

  const fetchConditions = useCallback(async (applicationId: string) => {
    setLoadingConditions(true)
    try {
      const res = await fetch(`/api/projects/${id}/planning/${applicationId}/conditions`)
      if (!res.ok) throw new Error('Failed to load conditions')
      const json = await res.json()
      setConditions(json.data?.conditions || [])
    } catch { toast('Failed to load conditions', 'error'); setConditions([]) }
    finally { setLoadingConditions(false) }
  }, [id, toast])

  const handleExpand = (appId: string) => {
    if (expandedId === appId) { setExpandedId(null); setConditions([]); setShowCondForm(false) }
    else { setExpandedId(appId); setShowCondForm(false); fetchConditions(appId) }
  }

  /* ── Create application ─────────────────────────────────── */

  const handleCreateApplication = async (e: React.FormEvent) => {
    e.preventDefault()
    const { authority, applicationType, description } = appForm
    if (!authority.trim() || !applicationType.trim() || !description.trim()) return

    const body: Record<string, unknown> = { authority: authority.trim(), applicationType: applicationType.trim(), description: description.trim() }
    if (appForm.reference.trim()) body.reference = appForm.reference.trim()
    if (appForm.consultant.trim()) body.consultant = appForm.consultant.trim()
    if (appForm.caseOfficer.trim()) body.caseOfficer = appForm.caseOfficer.trim()
    if (appForm.fee) body.fee = parseFloat(appForm.fee)
    if (appForm.currency) body.currency = appForm.currency
    if (appForm.submissionDate) body.submissionDate = appForm.submissionDate
    if (appForm.targetDecision) body.targetDecision = appForm.targetDecision
    if (appForm.portalLink.trim()) body.portalLink = appForm.portalLink.trim()
    if (appForm.comments.trim()) body.comments = appForm.comments.trim()

    const result = await createApplication(body)
    if (result) { toast('Application created', 'success'); resetAppForm(); fetchApplications() }
    else { toast(createError || 'Failed to create application', 'error') }
  }

  const resetAppForm = () => { setShowCreateForm(false); setAppForm(EMPTY_APP); clearCreateError() }

  /* ── Create condition ───────────────────────────────────── */

  const handleCreateCondition = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!expandedId || !condForm.description.trim()) return
    setCreatingCond(true)
    try {
      const body: Record<string, unknown> = { description: condForm.description.trim(), conditionType: condForm.conditionType }
      if (condForm.triggerStage.trim()) body.triggerStage = condForm.triggerStage.trim()
      if (condForm.submissionRequired.trim()) body.submissionRequired = condForm.submissionRequired.trim()
      if (condForm.dueDate) body.dueDate = condForm.dueDate
      if (condForm.comments.trim()) body.comments = condForm.comments.trim()

      const res = await fetch(`/api/projects/${id}/planning/${expandedId}/conditions`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      })
      if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(j.error?.message || 'Failed to create condition') }
      toast('Condition added', 'success'); setCondForm(EMPTY_COND); setShowCondForm(false)
      fetchConditions(expandedId); fetchApplications()
    } catch (err) { toast(err instanceof Error ? err.message : 'Failed to create condition', 'error') }
    finally { setCreatingCond(false) }
  }

  /* ── Filtering ──────────────────────────────────────────── */

  let filtered = applications
  if (statusFilter) filtered = filtered.filter((a) => a.status === statusFilter)
  if (typeFilter) filtered = filtered.filter((a) => a.applicationType.toLowerCase().includes(typeFilter.toLowerCase()))

  const filteredConditions = condStatusFilter ? conditions.filter((c) => c.status === condStatusFilter) : conditions
  const appsWithConditions = applications.filter((a) => a._count.conditions > 0)

  /* ── Loading / Error ────────────────────────────────────── */

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="space-y-1"><div className="h-6 w-40 bg-ink-100 animate-pulse rounded" /><div className="h-4 w-56 bg-ink-100 animate-pulse rounded" /></div>
        <div className="bg-white rounded-xl border border-ink-100 divide-y divide-ink-50">
          {Array.from({ length: 4 }).map((_, i) => <SkeletonRow key={i} />)}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh] gap-4">
        <AlertTriangle className="w-8 h-8 text-red-500" />
        <p className="text-[13px] text-ink-600">{error}</p>
        <button onClick={fetchApplications} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-ink-900 text-white text-[13px] font-medium hover:bg-ink-800 transition-colors">
          <RefreshCw className="w-4 h-4" /> Try again
        </button>
      </div>
    )
  }

  /* ── Render helpers ─────────────────────────────────────── */

  const setField = (field: keyof AppFormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setAppForm((f) => ({ ...f, [field]: e.target.value }))

  const setCondField = (field: keyof CondFormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setCondForm((f) => ({ ...f, [field]: e.target.value }))

  const canSubmitApp = appForm.authority.trim() && appForm.applicationType.trim() && appForm.description.trim()

  return (
    <div className="space-y-5">
      {/* ── Header ────────────────────────────────────────── */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-[18px] font-semibold text-ink-900">Planning Applications</h2>
          <p className="text-[12px] text-ink-400 mt-0.5">{applications.length} application{applications.length !== 1 ? 's' : ''}</p>
        </div>
        {tab === 'applications' && !showCreateForm && (
          <button onClick={() => setShowCreateForm(true)} className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-ink-900 text-white text-[12px] font-medium hover:bg-ink-800 transition-colors">
            <Plus className="w-4 h-4" /> New Application
          </button>
        )}
      </div>

      {/* ── Tabs ──────────────────────────────────────────── */}
      <div className="flex gap-1 border-b border-ink-100">
        {(['applications', 'conditions'] as PlanningTab[]).map((t) => (
          <button key={t} onClick={() => { setTab(t); setShowCreateForm(false) }}
            className={cn('px-4 py-2.5 text-[13px] font-medium border-b-2 transition-colors', tab === t ? 'border-ink-900 text-ink-900' : 'border-transparent text-ink-400 hover:text-ink-600')}>
            {t === 'applications' ? 'Applications' : 'Conditions'}
            {t === 'applications' && <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-ink-100 text-ink-500 text-[10px]">{applications.length}</span>}
          </button>
        ))}
      </div>

      {/* ══ Applications Tab ══════════════════════════════════ */}
      {tab === 'applications' && (
        <>
          {/* Create form */}
          {showCreateForm && (
            <form onSubmit={handleCreateApplication} className="bg-white rounded-xl border-2 border-accent-200 p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-[14px] font-semibold text-ink-900">New Application</h3>
                <button type="button" onClick={resetAppForm} className="text-ink-400 hover:text-ink-600 transition-colors"><X className="w-4 h-4" /></button>
              </div>

              <div className="flex gap-4">
                <div className="flex-1">
                  <label htmlFor="app-auth" className={labelCls}>Authority <span className="text-red-400">*</span></label>
                  <input id="app-auth" type="text" value={appForm.authority} onChange={setField('authority')} placeholder="e.g. London Borough of Camden" className={inputCls} maxLength={200} required autoFocus />
                </div>
                <div className="flex-1">
                  <label htmlFor="app-type" className={labelCls}>Application type <span className="text-red-400">*</span></label>
                  <input id="app-type" type="text" value={appForm.applicationType} onChange={setField('applicationType')} placeholder="e.g. Full planning, Listed building consent" className={inputCls} maxLength={200} required />
                </div>
              </div>

              <div>
                <label htmlFor="app-desc" className={labelCls}>Description <span className="text-red-400">*</span></label>
                <textarea id="app-desc" value={appForm.description} onChange={setField('description')} placeholder="Describe the planning application..." className={cn(inputCls, 'min-h-[80px]')} maxLength={5000} required />
              </div>

              <div className="flex gap-4">
                <div className="flex-1"><label htmlFor="app-ref" className={labelCls}>Reference</label><input id="app-ref" type="text" value={appForm.reference} onChange={setField('reference')} placeholder="e.g. 2024/1234/FUL" className={inputCls} maxLength={100} /></div>
                <div className="flex-1"><label htmlFor="app-con" className={labelCls}>Consultant</label><input id="app-con" type="text" value={appForm.consultant} onChange={setField('consultant')} placeholder="e.g. Smith Planning Ltd" className={inputCls} maxLength={200} /></div>
                <div className="flex-1"><label htmlFor="app-off" className={labelCls}>Case officer</label><input id="app-off" type="text" value={appForm.caseOfficer} onChange={setField('caseOfficer')} placeholder="e.g. J. Davies" className={inputCls} maxLength={200} /></div>
              </div>

              <div className="flex gap-4">
                <div className="flex-1"><label htmlFor="app-fee" className={labelCls}>Fee</label><input id="app-fee" type="number" step="0.01" min="0" value={appForm.fee} onChange={setField('fee')} placeholder="0.00" className={inputCls} /></div>
                <div className="w-24">
                  <label htmlFor="app-cur" className={labelCls}>Currency</label>
                  <select id="app-cur" value={appForm.currency} onChange={setField('currency')} className={cn(inputCls, 'bg-white')}>
                    {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="flex-1"><label htmlFor="app-sub" className={labelCls}>Submission date</label><input id="app-sub" type="date" value={appForm.submissionDate} onChange={setField('submissionDate')} className={inputCls} /></div>
                <div className="flex-1"><label htmlFor="app-tgt" className={labelCls}>Target decision</label><input id="app-tgt" type="date" value={appForm.targetDecision} onChange={setField('targetDecision')} className={inputCls} /></div>
              </div>

              <div><label htmlFor="app-portal" className={labelCls}>Portal link</label><input id="app-portal" type="url" value={appForm.portalLink} onChange={setField('portalLink')} placeholder="https://planning.authority.gov.uk/..." className={inputCls} maxLength={500} /></div>
              <div><label htmlFor="app-comm" className={labelCls}>Comments</label><textarea id="app-comm" value={appForm.comments} onChange={setField('comments')} placeholder="Any additional notes..." className={cn(inputCls, 'min-h-[60px]')} maxLength={2000} /></div>

              {createError && <p className="text-[12px] text-red-600 bg-red-50 px-3 py-2 rounded-lg">{createError}</p>}

              <div className="flex items-center justify-end gap-2 pt-1">
                <button type="button" onClick={resetAppForm} className="px-3.5 py-2 text-[12px] font-medium text-ink-500 hover:text-ink-700 transition-colors" disabled={creating}>Cancel</button>
                <button type="submit" disabled={creating || !canSubmitApp}
                  className={cn('flex items-center gap-1.5 px-4 py-2 rounded-lg text-[12px] font-medium transition-colors', creating || !canSubmitApp ? 'bg-ink-200 text-ink-400 cursor-not-allowed' : 'bg-ink-900 text-white hover:bg-ink-800')}>
                  {creating && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Create application
                </button>
              </div>
            </form>
          )}

          {/* Filter bar */}
          <div className="flex items-center gap-3 flex-wrap">
            <Filter className="w-4 h-4 text-ink-300" />
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="text-[11px] text-ink-600 bg-white border border-ink-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-accent-300">
              <option value="">All statuses</option>
              {ALL_APP_STATUSES.map((s) => <option key={s} value={s}>{APP_STATUS_LABELS[s]}</option>)}
            </select>
            <input type="text" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} placeholder="Filter by type..." className="text-[11px] text-ink-600 bg-white border border-ink-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-accent-300 placeholder:text-ink-300 w-44" />
            {(statusFilter || typeFilter) && (
              <button onClick={() => { setStatusFilter(''); setTypeFilter('') }} className="text-[11px] text-ink-400 hover:text-ink-600 transition-colors">Clear filters</button>
            )}
          </div>

          {/* Application cards */}
          {filtered.length === 0 ? (
            <div className="bg-white rounded-xl border border-ink-100 p-10 text-center">
              <Landmark className="w-8 h-8 text-ink-200 mx-auto mb-3" />
              <p className="text-[14px] font-medium text-ink-600">No applications found</p>
              <p className="text-[12px] text-ink-400 mt-1">Try changing the filter or create a new application.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map((app) => {
                const m = APP_STATUS_META[app.status] || APP_STATUS_META.PREPARING
                const isExp = expandedId === app.id

                return (
                  <div key={app.id} className="bg-white rounded-xl border border-ink-100 overflow-hidden">
                    <button type="button" onClick={() => handleExpand(app.id)} className="w-full px-5 py-4 text-left hover:bg-surface-50 transition-colors">
                      <div className="flex items-start gap-3">
                        <span className="mt-0.5 shrink-0 text-ink-300">{isExp ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[14px] font-semibold text-ink-900">{app.reference || 'Pending'}</span>
                            <span className="text-[12px] text-ink-400">{app.authority}</span>
                          </div>
                          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-ink-50 text-ink-600 text-[10px] font-medium">{app.applicationType}</span>
                            <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-medium', m.bg, m.color)}>
                              <span className={cn('w-1.5 h-1.5 rounded-full', m.dot)} />{APP_STATUS_LABELS[app.status] || app.status}
                            </span>
                          </div>
                          <p className="text-[12px] text-ink-500 mt-2 line-clamp-2">{app.description}</p>
                          <div className="flex items-center gap-4 mt-3 flex-wrap">
                            {app.submissionDate && <span className="flex items-center gap-1 text-[11px] text-ink-400"><Calendar className="w-3 h-3" /> Submitted {fmtDate(app.submissionDate)}</span>}
                            {app.validationDate && <span className="flex items-center gap-1 text-[11px] text-ink-400"><CheckCircle2 className="w-3 h-3" /> Validated {fmtDate(app.validationDate)}</span>}
                            {app.targetDecision && <span className="flex items-center gap-1 text-[11px] text-ink-400"><Clock className="w-3 h-3" /> Target {fmtDate(app.targetDecision)}</span>}
                            {app.decisionDate && <span className="flex items-center gap-1 text-[11px] text-ink-400"><FileCheck className="w-3 h-3" /> Decision {fmtDate(app.decisionDate)}</span>}
                          </div>
                          <div className="flex items-center gap-4 mt-2 flex-wrap">
                            {app.consultant && <span className="flex items-center gap-1 text-[11px] text-ink-400"><User className="w-3 h-3" /> {app.consultant}</span>}
                            {app.caseOfficer && <span className="flex items-center gap-1 text-[11px] text-ink-400"><Building2 className="w-3 h-3" /> {app.caseOfficer}</span>}
                            {app.fee != null && <span className="flex items-center gap-1 text-[11px] text-ink-400"><PoundSterling className="w-3 h-3" /> {fmtCurrency(app.fee, app.currency)}</span>}
                            {app._count.conditions > 0 && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-ink-50 text-ink-500 text-[10px] font-medium">
                                <Hash className="w-3 h-3" /> {app._count.conditions} condition{app._count.conditions !== 1 ? 's' : ''}
                              </span>
                            )}
                          </div>
                        </div>
                        {app.portalLink && (
                          <a href={app.portalLink} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}
                            className="shrink-0 p-1.5 text-ink-300 hover:text-accent-600 transition-colors rounded-lg hover:bg-accent-50" title="Open planning portal">
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        )}
                      </div>
                    </button>

                    {/* Expanded conditions */}
                    {isExp && (
                      <div className="border-t border-ink-100 bg-surface-50 px-5 py-4 space-y-4">
                        <div className="flex items-center justify-between">
                          <h4 className="text-[13px] font-semibold text-ink-700">
                            Conditions{conditions.length > 0 && <span className="ml-1.5 text-ink-400 font-normal">({conditions.length})</span>}
                          </h4>
                          {!showCondForm && (
                            <button onClick={() => setShowCondForm(true)} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-ink-900 text-white text-[11px] font-medium hover:bg-ink-800 transition-colors">
                              <Plus className="w-3.5 h-3.5" /> Add condition
                            </button>
                          )}
                        </div>

                        {showCondForm && (
                          <form onSubmit={handleCreateCondition} className="bg-white rounded-lg border border-ink-200 p-4 space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="text-[12px] font-semibold text-ink-700">New Condition</span>
                              <button type="button" onClick={() => { setShowCondForm(false); setCondForm(EMPTY_COND) }} className="text-ink-400 hover:text-ink-600 transition-colors"><X className="w-3.5 h-3.5" /></button>
                            </div>
                            <div>
                              <label htmlFor="cond-desc" className={labelCls}>Description <span className="text-red-400">*</span></label>
                              <textarea id="cond-desc" value={condForm.description} onChange={setCondField('description')} placeholder="Describe the planning condition..." className={cn(inputSmCls, 'min-h-[60px]')} maxLength={2000} required />
                            </div>
                            <div className="flex gap-3">
                              <div className="flex-1">
                                <label htmlFor="cond-type" className={labelCls}>Condition type</label>
                                <select id="cond-type" value={condForm.conditionType} onChange={setCondField('conditionType')} className={cn(inputSmCls, 'bg-white')}>
                                  {ALL_COND_TYPES.map((t) => <option key={t} value={t}>{COND_TYPE_LABELS[t]}</option>)}
                                </select>
                              </div>
                              <div className="flex-1"><label htmlFor="cond-trig" className={labelCls}>Trigger stage</label><input id="cond-trig" type="text" value={condForm.triggerStage} onChange={setCondField('triggerStage')} placeholder="e.g. Before superstructure" className={inputSmCls} maxLength={200} /></div>
                            </div>
                            <div className="flex gap-3">
                              <div className="flex-1"><label htmlFor="cond-sub" className={labelCls}>Submission required</label><input id="cond-sub" type="text" value={condForm.submissionRequired} onChange={setCondField('submissionRequired')} placeholder="e.g. Drainage strategy report" className={inputSmCls} maxLength={500} /></div>
                              <div className="w-40"><label htmlFor="cond-due" className={labelCls}>Due date</label><input id="cond-due" type="date" value={condForm.dueDate} onChange={setCondField('dueDate')} className={inputSmCls} /></div>
                            </div>
                            <div><label htmlFor="cond-comm" className={labelCls}>Comments</label><textarea id="cond-comm" value={condForm.comments} onChange={setCondField('comments')} placeholder="Any additional notes..." className={cn(inputSmCls, 'min-h-[48px]')} maxLength={2000} /></div>
                            <div className="flex items-center justify-end gap-2">
                              <button type="button" onClick={() => { setShowCondForm(false); setCondForm(EMPTY_COND) }} className="px-3 py-1.5 text-[11px] font-medium text-ink-500 hover:text-ink-700 transition-colors" disabled={creatingCond}>Cancel</button>
                              <button type="submit" disabled={creatingCond || !condForm.description.trim()}
                                className={cn('flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-[11px] font-medium transition-colors', creatingCond || !condForm.description.trim() ? 'bg-ink-200 text-ink-400 cursor-not-allowed' : 'bg-ink-900 text-white hover:bg-ink-800')}>
                                {creatingCond && <Loader2 className="w-3 h-3 animate-spin" />} Add condition
                              </button>
                            </div>
                          </form>
                        )}

                        {loadingConditions ? (
                          <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <SkeletonRow key={i} />)}</div>
                        ) : conditions.length === 0 ? (
                          <p className="text-[12px] text-ink-400 py-3 text-center">No conditions recorded yet.</p>
                        ) : (
                          <div className="space-y-2">{conditions.map((c) => <ConditionCard key={c.id} cond={c} />)}</div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {/* ══ Conditions Tab ════════════════════════════════════ */}
      {tab === 'conditions' && (
        <>
          <div className="flex items-center gap-3 flex-wrap">
            <Filter className="w-4 h-4 text-ink-300" />
            <select value={condStatusFilter} onChange={(e) => setCondStatusFilter(e.target.value)} className="text-[11px] text-ink-600 bg-white border border-ink-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-accent-300">
              <option value="">All statuses</option>
              {ALL_COND_STATUSES.map((s) => <option key={s} value={s}>{COND_STATUS_LABELS[s]}</option>)}
            </select>
            {condStatusFilter && <button onClick={() => setCondStatusFilter('')} className="text-[11px] text-ink-400 hover:text-ink-600 transition-colors">Clear filter</button>}
          </div>

          {appsWithConditions.length === 0 ? (
            <div className="bg-white rounded-xl border border-ink-100 p-10 text-center">
              <FileCheck className="w-8 h-8 text-ink-200 mx-auto mb-3" />
              <p className="text-[14px] font-medium text-ink-600">No conditions recorded</p>
              <p className="text-[12px] text-ink-400 mt-1">Conditions will appear here once added to applications.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {appsWithConditions.map((app) => {
                const isExp = expandedId === app.id
                const displayConds = isExp ? filteredConditions : []

                return (
                  <div key={app.id} className="bg-white rounded-xl border border-ink-100 overflow-hidden">
                    <button type="button" onClick={() => handleExpand(app.id)} className="w-full px-5 py-3 text-left hover:bg-surface-50 transition-colors flex items-center gap-3">
                      <span className="text-ink-300 shrink-0">{isExp ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}</span>
                      <span className="text-[13px] font-semibold text-ink-900">{app.reference || 'Pending'}</span>
                      <span className="text-[11px] text-ink-400">{app.authority}</span>
                      <span className="ml-auto inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-ink-50 text-ink-500 text-[10px] font-medium">
                        <Hash className="w-3 h-3" /> {app._count.conditions}
                      </span>
                    </button>

                    {isExp && (
                      <div className="border-t border-ink-100 bg-surface-50 px-5 py-3 space-y-2">
                        {loadingConditions ? (
                          <div className="space-y-2">{Array.from({ length: 2 }).map((_, i) => <SkeletonRow key={i} />)}</div>
                        ) : displayConds.length === 0 ? (
                          <p className="text-[12px] text-ink-400 py-2 text-center">{condStatusFilter ? 'No conditions match the filter.' : 'No conditions found.'}</p>
                        ) : (
                          displayConds.map((c) => <ConditionCard key={c.id} cond={c} />)
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}

'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import {
  Activity, AlertTriangle, RefreshCw, CheckCircle2, Clock,
  FileText, Wallet, CalendarClock, ShieldAlert, ChevronDown,
  ChevronRight, Plus, Send, TrendingUp, Info,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { SkeletonCard } from '@/components/Skeleton'
import { useToast } from '@/components/Toast'

/* ── Types ───────────────────────────────────────────────────── */

type HealthStatus = 'GREEN' | 'AMBER' | 'RED' | 'GREY'

interface HealthRecord {
  id: string
  projectId: string
  overallHealth: HealthStatus
  scheduleHealth: HealthStatus
  budgetHealth: HealthStatus
  qualityHealth: HealthStatus
  safetyHealth: HealthStatus
  riskHealth: HealthStatus
  narrative: string | null
  mitigationPlan: string | null
  reportedById: string | null
  reportedByName: string | null
  reportDate: string
  isOverride: boolean
}

interface DerivedHealth {
  schedule: { health: HealthStatus; reason: string }
  budget: { health: HealthStatus; reason: string }
  quality: { health: HealthStatus; reason: string }
  derivedOverall: HealthStatus
}

interface ProjectDetail {
  id: string
  name: string
  code: string
  healthStatus: string
  memberships: Array<{
    projectRole: string
    profile: { id: string; orgPermission: string }
  }>
}

/* ── Constants ───────────────────────────────────────────────── */

const HEALTH_META: Record<HealthStatus, { label: string; color: string; bgColor: string; dotColor: string; hex: string }> = {
  GREEN: { label: 'On track', color: 'text-emerald-700', bgColor: 'bg-emerald-50', dotColor: 'bg-emerald-500', hex: '#22c55e' },
  AMBER: { label: 'At risk', color: 'text-amber-700', bgColor: 'bg-amber-50', dotColor: 'bg-amber-500', hex: '#f59e0b' },
  RED:   { label: 'Off track', color: 'text-red-700', bgColor: 'bg-red-50', dotColor: 'bg-red-500', hex: '#ef4444' },
  GREY:  { label: 'Not assessed', color: 'text-gray-500', bgColor: 'bg-gray-50', dotColor: 'bg-gray-400', hex: '#6b7280' },
}

const HEALTH_DIMENSIONS = [
  { key: 'scheduleHealth', label: 'Schedule', icon: CalendarClock },
  { key: 'budgetHealth', label: 'Budget', icon: Wallet },
  { key: 'qualityHealth', label: 'Quality', icon: CheckCircle2 },
  { key: 'safetyHealth', label: 'Safety', icon: ShieldAlert },
  { key: 'riskHealth', label: 'Risk', icon: AlertTriangle },
] as const

const CAN_SUBMIT_ROLES = ['PROJECT_LEAD', 'PROJECT_ARCHITECT']
const CAN_SUBMIT_ORG = ['ADMIN', 'DIRECTOR', 'MANAGER']

/* ── RAG Selector Component ──────────────────────────────────── */

function RAGSelector({
  value,
  onChange,
  label,
}: {
  value: HealthStatus
  onChange: (v: HealthStatus) => void
  label: string
}) {
  const options: HealthStatus[] = ['GREEN', 'AMBER', 'RED']
  return (
    <div className="flex items-center gap-3">
      <span className="text-[12px] text-ink-500 w-20 shrink-0">{label}</span>
      <div className="flex gap-1.5">
        {options.map(status => {
          const meta = HEALTH_META[status]
          const isSelected = value === status
          return (
            <button
              key={status}
              type="button"
              onClick={() => onChange(status)}
              className={cn(
                'w-8 h-8 rounded-full border-2 transition-all flex items-center justify-center',
                isSelected
                  ? 'border-ink-900 scale-110 shadow-sm'
                  : 'border-transparent opacity-60 hover:opacity-100',
              )}
              title={meta.label}
            >
              <span
                className="w-5 h-5 rounded-full"
                style={{ backgroundColor: meta.hex }}
              />
            </button>
          )
        })}
      </div>
      {value !== 'GREY' && (
        <span className={cn('text-[11px] font-medium', HEALTH_META[value].color)}>
          {HEALTH_META[value].label}
        </span>
      )}
    </div>
  )
}

/* ── Health Dot for trend ────────────────────────────────────── */

function HealthDot({ status, date }: { status: HealthStatus; date: string }) {
  const meta = HEALTH_META[status]
  return (
    <div className="flex flex-col items-center gap-1" title={`${meta.label} — ${new Date(date).toLocaleDateString()}`}>
      <span className={cn('w-3 h-3 rounded-full', meta.dotColor)} />
      <span className="text-[9px] text-ink-300">
        {new Date(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
      </span>
    </div>
  )
}

/* ── Page ─────────────────────────────────────────────────────── */

export default function ProjectHealthPage() {
  const params = useParams()
  const projectId = params.id as string
  const { toast } = useToast()

  const [project, setProject] = useState<ProjectDetail | null>(null)
  const [latest, setLatest] = useState<HealthRecord | null>(null)
  const [history, setHistory] = useState<HealthRecord[]>([])
  const [derived, setDerived] = useState<DerivedHealth | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedRecord, setExpandedRecord] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Form state
  const [formOverall, setFormOverall] = useState<HealthStatus>('GREY')
  const [formSchedule, setFormSchedule] = useState<HealthStatus>('GREY')
  const [formBudget, setFormBudget] = useState<HealthStatus>('GREY')
  const [formQuality, setFormQuality] = useState<HealthStatus>('GREY')
  const [formSafety, setFormSafety] = useState<HealthStatus>('GREY')
  const [formRisk, setFormRisk] = useState<HealthStatus>('GREY')
  const [formNarrative, setFormNarrative] = useState('')
  const [formMitigation, setFormMitigation] = useState('')

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [projectRes, healthRes] = await Promise.all([
        fetch(`/api/projects/${projectId}`),
        fetch(`/api/projects/${projectId}/health`),
      ])

      if (!projectRes.ok) {
        const body = await projectRes.json().catch(() => ({}))
        throw new Error(body.error?.message || `Failed to load project (${projectRes.status})`)
      }
      if (!healthRes.ok) {
        const body = await healthRes.json().catch(() => ({}))
        throw new Error(body.error?.message || `Failed to load health data (${healthRes.status})`)
      }

      const projectJson = await projectRes.json()
      const healthJson = await healthRes.json()

      setProject(projectJson.data.project)
      setLatest(healthJson.data.latest)
      setHistory(healthJson.data.history || [])
      setDerived(healthJson.data.derived)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Check if current user can submit assessments
  const canSubmit = (() => {
    if (!project) return false
    const membership = project.memberships?.[0]
    if (!membership) return false
    const { projectRole } = membership
    const { orgPermission } = membership.profile
    return CAN_SUBMIT_ROLES.includes(projectRole) || CAN_SUBMIT_ORG.includes(orgPermission)
  })()

  const handleSubmit = async () => {
    if (formOverall === 'GREY') {
      toast('Please select an overall health status', 'error')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch(`/api/projects/${projectId}/health`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          overallHealth: formOverall,
          scheduleHealth: formSchedule !== 'GREY' ? formSchedule : undefined,
          budgetHealth: formBudget !== 'GREY' ? formBudget : undefined,
          qualityHealth: formQuality !== 'GREY' ? formQuality : undefined,
          safetyHealth: formSafety !== 'GREY' ? formSafety : undefined,
          riskHealth: formRisk !== 'GREY' ? formRisk : undefined,
          narrative: formNarrative || undefined,
          mitigationPlan: formMitigation || undefined,
        }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error?.message || `Failed to submit (${res.status})`)
      }

      toast('Health assessment recorded', 'success')
      setShowForm(false)
      resetForm()
      await fetchData()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to submit assessment', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const resetForm = () => {
    setFormOverall('GREY')
    setFormSchedule('GREY')
    setFormBudget('GREY')
    setFormQuality('GREY')
    setFormSafety('GREY')
    setFormRisk('GREY')
    setFormNarrative('')
    setFormMitigation('')
  }

  /* ── Loading ─────────────────────────────────────────────── */

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <div className="h-7 w-64 bg-ink-100 animate-pulse rounded" />
          <div className="h-4 w-40 bg-ink-100 animate-pulse rounded" />
        </div>
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <SkeletonCard />
            <SkeletonCard />
          </div>
          <SkeletonCard />
        </div>
      </div>
    )
  }

  /* ── Error ───────────────────────────────────────────────── */

  if (error || !project) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh] gap-4">
        <AlertTriangle className="w-8 h-8 text-red-500" />
        <p className="text-[13px] text-ink-600">{error || 'Project not found'}</p>
        <button onClick={fetchData} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-ink-900 text-white text-[13px] font-medium hover:bg-ink-800 transition-colors">
          <RefreshCw className="w-4 h-4" /> Try again
        </button>
      </div>
    )
  }

  /* ── Determine display health ────────────────────────────── */

  const overallStatus: HealthStatus = (latest?.overallHealth as HealthStatus) || (project.healthStatus as HealthStatus) || 'GREY'
  const overall = HEALTH_META[overallStatus]
  const trendRecords = history.slice(0, 10).reverse()

  return (
    <div className="space-y-6">
      {/* ── Page header ──────────────────────────────────── */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-[20px] font-semibold text-ink-900">Project Health</h1>
          </div>
          <p className="text-[12px] text-ink-400">{project.name} &middot; {project.code}</p>
        </div>
        {canSubmit && (
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-ink-900 text-white text-[13px] font-medium hover:bg-ink-800 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Record Assessment
          </button>
        )}
      </div>

      {/* ── Overall health banner ─────────────────────────── */}
      <div className={cn(
        'rounded-xl border p-6',
        overall.bgColor,
        overallStatus === 'GREEN' ? 'border-emerald-200' :
        overallStatus === 'AMBER' ? 'border-amber-200' :
        overallStatus === 'RED' ? 'border-red-200' : 'border-gray-200',
      )}>
        <div className="flex items-center gap-4">
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center"
            style={{ backgroundColor: overall.hex + '22' }}
          >
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center"
              style={{ backgroundColor: overall.hex + '44' }}
            >
              <Activity className="w-5 h-5" style={{ color: overall.hex }} />
            </div>
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-0.5">
              <span className={cn('w-2.5 h-2.5 rounded-full', overall.dotColor)} />
              <span className={cn('text-[16px] font-semibold', overall.color)}>{overall.label}</span>
            </div>
            <p className={cn('text-[13px]', overall.color)} style={{ opacity: 0.8 }}>
              {overallStatus === 'GREEN' && 'All health factors are within acceptable thresholds.'}
              {overallStatus === 'AMBER' && 'One or more factors require attention.'}
              {overallStatus === 'RED' && 'Critical issues detected that need immediate action.'}
              {overallStatus === 'GREY' && 'No health assessment has been recorded yet.'}
            </p>
            {latest && (
              <p className="text-[11px] text-ink-400 mt-1">
                Last assessed {new Date(latest.reportDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                {latest.reportedByName ? ` by ${latest.reportedByName}` : ''}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ── Component RAG indicators ─────────────────────── */}
      {latest && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {HEALTH_DIMENSIONS.map(dim => {
            const status = (latest[dim.key as keyof HealthRecord] as HealthStatus) || 'GREY'
            const meta = HEALTH_META[status]
            const Icon = dim.icon
            return (
              <div
                key={dim.key}
                className={cn('rounded-xl border p-4 text-center', meta.bgColor,
                  status === 'GREEN' ? 'border-emerald-200' :
                  status === 'AMBER' ? 'border-amber-200' :
                  status === 'RED' ? 'border-red-200' : 'border-gray-200',
                )}
              >
                <div className="flex justify-center mb-2">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: meta.hex + '22' }}
                  >
                    <Icon className="w-4 h-4" style={{ color: meta.hex }} />
                  </div>
                </div>
                <p className="text-[11px] font-medium text-ink-500">{dim.label}</p>
                <p className={cn('text-[12px] font-semibold mt-0.5', meta.color)}>{meta.label}</p>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Main layout ───────────────────────────────────── */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left column */}
        <div className="lg:col-span-2 space-y-6">
          {/* ── Health Narrative ───────────────────────────── */}
          <div className="bg-white rounded-xl border border-ink-100">
            <div className="flex items-center gap-2 px-5 py-4 border-b border-ink-50">
              <FileText className="w-4 h-4 text-ink-400" />
              <h3 className="text-[13px] font-semibold text-ink-700">Health Narrative</h3>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <p className="text-[11px] font-medium text-ink-400 uppercase tracking-wide mb-1">Current Status</p>
                <p className="text-[13px] text-ink-700 leading-relaxed">
                  {latest?.narrative || 'Not provided'}
                </p>
              </div>
              <div>
                <p className="text-[11px] font-medium text-ink-400 uppercase tracking-wide mb-1">Mitigation Plan</p>
                <p className="text-[13px] text-ink-700 leading-relaxed">
                  {latest?.mitigationPlan || 'Not provided'}
                </p>
              </div>
            </div>
          </div>

          {/* ── Auto-Computed Health Indicators ────────────── */}
          {derived && (
            <div className="bg-white rounded-xl border border-ink-100">
              <div className="flex items-center gap-2 px-5 py-4 border-b border-ink-50">
                <TrendingUp className="w-4 h-4 text-ink-400" />
                <h3 className="text-[13px] font-semibold text-ink-700">System-Computed Indicators</h3>
                <span className="ml-auto flex items-center gap-1 text-[10px] text-ink-300">
                  <Info className="w-3 h-3" /> Based on real project data
                </span>
              </div>
              <div className="divide-y divide-ink-50">
                {[
                  { label: 'Schedule', data: derived.schedule, icon: CalendarClock },
                  { label: 'Budget', data: derived.budget, icon: Wallet },
                  { label: 'Quality', data: derived.quality, icon: CheckCircle2 },
                ].map(item => {
                  const meta = HEALTH_META[item.data.health as HealthStatus]
                  const Icon = item.icon
                  return (
                    <div key={item.label} className="flex items-center gap-4 px-5 py-3">
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                        style={{ backgroundColor: meta.hex + '15' }}
                      >
                        <Icon className="w-4 h-4" style={{ color: meta.hex }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] text-ink-500">
                          System suggests: <span className="font-medium text-ink-700">{item.label}</span>{' '}
                          <span className={cn('font-semibold', meta.color)}>{meta.label}</span>
                        </p>
                        <p className="text-[11px] text-ink-400 mt-0.5">{item.data.reason}</p>
                      </div>
                      <span className={cn(
                        'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium shrink-0',
                        meta.bgColor, meta.color,
                      )}>
                        <span className={cn('w-1.5 h-1.5 rounded-full', meta.dotColor)} />
                        {item.data.health}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* ── Health History ─────────────────────────────── */}
          <div className="bg-white rounded-xl border border-ink-100">
            <div className="flex items-center gap-2 px-5 py-4 border-b border-ink-50">
              <Clock className="w-4 h-4 text-ink-400" />
              <h3 className="text-[13px] font-semibold text-ink-700">Health History</h3>
              {history.length > 0 && (
                <span className="ml-auto text-[11px] text-ink-300">{history.length} record{history.length !== 1 ? 's' : ''}</span>
              )}
            </div>

            {/* Trend dots */}
            {trendRecords.length > 1 && (
              <div className="px-5 py-3 border-b border-ink-50">
                <p className="text-[10px] text-ink-300 uppercase tracking-wide mb-2">Trend (last {trendRecords.length} assessments)</p>
                <div className="flex items-end gap-2">
                  {trendRecords.map((r) => (
                    <HealthDot
                      key={r.id}
                      status={r.overallHealth}
                      date={r.reportDate}
                    />
                  ))}
                </div>
              </div>
            )}

            {history.length === 0 ? (
              <div className="p-8 text-center">
                <Activity className="w-8 h-8 text-ink-200 mx-auto mb-2" />
                <p className="text-[13px] text-ink-400">No health assessments recorded yet</p>
                {canSubmit && (
                  <button
                    onClick={() => setShowForm(true)}
                    className="mt-3 text-[12px] text-blue-600 hover:text-blue-700 font-medium"
                  >
                    Record the first assessment
                  </button>
                )}
              </div>
            ) : (
              <div className="divide-y divide-ink-50">
                {history.map((record) => {
                  const isExpanded = expandedRecord === record.id
                  const meta = HEALTH_META[record.overallHealth]
                  return (
                    <div key={record.id}>
                      <button
                        onClick={() => setExpandedRecord(isExpanded ? null : record.id)}
                        className="w-full flex items-center gap-3 px-5 py-3 hover:bg-ink-25 transition-colors text-left"
                      >
                        {isExpanded ? (
                          <ChevronDown className="w-3.5 h-3.5 text-ink-300 shrink-0" />
                        ) : (
                          <ChevronRight className="w-3.5 h-3.5 text-ink-300 shrink-0" />
                        )}
                        <span className="text-[12px] text-ink-500 w-24 shrink-0">
                          {new Date(record.reportDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </span>
                        <span className="text-[12px] text-ink-400 flex-1 truncate">
                          {record.reportedByName || 'Unknown'}
                        </span>
                        {/* Mini RAG indicators */}
                        <div className="flex gap-1 shrink-0">
                          {['overallHealth', 'scheduleHealth', 'budgetHealth', 'qualityHealth', 'safetyHealth', 'riskHealth'].map(key => {
                            const val = record[key as keyof HealthRecord] as HealthStatus
                            return (
                              <span
                                key={key}
                                className="w-2.5 h-2.5 rounded-full"
                                style={{ backgroundColor: HEALTH_META[val]?.hex || '#6b7280' }}
                                title={`${key.replace('Health', '')}: ${val}`}
                              />
                            )
                          })}
                        </div>
                        <span className={cn(
                          'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium shrink-0',
                          meta.bgColor, meta.color,
                        )}>
                          {meta.label}
                        </span>
                      </button>
                      {isExpanded && (
                        <div className="px-5 pb-4 pl-12 space-y-3">
                          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                            {[
                              { label: 'Overall', value: record.overallHealth },
                              { label: 'Schedule', value: record.scheduleHealth },
                              { label: 'Budget', value: record.budgetHealth },
                              { label: 'Quality', value: record.qualityHealth },
                              { label: 'Safety', value: record.safetyHealth },
                              { label: 'Risk', value: record.riskHealth },
                            ].map(item => {
                              const m = HEALTH_META[item.value]
                              return (
                                <div key={item.label} className="text-center">
                                  <span
                                    className="inline-block w-4 h-4 rounded-full mb-1"
                                    style={{ backgroundColor: m.hex }}
                                  />
                                  <p className="text-[10px] text-ink-400">{item.label}</p>
                                  <p className={cn('text-[10px] font-medium', m.color)}>{m.label}</p>
                                </div>
                              )
                            })}
                          </div>
                          {record.narrative && (
                            <div>
                              <p className="text-[10px] font-medium text-ink-400 uppercase tracking-wide mb-0.5">Narrative</p>
                              <p className="text-[12px] text-ink-600 leading-relaxed">{record.narrative}</p>
                            </div>
                          )}
                          {record.mitigationPlan && (
                            <div>
                              <p className="text-[10px] font-medium text-ink-400 uppercase tracking-wide mb-0.5">Mitigation Plan</p>
                              <p className="text-[12px] text-ink-600 leading-relaxed">{record.mitigationPlan}</p>
                            </div>
                          )}
                          {!record.narrative && !record.mitigationPlan && (
                            <p className="text-[12px] text-ink-300 italic">No narrative provided</p>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-6">
          {/* ── Record New Assessment Form ─────────────────── */}
          {showForm && canSubmit && (
            <div className="bg-white rounded-xl border border-blue-200 shadow-sm">
              <div className="flex items-center gap-2 px-5 py-4 border-b border-blue-100 bg-blue-50 rounded-t-xl">
                <Plus className="w-4 h-4 text-blue-600" />
                <h3 className="text-[13px] font-semibold text-blue-700">New Assessment</h3>
              </div>
              <div className="p-5 space-y-4">
                <RAGSelector value={formOverall} onChange={setFormOverall} label="Overall" />
                <div className="border-t border-ink-50 pt-3 space-y-3">
                  <p className="text-[10px] font-medium text-ink-400 uppercase tracking-wide">Component Ratings</p>
                  <RAGSelector value={formSchedule} onChange={setFormSchedule} label="Schedule" />
                  <RAGSelector value={formBudget} onChange={setFormBudget} label="Budget" />
                  <RAGSelector value={formQuality} onChange={setFormQuality} label="Quality" />
                  <RAGSelector value={formSafety} onChange={setFormSafety} label="Safety" />
                  <RAGSelector value={formRisk} onChange={setFormRisk} label="Risk" />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-ink-500 mb-1">Narrative</label>
                  <textarea
                    value={formNarrative}
                    onChange={e => setFormNarrative(e.target.value)}
                    placeholder="What's happening on this project..."
                    className="w-full rounded-lg border border-ink-200 px-3 py-2 text-[12px] text-ink-700 placeholder:text-ink-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                    rows={3}
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-ink-500 mb-1">Mitigation Plan</label>
                  <textarea
                    value={formMitigation}
                    onChange={e => setFormMitigation(e.target.value)}
                    placeholder="What's being done about any issues..."
                    className="w-full rounded-lg border border-ink-200 px-3 py-2 text-[12px] text-ink-700 placeholder:text-ink-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                    rows={3}
                  />
                </div>
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={handleSubmit}
                    disabled={submitting || formOverall === 'GREY'}
                    className={cn(
                      'flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-[12px] font-medium transition-colors',
                      formOverall === 'GREY'
                        ? 'bg-ink-100 text-ink-400 cursor-not-allowed'
                        : 'bg-ink-900 text-white hover:bg-ink-800',
                    )}
                  >
                    <Send className="w-3.5 h-3.5" />
                    {submitting ? 'Submitting...' : 'Submit'}
                  </button>
                  <button
                    onClick={() => { setShowForm(false); resetForm() }}
                    className="px-4 py-2 rounded-lg border border-ink-200 text-[12px] text-ink-500 hover:bg-ink-50 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── Derived vs Manual comparison ───────────────── */}
          {derived && latest && (
            <div className="bg-white rounded-xl border border-ink-100">
              <div className="flex items-center gap-2 px-5 py-4 border-b border-ink-50">
                <Activity className="w-4 h-4 text-ink-400" />
                <h3 className="text-[13px] font-semibold text-ink-700">Assessment vs System</h3>
              </div>
              <div className="p-5 space-y-3">
                {[
                  { label: 'Schedule', manual: latest.scheduleHealth, system: derived.schedule.health },
                  { label: 'Budget', manual: latest.budgetHealth, system: derived.budget.health },
                  { label: 'Quality', manual: latest.qualityHealth, system: derived.quality.health },
                ].map(item => {
                  const manualMeta = HEALTH_META[item.manual]
                  const systemMeta = HEALTH_META[item.system]
                  const differs = item.manual !== item.system && item.manual !== 'GREY' && item.system !== 'GREY'
                  return (
                    <div key={item.label} className={cn('flex items-center gap-3 p-2 rounded-lg', differs ? 'bg-amber-50' : '')}>
                      <span className="text-[11px] text-ink-500 w-16">{item.label}</span>
                      <div className="flex items-center gap-1">
                        <span className="w-3 h-3 rounded-full" style={{ backgroundColor: manualMeta.hex }} title={`Manual: ${item.manual}`} />
                        <span className="text-[10px] text-ink-300">vs</span>
                        <span className="w-3 h-3 rounded-full" style={{ backgroundColor: systemMeta.hex }} title={`System: ${item.system}`} />
                      </div>
                      {differs && (
                        <span className="text-[9px] text-amber-600 font-medium">Differs</span>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* ── Quick info ─────────────────────────────────── */}
          <div className="bg-white rounded-xl border border-ink-100">
            <div className="flex items-center gap-2 px-5 py-4 border-b border-ink-50">
              <Info className="w-4 h-4 text-ink-400" />
              <h3 className="text-[13px] font-semibold text-ink-700">About Health Assessments</h3>
            </div>
            <div className="p-5 space-y-3">
              <div className="flex items-start gap-2">
                <span className="w-3 h-3 rounded-full bg-emerald-500 mt-0.5 shrink-0" />
                <div>
                  <p className="text-[12px] font-medium text-ink-700">GREEN — On track</p>
                  <p className="text-[11px] text-ink-400">No issues. Progressing as planned.</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <span className="w-3 h-3 rounded-full bg-amber-500 mt-0.5 shrink-0" />
                <div>
                  <p className="text-[12px] font-medium text-ink-700">AMBER — At risk</p>
                  <p className="text-[11px] text-ink-400">Issues identified. Mitigation in progress.</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <span className="w-3 h-3 rounded-full bg-red-500 mt-0.5 shrink-0" />
                <div>
                  <p className="text-[12px] font-medium text-ink-700">RED — Off track</p>
                  <p className="text-[11px] text-ink-400">Critical issues. Escalation required.</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <span className="w-3 h-3 rounded-full bg-gray-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-[12px] font-medium text-ink-700">GREY — Not assessed</p>
                  <p className="text-[11px] text-ink-400">No data available for this dimension.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

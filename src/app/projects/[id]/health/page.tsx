'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import {
  Activity, AlertTriangle, RefreshCw, CheckCircle2, Clock,
  FileText, Wallet, CalendarClock, ShieldAlert,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { SkeletonCard, SkeletonStats } from '@/components/Skeleton'

/* ── Types mirroring GET /api/projects/[id] ────────────── */

interface ProjectDetail {
  id: string
  name: string
  code: string
  description: string | null
  projectType: string
  stage: string
  status: string
  healthStatus: string
  currency: string
  clientBrand: string | null
  location: string | null
  startDate: string | null
  targetCompletion: string | null
  currentIssueRef: string | null
  currentIssueDate: string | null
  createdAt: string
  office: { id: string; name: string; city: string } | null
  memberships: Array<{
    assignedAt: string
    projectRole: string
    profile: { id: string; fullName: string; email: string; avatarUrl: string | null; orgPermission: string }
  }>
  taskSummary: Record<string, number>
}

/* ── RAG types & meta ────────────────────────────────────── */

type RAG = 'GREEN' | 'AMBER' | 'RED'

const HEALTH_META: Record<RAG, { label: string; color: string; bgColor: string; dotColor: string }> = {
  GREEN: { label: 'On track', color: 'text-emerald-700', bgColor: 'bg-emerald-50', dotColor: 'bg-emerald-500' },
  AMBER: { label: 'At risk', color: 'text-amber-700', bgColor: 'bg-amber-50', dotColor: 'bg-amber-500' },
  RED:   { label: 'Off track', color: 'text-red-700', bgColor: 'bg-red-50', dotColor: 'bg-red-500' },
}

interface HealthFactor {
  key: string
  label: string
  rag: RAG
  explanation: string
  icon: React.FC<{ className?: string }>
}

/* ── Health computation helpers ───────────────────────────── */

function computeTaskCompletionRag(taskSummary: Record<string, number>): { rag: RAG; explanation: string } {
  const total = Object.values(taskSummary).reduce((a, b) => a + b, 0)
  if (total === 0) return { rag: 'GREEN', explanation: 'No tasks created yet' }
  const completed = taskSummary['COMPLETED'] || 0
  const rate = completed / total
  const pct = Math.round(rate * 100)
  if (rate >= 0.7) return { rag: 'GREEN', explanation: `${pct}% of tasks completed (${completed}/${total})` }
  if (rate >= 0.3) return { rag: 'AMBER', explanation: `${pct}% of tasks completed (${completed}/${total})` }
  return { rag: 'RED', explanation: `${pct}% of tasks completed (${completed}/${total})` }
}

function computeOverdueRag(taskSummary: Record<string, number>): { rag: RAG; explanation: string } {
  const blocked = taskSummary['BLOCKED'] || 0
  if (blocked === 0) return { rag: 'GREEN', explanation: 'No blocked tasks' }
  if (blocked <= 2) return { rag: 'AMBER', explanation: `${blocked} blocked task${blocked > 1 ? 's' : ''} need attention` }
  return { rag: 'RED', explanation: `${blocked} blocked tasks require immediate action` }
}

function computeTimelineRag(targetCompletion: string | null): { rag: RAG; explanation: string } {
  if (!targetCompletion) return { rag: 'GREEN', explanation: 'No target completion date set' }
  const now = new Date()
  const target = new Date(targetCompletion)
  const diffMs = target.getTime() - now.getTime()
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))
  if (diffDays < 0) return { rag: 'RED', explanation: `Overdue by ${Math.abs(diffDays)} day${Math.abs(diffDays) !== 1 ? 's' : ''}` }
  if (diffDays < 15) return { rag: 'RED', explanation: `${diffDays} day${diffDays !== 1 ? 's' : ''} until target completion` }
  if (diffDays <= 30) return { rag: 'AMBER', explanation: `${diffDays} days until target completion` }
  return { rag: 'GREEN', explanation: `${diffDays} days until target completion` }
}

function computeOverallHealth(factors: HealthFactor[]): RAG {
  if (factors.some(f => f.rag === 'RED')) return 'RED'
  if (factors.some(f => f.rag === 'AMBER')) return 'AMBER'
  return 'GREEN'
}

/* ── Page ─────────────────────────────────────────────────── */

export default function ProjectHealthPage() {
  const params = useParams()
  const projectId = params.id as string

  const [project, setProject] = useState<ProjectDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchProject = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/projects/${projectId}`)
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error?.message || `Failed to load (${res.status})`)
      }
      const json = await res.json()
      setProject(json.data.project)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    fetchProject()
  }, [fetchProject])

  /* ── Loading ─────────────────────────────────────────── */

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <div className="h-7 w-64 bg-ink-100 animate-pulse rounded" />
          <div className="h-4 w-40 bg-ink-100 animate-pulse rounded" />
        </div>
        <SkeletonStats count={2} />
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

  /* ── Error ───────────────────────────────────────────── */

  if (error || !project) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh] gap-4">
        <AlertTriangle className="w-8 h-8 text-red-500" />
        <p className="text-[13px] text-ink-600">{error || 'Project not found'}</p>
        <button onClick={fetchProject} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-ink-900 text-white text-[13px] font-medium hover:bg-ink-800 transition-colors">
          <RefreshCw className="w-4 h-4" /> Try again
        </button>
      </div>
    )
  }

  /* ── Compute health factors ──────────────────────────── */

  const taskCompletion = computeTaskCompletionRag(project.taskSummary)
  const overdueTasks = computeOverdueRag(project.taskSummary)
  const timeline = computeTimelineRag(project.targetCompletion)

  const factors: HealthFactor[] = [
    { key: 'task-completion', label: 'Task completion rate', icon: CheckCircle2, ...taskCompletion },
    { key: 'overdue-tasks', label: 'Overdue tasks', icon: Clock, ...overdueTasks },
    { key: 'document-review', label: 'Document review status', icon: FileText, rag: 'GREEN', explanation: 'No documents pending review' },
    { key: 'budget-status', label: 'Budget status', icon: Wallet, rag: 'GREEN', explanation: 'Budget tracking not yet configured' },
    { key: 'timeline-status', label: 'Timeline status', icon: CalendarClock, ...timeline },
  ]

  const overallRag = computeOverallHealth(factors)
  const overall = HEALTH_META[overallRag]

  /* ── Risk indicators ─────────────────────────────────── */

  const totalTasks = Object.values(project.taskSummary).reduce((a, b) => a + b, 0)
  const blockedTasks = project.taskSummary['BLOCKED'] || 0
  const completedTasks = project.taskSummary['COMPLETED'] || 0

  const risks: Array<{ label: string; present: boolean; detail: string }> = [
    {
      label: 'Blocked tasks',
      present: blockedTasks > 0,
      detail: blockedTasks > 0 ? `${blockedTasks} task${blockedTasks > 1 ? 's' : ''} currently blocked` : 'No blocked tasks',
    },
    {
      label: 'Low completion rate',
      present: totalTasks > 0 && (completedTasks / totalTasks) < 0.3,
      detail: totalTasks > 0 ? `${Math.round((completedTasks / totalTasks) * 100)}% completion rate` : 'No tasks created',
    },
    {
      label: 'Approaching deadline',
      present: timeline.rag === 'AMBER' || timeline.rag === 'RED',
      detail: timeline.explanation,
    },
  ]

  return (
    <div className="space-y-6">
      {/* ── Page header ──────────────────────────────── */}
      <div>
        <div className="flex items-center gap-3 mb-1">
          <h1 className="text-[20px] font-semibold text-ink-900">Project Health</h1>
        </div>
        <p className="text-[12px] text-ink-400">{project.name} &middot; {project.code}</p>
      </div>

      {/* ── Overall health banner ─────────────────────── */}
      <div className={cn('rounded-xl border p-6', overall.bgColor, overallRag === 'GREEN' ? 'border-emerald-200' : overallRag === 'AMBER' ? 'border-amber-200' : 'border-red-200')}>
        <div className="flex items-center gap-4">
          <div className={cn('w-12 h-12 rounded-full flex items-center justify-center', overallRag === 'GREEN' ? 'bg-emerald-100' : overallRag === 'AMBER' ? 'bg-amber-100' : 'bg-red-100')}>
            <Activity className={cn('w-6 h-6', overall.color)} />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <span className={cn('w-2.5 h-2.5 rounded-full', overall.dotColor)} />
              <span className={cn('text-[16px] font-semibold', overall.color)}>{overall.label}</span>
            </div>
            <p className={cn('text-[13px]', overallRag === 'GREEN' ? 'text-emerald-600' : overallRag === 'AMBER' ? 'text-amber-600' : 'text-red-600')}>
              {overallRag === 'GREEN' && 'All health factors are within acceptable thresholds.'}
              {overallRag === 'AMBER' && 'One or more factors require attention.'}
              {overallRag === 'RED' && 'Critical issues detected that need immediate action.'}
            </p>
          </div>
        </div>
      </div>

      {/* ── Main layout ───────────────────────────────── */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left column — Health factors */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl border border-ink-100">
            <div className="flex items-center gap-2 px-5 py-4 border-b border-ink-50">
              <Activity className="w-4 h-4 text-ink-400" />
              <h3 className="text-[13px] font-semibold text-ink-700">Health factors</h3>
            </div>
            <div className="divide-y divide-ink-50">
              {factors.map((factor) => {
                const meta = HEALTH_META[factor.rag]
                const Icon = factor.icon
                return (
                  <div key={factor.key} className="flex items-center gap-4 px-5 py-4">
                    <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center shrink-0', meta.bgColor)}>
                      <Icon className={cn('w-4.5 h-4.5', meta.color)} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium text-ink-900">{factor.label}</p>
                      <p className="text-[12px] text-ink-400 mt-0.5">{factor.explanation}</p>
                    </div>
                    <span className={cn(
                      'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium shrink-0',
                      meta.bgColor, meta.color,
                    )}>
                      <span className={cn('w-1.5 h-1.5 rounded-full', meta.dotColor)} />
                      {meta.label}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Right column — Risk indicators */}
        <div>
          <div className="bg-white rounded-xl border border-ink-100">
            <div className="flex items-center gap-2 px-5 py-4 border-b border-ink-50">
              <ShieldAlert className="w-4 h-4 text-ink-400" />
              <h3 className="text-[13px] font-semibold text-ink-700">Risk indicators</h3>
            </div>
            <div className="p-5 space-y-4">
              {risks.map((risk) => (
                <div key={risk.label} className="flex items-start gap-3">
                  <span className={cn(
                    'mt-1 w-2 h-2 rounded-full shrink-0',
                    risk.present ? 'bg-red-500' : 'bg-emerald-500',
                  )} />
                  <div className="min-w-0">
                    <p className={cn('text-[13px] font-medium', risk.present ? 'text-red-700' : 'text-ink-700')}>
                      {risk.label}
                    </p>
                    <p className="text-[12px] text-ink-400 mt-0.5">{risk.detail}</p>
                  </div>
                </div>
              ))}

              {risks.every(r => !r.present) && (
                <div className="flex items-center gap-2 py-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  <p className="text-[13px] text-emerald-700">No active risks detected</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

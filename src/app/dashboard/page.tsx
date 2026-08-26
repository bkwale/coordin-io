'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  LayoutDashboard, FolderOpen, CheckCircle2, AlertTriangle,
  Clock, Eye, ArrowRight, Loader2, RefreshCw,
  BookOpen, ShieldCheck, ClipboardCheck,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface DashboardData {
  profile: { fullName: string; jobTitle: string | null; status: string; organisationName: string }
  projects: {
    id: string; name: string; code: string; stage: string;
    healthStatus: string; myTaskCount: number; overdueTaskCount: number; inReviewTaskCount: number
  }[]
  urgentTasks: {
    id: string; title: string; projectId: string; projectName: string;
    projectCode: string; status: string; priority: string; dueDate: string | null
  }[]
  stats: { totalTasks: number; overdueTasks: number; inReviewTasks: number; completedThisWeek: number }
}

interface PendingActionsData {
  totalCount: number
  policies: {
    count: number
    items: { id: string; title: string; category: string }[]
  }
  onboarding: {
    count: number
    items: { id: string; title: string; stage: string; status: string; dueDate: string | null }[]
  }
  approvals: {
    count: number
    items: { id: string; type: string; entityId: string; submitterName: string; label: string }[]
  }
}

const HEALTH_COLORS: Record<string, string> = {
  GREEN: 'bg-emerald-400',
  AMBER: 'bg-amber-400',
  RED: 'bg-red-400',
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pendingActions, setPendingActions] = useState<PendingActionsData | null>(null)

  async function fetchData() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/dashboard')
      if (!res.ok) throw new Error('Failed to load dashboard')
      const json = await res.json()
      setData(json.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  async function fetchPendingActions() {
    try {
      const res = await fetch('/api/dashboard/pending-actions')
      if (res.ok) {
        const json = await res.json()
        setPendingActions(json.data)
      }
    } catch {
      // Non-critical — silently skip
    }
  }

  useEffect(() => { fetchData(); fetchPendingActions() }, [])

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <Loader2 className="w-8 h-8 text-accent-500 animate-spin" />
        <p className="text-[13px] text-ink-400">Loading dashboard...</p>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <AlertTriangle className="w-10 h-10 text-red-400" />
        <p className="text-[15px] font-medium text-ink-900">Unable to load dashboard</p>
        <p className="text-[13px] text-ink-400">{error}</p>
        <button onClick={fetchData} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-ink-900 text-white text-[13px] font-medium hover:bg-ink-800">
          <RefreshCw className="w-4 h-4" /> Try again
        </button>
      </div>
    )
  }

  const { profile, projects, stats } = data
  const atRiskProjects = projects.filter(p => p.healthStatus === 'RED' || p.healthStatus === 'AMBER')

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-[24px] font-semibold text-ink-900">Practice Dashboard</h1>
        <p className="text-[13px] text-ink-400 mt-1">{profile.organisationName}</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Active projects', value: projects.length, icon: FolderOpen, accent: 'bg-blue-50 text-blue-600' },
          { label: 'Open tasks', value: stats.totalTasks, icon: Clock, accent: 'bg-ink-50 text-ink-600' },
          { label: 'Overdue', value: stats.overdueTasks, icon: AlertTriangle, accent: stats.overdueTasks > 0 ? 'bg-red-50 text-red-600' : 'bg-ink-50 text-ink-400' },
          { label: 'Awaiting review', value: stats.inReviewTasks, icon: Eye, accent: 'bg-amber-50 text-amber-600' },
        ].map(({ label, value, icon: Icon, accent }) => (
          <div key={label} className="bg-white rounded-xl border border-ink-100 p-5 flex items-start gap-4">
            <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center shrink-0', accent)}>
              <Icon className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[28px] font-semibold text-ink-900 leading-tight">{value}</p>
              <p className="text-[12px] text-ink-400 mt-0.5">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Pending actions */}
      {pendingActions && pendingActions.totalCount > 0 && (
        <section>
          <h2 className="text-[15px] font-semibold text-ink-900 mb-3">
            Pending actions
            <span className="ml-2 text-[12px] font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
              {pendingActions.totalCount}
            </span>
          </h2>
          <div className="grid sm:grid-cols-3 gap-4">
            {/* Unacknowledged policies */}
            {pendingActions.policies.count > 0 && (
              <Link href="/onboarding" className="bg-white rounded-xl border border-ink-100 p-5 hover:shadow-md hover:-translate-y-0.5 transition-all group">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-9 h-9 rounded-lg bg-red-50 flex items-center justify-center shrink-0">
                    <BookOpen className="w-4.5 h-4.5 text-red-500" />
                  </div>
                  <div>
                    <p className="text-[22px] font-semibold text-ink-900 leading-tight">{pendingActions.policies.count}</p>
                    <p className="text-[11px] text-ink-400">Policies to acknowledge</p>
                  </div>
                </div>
                <div className="space-y-1.5">
                  {pendingActions.policies.items.map((p) => (
                    <p key={p.id} className="text-[12px] text-ink-500 truncate">{p.title}</p>
                  ))}
                  {pendingActions.policies.count > 3 && (
                    <p className="text-[11px] text-accent-600 font-medium group-hover:text-accent-700">
                      +{pendingActions.policies.count - 3} more
                    </p>
                  )}
                </div>
              </Link>
            )}

            {/* Incomplete onboarding */}
            {pendingActions.onboarding.count > 0 && (
              <Link href="/onboarding" className="bg-white rounded-xl border border-ink-100 p-5 hover:shadow-md hover:-translate-y-0.5 transition-all group">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-9 h-9 rounded-lg bg-amber-50 flex items-center justify-center shrink-0">
                    <ClipboardCheck className="w-4.5 h-4.5 text-amber-500" />
                  </div>
                  <div>
                    <p className="text-[22px] font-semibold text-ink-900 leading-tight">{pendingActions.onboarding.count}</p>
                    <p className="text-[11px] text-ink-400">Onboarding tasks</p>
                  </div>
                </div>
                <div className="space-y-1.5">
                  {pendingActions.onboarding.items.map((t) => (
                    <p key={t.id} className="text-[12px] text-ink-500 truncate">{t.title}</p>
                  ))}
                  {pendingActions.onboarding.count > 3 && (
                    <p className="text-[11px] text-accent-600 font-medium group-hover:text-accent-700">
                      +{pendingActions.onboarding.count - 3} more
                    </p>
                  )}
                </div>
              </Link>
            )}

            {/* Pending approvals */}
            {pendingActions.approvals.count > 0 && (
              <Link href="/my-work" className="bg-white rounded-xl border border-ink-100 p-5 hover:shadow-md hover:-translate-y-0.5 transition-all group">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-9 h-9 rounded-lg bg-violet-50 flex items-center justify-center shrink-0">
                    <ShieldCheck className="w-4.5 h-4.5 text-violet-500" />
                  </div>
                  <div>
                    <p className="text-[22px] font-semibold text-ink-900 leading-tight">{pendingActions.approvals.count}</p>
                    <p className="text-[11px] text-ink-400">Pending approvals</p>
                  </div>
                </div>
                <div className="space-y-1.5">
                  {pendingActions.approvals.items.map((a) => (
                    <p key={a.id} className="text-[12px] text-ink-500 truncate">
                      {a.label} — {a.submitterName}
                    </p>
                  ))}
                  {pendingActions.approvals.count > 3 && (
                    <p className="text-[11px] text-accent-600 font-medium group-hover:text-accent-700">
                      +{pendingActions.approvals.count - 3} more
                    </p>
                  )}
                </div>
              </Link>
            )}
          </div>
        </section>
      )}

      {/* Projects at risk */}
      <section>
        <h2 className="text-[15px] font-semibold text-ink-900 mb-3">
          Projects at risk
          <span className="ml-2 text-[12px] font-medium text-ink-400">{atRiskProjects.length}</span>
        </h2>
        {atRiskProjects.length === 0 ? (
          <div className="bg-white rounded-xl border border-ink-100 p-8 text-center">
            <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-3" />
            <p className="text-[14px] font-medium text-ink-700">All projects healthy</p>
            <p className="text-[12px] text-ink-400 mt-1">No projects flagged as at risk.</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-ink-100 divide-y divide-ink-50">
            {atRiskProjects.map(p => (
              <Link key={p.id} href={`/projects/${p.id}`} className="flex items-center gap-4 px-5 py-3.5 hover:bg-surface-50 transition-colors">
                <span className={cn('w-2.5 h-2.5 rounded-full shrink-0', HEALTH_COLORS[p.healthStatus] || 'bg-ink-200')} />
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium text-ink-900 truncate">{p.name}</p>
                  <p className="text-[11px] text-ink-400">{p.code} · {p.overdueTaskCount} overdue</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* All projects overview */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[15px] font-semibold text-ink-900">
            All projects <span className="ml-2 text-[12px] font-medium text-ink-400">{projects.length}</span>
          </h2>
          <Link href="/projects" className="text-[12px] text-accent-600 hover:text-accent-700 font-medium flex items-center gap-1">
            View all <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
        {projects.length === 0 ? (
          <div className="bg-white rounded-xl border border-ink-100 p-8 text-center">
            <FolderOpen className="w-10 h-10 text-ink-300 mx-auto mb-3" />
            <p className="text-[14px] font-medium text-ink-700">No projects yet</p>
            <p className="text-[12px] text-ink-400 mt-1">Create your first project to get started.</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map(p => (
              <Link key={p.id} href={`/projects/${p.id}`} className="bg-white rounded-xl border border-ink-100 p-5 hover:shadow-md hover:-translate-y-0.5 transition-all">
                <div className="flex items-start justify-between mb-3">
                  <div className="min-w-0">
                    <p className="text-[14px] font-semibold text-ink-900 truncate">{p.name}</p>
                    <p className="text-[11px] text-ink-400 mt-0.5">{p.code}</p>
                  </div>
                  <span className={cn('w-2.5 h-2.5 rounded-full shrink-0 mt-1', HEALTH_COLORS[p.healthStatus] || 'bg-ink-200')} />
                </div>
                <p className="text-[11px] text-ink-400 mb-4">Stage: <span className="text-ink-600 font-medium">{p.stage.replace(/_/g, ' ')}</span></p>
                <div className="flex items-center gap-4 text-[11px]">
                  <span className="text-ink-500"><span className="font-semibold text-ink-700">{p.myTaskCount}</span> tasks</span>
                  {p.overdueTaskCount > 0 && <span className="text-red-600 font-medium">{p.overdueTaskCount} overdue</span>}
                  {p.inReviewTaskCount > 0 && <span className="text-amber-600 font-medium">{p.inReviewTaskCount} to review</span>}
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

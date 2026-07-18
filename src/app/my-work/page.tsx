'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  CheckCircle2, AlertTriangle, Clock, Eye,
  FolderOpen, ArrowRight, Loader2, RefreshCw,
} from 'lucide-react'
import { cn } from '@/lib/utils'

/* ── Types mirroring GET /api/dashboard response ─────── */

interface DashboardProfile {
  fullName: string
  jobTitle: string | null
  status: string
  organisationName: string
}

interface ProjectSummary {
  id: string
  name: string
  code: string
  stage: string
  healthStatus: string
  myTaskCount: number
  overdueTaskCount: number
  inReviewTaskCount: number
}

interface UrgentTask {
  id: string
  title: string
  projectId: string
  projectName: string
  projectCode: string
  status: string
  priority: string
  dueDate: string | null
  estimatedHours: number | null
}

interface DashboardStats {
  totalTasks: number
  overdueTasks: number
  inReviewTasks: number
  completedThisWeek: number
}

interface DashboardData {
  profile: DashboardProfile
  projects: ProjectSummary[]
  urgentTasks: UrgentTask[]
  stats: DashboardStats
}

/* ── Helpers ─────────────────────────────────────────── */

function getGreeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

function getFirstName(fullName: string): string {
  return fullName.split(' ')[0]
}

function formatDueDate(iso: string | null): string {
  if (!iso) return 'No due date'
  const d = new Date(iso)
  const now = new Date()
  const diffMs = d.getTime() - now.getTime()
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays < 0) return `${Math.abs(diffDays)}d overdue`
  if (diffDays === 0) return 'Due today'
  if (diffDays === 1) return 'Due tomorrow'
  return `Due in ${diffDays}d`
}

function isDueDateOverdue(iso: string | null): boolean {
  if (!iso) return false
  return new Date(iso) < new Date()
}

const STATUS_LABELS: Record<string, string> = {
  NOT_STARTED: 'Not started',
  IN_PROGRESS: 'In progress',
  READY_FOR_REVIEW: 'In review',
  COMPLETED: 'Completed',
  BLOCKED: 'Blocked',
  CHANGES_REQUIRED: 'Changes required',
}

const STATUS_COLORS: Record<string, string> = {
  NOT_STARTED: 'bg-ink-100 text-ink-600',
  IN_PROGRESS: 'bg-blue-50 text-blue-600',
  READY_FOR_REVIEW: 'bg-amber-50 text-amber-600',
  COMPLETED: 'bg-emerald-50 text-emerald-600',
  BLOCKED: 'bg-red-50 text-red-600',
  CHANGES_REQUIRED: 'bg-orange-50 text-orange-600',
}

const PRIORITY_COLORS: Record<string, string> = {
  LOW: 'text-ink-400',
  MEDIUM: 'text-ink-600',
  HIGH: 'text-amber-600',
  CRITICAL: 'text-red-600',
}

const HEALTH_COLORS: Record<string, string> = {
  ON_TRACK: 'bg-emerald-400',
  AT_RISK: 'bg-amber-400',
  OFF_TRACK: 'bg-red-400',
}

/* ── StatCard ────────────────────────────────────────── */

function StatCard({ label, value, icon: Icon, accent }: {
  label: string
  value: number
  icon: React.FC<{ className?: string }>
  accent: string
}) {
  return (
    <div className="bg-white rounded-xl border border-ink-100 p-5 flex items-start gap-4">
      <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center shrink-0', accent)}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-[28px] font-semibold text-ink-900 leading-tight">{value}</p>
        <p className="text-[12px] text-ink-400 mt-0.5">{label}</p>
      </div>
    </div>
  )
}

/* ── Page ────────────────────────────────────────────── */

export default function MyWorkPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function fetchDashboard() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/dashboard')
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error?.message || `Failed to load (${res.status})`)
      }
      const json = await res.json()
      setData(json.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDashboard()
  }, [])

  /* ── Loading state ──────────────────────────────────── */

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <Loader2 className="w-8 h-8 text-accent-500 animate-spin" />
        <p className="text-[13px] text-ink-400">Loading your dashboard...</p>
      </div>
    )
  }

  /* ── Error state ────────────────────────────────────── */

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center">
          <AlertTriangle className="w-7 h-7 text-red-500" />
        </div>
        <div className="text-center">
          <p className="text-[15px] font-medium text-ink-900">Unable to load dashboard</p>
          <p className="text-[13px] text-ink-400 mt-1 max-w-sm">{error || 'No data returned.'}</p>
        </div>
        <button
          onClick={fetchDashboard}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-ink-900 text-white text-[13px] font-medium hover:bg-ink-800 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Try again
        </button>
      </div>
    )
  }

  /* ── Data loaded ────────────────────────────────────── */

  const { profile, projects, urgentTasks, stats } = data
  const greeting = getGreeting()
  const firstName = getFirstName(profile.fullName)

  return (
    <div className="space-y-8">
      {/* ── Header ─────────────────────────────────────── */}
      <div>
        <h1 className="text-[24px] font-semibold text-ink-900">
          {greeting}, {firstName}
        </h1>
        <p className="text-[13px] text-ink-400 mt-1">
          {profile.jobTitle ? `${profile.jobTitle} · ` : ''}{profile.organisationName}
        </p>
      </div>

      {/* ── Stats row ──────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Active tasks"
          value={stats.totalTasks}
          icon={Clock}
          accent="bg-blue-50 text-blue-600"
        />
        <StatCard
          label="Overdue"
          value={stats.overdueTasks}
          icon={AlertTriangle}
          accent={stats.overdueTasks > 0 ? 'bg-red-50 text-red-600' : 'bg-ink-50 text-ink-400'}
        />
        <StatCard
          label="Awaiting review"
          value={stats.inReviewTasks}
          icon={Eye}
          accent="bg-amber-50 text-amber-600"
        />
        <StatCard
          label="Completed this week"
          value={stats.completedThisWeek}
          icon={CheckCircle2}
          accent="bg-emerald-50 text-emerald-600"
        />
      </div>

      {/* ── Urgent tasks ───────────────────────────────── */}
      <section>
        <h2 className="text-[15px] font-semibold text-ink-900 mb-3">
          Needs attention
          {urgentTasks.length > 0 && (
            <span className="ml-2 text-[12px] font-medium text-ink-400">
              {urgentTasks.length} {urgentTasks.length === 1 ? 'task' : 'tasks'}
            </span>
          )}
        </h2>

        {urgentTasks.length === 0 ? (
          <div className="bg-white rounded-xl border border-ink-100 p-8 text-center">
            <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-3" />
            <p className="text-[14px] font-medium text-ink-700">All clear</p>
            <p className="text-[12px] text-ink-400 mt-1">No urgent or overdue tasks right now.</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-ink-100 divide-y divide-ink-50">
            {urgentTasks.map((task) => (
              <Link key={task.id} href={`/tasks/${task.id}`} className="flex items-center gap-4 px-5 py-3.5 group hover:bg-surface-50 transition-colors">
                {/* Priority dot */}
                <span className={cn(
                  'w-2 h-2 rounded-full shrink-0',
                  task.priority === 'CRITICAL' && 'bg-red-500',
                  task.priority === 'HIGH' && 'bg-amber-500',
                  task.priority === 'MEDIUM' && 'bg-blue-400',
                  task.priority === 'LOW' && 'bg-ink-300',
                )} />

                {/* Task info */}
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium text-ink-900 truncate">{task.title}</p>
                  <p className="text-[11px] text-ink-400 mt-0.5">
                    {task.projectCode} · {task.projectName}
                  </p>
                </div>

                {/* Status pill */}
                <span className={cn(
                  'text-[11px] font-medium px-2.5 py-0.5 rounded-full shrink-0',
                  STATUS_COLORS[task.status] || 'bg-ink-100 text-ink-600',
                )}>
                  {STATUS_LABELS[task.status] || task.status}
                </span>

                {/* Due date */}
                <span className={cn(
                  'text-[11px] shrink-0 w-24 text-right',
                  isDueDateOverdue(task.dueDate) ? 'text-red-600 font-medium' : 'text-ink-400',
                )}>
                  {formatDueDate(task.dueDate)}
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* ── My projects ────────────────────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[15px] font-semibold text-ink-900">
            My projects
            <span className="ml-2 text-[12px] font-medium text-ink-400">
              {projects.length}
            </span>
          </h2>
          <Link
            href="/projects"
            className="text-[12px] text-accent-600 hover:text-accent-700 font-medium flex items-center gap-1 transition-colors"
          >
            View all <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {projects.length === 0 ? (
          <div className="bg-white rounded-xl border border-ink-100 p-8 text-center">
            <FolderOpen className="w-10 h-10 text-ink-300 mx-auto mb-3" />
            <p className="text-[14px] font-medium text-ink-700">No projects yet</p>
            <p className="text-[12px] text-ink-400 mt-1">You&apos;ll see your projects here once you&apos;re assigned to one.</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((project) => (
              <Link
                key={project.id}
                href={`/projects/${project.id}`}
                className="bg-white rounded-xl border border-ink-100 p-5 hover:shadow-md hover:-translate-y-0.5 transition-all group"
              >
                {/* Header row */}
                <div className="flex items-start justify-between mb-3">
                  <div className="min-w-0">
                    <p className="text-[14px] font-semibold text-ink-900 truncate group-hover:text-accent-700 transition-colors">
                      {project.name}
                    </p>
                    <p className="text-[11px] text-ink-400 mt-0.5">{project.code}</p>
                  </div>
                  {/* Health dot */}
                  <span className={cn(
                    'w-2.5 h-2.5 rounded-full shrink-0 mt-1',
                    HEALTH_COLORS[project.healthStatus] || 'bg-ink-200',
                  )} />
                </div>

                {/* Stage */}
                <p className="text-[11px] text-ink-400 mb-4">
                  Stage: <span className="text-ink-600 font-medium">{project.stage.replace(/_/g, ' ')}</span>
                </p>

                {/* Task counts */}
                <div className="flex items-center gap-4 text-[11px]">
                  <span className="text-ink-500">
                    <span className="font-semibold text-ink-700">{project.myTaskCount}</span> tasks
                  </span>
                  {project.overdueTaskCount > 0 && (
                    <span className="text-red-600 font-medium">
                      {project.overdueTaskCount} overdue
                    </span>
                  )}
                  {project.inReviewTaskCount > 0 && (
                    <span className="text-amber-600 font-medium">
                      {project.inReviewTaskCount} to review
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

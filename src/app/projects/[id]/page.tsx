'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import {
  ListChecks, FileText, Users, Calendar, MapPin,
  AlertTriangle, RefreshCw, ArrowRight,
  CheckCircle2, Clock, Eye, PauseCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { SkeletonCard, SkeletonStats } from '@/components/Skeleton'
import { TaskStatusBadge } from '@/components/StatusFlow'

/* ── Types mirroring GET /api/projects/[id] ────────────── */

interface ProjectMember {
  assignedAt: string
  projectRole: string
  profile: {
    id: string
    fullName: string
    email: string
    avatarUrl: string | null
    orgPermission: string
  }
}

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
  memberships: ProjectMember[]
  taskSummary: Record<string, number>
}

/* ── Helpers ───────────────────────────────────────────── */

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

const HEALTH_META: Record<string, { label: string; color: string; bgColor: string; dotColor: string }> = {
  GREEN: { label: 'On track', color: 'text-emerald-700', bgColor: 'bg-emerald-50', dotColor: 'bg-emerald-500' },
  AMBER: { label: 'At risk', color: 'text-amber-700', bgColor: 'bg-amber-50', dotColor: 'bg-amber-500' },
  RED: { label: 'Off track', color: 'text-red-700', bgColor: 'bg-red-50', dotColor: 'bg-red-500' },
}

const STAGE_LABELS: Record<string, string> = {
  BRIEF: 'Brief',
  CONCEPT: 'Concept',
  SPATIAL_COORDINATION: 'Spatial Coordination',
  WORKING_DRAWINGS: 'Working Drawings',
  CONSTRUCTION: 'Construction',
  HANDOVER: 'Handover',
  OPERATIONS: 'Operations',
}

const ROLE_LABELS: Record<string, string> = {
  GRADUATE: 'Graduate',
  PROJECT_ARCHITECT: 'Architect',
  PROJECT_LEAD: 'Project Lead',
  SENIOR_ARCHITECT: 'Senior Architect',
}

/* ── Page ──────────────────────────────────────────────── */

export default function ProjectDashboard() {
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
        <SkeletonStats count={4} />
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
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

  /* ── Computed ─────────────────────────────────────────── */

  const health = HEALTH_META[project.healthStatus] ?? HEALTH_META.GREEN
  const totalTasks = Object.values(project.taskSummary).reduce((a, b) => a + b, 0)
  const completedTasks = project.taskSummary['COMPLETED'] || 0
  const inProgressTasks = project.taskSummary['IN_PROGRESS'] || 0
  const blockedTasks = project.taskSummary['BLOCKED'] || 0
  const reviewTasks = project.taskSummary['READY_FOR_REVIEW'] || 0

  return (
    <div className="space-y-6">
      {/* ── Project header ────────────────────────────── */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-[20px] font-semibold text-ink-900">{project.name}</h1>
            <span className={cn(
              'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium',
              health.bgColor, health.color,
            )}>
              <span className={cn('w-1.5 h-1.5 rounded-full', health.dotColor)} />
              {health.label}
            </span>
          </div>
          <div className="flex items-center gap-3 text-[12px] text-ink-400 flex-wrap">
            <span className="font-medium text-ink-600">{project.code}</span>
            <span>·</span>
            <span>{project.projectType.replace(/_/g, ' ')}</span>
            <span>·</span>
            <span>{STAGE_LABELS[project.stage] || project.stage}</span>
            {project.location && (
              <>
                <span>·</span>
                <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {project.location}</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── Task stat cards ───────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total tasks" value={totalTasks} icon={ListChecks} accent="bg-blue-50 text-blue-600" />
        <StatCard label="In progress" value={inProgressTasks} icon={Clock} accent="bg-blue-50 text-blue-600" />
        <StatCard label="In review" value={reviewTasks} icon={Eye} accent="bg-amber-50 text-amber-600" />
        <StatCard label="Completed" value={completedTasks} icon={CheckCircle2} accent="bg-emerald-50 text-emerald-600" />
      </div>

      {/* ── Blocked alert ─────────────────────────────── */}
      {blockedTasks > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-5 py-3.5 flex items-center gap-3">
          <PauseCircle className="w-5 h-5 text-red-500 shrink-0" />
          <p className="text-[13px] text-red-700">
            <span className="font-semibold">{blockedTasks} task{blockedTasks > 1 ? 's' : ''} blocked</span> — these need attention before work can continue.
          </p>
          <Link
            href={`/projects/${projectId}/tasks`}
            className="ml-auto text-[12px] text-red-600 font-medium hover:text-red-700 flex items-center gap-1 shrink-0"
          >
            View <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      )}

      {/* ── Main layout ───────────────────────────────── */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Description */}
          {project.description && (
            <div className="bg-white rounded-xl border border-ink-100 p-5">
              <h3 className="text-[13px] font-semibold text-ink-700 mb-2">About this project</h3>
              <p className="text-[13px] text-ink-600 whitespace-pre-wrap leading-relaxed">{project.description}</p>
            </div>
          )}

          {/* Task breakdown */}
          <div className="bg-white rounded-xl border border-ink-100">
            <div className="flex items-center justify-between px-5 py-4 border-b border-ink-50">
              <div className="flex items-center gap-2">
                <ListChecks className="w-4 h-4 text-ink-400" />
                <h3 className="text-[13px] font-semibold text-ink-700">Task breakdown</h3>
              </div>
              <Link
                href={`/projects/${projectId}/tasks`}
                className="text-[12px] text-accent-600 font-medium hover:text-accent-700 flex items-center gap-1"
              >
                View all tasks <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {totalTasks === 0 ? (
              <div className="px-5 py-8 text-center">
                <p className="text-[13px] text-ink-500">No tasks yet</p>
              </div>
            ) : (
              <div className="p-5">
                {/* Progress bar */}
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[12px] text-ink-500">Overall progress</span>
                    <span className="text-[12px] font-medium text-ink-700">
                      {totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0}%
                    </span>
                  </div>
                  <div className="w-full h-2 bg-ink-100 rounded-full overflow-hidden flex">
                    {completedTasks > 0 && (
                      <div className="h-full bg-emerald-500" style={{ width: `${(completedTasks / totalTasks) * 100}%` }} />
                    )}
                    {inProgressTasks > 0 && (
                      <div className="h-full bg-blue-400" style={{ width: `${(inProgressTasks / totalTasks) * 100}%` }} />
                    )}
                    {reviewTasks > 0 && (
                      <div className="h-full bg-amber-400" style={{ width: `${(reviewTasks / totalTasks) * 100}%` }} />
                    )}
                    {blockedTasks > 0 && (
                      <div className="h-full bg-red-400" style={{ width: `${(blockedTasks / totalTasks) * 100}%` }} />
                    )}
                  </div>
                </div>

                {/* Status breakdown rows */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {Object.entries(project.taskSummary)
                    .filter(([, count]) => count > 0)
                    .sort(([a], [b]) => {
                      const order: Record<string, number> = {
                        BLOCKED: 0, CHANGES_REQUIRED: 1, IN_PROGRESS: 2,
                        READY_FOR_REVIEW: 3, NOT_STARTED: 4, COMPLETED: 5,
                      }
                      return (order[a] ?? 99) - (order[b] ?? 99)
                    })
                    .map(([status, count]) => (
                      <div key={status} className="flex items-center gap-2">
                        <TaskStatusBadge status={status} />
                        <span className="text-[13px] font-semibold text-ink-700">{count}</span>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>

          {/* Quick links */}
          <div className="grid sm:grid-cols-2 gap-4">
            <Link
              href={`/projects/${projectId}/tasks`}
              className="bg-white rounded-xl border border-ink-100 p-5 hover:shadow-md hover:-translate-y-0.5 transition-all group"
            >
              <ListChecks className="w-5 h-5 text-ink-400 mb-3 group-hover:text-accent-600 transition-colors" />
              <p className="text-[14px] font-semibold text-ink-900">Tasks</p>
              <p className="text-[12px] text-ink-400 mt-1">View and manage all project tasks</p>
            </Link>
            <Link
              href={`/projects/${projectId}/documents`}
              className="bg-white rounded-xl border border-ink-100 p-5 hover:shadow-md hover:-translate-y-0.5 transition-all group"
            >
              <FileText className="w-5 h-5 text-ink-400 mb-3 group-hover:text-accent-600 transition-colors" />
              <p className="text-[14px] font-semibold text-ink-900">Documents</p>
              <p className="text-[12px] text-ink-400 mt-1">Drawing register and revision control</p>
            </Link>
          </div>
        </div>

        {/* ── Right column — sidebar ───────────────────── */}
        <div className="space-y-4">
          {/* Project details */}
          <div className="bg-white rounded-xl border border-ink-100 p-5 space-y-4">
            <h3 className="text-[12px] font-semibold text-ink-400 uppercase tracking-wide">Details</h3>
            <div className="space-y-3 text-[12px]">
              {project.clientBrand && (
                <Row label="Client" value={project.clientBrand} />
              )}
              <Row label="Type" value={project.projectType.replace(/_/g, ' ')} />
              <Row label="Stage" value={STAGE_LABELS[project.stage] || project.stage} />
              <Row label="Currency" value={project.currency} />
              {project.office && (
                <Row label="Office" value={`${project.office.name}, ${project.office.city}`} />
              )}
              <Row label="Start" value={formatDate(project.startDate)} />
              <Row label="Target" value={formatDate(project.targetCompletion)} />
              {project.currentIssueRef && (
                <Row label="Issue" value={`${project.currentIssueRef} (${formatDate(project.currentIssueDate)})`} />
              )}
            </div>
          </div>

          {/* Team */}
          <div className="bg-white rounded-xl border border-ink-100 p-5">
            <div className="flex items-center gap-2 mb-4">
              <Users className="w-4 h-4 text-ink-400" />
              <h3 className="text-[12px] font-semibold text-ink-400 uppercase tracking-wide">
                Team
                <span className="ml-1.5 text-ink-400 font-normal lowercase">
                  ({project.memberships.length})
                </span>
              </h3>
            </div>
            <div className="space-y-3">
              {project.memberships.map((m) => (
                <div key={m.profile.id} className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-full bg-accent-100 flex items-center justify-center shrink-0">
                    <span className="text-[10px] font-semibold text-accent-700">
                      {m.profile.fullName.split(' ').map(n => n[0]).join('')}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[12px] font-medium text-ink-700 truncate">{m.profile.fullName}</p>
                    <p className="text-[10px] text-ink-400">{ROLE_LABELS[m.projectRole] || m.projectRole}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ── Helpers ───────────────────────────────────────────── */

function StatCard({ label, value, icon: Icon, accent }: {
  label: string; value: number; icon: React.FC<{ className?: string }>; accent: string
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

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-ink-400">{label}</span>
      <span className="text-ink-700 text-right">{value}</span>
    </div>
  )
}

'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import {
  ListChecks, FileText, Users, Calendar, MapPin,
  AlertTriangle, RefreshCw, ArrowRight,
  CheckCircle2, Clock, Eye, PauseCircle,
  Plus, X, Loader2, Building2, Shield,
  Milestone, MessageSquare, Target, CalendarDays,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { SkeletonCard, SkeletonStats } from '@/components/Skeleton'
import { TaskStatusBadge } from '@/components/StatusFlow'
import { useToast } from '@/components/Toast'
import { useApiMutation } from '@/hooks/use-api'

/* ── Types ────────────────────────────────────────────── */

interface ProjectMember {
  assignedAt: string
  projectRole: string
  profile: {
    id: string
    fullName: string
    email: string
    avatarUrl: string | null
    jobTitle: string | null
    orgPermission: string
  }
}

interface MilestoneItem {
  id: string
  title: string
  description: string | null
  category: string | null
  dueDate: string
  completedDate: string | null
  status: string
  stage: string | null
  sortOrder: number
}

interface ProjectUpdateItem {
  id: string
  authorId: string
  weekEnding: string
  progress: string | null
  issues: string | null
  decisions: string | null
  actions: string | null
  healthOverride: string | null
  healthReason: string | null
  createdAt: string
}

interface OverviewData {
  project: {
    id: string
    name: string
    code: string | null
    description: string | null
    projectType: string
    stage: string
    status: string
    healthStatus: string
    currency: string | null
    clientBrand: string | null
    location: string | null
    startDate: string | null
    targetCompletion: string | null
    currentIssueRef: string | null
    currentIssueDate: string | null
    siteAddress: string | null
    siteCity: string | null
    siteCountry: string | null
    siteRegion: string | null
    sitePostcode: string | null
    buildingType: string | null
    developmentType: string | null
    clientType: string | null
    operatorName: string | null
    operatorBrand: string | null
    workStageFramework: string | null
    budget: number | null
    grossFloorArea: number | null
    numberOfUnits: number | null
    targetKeys: number | null
    isBRPD: boolean
    isCDM: boolean
    complianceFrameworks: string | null
    contractValue: number | null
    feeValue: number | null
    jurisdiction: string | null
    feeBasis: string | null
    appointmentType: string | null
    office: { id: string; name: string; city: string } | null
    memberships: ProjectMember[]
  }
  team: { count: number; members: ProjectMember[] }
  milestones: {
    total: number
    active: number
    completed: number
    next: MilestoneItem | null
    items: MilestoneItem[]
  }
  recentUpdates: ProjectUpdateItem[]
  taskStats: {
    total: number
    completed: number
    overdue: number
    byStatus: Record<string, number>
  }
  documentStats: {
    total: number
    byType: Record<string, number>
  }
  metrics: {
    daysToTarget: number | null
    teamSize: number
    completionRate: number
  }
}

/* ── Helpers ──────────────────────────────────────────── */

function formatDate(iso: string | null | undefined): string {
  if (!iso) return 'Not provided'
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function formatCurrency(value: number | null | undefined, currency?: string | null): string {
  if (value === null || value === undefined) return 'Not provided'
  const sym = currency === 'NGN' ? '₦' : currency === 'GBP' ? '£' : currency === 'EUR' ? '€' : '$'
  return `${sym}${value.toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
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

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Active',
  PAUSED: 'Paused',
  COMPLETED: 'Completed',
  ARCHIVED: 'Archived',
}

const MILESTONE_STATUS_META: Record<string, { label: string; color: string; bgColor: string; dotColor: string }> = {
  UPCOMING: { label: 'Upcoming', color: 'text-ink-600', bgColor: 'bg-ink-50', dotColor: 'bg-ink-400' },
  DUE: { label: 'Due', color: 'text-amber-700', bgColor: 'bg-amber-50', dotColor: 'bg-amber-500' },
  OVERDUE: { label: 'Overdue', color: 'text-red-700', bgColor: 'bg-red-50', dotColor: 'bg-red-500' },
  COMPLETED: { label: 'Completed', color: 'text-emerald-700', bgColor: 'bg-emerald-50', dotColor: 'bg-emerald-500' },
  CANCELLED: { label: 'Cancelled', color: 'text-ink-400', bgColor: 'bg-ink-50', dotColor: 'bg-ink-300' },
}

const DEV_TYPE_LABELS: Record<string, string> = {
  NEW_BUILD: 'New Build',
  CONVERSION: 'Conversion',
  REFURBISHMENT: 'Refurbishment',
  EXTENSION: 'Extension',
  COMPLETION: 'Completion',
  FIT_OUT: 'Fit-Out',
  MIXED: 'Mixed',
}

const CLIENT_TYPE_LABELS: Record<string, string> = {
  PRIVATE: 'Private',
  DEVELOPER: 'Developer',
  CORPORATE: 'Corporate',
  HOTEL_OWNER: 'Hotel Owner',
  HOTEL_OPERATOR: 'Hotel Operator',
  GOVERNMENT: 'Government',
  INTERNAL: 'Internal',
}

const FRAMEWORK_LABELS: Record<string, string> = {
  RIBA: 'RIBA',
  NIGERIAN_CWA: 'Nigerian CWA',
  INTERNATIONAL: 'International',
  DESIGN_BUILD: 'Design & Build',
  CUSTOM: 'Custom',
}

/* ── Page ─────────────────────────────────────────────── */

export default function ProjectDashboard() {
  const params = useParams()
  const projectId = params.id as string
  const { toast } = useToast()

  const [data, setData] = useState<OverviewData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Modal state
  const [showMilestoneForm, setShowMilestoneForm] = useState(false)
  const [showUpdateForm, setShowUpdateForm] = useState(false)

  const fetchOverview = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/projects/${projectId}/overview`)
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
  }, [projectId])

  useEffect(() => {
    fetchOverview()
  }, [fetchOverview])

  /* ── Loading ────────────────────────────────────────── */

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

  /* ── Error ──────────────────────────────────────────── */

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh] gap-4">
        <AlertTriangle className="w-8 h-8 text-red-500" />
        <p className="text-[13px] text-ink-600">{error || 'Project not found'}</p>
        <button onClick={fetchOverview} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-ink-900 text-white text-[13px] font-medium hover:bg-ink-800 transition-colors">
          <RefreshCw className="w-4 h-4" /> Try again
        </button>
      </div>
    )
  }

  const { project, milestones, recentUpdates, taskStats, documentStats, metrics } = data

  /* ── Computed ────────────────────────────────────────── */

  const totalTasks = taskStats.total
  const completedTasks = taskStats.completed
  const inProgressTasks = taskStats.byStatus['IN_PROGRESS'] || 0
  const blockedTasks = taskStats.byStatus['BLOCKED'] || 0
  const reviewTasks = taskStats.byStatus['READY_FOR_REVIEW'] || 0
  const changesRequiredTasks = taskStats.byStatus['CHANGES_REQUIRED'] || 0

  const weightedProgress = totalTasks > 0
    ? Math.round(
        ((completedTasks * 100) + (inProgressTasks * 50) + (reviewTasks * 75) + (changesRequiredTasks * 25))
        / totalTasks
      )
    : 0

  const computedHealth = (() => {
    if (totalTasks === 0) return project.healthStatus || 'GREEN'
    const overdueRatio = blockedTasks / totalTasks
    if (overdueRatio > 0.2 || blockedTasks >= 3) return 'RED'
    if (blockedTasks > 0 || weightedProgress < 25) return 'AMBER'
    return project.healthStatus || 'GREEN'
  })()
  const health = HEALTH_META[computedHealth] ?? HEALTH_META.GREEN

  // Location string
  const locationParts = [project.siteCity, project.siteRegion, project.siteCountry].filter(Boolean)
  const locationStr = locationParts.length > 0 ? locationParts.join(', ') : project.location || 'Not provided'

  // Compliance badges
  const complianceBadges: string[] = []
  if (project.isBRPD) complianceBadges.push('BRPD')
  if (project.isCDM) complianceBadges.push('CDM')
  if (project.complianceFrameworks) {
    project.complianceFrameworks.split(',').forEach(f => {
      const trimmed = f.trim()
      if (trimmed && !complianceBadges.includes(trimmed)) complianceBadges.push(trimmed)
    })
  }

  return (
    <div className="space-y-6">
      {/* ── Project header ──────────────────────────────── */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1 flex-wrap">
            <h1 className="text-[20px] font-semibold text-ink-900">{project.name}</h1>
            <span className={cn(
              'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium',
              health.bgColor, health.color,
            )}>
              <span className={cn('w-1.5 h-1.5 rounded-full', health.dotColor)} />
              {health.label}
            </span>
            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold bg-ink-100 text-ink-600 uppercase tracking-wide">
              {STATUS_LABELS[project.status] || project.status}
            </span>
          </div>
          <div className="flex items-center gap-3 text-[12px] text-ink-400 flex-wrap">
            {project.code && <span className="font-medium text-ink-600">{project.code}</span>}
            {project.code && <span>·</span>}
            <span>{project.projectType.replace(/_/g, ' ')}</span>
            <span>·</span>
            <span>{STAGE_LABELS[project.stage] || project.stage}</span>
            <span>·</span>
            <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {locationStr}</span>
          </div>
        </div>
      </div>

      {/* ── Project Summary Card ────────────────────────── */}
      <div className="bg-white rounded-xl border border-ink-100 p-5">
        <div className="flex items-center gap-2 mb-4">
          <Building2 className="w-4 h-4 text-ink-400" />
          <h3 className="text-[13px] font-semibold text-ink-700">Project Summary</h3>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-3 text-[12px]">
          <Row label="Client" value={project.clientBrand || 'Not provided'} />
          <Row label="Client type" value={CLIENT_TYPE_LABELS[project.clientType || ''] || project.clientType || 'Not provided'} />
          <Row label="Development type" value={DEV_TYPE_LABELS[project.developmentType || ''] || project.developmentType || 'Not provided'} />
          <Row label="Sector" value={project.projectType.replace(/_/g, ' ')} />
          <Row label="Work stage" value={FRAMEWORK_LABELS[project.workStageFramework || ''] || project.workStageFramework || 'Not provided'} />
          <Row label="Jurisdiction" value={project.jurisdiction || 'Not provided'} />
          <Row label="Location" value={locationStr} />
          {project.sitePostcode && <Row label="Postcode" value={project.sitePostcode} />}
          <Row label="Start date" value={formatDate(project.startDate)} />
          <Row label="Target completion" value={formatDate(project.targetCompletion)} />
          <Row label="Budget" value={formatCurrency(project.budget, project.currency)} />
          <Row label="Contract value" value={formatCurrency(project.contractValue, project.currency)} />
          {project.operatorName && <Row label="Operator" value={`${project.operatorName}${project.operatorBrand ? ` (${project.operatorBrand})` : ''}`} />}
          {project.grossFloorArea !== null && project.grossFloorArea !== undefined && (
            <Row label="GFA" value={`${project.grossFloorArea.toLocaleString()} m²`} />
          )}
          {project.numberOfUnits !== null && project.numberOfUnits !== undefined && (
            <Row label="Units" value={String(project.numberOfUnits)} />
          )}
          {project.targetKeys !== null && project.targetKeys !== undefined && (
            <Row label="Target keys" value={String(project.targetKeys)} />
          )}
        </div>

        {/* Compliance badges */}
        {complianceBadges.length > 0 && (
          <div className="mt-4 pt-3 border-t border-ink-50">
            <div className="flex items-center gap-2 mb-2">
              <Shield className="w-3.5 h-3.5 text-ink-400" />
              <span className="text-[11px] font-medium text-ink-500">Compliance</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {complianceBadges.map(badge => (
                <span key={badge} className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-blue-50 text-blue-700 uppercase tracking-wide">
                  {badge.replace(/_/g, ' ')}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Quick Stats Row ─────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard label="Total tasks" value={totalTasks} icon={ListChecks} accent="bg-blue-50 text-blue-600" href={`/projects/${projectId}/tasks`} />
        <StatCard label="Completed" value={completedTasks} icon={CheckCircle2} accent="bg-emerald-50 text-emerald-600" href={`/projects/${projectId}/tasks?status=COMPLETED`} />
        <StatCard label="Overdue" value={taskStats.overdue} icon={AlertTriangle} accent="bg-red-50 text-red-600" href={`/projects/${projectId}/tasks?status=OVERDUE`} />
        <StatCard label="Documents" value={documentStats.total} icon={FileText} accent="bg-purple-50 text-purple-600" href={`/projects/${projectId}/documents`} />
        <StatCard
          label={metrics.daysToTarget !== null ? (metrics.daysToTarget >= 0 ? 'Days to target' : 'Days overdue') : 'Days to target'}
          value={metrics.daysToTarget !== null ? Math.abs(metrics.daysToTarget) : 0}
          icon={CalendarDays}
          accent={metrics.daysToTarget !== null && metrics.daysToTarget < 0 ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'}
          suffix={metrics.daysToTarget === null ? 'N/A' : undefined}
        />
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

      {/* ── Main layout ──────────────────────────────── */}
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

          {/* ── Milestones Section ──────────────────────── */}
          <div className="bg-white rounded-xl border border-ink-100">
            <div className="flex items-center justify-between px-5 py-4 border-b border-ink-50">
              <div className="flex items-center gap-2">
                <Milestone className="w-4 h-4 text-ink-400" />
                <h3 className="text-[13px] font-semibold text-ink-700">
                  Milestones
                  <span className="ml-1.5 text-ink-400 font-normal text-[12px]">
                    ({milestones.active} active)
                  </span>
                </h3>
              </div>
              <button
                onClick={() => setShowMilestoneForm(true)}
                className="flex items-center gap-1 text-[12px] text-accent-600 font-medium hover:text-accent-700"
              >
                <Plus className="w-3.5 h-3.5" /> Add
              </button>
            </div>

            {milestones.items.length === 0 ? (
              <div className="px-5 py-8 text-center">
                <Target className="w-6 h-6 text-ink-300 mx-auto mb-2" />
                <p className="text-[13px] text-ink-500">No milestones yet</p>
                <p className="text-[11px] text-ink-400 mt-1">Add milestones to track key project dates</p>
              </div>
            ) : (
              <div className="divide-y divide-ink-50">
                {milestones.items.map(ms => {
                  const meta = MILESTONE_STATUS_META[ms.status] || MILESTONE_STATUS_META.UPCOMING
                  const isNext = milestones.next?.id === ms.id
                  return (
                    <div
                      key={ms.id}
                      className={cn(
                        'px-5 py-3.5 flex items-center gap-3',
                        isNext && 'bg-accent-50/50',
                      )}
                    >
                      <span className={cn('w-2 h-2 rounded-full shrink-0', meta.dotColor)} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-[13px] font-medium text-ink-800 truncate">{ms.title}</p>
                          {isNext && (
                            <span className="text-[9px] font-semibold text-accent-600 bg-accent-100 px-1.5 py-0.5 rounded uppercase tracking-wide shrink-0">
                              Next
                            </span>
                          )}
                        </div>
                        {ms.description && (
                          <p className="text-[11px] text-ink-400 truncate mt-0.5">{ms.description}</p>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <span className={cn(
                          'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium',
                          meta.bgColor, meta.color,
                        )}>
                          {meta.label}
                        </span>
                        <p className="text-[10px] text-ink-400 mt-0.5">
                          {ms.status === 'COMPLETED' ? formatDate(ms.completedDate) : formatDate(ms.dueDate)}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* ── Task breakdown ──────────────────────────── */}
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
                    <span className="text-[12px] font-medium text-ink-700">{weightedProgress}%</span>
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
                  {Object.entries(taskStats.byStatus)
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

          {/* ── Recent Updates Section ──────────────────── */}
          <div className="bg-white rounded-xl border border-ink-100">
            <div className="flex items-center justify-between px-5 py-4 border-b border-ink-50">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-ink-400" />
                <h3 className="text-[13px] font-semibold text-ink-700">
                  Recent Updates
                  <span className="ml-1.5 text-ink-400 font-normal text-[12px]">
                    ({recentUpdates.length})
                  </span>
                </h3>
              </div>
              <button
                onClick={() => setShowUpdateForm(true)}
                className="flex items-center gap-1 text-[12px] text-accent-600 font-medium hover:text-accent-700"
              >
                <Plus className="w-3.5 h-3.5" /> Post update
              </button>
            </div>

            {recentUpdates.length === 0 ? (
              <div className="px-5 py-8 text-center">
                <MessageSquare className="w-6 h-6 text-ink-300 mx-auto mb-2" />
                <p className="text-[13px] text-ink-500">No updates yet</p>
                <p className="text-[11px] text-ink-400 mt-1">Post project updates to keep the team informed</p>
              </div>
            ) : (
              <div className="divide-y divide-ink-50">
                {recentUpdates.map(upd => {
                  const healthMeta = upd.healthOverride ? HEALTH_META[upd.healthOverride] : null
                  return (
                    <div key={upd.id} className="px-5 py-4">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-[11px] text-ink-400">
                          Week ending {formatDate(upd.weekEnding)}
                        </span>
                        {healthMeta && (
                          <span className={cn(
                            'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium',
                            healthMeta.bgColor, healthMeta.color,
                          )}>
                            <span className={cn('w-1.5 h-1.5 rounded-full', healthMeta.dotColor)} />
                            {healthMeta.label}
                          </span>
                        )}
                        <span className="text-[10px] text-ink-300 ml-auto">{formatDate(upd.createdAt)}</span>
                      </div>
                      {upd.progress && (
                        <p className="text-[12px] text-ink-700 leading-relaxed whitespace-pre-wrap line-clamp-3">{upd.progress}</p>
                      )}
                      {upd.issues && (
                        <p className="text-[11px] text-red-600 mt-1.5">
                          <span className="font-medium">Issues:</span> {upd.issues}
                        </p>
                      )}
                    </div>
                  )
                })}
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

        {/* ── Right column — sidebar ──────────────────── */}
        <div className="space-y-4">
          {/* Project details */}
          <div className="bg-white rounded-xl border border-ink-100 p-5 space-y-4">
            <h3 className="text-[12px] font-semibold text-ink-400 uppercase tracking-wide">Details</h3>
            <div className="space-y-3 text-[12px]">
              <Row label="Client" value={project.clientBrand || 'Not provided'} />
              <Row label="Type" value={project.projectType.replace(/_/g, ' ')} />
              <Row label="Stage" value={STAGE_LABELS[project.stage] || project.stage} />
              <Row label="Currency" value={project.currency || 'Not provided'} />
              {project.office && (
                <Row label="Office" value={`${project.office.name}, ${project.office.city}`} />
              )}
              <Row label="Start" value={formatDate(project.startDate)} />
              <Row label="Target" value={formatDate(project.targetCompletion)} />
              {project.feeBasis && <Row label="Fee basis" value={project.feeBasis.replace(/_/g, ' ')} />}
              {project.appointmentType && <Row label="Appointment" value={project.appointmentType.replace(/_/g, ' ')} />}
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
                  ({data.team.count})
                </span>
              </h3>
            </div>
            <div className="space-y-3">
              {data.team.members.map((m) => (
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

          {/* Key metrics */}
          <div className="bg-white rounded-xl border border-ink-100 p-5 space-y-3">
            <h3 className="text-[12px] font-semibold text-ink-400 uppercase tracking-wide">Key Metrics</h3>
            <div className="space-y-2 text-[12px]">
              <Row label="Team size" value={String(metrics.teamSize)} />
              <Row label="Completion rate" value={`${metrics.completionRate}%`} />
              <Row label="Tasks overdue" value={String(taskStats.overdue)} />
              <Row label="Active milestones" value={String(milestones.active)} />
              <Row
                label="Days to target"
                value={metrics.daysToTarget !== null ? String(metrics.daysToTarget) : 'Not provided'}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── Add Milestone Modal ─────────────────────── */}
      {showMilestoneForm && (
        <MilestoneFormModal
          projectId={projectId}
          onClose={() => setShowMilestoneForm(false)}
          onSuccess={() => {
            setShowMilestoneForm(false)
            toast('Milestone added', 'success')
            fetchOverview()
          }}
        />
      )}

      {/* ── Post Update Modal ───────────────────────── */}
      {showUpdateForm && (
        <UpdateFormModal
          projectId={projectId}
          onClose={() => setShowUpdateForm(false)}
          onSuccess={() => {
            setShowUpdateForm(false)
            toast('Update posted', 'success')
            fetchOverview()
          }}
        />
      )}
    </div>
  )
}

/* ── Sub-components ───────────────────────────────────── */

function StatCard({ label, value, icon: Icon, accent, suffix, href }: {
  label: string
  value: number
  icon: React.FC<{ className?: string }>
  accent: string
  suffix?: string
  href?: string
}) {
  const content = (
    <div className={cn(
      'bg-white rounded-xl border border-ink-100 p-5 flex items-start gap-4',
      href && 'cursor-pointer hover:border-ink-300 hover:shadow-sm transition-all'
    )}>
      <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center shrink-0', accent)}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-[28px] font-semibold text-ink-900 leading-tight">
          {suffix || value}
        </p>
        <p className="text-[12px] text-ink-400 mt-0.5">{label}</p>
      </div>
    </div>
  )
  if (href) {
    return <Link href={href}>{content}</Link>
  }
  return content
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-ink-400">{label}</span>
      <span className="text-ink-700 text-right">{value}</span>
    </div>
  )
}

/* ── Milestone Form Modal ─────────────────────────────── */

function MilestoneFormModal({ projectId, onClose, onSuccess }: {
  projectId: string
  onClose: () => void
  onSuccess: () => void
}) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [category, setCategory] = useState('')
  const { mutate, loading } = useApiMutation(`/api/projects/${projectId}/milestones`, 'POST')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const result = await mutate({
      title,
      description: description || undefined,
      dueDate,
      category: category || undefined,
    })
    if (result) onSuccess()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-ink-100">
          <h3 className="text-[14px] font-semibold text-ink-900">Add Milestone</h3>
          <button onClick={onClose} className="text-ink-400 hover:text-ink-600"><X className="w-4 h-4" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-[12px] font-medium text-ink-600 mb-1">Title *</label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              required
              className="w-full px-3 py-2 border border-ink-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-accent-500/20 focus:border-accent-500"
              placeholder="e.g. Design freeze"
            />
          </div>
          <div>
            <label className="block text-[12px] font-medium text-ink-600 mb-1">Due date *</label>
            <input
              type="date"
              value={dueDate}
              onChange={e => setDueDate(e.target.value)}
              required
              className="w-full px-3 py-2 border border-ink-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-accent-500/20 focus:border-accent-500"
            />
          </div>
          <div>
            <label className="block text-[12px] font-medium text-ink-600 mb-1">Category</label>
            <select
              value={category}
              onChange={e => setCategory(e.target.value)}
              className="w-full px-3 py-2 border border-ink-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-accent-500/20 focus:border-accent-500"
            >
              <option value="">Select category</option>
              <option value="DESIGN_FREEZE">Design Freeze</option>
              <option value="PLANNING">Planning</option>
              <option value="CONSTRUCTION">Construction</option>
              <option value="OPERATOR_REVIEW">Operator Review</option>
              <option value="STAGE_GATE">Stage Gate</option>
              <option value="HANDOVER">Handover</option>
              <option value="CUSTOM">Custom</option>
            </select>
          </div>
          <div>
            <label className="block text-[12px] font-medium text-ink-600 mb-1">Notes</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-ink-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-accent-500/20 focus:border-accent-500 resize-none"
              placeholder="Optional notes about this milestone"
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-[13px] font-medium text-ink-600 hover:text-ink-800">
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !title || !dueDate}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-ink-900 text-white text-[13px] font-medium hover:bg-ink-800 disabled:opacity-50 transition-colors"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              Add milestone
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

/* ── Update Form Modal ────────────────────────────────── */

function UpdateFormModal({ projectId, onClose, onSuccess }: {
  projectId: string
  onClose: () => void
  onSuccess: () => void
}) {
  const [progress, setProgress] = useState('')
  const [issues, setIssues] = useState('')
  const [decisions, setDecisions] = useState('')
  const [actions, setActions] = useState('')
  const [healthOverride, setHealthOverride] = useState('')
  const [healthReason, setHealthReason] = useState('')
  const { mutate, loading } = useApiMutation(`/api/projects/${projectId}/updates`, 'POST')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const result = await mutate({
      progress,
      issues: issues || undefined,
      decisions: decisions || undefined,
      actions: actions || undefined,
      healthOverride: healthOverride || undefined,
      healthReason: healthReason || undefined,
    })
    if (result) onSuccess()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-ink-100">
          <h3 className="text-[14px] font-semibold text-ink-900">Post Project Update</h3>
          <button onClick={onClose} className="text-ink-400 hover:text-ink-600"><X className="w-4 h-4" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-[12px] font-medium text-ink-600 mb-1">Progress *</label>
            <textarea
              value={progress}
              onChange={e => setProgress(e.target.value)}
              required
              rows={3}
              className="w-full px-3 py-2 border border-ink-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-accent-500/20 focus:border-accent-500 resize-none"
              placeholder="What was done this week?"
            />
          </div>
          <div>
            <label className="block text-[12px] font-medium text-ink-600 mb-1">Issues / Blockers</label>
            <textarea
              value={issues}
              onChange={e => setIssues(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border border-ink-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-accent-500/20 focus:border-accent-500 resize-none"
              placeholder="Current blockers or concerns"
            />
          </div>
          <div>
            <label className="block text-[12px] font-medium text-ink-600 mb-1">Decisions</label>
            <textarea
              value={decisions}
              onChange={e => setDecisions(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border border-ink-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-accent-500/20 focus:border-accent-500 resize-none"
              placeholder="Decisions made or needed"
            />
          </div>
          <div>
            <label className="block text-[12px] font-medium text-ink-600 mb-1">Actions</label>
            <textarea
              value={actions}
              onChange={e => setActions(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border border-ink-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-accent-500/20 focus:border-accent-500 resize-none"
              placeholder="Actions assigned"
            />
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[12px] font-medium text-ink-600 mb-1">Health override</label>
              <select
                value={healthOverride}
                onChange={e => setHealthOverride(e.target.value)}
                className="w-full px-3 py-2 border border-ink-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-accent-500/20 focus:border-accent-500"
              >
                <option value="">No override</option>
                <option value="GREEN">Green - On track</option>
                <option value="AMBER">Amber - At risk</option>
                <option value="RED">Red - Off track</option>
              </select>
            </div>
            {healthOverride && (
              <div>
                <label className="block text-[12px] font-medium text-ink-600 mb-1">Reason</label>
                <input
                  type="text"
                  value={healthReason}
                  onChange={e => setHealthReason(e.target.value)}
                  className="w-full px-3 py-2 border border-ink-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-accent-500/20 focus:border-accent-500"
                  placeholder="Reason for health override"
                />
              </div>
            )}
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-[13px] font-medium text-ink-600 hover:text-ink-800">
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !progress}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-ink-900 text-white text-[13px] font-medium hover:bg-ink-800 disabled:opacity-50 transition-colors"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              Post update
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

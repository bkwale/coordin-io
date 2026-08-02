'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import {
  BarChart3, Loader2, AlertTriangle, RefreshCw,
  TrendingUp, TrendingDown, ChevronRight, Filter,
  Activity, CheckCircle2, Clock, Eye,
  ShieldCheck, Landmark, HardHat, Users,
  ArrowUpRight, X, Layers, Info,
} from 'lucide-react'
import { cn } from '@/lib/utils'

/* ── Types ─────────────────────────────────────────────── */

interface ComponentScores {
  programme: number | null
  tasks: number | null
  design: number | null
  planning: number | null
  compliance: number | null
  commercial: number | null
  quality: number | null
  staffing: number | null
  overall: number | null
}

interface ComponentRAG {
  programme: string | null
  tasks: string | null
  design: string | null
  planning: string | null
  compliance: string | null
  commercial: string | null
  quality: string | null
  staffing: string | null
  overall: string | null
}

interface ProjectStats {
  totalTasks: number
  completedTasks: number
  overdueTasks: number
  openSnags: number
  openObservations: number
  teamSize: number
}

interface ProjectHealth {
  id: string
  name: string
  code: string | null
  stage: string
  status: string
  projectType: string
  healthStatus: string
  officeId: string | null
  officeName: string | null
  startDate: string | null
  targetCompletion: string | null
  scores: ComponentScores
  rag: ComponentRAG
  stats: ProjectStats
}

interface PortfolioSummary {
  totalProjects: number
  projectsAtRisk: number
  avgHealthScore: number | null
  totalOverdueTasks: number
  totalOpenSnags: number
  ragDistribution: { GREEN: number; AMBER: number; RED: number; UNSCORED: number }
  componentAverages: Record<string, number | null>
}

interface FilterOptions {
  offices: Array<{ id: string; name: string }>
  stages: string[]
  statuses: string[]
  healthStatuses: string[]
  sectors: string[]
}

interface PortfolioData {
  summary: PortfolioSummary
  projects: ProjectHealth[]
  filterOptions: FilterOptions
}

/* ── Helpers ───────────────────────────────────────────── */

function scoreColor(score: number | null): string {
  if (score === null) return 'text-ink-400'
  if (score >= 70) return 'text-emerald-600'
  if (score >= 45) return 'text-amber-600'
  return 'text-red-600'
}

function scoreBg(score: number | null): string {
  if (score === null) return 'bg-surface-100'
  if (score >= 70) return 'bg-emerald-50'
  if (score >= 45) return 'bg-amber-50'
  return 'bg-red-50'
}

function ragDot(rag: string | null): string {
  if (rag === 'GREEN') return 'bg-emerald-500'
  if (rag === 'AMBER') return 'bg-amber-500'
  if (rag === 'RED') return 'bg-red-500'
  return 'bg-ink-200'
}

function ragBadge(rag: string | null): string {
  if (rag === 'GREEN') return 'bg-emerald-50 text-emerald-700'
  if (rag === 'AMBER') return 'bg-amber-50 text-amber-700'
  if (rag === 'RED') return 'bg-red-50 text-red-700'
  return 'bg-surface-100 text-ink-400'
}

function ragLabel(rag: string | null): string {
  if (rag === 'GREEN') return 'On Track'
  if (rag === 'AMBER') return 'At Risk'
  if (rag === 'RED') return 'Critical'
  return 'No Data'
}

function stageLabel(stage: string): string {
  const labels: Record<string, string> = {
    BRIEF: 'Brief',
    CONCEPT: 'Concept',
    SPATIAL_COORDINATION: 'Spatial Coord.',
    WORKING_DRAWINGS: 'Working Drawings',
    CONSTRUCTION: 'Construction',
    HANDOVER: 'Handover',
    OPERATIONS: 'Operations',
  }
  return labels[stage] || stage
}

function sectorLabel(sector: string): string {
  const labels: Record<string, string> = {
    HOTEL: 'Hotel',
    RESIDENTIAL: 'Residential',
    MIXED_USE: 'Mixed Use',
    RESORT: 'Resort',
    REFURBISHMENT: 'Refurb',
    OFFICE_FIT_OUT: 'Office Fit-Out',
  }
  return labels[sector] || sector
}

const COMPONENT_META: Array<{
  key: keyof ComponentScores
  label: string
  icon: React.FC<{ className?: string }>
}> = [
  { key: 'programme', label: 'Programme', icon: Clock },
  { key: 'tasks', label: 'Tasks', icon: CheckCircle2 },
  { key: 'design', label: 'Design', icon: Eye },
  { key: 'planning', label: 'Planning', icon: Landmark },
  { key: 'compliance', label: 'Compliance', icon: ShieldCheck },
  { key: 'commercial', label: 'Commercial', icon: TrendingUp },
  { key: 'quality', label: 'Quality', icon: HardHat },
  { key: 'staffing', label: 'Staffing', icon: Users },
]

/* ── Component ─────────────────────────────────────────── */

export default function PortfolioAnalyticsPage() {
  const [data, setData] = useState<PortfolioData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filters
  const [stageFilter, setStageFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('ACTIVE')
  const [officeFilter, setOfficeFilter] = useState('')
  const [healthFilter, setHealthFilter] = useState('')
  const [sectorFilter, setSectorFilter] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [sortBy, setSortBy] = useState<'name' | 'score' | 'overdue'>('score')

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (stageFilter) params.set('stage', stageFilter)
      if (statusFilter) params.set('status', statusFilter)
      if (officeFilter) params.set('office', officeFilter)
      if (healthFilter) params.set('health', healthFilter)
      if (sectorFilter) params.set('sector', sectorFilter)

      const res = await fetch(`/api/analytics/portfolio?${params}`)
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error?.message || `Request failed (${res.status})`)
      }
      const json = await res.json()
      setData(json.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load portfolio data')
    } finally {
      setLoading(false)
    }
  }, [stageFilter, statusFilter, officeFilter, healthFilter, sectorFilter])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // ── Sort projects ──────────────────────────────────────
  const sortedProjects = data?.projects ? [...data.projects].sort((a, b) => {
    if (sortBy === 'score') {
      const aScore = a.scores.overall ?? -1
      const bScore = b.scores.overall ?? -1
      return aScore - bScore // Worst first
    }
    if (sortBy === 'overdue') {
      return b.stats.overdueTasks - a.stats.overdueTasks
    }
    return a.name.localeCompare(b.name)
  }) : []

  const activeFilterCount = [stageFilter, officeFilter, healthFilter, sectorFilter]
    .filter(Boolean).length + (statusFilter !== 'ACTIVE' ? 1 : 0)

  // ── Loading ────────────────────────────────────────────
  if (loading && !data) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-[22px] font-semibold text-ink-900">Portfolio Overview</h1>
          <p className="text-[13px] text-ink-400 mt-1">Practice-wide project health and risk dashboard</p>
        </div>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 text-accent-500 animate-spin" />
          <span className="ml-3 text-[13px] text-ink-400">Analysing portfolio health...</span>
        </div>
      </div>
    )
  }

  // ── Error ──────────────────────────────────────────────
  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-[22px] font-semibold text-ink-900">Portfolio Overview</h1>
          <p className="text-[13px] text-ink-400 mt-1">Practice-wide project health and risk dashboard</p>
        </div>
        <div className="bg-white rounded-xl border border-red-200 p-8 text-center">
          <AlertTriangle className="w-8 h-8 text-red-400 mx-auto mb-3" />
          <p className="text-[13px] text-red-600 mb-4">{error}</p>
          <button onClick={fetchData} className="btn-secondary text-[12px] gap-1.5">
            <RefreshCw className="w-3.5 h-3.5" /> Retry
          </button>
        </div>
      </div>
    )
  }

  if (!data) return null
  const { summary } = data

  return (
    <div className="space-y-6">
      {/* ── Header ─────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-[22px] font-semibold text-ink-900">Portfolio Overview</h1>
          <p className="text-[13px] text-ink-400 mt-1">
            Practice-wide project health and risk dashboard
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-colors border',
              showFilters
                ? 'bg-accent-50 text-accent-600 border-accent-200'
                : 'bg-white text-ink-500 border-surface-200 hover:bg-surface-50'
            )}
          >
            <Filter className="w-3.5 h-3.5" />
            Filters
            {activeFilterCount > 0 && (
              <span className="ml-1 w-4 h-4 rounded-full bg-accent-500 text-white text-[9px] flex items-center justify-center font-bold">
                {activeFilterCount}
              </span>
            )}
          </button>
          <button
            onClick={fetchData}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium bg-white text-ink-500 border border-surface-200 hover:bg-surface-50 transition-colors"
          >
            <RefreshCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} />
            Refresh
          </button>
        </div>
      </div>

      {/* ── Filters ────────────────────────────────────── */}
      {showFilters && (
        <div className="card-static p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[11px] font-semibold text-ink-500 uppercase tracking-wider">Filter Portfolio</p>
            {activeFilterCount > 0 && (
              <button
                onClick={() => {
                  setStageFilter('')
                  setStatusFilter('ACTIVE')
                  setOfficeFilter('')
                  setHealthFilter('')
                  setSectorFilter('')
                }}
                className="text-[11px] text-accent-500 hover:text-accent-600 font-medium flex items-center gap-1"
              >
                <X className="w-3 h-3" /> Clear all
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div>
              <label className="text-[10px] font-medium text-ink-400 uppercase mb-1 block">Status</label>
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className="w-full text-[12px] rounded-lg border border-surface-200 bg-white px-2.5 py-1.5 text-ink-700"
              >
                <option value="">All Statuses</option>
                {data.filterOptions.statuses.map(s => (
                  <option key={s} value={s}>{s.charAt(0) + s.slice(1).toLowerCase()}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-medium text-ink-400 uppercase mb-1 block">Stage</label>
              <select
                value={stageFilter}
                onChange={e => setStageFilter(e.target.value)}
                className="w-full text-[12px] rounded-lg border border-surface-200 bg-white px-2.5 py-1.5 text-ink-700"
              >
                <option value="">All Stages</option>
                {data.filterOptions.stages.map(s => (
                  <option key={s} value={s}>{stageLabel(s)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-medium text-ink-400 uppercase mb-1 block">Office</label>
              <select
                value={officeFilter}
                onChange={e => setOfficeFilter(e.target.value)}
                className="w-full text-[12px] rounded-lg border border-surface-200 bg-white px-2.5 py-1.5 text-ink-700"
              >
                <option value="">All Offices</option>
                {data.filterOptions.offices.map(o => (
                  <option key={o.id} value={o.id}>{o.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-medium text-ink-400 uppercase mb-1 block">Health</label>
              <select
                value={healthFilter}
                onChange={e => setHealthFilter(e.target.value)}
                className="w-full text-[12px] rounded-lg border border-surface-200 bg-white px-2.5 py-1.5 text-ink-700"
              >
                <option value="">All Health</option>
                {data.filterOptions.healthStatuses.map(h => (
                  <option key={h} value={h}>{h.charAt(0) + h.slice(1).toLowerCase()}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-medium text-ink-400 uppercase mb-1 block">Sector</label>
              <select
                value={sectorFilter}
                onChange={e => setSectorFilter(e.target.value)}
                className="w-full text-[12px] rounded-lg border border-surface-200 bg-white px-2.5 py-1.5 text-ink-700"
              >
                <option value="">All Sectors</option>
                {data.filterOptions.sectors.map(s => (
                  <option key={s} value={s}>{sectorLabel(s)}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* ── Summary Cards ──────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <SummaryCard
          label="Total Projects"
          value={summary.totalProjects}
          icon={<Layers className="w-4 h-4" />}
          accent="blue"
        />
        <SummaryCard
          label="At Risk"
          value={summary.projectsAtRisk}
          icon={<AlertTriangle className="w-4 h-4" />}
          accent={summary.projectsAtRisk > 0 ? 'red' : 'green'}
        />
        <SummaryCard
          label="Avg Health"
          value={summary.avgHealthScore !== null ? `${summary.avgHealthScore}%` : '--'}
          icon={<Activity className="w-4 h-4" />}
          accent={
            summary.avgHealthScore === null ? 'slate'
            : summary.avgHealthScore >= 70 ? 'green'
            : summary.avgHealthScore >= 45 ? 'amber'
            : 'red'
          }
        />
        <SummaryCard
          label="Overdue Tasks"
          value={summary.totalOverdueTasks}
          icon={<Clock className="w-4 h-4" />}
          accent={summary.totalOverdueTasks > 0 ? 'amber' : 'green'}
        />
        <SummaryCard
          label="Open Snags"
          value={summary.totalOpenSnags}
          icon={<HardHat className="w-4 h-4" />}
          accent={summary.totalOpenSnags > 5 ? 'amber' : 'slate'}
        />
      </div>

      {/* ── RAG Distribution ───────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* RAG Donut-like summary */}
        <div className="card-static p-5">
          <h3 className="text-[13px] font-semibold text-ink-700 mb-4">Health Distribution</h3>
          <div className="flex items-center gap-6">
            <div className="flex-1 space-y-2.5">
              <RAGBar label="On Track" count={summary.ragDistribution.GREEN} total={summary.totalProjects} color="bg-emerald-500" />
              <RAGBar label="At Risk" count={summary.ragDistribution.AMBER} total={summary.totalProjects} color="bg-amber-500" />
              <RAGBar label="Critical" count={summary.ragDistribution.RED} total={summary.totalProjects} color="bg-red-500" />
              {summary.ragDistribution.UNSCORED > 0 && (
                <RAGBar label="No Data" count={summary.ragDistribution.UNSCORED} total={summary.totalProjects} color="bg-ink-200" />
              )}
            </div>
          </div>
        </div>

        {/* Component Health Averages */}
        <div className="card-static p-5">
          <h3 className="text-[13px] font-semibold text-ink-700 mb-4">Component Averages</h3>
          <div className="grid grid-cols-2 gap-x-6 gap-y-2.5">
            {COMPONENT_META.map(({ key, label, icon: Icon }) => {
              const score = summary.componentAverages[key]
              return (
                <div key={key} className="flex items-center gap-2.5">
                  <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center shrink-0', scoreBg(score))}>
                    <Icon className={cn('w-3.5 h-3.5', scoreColor(score))} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] text-ink-400 truncate">{label}</p>
                    <p className={cn('text-[14px] font-semibold tabular-nums', scoreColor(score))}>
                      {score !== null ? `${score}%` : 'Insufficient data'}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* ── Project Health Table ────────────────────────── */}
      <div className="card-static overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-surface-100">
          <h3 className="text-[13px] font-semibold text-ink-700">Project Health</h3>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-ink-400">Sort:</span>
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as 'name' | 'score' | 'overdue')}
              className="text-[11px] rounded-md border border-surface-200 bg-white px-2 py-1 text-ink-600"
            >
              <option value="score">Health Score</option>
              <option value="overdue">Overdue Tasks</option>
              <option value="name">Name</option>
            </select>
          </div>
        </div>

        {sortedProjects.length === 0 ? (
          <div className="p-12 text-center">
            <BarChart3 className="w-10 h-10 text-ink-200 mx-auto mb-3" />
            <p className="text-[13px] text-ink-500 font-medium">No projects match the current filters</p>
            <p className="text-[11px] text-ink-400 mt-1">Try adjusting the filters above</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-surface-50/50">
                  <th className="text-left text-[10px] font-semibold text-ink-400 uppercase tracking-wider px-5 py-2.5 sticky left-0 bg-surface-50/50 z-10">
                    Project
                  </th>
                  <th className="text-center text-[10px] font-semibold text-ink-400 uppercase tracking-wider px-2 py-2.5 min-w-[60px]">
                    Overall
                  </th>
                  {COMPONENT_META.map(({ key, label }) => (
                    <th key={key} className="text-center text-[10px] font-semibold text-ink-400 uppercase tracking-wider px-2 py-2.5 min-w-[56px]">
                      {label.slice(0, 5)}
                    </th>
                  ))}
                  <th className="text-center text-[10px] font-semibold text-ink-400 uppercase tracking-wider px-2 py-2.5 min-w-[60px]">
                    Overdue
                  </th>
                  <th className="text-center text-[10px] font-semibold text-ink-400 uppercase tracking-wider px-2 py-2.5 min-w-[50px]">
                    Snags
                  </th>
                  <th className="text-right text-[10px] font-semibold text-ink-400 uppercase tracking-wider px-5 py-2.5 min-w-[40px]">
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedProjects.map((project) => (
                  <tr key={project.id} className="border-t border-surface-100 hover:bg-surface-50/30 transition-colors">
                    {/* Project name */}
                    <td className="px-5 py-3 sticky left-0 bg-white z-10">
                      <div className="flex items-center gap-2.5">
                        <span className={cn('w-2 h-2 rounded-full shrink-0', ragDot(project.rag.overall))} />
                        <div className="min-w-0">
                          <p className="text-[12px] font-medium text-ink-800 truncate max-w-[200px]">
                            {project.code ? `${project.code} - ` : ''}{project.name}
                          </p>
                          <p className="text-[10px] text-ink-400">
                            {stageLabel(project.stage)}
                            {project.officeName ? ` | ${project.officeName}` : ''}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* Overall score */}
                    <td className="px-2 py-3 text-center">
                      <span className={cn(
                        'inline-flex items-center justify-center min-w-[42px] px-2 py-0.5 rounded-full text-[11px] font-semibold',
                        ragBadge(project.rag.overall)
                      )}>
                        {project.scores.overall !== null ? `${project.scores.overall}%` : '--'}
                      </span>
                    </td>

                    {/* Component RAG cells */}
                    {COMPONENT_META.map(({ key }) => (
                      <td key={key} className="px-2 py-3 text-center">
                        {project.scores[key] !== null ? (
                          <span className={cn('w-6 h-6 rounded-full inline-flex items-center justify-center', ragDot(project.rag[key]))}>
                            <span className="sr-only">{ragLabel(project.rag[key])}</span>
                          </span>
                        ) : (
                          <span className="text-[10px] text-ink-300" title="Insufficient data">--</span>
                        )}
                      </td>
                    ))}

                    {/* Overdue tasks */}
                    <td className="px-2 py-3 text-center">
                      <span className={cn(
                        'text-[12px] font-semibold tabular-nums',
                        project.stats.overdueTasks > 0 ? 'text-red-600' : 'text-ink-300'
                      )}>
                        {project.stats.overdueTasks}
                      </span>
                    </td>

                    {/* Open snags */}
                    <td className="px-2 py-3 text-center">
                      <span className={cn(
                        'text-[12px] font-semibold tabular-nums',
                        project.stats.openSnags > 0 ? 'text-amber-600' : 'text-ink-300'
                      )}>
                        {project.stats.openSnags}
                      </span>
                    </td>

                    {/* Link */}
                    <td className="px-5 py-3 text-right">
                      <Link
                        href={`/projects/${project.id}/health`}
                        className="text-accent-500 hover:text-accent-600 transition-colors"
                        title="View project health"
                      >
                        <ArrowUpRight className="w-4 h-4" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Component Detail Cards ─────────────────────── */}
      <div>
        <h3 className="text-[15px] font-semibold text-ink-800 mb-3">Health by Component</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {COMPONENT_META.map(({ key, label, icon: Icon }) => {
            const avg = summary.componentAverages[key]
            const projectsWithData = data.projects.filter(p => p.scores[key] !== null)
            const greenCount = projectsWithData.filter(p => (p.scores[key] || 0) >= 70).length
            const amberCount = projectsWithData.filter(p => {
              const s = p.scores[key] || 0
              return s >= 45 && s < 70
            }).length
            const redCount = projectsWithData.filter(p => (p.scores[key] || 0) < 45).length

            return (
              <div key={key} className="card-static p-4">
                <div className="flex items-center gap-2.5 mb-3">
                  <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center', scoreBg(avg))}>
                    <Icon className={cn('w-4 h-4', scoreColor(avg))} />
                  </div>
                  <div>
                    <p className="text-[12px] font-semibold text-ink-700">{label}</p>
                    <p className={cn('text-[18px] font-bold tabular-nums leading-tight', scoreColor(avg))}>
                      {avg !== null ? `${avg}%` : '--'}
                    </p>
                  </div>
                </div>

                {projectsWithData.length > 0 ? (
                  <div className="flex items-center gap-1.5 text-[10px]">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span className="text-ink-500">{greenCount}</span>
                    <span className="w-2 h-2 rounded-full bg-amber-500 ml-2" />
                    <span className="text-ink-500">{amberCount}</span>
                    <span className="w-2 h-2 rounded-full bg-red-500 ml-2" />
                    <span className="text-ink-500">{redCount}</span>
                    <span className="ml-auto text-ink-400">{projectsWithData.length} projects</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <Info className="w-3 h-3 text-ink-300" />
                    <p className="text-[10px] text-ink-400">Insufficient data</p>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Trends Placeholder ─────────────────────────── */}
      <div className="card-static p-6 text-center">
        <TrendingUp className="w-8 h-8 text-ink-200 mx-auto mb-3" />
        <p className="text-[13px] font-medium text-ink-500">Trend Analysis</p>
        <p className="text-[11px] text-ink-400 mt-1 max-w-md mx-auto">
          Health score trends and historical comparisons will appear here as more data is collected over time.
        </p>
      </div>
    </div>
  )
}

/* ── Sub-components ────────────────────────────────────── */

function SummaryCard({ label, value, icon, accent }: {
  label: string
  value: string | number
  icon: React.ReactNode
  accent: 'blue' | 'green' | 'amber' | 'red' | 'slate'
}) {
  const accentStyles = {
    blue: { bg: 'bg-accent-100 text-accent-600', dot: 'bg-accent-500' },
    green: { bg: 'bg-emerald-100 text-emerald-600', dot: 'bg-emerald-500' },
    amber: { bg: 'bg-amber-100 text-amber-600', dot: 'bg-amber-500' },
    red: { bg: 'bg-red-100 text-red-600', dot: 'bg-red-500' },
    slate: { bg: 'bg-surface-100 text-ink-400', dot: 'bg-ink-300' },
  }
  const a = accentStyles[accent]

  return (
    <div className="card-static p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[10px] font-semibold text-ink-400 uppercase tracking-wider">{label}</p>
        <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center', a.bg)}>
          {icon}
        </div>
      </div>
      <p className="text-[28px] font-semibold text-ink-900 leading-none tabular-nums">{value}</p>
    </div>
  )
}

function RAGBar({ label, count, total, color }: {
  label: string; count: number; total: number; color: string
}) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0
  return (
    <div className="flex items-center gap-3">
      <span className="text-[11px] text-ink-500 w-16 shrink-0">{label}</span>
      <div className="flex-1 h-3 bg-surface-100 rounded-full overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all duration-500', color)}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[11px] font-semibold text-ink-600 tabular-nums w-8 text-right">{count}</span>
    </div>
  )
}

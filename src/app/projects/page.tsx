'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { FolderOpen, Plus, Loader2, AlertTriangle, RefreshCw, Search, X, Archive, SlidersHorizontal } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getProjectTypeIcon } from '@/lib/project-icons'

interface Project {
  id: string
  name: string
  code: string
  stage: string
  healthStatus: string
  status: string
  projectType: string
  client: string | null
  clientBrand: string | null
  createdAt: string
  office?: { id: string; name: string } | null
}

const HEALTH_COLORS: Record<string, string> = {
  GREEN: 'bg-emerald-400',
  AMBER: 'bg-amber-400',
  RED: 'bg-red-400',
  GREY: 'bg-slate-300',
}

const STAGE_OPTIONS: { value: string; label: string }[] = [
  { value: 'BRIEF', label: 'Brief' },
  { value: 'CONCEPT', label: 'Concept' },
  { value: 'SPATIAL_COORDINATION', label: 'Spatial Coordination' },
  { value: 'WORKING_DRAWINGS', label: 'Working Drawings' },
  { value: 'CONSTRUCTION', label: 'Construction' },
  { value: 'HANDOVER', label: 'Handover' },
  { value: 'OPERATIONS', label: 'Operations' },
]

const STAGE_LABELS: Record<string, string> = Object.fromEntries(
  STAGE_OPTIONS.map((s) => [s.value, s.label])
)

const TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: 'HOTEL', label: 'Hotel' },
  { value: 'RESIDENTIAL', label: 'Residential' },
  { value: 'MIXED_USE', label: 'Mixed Use' },
  { value: 'RESORT', label: 'Resort' },
  { value: 'REFURBISHMENT', label: 'Refurbishment' },
  { value: 'OFFICE_FIT_OUT', label: 'Office Fit-Out' },
  { value: 'RELIGIOUS_BUILDING', label: 'Religious Building' },
  { value: 'MASTER_PLAN', label: 'Master Plan' },
  { value: 'TRANSPORT', label: 'Transport' },
  { value: 'OTHER', label: 'Other' },
]

const HEALTH_OPTIONS: { value: string; label: string; dot: string }[] = [
  { value: 'GREEN', label: 'Green', dot: 'bg-emerald-400' },
  { value: 'AMBER', label: 'Amber', dot: 'bg-amber-400' },
  { value: 'RED', label: 'Red', dot: 'bg-red-400' },
  { value: 'GREY', label: 'Grey', dot: 'bg-slate-300' },
]

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: 'DRAFT', label: 'Draft' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'PAUSED', label: 'Paused' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'ARCHIVED', label: 'Archived' },
]

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filters
  const [search, setSearch] = useState('')
  const [stageFilter, setStageFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [healthFilter, setHealthFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [includeArchived, setIncludeArchived] = useState(false)
  const [showFilters, setShowFilters] = useState(false)

  const buildUrl = useCallback(() => {
    const params = new URLSearchParams()
    if (search) params.set('search', search)
    if (stageFilter) params.set('stage', stageFilter)
    if (typeFilter) params.set('projectType', typeFilter)
    if (healthFilter) params.set('healthStatus', healthFilter)
    if (statusFilter) params.set('status', statusFilter)
    if (includeArchived) params.set('includeArchived', 'true')
    const qs = params.toString()
    return `/api/projects${qs ? `?${qs}` : ''}`
  }, [search, stageFilter, typeFilter, healthFilter, statusFilter, includeArchived])

  const fetchProjects = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(buildUrl())
      if (!res.ok) throw new Error('Failed to load projects')
      const json = await res.json()
      setProjects(json.data?.projects || json.data || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }, [buildUrl])

  useEffect(() => { fetchProjects() }, [fetchProjects])

  const activeFilterCount = useMemo(() => {
    let count = 0
    if (stageFilter) count++
    if (typeFilter) count++
    if (healthFilter) count++
    if (statusFilter) count++
    if (includeArchived) count++
    return count
  }, [stageFilter, typeFilter, healthFilter, statusFilter, includeArchived])

  const clearAllFilters = () => {
    setSearch('')
    setStageFilter('')
    setTypeFilter('')
    setHealthFilter('')
    setStatusFilter('')
    setIncludeArchived(false)
  }

  if (loading && projects.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <Loader2 className="w-8 h-8 text-accent-500 animate-spin" />
        <p className="text-[13px] text-ink-400">Loading projects...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <AlertTriangle className="w-10 h-10 text-red-400" />
        <p className="text-[15px] font-medium text-ink-900">Unable to load projects</p>
        <p className="text-[13px] text-ink-400">{error}</p>
        <button onClick={fetchProjects} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-ink-900 text-white text-[13px] font-medium hover:bg-ink-800">
          <RefreshCw className="w-4 h-4" /> Try again
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold text-ink-900">Projects</h1>
          <p className="text-[13px] text-ink-400 mt-1">
            {projects.length} {projects.length === 1 ? 'project' : 'projects'}
            {(search || activeFilterCount > 0) && ' matching filters'}
          </p>
        </div>
        <Link
          href="/projects/new"
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-ink-900 text-white text-[13px] font-medium hover:bg-ink-800 transition-colors self-start shrink-0"
        >
          <Plus className="w-4 h-4" />
          New Project
        </Link>
      </div>

      {/* Search + filter bar */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          {/* Search input */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-300" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, code or client..."
              className="w-full pl-9 pr-8 py-2 rounded-lg border border-ink-200 bg-white text-[13px] text-ink-900 placeholder:text-ink-300 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-ink-100"
              >
                <X className="w-3.5 h-3.5 text-ink-400" />
              </button>
            )}
          </div>

          {/* Filter toggle */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-2 rounded-lg border text-[13px] font-medium transition-colors',
              showFilters || activeFilterCount > 0
                ? 'border-brand-500 bg-brand-50 text-brand-700'
                : 'border-ink-200 bg-white text-ink-600 hover:bg-ink-50'
            )}
          >
            <SlidersHorizontal className="w-4 h-4" />
            Filters
            {activeFilterCount > 0 && (
              <span className="ml-1 w-5 h-5 rounded-full bg-brand-600 text-white text-[11px] flex items-center justify-center">
                {activeFilterCount}
              </span>
            )}
          </button>

          {/* Clear all */}
          {(search || activeFilterCount > 0) && (
            <button
              onClick={clearAllFilters}
              className="text-[12px] text-ink-400 hover:text-ink-600 underline"
            >
              Clear all
            </button>
          )}
        </div>

        {/* Filter dropdowns row */}
        {showFilters && (
          <div className="flex flex-wrap items-center gap-2 p-3 bg-white rounded-lg border border-ink-100">
            {/* Stage */}
            <select
              value={stageFilter}
              onChange={(e) => setStageFilter(e.target.value)}
              className="px-3 py-1.5 rounded-md border border-ink-200 bg-white text-[12px] text-ink-700 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
            >
              <option value="">All Stages</option>
              {STAGE_OPTIONS.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>

            {/* Project Type */}
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="px-3 py-1.5 rounded-md border border-ink-200 bg-white text-[12px] text-ink-700 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
            >
              <option value="">All Types</option>
              {TYPE_OPTIONS.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>

            {/* Health */}
            <select
              value={healthFilter}
              onChange={(e) => setHealthFilter(e.target.value)}
              className="px-3 py-1.5 rounded-md border border-ink-200 bg-white text-[12px] text-ink-700 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
            >
              <option value="">All Health</option>
              {HEALTH_OPTIONS.map((h) => (
                <option key={h.value} value={h.value}>{h.label}</option>
              ))}
            </select>

            {/* Status */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-1.5 rounded-md border border-ink-200 bg-white text-[12px] text-ink-700 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
            >
              <option value="">All Statuses</option>
              {STATUS_OPTIONS.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>

            {/* Include archived toggle */}
            <label className="flex items-center gap-2 ml-2 cursor-pointer">
              <input
                type="checkbox"
                checked={includeArchived}
                onChange={(e) => setIncludeArchived(e.target.checked)}
                className="w-4 h-4 rounded border-ink-300 text-brand-600 focus:ring-brand-500"
              />
              <span className="flex items-center gap-1.5 text-[12px] text-ink-600">
                <Archive className="w-3.5 h-3.5" />
                Include archived
              </span>
            </label>
          </div>
        )}
      </div>

      {/* Project grid */}
      {projects.length === 0 ? (
        <div className="bg-white rounded-xl border border-ink-100 p-12 text-center">
          <FolderOpen className="w-12 h-12 text-ink-200 mx-auto mb-4" />
          {search || activeFilterCount > 0 ? (
            <>
              <p className="text-[15px] font-medium text-ink-700">No projects match your filters</p>
              <p className="text-[12px] text-ink-400 mt-2 max-w-md mx-auto">
                Try adjusting your search or filter criteria.
              </p>
              <button
                onClick={clearAllFilters}
                className="inline-flex items-center gap-2 mt-4 px-4 py-2 rounded-lg border border-ink-200 text-ink-700 text-[13px] font-medium hover:bg-ink-50 transition-colors"
              >
                <X className="w-4 h-4" /> Clear filters
              </button>
            </>
          ) : (
            <>
              <p className="text-[15px] font-medium text-ink-700">No projects yet</p>
              <p className="text-[12px] text-ink-400 mt-2 max-w-md mx-auto">
                Create your first project to start tracking tasks, documents, and progress.
              </p>
              <Link
                href="/projects/new"
                className="inline-flex items-center gap-2 mt-4 px-4 py-2 rounded-lg bg-ink-900 text-white text-[13px] font-medium hover:bg-ink-800 transition-colors"
              >
                <Plus className="w-4 h-4" /> Create Project
              </Link>
            </>
          )}
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map(project => (
            <Link
              key={project.id}
              href={`/projects/${project.id}`}
              className={cn(
                'bg-white rounded-xl border p-5 hover:shadow-md hover:-translate-y-0.5 transition-all group',
                project.status === 'ARCHIVED' ? 'border-ink-200 opacity-70' : 'border-ink-100'
              )}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-start gap-3 min-w-0">
                  {(() => {
                    const pti = getProjectTypeIcon(project.projectType)
                    const PtIcon = pti.icon
                    return (
                      <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center shrink-0', pti.bg)}>
                        <PtIcon className={cn('w-4 h-4', pti.fg)} />
                      </div>
                    )
                  })()}
                  <div className="min-w-0">
                    <p className="text-[14px] font-semibold text-ink-900 truncate group-hover:text-accent-700 transition-colors">
                      {project.name}
                    </p>
                    <p className="text-[11px] text-ink-400 mt-0.5">{project.code}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0 mt-1">
                  {project.status === 'ARCHIVED' && (
                    <Archive className="w-3.5 h-3.5 text-ink-300" />
                  )}
                  <span className={cn(
                    'w-2.5 h-2.5 rounded-full',
                    HEALTH_COLORS[project.healthStatus] || 'bg-ink-200',
                  )} />
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-[11px] text-ink-400">
                  Stage: <span className="text-ink-600 font-medium">
                    {STAGE_LABELS[project.stage] || project.stage?.replace(/_/g, ' ') || '—'}
                  </span>
                </p>
                {project.status && project.status !== 'ACTIVE' && (
                  <span className={cn(
                    'px-1.5 py-0.5 rounded text-[10px] font-medium',
                    project.status === 'ARCHIVED' ? 'bg-ink-100 text-ink-500'
                      : project.status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-600'
                      : project.status === 'PAUSED' ? 'bg-amber-50 text-amber-600'
                      : project.status === 'DRAFT' ? 'bg-blue-50 text-blue-600'
                      : 'bg-ink-50 text-ink-500'
                  )}>
                    {project.status}
                  </span>
                )}
              </div>
              {(project.client || project.clientBrand) && (
                <p className="text-[11px] text-ink-400 mt-1">
                  Client: <span className="text-ink-600">{project.clientBrand || project.client}</span>
                </p>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

'use client'

import { useState } from 'react'
import Link from 'next/link'
import { PROJECTS, getProjectTasks, getUser } from '@/lib/mock-data'
import { calculateRisks, calculateHealth, calculateCompletion } from '@/lib/risk-engine'
import { RIBA_STAGES, RIBAStage, ProjectStatus, ProjectSummary } from '@/lib/types'
import { StageBadge } from '@/components/StageBadge'
import { ProgressBar } from '@/components/ProgressBar'
import { cn, isOverdue, healthDot } from '@/lib/utils'

export default function ProjectsPage() {
  const [search, setSearch] = useState('')
  const [stageFilter, setStageFilter] = useState<RIBAStage | 'all'>('all')
  const [statusFilter, setStatusFilter] = useState<ProjectStatus | 'all'>('all')

  const summaries: ProjectSummary[] = PROJECTS.map(project => {
    const tasks = getProjectTasks(project.id)
    const risks = calculateRisks(project, tasks)
    const overdueTasks = tasks.filter(t => isOverdue(t.due_date) && t.status !== 'done')
    const completion = calculateCompletion(tasks)
    const health = calculateHealth(risks, overdueTasks)
    return {
      project,
      lead: project.project_lead_user_id ? getUser(project.project_lead_user_id) : undefined,
      completion,
      stage_completion: 0,
      open_risks: risks.filter(r => !r.resolved_flag).length,
      overdue_tasks: overdueTasks.length,
      health,
    }
  })

  const filtered = summaries.filter(s => {
    const matchesSearch = search === '' ||
      s.project.name.toLowerCase().includes(search.toLowerCase()) ||
      s.project.client.toLowerCase().includes(search.toLowerCase())
    const matchesStage = stageFilter === 'all' || s.project.current_stage === stageFilter
    const matchesStatus = statusFilter === 'all' || s.project.status === statusFilter
    return matchesSearch && matchesStage && matchesStatus
  })

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-[2rem] sm:text-[2.5rem] text-ink-900">Projects</h1>
          <p className="text-[13px] text-ink-400 mt-1">{filtered.length} of {PROJECTS.length} projects shown</p>
        </div>
        <Link
          href="/projects/new"
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 transition-colors shadow-sm"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" d="M12 5v14M5 12h14" />
          </svg>
          New Project
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          type="text"
          placeholder="Search by name or client..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 bg-white placeholder:text-slate-300"
        />
        <select
          value={stageFilter}
          onChange={e => setStageFilter(e.target.value === 'all' ? 'all' : Number(e.target.value) as RIBAStage)}
          className="px-3 py-2.5 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
        >
          <option value="all">All Stages</option>
          {(Object.entries(RIBA_STAGES) as [string, string][]).map(([s, label]) => (
            <option key={s} value={s}>Stage {s}: {label}</option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value as ProjectStatus | 'all')}
          className="px-3 py-2.5 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
        >
          <option value="all">All Statuses</option>
          <option value="active">Active</option>
          <option value="paused">Paused</option>
          <option value="completed">Completed</option>
          <option value="archived">Archived</option>
        </select>
      </div>

      {/* Project Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filtered.map(s => (
          <Link
            key={s.project.id}
            href={`/projects/${s.project.id}`}
            className="card-premium p-5 hover:shadow-md hover:border-slate-300 transition-all group"
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className={cn('w-2 h-2 rounded-full', healthDot(s.health))} />
                  <h3 className="text-sm font-semibold text-slate-900 group-hover:text-brand-600 transition-colors">{s.project.name}</h3>
                </div>
                <p className="text-xs text-slate-500">{s.project.client}</p>
              </div>
              <StageBadge stage={s.project.current_stage} size="sm" />
            </div>

            <ProgressBar value={s.completion} size="sm" />

            <div className="flex items-center gap-4 mt-3 text-xs text-slate-400">
              {s.lead && <span>Lead: {s.lead.name}</span>}
              {s.open_risks > 0 && <span className="text-red-600 font-medium">{s.open_risks} risks</span>}
              {s.overdue_tasks > 0 && <span className="text-amber-600 font-medium">{s.overdue_tasks} overdue</span>}
              <span className={cn(
                'ml-auto status-pill capitalize',
                s.project.status === 'active' ? 'bg-emerald-100 text-emerald-700' :
                s.project.status === 'paused' ? 'bg-amber-100 text-amber-700' :
                'bg-slate-100 text-slate-600'
              )}>
                {s.project.status}
              </span>
            </div>
          </Link>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12">
          <p className="text-sm text-slate-400">No projects match your filters.</p>
        </div>
      )}
    </div>
  )
}

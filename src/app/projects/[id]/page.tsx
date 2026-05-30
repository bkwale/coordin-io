import Link from 'next/link'
import { notFound } from 'next/navigation'
import { PROJECTS, getProjectTasks, getUser } from '@/lib/mock-data'
import { calculateRisks, calculateHealth, calculateCompletion, calculateStageCompletion } from '@/lib/risk-engine'
import { RIBA_STAGES, TaskStatus } from '@/lib/types'
import { StageBadge } from '@/components/StageBadge'
import { ProgressBar } from '@/components/ProgressBar'
import { RiskAlertCard } from '@/components/RiskAlertCard'
import { TaskList } from '@/components/TaskList'

import { Phase2Warnings } from '@/components/Phase2Warnings'
import { cn, isOverdue, statusLabel, formatDate, healthColor } from '@/lib/utils'

export function generateStaticParams() {
  return PROJECTS.map(p => ({ id: p.id }))
}

export default function ProjectDashboard({ params }: { params: { id: string } }) {
  const project = PROJECTS.find(p => p.id === params.id)
  if (!project) notFound()

  const tasks = getProjectTasks(project.id)
  const risks = calculateRisks(project, tasks)
  const overdueTasks = tasks.filter(t => isOverdue(t.due_date) && t.status !== 'done')
  const health = calculateHealth(risks, overdueTasks)
  const completion = calculateCompletion(tasks)
  const stageCompletion = calculateStageCompletion(tasks, project.current_stage)
  const lead = project.project_lead_user_id ? getUser(project.project_lead_user_id) : null

  const tasksByStatus: Record<TaskStatus, number> = {
    not_started: tasks.filter(t => t.status === 'not_started').length,
    in_progress: tasks.filter(t => t.status === 'in_progress').length,
    done: tasks.filter(t => t.status === 'done').length,
    blocked: tasks.filter(t => t.status === 'blocked').length,
  }

  const requiredOutstanding = tasks.filter(t =>
    t.required_flag && t.status !== 'done' && t.stage === project.current_stage
  )

  const nextActions = tasks
    .filter(t => t.status !== 'done' && t.stage === project.current_stage)
    .sort((a, b) => {
      if (a.required_flag !== b.required_flag) return a.required_flag ? -1 : 1
      if (a.due_date && b.due_date) return new Date(a.due_date).getTime() - new Date(b.due_date).getTime()
      if (a.due_date) return -1
      return 1
    })
    .slice(0, 5)

  return (
    <div className="space-y-6 sm:space-y-8 animate-fade-in">
      {/* Project Header */}
      <div className="card-premium p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-[2rem] sm:text-[2.5rem] font-display font-bold text-ink-900">{project.name}</h1>
              <span className={cn('px-2 py-0.5 rounded text-[11px] font-bold uppercase', healthColor(health))}>
                {health}
              </span>
            </div>
            <p className="text-sm text-slate-500">{project.client}</p>
            {project.description && (
              <p className="text-sm text-slate-400 mt-1 max-w-xl">{project.description}</p>
            )}
            <div className="flex flex-wrap items-center gap-3 mt-3">
              <StageBadge stage={project.current_stage} />
              <span className={cn(
                'inline-block px-2 py-0.5 rounded text-[11px] font-medium capitalize',
                project.status === 'active' ? 'bg-emerald-100 text-emerald-700' :
                project.status === 'paused' ? 'bg-amber-100 text-amber-700' :
                'bg-slate-100 text-slate-600'
              )}>
                {project.status}
              </span>
              {lead && (
                <span className="text-xs text-slate-400">Lead: <span className="text-slate-600 font-medium">{lead.name}</span></span>
              )}
            </div>
          </div>

          <div className="text-xs text-slate-400 space-y-1 sm:text-right shrink-0">
            <p>Started: <span className="text-slate-600">{formatDate(project.start_date)}</span></p>
            {project.target_completion_date && (
              <p>Target: <span className="text-slate-600">{formatDate(project.target_completion_date)}</span></p>
            )}
            <p>Updated: <span className="text-slate-600">{formatDate(project.last_activity_at)}</span></p>
          </div>
        </div>
      </div>

      {/* Progress + Task Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="card-premium p-5">
          <h3 className="text-[11px] font-semibold text-ink-400 uppercase tracking-[0.1em] mb-4">Progress</h3>
          <div className="space-y-4">
            <ProgressBar value={completion} label="Overall Completion" />
            <ProgressBar value={stageCompletion} label={`Stage ${project.current_stage}: ${RIBA_STAGES[project.current_stage]}`} />
          </div>
        </div>

        <div className="card-premium p-5">
          <h3 className="text-[11px] font-semibold text-ink-400 uppercase tracking-[0.1em] mb-4">Task Summary</h3>
          <div className="grid grid-cols-2 gap-3">
            {(['not_started', 'in_progress', 'done', 'blocked'] as TaskStatus[]).map(status => (
              <div key={status} className="text-center p-2 rounded-lg bg-slate-50">
                <p className="text-lg font-bold text-slate-900">{tasksByStatus[status]}</p>
                <p className="text-[11px] text-slate-500 font-medium">{statusLabel(status)}</p>
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-center justify-between text-xs">
            <span className="text-slate-400">Total: {tasks.length} tasks</span>
            {overdueTasks.length > 0 && (
              <span className="text-red-600 font-medium">{overdueTasks.length} overdue</span>
            )}
          </div>
        </div>
      </div>

      {/* Risks + Required Outstanding + Next Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Risks */}
        <div className="card-premium p-5">
          <h3 className="text-[11px] font-semibold text-ink-400 uppercase tracking-[0.1em] mb-3">Risk Alerts</h3>
          {risks.length === 0 ? (
            <div className="text-center py-4">
              <span className="inline-block w-8 h-8 rounded-full bg-emerald-100 text-emerald-600 text-sm font-bold leading-8 mb-1">✓</span>
              <p className="text-xs text-slate-400">No risks detected</p>
            </div>
          ) : (
            <div className="space-y-2">
              {risks.slice(0, 5).map(risk => (
                <RiskAlertCard key={risk.id} risk={risk} compact />
              ))}
              {risks.length > 5 && (
                <p className="text-xs text-slate-400 text-center pt-1">+ {risks.length - 5} more</p>
              )}
            </div>
          )}
        </div>

        {/* Required Outstanding */}
        <div className="card-premium p-5">
          <h3 className="text-[11px] font-semibold text-ink-400 uppercase tracking-[0.1em] mb-3">Required Tasks Outstanding</h3>
          {requiredOutstanding.length === 0 ? (
            <div className="text-center py-4">
              <span className="inline-block w-8 h-8 rounded-full bg-emerald-100 text-emerald-600 text-sm font-bold leading-8 mb-1">✓</span>
              <p className="text-xs text-slate-400">All required tasks complete</p>
            </div>
          ) : (
            <div className="space-y-2">
              {requiredOutstanding.map(task => (
                <div key={task.id} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-brand-500 shrink-0" />
                  <span className="text-xs font-medium text-amber-900 truncate">{task.title}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Next Actions */}
        <div className="card-premium p-5">
          <h3 className="text-[11px] font-semibold text-ink-400 uppercase tracking-[0.1em] mb-3">Next Actions</h3>
          {nextActions.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-4">No pending actions.</p>
          ) : (
            <div className="space-y-2">
              {nextActions.map((task, i) => {
                const owner = task.owner_user_id ? getUser(task.owner_user_id) : null
                return (
                  <div key={task.id} className="flex items-start gap-2.5 py-1.5">
                    <span className="text-xs font-bold text-slate-300 mt-0.5">{i + 1}</span>
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-slate-800 truncate">{task.title}</p>
                      {owner && <p className="text-[11px] text-slate-400">{owner.name}</p>}
                    </div>
                    {task.required_flag && (
                      <span className="text-[10px] font-bold text-brand-600 bg-brand-50 px-1.5 py-0.5 rounded shrink-0">REQ</span>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Phase 2: Warning Chips */}
      <Phase2Warnings projectId={project.id} />

      {/* Project Workspaces Grid */}
      <div>
        <h2 className="text-[11px] font-semibold text-ink-400 uppercase tracking-[0.1em] mb-3">Workspaces</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { href: `/projects/${project.id}/health`, label: 'Health', sub: 'Scorecards & Alerts' },
            { href: `/projects/${project.id}/registers`, label: 'Registers', sub: 'Issues, Changes & Risks' },
            { href: `/projects/${project.id}/meetings`, label: 'Meetings', sub: 'Meetings & Actions' },
            { href: `/projects/${project.id}/design-risks`, label: 'Design Risk', sub: 'Risk Workspace' },
            { href: `/projects/${project.id}/contract-admin`, label: 'Contract', sub: 'Administration' },
            { href: `/projects/${project.id}/planning`, label: 'Planning', sub: 'Site Context' },
            { href: `/projects/${project.id}/tender`, label: 'Tender', sub: 'ITT & Evaluation' },
            { href: `/projects/${project.id}/site-queries`, label: 'Site Queries', sub: 'Site-to-Office' },
            { href: `/projects/${project.id}/building-regs`, label: 'Building Regs', sub: 'Submissions & Inspections' },
            { href: `/projects/${project.id}/brpd`, label: 'BRPD', sub: 'Compliance & Dutyholders' },
            { href: `/projects/${project.id}/brpd/changelog`, label: 'BRPD Changelog', sub: 'Document Control' },
            { href: `/projects/${project.id}/drawing-issues`, label: 'Drawing Issues', sub: 'Email Workflow' },
            { href: `/projects/${project.id}/brief`, label: 'Brief', sub: 'Project Brief Builder' },
            { href: `/projects/${project.id}/documents`, label: 'Documents', sub: 'Register & Transmittals' },
            { href: `/projects/${project.id}/ai`, label: 'AI Teammate', sub: 'Ask About This Project' },
            { href: '/approvals', label: 'Approvals', sub: 'Review Queue' },
          ].map(link => (
            <Link
              key={link.href}
              href={link.href}
              className="card-premium p-3.5 hover:border-brand-200 hover:bg-brand-50/30 transition-all group"
            >
              <p className="text-sm font-semibold text-slate-900 group-hover:text-brand-700 transition-colors">{link.label}</p>
              <p className="text-[11px] text-slate-400 mt-0.5">{link.sub}</p>
            </Link>
          ))}
        </div>
      </div>

      {/* Task List */}
      <TaskList tasks={tasks} currentStage={project.current_stage} groupByStage />

      {/* Stage Progression Warning */}
      {requiredOutstanding.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
          <svg className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          <div>
            <p className="text-sm font-semibold text-amber-900">Stage progression blocked</p>
            <p className="text-xs text-amber-700 mt-0.5">
              {requiredOutstanding.length} required task{requiredOutstanding.length > 1 ? 's' : ''} must be completed before moving to Stage {project.current_stage + 1}.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}


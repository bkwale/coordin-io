'use client'

import { useState } from 'react'
import { getAllDrawingIssues, PROJECTS, getUser, USERS } from '@/lib/mock-data'
import { DrawingIssueRecord, DrawingIssueType, RIBAStage, RIBA_STAGES, RIBA_STAGE_COLORS } from '@/lib/types'
import { cn, formatDate, drawingIssueTypeLabel, drawingIssueTypeColor } from '@/lib/utils'
import { Breadcrumb } from '@/components/Breadcrumb'
import { SummaryCard } from '@/components/SummaryCard'
import { TabBar } from '@/components/TabBar'
import { EmptyState } from '@/components/EmptyState'

type DrawingIssueTypeValue = DrawingIssueType

export default function DrawingIssuesPage() {
  const issues = getAllDrawingIssues()
  const [activeProject, setActiveProject] = useState<string>('all')

  // ━━━ CALCULATIONS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const totalIssues = issues.length
  const uniqueDrawings = new Set(issues.map(i => i.drawing_ref)).size
  const reIssues = issues.filter(i => i.supersedes).length
  const activeProjects = new Set(issues.map(i => i.project_id)).size

  // Count issues by type
  const issuesByType: Record<string, number> = {}
  issues.forEach(issue => {
    issuesByType[issue.issue_type] = (issuesByType[issue.issue_type] || 0) + 1
  })

  // Count issues by stage
  const issuesByStage: Record<RIBAStage, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0 }
  issues.forEach(issue => {
    if (issue.stage !== undefined) {
      issuesByStage[issue.stage] = (issuesByStage[issue.stage] || 0) + 1
    }
  })

  // Re-issued drawings (where supersedes is set)
  const reissuedDrawings = issues.filter(i => i.supersedes)

  // Count re-issues per drawing
  const reissueCountByDrawing: Record<string, number> = {}
  reissuedDrawings.forEach(issue => {
    reissueCountByDrawing[issue.drawing_ref] = (reissueCountByDrawing[issue.drawing_ref] || 0) + 1
  })

  // Filter issues by selected project
  const filteredIssues = activeProject === 'all'
    ? issues
    : issues.filter(i => i.project_id === activeProject)

  // Group filtered issues by project for timeline
  const issuesByProject: Record<string, DrawingIssueRecord[]> = {}
  filteredIssues.forEach(issue => {
    if (!issuesByProject[issue.project_id]) {
      issuesByProject[issue.project_id] = []
    }
    issuesByProject[issue.project_id].push(issue)
  })

  // Sort issues chronologically within each project
  Object.keys(issuesByProject).forEach(projectId => {
    issuesByProject[projectId].sort((a, b) =>
      new Date(b.issued_date).getTime() - new Date(a.issued_date).getTime()
    )
  })

  // Get project names for tabs
  const projectsWithIssues = Array.from(new Set(issues.map(i => i.project_id)))
    .map(pid => PROJECTS.find(p => p.id === pid))
    .filter(Boolean)

  const projectTabs = [
    { key: 'all', label: 'All', count: filteredIssues.length },
    ...projectsWithIssues.map(p => ({
      key: p!.id,
      label: p!.name,
      count: issues.filter(i => i.project_id === p!.id).length
    }))
  ]

  // Get max count for bar scaling
  const maxTypeCount = Math.max(...Object.values(issuesByType), 1)
  const maxStageCount = Math.max(...Object.values(issuesByStage), 1)

  return (
    <div className="max-w-6xl animate-fade-in">
      {/* ━━━ BREADCRUMB ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section className="pb-8">
        <Breadcrumb items={[
          { label: 'Dashboard', href: '/' },
          { label: 'Analytics' },
          { label: 'Drawing Issues' }
        ]} />
      </section>

      {/* ━━━ HEADER ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section className="pb-16">
        <h1 className="font-display text-[2rem] text-ink-900 mb-2">Drawing Issue Intelligence</h1>
        <p className="text-[13px] text-ink-400">Track issue patterns, re-issues, and delivery pressure across projects</p>
      </section>

      {/* ━━━ SUMMARY CARDS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section className="pb-16">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-8">
          <SummaryCard value={totalIssues} label="Total Issues" />
          <SummaryCard value={uniqueDrawings} label="Unique Drawings" />
          <SummaryCard value={reIssues} label="Re-issues" />
          <SummaryCard value={activeProjects} label="Active Projects" />
        </div>
      </section>

      {/* ━━━ ISSUE VOLUME BY TYPE ━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section className="pb-16">
        <div className="border-t border-surface-200/60 pt-10">
          <h2 className="font-display text-[1.5rem] text-ink-900 mb-8">Issue Volume by Type</h2>
          <div className="card-premium p-6 space-y-4">
            {Object.entries(issuesByType)
              .sort(([, a], [, b]) => b - a)
              .map(([type, count]) => {
                const percentage = (count / maxTypeCount) * 100
                const bgColor = drawingIssueTypeColor(type as DrawingIssueTypeValue)
                return (
                  <div key={type} className="flex items-center gap-4">
                    <div className="w-24 text-[12px] font-medium text-ink-700 flex-shrink-0">
                      {drawingIssueTypeLabel(type as DrawingIssueTypeValue)}
                    </div>
                    <div className="flex-1 flex items-center gap-3">
                      <div className="h-7 rounded-lg flex-1 bg-surface-100 overflow-hidden">
                        <div
                          className={cn('h-full rounded-lg transition-all', bgColor)}
                          style={{ width: `${Math.max(percentage, 3)}%`, minWidth: '2px' }}
                        />
                      </div>
                      <div className="w-10 text-right text-[12px] font-semibold text-ink-900 flex-shrink-0">
                        {count}
                      </div>
                    </div>
                  </div>
                )
              })}
          </div>
        </div>
      </section>

      {/* ━━━ ISSUE VOLUME BY STAGE ━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section className="pb-16">
        <div className="border-t border-surface-200/60 pt-10">
          <h2 className="font-display text-[1.5rem] text-ink-900 mb-8">Issue Volume by RIBA Stage</h2>
          <div className="card-premium p-6 space-y-4">
            {(Object.entries(issuesByStage) as [string, number][])
              .map(([stage]) => stage as unknown as RIBAStage)
              .filter(stage => issuesByStage[stage])
              .sort((a, b) => (issuesByStage[b] || 0) - (issuesByStage[a] || 0))
              .map(stage => {
                const count = issuesByStage[stage] || 0
                const percentage = (count / maxStageCount) * 100
                const stageColor = RIBA_STAGE_COLORS[stage as RIBAStage]
                return (
                  <div key={stage} className="flex items-center gap-4">
                    <div className="w-24 text-[12px] font-medium text-ink-700 flex-shrink-0">
                      Stage {stage}
                    </div>
                    <div className="flex-1 flex items-center gap-3">
                      <div className="h-7 rounded-lg flex-1 bg-surface-100 overflow-hidden">
                        <div
                          className="h-full rounded-lg transition-all"
                          style={{
                            backgroundColor: stageColor,
                            width: `${Math.max(percentage, 3)}%`,
                            minWidth: '2px'
                          }}
                        />
                      </div>
                      <div className="w-10 text-right text-[12px] font-semibold text-ink-900 flex-shrink-0">
                        {count}
                      </div>
                    </div>
                  </div>
                )
              })}
          </div>
        </div>
      </section>

      {/* ━━━ RE-ISSUE TRACKER ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section className="pb-16">
        <div className="border-t border-surface-200/60 pt-10">
          <h2 className="font-display text-[1.5rem] text-ink-900 mb-2">Re-Issue Patterns</h2>
          <p className="text-[13px] text-ink-400 mb-8">Drawings that have been re-issued. Frequent re-issues may indicate scope creep or coordination gaps.</p>

          {reissuedDrawings.length === 0 ? (
            <EmptyState message="No re-issued drawings found." />
          ) : (
            <div className="card-premium overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-[12px]">
                  <thead className="bg-surface-50 border-b border-surface-200">
                    <tr>
                      <th className="text-left p-4 text-[11px] text-ink-300 uppercase tracking-[0.08em] font-semibold">Drawing Ref</th>
                      <th className="text-left p-4 text-[11px] text-ink-300 uppercase tracking-[0.08em] font-semibold">Title</th>
                      <th className="text-left p-4 text-[11px] text-ink-300 uppercase tracking-[0.08em] font-semibold">Project</th>
                      <th className="text-left p-4 text-[11px] text-ink-300 uppercase tracking-[0.08em] font-semibold">Type</th>
                      <th className="text-left p-4 text-[11px] text-ink-300 uppercase tracking-[0.08em] font-semibold">Rev</th>
                      <th className="text-left p-4 text-[11px] text-ink-300 uppercase tracking-[0.08em] font-semibold">Supersedes</th>
                      <th className="text-left p-4 text-[11px] text-ink-300 uppercase tracking-[0.08em] font-semibold">Date</th>
                      <th className="text-left p-4 text-[11px] text-ink-300 uppercase tracking-[0.08em] font-semibold">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reissuedDrawings
                      .sort((a, b) => new Date(b.issued_date).getTime() - new Date(a.issued_date).getTime())
                      .map((issue, i) => {
                        const project = PROJECTS.find(p => p.id === issue.project_id)
                        const reissueCount = reissueCountByDrawing[issue.drawing_ref] || 0
                        const highlight = reissueCount >= 2
                        return (
                          <tr
                            key={`${issue.id}-${i}`}
                            className={cn(
                              'stripe-row border-b border-surface-200 transition-colors',
                              highlight ? 'bg-amber-50' : 'hover:bg-surface-50'
                            )}
                          >
                            <td className="p-4 font-mono text-ink-900">{issue.drawing_ref}</td>
                            <td className="p-4 text-ink-800 max-w-xs truncate">{issue.drawing_title}</td>
                            <td className="p-4 text-ink-600">{project?.name || '—'}</td>
                            <td className="p-4">
                              <span className={cn(
                                'px-2 py-0.5 rounded-md text-[10px] font-semibold tracking-wide',
                                drawingIssueTypeColor(issue.issue_type)
                              )}>
                                {drawingIssueTypeLabel(issue.issue_type)}
                              </span>
                            </td>
                            <td className="p-4 text-ink-700">{issue.revision}</td>
                            <td className="p-4 font-mono text-ink-600">{issue.supersedes || '—'}</td>
                            <td className="p-4 text-ink-500 whitespace-nowrap">{formatDate(issue.issued_date)}</td>
                            <td className="p-4 text-ink-400 text-[11px] max-w-xs truncate">{issue.notes || '—'}</td>
                          </tr>
                        )
                      })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ━━━ ISSUE TIMELINE BY PROJECT ━━━━━━━━━━━━━━━━━━━━━ */}
      <section className="pb-16">
        <div className="border-t border-surface-200/60 pt-10">
          <h2 className="font-display text-[1.5rem] text-ink-900 mb-8">Project Issue History</h2>

          <div className="mb-8">
            <TabBar tabs={projectTabs} activeKey={activeProject} onSelect={setActiveProject} />
          </div>

          {filteredIssues.length === 0 ? (
            <EmptyState message="No issues found for this project." />
          ) : (
            <div className="space-y-10">
              {Object.entries(issuesByProject)
                .sort(([aId], [bId]) => {
                  const aProject = PROJECTS.find(p => p.id === aId)
                  const bProject = PROJECTS.find(p => p.id === bId)
                  return (aProject?.name || '').localeCompare(bProject?.name || '')
                })
                .map(([projectId, projectIssues]) => {
                  const project = PROJECTS.find(p => p.id === projectId)
                  return (
                    <div key={projectId}>
                      <h3 className="text-[13px] font-semibold text-ink-700 mb-6">{project?.name}</h3>
                      <div className="space-y-0">
                        {projectIssues.map((issue, idx) => {
                          const issuedToUser = issue.issued_to ? getUser(issue.issued_to) : null
                          return (
                            <div
                              key={`${issue.id}-${idx}`}
                              className="relative flex items-start gap-4 pb-6"
                            >
                              {/* Timeline line */}
                              {idx < projectIssues.length - 1 && (
                                <div className="absolute left-[5px] top-6 w-0.5 h-12 bg-surface-200" />
                              )}

                              {/* Dot */}
                              <div className="relative mt-1">
                                <div className={cn(
                                  'w-3 h-3 rounded-full border-2',
                                  issue.supersedes
                                    ? 'border-amber-500 bg-amber-50'
                                    : 'border-surface-300 bg-white'
                                )} />
                              </div>

                              {/* Content */}
                              <div className="flex-1 min-w-0">
                                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-1">
                                  <div className="flex items-center gap-3">
                                    <p className="text-[11px] text-ink-400 whitespace-nowrap">
                                      {formatDate(issue.issued_date)}
                                    </p>
                                    <p className="font-mono text-[12px] text-ink-900">{issue.drawing_ref}</p>
                                    <p className="text-[12px] text-ink-700 truncate">{issue.drawing_title}</p>
                                  </div>
                                </div>
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className={cn(
                                    'px-2 py-0.5 rounded-md text-[10px] font-semibold tracking-wide',
                                    drawingIssueTypeColor(issue.issue_type)
                                  )}>
                                    {drawingIssueTypeLabel(issue.issue_type)}
                                  </span>
                                  <p className="text-[11px] text-ink-500">Rev {issue.revision}</p>
                                  {issuedToUser && (
                                    <p className="text-[11px] text-ink-400">→ {issuedToUser.name}</p>
                                  )}
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
            </div>
          )}
        </div>
      </section>

    </div>
  )
}

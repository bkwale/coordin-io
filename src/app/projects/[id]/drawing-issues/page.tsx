'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'

import { SummaryCard } from '@/components/SummaryCard'
import { StatusBadge } from '@/components/StatusBadge'
import { EmptyState } from '@/components/EmptyState'
import { getProject, getDrawingIssueWorkflows, getWorkflowEmails, getUser } from '@/lib/mock-data'
import { DrawingWorkflowStatus } from '@/lib/types'
import { cn, formatDate, drawingWorkflowStatusColor, drawingWorkflowStatusLabel, drawingEmailDirectionLabel, drawingEmailDirectionColor, isOverdue } from '@/lib/utils'

const STATUS_FILTERS: DrawingWorkflowStatus[] = ['draft', 'issued', 'queried', 'responded', 'closed', 'escalated']

export default function DrawingIssuesPage() {
  const params = useParams()
  const projectId = params.id as string

  const project = getProject(projectId)
  const allWorkflows = getDrawingIssueWorkflows(projectId)

  const [activeFilter, setActiveFilter] = useState<DrawingWorkflowStatus | 'all'>('all')
  const [expandedWorkflow, setExpandedWorkflow] = useState<string | null>(null)

  if (!project) {
    return <EmptyState message="Project not found." />
  }

  const filteredWorkflows = activeFilter === 'all'
    ? allWorkflows
    : allWorkflows.filter(w => w.status === activeFilter)

  const activeWorkflows = allWorkflows.filter(w => w.status !== 'draft' && w.status !== 'closed')
  const escalatedWorkflows = allWorkflows.filter(w => w.escalated_flag)

  const responseTimes = allWorkflows
    .filter(w => w.response_received_date && w.issued_date)
    .map(w => {
      const issued = new Date(w.issued_date)
      const received = new Date(w.response_received_date!)
      return Math.floor((received.getTime() - issued.getTime()) / (1000 * 60 * 60 * 24))
    })

  const avgResponseTime = responseTimes.length > 0
    ? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length)
    : 0

  const expandedEmails = expandedWorkflow
    ? getWorkflowEmails(expandedWorkflow)
    : []

  return (
    <div className="space-y-6 sm:space-y-8 animate-fade-in">
      <div>
        <h1 className="font-display text-2xl sm:text-3xl text-ink-900">Drawing Issue & Email Workflow</h1>
        <p className="text-sm text-ink-400 mt-1">Track drawing issues, responses, queries and escalations</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <SummaryCard
          value={allWorkflows.length}
          label="Total Workflows"
          bgColor="bg-surface-50"
          borderColor="border-surface-200"
          textColor="text-ink-900"
          labelColor="text-ink-400"
        />
        <SummaryCard
          value={activeWorkflows.length}
          label="Active"
          bgColor="bg-blue-50"
          borderColor="border-blue-200"
          textColor="text-blue-700"
          labelColor="text-blue-600"
        />
        <SummaryCard
          value={escalatedWorkflows.length}
          label="Escalated"
          bgColor="bg-red-50"
          borderColor="border-red-200"
          textColor="text-red-700"
          labelColor="text-red-600"
        />
        <SummaryCard
          value={avgResponseTime}
          label="Avg Response (days)"
          bgColor="bg-amber-50"
          borderColor="border-amber-200"
          textColor="text-amber-700"
          labelColor="text-amber-600"
        />
      </div>

      {/* Workflow Table */}
      <div className="space-y-4 border-t border-surface-200/60 pt-10">
        <h2 className="font-display text-[1.5rem] text-ink-900">Workflows</h2>

        {/* Filter Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-2">
          <button
            onClick={() => setActiveFilter('all')}
            className={cn(
              'px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors',
              activeFilter === 'all'
                ? 'bg-ink-900 text-white'
                : 'bg-white border border-surface-200 text-ink-600 hover:bg-surface-50'
            )}
          >
            All
          </button>
          {STATUS_FILTERS.map(status => (
            <button
              key={status}
              onClick={() => setActiveFilter(status)}
              className={cn(
                'px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors',
                activeFilter === status
                  ? 'bg-ink-900 text-white'
                  : 'bg-white border border-surface-200 text-ink-600 hover:bg-surface-50'
              )}
            >
              {drawingWorkflowStatusLabel(status)}
            </button>
          ))}
        </div>

        {filteredWorkflows.length === 0 ? (
          <EmptyState message="No workflows match this filter." />
        ) : (
          <div className="card-premium overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-surface-50 border-b border-surface-200/60">
                  <tr>
                    <th className="text-left px-5 py-3 text-[11px] font-semibold text-ink-400 uppercase tracking-wide">Drawing Ref</th>
                    <th className="text-left px-5 py-3 text-[11px] font-semibold text-ink-400 uppercase tracking-wide">Title</th>
                    <th className="text-left px-5 py-3 text-[11px] font-semibold text-ink-400 uppercase tracking-wide">Status</th>
                    <th className="text-left px-5 py-3 text-[11px] font-semibold text-ink-400 uppercase tracking-wide">Issued To</th>
                    <th className="text-left px-5 py-3 text-[11px] font-semibold text-ink-400 uppercase tracking-wide">Issued</th>
                    <th className="text-left px-5 py-3 text-[11px] font-semibold text-ink-400 uppercase tracking-wide">Response Due</th>
                    <th className="text-left px-5 py-3 text-[11px] font-semibold text-ink-400 uppercase tracking-wide">Queries</th>
                    <th className="text-center px-5 py-3 text-[11px] font-semibold text-ink-400 uppercase tracking-wide">Trail</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredWorkflows.map((wf, idx) => {
                    const overdueFlag = isOverdue(wf.response_due_date) && (wf.status === 'issued' || wf.status === 'queried')
                    const isExpanded = expandedWorkflow === wf.id

                    return (
                      <tr
                        key={wf.id}
                        onClick={() => setExpandedWorkflow(isExpanded ? null : wf.id)}
                        className={cn(
                          'stripe-row cursor-pointer hover:bg-surface-50 transition-colors',
                          idx !== filteredWorkflows.length - 1 && 'border-b border-surface-200/60'
                        )}
                      >
                        <td className="px-5 py-4 font-mono text-xs text-ink-900">{wf.drawing_ref}</td>
                        <td className="px-5 py-4 text-ink-700">{wf.drawing_title}</td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2">
                            <StatusBadge
                              label={drawingWorkflowStatusLabel(wf.status)}
                              colorClass={drawingWorkflowStatusColor(wf.status)}
                            />
                            {wf.escalated_flag && (
                              <span className="text-[10px] font-bold text-red-600">⚠</span>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-4 text-ink-700">{wf.issued_to_name}</td>
                        <td className="px-5 py-4 text-ink-500 text-xs">{formatDate(wf.issued_date)}</td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2">
                            <span className="text-ink-500 text-xs">{formatDate(wf.response_due_date)}</span>
                            {overdueFlag && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700">Overdue</span>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <span className={cn(
                            'text-xs font-semibold',
                            wf.query_count > 0 ? 'text-amber-700' : 'text-ink-400'
                          )}>
                            {wf.query_count}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-center text-ink-400 text-xs">
                          {isExpanded ? '▲' : '▼'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Email Trail (expanded) */}
            {expandedWorkflow && (
              <div className="border-t border-surface-200/60 bg-surface-50/30 p-5">
                <h3 className="text-xs font-semibold text-ink-400 uppercase tracking-wide mb-4">Email Trail</h3>
                {expandedEmails.length === 0 ? (
                  <EmptyState message="No emails recorded for this workflow." />
                ) : (
                  <div className="space-y-3">
                    {expandedEmails.map(email => (
                      <div
                        key={email.id}
                        className="card-premium p-4"
                      >
                        <div className="flex items-start justify-between gap-4 mb-2">
                          <div className="flex items-center gap-3">
                            <span className={cn('px-2 py-0.5 rounded-md text-[10px] font-semibold', drawingEmailDirectionColor(email.direction))}>
                              {drawingEmailDirectionLabel(email.direction)}
                            </span>
                            <div className="text-xs">
                              <span className="font-medium text-ink-700">{email.from_name}</span>
                              <span className="text-ink-400"> → </span>
                              <span className="text-ink-600">{email.to_name}</span>
                            </div>
                          </div>
                          <span className="text-[11px] text-ink-400 whitespace-nowrap">{formatDate(email.sent_at)}</span>
                        </div>

                        <p className="text-xs font-semibold text-ink-900 mb-1">{email.subject}</p>
                        <p className="text-xs text-ink-500 line-clamp-2">{email.body_preview}</p>

                        {email.has_attachment && (
                          <div className="flex items-center gap-1.5 text-[11px] text-ink-500 mt-2 pt-2 border-t border-surface-200/60">
                            <span>📎</span>
                            <span>{email.attachment_names?.join(', ') ?? 'Attachment'}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Escalation Summary */}
      {escalatedWorkflows.length > 0 && (
        <div className="space-y-4 border-t border-surface-200/60 pt-10">
          <h2 className="font-display text-[1.5rem] text-ink-900">Escalated Issues</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {escalatedWorkflows.map(wf => {
              const escalatedToUser = wf.escalated_to_user_id ? getUser(wf.escalated_to_user_id) : undefined

              return (
                <div
                  key={wf.id}
                  className="card-premium border-2 border-red-200 p-5"
                >
                  <div className="flex items-start gap-3 mb-3">
                    <span className="text-red-500 text-lg">⚠</span>
                    <div>
                      <p className="text-[11px] text-ink-400 uppercase tracking-[0.08em] font-semibold">Drawing Reference</p>
                      <p className="text-sm font-mono font-semibold text-ink-900">{wf.drawing_ref}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <p className="text-[11px] text-ink-400 uppercase tracking-[0.08em] font-semibold mb-0.5">Issued To</p>
                      <p className="text-ink-700">{wf.issued_to_name}</p>
                    </div>
                    <div>
                      <p className="text-[11px] text-ink-400 uppercase tracking-[0.08em] font-semibold mb-0.5">Queries</p>
                      <p className="text-amber-700 font-semibold">{wf.query_count}</p>
                    </div>
                    <div>
                      <p className="text-[11px] text-ink-400 uppercase tracking-[0.08em] font-semibold mb-0.5">Response Due</p>
                      <p className="text-red-600 font-semibold">{formatDate(wf.response_due_date)}</p>
                    </div>
                    {escalatedToUser && (
                      <div>
                        <p className="text-[11px] text-ink-400 uppercase tracking-[0.08em] font-semibold mb-0.5">Escalated To</p>
                        <p className="text-red-700 font-semibold">{escalatedToUser.name}</p>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import { getProject, getProjectChangelog, getProjectComplianceStatements, getUser } from '@/lib/mock-data'
import { BRPDChangeType } from '@/lib/types'
import { cn, formatDate, brpdChangeTypeLabel, brpdChangeTypeColor, complianceStatementStatusColor, complianceStatementStatusLabel } from '@/lib/utils'

import { SummaryCard } from '@/components/SummaryCard'
import { StatusBadge } from '@/components/StatusBadge'
import { EmptyState } from '@/components/EmptyState'

const CHANGE_TYPE_FILTERS: (BRPDChangeType | 'All')[] = [
  'All', 'dutyholder_change', 'gateway_update', 'compliance_update', 'document_revision', 'requirement_update', 'evidence_upload'
]

const FILTER_LABELS: Record<string, string> = {
  All: 'All',
  dutyholder_change: 'Dutyholder',
  gateway_update: 'Gateway',
  compliance_update: 'Compliance',
  document_revision: 'Document',
  requirement_update: 'Requirement',
  evidence_upload: 'Evidence',
}

export default function BRPDChangelogPage() {
  const params = useParams()
  const projectId = params.id as string
  const project = getProject(projectId)
  const changelog = getProjectChangelog(projectId)
  const complianceStatements = getProjectComplianceStatements(projectId)
  const [activeFilter, setActiveFilter] = useState<BRPDChangeType | 'All'>('All')

  if (!project) {
    return <EmptyState message="Project not found." />
  }

  const filteredChangelog = activeFilter === 'All'
    ? changelog
    : changelog.filter(entry => entry.change_type === activeFilter)

  const approvedCount = changelog.filter(entry => entry.approved_flag).length
  const pendingCount = changelog.filter(entry => !entry.approved_flag).length

  return (
    <div className="space-y-6 sm:space-y-8 animate-fade-in">
      <div>
        <h1 className="font-display text-2xl sm:text-3xl text-ink-900">BRPD Changelog & Document Control</h1>
        <p className="text-sm text-ink-400 mt-1">Track all changes to dutyholders, gateways, compliance and documents</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        <SummaryCard
          value={changelog.length}
          label="Total Changes"
          bgColor="bg-surface-50"
          borderColor="border-surface-200"
          textColor="text-ink-900"
          labelColor="text-ink-400"
        />
        <SummaryCard
          value={approvedCount}
          label="Approved"
          bgColor="bg-emerald-50"
          borderColor="border-emerald-200"
          textColor="text-emerald-700"
          labelColor="text-emerald-600"
        />
        <SummaryCard
          value={pendingCount}
          label="Pending Approval"
          bgColor="bg-amber-50"
          borderColor="border-amber-200"
          textColor="text-amber-700"
          labelColor="text-amber-600"
        />
      </div>

      {/* Changelog Timeline */}
      <div className="space-y-4 border-t border-surface-200/60 pt-10">
        <h2 className="font-display text-[1.5rem] text-ink-900">Changelog Timeline</h2>

        {/* Filter Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-2">
          {CHANGE_TYPE_FILTERS.map(filter => (
            <button
              key={filter}
              onClick={() => setActiveFilter(filter)}
              className={cn(
                'px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors',
                activeFilter === filter
                  ? 'bg-ink-900 text-white'
                  : 'bg-white border border-surface-200 text-ink-600 hover:bg-surface-50'
              )}
            >
              {FILTER_LABELS[filter]}
            </button>
          ))}
        </div>

        {/* Changelog Entries */}
        {filteredChangelog.length === 0 ? (
          <EmptyState message="No changelog entries match this filter." />
        ) : (
          <div className="space-y-4">
            {filteredChangelog.map(entry => {
              const changedByUser = getUser(entry.changed_by_user_id)
              const approvedByUser = entry.approved_by_user_id ? getUser(entry.approved_by_user_id) : undefined

              return (
                <div
                  key={entry.id}
                  className="card-premium p-5"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <span className={cn('px-2 py-0.5 rounded-md text-[10px] font-semibold', brpdChangeTypeColor(entry.change_type))}>
                        {brpdChangeTypeLabel(entry.change_type)}
                      </span>
                      <h3 className="text-sm font-semibold text-ink-900">{entry.title}</h3>
                    </div>
                    {entry.approved_flag ? (
                      <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                        Approved
                      </span>
                    ) : (
                      <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md">
                        Pending
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-ink-600 mb-3">{entry.description}</p>

                  {entry.previous_value && entry.new_value && (
                    <div className="bg-surface-50 rounded-lg p-3 mb-3 border border-surface-200/60">
                      <p className="text-[11px] text-ink-400 uppercase tracking-[0.08em] font-semibold mb-2">Change Details</p>
                      <div className="flex items-center gap-3 text-xs">
                        <span className="text-ink-500">Previous:</span>
                        <code className="bg-white px-2 py-0.5 rounded text-ink-700 text-[11px] font-mono border border-surface-200">{entry.previous_value}</code>
                        <span className="text-ink-300">→</span>
                        <span className="text-ink-500">New:</span>
                        <code className="bg-white px-2 py-0.5 rounded text-ink-700 text-[11px] font-mono border border-surface-200">{entry.new_value}</code>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between text-[11px] text-ink-400">
                    <div className="space-y-0.5">
                      <p>Changed by <span className="font-medium text-ink-600">{changedByUser?.name ?? 'Unknown'}</span></p>
                      {entry.approved_flag && approvedByUser && (
                        <p>Approved by <span className="font-medium text-ink-600">{approvedByUser.name}</span></p>
                      )}
                    </div>
                    <p>{formatDate(entry.changed_at)}</p>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Document Control Summary */}
      <div className="space-y-4 border-t border-surface-200/60 pt-10">
        <h2 className="font-display text-[1.5rem] text-ink-900">Document Control Summary</h2>

        {complianceStatements.length === 0 ? (
          <EmptyState message="No compliance statements found for this project." />
        ) : (
          <div className="card-premium overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-surface-50 border-b border-surface-200/60">
                  <tr>
                    <th className="text-left px-5 py-3 text-[11px] font-semibold text-ink-400 uppercase tracking-wide">Title</th>
                    <th className="text-left px-5 py-3 text-[11px] font-semibold text-ink-400 uppercase tracking-wide">Status</th>
                    <th className="text-left px-5 py-3 text-[11px] font-semibold text-ink-400 uppercase tracking-wide">Last Updated</th>
                    <th className="text-right px-5 py-3 text-[11px] font-semibold text-ink-400 uppercase tracking-wide">Evidence Docs</th>
                  </tr>
                </thead>
                <tbody>
                  {complianceStatements.map((cs, idx) => (
                    <tr
                      key={cs.id}
                      className={cn(
                        'stripe-row bg-white',
                        idx !== complianceStatements.length - 1 && 'border-b border-surface-200/60'
                      )}
                    >
                      <td className="px-5 py-4 text-ink-700 font-medium">{cs.title}</td>
                      <td className="px-5 py-4">
                        <StatusBadge
                          label={complianceStatementStatusLabel(cs.status)}
                          colorClass={complianceStatementStatusColor(cs.status)}
                        />
                      </td>
                      <td className="px-5 py-4 text-ink-500">{formatDate(cs.updated_at)}</td>
                      <td className="px-5 py-4 text-right">
                        <span className="inline-flex items-center justify-center w-7 h-7 bg-blue-50 text-blue-700 rounded-lg text-xs font-semibold">
                          {cs.evidence_document_ids.length}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

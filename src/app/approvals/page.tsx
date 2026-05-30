'use client'

import { useState } from 'react'
import Link from 'next/link'
import { APPROVALS, getUser, getProject } from '@/lib/mock-data'
import { cn, approvalStatusColor, approvalStatusLabel, formatDate } from '@/lib/utils'
import { Breadcrumb } from '@/components/Breadcrumb'
import { SummaryCard } from '@/components/SummaryCard'
import { TabBar } from '@/components/TabBar'
import { StatusBadge } from '@/components/StatusBadge'
import { EmptyState } from '@/components/EmptyState'

type FilterTab = 'pending' | 'returned' | 'approved' | 'all'

export default function ApprovalsQueuePage() {
  const [activeTab, setActiveTab] = useState<FilterTab>('pending')

  const tabs: { key: FilterTab; label: string; count: number }[] = [
    { key: 'pending', label: 'Awaiting Review', count: APPROVALS.filter(a => a.status === 'pending').length },
    { key: 'returned', label: 'Returned', count: APPROVALS.filter(a => a.status === 'returned').length },
    { key: 'approved', label: 'Recently Approved', count: APPROVALS.filter(a => a.status === 'approved').length },
    { key: 'all', label: 'All', count: APPROVALS.length },
  ]

  const filtered = activeTab === 'all'
    ? APPROVALS
    : APPROVALS.filter(a => a.status === activeTab)

  const sorted = [...filtered].sort((a, b) => {
    if (a.status === 'pending' && b.status !== 'pending') return -1
    if (a.status !== 'pending' && b.status === 'pending') return 1
    return new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime()
  })

  return (
    <div className="space-y-6 sm:space-y-8 animate-fade-in">
      <Breadcrumb items={[
        { label: 'Dashboard', href: '/' },
        { label: 'Approvals' },
      ]} />

      <div>
        <h1 className="font-display text-[2rem] sm:text-[2.5rem] text-ink-900">Approvals Queue</h1>
        <p className="text-[13px] text-ink-400 mt-1">{tabs[0].count} items awaiting review</p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <SummaryCard value={tabs[0].count} label="Pending" bgColor="bg-amber-50" borderColor="border-amber-200" textColor="text-amber-700" labelColor="text-amber-600" />
        <SummaryCard value={tabs[1].count} label="Returned" bgColor="bg-red-50" borderColor="border-red-200" textColor="text-red-700" labelColor="text-red-600" />
        <SummaryCard value={tabs[2].count} label="Approved" bgColor="bg-emerald-50" borderColor="border-emerald-200" textColor="text-emerald-700" labelColor="text-emerald-600" />
      </div>

      <TabBar tabs={tabs} activeKey={activeTab} onSelect={(key) => setActiveTab(key as FilterTab)} />

      <div className="space-y-3">
        {sorted.length === 0 ? (
          <EmptyState message="No items in this category." />
        ) : (
          sorted.map(approval => {
            const submitter = getUser(approval.submitted_by_user_id)
            const project = getProject(approval.project_id)
            const reviewer = getUser(approval.reviewer_user_id)

            return (
              <div
                key={approval.id}
                className={cn(
                  'card-premium p-5 transition-colors',
                  approval.status === 'pending' ? 'border-amber-200 hover:border-amber-300' :
                  approval.status === 'returned' ? 'border-red-200 hover:border-red-300' :
                  ''
                )}
              >
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1.5">
                      <StatusBadge label={approvalStatusLabel(approval.status)} colorClass={approvalStatusColor(approval.status)} />
                      <span className="text-[10px] font-medium text-slate-400 uppercase">
                        {approval.item_type}
                      </span>
                    </div>

                    <h3 className="text-sm font-semibold text-slate-900 truncate">{approval.item_title}</h3>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs text-slate-400">
                      {project && (
                        <Link href={`/projects/${project.id}`} className="hover:text-brand-600 transition-colors">
                          {project.name}
                        </Link>
                      )}
                      {submitter && <span>Submitted by <span className="text-slate-600">{submitter.name}</span></span>}
                      <span>{formatDate(approval.submitted_at)}</span>
                    </div>

                    {approval.reviewer_comments && (
                      <div className="mt-3 p-3 bg-red-50 border border-red-100 rounded-lg">
                        <p className="text-xs font-medium text-red-800 mb-0.5">Review Comments</p>
                        <p className="text-xs text-red-700">{approval.reviewer_comments}</p>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2 shrink-0">
                    {approval.status === 'pending' && (
                      <>
                        <button className="px-3 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors">
                          Approve
                        </button>
                        <button className="px-3 py-1.5 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors">
                          Return
                        </button>
                      </>
                    )}
                    {approval.status === 'approved' && approval.reviewed_at && (
                      <span className="text-[11px] text-slate-400">
                        Approved {formatDate(approval.reviewed_at)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import { PROJECTS, getProjectSiteQueries, getUser } from '@/lib/mock-data'
import { SiteQueryStatus } from '@/lib/types'
import { cn, siteQueryStatusColor, formatDate, isOverdue } from '@/lib/utils'

import { SummaryCard } from '@/components/SummaryCard'
import { TabBar } from '@/components/TabBar'
import { StatusBadge } from '@/components/StatusBadge'
import { EmptyState } from '@/components/EmptyState'

type FilterTab = SiteQueryStatus | 'all'

export default function SiteQueriesPage() {
  const params = useParams()
  const project = PROJECTS.find(p => p.id === params.id)
  const [activeTab, setActiveTab] = useState<FilterTab>('all')

  if (!project) return <EmptyState message="Project not found." />

  const queries = getProjectSiteQueries(project.id)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

  const filtered = activeTab === 'all' ? queries : queries.filter(q => q.status === activeTab)

  const openCount = queries.filter(q => q.status === 'open').length
  const respondedCount = queries.filter(q => q.status === 'responded').length
  const overdueCount = queries.filter(q => q.status === 'open' && isOverdue(q.due_date)).length

  const tabs: { key: FilterTab; label: string; count: number }[] = [
    { key: 'all', label: 'All', count: queries.length },
    { key: 'open', label: 'Open', count: openCount },
    { key: 'responded', label: 'Responded', count: respondedCount },
    { key: 'closed', label: 'Closed', count: queries.filter(q => q.status === 'closed').length },
  ]

  return (
    <div className="space-y-6 sm:space-y-8 animate-fade-in">
      <div>
        <h1 className="text-[2rem] sm:text-[2.5rem] font-display font-bold text-ink-900">Site Queries</h1>
        <p className="text-sm text-slate-500 mt-1">{project.name} — site-to-office workflow</p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <SummaryCard value={openCount} label="Open" bgColor="bg-red-50" borderColor="border-red-200" textColor="text-red-700" labelColor="text-red-600" />
        <SummaryCard value={respondedCount} label="Responded" bgColor="bg-blue-50" borderColor="border-blue-200" textColor="text-blue-700" labelColor="text-blue-600" />
        <SummaryCard value={overdueCount} label="Overdue" bgColor="bg-amber-50" borderColor="border-amber-200" textColor="text-amber-700" labelColor="text-amber-600" />
      </div>

      {/* Quick-add form */}
      <div className="card-premium p-5">
        <h2 className="text-[15px] font-semibold text-ink-900 mb-3">Raise a Query</h2>
        <div className="space-y-3">
          <input
            type="text"
            placeholder="Query title..."
            className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
          />
          <textarea
            placeholder="Describe the query..."
            rows={3}
            className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent resize-none"
          />
          <div className="flex gap-3">
            <input
              type="date"
              className="flex-1 px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
            />
            <button className="px-4 py-2.5 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 transition-colors">
              Submit Query
            </button>
          </div>
        </div>
      </div>

      <TabBar tabs={tabs} activeKey={activeTab} onSelect={(key) => setActiveTab(key as FilterTab)} />

      <div className="space-y-3">
        {filtered.length === 0 ? (
          <EmptyState message="No queries in this category." />
        ) : (
          filtered.map(query => {
            const raisedBy = getUser(query.raised_by_user_id)
            const owner = getUser(query.owner_user_id)
            const overdue = query.status === 'open' && isOverdue(query.due_date)

            return (
              <div key={query.id} className={cn(
                'card-premium p-5',
                overdue ? 'border-red-200' : ''
              )}>
                <div className="flex items-center gap-2 mb-1.5">
                  <StatusBadge label={query.status} colorClass={siteQueryStatusColor(query.status)} />
                  {overdue && (
                    <span className="text-[10px] font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded">OVERDUE</span>
                  )}
                </div>

                <h3 className="text-sm font-semibold text-slate-900">{query.title}</h3>
                <p className="text-xs text-slate-500 mt-1">{query.description}</p>

                {query.response_notes && (
                  <div className="p-2.5 bg-emerald-50 border border-emerald-100 rounded-lg mt-3">
                    <p className="text-[10px] font-bold text-emerald-600 uppercase mb-0.5">Response</p>
                    <p className="text-xs text-emerald-800">{query.response_notes}</p>
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-4 mt-2 text-xs text-slate-400">
                  {raisedBy && <span>Raised by: <span className="text-slate-600">{raisedBy.name}</span></span>}
                  {owner && <span>Owner: <span className="text-slate-600">{owner.name}</span></span>}
                  <span className={cn(overdue ? 'text-red-600 font-medium' : '')}>
                    Due: {formatDate(query.due_date)}
                  </span>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

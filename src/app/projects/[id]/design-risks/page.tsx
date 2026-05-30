'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import { PROJECTS, getProjectDesignRisks, getUser } from '@/lib/mock-data'
import { DesignRiskReviewStatus, RIBA_STAGES } from '@/lib/types'
import { cn, designRiskStatusColor, formatDate } from '@/lib/utils'

import { SummaryCard } from '@/components/SummaryCard'
import { TabBar } from '@/components/TabBar'
import { StatusBadge } from '@/components/StatusBadge'
import { EmptyState } from '@/components/EmptyState'

export default function DesignRiskPage() {
  const params = useParams()
  const project = PROJECTS.find(p => p.id === params.id)
  const [filterStatus, setFilterStatus] = useState<DesignRiskReviewStatus | 'all'>('all')

  if (!project) return <EmptyState message="Project not found." />

  const risks = getProjectDesignRisks(project.id)
  const filtered = filterStatus === 'all' ? risks : risks.filter(r => r.review_status === filterStatus)

  const openCount = risks.filter(r => r.review_status === 'open').length
  const reviewCount = risks.filter(r => r.review_status === 'under_review').length
  const significantCount = risks.filter(r => r.unusual_or_significant_flag).length

  const statusFilters: { key: string; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'open', label: 'Open' },
    { key: 'under_review', label: 'Under Review' },
    { key: 'accepted', label: 'Accepted' },
    { key: 'closed', label: 'Closed' },
  ]

  return (
    <div className="space-y-6 sm:space-y-8 animate-fade-in">
      <div>
        <h1 className="text-[2rem] sm:text-[2.5rem] font-display font-bold text-ink-900">Design Risk Workspace</h1>
        <p className="text-sm text-slate-500 mt-1">{project.name} — Stage {project.current_stage} {RIBA_STAGES[project.current_stage]}</p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <SummaryCard value={openCount} label="Open" bgColor="bg-red-50" borderColor="border-red-200" textColor="text-red-700" labelColor="text-red-600" />
        <SummaryCard value={reviewCount} label="Under Review" bgColor="bg-amber-50" borderColor="border-amber-200" textColor="text-amber-700" labelColor="text-amber-600" />
        <SummaryCard value={significantCount} label="Significant" bgColor="bg-violet-50" borderColor="border-violet-200" textColor="text-violet-700" labelColor="text-violet-600" />
      </div>

      <TabBar tabs={statusFilters} activeKey={filterStatus} onSelect={(key) => setFilterStatus(key as DesignRiskReviewStatus | 'all')} />

      <div className="space-y-3">
        {filtered.length === 0 ? (
          <EmptyState message="No design risks in this category." />
        ) : (
          filtered.map(risk => {
            const owner = getUser(risk.owner_user_id)
            return (
              <div key={risk.id} className={cn(
                'card-premium p-5',
                risk.unusual_or_significant_flag ? 'border-violet-200' : ''
              )}>
                <div className="flex items-start gap-3">
                  {risk.unusual_or_significant_flag && (
                    <span className="mt-0.5 shrink-0 w-2 h-2 rounded-full bg-violet-500" title="Unusual or significant" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1.5">
                      <StatusBadge label={risk.review_status.replace('_', ' ')} colorClass={designRiskStatusColor(risk.review_status)} />
                      <span className="text-[10px] font-medium text-slate-400">Stage {risk.stage_code}</span>
                      {risk.unusual_or_significant_flag && (
                        <span className="text-[10px] font-bold text-violet-600 bg-violet-50 px-1.5 py-0.5 rounded">SIGNIFICANT</span>
                      )}
                    </div>
                    <h3 className="text-sm font-semibold text-slate-900">{risk.title}</h3>
                    <p className="text-xs text-slate-500 mt-1">{risk.description}</p>

                    <div className="p-2.5 bg-slate-50 rounded-lg mt-3">
                      <p className="text-[10px] font-bold text-slate-400 uppercase mb-0.5">Mitigation</p>
                      <p className="text-xs text-slate-700">{risk.mitigation}</p>
                    </div>

                    {risk.residual_risk_note && (
                      <div className="p-2.5 bg-amber-50 rounded-lg mt-2">
                        <p className="text-[10px] font-bold text-amber-500 uppercase mb-0.5">Residual Risk</p>
                        <p className="text-xs text-amber-700">{risk.residual_risk_note}</p>
                      </div>
                    )}

                    <div className="flex items-center gap-4 mt-2 text-xs text-slate-400">
                      {owner && <span>Owner: <span className="text-slate-600">{owner.name}</span></span>}
                      <span>Updated: {formatDate(risk.updated_at)}</span>
                    </div>
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

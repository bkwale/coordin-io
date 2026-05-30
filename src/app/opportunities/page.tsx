'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { getOpportunities, getUser, getOpportunityQuotes } from '@/lib/mock-data'
import { Opportunity, OpportunityStatus } from '@/lib/types'
import { cn, formatDate, formatCurrency, opportunityStatusColor, opportunityStatusLabel } from '@/lib/utils'
import { Breadcrumb } from '@/components/Breadcrumb'
import { SummaryCard } from '@/components/SummaryCard'
import { StatusBadge } from '@/components/StatusBadge'
import { TabBar } from '@/components/TabBar'
import { EmptyState } from '@/components/EmptyState'

export default function OpportunitiesPage() {
  const opportunities = getOpportunities()
  const [activeTab, setActiveTab] = useState<'all' | 'active' | 'won' | 'lost'>('all')

  // Status definitions
  const ACTIVE_STATUSES: OpportunityStatus[] = ['lead', 'qualifying', 'proposal_sent', 'negotiation']
  const WON_STATUSES: OpportunityStatus[] = ['won']
  const LOST_STATUSES: OpportunityStatus[] = ['lost']

  // Filter opportunities
  const filtered = useMemo(() => {
    if (activeTab === 'active') {
      return opportunities.filter(o => ACTIVE_STATUSES.includes(o.status))
    }
    if (activeTab === 'won') {
      return opportunities.filter(o => WON_STATUSES.includes(o.status))
    }
    if (activeTab === 'lost') {
      return opportunities.filter(o => LOST_STATUSES.includes(o.status))
    }
    return opportunities
  }, [activeTab])

  // Sort: active first, then by likelihood descending
  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const aIsActive = ACTIVE_STATUSES.includes(a.status)
      const bIsActive = ACTIVE_STATUSES.includes(b.status)
      if (aIsActive !== bIsActive) return aIsActive ? -1 : 1
      return (b.likelihood_percentage || 0) - (a.likelihood_percentage || 0)
    })
  }, [filtered])

  // Calculate summary metrics
  const summaries = useMemo(() => {
    const active = opportunities.filter(o => !['won', 'lost', 'dormant'].includes(o.status))
    const won = opportunities.filter(o => o.status === 'won')
    const lost = opportunities.filter(o => o.status === 'lost')

    // Total Pipeline Value: sum of estimated_value where not lost/dormant, weighted by likelihood
    const totalPipelineValue = opportunities
      .filter(o => !['lost', 'dormant'].includes(o.status))
      .reduce((sum, o) => {
        const likelihood = (o.likelihood_percentage || 0) / 100
        return sum + ((o.estimated_value || 0) * likelihood)
      }, 0)

    // Win Rate
    const winRate = won.length + lost.length > 0 ? (won.length / (won.length + lost.length)) * 100 : 0

    // Proposals Sent
    const proposalsSent = opportunities.filter(o => {
      const statuses: OpportunityStatus[] = ['proposal_sent', 'negotiation', 'won']
      return statuses.includes(o.status)
    }).length

    return {
      totalPipelineValue,
      activeOpportunities: active.length,
      winRate,
      proposalsSent,
    }
  }, [opportunities])

  // Pipeline stages with colors
  const pipelineStages = useMemo(() => {
    const stages = [
      { key: 'lead', label: 'Lead', color: 'bg-slate-400' },
      { key: 'qualifying', label: 'Qualifying', color: 'bg-blue-500' },
      { key: 'proposal_sent', label: 'Proposal Sent', color: 'bg-indigo-500' },
      { key: 'negotiation', label: 'Negotiation', color: 'bg-amber-500' },
      { key: 'won', label: 'Won', color: 'bg-emerald-500' },
    ]

    const stageCounts = stages.map(stage => ({
      ...stage,
      count: opportunities.filter(o => o.status === stage.key as OpportunityStatus).length,
      value: opportunities
        .filter(o => o.status === stage.key as OpportunityStatus)
        .reduce((sum, o) => sum + (o.estimated_value || 0), 0),
    }))

    const totalValue = stageCounts.reduce((sum, s) => sum + s.value, 0)

    return stageCounts.map(s => ({
      ...s,
      widthPercent: totalValue > 0 ? (s.value / totalValue) * 100 : 0,
    }))
  }, [opportunities])

  // Tab counts
  const tabCounts = {
    all: opportunities.length,
    active: opportunities.filter(o => ACTIVE_STATUSES.includes(o.status)).length,
    won: opportunities.filter(o => o.status === 'won').length,
    lost: opportunities.filter(o => o.status === 'lost').length,
  }

  const winLossOpportunities = opportunities.filter(o => ['won', 'lost'].includes(o.status))

  return (
    <div className="max-w-6xl animate-fade-in">
      {/* ━━━ BREADCRUMB & HEADER ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section className="pb-12">
        <Breadcrumb
          items={[
            { label: 'Dashboard', href: '/' },
            { label: 'Opportunities' },
          ]}
        />
        <div className="mt-6">
          <h1 className="font-display text-[2rem] text-ink-900">
            Opportunities & Proposals
          </h1>
          <p className="text-[13px] text-ink-400 mt-1">{opportunities.length} opportunities &middot; {summaries.activeOpportunities} active</p>
        </div>
      </section>

      {/* ━━━ SUMMARY CARDS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section className="pb-16">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="card-premium p-4 text-center">
            <p className="text-2xl font-light tracking-tight text-ink-900">{formatCurrency(summaries.totalPipelineValue)}</p>
            <p className="text-[11px] text-ink-400 font-medium mt-1.5 tracking-wide">Total Pipeline Value</p>
          </div>
          <div className="card-premium p-4 text-center">
            <p className="text-2xl font-light tracking-tight text-ink-900">{summaries.activeOpportunities}</p>
            <p className="text-[11px] text-ink-400 font-medium mt-1.5 tracking-wide">Active Opportunities</p>
          </div>
          <div className="card-premium p-4 text-center">
            <p className="text-2xl font-light tracking-tight text-ink-900">{summaries.winRate.toFixed(0)}%</p>
            <p className="text-[11px] text-ink-400 font-medium mt-1.5 tracking-wide">Win Rate</p>
          </div>
          <div className="card-premium p-4 text-center">
            <p className="text-2xl font-light tracking-tight text-ink-900">{summaries.proposalsSent}</p>
            <p className="text-[11px] text-ink-400 font-medium mt-1.5 tracking-wide">Proposals Sent</p>
          </div>
        </div>
      </section>

      {/* ━━━ PIPELINE VISUALIZATION ━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section className="pb-16">
        <div className="card-premium p-6">
          <h2 className="font-display text-[1.25rem] text-ink-900 mb-6">Sales Pipeline</h2>

          {/* Visual Pipeline */}
          <div className="flex items-end gap-2 h-24 mb-6">
            {pipelineStages.map((stage, i) => (
              <div
                key={stage.key}
                className="flex-1 flex flex-col items-center gap-2 group"
                style={{ minHeight: '80px' }}
              >
                {/* Bar */}
                <div
                  className={cn('w-full rounded-t-xl transition-opacity group-hover:opacity-80', stage.color)}
                  style={{
                    minHeight: '40px',
                    height: `${Math.max(20, (stage.count / Math.max(...pipelineStages.map(s => s.count))) * 60)}px`,
                  }}
                  title={`${stage.label}: ${stage.count} opportunities, ${formatCurrency(stage.value)}`}
                />
                {/* Label */}
                <div className="text-center text-[10px]">
                  <p className="font-semibold text-ink-900">{stage.count}</p>
                  <p className="text-ink-300 uppercase tracking-wider">{stage.label}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Value breakdown */}
          <div className="border-t border-surface-200 pt-4">
            <div className="grid grid-cols-5 gap-2 text-[10px]">
              {pipelineStages.map(stage => (
                <div key={stage.key} className="text-center">
                  <p className="font-semibold text-ink-900">{formatCurrency(stage.value)}</p>
                  <p className="text-ink-300 mt-0.5">
                    {stage.widthPercent.toFixed(0)}% of total
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ━━━ OPPORTUNITY LIST ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section className="pb-16">
        <div className="mb-6">
          <h2 className="font-display text-[1.25rem] text-ink-900 mb-4">Opportunities</h2>
          <TabBar
            tabs={[
              { key: 'all', label: 'All', count: tabCounts.all },
              { key: 'active', label: 'Active', count: tabCounts.active },
              { key: 'won', label: 'Won', count: tabCounts.won },
              { key: 'lost', label: 'Lost', count: tabCounts.lost },
            ]}
            activeKey={activeTab}
            onSelect={(key) => setActiveTab(key as 'all' | 'active' | 'won' | 'lost')}
          />
        </div>

        {sorted.length === 0 ? (
          <EmptyState message="No opportunities in this category." />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {sorted.map(opportunity => {
              const owner = opportunity.owner_user_id ? getUser(opportunity.owner_user_id) : undefined
              const quotes = getOpportunityQuotes(opportunity.id)

              return (
                <div
                  key={opportunity.id}
                  className="card-premium p-5 hover:shadow-card-hover transition-all"
                >
                  {/* Title & Client */}
                  <div className="mb-3">
                    <h3 className="text-[13px] font-semibold text-ink-900">
                      {opportunity.title}
                    </h3>
                    <p className="text-[11px] text-ink-400 mt-1">
                      {opportunity.client_name}
                    </p>
                  </div>

                  {/* Badges */}
                  <div className="flex flex-wrap gap-2 mb-4">
                    <StatusBadge
                      label={opportunity.sector}
                      colorClass="bg-surface-100 text-ink-600"
                      uppercase={false}
                    />
                    <StatusBadge
                      label={opportunityStatusLabel(opportunity.status)}
                      colorClass={opportunityStatusColor(opportunity.status)}
                    />
                  </div>

                  {/* Estimated Value */}
                  <div className="mb-4">
                    <p className="text-[11px] text-ink-400 mb-1">Estimated Value</p>
                    <p className="font-display text-[1.25rem] text-ink-900">
                      {formatCurrency(opportunity.estimated_value || 0)}
                    </p>
                  </div>

                  {/* Likelihood Bar */}
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-[10px] text-ink-400">Likelihood</p>
                      <p className="text-[10px] font-semibold text-ink-600">
                        {opportunity.likelihood_percentage || 0}%
                      </p>
                    </div>
                    <div className="w-full bg-surface-200 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="bg-accent-500 h-full rounded-full transition-all"
                        style={{
                          width: `${opportunity.likelihood_percentage || 0}%`,
                        }}
                      />
                    </div>
                  </div>

                  {/* Expected Start Date */}
                  <div className="mb-3">
                    <p className="text-[10px] text-ink-400">Expected Start</p>
                    <p className="text-[12px] text-ink-700 font-medium">
                      {opportunity.expected_start_date ? formatDate(opportunity.expected_start_date) : '—'}
                    </p>
                  </div>

                  {/* Owner */}
                  {owner && (
                    <div className="mb-3">
                      <p className="text-[10px] text-ink-400">Owner</p>
                      <p className="text-[12px] text-ink-700 font-medium">
                        {owner.name}
                      </p>
                    </div>
                  )}

                  {/* Linked Quotes */}
                  {quotes.length > 0 && (
                    <div className="mb-3 pb-3 border-b border-surface-200">
                      <p className="text-[10px] text-ink-400">
                        Linked Quotes
                      </p>
                      <p className="text-[12px] text-ink-700 font-medium">
                        {quotes.length} quote{quotes.length > 1 ? 's' : ''}
                      </p>
                    </div>
                  )}

                  {/* Notes */}
                  {opportunity.notes && (
                    <p className="text-[11px] text-ink-500 line-clamp-2">
                      {opportunity.notes}
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* ━━━ WIN/LOSS LOG ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {winLossOpportunities.length > 0 && (
        <section className="pb-16">
          <div className="border-t border-surface-200/60 pt-10 mt-10">
            <h2 className="font-display text-[1.25rem] text-ink-900 mb-6">Win/Loss Log</h2>

            <div className="overflow-x-auto">
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="border-b border-surface-200">
                    <th className="px-4 py-3 text-left text-ink-400 font-semibold uppercase tracking-wide">Title</th>
                    <th className="px-4 py-3 text-left text-ink-400 font-semibold uppercase tracking-wide">Client</th>
                    <th className="px-4 py-3 text-left text-ink-400 font-semibold uppercase tracking-wide">Value</th>
                    <th className="px-4 py-3 text-left text-ink-400 font-semibold uppercase tracking-wide">Status</th>
                    <th className="px-4 py-3 text-left text-ink-400 font-semibold uppercase tracking-wide">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {winLossOpportunities.map(opportunity => (
                    <tr
                      key={opportunity.id}
                      className={cn(
                        'border-b border-surface-200/40 transition-colors stripe-row',
                        opportunity.status === 'won' ? 'bg-emerald-50/30' : 'bg-red-50/30'
                      )}
                    >
                      <td className="px-4 py-3 font-medium text-ink-900">
                        {opportunity.title}
                      </td>
                      <td className="px-4 py-3 text-ink-600">
                        {opportunity.client_name}
                      </td>
                      <td className="px-4 py-3 font-display text-ink-900">
                        {formatCurrency(opportunity.estimated_value || 0)}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge
                          label={opportunityStatusLabel(opportunity.status)}
                          colorClass={cn(
                            opportunity.status === 'won'
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-red-100 text-red-700'
                          )}
                        />
                      </td>
                      <td className="px-4 py-3 text-ink-500 max-w-xs truncate">
                        {opportunity.notes || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}
    </div>
  )
}

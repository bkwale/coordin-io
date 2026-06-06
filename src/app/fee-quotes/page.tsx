'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { getFeeQuoteRecords, getUser, PROJECTS, getOpportunity } from '@/lib/mock-data'
import { FeeQuoteRecord, FeeQuoteStatus } from '@/lib/types'
import { cn, formatDate, formatCurrency, feeQuoteStatusColor, feeQuoteStatusLabel, timeAgo, quoteNeedsFollowUp, quoteTemplateTypeColor, quoteTemplateTypeLabel, quoteModeLabel } from '@/lib/utils'
import { Breadcrumb } from '@/components/Breadcrumb'
import { TabBar } from '@/components/TabBar'

// Eye icon SVG
const EyeIcon = ({ className = 'w-3 h-3' }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
  </svg>
)

export default function FeeQuotesPage() {
  const quotes = getFeeQuoteRecords()
  const [activeTab, setActiveTab] = useState<string>('all')

  // Filter quotes by status
  const filteredQuotes = useMemo(() => {
    if (activeTab === 'all') return quotes
    return quotes.filter(q => q.status === activeTab)
  }, [quotes, activeTab])

  // Calculate summary metrics
  const totalQuotes = quotes.length
  const sentViewedQuotes = quotes.filter(q => q.status === 'sent' || q.status === 'viewed')
  const pipelineValue = sentViewedQuotes.reduce((sum, q) => sum + q.total_fee, 0)
  const acceptedQuotes = quotes.filter(q => q.status === 'accepted')
  const acceptedValue = acceptedQuotes.reduce((sum, q) => sum + q.total_fee, 0)
  const declinedExpiredQuotes = quotes.filter(q => q.status === 'declined' || q.status === 'expired')
  const conversionRate = (acceptedQuotes.length + declinedExpiredQuotes.length) > 0
    ? Math.round((acceptedQuotes.length / (acceptedQuotes.length + declinedExpiredQuotes.length)) * 100)
    : 0

  // Tab counts including expired
  const tabCounts = {
    all: quotes.length,
    draft: quotes.filter(q => q.status === 'draft').length,
    sent: quotes.filter(q => q.status === 'sent').length,
    viewed: quotes.filter(q => q.status === 'viewed').length,
    accepted: quotes.filter(q => q.status === 'accepted').length,
    declined: quotes.filter(q => q.status === 'declined').length,
    expired: quotes.filter(q => q.status === 'expired').length,
  }

  const tabs = [
    { key: 'all', label: 'All', count: tabCounts.all },
    { key: 'draft', label: 'Draft', count: tabCounts.draft },
    { key: 'sent', label: 'Sent', count: tabCounts.sent },
    { key: 'viewed', label: 'Viewed', count: tabCounts.viewed },
    { key: 'accepted', label: 'Accepted', count: tabCounts.accepted },
    { key: 'declined', label: 'Declined', count: tabCounts.declined },
    { key: 'expired', label: 'Expired', count: tabCounts.expired },
  ]

  return (
    <div className="bg-surface-50 min-h-screen animate-fade-in">
      <div className="max-w-6xl mx-auto px-0 py-0">
        {/* ━━━ BREADCRUMB ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        <section className="pt-10 pb-6">
          <Breadcrumb items={[{ label: 'Fee Quotes' }]} />
        </section>

        {/* ━━━ HEADER ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        <section className="px-10 pb-8 flex items-start justify-between">
          <div>
            <h1 className="font-display text-3xl font-semibold text-ink-900 mb-2">Fee Quotes</h1>
            <p className="text-[13px] text-ink-400 mt-1">{totalQuotes} quotes &middot; {formatCurrency(pipelineValue)} in pipeline</p>
          </div>
          <Link
            href="/fee-quotes/new"
            className="bg-ink-900 text-white px-5 py-2.5 rounded-lg font-medium text-[14px] hover:bg-ink-800 transition-colors"
          >
            New Quote
          </Link>
        </section>

        {/* ━━━ SUMMARY BAR ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        <section className="border-t border-slate-300 px-10 py-8">
          <div className="flex items-center justify-start gap-12">
            <div className="flex flex-col">
              <p className="text-[12px] text-ink-400 font-medium uppercase tracking-wide mb-1">Total Quotes</p>
              <p className="text-2xl font-light text-ink-900">{totalQuotes}</p>
            </div>
            <div className="border-r border-slate-300 h-10"></div>
            <div className="flex flex-col">
              <p className="text-[12px] text-ink-400 font-medium uppercase tracking-wide mb-1">Pipeline Value</p>
              <p className="text-2xl font-light text-ink-900">{formatCurrency(pipelineValue)}</p>
            </div>
            <div className="border-r border-slate-300 h-10"></div>
            <div className="flex flex-col">
              <p className="text-[12px] text-ink-400 font-medium uppercase tracking-wide mb-1">Won Value</p>
              <p className="text-2xl font-light text-ink-900">{formatCurrency(acceptedValue)}</p>
            </div>
            <div className="border-r border-slate-300 h-10"></div>
            <div className="flex flex-col">
              <p className="text-[12px] text-ink-400 font-medium uppercase tracking-wide mb-1">Conversion Rate</p>
              <p className="text-2xl font-light text-ink-900">{conversionRate}%</p>
            </div>
          </div>
        </section>

        {/* ━━━ TAB BAR ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        <section className="border-t border-slate-300 px-10 py-6">
          <TabBar tabs={tabs} activeKey={activeTab} onSelect={setActiveTab} />
        </section>

        {/* ━━━ QUOTE CARDS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        <section className="px-10 pb-20">
          {filteredQuotes.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-ink-400 text-[14px] mb-2">No quotes found</p>
              <p className="text-ink-300 text-[13px]">
                {activeTab !== 'all' ? `Try selecting a different status` : `Get started by creating a new quote`}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {filteredQuotes.map((quote) => {
                const project = quote.related_project_id ? PROJECTS.find(p => p.id === quote.related_project_id) : null
                const opportunity = quote.related_opportunity_id ? getOpportunity(quote.related_opportunity_id) : null
                const preparedBy = getUser(quote.prepared_by_user_id)
                const needsFollowUp = quoteNeedsFollowUp(quote)

                return (
                  <Link
                    key={quote.id}
                    href={`/fee-quotes/${quote.id}`}
                    className="card-premium p-5 hover:border-accent-200 transition-all"
                  >
                    {/* Status + Reference */}
                    <div className="flex items-center justify-between gap-3 mb-3">
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            'status-pill',
                            feeQuoteStatusColor(quote.status)
                          )}
                        >
                          {feeQuoteStatusLabel(quote.status)}
                        </span>
                        <span
                          className={cn(
                            'status-pill',
                            quoteTemplateTypeColor(quote.quote_template_type)
                          )}
                        >
                          {quoteTemplateTypeLabel(quote.quote_template_type)}
                        </span>
                      </div>
                      <span className="font-mono text-[12px] text-ink-400">{quote.quote_reference}</span>
                    </div>

                    {/* Mode label */}
                    <p className="text-[11px] text-ink-400 mb-2">{quoteModeLabel(quote.quote_mode)}</p>

                    {/* Title + Client */}
                    <div className="mb-4">
                      <h3 className="text-[15px] font-semibold text-ink-900 mb-1">{quote.quote_title || 'Untitled Quote'}</h3>
                      <p className="text-[13px] text-ink-500">{quote.client_name || '—'}</p>
                    </div>

                    {/* Fee Amount */}
                    <div className="mb-4">
                      <p className="font-display text-xl font-bold text-ink-900">{formatCurrency(quote.total_fee)}</p>
                      <p className="text-[12px] text-ink-400 mt-0.5">
                        {quote.fee_basis} · {quote.currency}
                      </p>
                    </div>

                    {/* Dates + Prepared By */}
                    <div className="text-[12px] text-ink-400 space-y-1 mb-4 pb-4 border-b border-slate-100">
                      <p>Issued {quote.issue_date ? formatDate(quote.issue_date) : '—'}</p>
                      {quote.valid_until && <p>Valid until {formatDate(quote.valid_until)}</p>}
                      {preparedBy && <p>Prepared by {preparedBy.name}</p>}
                    </div>

                    {/* Bottom Row: Pills & Meta */}
                    <div className="flex flex-wrap items-center gap-2">
                      {/* Project/Opportunity Pill */}
                      {(project || opportunity) && (
                        <span className="text-[11px] bg-slate-100 text-ink-600 px-2 py-1 rounded-full">
                          Linked to {project?.name || opportunity?.title}
                        </span>
                      )}

                      {/* View Count */}
                      {quote.viewed_count && quote.viewed_count > 0 && (
                        <span className="text-[11px] text-ink-400 flex items-center gap-1">
                          <EyeIcon className="w-3 h-3" />
                          Viewed {quote.viewed_count} {quote.viewed_count === 1 ? 'time' : 'times'}
                        </span>
                      )}

                      {/* Follow-up Chip */}
                      {needsFollowUp && (
                        <span className="bg-amber-100 text-amber-700 text-[11px] px-2 py-0.5 rounded-full">
                          Follow-up needed
                        </span>
                      )}

                      {/* Accepted Badge */}
                      {quote.accepted_at && (
                        <span className="text-[11px] text-green-600">
                          ✓ Accepted {timeAgo(quote.accepted_at)}
                        </span>
                      )}

                      {/* Declined Badge */}
                      {quote.declined_at && (
                        <span className="text-[11px] text-red-600">
                          ✕ Declined {timeAgo(quote.declined_at)}
                        </span>
                      )}
                    </div>

                    {/* Edit Button */}
                    <div className="mt-4 pt-4 border-t border-slate-100 flex justify-end">
                      <Link
                        href={`/fee-quotes/${quote.id}/edit`}
                        className="text-[12px] text-accent-600 font-medium hover:text-accent-700"
                        onClick={(e) => e.stopPropagation()}
                      >
                        Edit →
                      </Link>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

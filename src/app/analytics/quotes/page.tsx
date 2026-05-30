'use client'

import { useState } from 'react'
import Link from 'next/link'
import { getFeeQuoteRecords, getFeeQuoteViews, getUser, PROJECTS, getQuoteConversionMetrics, getQuoteProjectLinks } from '@/lib/mock-data'
import { formatCurrency, formatDate, timeAgo, feeQuoteStatusColor, feeQuoteStatusLabel, cn, formatPercent } from '@/lib/utils'
import { Breadcrumb } from '@/components/Breadcrumb'
import { FeeQuoteRecord, FeeQuoteView } from '@/lib/types'

export default function QuotePerformanceAnalytics() {
  const [period, setPeriod] = useState<'all' | '3mo' | '6mo' | '1yr'>('all')

  const quotes = getFeeQuoteRecords()

  // ━━━ KPI CALCULATIONS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const statusCounts = {
    draft: quotes.filter(q => q.status === 'draft').length,
    sent: quotes.filter(q => q.status === 'sent').length,
    viewed: quotes.filter(q => q.status === 'viewed').length,
    accepted: quotes.filter(q => q.status === 'accepted').length,
    declined: quotes.filter(q => q.status === 'declined').length,
    expired: quotes.filter(q => q.status === 'expired').length,
  }

  const statusValues = {
    draft: quotes.filter(q => q.status === 'draft').reduce((sum, q) => sum + q.total_fee, 0),
    sent: quotes.filter(q => q.status === 'sent').reduce((sum, q) => sum + q.total_fee, 0),
    viewed: quotes.filter(q => q.status === 'viewed').reduce((sum, q) => sum + q.total_fee, 0),
    accepted: quotes.filter(q => q.status === 'accepted').reduce((sum, q) => sum + q.total_fee, 0),
    declined: quotes.filter(q => q.status === 'declined').reduce((sum, q) => sum + q.total_fee, 0),
    expired: quotes.filter(q => q.status === 'expired').reduce((sum, q) => sum + q.total_fee, 0),
  }

  // ━━━ CONVERSION FUNNEL ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const totalQuotes = quotes.length
  const sentQuotes = quotes.filter(q => q.sent_at).length
  const viewedQuotes = quotes.filter(q => q.viewed_count > 0).length
  const acceptedQuotes = quotes.filter(q => q.status === 'accepted').length

  const conversionRates = {
    sent: totalQuotes > 0 ? ((sentQuotes / totalQuotes) * 100).toFixed(1) : '0',
    viewed: sentQuotes > 0 ? ((viewedQuotes / sentQuotes) * 100).toFixed(1) : '0',
    accepted: viewedQuotes > 0 ? ((acceptedQuotes / viewedQuotes) * 100).toFixed(1) : '0',
  }

  // ━━━ FOLLOW-UP ANALYSIS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const now = new Date()
  const quoteNeedingFollowUp = quotes.filter(quote => {
    // Sent but not viewed after 3+ days
    if (quote.status === 'sent' && quote.viewed_count === 0 && quote.sent_at) {
      const daysSinceSent = Math.floor((now.getTime() - new Date(quote.sent_at).getTime()) / 86400000)
      return daysSinceSent > 3
    }
    // Viewed but not responded with validity expiring in <7 days
    if (quote.status === 'viewed') {
      const daysUntilExpiry = Math.floor((new Date(quote.valid_until).getTime() - now.getTime()) / 86400000)
      return daysUntilExpiry < 7
    }
    // Any quote expiring within 7 days (and not yet accepted/declined)
    if (!['accepted', 'declined', 'expired', 'superseded'].includes(quote.status)) {
      const daysUntilExpiry = Math.floor((new Date(quote.valid_until).getTime() - now.getTime()) / 86400000)
      return daysUntilExpiry < 7
    }
    return false
  })

  // ━━━ RECENT ACTIVITY ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const allQuoteViews: Array<FeeQuoteView & { quoteName: string; quoteRef: string }> = []
  quotes.forEach(quote => {
    const viewsForQuote = getFeeQuoteViews(quote.id)
    viewsForQuote.forEach(view => {
      allQuoteViews.push({
        ...view,
        quoteName: quote.quote_title,
        quoteRef: quote.quote_reference,
      })
    })
  })

  const recentViews = allQuoteViews
    .sort((a, b) => new Date(b.viewed_at).getTime() - new Date(a.viewed_at).getTime())
    .slice(0, 10)

  // ━━━ QUOTE VALUE CHART DATA (for rendering bars) ━━━━━━━━
  const maxFee = Math.max(...quotes.map(q => q.total_fee), 1)

  // ━━━ CONVERSION METRICS & PIPELINE DATA ━━━━━━━━━━━━━━━━
  const conversionMetrics = getQuoteConversionMetrics()
  const quoteProjectLinks = getQuoteProjectLinks()

  // Quote-to-project pipeline counts
  const linkedToProjects = quoteProjectLinks.filter(link => link.project_creation_status === 'created').length
  const awaitingLink = quoteProjectLinks.filter(link => link.project_creation_status === 'pending').length
  const skipped = quoteProjectLinks.filter(link => link.project_creation_status === 'skipped').length

  // Calculate overall average days to accept (weighted)
  const totalAcceptedQuotes = conversionMetrics.reduce((sum, m) => sum + m.accepted_quotes, 0)
  const overallAvgDaysToAccept = totalAcceptedQuotes > 0
    ? conversionMetrics.reduce((sum, m) => sum + (m.avg_days_to_accept * m.accepted_quotes), 0) / totalAcceptedQuotes
    : 0

  // Calculate weighted average win rate
  const totalQuotesInMetrics = conversionMetrics.reduce((sum, m) => sum + m.total_quotes, 0)
  const weightedAvgWinRate = totalQuotesInMetrics > 0
    ? conversionMetrics.reduce((sum, m) => sum + (m.win_rate * m.total_quotes), 0) / totalQuotesInMetrics
    : 0

  // Pipeline value calculations
  const sentAndViewedQuotes = quotes.filter(q => q.status === 'sent' || q.status === 'viewed')
  const totalPipelineValue = sentAndViewedQuotes.reduce((sum, q) => sum + q.total_fee, 0)
  const expectedValue = totalPipelineValue * (weightedAvgWinRate / 100)

  // ━━━ STATUS COLOR MAP ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const statusBgColors: Record<string, string> = {
    draft: 'bg-slate-400',
    sent: 'bg-blue-500',
    viewed: 'bg-indigo-500',
    revised: 'bg-amber-500',
    accepted: 'bg-emerald-500',
    declined: 'bg-red-500',
    expired: 'bg-slate-300',
    superseded: 'bg-violet-500',
  }

  return (
    <div className="max-w-7xl animate-fade-in">
      {/* ━━━ HEADER ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section className="pb-12">
        <Breadcrumb items={[
          { label: 'Analytics' },
          { label: 'Quote Performance' }
        ]} />
        <h1 className="font-display text-[2rem] sm:text-[2.5rem] text-ink-900 mt-6 mb-2">Quote Performance</h1>
        <p className="text-[14px] text-ink-400">Track proposals, conversions and revenue pipeline</p>
      </section>

      {/* ━━━ KPI CARDS SECTION ━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section className="pb-16">
        <div className="border-t border-surface-200/60 pt-10">
          <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
            {/* Drafts */}
            <div className="card-premium p-5">
              <div className="flex items-start gap-3 mb-3">
                <div className="w-1 h-8 bg-slate-300 rounded-r-sm"></div>
                <div className="flex-1">
                  <p className="text-[11px] text-ink-300 uppercase tracking-[0.08em] font-semibold">Drafts</p>
                </div>
              </div>
              <p className="text-2xl font-light text-ink-900 mb-2">{statusCounts.draft}</p>
              <p className="text-[13px] text-ink-400">{formatCurrency(statusValues.draft)}</p>
            </div>

            {/* Sent */}
            <div className="card-premium p-5">
              <div className="flex items-start gap-3 mb-3">
                <div className="w-1 h-8 bg-blue-500 rounded-r-sm"></div>
                <div className="flex-1">
                  <p className="text-[11px] text-ink-300 uppercase tracking-[0.08em] font-semibold">Sent</p>
                </div>
              </div>
              <p className="text-2xl font-light text-ink-900 mb-2">{statusCounts.sent}</p>
              <p className="text-[13px] text-ink-400">{formatCurrency(statusValues.sent)}</p>
            </div>

            {/* Viewed */}
            <div className="card-premium p-5">
              <div className="flex items-start gap-3 mb-3">
                <div className="w-1 h-8 bg-indigo-500 rounded-r-sm"></div>
                <div className="flex-1">
                  <p className="text-[11px] text-ink-300 uppercase tracking-[0.08em] font-semibold">Viewed</p>
                </div>
              </div>
              <p className="text-2xl font-light text-ink-900 mb-2">{statusCounts.viewed}</p>
              <p className="text-[13px] text-ink-400">{formatCurrency(statusValues.viewed)}</p>
            </div>

            {/* Accepted */}
            <div className="card-premium p-5">
              <div className="flex items-start gap-3 mb-3">
                <div className="w-1 h-8 bg-emerald-500 rounded-r-sm"></div>
                <div className="flex-1">
                  <p className="text-[11px] text-ink-300 uppercase tracking-[0.08em] font-semibold">Accepted</p>
                </div>
              </div>
              <p className="text-2xl font-light text-ink-900 mb-2">{statusCounts.accepted}</p>
              <p className="text-[13px] text-ink-400">{formatCurrency(statusValues.accepted)}</p>
            </div>

            {/* Declined */}
            <div className="card-premium p-5">
              <div className="flex items-start gap-3 mb-3">
                <div className="w-1 h-8 bg-red-500 rounded-r-sm"></div>
                <div className="flex-1">
                  <p className="text-[11px] text-ink-300 uppercase tracking-[0.08em] font-semibold">Declined</p>
                </div>
              </div>
              <p className="text-2xl font-light text-ink-900 mb-2">{statusCounts.declined}</p>
              <p className="text-[13px] text-ink-400">{formatCurrency(statusValues.declined)}</p>
            </div>

            {/* Expired */}
            <div className="card-premium p-5">
              <div className="flex items-start gap-3 mb-3">
                <div className="w-1 h-8 bg-slate-300 rounded-r-sm"></div>
                <div className="flex-1">
                  <p className="text-[11px] text-ink-300 uppercase tracking-[0.08em] font-semibold">Expired</p>
                </div>
              </div>
              <p className="text-2xl font-light text-ink-900 mb-2">{statusCounts.expired}</p>
              <p className="text-[13px] text-ink-400">{formatCurrency(statusValues.expired)}</p>
            </div>
          </div>
        </div>
      </section>

      {/* ━━━ QUOTE VALUE CHART ━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section className="pb-16">
        <div className="border-t border-surface-200/60 pt-10 mb-8">
          <h2 className="font-display text-xl text-ink-900 mb-6">Quote Values by Status</h2>
          <div className="card-premium p-6">
            <div className="space-y-3">
              {quotes.slice(0, 12).map((quote) => {
                const barWidth = (quote.total_fee / maxFee) * 100
                const statusColor = statusBgColors[quote.status] || 'bg-slate-400'
                return (
                  <div key={quote.id} className="group">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex-1">
                        <p className="text-[13px] font-medium text-ink-900">{quote.quote_reference}</p>
                        <p className="text-[12px] text-ink-400">{quote.client_name}</p>
                      </div>
                      <p className="text-[13px] font-medium text-ink-900 ml-4">{formatCurrency(quote.total_fee)}</p>
                    </div>
                    <div className="relative h-6 bg-surface-100 rounded-r-lg overflow-hidden">
                      <div
                        className={cn(statusColor, 'h-full rounded-r-lg transition-all duration-300 flex items-center px-3')}
                        style={{ width: `${Math.max(barWidth, 2)}%` }}
                      >
                        <span className="text-[11px] font-medium text-white truncate">
                          {quote.status && feeQuoteStatusLabel(quote.status)}
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </section>

      {/* ━━━ CONVERSION FUNNEL ━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section className="pb-16">
        <div className="border-t border-surface-200/60 pt-10 mb-8">
          <h2 className="font-display text-xl text-ink-900 mb-6">Conversion Funnel</h2>
          <div className="card-premium p-8">
            <div className="space-y-6">
              {/* Total Quotes */}
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-[14px] font-medium text-ink-900 mb-1">Total Quotes</p>
                  <p className="text-[13px] text-ink-400">All quotes in system</p>
                </div>
                <div className="text-right">
                  <p className="text-3xl font-light text-ink-900">{totalQuotes}</p>
                  <p className="text-[12px] text-ink-400">{formatCurrency(quotes.reduce((sum, q) => sum + q.total_fee, 0))}</p>
                </div>
              </div>
              <div className="h-12 bg-gradient-to-r from-slate-200 to-slate-100 rounded-xl relative overflow-hidden">
                <div className="absolute inset-0 bg-slate-400 rounded-xl" style={{ width: '100%' }}></div>
              </div>

              {/* Sent Arrow */}
              <div className="flex items-center justify-center">
                <div className="text-2xl text-ink-300">↓</div>
              </div>

              {/* Sent Quotes */}
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-[14px] font-medium text-ink-900 mb-1">Sent to Client</p>
                  <p className="text-[13px] text-ink-400">Conversion: {conversionRates.sent}%</p>
                </div>
                <div className="text-right">
                  <p className="text-3xl font-light text-ink-900">{sentQuotes}</p>
                  <p className="text-[12px] text-ink-400">{formatCurrency(quotes.filter(q => q.sent_at).reduce((sum, q) => sum + q.total_fee, 0))}</p>
                </div>
              </div>
              <div className="h-12 bg-gradient-to-r from-blue-200 to-blue-100 rounded-xl relative overflow-hidden">
                <div className="absolute inset-0 bg-blue-500 rounded-xl" style={{ width: `${(sentQuotes / totalQuotes) * 100}%` }}></div>
              </div>

              {/* Viewed Arrow */}
              <div className="flex items-center justify-center">
                <div className="text-2xl text-ink-300">↓</div>
              </div>

              {/* Viewed Quotes */}
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-[14px] font-medium text-ink-900 mb-1">Viewed by Client</p>
                  <p className="text-[13px] text-ink-400">Conversion: {conversionRates.viewed}%</p>
                </div>
                <div className="text-right">
                  <p className="text-3xl font-light text-ink-900">{viewedQuotes}</p>
                  <p className="text-[12px] text-ink-400">{formatCurrency(quotes.filter(q => q.viewed_count > 0).reduce((sum, q) => sum + q.total_fee, 0))}</p>
                </div>
              </div>
              <div className="h-12 bg-gradient-to-r from-indigo-200 to-indigo-100 rounded-xl relative overflow-hidden">
                <div className="absolute inset-0 bg-indigo-500 rounded-xl" style={{ width: `${(viewedQuotes / totalQuotes) * 100}%` }}></div>
              </div>

              {/* Accepted Arrow */}
              <div className="flex items-center justify-center">
                <div className="text-2xl text-ink-300">↓</div>
              </div>

              {/* Accepted Quotes */}
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-[14px] font-medium text-ink-900 mb-1">Accepted by Client</p>
                  <p className="text-[13px] text-ink-400">Final conversion: {conversionRates.accepted}%</p>
                </div>
                <div className="text-right">
                  <p className="text-3xl font-light text-ink-900">{acceptedQuotes}</p>
                  <p className="text-[12px] text-ink-400">{formatCurrency(quotes.filter(q => q.status === 'accepted').reduce((sum, q) => sum + q.total_fee, 0))}</p>
                </div>
              </div>
              <div className="h-12 bg-gradient-to-r from-emerald-200 to-emerald-100 rounded-xl relative overflow-hidden">
                <div className="absolute inset-0 bg-emerald-500 rounded-xl" style={{ width: `${(acceptedQuotes / totalQuotes) * 100}%` }}></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ━━━ QUOTES NEEDING FOLLOW-UP ━━━━━━━━━━━━━━━━━━━━ */}
      <section className="pb-16">
        <div className="border-t border-surface-200/60 pt-10 mb-8">
          <h2 className="font-display text-xl text-ink-900 mb-6">Quotes Needing Follow-Up</h2>
          {quoteNeedingFollowUp.length > 0 ? (
            <div className="card-premium overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-surface-200 bg-surface-50/50">
                      <th className="text-left px-6 py-4 text-[11px] text-ink-300 uppercase tracking-[0.08em] font-semibold">Quote</th>
                      <th className="text-left px-6 py-4 text-[11px] text-ink-300 uppercase tracking-[0.08em] font-semibold">Client</th>
                      <th className="text-left px-6 py-4 text-[11px] text-ink-300 uppercase tracking-[0.08em] font-semibold">Status</th>
                      <th className="text-right px-6 py-4 text-[11px] text-ink-300 uppercase tracking-[0.08em] font-semibold">Days Since</th>
                      <th className="text-right px-6 py-4 text-[11px] text-ink-300 uppercase tracking-[0.08em] font-semibold">Valid Until</th>
                      <th className="text-left px-6 py-4 text-[11px] text-ink-300 uppercase tracking-[0.08em] font-semibold">Action Needed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {quoteNeedingFollowUp.map((quote, idx) => {
                      const sentDate = quote.sent_at ? new Date(quote.sent_at) : new Date()
                      const daysSinceSent = Math.floor((now.getTime() - sentDate.getTime()) / 86400000)
                      const daysUntilExpiry = Math.floor((new Date(quote.valid_until).getTime() - now.getTime()) / 86400000)

                      let actionLabel = ''
                      let actionColor = 'bg-slate-100 text-slate-700'

                      if (quote.status === 'sent' && quote.viewed_count === 0) {
                        actionLabel = 'Send Reminder'
                        actionColor = 'bg-amber-100 text-amber-700'
                      } else if (quote.status === 'viewed' && daysUntilExpiry < 7) {
                        actionLabel = 'Follow Up for Decision'
                        actionColor = 'bg-red-100 text-red-700'
                      } else if (daysUntilExpiry < 7) {
                        actionLabel = 'Expiring Soon'
                        actionColor = 'bg-red-100 text-red-700'
                      }

                      return (
                        <tr key={idx} className="stripe-row border-b border-surface-100 hover:bg-surface-50/50 transition-colors">
                          <td className="px-6 py-4">
                            <p className="text-[13px] font-medium text-ink-900">{quote.quote_reference}</p>
                          </td>
                          <td className="px-6 py-4">
                            <p className="text-[13px] text-ink-600">{quote.client_name}</p>
                          </td>
                          <td className="px-6 py-4">
                            <span className={cn('inline-block px-3 py-1 rounded-full text-[11px] font-medium', feeQuoteStatusColor(quote.status))}>
                              {feeQuoteStatusLabel(quote.status)}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <p className="text-[13px] text-ink-600">{daysSinceSent} days</p>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <p className="text-[13px] text-ink-600">{formatDate(quote.valid_until)}</p>
                            {daysUntilExpiry <= 7 && (
                              <p className="text-[12px] text-red-600 font-medium">{daysUntilExpiry} days remaining</p>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            <span className={cn('inline-block px-3 py-1 rounded-full text-[11px] font-medium', actionColor)}>
                              {actionLabel}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="card-premium p-8 text-center">
              <p className="text-[14px] text-ink-400">No quotes currently need follow-up action</p>
            </div>
          )}
        </div>
      </section>

      {/* ━━━ WIN RATE BY SECTOR ━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section className="pb-16">
        <div className="border-t border-surface-200/60 pt-10 mb-8">
          <h2 className="font-display text-xl text-ink-900 mb-6">Win Rate by Sector</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {conversionMetrics.map((metric) => {
              const barColor = metric.win_rate > 40
                ? 'bg-emerald-500'
                : metric.win_rate >= 20
                ? 'bg-amber-500'
                : 'bg-red-500'

              return (
                <div key={metric.sector} className="card-premium p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <p className="text-[11px] text-ink-300 uppercase tracking-[0.08em] font-semibold mb-1">Sector</p>
                      <p className="text-lg font-medium text-ink-900">{metric.sector}</p>
                    </div>
                    <p className="text-[13px] font-semibold text-ink-900">{formatPercent(metric.win_rate)}</p>
                  </div>

                  {/* Win rate bar */}
                  <div className="mb-5">
                    <div className="relative h-2 bg-surface-100 rounded-full overflow-hidden">
                      <div
                        className={cn(barColor, 'h-full rounded-full transition-all duration-300')}
                        style={{ width: `${Math.max(metric.win_rate, 2)}%` }}
                      ></div>
                    </div>
                  </div>

                  {/* Metrics grid */}
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <p className="text-[11px] text-ink-300 uppercase tracking-[0.08em] font-semibold">Quotes</p>
                      <p className="text-lg font-medium text-ink-900">{metric.total_quotes}</p>
                    </div>
                    <div>
                      <p className="text-[11px] text-ink-300 uppercase tracking-[0.08em] font-semibold">Won Value</p>
                      <p className="text-sm font-medium text-ink-900">{formatCurrency(metric.won_value)}</p>
                    </div>
                    <div>
                      <p className="text-[11px] text-ink-300 uppercase tracking-[0.08em] font-semibold">Avg Days</p>
                      <p className="text-lg font-medium text-ink-900">{Math.round(metric.avg_days_to_accept)}</p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ━━━ QUOTE-TO-PROJECT PIPELINE ━━━━━━━━━━━━━━━━━━━━━ */}
      <section className="pb-16">
        <div className="border-t border-surface-200/60 pt-10 mb-8">
          <h2 className="font-display text-xl text-ink-900 mb-6">Quote-to-Project Pipeline</h2>

          {/* KPI Cards */}
          <div className="grid grid-cols-3 gap-4 mb-8">
            <div className="card-premium p-6">
              <div className="flex items-start gap-3 mb-3">
                <div className="w-1 h-8 bg-emerald-500 rounded-r-sm"></div>
                <div className="flex-1">
                  <p className="text-[11px] text-ink-300 uppercase tracking-[0.08em] font-semibold">Linked to Projects</p>
                </div>
              </div>
              <p className="text-3xl font-light text-ink-900">{linkedToProjects}</p>
            </div>

            <div className="card-premium p-6">
              <div className="flex items-start gap-3 mb-3">
                <div className="w-1 h-8 bg-amber-500 rounded-r-sm"></div>
                <div className="flex-1">
                  <p className="text-[11px] text-ink-300 uppercase tracking-[0.08em] font-semibold">Awaiting Link</p>
                </div>
              </div>
              <p className="text-3xl font-light text-ink-900">{awaitingLink}</p>
            </div>

            <div className="card-premium p-6">
              <div className="flex items-start gap-3 mb-3">
                <div className="w-1 h-8 bg-slate-300 rounded-r-sm"></div>
                <div className="flex-1">
                  <p className="text-[11px] text-ink-300 uppercase tracking-[0.08em] font-semibold">Skipped</p>
                </div>
              </div>
              <p className="text-3xl font-light text-ink-900">{skipped}</p>
            </div>
          </div>

          {/* Pipeline table */}
          {quoteProjectLinks.length > 0 ? (
            <div className="card-premium overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-surface-200 bg-surface-50/50">
                      <th className="text-left px-6 py-4 text-[11px] text-ink-300 uppercase tracking-[0.08em] font-semibold">Quote Ref</th>
                      <th className="text-left px-6 py-4 text-[11px] text-ink-300 uppercase tracking-[0.08em] font-semibold">Status</th>
                      <th className="text-left px-6 py-4 text-[11px] text-ink-300 uppercase tracking-[0.08em] font-semibold">Linked Project</th>
                      <th className="text-left px-6 py-4 text-[11px] text-ink-300 uppercase tracking-[0.08em] font-semibold">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {quoteProjectLinks.slice(0, 8).map((link, idx) => {
                      const quote = quotes.find(q => q.id === link.fee_quote_id)
                      const project = PROJECTS.find(p => p.id === link.project_id)
                      const statusColors = {
                        'created': 'bg-emerald-100 text-emerald-700',
                        'pending': 'bg-amber-100 text-amber-700',
                        'skipped': 'bg-slate-100 text-slate-700',
                      }
                      const statusLabel = {
                        'created': 'Linked',
                        'pending': 'Pending',
                        'skipped': 'Skipped',
                      }

                      return (
                        <tr key={idx} className="stripe-row border-b border-surface-100 hover:bg-surface-50/50 transition-colors">
                          <td className="px-6 py-4">
                            <p className="text-[13px] font-medium text-ink-900">{quote ? quote.quote_reference : 'Quote not found'}</p>
                          </td>
                          <td className="px-6 py-4">
                            <span className={cn('inline-block px-3 py-1 rounded-full text-[11px] font-medium', statusColors[link.project_creation_status])}>
                              {statusLabel[link.project_creation_status]}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <p className="text-[13px] text-ink-600">
                              {project ? project.name : link.project_id ? 'Project not found' : '—'}
                            </p>
                          </td>
                          <td className="px-6 py-4">
                            <p className="text-[13px] text-ink-400">{link.linked_at ? formatDate(link.linked_at) : '—'}</p>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="card-premium p-8 text-center">
              <p className="text-[14px] text-ink-400">No quote-to-project links</p>
            </div>
          )}
        </div>
      </section>

      {/* ━━━ AVERAGE TIME TO ACCEPT ━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section className="pb-16">
        <div className="border-t border-surface-200/60 pt-10 mb-8">
          <h2 className="font-display text-xl text-ink-900 mb-6">Average Time to Accept</h2>
          <div className="card-premium p-8">
            {/* Overall metric */}
            <div className="mb-10 pb-10 border-b border-surface-200/60">
              <div className="flex items-baseline justify-between mb-4">
                <p className="text-[14px] font-medium text-ink-900">Overall Average</p>
                <p className="text-3xl font-light text-ink-900">{Math.round(overallAvgDaysToAccept)}</p>
              </div>
              <p className="text-[13px] text-ink-400">days across all sectors</p>
            </div>

            {/* Per-sector breakdown */}
            <div className="space-y-4">
              {conversionMetrics
                .sort((a, b) => a.avg_days_to_accept - b.avg_days_to_accept)
                .map((metric) => {
                  const maxDays = Math.max(...conversionMetrics.map(m => m.avg_days_to_accept), 30)
                  const barWidth = (metric.avg_days_to_accept / maxDays) * 100

                  return (
                    <div key={metric.sector}>
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-[13px] font-medium text-ink-900">{metric.sector}</p>
                        <p className="text-[13px] text-ink-600">{Math.round(metric.avg_days_to_accept)} days</p>
                      </div>
                      <div className="relative h-2 bg-surface-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-indigo-500 rounded-full transition-all duration-300"
                          style={{ width: `${Math.max(barWidth, 2)}%` }}
                        ></div>
                      </div>
                    </div>
                  )
                })}
            </div>
          </div>
        </div>
      </section>

      {/* ━━━ PIPELINE VALUE FORECAST ━━━━━━━━━━━━━━━━━━━━━━ */}
      <section className="pb-16">
        <div className="border-t border-surface-200/60 pt-10 mb-8">
          <h2 className="font-display text-xl text-ink-900 mb-6">Pipeline Value Forecast</h2>
          <div className="grid grid-cols-2 gap-6 mb-8">
            <div className="card-premium p-8">
              <p className="text-[11px] text-ink-300 uppercase tracking-[0.08em] font-semibold mb-3">Total Pipeline Value</p>
              <p className="text-4xl font-light text-ink-900 mb-2">{formatCurrency(totalPipelineValue)}</p>
              <p className="text-[13px] text-ink-400">Sent & viewed quotes</p>
            </div>

            <div className="card-premium p-8">
              <p className="text-[11px] text-ink-300 uppercase tracking-[0.08em] font-semibold mb-3">Expected Value</p>
              <p className="text-4xl font-light text-emerald-600 mb-2">{formatCurrency(expectedValue)}</p>
              <p className="text-[13px] text-ink-400">Based on {formatPercent(weightedAvgWinRate)} win rate</p>
            </div>
          </div>

          {/* Breakdown */}
          <div className="card-premium p-6">
            <p className="text-[11px] text-ink-300 uppercase tracking-[0.08em] font-semibold mb-6">Breakdown by Status</p>
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[13px] font-medium text-ink-900">Sent</p>
                  <div className="text-right">
                    <p className="text-[13px] font-medium text-ink-900">{quotes.filter(q => q.status === 'sent').length} quotes</p>
                    <p className="text-[12px] text-ink-400">{formatCurrency(quotes.filter(q => q.status === 'sent').reduce((sum, q) => sum + q.total_fee, 0))}</p>
                  </div>
                </div>
                <div className="relative h-2 bg-surface-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded-full"
                    style={{
                      width: `${totalPipelineValue > 0 ? ((quotes.filter(q => q.status === 'sent').reduce((sum, q) => sum + q.total_fee, 0) / totalPipelineValue) * 100) : 0}%`
                    }}
                  ></div>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[13px] font-medium text-ink-900">Viewed</p>
                  <div className="text-right">
                    <p className="text-[13px] font-medium text-ink-900">{quotes.filter(q => q.status === 'viewed').length} quotes</p>
                    <p className="text-[12px] text-ink-400">{formatCurrency(quotes.filter(q => q.status === 'viewed').reduce((sum, q) => sum + q.total_fee, 0))}</p>
                  </div>
                </div>
                <div className="relative h-2 bg-surface-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-indigo-500 rounded-full"
                    style={{
                      width: `${totalPipelineValue > 0 ? ((quotes.filter(q => q.status === 'viewed').reduce((sum, q) => sum + q.total_fee, 0) / totalPipelineValue) * 100) : 0}%`
                    }}
                  ></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ━━━ RECENT ACTIVITY TIMELINE ━━━━━━━━━━━━━━━━━━━━ */}
      <section className="pb-16">
        <div className="border-t border-surface-200/60 pt-10 mb-8">
          <h2 className="font-display text-xl text-ink-900 mb-6">Recent Activity</h2>
          {recentViews.length > 0 ? (
            <div className="space-y-0">
              {recentViews.map((view, idx) => (
                <div key={idx} className="card-premium border-t-0 first:border-t p-6 hover:bg-surface-50/50 transition-colors group">
                  <div className="flex items-start gap-6">
                    {/* Timeline dot */}
                    <div className="pt-1">
                      <div className="w-3 h-3 bg-indigo-500 rounded-full ring-4 ring-indigo-100"></div>
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between gap-4 mb-2">
                        <p className="text-[13px] font-medium text-ink-900">
                          {view.viewer_identifier} viewed <span className="font-semibold">{view.quoteRef}</span>
                        </p>
                        <p className="text-[12px] text-ink-400 whitespace-nowrap">{timeAgo(view.viewed_at)}</p>
                      </div>
                      <p className="text-[13px] text-ink-600 mb-3">{view.quoteName}</p>
                      <div className="flex items-center gap-3">
                        <span className={cn(
                          'inline-block px-2 py-1 rounded text-[11px] font-medium',
                          view.source === 'email' && 'bg-blue-100 text-blue-700',
                          view.source === 'portal' && 'bg-indigo-100 text-indigo-700',
                          view.source === 'direct_link' && 'bg-slate-100 text-slate-600',
                        )}>
                          {view.source === 'email' && 'Email'}
                          {view.source === 'portal' && 'Portal'}
                          {view.source === 'direct_link' && 'Direct Link'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="card-premium p-8 text-center">
              <p className="text-[14px] text-ink-400">No recent activity</p>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}

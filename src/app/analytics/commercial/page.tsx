'use client'

import Link from 'next/link'
import { getAllProjectCommercials, PROJECTS, getUser } from '@/lib/mock-data'
import { commercialHealthColor, commercialHealthDot, formatCurrency, formatPercent } from '@/lib/utils'
import { Breadcrumb } from '@/components/Breadcrumb'
import { SummaryCard } from '@/components/SummaryCard'

export default function CommercialAnalytics() {
  const commercials = getAllProjectCommercials()

  // Summary metrics
  const totalAgreedFees = commercials.reduce((sum, c) => sum + c.agreed_fee, 0)
  const totalInvoiced = commercials.reduce((sum, c) => sum + c.fee_invoiced, 0)
  const totalWIP = commercials.reduce((sum, c) => sum + c.wip_value, 0)
  const avgMargin = commercials.length > 0
    ? commercials.reduce((sum, c) => sum + c.current_margin_percent, 0) / commercials.length
    : 0

  // Projects sorted by health (critical first)
  const sortedByHealth = [...commercials].sort((a, b) => {
    const healthOrder = { critical: 0, at_risk: 1, watch: 2, healthy: 3 }
    return healthOrder[a.health_flag as keyof typeof healthOrder] - healthOrder[b.health_flag as keyof typeof healthOrder]
  })

  // Fee recovery projects
  const feeRecoveryProjects = commercials.map(c => ({
    projectId: c.project_id,
    projectName: PROJECTS.find(p => p.id === c.project_id)?.name || 'Unknown',
    agreedFee: c.agreed_fee,
    invoiced: c.fee_invoiced,
    recovery: c.agreed_fee > 0 ? (c.fee_invoiced / c.agreed_fee) : 0,
    isLowCollection: c.fee_paid < (c.fee_invoiced * 0.8)
  }))

  // Watch list projects
  const watchList = commercials.filter(c => ['watch', 'at_risk', 'critical'].includes(c.health_flag))

  return (
    <div className="max-w-6xl animate-fade-in">
      {/* ━━━ BREADCRUMB & HEADER ━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section className="pb-12">
        <Breadcrumb items={[
          { label: 'Dashboard', href: '/' },
          { label: 'Analytics', href: '/analytics' },
          { label: 'Commercial Performance' }
        ]} />
        <h1 className="font-display text-[2rem] text-ink-900 mt-4 mb-8">Commercial Performance</h1>

        {/* Navigation links */}
        <div className="flex gap-6 text-[12px]">
          <span className="font-semibold text-ink-900">This Page</span>
          <Link href="/analytics/cashflow" className="text-ink-400 hover:text-accent-600 transition-colors">
            Cashflow Forecast →
          </Link>
          <Link href="/analytics/portfolio" className="text-ink-400 hover:text-accent-600 transition-colors">
            Portfolio Health →
          </Link>
        </div>
      </section>

      {/* ━━━ SUMMARY CARDS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section className="pb-16">
        <div className="border-t border-surface-200/60 pt-10">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="card-premium p-5">
              <p className="text-[11px] text-ink-400 uppercase tracking-[0.08em] font-semibold mb-3">Total Agreed Fees</p>
              <p className="text-2xl font-light text-ink-900 tracking-tight">{formatCurrency(totalAgreedFees)}</p>
            </div>
            <div className="card-premium p-5">
              <p className="text-[11px] text-ink-400 uppercase tracking-[0.08em] font-semibold mb-3">Total Invoiced</p>
              <p className="text-2xl font-light text-ink-900 tracking-tight">{formatCurrency(totalInvoiced)}</p>
            </div>
            <div className="card-premium p-5">
              <p className="text-[11px] text-ink-400 uppercase tracking-[0.08em] font-semibold mb-3">Total WIP</p>
              <p className="text-2xl font-light text-ink-900 tracking-tight">{formatCurrency(totalWIP)}</p>
            </div>
            <div className="card-premium p-5">
              <p className="text-[11px] text-ink-400 uppercase tracking-[0.08em] font-semibold mb-3">Avg Margin</p>
              <p className="text-2xl font-light text-ink-900 tracking-tight">{formatPercent(avgMargin)}</p>
            </div>
          </div>
        </div>
      </section>

      {/* ━━━ PROJECT COMMERCIAL HEALTH TABLE ━━━━━━━━━━━━ */}
      <section className="pb-16">
        <div className="border-t border-surface-200/60 pt-10 mb-8">
          <h2 className="font-display text-[1.5rem] text-ink-900 mb-6">Project Commercial Health</h2>
          <div className="card-premium overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-surface-200">
                    <th className="text-left px-5 py-4 text-[11px] text-ink-300 uppercase tracking-[0.08em] font-semibold">Project</th>
                    <th className="text-left px-5 py-4 text-[11px] text-ink-300 uppercase tracking-[0.08em] font-semibold">Client</th>
                    <th className="text-right px-5 py-4 text-[11px] text-ink-300 uppercase tracking-[0.08em] font-semibold">Agreed Fee</th>
                    <th className="text-right px-5 py-4 text-[11px] text-ink-300 uppercase tracking-[0.08em] font-semibold">Invoiced</th>
                    <th className="text-right px-5 py-4 text-[11px] text-ink-300 uppercase tracking-[0.08em] font-semibold">Paid</th>
                    <th className="text-right px-5 py-4 text-[11px] text-ink-300 uppercase tracking-[0.08em] font-semibold">WIP</th>
                    <th className="text-right px-5 py-4 text-[11px] text-ink-300 uppercase tracking-[0.08em] font-semibold">Margin %</th>
                    <th className="text-center px-5 py-4 text-[11px] text-ink-300 uppercase tracking-[0.08em] font-semibold">Health</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedByHealth.map((commercial, i) => {
                    const project = PROJECTS.find(p => p.id === commercial.project_id)
                    const isOverspend = commercial.current_margin_percent < 0
                    const bgClass = isOverspend ? 'bg-red-50/30' : 'bg-white'

                    return (
                      <tr key={`${commercial.project_id}-${i}`} className={`stripe-row border-b border-surface-200 hover:bg-surface-50/50 transition-colors ${bgClass}`}>
                        <td className="px-5 py-4 text-[12px] font-medium text-ink-900">{project?.name || 'Unknown'}</td>
                        <td className="px-5 py-4 text-[12px] text-ink-600">{project?.client || '—'}</td>
                        <td className="text-right px-5 py-4 text-[12px] text-ink-900 font-mono">{formatCurrency(commercial.agreed_fee)}</td>
                        <td className="text-right px-5 py-4 text-[12px] text-ink-900 font-mono">{formatCurrency(commercial.fee_invoiced)}</td>
                        <td className="text-right px-5 py-4 text-[12px] text-ink-900 font-mono">{formatCurrency(commercial.fee_paid)}</td>
                        <td className="text-right px-5 py-4 text-[12px] text-ink-900 font-mono">{formatCurrency(commercial.wip_value)}</td>
                        <td className={`text-right px-5 py-4 text-[12px] font-mono ${isOverspend ? 'text-red-600 font-semibold' : 'text-ink-900'}`}>
                          {formatPercent(commercial.current_margin_percent)}
                        </td>
                        <td className="text-center px-5 py-4">
                          <div className="inline-flex items-center gap-2">
                            {commercialHealthDot(commercial.health_flag)}
                            <span className="text-[11px] font-medium capitalize" style={{ color: commercialHealthColor(commercial.health_flag) }}>
                              {commercial.health_flag}
                            </span>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      {/* ━━━ FEE RECOVERY ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section className="pb-16">
        <div className="border-t border-surface-200/60 pt-10 mb-8">
          <h2 className="font-display text-[1.5rem] text-ink-900 mb-6">Fee Recovery</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {feeRecoveryProjects.map((proj, i) => (
              <div key={i} className="card-premium p-5">
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[12px] font-medium text-ink-900">{proj.projectName}</p>
                    <span className="text-[11px] font-mono text-ink-400">{formatPercent(proj.recovery)}</span>
                  </div>
                  <div className="h-2 bg-surface-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500"
                      style={{ width: `${Math.min(proj.recovery * 100, 100)}%` }}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 text-[11px]">
                  <div>
                    <p className="text-ink-400 mb-1">Agreed</p>
                    <p className="font-mono text-ink-900">{formatCurrency(proj.agreedFee)}</p>
                  </div>
                  <div>
                    <p className="text-ink-400 mb-1">Invoiced</p>
                    <p className="font-mono text-ink-900">{formatCurrency(proj.invoiced)}</p>
                  </div>
                </div>
                {proj.isLowCollection && (
                  <p className="text-[10px] text-red-600 mt-3 pt-3 border-t border-surface-200">
                    Warning: Paid value &lt; 80% of invoiced amount
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ━━━ WATCH LIST & NEAR-LOSS ━━━━━━━━━━━━━━━━━━━ */}
      {watchList.length > 0 && (
        <section className="pb-16">
          <div className="border-t border-surface-200/60 pt-10 mb-8">
            <h2 className="font-display text-[1.5rem] text-ink-900 mb-6">Near-Loss & Watch List</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {watchList.map((commercial, i) => {
                const project = PROJECTS.find(p => p.id === commercial.project_id)
                const isLowMargin = commercial.current_margin_percent < 5
                const isOverspend = commercial.current_margin_percent < 0
                const reason = isOverspend ? 'Overspend detected' : isLowMargin ? 'Low margin risk' : 'At risk'

                return (
                  <div
                    key={i}
                    className={`rounded-2xl border shadow-card p-5 ${
                      commercial.health_flag === 'critical'
                        ? 'bg-red-50 border-red-200'
                        : commercial.health_flag === 'at_risk'
                        ? 'bg-amber-50 border-amber-200'
                        : 'bg-white border-surface-200'
                    }`}
                  >
                    <div className="flex items-start gap-3 mb-3">
                      {commercialHealthDot(commercial.health_flag)}
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-semibold text-ink-900 truncate">{project?.name}</p>
                        <p className="text-[11px] text-ink-400 mt-0.5">{project?.client || '—'}</p>
                      </div>
                    </div>
                    <div className="space-y-2 mb-4 pt-3 border-t border-surface-200">
                      <p className="text-[10px] text-ink-400 uppercase tracking-[0.08em] font-semibold">Reason</p>
                      <p className="text-[12px] font-medium text-ink-900">{reason}</p>
                    </div>
                    <div className="space-y-2 mb-4 pt-3 border-t border-surface-200">
                      <p className="text-[10px] text-ink-400 uppercase tracking-[0.08em] font-semibold">Details</p>
                      <p className="text-[11px] text-ink-600 font-mono">Margin: {formatPercent(commercial.current_margin_percent)}</p>
                      <p className="text-[11px] text-ink-600 font-mono">Invoiced: {formatCurrency(commercial.fee_invoiced)}/{formatCurrency(commercial.agreed_fee)}</p>
                    </div>
                    <div className="pt-3 border-t border-surface-200">
                      <p className="text-[10px] text-ink-400 uppercase tracking-[0.08em] font-semibold mb-2">Action</p>
                      <p className="text-[11px] text-ink-700">
                        {isOverspend ? 'Review scope & costs immediately' : isLowMargin ? 'Limit scope changes' : 'Monitor closely'}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </section>
      )}
    </div>
  )
}

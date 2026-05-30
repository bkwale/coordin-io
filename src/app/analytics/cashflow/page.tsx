'use client'

import Link from 'next/link'
import { getCashflowForecasts } from '@/lib/mock-data'
import { formatCurrency } from '@/lib/utils'
import { Breadcrumb } from '@/components/Breadcrumb'

export default function CashflowForecast() {
  const forecasts = getCashflowForecasts()

  // Summary metrics
  const latestWithActuals = forecasts
    .filter(f => (f.actual_income ?? 0) > 0 || (f.actual_expenses ?? 0) > 0)
    .sort((a, b) => new Date(b.month).getTime() - new Date(a.month).getTime())[0]

  const currentMonthNet = latestWithActuals
    ? (latestWithActuals.actual_income ?? 0) - (latestWithActuals.actual_expenses ?? 0)
    : 0

  const nextThreeMonths = forecasts
    .filter(f => new Date(f.month) > new Date())
    .sort((a, b) => new Date(a.month).getTime() - new Date(b.month).getTime())
    .slice(0, 3)

  const projectedNetNext3 = nextThreeMonths.reduce((sum, f) => sum + (f.projected_income - f.projected_expenses), 0)

  const latestMonth = forecasts
    .sort((a, b) => new Date(b.month).getTime() - new Date(a.month).getTime())[0]

  const pipelineValue = latestMonth?.pipeline_value || 0
  const monthsCount = forecasts.length

  // Table data
  const monthsWithVariance = forecasts.map(f => {
    const hasActuals = (f.actual_income ?? 0) > 0 || (f.actual_expenses ?? 0) > 0
    return {
      ...f,
      hasActuals,
      variance: hasActuals
        ? {
            incomeVar: (f.actual_income ?? 0) - f.projected_income,
            expenseVar: (f.actual_expenses ?? 0) - f.projected_expenses
          }
        : null
    }
  })

  // Find max values for chart scaling
  const maxIncome = Math.max(...forecasts.map(f => Math.max(f.projected_income, f.actual_income ?? 0)))
  const maxExpense = Math.max(...forecasts.map(f => Math.max(f.projected_expenses, f.actual_expenses ?? 0)))
  const maxValue = Math.max(maxIncome, maxExpense)

  const formatMonth = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' }).toUpperCase()
  }

  return (
    <div className="max-w-7xl animate-fade-in">
      {/* ━━━ BREADCRUMB & HEADER ━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section className="pb-12">
        <Breadcrumb items={[
          { label: 'Dashboard', href: '/' },
          { label: 'Analytics', href: '/analytics' },
          { label: 'Cashflow Forecast' }
        ]} />
        <h1 className="font-display text-[2rem] text-ink-900 mt-4 mb-8">Cashflow Forecast</h1>

        {/* Navigation links */}
        <div className="flex gap-6 text-[12px]">
          <Link href="/analytics/commercial" className="text-ink-400 hover:text-accent-600 transition-colors">
            ← Commercial Performance
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
              <p className="text-[11px] text-ink-400 uppercase tracking-[0.08em] font-semibold mb-3">Current Month Net</p>
              <p className={`text-2xl font-light tracking-tight ${currentMonthNet >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {formatCurrency(currentMonthNet)}
              </p>
            </div>
            <div className="card-premium p-5">
              <p className="text-[11px] text-ink-400 uppercase tracking-[0.08em] font-semibold mb-3">3-Month Projected Net</p>
              <p className={`text-2xl font-light tracking-tight ${projectedNetNext3 >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {formatCurrency(projectedNetNext3)}
              </p>
            </div>
            <div className="card-premium p-5">
              <p className="text-[11px] text-ink-400 uppercase tracking-[0.08em] font-semibold mb-3">Pipeline Value</p>
              <p className="text-2xl font-light text-ink-900 tracking-tight">{formatCurrency(pipelineValue)}</p>
            </div>
            <div className="card-premium p-5">
              <p className="text-[11px] text-ink-400 uppercase tracking-[0.08em] font-semibold mb-3">Months Available</p>
              <p className="text-2xl font-light text-ink-900 tracking-tight">{monthsCount}</p>
            </div>
          </div>
        </div>
      </section>

      {/* ━━━ MONTHLY FORECAST TABLE ━━━━━━━━━━━━━━━━━━━━ */}
      <section className="pb-16">
        <div className="border-t border-surface-200/60 pt-10 mb-8">
          <h2 className="font-display text-[1.5rem] text-ink-900 mb-6">Monthly Forecast</h2>
          <div className="card-premium overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-surface-200">
                    <th className="text-left px-5 py-4 text-[11px] text-ink-300 uppercase tracking-[0.08em] font-semibold">Month</th>
                    <th className="text-right px-5 py-4 text-[11px] text-ink-300 uppercase tracking-[0.08em] font-semibold">Proj. Income</th>
                    <th className="text-right px-5 py-4 text-[11px] text-ink-300 uppercase tracking-[0.08em] font-semibold">Proj. Expenses</th>
                    <th className="text-right px-5 py-4 text-[11px] text-ink-300 uppercase tracking-[0.08em] font-semibold">Actual Income</th>
                    <th className="text-right px-5 py-4 text-[11px] text-ink-300 uppercase tracking-[0.08em] font-semibold">Actual Expenses</th>
                    <th className="text-right px-5 py-4 text-[11px] text-ink-300 uppercase tracking-[0.08em] font-semibold">Net</th>
                    <th className="text-right px-5 py-4 text-[11px] text-ink-300 uppercase tracking-[0.08em] font-semibold">Pipeline</th>
                  </tr>
                </thead>
                <tbody>
                  {monthsWithVariance.map((f, i) => {
                    const netAmount = f.hasActuals
                      ? (f.actual_income ?? 0) - (f.actual_expenses ?? 0)
                      : f.projected_income - f.projected_expenses

                    return (
                      <tr
                        key={i}
                        className={`stripe-row border-b border-surface-200 hover:bg-surface-50/50 transition-colors ${
                          f.hasActuals ? 'bg-blue-50/20' : ''
                        }`}
                      >
                        <td className="px-5 py-4 text-[12px] font-medium text-ink-900">{formatMonth(f.month)}</td>
                        <td className="text-right px-5 py-4 text-[12px] text-ink-900 font-mono">{formatCurrency(f.projected_income)}</td>
                        <td className="text-right px-5 py-4 text-[12px] text-ink-900 font-mono">{formatCurrency(f.projected_expenses)}</td>
                        <td className={`text-right px-5 py-4 text-[12px] font-mono ${f.hasActuals ? 'text-ink-900 font-semibold' : 'text-ink-300'}`}>
                          {f.hasActuals ? formatCurrency(f.actual_income ?? 0) : '—'}
                        </td>
                        <td className={`text-right px-5 py-4 text-[12px] font-mono ${f.hasActuals ? 'text-ink-900 font-semibold' : 'text-ink-300'}`}>
                          {f.hasActuals ? formatCurrency(f.actual_expenses ?? 0) : '—'}
                        </td>
                        <td className={`text-right px-5 py-4 text-[12px] font-mono font-semibold ${
                          netAmount >= 0 ? 'text-emerald-600' : 'text-red-600'
                        }`}>
                          {formatCurrency(netAmount)}
                        </td>
                        <td className="text-right px-5 py-4 text-[12px] text-ink-900 font-mono">{formatCurrency(f.pipeline_value)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      {/* ━━━ VISUAL CHART ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section className="pb-16">
        <div className="border-t border-surface-200/60 pt-10 mb-8">
          <h2 className="font-display text-[1.5rem] text-ink-900 mb-6">Cashflow Visualization</h2>
          <div className="card-premium p-6">
            <div className="flex gap-8">
              {/* Chart */}
              <div className="flex-1 min-w-0">
                <div className="flex items-flex-end justify-between gap-2 h-64 relative">
                  {/* Y-axis scale lines */}
                  <div className="absolute left-0 top-0 bottom-0 w-px bg-surface-200" />

                  {/* Bars */}
                  {forecasts.slice(0, 12).map((f, i) => {
                    const incomeHeight = maxValue > 0 ? (f.projected_income / maxValue) * 100 : 0
                    const expenseHeight = maxValue > 0 ? (f.projected_expenses / maxValue) * 100 : 0

                    return (
                      <div key={i} className="flex-1 flex flex-col items-center gap-2 pb-8">
                        <div className="flex items-flex-end gap-1.5 h-48 relative">
                          {/* Income bar */}
                          <div className="w-3 bg-emerald-500 rounded-t" style={{ height: `${incomeHeight}%` }} />
                          {/* Expense bar */}
                          <div className="w-3 bg-red-400 rounded-t" style={{ height: `${expenseHeight}%` }} />
                        </div>
                        <span className="text-[9px] text-ink-300 font-mono mt-1">{formatMonth(f.month)}</span>
                      </div>
                    )
                  })}
                </div>

                {/* Scale reference */}
                <div className="flex items-center gap-4 mt-8 pt-6 border-t border-surface-200">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-emerald-500 rounded" />
                    <span className="text-[10px] text-ink-400">Income</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-red-400 rounded" />
                    <span className="text-[10px] text-ink-400">Expenses</span>
                  </div>
                  <div className="ml-auto text-[10px] text-ink-300">
                    Scale: {formatCurrency(maxValue)} max
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

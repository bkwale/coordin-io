import Link from 'next/link'
import { WidgetCard, WidgetStat, WidgetDivider } from './WidgetCard'
import { getOpenInvoiceValue, getOverdueInvoices, getTotalInvoicedThisMonth, getMonthlyOverheadTotal, getOverheadSummaries, getFeeRecoveryRate } from '@/lib/mock-data'
import { overheadCategoryLabel } from '@/lib/utils'
import { cn } from '@/lib/utils'

export function FinancialHealthWidget() {
  const openValue = getOpenInvoiceValue()
  const overdueInvoices = getOverdueInvoices()
  const overdueValue = overdueInvoices.reduce((s, i) => s + i.total_amount, 0)
  const invoicedThisMonth = getTotalInvoicedThisMonth()
  const monthlyOverhead = getMonthlyOverheadTotal()
  const recoveryRate = getFeeRecoveryRate()
  const overheads = getOverheadSummaries()

  const formatK = (v: number) => v >= 1000 ? `£${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}k` : `£${v}`

  return (
    <WidgetCard
      title="Financial Health"
      icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" /></svg>}
    >
      <div className="grid grid-cols-3 gap-3">
        <WidgetStat label="Invoiced (May)" value={formatK(invoicedThisMonth)} />
        <WidgetStat label="Open Invoices" value={formatK(openValue)} color="text-blue-600" />
        <WidgetStat label="Overdue" value={formatK(overdueValue)} color={overdueValue > 0 ? 'text-red-600' : 'text-emerald-600'} />
      </div>

      <WidgetDivider />

      <div className="grid grid-cols-2 gap-3">
        <WidgetStat label="Fee Recovery" value={`${recoveryRate}%`} color={recoveryRate >= 80 ? 'text-emerald-600' : 'text-amber-600'} />
        <WidgetStat label="Monthly Overhead" value={formatK(monthlyOverhead)} />
      </div>

      <WidgetDivider />

      {/* Overhead breakdown */}
      <p className="text-[10px] font-semibold text-ink-400 uppercase tracking-wider mb-2">Overhead Breakdown</p>
      <div className="space-y-1.5">
        {overheads.slice(0, 5).map(oh => (
          <div key={oh.category} className="flex items-center justify-between">
            <span className="text-[11px] text-ink-600">{overheadCategoryLabel(oh.category)}</span>
            <span className="text-[11px] font-medium text-ink-700 tabular-nums">£{oh.monthly_total.toLocaleString()}</span>
          </div>
        ))}
      </div>

      <WidgetDivider />

      <Link href="/analytics/commercial" className="text-[11px] text-accent-500 hover:text-accent-600 font-semibold transition-colors">
        View commercial →
      </Link>
    </WidgetCard>
  )
}

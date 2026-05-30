import Link from 'next/link'
import { WidgetCard, WidgetStat, WidgetDivider } from './WidgetCard'
import { getOpenInvoiceValue, getOverdueInvoices, getTotalInvoicedThisMonth, getMonthlyOverheadTotal, getOverheadSummaries, getFeeRecoveryRate } from '@/lib/mock-data'
import { overheadCategoryLabel } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { PoundSterling } from 'lucide-react'

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
      icon={<PoundSterling className="w-4 h-4" />}
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

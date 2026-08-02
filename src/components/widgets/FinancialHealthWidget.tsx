'use client'

import { DollarSign, Info } from 'lucide-react'
import { WidgetCard, WidgetStat, WidgetDivider } from './WidgetCard'

export function FinancialHealthWidget() {
  return (
    <WidgetCard
      title="Financial Health"
      icon={<DollarSign className="w-4 h-4" />}
    >
      <div className="grid grid-cols-3 gap-4">
        <WidgetStat label="Total budget" value="---" color="text-ink-300" />
        <WidgetStat label="Invoiced" value="---" color="text-ink-300" />
        <WidgetStat label="Outstanding" value="---" color="text-ink-300" />
      </div>
      <WidgetDivider />
      <div className="flex items-start gap-2">
        <Info className="w-3.5 h-3.5 text-ink-300 shrink-0 mt-0.5" />
        <p className="text-[11px] text-ink-400">
          Connect your accounting system to see live financial data
        </p>
      </div>
    </WidgetCard>
  )
}

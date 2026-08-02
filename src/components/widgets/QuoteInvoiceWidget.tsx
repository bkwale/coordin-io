'use client'

import { FileText, Info } from 'lucide-react'
import { WidgetCard, WidgetStat, WidgetDivider } from './WidgetCard'

export function QuoteInvoiceWidget() {
  return (
    <WidgetCard
      title="Quotes & Invoices"
      icon={<FileText className="w-4 h-4" />}
    >
      <div className="grid grid-cols-3 gap-4">
        <WidgetStat label="Quotes sent" value="---" color="text-ink-300" />
        <WidgetStat label="Invoices raised" value="---" color="text-ink-300" />
        <WidgetStat label="Overdue invoices" value="---" color="text-ink-300" />
      </div>
      <WidgetDivider />
      <div className="flex items-start gap-2">
        <Info className="w-3.5 h-3.5 text-ink-300 shrink-0 mt-0.5" />
        <p className="text-[11px] text-ink-400">
          Invoicing features coming soon
        </p>
      </div>
    </WidgetCard>
  )
}

import Link from 'next/link'
import { WidgetCard, WidgetDivider } from './WidgetCard'
import { FEE_QUOTE_RECORDS, INVOICES, getUnsyncedInvoices } from '@/lib/mock-data'
import { feeQuoteStatusColor, feeQuoteStatusLabel, invoiceStatusColor, invoiceStatusLabel, cn } from '@/lib/utils'
import { FileText } from 'lucide-react'

export function QuoteInvoiceWidget() {
  const quotesByStatus = {
    draft: FEE_QUOTE_RECORDS.filter(q => q.status === 'draft').length,
    sent: FEE_QUOTE_RECORDS.filter(q => q.status === 'sent').length,
    viewed: FEE_QUOTE_RECORDS.filter(q => q.status === 'viewed').length,
    accepted: FEE_QUOTE_RECORDS.filter(q => q.status === 'accepted').length,
    declined: FEE_QUOTE_RECORDS.filter(q => q.status === 'declined').length,
  }

  const invoicesByStatus = {
    draft: INVOICES.filter(i => i.status === 'draft').length,
    sent: INVOICES.filter(i => i.status === 'sent').length,
    due: INVOICES.filter(i => i.status === 'due').length,
    overdue: INVOICES.filter(i => i.status === 'overdue').length,
    paid: INVOICES.filter(i => i.status === 'paid').length,
  }

  const unsynced = getUnsyncedInvoices()

  const quoteValue = FEE_QUOTE_RECORDS
    .filter(q => q.status === 'sent' || q.status === 'viewed')
    .reduce((s, q) => s + q.total_fee, 0)

  return (
    <WidgetCard
      title="Quote & Invoice Pipeline"
      icon={<FileText className="w-4 h-4" />}
    >
      {/* Quotes */}
      <p className="text-[10px] font-semibold text-ink-400 uppercase tracking-wider mb-2">Quotes</p>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {Object.entries(quotesByStatus).filter(([, v]) => v > 0).map(([status, count]) => (
          <span key={status} className={cn('status-pill text-[9px]', feeQuoteStatusColor(status as any))}>
            {count} {feeQuoteStatusLabel(status as any)}
          </span>
        ))}
      </div>
      <p className="text-[11px] text-ink-500">Pipeline value: <span className="font-semibold text-ink-700">£{quoteValue.toLocaleString()}</span></p>

      <WidgetDivider />

      {/* Invoices */}
      <p className="text-[10px] font-semibold text-ink-400 uppercase tracking-wider mb-2">Invoices</p>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {Object.entries(invoicesByStatus).filter(([, v]) => v > 0).map(([status, count]) => (
          <span key={status} className={cn('status-pill text-[9px]', invoiceStatusColor(status as any))}>
            {count} {invoiceStatusLabel(status as any)}
          </span>
        ))}
      </div>

      {unsynced.length > 0 && (
        <div className="mt-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-100">
          <p className="text-[11px] font-medium text-amber-700">{unsynced.length} invoice{unsynced.length > 1 ? 's' : ''} not synced to Xero</p>
        </div>
      )}

      <WidgetDivider />

      <div className="flex items-center justify-between">
        <Link href="/fee-quotes" className="text-[11px] text-accent-500 hover:text-accent-600 font-semibold transition-colors">
          View quotes →
        </Link>
        <Link href="/analytics/quotes" className="text-[11px] text-accent-500 hover:text-accent-600 font-semibold transition-colors">
          Quote analytics →
        </Link>
      </div>
    </WidgetCard>
  )
}

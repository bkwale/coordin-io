'use client'

import { TrendingUp } from 'lucide-react'

export default function CashflowPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[22px] font-semibold text-ink-900">Cashflow Forecast</h1>
        <p className="text-[13px] text-ink-400 mt-1">Revenue projections and payment tracking</p>
      </div>
      <div className="bg-white rounded-xl border border-ink-100 p-12 text-center">
        <TrendingUp className="w-12 h-12 text-ink-200 mx-auto mb-4" />
        <p className="text-[15px] font-medium text-ink-700">No cashflow data yet</p>
        <p className="text-[12px] text-ink-400 mt-2 max-w-md mx-auto">
          Cashflow forecasts will generate from your invoices, quotes, and project fee schedules.
        </p>
      </div>
    </div>
  )
}

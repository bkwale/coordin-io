'use client'

import { BarChart3 } from 'lucide-react'

export default function QuoteAnalyticsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[22px] font-semibold text-ink-900">Quote Analytics</h1>
        <p className="text-[13px] text-ink-400 mt-1">Conversion rates, pipeline value, and quote performance</p>
      </div>
      <div className="bg-white rounded-xl border border-ink-100 p-12 text-center">
        <BarChart3 className="w-12 h-12 text-ink-200 mx-auto mb-4" />
        <p className="text-[15px] font-medium text-ink-700">No quote data yet</p>
        <p className="text-[12px] text-ink-400 mt-2 max-w-md mx-auto">
          Analytics will populate once you create fee quotes and track their outcomes.
        </p>
      </div>
    </div>
  )
}

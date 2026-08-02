'use client'

import { PoundSterling } from 'lucide-react'

export default function CommercialAnalyticsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[22px] font-semibold text-ink-900">Commercial Analytics</h1>
        <p className="text-[13px] text-ink-400 mt-1">Project profitability and fee recovery</p>
      </div>
      <div className="bg-white rounded-xl border border-ink-100 p-12 text-center">
        <PoundSterling className="w-12 h-12 text-ink-200 mx-auto mb-4" />
        <p className="text-[15px] font-medium text-ink-700">No commercial data yet</p>
        <p className="text-[12px] text-ink-400 mt-2 max-w-md mx-auto">
          Fee recovery rates, profit margins, and project financial health will appear once projects have invoices and timesheets.
        </p>
      </div>
    </div>
  )
}

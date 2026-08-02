'use client'

import { PieChart } from 'lucide-react'

export default function PortfolioAnalyticsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[22px] font-semibold text-ink-900">Portfolio Overview</h1>
        <p className="text-[13px] text-ink-400 mt-1">Practice-wide project health and risk dashboard</p>
      </div>
      <div className="bg-white rounded-xl border border-ink-100 p-12 text-center">
        <PieChart className="w-12 h-12 text-ink-200 mx-auto mb-4" />
        <p className="text-[15px] font-medium text-ink-700">No portfolio data yet</p>
        <p className="text-[12px] text-ink-400 mt-2 max-w-md mx-auto">
          Health snapshots, risk alerts, and portfolio-level trends will populate as projects progress.
        </p>
      </div>
    </div>
  )
}

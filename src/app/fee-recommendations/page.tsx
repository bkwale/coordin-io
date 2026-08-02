'use client'

import { TrendingUp } from 'lucide-react'

export default function FeeRecommendationsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[22px] font-semibold text-ink-900">Fee Recommendations</h1>
        <p className="text-[13px] text-ink-400 mt-1">AI-powered fee guidance based on project data</p>
      </div>
      <div className="bg-white rounded-xl border border-ink-100 p-12 text-center">
        <TrendingUp className="w-12 h-12 text-ink-200 mx-auto mb-4" />
        <p className="text-[15px] font-medium text-ink-700">No fee recommendations yet</p>
        <p className="text-[12px] text-ink-400 mt-2 max-w-md mx-auto">
          Fee recommendations will generate automatically once you have enough project and quote history.
        </p>
      </div>
    </div>
  )
}

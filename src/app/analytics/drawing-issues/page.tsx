'use client'

import { BarChart3 } from 'lucide-react'

export default function DrawingIssueAnalyticsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[22px] font-semibold text-ink-900">Drawing Issue Analytics</h1>
        <p className="text-[13px] text-ink-400 mt-1">Track drawing revisions, RFIs, and issue resolution</p>
      </div>
      <div className="bg-white rounded-xl border border-ink-100 p-12 text-center">
        <BarChart3 className="w-12 h-12 text-ink-200 mx-auto mb-4" />
        <p className="text-[15px] font-medium text-ink-700">No drawing issue data yet</p>
        <p className="text-[12px] text-ink-400 mt-2 max-w-md mx-auto">
          Drawing issue trends will appear once drawings are issued on your projects.
        </p>
      </div>
    </div>
  )
}

'use client'

import { Eye } from 'lucide-react'

export default function TimesheetReviewPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[22px] font-semibold text-ink-900">Timesheet Review</h1>
        <p className="text-[13px] text-ink-400 mt-1">Review and approve team timesheets</p>
      </div>
      <div className="bg-white rounded-xl border border-ink-100 p-12 text-center">
        <Eye className="w-12 h-12 text-ink-200 mx-auto mb-4" />
        <p className="text-[15px] font-medium text-ink-700">No timesheets to review</p>
        <p className="text-[12px] text-ink-400 mt-2 max-w-md mx-auto">
          Timesheets submitted for approval will appear here.
        </p>
      </div>
    </div>
  )
}

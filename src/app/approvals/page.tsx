'use client'

import { CheckCircle2 } from 'lucide-react'

export default function ApprovalsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[22px] font-semibold text-ink-900">Approvals</h1>
        <p className="text-[13px] text-ink-400 mt-1">Review and approve pending requests</p>
      </div>
      <div className="bg-white rounded-xl border border-ink-100 p-12 text-center">
        <CheckCircle2 className="w-12 h-12 text-ink-200 mx-auto mb-4" />
        <p className="text-[15px] font-medium text-ink-700">No pending approvals</p>
        <p className="text-[12px] text-ink-400 mt-2 max-w-md mx-auto">
          Leave requests, expense claims, and document approvals will appear here when submitted.
        </p>
      </div>
    </div>
  )
}

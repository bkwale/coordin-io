'use client'

import { FileText } from 'lucide-react'

export default function NewFeeQuotePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[22px] font-semibold text-ink-900">New Fee Quote</h1>
        <p className="text-[13px] text-ink-400 mt-1">Create a new fee proposal</p>
      </div>
      <div className="bg-white rounded-xl border border-ink-100 p-12 text-center">
        <FileText className="w-12 h-12 text-ink-200 mx-auto mb-4" />
        <p className="text-[15px] font-medium text-ink-700">No projects available</p>
        <p className="text-[12px] text-ink-400 mt-2 max-w-md mx-auto">
          Create a project first, then you can generate fee quotes linked to it.
        </p>
      </div>
    </div>
  )
}

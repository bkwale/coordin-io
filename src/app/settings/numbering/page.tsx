'use client'

import { Hash } from 'lucide-react'

export default function NumberingPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[22px] font-semibold text-ink-900">Numbering Templates</h1>
        <p className="text-[13px] text-ink-400 mt-1">Configure auto-numbering for projects, quotes, and drawings</p>
      </div>
      <div className="bg-white rounded-xl border border-ink-100 p-12 text-center">
        <Hash className="w-12 h-12 text-ink-200 mx-auto mb-4" />
        <p className="text-[15px] font-medium text-ink-700">No numbering templates yet</p>
        <p className="text-[12px] text-ink-400 mt-2 max-w-md mx-auto">
          Set up numbering conventions for project codes, drawing numbers, quote references, and document revisions.
        </p>
      </div>
    </div>
  )
}

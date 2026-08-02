'use client'

import Link from 'next/link'
import { FileText, Plus } from 'lucide-react'

export default function FeeQuotesPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold text-ink-900">Fee Quotes</h1>
          <p className="text-[13px] text-ink-400 mt-1">Create and manage fee proposals for your projects</p>
        </div>
        <Link
          href="/fee-quotes/new"
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-ink-900 text-white text-[13px] font-medium hover:bg-ink-800 transition-colors self-start shrink-0"
        >
          <Plus className="w-4 h-4" />
          New Quote
        </Link>
      </div>
      <div className="bg-white rounded-xl border border-ink-100 p-12 text-center">
        <FileText className="w-12 h-12 text-ink-200 mx-auto mb-4" />
        <p className="text-[15px] font-medium text-ink-700">No fee quotes yet</p>
        <p className="text-[12px] text-ink-400 mt-2 max-w-md mx-auto">
          Fee quotes will appear here once you create your first proposal. Each quote links to a project and tracks line items, stages, and approval status.
        </p>
      </div>
    </div>
  )
}

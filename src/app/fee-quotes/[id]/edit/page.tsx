'use client'

import { FileText } from 'lucide-react'
import Link from 'next/link'

export default function EditFeeQuotePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[22px] font-semibold text-ink-900">Edit Fee Quote</h1>
        <p className="text-[13px] text-ink-400 mt-1">Modify fee quote details</p>
      </div>
      <div className="bg-white rounded-xl border border-ink-100 p-12 text-center">
        <FileText className="w-12 h-12 text-ink-200 mx-auto mb-4" />
        <p className="text-[15px] font-medium text-ink-700">Quote not found</p>
        <p className="text-[12px] text-ink-400 mt-2 max-w-md mx-auto">
          This fee quote does not exist or has been removed.
        </p>
        <Link href="/fee-quotes" className="inline-block mt-4 text-[13px] text-accent-600 hover:text-accent-700 font-medium">
          Back to Fee Quotes
        </Link>
      </div>
    </div>
  )
}

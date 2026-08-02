'use client'

import { BookOpen } from 'lucide-react'

export default function CPDPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[22px] font-semibold text-ink-900">CPD Records</h1>
        <p className="text-[13px] text-ink-400 mt-1">Continuing professional development tracking</p>
      </div>
      <div className="bg-white rounded-xl border border-ink-100 p-12 text-center">
        <BookOpen className="w-12 h-12 text-ink-200 mx-auto mb-4" />
        <p className="text-[15px] font-medium text-ink-700">No CPD records yet</p>
        <p className="text-[12px] text-ink-400 mt-2 max-w-md mx-auto">
          Log courses, conferences, and learning activities to track professional development hours.
        </p>
      </div>
    </div>
  )
}

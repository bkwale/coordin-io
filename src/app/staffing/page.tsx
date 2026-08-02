'use client'

import { Users } from 'lucide-react'

export default function StaffingPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[22px] font-semibold text-ink-900">Staffing</h1>
        <p className="text-[13px] text-ink-400 mt-1">Resource allocation and capacity planning</p>
      </div>
      <div className="bg-white rounded-xl border border-ink-100 p-12 text-center">
        <Users className="w-12 h-12 text-ink-200 mx-auto mb-4" />
        <p className="text-[15px] font-medium text-ink-700">No staffing data yet</p>
        <p className="text-[12px] text-ink-400 mt-2 max-w-md mx-auto">
          Team capacity, utilisation rates, and resource forecasts will appear once team members are assigned to projects.
        </p>
      </div>
    </div>
  )
}

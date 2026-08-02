'use client'

import { Globe2 } from 'lucide-react'

export default function InternationalSettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[22px] font-semibold text-ink-900">International Settings</h1>
        <p className="text-[13px] text-ink-400 mt-1">Regional standards, jurisdictions, and compliance packs</p>
      </div>
      <div className="bg-white rounded-xl border border-ink-100 p-12 text-center">
        <Globe2 className="w-12 h-12 text-ink-200 mx-auto mb-4" />
        <p className="text-[15px] font-medium text-ink-700">No jurisdiction packs configured</p>
        <p className="text-[12px] text-ink-400 mt-2 max-w-md mx-auto">
          Configure regional building regulations, measurement systems, and compliance standards for international projects.
        </p>
      </div>
    </div>
  )
}

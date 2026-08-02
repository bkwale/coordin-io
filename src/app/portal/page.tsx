'use client'

import { Globe } from 'lucide-react'

export default function PortalPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[22px] font-semibold text-ink-900">Client Portal</h1>
        <p className="text-[13px] text-ink-400 mt-1">Shared documents and project updates for clients</p>
      </div>
      <div className="bg-white rounded-xl border border-ink-100 p-12 text-center">
        <Globe className="w-12 h-12 text-ink-200 mx-auto mb-4" />
        <p className="text-[15px] font-medium text-ink-700">No portal items yet</p>
        <p className="text-[12px] text-ink-400 mt-2 max-w-md mx-auto">
          Share drawings, reports, and project updates with clients through the portal.
        </p>
      </div>
    </div>
  )
}

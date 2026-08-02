'use client'

import { Plug } from 'lucide-react'

export default function IntegrationsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[22px] font-semibold text-ink-900">Integrations</h1>
        <p className="text-[13px] text-ink-400 mt-1">Connect external tools and services</p>
      </div>
      <div className="bg-white rounded-xl border border-ink-100 p-12 text-center">
        <Plug className="w-12 h-12 text-ink-200 mx-auto mb-4" />
        <p className="text-[15px] font-medium text-ink-700">No integrations connected</p>
        <p className="text-[12px] text-ink-400 mt-2 max-w-md mx-auto">
          Connect accounting software, document management, and other tools to streamline your workflow.
        </p>
      </div>
    </div>
  )
}

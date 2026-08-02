'use client'

import { Bot } from 'lucide-react'

export default function AISettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[22px] font-semibold text-ink-900">AI Settings</h1>
        <p className="text-[13px] text-ink-400 mt-1">Manage AI source permissions, visibility rules, and usage logs</p>
      </div>
      <div className="bg-white rounded-xl border border-ink-100 p-12 text-center">
        <Bot className="w-12 h-12 text-ink-200 mx-auto mb-4" />
        <p className="text-[15px] font-medium text-ink-700">No AI configuration yet</p>
        <p className="text-[12px] text-ink-400 mt-2 max-w-md mx-auto">
          Configure which data sources the AI assistant can access and set visibility rules for your organisation.
        </p>
      </div>
    </div>
  )
}

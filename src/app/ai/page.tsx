'use client'

import { Bot } from 'lucide-react'

export default function AIPage() {
  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      <div className="mb-6">
        <h1 className="text-[22px] font-semibold text-ink-900">AI Assistant</h1>
        <p className="text-[13px] text-ink-400 mt-1">Ask questions about architecture, building regulations, and project management</p>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center text-center">
        <div className="w-16 h-16 rounded-2xl bg-ink-50 flex items-center justify-center mb-5">
          <Bot className="w-8 h-8 text-ink-300" />
        </div>
        <h2 className="text-[17px] font-semibold text-ink-700 mb-2">Coming Soon</h2>
        <p className="text-[13px] text-ink-400 max-w-sm leading-relaxed">
          The AI assistant is currently under development. It will be able to answer
          questions about building regulations, RIBA stages, contract administration,
          and other architecture and construction topics.
        </p>
      </div>
    </div>
  )
}

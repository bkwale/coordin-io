'use client'

import { useState } from 'react'
import { Bot, Send, Loader2 } from 'lucide-react'

export default function AIPage() {
  const [query, setQuery] = useState('')
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([])
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!query.trim() || loading) return

    const userMessage = query.trim()
    setQuery('')
    setMessages(prev => [...prev, { role: 'user', content: userMessage }])
    setLoading(true)

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMessage }),
      })

      if (!res.ok) {
        setMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, the AI assistant is not available right now. Please try again later.' }])
      } else {
        const data = await res.json()
        setMessages(prev => [...prev, { role: 'assistant', content: data.response || data.data?.response || 'No response received.' }])
      }
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Unable to reach the AI assistant. Check your connection and try again.' }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      <div className="mb-6">
        <h1 className="text-[22px] font-semibold text-ink-900">AI Assistant</h1>
        <p className="text-[13px] text-ink-400 mt-1">Ask questions about architecture, building regulations, and project management</p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-4 mb-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <Bot className="w-12 h-12 text-ink-200 mb-4" />
            <p className="text-[15px] font-medium text-ink-700">How can I help?</p>
            <p className="text-[12px] text-ink-400 mt-2 max-w-md">
              Ask about building regulations, RIBA stages, contract administration, or any architecture and construction topic.
            </p>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] rounded-xl px-4 py-3 text-[13px] leading-relaxed ${
              msg.role === 'user'
                ? 'bg-ink-900 text-white'
                : 'bg-white border border-ink-100 text-ink-800'
            }`}>
              {msg.content}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-white border border-ink-100 rounded-xl px-4 py-3">
              <Loader2 className="w-4 h-4 text-ink-400 animate-spin" />
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="flex gap-3">
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Ask a question..."
          className="flex-1 px-4 py-3 rounded-xl border border-ink-200 text-[13px] focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-transparent"
          disabled={loading}
        />
        <button
          type="submit"
          disabled={!query.trim() || loading}
          className="px-4 py-3 rounded-xl bg-ink-900 text-white hover:bg-ink-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  )
}

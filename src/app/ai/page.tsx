'use client'

import { useState, useEffect, useRef } from 'react'
import { Breadcrumb } from '@/components/Breadcrumb'
import { cn } from '@/lib/utils'
import { formatDate, timeAgo } from '@/lib/utils'
import {
  getAISuggestedPrompts,
  getAIConversations,
  getAllAIConversations,
  getUser,
} from '@/lib/mock-data'
import { AIConversation, AISuggestedPrompt, AIMessage, AISource } from '@/lib/types'

interface GroupedPrompts {
  [category: string]: AISuggestedPrompt[]
}

export default function AITeammatesPage() {
  const [activeConversation, setActiveConversation] = useState<AIConversation | null>(null)
  const [inputValue, setInputValue] = useState('')
  const [messages, setMessages] = useState<AIMessage[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Load suggested prompts and conversations
  const suggestedPrompts = getAISuggestedPrompts()
  const conversations = getAIConversations()

  // Group prompts by category
  const groupedPrompts: GroupedPrompts = suggestedPrompts.reduce((acc, prompt) => {
    if (!acc[prompt.category]) acc[prompt.category] = []
    acc[prompt.category].push(prompt)
    return acc
  }, {} as GroupedPrompts)

  const categoryOrder = ['Portfolio Overview', 'Risk Management', 'Staffing', 'Commercial', 'Compliance']
  const sortedCategories = categoryOrder.filter(cat => groupedPrompts[cat])

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Load conversation when selected
  const handleSelectConversation = (conversation: AIConversation) => {
    setActiveConversation(conversation)
    setMessages(conversation.messages)
    setInputValue('')
  }

  // Handle suggested prompt click
  const handleSelectPrompt = (prompt: AISuggestedPrompt) => {
    setInputValue(prompt.prompt)
  }

  // Handle send message
  const handleSendMessage = () => {
    if (!inputValue.trim()) return

    // Add user message
    const newUserMessage: AIMessage = {
      id: `msg-${Date.now()}`,
      conversation_id: activeConversation?.id || `conv-${Date.now()}`,
      role: 'user',
      content: inputValue,
      timestamp: new Date().toISOString(),
    }

    setMessages(prev => [...prev, newUserMessage])
    setInputValue('')
    setIsLoading(true)

    // Simulate assistant response delay
    setTimeout(() => {
      const mockResponse: AIMessage = {
        id: `msg-${Date.now() + 1}`,
        conversation_id: newUserMessage.conversation_id,
        role: 'assistant',
        content: 'I\'m analyzing your portfolio data... This is a demo — in production, I\'d connect to your live project data to answer this question. Try selecting one of the recent conversations to see example interactions.',
        sources: [],
        timestamp: new Date().toISOString(),
      }
      setMessages(prev => [...prev, mockResponse])
      setIsLoading(false)
    }, 1500)
  }

  // Handle Enter key to send
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const displayMessages = messages.length > 0 ? messages : []
  const isInputEmpty = !inputValue.trim()

  return (
    <div className="max-w-7xl animate-fade-in">
      {/* ━━━ HEADER ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section className="pb-8">
        <Breadcrumb items={[{ label: 'AI Teammate' }]} />
        <div className="mt-6">
          <h1 className="font-display text-3xl text-ink-900 tracking-tight mb-2">
            AI Teammate
          </h1>
          <p className="text-[13px] text-ink-400">
            Ask questions about your portfolio, risks, staffing, and compliance
          </p>
        </div>
      </section>

      {/* ━━━ MAIN LAYOUT: 2/3 CHAT + 1/3 SIDEBAR ━━━━━━━━━━━ */}
      <div className="grid grid-cols-3 gap-8">
        {/* LEFT COLUMN: CHAT AREA */}
        <div className="col-span-2">
          {/* No active conversation state */}
          {!activeConversation && displayMessages.length === 0 ? (
            <div className="flex flex-col items-center justify-center min-h-[600px] text-center">
              <div className="max-w-sm">
                <div className="w-16 h-16 rounded-full bg-accent-100 flex items-center justify-center mx-auto mb-6">
                  <span className="text-2xl font-display text-accent-600">A</span>
                </div>
                <h2 className="font-display text-2xl text-ink-900 mb-2">Start a conversation</h2>
                <p className="text-[13px] text-ink-400 mb-8">
                  Select a conversation from the history or try one of the suggested prompts
                </p>
              </div>

              {/* Suggested prompts grid in welcome state */}
              <div className="w-full mt-8 space-y-6">
                {sortedCategories.map(category => (
                  <div key={category}>
                    <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-3">
                      {category}
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      {groupedPrompts[category].slice(0, 2).map(prompt => (
                        <button
                          key={prompt.id}
                          onClick={() => handleSelectPrompt(prompt)}
                          className={cn(
                            'p-4 text-left rounded-xl border transition-all',
                            'card-premium hover:border-accent-300 hover:bg-accent-50'
                          )}
                        >
                          <p className="text-[12px] font-medium text-ink-900">{prompt.label}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            // Chat area with messages
            <>
              {/* Messages container */}
              <div className="max-h-[600px] overflow-y-auto mb-6 space-y-4 card-premium p-6">
                {displayMessages.map(msg => (
                  <div
                    key={msg.id}
                    className={cn(
                      'flex gap-4',
                      msg.role === 'user' ? 'justify-end' : 'justify-start'
                    )}
                  >
                    {/* Assistant avatar */}
                    {msg.role === 'assistant' && (
                      <div className="flex-shrink-0">
                        <div className="w-8 h-8 rounded-full bg-accent-100 flex items-center justify-center">
                          <span className="text-sm font-display text-accent-600">A</span>
                        </div>
                      </div>
                    )}

                    {/* Message bubble */}
                    <div
                      className={cn(
                        'max-w-[500px] px-4 py-3 rounded-lg text-[13px] leading-relaxed',
                        msg.role === 'user'
                          ? 'bg-accent-600 text-white rounded-br-none'
                          : 'bg-white border border-slate-200 text-ink-900 rounded-bl-none'
                      )}
                    >
                      {/* Parse and render markdown-style bold */}
                      {msg.role === 'user' ? (
                        msg.content
                      ) : (
                        <div className="space-y-2">
                          {msg.content.split('\n\n').map((paragraph, i) => (
                            <p key={i}>
                              {paragraph.split(/(\*\*[^*]+\*\*)/g).map((part, j) => {
                                if (part.startsWith('**') && part.endsWith('**')) {
                                  return (
                                    <strong key={j}>
                                      {part.slice(2, -2)}
                                    </strong>
                                  )
                                }
                                return part
                              })}
                            </p>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* User spacer */}
                    {msg.role === 'user' && <div className="w-8" />}
                  </div>
                ))}

                {/* Sources */}
                {displayMessages.length > 0 && displayMessages[displayMessages.length - 1]?.sources && displayMessages[displayMessages.length - 1].sources!.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-6 pt-4 border-t border-slate-100">
                    {displayMessages[displayMessages.length - 1].sources!.map((source, i) => (
                      <div
                        key={i}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 text-[11px]"
                      >
                        <span className="text-[10px]">📎</span>
                        <span className="font-medium">{source.title}</span>
                      </div>
                    ))}
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Input area */}
              <div className="flex gap-3">
                <textarea
                  value={inputValue}
                  onChange={e => setInputValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask about your portfolio, risks, staffing..."
                  rows={3}
                  className={cn(
                    'flex-1 px-4 py-3 rounded-xl border border-slate-200 bg-white text-[13px]',
                    'placeholder-slate-400 focus:outline-none focus:border-accent-300 focus:ring-1 focus:ring-accent-100',
                    'resize-none'
                  )}
                />
                <button
                  onClick={handleSendMessage}
                  disabled={isInputEmpty || isLoading}
                  className={cn(
                    'flex-shrink-0 px-4 py-3 rounded-xl font-medium text-[13px] transition-all self-end',
                    isInputEmpty || isLoading
                      ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                      : 'bg-accent-600 text-white hover:bg-accent-700 active:scale-95'
                  )}
                >
                  {isLoading ? 'Sending...' : 'Send'}
                </button>
              </div>
            </>
          )}
        </div>

        {/* RIGHT COLUMN: HISTORY & PROMPTS */}
        <div className="col-span-1 space-y-8">
          {/* Recent Conversations */}
          <div className="border-t border-slate-200 pt-6">
            <h3 className="font-display text-[13px] font-semibold text-ink-900 mb-4 uppercase tracking-wider">
              Recent Conversations
            </h3>
            <div className="space-y-2">
              {conversations.length > 0 ? (
                conversations.map(conversation => (
                  <button
                    key={conversation.id}
                    onClick={() => handleSelectConversation(conversation)}
                    className={cn(
                      'w-full text-left p-3 rounded-lg border transition-all text-[12px]',
                      activeConversation?.id === conversation.id
                        ? 'bg-accent-50 border-accent-300'
                        : 'card-premium hover:border-slate-300 hover:bg-slate-50'
                    )}
                  >
                    <p className="font-medium text-ink-900 truncate">{conversation.title}</p>
                    <p className="text-[11px] text-ink-400 mt-1">
                      {conversation.messages.length} messages
                    </p>
                    <p className="text-[10px] text-ink-300 mt-1">
                      {timeAgo(conversation.updated_at)}
                    </p>
                  </button>
                ))
              ) : (
                <p className="text-[12px] text-ink-400">No conversations yet</p>
              )}
            </div>
          </div>

          {/* Suggested Prompts */}
          <div className="border-t border-slate-200 pt-6">
            <h3 className="font-display text-[13px] font-semibold text-ink-900 mb-4 uppercase tracking-wider">
              Suggested Prompts
            </h3>
            <div className="space-y-4">
              {sortedCategories.map(category => (
                <div key={category}>
                  <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-2">
                    {category}
                  </p>
                  <div className="space-y-1.5">
                    {groupedPrompts[category].map(prompt => (
                      <button
                        key={prompt.id}
                        onClick={() => handleSelectPrompt(prompt)}
                        className="w-full text-left px-3 py-2 rounded-lg card-premium hover:border-accent-200 hover:bg-accent-50 transition-all text-[12px] font-medium text-ink-900"
                      >
                        {prompt.label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

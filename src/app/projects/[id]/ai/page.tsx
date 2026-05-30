'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams } from 'next/navigation'
import { PROJECTS, getAISuggestedPrompts, getAIConversations, getUser } from '@/lib/mock-data'
import { AIConversation, AISuggestedPrompt, AIMessage } from '@/lib/types'
import { cn, formatDate, timeAgo } from '@/lib/utils'

import { EmptyState } from '@/components/EmptyState'

export default function ProjectAITeammatePage() {
  const params = useParams()
  const projectId = params.id as string
  const project = PROJECTS.find(p => p.id === projectId)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // ── State ──────────────────────────────────────────────────
  const [messages, setMessages] = useState<AIMessage[]>([])
  const [inputValue, setInputValue] = useState('')
  const [activeConversation, setActiveConversation] = useState<AIConversation | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [showConversationHistory, setShowConversationHistory] = useState(false)

  // ── Data ──────────────────────────────────────────────────
  const suggestedPrompts = getAISuggestedPrompts('project')
  const projectConversations = getAIConversations(projectId)

  // ── Auto-scroll to bottom ──────────────────────────────────
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // ── Guard: Project not found ──────────────────────────────
  if (!project) {
    return <EmptyState message="Project not found." />
  }

  // ── Handle prompt click (from suggested pills) ────────────
  const handleSuggestedPromptClick = (prompt: AISuggestedPrompt) => {
    handleSendMessage(prompt.prompt)
  }

  // ── Handle send message ────────────────────────────────────
  const handleSendMessage = (content?: string) => {
    const messageContent = content || inputValue
    if (!messageContent.trim()) return

    // Add user message
    const userMessage: AIMessage = {
      id: `msg-${Date.now()}`,
      conversation_id: activeConversation?.id || `conv-new-${projectId}`,
      role: 'user',
      content: messageContent,
      timestamp: new Date().toISOString(),
    }

    setMessages(prev => [...prev, userMessage])
    setInputValue('')
    setIsLoading(true)

    // Mock assistant response after 1500ms delay
    setTimeout(() => {
      const assistantMessage: AIMessage = {
        id: `msg-${Date.now()}-assistant`,
        conversation_id: activeConversation?.id || `conv-new-${projectId}`,
        role: 'assistant',
        content: `I understand you're asking about "${messageContent}" on ${project.name}. Based on the project data, I can help you with:\n\n• **Project Status**: ${project.status}\n• **Current Stage**: ${project.current_stage}\n• **Client**: ${project.client}\n\nWould you like more detailed information about any specific aspect of this project?`,
        sources: [
          { type: 'project', title: project.name, reference_id: projectId },
        ],
        timestamp: new Date().toISOString(),
      }

      setMessages(prev => [...prev, assistantMessage])
      setIsLoading(false)
    }, 1500)
  }

  // ── Handle conversation load ───────────────────────────────
  const handleLoadConversation = (conversation: AIConversation) => {
    setActiveConversation(conversation)
    setMessages(conversation.messages)
    setShowConversationHistory(false)
  }

  // ── Handle new conversation ────────────────────────────────
  const handleNewConversation = () => {
    setActiveConversation(null)
    setMessages([])
  }

  // ── Handle keyboard: Enter to send ──────────────────────────
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  return (
    <div className="space-y-6 sm:space-y-8 flex flex-col h-full animate-fade-in">
      {/* ── Title ────────────────────────────── */}
      <div className="flex-shrink-0">
        <div>
          <h1 className="text-2xl font-display font-bold text-ink-900">
            AI Teammate — {project.name}
          </h1>
          <p className="text-sm text-ink-400 mt-1">
            Ask questions about this project's progress, risks, and tasks
          </p>
        </div>
      </div>

      {/* ── Main Chat Area ────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-h-0 space-y-4">
        {/* ── Suggested Prompts (shown when no conversation active) ── */}
        {messages.length === 0 && (
          <div className="space-y-3">
            <p className="text-xs font-semibold text-ink-400 uppercase tracking-wide">Suggested Questions</p>
            <div className="flex gap-2 overflow-x-auto pb-2">
              {suggestedPrompts.map(prompt => (
                <button
                  key={prompt.id}
                  onClick={() => handleSuggestedPromptClick(prompt)}
                  className="flex-shrink-0 px-4 py-2 bg-white border border-surface-200 rounded-full text-sm font-medium text-ink-700 hover:bg-surface-50 transition-colors whitespace-nowrap"
                >
                  {prompt.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Messages Container ────────────────────────────── */}
        <div className="flex-1 overflow-y-auto space-y-4 px-1">
          {messages.map(message => (
            <div
              key={message.id}
              className={cn(
                'flex gap-3 animate-fade-in',
                message.role === 'user' ? 'justify-end' : 'justify-start'
              )}
            >
              {/* ── Assistant Avatar ──────────────────────────── */}
              {message.role === 'assistant' && (
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-accent-100 border border-accent-200 flex items-center justify-center">
                  <span className="text-xs font-bold text-accent-700">A</span>
                </div>
              )}

              {/* ── Message Bubble ────────────────────────────── */}
              <div
                className={cn(
                  'max-w-md rounded-lg px-4 py-3 text-sm leading-relaxed',
                  message.role === 'user'
                    ? 'bg-accent-600 text-white rounded-br-none'
                    : 'bg-white border border-surface-200 text-ink-900 rounded-bl-none shadow-card'
                )}
              >
                {/* ── Parse bold text in content ────────────────── */}
                <div className="whitespace-pre-wrap">
                  {message.content.split(/\*\*(.+?)\*\*/g).map((part, idx) =>
                    idx % 2 === 1 ? (
                      <strong key={idx}>{part}</strong>
                    ) : (
                      <span key={idx}>{part}</span>
                    )
                  )}
                </div>

                {/* ── Source Pills ──────────────────────────────── */}
                {message.sources && message.sources.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-surface-200/40 flex flex-wrap gap-1.5">
                    {message.sources.map((source, idx) => (
                      <span
                        key={idx}
                        className="inline-block text-[11px] font-medium px-2 py-1 rounded-md bg-surface-100 text-ink-600"
                      >
                        {source.title}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* ── User Avatar Spacer ────────────────────────── */}
              {message.role === 'user' && (
                <div className="flex-shrink-0 w-8 h-8" />
              )}
            </div>
          ))}

          {/* ── Loading Indicator ────────────────────────────── */}
          {isLoading && (
            <div className="flex gap-3">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-accent-100 border border-accent-200 flex items-center justify-center">
                <span className="text-xs font-bold text-accent-700">A</span>
              </div>
              <div className="max-w-md rounded-lg px-4 py-3 bg-white border border-surface-200 shadow-card rounded-bl-none">
                <div className="flex gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-ink-400 animate-pulse" />
                  <div className="w-2 h-2 rounded-full bg-ink-400 animate-pulse" style={{ animationDelay: '0.1s' }} />
                  <div className="w-2 h-2 rounded-full bg-ink-400 animate-pulse" style={{ animationDelay: '0.2s' }} />
                </div>
              </div>
            </div>
          )}

          {/* ── Scroll anchor ────────────────────────────────── */}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* ── Input Area ────────────────────────────────────────── */}
      <div className="flex-shrink-0 space-y-3 border-t border-surface-200 pt-4">
        {/* ── Conversation History Toggle ───────────────────── */}
        {projectConversations.length > 0 && (
          <div>
            <button
              onClick={() => setShowConversationHistory(!showConversationHistory)}
              className="text-xs font-semibold text-accent-600 hover:text-accent-700 uppercase tracking-wide"
            >
              {showConversationHistory ? '— Hide' : '+ Show'} Previous Conversations ({projectConversations.length})
            </button>

            {/* ── Conversation History List ────────────────────── */}
            {showConversationHistory && (
              <div className="mt-3 space-y-2 max-h-40 overflow-y-auto">
                {projectConversations.map(conv => (
                  <button
                    key={conv.id}
                    onClick={() => handleLoadConversation(conv)}
                    className={cn(
                      'w-full text-left px-3 py-2 rounded-lg text-xs transition-colors',
                      activeConversation?.id === conv.id
                        ? 'bg-accent-50 border border-accent-200 text-accent-700 font-medium'
                        : 'bg-surface-50 border border-surface-200 text-ink-600 hover:bg-surface-100'
                    )}
                  >
                    <div className="font-medium truncate">{conv.title}</div>
                    <div className="text-[10px] text-ink-400 mt-0.5">
                      {timeAgo(conv.updated_at)}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── New Conversation Button (if viewing conversation) ── */}
        {activeConversation && (
          <div className="pb-2">
            <button
              onClick={handleNewConversation}
              className="text-xs font-semibold text-ink-400 hover:text-ink-600 uppercase tracking-wide"
            >
              + Start New Conversation
            </button>
          </div>
        )}

        {/* ── Input Textarea ────────────────────────────────── */}
        <div className="flex gap-2">
          <textarea
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about this project..."
            disabled={isLoading}
            className="flex-1 px-4 py-3 rounded-lg border border-surface-200 focus:border-accent-400 focus:ring-1 focus:ring-accent-200 outline-none resize-none text-sm placeholder-ink-300 transition-colors disabled:bg-surface-50 disabled:text-ink-400"
            rows={3}
          />
          <button
            onClick={() => handleSendMessage()}
            disabled={isLoading || !inputValue.trim()}
            className="flex-shrink-0 px-4 py-3 bg-accent-600 text-white font-semibold rounded-lg hover:bg-accent-700 transition-colors disabled:bg-surface-200 disabled:text-ink-400 disabled:cursor-not-allowed"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  )
}

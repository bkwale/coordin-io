'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import {
  Ticket, AlertCircle, Clock, CheckCircle2,
  ChevronRight, Bug, HelpCircle, Lightbulb, ShieldAlert, MoreHorizontal,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { SkeletonRow } from '@/components/Skeleton'

interface TicketItem {
  id: string
  ref: string
  title: string
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED'
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  category: string
  page: string | null
  submitter: { id: string; fullName: string; email: string }
  replyCount: number
  createdAt: string
  updatedAt: string
  resolvedAt: string | null
}

const STATUS_CONFIG = {
  OPEN: { label: 'Open', color: 'bg-blue-50 text-blue-600', icon: AlertCircle },
  IN_PROGRESS: { label: 'In Progress', color: 'bg-amber-50 text-amber-600', icon: Clock },
  RESOLVED: { label: 'Resolved', color: 'bg-emerald-50 text-emerald-600', icon: CheckCircle2 },
  CLOSED: { label: 'Closed', color: 'bg-surface-200 text-ink-400', icon: CheckCircle2 },
}

const PRIORITY_CONFIG = {
  LOW: { label: 'Low', dot: 'bg-emerald-500' },
  MEDIUM: { label: 'Medium', dot: 'bg-amber-500' },
  HIGH: { label: 'High', dot: 'bg-orange-500' },
  CRITICAL: { label: 'Critical', dot: 'bg-red-500' },
}

const CATEGORY_ICON = {
  BUG: Bug,
  FEATURE_REQUEST: Lightbulb,
  QUESTION: HelpCircle,
  ACCESS_ISSUE: ShieldAlert,
  OTHER: MoreHorizontal,
}

type StatusFilter = 'all' | 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED'

export default function SupportTicketsPage() {
  const [tickets, setTickets] = useState<TicketItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState<StatusFilter>('all')

  const fetchTickets = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/support-tickets')
      if (!res.ok) throw new Error('Failed to load tickets')
      const data = await res.json()
      setTickets(data.data?.tickets || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tickets')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchTickets() }, [fetchTickets])

  const statusCounts = tickets.reduce<Record<string, number>>((acc, t) => {
    acc[t.status] = (acc[t.status] || 0) + 1
    return acc
  }, {})

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-[24px] font-semibold text-ink-900 flex items-center gap-2.5">
          <Ticket className="w-5 h-5 text-accent-500" />
          My Tickets
        </h1>
        <p className="text-[13px] text-ink-400 mt-1">Track your support requests and their progress.</p>
      </div>

      {/* Status filter pills */}
      <div className="flex gap-2 flex-wrap">
        {(['all', 'OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'] as const).map(f => {
          const label = f === 'all' ? 'All' : STATUS_CONFIG[f].label
          const count = f === 'all' ? tickets.length : (statusCounts[f] || 0)
          return (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all border',
                filter === f
                  ? 'bg-accent-50 border-accent-200 text-accent-700'
                  : 'bg-white border-surface-200 text-ink-400 hover:text-ink-700 hover:border-surface-300'
              )}
            >
              {label}
              <span className={cn(
                'text-[10px] px-1.5 py-0.5 rounded-full',
                filter === f ? 'bg-accent-100 text-accent-600' : 'bg-surface-100 text-ink-400'
              )}>{count}</span>
            </button>
          )
        })}
      </div>

      {/* Ticket list */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <SkeletonRow key={i} />)}
        </div>
      ) : error ? (
        <div className="text-center py-16">
          <AlertCircle className="w-8 h-8 text-red-400 mx-auto mb-3" />
          <p className="text-[13px] text-ink-400">{error}</p>
        </div>
      ) : tickets.length === 0 ? (
        <div className="text-center py-16">
          <Ticket className="w-8 h-8 text-ink-200 mx-auto mb-3" />
          <p className="text-[14px] text-ink-500">No tickets yet.</p>
          <p className="text-[12px] text-ink-300 mt-1">Use &quot;Report Issue&quot; in the sidebar to submit a ticket.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {tickets
            .filter(t => filter === 'all' || t.status === filter)
            .map(ticket => {
              const statusCfg = STATUS_CONFIG[ticket.status]
              const priorityCfg = PRIORITY_CONFIG[ticket.priority]
              const CategoryIcon = CATEGORY_ICON[ticket.category as keyof typeof CATEGORY_ICON] || MoreHorizontal
              const StatusIcon = statusCfg.icon

              return (
                <Link
                  key={ticket.id}
                  href={`/support-tickets/${ticket.id}`}
                  className="flex items-center gap-4 p-4 rounded-xl bg-white border border-surface-200 hover:border-accent-200 hover:shadow-card transition-all group"
                >
                  {/* Category icon */}
                  <div className="w-9 h-9 rounded-lg bg-surface-100 flex items-center justify-center shrink-0">
                    <CategoryIcon className="w-4 h-4 text-ink-400" />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[11px] text-ink-300 font-mono">{ticket.ref}</span>
                      <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium', statusCfg.color)}>
                        <StatusIcon className="w-3 h-3" />
                        {statusCfg.label}
                      </span>
                      <span className="flex items-center gap-1 text-[10px] text-ink-300">
                        <span className={cn('w-1.5 h-1.5 rounded-full', priorityCfg.dot)} />
                        {priorityCfg.label}
                      </span>
                    </div>
                    <p className="text-[13px] text-ink-900 font-medium truncate">{ticket.title}</p>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-[11px] text-ink-300">
                        {new Date(ticket.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                      {ticket.replyCount > 0 && (
                        <span className="text-[11px] text-accent-600">{ticket.replyCount} {ticket.replyCount === 1 ? 'reply' : 'replies'}</span>
                      )}
                    </div>
                  </div>

                  {/* Arrow */}
                  <ChevronRight className="w-4 h-4 text-ink-200 group-hover:text-accent-500 transition-colors shrink-0" />
                </Link>
              )
            })}
        </div>
      )}
    </div>
  )
}

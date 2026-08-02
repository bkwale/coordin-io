'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Bell, ClipboardList, RefreshCw, FileText, CalendarDays,
  Wallet, PoundSterling, AtSign, CheckCheck, Inbox,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { timeAgo } from '@/lib/utils'
import { SkeletonRow } from '@/components/Skeleton'

/* ── Types ─────────────────────────────────────────────── */

interface Notification {
  id: string
  type: string
  title: string
  body: string | null
  linkUrl: string | null
  read: boolean
  readAt: string | null
  createdAt: string
}

type TypeFilter = 'all' | 'tasks' | 'documents' | 'leave' | 'expenses' | 'budget' | 'mentions'
type ReadFilter = 'all' | 'unread' | 'read'

/* ── Constants ─────────────────────────────────────────── */

const TYPE_FILTERS: { value: TypeFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'tasks', label: 'Tasks' },
  { value: 'documents', label: 'Documents' },
  { value: 'leave', label: 'Leave' },
  { value: 'expenses', label: 'Expenses' },
  { value: 'budget', label: 'Budget' },
  { value: 'mentions', label: 'Mentions' },
]

const READ_FILTERS: { value: ReadFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'unread', label: 'Unread' },
  { value: 'read', label: 'Read' },
]

const TYPE_ICONS: Record<string, React.FC<{ className?: string }>> = {
  'task.assigned': ClipboardList,
  'task.status_changed': RefreshCw,
  'document.review': FileText,
  'leave.status_changed': CalendarDays,
  'expense.status_changed': Wallet,
  'budget.approval_needed': PoundSterling,
  'mention': AtSign,
}

function getTypeIcon(type: string) {
  return TYPE_ICONS[type] || Bell
}

function matchesTypeFilter(type: string, filter: TypeFilter): boolean {
  switch (filter) {
    case 'all': return true
    case 'tasks': return type.startsWith('task.')
    case 'documents': return type.startsWith('document.')
    case 'leave': return type.startsWith('leave.')
    case 'expenses': return type.startsWith('expense.')
    case 'budget': return type.startsWith('budget.')
    case 'mentions': return type === 'mention'
    default: return true
  }
}

/* ── Page ──────────────────────────────────────────────── */

const PAGE_SIZE = 20

export default function NotificationsPage() {
  const router = useRouter()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [total, setTotal] = useState(0)
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [offset, setOffset] = useState(0)

  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')
  const [readFilter, setReadFilter] = useState<ReadFilter>('all')

  /* ── Fetch ───────────────────────────────────────────── */

  const fetchNotifications = useCallback(async (currentOffset: number, append: boolean = false) => {
    try {
      setError(null)
      const params = new URLSearchParams({
        limit: String(PAGE_SIZE),
        offset: String(currentOffset),
      })
      if (readFilter === 'unread') params.set('unreadOnly', 'true')

      const res = await fetch(`/api/notifications?${params}`)
      if (!res.ok) throw new Error('Failed to load notifications')
      const json = await res.json()
      const data = json.data

      if (append) {
        setNotifications(prev => [...prev, ...(data.notifications || [])])
      } else {
        setNotifications(data.notifications || [])
      }
      setTotal(data.total || 0)
      setUnreadCount(data.unreadCount || 0)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    }
  }, [readFilter])

  /* ── Initial load + reload on filter change ──────────── */

  useEffect(() => {
    setLoading(true)
    setOffset(0)
    fetchNotifications(0).finally(() => setLoading(false))
  }, [fetchNotifications])

  /* ── Load more ───────────────────────────────────────── */

  const loadMore = useCallback(async () => {
    const newOffset = offset + PAGE_SIZE
    setLoadingMore(true)
    await fetchNotifications(newOffset, true)
    setOffset(newOffset)
    setLoadingMore(false)
  }, [offset, fetchNotifications])

  /* ── Mark all read ───────────────────────────────────── */

  const markAllRead = useCallback(async () => {
    try {
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markAllRead: true }),
      })
      setNotifications(prev =>
        prev.map(n => ({ ...n, read: true, readAt: new Date().toISOString() }))
      )
      setUnreadCount(0)
    } catch {
      // Silently fail
    }
  }, [])

  /* ── Mark single as read + navigate ──────────────────── */

  const handleClick = useCallback(async (n: Notification) => {
    if (!n.read) {
      try {
        await fetch('/api/notifications', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids: [n.id] }),
        })
        setNotifications(prev =>
          prev.map(item => item.id === n.id ? { ...item, read: true, readAt: new Date().toISOString() } : item)
        )
        setUnreadCount(prev => Math.max(0, prev - 1))
      } catch {
        // Silently fail
      }
    }
    if (n.linkUrl) {
      router.push(n.linkUrl)
    }
  }, [router])

  /* ── Client-side type filtering ──────────────────────── */

  const filtered = notifications.filter(n => {
    if (!matchesTypeFilter(n.type, typeFilter)) return false
    if (readFilter === 'read' && !n.read) return false
    // 'unread' is already filtered server-side, but double-check
    if (readFilter === 'unread' && n.read) return false
    return true
  })

  const hasMore = notifications.length < total

  /* ── Render ──────────────────────────────────────────── */

  return (
    <div className="min-h-screen bg-surface-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <h1 className="text-[18px] font-semibold text-ink-900">Notifications</h1>
            {unreadCount > 0 && (
              <span className="inline-flex items-center justify-center min-w-[22px] h-[22px] rounded-full bg-red-500 text-white text-[11px] font-semibold px-1.5">
                {unreadCount}
              </span>
            )}
          </div>
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium text-accent-600 hover:bg-accent-50 transition-colors"
            >
              <CheckCheck className="w-4 h-4" />
              Mark all as read
            </button>
          )}
        </div>

        {/* Filter bar */}
        <div className="bg-white rounded-xl border border-ink-100 px-4 py-3 mb-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            {/* Type filter */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {TYPE_FILTERS.map(f => (
                <button
                  key={f.value}
                  onClick={() => setTypeFilter(f.value)}
                  className={cn(
                    'px-2.5 py-1 rounded-full text-[12px] font-medium transition-colors',
                    typeFilter === f.value
                      ? 'bg-accent-100 text-accent-700'
                      : 'text-ink-400 hover:text-ink-600 hover:bg-ink-50'
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Divider */}
            <div className="hidden sm:block w-px h-5 bg-ink-100" />

            {/* Read status filter */}
            <div className="flex items-center gap-1.5">
              {READ_FILTERS.map(f => (
                <button
                  key={f.value}
                  onClick={() => setReadFilter(f.value)}
                  className={cn(
                    'px-2.5 py-1 rounded-full text-[12px] font-medium transition-colors',
                    readFilter === f.value
                      ? 'bg-ink-900 text-white'
                      : 'text-ink-400 hover:text-ink-600 hover:bg-ink-50'
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Notifications list */}
        <div className="bg-white rounded-xl border border-ink-100 overflow-hidden">
          {loading ? (
            <div className="divide-y divide-ink-50">
              {Array.from({ length: 6 }).map((_, i) => (
                <SkeletonRow key={i} />
              ))}
            </div>
          ) : error ? (
            <div className="px-6 py-12 text-center">
              <p className="text-[13px] text-red-500">{error}</p>
              <button
                onClick={() => {
                  setLoading(true)
                  setOffset(0)
                  fetchNotifications(0).finally(() => setLoading(false))
                }}
                className="mt-3 text-[12px] text-accent-600 hover:text-accent-700 font-medium"
              >
                Try again
              </button>
            </div>
          ) : filtered.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <Inbox className="w-10 h-10 text-ink-200 mx-auto mb-3" />
              <p className="text-[14px] font-medium text-ink-500">No notifications</p>
              <p className="text-[12px] text-ink-400 mt-1">
                {typeFilter !== 'all' || readFilter !== 'all'
                  ? 'Try adjusting your filters'
                  : 'You\'re all caught up'}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-ink-50">
              {filtered.map(n => {
                const Icon = getTypeIcon(n.type)
                return (
                  <button
                    key={n.id}
                    onClick={() => handleClick(n)}
                    className={cn(
                      'w-full flex items-start gap-4 px-5 py-4 text-left hover:bg-surface-50 transition-colors',
                      !n.read && 'bg-accent-50/20'
                    )}
                  >
                    {/* Type icon */}
                    <div className="shrink-0 mt-0.5">
                      <div className={cn(
                        'w-9 h-9 rounded-lg flex items-center justify-center',
                        !n.read ? 'bg-accent-100 text-accent-600' : 'bg-ink-100 text-ink-400'
                      )}>
                        <Icon className="w-[18px] h-[18px]" />
                      </div>
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className={cn(
                            'text-[13px] leading-snug',
                            !n.read ? 'font-semibold text-ink-900' : 'font-medium text-ink-700'
                          )}>
                            {n.title}
                          </p>
                          {n.body && (
                            <p className="text-[12px] text-ink-400 mt-0.5 line-clamp-2">{n.body}</p>
                          )}
                          <p className="text-[11px] text-ink-300 mt-1.5">{timeAgo(n.createdAt)}</p>
                        </div>

                        {/* Unread dot */}
                        {!n.read && (
                          <span className="shrink-0 mt-1.5 w-2.5 h-2.5 rounded-full bg-accent-500" />
                        )}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          )}

          {/* Load more */}
          {!loading && !error && hasMore && (
            <div className="border-t border-ink-100 px-5 py-3 text-center">
              <button
                onClick={loadMore}
                disabled={loadingMore}
                className="text-[12px] font-medium text-accent-600 hover:text-accent-700 disabled:opacity-50 transition-colors"
              >
                {loadingMore ? 'Loading...' : 'Load more'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

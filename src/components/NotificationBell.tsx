'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Bell, ClipboardList, RefreshCw, FileText, CalendarDays,
  Wallet, PoundSterling, AtSign, CheckCheck,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { timeAgo } from '@/lib/utils'

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

/* ── Icon mapping ──────────────────────────────────────── */

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

/* ── Component ─────────────────────────────────────────── */

export function NotificationBell() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  /* ── Fetch notifications ─────────────────────────────── */

  const fetchNotifications = useCallback(async () => {
    try {
      setError(null)
      const res = await fetch('/api/notifications?limit=10')
      if (!res.ok) throw new Error('Failed to load notifications')
      const json = await res.json()
      setNotifications(json.data?.notifications || [])
      setUnreadCount(json.data?.unreadCount || 0)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    }
  }, [])

  /* ── Poll every 60 seconds + fetch on mount ──────────── */

  useEffect(() => {
    fetchNotifications()
    const interval = setInterval(fetchNotifications, 60_000)
    return () => clearInterval(interval)
  }, [fetchNotifications])

  /* ── Re-fetch when dropdown opens ────────────────────── */

  useEffect(() => {
    if (open) {
      setLoading(true)
      fetchNotifications().finally(() => setLoading(false))
    }
  }, [open, fetchNotifications])

  /* ── Click-outside listener ──────────────────────────── */

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setOpen(false)
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  /* ── Mark as read ────────────────────────────────────── */

  const markAsRead = useCallback(async (ids: string[]) => {
    try {
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      })
      setNotifications(prev =>
        prev.map(n => ids.includes(n.id) ? { ...n, read: true, readAt: new Date().toISOString() } : n)
      )
      setUnreadCount(prev => Math.max(0, prev - ids.length))
    } catch {
      // Silently fail — user can retry
    }
  }, [])

  const markAllRead = useCallback(async () => {
    try {
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markAllRead: true }),
      })
      setNotifications(prev => prev.map(n => ({ ...n, read: true, readAt: new Date().toISOString() })))
      setUnreadCount(0)
    } catch {
      // Silently fail
    }
  }, [])

  /* ── Click notification ──────────────────────────────── */

  const handleNotificationClick = useCallback((n: Notification) => {
    if (!n.read) {
      markAsRead([n.id])
    }
    if (n.linkUrl) {
      router.push(n.linkUrl)
    }
    setOpen(false)
  }, [markAsRead, router])

  /* ── Render ──────────────────────────────────────────── */

  return (
    <div className="relative">
      {/* Bell button */}
      <button
        ref={buttonRef}
        onClick={() => setOpen(prev => !prev)}
        className="relative p-2 rounded-lg hover:bg-surface-100 transition-colors"
        aria-label="Notifications"
      >
        <Bell className="w-5 h-5 text-ink-400" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[18px] h-[18px] rounded-full bg-red-500 text-white text-[10px] font-semibold px-1 leading-none">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div
          ref={dropdownRef}
          className="absolute right-0 top-full mt-2 w-[380px] bg-white rounded-xl border border-ink-100 shadow-elevated z-50 overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-ink-100">
            <h3 className="text-[14px] font-semibold text-ink-900">Notifications</h3>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="flex items-center gap-1.5 text-[12px] text-accent-600 hover:text-accent-700 font-medium transition-colors"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                Mark all as read
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-[400px] overflow-y-auto">
            {loading && notifications.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <div className="w-5 h-5 border-2 border-ink-200 border-t-accent-500 rounded-full animate-spin mx-auto" />
                <p className="text-[12px] text-ink-400 mt-2">Loading...</p>
              </div>
            ) : error ? (
              <div className="px-4 py-8 text-center">
                <p className="text-[12px] text-red-500">{error}</p>
              </div>
            ) : notifications.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <Bell className="w-8 h-8 text-ink-200 mx-auto mb-2" />
                <p className="text-[13px] text-ink-400">No notifications yet</p>
              </div>
            ) : (
              notifications.map(n => {
                const Icon = getTypeIcon(n.type)
                return (
                  <button
                    key={n.id}
                    onClick={() => handleNotificationClick(n)}
                    className={cn(
                      'w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-surface-50 transition-colors border-b border-ink-50 last:border-b-0',
                      !n.read && 'bg-accent-50/30'
                    )}
                  >
                    {/* Type icon */}
                    <div className="shrink-0 mt-0.5">
                      <div className={cn(
                        'w-8 h-8 rounded-lg flex items-center justify-center',
                        !n.read ? 'bg-accent-100 text-accent-600' : 'bg-ink-100 text-ink-400'
                      )}>
                        <Icon className="w-4 h-4" />
                      </div>
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <p className={cn(
                        'text-[13px] leading-snug truncate',
                        !n.read ? 'font-semibold text-ink-900' : 'font-medium text-ink-700'
                      )}>
                        {n.title}
                      </p>
                      {n.body && (
                        <p className="text-[12px] text-ink-400 truncate mt-0.5">{n.body}</p>
                      )}
                      <p className="text-[11px] text-ink-300 mt-1">{timeAgo(n.createdAt)}</p>
                    </div>

                    {/* Unread dot */}
                    {!n.read && (
                      <span className="shrink-0 mt-2 w-2 h-2 rounded-full bg-accent-500" />
                    )}
                  </button>
                )
              })
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-ink-100">
            <button
              onClick={() => {
                setOpen(false)
                router.push('/notifications')
              }}
              className="w-full px-4 py-2.5 text-[12px] font-medium text-accent-600 hover:bg-surface-50 transition-colors text-center"
            >
              View all notifications
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

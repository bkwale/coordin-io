'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { Bell } from 'lucide-react'
import { getCriticalUpdates, USERS } from '@/lib/mock-data'
import { cn, updateSeverityDot } from '@/lib/utils'

export function NotificationBell() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const updates = getCriticalUpdates()

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  const timeAgo = (ts: string) => {
    const diff = Date.now() - new Date(ts).getTime()
    const hours = Math.floor(diff / 3600000)
    if (hours < 1) return 'Just now'
    if (hours < 24) return `${hours}h ago`
    const days = Math.floor(hours / 24)
    return `${days}d ago`
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2.5 rounded-xl bg-white border border-surface-200 hover:border-surface-300 transition-colors shadow-card"
      >
        <Bell className="w-4 h-4 text-ink-500" />
        {updates.length > 0 && (
          <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-[8px] text-white font-bold flex items-center justify-center">
            {updates.length}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl border border-surface-200 shadow-lg z-50 overflow-hidden">
          <div className="px-4 py-3 border-b border-surface-100">
            <p className="text-[13px] font-semibold text-ink-800">Notifications</p>
          </div>
          <div className="max-h-80 overflow-y-auto">
            {updates.slice(0, 5).map(update => (
              <Link
                key={update.id}
                href={`/projects/${update.project_id}`}
                onClick={() => setOpen(false)}
                className="flex items-start gap-3 px-4 py-3 hover:bg-surface-50 transition-colors border-b border-surface-50 last:border-b-0"
              >
                <span className={cn('w-2 h-2 rounded-full mt-1.5 shrink-0', updateSeverityDot(update.severity))} />
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-medium text-ink-800 truncate">{update.project_name}</p>
                  <p className="text-[10px] text-ink-500 mt-0.5 line-clamp-2">{update.description}</p>
                  <p className="text-[9px] text-ink-300 mt-1">{timeAgo(update.timestamp)}</p>
                </div>
              </Link>
            ))}
          </div>
          <div className="px-4 py-2.5 border-t border-surface-100">
            <Link
              href="/projects"
              onClick={() => setOpen(false)}
              className="text-[11px] font-medium text-accent-600 hover:text-accent-700 transition-colors"
            >
              View all
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}

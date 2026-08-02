'use client'

import { Bell } from 'lucide-react'

export function NotificationBell() {
  return (
    <button className="relative p-2 rounded-lg hover:bg-surface-100 transition-colors" aria-label="Notifications">
      <Bell className="w-5 h-5 text-ink-400" />
    </button>
  )
}

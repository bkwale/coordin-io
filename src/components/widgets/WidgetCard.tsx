'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'

interface WidgetCardProps {
  title: string
  icon?: React.ReactNode
  actions?: React.ReactNode
  children: React.ReactNode
  className?: string
  collapsible?: boolean
  defaultCollapsed?: boolean
}

export function WidgetCard({ title, icon, actions, children, className, collapsible = true, defaultCollapsed = false }: WidgetCardProps) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed)

  return (
    <div className={cn('card-premium overflow-hidden', className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-4 pb-3">
        <div className="flex items-center gap-2.5">
          {icon && <span className="text-ink-400">{icon}</span>}
          <h3 className="text-[13px] font-semibold text-ink-800">{title}</h3>
        </div>
        <div className="flex items-center gap-2">
          {actions}
          {collapsible && (
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="p-1 rounded-md hover:bg-surface-100 text-ink-300 hover:text-ink-500 transition-colors"
              aria-label={collapsed ? 'Expand' : 'Collapse'}
            >
              <svg className={cn('w-4 h-4 transition-transform', collapsed && '-rotate-90')} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Body */}
      {!collapsed && (
        <div className="px-5 pb-5">
          {children}
        </div>
      )}
    </div>
  )
}

// ── Small sub-components for widgets ────────────────────────

export function WidgetStat({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="text-center">
      <p className={cn('text-[1.5rem] font-semibold tabular-nums', color || 'text-ink-900')}>{value}</p>
      <p className="text-[10px] text-ink-400 mt-0.5">{label}</p>
    </div>
  )
}

export function WidgetRow({ children, href, className }: { children: React.ReactNode; href?: string; className?: string }) {
  const base = cn('flex items-center justify-between py-2.5 px-2 -mx-2 rounded-lg transition-colors', href && 'hover:bg-surface-50 cursor-pointer', className)
  if (href) {
    return <a href={href} className={base}>{children}</a>
  }
  return <div className={base}>{children}</div>
}

export function WidgetDivider() {
  return <div className="border-t border-surface-100 my-3" />
}

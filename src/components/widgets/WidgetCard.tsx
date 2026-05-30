'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { ChevronDown } from 'lucide-react'

interface WidgetCardProps {
  title: string
  icon?: React.ReactNode
  actions?: React.ReactNode
  children: React.ReactNode
  className?: string
  collapsible?: boolean
  defaultCollapsed?: boolean
  isLoading?: boolean
}

export function WidgetCard({ title, icon, actions, children, className, collapsible = true, defaultCollapsed = false, isLoading = false }: WidgetCardProps) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed)

  return (
    <div className={cn('card-static overflow-hidden', className)}>
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
              <ChevronDown className={cn('w-4 h-4 transition-transform', collapsed && '-rotate-90')} />
            </button>
          )}
        </div>
      </div>

      {/* Body */}
      {isLoading ? (
        <div className="px-5 pb-5 space-y-3">
          <div className="h-4 bg-surface-100 rounded animate-pulse w-3/4" />
          <div className="h-4 bg-surface-100 rounded animate-pulse w-1/2" />
          <div className="h-8 bg-surface-100 rounded animate-pulse w-full" />
          <div className="h-4 bg-surface-100 rounded animate-pulse w-2/3" />
        </div>
      ) : !collapsed ? (
        <div className="px-5 pb-5">
          {children}
        </div>
      ) : null}
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

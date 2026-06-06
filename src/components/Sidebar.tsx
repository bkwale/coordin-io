'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard, FolderOpen, Sparkles, BookOpen,
  GraduationCap, Users, ExternalLink, BarChart3, PoundSterling,
  TrendingUp, Receipt, Target, Shield, Clock,
  Link as LinkIcon, Plus, Search, MoreHorizontal,
  ChevronLeft, ChevronRight,
} from 'lucide-react'

/* ── Navigation structure ──────────────────────────────── */

const MAIN_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/projects', label: 'Projects', icon: FolderOpen },
  { href: '/fee-quotes', label: 'Quotes & Invoices', icon: Receipt },
  { href: '/staffing', label: 'Staffing', icon: Users },
  { href: '/timesheets', label: 'Timesheets', icon: Clock },
]

const INSIGHTS_ITEMS = [
  { href: '/analytics/portfolio', label: 'Portfolio', icon: BarChart3 },
  { href: '/analytics/commercial', label: 'Commercial', icon: PoundSterling },
  { href: '/analytics/cashflow', label: 'Cashflow', icon: TrendingUp },
]

const MORE_ITEMS = [
  { href: '/knowledge', label: 'Knowledge', icon: BookOpen },
  { href: '/cpd', label: 'CPD', icon: GraduationCap },
  { href: '/opportunities', label: 'Opportunities', icon: Target },
  { href: '/ai', label: 'AI Teammate', icon: Sparkles },
  { href: '/portal', label: 'Portal', icon: ExternalLink },
]

const SETTINGS_ITEMS = [
  { href: '/settings/admin', label: 'Settings', icon: Shield },
  { href: '/settings/integrations', label: 'Integrations', icon: LinkIcon },
]

type NavItemDef = { href: string; label: string; icon: React.FC<{ className?: string }> }

/* ── NavItem ───────────────────────────────────────────── */

function NavItem({ href, label, icon: Icon, isActive, collapsed, onClick }: {
  href: string; label: string; icon: React.FC<{ className?: string }>; isActive: boolean; collapsed: boolean; onClick?: () => void
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      title={collapsed ? label : undefined}
      className={cn(
        'flex items-center gap-3 rounded-lg text-[13px] font-medium transition-all duration-150 relative group',
        collapsed ? 'justify-center px-0 py-2' : 'px-3 py-2',
        isActive
          ? 'bg-white/[0.08] text-white'
          : 'text-white/40 hover:text-white/70 hover:bg-white/[0.04]'
      )}
    >
      {/* Active indicator bar */}
      {isActive && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-accent-400" />
      )}
      <Icon className={cn('w-[18px] h-[18px] shrink-0', isActive ? 'text-accent-400' : 'text-white/25 group-hover:text-white/40')} />
      {!collapsed && label}

      {/* Tooltip for collapsed mode */}
      {collapsed && (
        <span className="pointer-events-none absolute left-full ml-2 top-1/2 -translate-y-1/2 whitespace-nowrap rounded-md bg-ink-900 px-2.5 py-1 text-[11px] font-medium text-white shadow-elevated opacity-0 group-hover:opacity-100 transition-opacity z-50">
          {label}
        </span>
      )}
    </Link>
  )
}

/* ── NavSection ────────────────────────────────────────── */

function NavSection({ title, items, pathname, collapsed, onClick }: {
  title: string; items: NavItemDef[]; pathname: string; collapsed: boolean; onClick?: () => void
}) {
  return (
    <div className="mt-7">
      {!collapsed && (
        <p className="text-[9px] font-semibold text-white/20 uppercase tracking-[0.18em] px-3 mb-2">{title}</p>
      )}
      {collapsed && <div className="mx-auto mb-2 w-5 border-t border-white/[0.08]" />}
      <div className="space-y-0.5">
        {items.map(item => {
          const isActive = item.href === '/'
            ? pathname === '/'
            : pathname.startsWith(item.href)
          return (
            <NavItem key={item.href} {...item} isActive={isActive} collapsed={collapsed} onClick={onClick} />
          )
        })}
      </div>
    </div>
  )
}

/* ── Sidebar ───────────────────────────────────────────── */

export function Sidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const close = () => setOpen(false)

  return (
    <>
      {/* Mobile hamburger */}
      <button
        onClick={() => setOpen(!open)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2.5 rounded-xl bg-ink-900 shadow-elevated"
        aria-label="Toggle menu"
      >
        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          {open ? (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h16" />
          )}
        </svg>
      </button>

      {/* Overlay */}
      {open && (
        <div className="lg:hidden fixed inset-0 bg-black/30 backdrop-blur-sm z-30" onClick={close} />
      )}

      {/* Sidebar */}
      <aside className={cn(
        'fixed top-0 left-0 h-full sidebar-mesh z-40 transition-all duration-200 flex flex-col shadow-sidebar',
        collapsed ? 'w-16' : 'w-72',
        open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      )}>
        {/* Logo */}
        <div className={cn('pt-7 pb-6', collapsed ? 'px-3' : 'px-6')}>
          <Link href="/" className={cn('flex items-center', collapsed ? 'justify-center' : 'gap-3')} onClick={close}>
            <div className="w-9 h-9 rounded-xl bg-gradient-accent flex items-center justify-center shadow-glow-indigo shrink-0">
              <span className="text-white font-bold text-[14px] tracking-tight">C</span>
            </div>
            {!collapsed && (
              <div>
                <h1 className="text-[16px] font-semibold text-white leading-tight tracking-tight">Coordin.io</h1>
                <p className="text-[9px] text-white/25 font-medium tracking-[0.2em] uppercase mt-0.5">Project Control</p>
              </div>
            )}
          </Link>
        </div>

        {/* Search — hidden when collapsed */}
        {!collapsed && (
          <div className="px-4 mb-4">
            <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-white/[0.06] border border-white/[0.06]">
              <Search className="w-4 h-4 text-white/25 shrink-0" />
              <span className="text-[12px] text-white/20">Search...</span>
              <span className="ml-auto text-[10px] text-white/15 border border-white/10 rounded px-1.5 py-0.5 font-mono">/</span>
            </div>
          </div>
        )}

        {/* Navigation */}
        <nav className={cn('flex-1 overflow-y-auto', collapsed ? 'px-2' : 'px-3')}>
          {/* Main */}
          <div>
            {!collapsed && (
              <p className="text-[9px] font-semibold text-white/20 uppercase tracking-[0.18em] px-3 mb-2">Main</p>
            )}
            <div className="space-y-0.5">
              {MAIN_ITEMS.map(item => {
                const isActive = item.href === '/'
                  ? pathname === '/'
                  : pathname.startsWith(item.href)
                return (
                  <NavItem key={item.href} {...item} isActive={isActive} collapsed={collapsed} onClick={close} />
                )
              })}
            </div>
          </div>

          <NavSection title="Insights" items={INSIGHTS_ITEMS} pathname={pathname} collapsed={collapsed} onClick={close} />
          <NavSection title="More" items={MORE_ITEMS} pathname={pathname} collapsed={collapsed} onClick={close} />
          <NavSection title="Settings" items={SETTINGS_ITEMS} pathname={pathname} collapsed={collapsed} onClick={close} />

          {/* New Project CTA */}
          <div className="mt-7 px-1">
            {collapsed ? (
              <Link
                href="/projects/new"
                onClick={close}
                title="New Project"
                className="flex items-center justify-center w-full py-2.5 rounded-lg bg-gradient-accent text-white hover:opacity-90 transition-opacity shadow-glow-indigo group relative"
              >
                <Plus className="w-4 h-4" />
                <span className="pointer-events-none absolute left-full ml-2 top-1/2 -translate-y-1/2 whitespace-nowrap rounded-md bg-ink-900 px-2.5 py-1 text-[11px] font-medium text-white shadow-elevated opacity-0 group-hover:opacity-100 transition-opacity z-50">
                  New Project
                </span>
              </Link>
            ) : (
              <Link
                href="/projects/new"
                onClick={close}
                className="flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-lg bg-gradient-accent text-white text-[12px] font-semibold tracking-wide hover:opacity-90 transition-opacity shadow-glow-indigo"
              >
                <Plus className="w-4 h-4" />
                New Project
              </Link>
            )}
          </div>
        </nav>

        {/* Divider */}
        <div className={cn('border-t border-white/[0.06]', collapsed ? 'mx-3' : 'mx-5')} />

        {/* User */}
        <div className={cn('py-4', collapsed ? 'px-3' : 'px-5')}>
          <div className={cn('flex items-center', collapsed ? 'justify-center' : 'gap-3')}>
            <div className="relative shrink-0">
              <div className="w-9 h-9 rounded-full bg-gradient-accent flex items-center justify-center text-[12px] font-semibold text-white">SM</div>
              <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-400 border-2 border-[#16162a]" />
            </div>
            {!collapsed && (
              <>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium text-white/80 truncate">Sarah Mitchell</p>
                  <p className="text-[10px] text-white/30">Practice Owner</p>
                </div>
                <button className="text-white/20 hover:text-white/50 transition-colors">
                  <MoreHorizontal className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
        </div>

        {/* Collapse toggle — desktop only */}
        <button
          onClick={onToggle}
          className="hidden lg:flex items-center justify-center py-3 border-t border-white/[0.06] text-white/20 hover:text-white/50 transition-colors"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </aside>
    </>
  )
}

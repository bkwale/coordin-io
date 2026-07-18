'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Building2,
  Users,
  ScrollText,
  Activity,
  ArrowLeft,
  Shield,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const NAV_ITEMS = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/organisations', label: 'Organisations', icon: Building2 },
  { href: '/admin/users', label: 'Users', icon: Users },
  { href: '/admin/audit', label: 'Audit Log', icon: ScrollText },
  { href: '/admin/health', label: 'System Health', icon: Activity },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Admin Sidebar */}
      <aside className="w-64 bg-slate-900 text-white flex flex-col">
        <div className="p-5 border-b border-slate-700">
          <div className="flex items-center gap-2.5 mb-1">
            <div className="w-8 h-8 rounded-lg bg-amber-500 flex items-center justify-center">
              <Shield className="w-4 h-4 text-white" />
            </div>
            <span className="font-semibold text-lg">Admin</span>
          </div>
          <p className="text-xs text-slate-400 mt-1">Coordin.io Platform</p>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const isActive = pathname === href ||
              (href !== '/admin' && pathname.startsWith(href))
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-slate-700 text-white'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800',
                )}
              >
                <Icon className="w-4 h-4" />
                {label}
              </Link>
            )
          })}
        </nav>

        <div className="p-3 border-t border-slate-700">
          <Link
            href="/"
            className="flex items-center gap-2 px-3 py-2 text-sm text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to App
          </Link>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-8 max-w-6xl">
        {children}
      </main>
    </div>
  )
}

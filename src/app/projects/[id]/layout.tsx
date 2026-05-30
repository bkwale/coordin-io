'use client'

import { usePathname, useParams } from 'next/navigation'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { PROJECTS } from '@/lib/mock-data'
import {
  LayoutDashboard, ListChecks, FileText, PoundSterling,
  ShieldCheck, MapPin
} from 'lucide-react'

const PROJECT_TABS = [
  {
    label: 'Overview',
    href: '', // base /projects/[id]
    icon: LayoutDashboard,
    subRoutes: ['', '/health', '/brief']
  },
  {
    label: 'Tasks & Actions',
    href: '/registers',
    icon: ListChecks,
    subRoutes: ['/registers', '/meetings']
  },
  {
    label: 'Documents',
    href: '/documents',
    icon: FileText,
    subRoutes: ['/documents', '/drawing-issues']
  },
  {
    label: 'Commercial',
    href: '/contract-admin',
    icon: PoundSterling,
    subRoutes: ['/contract-admin', '/tender']
  },
  {
    label: 'Compliance',
    href: '/brpd',
    icon: ShieldCheck,
    subRoutes: ['/brpd', '/brpd/changelog', '/building-regs', '/design-risks']
  },
  {
    label: 'Planning',
    href: '/planning',
    icon: MapPin,
    subRoutes: ['/planning', '/site-queries']
  },
]

export default function ProjectLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const params = useParams()
  const projectId = params.id as string
  const project = PROJECTS.find(p => p.id === projectId)
  const basePath = `/projects/${projectId}`

  // Determine which tab is active
  const currentSubRoute = pathname.replace(basePath, '') || ''

  return (
    <div>
      {/* Project header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 text-[11px] text-ink-400 mb-2">
          <Link href="/projects" className="hover:text-accent-500 transition-colors">Projects</Link>
          <span>/</span>
          <span className="text-ink-600">{project?.name || 'Project'}</span>
        </div>
      </div>

      {/* Tab navigation */}
      <div className="mb-6 border-b border-surface-200">
        <nav className="flex gap-0 overflow-x-auto -mb-px">
          {PROJECT_TABS.map(tab => {
            const isActive = tab.subRoutes.some(sr => currentSubRoute === sr)
            const tabHref = `${basePath}${tab.href}`

            return (
              <Link
                key={tab.label}
                href={tabHref}
                className={cn(
                  'flex items-center gap-2 px-4 py-3 text-[12px] font-medium border-b-2 whitespace-nowrap transition-colors min-h-[44px]',
                  isActive
                    ? 'border-accent-500 text-accent-600'
                    : 'border-transparent text-ink-400 hover:text-ink-600 hover:border-surface-300'
                )}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </Link>
            )
          })}
        </nav>
      </div>

      {/* Page content */}
      {children}
    </div>
  )
}

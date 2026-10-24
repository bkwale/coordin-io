'use client'

import { usePathname, useParams } from 'next/navigation'
import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard, ListChecks, FileText, PoundSterling,
  ShieldCheck, HardHat, GitBranch,
} from 'lucide-react'

/* ── Tab definitions ─────────────────────────────────────── */

interface SubTab {
  label: string
  href: string // relative to basePath
}

interface TabDef {
  label: string
  href: string
  icon: typeof LayoutDashboard
  /** All routes that belong to this tab (for active-highlight) */
  routes: string[]
  /** Subtab pills shown below the main tab bar */
  subTabs?: SubTab[]
  /** Only show this tab when project uses one of these frameworks */
  frameworks?: string[]
}

const PROJECT_TABS: TabDef[] = [
  {
    label: 'Overview',
    href: '',
    icon: LayoutDashboard,
    routes: ['', '/health', '/brief', '/resources'],
    subTabs: [
      { label: 'Dashboard', href: '' },
      { label: 'Health', href: '/health' },
      { label: 'Brief', href: '/brief' },
      { label: 'Resources', href: '/resources' },
    ],
  },
  {
    label: 'Tasks',
    href: '/tasks',
    icon: ListChecks,
    routes: ['/tasks', '/registers', '/meetings'],
    subTabs: [
      { label: 'Tasks', href: '/tasks' },
      { label: 'Registers', href: '/registers' },
      { label: 'Meetings', href: '/meetings' },
    ],
  },
  {
    label: 'Documents',
    href: '/documents',
    icon: FileText,
    routes: ['/documents', '/drawing-issues'],
    subTabs: [
      { label: 'Documents', href: '/documents' },
      { label: 'Drawing Issues', href: '/drawing-issues' },
    ],
  },
  {
    label: 'Commercial',
    href: '/contract-admin',
    icon: PoundSterling,
    routes: ['/contract-admin', '/tender', '/metrics'],
    subTabs: [
      { label: 'Contract Admin', href: '/contract-admin' },
      { label: 'Tender', href: '/tender' },
      { label: 'Metrics', href: '/metrics' },
    ],
  },
  {
    label: 'Compliance',
    href: '/brpd',
    icon: ShieldCheck,
    routes: ['/brpd', '/brpd/changelog', '/building-regs', '/design-risks'],
    subTabs: [
      { label: 'BRPD', href: '/brpd' },
      { label: 'Building Regs', href: '/building-regs' },
      { label: 'Design Risks', href: '/design-risks' },
    ],
  },
  {
    label: 'Site',
    href: '/observations',
    icon: HardHat,
    routes: ['/observations', '/snags', '/planning', '/site-queries', '/soa'],
    subTabs: [
      { label: 'Observations', href: '/observations' },
      { label: 'Snags', href: '/snags' },
      { label: 'Planning', href: '/planning' },
      { label: 'Site Queries', href: '/site-queries' },
      { label: 'SOA', href: '/soa' },
    ],
  },
  {
    label: 'Stages',
    href: '/stages',
    icon: GitBranch,
    routes: ['/stages'],
    frameworks: ['RIBA'],
  },
]

/* ── Layout component ────────────────────────────────────── */

export default function ProjectLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const params = useParams()
  const projectId = params.id as string
  const basePath = `/projects/${projectId}`

  const [projectName, setProjectName] = useState<string | null>(null)
  const [workStageFramework, setWorkStageFramework] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/projects/${projectId}`)
      .then(res => res.json())
      .then(data => {
        if (data?.data?.project?.name) setProjectName(data.data.project.name)
        if (data?.data?.project?.workStageFramework) setWorkStageFramework(data.data.project.workStageFramework)
      })
      .catch(() => {})
  }, [projectId])

  // Filter tabs based on project framework
  const visibleTabs = useMemo(() =>
    PROJECT_TABS.filter(tab =>
      !tab.frameworks || (workStageFramework && tab.frameworks.includes(workStageFramework))
    ),
    [workStageFramework]
  )

  // Determine active tab and sub-route
  const currentSubRoute = pathname.replace(basePath, '') || ''

  const activeTab = useMemo(() =>
    visibleTabs.find(tab => tab.routes.some(r => currentSubRoute === r || currentSubRoute.startsWith(r + '/')))
      ?? visibleTabs[0],
    [visibleTabs, currentSubRoute]
  )

  // Only show subtab pills when the tab has more than 1 subtab
  const showSubTabs = activeTab?.subTabs && activeTab.subTabs.length > 1

  return (
    <div>
      {/* Project header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 text-[11px] text-ink-400 mb-2">
          <Link href="/projects" className="hover:text-accent-500 transition-colors">Projects</Link>
          <span>/</span>
          <span className="text-ink-600 truncate max-w-[200px]">{projectName || 'Loading…'}</span>
        </div>
      </div>

      {/* Primary tab navigation */}
      <div className="border-b border-surface-200">
        <nav className="flex gap-0 overflow-x-auto scrollbar-hide -mb-px" style={{ WebkitOverflowScrolling: 'touch' }}>
          {visibleTabs.map(tab => {
            const isActive = tab === activeTab
            const tabHref = `${basePath}${tab.href}`

            return (
              <Link
                key={tab.label}
                href={tabHref}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-3 text-[11px] sm:text-[12px] sm:px-4 sm:gap-2 font-medium border-b-2 whitespace-nowrap transition-colors min-h-[44px] shrink-0',
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

      {/* Subtab pills */}
      {showSubTabs && (
        <div className="flex gap-1 px-1 py-2 overflow-x-auto scrollbar-hide">
          {activeTab.subTabs!.map(st => {
            const isActiveSub = currentSubRoute === st.href || currentSubRoute.startsWith(st.href + '/')
            return (
              <Link
                key={st.href}
                href={`${basePath}${st.href}`}
                className={cn(
                  'px-3 py-1.5 rounded-full text-[11px] font-medium whitespace-nowrap transition-colors',
                  isActiveSub
                    ? 'bg-accent-50 text-accent-700 ring-1 ring-accent-200'
                    : 'text-ink-400 hover:text-ink-600 hover:bg-surface-50'
                )}
              >
                {st.label}
              </Link>
            )
          })}
        </div>
      )}

      {/* Spacer when no subtabs */}
      {!showSubTabs && <div className="mb-6" />}

      {/* Page content */}
      <div className={showSubTabs ? 'mt-2' : ''}>
        {children}
      </div>
    </div>
  )
}

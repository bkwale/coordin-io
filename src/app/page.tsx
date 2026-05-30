'use client'

import { useState } from 'react'
import Link from 'next/link'
import { PROJECTS, ALL_TASKS, APPROVALS, getDashboardKPIs, getOpenInvoiceValue, getMissingTimesheetUsers, USERS } from '@/lib/mock-data'
import { isOverdue, cn } from '@/lib/utils'
import { KPICard } from '@/components/KPICard'
import { NotificationBell } from '@/components/NotificationBell'
import { FolderOpen, AlertTriangle, Clock, PoundSterling, FileText, ShieldCheck, CheckCircle, Settings, Plus } from 'lucide-react'
import {
  PracticeSummaryWidget,
  StaffResourcingWidget,
  FinancialHealthWidget,
  QuoteInvoiceWidget,
  JobsAtRiskWidget,
  CalendarDeadlinesWidget,
  ProjectUpdatesWidget,
  BRPDWidget,
  NewsWidget,
  RecentActivityWidget,
} from '@/components/widgets'

type FilterView = 'all' | 'today' | 'week' | 'practice' | 'commercial' | 'staff' | 'brpd' | 'portfolio'

const FILTERS: { value: FilterView; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This Week' },
  { value: 'practice', label: 'Practice' },
  { value: 'commercial', label: 'Commercial' },
  { value: 'staff', label: 'Staff' },
  { value: 'brpd', label: 'BRPD' },
  { value: 'portfolio', label: 'Portfolio' },
]

export default function ExecutiveDashboard() {
  const [activeFilter, setActiveFilter] = useState<FilterView>('all')
  const kpis = getDashboardKPIs()

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const missingTs = getMissingTimesheetUsers()
  const openInvoice = getOpenInvoiceValue()

  // Determine which widgets to show based on filter
  const showWidget = (category: 'practice' | 'staff' | 'commercial' | 'brpd' | 'project' | 'calendar' | 'news' | 'activity') => {
    if (activeFilter === 'all' || activeFilter === 'today' || activeFilter === 'week') return true
    if (activeFilter === 'practice') return ['practice', 'project', 'calendar', 'activity'].includes(category)
    if (activeFilter === 'commercial') return ['commercial', 'practice'].includes(category)
    if (activeFilter === 'staff') return ['staff', 'calendar'].includes(category)
    if (activeFilter === 'brpd') return ['brpd', 'project'].includes(category)
    if (activeFilter === 'portfolio') return ['practice', 'project', 'commercial'].includes(category)
    return true
  }

  return (
    <div className="max-w-[1400px] animate-fade-in">

      {/* ━━━ HEADER ROW ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section className="pb-6">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <p className="text-[13px] text-ink-400 mb-1">{greeting}, Sarah</p>
            <h1 className="font-display text-[2rem] sm:text-[2.5rem] leading-[1.1] text-ink-900 tracking-tight">
              Executive Dashboard
            </h1>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-auto">
            {/* Notifications */}
            <NotificationBell />

            {/* Settings */}
            <Link href="/settings/admin" className="p-2.5 rounded-xl bg-white border border-surface-200 hover:border-surface-300 transition-colors shadow-card">
              <Settings className="w-4 h-4 text-ink-500" />
            </Link>

            {/* Quick action */}
            <Link
              href="/projects/new"
              className="inline-flex items-center gap-2 px-4 py-2.5 text-[12px] font-semibold text-white bg-gradient-accent rounded-xl hover:opacity-90 transition-all shadow-md hover:shadow-lg"
            >
              <Plus className="w-4 h-4" />
              New Project
            </Link>
          </div>
        </div>
      </section>

      {/* ━━━ FILTER BAR ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section className="pb-6">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {FILTERS.map(f => (
            <button
              key={f.value}
              onClick={() => setActiveFilter(f.value)}
              className={cn(
                'px-3.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all whitespace-nowrap',
                activeFilter === f.value
                  ? 'bg-ink-900 text-white shadow-sm'
                  : 'bg-white text-ink-500 border border-surface-200 hover:border-surface-300 hover:text-ink-700'
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </section>

      {/* ━━━ KPI ROW ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section className="pb-8">
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          <KPICard label="Active Projects" value={kpis.active_projects} accent="blue" icon={<FolderOpen className="w-4 h-4" />} />
          <KPICard label="At Risk" value={kpis.projects_at_risk} accent={kpis.projects_at_risk > 0 ? 'red' : 'green'} icon={<AlertTriangle className="w-4 h-4" />} />
          <KPICard label="Missing Timesheets" value={missingTs.length} accent={missingTs.length > 0 ? 'amber' : 'green'} icon={<Clock className="w-4 h-4" />} />
          <KPICard label="Open Invoices" value={`£${(openInvoice / 1000).toFixed(0)}k`} accent="blue" icon={<PoundSterling className="w-4 h-4" />} />
          <KPICard label="Quotes Expiring" value={kpis.quotes_expiring} accent={kpis.quotes_expiring > 0 ? 'amber' : 'green'} icon={<FileText className="w-4 h-4" />} />
          <KPICard label="BRPD Deadlines" value={kpis.brpd_deadlines} accent={kpis.brpd_deadlines > 0 ? 'amber' : 'green'} icon={<ShieldCheck className="w-4 h-4" />} />
          <KPICard label="Approvals" value={kpis.approvals_waiting} accent={kpis.approvals_waiting > 0 ? 'blue' : 'green'} icon={<CheckCircle className="w-4 h-4" />} />
        </div>
      </section>

      {/* ━━━ WIDGET GRID — ROW 3 ━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section className="pb-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-5">
          <div className={cn(!showWidget('practice') && 'opacity-40 pointer-events-none')}>
            <PracticeSummaryWidget />
          </div>
          <div className={cn(!showWidget('staff') && 'opacity-40 pointer-events-none')}>
            <StaffResourcingWidget />
          </div>
          <div className={cn(!showWidget('commercial') && 'opacity-40 pointer-events-none')}>
            <FinancialHealthWidget />
          </div>
          <div className={cn(!showWidget('calendar') && 'opacity-40 pointer-events-none')}>
            <CalendarDeadlinesWidget />
          </div>
        </div>
      </section>

      {/* ━━━ WIDGET GRID — ROW 4 ━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section className="pb-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-5">
          <div className={cn(!showWidget('project') && 'opacity-40 pointer-events-none')}>
            <JobsAtRiskWidget />
          </div>
          <div className={cn(!showWidget('commercial') && 'opacity-40 pointer-events-none')}>
            <QuoteInvoiceWidget />
          </div>
          <div className={cn(!showWidget('project') && 'opacity-40 pointer-events-none')}>
            <ProjectUpdatesWidget />
          </div>
          <div className={cn(!showWidget('brpd') && 'opacity-40 pointer-events-none')}>
            <BRPDWidget />
          </div>
        </div>
      </section>

      {/* ━━━ WIDGET GRID — ROW 5 ━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section className="pb-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-5">
          <div className={cn(!showWidget('news') && 'opacity-40 pointer-events-none')}>
            <NewsWidget />
          </div>
          <div className={cn(!showWidget('activity') && 'opacity-40 pointer-events-none')}>
            <RecentActivityWidget />
          </div>
        </div>
      </section>

    </div>
  )
}

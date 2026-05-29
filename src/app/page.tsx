'use client'

import { useState } from 'react'
import Link from 'next/link'
import { PROJECTS, ALL_TASKS, APPROVALS, getDashboardKPIs, getOpenInvoiceValue, getMissingTimesheetUsers, USERS } from '@/lib/mock-data'
import { isOverdue, cn } from '@/lib/utils'
import { KPICard } from '@/components/KPICard'
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
            <button className="relative p-2.5 rounded-xl bg-white border border-surface-200 hover:border-surface-300 transition-colors shadow-card">
              <svg className="w-4 h-4 text-ink-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
              </svg>
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-[8px] text-white font-bold flex items-center justify-center">3</span>
            </button>

            {/* Settings */}
            <Link href="/settings/admin" className="p-2.5 rounded-xl bg-white border border-surface-200 hover:border-surface-300 transition-colors shadow-card">
              <svg className="w-4 h-4 text-ink-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </Link>

            {/* Quick action */}
            <Link
              href="/projects/new"
              className="inline-flex items-center gap-2 px-4 py-2.5 text-[12px] font-semibold text-white bg-gradient-accent rounded-xl hover:opacity-90 transition-all shadow-md hover:shadow-lg"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" d="M12 5v14M5 12h14" />
              </svg>
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
          <KPICard label="Active Projects" value={kpis.active_projects} accent="blue" icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>} />
          <KPICard label="At Risk" value={kpis.projects_at_risk} accent={kpis.projects_at_risk > 0 ? 'red' : 'green'} icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" /></svg>} />
          <KPICard label="Missing Timesheets" value={missingTs.length} accent={missingTs.length > 0 ? 'amber' : 'green'} icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>} />
          <KPICard label="Open Invoices" value={`£${(openInvoice / 1000).toFixed(0)}k`} accent="blue" icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" /></svg>} />
          <KPICard label="Quotes Expiring" value={kpis.quotes_expiring} accent={kpis.quotes_expiring > 0 ? 'amber' : 'green'} icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>} />
          <KPICard label="BRPD Deadlines" value={kpis.brpd_deadlines} accent={kpis.brpd_deadlines > 0 ? 'amber' : 'green'} icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" /></svg>} />
          <KPICard label="Approvals" value={kpis.approvals_waiting} accent={kpis.approvals_waiting > 0 ? 'blue' : 'green'} icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>} />
        </div>
      </section>

      {/* ━━━ WIDGET GRID — ROW 3 ━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section className="pb-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-5">
          {showWidget('practice') && <PracticeSummaryWidget />}
          {showWidget('staff') && <StaffResourcingWidget />}
          {showWidget('commercial') && <FinancialHealthWidget />}
          {showWidget('calendar') && <CalendarDeadlinesWidget />}
        </div>
      </section>

      {/* ━━━ WIDGET GRID — ROW 4 ━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section className="pb-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-5">
          {showWidget('project') && <JobsAtRiskWidget />}
          {showWidget('commercial') && <QuoteInvoiceWidget />}
          {showWidget('project') && <ProjectUpdatesWidget />}
          {showWidget('brpd') && <BRPDWidget />}
        </div>
      </section>

      {/* ━━━ WIDGET GRID — ROW 5 ━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section className="pb-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-5">
          {showWidget('news') && <NewsWidget />}
          {showWidget('activity') && <RecentActivityWidget />}
        </div>
      </section>

    </div>
  )
}

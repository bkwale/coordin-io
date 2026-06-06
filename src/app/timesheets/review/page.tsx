'use client'

import { useState, useMemo } from 'react'
import { Breadcrumb } from '@/components/Breadcrumb'
import { cn, timesheetStatusColor, timesheetStatusLabel, timesheetCategoryLabel, timesheetCategoryColor, formatCurrency } from '@/lib/utils'
import { getTimesheetEntries, getTimesheetWeekSummaries, PROJECTS, USERS } from '@/lib/mock-data'
import { TimesheetEntry, TimesheetCategory } from '@/lib/types'
import {
  Clock,
  Users as UsersIcon,
  FolderOpen,
  Layers,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  TrendingDown,
} from 'lucide-react'

type Tab = 'project' | 'person' | 'stage'

interface ProjectSummary {
  projectId: string
  projectName: string
  client: string
  totalHours: number
  billableHours: number
  nonBillableHours: number
  entries: number
  nonBillablePercent: number
  quoteFee?: number
  impliedRate?: number
}

interface PersonSummary {
  userId: string
  name: string
  role: string
  weeklyHours: number
  billableHours: number
  missingDays: number
  submitted: boolean
  status: 'approved' | 'submitted' | 'draft' | 'rejected'
}

interface StageSummary {
  category: TimesheetCategory
  label: string
  totalHours: number
  billableHours: number
  nonBillableHours: number
  entries: number
}

// Mock quote data for comparison
const QUOTE_ASSUMPTIONS: Record<string, { fee: number; estimatedHours: number }> = {
  p1: { fee: 85000, estimatedHours: 680 },
  p2: { fee: 45000, estimatedHours: 360 },
  p3: { fee: 62000, estimatedHours: 500 },
  p4: { fee: 28000, estimatedHours: 220 },
  p5: { fee: 18000, estimatedHours: 150 },
}

export default function TimesheetReviewPage() {
  const [activeTab, setActiveTab] = useState<Tab>('project')

  const allEntries = useMemo(() => getTimesheetEntries(), [])
  const weekSummaries = useMemo(() => getTimesheetWeekSummaries('2026-05-18'), [])

  // By Project
  const projectSummaries = useMemo((): ProjectSummary[] => {
    const grouped: Record<string, TimesheetEntry[]> = {}
    allEntries.forEach(e => {
      if (!grouped[e.project_id]) grouped[e.project_id] = []
      grouped[e.project_id].push(e)
    })

    return Object.entries(grouped).map(([projectId, entries]) => {
      const project = PROJECTS.find(p => p.id === projectId)
      const totalHours = entries.reduce((s, e) => s + e.hours, 0)
      const billableHours = entries.filter(e => e.billable).reduce((s, e) => s + e.hours, 0)
      const nonBillableHours = totalHours - billableHours
      const quote = QUOTE_ASSUMPTIONS[projectId]

      return {
        projectId,
        projectName: project?.name || 'Unknown',
        client: project?.client || 'N/A',
        totalHours,
        billableHours,
        nonBillableHours,
        entries: entries.length,
        nonBillablePercent: totalHours > 0 ? Math.round((nonBillableHours / totalHours) * 100) : 0,
        quoteFee: quote?.fee,
        impliedRate: quote && billableHours > 0 ? Math.round(quote.fee / quote.estimatedHours) : undefined,
      }
    }).sort((a, b) => b.totalHours - a.totalHours)
  }, [allEntries])

  // By Person
  const personSummaries = useMemo((): PersonSummary[] => {
    return USERS.map(user => {
      const userEntries = allEntries.filter(e => e.user_id === user.id)
      const totalHours = userEntries.reduce((s, e) => s + e.hours, 0)
      const billableHours = userEntries.filter(e => e.billable).reduce((s, e) => s + e.hours, 0)
      const weekSummary = weekSummaries.find(ws => ws.user_id === user.id)

      let status: 'approved' | 'submitted' | 'draft' | 'rejected' = 'draft'
      if (userEntries.every(e => e.status === 'approved') && userEntries.length > 0) status = 'approved'
      else if (userEntries.some(e => e.status === 'submitted')) status = 'submitted'

      return {
        userId: user.id,
        name: user.name,
        role: user.role === 'practice_owner' ? 'Practice Owner' : user.role === 'project_lead' ? 'Project Lead' : 'Team Member',
        weeklyHours: totalHours,
        billableHours,
        missingDays: weekSummary?.missing_days || 5,
        submitted: weekSummary?.submitted || false,
        status,
      }
    }).sort((a, b) => b.weeklyHours - a.weeklyHours)
  }, [allEntries, weekSummaries])

  // By Stage
  const stageSummaries = useMemo((): StageSummary[] => {
    const grouped: Record<string, TimesheetEntry[]> = {}
    allEntries.forEach(e => {
      if (!grouped[e.task_category]) grouped[e.task_category] = []
      grouped[e.task_category].push(e)
    })

    return Object.entries(grouped).map(([category, entries]) => {
      const totalHours = entries.reduce((s, e) => s + e.hours, 0)
      const billableHours = entries.filter(e => e.billable).reduce((s, e) => s + e.hours, 0)
      return {
        category: category as TimesheetCategory,
        label: timesheetCategoryLabel(category as TimesheetCategory),
        totalHours,
        billableHours,
        nonBillableHours: totalHours - billableHours,
        entries: entries.length,
      }
    }).sort((a, b) => b.totalHours - a.totalHours)
  }, [allEntries])

  // Totals
  const totalHours = allEntries.reduce((s, e) => s + e.hours, 0)
  const totalBillable = allEntries.filter(e => e.billable).reduce((s, e) => s + e.hours, 0)
  const totalNonBillable = totalHours - totalBillable
  const nonBillablePercent = totalHours > 0 ? Math.round((totalNonBillable / totalHours) * 100) : 0
  const highNonBillable = nonBillablePercent > 30

  const tabs: { id: Tab; label: string; icon: React.FC<{ className?: string }> }[] = [
    { id: 'project', label: 'By Project', icon: FolderOpen },
    { id: 'person', label: 'By Person', icon: UsersIcon },
    { id: 'stage', label: 'By Stage', icon: Layers },
  ]

  return (
    <div className="max-w-6xl animate-fade-in">
      {/* Header */}
      <section className="pb-8">
        <Breadcrumb items={[{ label: 'Dashboard', href: '/' }, { label: 'Timesheets', href: '/timesheets' }, { label: 'Review' }]} />
        <div className="mt-6">
          <h1 className="font-display text-[2rem] text-ink-900 tracking-tight mb-2">
            Timesheet Review
          </h1>
          <p className="text-[13px] text-ink-400 mt-1">
            {totalHours}h total &middot; {totalBillable}h billable &middot; {USERS.length} team members
          </p>
        </div>
      </section>

      {/* Summary Cards */}
      <section className="pb-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="card-static p-4">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-4 h-4 text-ink-300" />
              <span className="text-[10px] text-ink-400 uppercase tracking-wide font-semibold">Total Hours</span>
            </div>
            <p className="text-[20px] font-bold font-mono tabular-nums text-ink-900">{totalHours}h</p>
          </div>
          <div className="card-static p-4">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              <span className="text-[10px] text-ink-400 uppercase tracking-wide font-semibold">Billable</span>
            </div>
            <p className="text-[20px] font-bold font-mono tabular-nums text-emerald-600">{totalBillable}h</p>
          </div>
          <div className={cn('card-static p-4', highNonBillable && 'border-amber-200 bg-amber-50/40')}>
            <div className="flex items-center gap-2 mb-2">
              {highNonBillable ? (
                <AlertTriangle className="w-4 h-4 text-amber-500" />
              ) : (
                <TrendingDown className="w-4 h-4 text-ink-300" />
              )}
              <span className="text-[10px] text-ink-400 uppercase tracking-wide font-semibold">Non-billable</span>
            </div>
            <p className={cn('text-[20px] font-bold font-mono tabular-nums', highNonBillable ? 'text-amber-600' : 'text-ink-600')}>
              {nonBillablePercent}%
            </p>
          </div>
          <div className="card-static p-4">
            <div className="flex items-center gap-2 mb-2">
              <UsersIcon className="w-4 h-4 text-ink-300" />
              <span className="text-[10px] text-ink-400 uppercase tracking-wide font-semibold">Missing</span>
            </div>
            <p className="text-[20px] font-bold font-mono tabular-nums text-red-600">
              {personSummaries.filter(p => p.missingDays >= 5).length}
            </p>
            <p className="text-[10px] text-ink-300 mt-0.5">no entries this week</p>
          </div>
        </div>
      </section>

      {/* Non-billable warning */}
      {highNonBillable && (
        <section className="pb-6">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-[13px] font-semibold text-amber-800">High non-billable time detected</p>
              <p className="text-[12px] text-amber-700 mt-1">
                Non-billable time is at {nonBillablePercent}% of total hours (threshold: 30%). Review admin tasks and internal meetings for reallocation opportunities.
              </p>
            </div>
          </div>
        </section>
      )}

      {/* Tab Bar */}
      <section className="pb-6">
        <div className="flex items-center gap-1 p-1 rounded-xl bg-surface-100 w-fit">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex items-center gap-2 px-4 py-2.5 rounded-lg text-[12px] font-semibold transition-all min-h-[44px]',
                activeTab === tab.id
                  ? 'bg-white text-ink-900 shadow-sm'
                  : 'text-ink-400 hover:text-ink-600'
              )}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>
      </section>

      {/* Tab Content */}
      <section className="pb-10">
        {activeTab === 'project' && (
          <div className="card-static overflow-hidden">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-surface-200">
                  <th className="px-5 py-3 text-left text-[10px] text-ink-400 uppercase tracking-[0.1em] font-semibold">Project</th>
                  <th className="px-4 py-3 text-center text-[10px] text-ink-400 uppercase tracking-[0.1em] font-semibold">Entries</th>
                  <th className="px-4 py-3 text-center text-[10px] text-ink-400 uppercase tracking-[0.1em] font-semibold">Total</th>
                  <th className="px-4 py-3 text-center text-[10px] text-ink-400 uppercase tracking-[0.1em] font-semibold">Billable</th>
                  <th className="px-4 py-3 text-center text-[10px] text-ink-400 uppercase tracking-[0.1em] font-semibold">Non-bill</th>
                  <th className="px-4 py-3 text-center text-[10px] text-ink-400 uppercase tracking-[0.1em] font-semibold">Non-bill %</th>
                  <th className="px-4 py-3 text-center text-[10px] text-ink-400 uppercase tracking-[0.1em] font-semibold">Quote Fee</th>
                  <th className="px-5 py-3 text-center text-[10px] text-ink-400 uppercase tracking-[0.1em] font-semibold">Implied Rate</th>
                </tr>
              </thead>
              <tbody>
                {projectSummaries.map(ps => (
                  <tr key={ps.projectId} className="border-b border-surface-100 stripe-row">
                    <td className="px-5 py-3.5">
                      <p className="font-medium text-ink-900">{ps.projectName}</p>
                      <p className="text-[11px] text-ink-400 mt-0.5">{ps.client}</p>
                    </td>
                    <td className="px-4 py-3.5 text-center font-mono tabular-nums">{ps.entries}</td>
                    <td className="px-4 py-3.5 text-center font-semibold font-mono tabular-nums text-ink-900">{ps.totalHours}h</td>
                    <td className="px-4 py-3.5 text-center font-mono tabular-nums text-emerald-600">{ps.billableHours}h</td>
                    <td className="px-4 py-3.5 text-center font-mono tabular-nums text-ink-500">{ps.nonBillableHours}h</td>
                    <td className="px-4 py-3.5 text-center">
                      <span className={cn(
                        'font-mono tabular-nums font-semibold',
                        ps.nonBillablePercent > 30 ? 'text-amber-600' : 'text-ink-600'
                      )}>
                        {ps.nonBillablePercent}%
                      </span>
                      {ps.nonBillablePercent > 30 && (
                        <AlertTriangle className="w-3 h-3 text-amber-500 inline-block ml-1" />
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-center font-mono tabular-nums text-ink-600">
                      {ps.quoteFee ? formatCurrency(ps.quoteFee) : '—'}
                    </td>
                    <td className="px-5 py-3.5 text-center font-mono tabular-nums text-ink-600">
                      {ps.impliedRate ? `${formatCurrency(ps.impliedRate)}/h` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-surface-300">
                  <td className="px-5 py-4 font-semibold text-ink-900">Totals</td>
                  <td className="px-4 py-4 text-center font-mono tabular-nums">{allEntries.length}</td>
                  <td className="px-4 py-4 text-center font-bold font-mono tabular-nums text-ink-900">{totalHours}h</td>
                  <td className="px-4 py-4 text-center font-semibold font-mono tabular-nums text-emerald-600">{totalBillable}h</td>
                  <td className="px-4 py-4 text-center font-mono tabular-nums text-ink-500">{totalNonBillable}h</td>
                  <td className="px-4 py-4 text-center font-semibold font-mono tabular-nums">{nonBillablePercent}%</td>
                  <td className="px-4 py-4" />
                  <td className="px-5 py-4" />
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {activeTab === 'person' && (
          <div className="card-static overflow-hidden">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-surface-200">
                  <th className="px-5 py-3 text-left text-[10px] text-ink-400 uppercase tracking-[0.1em] font-semibold">Person</th>
                  <th className="px-4 py-3 text-left text-[10px] text-ink-400 uppercase tracking-[0.1em] font-semibold">Role</th>
                  <th className="px-4 py-3 text-center text-[10px] text-ink-400 uppercase tracking-[0.1em] font-semibold">Hours</th>
                  <th className="px-4 py-3 text-center text-[10px] text-ink-400 uppercase tracking-[0.1em] font-semibold">Billable</th>
                  <th className="px-4 py-3 text-center text-[10px] text-ink-400 uppercase tracking-[0.1em] font-semibold">Missing Days</th>
                  <th className="px-5 py-3 text-center text-[10px] text-ink-400 uppercase tracking-[0.1em] font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {personSummaries.map(ps => (
                  <tr key={ps.userId} className={cn('border-b border-surface-100 stripe-row', ps.missingDays >= 5 && 'bg-red-50/30')}>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <span className="w-7 h-7 rounded-full bg-accent-100 flex items-center justify-center text-[10px] font-bold text-accent-600">
                          {ps.name.split(' ').map(n => n[0]).join('')}
                        </span>
                        <span className="font-medium text-ink-900">{ps.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-ink-500">{ps.role}</td>
                    <td className="px-4 py-3.5 text-center font-semibold font-mono tabular-nums text-ink-900">
                      {ps.weeklyHours}h
                    </td>
                    <td className="px-4 py-3.5 text-center font-mono tabular-nums text-emerald-600">
                      {ps.billableHours}h
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      {ps.missingDays > 0 ? (
                        <span className="inline-flex items-center gap-1">
                          <span className={cn(
                            'font-mono tabular-nums font-semibold',
                            ps.missingDays >= 5 ? 'text-red-600' : 'text-amber-600'
                          )}>
                            {ps.missingDays}
                          </span>
                          {ps.missingDays >= 3 && <AlertTriangle className="w-3 h-3 text-amber-500" />}
                        </span>
                      ) : (
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 mx-auto" />
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      <span className={cn('status-pill', timesheetStatusColor(ps.status))}>
                        {timesheetStatusLabel(ps.status)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'stage' && (
          <div className="card-static overflow-hidden">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-surface-200">
                  <th className="px-5 py-3 text-left text-[10px] text-ink-400 uppercase tracking-[0.1em] font-semibold">Category</th>
                  <th className="px-4 py-3 text-center text-[10px] text-ink-400 uppercase tracking-[0.1em] font-semibold">Entries</th>
                  <th className="px-4 py-3 text-center text-[10px] text-ink-400 uppercase tracking-[0.1em] font-semibold">Total Hours</th>
                  <th className="px-4 py-3 text-center text-[10px] text-ink-400 uppercase tracking-[0.1em] font-semibold">Billable</th>
                  <th className="px-4 py-3 text-center text-[10px] text-ink-400 uppercase tracking-[0.1em] font-semibold">Non-billable</th>
                  <th className="px-5 py-3 text-center text-[10px] text-ink-400 uppercase tracking-[0.1em] font-semibold">Share</th>
                </tr>
              </thead>
              <tbody>
                {stageSummaries.map(ss => (
                  <tr key={ss.category} className="border-b border-surface-100 stripe-row">
                    <td className="px-5 py-3.5">
                      <span className={cn('status-pill', timesheetCategoryColor(ss.category))}>
                        {ss.label}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-center font-mono tabular-nums">{ss.entries}</td>
                    <td className="px-4 py-3.5 text-center font-semibold font-mono tabular-nums text-ink-900">{ss.totalHours}h</td>
                    <td className="px-4 py-3.5 text-center font-mono tabular-nums text-emerald-600">{ss.billableHours}h</td>
                    <td className="px-4 py-3.5 text-center font-mono tabular-nums text-ink-500">{ss.nonBillableHours}h</td>
                    <td className="px-5 py-3.5 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-16 h-2 bg-surface-200 rounded-full overflow-hidden">
                          <div
                            className={cn('h-full rounded-full', timesheetCategoryColor(ss.category).split(' ')[0])}
                            style={{ width: `${totalHours > 0 ? Math.round((ss.totalHours / totalHours) * 100) : 0}%` }}
                          />
                        </div>
                        <span className="text-[11px] font-mono tabular-nums text-ink-400">
                          {totalHours > 0 ? Math.round((ss.totalHours / totalHours) * 100) : 0}%
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-surface-300">
                  <td className="px-5 py-4 font-semibold text-ink-900">Totals</td>
                  <td className="px-4 py-4 text-center font-mono tabular-nums">{allEntries.length}</td>
                  <td className="px-4 py-4 text-center font-bold font-mono tabular-nums text-ink-900">{totalHours}h</td>
                  <td className="px-4 py-4 text-center font-semibold font-mono tabular-nums text-emerald-600">{totalBillable}h</td>
                  <td className="px-4 py-4 text-center font-mono tabular-nums text-ink-500">{totalNonBillable}h</td>
                  <td className="px-5 py-4 text-center font-mono tabular-nums">100%</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}

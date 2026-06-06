'use client'

import { useState, useMemo } from 'react'
import { Breadcrumb } from '@/components/Breadcrumb'
import { cn, timesheetStatusColor, timesheetStatusLabel, timesheetCategoryLabel, timesheetCategoryColor, formatDate } from '@/lib/utils'
import { getUserTimesheets, PROJECTS, ALL_TASKS } from '@/lib/mock-data'
import { TimesheetEntry } from '@/lib/types'
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  Check,
  AlertTriangle,
  Send,
  FileText,
  Briefcase,
} from 'lucide-react'

function getMonday(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  d.setDate(diff)
  d.setHours(0, 0, 0, 0)
  return d
}

function formatWeekRange(monday: Date): string {
  const friday = new Date(monday)
  friday.setDate(monday.getDate() + 4)
  return `${formatDate(monday.toISOString())} - ${formatDate(friday.toISOString())}`
}

function getWeekDates(monday: Date): string[] {
  return Array.from({ length: 5 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return d.toISOString().split('T')[0]
  })
}

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']

export default function TimesheetsPage() {
  const [currentMonday, setCurrentMonday] = useState(() => getMonday(new Date('2026-05-18')))

  const weekDates = useMemo(() => getWeekDates(currentMonday), [currentMonday])

  const entries = useMemo(() => {
    const all = getUserTimesheets('u1')
    return all.filter(e => weekDates.includes(e.date))
  }, [weekDates])

  const entriesByDay = useMemo(() => {
    const map: Record<string, TimesheetEntry[]> = {}
    weekDates.forEach(d => { map[d] = [] })
    entries.forEach(e => {
      if (map[e.date]) map[e.date].push(e)
    })
    return map
  }, [entries, weekDates])

  const dailyTotals = useMemo(() => {
    return weekDates.map(d => entriesByDay[d].reduce((sum, e) => sum + e.hours, 0))
  }, [weekDates, entriesByDay])

  const weekTotal = dailyTotals.reduce((s, h) => s + h, 0)
  const billableTotal = entries.filter(e => e.billable).reduce((s, e) => s + e.hours, 0)
  const missingDays = dailyTotals.filter(h => h === 0).length
  const weekStatus = entries.length === 0 ? 'draft' : entries.every(e => e.status === 'approved') ? 'approved' : entries.some(e => e.status === 'submitted') ? 'submitted' : 'draft'
  const canSubmit = missingDays === 0 && weekStatus === 'draft'

  // Recently used projects and tasks for sidebar
  const recentProjects = useMemo(() => {
    const projectIds = [...new Set(entries.map(e => e.project_id))]
    return projectIds.map(id => PROJECTS.find(p => p.id === id)).filter(Boolean)
  }, [entries])

  const assignedTasks = useMemo(() => {
    return ALL_TASKS.filter(t => t.owner_user_id === 'u1' && t.status !== 'done').slice(0, 6)
  }, [])

  function prevWeek() {
    const d = new Date(currentMonday)
    d.setDate(d.getDate() - 7)
    setCurrentMonday(d)
  }

  function nextWeek() {
    const d = new Date(currentMonday)
    d.setDate(d.getDate() + 7)
    setCurrentMonday(d)
  }

  return (
    <div className="max-w-7xl animate-fade-in">
      {/* Header */}
      <section className="pb-8">
        <Breadcrumb items={[{ label: 'Dashboard', href: '/' }, { label: 'Timesheets' }]} />
        <div className="mt-6">
          <h1 className="font-display text-[2rem] text-ink-900 tracking-tight mb-2">
            My Timesheets
          </h1>
          <p className="text-[13px] text-ink-400 mt-1">
            {weekTotal}h logged this week &middot; {billableTotal}h billable &middot; {missingDays > 0 ? `${missingDays} day${missingDays > 1 ? 's' : ''} missing` : 'All days covered'}
          </p>
        </div>
      </section>

      {/* Week Navigator */}
      <section className="pb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={prevWeek}
              className="w-11 h-11 flex items-center justify-center rounded-xl border border-surface-200 hover:bg-surface-100 transition-colors"
              aria-label="Previous week"
            >
              <ChevronLeft className="w-4 h-4 text-ink-500" />
            </button>
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-ink-400" />
              <span className="text-[14px] font-semibold text-ink-900">{formatWeekRange(currentMonday)}</span>
            </div>
            <button
              onClick={nextWeek}
              className="w-11 h-11 flex items-center justify-center rounded-xl border border-surface-200 hover:bg-surface-100 transition-colors"
              aria-label="Next week"
            >
              <ChevronRight className="w-4 h-4 text-ink-500" />
            </button>
          </div>

          <div className="flex items-center gap-3">
            <span className={cn('status-pill', timesheetStatusColor(weekStatus as 'draft' | 'submitted' | 'approved' | 'rejected'))}>
              {timesheetStatusLabel(weekStatus as 'draft' | 'submitted' | 'approved' | 'rejected')}
            </span>
            {canSubmit && (
              <button className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-accent text-white text-[12px] font-semibold hover:opacity-90 transition-opacity shadow-glow-indigo">
                <Send className="w-3.5 h-3.5" />
                Submit Week
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Main Content: Grid + Sidebar */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-6">
        {/* Weekly Grid */}
        <section>
          <div className="card-static overflow-hidden">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-surface-200">
                  <th className="px-5 py-3 text-left text-[10px] text-ink-400 uppercase tracking-[0.1em] font-semibold">Day</th>
                  <th className="px-4 py-3 text-left text-[10px] text-ink-400 uppercase tracking-[0.1em] font-semibold">Project</th>
                  <th className="px-4 py-3 text-left text-[10px] text-ink-400 uppercase tracking-[0.1em] font-semibold">Task / Description</th>
                  <th className="px-4 py-3 text-center text-[10px] text-ink-400 uppercase tracking-[0.1em] font-semibold">Stage</th>
                  <th className="px-4 py-3 text-center text-[10px] text-ink-400 uppercase tracking-[0.1em] font-semibold">Hours</th>
                  <th className="px-4 py-3 text-center text-[10px] text-ink-400 uppercase tracking-[0.1em] font-semibold">Billable</th>
                  <th className="px-5 py-3 text-center text-[10px] text-ink-400 uppercase tracking-[0.1em] font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {weekDates.map((date, dayIdx) => {
                  const dayEntries = entriesByDay[date]
                  const dayTotal = dailyTotals[dayIdx]
                  const isMissing = dayTotal === 0

                  if (dayEntries.length === 0) {
                    return (
                      <tr key={date} className={cn('border-b border-surface-100', isMissing && 'bg-amber-50/40')}>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2">
                            {isMissing && <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />}
                            <div>
                              <span className="font-medium text-ink-900">{DAY_LABELS[dayIdx]}</span>
                              <span className="text-[11px] text-ink-300 ml-2 font-mono tabular-nums">{formatDate(date)}</span>
                            </div>
                          </div>
                        </td>
                        <td colSpan={5} className="px-4 py-4 text-[12px] text-ink-300 italic">No entries</td>
                        <td className="px-5 py-4 text-center">
                          <span className="text-[11px] font-mono tabular-nums text-ink-300">0h</span>
                        </td>
                      </tr>
                    )
                  }

                  return dayEntries.map((entry, entryIdx) => {
                    const project = PROJECTS.find(p => p.id === entry.project_id)
                    return (
                      <tr key={entry.id} className="border-b border-surface-100 stripe-row">
                        {entryIdx === 0 && (
                          <td className="px-5 py-3.5" rowSpan={dayEntries.length}>
                            <div>
                              <span className="font-medium text-ink-900">{DAY_LABELS[dayIdx]}</span>
                              <span className="text-[11px] text-ink-300 ml-2 font-mono tabular-nums">{formatDate(date)}</span>
                            </div>
                            <div className="mt-1 text-[11px] font-semibold text-ink-600 font-mono tabular-nums">
                              {dayTotal}h total
                            </div>
                          </td>
                        )}
                        <td className="px-4 py-3.5">
                          <span className="text-ink-900 font-medium">{project?.name || 'Unknown'}</span>
                        </td>
                        <td className="px-4 py-3.5 text-ink-600 max-w-[200px] truncate">
                          {entry.description || '—'}
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          <span className={cn('status-pill text-[10px]', timesheetCategoryColor(entry.task_category))}>
                            {timesheetCategoryLabel(entry.task_category)}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-center font-semibold font-mono tabular-nums text-ink-900">
                          {entry.hours}h
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          {entry.billable ? (
                            <Check className="w-4 h-4 text-emerald-500 mx-auto" />
                          ) : (
                            <span className="text-[11px] text-ink-300">—</span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-center">
                          <span className={cn('status-pill text-[10px]', timesheetStatusColor(entry.status))}>
                            {timesheetStatusLabel(entry.status)}
                          </span>
                        </td>
                      </tr>
                    )
                  })
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-surface-300">
                  <td className="px-5 py-4 font-semibold text-ink-900">Week Total</td>
                  <td className="px-4 py-4" />
                  <td className="px-4 py-4" />
                  <td className="px-4 py-4" />
                  <td className="px-4 py-4 text-center font-bold font-mono tabular-nums text-ink-900 text-[14px]">
                    {weekTotal}h
                  </td>
                  <td className="px-4 py-4 text-center text-[11px] text-ink-400 font-mono tabular-nums">
                    {billableTotal}h billable
                  </td>
                  <td className="px-5 py-4" />
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Daily totals bar */}
          <div className="mt-4 grid grid-cols-5 gap-2">
            {weekDates.map((date, i) => {
              const total = dailyTotals[i]
              const isMissing = total === 0
              return (
                <div
                  key={date}
                  className={cn(
                    'card-static p-3 text-center',
                    isMissing && 'border-amber-200 bg-amber-50/40'
                  )}
                >
                  <p className="text-[10px] text-ink-400 uppercase tracking-wide font-semibold">{DAY_LABELS[i]}</p>
                  <p className={cn(
                    'text-[16px] font-bold font-mono tabular-nums mt-1',
                    isMissing ? 'text-amber-600' : 'text-ink-900'
                  )}>
                    {total}h
                  </p>
                </div>
              )
            })}
          </div>

          {/* Export */}
          <div className="mt-6 flex items-center gap-3">
            <button className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-surface-200 text-[12px] font-medium text-ink-600 hover:bg-surface-100 transition-colors">
              <Download className="w-3.5 h-3.5" />
              Export PDF
            </button>
            <button className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-surface-200 text-[12px] font-medium text-ink-600 hover:bg-surface-100 transition-colors">
              <FileText className="w-3.5 h-3.5" />
              Export CSV
            </button>
          </div>
        </section>

        {/* Sidebar */}
        <aside className="space-y-6">
          {/* Assigned Projects */}
          <div className="card-static p-5">
            <h3 className="text-[11px] font-semibold text-ink-400 uppercase tracking-[0.1em] mb-4 flex items-center gap-2">
              <Briefcase className="w-3.5 h-3.5" />
              Active Projects
            </h3>
            <div className="space-y-3">
              {recentProjects.map(project => project && (
                <div key={project.id} className="flex items-center justify-between">
                  <div>
                    <p className="text-[12px] font-medium text-ink-900">{project.name}</p>
                    <p className="text-[10px] text-ink-400 mt-0.5">{project.client}</p>
                  </div>
                  <span className="text-[10px] font-mono tabular-nums text-ink-300 bg-surface-100 px-2 py-0.5 rounded-md">
                    Stage {project.current_stage}
                  </span>
                </div>
              ))}
              {recentProjects.length === 0 && (
                <p className="text-[12px] text-ink-300 italic">No active projects this week.</p>
              )}
            </div>
          </div>

          {/* Assigned Tasks */}
          <div className="card-static p-5">
            <h3 className="text-[11px] font-semibold text-ink-400 uppercase tracking-[0.1em] mb-4 flex items-center gap-2">
              <Clock className="w-3.5 h-3.5" />
              Assigned Tasks
            </h3>
            <div className="space-y-2.5">
              {assignedTasks.map(task => {
                const project = PROJECTS.find(p => p.id === task.project_id)
                return (
                  <div key={task.id} className="p-2.5 rounded-lg bg-surface-50 border border-surface-100">
                    <p className="text-[12px] font-medium text-ink-900 leading-snug">{task.title}</p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="text-[10px] text-ink-400">{project?.name}</span>
                      {task.due_date && (
                        <span className="text-[10px] font-mono tabular-nums text-ink-300">
                          Due {formatDate(task.due_date)}
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Week Summary */}
          <div className="card-static p-5">
            <h3 className="text-[11px] font-semibold text-ink-400 uppercase tracking-[0.1em] mb-4">Week Summary</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[12px] text-ink-500">Total Hours</span>
                <span className="text-[13px] font-bold font-mono tabular-nums text-ink-900">{weekTotal}h</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[12px] text-ink-500">Billable Hours</span>
                <span className="text-[13px] font-semibold font-mono tabular-nums text-emerald-600">{billableTotal}h</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[12px] text-ink-500">Non-billable</span>
                <span className="text-[13px] font-mono tabular-nums text-ink-600">{weekTotal - billableTotal}h</span>
              </div>
              <div className="border-t border-surface-100 pt-3 flex items-center justify-between">
                <span className="text-[12px] text-ink-500">Billable %</span>
                <span className={cn(
                  'text-[13px] font-bold font-mono tabular-nums',
                  weekTotal > 0 && (billableTotal / weekTotal) >= 0.7 ? 'text-emerald-600' : 'text-amber-600'
                )}>
                  {weekTotal > 0 ? Math.round((billableTotal / weekTotal) * 100) : 0}%
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[12px] text-ink-500">Missing Days</span>
                <span className={cn(
                  'text-[13px] font-bold font-mono tabular-nums',
                  missingDays > 0 ? 'text-amber-600' : 'text-emerald-600'
                )}>
                  {missingDays}
                </span>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}

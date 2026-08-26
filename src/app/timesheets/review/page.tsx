'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  Eye, Loader2, AlertTriangle, RefreshCw, CheckCircle2, XCircle,
  RotateCcw, Clock, ChevronDown, ChevronUp, User,
  Download, FileText,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useToast } from '@/components/Toast'
import { SkeletonRow } from '@/components/Skeleton'

/* ── Types ─────────────────────────────────────────────── */

interface TimesheetEntry {
  id: string
  hours: number
  isBillable: boolean
  date: string
  projectId: string | null
}

interface TimesheetWeek {
  id: string
  weekStarting: string
  status: string
  totalHours: number | null
  billableHours: number | null
  submittedAt: string | null
  rejectionReason: string | null
  comments: string | null
  profile: {
    id: string
    fullName: string
    jobTitle: string | null
    avatarUrl: string | null
  }
  entries: TimesheetEntry[]
}

type FilterStatus = 'ALL' | 'SUBMITTED' | 'APPROVED' | 'CHANGES_REQUIRED' | 'REJECTED'

const STATUS_FILTERS: { value: FilterStatus; label: string }[] = [
  { value: 'ALL', label: 'All' },
  { value: 'SUBMITTED', label: 'Pending' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'CHANGES_REQUIRED', label: 'Changes requested' },
  { value: 'REJECTED', label: 'Rejected' },
]

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  DRAFT: { label: 'Draft', color: 'text-ink-500', bg: 'bg-ink-100' },
  SUBMITTED: { label: 'Pending', color: 'text-blue-600', bg: 'bg-blue-50' },
  APPROVED: { label: 'Approved', color: 'text-emerald-600', bg: 'bg-emerald-50' },
  CHANGES_REQUIRED: { label: 'Changes requested', color: 'text-amber-600', bg: 'bg-amber-50' },
  REJECTED: { label: 'Rejected', color: 'text-red-600', bg: 'bg-red-50' },
  LOCKED: { label: 'Locked', color: 'text-purple-600', bg: 'bg-purple-50' },
  REOPENED: { label: 'Reopened', color: 'text-ink-600', bg: 'bg-ink-100' },
}

function StatusBadge({ status }: { status: string }) {
  const meta = STATUS_META[status] || { label: status, color: 'text-ink-500', bg: 'bg-ink-100' }
  return (
    <span className={cn('text-[11px] font-medium px-2.5 py-0.5 rounded-full', meta.bg, meta.color)}>
      {meta.label}
    </span>
  )
}

function formatWeek(dateStr: string): string {
  const d = new Date(dateStr)
  const end = new Date(d)
  end.setDate(end.getDate() + 6)
  const fmt = (dt: Date) => dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  return `${fmt(d)} – ${fmt(end)}`
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
}

/* ── Page ──────────────────────────────────────────────── */

export default function TimesheetReviewPage() {
  const { toast } = useToast()
  const [weeks, setWeeks] = useState<TimesheetWeek[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('SUBMITTED')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // Export filter state
  const [departmentFilter, setDepartmentFilter] = useState<string>('ALL')
  const [employeeFilter, setEmployeeFilter] = useState<string>('ALL')
  const [departments, setDepartments] = useState<string[]>([])
  const [profileDeptMap, setProfileDeptMap] = useState<Record<string, string>>({})

  // Action state
  const [actionId, setActionId] = useState<string | null>(null)
  const [actionType, setActionType] = useState<string | null>(null)
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [exporting, setExporting] = useState(false)

  const handleExport = useCallback(async (format: 'csv' | 'pdf') => {
    setExporting(true)
    try {
      const params = new URLSearchParams({ format, role: 'manager' })
      if (statusFilter !== 'ALL') params.set('status', statusFilter)
      if (employeeFilter !== 'ALL') params.set('profileId', employeeFilter)

      const res = await fetch(`/api/timesheets/export?${params}`)
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error?.message || 'Export failed')
      }

      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `timesheets-review.${format}`
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
      toast(`Timesheet ${format.toUpperCase()} downloaded`, 'success')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Export failed', 'error')
    } finally {
      setExporting(false)
    }
  }, [statusFilter, employeeFilter, toast])

  // Fetch departments from staffing for export filters
  useEffect(() => {
    fetch('/api/staffing')
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (!json?.data) return
        const people: { id: string; fullName: string; department?: string | null }[] =
          json.data.employees ?? json.data.directory ?? []

        // Build profileId -> department map
        const deptMap: Record<string, string> = {}
        const deptSet = new Set<string>()
        for (const p of people) {
          if (p.department) {
            deptMap[p.id] = p.department
            deptSet.add(p.department)
          }
        }
        setProfileDeptMap(deptMap)
        setDepartments([...deptSet].sort())
      })
      .catch(() => {})
  }, [])

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ role: 'manager', pageSize: '50' })
      if (statusFilter !== 'ALL') params.set('status', statusFilter)
      const res = await fetch(`/api/timesheets?${params}`)
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error?.message || 'Failed to load timesheets')
      }
      const json = await res.json()
      setWeeks(json.data.weeks)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }, [statusFilter])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  /* ── Actions ─────────────────────────────────────── */

  const handleAction = async (weekId: string, newStatus: string, rejectionReason?: string) => {
    setSubmitting(true)
    try {
      const payload: Record<string, unknown> = { status: newStatus }
      if (rejectionReason) payload.rejectionReason = rejectionReason

      const res = await fetch(`/api/timesheets/${weekId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error?.message || 'Failed to update timesheet')
      }

      const label = newStatus.toLowerCase().replace(/_/g, ' ')
      toast(`Timesheet ${label}`, 'success')
      setActionId(null)
      setActionType(null)
      setReason('')
      fetchData()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to update', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const startAction = (weekId: string, type: string) => {
    setActionId(weekId)
    setActionType(type)
    setReason('')
  }

  const cancelAction = () => {
    setActionId(null)
    setActionType(null)
    setReason('')
  }

  /* ── Day breakdown helper ────────────────────────── */

  const getDayBreakdown = (entries: TimesheetEntry[]) => {
    const byDate: Record<string, { total: number; billable: number; count: number }> = {}
    for (const e of entries) {
      const key = e.date.slice(0, 10)
      if (!byDate[key]) byDate[key] = { total: 0, billable: 0, count: 0 }
      byDate[key].total += e.hours
      if (e.isBillable) byDate[key].billable += e.hours
      byDate[key].count++
    }
    return Object.entries(byDate)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, data]) => ({ date, ...data }))
  }

  /* ── Client-side department + employee filters ───── */

  let filteredWeeks = weeks
  if (departmentFilter !== 'ALL') {
    filteredWeeks = filteredWeeks.filter((w) => profileDeptMap[w.profile.id] === departmentFilter)
  }
  if (employeeFilter !== 'ALL') {
    filteredWeeks = filteredWeeks.filter((w) => w.profile.id === employeeFilter)
  }

  // Unique employees from weeks (for the employee dropdown)
  const uniqueEmployees = Array.from(
    new Map(weeks.map((w) => [w.profile.id, { id: w.profile.id, fullName: w.profile.fullName }])).values(),
  ).sort((a, b) => a.fullName.localeCompare(b.fullName))

  /* ── Summary ─────────────────────────────────────── */

  const statusCounts = weeks.reduce<Record<string, number>>((acc, w) => {
    acc[w.status] = (acc[w.status] || 0) + 1
    return acc
  }, {})

  /* ── Loading ─────────────────────────────────────── */

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-56 bg-ink-100 animate-pulse rounded" />
        <div className="bg-white rounded-xl border border-ink-100 divide-y divide-ink-50">
          {Array.from({ length: 4 }).map((_, i) => <SkeletonRow key={i} />)}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh] gap-4">
        <AlertTriangle className="w-8 h-8 text-red-500" />
        <p className="text-[13px] text-ink-600">{error}</p>
        <button onClick={fetchData} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-ink-900 text-white text-[13px] font-medium hover:bg-ink-800 transition-colors">
          <RefreshCw className="w-4 h-4" /> Try again
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* ── Header ─────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-[20px] sm:text-[22px] font-semibold text-ink-900">Timesheet Review</h1>
          <p className="text-[12px] text-ink-400 mt-0.5">
            {filteredWeeks.length === weeks.length
              ? `${weeks.length} timesheets`
              : `${filteredWeeks.length} of ${weeks.length} timesheets`}
            {' · '}{statusCounts.SUBMITTED || 0} pending approval
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleExport('csv')}
            disabled={exporting || filteredWeeks.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-ink-200 rounded-lg text-[12px] font-medium text-ink-600 hover:bg-ink-50 transition-colors disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" />
            {exporting ? 'Exporting…' : 'Download CSV'}
          </button>
          <button
            onClick={() => handleExport('pdf')}
            disabled={exporting || filteredWeeks.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-ink-200 rounded-lg text-[12px] font-medium text-ink-600 hover:bg-ink-50 transition-colors disabled:opacity-50"
          >
            <FileText className="w-3.5 h-3.5" />
            {exporting ? 'Exporting…' : 'Download PDF'}
          </button>
        </div>
      </div>

      {/* ── Filter bar ─────────────────────────────── */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex gap-1 flex-wrap">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setStatusFilter(f.value)}
              className={cn(
                'px-3 py-1.5 rounded-full text-[11px] font-medium transition-colors',
                statusFilter === f.value
                  ? 'bg-ink-900 text-white'
                  : 'bg-ink-50 text-ink-500 hover:bg-ink-100',
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        {departments.length > 0 && (
          <select
            value={departmentFilter}
            onChange={(e) => setDepartmentFilter(e.target.value)}
            className="text-[11px] text-ink-600 bg-white border border-ink-200 rounded-lg px-2.5 py-1.5 outline-none focus:ring-2 focus:ring-accent-300"
          >
            <option value="ALL">All departments</option>
            {departments.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        )}

        {uniqueEmployees.length > 1 && (
          <select
            value={employeeFilter}
            onChange={(e) => setEmployeeFilter(e.target.value)}
            className="text-[11px] text-ink-600 bg-white border border-ink-200 rounded-lg px-2.5 py-1.5 outline-none focus:ring-2 focus:ring-accent-300"
          >
            <option value="ALL">All employees</option>
            {uniqueEmployees.map((e) => (
              <option key={e.id} value={e.id}>{e.fullName}</option>
            ))}
          </select>
        )}
      </div>

      {/* ── List ───────────────────────────────────── */}
      {filteredWeeks.length === 0 ? (
        <div className="bg-white rounded-xl border border-ink-100 p-12 text-center">
          <Eye className="w-12 h-12 text-ink-200 mx-auto mb-4" />
          <p className="text-[15px] font-medium text-ink-700">No timesheets to review</p>
          <p className="text-[12px] text-ink-400 mt-2">
            {statusFilter === 'SUBMITTED'
              ? 'No timesheets are waiting for your approval.'
              : 'No timesheets match the current filters.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredWeeks.map((week) => {
            const isExpanded = expandedId === week.id
            const days = getDayBreakdown(week.entries)
            const totalHours = week.totalHours ?? week.entries.reduce((s, e) => s + e.hours, 0)
            const billableHours = week.billableHours ?? week.entries.filter(e => e.isBillable).reduce((s, e) => s + e.hours, 0)
            const isActioning = actionId === week.id

            return (
              <div key={week.id} className="bg-white rounded-xl border border-ink-100 overflow-hidden">
                {/* Card header */}
                <button
                  onClick={() => setExpandedId(isExpanded ? null : week.id)}
                  className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-ink-50/50 transition-colors"
                >
                  <div className="w-9 h-9 rounded-full bg-ink-100 flex items-center justify-center shrink-0">
                    <User className="w-4 h-4 text-ink-500" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-ink-900">{week.profile.fullName}</p>
                    <p className="text-[11px] text-ink-400">
                      {formatWeek(week.weekStarting)}
                      {week.profile.jobTitle && ` · ${week.profile.jobTitle}`}
                    </p>
                  </div>

                  <div className="text-right shrink-0">
                    <p className="text-[14px] font-semibold text-ink-900">{totalHours}h</p>
                    <p className="text-[10px] text-ink-400">{billableHours}h billable</p>
                  </div>

                  <StatusBadge status={week.status} />

                  {isExpanded
                    ? <ChevronUp className="w-4 h-4 text-ink-300 shrink-0" />
                    : <ChevronDown className="w-4 h-4 text-ink-300 shrink-0" />
                  }
                </button>

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="border-t border-ink-100 px-5 py-4 space-y-4">
                    {/* Day breakdown */}
                    {days.length > 0 ? (
                      <div className="overflow-x-auto">
                        <table className="w-full text-[12px]">
                          <thead>
                            <tr className="text-ink-400 text-[10px] uppercase tracking-wider">
                              <th className="text-left py-1.5 font-medium">Day</th>
                              <th className="text-right py-1.5 font-medium">Hours</th>
                              <th className="text-right py-1.5 font-medium">Billable</th>
                              <th className="text-right py-1.5 font-medium">Entries</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-ink-50">
                            {days.map((d) => (
                              <tr key={d.date}>
                                <td className="py-1.5 text-ink-700">{formatDate(d.date)}</td>
                                <td className="py-1.5 text-right text-ink-900 font-medium">{d.total}h</td>
                                <td className="py-1.5 text-right text-ink-500">{d.billable}h</td>
                                <td className="py-1.5 text-right text-ink-400">{d.count}</td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr className="border-t border-ink-200 font-medium">
                              <td className="py-2 text-ink-700">Total</td>
                              <td className="py-2 text-right text-ink-900">{totalHours}h</td>
                              <td className="py-2 text-right text-ink-600">{billableHours}h</td>
                              <td className="py-2 text-right text-ink-400">{week.entries.length}</td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    ) : (
                      <p className="text-[12px] text-ink-400">No entries recorded.</p>
                    )}

                    {/* Previous rejection reason */}
                    {week.rejectionReason && (
                      <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                        <p className="text-[11px] font-medium text-amber-700">Previous feedback</p>
                        <p className="text-[12px] text-amber-600 mt-0.5">{week.rejectionReason}</p>
                      </div>
                    )}

                    {/* Submitted timestamp */}
                    {week.submittedAt && (
                      <p className="text-[11px] text-ink-400 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        Submitted {new Date(week.submittedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    )}

                    {/* Action buttons */}
                    {week.status === 'SUBMITTED' && !isActioning && (
                      <div className="flex items-center gap-2 pt-2">
                        <button
                          onClick={() => handleAction(week.id, 'APPROVED')}
                          disabled={submitting}
                          className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 text-white text-[12px] font-medium hover:bg-emerald-700 transition-colors"
                        >
                          <CheckCircle2 className="w-4 h-4" /> Approve
                        </button>
                        <button
                          onClick={() => startAction(week.id, 'CHANGES_REQUIRED')}
                          className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-amber-50 text-amber-700 border border-amber-200 text-[12px] font-medium hover:bg-amber-100 transition-colors"
                        >
                          <RotateCcw className="w-4 h-4" /> Request changes
                        </button>
                        <button
                          onClick={() => startAction(week.id, 'REJECTED')}
                          className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-red-50 text-red-600 border border-red-200 text-[12px] font-medium hover:bg-red-100 transition-colors"
                        >
                          <XCircle className="w-4 h-4" /> Reject
                        </button>
                      </div>
                    )}

                    {/* Reason input */}
                    {isActioning && (
                      <div className="space-y-3 pt-2">
                        <label className="block text-[11px] font-medium text-ink-500">
                          {actionType === 'CHANGES_REQUIRED' ? 'What changes are needed?' : 'Reason for rejection'} <span className="text-red-400">*</span>
                        </label>
                        <textarea
                          value={reason}
                          onChange={(e) => setReason(e.target.value)}
                          placeholder={actionType === 'CHANGES_REQUIRED' ? 'e.g. Missing entries for Thursday' : 'e.g. Hours do not match project records'}
                          className="w-full px-3 py-2 text-[13px] border border-ink-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-300 placeholder:text-ink-300 min-h-[60px]"
                          maxLength={2000}
                          autoFocus
                        />
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleAction(week.id, actionType!, reason.trim())}
                            disabled={submitting || !reason.trim()}
                            className={cn(
                              'flex items-center gap-1.5 px-4 py-2 rounded-lg text-[12px] font-medium transition-colors',
                              submitting || !reason.trim()
                                ? 'bg-ink-200 text-ink-400 cursor-not-allowed'
                                : actionType === 'REJECTED'
                                  ? 'bg-red-600 text-white hover:bg-red-700'
                                  : 'bg-amber-600 text-white hover:bg-amber-700',
                            )}
                          >
                            {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                            {actionType === 'CHANGES_REQUIRED' ? 'Send back' : 'Reject'}
                          </button>
                          <button
                            onClick={cancelAction}
                            className="px-3.5 py-2 text-[12px] font-medium text-ink-500 hover:text-ink-700 transition-colors"
                            disabled={submitting}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

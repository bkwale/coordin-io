'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import {
  CalendarDays, Plus, Loader2, AlertTriangle, RefreshCw,
  X, Check, Clock, Ban, ArrowRight, ChevronLeft, ChevronRight,
  Users, ShieldCheck, Settings, Eye, MessageSquare,
  SunMedium, Moon, CheckCircle, XCircle, Trash2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { filterLeaveRequests } from '@/lib/leave-filters'
import type { LeaveFilterStatus } from '@/lib/leave-filters'
import { useToast } from '@/components/Toast'
import { useApiMutation } from '@/hooks/use-api'
import { SkeletonRow } from '@/components/Skeleton'

/* ── Types ─────────────────────────────────────────────── */

interface LeaveBalance {
  year: number
  allocation: number
  used: number
  carriedForward: number
  pending: number
  available: number
  taken: number
  approvedFuture: number
}

interface LeaveRequest {
  id: string
  leaveType: string
  startDate: string
  endDate: string
  days: number
  halfDay: boolean
  halfDayPeriod: string | null
  reason: string | null
  status: string
  approvalComment: string | null
  createdAt: string
  approvedAt: string | null
  profile: { id: string; fullName: string; jobTitle?: string }
  approver: { id: string; fullName: string } | null
}

interface CalendarHoliday {
  id: string
  name: string
  date: string
  country: string
  isRecurring: boolean
  officeId: string | null
  office: { id: string; name: string } | null
}

interface BlackoutDate {
  id: string
  name: string
  startDate: string
  endDate: string
  reason: string | null
  createdBy: { id: string; fullName: string } | null
  createdAt: string
}

interface TeamMember {
  id: string
  fullName: string
  jobTitle: string | null
  avatarUrl: string | null
  department: string | null
}

interface UserProfile {
  id: string
  orgPermission: string
  managerId: string | null
}

type Tab = 'my-leave' | 'team-calendar' | 'approvals' | 'admin'

type FilterStatus = LeaveFilterStatus

/* ── Constants ─────────────────────────────────────────── */

const STATUS_FILTERS: { value: FilterStatus; label: string }[] = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'ALL', label: 'All' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'SUBMITTED', label: 'Submitted' },
  { value: 'LINE_MANAGER_APPROVED', label: 'Manager approved' },
  { value: 'HR_APPROVED', label: 'HR approved' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'CANCELLED', label: 'Cancelled' },
  { value: 'WITHDRAWN', label: 'Withdrawn' },
]

const LEAVE_TYPES: { value: string; label: string }[] = [
  { value: 'ANNUAL', label: 'Annual leave' },
  { value: 'SICK', label: 'Sick leave' },
  { value: 'COMPASSIONATE', label: 'Compassionate leave' },
  { value: 'PARENTAL', label: 'Parental leave' },
  { value: 'MATERNITY', label: 'Maternity leave' },
  { value: 'PATERNITY', label: 'Paternity leave' },
  { value: 'STUDY', label: 'Study leave' },
  { value: 'CPD_TRAINING', label: 'CPD / Training' },
  { value: 'UNPAID', label: 'Unpaid leave' },
  { value: 'TOIL', label: 'TOIL' },
  { value: 'BUSINESS_TRAVEL', label: 'Business travel' },
  { value: 'PUBLIC_HOLIDAY', label: 'Public holiday' },
  { value: 'OTHER', label: 'Other' },
]

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  DRAFT: { label: 'Draft', color: 'text-ink-500', bg: 'bg-ink-100' },
  SUBMITTED: { label: 'Submitted', color: 'text-blue-600', bg: 'bg-blue-50' },
  UNDER_REVIEW: { label: 'Under review', color: 'text-amber-600', bg: 'bg-amber-50' },
  LINE_MANAGER_APPROVED: { label: 'Manager approved', color: 'text-cyan-600', bg: 'bg-cyan-50' },
  HR_APPROVED: { label: 'HR approved', color: 'text-violet-600', bg: 'bg-violet-50' },
  APPROVED: { label: 'Approved', color: 'text-emerald-600', bg: 'bg-emerald-50' },
  REJECTED: { label: 'Rejected', color: 'text-red-600', bg: 'bg-red-50' },
  CANCELLED: { label: 'Cancelled', color: 'text-orange-600', bg: 'bg-orange-50' },
  FULFILMENT_IN_PROGRESS: { label: 'In progress', color: 'text-blue-600', bg: 'bg-blue-50' },
  COMPLETED: { label: 'Completed', color: 'text-emerald-600', bg: 'bg-emerald-50' },
  WITHDRAWN: { label: 'Withdrawn', color: 'text-ink-400', bg: 'bg-ink-50' },
}

const APPROVAL_CHAIN_STEPS = [
  { key: 'SUBMITTED', label: 'Submitted' },
  { key: 'LINE_MANAGER_APPROVED', label: 'Line Manager' },
  { key: 'HR_APPROVED', label: 'HR Review' },
  { key: 'APPROVED', label: 'Approved' },
]

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

const DAY_HEADERS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

/* ── Helpers ───────────────────────────────────────────── */

function calculateWorkingDays(startStr: string, endStr: string): number {
  const start = new Date(startStr)
  const end = new Date(endStr)
  if (end < start) return 0
  let count = 0
  const current = new Date(start)
  current.setHours(0, 0, 0, 0)
  const endDate = new Date(end)
  endDate.setHours(0, 0, 0, 0)
  while (current <= endDate) {
    const day = current.getDay()
    if (day !== 0 && day !== 6) count++
    current.setDate(current.getDate() + 1)
  }
  return count
}

function formatDateRange(start: string, end: string): string {
  const s = new Date(start)
  const e = new Date(end)
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }
  if (s.getFullYear() !== new Date().getFullYear()) {
    return `${s.toLocaleDateString('en-GB', { ...opts, year: 'numeric' })} – ${e.toLocaleDateString('en-GB', { ...opts, year: 'numeric' })}`
  }
  return `${s.toLocaleDateString('en-GB', opts)} – ${e.toLocaleDateString('en-GB', opts)}`
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

function getLeaveTypeLabel(type: string): string {
  return LEAVE_TYPES.find((t) => t.value === type)?.label || type
}

function StatusBadge({ status }: { status: string }) {
  const meta = STATUS_META[status] || { label: status, color: 'text-ink-500', bg: 'bg-ink-100' }
  return (
    <span className={cn('text-[11px] font-medium px-2.5 py-0.5 rounded-full whitespace-nowrap', meta.bg, meta.color)}>
      {meta.label}
    </span>
  )
}

/** Get the approval chain step index for a given status */
function getApprovalStepIndex(status: string): number {
  switch (status) {
    case 'DRAFT': return -1
    case 'SUBMITTED': return 0
    case 'LINE_MANAGER_APPROVED': return 1
    case 'HR_APPROVED': return 2
    case 'APPROVED': return 3
    default: return -1
  }
}

/** Get calendar grid data for a month */
function getCalendarGrid(year: number, month: number): { date: Date; isCurrentMonth: boolean }[][] {
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)

  // Monday-based: 0=Mon, 6=Sun
  let startDow = firstDay.getDay() - 1
  if (startDow < 0) startDow = 6

  const weeks: { date: Date; isCurrentMonth: boolean }[][] = []
  let currentDate = new Date(firstDay)
  currentDate.setDate(currentDate.getDate() - startDow)

  for (let w = 0; w < 6; w++) {
    const week: { date: Date; isCurrentMonth: boolean }[] = []
    for (let d = 0; d < 7; d++) {
      week.push({
        date: new Date(currentDate),
        isCurrentMonth: currentDate.getMonth() === month,
      })
      currentDate.setDate(currentDate.getDate() + 1)
    }
    // Only add weeks that contain at least one day from the current month
    if (week.some((d) => d.isCurrentMonth)) {
      weeks.push(week)
    }
  }

  return weeks
}

/** Check if a date falls within a leave request */
function isDateInLeaveRange(date: Date, start: string, end: string): boolean {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  const s = new Date(start)
  s.setHours(0, 0, 0, 0)
  const e = new Date(end)
  e.setHours(0, 0, 0, 0)
  return d >= s && d <= e
}

/** Colors by leave type for team calendar */
const LEAVE_TYPE_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  ANNUAL:          { bg: 'bg-blue-100',    text: 'text-blue-700',    label: 'Annual' },
  SICK:            { bg: 'bg-red-100',     text: 'text-red-700',     label: 'Sick' },
  COMPASSIONATE:   { bg: 'bg-purple-100',  text: 'text-purple-700',  label: 'Compassionate' },
  MATERNITY:       { bg: 'bg-teal-100',    text: 'text-teal-700',    label: 'Maternity' },
  PATERNITY:       { bg: 'bg-teal-100',    text: 'text-teal-700',    label: 'Paternity' },
  PARENTAL:        { bg: 'bg-teal-100',    text: 'text-teal-700',    label: 'Parental' },
  STUDY:           { bg: 'bg-indigo-100',  text: 'text-indigo-700',  label: 'Study' },
  CPD_TRAINING:    { bg: 'bg-amber-100',   text: 'text-amber-700',   label: 'Training' },
  UNPAID:          { bg: 'bg-stone-100',   text: 'text-stone-700',   label: 'Unpaid' },
  TOIL:            { bg: 'bg-lime-100',    text: 'text-lime-700',    label: 'TOIL' },
  BUSINESS_TRAVEL: { bg: 'bg-violet-100',  text: 'text-violet-700',  label: 'Travel' },
  PUBLIC_HOLIDAY:  { bg: 'bg-slate-200',   text: 'text-slate-600',   label: 'Public holiday' },
  OTHER:           { bg: 'bg-gray-100',    text: 'text-gray-700',    label: 'Other' },
}

function getLeaveTypeColor(leaveType: string): { bg: string; text: string; label: string } {
  return LEAVE_TYPE_COLORS[leaveType] || LEAVE_TYPE_COLORS.OTHER
}

/* ── Page ──────────────────────────────────────────────── */

export default function LeavePage() {
  const { toast } = useToast()

  // User context (fetched from session)
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)

  // Tab state
  const [activeTab, setActiveTab] = useState<Tab>('my-leave')

  // My Leave data
  const [balance, setBalance] = useState<LeaveBalance | null>(null)
  const [requests, setRequests] = useState<LeaveRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('ACTIVE')

  // Detail view
  const [selectedRequest, setSelectedRequest] = useState<LeaveRequest | null>(null)

  // Create form state
  const [showForm, setShowForm] = useState(false)
  const [formType, setFormType] = useState('ANNUAL')
  const [formStart, setFormStart] = useState('')
  const [formEnd, setFormEnd] = useState('')
  const [formReason, setFormReason] = useState('')
  const [formHalfDay, setFormHalfDay] = useState(false)
  const [formHalfDayPeriod, setFormHalfDayPeriod] = useState<'AM' | 'PM'>('AM')
  const { mutate: createLeave, loading: creating } = useApiMutation<LeaveRequest>('/api/leave/requests', 'POST')

  // Team Calendar state
  const [calMonth, setCalMonth] = useState(new Date().getMonth())
  const [calYear, setCalYear] = useState(new Date().getFullYear())
  const [teamLeave, setTeamLeave] = useState<LeaveRequest[]>([])
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [teamHolidays, setTeamHolidays] = useState<CalendarHoliday[]>([])
  const [teamLoading, setTeamLoading] = useState(false)
  const [calDeptFilter, setCalDeptFilter] = useState('')
  const [calOfficeFilter, setCalOfficeFilter] = useState('')
  const [calEmployeeFilter, setCalEmployeeFilter] = useState('')
  const [calLeaveTypeFilter, setCalLeaveTypeFilter] = useState('')
  const [calStatusFilter, setCalStatusFilter] = useState('')

  // Approvals state
  const [approvalRequests, setApprovalRequests] = useState<LeaveRequest[]>([])
  const [approvalsLoading, setApprovalsLoading] = useState(false)
  const [approvalComment, setApprovalComment] = useState('')

  // Computed: is manager or admin?
  const isManager = userProfile?.orgPermission === 'MANAGER' || userProfile?.orgPermission === 'ADMIN' || userProfile?.orgPermission === 'OWNER'
  const isAdmin = userProfile?.orgPermission === 'ADMIN' || userProfile?.orgPermission === 'OWNER'

  /* ── Data fetching ──────────────────────────────────── */

  const fetchUserProfile = useCallback(async () => {
    try {
      const res = await fetch('/api/me')
      if (res.ok) {
        const json = await res.json()
        setUserProfile({
          id: json.data.id,
          orgPermission: json.data.orgPermission,
          managerId: json.data.managerId,
        })
      }
    } catch {
      // Silently fail — tabs will just not show manager/admin features
    }
  }, [])

  const fetchMyLeave = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [balRes, reqRes] = await Promise.all([
        fetch('/api/leave/balance'),
        fetch('/api/leave/requests'),
      ])
      if (!balRes.ok || !reqRes.ok) {
        const errBody = await (balRes.ok ? reqRes : balRes).json().catch(() => ({}))
        throw new Error(errBody.error?.message || 'Failed to load leave data')
      }
      const balJson = await balRes.json()
      const reqJson = await reqRes.json()
      setBalance(balJson.data)
      setRequests(reqJson.data.requests)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchTeamLeave = useCallback(async () => {
    setTeamLoading(true)
    try {
      const params = new URLSearchParams({ month: String(calMonth + 1), year: String(calYear) })
      if (calDeptFilter) params.set('department', calDeptFilter)
      if (calOfficeFilter) params.set('officeId', calOfficeFilter)
      const res = await fetch(`/api/leave/team?${params}`)
      if (res.ok) {
        const json = await res.json()
        setTeamLeave(json.data.teamLeave || [])
        setTeamMembers(json.data.teamMembers || [])
        setTeamHolidays(json.data.holidays || [])
      }
    } catch {
      // Silently fail
    } finally {
      setTeamLoading(false)
    }
  }, [calMonth, calYear, calDeptFilter, calOfficeFilter])

  const fetchApprovals = useCallback(async () => {
    setApprovalsLoading(true)
    try {
      const res = await fetch('/api/leave/requests?role=approver')
      if (res.ok) {
        const json = await res.json()
        setApprovalRequests(json.data.requests || [])
      }
    } catch {
      // Silently fail
    } finally {
      setApprovalsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchUserProfile()
    fetchMyLeave()
  }, [fetchUserProfile, fetchMyLeave])

  useEffect(() => {
    if (activeTab === 'team-calendar' && isManager) {
      fetchTeamLeave()
    }
  }, [activeTab, isManager, fetchTeamLeave])

  useEffect(() => {
    if (activeTab === 'approvals' && isManager) {
      fetchApprovals()
    }
  }, [activeTab, isManager, fetchApprovals])

  /* ── Create handler ──────────────────────────────── */

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formStart || !formEnd) return

    const result = await createLeave({
      leaveType: formType,
      startDate: formStart,
      endDate: formEnd,
      reason: formReason || undefined,
      halfDay: formHalfDay,
      halfDayPeriod: formHalfDay ? formHalfDayPeriod : undefined,
    })

    if (result) {
      toast('Leave request created', 'success')
      cancelForm()
      fetchMyLeave()
    } else {
      toast('Failed to create leave request', 'error')
    }
  }

  const cancelForm = () => {
    setShowForm(false)
    setFormType('ANNUAL')
    setFormStart('')
    setFormEnd('')
    setFormReason('')
    setFormHalfDay(false)
    setFormHalfDayPeriod('AM')
  }

  /* ── Status change handler ─────────────────────── */

  const handleStatusChange = async (id: string, newStatus: string, comment?: string) => {
    try {
      const res = await fetch(`/api/leave/requests/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus, ...(comment ? { comment } : {}) }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error?.message || 'Failed to update')
      }
      toast(`Leave request ${newStatus.toLowerCase().replace(/_/g, ' ')}`, 'success')
      fetchMyLeave()
      if (activeTab === 'approvals') fetchApprovals()
      setSelectedRequest(null)
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to update', 'error')
    }
  }

  /* ── Working days preview ───────────────────────── */

  const workingDaysPreview = useMemo(() => {
    if (!formStart || !formEnd) return null
    if (formHalfDay) return 0.5
    return calculateWorkingDays(formStart, formEnd)
  }, [formStart, formEnd, formHalfDay])

  /* ── Filter ──────────────────────────────────────── */

  const filtered = filterLeaveRequests(requests, statusFilter)
  const statusCounts = requests.reduce<Record<string, number>>((acc, r) => {
    acc[r.status] = (acc[r.status] || 0) + 1
    return acc
  }, {})

  /* ── Calendar navigation ─────────────────────────── */

  const navigateMonth = (direction: -1 | 1) => {
    let newMonth = calMonth + direction
    let newYear = calYear
    if (newMonth < 0) { newMonth = 11; newYear-- }
    if (newMonth > 11) { newMonth = 0; newYear++ }
    setCalMonth(newMonth)
    setCalYear(newYear)
  }

  const calendarGrid = useMemo(() => getCalendarGrid(calYear, calMonth), [calYear, calMonth])

  /* ── Tabs ────────────────────────────────────────── */

  const tabs: { key: Tab; label: string; icon: React.FC<{ className?: string }>; visible: boolean }[] = [
    { key: 'my-leave', label: 'My Leave', icon: CalendarDays, visible: true },
    { key: 'team-calendar', label: 'Team Calendar', icon: Users, visible: isManager },
    { key: 'approvals', label: 'Approvals', icon: ShieldCheck, visible: isManager },
    { key: 'admin', label: 'Admin', icon: Settings, visible: isAdmin },
  ]

  /* ── Loading ─────────────────────────────────────── */

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-40 bg-ink-100 animate-pulse rounded" />
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-24 bg-ink-100 animate-pulse rounded-xl" />
          ))}
        </div>
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
        <button onClick={fetchMyLeave} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-ink-900 text-white text-[13px] font-medium hover:bg-ink-800 transition-colors">
          <RefreshCw className="w-4 h-4" /> Try again
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* ── Header ─────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[20px] sm:text-[22px] font-semibold text-ink-900">Leave</h1>
          <p className="text-[12px] text-ink-400 mt-0.5">
            {balance?.year} &middot; {requests.length} requests
          </p>
        </div>
        {activeTab === 'my-leave' && !showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-ink-900 text-white text-[12px] font-medium hover:bg-ink-800 transition-colors self-start shrink-0"
          >
            <Plus className="w-4 h-4" />
            Request leave
          </button>
        )}
      </div>

      {/* ── Tab bar ────────────────────────────────── */}
      <div className="flex gap-1 border-b border-ink-100 overflow-x-auto">
        {tabs.filter((t) => t.visible).map((tab) => {
          const Icon = tab.icon
          const isActive = activeTab === tab.key
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                'flex items-center gap-1.5 px-4 py-2.5 text-[12px] font-medium border-b-2 transition-colors whitespace-nowrap',
                isActive
                  ? 'border-ink-900 text-ink-900'
                  : 'border-transparent text-ink-400 hover:text-ink-600',
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              {tab.label}
              {tab.key === 'approvals' && approvalRequests.length > 0 && (
                <span className="ml-1 px-1.5 py-0.5 rounded-full bg-red-100 text-red-600 text-[10px] font-semibold">
                  {approvalRequests.length}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* ── Tab content ─────────────────────────────── */}
      {activeTab === 'my-leave' && (
        <MyLeaveTab
          balance={balance}
          requests={requests}
          filtered={filtered}
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
          statusCounts={statusCounts}
          showForm={showForm}
          handleCreate={handleCreate}
          cancelForm={cancelForm}
          creating={creating}
          formType={formType}
          setFormType={setFormType}
          formStart={formStart}
          setFormStart={setFormStart}
          formEnd={formEnd}
          setFormEnd={setFormEnd}
          formReason={formReason}
          setFormReason={setFormReason}
          formHalfDay={formHalfDay}
          setFormHalfDay={setFormHalfDay}
          formHalfDayPeriod={formHalfDayPeriod}
          setFormHalfDayPeriod={setFormHalfDayPeriod}
          workingDaysPreview={workingDaysPreview}
          handleStatusChange={handleStatusChange}
          selectedRequest={selectedRequest}
          setSelectedRequest={setSelectedRequest}
        />
      )}

      {activeTab === 'team-calendar' && isManager && (
        <TeamCalendarTab
          calMonth={calMonth}
          calYear={calYear}
          navigateMonth={navigateMonth}
          goToToday={() => { setCalMonth(new Date().getMonth()); setCalYear(new Date().getFullYear()) }}
          calendarGrid={calendarGrid}
          teamLeave={teamLeave}
          teamMembers={teamMembers}
          teamLoading={teamLoading}
          holidays={teamHolidays}
          deptFilter={calDeptFilter}
          setDeptFilter={setCalDeptFilter}
          officeFilter={calOfficeFilter}
          setOfficeFilter={setCalOfficeFilter}
          employeeFilter={calEmployeeFilter}
          setEmployeeFilter={setCalEmployeeFilter}
          leaveTypeFilter={calLeaveTypeFilter}
          setLeaveTypeFilter={setCalLeaveTypeFilter}
          statusFilter={calStatusFilter}
          setStatusFilter={setCalStatusFilter}
        />
      )}

      {activeTab === 'approvals' && isManager && (
        <ApprovalsTab
          approvalRequests={approvalRequests}
          approvalsLoading={approvalsLoading}
          handleStatusChange={handleStatusChange}
          approvalComment={approvalComment}
          setApprovalComment={setApprovalComment}
        />
      )}

      {activeTab === 'admin' && isAdmin && (
        <AdminRulesPanel />
      )}

      {/* ── Request detail modal ───────────────────── */}
      {selectedRequest && (
        <RequestDetailModal
          request={selectedRequest}
          onClose={() => setSelectedRequest(null)}
          handleStatusChange={handleStatusChange}
          userProfile={userProfile}
        />
      )}
    </div>
  )
}

/* ══════════════════════════════════════════════════════════
   MY LEAVE TAB
   ══════════════════════════════════════════════════════════ */

interface MyLeaveTabProps {
  balance: LeaveBalance | null
  requests: LeaveRequest[]
  filtered: LeaveRequest[]
  statusFilter: FilterStatus
  setStatusFilter: (f: FilterStatus) => void
  statusCounts: Record<string, number>
  showForm: boolean
  handleCreate: (e: React.FormEvent) => void
  cancelForm: () => void
  creating: boolean
  formType: string
  setFormType: (v: string) => void
  formStart: string
  setFormStart: (v: string) => void
  formEnd: string
  setFormEnd: (v: string) => void
  formReason: string
  setFormReason: (v: string) => void
  formHalfDay: boolean
  setFormHalfDay: (v: boolean) => void
  formHalfDayPeriod: 'AM' | 'PM'
  setFormHalfDayPeriod: (v: 'AM' | 'PM') => void
  workingDaysPreview: number | null
  handleStatusChange: (id: string, status: string, comment?: string) => void
  selectedRequest: LeaveRequest | null
  setSelectedRequest: (r: LeaveRequest | null) => void
}

function MyLeaveTab(props: MyLeaveTabProps) {
  const {
    balance, filtered, statusFilter, setStatusFilter, statusCounts,
    showForm, handleCreate, cancelForm, creating,
    formType, setFormType, formStart, setFormStart, formEnd, setFormEnd,
    formReason, setFormReason, formHalfDay, setFormHalfDay,
    formHalfDayPeriod, setFormHalfDayPeriod, workingDaysPreview,
    handleStatusChange, setSelectedRequest, requests,
  } = props

  return (
    <div className="space-y-6">
      {/* ── Balance cards ──────────────────────────── */}
      {balance && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <BalanceCard label="Entitlement" value={balance.allocation} icon={CalendarDays} accent="bg-blue-50 text-blue-600" />
          <BalanceCard label="Taken" value={balance.taken} icon={Check} accent="bg-ink-50 text-ink-500" />
          <BalanceCard label="Approved Future" value={balance.approvedFuture} icon={CheckCircle} accent="bg-cyan-50 text-cyan-600" />
          <BalanceCard label="Pending" value={balance.pending} icon={Clock} accent="bg-amber-50 text-amber-600" />
          <BalanceCard
            label="Remaining"
            value={balance.available}
            icon={CalendarDays}
            accent={balance.available <= 3 ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'}
          />
        </div>
      )}

      {/* ── Enhanced create form ───────────────────── */}
      {showForm && (
        <form onSubmit={handleCreate} className="bg-white rounded-xl border-2 border-accent-200 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-[14px] font-semibold text-ink-900">New leave request</h3>
            <button type="button" onClick={cancelForm} className="text-ink-400 hover:text-ink-600 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Leave type */}
            <div>
              <label htmlFor="leave-type" className="block text-[11px] font-medium text-ink-500 mb-1">Type</label>
              <select
                id="leave-type"
                value={formType}
                onChange={(e) => setFormType(e.target.value)}
                className="w-full px-3 py-2 text-[13px] border border-ink-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-300 bg-white"
              >
                {LEAVE_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>

            {/* Start date */}
            <div>
              <label htmlFor="leave-start" className="block text-[11px] font-medium text-ink-500 mb-1">
                Start date <span className="text-red-400">*</span>
              </label>
              <input
                id="leave-start"
                type="date"
                value={formStart}
                onChange={(e) => { setFormStart(e.target.value); if (!formEnd) setFormEnd(e.target.value) }}
                className="w-full px-3 py-2 text-[13px] border border-ink-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-300"
                required
              />
            </div>

            {/* End date */}
            <div>
              <label htmlFor="leave-end" className="block text-[11px] font-medium text-ink-500 mb-1">
                End date <span className="text-red-400">*</span>
              </label>
              <input
                id="leave-end"
                type="date"
                value={formEnd}
                onChange={(e) => setFormEnd(e.target.value)}
                min={formStart || undefined}
                className="w-full px-3 py-2 text-[13px] border border-ink-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-300"
                required
              />
            </div>

            {/* Half-day toggle */}
            <div>
              <label className="block text-[11px] font-medium text-ink-500 mb-1">Half day</label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setFormHalfDay(!formHalfDay)}
                  className={cn(
                    'relative w-10 h-5 rounded-full transition-colors',
                    formHalfDay ? 'bg-accent-500' : 'bg-ink-200',
                  )}
                >
                  <span className={cn(
                    'absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform',
                    formHalfDay ? 'left-5' : 'left-0.5',
                  )} />
                </button>
                {formHalfDay && (
                  <div className="flex rounded-lg overflow-hidden border border-ink-200">
                    <button
                      type="button"
                      onClick={() => setFormHalfDayPeriod('AM')}
                      className={cn(
                        'flex items-center gap-1 px-2 py-1 text-[11px] font-medium transition-colors',
                        formHalfDayPeriod === 'AM' ? 'bg-accent-100 text-accent-700' : 'text-ink-400 hover:bg-ink-50',
                      )}
                    >
                      <SunMedium className="w-3 h-3" /> AM
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormHalfDayPeriod('PM')}
                      className={cn(
                        'flex items-center gap-1 px-2 py-1 text-[11px] font-medium transition-colors',
                        formHalfDayPeriod === 'PM' ? 'bg-accent-100 text-accent-700' : 'text-ink-400 hover:bg-ink-50',
                      )}
                    >
                      <Moon className="w-3 h-3" /> PM
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Reason */}
          <div>
            <label htmlFor="leave-reason" className="block text-[11px] font-medium text-ink-500 mb-1">Reason (optional)</label>
            <input
              id="leave-reason"
              type="text"
              value={formReason}
              onChange={(e) => setFormReason(e.target.value)}
              placeholder="e.g. Family holiday"
              className="w-full px-3 py-2 text-[13px] border border-ink-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-300 placeholder:text-ink-300"
              maxLength={1000}
            />
          </div>

          {/* Duration preview */}
          {workingDaysPreview !== null && workingDaysPreview > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 rounded-lg">
              <CalendarDays className="w-4 h-4 text-blue-500" />
              <span className="text-[12px] text-blue-700 font-medium">
                {workingDaysPreview} working {workingDaysPreview === 1 || workingDaysPreview === 0.5 ? 'day' : 'days'}
                {formHalfDay && ` (${formHalfDayPeriod} half day)`}
              </span>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-1">
            <button type="button" onClick={cancelForm} className="px-3.5 py-2 text-[12px] font-medium text-ink-500 hover:text-ink-700 transition-colors" disabled={creating}>
              Cancel
            </button>
            <button
              type="submit"
              disabled={creating || !formStart || !formEnd}
              className={cn(
                'flex items-center gap-1.5 px-4 py-2 rounded-lg text-[12px] font-medium transition-colors',
                creating || !formStart || !formEnd
                  ? 'bg-ink-200 text-ink-400 cursor-not-allowed'
                  : 'bg-ink-900 text-white hover:bg-ink-800',
              )}
            >
              {creating && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Create request
            </button>
          </div>
        </form>
      )}

      {/* ── Filter bar ─────────────────────────────── */}
      <div className="flex gap-1 flex-wrap">
        {STATUS_FILTERS.map((f) => {
          const count = f.value === 'ALL'
            ? requests.length
            : f.value === 'ACTIVE'
              ? requests.filter((r) => r.status !== 'WITHDRAWN' && r.status !== 'CANCELLED').length
              : (statusCounts[f.value] || 0)
          if (f.value !== 'ALL' && f.value !== 'ACTIVE' && count === 0) return null
          return (
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
              {count > 0 && <span className={cn('ml-1', statusFilter === f.value ? 'text-ink-300' : 'text-ink-400')}>{count}</span>}
            </button>
          )
        })}
      </div>

      {/* ── Request list ───────────────────────────── */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-ink-100 p-10 text-center">
          <CalendarDays className="w-10 h-10 text-ink-200 mx-auto mb-3" />
          <p className="text-[14px] font-medium text-ink-600">No leave requests</p>
          <p className="text-[12px] text-ink-400 mt-1">Click &ldquo;Request leave&rdquo; to get started.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-ink-100 divide-y divide-ink-50">
          {filtered.map((req) => (
            <div
              key={req.id}
              className="flex items-center gap-4 px-5 py-4 hover:bg-ink-25 cursor-pointer transition-colors"
              onClick={() => setSelectedRequest(req)}
            >
              {/* Type icon */}
              <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                <CalendarDays className="w-4 h-4 text-blue-500" />
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-medium text-ink-900">
                  {getLeaveTypeLabel(req.leaveType)}
                  {req.halfDay && (
                    <span className="ml-1.5 text-[10px] text-ink-400 font-normal">
                      ({req.halfDayPeriod} half day)
                    </span>
                  )}
                </p>
                <p className="text-[11px] text-ink-400 mt-0.5">
                  {formatDateRange(req.startDate, req.endDate)} &middot; {req.days} {req.days === 1 || req.days === 0.5 ? 'day' : 'days'}
                  {req.reason && <span> &middot; {req.reason}</span>}
                </p>
              </div>

              {/* Status */}
              <StatusBadge status={req.status} />

              {/* Quick actions */}
              <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                {req.status === 'DRAFT' && (
                  <>
                    <button
                      onClick={() => handleStatusChange(req.id, 'SUBMITTED')}
                      className="p-1.5 rounded-md text-blue-500 hover:bg-blue-50 transition-colors"
                      title="Submit"
                    >
                      <ArrowRight className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleStatusChange(req.id, 'WITHDRAWN')}
                      className="p-1.5 rounded-md text-ink-300 hover:bg-ink-50 transition-colors"
                      title="Withdraw"
                    >
                      <Ban className="w-4 h-4" />
                    </button>
                  </>
                )}
                {req.status === 'SUBMITTED' && (
                  <button
                    onClick={() => handleStatusChange(req.id, 'WITHDRAWN')}
                    className="p-1.5 rounded-md text-ink-300 hover:bg-ink-50 transition-colors"
                    title="Withdraw"
                  >
                    <Ban className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={() => setSelectedRequest(req)}
                  className="p-1.5 rounded-md text-ink-300 hover:bg-ink-50 transition-colors"
                  title="View details"
                >
                  <Eye className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ══════════════════════════════════════════════════════════
   TEAM CALENDAR TAB
   ══════════════════════════════════════════════════════════ */

interface TeamCalendarTabProps {
  calMonth: number
  calYear: number
  navigateMonth: (dir: -1 | 1) => void
  goToToday: () => void
  calendarGrid: { date: Date; isCurrentMonth: boolean }[][]
  teamLeave: LeaveRequest[]
  teamMembers: TeamMember[]
  teamLoading: boolean
  holidays: CalendarHoliday[]
  deptFilter: string
  setDeptFilter: (v: string) => void
  officeFilter: string
  setOfficeFilter: (v: string) => void
  employeeFilter: string
  setEmployeeFilter: (v: string) => void
  leaveTypeFilter: string
  setLeaveTypeFilter: (v: string) => void
  statusFilter: string
  setStatusFilter: (v: string) => void
}

function TeamCalendarTab(props: TeamCalendarTabProps) {
  const {
    calMonth, calYear, navigateMonth, goToToday, calendarGrid,
    teamLeave, teamMembers, teamLoading, holidays,
    deptFilter, setDeptFilter, officeFilter, setOfficeFilter,
    employeeFilter, setEmployeeFilter, leaveTypeFilter, setLeaveTypeFilter,
    statusFilter, setStatusFilter,
  } = props

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // Extract unique departments from team members for filter dropdowns
  const departments = useMemo(() => {
    const set = new Set<string>()
    teamMembers.forEach((m) => { if (m.department) set.add(m.department) })
    return Array.from(set).sort()
  }, [teamMembers])

  // Extract unique leave types present in current data
  const activeLeaveTypes = useMemo(() => {
    const set = new Set<string>()
    teamLeave.forEach((l) => set.add(l.leaveType))
    return Array.from(set).sort()
  }, [teamLeave])

  // Extract unique statuses present in current data
  const activeStatuses = useMemo(() => {
    const set = new Set<string>()
    teamLeave.forEach((l) => set.add(l.status))
    return Array.from(set).sort()
  }, [teamLeave])

  // Client-side filtered leave (employee, leave type, status)
  const filteredTeamLeave = useMemo(() => {
    let filtered = teamLeave
    if (employeeFilter) {
      filtered = filtered.filter((l) => l.profile.id === employeeFilter)
    }
    if (leaveTypeFilter) {
      filtered = filtered.filter((l) => l.leaveType === leaveTypeFilter)
    }
    if (statusFilter) {
      filtered = filtered.filter((l) => l.status === statusFilter)
    }
    return filtered
  }, [teamLeave, employeeFilter, leaveTypeFilter, statusFilter])

  // Build a holiday date lookup (ISO date string → holiday names)
  const holidayMap = useMemo(() => {
    const map = new Map<string, string[]>()
    for (const h of holidays) {
      const dateKey = new Date(h.date).toISOString().substring(0, 10)
      const existing = map.get(dateKey) || []
      existing.push(h.name)
      map.set(dateKey, existing)
    }
    return map
  }, [holidays])

  // For each calendar day, find who is on leave (using filtered data)
  const getLeaveForDate = useCallback((date: Date): { member: TeamMember; leave: LeaveRequest }[] => {
    const results: { member: TeamMember; leave: LeaveRequest }[] = []
    for (const leave of filteredTeamLeave) {
      if (isDateInLeaveRange(date, leave.startDate, leave.endDate)) {
        const member = teamMembers.find((m) => m.id === leave.profile.id)
        if (member) {
          results.push({ member, leave })
        }
      }
    }
    return results
  }, [filteredTeamLeave, teamMembers])

  if (teamLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 bg-ink-100 animate-pulse rounded" />
        <div className="h-96 bg-ink-100 animate-pulse rounded-xl" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Month navigation + filters */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-[16px] font-semibold text-ink-900">
          {MONTH_NAMES[calMonth]} {calYear}
        </h2>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Department filter */}
          {departments.length > 0 && (
            <select
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
              className="px-2 py-1.5 text-[11px] border border-ink-200 rounded-lg bg-white"
            >
              <option value="">All departments</option>
              {departments.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          )}
          {/* Office filter — uses data from team members */}
          <select
            value={officeFilter}
            onChange={(e) => setOfficeFilter(e.target.value)}
            className="px-2 py-1.5 text-[11px] border border-ink-200 rounded-lg bg-white"
          >
            <option value="">All offices</option>
            {/* Unique offices from members */}
          </select>

          {/* Employee filter */}
          {teamMembers.length > 0 && (
            <select
              value={employeeFilter}
              onChange={(e) => setEmployeeFilter(e.target.value)}
              className="px-2 py-1.5 text-[11px] border border-ink-200 rounded-lg bg-white"
            >
              <option value="">All employees</option>
              {teamMembers.map((m) => <option key={m.id} value={m.id}>{m.fullName}</option>)}
            </select>
          )}

          {/* Leave Type filter */}
          <select
            value={leaveTypeFilter}
            onChange={(e) => setLeaveTypeFilter(e.target.value)}
            className="px-2 py-1.5 text-[11px] border border-ink-200 rounded-lg bg-white"
          >
            <option value="">All leave types</option>
            {activeLeaveTypes.map((t) => (
              <option key={t} value={t}>{getLeaveTypeLabel(t)}</option>
            ))}
          </select>

          {/* Status filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-2 py-1.5 text-[11px] border border-ink-200 rounded-lg bg-white"
          >
            <option value="">All statuses</option>
            {activeStatuses.map((s) => (
              <option key={s} value={s}>{STATUS_META[s]?.label || s}</option>
            ))}
          </select>

          <div className="flex items-center gap-1">
            <button
              onClick={() => navigateMonth(-1)}
              className="p-2 rounded-lg hover:bg-ink-50 transition-colors"
            >
              <ChevronLeft className="w-4 h-4 text-ink-500" />
            </button>
            <button
              onClick={goToToday}
              className="px-3 py-1.5 rounded-lg text-[11px] font-medium text-ink-500 hover:bg-ink-50 transition-colors"
            >
              Today
            </button>
            <button
              onClick={() => navigateMonth(1)}
              className="p-2 rounded-lg hover:bg-ink-50 transition-colors"
            >
              <ChevronRight className="w-4 h-4 text-ink-500" />
            </button>
          </div>
        </div>
      </div>

      {/* Calendar grid */}
      <div className="bg-white rounded-xl border border-ink-100 overflow-hidden">
        {/* Header */}
        <div className="grid grid-cols-7 border-b border-ink-100">
          {DAY_HEADERS.map((d) => (
            <div key={d} className="px-2 py-2 text-[10px] font-semibold text-ink-400 text-center uppercase tracking-wider">
              {d}
            </div>
          ))}
        </div>

        {/* Weeks */}
        {calendarGrid.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7 border-b border-ink-50 last:border-b-0">
            {week.map((cell, di) => {
              const isToday = cell.date.getTime() === today.getTime()
              const isWeekend = cell.date.getDay() === 0 || cell.date.getDay() === 6
              const dateKey = cell.date.toISOString().substring(0, 10)
              const holidayNames = cell.isCurrentMonth ? (holidayMap.get(dateKey) || []) : []
              const isHoliday = holidayNames.length > 0
              const leaveOnDay = cell.isCurrentMonth && !isWeekend && !isHoliday ? getLeaveForDate(cell.date) : []

              return (
                <div
                  key={di}
                  className={cn(
                    'min-h-[72px] p-1 border-r border-ink-50 last:border-r-0',
                    !cell.isCurrentMonth && 'bg-ink-25',
                    isWeekend && cell.isCurrentMonth && 'bg-ink-25/50',
                    isHoliday && 'bg-slate-100',
                  )}
                >
                  <div className={cn(
                    'text-[11px] font-medium mb-0.5 w-6 h-6 flex items-center justify-center rounded-full',
                    isToday ? 'bg-ink-900 text-white' : '',
                    !cell.isCurrentMonth ? 'text-ink-200' : 'text-ink-600',
                  )}>
                    {cell.date.getDate()}
                  </div>

                  {/* Public holiday indicator */}
                  {isHoliday && (
                    <div className="rounded px-1 py-0.5 text-[9px] font-medium text-slate-600 bg-slate-200 truncate mb-0.5"
                         title={holidayNames.join(', ')}>
                      {holidayNames[0]}
                    </div>
                  )}

                  {/* Leave indicators — colored by leave type, employee name inside */}
                  <div className="space-y-0.5">
                    {leaveOnDay.slice(0, 3).map(({ member, leave }, li) => {
                      const ltColor = getLeaveTypeColor(leave.leaveType)
                      return (
                        <div
                          key={`${member.id}-${leave.id}-${li}`}
                          className={cn(
                            'rounded px-1 py-0.5 text-[9px] font-medium truncate',
                            ltColor.bg, ltColor.text,
                          )}
                          title={`${member.fullName} - ${getLeaveTypeLabel(leave.leaveType)} (${STATUS_META[leave.status]?.label || leave.status})`}
                        >
                          {member.fullName.split(' ')[0]}
                        </div>
                      )
                    })}
                    {leaveOnDay.length > 3 && (
                      <div className="text-[9px] text-ink-400 px-1">
                        +{leaveOnDay.length - 3} more
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        ))}
      </div>

      {/* Legend — leave types only */}
      <div className="flex flex-wrap gap-3 items-center">
        {Object.entries(LEAVE_TYPE_COLORS)
          .filter(([key]) => key !== 'OTHER' && key !== 'PUBLIC_HOLIDAY')
          .map(([key, val]) => (
          <div key={key} className="flex items-center gap-1.5">
            <div className={cn('w-3 h-3 rounded', val.bg)} />
            <span className="text-[11px] text-ink-500">{val.label}</span>
          </div>
        ))}
        {holidays.length > 0 && (
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-slate-200" />
            <span className="text-[11px] text-ink-500">Public holiday</span>
          </div>
        )}
      </div>

      {teamMembers.length === 0 && (
        <div className="bg-white rounded-xl border border-ink-100 p-10 text-center">
          <Users className="w-10 h-10 text-ink-200 mx-auto mb-3" />
          <p className="text-[14px] font-medium text-ink-600">No team members</p>
          <p className="text-[12px] text-ink-400 mt-1">Team members will appear here once they are assigned to you.</p>
        </div>
      )}
    </div>
  )
}

/* ══════════════════════════════════════════════════════════
   APPROVALS TAB
   ══════════════════════════════════════════════════════════ */

interface ApprovalsTabProps {
  approvalRequests: LeaveRequest[]
  approvalsLoading: boolean
  handleStatusChange: (id: string, status: string, comment?: string) => void
  approvalComment: string
  setApprovalComment: (v: string) => void
}

function ApprovalsTab(props: ApprovalsTabProps) {
  const { approvalRequests, approvalsLoading, handleStatusChange } = props
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [comments, setComments] = useState<Record<string, string>>({})
  const [actionBusy, setActionBusy] = useState<string | null>(null)
  const [approvalInstances, setApprovalInstances] = useState<Record<string, ApprovalInstanceData>>({})

  // Fetch approval engine instances for expanded requests
  const fetchApprovalInstance = useCallback(async (leaveRequestId: string) => {
    try {
      const res = await fetch(`/api/approvals?entityId=${leaveRequestId}`)
      if (!res.ok) return
      const json = await res.json()
      const approvals = json.data?.approvals ?? []
      if (approvals.length > 0) {
        // Fetch full detail for the first matching instance
        const detailRes = await fetch(`/api/approvals/${approvals[0].instanceId}`)
        if (detailRes.ok) {
          const detail = await detailRes.json()
          const approval = detail.data?.approval
          if (approval) {
            setApprovalInstances((prev) => ({ ...prev, [leaveRequestId]: approval }))
          }
        }
      }
    } catch {
      // Non-critical — just no workflow stepper shown
    }
  }, [])

  useEffect(() => {
    if (expandedId) {
      fetchApprovalInstance(expandedId)
    }
  }, [expandedId, fetchApprovalInstance])

  function getComment(id: string) { return comments[id] ?? '' }
  function setComment(id: string, val: string) { setComments((prev) => ({ ...prev, [id]: val })) }

  async function doAction(reqId: string, status: string) {
    setActionBusy(reqId)
    const comment = getComment(reqId) || undefined
    await handleStatusChange(reqId, status, comment)
    setComment(reqId, '')
    setActionBusy(null)
  }

  if (approvalsLoading) {
    return (
      <div className="bg-white rounded-xl border border-ink-100 divide-y divide-ink-50">
        {Array.from({ length: 3 }).map((_, i) => <SkeletonRow key={i} />)}
      </div>
    )
  }

  if (approvalRequests.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-ink-100 p-10 text-center">
        <ShieldCheck className="w-10 h-10 text-ink-200 mx-auto mb-3" />
        <p className="text-[14px] font-medium text-ink-600">No pending approvals</p>
        <p className="text-[12px] text-ink-400 mt-1">Leave requests requiring your approval will appear here.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <h2 className="text-[16px] font-semibold text-ink-900">
        Pending approvals ({approvalRequests.length})
      </h2>

      <div className="space-y-3">
        {approvalRequests.map((req) => {
          const isExpanded = expandedId === req.id
          const isBusy = actionBusy === req.id
          const instance = approvalInstances[req.id]

          // Determine which approval action is appropriate
          const nextApprovalStatus = req.status === 'SUBMITTED'
            ? 'LINE_MANAGER_APPROVED'
            : req.status === 'LINE_MANAGER_APPROVED'
              ? 'HR_APPROVED'
              : 'APPROVED'
          const nextApprovalLabel = req.status === 'SUBMITTED'
            ? 'Approve (Line Manager)'
            : req.status === 'LINE_MANAGER_APPROVED'
              ? 'Approve (HR)'
              : 'Final Approve'

          // Derive the current approval stage label
          const approvalStageLabel = req.status === 'SUBMITTED'
            ? 'Awaiting Line Manager'
            : req.status === 'LINE_MANAGER_APPROVED'
              ? 'Awaiting HR'
              : req.status === 'HR_APPROVED'
                ? 'Awaiting Final'
                : null

          // Is this pending action from the viewer?
          const needsAction = ['SUBMITTED', 'LINE_MANAGER_APPROVED', 'HR_APPROVED'].includes(req.status)

          return (
            <div key={req.id} className="bg-white rounded-xl border border-ink-100 overflow-hidden">
              {/* Summary row */}
              <div
                className="flex items-center gap-4 px-5 py-4 cursor-pointer hover:bg-ink-25 transition-colors"
                onClick={() => setExpandedId(isExpanded ? null : req.id)}
              >
                <div className="relative w-9 h-9 rounded-full bg-blue-50 flex items-center justify-center shrink-0 text-[12px] font-semibold text-blue-600">
                  {req.profile.fullName.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                  {needsAction && (
                    <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-red-500 border-2 border-white" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-[13px] font-medium text-ink-900">{req.profile.fullName}</p>
                    {needsAction && (
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-red-50 text-red-600 whitespace-nowrap">
                        Action Required
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-ink-400 mt-0.5">
                    {getLeaveTypeLabel(req.leaveType)} &middot; {formatDateRange(req.startDate, req.endDate)} &middot; {req.days} {req.days === 1 || req.days === 0.5 ? 'day' : 'days'}
                  </p>
                </div>

                {/* Approval stage indicator */}
                {approvalStageLabel && (
                  <span className="text-[10px] font-medium px-2 py-1 rounded-full bg-blue-50 text-blue-600 whitespace-nowrap hidden sm:inline-flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {approvalStageLabel}
                  </span>
                )}

                <StatusBadge status={req.status} />

                <ChevronRight className={cn('w-4 h-4 text-ink-300 transition-transform', isExpanded && 'rotate-90')} />
              </div>

              {/* Expanded detail */}
              {isExpanded && (
                <div className="border-t border-ink-100 px-5 py-4 space-y-4 bg-ink-25/50">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-[12px]">
                    <div>
                      <p className="text-ink-400 mb-0.5">Employee</p>
                      <p className="text-ink-900 font-medium">{req.profile.fullName}</p>
                      {req.profile.jobTitle && (
                        <p className="text-ink-400 text-[11px]">{req.profile.jobTitle}</p>
                      )}
                    </div>
                    <div>
                      <p className="text-ink-400 mb-0.5">Type</p>
                      <p className="text-ink-900 font-medium">{getLeaveTypeLabel(req.leaveType)}</p>
                    </div>
                    <div>
                      <p className="text-ink-400 mb-0.5">Dates</p>
                      <p className="text-ink-900 font-medium">{formatDateRange(req.startDate, req.endDate)}</p>
                    </div>
                    <div>
                      <p className="text-ink-400 mb-0.5">Duration</p>
                      <p className="text-ink-900 font-medium">
                        {req.days} {req.days === 1 || req.days === 0.5 ? 'day' : 'days'}
                        {req.halfDay && ` (${req.halfDayPeriod})`}
                      </p>
                    </div>
                  </div>

                  {req.reason && (
                    <div className="text-[12px]">
                      <p className="text-ink-400 mb-0.5">Reason</p>
                      <p className="text-ink-700">{req.reason}</p>
                    </div>
                  )}

                  {req.approvalComment && (
                    <div className="text-[12px]">
                      <p className="text-ink-400 mb-0.5">Previous comment</p>
                      <p className="text-ink-700 italic">{req.approvalComment}</p>
                    </div>
                  )}

                  {/* Approval Workflow Stepper with audit trail */}
                  {instance && instance.steps && instance.steps.length > 0 && (
                    <div className="border border-surface-200 rounded-lg p-3 bg-white">
                      <p className="text-[11px] font-medium text-ink-500 mb-3">
                        Approval Workflow{instance.route?.name ? `: ${instance.route.name}` : ''}
                      </p>
                      <div className="space-y-0">
                        {instance.steps.map((step: ApprovalStepData, idx: number) => {
                          const isActive = step.status === 'PENDING'
                          const isDone = step.status === 'APPROVED'
                          const isRejected = step.status === 'REJECTED'
                          const isSkipped = step.status === 'SKIPPED'
                          const isActioned = isDone || isRejected || isSkipped
                          return (
                            <div key={step.id}>
                              {/* Connector line */}
                              {idx > 0 && (
                                <div className="flex ml-[15px]">
                                  <div className={cn('w-px h-3', isDone ? 'bg-emerald-300' : isRejected ? 'bg-red-300' : 'bg-ink-200')} />
                                </div>
                              )}
                              {/* Step row */}
                              <div className="flex items-start gap-2.5">
                                {/* Status icon */}
                                <div className={cn(
                                  'w-8 h-8 rounded-full flex items-center justify-center shrink-0',
                                  isDone && 'bg-emerald-100 text-emerald-600',
                                  isRejected && 'bg-red-100 text-red-600',
                                  isActive && 'bg-blue-100 text-blue-600',
                                  isSkipped && 'bg-ink-100 text-ink-400',
                                  !isDone && !isRejected && !isActive && !isSkipped && 'bg-ink-50 text-ink-300',
                                )}>
                                  {isDone && <CheckCircle className="w-4 h-4" />}
                                  {isRejected && <XCircle className="w-4 h-4" />}
                                  {isActive && <Clock className="w-4 h-4" />}
                                  {isSkipped && <Ban className="w-3.5 h-3.5" />}
                                  {!isDone && !isRejected && !isActive && !isSkipped && (
                                    <span className="text-[10px] font-medium">{idx + 1}</span>
                                  )}
                                </div>
                                {/* Step content */}
                                <div className="flex-1 min-w-0 pb-1">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className={cn(
                                      'text-[12px] font-medium',
                                      isDone && 'text-emerald-700',
                                      isRejected && 'text-red-700',
                                      isActive && 'text-blue-700',
                                      isSkipped && 'text-ink-400 line-through',
                                      !isDone && !isRejected && !isActive && !isSkipped && 'text-ink-400',
                                    )}>
                                      {step.label || `Step ${step.stepOrder}`}
                                    </span>
                                    {step.approver?.fullName && (
                                      <span className="text-[10px] text-ink-400">({step.approver.fullName})</span>
                                    )}
                                  </div>
                                  {/* Timestamp for actioned steps */}
                                  {isActioned && step.actionedAt && (
                                    <p className="text-[10px] text-ink-400 mt-0.5">
                                      {isDone ? 'Approved' : isRejected ? 'Rejected' : 'Skipped'}{' '}
                                      {new Date(step.actionedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}{' '}
                                      at {new Date(step.actionedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                                    </p>
                                  )}
                                  {/* Per-step comment */}
                                  {step.comment && (
                                    <div className="mt-1 flex items-start gap-1">
                                      <MessageSquare className="w-3 h-3 text-ink-300 mt-0.5 shrink-0" />
                                      <p className="text-[11px] text-ink-500 italic">{step.comment}</p>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* Comment field */}
                  <div>
                    <label className="block text-[11px] font-medium text-ink-500 mb-1">
                      Comment (optional — required for Request Info)
                    </label>
                    <textarea
                      value={getComment(req.id)}
                      onChange={(e) => setComment(req.id, e.target.value)}
                      placeholder="Add a comment or reason..."
                      rows={2}
                      className="w-full px-3 py-2 text-[12px] border border-ink-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-300 placeholder:text-ink-300 resize-none"
                      maxLength={1000}
                    />
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      onClick={() => doAction(req.id, nextApprovalStatus)}
                      disabled={isBusy}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 text-white text-[12px] font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50"
                    >
                      {isBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                      {nextApprovalLabel}
                    </button>
                    <button
                      onClick={() => doAction(req.id, 'UNDER_REVIEW')}
                      disabled={isBusy || !getComment(req.id).trim()}
                      title={!getComment(req.id).trim() ? 'A comment is required when requesting info' : undefined}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-amber-500 text-white text-[12px] font-medium hover:bg-amber-600 transition-colors disabled:opacity-50"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      Request Info
                    </button>
                    <button
                      onClick={() => doAction(req.id, 'REJECTED')}
                      disabled={isBusy}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-red-600 text-white text-[12px] font-medium hover:bg-red-700 transition-colors disabled:opacity-50"
                    >
                      <X className="w-3.5 h-3.5" />
                      Reject
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// Type for approval instance data fetched from API
interface ApprovalStepData {
  id: string
  stepOrder: number
  label: string | null
  status: string
  comment: string | null
  actionedAt: string | null
  approver: { id: string; fullName: string } | null
  escalatedTo: { id: string; fullName: string } | null
}

interface ApprovalInstanceData {
  id: string
  status: string
  steps: ApprovalStepData[]
  route: { id: string; name: string; requestType: string } | null
  submitter: { id: string; fullName: string; email: string } | null
}

/* ══════════════════════════════════════════════════════════
   ADMIN RULES PANEL
   ══════════════════════════════════════════════════════════ */

function AdminRulesPanel() {
  const { toast } = useToast()
  const [defaultEntitlement, setDefaultEntitlement] = useState(25)

  // Blackout dates state
  const [blackoutDates, setBlackoutDates] = useState<BlackoutDate[]>([])
  const [blackoutLoading, setBlackoutLoading] = useState(true)
  const [showBlackoutForm, setShowBlackoutForm] = useState(false)
  const [boName, setBoName] = useState('')
  const [boStart, setBoStart] = useState('')
  const [boEnd, setBoEnd] = useState('')
  const [boReason, setBoReason] = useState('')
  const [boSaving, setBoSaving] = useState(false)
  const [boDeleting, setBoDeleting] = useState<string | null>(null)

  // Individual allowance editing state
  const [allowanceMembers, setAllowanceMembers] = useState<{ id: string; fullName: string; jobTitle: string | null; leaveAllocation: number }[]>([])
  const [allowanceLoading, setAllowanceLoading] = useState(true)
  const [editingAllowance, setEditingAllowance] = useState<string | null>(null)
  const [editAllowanceValue, setEditAllowanceValue] = useState(25)
  const [allowanceSaving, setAllowanceSaving] = useState(false)

  // Fetch blackout dates
  const fetchBlackoutDates = useCallback(async () => {
    setBlackoutLoading(true)
    try {
      const res = await fetch('/api/blackout-dates')
      if (res.ok) {
        const json = await res.json()
        setBlackoutDates(json.data.blackoutDates || [])
      }
    } catch {
      // Silently fail
    } finally {
      setBlackoutLoading(false)
    }
  }, [])

  // Fetch org members for allowance editing
  const fetchAllowanceMembers = useCallback(async () => {
    setAllowanceLoading(true)
    try {
      const res = await fetch('/api/staffing')
      if (res.ok) {
        const json = await res.json()
        // staffing API returns employees with leaveAllocation at top level (via mapStaffingEmployee)
        const employees = json.data.employees || []
        const members = employees.map((e: { id: string; fullName: string; jobTitle: string | null; leaveAllocation?: number }) => ({
          id: e.id,
          fullName: e.fullName,
          jobTitle: e.jobTitle,
          leaveAllocation: e.leaveAllocation ?? 25,
        }))
        setAllowanceMembers(members)
      }
    } catch {
      // Silently fail
    } finally {
      setAllowanceLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchBlackoutDates()
    fetchAllowanceMembers()
  }, [fetchBlackoutDates, fetchAllowanceMembers])

  // Create blackout date
  const handleCreateBlackout = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!boName || !boStart || !boEnd) return
    setBoSaving(true)
    try {
      const res = await fetch('/api/blackout-dates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: boName, startDate: boStart, endDate: boEnd, reason: boReason || undefined }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error?.message || 'Failed to create blackout date')
      }
      toast('Blackout date created', 'success')
      setShowBlackoutForm(false)
      setBoName('')
      setBoStart('')
      setBoEnd('')
      setBoReason('')
      fetchBlackoutDates()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to create', 'error')
    } finally {
      setBoSaving(false)
    }
  }

  // Delete blackout date
  const handleDeleteBlackout = async (id: string) => {
    setBoDeleting(id)
    try {
      const res = await fetch(`/api/blackout-dates/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error?.message || 'Failed to delete')
      }
      toast('Blackout date removed', 'success')
      fetchBlackoutDates()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to delete', 'error')
    } finally {
      setBoDeleting(null)
    }
  }

  // Save individual allowance
  const handleSaveAllowance = async (profileId: string) => {
    setAllowanceSaving(true)
    try {
      const res = await fetch(`/api/staffing/employees/${profileId}/profile`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ annualLeaveAllocation: editAllowanceValue }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error?.message || 'Failed to update allocation')
      }
      toast('Leave allocation updated', 'success')
      setEditingAllowance(null)
      fetchAllowanceMembers()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to update', 'error')
    } finally {
      setAllowanceSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <h2 className="text-[16px] font-semibold text-ink-900">Leave Administration</h2>

      {/* Default entitlement */}
      <div className="bg-white rounded-xl border border-ink-100 p-5 space-y-4">
        <h3 className="text-[14px] font-semibold text-ink-900">Default Annual Entitlement</h3>
        <p className="text-[12px] text-ink-400">
          Set the default annual leave allocation for new employees. Individual allocations can be overridden below.
        </p>
        <div className="flex items-center gap-3">
          <input
            type="number"
            value={defaultEntitlement}
            onChange={(e) => setDefaultEntitlement(Number(e.target.value))}
            min={0}
            max={50}
            className="w-20 px-3 py-2 text-[13px] border border-ink-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-300 text-center"
          />
          <span className="text-[12px] text-ink-500">days per year</span>
        </div>
      </div>

      {/* Individual leave allowances */}
      <div className="bg-white rounded-xl border border-ink-100 p-5 space-y-4">
        <h3 className="text-[14px] font-semibold text-ink-900">Individual Leave Allowances</h3>
        <p className="text-[12px] text-ink-400">
          Override the default allocation for individual employees. Changes take effect immediately.
        </p>
        {allowanceLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-10 bg-ink-50 animate-pulse rounded-lg" />
            ))}
          </div>
        ) : allowanceMembers.length === 0 ? (
          <div className="bg-ink-25 rounded-lg p-6 text-center">
            <Users className="w-8 h-8 text-ink-200 mx-auto mb-2" />
            <p className="text-[12px] text-ink-400">No employees found</p>
          </div>
        ) : (
          <div className="divide-y divide-ink-50 max-h-[320px] overflow-y-auto">
            {allowanceMembers.map((member) => (
              <div key={member.id} className="flex items-center justify-between py-2.5 px-1 gap-3">
                <div className="min-w-0">
                  <p className="text-[13px] font-medium text-ink-900 truncate">{member.fullName}</p>
                  {member.jobTitle && (
                    <p className="text-[11px] text-ink-400 truncate">{member.jobTitle}</p>
                  )}
                </div>
                {editingAllowance === member.id ? (
                  <div className="flex items-center gap-2 shrink-0">
                    <input
                      type="number"
                      value={editAllowanceValue}
                      onChange={(e) => setEditAllowanceValue(Number(e.target.value))}
                      min={0}
                      max={365}
                      className="w-16 px-2 py-1 text-[12px] border border-ink-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-300 text-center"
                      autoFocus
                    />
                    <button
                      onClick={() => handleSaveAllowance(member.id)}
                      disabled={allowanceSaving}
                      className="p-1 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-colors disabled:opacity-50"
                    >
                      {allowanceSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                    </button>
                    <button
                      onClick={() => setEditingAllowance(null)}
                      className="p-1 rounded-lg bg-ink-50 text-ink-400 hover:bg-ink-100 transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      setEditingAllowance(member.id)
                      setEditAllowanceValue(member.leaveAllocation)
                    }}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-ink-50 text-ink-600 text-[12px] font-medium hover:bg-ink-100 transition-colors shrink-0"
                  >
                    {member.leaveAllocation} days
                    <Settings className="w-3 h-3 text-ink-400" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Approval chain configuration */}
      <div className="bg-white rounded-xl border border-ink-100 p-5 space-y-4">
        <h3 className="text-[14px] font-semibold text-ink-900">Approval Chain</h3>
        <p className="text-[12px] text-ink-400">
          Leave requests follow a multi-stage approval workflow. All stages must be completed before leave is formally approved.
        </p>
        <div className="flex items-center gap-2 flex-wrap">
          {['Requester submits', 'Line Manager', 'HR Review', 'Approved'].map((step, i) => (
            <div key={step} className="flex items-center gap-2">
              <div className={cn(
                'px-3 py-1.5 rounded-lg text-[11px] font-medium',
                i === 3 ? 'bg-emerald-50 text-emerald-600' : 'bg-ink-100 text-ink-600',
              )}>
                {step}
              </div>
              {i < 3 && <ArrowRight className="w-3 h-3 text-ink-300" />}
            </div>
          ))}
        </div>
      </div>

      {/* Blackout dates */}
      <div className="bg-white rounded-xl border border-ink-100 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-[14px] font-semibold text-ink-900">Blackout Dates</h3>
            <p className="text-[12px] text-ink-400 mt-0.5">
              Periods when leave cannot be requested. Useful for project deadlines, audits, or peak periods.
            </p>
          </div>
          <button
            onClick={() => setShowBlackoutForm(!showBlackoutForm)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-ink-900 text-white text-[11px] font-medium hover:bg-ink-800 transition-colors"
          >
            {showBlackoutForm ? <X className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
            {showBlackoutForm ? 'Cancel' : 'Add blackout'}
          </button>
        </div>

        {/* Create form */}
        {showBlackoutForm && (
          <form onSubmit={handleCreateBlackout} className="bg-ink-25 rounded-lg p-4 space-y-3">
            <div>
              <label className="block text-[11px] font-medium text-ink-600 mb-1">Name</label>
              <input
                type="text"
                value={boName}
                onChange={(e) => setBoName(e.target.value)}
                placeholder="e.g. Year-end close"
                required
                className="w-full px-3 py-2 text-[13px] border border-ink-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-300"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-medium text-ink-600 mb-1">Start date</label>
                <input
                  type="date"
                  value={boStart}
                  onChange={(e) => setBoStart(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-[13px] border border-ink-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-300"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-ink-600 mb-1">End date</label>
                <input
                  type="date"
                  value={boEnd}
                  onChange={(e) => setBoEnd(e.target.value)}
                  required
                  min={boStart || undefined}
                  className="w-full px-3 py-2 text-[13px] border border-ink-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-300"
                />
              </div>
            </div>
            <div>
              <label className="block text-[11px] font-medium text-ink-600 mb-1">Reason (optional)</label>
              <input
                type="text"
                value={boReason}
                onChange={(e) => setBoReason(e.target.value)}
                placeholder="e.g. Regulatory audit period"
                className="w-full px-3 py-2 text-[13px] border border-ink-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-300"
              />
            </div>
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={boSaving || !boName || !boStart || !boEnd}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-ink-900 text-white text-[12px] font-medium hover:bg-ink-800 transition-colors disabled:opacity-50"
              >
                {boSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                Create blackout date
              </button>
            </div>
          </form>
        )}

        {/* Blackout dates list */}
        {blackoutLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="h-12 bg-ink-50 animate-pulse rounded-lg" />
            ))}
          </div>
        ) : blackoutDates.length === 0 ? (
          <div className="bg-ink-25 rounded-lg p-6 text-center">
            <Ban className="w-8 h-8 text-ink-200 mx-auto mb-2" />
            <p className="text-[12px] text-ink-400">No blackout dates configured</p>
          </div>
        ) : (
          <div className="divide-y divide-ink-50">
            {blackoutDates.map((bd) => (
              <div key={bd.id} className="flex items-center justify-between py-3 px-1 gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Ban className="w-3.5 h-3.5 text-red-400 shrink-0" />
                    <p className="text-[13px] font-medium text-ink-900 truncate">{bd.name}</p>
                  </div>
                  <p className="text-[11px] text-ink-400 mt-0.5 ml-[22px]">
                    {formatDate(bd.startDate)} – {formatDate(bd.endDate)}
                    {bd.reason && <span className="ml-2 text-ink-300">· {bd.reason}</span>}
                  </p>
                </div>
                <button
                  onClick={() => handleDeleteBlackout(bd.id)}
                  disabled={boDeleting === bd.id}
                  className="p-1.5 rounded-lg text-ink-300 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50 shrink-0"
                  title="Remove blackout date"
                >
                  {boDeleting === bd.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Leave types configuration */}
      <div className="bg-white rounded-xl border border-ink-100 p-5 space-y-4">
        <h3 className="text-[14px] font-semibold text-ink-900">Active Leave Types</h3>
        <p className="text-[12px] text-ink-400">
          All {LEAVE_TYPES.length} absence types are active. Contact support to customise which types are available.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
          {LEAVE_TYPES.map((t) => (
            <div key={t.value} className="flex items-center gap-2 px-3 py-2 bg-ink-25 rounded-lg">
              <div className="w-2 h-2 rounded-full bg-emerald-400" />
              <span className="text-[11px] text-ink-600 font-medium">{t.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════
   REQUEST DETAIL MODAL
   ══════════════════════════════════════════════════════════ */

interface RequestDetailModalProps {
  request: LeaveRequest
  onClose: () => void
  handleStatusChange: (id: string, status: string, comment?: string) => void
  userProfile: UserProfile | null
}

function RequestDetailModal({ request, onClose, handleStatusChange, userProfile }: RequestDetailModalProps) {
  const [comment, setComment] = useState('')
  const stepIndex = getApprovalStepIndex(request.status)
  const isOwner = userProfile?.id === request.profile.id
  const isTerminal = ['REJECTED', 'CANCELLED', 'WITHDRAWN', 'APPROVED'].includes(request.status)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-ink-100">
          <h2 className="text-[16px] font-semibold text-ink-900">Leave Request</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-ink-50 transition-colors">
            <X className="w-4 h-4 text-ink-400" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Status + type */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[15px] font-semibold text-ink-900">{getLeaveTypeLabel(request.leaveType)}</p>
              {request.halfDay && (
                <p className="text-[11px] text-ink-400 mt-0.5">{request.halfDayPeriod} half day</p>
              )}
            </div>
            <StatusBadge status={request.status} />
          </div>

          {/* Detail grid */}
          <div className="grid grid-cols-2 gap-4 text-[12px]">
            <div>
              <p className="text-ink-400 mb-0.5">Start date</p>
              <p className="text-ink-900 font-medium">{formatDate(request.startDate)}</p>
            </div>
            <div>
              <p className="text-ink-400 mb-0.5">End date</p>
              <p className="text-ink-900 font-medium">{formatDate(request.endDate)}</p>
            </div>
            <div>
              <p className="text-ink-400 mb-0.5">Duration</p>
              <p className="text-ink-900 font-medium">{request.days} working {request.days === 1 || request.days === 0.5 ? 'day' : 'days'}</p>
            </div>
            <div>
              <p className="text-ink-400 mb-0.5">Submitted</p>
              <p className="text-ink-900 font-medium">{formatDate(request.createdAt)}</p>
            </div>
            {request.approver && (
              <div>
                <p className="text-ink-400 mb-0.5">Approver</p>
                <p className="text-ink-900 font-medium">{request.approver.fullName}</p>
              </div>
            )}
            {request.approvedAt && (
              <div>
                <p className="text-ink-400 mb-0.5">Actioned</p>
                <p className="text-ink-900 font-medium">{formatDate(request.approvedAt)}</p>
              </div>
            )}
          </div>

          {request.reason && (
            <div className="text-[12px]">
              <p className="text-ink-400 mb-0.5">Reason</p>
              <p className="text-ink-700 bg-ink-25 rounded-lg px-3 py-2">{request.reason}</p>
            </div>
          )}

          {request.approvalComment && (
            <div className="text-[12px]">
              <p className="text-ink-400 mb-0.5 flex items-center gap-1">
                <MessageSquare className="w-3 h-3" /> Approver comment
              </p>
              <p className="text-ink-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                {request.approvalComment}
              </p>
            </div>
          )}

          {/* Approval chain progress */}
          <div>
            <p className="text-[11px] font-medium text-ink-500 mb-3">Approval chain</p>
            <div className="flex items-center gap-0">
              {APPROVAL_CHAIN_STEPS.map((step, i) => {
                const isCompleted = stepIndex >= i
                const isCurrent = stepIndex === i
                const isRejected = request.status === 'REJECTED'
                const isCancelled = request.status === 'CANCELLED'

                return (
                  <div key={step.key} className="flex items-center flex-1">
                    <div className="flex flex-col items-center flex-1">
                      <div className={cn(
                        'w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-semibold',
                        isCompleted && !isRejected && !isCancelled
                          ? 'bg-emerald-500 text-white'
                          : isRejected && isCurrent
                            ? 'bg-red-500 text-white'
                            : isCancelled && isCurrent
                              ? 'bg-orange-500 text-white'
                              : 'bg-ink-100 text-ink-400',
                      )}>
                        {isCompleted && !isRejected && !isCancelled ? (
                          <Check className="w-3.5 h-3.5" />
                        ) : isRejected && isCurrent ? (
                          <X className="w-3.5 h-3.5" />
                        ) : (
                          i + 1
                        )}
                      </div>
                      <p className={cn(
                        'text-[9px] mt-1 text-center leading-tight',
                        isCompleted ? 'text-ink-600 font-medium' : 'text-ink-300',
                      )}>
                        {step.label}
                        {isCompleted && request.approver && step.key === request.status && (
                          <>
                            <br />
                            <span className="text-ink-400 font-normal">{request.approver.fullName}</span>
                          </>
                        )}
                      </p>
                    </div>
                    {i < APPROVAL_CHAIN_STEPS.length - 1 && (
                      <div className={cn(
                        'h-0.5 flex-1 -mx-1',
                        stepIndex > i ? 'bg-emerald-300' : 'bg-ink-100',
                      )} />
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Actions for owner */}
          {isOwner && !isTerminal && (
            <div className="border-t border-ink-100 pt-4 space-y-3">
              {request.status === 'DRAFT' && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleStatusChange(request.id, 'SUBMITTED')}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 text-white text-[12px] font-medium hover:bg-blue-700 transition-colors"
                  >
                    <ArrowRight className="w-3.5 h-3.5" /> Submit for approval
                  </button>
                  <button
                    onClick={() => handleStatusChange(request.id, 'WITHDRAWN')}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-ink-100 text-ink-600 text-[12px] font-medium hover:bg-ink-200 transition-colors"
                  >
                    <Ban className="w-3.5 h-3.5" /> Withdraw
                  </button>
                </div>
              )}
              {request.status === 'SUBMITTED' && (
                <button
                  onClick={() => handleStatusChange(request.id, 'WITHDRAWN')}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-ink-100 text-ink-600 text-[12px] font-medium hover:bg-ink-200 transition-colors"
                >
                  <Ban className="w-3.5 h-3.5" /> Withdraw request
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/* ── Balance card ────────────────────────────────────── */

function BalanceCard({ label, value, icon: Icon, accent }: {
  label: string; value: number; icon: React.FC<{ className?: string }>; accent: string
}) {
  return (
    <div className="bg-white rounded-xl border border-ink-100 p-5 flex items-start gap-4">
      <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center shrink-0', accent)}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-[28px] font-semibold text-ink-900 leading-tight">{value}</p>
        <p className="text-[12px] text-ink-400 mt-0.5">{label}</p>
      </div>
    </div>
  )
}

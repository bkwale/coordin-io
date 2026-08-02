'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import {
  Clock, Plus, Loader2, AlertTriangle, RefreshCw,
  ChevronLeft, ChevronRight, Send, Check, X, Copy,
  Users, ShieldCheck, Calendar, LayoutGrid, Sun,
  MapPin, Briefcase, TrendingUp, BarChart3,
  MessageSquare, RotateCcw, Lock, Trash2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useToast } from '@/components/Toast'
import { useApiMutation } from '@/hooks/use-api'
import { SkeletonRow } from '@/components/Skeleton'

/* ── Types ─────────────────────────────────────────────── */

interface TimesheetEntry {
  id: string
  weekId: string
  date: string
  projectId: string | null
  workStage: string | null
  taskId: string | null
  activity: string | null
  description: string | null
  hours: number
  isBillable: boolean
  overheadCode: string | null
  locationType: string | null
  isOvertime: boolean
  isTOIL: boolean
  createdAt: string
}

interface TimesheetWeek {
  id: string
  profileId: string
  organisationId: string
  weekStarting: string
  status: string
  totalHours: number
  billableHours: number
  submittedAt: string | null
  approvedById: string | null
  approvedAt: string | null
  rejectionReason: string | null
  comments: string | null
  profile: { id: string; fullName: string; jobTitle?: string; avatarUrl?: string; managerId?: string }
  entries: TimesheetEntry[]
}

interface Project {
  id: string
  name: string
  code: string
}

type Tab = 'my-timesheets' | 'manager'
type ViewMode = 'week' | 'day' | 'calendar'

/* ── Constants ─────────────────────────────────────────── */

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const FULL_DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const EXPECTED_DAILY_HOURS = 8
const EXPECTED_WEEKLY_HOURS = 40

const STATUS_META: Record<string, { label: string; color: string; bg: string; icon: typeof Clock }> = {
  DRAFT: { label: 'Draft', color: 'text-ink-500', bg: 'bg-ink-100', icon: Clock },
  SUBMITTED: { label: 'Submitted', color: 'text-blue-600', bg: 'bg-blue-50', icon: Send },
  CHANGES_REQUIRED: { label: 'Changes required', color: 'text-amber-600', bg: 'bg-amber-50', icon: MessageSquare },
  APPROVED: { label: 'Approved', color: 'text-emerald-600', bg: 'bg-emerald-50', icon: Check },
  REJECTED: { label: 'Rejected', color: 'text-red-600', bg: 'bg-red-50', icon: X },
  LOCKED: { label: 'Locked', color: 'text-violet-600', bg: 'bg-violet-50', icon: Lock },
  REOPENED: { label: 'Reopened', color: 'text-orange-600', bg: 'bg-orange-50', icon: RotateCcw },
}

const WORK_STAGES = [
  { value: '0', label: '0 - Strategic Definition' },
  { value: '1', label: '1 - Preparation & Briefing' },
  { value: '2', label: '2 - Concept Design' },
  { value: '3', label: '3 - Spatial Coordination' },
  { value: '4', label: '4 - Technical Design' },
  { value: '5', label: '5 - Manufacturing & Construction' },
  { value: '6', label: '6 - Handover' },
  { value: '7', label: '7 - Use' },
]

const LOCATION_TYPES = [
  { value: 'office', label: 'Office' },
  { value: 'site', label: 'Site' },
  { value: 'remote', label: 'Remote' },
  { value: 'travel', label: 'Travel' },
]

const OVERHEAD_CODES = [
  { value: 'ADMIN', label: 'Administration' },
  { value: 'CPD', label: 'CPD / Training' },
  { value: 'MARKETING', label: 'Marketing / BD' },
  { value: 'MEETING', label: 'Internal Meeting' },
  { value: 'IT', label: 'IT / Systems' },
  { value: 'OTHER', label: 'Other' },
]

/* ── Helpers ───────────────────────────────────────────── */

function getMonday(date: Date): Date {
  const d = new Date(date)
  const day = d.getUTCDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setUTCDate(d.getUTCDate() + diff)
  d.setUTCHours(0, 0, 0, 0)
  return d
}

function formatWeekDate(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

function formatFullDate(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
}

function formatDateISO(date: Date): string {
  return date.toISOString().split('T')[0]
}

function getWeekDates(weekStarting: Date): Date[] {
  const dates: Date[] = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStarting)
    d.setUTCDate(d.getUTCDate() + i)
    dates.push(d)
  }
  return dates
}

function isToday(date: Date): boolean {
  const now = new Date()
  return date.getUTCFullYear() === now.getFullYear() &&
    date.getUTCMonth() === now.getMonth() &&
    date.getUTCDate() === now.getDate()
}

function isWeekend(date: Date): boolean {
  const day = date.getUTCDay()
  return day === 0 || day === 6
}

function weekLabel(weekStarting: Date): string {
  const end = new Date(weekStarting)
  end.setUTCDate(end.getUTCDate() + 6)
  const startStr = weekStarting.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  const endStr = end.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  return `${startStr} - ${endStr}`
}

/* ── Component ─────────────────────────────────────────── */

export default function TimesheetsPage() {
  const { toast } = useToast()

  // Navigation
  const [currentMonday, setCurrentMonday] = useState(() => getMonday(new Date()))
  const [activeTab, setActiveTab] = useState<Tab>('my-timesheets')
  const [viewMode, setViewMode] = useState<ViewMode>('week')
  const [selectedDay, setSelectedDay] = useState<number>(0) // 0=Mon for day view

  // Data
  const [week, setWeek] = useState<TimesheetWeek | null>(null)
  const [teamWeeks, setTeamWeeks] = useState<TimesheetWeek[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [userProfile, setUserProfile] = useState<{ id: string; orgPermission: string } | null>(null)
  const [previousWeekId, setPreviousWeekId] = useState<string | null>(null)

  // Loading
  const [loading, setLoading] = useState(true)
  const [teamLoading, setTeamLoading] = useState(false)
  const [creating, setCreating] = useState(false)

  // Entry form
  const [showEntryForm, setShowEntryForm] = useState(false)
  const [entryFormDay, setEntryFormDay] = useState<number>(0)
  const [entryProject, setEntryProject] = useState('')
  const [entryStage, setEntryStage] = useState('')
  const [entryActivity, setEntryActivity] = useState('')
  const [entryHours, setEntryHours] = useState('')
  const [entryBillable, setEntryBillable] = useState(true)
  const [entryLocation, setEntryLocation] = useState('office')
  const [entryOverhead, setEntryOverhead] = useState('')
  const [entryOvertime, setEntryOvertime] = useState(false)
  const [entryTOIL, setEntryTOIL] = useState(false)
  const [entryDescription, setEntryDescription] = useState('')
  const [submittingEntry, setSubmittingEntry] = useState(false)

  // Manager actions
  const [actionWeekId, setActionWeekId] = useState<string | null>(null)
  const [actionReason, setActionReason] = useState('')
  const [actionLoading, setActionLoading] = useState(false)

  // Derived
  const weekDates = useMemo(() => getWeekDates(currentMonday), [currentMonday])
  const weekKey = formatDateISO(currentMonday)

  const isEditable = week && ['DRAFT', 'CHANGES_REQUIRED', 'REOPENED'].includes(week.status)
  const isManager = userProfile && ['ADMIN', 'OWNER', 'MANAGER'].includes(userProfile.orgPermission)

  /* ── Data Loading ────────────────────────────────────── */

  const loadWeek = useCallback(async () => {
    setLoading(true)
    try {
      // Load user profile
      const meRes = await fetch('/api/me')
      if (meRes.ok) {
        const meData = await meRes.json()
        setUserProfile(meData.data?.profile || null)
      }

      // Load projects
      const projRes = await fetch('/api/projects?pageSize=100')
      if (projRes.ok) {
        const projData = await projRes.json()
        setProjects(
          (projData.data?.projects || projData.data || []).map((p: Record<string, unknown>) => ({
            id: p.id,
            name: p.name,
            code: p.code || p.projectCode || '',
          }))
        )
      }

      // Load current week
      const res = await fetch(`/api/timesheets?page=1&pageSize=52`)
      if (!res.ok) throw new Error('Failed to load timesheets')
      const data = await res.json()
      const allWeeks: TimesheetWeek[] = data.data?.weeks || []

      // Find week matching current Monday
      const match = allWeeks.find((w: TimesheetWeek) => {
        const ws = new Date(w.weekStarting)
        return formatDateISO(ws) === weekKey
      })

      if (match) {
        // Load full week with entries
        const detailRes = await fetch(`/api/timesheets/${match.id}`)
        if (detailRes.ok) {
          const detailData = await detailRes.json()
          setWeek(detailData.data?.week || null)
        } else {
          setWeek(match)
        }
      } else {
        setWeek(null)
      }

      // Find previous week for copy function
      const prevMonday = new Date(currentMonday)
      prevMonday.setUTCDate(prevMonday.getUTCDate() - 7)
      const prevKey = formatDateISO(prevMonday)
      const prevMatch = allWeeks.find((w: TimesheetWeek) => {
        const ws = new Date(w.weekStarting)
        return formatDateISO(ws) === prevKey
      })
      setPreviousWeekId(prevMatch?.id || null)
    } catch (err) {
      toast('Failed to load timesheet data', 'error')
    } finally {
      setLoading(false)
    }
  }, [weekKey, currentMonday, toast])

  const loadTeamWeeks = useCallback(async () => {
    if (!isManager) return
    setTeamLoading(true)
    try {
      const res = await fetch(`/api/timesheets?role=manager&page=1&pageSize=50`)
      if (res.ok) {
        const data = await res.json()
        setTeamWeeks(data.data?.weeks || [])
      }
    } catch {
      // Silent — manager tab is supplementary
    } finally {
      setTeamLoading(false)
    }
  }, [isManager])

  useEffect(() => {
    loadWeek()
  }, [loadWeek])

  useEffect(() => {
    if (activeTab === 'manager') {
      loadTeamWeeks()
    }
  }, [activeTab, loadTeamWeeks])

  /* ── Actions ─────────────────────────────────────────── */

  const createWeek = async () => {
    setCreating(true)
    try {
      const res = await fetch('/api/timesheets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ weekStarting: weekKey }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Failed to create timesheet')
      }
      toast('Timesheet created', 'success')
      await loadWeek()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to create timesheet', 'error')
    } finally {
      setCreating(false)
    }
  }

  const addEntry = async () => {
    if (!week) return
    const hours = parseFloat(entryHours)
    if (isNaN(hours) || hours <= 0) {
      toast('Please enter valid hours', 'error')
      return
    }

    setSubmittingEntry(true)
    try {
      const entryDate = new Date(currentMonday)
      entryDate.setUTCDate(entryDate.getUTCDate() + entryFormDay)

      const body: Record<string, unknown> = {
        date: formatDateISO(entryDate),
        hours,
        isBillable: entryBillable,
        locationType: entryLocation,
        isOvertime: entryOvertime,
        isTOIL: entryTOIL,
      }

      if (entryProject) body.projectId = entryProject
      if (entryStage) body.workStage = entryStage
      if (entryActivity.trim()) body.activity = entryActivity.trim()
      if (entryDescription.trim()) body.description = entryDescription.trim()
      if (entryOverhead) body.overheadCode = entryOverhead

      const res = await fetch(`/api/timesheets/${week.id}/entries`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Failed to add entry')
      }

      toast('Entry added', 'success')
      resetEntryForm()
      await loadWeek()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to add entry', 'error')
    } finally {
      setSubmittingEntry(false)
    }
  }

  const deleteEntry = async (entryId: string) => {
    try {
      const res = await fetch(`/api/timesheets/entries/${entryId}`, { method: 'DELETE' })
      if (!res.ok && res.status !== 204) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Failed to delete entry')
      }
      toast('Entry removed', 'success')
      await loadWeek()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to delete entry', 'error')
    }
  }

  const updateStatus = async (weekId: string, status: string, rejectionReason?: string) => {
    setActionLoading(true)
    try {
      const body: Record<string, unknown> = { status }
      if (rejectionReason) body.rejectionReason = rejectionReason

      const res = await fetch(`/api/timesheets/${weekId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Failed to update status')
      }

      toast(`Timesheet ${status.toLowerCase().replace('_', ' ')}`, 'success')
      setActionWeekId(null)
      setActionReason('')
      await loadWeek()
      if (activeTab === 'manager') await loadTeamWeeks()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to update status', 'error')
    } finally {
      setActionLoading(false)
    }
  }

  const copyPreviousWeek = async () => {
    if (!week || !previousWeekId) return
    try {
      const res = await fetch(`/api/timesheets/${week.id}/entries`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ copyFromWeekId: previousWeekId }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Failed to copy entries')
      }
      toast('Previous week entries copied', 'success')
      await loadWeek()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to copy entries', 'error')
    }
  }

  const resetEntryForm = () => {
    setShowEntryForm(false)
    setEntryProject('')
    setEntryStage('')
    setEntryActivity('')
    setEntryHours('')
    setEntryBillable(true)
    setEntryLocation('office')
    setEntryOverhead('')
    setEntryOvertime(false)
    setEntryTOIL(false)
    setEntryDescription('')
  }

  /* ── Week Navigation ─────────────────────────────────── */

  const goToPreviousWeek = () => {
    const prev = new Date(currentMonday)
    prev.setUTCDate(prev.getUTCDate() - 7)
    setCurrentMonday(prev)
  }

  const goToNextWeek = () => {
    const next = new Date(currentMonday)
    next.setUTCDate(next.getUTCDate() + 7)
    setCurrentMonday(next)
  }

  const goToThisWeek = () => {
    setCurrentMonday(getMonday(new Date()))
  }

  /* ── Computed ────────────────────────────────────────── */

  const entries = week?.entries || []

  const entriesByDay = useMemo(() => {
    const map: Record<string, TimesheetEntry[]> = {}
    weekDates.forEach(d => {
      map[formatDateISO(d)] = []
    })
    entries.forEach((e: TimesheetEntry) => {
      const key = formatDateISO(new Date(e.date))
      if (map[key]) {
        map[key].push(e)
      }
    })
    return map
  }, [entries, weekDates])

  const dailyTotals = useMemo(() => {
    return weekDates.map(d => {
      const dayEntries = entriesByDay[formatDateISO(d)] || []
      return dayEntries.reduce((sum, e) => sum + e.hours, 0)
    })
  }, [weekDates, entriesByDay])

  const weekTotal = dailyTotals.reduce((a, b) => a + b, 0)
  const billableTotal = entries.filter(e => e.isBillable).reduce((sum, e) => sum + e.hours, 0)
  const billablePercent = weekTotal > 0 ? Math.round((billableTotal / weekTotal) * 100) : 0

  // Group entries by project/activity for the grid display
  const entryRows = useMemo(() => {
    const rowMap = new Map<string, { projectId: string | null; activity: string | null; overheadCode: string | null; entries: Record<string, TimesheetEntry[]> }>()

    entries.forEach((e: TimesheetEntry) => {
      const key = `${e.projectId || 'none'}-${e.activity || 'none'}-${e.overheadCode || 'none'}`
      if (!rowMap.has(key)) {
        rowMap.set(key, {
          projectId: e.projectId,
          activity: e.activity,
          overheadCode: e.overheadCode,
          entries: {},
        })
      }
      const dateKey = formatDateISO(new Date(e.date))
      const row = rowMap.get(key)!
      if (!row.entries[dateKey]) row.entries[dateKey] = []
      row.entries[dateKey].push(e)
    })

    return Array.from(rowMap.values())
  }, [entries])

  const projectName = (id: string | null) => {
    if (!id) return 'No project'
    const p = projects.find(proj => proj.id === id)
    return p ? `${p.code || ''} ${p.name}`.trim() : 'Unknown project'
  }

  // Manager-view filtered weeks for current week
  const teamWeeksThisWeek = useMemo(() => {
    return teamWeeks.filter(w => {
      const ws = new Date(w.weekStarting)
      return formatDateISO(ws) === weekKey
    })
  }, [teamWeeks, weekKey])

  const isThisWeek = formatDateISO(getMonday(new Date())) === weekKey

  /* ── Status badge component ──────────────────────────── */

  const StatusBadge = ({ status }: { status: string }) => {
    const meta = STATUS_META[status] || STATUS_META.DRAFT
    const Icon = meta.icon
    return (
      <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12px] font-medium', meta.bg, meta.color)}>
        <Icon className="w-3.5 h-3.5" />
        {meta.label}
      </span>
    )
  }

  /* ── Render ──────────────────────────────────────────── */

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-semibold text-ink-900">Timesheets</h1>
          <p className="text-[13px] text-ink-400 mt-1">Track time against projects and tasks</p>
        </div>

        {/* View mode toggle */}
        <div className="flex items-center gap-2">
          <div className="flex bg-ink-50 rounded-lg p-0.5">
            {([
              { key: 'week' as ViewMode, icon: LayoutGrid, label: 'Week' },
              { key: 'day' as ViewMode, icon: Sun, label: 'Day' },
              { key: 'calendar' as ViewMode, icon: Calendar, label: 'Calendar' },
            ]).map(v => (
              <button
                key={v.key}
                onClick={() => setViewMode(v.key)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-medium transition-colors',
                  viewMode === v.key ? 'bg-white text-ink-900 shadow-sm' : 'text-ink-400 hover:text-ink-600'
                )}
              >
                <v.icon className="w-3.5 h-3.5" />
                {v.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tabs (My / Manager) */}
      {isManager && (
        <div className="flex border-b border-ink-100">
          <button
            onClick={() => setActiveTab('my-timesheets')}
            className={cn(
              'px-4 py-2.5 text-[13px] font-medium border-b-2 transition-colors',
              activeTab === 'my-timesheets'
                ? 'border-brand-600 text-brand-600'
                : 'border-transparent text-ink-400 hover:text-ink-600'
            )}
          >
            <Clock className="w-4 h-4 inline mr-1.5" />
            My Timesheets
          </button>
          <button
            onClick={() => setActiveTab('manager')}
            className={cn(
              'px-4 py-2.5 text-[13px] font-medium border-b-2 transition-colors',
              activeTab === 'manager'
                ? 'border-brand-600 text-brand-600'
                : 'border-transparent text-ink-400 hover:text-ink-600'
            )}
          >
            <Users className="w-4 h-4 inline mr-1.5" />
            Team Timesheets
          </button>
        </div>
      )}

      {/* ── My Timesheets Tab ──────────────────────────────── */}
      {activeTab === 'my-timesheets' && (
        <>
          {/* Week Navigation */}
          <div className="flex items-center justify-between bg-white rounded-xl border border-ink-100 px-4 py-3">
            <button
              onClick={goToPreviousWeek}
              className="p-1.5 rounded-lg hover:bg-ink-50 text-ink-500 transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>

            <div className="text-center">
              <p className="text-[15px] font-semibold text-ink-900">
                {weekLabel(currentMonday)}
              </p>
              {isThisWeek && (
                <p className="text-[11px] text-brand-600 font-medium mt-0.5">Current week</p>
              )}
            </div>

            <div className="flex items-center gap-2">
              {!isThisWeek && (
                <button
                  onClick={goToThisWeek}
                  className="text-[12px] text-brand-600 hover:text-brand-700 font-medium px-2 py-1 rounded hover:bg-brand-50 transition-colors"
                >
                  This week
                </button>
              )}
              <button
                onClick={goToNextWeek}
                className="p-1.5 rounded-lg hover:bg-ink-50 text-ink-500 transition-colors"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="bg-white rounded-xl border border-ink-100 p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                  <Clock className="w-4 h-4 text-blue-600" />
                </div>
                <span className="text-[12px] text-ink-400">Total hours</span>
              </div>
              <p className="text-[22px] font-semibold text-ink-900">
                {loading ? '--' : weekTotal.toFixed(1)}
              </p>
              <div className="mt-1">
                {!loading && weekTotal > 0 && (
                  <div className="w-full bg-ink-100 rounded-full h-1.5">
                    <div
                      className={cn(
                        'h-1.5 rounded-full transition-all',
                        weekTotal >= EXPECTED_WEEKLY_HOURS ? 'bg-emerald-500' : 'bg-blue-500'
                      )}
                      style={{ width: `${Math.min(100, (weekTotal / EXPECTED_WEEKLY_HOURS) * 100)}%` }}
                    />
                  </div>
                )}
                <p className="text-[11px] text-ink-300 mt-1">of {EXPECTED_WEEKLY_HOURS}h expected</p>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-ink-100 p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
                  <TrendingUp className="w-4 h-4 text-emerald-600" />
                </div>
                <span className="text-[12px] text-ink-400">Billable</span>
              </div>
              <p className="text-[22px] font-semibold text-ink-900">
                {loading ? '--' : `${billablePercent}%`}
              </p>
              <p className="text-[11px] text-ink-300 mt-1">
                {loading ? '--' : `${billableTotal.toFixed(1)}h billable`}
              </p>
            </div>

            <div className="bg-white rounded-xl border border-ink-100 p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg bg-violet-50 flex items-center justify-center">
                  <BarChart3 className="w-4 h-4 text-violet-600" />
                </div>
                <span className="text-[12px] text-ink-400">Entries</span>
              </div>
              <p className="text-[22px] font-semibold text-ink-900">
                {loading ? '--' : entries.length}
              </p>
              <p className="text-[11px] text-ink-300 mt-1">
                {loading ? '--' : `${entryRows.length} project rows`}
              </p>
            </div>

            <div className="bg-white rounded-xl border border-ink-100 p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center">
                  <ShieldCheck className="w-4 h-4 text-amber-600" />
                </div>
                <span className="text-[12px] text-ink-400">Status</span>
              </div>
              {week ? (
                <StatusBadge status={week.status} />
              ) : (
                <p className="text-[13px] text-ink-300">No timesheet</p>
              )}
              {week?.rejectionReason && (
                <p className="text-[11px] text-red-500 mt-1 line-clamp-2">{week.rejectionReason}</p>
              )}
            </div>
          </div>

          {/* Loading skeleton */}
          {loading && (
            <div className="bg-white rounded-xl border border-ink-100 p-6">
              { Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />) }
            </div>
          )}

          {/* No week yet — prompt to create */}
          {!loading && !week && (
            <div className="bg-white rounded-xl border border-ink-100 p-12 text-center">
              <Clock className="w-12 h-12 text-ink-200 mx-auto mb-4" />
              <p className="text-[15px] font-medium text-ink-700">No timesheet for this week</p>
              <p className="text-[12px] text-ink-400 mt-2 max-w-md mx-auto">
                Create a timesheet to start logging your hours for {weekLabel(currentMonday)}.
              </p>
              <button
                onClick={createWeek}
                disabled={creating}
                className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg text-[13px] font-medium hover:bg-brand-700 transition-colors disabled:opacity-50"
              >
                {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Create Timesheet
              </button>
            </div>
          )}

          {/* ── Week Grid View ────────────────────────────── */}
          {!loading && week && viewMode === 'week' && (
            <div className="bg-white rounded-xl border border-ink-100 overflow-hidden">
              {/* Status bar */}
              {week.status !== 'DRAFT' && (
                <div className={cn(
                  'px-4 py-2 flex items-center justify-between text-[12px]',
                  week.status === 'CHANGES_REQUIRED' ? 'bg-amber-50 text-amber-700' :
                  week.status === 'APPROVED' ? 'bg-emerald-50 text-emerald-700' :
                  week.status === 'REJECTED' ? 'bg-red-50 text-red-700' :
                  week.status === 'SUBMITTED' ? 'bg-blue-50 text-blue-700' :
                  'bg-ink-50 text-ink-600'
                )}>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={week.status} />
                    {week.rejectionReason && (
                      <span className="ml-2">{week.rejectionReason}</span>
                    )}
                  </div>
                  {week.status === 'CHANGES_REQUIRED' && (
                    <button
                      onClick={() => updateStatus(week.id, 'DRAFT')}
                      className="text-[12px] font-medium underline hover:no-underline"
                    >
                      Return to draft
                    </button>
                  )}
                </div>
              )}

              {/* Grid header */}
              <div className="overflow-x-auto">
                <table className="w-full min-w-[800px]">
                  <thead>
                    <tr className="border-b border-ink-100">
                      <th className="text-left px-4 py-3 text-[12px] font-medium text-ink-400 w-[200px]">
                        Project / Activity
                      </th>
                      {weekDates.map((d, i) => (
                        <th
                          key={i}
                          className={cn(
                            'text-center px-2 py-3 text-[12px] font-medium min-w-[80px]',
                            isToday(d) ? 'text-brand-600 bg-brand-50/50' : isWeekend(d) ? 'text-ink-300 bg-ink-50/50' : 'text-ink-500'
                          )}
                        >
                          <div>{DAY_NAMES[i]}</div>
                          <div className="text-[11px] font-normal mt-0.5">{formatWeekDate(d.toISOString())}</div>
                        </th>
                      ))}
                      <th className="text-center px-3 py-3 text-[12px] font-medium text-ink-500 min-w-[60px]">
                        Total
                      </th>
                      {isEditable && (
                        <th className="w-[40px]" />
                      )}
                    </tr>
                  </thead>

                  <tbody>
                    {/* Entry rows */}
                    {entryRows.map((row, rowIdx) => {
                      const rowTotal = weekDates.reduce((sum, d) => {
                        const dayEntries = row.entries[formatDateISO(d)] || []
                        return sum + dayEntries.reduce((s, e) => s + e.hours, 0)
                      }, 0)

                      return (
                        <tr key={rowIdx} className="border-b border-ink-50 hover:bg-ink-50/30">
                          <td className="px-4 py-2.5">
                            <div className="text-[13px] font-medium text-ink-800 truncate max-w-[180px]">
                              {row.projectId ? projectName(row.projectId) : (row.overheadCode ? `[${row.overheadCode}]` : 'Unassigned')}
                            </div>
                            {row.activity && (
                              <div className="text-[11px] text-ink-400 truncate max-w-[180px]">{row.activity}</div>
                            )}
                          </td>
                          {weekDates.map((d, di) => {
                            const dayEntries = row.entries[formatDateISO(d)] || []
                            const dayHours = dayEntries.reduce((s, e) => s + e.hours, 0)
                            return (
                              <td
                                key={di}
                                className={cn(
                                  'text-center px-2 py-2.5 text-[13px]',
                                  isToday(d) ? 'bg-brand-50/30' : isWeekend(d) ? 'bg-ink-50/30' : '',
                                  dayHours > 0 ? 'text-ink-800 font-medium' : 'text-ink-200',
                                )}
                              >
                                {dayHours > 0 ? dayHours.toFixed(1) : '-'}
                              </td>
                            )
                          })}
                          <td className="text-center px-3 py-2.5 text-[13px] font-semibold text-ink-900">
                            {rowTotal.toFixed(1)}
                          </td>
                          {isEditable && (
                            <td className="px-1">
                              {/* Row-level delete could go here */}
                            </td>
                          )}
                        </tr>
                      )
                    })}

                    {/* Empty state row */}
                    {entryRows.length === 0 && (
                      <tr>
                        <td colSpan={9 + (isEditable ? 1 : 0)} className="px-4 py-8 text-center">
                          <p className="text-[13px] text-ink-400">No time entries this week</p>
                          <p className="text-[11px] text-ink-300 mt-1">Click &ldquo;Add time&rdquo; to log your first entry</p>
                        </td>
                      </tr>
                    )}

                    {/* Daily totals row */}
                    <tr className="bg-ink-50/50 border-t border-ink-200">
                      <td className="px-4 py-2.5 text-[12px] font-semibold text-ink-600">
                        Daily total
                      </td>
                      {dailyTotals.map((total, i) => (
                        <td
                          key={i}
                          className={cn(
                            'text-center px-2 py-2.5 text-[13px] font-semibold',
                            total > EXPECTED_DAILY_HOURS ? 'text-amber-600' :
                            total === 0 && !isWeekend(weekDates[i]) ? 'text-ink-300' :
                            'text-ink-700',
                            isToday(weekDates[i]) ? 'bg-brand-50/50' : ''
                          )}
                        >
                          {total > 0 ? total.toFixed(1) : '-'}
                          {total > EXPECTED_DAILY_HOURS && (
                            <AlertTriangle className="w-3 h-3 inline ml-0.5 text-amber-500" />
                          )}
                        </td>
                      ))}
                      <td className="text-center px-3 py-2.5 text-[14px] font-bold text-ink-900">
                        {weekTotal.toFixed(1)}
                      </td>
                      {isEditable && <td />}
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Action bar */}
              <div className="px-4 py-3 border-t border-ink-100 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  {isEditable && (
                    <>
                      <button
                        onClick={() => {
                          setShowEntryForm(true)
                          setEntryFormDay(Math.min(4, new Date().getUTCDay() === 0 ? 4 : new Date().getUTCDay() - 1))
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-brand-600 text-white rounded-lg text-[12px] font-medium hover:bg-brand-700 transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Add time
                      </button>
                      {previousWeekId && entries.length === 0 && (
                        <button
                          onClick={copyPreviousWeek}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-ink-200 text-ink-600 rounded-lg text-[12px] font-medium hover:bg-ink-50 transition-colors"
                        >
                          <Copy className="w-3.5 h-3.5" />
                          Copy previous week
                        </button>
                      )}
                    </>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {week.status === 'DRAFT' && entries.length > 0 && (
                    <button
                      onClick={() => updateStatus(week.id, 'SUBMITTED')}
                      disabled={actionLoading}
                      className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 text-white rounded-lg text-[12px] font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
                    >
                      {actionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                      Submit week
                    </button>
                  )}
                  {week.status === 'REOPENED' && (
                    <button
                      onClick={() => updateStatus(week.id, 'SUBMITTED')}
                      disabled={actionLoading}
                      className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 text-white rounded-lg text-[12px] font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
                    >
                      {actionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                      Resubmit
                    </button>
                  )}
                  <button
                    onClick={loadWeek}
                    className="p-1.5 rounded-lg hover:bg-ink-50 text-ink-400 transition-colors"
                    title="Refresh"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── Day View ──────────────────────────────────── */}
          {!loading && week && viewMode === 'day' && (
            <div className="bg-white rounded-xl border border-ink-100">
              {/* Day selector */}
              <div className="flex border-b border-ink-100 overflow-x-auto">
                {weekDates.map((d, i) => {
                  const dayTotal = dailyTotals[i]
                  return (
                    <button
                      key={i}
                      onClick={() => setSelectedDay(i)}
                      className={cn(
                        'flex-1 min-w-[80px] px-3 py-3 text-center border-b-2 transition-colors',
                        selectedDay === i
                          ? 'border-brand-600 bg-brand-50/50'
                          : 'border-transparent hover:bg-ink-50',
                        isToday(d) && selectedDay !== i ? 'bg-brand-50/20' : ''
                      )}
                    >
                      <div className={cn(
                        'text-[12px] font-medium',
                        selectedDay === i ? 'text-brand-600' : 'text-ink-500'
                      )}>
                        {DAY_NAMES[i]}
                      </div>
                      <div className="text-[11px] text-ink-400 mt-0.5">{formatWeekDate(d.toISOString())}</div>
                      {dayTotal > 0 && (
                        <div className={cn(
                          'text-[11px] font-semibold mt-1',
                          dayTotal > EXPECTED_DAILY_HOURS ? 'text-amber-600' : 'text-ink-600'
                        )}>
                          {dayTotal.toFixed(1)}h
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>

              {/* Day entries */}
              <div className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-[14px] font-semibold text-ink-800">
                    {FULL_DAY_NAMES[selectedDay]}, {formatWeekDate(weekDates[selectedDay].toISOString())}
                  </h3>
                  <span className={cn(
                    'text-[13px] font-semibold',
                    dailyTotals[selectedDay] > EXPECTED_DAILY_HOURS ? 'text-amber-600' : 'text-ink-600'
                  )}>
                    {dailyTotals[selectedDay].toFixed(1)} / {EXPECTED_DAILY_HOURS}h
                  </span>
                </div>

                {(entriesByDay[formatDateISO(weekDates[selectedDay])] || []).map((entry) => (
                  <div key={entry.id} className="flex items-start gap-3 p-3 rounded-lg border border-ink-100 hover:border-ink-200">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] font-medium text-ink-800">
                          {entry.projectId ? projectName(entry.projectId) : (entry.overheadCode ? `[${entry.overheadCode}]` : 'Unassigned')}
                        </span>
                        {entry.isBillable && (
                          <span className="text-[10px] px-1.5 py-0.5 bg-emerald-50 text-emerald-600 rounded font-medium">Billable</span>
                        )}
                        {entry.isOvertime && (
                          <span className="text-[10px] px-1.5 py-0.5 bg-amber-50 text-amber-600 rounded font-medium">OT</span>
                        )}
                        {entry.isTOIL && (
                          <span className="text-[10px] px-1.5 py-0.5 bg-violet-50 text-violet-600 rounded font-medium">TOIL</span>
                        )}
                      </div>
                      {entry.activity && (
                        <p className="text-[12px] text-ink-500 mt-0.5">{entry.activity}</p>
                      )}
                      {entry.description && (
                        <p className="text-[11px] text-ink-400 mt-0.5">{entry.description}</p>
                      )}
                      <div className="flex items-center gap-3 mt-1.5 text-[11px] text-ink-400">
                        {entry.workStage && (
                          <span>Stage {entry.workStage}</span>
                        )}
                        {entry.locationType && (
                          <span className="flex items-center gap-0.5">
                            <MapPin className="w-3 h-3" />
                            {entry.locationType}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[15px] font-semibold text-ink-900">{entry.hours.toFixed(1)}h</span>
                      {isEditable && (
                        <button
                          onClick={() => deleteEntry(entry.id)}
                          className="p-1 rounded hover:bg-red-50 text-ink-300 hover:text-red-500 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}

                {(entriesByDay[formatDateISO(weekDates[selectedDay])] || []).length === 0 && (
                  <div className="py-8 text-center">
                    <p className="text-[13px] text-ink-400">No entries for this day</p>
                  </div>
                )}

                {isEditable && (
                  <button
                    onClick={() => {
                      setEntryFormDay(selectedDay)
                      setShowEntryForm(true)
                    }}
                    className="w-full py-2 border border-dashed border-ink-200 rounded-lg text-[12px] text-ink-400 hover:text-ink-600 hover:border-ink-300 transition-colors flex items-center justify-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add entry
                  </button>
                )}
              </div>
            </div>
          )}

          {/* ── Calendar View ─────────────────────────────── */}
          {!loading && week && viewMode === 'calendar' && (
            <div className="bg-white rounded-xl border border-ink-100">
              <div className="grid grid-cols-7 border-b border-ink-100">
                {DAY_NAMES.map((day, i) => (
                  <div
                    key={day}
                    className={cn(
                      'px-3 py-2 text-center text-[12px] font-medium',
                      isWeekend(weekDates[i]) ? 'text-ink-300 bg-ink-50/50' : 'text-ink-500'
                    )}
                  >
                    {day}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7 min-h-[280px]">
                {weekDates.map((d, i) => {
                  const dayEntries = entriesByDay[formatDateISO(d)] || []
                  const dayTotal = dailyTotals[i]
                  return (
                    <div
                      key={i}
                      className={cn(
                        'border-r border-b border-ink-100 p-2 last:border-r-0',
                        isToday(d) ? 'bg-brand-50/30' : isWeekend(d) ? 'bg-ink-50/30' : '',
                      )}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className={cn(
                          'text-[12px] font-medium',
                          isToday(d) ? 'text-brand-600' : 'text-ink-500'
                        )}>
                          {d.getUTCDate()}
                        </span>
                        {dayTotal > 0 && (
                          <span className={cn(
                            'text-[11px] font-semibold px-1.5 py-0.5 rounded',
                            dayTotal > EXPECTED_DAILY_HOURS ? 'bg-amber-100 text-amber-700' : 'bg-ink-100 text-ink-600'
                          )}>
                            {dayTotal.toFixed(1)}h
                          </span>
                        )}
                      </div>
                      <div className="space-y-1">
                        {dayEntries.slice(0, 3).map((entry) => (
                          <div
                            key={entry.id}
                            className={cn(
                              'text-[10px] px-1.5 py-1 rounded truncate',
                              entry.isBillable ? 'bg-blue-50 text-blue-700' : 'bg-ink-100 text-ink-600'
                            )}
                          >
                            {entry.hours.toFixed(1)}h {entry.projectId ? projectName(entry.projectId).substring(0, 15) : (entry.overheadCode || 'Misc')}
                          </div>
                        ))}
                        {dayEntries.length > 3 && (
                          <div className="text-[10px] text-ink-400 px-1.5">+{dayEntries.length - 3} more</div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* ── Add Entry Form (Modal-style overlay) ───────── */}
          {showEntryForm && week && (
            <div className="bg-white rounded-xl border border-ink-100 p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-[14px] font-semibold text-ink-800">
                  Add time entry &mdash; {FULL_DAY_NAMES[entryFormDay]}, {formatWeekDate(weekDates[entryFormDay].toISOString())}
                </h3>
                <button onClick={resetEntryForm} className="p-1 rounded hover:bg-ink-50 text-ink-400">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Day picker */}
                <div>
                  <label className="block text-[12px] font-medium text-ink-600 mb-1">Day</label>
                  <select
                    value={entryFormDay}
                    onChange={e => setEntryFormDay(parseInt(e.target.value))}
                    className="w-full px-3 py-2 border border-ink-200 rounded-lg text-[13px] focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                  >
                    {DAY_NAMES.map((day, i) => (
                      <option key={i} value={i}>{day} {formatWeekDate(weekDates[i].toISOString())}</option>
                    ))}
                  </select>
                </div>

                {/* Project */}
                <div>
                  <label className="block text-[12px] font-medium text-ink-600 mb-1">Project</label>
                  <select
                    value={entryProject}
                    onChange={e => setEntryProject(e.target.value)}
                    className="w-full px-3 py-2 border border-ink-200 rounded-lg text-[13px] focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                  >
                    <option value="">No project (overhead)</option>
                    {projects.map(p => (
                      <option key={p.id} value={p.id}>{p.code ? `${p.code} - ` : ''}{p.name}</option>
                    ))}
                  </select>
                </div>

                {/* Work stage */}
                <div>
                  <label className="block text-[12px] font-medium text-ink-600 mb-1">Work stage</label>
                  <select
                    value={entryStage}
                    onChange={e => setEntryStage(e.target.value)}
                    className="w-full px-3 py-2 border border-ink-200 rounded-lg text-[13px] focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                  >
                    <option value="">Select stage</option>
                    {WORK_STAGES.map(s => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                </div>

                {/* Activity */}
                <div>
                  <label className="block text-[12px] font-medium text-ink-600 mb-1">Activity</label>
                  <input
                    type="text"
                    value={entryActivity}
                    onChange={e => setEntryActivity(e.target.value)}
                    placeholder="e.g. Floor plan design"
                    className="w-full px-3 py-2 border border-ink-200 rounded-lg text-[13px] focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                  />
                </div>

                {/* Hours */}
                <div>
                  <label className="block text-[12px] font-medium text-ink-600 mb-1">Hours</label>
                  <input
                    type="number"
                    step="0.25"
                    min="0.25"
                    max="24"
                    value={entryHours}
                    onChange={e => setEntryHours(e.target.value)}
                    placeholder="8.0"
                    className="w-full px-3 py-2 border border-ink-200 rounded-lg text-[13px] focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                  />
                </div>

                {/* Location */}
                <div>
                  <label className="block text-[12px] font-medium text-ink-600 mb-1">Location</label>
                  <select
                    value={entryLocation}
                    onChange={e => setEntryLocation(e.target.value)}
                    className="w-full px-3 py-2 border border-ink-200 rounded-lg text-[13px] focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                  >
                    {LOCATION_TYPES.map(l => (
                      <option key={l.value} value={l.value}>{l.label}</option>
                    ))}
                  </select>
                </div>

                {/* Overhead code (only shown when no project) */}
                {!entryProject && (
                  <div>
                    <label className="block text-[12px] font-medium text-ink-600 mb-1">Overhead code</label>
                    <select
                      value={entryOverhead}
                      onChange={e => setEntryOverhead(e.target.value)}
                      className="w-full px-3 py-2 border border-ink-200 rounded-lg text-[13px] focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                    >
                      <option value="">Select code</option>
                      {OVERHEAD_CODES.map(c => (
                        <option key={c.value} value={c.value}>{c.label}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Description */}
                <div className="sm:col-span-2 lg:col-span-3">
                  <label className="block text-[12px] font-medium text-ink-600 mb-1">Description (optional)</label>
                  <textarea
                    value={entryDescription}
                    onChange={e => setEntryDescription(e.target.value)}
                    rows={2}
                    placeholder="Brief description of the work done..."
                    className="w-full px-3 py-2 border border-ink-200 rounded-lg text-[13px] focus:ring-2 focus:ring-brand-500 focus:border-brand-500 resize-none"
                  />
                </div>
              </div>

              {/* Toggles */}
              <div className="flex flex-wrap items-center gap-4 mt-4 pt-3 border-t border-ink-100">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={entryBillable}
                    onChange={e => setEntryBillable(e.target.checked)}
                    className="rounded border-ink-300 text-brand-600 focus:ring-brand-500"
                  />
                  <span className="text-[12px] text-ink-600">Billable</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={entryOvertime}
                    onChange={e => setEntryOvertime(e.target.checked)}
                    className="rounded border-ink-300 text-brand-600 focus:ring-brand-500"
                  />
                  <span className="text-[12px] text-ink-600">Overtime</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={entryTOIL}
                    onChange={e => setEntryTOIL(e.target.checked)}
                    className="rounded border-ink-300 text-brand-600 focus:ring-brand-500"
                  />
                  <span className="text-[12px] text-ink-600">TOIL</span>
                </label>

                <div className="flex-1" />

                <button
                  onClick={resetEntryForm}
                  className="px-3 py-1.5 text-[12px] text-ink-500 hover:text-ink-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={addEntry}
                  disabled={submittingEntry || !entryHours}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-brand-600 text-white rounded-lg text-[12px] font-medium hover:bg-brand-700 transition-colors disabled:opacity-50"
                >
                  {submittingEntry ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                  Add entry
                </button>
              </div>
            </div>
          )}

          {/* ── Detailed Entry List (below grid) ──────────── */}
          {!loading && week && entries.length > 0 && viewMode === 'week' && (
            <div className="bg-white rounded-xl border border-ink-100">
              <div className="px-4 py-3 border-b border-ink-100">
                <h3 className="text-[13px] font-semibold text-ink-700">All entries this week</h3>
              </div>
              <div className="divide-y divide-ink-50">
                {entries.map((entry) => (
                  <div key={entry.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-ink-50/30">
                    <div className="w-[70px] text-[12px] text-ink-500 font-medium">
                      {formatWeekDate(entry.date)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-[13px] text-ink-800 font-medium">
                        {entry.projectId ? projectName(entry.projectId) : (entry.overheadCode ? `[${entry.overheadCode}]` : 'Unassigned')}
                      </span>
                      {entry.activity && (
                        <span className="text-[12px] text-ink-400 ml-2">{entry.activity}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {entry.isBillable && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-emerald-50 text-emerald-600 rounded font-medium">$</span>
                      )}
                      {entry.locationType && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-ink-100 text-ink-500 rounded">{entry.locationType}</span>
                      )}
                      <span className="text-[13px] font-semibold text-ink-800 w-[50px] text-right">
                        {entry.hours.toFixed(1)}h
                      </span>
                      {isEditable && (
                        <button
                          onClick={() => deleteEntry(entry.id)}
                          className="p-1 rounded hover:bg-red-50 text-ink-300 hover:text-red-500 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Manager Tab ────────────────────────────────────── */}
      {activeTab === 'manager' && (
        <div className="space-y-4">
          {/* Week Navigation (reuse) */}
          <div className="flex items-center justify-between bg-white rounded-xl border border-ink-100 px-4 py-3">
            <button onClick={goToPreviousWeek} className="p-1.5 rounded-lg hover:bg-ink-50 text-ink-500">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div className="text-center">
              <p className="text-[15px] font-semibold text-ink-900">{weekLabel(currentMonday)}</p>
            </div>
            <div className="flex items-center gap-2">
              {!isThisWeek && (
                <button onClick={goToThisWeek} className="text-[12px] text-brand-600 hover:text-brand-700 font-medium px-2 py-1">This week</button>
              )}
              <button onClick={goToNextWeek} className="p-1.5 rounded-lg hover:bg-ink-50 text-ink-500">
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Team summary cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="bg-white rounded-xl border border-ink-100 p-4">
              <p className="text-[12px] text-ink-400">Submitted</p>
              <p className="text-[22px] font-semibold text-blue-600 mt-1">
                {teamWeeksThisWeek.filter(w => w.status === 'SUBMITTED').length}
              </p>
            </div>
            <div className="bg-white rounded-xl border border-ink-100 p-4">
              <p className="text-[12px] text-ink-400">Approved</p>
              <p className="text-[22px] font-semibold text-emerald-600 mt-1">
                {teamWeeksThisWeek.filter(w => w.status === 'APPROVED' || w.status === 'LOCKED').length}
              </p>
            </div>
            <div className="bg-white rounded-xl border border-ink-100 p-4">
              <p className="text-[12px] text-ink-400">Missing</p>
              <p className="text-[22px] font-semibold text-red-600 mt-1">
                {teamLoading ? '--' : Math.max(0, teamWeeks.length > 0 ? 0 : 0)}
              </p>
              <p className="text-[11px] text-ink-300 mt-0.5">Not yet created</p>
            </div>
            <div className="bg-white rounded-xl border border-ink-100 p-4">
              <p className="text-[12px] text-ink-400">Pending review</p>
              <p className="text-[22px] font-semibold text-amber-600 mt-1">
                {teamWeeksThisWeek.filter(w => w.status === 'SUBMITTED' || w.status === 'CHANGES_REQUIRED').length}
              </p>
            </div>
          </div>

          {/* Team timesheets list */}
          {teamLoading && (
            <div className="bg-white rounded-xl border border-ink-100 p-6">
              { Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />) }
            </div>
          )}

          {!teamLoading && teamWeeks.length === 0 && (
            <div className="bg-white rounded-xl border border-ink-100 p-12 text-center">
              <Users className="w-12 h-12 text-ink-200 mx-auto mb-4" />
              <p className="text-[15px] font-medium text-ink-700">No team timesheets found</p>
              <p className="text-[12px] text-ink-400 mt-2">Team timesheets will appear here when your direct reports create them.</p>
            </div>
          )}

          {!teamLoading && teamWeeks.length > 0 && (
            <div className="bg-white rounded-xl border border-ink-100 overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-ink-100">
                    <th className="text-left px-4 py-3 text-[12px] font-medium text-ink-400">Team member</th>
                    <th className="text-left px-4 py-3 text-[12px] font-medium text-ink-400">Week</th>
                    <th className="text-center px-4 py-3 text-[12px] font-medium text-ink-400">Hours</th>
                    <th className="text-center px-4 py-3 text-[12px] font-medium text-ink-400">Billable</th>
                    <th className="text-center px-4 py-3 text-[12px] font-medium text-ink-400">Status</th>
                    <th className="text-right px-4 py-3 text-[12px] font-medium text-ink-400">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {teamWeeks.map((tw) => (
                    <tr key={tw.id} className="border-b border-ink-50 hover:bg-ink-50/30">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-brand-100 flex items-center justify-center text-[11px] font-semibold text-brand-700">
                            {tw.profile.fullName.split(' ').map(n => n[0]).join('').substring(0, 2)}
                          </div>
                          <div>
                            <p className="text-[13px] font-medium text-ink-800">{tw.profile.fullName}</p>
                            {tw.profile.jobTitle && (
                              <p className="text-[11px] text-ink-400">{tw.profile.jobTitle}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-[12px] text-ink-600">
                        {weekLabel(new Date(tw.weekStarting))}
                      </td>
                      <td className="text-center px-4 py-3 text-[13px] font-medium text-ink-800">
                        {tw.totalHours.toFixed(1)}
                      </td>
                      <td className="text-center px-4 py-3 text-[13px] text-ink-600">
                        {tw.totalHours > 0 ? Math.round((tw.billableHours / tw.totalHours) * 100) : 0}%
                      </td>
                      <td className="text-center px-4 py-3">
                        <StatusBadge status={tw.status} />
                      </td>
                      <td className="text-right px-4 py-3">
                        <div className="flex items-center justify-end gap-1.5">
                          {tw.status === 'SUBMITTED' && (
                            <>
                              <button
                                onClick={() => updateStatus(tw.id, 'APPROVED')}
                                disabled={actionLoading}
                                className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-600 rounded text-[11px] font-medium hover:bg-emerald-100 transition-colors"
                              >
                                <Check className="w-3 h-3" />
                                Approve
                              </button>
                              <button
                                onClick={() => setActionWeekId(tw.id)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-50 text-amber-600 rounded text-[11px] font-medium hover:bg-amber-100 transition-colors"
                              >
                                <MessageSquare className="w-3 h-3" />
                                Return
                              </button>
                              <button
                                onClick={() => setActionWeekId(`reject-${tw.id}`)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 bg-red-50 text-red-600 rounded text-[11px] font-medium hover:bg-red-100 transition-colors"
                              >
                                <X className="w-3 h-3" />
                                Reject
                              </button>
                            </>
                          )}
                          {tw.status === 'APPROVED' && (
                            <button
                              onClick={() => updateStatus(tw.id, 'LOCKED')}
                              disabled={actionLoading}
                              className="inline-flex items-center gap-1 px-2.5 py-1 bg-violet-50 text-violet-600 rounded text-[11px] font-medium hover:bg-violet-100 transition-colors"
                            >
                              <Lock className="w-3 h-3" />
                              Lock
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Return / Reject reason modal */}
          {actionWeekId && (
            <div className="bg-white rounded-xl border border-ink-100 p-5">
              <h3 className="text-[14px] font-semibold text-ink-800 mb-3">
                {actionWeekId.startsWith('reject-') ? 'Reject timesheet' : 'Request changes'}
              </h3>
              <textarea
                value={actionReason}
                onChange={e => setActionReason(e.target.value)}
                rows={3}
                placeholder="Provide a reason..."
                className="w-full px-3 py-2 border border-ink-200 rounded-lg text-[13px] focus:ring-2 focus:ring-brand-500 focus:border-brand-500 resize-none"
              />
              <div className="flex items-center justify-end gap-2 mt-3">
                <button
                  onClick={() => { setActionWeekId(null); setActionReason('') }}
                  className="px-3 py-1.5 text-[12px] text-ink-500 hover:text-ink-700"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    if (!actionReason.trim()) {
                      toast('Please provide a reason', 'error')
                      return
                    }
                    const isReject = actionWeekId.startsWith('reject-')
                    const weekIdClean = isReject ? actionWeekId.replace('reject-', '') : actionWeekId
                    updateStatus(weekIdClean, isReject ? 'REJECTED' : 'CHANGES_REQUIRED', actionReason.trim())
                  }}
                  disabled={actionLoading}
                  className={cn(
                    'inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-[12px] font-medium text-white transition-colors disabled:opacity-50',
                    actionWeekId.startsWith('reject-') ? 'bg-red-600 hover:bg-red-700' : 'bg-amber-600 hover:bg-amber-700'
                  )}
                >
                  {actionLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {actionWeekId.startsWith('reject-') ? 'Reject' : 'Request changes'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

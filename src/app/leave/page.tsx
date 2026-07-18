'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  CalendarDays, Plus, Loader2, AlertTriangle, RefreshCw,
  X, Check, Clock, Ban, ArrowRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'
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
}

interface LeaveRequest {
  id: string
  leaveType: string
  startDate: string
  endDate: string
  days: number
  reason: string | null
  status: string
  createdAt: string
  profile: { id: string; fullName: string; jobTitle?: string }
  approver: { id: string; fullName: string } | null
}

type FilterStatus = 'ALL' | 'DRAFT' | 'SUBMITTED' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED' | 'WITHDRAWN'

const STATUS_FILTERS: { value: FilterStatus; label: string }[] = [
  { value: 'ALL', label: 'All' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'SUBMITTED', label: 'Submitted' },
  { value: 'UNDER_REVIEW', label: 'Under review' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'WITHDRAWN', label: 'Withdrawn' },
]

const LEAVE_TYPES: { value: string; label: string }[] = [
  { value: 'ANNUAL', label: 'Annual leave' },
  { value: 'SICK', label: 'Sick leave' },
  { value: 'COMPASSIONATE', label: 'Compassionate leave' },
  { value: 'UNPAID', label: 'Unpaid leave' },
]

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  DRAFT: { label: 'Draft', color: 'text-ink-500', bg: 'bg-ink-100' },
  SUBMITTED: { label: 'Submitted', color: 'text-blue-600', bg: 'bg-blue-50' },
  UNDER_REVIEW: { label: 'Under review', color: 'text-amber-600', bg: 'bg-amber-50' },
  APPROVED: { label: 'Approved', color: 'text-emerald-600', bg: 'bg-emerald-50' },
  REJECTED: { label: 'Rejected', color: 'text-red-600', bg: 'bg-red-50' },
  FULFILMENT_IN_PROGRESS: { label: 'In progress', color: 'text-blue-600', bg: 'bg-blue-50' },
  COMPLETED: { label: 'Completed', color: 'text-emerald-600', bg: 'bg-emerald-50' },
  WITHDRAWN: { label: 'Withdrawn', color: 'text-ink-400', bg: 'bg-ink-50' },
}

/* ── Helpers ───────────────────────────────────────────── */

function formatDateRange(start: string, end: string): string {
  const s = new Date(start)
  const e = new Date(end)
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }
  if (s.getFullYear() !== new Date().getFullYear()) {
    return `${s.toLocaleDateString('en-GB', { ...opts, year: 'numeric' })} – ${e.toLocaleDateString('en-GB', { ...opts, year: 'numeric' })}`
  }
  return `${s.toLocaleDateString('en-GB', opts)} – ${e.toLocaleDateString('en-GB', opts)}`
}

function StatusBadge({ status }: { status: string }) {
  const meta = STATUS_META[status] || { label: status, color: 'text-ink-500', bg: 'bg-ink-100' }
  return (
    <span className={cn('text-[11px] font-medium px-2.5 py-0.5 rounded-full', meta.bg, meta.color)}>
      {meta.label}
    </span>
  )
}

/* ── Page ──────────────────────────────────────────────── */

export default function LeavePage() {
  const { toast } = useToast()

  const [balance, setBalance] = useState<LeaveBalance | null>(null)
  const [requests, setRequests] = useState<LeaveRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('ALL')

  // Create form state
  const [showForm, setShowForm] = useState(false)
  const [formType, setFormType] = useState('ANNUAL')
  const [formStart, setFormStart] = useState('')
  const [formEnd, setFormEnd] = useState('')
  const [formReason, setFormReason] = useState('')
  const { mutate: createLeave, loading: creating } = useApiMutation<LeaveRequest>('/api/leave/requests', 'POST')

  const fetchData = useCallback(async () => {
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

  useEffect(() => {
    fetchData()
  }, [fetchData])

  /* ── Create handler ──────────────────────────────── */

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formStart || !formEnd) return

    const result = await createLeave({
      leaveType: formType,
      startDate: formStart,
      endDate: formEnd,
      reason: formReason || undefined,
    })

    if (result) {
      toast('Leave request created', 'success')
      setShowForm(false)
      setFormType('ANNUAL')
      setFormStart('')
      setFormEnd('')
      setFormReason('')
      fetchData()
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
  }

  /* ── Quick actions on requests ───────────────────── */

  const handleStatusChange = async (id: string, newStatus: string) => {
    try {
      const res = await fetch(`/api/leave/requests/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error?.message || 'Failed to update')
      }
      toast(`Leave request ${newStatus.toLowerCase().replace(/_/g, ' ')}`, 'success')
      fetchData()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to update', 'error')
    }
  }

  /* ── Filter ──────────────────────────────────────── */

  const filtered = statusFilter === 'ALL' ? requests : requests.filter((r) => r.status === statusFilter)
  const statusCounts = requests.reduce<Record<string, number>>((acc, r) => {
    acc[r.status] = (acc[r.status] || 0) + 1
    return acc
  }, {})

  /* ── Loading ─────────────────────────────────────── */

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-40 bg-ink-100 animate-pulse rounded" />
        <div className="grid grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
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
        <button onClick={fetchData} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-ink-900 text-white text-[13px] font-medium hover:bg-ink-800 transition-colors">
          <RefreshCw className="w-4 h-4" /> Try again
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* ── Header ─────────────────────────────────── */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-[22px] font-semibold text-ink-900">Leave</h1>
          <p className="text-[12px] text-ink-400 mt-0.5">
            {balance?.year} · {requests.length} requests
          </p>
        </div>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-ink-900 text-white text-[12px] font-medium hover:bg-ink-800 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Request leave
          </button>
        )}
      </div>

      {/* ── Balance cards ──────────────────────────── */}
      {balance && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <BalanceCard label="Allocation" value={balance.allocation} icon={CalendarDays} accent="bg-blue-50 text-blue-600" />
          <BalanceCard label="Used" value={balance.used} icon={Check} accent="bg-ink-50 text-ink-500" />
          <BalanceCard label="Pending" value={balance.pending} icon={Clock} accent="bg-amber-50 text-amber-600" />
          <BalanceCard
            label="Available"
            value={balance.available}
            icon={CalendarDays}
            accent={balance.available <= 3 ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'}
          />
        </div>
      )}

      {/* ── Create form ────────────────────────────── */}
      {showForm && (
        <form onSubmit={handleCreate} className="bg-white rounded-xl border-2 border-accent-200 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-[14px] font-semibold text-ink-900">New leave request</h3>
            <button type="button" onClick={cancelForm} className="text-ink-400 hover:text-ink-600 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
            <div>
              <label htmlFor="leave-start" className="block text-[11px] font-medium text-ink-500 mb-1">
                Start date <span className="text-red-400">*</span>
              </label>
              <input
                id="leave-start"
                type="date"
                value={formStart}
                onChange={(e) => setFormStart(e.target.value)}
                className="w-full px-3 py-2 text-[13px] border border-ink-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-300"
                required
              />
            </div>
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
          </div>

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
          const count = f.value === 'ALL' ? requests.length : (statusCounts[f.value] || 0)
          if (f.value !== 'ALL' && count === 0) return null
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
          <p className="text-[12px] text-ink-400 mt-1">Click "Request leave" to get started.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-ink-100 divide-y divide-ink-50">
          {filtered.map((req) => (
            <div key={req.id} className="flex items-center gap-4 px-5 py-4">
              {/* Type icon */}
              <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                <CalendarDays className="w-4 h-4 text-blue-500" />
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-medium text-ink-900">
                  {LEAVE_TYPES.find((t) => t.value === req.leaveType)?.label || req.leaveType}
                </p>
                <p className="text-[11px] text-ink-400 mt-0.5">
                  {formatDateRange(req.startDate, req.endDate)} · {req.days} {req.days === 1 ? 'day' : 'days'}
                  {req.reason && <span> · {req.reason}</span>}
                </p>
              </div>

              {/* Status */}
              <StatusBadge status={req.status} />

              {/* Quick actions */}
              <div className="flex items-center gap-1.5 shrink-0">
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
              </div>
            </div>
          ))}
        </div>
      )}
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

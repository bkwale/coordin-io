'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  CheckCircle2, Loader2, ShieldCheck, ChevronRight, Check, X, Clock,
  FileText, CreditCard,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useToast } from '@/components/Toast'
import { SkeletonRow } from '@/components/Skeleton'

/* ── Types ─────────────────────────────────────────────── */

interface ApprovalRequest {
  id: string
  type: 'leave' | 'expense'
  // Leave fields
  leaveType?: string
  startDate?: string
  endDate?: string
  days?: number
  halfDay?: boolean
  halfDayPeriod?: string | null
  reason?: string | null
  // Expense fields
  description?: string
  amount?: number
  currency?: string
  category?: string
  // Common
  status: string
  createdAt: string
  profile: { id: string; fullName: string; jobTitle?: string }
  approver: { id: string; fullName: string } | null
}

/* ── Constants ─────────────────────────────────────────── */

const LEAVE_TYPE_LABELS: Record<string, string> = {
  ANNUAL: 'Annual leave',
  SICK: 'Sick leave',
  COMPASSIONATE: 'Compassionate leave',
  PARENTAL: 'Parental leave',
  MATERNITY: 'Maternity leave',
  PATERNITY: 'Paternity leave',
  STUDY: 'Study leave',
  CPD_TRAINING: 'CPD / Training',
  UNPAID: 'Unpaid leave',
  TOIL: 'TOIL',
  BUSINESS_TRAVEL: 'Business travel',
  PUBLIC_HOLIDAY: 'Public holiday',
  OTHER: 'Other',
}

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  SUBMITTED: { label: 'Submitted', color: 'text-blue-600', bg: 'bg-blue-50' },
  LINE_MANAGER_APPROVED: { label: 'Manager approved', color: 'text-cyan-600', bg: 'bg-cyan-50' },
  HR_APPROVED: { label: 'HR approved', color: 'text-violet-600', bg: 'bg-violet-50' },
  PENDING: { label: 'Pending', color: 'text-amber-600', bg: 'bg-amber-50' },
}

/* ── Helpers ───────────────────────────────────────────── */

function StatusBadge({ status }: { status: string }) {
  const meta = STATUS_META[status] ?? { label: status, color: 'text-ink-500', bg: 'bg-ink-100' }
  return (
    <span className={cn('text-[11px] font-medium px-2.5 py-1 rounded-full', meta.bg, meta.color)}>
      {meta.label}
    </span>
  )
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function formatDateRange(start: string, end: string) {
  return `${formatDate(start)} – ${formatDate(end)}`
}

/* ── Page ──────────────────────────────────────────────── */

export default function ApprovalsPage() {
  const [requests, setRequests] = useState<ApprovalRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [comment, setComment] = useState('')
  const [acting, setActing] = useState<string | null>(null)
  const { toast } = useToast()

  const fetchApprovals = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      // Fetch leave requests pending this user's approval
      const leaveRes = await fetch('/api/leave/requests?role=approver')
      const leaveData = await leaveRes.json()

      const leaveItems: ApprovalRequest[] = (leaveData?.data?.requests ?? []).map(
        (r: ApprovalRequest) => ({ ...r, type: 'leave' as const })
      )

      // Fetch expense claims pending approval
      let expenseItems: ApprovalRequest[] = []
      try {
        const expRes = await fetch('/api/expenses?role=approver')
        const expData = await expRes.json()
        expenseItems = (expData?.data?.claims ?? []).map(
          (r: ApprovalRequest) => ({ ...r, type: 'expense' as const })
        )
      } catch {
        // Expense approver endpoint may not exist yet — skip
      }

      setRequests([...leaveItems, ...expenseItems])
    } catch {
      setError('Failed to load approvals')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchApprovals() }, [fetchApprovals])

  const handleAction = async (id: string, type: 'leave' | 'expense', newStatus: string) => {
    setActing(id)
    try {
      const url = type === 'leave'
        ? `/api/leave/requests/${id}`
        : `/api/expenses/${id}`

      const res = await fetch(url, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus, comment: comment || undefined }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data?.error ?? 'Action failed')
      }

      toast(newStatus === 'REJECTED' ? 'Request rejected' : 'Request approved', 'success')
      setComment('')
      setExpandedId(null)
      fetchApprovals()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Action failed', 'error')
    } finally {
      setActing(null)
    }
  }

  /* ── Loading ──────────────────────────────────── */
  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-[22px] font-semibold text-ink-900">Approvals</h1>
          <p className="text-[13px] text-ink-400 mt-1">Review and approve pending requests</p>
        </div>
        <div className="bg-white rounded-xl border border-ink-100 divide-y divide-ink-50">
          {Array.from({ length: 3 }).map((_, i) => <SkeletonRow key={i} />)}
        </div>
      </div>
    )
  }

  /* ── Error ─────────────────────────────────────── */
  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-[22px] font-semibold text-ink-900">Approvals</h1>
          <p className="text-[13px] text-ink-400 mt-1">Review and approve pending requests</p>
        </div>
        <div className="bg-white rounded-xl border border-ink-100 p-12 text-center">
          <p className="text-[14px] text-red-600">{error}</p>
          <button onClick={fetchApprovals} className="mt-3 text-[12px] text-accent-600 hover:underline">
            Try again
          </button>
        </div>
      </div>
    )
  }

  /* ── Empty state ───────────────────────────────── */
  if (requests.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-[22px] font-semibold text-ink-900">Approvals</h1>
          <p className="text-[13px] text-ink-400 mt-1">Review and approve pending requests</p>
        </div>
        <div className="bg-white rounded-xl border border-ink-100 p-12 text-center">
          <CheckCircle2 className="w-12 h-12 text-ink-200 mx-auto mb-4" />
          <p className="text-[15px] font-medium text-ink-700">No pending approvals</p>
          <p className="text-[12px] text-ink-400 mt-2 max-w-md mx-auto">
            Leave requests, expense claims, and document approvals will appear here when submitted.
          </p>
        </div>
      </div>
    )
  }

  /* ── Request list ──────────────────────────────── */
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[22px] font-semibold text-ink-900">Approvals</h1>
        <p className="text-[13px] text-ink-400 mt-1">
          {requests.length} pending {requests.length === 1 ? 'request' : 'requests'}
        </p>
      </div>

      <div className="space-y-3">
        {requests.map((req) => {
          const isExpanded = expandedId === req.id
          const isActing = acting === req.id

          // Determine next approval status for leave
          let approveStatus = 'APPROVED'
          let approveLabel = 'Approve'
          if (req.type === 'leave') {
            if (req.status === 'SUBMITTED') {
              approveStatus = 'LINE_MANAGER_APPROVED'
              approveLabel = 'Approve (Line Manager)'
            } else if (req.status === 'LINE_MANAGER_APPROVED') {
              approveStatus = 'HR_APPROVED'
              approveLabel = 'Approve (HR)'
            }
          }

          const typeIcon = req.type === 'expense'
            ? <CreditCard className="w-4 h-4" />
            : <Clock className="w-4 h-4" />

          const subtitle = req.type === 'leave'
            ? `${LEAVE_TYPE_LABELS[req.leaveType ?? ''] ?? req.leaveType} · ${formatDateRange(req.startDate ?? '', req.endDate ?? '')} · ${req.days} ${req.days === 1 || req.days === 0.5 ? 'day' : 'days'}`
            : `${req.category ?? 'Expense'} · ${req.currency ?? '£'}${(req.amount ?? 0).toLocaleString()}`

          return (
            <div key={req.id} className="bg-white rounded-xl border border-ink-100 overflow-hidden">
              {/* Summary row */}
              <div
                className="flex items-center gap-4 px-5 py-4 cursor-pointer hover:bg-ink-25 transition-colors"
                onClick={() => setExpandedId(isExpanded ? null : req.id)}
              >
                <div className="w-9 h-9 rounded-full bg-blue-50 flex items-center justify-center shrink-0 text-[12px] font-semibold text-blue-600">
                  {req.profile.fullName.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium text-ink-900">{req.profile.fullName}</p>
                  <p className="text-[11px] text-ink-400 mt-0.5 flex items-center gap-1">
                    {typeIcon}
                    {subtitle}
                  </p>
                </div>

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
                    {req.type === 'leave' && (
                      <>
                        <div>
                          <p className="text-ink-400 mb-0.5">Type</p>
                          <p className="text-ink-900 font-medium">{LEAVE_TYPE_LABELS[req.leaveType ?? ''] ?? req.leaveType}</p>
                        </div>
                        <div>
                          <p className="text-ink-400 mb-0.5">Dates</p>
                          <p className="text-ink-900 font-medium">{formatDateRange(req.startDate ?? '', req.endDate ?? '')}</p>
                        </div>
                        <div>
                          <p className="text-ink-400 mb-0.5">Duration</p>
                          <p className="text-ink-900 font-medium">
                            {req.days} {req.days === 1 || req.days === 0.5 ? 'day' : 'days'}
                            {req.halfDay && ` (${req.halfDayPeriod})`}
                          </p>
                        </div>
                      </>
                    )}
                    {req.type === 'expense' && (
                      <>
                        <div>
                          <p className="text-ink-400 mb-0.5">Category</p>
                          <p className="text-ink-900 font-medium">{req.category ?? '—'}</p>
                        </div>
                        <div>
                          <p className="text-ink-400 mb-0.5">Amount</p>
                          <p className="text-ink-900 font-medium">{req.currency ?? '£'}{(req.amount ?? 0).toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-ink-400 mb-0.5">Submitted</p>
                          <p className="text-ink-900 font-medium">{formatDate(req.createdAt)}</p>
                        </div>
                      </>
                    )}
                  </div>

                  {req.reason && (
                    <div className="text-[12px]">
                      <p className="text-ink-400 mb-0.5">Reason</p>
                      <p className="text-ink-700">{req.reason}</p>
                    </div>
                  )}
                  {req.description && (
                    <div className="text-[12px]">
                      <p className="text-ink-400 mb-0.5">Description</p>
                      <p className="text-ink-700">{req.description}</p>
                    </div>
                  )}

                  {/* Comment field */}
                  <div>
                    <label className="block text-[11px] font-medium text-ink-500 mb-1">
                      Comment (optional)
                    </label>
                    <input
                      type="text"
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      placeholder="Add a comment..."
                      className="w-full px-3 py-2 text-[12px] border border-ink-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-300 placeholder:text-ink-300"
                      maxLength={1000}
                    />
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center gap-2">
                    <button
                      disabled={isActing}
                      onClick={() => handleAction(req.id, req.type, approveStatus)}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 text-white text-[12px] font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50"
                    >
                      {isActing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                      {approveLabel}
                    </button>
                    <button
                      disabled={isActing}
                      onClick={() => handleAction(req.id, req.type, 'REJECTED')}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-red-600 text-white text-[12px] font-medium hover:bg-red-700 transition-colors disabled:opacity-50"
                    >
                      {isActing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
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

'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  FileText, Plus, Loader2, AlertTriangle, RefreshCw,
  X, ArrowRight, Ban,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useToast } from '@/components/Toast'
import { useApiMutation } from '@/hooks/use-api'
import { SkeletonRow } from '@/components/Skeleton'

/* ── Types ─────────────────────────────────────────────── */

interface ServiceRequest {
  id: string
  requestType: string
  title: string
  description: string | null
  status: string
  createdAt: string
  profile: { id: string; fullName: string; jobTitle?: string }
  approver: { id: string; fullName: string } | null
}

type FilterStatus = 'ALL' | 'DRAFT' | 'SUBMITTED' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED' | 'COMPLETED' | 'WITHDRAWN'

const STATUS_FILTERS: { value: FilterStatus; label: string }[] = [
  { value: 'ALL', label: 'All' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'SUBMITTED', label: 'Submitted' },
  { value: 'UNDER_REVIEW', label: 'Under review' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'WITHDRAWN', label: 'Withdrawn' },
]

const REQUEST_TYPES: { value: string; label: string }[] = [
  { value: 'IT_SUPPORT', label: 'IT Support' },
  { value: 'EQUIPMENT', label: 'Equipment' },
  { value: 'PPE', label: 'PPE' },
  { value: 'SOFTWARE_LICENCE', label: 'Software Licence' },
  { value: 'TRAINING', label: 'Training' },
  { value: 'BOOKS_STANDARDS', label: 'Books & Standards' },
  { value: 'TRAVEL', label: 'Travel' },
  { value: 'FLIGHTS_ACCOMMODATION', label: 'Flights & Accommodation' },
  { value: 'OFFICE_SUPPLIES', label: 'Office Supplies' },
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

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
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

export default function ServiceRequestsPage() {
  const { toast } = useToast()

  const [requests, setRequests] = useState<ServiceRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('ALL')

  // Create form state
  const [showForm, setShowForm] = useState(false)
  const [formType, setFormType] = useState('IT_SUPPORT')
  const [formTitle, setFormTitle] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const { mutate: createRequest, loading: creating } = useApiMutation<ServiceRequest>('/api/service-requests', 'POST')

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/service-requests')
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error?.message || 'Failed to load service requests')
      }
      const json = await res.json()
      setRequests(json.data.requests)
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
    if (!formTitle) return

    const result = await createRequest({
      requestType: formType,
      title: formTitle,
      description: formDescription || undefined,
    })

    if (result) {
      toast('Service request created', 'success')
      setShowForm(false)
      setFormType('IT_SUPPORT')
      setFormTitle('')
      setFormDescription('')
      fetchData()
    } else {
      toast('Failed to create service request', 'error')
    }
  }

  const cancelForm = () => {
    setShowForm(false)
    setFormType('IT_SUPPORT')
    setFormTitle('')
    setFormDescription('')
  }

  /* ── Status change ───────────────────────────────── */

  const handleStatusChange = async (id: string, newStatus: string) => {
    try {
      const res = await fetch(`/api/service-requests/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error?.message || 'Failed to update')
      }
      toast(`Request ${newStatus.toLowerCase().replace(/_/g, ' ')}`, 'success')
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
        <div className="h-8 w-48 bg-ink-100 animate-pulse rounded" />
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
          <h1 className="text-[22px] font-semibold text-ink-900">Service Requests</h1>
          <p className="text-[12px] text-ink-400 mt-0.5">
            {requests.length} requests
          </p>
        </div>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-ink-900 text-white text-[12px] font-medium hover:bg-ink-800 transition-colors"
          >
            <Plus className="w-4 h-4" />
            New request
          </button>
        )}
      </div>

      {/* ── Create form ────────────────────────────── */}
      {showForm && (
        <form onSubmit={handleCreate} className="bg-white rounded-xl border-2 border-accent-200 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-[14px] font-semibold text-ink-900">New service request</h3>
            <button type="button" onClick={cancelForm} className="text-ink-400 hover:text-ink-600 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="sr-type" className="block text-[11px] font-medium text-ink-500 mb-1">Type</label>
              <select
                id="sr-type"
                value={formType}
                onChange={(e) => setFormType(e.target.value)}
                className="w-full px-3 py-2 text-[13px] border border-ink-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-300 bg-white"
              >
                {REQUEST_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="sr-title" className="block text-[11px] font-medium text-ink-500 mb-1">
                Title <span className="text-red-400">*</span>
              </label>
              <input
                id="sr-title"
                type="text"
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                placeholder="e.g. New laptop for site visits"
                className="w-full px-3 py-2 text-[13px] border border-ink-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-300 placeholder:text-ink-300"
                required
                maxLength={200}
              />
            </div>
          </div>

          <div>
            <label htmlFor="sr-desc" className="block text-[11px] font-medium text-ink-500 mb-1">Description (optional)</label>
            <textarea
              id="sr-desc"
              value={formDescription}
              onChange={(e) => setFormDescription(e.target.value)}
              placeholder="Provide additional details..."
              className="w-full px-3 py-2 text-[13px] border border-ink-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-300 placeholder:text-ink-300 resize-none"
              rows={3}
              maxLength={2000}
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-1">
            <button type="button" onClick={cancelForm} className="px-3.5 py-2 text-[12px] font-medium text-ink-500 hover:text-ink-700 transition-colors" disabled={creating}>
              Cancel
            </button>
            <button
              type="submit"
              disabled={creating || !formTitle}
              className={cn(
                'flex items-center gap-1.5 px-4 py-2 rounded-lg text-[12px] font-medium transition-colors',
                creating || !formTitle
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
          <FileText className="w-10 h-10 text-ink-200 mx-auto mb-3" />
          <p className="text-[14px] font-medium text-ink-600">No service requests</p>
          <p className="text-[12px] text-ink-400 mt-1">Click &quot;New request&quot; to get started.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-ink-100 divide-y divide-ink-50">
          {filtered.map((req) => (
            <div key={req.id} className="flex items-center gap-4 px-5 py-4">
              {/* Icon */}
              <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                <FileText className="w-4 h-4 text-blue-500" />
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-medium text-ink-900 truncate">{req.title}</p>
                <p className="text-[11px] text-ink-400 mt-0.5">
                  {REQUEST_TYPES.find((t) => t.value === req.requestType)?.label || req.requestType}
                  {' · '}{formatDate(req.createdAt)}
                  {req.description && <span> · {req.description.slice(0, 60)}{req.description.length > 60 ? '...' : ''}</span>}
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

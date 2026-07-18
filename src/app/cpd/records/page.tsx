'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  BookOpen, Plus, Loader2, AlertTriangle, RefreshCw,
  X, Check, ArrowRight, RotateCcw,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useToast } from '@/components/Toast'
import { useApiMutation } from '@/hooks/use-api'
import { SkeletonRow } from '@/components/Skeleton'

/* ── Types ─────────────────────────────────────────────── */

interface CPDRecord {
  id: string
  title: string
  provider: string | null
  date: string
  durationHours: number
  topic: string | null
  learningOutcome: string | null
  evidenceUrl: string | null
  status: string
  verifiedBy: { id: string; fullName: string } | null
  verifiedAt: string | null
  createdAt: string
  profile: { id: string; fullName: string; jobTitle?: string }
}

type FilterStatus = 'ALL' | 'DRAFT' | 'SUBMITTED' | 'VERIFIED' | 'RETURNED'

const STATUS_FILTERS: { value: FilterStatus; label: string }[] = [
  { value: 'ALL', label: 'All' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'SUBMITTED', label: 'Submitted' },
  { value: 'VERIFIED', label: 'Verified' },
  { value: 'RETURNED', label: 'Returned' },
]

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  DRAFT: { label: 'Draft', color: 'text-ink-500', bg: 'bg-ink-100' },
  SUBMITTED: { label: 'Submitted', color: 'text-blue-600', bg: 'bg-blue-50' },
  VERIFIED: { label: 'Verified', color: 'text-emerald-600', bg: 'bg-emerald-50' },
  RETURNED: { label: 'Returned', color: 'text-amber-600', bg: 'bg-amber-50' },
}

/* ── Helpers ───────────────────────────────────────────── */

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
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

export default function CPDRecordsPage() {
  const { toast } = useToast()

  const [records, setRecords] = useState<CPDRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('ALL')

  // Create form state
  const [showForm, setShowForm] = useState(false)
  const [formTitle, setFormTitle] = useState('')
  const [formProvider, setFormProvider] = useState('')
  const [formDate, setFormDate] = useState('')
  const [formHours, setFormHours] = useState('')
  const [formTopic, setFormTopic] = useState('')
  const [formOutcome, setFormOutcome] = useState('')
  const { mutate: createRecord, loading: creating } = useApiMutation<CPDRecord>('/api/cpd', 'POST')

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/cpd')
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error?.message || 'Failed to load CPD records')
      }
      const json = await res.json()
      setRecords(json.data.records)
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
    if (!formTitle || !formDate || !formHours) return

    const result = await createRecord({
      title: formTitle,
      provider: formProvider || undefined,
      date: formDate,
      durationHours: parseFloat(formHours),
      topic: formTopic || undefined,
      learningOutcome: formOutcome || undefined,
    })

    if (result) {
      toast('CPD record created', 'success')
      setShowForm(false)
      resetForm()
      fetchData()
    } else {
      toast('Failed to create CPD record', 'error')
    }
  }

  const resetForm = () => {
    setFormTitle('')
    setFormProvider('')
    setFormDate('')
    setFormHours('')
    setFormTopic('')
    setFormOutcome('')
  }

  const cancelForm = () => {
    setShowForm(false)
    resetForm()
  }

  /* ── Status change handler ───────────────────────── */

  const handleStatusChange = async (id: string, newStatus: string) => {
    try {
      const res = await fetch(`/api/cpd/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error?.message || 'Failed to update')
      }
      toast(`CPD record ${newStatus.toLowerCase()}`, 'success')
      fetchData()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to update', 'error')
    }
  }

  /* ── Filter ──────────────────────────────────────── */

  const filtered = statusFilter === 'ALL' ? records : records.filter((r) => r.status === statusFilter)
  const statusCounts = records.reduce<Record<string, number>>((acc, r) => {
    acc[r.status] = (acc[r.status] || 0) + 1
    return acc
  }, {})

  const totalHours = records.reduce((sum, r) => sum + r.durationHours, 0)

  /* ── Loading ─────────────────────────────────────── */

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-40 bg-ink-100 animate-pulse rounded" />
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
          <h1 className="text-[22px] font-semibold text-ink-900">CPD Records</h1>
          <p className="text-[12px] text-ink-400 mt-0.5">
            {records.length} records · {totalHours} hours logged
          </p>
        </div>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-ink-900 text-white text-[12px] font-medium hover:bg-ink-800 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add CPD record
          </button>
        )}
      </div>

      {/* ── Create form ────────────────────────────── */}
      {showForm && (
        <form onSubmit={handleCreate} className="bg-white rounded-xl border-2 border-accent-200 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-[14px] font-semibold text-ink-900">New CPD record</h3>
            <button type="button" onClick={cancelForm} className="text-ink-400 hover:text-ink-600 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label htmlFor="cpd-title" className="block text-[11px] font-medium text-ink-500 mb-1">
                Title <span className="text-red-400">*</span>
              </label>
              <input
                id="cpd-title"
                type="text"
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                placeholder="e.g. Revit Advanced Modelling Workshop"
                className="w-full px-3 py-2 text-[13px] border border-ink-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-300 placeholder:text-ink-300"
                required
                maxLength={200}
              />
            </div>
            <div>
              <label htmlFor="cpd-provider" className="block text-[11px] font-medium text-ink-500 mb-1">Provider</label>
              <input
                id="cpd-provider"
                type="text"
                value={formProvider}
                onChange={(e) => setFormProvider(e.target.value)}
                placeholder="e.g. RIBA CPD"
                className="w-full px-3 py-2 text-[13px] border border-ink-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-300 placeholder:text-ink-300"
                maxLength={200}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label htmlFor="cpd-date" className="block text-[11px] font-medium text-ink-500 mb-1">
                Date <span className="text-red-400">*</span>
              </label>
              <input
                id="cpd-date"
                type="date"
                value={formDate}
                onChange={(e) => setFormDate(e.target.value)}
                className="w-full px-3 py-2 text-[13px] border border-ink-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-300"
                required
              />
            </div>
            <div>
              <label htmlFor="cpd-hours" className="block text-[11px] font-medium text-ink-500 mb-1">
                Hours <span className="text-red-400">*</span>
              </label>
              <input
                id="cpd-hours"
                type="number"
                step="0.5"
                min="0.5"
                value={formHours}
                onChange={(e) => setFormHours(e.target.value)}
                placeholder="e.g. 2"
                className="w-full px-3 py-2 text-[13px] border border-ink-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-300 placeholder:text-ink-300"
                required
              />
            </div>
            <div>
              <label htmlFor="cpd-topic" className="block text-[11px] font-medium text-ink-500 mb-1">Topic</label>
              <input
                id="cpd-topic"
                type="text"
                value={formTopic}
                onChange={(e) => setFormTopic(e.target.value)}
                placeholder="e.g. BIM Level 2"
                className="w-full px-3 py-2 text-[13px] border border-ink-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-300 placeholder:text-ink-300"
                maxLength={500}
              />
            </div>
          </div>

          <div>
            <label htmlFor="cpd-outcome" className="block text-[11px] font-medium text-ink-500 mb-1">Learning outcome</label>
            <textarea
              id="cpd-outcome"
              value={formOutcome}
              onChange={(e) => setFormOutcome(e.target.value)}
              placeholder="What did you learn or achieve?"
              className="w-full px-3 py-2 text-[13px] border border-ink-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-300 placeholder:text-ink-300 resize-none"
              rows={2}
              maxLength={2000}
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-1">
            <button type="button" onClick={cancelForm} className="px-3.5 py-2 text-[12px] font-medium text-ink-500 hover:text-ink-700 transition-colors" disabled={creating}>
              Cancel
            </button>
            <button
              type="submit"
              disabled={creating || !formTitle || !formDate || !formHours}
              className={cn(
                'flex items-center gap-1.5 px-4 py-2 rounded-lg text-[12px] font-medium transition-colors',
                creating || !formTitle || !formDate || !formHours
                  ? 'bg-ink-200 text-ink-400 cursor-not-allowed'
                  : 'bg-ink-900 text-white hover:bg-ink-800',
              )}
            >
              {creating && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Create record
            </button>
          </div>
        </form>
      )}

      {/* ── Filter bar ─────────────────────────────── */}
      <div className="flex gap-1 flex-wrap">
        {STATUS_FILTERS.map((f) => {
          const count = f.value === 'ALL' ? records.length : (statusCounts[f.value] || 0)
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

      {/* ── Record list ───────────────────────────── */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-ink-100 p-10 text-center">
          <BookOpen className="w-10 h-10 text-ink-200 mx-auto mb-3" />
          <p className="text-[14px] font-medium text-ink-600">No CPD records</p>
          <p className="text-[12px] text-ink-400 mt-1">Click &quot;Add CPD record&quot; to get started.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-ink-100 divide-y divide-ink-50">
          {filtered.map((rec) => (
            <div key={rec.id} className="flex items-center gap-4 px-5 py-4">
              {/* Icon */}
              <div className="w-9 h-9 rounded-lg bg-purple-50 flex items-center justify-center shrink-0">
                <BookOpen className="w-4 h-4 text-purple-500" />
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-medium text-ink-900 truncate">{rec.title}</p>
                <p className="text-[11px] text-ink-400 mt-0.5">
                  {formatDate(rec.date)} · {rec.durationHours}h
                  {rec.provider && <span> · {rec.provider}</span>}
                  {rec.topic && <span> · {rec.topic}</span>}
                </p>
              </div>

              {/* Status */}
              <StatusBadge status={rec.status} />

              {/* Quick actions */}
              <div className="flex items-center gap-1.5 shrink-0">
                {rec.status === 'DRAFT' && (
                  <button
                    onClick={() => handleStatusChange(rec.id, 'SUBMITTED')}
                    className="p-1.5 rounded-md text-blue-500 hover:bg-blue-50 transition-colors"
                    title="Submit for verification"
                  >
                    <ArrowRight className="w-4 h-4" />
                  </button>
                )}
                {rec.status === 'SUBMITTED' && (
                  <>
                    <button
                      onClick={() => handleStatusChange(rec.id, 'VERIFIED')}
                      className="p-1.5 rounded-md text-emerald-500 hover:bg-emerald-50 transition-colors"
                      title="Verify"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleStatusChange(rec.id, 'RETURNED')}
                      className="p-1.5 rounded-md text-amber-500 hover:bg-amber-50 transition-colors"
                      title="Return for changes"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>
                  </>
                )}
                {rec.status === 'RETURNED' && (
                  <button
                    onClick={() => handleStatusChange(rec.id, 'SUBMITTED')}
                    className="p-1.5 rounded-md text-blue-500 hover:bg-blue-50 transition-colors"
                    title="Resubmit"
                  >
                    <ArrowRight className="w-4 h-4" />
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

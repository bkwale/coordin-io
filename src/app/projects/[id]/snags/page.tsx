'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import {
  Plus, Filter, Loader2, AlertTriangle, RefreshCw, X,
  ChevronRight, Building2, Calendar,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useToast } from '@/components/Toast'
import { useApiMutation } from '@/hooks/use-api'
import { SkeletonRow } from '@/components/Skeleton'
import type { SnagStatus, SnagCategory, SnagSeverity } from '@/generated/prisma/client'

/* ── Types ─────────────────────────────────────────────── */

interface SnagListItem {
  id: string
  description: string
  category: SnagCategory
  severity: SnagSeverity
  status: SnagStatus
  block: string | null
  floor: string | null
  room: string | null
  element: string | null
  drawingRef: string | null
  specRef: string | null
  responsibleOrg: string | null
  targetDate: string | null
  createdAt: string
  createdBy: { id: string; fullName: string }
  verifiedBy: { id: string; fullName: string } | null
  closedAt: string | null
}

/* ── Labels ────────────────────────────────────────────── */

const STATUS_LABELS: Record<string, string> = {
  OPEN: 'Open',
  ASSIGNED: 'Assigned',
  RECTIFICATION_SUBMITTED: 'Rectification submitted',
  VERIFICATION: 'Verification',
  CLOSED: 'Closed',
  REOPENED: 'Reopened',
}

const STATUS_META: Record<string, { color: string; bgColor: string; dotColor: string }> = {
  OPEN: { color: 'text-blue-700', bgColor: 'bg-blue-50', dotColor: 'bg-blue-500' },
  ASSIGNED: { color: 'text-amber-700', bgColor: 'bg-amber-50', dotColor: 'bg-amber-500' },
  RECTIFICATION_SUBMITTED: { color: 'text-purple-700', bgColor: 'bg-purple-50', dotColor: 'bg-purple-500' },
  VERIFICATION: { color: 'text-orange-700', bgColor: 'bg-orange-50', dotColor: 'bg-orange-500' },
  CLOSED: { color: 'text-emerald-700', bgColor: 'bg-emerald-50', dotColor: 'bg-emerald-500' },
  REOPENED: { color: 'text-red-700', bgColor: 'bg-red-50', dotColor: 'bg-red-500' },
}

const CATEGORY_LABELS: Record<string, string> = {
  ARCHITECTURAL: 'Architectural',
  MEP: 'MEP',
  STRUCTURAL: 'Structural',
  FIRE: 'Fire',
  HEALTH_SAFETY: 'Health & Safety',
  FINISH: 'Finish',
  FF_AND_E: 'FF&E',
  EXTERNAL_WORKS: 'External works',
}

const SEVERITY_LABELS: Record<string, string> = {
  MINOR: 'Minor',
  MODERATE: 'Moderate',
  MAJOR: 'Major',
  SAFETY_CRITICAL: 'Safety critical',
}

const SEVERITY_META: Record<string, { color: string; dotColor: string }> = {
  MINOR: { color: 'text-ink-500', dotColor: 'bg-ink-300' },
  MODERATE: { color: 'text-amber-600', dotColor: 'bg-amber-500' },
  MAJOR: { color: 'text-orange-600', dotColor: 'bg-orange-500' },
  SAFETY_CRITICAL: { color: 'text-red-600', dotColor: 'bg-red-500' },
}

/* ── Valid transitions (mirrors server-side state machine) ── */

const VALID_TRANSITIONS: Record<string, string[]> = {
  OPEN: ['ASSIGNED'],
  ASSIGNED: ['RECTIFICATION_SUBMITTED'],
  RECTIFICATION_SUBMITTED: ['VERIFICATION'],
  VERIFICATION: ['CLOSED', 'REOPENED'],
  REOPENED: ['ASSIGNED'],
  CLOSED: [],
}

type FilterStatus = 'ALL' | SnagStatus

const STATUS_FILTERS: { value: FilterStatus; label: string }[] = [
  { value: 'ALL', label: 'All' },
  { value: 'OPEN', label: 'Open' },
  { value: 'ASSIGNED', label: 'Assigned' },
  { value: 'RECTIFICATION_SUBMITTED', label: 'Rectification' },
  { value: 'VERIFICATION', label: 'Verification' },
  { value: 'CLOSED', label: 'Closed' },
  { value: 'REOPENED', label: 'Reopened' },
]

const ALL_CATEGORIES: SnagCategory[] = [
  'ARCHITECTURAL', 'MEP', 'STRUCTURAL', 'FIRE',
  'HEALTH_SAFETY', 'FINISH', 'FF_AND_E', 'EXTERNAL_WORKS',
]

const ALL_SEVERITIES: SnagSeverity[] = ['MINOR', 'MODERATE', 'MAJOR', 'SAFETY_CRITICAL']

/* ── Page ──────────────────────────────────────────────── */

export default function ProjectSnagsPage() {
  const params = useParams()
  const projectId = params.id as string
  const { toast } = useToast()

  const [snags, setSnags] = useState<SnagListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('ALL')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [severityFilter, setSeverityFilter] = useState('')

  /* ── Create form ──────────────────────────────────── */
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [newDescription, setNewDescription] = useState('')
  const [newCategory, setNewCategory] = useState<SnagCategory>('ARCHITECTURAL')
  const [newSeverity, setNewSeverity] = useState<SnagSeverity>('MINOR')
  const [newBlock, setNewBlock] = useState('')
  const [newFloor, setNewFloor] = useState('')
  const [newRoom, setNewRoom] = useState('')
  const [newElement, setNewElement] = useState('')
  const [newDrawingRef, setNewDrawingRef] = useState('')
  const [newSpecRef, setNewSpecRef] = useState('')
  const [newResponsibleOrg, setNewResponsibleOrg] = useState('')
  const [newTargetDate, setNewTargetDate] = useState('')
  const { mutate: createSnag, loading: creating, error: createError, clearError: clearCreateError } =
    useApiMutation<SnagListItem>(`/api/projects/${projectId}/snags`, 'POST')

  /* ── Quick transition ─────────────────────────────── */
  const [transitioning, setTransitioning] = useState<string | null>(null)

  const handleTransition = async (snagId: string, newStatus: string) => {
    setTransitioning(snagId)
    try {
      const body: Record<string, unknown> = { status: newStatus }
      // ASSIGNED requires a responsibleOrg — prompt with a simple default
      if (newStatus === 'ASSIGNED') {
        const org = prompt('Responsible organisation:')
        if (!org?.trim()) {
          setTransitioning(null)
          return
        }
        body.responsibleOrg = org.trim()
      }
      const res = await fetch(`/api/snags/${snagId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json.error?.message || `Failed (${res.status})`)
      }
      toast(`Snag moved to ${STATUS_LABELS[newStatus] || newStatus}`, 'success')
      fetchSnags()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Transition failed', 'error')
    } finally {
      setTransitioning(null)
    }
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = newDescription.trim()
    if (!trimmed) return

    const body: Record<string, unknown> = {
      description: trimmed,
      category: newCategory,
      severity: newSeverity,
    }
    if (newBlock.trim()) body.block = newBlock.trim()
    if (newFloor.trim()) body.floor = newFloor.trim()
    if (newRoom.trim()) body.room = newRoom.trim()
    if (newElement.trim()) body.element = newElement.trim()
    if (newDrawingRef.trim()) body.drawingRef = newDrawingRef.trim()
    if (newSpecRef.trim()) body.specRef = newSpecRef.trim()
    if (newResponsibleOrg.trim()) body.responsibleOrg = newResponsibleOrg.trim()
    if (newTargetDate) body.targetDate = newTargetDate

    const result = await createSnag(body)
    if (result) {
      toast('Snag created', 'success')
      resetCreateForm()
      fetchSnags()
    } else {
      toast(createError || 'Failed to create snag', 'error')
    }
  }

  const resetCreateForm = () => {
    setShowCreateForm(false)
    setNewDescription('')
    setNewCategory('ARCHITECTURAL')
    setNewSeverity('MINOR')
    setNewBlock('')
    setNewFloor('')
    setNewRoom('')
    setNewElement('')
    setNewDrawingRef('')
    setNewSpecRef('')
    setNewResponsibleOrg('')
    setNewTargetDate('')
    clearCreateError()
  }

  const fetchSnags = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const url = `/api/projects/${projectId}/snags`
      const res = await fetch(url)
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error?.message || `Failed to load (${res.status})`)
      }
      const json = await res.json()
      setSnags(json.data.snags)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    fetchSnags()
  }, [fetchSnags])

  /* ── Filter ─────────────────────────────────────────── */

  let filtered = snags
  if (statusFilter !== 'ALL') {
    filtered = filtered.filter((s) => s.status === statusFilter)
  }
  if (categoryFilter) {
    filtered = filtered.filter((s) => s.category === categoryFilter)
  }
  if (severityFilter) {
    filtered = filtered.filter((s) => s.severity === severityFilter)
  }

  /* ── Stats ──────────────────────────────────────────── */

  const statusCounts = snags.reduce<Record<string, number>>((acc, s) => {
    acc[s.status] = (acc[s.status] || 0) + 1
    return acc
  }, {})

  const openCount = (statusCounts['OPEN'] || 0) + (statusCounts['ASSIGNED'] || 0) + (statusCounts['REOPENED'] || 0)

  /* ── Loading ─────────────────────────────────────────── */

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <div className="h-6 w-32 bg-ink-100 animate-pulse rounded" />
            <div className="h-4 w-48 bg-ink-100 animate-pulse rounded" />
          </div>
        </div>
        <div className="bg-white rounded-xl border border-ink-100 divide-y divide-ink-50">
          {Array.from({ length: 5 }).map((_, i) => (
            <SkeletonRow key={i} />
          ))}
        </div>
      </div>
    )
  }

  /* ── Error ───────────────────────────────────────────── */

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh] gap-4">
        <AlertTriangle className="w-8 h-8 text-red-500" />
        <p className="text-[13px] text-ink-600">{error}</p>
        <button onClick={fetchSnags} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-ink-900 text-white text-[13px] font-medium hover:bg-ink-800 transition-colors">
          <RefreshCw className="w-4 h-4" /> Try again
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* ── Header ─────────────────────────────────────── */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-[18px] font-semibold text-ink-900">Snags</h2>
          <p className="text-[12px] text-ink-400 mt-0.5">
            {snags.length} total · {openCount} open · {statusCounts['CLOSED'] || 0} closed
          </p>
        </div>
        {!showCreateForm && (
          <button
            onClick={() => setShowCreateForm(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-ink-900 text-white text-[12px] font-medium hover:bg-ink-800 transition-colors"
          >
            <Plus className="w-4 h-4" />
            New snag
          </button>
        )}
      </div>

      {/* ── Create form ───────────────────────────── */}
      {showCreateForm && (
        <form
          onSubmit={handleCreate}
          className="bg-white rounded-xl border-2 border-accent-200 p-5 space-y-4"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-[14px] font-semibold text-ink-900">New snag</h3>
            <button type="button" onClick={resetCreateForm} className="text-ink-400 hover:text-ink-600 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Description */}
          <div>
            <label htmlFor="snag-desc" className="block text-[11px] font-medium text-ink-500 mb-1">
              Description <span className="text-red-400">*</span>
            </label>
            <textarea
              id="snag-desc"
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              placeholder="Describe the defect or issue..."
              className="w-full px-3 py-2 text-[13px] border border-ink-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-300 focus:border-accent-400 placeholder:text-ink-300 min-h-[80px]"
              autoFocus
              maxLength={5000}
              required
            />
          </div>

          {/* Category + Severity */}
          <div className="flex gap-4">
            <div className="flex-1">
              <label htmlFor="snag-cat" className="block text-[11px] font-medium text-ink-500 mb-1">Category</label>
              <select id="snag-cat" value={newCategory} onChange={(e) => setNewCategory(e.target.value as SnagCategory)} className="w-full px-3 py-2 text-[13px] border border-ink-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-300 focus:border-accent-400 bg-white">
                {ALL_CATEGORIES.map(c => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
              </select>
            </div>
            <div className="flex-1">
              <label htmlFor="snag-sev" className="block text-[11px] font-medium text-ink-500 mb-1">Severity</label>
              <select id="snag-sev" value={newSeverity} onChange={(e) => setNewSeverity(e.target.value as SnagSeverity)} className="w-full px-3 py-2 text-[13px] border border-ink-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-300 focus:border-accent-400 bg-white">
                {ALL_SEVERITIES.map(s => <option key={s} value={s}>{SEVERITY_LABELS[s]}</option>)}
              </select>
            </div>
          </div>

          {/* Location row */}
          <div className="flex gap-4">
            <div className="flex-1">
              <label htmlFor="snag-block" className="block text-[11px] font-medium text-ink-500 mb-1">Block</label>
              <input id="snag-block" type="text" value={newBlock} onChange={(e) => setNewBlock(e.target.value)} placeholder="e.g. A" className="w-full px-3 py-2 text-[13px] border border-ink-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-300 focus:border-accent-400 placeholder:text-ink-300" maxLength={100} />
            </div>
            <div className="flex-1">
              <label htmlFor="snag-floor" className="block text-[11px] font-medium text-ink-500 mb-1">Floor</label>
              <input id="snag-floor" type="text" value={newFloor} onChange={(e) => setNewFloor(e.target.value)} placeholder="e.g. GF" className="w-full px-3 py-2 text-[13px] border border-ink-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-300 focus:border-accent-400 placeholder:text-ink-300" maxLength={100} />
            </div>
            <div className="flex-1">
              <label htmlFor="snag-room" className="block text-[11px] font-medium text-ink-500 mb-1">Room</label>
              <input id="snag-room" type="text" value={newRoom} onChange={(e) => setNewRoom(e.target.value)} placeholder="e.g. 101" className="w-full px-3 py-2 text-[13px] border border-ink-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-300 focus:border-accent-400 placeholder:text-ink-300" maxLength={100} />
            </div>
          </div>

          {/* Element + refs row */}
          <div className="flex gap-4">
            <div className="flex-1">
              <label htmlFor="snag-elem" className="block text-[11px] font-medium text-ink-500 mb-1">Element</label>
              <input id="snag-elem" type="text" value={newElement} onChange={(e) => setNewElement(e.target.value)} placeholder="e.g. Ceiling grid" className="w-full px-3 py-2 text-[13px] border border-ink-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-300 focus:border-accent-400 placeholder:text-ink-300" maxLength={200} />
            </div>
            <div className="flex-1">
              <label htmlFor="snag-dwg" className="block text-[11px] font-medium text-ink-500 mb-1">Drawing ref</label>
              <input id="snag-dwg" type="text" value={newDrawingRef} onChange={(e) => setNewDrawingRef(e.target.value)} placeholder="e.g. ALC-A-100" className="w-full px-3 py-2 text-[13px] border border-ink-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-300 focus:border-accent-400 placeholder:text-ink-300" maxLength={200} />
            </div>
            <div className="flex-1">
              <label htmlFor="snag-spec" className="block text-[11px] font-medium text-ink-500 mb-1">Spec ref</label>
              <input id="snag-spec" type="text" value={newSpecRef} onChange={(e) => setNewSpecRef(e.target.value)} placeholder="e.g. Section 45" className="w-full px-3 py-2 text-[13px] border border-ink-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-300 focus:border-accent-400 placeholder:text-ink-300" maxLength={200} />
            </div>
          </div>

          {/* Responsible org + target date */}
          <div className="flex gap-4">
            <div className="flex-1">
              <label htmlFor="snag-org" className="block text-[11px] font-medium text-ink-500 mb-1">Responsible org</label>
              <input id="snag-org" type="text" value={newResponsibleOrg} onChange={(e) => setNewResponsibleOrg(e.target.value)} placeholder="e.g. Main Contractor" className="w-full px-3 py-2 text-[13px] border border-ink-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-300 focus:border-accent-400 placeholder:text-ink-300" maxLength={200} />
            </div>
            <div className="flex-1">
              <label htmlFor="snag-target" className="block text-[11px] font-medium text-ink-500 mb-1">Target date</label>
              <input id="snag-target" type="date" value={newTargetDate} onChange={(e) => setNewTargetDate(e.target.value)} className="w-full px-3 py-2 text-[13px] border border-ink-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-300 focus:border-accent-400" />
            </div>
          </div>

          {/* Error */}
          {createError && (
            <p className="text-[12px] text-red-600 bg-red-50 px-3 py-2 rounded-lg">{createError}</p>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-1">
            <button type="button" onClick={resetCreateForm} className="px-3.5 py-2 text-[12px] font-medium text-ink-500 hover:text-ink-700 transition-colors" disabled={creating}>
              Cancel
            </button>
            <button
              type="submit"
              disabled={creating || !newDescription.trim()}
              className={cn(
                'flex items-center gap-1.5 px-4 py-2 rounded-lg text-[12px] font-medium transition-colors',
                creating || !newDescription.trim()
                  ? 'bg-ink-200 text-ink-400 cursor-not-allowed'
                  : 'bg-ink-900 text-white hover:bg-ink-800',
              )}
            >
              {creating && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Create snag
            </button>
          </div>
        </form>
      )}

      {/* ── Filters bar ────────────────────────────────── */}
      <div className="flex items-center gap-3 flex-wrap">
        <Filter className="w-4 h-4 text-ink-300" />
        <div className="flex gap-1 flex-wrap">
          {STATUS_FILTERS.map((f) => {
            const count = f.value === 'ALL' ? snags.length : (statusCounts[f.value] || 0)
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
                {count > 0 && (
                  <span className={cn(
                    'ml-1',
                    statusFilter === f.value ? 'text-ink-300' : 'text-ink-400',
                  )}>
                    {count}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        <div className="ml-auto flex items-center gap-2">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="text-[11px] text-ink-600 bg-white border border-ink-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-accent-300"
          >
            <option value="">All categories</option>
            {ALL_CATEGORIES.map(c => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
          </select>
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="text-[11px] text-ink-600 bg-white border border-ink-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-accent-300"
          >
            <option value="">All severities</option>
            {ALL_SEVERITIES.map(s => <option key={s} value={s}>{SEVERITY_LABELS[s]}</option>)}
          </select>
        </div>
      </div>

      {/* ── Snag list ──────────────────────────────────── */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-ink-100 p-10 text-center">
          <p className="text-[14px] font-medium text-ink-600">No snags match the filter</p>
          <p className="text-[12px] text-ink-400 mt-1">Try changing the filter or create a new snag.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-ink-100 divide-y divide-ink-50">
          {filtered.map((snag) => {
            const meta = STATUS_META[snag.status] || STATUS_META.OPEN
            const sevMeta = SEVERITY_META[snag.severity] || SEVERITY_META.MINOR
            const validNext = VALID_TRANSITIONS[snag.status] || []

            return (
              <div key={snag.id} className="px-5 py-4 hover:bg-surface-50 transition-colors">
                <div className="flex items-start gap-4">
                  {/* Severity dot */}
                  <span className={cn('w-2 h-2 rounded-full mt-1.5 shrink-0', sevMeta.dotColor)} />

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-ink-900">{snag.description}</p>
                    <div className="flex items-center gap-3 mt-2 flex-wrap">
                      {/* Category */}
                      <span className="text-[11px] text-ink-500">{CATEGORY_LABELS[snag.category] || snag.category}</span>
                      {/* Severity */}
                      <span className={cn('text-[11px] font-medium', sevMeta.color)}>
                        {SEVERITY_LABELS[snag.severity] || snag.severity}
                      </span>
                      {/* Location */}
                      {(snag.block || snag.floor || snag.room) && (
                        <span className="flex items-center gap-1 text-[11px] text-ink-400">
                          <Building2 className="w-3 h-3" />
                          {[snag.block, snag.floor, snag.room].filter(Boolean).join(' / ')}
                        </span>
                      )}
                      {/* Responsible org */}
                      {snag.responsibleOrg && (
                        <span className="text-[11px] text-ink-400">{snag.responsibleOrg}</span>
                      )}
                      {/* Target date */}
                      {snag.targetDate && (
                        <span className="flex items-center gap-1 text-[11px] text-ink-400">
                          <Calendar className="w-3 h-3" />
                          {new Date(snag.targetDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Status badge */}
                  <span className={cn(
                    'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium shrink-0',
                    meta.bgColor, meta.color,
                  )}>
                    <span className={cn('w-1.5 h-1.5 rounded-full', meta.dotColor)} />
                    {STATUS_LABELS[snag.status] || snag.status}
                  </span>

                  {/* Quick transition buttons */}
                  {validNext.length > 0 && (
                    <div className="flex items-center gap-1 shrink-0">
                      <ChevronRight className="w-3.5 h-3.5 text-ink-200" />
                      {validNext.map((next) => {
                        const nextMeta = STATUS_META[next] || STATUS_META.OPEN
                        return (
                          <button
                            key={next}
                            onClick={() => handleTransition(snag.id, next)}
                            disabled={transitioning === snag.id}
                            className={cn(
                              'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border transition-all',
                              'hover:shadow-sm active:scale-95',
                              transitioning === snag.id && 'opacity-50 cursor-not-allowed',
                              nextMeta.bgColor, nextMeta.color, 'border-current/20',
                            )}
                          >
                            <span className={cn('w-1 h-1 rounded-full', nextMeta.dotColor)} />
                            {STATUS_LABELS[next] || next}
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

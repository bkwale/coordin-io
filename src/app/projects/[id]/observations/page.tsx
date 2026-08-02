'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import {
  Plus, Filter, Loader2, AlertTriangle, RefreshCw, X,
  MapPin, Camera, Building2, ChevronRight, Calendar,
  Eye, ClipboardList, Cloud, Users,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useToast } from '@/components/Toast'
import { useApiMutation } from '@/hooks/use-api'
import { SkeletonRow } from '@/components/Skeleton'

/* ── Types ─────────────────────────────────────────────── */

interface ObservationListItem {
  id: string
  observationNumber: string
  description: string
  category: string | null
  discipline: string | null
  severity: string
  status: string
  actionRequired: string | null
  drawingRef: string | null
  specRef: string | null
  block: string | null
  floor: string | null
  room: string | null
  photoUrls: string[]
  latitude: number | null
  longitude: number | null
  dueDate: string | null
  response: string | null
  weather: string | null
  labourOnSite: number | null
  closedAt: string | null
  createdAt: string
  updatedAt: string
  createdBy: { id: string; fullName: string }
  assignedTo: { id: string; fullName: string } | null
}

/* ── Labels & Meta ────────────────────────────────────── */

const STATUS_LABELS: Record<string, string> = {
  OPEN: 'Open',
  ASSIGNED: 'Assigned',
  IN_PROGRESS: 'In progress',
  RESOLVED: 'Resolved',
  CLOSED: 'Closed',
  REOPENED: 'Reopened',
}

const STATUS_META: Record<string, { color: string; bgColor: string; dotColor: string }> = {
  OPEN: { color: 'text-blue-700', bgColor: 'bg-blue-50', dotColor: 'bg-blue-500' },
  ASSIGNED: { color: 'text-amber-700', bgColor: 'bg-amber-50', dotColor: 'bg-amber-500' },
  IN_PROGRESS: { color: 'text-purple-700', bgColor: 'bg-purple-50', dotColor: 'bg-purple-500' },
  RESOLVED: { color: 'text-emerald-700', bgColor: 'bg-emerald-50', dotColor: 'bg-emerald-500' },
  CLOSED: { color: 'text-ink-700', bgColor: 'bg-ink-50', dotColor: 'bg-ink-400' },
  REOPENED: { color: 'text-red-700', bgColor: 'bg-red-50', dotColor: 'bg-red-500' },
}

const SEVERITY_LABELS: Record<string, string> = {
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High',
  CRITICAL: 'Critical',
}

const SEVERITY_META: Record<string, { color: string; dotColor: string }> = {
  LOW: { color: 'text-ink-500', dotColor: 'bg-ink-300' },
  MEDIUM: { color: 'text-amber-600', dotColor: 'bg-amber-500' },
  HIGH: { color: 'text-orange-600', dotColor: 'bg-orange-500' },
  CRITICAL: { color: 'text-red-600', dotColor: 'bg-red-500' },
}

const CATEGORIES = ['Structural', 'Services', 'Finishes', 'External', 'Safety', 'Quality'] as const
const SEVERITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const
const ALL_STATUSES = ['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED', 'REOPENED'] as const

const VALID_TRANSITIONS: Record<string, string[]> = {
  OPEN: ['ASSIGNED'],
  ASSIGNED: ['IN_PROGRESS'],
  IN_PROGRESS: ['RESOLVED'],
  RESOLVED: ['CLOSED', 'REOPENED'],
  REOPENED: ['ASSIGNED'],
  CLOSED: [],
}

type FilterStatus = 'ALL' | string

const STATUS_FILTERS: { value: FilterStatus; label: string }[] = [
  { value: 'ALL', label: 'All' },
  { value: 'OPEN', label: 'Open' },
  { value: 'ASSIGNED', label: 'Assigned' },
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'RESOLVED', label: 'Resolved' },
  { value: 'CLOSED', label: 'Closed' },
  { value: 'REOPENED', label: 'Reopened' },
]

/* ── Page ──────────────────────────────────────────────── */

export default function ProjectObservationsPage() {
  const params = useParams()
  const projectId = params.id as string
  const { toast } = useToast()

  const [observations, setObservations] = useState<ObservationListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('ALL')
  const [severityFilter, setSeverityFilter] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')

  /* ── Create form state ──────────────────────────────── */
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [newDescription, setNewDescription] = useState('')
  const [newCategory, setNewCategory] = useState('')
  const [newSeverity, setNewSeverity] = useState('LOW')
  const [newBlock, setNewBlock] = useState('')
  const [newFloor, setNewFloor] = useState('')
  const [newRoom, setNewRoom] = useState('')
  const [newActionRequired, setNewActionRequired] = useState('')
  const [newDrawingRef, setNewDrawingRef] = useState('')
  const [newSpecRef, setNewSpecRef] = useState('')
  const [newDueDate, setNewDueDate] = useState('')
  const [newWeather, setNewWeather] = useState('')
  const [newLabourOnSite, setNewLabourOnSite] = useState('')

  const { mutate: createObservation, loading: creating, error: createError, clearError: clearCreateError } =
    useApiMutation<ObservationListItem>(`/api/projects/${projectId}/observations`, 'POST')

  /* ── Detail panel ────────────────────────────────────── */
  const [selectedObs, setSelectedObs] = useState<ObservationListItem | null>(null)

  /* ── Quick transition ─────────────────────────────── */
  const [transitioning, setTransitioning] = useState<string | null>(null)

  const handleTransition = async (obsId: string, newStatus: string) => {
    setTransitioning(obsId)
    try {
      const body: Record<string, unknown> = { status: newStatus }

      // ASSIGNED requires an assignee — prompt
      if (newStatus === 'ASSIGNED') {
        const assignee = prompt('Assign to (enter team member name or leave blank):')
        // For now we just set status without assignedToId
        // In production, this would open a proper picker
      }

      // RESOLVED can include a response
      if (newStatus === 'RESOLVED') {
        const response = prompt('Resolution response (optional):')
        if (response?.trim()) body.response = response.trim()
      }

      const res = await fetch(`/api/projects/${projectId}/observations/${obsId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json.error || `Failed (${res.status})`)
      }
      toast(`Observation moved to ${STATUS_LABELS[newStatus] || newStatus}`, 'success')
      fetchObservations()
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
      severity: newSeverity,
    }
    if (newCategory) body.category = newCategory
    if (newBlock.trim()) body.block = newBlock.trim()
    if (newFloor.trim()) body.floor = newFloor.trim()
    if (newRoom.trim()) body.room = newRoom.trim()
    if (newActionRequired.trim()) body.actionRequired = newActionRequired.trim()
    if (newDrawingRef.trim()) body.drawingRef = newDrawingRef.trim()
    if (newSpecRef.trim()) body.specRef = newSpecRef.trim()
    if (newDueDate) body.dueDate = newDueDate
    if (newWeather.trim()) body.weather = newWeather.trim()
    if (newLabourOnSite && Number(newLabourOnSite) > 0) body.labourOnSite = Number(newLabourOnSite)

    const result = await createObservation(body)
    if (result) {
      toast('Observation recorded', 'success')
      resetCreateForm()
      fetchObservations()
    } else {
      toast(createError || 'Failed to create observation', 'error')
    }
  }

  const resetCreateForm = () => {
    setShowCreateForm(false)
    setNewDescription('')
    setNewCategory('')
    setNewSeverity('LOW')
    setNewBlock('')
    setNewFloor('')
    setNewRoom('')
    setNewActionRequired('')
    setNewDrawingRef('')
    setNewSpecRef('')
    setNewDueDate('')
    setNewWeather('')
    setNewLabourOnSite('')
    clearCreateError()
  }

  const fetchObservations = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (statusFilter !== 'ALL') params.set('status', statusFilter)
      if (severityFilter) params.set('severity', severityFilter)
      if (categoryFilter) params.set('category', categoryFilter)
      const qs = params.toString()
      const url = `/api/projects/${projectId}/observations${qs ? `?${qs}` : ''}`
      const res = await fetch(url)
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || `Failed to load (${res.status})`)
      }
      const json = await res.json()
      setObservations(json.data.observations)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }, [projectId, statusFilter, severityFilter, categoryFilter])

  useEffect(() => {
    fetchObservations()
  }, [fetchObservations])

  /* ── Stats ──────────────────────────────────────────── */

  const statusCounts = observations.reduce<Record<string, number>>((acc, o) => {
    acc[o.status] = (acc[o.status] || 0) + 1
    return acc
  }, {})

  const summaryCards = [
    { label: 'Open', count: (statusCounts['OPEN'] || 0) + (statusCounts['REOPENED'] || 0), color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200' },
    { label: 'In Progress', count: (statusCounts['ASSIGNED'] || 0) + (statusCounts['IN_PROGRESS'] || 0), color: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-200' },
    { label: 'Resolved', count: statusCounts['RESOLVED'] || 0, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200' },
    { label: 'Closed', count: statusCounts['CLOSED'] || 0, color: 'text-ink-600', bg: 'bg-ink-50', border: 'border-ink-200' },
  ]

  /* ── Loading ─────────────────────────────────────────── */

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <div className="h-6 w-40 bg-ink-100 animate-pulse rounded" />
            <div className="h-4 w-56 bg-ink-100 animate-pulse rounded" />
          </div>
        </div>
        <div className="grid grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 bg-ink-50 animate-pulse rounded-xl" />
          ))}
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
        <button onClick={fetchObservations} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-ink-900 text-white text-[13px] font-medium hover:bg-ink-800 transition-colors">
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
          <h2 className="text-[18px] font-semibold text-ink-900">Site Observations</h2>
          <p className="text-[12px] text-ink-400 mt-0.5">
            {observations.length} observation{observations.length !== 1 ? 's' : ''} recorded
          </p>
        </div>
        {!showCreateForm && (
          <button
            onClick={() => setShowCreateForm(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-ink-900 text-white text-[12px] font-medium hover:bg-ink-800 transition-colors"
          >
            <Plus className="w-4 h-4" />
            New observation
          </button>
        )}
      </div>

      {/* ── Summary cards ──────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {summaryCards.map((card) => (
          <div key={card.label} className={cn('rounded-xl border p-4', card.bg, card.border)}>
            <p className="text-[11px] font-medium text-ink-500 uppercase tracking-wide">{card.label}</p>
            <p className={cn('text-[24px] font-bold mt-1', card.color)}>{card.count}</p>
          </div>
        ))}
      </div>

      {/* ── Create form ───────────────────────────── */}
      {showCreateForm && (
        <form
          onSubmit={handleCreate}
          className="bg-white rounded-xl border-2 border-accent-200 p-5 space-y-4"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-[14px] font-semibold text-ink-900">New observation</h3>
            <button type="button" onClick={resetCreateForm} className="text-ink-400 hover:text-ink-600 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Description */}
          <div>
            <label htmlFor="obs-desc" className="block text-[11px] font-medium text-ink-500 mb-1">
              Description <span className="text-red-400">*</span>
            </label>
            <textarea
              id="obs-desc"
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              placeholder="Describe what you observed on site..."
              className="w-full px-3 py-2 text-[13px] border border-ink-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-300 focus:border-accent-400 placeholder:text-ink-300 min-h-[80px]"
              autoFocus
              maxLength={5000}
              required
            />
          </div>

          {/* Category + Severity */}
          <div className="flex gap-4">
            <div className="flex-1">
              <label htmlFor="obs-cat" className="block text-[11px] font-medium text-ink-500 mb-1">Category</label>
              <select id="obs-cat" value={newCategory} onChange={(e) => setNewCategory(e.target.value)} className="w-full px-3 py-2 text-[13px] border border-ink-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-300 focus:border-accent-400 bg-white">
                <option value="">Select category...</option>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="flex-1">
              <label htmlFor="obs-sev" className="block text-[11px] font-medium text-ink-500 mb-1">Severity</label>
              <select id="obs-sev" value={newSeverity} onChange={(e) => setNewSeverity(e.target.value)} className="w-full px-3 py-2 text-[13px] border border-ink-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-300 focus:border-accent-400 bg-white">
                {SEVERITIES.map(s => <option key={s} value={s}>{SEVERITY_LABELS[s]}</option>)}
              </select>
            </div>
          </div>

          {/* Location row */}
          <div className="flex gap-4">
            <div className="flex-1">
              <label htmlFor="obs-block" className="block text-[11px] font-medium text-ink-500 mb-1">Block</label>
              <input id="obs-block" type="text" value={newBlock} onChange={(e) => setNewBlock(e.target.value)} placeholder="e.g. A" className="w-full px-3 py-2 text-[13px] border border-ink-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-300 focus:border-accent-400 placeholder:text-ink-300" maxLength={100} />
            </div>
            <div className="flex-1">
              <label htmlFor="obs-floor" className="block text-[11px] font-medium text-ink-500 mb-1">Floor</label>
              <input id="obs-floor" type="text" value={newFloor} onChange={(e) => setNewFloor(e.target.value)} placeholder="e.g. GF" className="w-full px-3 py-2 text-[13px] border border-ink-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-300 focus:border-accent-400 placeholder:text-ink-300" maxLength={100} />
            </div>
            <div className="flex-1">
              <label htmlFor="obs-room" className="block text-[11px] font-medium text-ink-500 mb-1">Room</label>
              <input id="obs-room" type="text" value={newRoom} onChange={(e) => setNewRoom(e.target.value)} placeholder="e.g. 101" className="w-full px-3 py-2 text-[13px] border border-ink-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-300 focus:border-accent-400 placeholder:text-ink-300" maxLength={100} />
            </div>
          </div>

          {/* Action + refs row */}
          <div className="flex gap-4">
            <div className="flex-1">
              <label htmlFor="obs-action" className="block text-[11px] font-medium text-ink-500 mb-1">Action required</label>
              <input id="obs-action" type="text" value={newActionRequired} onChange={(e) => setNewActionRequired(e.target.value)} placeholder="e.g. Rectify before pour" className="w-full px-3 py-2 text-[13px] border border-ink-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-300 focus:border-accent-400 placeholder:text-ink-300" maxLength={5000} />
            </div>
            <div className="flex-1">
              <label htmlFor="obs-dwg" className="block text-[11px] font-medium text-ink-500 mb-1">Drawing ref</label>
              <input id="obs-dwg" type="text" value={newDrawingRef} onChange={(e) => setNewDrawingRef(e.target.value)} placeholder="e.g. ALC-A-100" className="w-full px-3 py-2 text-[13px] border border-ink-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-300 focus:border-accent-400 placeholder:text-ink-300" maxLength={200} />
            </div>
            <div className="flex-1">
              <label htmlFor="obs-spec" className="block text-[11px] font-medium text-ink-500 mb-1">Spec ref</label>
              <input id="obs-spec" type="text" value={newSpecRef} onChange={(e) => setNewSpecRef(e.target.value)} placeholder="e.g. Section 45" className="w-full px-3 py-2 text-[13px] border border-ink-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-300 focus:border-accent-400 placeholder:text-ink-300" maxLength={200} />
            </div>
          </div>

          {/* Site context + due date */}
          <div className="flex gap-4">
            <div className="flex-1">
              <label htmlFor="obs-weather" className="block text-[11px] font-medium text-ink-500 mb-1">Weather</label>
              <input id="obs-weather" type="text" value={newWeather} onChange={(e) => setNewWeather(e.target.value)} placeholder="e.g. Clear, 22C" className="w-full px-3 py-2 text-[13px] border border-ink-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-300 focus:border-accent-400 placeholder:text-ink-300" maxLength={200} />
            </div>
            <div className="flex-1">
              <label htmlFor="obs-labour" className="block text-[11px] font-medium text-ink-500 mb-1">Labour on site</label>
              <input id="obs-labour" type="number" min="0" value={newLabourOnSite} onChange={(e) => setNewLabourOnSite(e.target.value)} placeholder="e.g. 45" className="w-full px-3 py-2 text-[13px] border border-ink-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-300 focus:border-accent-400 placeholder:text-ink-300" />
            </div>
            <div className="flex-1">
              <label htmlFor="obs-due" className="block text-[11px] font-medium text-ink-500 mb-1">Due date</label>
              <input id="obs-due" type="date" value={newDueDate} onChange={(e) => setNewDueDate(e.target.value)} className="w-full px-3 py-2 text-[13px] border border-ink-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-300 focus:border-accent-400" />
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
              Record observation
            </button>
          </div>
        </form>
      )}

      {/* ── Filters bar ────────────────────────────────── */}
      <div className="flex items-center gap-3 flex-wrap">
        <Filter className="w-4 h-4 text-ink-300" />
        <div className="flex gap-1 flex-wrap">
          {STATUS_FILTERS.map((f) => {
            const count = f.value === 'ALL' ? observations.length : (statusCounts[f.value] || 0)
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
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="text-[11px] text-ink-600 bg-white border border-ink-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-accent-300"
          >
            <option value="">All severities</option>
            {SEVERITIES.map(s => <option key={s} value={s}>{SEVERITY_LABELS[s]}</option>)}
          </select>
        </div>
      </div>

      {/* ── Observations list ──────────────────────────── */}
      {observations.length === 0 ? (
        <div className="bg-white rounded-xl border border-ink-100 p-10 text-center">
          <ClipboardList className="w-10 h-10 text-ink-200 mx-auto mb-3" />
          <p className="text-[14px] font-medium text-ink-600">No observations recorded yet</p>
          <p className="text-[12px] text-ink-400 mt-1">Record site observations to track conditions, progress, and issues.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-ink-100 divide-y divide-ink-50">
          {observations.map((obs) => {
            const meta = STATUS_META[obs.status] || STATUS_META.OPEN
            const sevMeta = SEVERITY_META[obs.severity] || SEVERITY_META.LOW
            const validNext = VALID_TRANSITIONS[obs.status] || []

            return (
              <div
                key={obs.id}
                className="px-5 py-4 hover:bg-surface-50 transition-colors cursor-pointer"
                onClick={() => setSelectedObs(selectedObs?.id === obs.id ? null : obs)}
              >
                <div className="flex items-start gap-4">
                  {/* Severity dot */}
                  <span className={cn('w-2 h-2 rounded-full mt-1.5 shrink-0', sevMeta.dotColor)} />

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[11px] font-mono text-ink-400">{obs.observationNumber}</span>
                      {obs.category && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-ink-50 text-ink-500">{obs.category}</span>
                      )}
                    </div>
                    <p className="text-[13px] text-ink-900">{obs.description}</p>
                    <div className="flex items-center gap-3 mt-2 flex-wrap">
                      {/* Severity */}
                      <span className={cn('text-[11px] font-medium', sevMeta.color)}>
                        {SEVERITY_LABELS[obs.severity] || obs.severity}
                      </span>
                      {/* Location */}
                      {(obs.block || obs.floor || obs.room) && (
                        <span className="flex items-center gap-1 text-[11px] text-ink-400">
                          <Building2 className="w-3 h-3" />
                          {[obs.block, obs.floor, obs.room].filter(Boolean).join(' / ')}
                        </span>
                      )}
                      {/* Assignee */}
                      {obs.assignedTo && (
                        <span className="text-[11px] text-ink-400">
                          {obs.assignedTo.fullName}
                        </span>
                      )}
                      {/* Due date */}
                      {obs.dueDate && (
                        <span className="flex items-center gap-1 text-[11px] text-ink-400">
                          <Calendar className="w-3 h-3" />
                          {new Date(obs.dueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                        </span>
                      )}
                      {/* Photos count */}
                      {obs.photoUrls.length > 0 && (
                        <span className="flex items-center gap-1 text-[11px] text-ink-400">
                          <Camera className="w-3 h-3" />
                          {obs.photoUrls.length}
                        </span>
                      )}
                      {/* GPS */}
                      {obs.latitude !== null && obs.longitude !== null && (
                        <span className="flex items-center gap-1 text-[11px] text-blue-500">
                          <MapPin className="w-3 h-3" />
                          GPS
                        </span>
                      )}
                      {/* Weather */}
                      {obs.weather && (
                        <span className="flex items-center gap-1 text-[11px] text-ink-400">
                          <Cloud className="w-3 h-3" />
                          {obs.weather}
                        </span>
                      )}
                      {/* Labour */}
                      {obs.labourOnSite !== null && obs.labourOnSite > 0 && (
                        <span className="flex items-center gap-1 text-[11px] text-ink-400">
                          <Users className="w-3 h-3" />
                          {obs.labourOnSite}
                        </span>
                      )}
                      {/* Author + date */}
                      <span className="text-[11px] text-ink-400">
                        {obs.createdBy.fullName} &middot; {new Date(obs.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                    </div>

                    {/* Expanded detail */}
                    {selectedObs?.id === obs.id && (
                      <div className="mt-3 pt-3 border-t border-ink-100 space-y-2">
                        {obs.actionRequired && (
                          <div>
                            <span className="text-[10px] font-medium text-ink-400 uppercase">Action Required</span>
                            <p className="text-[12px] text-ink-700 mt-0.5">{obs.actionRequired}</p>
                          </div>
                        )}
                        {obs.response && (
                          <div>
                            <span className="text-[10px] font-medium text-ink-400 uppercase">Response</span>
                            <p className="text-[12px] text-ink-700 mt-0.5">{obs.response}</p>
                          </div>
                        )}
                        {(obs.drawingRef || obs.specRef) && (
                          <div className="flex gap-4">
                            {obs.drawingRef && (
                              <div>
                                <span className="text-[10px] font-medium text-ink-400 uppercase">Drawing</span>
                                <p className="text-[12px] text-ink-700 mt-0.5">{obs.drawingRef}</p>
                              </div>
                            )}
                            {obs.specRef && (
                              <div>
                                <span className="text-[10px] font-medium text-ink-400 uppercase">Spec</span>
                                <p className="text-[12px] text-ink-700 mt-0.5">{obs.specRef}</p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Status badge */}
                  <span className={cn(
                    'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium shrink-0',
                    meta.bgColor, meta.color,
                  )}>
                    <span className={cn('w-1.5 h-1.5 rounded-full', meta.dotColor)} />
                    {STATUS_LABELS[obs.status] || obs.status}
                  </span>

                  {/* Quick transition buttons */}
                  {validNext.length > 0 && (
                    <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                      <ChevronRight className="w-3.5 h-3.5 text-ink-200" />
                      {validNext.map((next) => {
                        const nextMeta = STATUS_META[next] || STATUS_META.OPEN
                        return (
                          <button
                            key={next}
                            onClick={() => handleTransition(obs.id, next)}
                            disabled={transitioning === obs.id}
                            className={cn(
                              'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border transition-all',
                              'hover:shadow-sm active:scale-95',
                              transitioning === obs.id && 'opacity-50 cursor-not-allowed',
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

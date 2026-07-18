'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import {
  Plus, Filter, Loader2, AlertTriangle, RefreshCw, X,
  MapPin, Camera, Building2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useToast } from '@/components/Toast'
import { useApiMutation } from '@/hooks/use-api'
import { SkeletonRow } from '@/components/Skeleton'

/* ── Types ─────────────────────────────────────────────── */

interface ObservationListItem {
  id: string
  description: string
  block: string | null
  floor: string | null
  room: string | null
  photoUrls: string[]
  latitude: number | null
  longitude: number | null
  createdAt: string
  createdBy: { id: string; fullName: string }
}

/* ── Page ──────────────────────────────────────────────── */

export default function ProjectObservationsPage() {
  const params = useParams()
  const projectId = params.id as string
  const { toast } = useToast()

  const [observations, setObservations] = useState<ObservationListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [blockFilter, setBlockFilter] = useState('')
  const [floorFilter, setFloorFilter] = useState('')

  /* ── Create form ──────────────────────────────────── */
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [newDescription, setNewDescription] = useState('')
  const [newBlock, setNewBlock] = useState('')
  const [newFloor, setNewFloor] = useState('')
  const [newRoom, setNewRoom] = useState('')
  const { mutate: createObservation, loading: creating, error: createError, clearError: clearCreateError } =
    useApiMutation<ObservationListItem>(`/api/projects/${projectId}/observations`, 'POST')

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = newDescription.trim()
    if (!trimmed) return

    const body: Record<string, unknown> = { description: trimmed }
    if (newBlock.trim()) body.block = newBlock.trim()
    if (newFloor.trim()) body.floor = newFloor.trim()
    if (newRoom.trim()) body.room = newRoom.trim()

    const result = await createObservation(body)
    if (result) {
      toast('Observation recorded', 'success')
      setNewDescription('')
      setNewBlock('')
      setNewFloor('')
      setNewRoom('')
      setShowCreateForm(false)
      clearCreateError()
      fetchObservations()
    } else {
      toast(createError || 'Failed to create observation', 'error')
    }
  }

  const cancelCreate = () => {
    setShowCreateForm(false)
    setNewDescription('')
    setNewBlock('')
    setNewFloor('')
    setNewRoom('')
    clearCreateError()
  }

  const fetchObservations = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (blockFilter) params.set('block', blockFilter)
      if (floorFilter) params.set('floor', floorFilter)
      const qs = params.toString()
      const url = `/api/projects/${projectId}/observations${qs ? `?${qs}` : ''}`
      const res = await fetch(url)
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error?.message || `Failed to load (${res.status})`)
      }
      const json = await res.json()
      setObservations(json.data.observations)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }, [projectId, blockFilter, floorFilter])

  useEffect(() => {
    fetchObservations()
  }, [fetchObservations])

  /* ── Unique blocks/floors for filter options ─────── */
  const blocks = [...new Set(observations.map(o => o.block).filter(Boolean))] as string[]
  const floors = [...new Set(observations.map(o => o.floor).filter(Boolean))] as string[]

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
        <div className="bg-white rounded-xl border border-ink-100 divide-y divide-ink-50">
          {Array.from({ length: 4 }).map((_, i) => (
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

      {/* ── Create form ───────────────────────────── */}
      {showCreateForm && (
        <form
          onSubmit={handleCreate}
          className="bg-white rounded-xl border-2 border-accent-200 p-5 space-y-4"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-[14px] font-semibold text-ink-900">New observation</h3>
            <button type="button" onClick={cancelCreate} className="text-ink-400 hover:text-ink-600 transition-colors">
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

          {/* Error */}
          {createError && (
            <p className="text-[12px] text-red-600 bg-red-50 px-3 py-2 rounded-lg">{createError}</p>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-1">
            <button type="button" onClick={cancelCreate} className="px-3.5 py-2 text-[12px] font-medium text-ink-500 hover:text-ink-700 transition-colors" disabled={creating}>
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
      {(blocks.length > 0 || floors.length > 0) && (
        <div className="flex items-center gap-3 flex-wrap">
          <Filter className="w-4 h-4 text-ink-300" />
          {blocks.length > 0 && (
            <select
              value={blockFilter}
              onChange={(e) => setBlockFilter(e.target.value)}
              className="text-[11px] text-ink-600 bg-white border border-ink-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-accent-300"
            >
              <option value="">All blocks</option>
              {blocks.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          )}
          {floors.length > 0 && (
            <select
              value={floorFilter}
              onChange={(e) => setFloorFilter(e.target.value)}
              className="text-[11px] text-ink-600 bg-white border border-ink-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-accent-300"
            >
              <option value="">All floors</option>
              {floors.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          )}
        </div>
      )}

      {/* ── Observations list ──────────────────────────── */}
      {observations.length === 0 ? (
        <div className="bg-white rounded-xl border border-ink-100 p-10 text-center">
          <p className="text-[14px] font-medium text-ink-600">No observations recorded yet</p>
          <p className="text-[12px] text-ink-400 mt-1">Record site observations to track conditions and progress.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-ink-100 divide-y divide-ink-50">
          {observations.map((obs) => (
            <div key={obs.id} className="px-5 py-4 hover:bg-surface-50 transition-colors">
              <div className="flex items-start gap-4">
                {/* Content */}
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] text-ink-900">{obs.description}</p>
                  <div className="flex items-center gap-3 mt-2 flex-wrap">
                    {/* Location */}
                    {(obs.block || obs.floor || obs.room) && (
                      <span className="flex items-center gap-1 text-[11px] text-ink-400">
                        <Building2 className="w-3 h-3" />
                        {[obs.block, obs.floor, obs.room].filter(Boolean).join(' / ')}
                      </span>
                    )}
                    {/* Photos count */}
                    {obs.photoUrls.length > 0 && (
                      <span className="flex items-center gap-1 text-[11px] text-ink-400">
                        <Camera className="w-3 h-3" />
                        {obs.photoUrls.length} photo{obs.photoUrls.length !== 1 ? 's' : ''}
                      </span>
                    )}
                    {/* Map pin */}
                    {obs.latitude !== null && obs.longitude !== null && (
                      <span className="flex items-center gap-1 text-[11px] text-blue-500">
                        <MapPin className="w-3 h-3" />
                        GPS
                      </span>
                    )}
                    {/* Author + date */}
                    <span className="text-[11px] text-ink-400">
                      {obs.createdBy.fullName} · {new Date(obs.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

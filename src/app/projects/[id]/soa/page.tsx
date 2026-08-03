'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useParams } from 'next/navigation'
import {
  Plus, Loader2, Trash2, Save, ChevronDown,
  Table2, Copy, AlertCircle, X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useToast } from '@/components/Toast'
import { SkeletonRow } from '@/components/Skeleton'

/* ── Types ─────────────────────────────────────────────── */

interface SOAVersion {
  id: string
  projectId: string
  versionNumber: number
  name: string | null
  status: string
  changeReason: string | null
  createdAt: string
  updatedAt: string
  _count?: { rows: number }
}

interface SOARow {
  id: string
  versionId: string
  spaceCategory: string
  roomType: string
  code: string | null
  quantity: number
  targetArea: number | null
  currentArea: number | null
  requirement: string | null
  requirementSource: string | null
  status: string
  comment: string | null
  sortOrder: number
}

interface EditableRow extends SOARow {
  _isNew?: boolean
  _dirty?: boolean
  _deleted?: boolean
}

interface Summary {
  totalRows: number
  totalQuantity: number
  totalTargetArea: number
  totalCurrentArea: number
}

/* ── Constants ─────────────────────────────────────────── */

const SPACE_CATEGORIES = [
  { value: 'GUEST_ACCOMMODATION', label: 'Guest Accommodation' },
  { value: 'FOH', label: 'Front of House' },
  { value: 'BOH', label: 'Back of House' },
  { value: 'CIRCULATION', label: 'Circulation' },
  { value: 'EXTERNAL', label: 'External' },
] as const

const SPACE_CATEGORY_LABELS: Record<string, string> = {
  GUEST_ACCOMMODATION: 'Guest Accommodation',
  FOH: 'Front of House',
  BOH: 'Back of House',
  CIRCULATION: 'Circulation',
  EXTERNAL: 'External',
}

const ROOM_TYPE_SUGGESTIONS: Record<string, string[]> = {
  GUEST_ACCOMMODATION: ['Standard Room', 'Superior Room', 'Suite', 'Junior Suite', 'Penthouse', 'Accessible Room', 'Connecting Rooms'],
  FOH: ['Reception / Lobby', 'Restaurant', 'Bar / Lounge', 'Meeting Room', 'Ballroom / Function', 'Spa / Wellness', 'Pool Area', 'Gym / Fitness', 'Business Centre', 'Retail'],
  BOH: ['Main Kitchen', 'Prep Kitchen', 'Pastry Kitchen', 'Laundry', 'Housekeeping Store', 'General Storage', 'Receiving / Loading', 'Staff Canteen', 'Staff Changing', 'Management Offices', 'Security / CCTV', 'IT / Comms Room'],
  CIRCULATION: ['Corridors', 'Lift Lobbies', 'Staircases', 'Service Corridors'],
  EXTERNAL: ['Car Park', 'Drop-off', 'Terrace / Outdoor Dining', 'Garden / Landscaping', 'Service Yard'],
}

const REQUIREMENTS = [
  { value: 'CLIENT_BRIEF', label: 'Client Brief' },
  { value: 'OPERATOR', label: 'Operator' },
  { value: 'STANDARD', label: 'Standard' },
  { value: 'ACCESSIBILITY', label: 'Accessibility' },
  { value: 'CWA', label: 'CWA' },
  { value: 'CUSTOM', label: 'Custom' },
] as const

const VERSION_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Draft',
  UNDER_REVIEW: 'Under Review',
  APPROVED: 'Approved',
  SUPERSEDED: 'Superseded',
}

const VERSION_STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-blue-50 text-blue-700',
  UNDER_REVIEW: 'bg-amber-50 text-amber-700',
  APPROVED: 'bg-emerald-50 text-emerald-700',
  SUPERSEDED: 'bg-ink-50 text-ink-500',
}

/* ── Helper: generate temp ID ────────────────────────── */

let tempIdCounter = 0
function tempId() {
  return `_new_${Date.now()}_${++tempIdCounter}`
}

/* ── Page ──────────────────────────────────────────────── */

export default function SOAPage() {
  const params = useParams()
  const projectId = params.id as string
  const { toast } = useToast()

  // Versions
  const [versions, setVersions] = useState<SOAVersion[]>([])
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null)
  const [loadingVersions, setLoadingVersions] = useState(true)

  // Rows
  const [rows, setRows] = useState<EditableRow[]>([])
  const [loadingRows, setLoadingRows] = useState(false)

  // UI state
  const [saving, setSaving] = useState(false)
  const [showNewVersion, setShowNewVersion] = useState(false)
  const [newVersionName, setNewVersionName] = useState('')
  const [copyFromPrevious, setCopyFromPrevious] = useState(true)
  const [creatingVersion, setCreatingVersion] = useState(false)
  const [showVersionDropdown, setShowVersionDropdown] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /* ── Computed values ───────────────────────────────── */

  const selectedVersion = useMemo(
    () => versions.find(v => v.id === selectedVersionId) ?? null,
    [versions, selectedVersionId],
  )

  const activeRows = useMemo(
    () => rows.filter(r => !r._deleted),
    [rows],
  )

  const summary = useMemo<Summary>(() => {
    let totalQuantity = 0
    let totalTargetArea = 0
    let totalCurrentArea = 0

    for (const row of activeRows) {
      const qty = row.quantity ?? 0
      totalQuantity += qty
      totalTargetArea += qty * (row.targetArea ?? 0)
      totalCurrentArea += qty * (row.currentArea ?? 0)
    }

    return {
      totalRows: activeRows.length,
      totalQuantity,
      totalTargetArea: Math.round(totalTargetArea * 100) / 100,
      totalCurrentArea: Math.round(totalCurrentArea * 100) / 100,
    }
  }, [activeRows])

  const hasUnsavedChanges = useMemo(
    () => rows.some(r => r._isNew || r._dirty || r._deleted),
    [rows],
  )

  /* ── Fetch versions ────────────────────────────────── */

  const fetchVersions = useCallback(async () => {
    setLoadingVersions(true)
    try {
      const res = await fetch(`/api/projects/${projectId}/soa`)
      if (!res.ok) throw new Error('Failed to load SOA versions')
      const json = await res.json()
      const vList: SOAVersion[] = json.data?.versions ?? []
      setVersions(vList)
      // Select first (most recent) version if none selected
      if (vList.length > 0 && !selectedVersionId) {
        setSelectedVersionId(vList[0].id)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoadingVersions(false)
    }
  }, [projectId, selectedVersionId])

  useEffect(() => {
    fetchVersions()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId])

  /* ── Fetch rows for selected version ───────────────── */

  const fetchRows = useCallback(async (vId: string) => {
    setLoadingRows(true)
    try {
      const res = await fetch(`/api/projects/${projectId}/soa/${vId}/rows`)
      if (!res.ok) throw new Error('Failed to load SOA rows')
      const json = await res.json()
      const fetched: SOARow[] = json.data?.rows ?? []
      setRows(fetched.map(r => ({ ...r, _isNew: false, _dirty: false, _deleted: false })))
    } catch {
      toast('Failed to load rows', 'error')
    } finally {
      setLoadingRows(false)
    }
  }, [projectId, toast])

  useEffect(() => {
    if (selectedVersionId) {
      fetchRows(selectedVersionId)
    }
  }, [selectedVersionId, fetchRows])

  /* ── Version actions ───────────────────────────────── */

  const handleCreateVersion = async () => {
    setCreatingVersion(true)
    try {
      const res = await fetch(`/api/projects/${projectId}/soa`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newVersionName || undefined,
          copyFromPrevious,
        }),
      })
      if (!res.ok) throw new Error('Failed to create version')
      const json = await res.json()
      const newVersion = json.data?.version
      toast('New version created', 'success')
      setShowNewVersion(false)
      setNewVersionName('')

      // Refresh versions list and select new one
      const vRes = await fetch(`/api/projects/${projectId}/soa`)
      if (vRes.ok) {
        const vJson = await vRes.json()
        setVersions(vJson.data?.versions ?? [])
      }
      if (newVersion?.id) {
        setSelectedVersionId(newVersion.id)
      }
    } catch {
      toast('Failed to create version', 'error')
    } finally {
      setCreatingVersion(false)
    }
  }

  /* ── Row editing ───────────────────────────────────── */

  const addRow = () => {
    const newRow: EditableRow = {
      id: tempId(),
      versionId: selectedVersionId || '',
      spaceCategory: 'GUEST_ACCOMMODATION',
      roomType: '',
      code: null,
      quantity: 1,
      targetArea: null,
      currentArea: null,
      requirement: null,
      requirementSource: null,
      status: 'DRAFT',
      comment: null,
      sortOrder: activeRows.length,
      _isNew: true,
      _dirty: false,
      _deleted: false,
    }
    setRows(prev => [...prev, newRow])
  }

  const updateRow = (rowId: string, field: keyof SOARow, value: unknown) => {
    setRows(prev => prev.map(r => {
      if (r.id !== rowId) return r
      return { ...r, [field]: value, _dirty: true }
    }))
  }

  const deleteRow = (rowId: string) => {
    setRows(prev => prev.map(r => {
      if (r.id !== rowId) return r
      if (r._isNew) {
        // Remove unsaved rows entirely
        return { ...r, _deleted: true }
      }
      return { ...r, _deleted: true }
    }))
  }

  /* ── Save all changes ──────────────────────────────── */

  const handleSaveAll = async () => {
    if (!selectedVersionId) return
    setSaving(true)

    try {
      // 1. Delete removed rows
      const deletedRows = rows.filter(r => r._deleted && !r._isNew)
      for (const row of deletedRows) {
        await fetch(`/api/projects/${projectId}/soa/${selectedVersionId}/rows?rowId=${row.id}`, {
          method: 'DELETE',
        })
      }

      // 2. Create new rows
      const newRows = rows.filter(r => r._isNew && !r._deleted)
      for (const row of newRows) {
        await fetch(`/api/projects/${projectId}/soa/${selectedVersionId}/rows`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            spaceCategory: row.spaceCategory,
            roomType: row.roomType,
            code: row.code,
            quantity: row.quantity,
            targetArea: row.targetArea,
            currentArea: row.currentArea,
            requirement: row.requirement,
            requirementSource: row.requirementSource,
            comment: row.comment,
          }),
        })
      }

      // 3. Update dirty (existing) rows
      const dirtyRows = rows.filter(r => r._dirty && !r._isNew && !r._deleted)
      for (const row of dirtyRows) {
        await fetch(`/api/projects/${projectId}/soa/${selectedVersionId}/rows?rowId=${row.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            spaceCategory: row.spaceCategory,
            roomType: row.roomType,
            code: row.code,
            quantity: row.quantity,
            targetArea: row.targetArea,
            currentArea: row.currentArea,
            requirement: row.requirement,
            requirementSource: row.requirementSource,
            comment: row.comment,
            sortOrder: row.sortOrder,
          }),
        })
      }

      toast('All changes saved', 'success')
      // Refresh rows from server
      await fetchRows(selectedVersionId)
      // Refresh versions for updated row counts
      const vRes = await fetch(`/api/projects/${projectId}/soa`)
      if (vRes.ok) {
        const vJson = await vRes.json()
        setVersions(vJson.data?.versions ?? [])
      }
    } catch {
      toast('Some changes failed to save', 'error')
    } finally {
      setSaving(false)
    }
  }

  /* ── Render ────────────────────────────────────────── */

  if (loadingVersions) {
    return (
      <div className="space-y-4">
        <h1 className="text-lg font-semibold text-ink-900">Schedule of Accommodation</h1>
        <div className="space-y-3">
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-4">
        <h1 className="text-lg font-semibold text-ink-900">Schedule of Accommodation</h1>
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-ink-900">Schedule of Accommodation</h1>
          <p className="text-xs text-ink-400 mt-1">
            Manage room schedules, areas, and space allocation
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowNewVersion(true)}
            className="flex items-center gap-1.5 rounded-md border border-surface-300 px-3 py-2 text-xs font-medium text-ink-600 hover:bg-surface-50 transition-colors"
          >
            <Copy className="w-3.5 h-3.5" />
            New Version
          </button>
          {hasUnsavedChanges && (
            <button
              onClick={handleSaveAll}
              disabled={saving}
              className="flex items-center gap-1.5 rounded-md bg-accent-600 px-4 py-2 text-xs font-medium text-white hover:bg-accent-700 transition-colors disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              Save Changes
            </button>
          )}
        </div>
      </div>

      {/* New Version Dialog */}
      {showNewVersion && (
        <div className="rounded-lg border border-surface-200 bg-white p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-ink-800">Create New Version</h3>
            <button onClick={() => setShowNewVersion(false)} className="text-ink-400 hover:text-ink-600">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-medium text-ink-500 mb-1">Version Name</label>
              <input
                type="text"
                value={newVersionName}
                onChange={e => setNewVersionName(e.target.value)}
                placeholder="e.g. Stage 2 Issue"
                className="w-full rounded-md border border-surface-300 px-3 py-2 text-sm text-ink-800 focus:border-accent-500 focus:ring-1 focus:ring-accent-500"
              />
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 text-sm text-ink-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={copyFromPrevious}
                  onChange={e => setCopyFromPrevious(e.target.checked)}
                  className="rounded border-surface-300 text-accent-600 focus:ring-accent-500"
                />
                Copy rows from current version
              </label>
            </div>
          </div>
          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={handleCreateVersion}
              disabled={creatingVersion}
              className="flex items-center gap-1.5 rounded-md bg-accent-600 px-4 py-2 text-xs font-medium text-white hover:bg-accent-700 transition-colors disabled:opacity-50"
            >
              {creatingVersion ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
              Create
            </button>
            <button
              onClick={() => setShowNewVersion(false)}
              className="rounded-md border border-surface-300 px-4 py-2 text-xs font-medium text-ink-600 hover:bg-surface-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* No versions yet */}
      {versions.length === 0 && !showNewVersion && (
        <div className="rounded-lg border border-dashed border-surface-300 bg-surface-50 p-8 text-center">
          <Table2 className="w-8 h-8 text-ink-300 mx-auto mb-3" />
          <p className="text-sm font-medium text-ink-600 mb-1">No schedule versions yet</p>
          <p className="text-xs text-ink-400 mb-4">
            Create your first SOA version to start defining the room schedule.
          </p>
          <button
            onClick={() => setShowNewVersion(true)}
            className="inline-flex items-center gap-1.5 rounded-md bg-accent-600 px-3 py-2 text-xs font-medium text-white hover:bg-accent-700 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Create First Version
          </button>
        </div>
      )}

      {/* Version Selector + Table */}
      {versions.length > 0 && (
        <>
          {/* Version selector */}
          <div className="flex items-center gap-3">
            <div className="relative">
              <button
                onClick={() => setShowVersionDropdown(v => !v)}
                className="flex items-center gap-2 rounded-md border border-surface-300 bg-white px-3 py-2 text-sm text-ink-700 hover:bg-surface-50 transition-colors min-w-[220px] justify-between"
              >
                <span className="truncate">
                  V{selectedVersion?.versionNumber ?? '?'}: {selectedVersion?.name || 'Untitled'}
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-ink-400 shrink-0" />
              </button>

              {showVersionDropdown && (
                <div className="absolute z-20 mt-1 w-72 rounded-md border border-surface-200 bg-white shadow-lg">
                  {versions.map(v => (
                    <button
                      key={v.id}
                      onClick={() => { setSelectedVersionId(v.id); setShowVersionDropdown(false) }}
                      className={cn(
                        'flex items-center justify-between w-full px-3 py-2 text-sm hover:bg-surface-50 transition-colors text-left',
                        v.id === selectedVersionId && 'bg-accent-50 text-accent-700',
                      )}
                    >
                      <div>
                        <span className="font-medium">V{v.versionNumber}</span>
                        <span className="text-ink-500 ml-2">{v.name || 'Untitled'}</span>
                        <span className="text-ink-400 ml-2 text-xs">{v._count?.rows ?? 0} rows</span>
                      </div>
                      <span className={cn('text-[10px] px-1.5 py-0.5 rounded font-medium', VERSION_STATUS_COLORS[v.status] || 'bg-ink-50 text-ink-500')}>
                        {VERSION_STATUS_LABELS[v.status] || v.status}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {selectedVersion && (
              <span className={cn('text-[10px] px-2 py-1 rounded font-semibold uppercase', VERSION_STATUS_COLORS[selectedVersion.status])}>
                {VERSION_STATUS_LABELS[selectedVersion.status]}
              </span>
            )}

            {hasUnsavedChanges && (
              <span className="flex items-center gap-1 text-[11px] text-amber-600">
                <AlertCircle className="w-3 h-3" />
                Unsaved changes
              </span>
            )}
          </div>

          {/* Loading rows */}
          {loadingRows && (
            <div className="space-y-3">
              <SkeletonRow />
              <SkeletonRow />
              <SkeletonRow />
            </div>
          )}

          {/* SOA Table */}
          {!loadingRows && (
            <div className="rounded-lg border border-surface-200 bg-white overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-surface-50 border-b border-surface-200">
                      <th className="text-left px-3 py-2.5 font-semibold text-ink-600 whitespace-nowrap w-[140px]">Space Category</th>
                      <th className="text-left px-3 py-2.5 font-semibold text-ink-600 whitespace-nowrap w-[160px]">Room Type</th>
                      <th className="text-left px-3 py-2.5 font-semibold text-ink-600 whitespace-nowrap w-[80px]">Code</th>
                      <th className="text-right px-3 py-2.5 font-semibold text-ink-600 whitespace-nowrap w-[60px]">Qty</th>
                      <th className="text-right px-3 py-2.5 font-semibold text-ink-600 whitespace-nowrap w-[90px]">Target (m&sup2;)</th>
                      <th className="text-right px-3 py-2.5 font-semibold text-ink-600 whitespace-nowrap w-[90px]">Current (m&sup2;)</th>
                      <th className="text-right px-3 py-2.5 font-semibold text-ink-600 whitespace-nowrap w-[100px]">Total Target</th>
                      <th className="text-right px-3 py-2.5 font-semibold text-ink-600 whitespace-nowrap w-[100px]">Total Current</th>
                      <th className="text-left px-3 py-2.5 font-semibold text-ink-600 whitespace-nowrap w-[100px]">Requirement</th>
                      <th className="text-left px-3 py-2.5 font-semibold text-ink-600 whitespace-nowrap w-[140px]">Comment</th>
                      <th className="text-center px-3 py-2.5 font-semibold text-ink-600 w-[40px]"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeRows.length === 0 ? (
                      <tr>
                        <td colSpan={11} className="px-3 py-8 text-center">
                          <Table2 className="w-6 h-6 text-ink-300 mx-auto mb-2" />
                          <p className="text-sm text-ink-500 mb-1">No rooms added yet</p>
                          <button
                            onClick={addRow}
                            className="inline-flex items-center gap-1 text-xs text-accent-600 hover:text-accent-700 font-medium"
                          >
                            <Plus className="w-3 h-3" />
                            Add your first room
                          </button>
                        </td>
                      </tr>
                    ) : (
                      activeRows.map((row) => {
                        const totalTarget = (row.quantity ?? 0) * (row.targetArea ?? 0)
                        const totalCurrent = (row.quantity ?? 0) * (row.currentArea ?? 0)

                        return (
                          <tr
                            key={row.id}
                            className={cn(
                              'border-b border-surface-100 hover:bg-surface-50/50 transition-colors',
                              (row._isNew || row._dirty) && 'bg-amber-50/30',
                            )}
                          >
                            {/* Space Category */}
                            <td className="px-2 py-1.5">
                              <select
                                value={row.spaceCategory}
                                onChange={e => updateRow(row.id, 'spaceCategory', e.target.value)}
                                className="w-full rounded border border-surface-200 px-2 py-1.5 text-xs text-ink-700 bg-transparent focus:border-accent-500 focus:ring-1 focus:ring-accent-500"
                              >
                                {SPACE_CATEGORIES.map(sc => (
                                  <option key={sc.value} value={sc.value}>{sc.label}</option>
                                ))}
                              </select>
                            </td>

                            {/* Room Type */}
                            <td className="px-2 py-1.5">
                              <input
                                type="text"
                                value={row.roomType}
                                onChange={e => updateRow(row.id, 'roomType', e.target.value)}
                                list={`room-suggestions-${row.id}`}
                                placeholder="Room type..."
                                className="w-full rounded border border-surface-200 px-2 py-1.5 text-xs text-ink-700 bg-transparent focus:border-accent-500 focus:ring-1 focus:ring-accent-500"
                              />
                              <datalist id={`room-suggestions-${row.id}`}>
                                {(ROOM_TYPE_SUGGESTIONS[row.spaceCategory] || []).map(rt => (
                                  <option key={rt} value={rt} />
                                ))}
                              </datalist>
                            </td>

                            {/* Code */}
                            <td className="px-2 py-1.5">
                              <input
                                type="text"
                                value={row.code ?? ''}
                                onChange={e => updateRow(row.id, 'code', e.target.value || null)}
                                placeholder="STD-01"
                                className="w-full rounded border border-surface-200 px-2 py-1.5 text-xs text-ink-700 bg-transparent focus:border-accent-500 focus:ring-1 focus:ring-accent-500"
                              />
                            </td>

                            {/* Quantity */}
                            <td className="px-2 py-1.5">
                              <input
                                type="number"
                                min={0}
                                value={row.quantity}
                                onChange={e => updateRow(row.id, 'quantity', parseInt(e.target.value) || 0)}
                                className="w-full rounded border border-surface-200 px-2 py-1.5 text-xs text-ink-700 bg-transparent text-right focus:border-accent-500 focus:ring-1 focus:ring-accent-500"
                              />
                            </td>

                            {/* Target Area per unit */}
                            <td className="px-2 py-1.5">
                              <input
                                type="number"
                                min={0}
                                step={0.01}
                                value={row.targetArea ?? ''}
                                onChange={e => updateRow(row.id, 'targetArea', e.target.value ? parseFloat(e.target.value) : null)}
                                placeholder="0.00"
                                className="w-full rounded border border-surface-200 px-2 py-1.5 text-xs text-ink-700 bg-transparent text-right focus:border-accent-500 focus:ring-1 focus:ring-accent-500"
                              />
                            </td>

                            {/* Current Area per unit */}
                            <td className="px-2 py-1.5">
                              <input
                                type="number"
                                min={0}
                                step={0.01}
                                value={row.currentArea ?? ''}
                                onChange={e => updateRow(row.id, 'currentArea', e.target.value ? parseFloat(e.target.value) : null)}
                                placeholder="0.00"
                                className="w-full rounded border border-surface-200 px-2 py-1.5 text-xs text-ink-700 bg-transparent text-right focus:border-accent-500 focus:ring-1 focus:ring-accent-500"
                              />
                            </td>

                            {/* Total Target (calculated, readonly) */}
                            <td className="px-3 py-1.5 text-right text-ink-600 font-medium tabular-nums">
                              {totalTarget > 0 ? totalTarget.toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) : 'Not provided'}
                            </td>

                            {/* Total Current (calculated, readonly) */}
                            <td className="px-3 py-1.5 text-right text-ink-600 font-medium tabular-nums">
                              {totalCurrent > 0 ? totalCurrent.toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) : 'Not provided'}
                            </td>

                            {/* Requirement */}
                            <td className="px-2 py-1.5">
                              <select
                                value={row.requirement ?? ''}
                                onChange={e => updateRow(row.id, 'requirement', e.target.value || null)}
                                className="w-full rounded border border-surface-200 px-2 py-1.5 text-xs text-ink-700 bg-transparent focus:border-accent-500 focus:ring-1 focus:ring-accent-500"
                              >
                                <option value="">--</option>
                                {REQUIREMENTS.map(r => (
                                  <option key={r.value} value={r.value}>{r.label}</option>
                                ))}
                              </select>
                            </td>

                            {/* Comment */}
                            <td className="px-2 py-1.5">
                              <input
                                type="text"
                                value={row.comment ?? ''}
                                onChange={e => updateRow(row.id, 'comment', e.target.value || null)}
                                placeholder="Notes..."
                                className="w-full rounded border border-surface-200 px-2 py-1.5 text-xs text-ink-700 bg-transparent focus:border-accent-500 focus:ring-1 focus:ring-accent-500"
                              />
                            </td>

                            {/* Actions */}
                            <td className="px-2 py-1.5 text-center">
                              <button
                                onClick={() => deleteRow(row.id)}
                                className="p-1 rounded text-ink-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                                title="Remove row"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        )
                      })
                    )}

                    {/* Summary row */}
                    {activeRows.length > 0 && (
                      <tr className="bg-surface-100 border-t-2 border-surface-300 font-semibold text-ink-800">
                        <td className="px-3 py-2.5" colSpan={3}>
                          Totals ({summary.totalRows} row{summary.totalRows !== 1 ? 's' : ''})
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums">
                          {summary.totalQuantity.toLocaleString('en-GB')}
                        </td>
                        <td className="px-3 py-2.5 text-right" colSpan={2}></td>
                        <td className="px-3 py-2.5 text-right tabular-nums">
                          {summary.totalTargetArea.toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                          <span className="text-[10px] font-normal text-ink-400 ml-0.5">m&sup2;</span>
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums">
                          {summary.totalCurrentArea.toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                          <span className="text-[10px] font-normal text-ink-400 ml-0.5">m&sup2;</span>
                        </td>
                        <td colSpan={3}></td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Add row button */}
              <div className="border-t border-surface-200 px-3 py-2">
                <button
                  onClick={addRow}
                  className="flex items-center gap-1.5 text-xs text-accent-600 hover:text-accent-700 font-medium transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Row
                </button>
              </div>
            </div>
          )}

          {/* Save bar (sticky bottom when there are unsaved changes) */}
          {hasUnsavedChanges && (
            <div className="sticky bottom-4 flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 shadow-lg">
              <p className="text-xs text-amber-800">
                You have unsaved changes to this SOA version.
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { if (selectedVersionId) fetchRows(selectedVersionId) }}
                  className="rounded-md border border-amber-300 px-3 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-100 transition-colors"
                >
                  Discard
                </button>
                <button
                  onClick={handleSaveAll}
                  disabled={saving}
                  className="flex items-center gap-1.5 rounded-md bg-accent-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-accent-700 transition-colors disabled:opacity-50"
                >
                  {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  Save All Changes
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

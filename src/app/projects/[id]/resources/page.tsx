'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import {
  Users, Plus, Loader2, Clock, ChevronLeft, ChevronRight,
  AlertTriangle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useToast } from '@/components/Toast'
import { SkeletonRow } from '@/components/Skeleton'

/* ── Types ────────────────────────────────────────────────── */

interface Member {
  profileId: string
  fullName: string
  jobTitle: string | null
  role: string
}

interface Allocation {
  id: string
  profileId: string
  weekStarting: string
  hoursAllocated: number
  role: string | null
  stage: string | null
  isBillable: boolean
  notes: string | null
  profile: { id: string; fullName: string; jobTitle: string | null }
}

interface Week {
  start: string
  label: string
}

interface ResourcePlanData {
  allocations: Allocation[]
  members: Member[]
  weeks: Week[]
  currentWorkStage: number
  timesheetActuals: Record<string, number> // profileId::weekStart -> hours
}

/* ── Helpers ──────────────────────────────────────────────── */

function getAllocationKey(profileId: string, weekStart: string) {
  return `${profileId}::${weekStart}`
}

/* ── Component ───────────────────────────────────────────── */

export default function ResourcePlanningPage() {
  const { id: projectId } = useParams<{ id: string }>()
  const { toast } = useToast()

  const [data, setData] = useState<ResourcePlanData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [weeksOffset, setWeeksOffset] = useState(0)
  const [saving, setSaving] = useState<string | null>(null) // key of cell being saved
  const [showAddMember, setShowAddMember] = useState(false)

  // Local edits: key = profileId::weekStart, value = hours string
  const [edits, setEdits] = useState<Record<string, string>>({})

  const weeksCount = 8

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch(
        `/api/projects/${projectId}/resource-plan?weeks=${weeksCount}&offset=${weeksOffset}`
      )
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || `Failed to load resource plan`)
      }
      const json = await res.json()
      setData(json.data)
      setError(null)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [projectId, weeksOffset])

  useEffect(() => { fetchData() }, [fetchData])

  // Build allocation lookup
  const allocationMap = new Map<string, Allocation>()
  data?.allocations.forEach(a => {
    const weekKey = a.weekStarting.split('T')[0]
    allocationMap.set(getAllocationKey(a.profileId, weekKey), a)
  })

  // Get unique members who have allocations
  const allocatedMemberIds = new Set(data?.allocations.map(a => a.profileId) ?? [])
  const allMembers = data?.members ?? []

  // Show members who have allocations + any added via the dropdown
  const [addedMemberIds, setAddedMemberIds] = useState<Set<string>>(new Set())

  const displayedMembers = allMembers.filter(
    m => allocatedMemberIds.has(m.profileId) || addedMemberIds.has(m.profileId)
  )

  const unallocatedMembers = allMembers.filter(
    m => !allocatedMemberIds.has(m.profileId) && !addedMemberIds.has(m.profileId)
  )

  // Save an allocation
  const saveAllocation = async (profileId: string, weekStart: string, hours: number) => {
    const key = getAllocationKey(profileId, weekStart)
    setSaving(key)
    try {
      const res = await fetch(`/api/projects/${projectId}/resource-plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profileId,
          weekStarting: weekStart,
          hoursAllocated: hours,
          isBillable: true,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Failed to save')
      }
      // Refresh data
      await fetchData()
      // Clear the edit
      setEdits(prev => {
        const next = { ...prev }
        delete next[key]
        return next
      })
    } catch (err: any) {
      toast(err.message, 'error')
    } finally {
      setSaving(null)
    }
  }

  const handleBlur = (profileId: string, weekStart: string) => {
    const key = getAllocationKey(profileId, weekStart)
    const val = edits[key]
    if (val === undefined) return // no edit

    const hours = parseFloat(val)
    const existing = allocationMap.get(key)

    if (isNaN(hours) || hours < 0) {
      // Reset to original
      setEdits(prev => {
        const next = { ...prev }
        delete next[key]
        return next
      })
      return
    }

    // Only save if changed
    if (existing && existing.hoursAllocated === hours) {
      setEdits(prev => {
        const next = { ...prev }
        delete next[key]
        return next
      })
      return
    }

    saveAllocation(profileId, weekStart, hours)
  }

  const handleKeyDown = (e: React.KeyboardEvent, profileId: string, weekStart: string) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      ;(e.target as HTMLInputElement).blur()
    }
    if (e.key === 'Escape') {
      const key = getAllocationKey(profileId, weekStart)
      setEdits(prev => {
        const next = { ...prev }
        delete next[key]
        return next
      })
      ;(e.target as HTMLInputElement).blur()
    }
  }

  // Compute row totals
  const getRowTotal = (profileId: string): number => {
    if (!data) return 0
    return data.weeks.reduce((sum, week) => {
      const key = getAllocationKey(profileId, week.start)
      const alloc = allocationMap.get(key)
      return sum + (alloc?.hoursAllocated ?? 0)
    }, 0)
  }

  // Compute column totals
  const getColTotal = (weekStart: string): number => {
    return displayedMembers.reduce((sum, m) => {
      const key = getAllocationKey(m.profileId, weekStart)
      const alloc = allocationMap.get(key)
      return sum + (alloc?.hoursAllocated ?? 0)
    }, 0)
  }

  // Actual hours helpers
  const actuals = data?.timesheetActuals ?? {}

  const getActual = (profileId: string, weekStart: string): number => {
    return actuals[getAllocationKey(profileId, weekStart)] ?? 0
  }

  const getRowActualTotal = (profileId: string): number => {
    if (!data) return 0
    return data.weeks.reduce((sum, week) => sum + getActual(profileId, week.start), 0)
  }

  const getColActualTotal = (weekStart: string): number => {
    return displayedMembers.reduce((sum, m) => sum + getActual(m.profileId, weekStart), 0)
  }

  /* ── Render ─────────────────────────────────────────────── */

  if (loading && !data) {
    return (
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-ink-900">Resource Planning</h2>
        {Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)}
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-ink-900">Resource Planning</h2>
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-amber-800">{error}</p>
            <p className="text-xs text-amber-600 mt-1">You may need Manager or above permissions to view resource plans.</p>
          </div>
        </div>
      </div>
    )
  }

  if (!data) return null

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-ink-900">Resource Planning</h2>
          <p className="text-xs text-ink-400 mt-0.5">
            Allocate team hours per week — click any cell to edit
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Week navigation */}
          <button
            onClick={() => setWeeksOffset(o => o - weeksCount)}
            className="p-1.5 rounded-md border border-surface-300 text-ink-500 hover:bg-surface-50 transition-colors"
            title="Previous weeks"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => setWeeksOffset(0)}
            disabled={weeksOffset === 0}
            className="px-2.5 py-1.5 text-[11px] font-medium rounded-md border border-surface-300 text-ink-500 hover:bg-surface-50 disabled:opacity-40 transition-colors"
          >
            This Week
          </button>
          <button
            onClick={() => setWeeksOffset(o => o + weeksCount)}
            className="p-1.5 rounded-md border border-surface-300 text-ink-500 hover:bg-surface-50 transition-colors"
            title="Next weeks"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Allocation Grid */}
      <div className="bg-white rounded-lg border border-surface-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-surface-200 bg-surface-50">
                <th className="text-left py-3 px-3 font-semibold text-ink-600 sticky left-0 bg-surface-50 z-10 min-w-[180px]">
                  Team Member
                </th>
                {data.weeks.map(week => (
                  <th
                    key={week.start}
                    className="text-center py-3 px-2 font-medium text-ink-500 min-w-[72px]"
                  >
                    {week.label}
                  </th>
                ))}
                <th className="text-center py-3 px-3 font-semibold text-ink-600 min-w-[64px] bg-surface-100">
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {displayedMembers.length === 0 ? (
                <tr>
                  <td
                    colSpan={data.weeks.length + 2}
                    className="py-8 text-center text-ink-400"
                  >
                    <Users className="w-8 h-8 mx-auto mb-2 text-ink-200" />
                    <p className="text-sm font-medium">No team members allocated</p>
                    <p className="text-xs mt-1">Add a team member below to start planning</p>
                  </td>
                </tr>
              ) : (
                displayedMembers.map(member => {
                  const rowTotal = getRowTotal(member.profileId)
                  return (
                    <tr key={member.profileId} className="border-b border-surface-100 hover:bg-surface-50/50">
                      {/* Member info */}
                      <td className="py-2.5 px-3 sticky left-0 bg-white z-10">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-accent-100 flex items-center justify-center text-[10px] font-bold text-accent-700 shrink-0">
                            {member.fullName.split(' ').map(n => n[0]).join('').slice(0, 2)}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-ink-800 truncate">{member.fullName}</p>
                            <p className="text-[10px] text-ink-400 truncate">{member.role || member.jobTitle || '—'}</p>
                          </div>
                        </div>
                      </td>

                      {/* Week cells */}
                      {data.weeks.map(week => {
                        const key = getAllocationKey(member.profileId, week.start)
                        const alloc = allocationMap.get(key)
                        const editVal = edits[key]
                        const displayVal = editVal !== undefined
                          ? editVal
                          : alloc?.hoursAllocated?.toString() ?? ''
                        const isSaving = saving === key

                        const actualHours = getActual(member.profileId, week.start)
                        const planned = alloc?.hoursAllocated ?? 0
                        const overAllocated = actualHours > 0 && planned > 0 && actualHours > planned

                        return (
                          <td key={week.start} className="py-1.5 px-1 text-center">
                            <div className="relative">
                              <input
                                type="number"
                                min="0"
                                max="60"
                                step="0.5"
                                value={displayVal}
                                onChange={(e) => setEdits(prev => ({ ...prev, [key]: e.target.value }))}
                                onBlur={() => handleBlur(member.profileId, week.start)}
                                onKeyDown={(e) => handleKeyDown(e, member.profileId, week.start)}
                                disabled={isSaving}
                                placeholder="—"
                                className={cn(
                                  'w-14 text-center text-xs py-1.5 rounded-md border transition-colors',
                                  'focus:ring-2 focus:ring-accent-500 focus:border-accent-500 outline-none',
                                  displayVal && parseFloat(displayVal) > 0
                                    ? 'border-accent-200 bg-accent-50/50 text-ink-800 font-medium'
                                    : 'border-surface-200 bg-white text-ink-400',
                                  isSaving && 'opacity-50',
                                )}
                              />
                              {isSaving && (
                                <Loader2 className="w-3 h-3 animate-spin absolute top-1/2 right-1 -translate-y-1/2 text-accent-500" />
                              )}
                            </div>
                            {actualHours > 0 && (
                              <p className={cn(
                                'text-[10px] mt-0.5 font-medium',
                                overAllocated ? 'text-amber-600' : 'text-ink-400',
                              )}>
                                {actualHours}h actual
                              </p>
                            )}
                          </td>
                        )
                      })}

                      {/* Row total */}
                      <td className="py-2.5 px-3 text-center bg-surface-50">
                        <span className={cn(
                          'text-xs font-semibold',
                          rowTotal > 40 ? 'text-red-600' : rowTotal > 0 ? 'text-ink-800' : 'text-ink-300',
                        )}>
                          {rowTotal > 0 ? `${rowTotal}h` : '—'}
                        </span>
                        {(() => {
                          const rowActual = getRowActualTotal(member.profileId)
                          return rowActual > 0 ? (
                            <p className={cn(
                              'text-[10px] font-medium mt-0.5',
                              rowActual > rowTotal ? 'text-amber-600' : 'text-ink-400',
                            )}>
                              {rowActual}h actual
                            </p>
                          ) : null
                        })()}
                      </td>
                    </tr>
                  )
                })
              )}

              {/* Column totals row */}
              {displayedMembers.length > 0 && (
                <tr className="bg-surface-50 border-t border-surface-200">
                  <td className="py-2.5 px-3 sticky left-0 bg-surface-50 z-10">
                    <span className="text-xs font-semibold text-ink-600 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" />
                      Weekly Total
                    </span>
                  </td>
                  {data.weeks.map(week => {
                    const total = getColTotal(week.start)
                    const colActual = getColActualTotal(week.start)
                    return (
                      <td key={week.start} className="py-2.5 px-1 text-center">
                        <span className={cn(
                          'text-xs font-semibold',
                          total > 0 ? 'text-ink-700' : 'text-ink-300',
                        )}>
                          {total > 0 ? `${total}h` : '—'}
                        </span>
                        {colActual > 0 && (
                          <p className={cn(
                            'text-[10px] font-medium mt-0.5',
                            colActual > total ? 'text-amber-600' : 'text-ink-400',
                          )}>
                            {colActual}h actual
                          </p>
                        )}
                      </td>
                    )
                  })}
                  <td className="py-2.5 px-3 text-center bg-surface-100">
                    <span className="text-xs font-bold text-ink-800">
                      {displayedMembers.reduce((sum, m) => sum + getRowTotal(m.profileId), 0)}h
                    </span>
                    {(() => {
                      const grandActual = displayedMembers.reduce((sum, m) => sum + getRowActualTotal(m.profileId), 0)
                      return grandActual > 0 ? (
                        <p className="text-[10px] font-medium text-ink-400 mt-0.5">{grandActual}h actual</p>
                      ) : null
                    })()}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Member */}
      <div className="flex items-center gap-2">
        {showAddMember ? (
          <div className="flex items-center gap-2">
            <select
              className="rounded-md border border-surface-300 text-xs py-1.5 px-2 focus:ring-2 focus:ring-accent-500 focus:border-accent-500"
              defaultValue=""
              onChange={(e) => {
                if (e.target.value) {
                  setAddedMemberIds(prev => new Set([...prev, e.target.value]))
                  setShowAddMember(false)
                }
              }}
            >
              <option value="" disabled>Select team member…</option>
              {unallocatedMembers.map(m => (
                <option key={m.profileId} value={m.profileId}>
                  {m.fullName} — {m.role || m.jobTitle || 'Member'}
                </option>
              ))}
            </select>
            <button
              onClick={() => setShowAddMember(false)}
              className="text-xs text-ink-400 hover:text-ink-600"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowAddMember(true)}
            disabled={unallocatedMembers.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-dashed border-surface-300 text-ink-500 hover:bg-surface-50 hover:border-accent-300 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Team Member
          </button>
        )}
        {unallocatedMembers.length === 0 && allMembers.length > 0 && (
          <span className="text-[10px] text-ink-400">All project members are shown</span>
        )}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-[10px] text-ink-400 flex-wrap">
        <span>Click any cell to enter hours · Tab/Enter to save · Esc to cancel</span>
        <span className="text-red-500 font-medium">Red total = over 40h/week</span>
        <span className="text-ink-400 font-medium">Grey = timesheet actuals within plan</span>
        <span className="text-amber-600 font-medium">Amber = actuals exceed planned hours</span>
      </div>
    </div>
  )
}

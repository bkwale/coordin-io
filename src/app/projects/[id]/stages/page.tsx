'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import {
  GitBranch, ChevronRight, CheckCircle2, Circle,
  AlertTriangle, ArrowUp, ArrowDown, Loader2, Lock,
  Unlock, FileText, User, Calendar,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useToast } from '@/components/Toast'
import { SkeletonRow } from '@/components/Skeleton'

/* ── Types ────────────────────────────────────────────────── */

interface StageGate {
  id: string
  fromStage: number
  toStage: number
  advancedAt: string
  signOffNotes: string | null
  prerequisitesMet: string[] | null
  isRollback: boolean
  advancedBy: { id: string; fullName: string; jobTitle: string | null }
}

interface Prerequisite {
  title: string
  required: boolean
  completed?: boolean
}

interface StageData {
  project: {
    id: string
    name: string
    stage: string
    currentWorkStage: number
    workStageFramework: string | null
  }
  gates: StageGate[]
  currentPrerequisiteStatus: Prerequisite[]
  nextStagePrerequisites: Prerequisite[]
}

/* ── RIBA stage metadata ─────────────────────────────────── */

const RIBA_STAGES: { id: number; label: string; shortLabel: string; color: string; bg: string }[] = [
  { id: 0, label: 'Stage 0 — Strategic Definition',       shortLabel: '0', color: 'text-slate-700',   bg: 'bg-slate-100' },
  { id: 1, label: 'Stage 1 — Preparation & Briefing',     shortLabel: '1', color: 'text-blue-700',    bg: 'bg-blue-100' },
  { id: 2, label: 'Stage 2 — Concept Design',             shortLabel: '2', color: 'text-indigo-700',  bg: 'bg-indigo-100' },
  { id: 3, label: 'Stage 3 — Spatial Coordination',       shortLabel: '3', color: 'text-violet-700',  bg: 'bg-violet-100' },
  { id: 4, label: 'Stage 4 — Technical Design',           shortLabel: '4', color: 'text-purple-700',  bg: 'bg-purple-100' },
  { id: 5, label: 'Stage 5 — Manufacturing & Construction', shortLabel: '5', color: 'text-amber-700', bg: 'bg-amber-100' },
  { id: 6, label: 'Stage 6 — Handover',                   shortLabel: '6', color: 'text-emerald-700', bg: 'bg-emerald-100' },
  { id: 7, label: 'Stage 7 — Use',                        shortLabel: '7', color: 'text-green-700',   bg: 'bg-green-100' },
]

/* ── Component ───────────────────────────────────────────── */

export default function StagesPage() {
  const params = useParams()
  const projectId = params.id as string
  const { toast } = useToast()

  const [data, setData] = useState<StageData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Advance / rollback state
  const [advancing, setAdvancing] = useState(false)
  const [rollingBack, setRollingBack] = useState(false)
  const [signOffNotes, setSignOffNotes] = useState('')
  const [showAdvanceModal, setShowAdvanceModal] = useState(false)
  const [showRollbackModal, setShowRollbackModal] = useState(false)
  const [skipPrerequisites, setSkipPrerequisites] = useState(false)

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch(`/api/projects/${projectId}/stage-gates`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to load stage data')
      setData(json.data)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => { fetchData() }, [fetchData])

  /* ── Advance handler ─────────────────────────────────── */

  const handleAdvance = async () => {
    try {
      setAdvancing(true)
      const res = await fetch(`/api/projects/${projectId}/stage-gates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signOffNotes: signOffNotes || undefined, skipPrerequisites }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to advance stage')
      toast(`Advanced to Stage ${json.data.newStage}`, 'success')
      setShowAdvanceModal(false)
      setSignOffNotes('')
      setSkipPrerequisites(false)
      fetchData()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to advance', 'error')
    } finally {
      setAdvancing(false)
    }
  }

  /* ── Rollback handler ────────────────────────────────── */

  const handleRollback = async () => {
    try {
      setRollingBack(true)
      const res = await fetch(`/api/projects/${projectId}/stage-gates`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signOffNotes: signOffNotes || undefined }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to roll back stage')
      toast(`Rolled back to Stage ${json.data.newStage}`, 'success')
      setShowRollbackModal(false)
      setSignOffNotes('')
      fetchData()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to roll back', 'error')
    } finally {
      setRollingBack(false)
    }
  }

  /* ── Loading / error states ─────────────────────────── */

  if (loading) {
    return (
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-ink-900">RIBA Stage Tracking</h2>
        <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <SkeletonRow key={i} />)}</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-ink-900">RIBA Stage Tracking</h2>
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-amber-800">{error}</p>
            <p className="text-xs text-amber-600 mt-1">This feature may need to be enabled in Settings → Features.</p>
          </div>
        </div>
      </div>
    )
  }

  if (!data) return null

  const currentStage = data.project.currentWorkStage
  const currentMeta = RIBA_STAGES[currentStage]
  const canAdvance = currentStage < 7
  const canRollBack = currentStage > 0

  // Check if all required prerequisites for current stage are met
  const requiredPrereqs = data.currentPrerequisiteStatus.filter(p => p.required)
  const allRequiredMet = requiredPrereqs.every(p => p.completed)
  const unmetRequired = requiredPrereqs.filter(p => !p.completed)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-ink-900">RIBA Stage Tracking</h2>
          <p className="text-xs text-ink-400 mt-0.5">
            {data.project.workStageFramework || 'RIBA'} Plan of Work — stage gate control
          </p>
        </div>
        <div className="flex items-center gap-2">
          {canRollBack && (
            <button
              onClick={() => { setSignOffNotes(''); setShowRollbackModal(true) }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-surface-300 text-ink-500 hover:bg-surface-50 transition-colors"
            >
              <ArrowDown className="w-3.5 h-3.5" />
              Roll Back
            </button>
          )}
          {canAdvance && (
            <button
              onClick={() => { setSignOffNotes(''); setSkipPrerequisites(false); setShowAdvanceModal(true) }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-accent-600 text-white hover:bg-accent-700 transition-colors"
            >
              <ArrowUp className="w-3.5 h-3.5" />
              Advance Stage
            </button>
          )}
        </div>
      </div>

      {/* ── Stage Timeline ─────────────────────────────── */}
      <div className="bg-white rounded-lg border border-surface-200 p-5">
        <h3 className="text-sm font-semibold text-ink-700 mb-4">Stage Progress</h3>
        <div className="flex items-center gap-0 overflow-x-auto pb-2">
          {RIBA_STAGES.map((stage, idx) => {
            const isCurrent = idx === currentStage
            const isPast = idx < currentStage
            const isFuture = idx > currentStage

            return (
              <div key={stage.id} className="flex items-center shrink-0">
                {/* Stage node */}
                <div className={cn(
                  'flex flex-col items-center gap-1.5 px-2 min-w-[72px]',
                )}>
                  <div className={cn(
                    'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all',
                    isCurrent && 'border-accent-500 bg-accent-50 text-accent-700 ring-2 ring-accent-200',
                    isPast && 'border-emerald-500 bg-emerald-50 text-emerald-700',
                    isFuture && 'border-surface-300 bg-surface-50 text-ink-400',
                  )}>
                    {isPast ? <CheckCircle2 className="w-4 h-4" /> : stage.shortLabel}
                  </div>
                  <span className={cn(
                    'text-[10px] text-center leading-tight max-w-[68px]',
                    isCurrent && 'font-semibold text-accent-700',
                    isPast && 'text-emerald-600',
                    isFuture && 'text-ink-400',
                  )}>
                    {stage.label.replace(/Stage \d — /, '')}
                  </span>
                </div>

                {/* Connector line */}
                {idx < RIBA_STAGES.length - 1 && (
                  <div className={cn(
                    'h-0.5 w-6 shrink-0',
                    idx < currentStage ? 'bg-emerald-400' : 'bg-surface-200',
                  )} />
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Current Stage Card ─────────────────────────── */}
      <div className="bg-white rounded-lg border border-surface-200 p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center', currentMeta.bg)}>
            <GitBranch className={cn('w-5 h-5', currentMeta.color)} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-ink-900">{currentMeta.label}</h3>
            <p className="text-xs text-ink-400">Current project stage</p>
          </div>
        </div>

        {/* Prerequisites checklist */}
        {data.currentPrerequisiteStatus.length > 0 && (
          <div className="mt-4">
            <h4 className="text-xs font-semibold text-ink-600 uppercase tracking-wider mb-3">
              Stage Prerequisites
            </h4>
            <div className="space-y-2">
              {data.currentPrerequisiteStatus.map((prereq, i) => (
                <div key={i} className="flex items-center gap-2.5 py-1.5 px-3 rounded-md bg-surface-50">
                  {prereq.completed ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  ) : (
                    <Circle className={cn('w-4 h-4 shrink-0', prereq.required ? 'text-amber-500' : 'text-ink-300')} />
                  )}
                  <span className={cn(
                    'text-xs flex-1',
                    prereq.completed ? 'text-ink-500 line-through' : 'text-ink-700',
                  )}>
                    {prereq.title}
                  </span>
                  {prereq.required && !prereq.completed && (
                    <span className="text-[10px] font-medium text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">Required</span>
                  )}
                  {!prereq.required && (
                    <span className="text-[10px] text-ink-400">Optional</span>
                  )}
                </div>
              ))}
            </div>

            {/* Summary */}
            <div className="mt-3 flex items-center gap-2 text-xs">
              {allRequiredMet ? (
                <>
                  <Unlock className="w-3.5 h-3.5 text-emerald-500" />
                  <span className="text-emerald-600 font-medium">All required prerequisites met — ready to advance</span>
                </>
              ) : (
                <>
                  <Lock className="w-3.5 h-3.5 text-amber-500" />
                  <span className="text-amber-600 font-medium">
                    {unmetRequired.length} required prerequisite{unmetRequired.length > 1 ? 's' : ''} unmet
                  </span>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Next Stage Prerequisites ───────────────────── */}
      {canAdvance && data.nextStagePrerequisites.length > 0 && (
        <div className="bg-white rounded-lg border border-surface-200 p-5">
          <h3 className="text-sm font-semibold text-ink-700 mb-3">
            Next Stage — {RIBA_STAGES[currentStage + 1]?.label}
          </h3>
          <p className="text-xs text-ink-400 mb-3">Tasks that will be required at the next stage:</p>
          <div className="space-y-1.5">
            {data.nextStagePrerequisites.map((prereq, i) => (
              <div key={i} className="flex items-center gap-2 text-xs text-ink-600 py-1">
                <ChevronRight className="w-3 h-3 text-ink-300" />
                <span>{prereq.title}</span>
                {prereq.required && (
                  <span className="text-[10px] font-medium text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded">Required</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Gate History ────────────────────────────────── */}
      <div className="bg-white rounded-lg border border-surface-200 p-5">
        <h3 className="text-sm font-semibold text-ink-700 mb-4">Stage Transition History</h3>

        {data.gates.length === 0 ? (
          <p className="text-xs text-ink-400 py-4 text-center">No stage transitions recorded yet.</p>
        ) : (
          <div className="space-y-3">
            {data.gates.map((gate) => {
              const fromMeta = RIBA_STAGES[gate.fromStage]
              const toMeta = RIBA_STAGES[gate.toStage]

              return (
                <div
                  key={gate.id}
                  className={cn(
                    'flex items-start gap-3 p-3 rounded-lg border',
                    gate.isRollback ? 'border-red-100 bg-red-50/50' : 'border-surface-100 bg-surface-50/50',
                  )}
                >
                  <div className={cn(
                    'w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5',
                    gate.isRollback ? 'bg-red-100' : 'bg-emerald-100',
                  )}>
                    {gate.isRollback ? (
                      <ArrowDown className="w-4 h-4 text-red-600" />
                    ) : (
                      <ArrowUp className="w-4 h-4 text-emerald-600" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={cn('text-xs font-medium px-1.5 py-0.5 rounded', fromMeta?.bg, fromMeta?.color)}>
                        Stage {gate.fromStage}
                      </span>
                      <ChevronRight className="w-3 h-3 text-ink-300" />
                      <span className={cn('text-xs font-medium px-1.5 py-0.5 rounded', toMeta?.bg, toMeta?.color)}>
                        Stage {gate.toStage}
                      </span>
                      {gate.isRollback && (
                        <span className="text-[10px] font-medium text-red-600 bg-red-100 px-1.5 py-0.5 rounded">Rollback</span>
                      )}
                    </div>
                    {gate.signOffNotes && (
                      <p className="text-xs text-ink-500 mt-1.5 flex items-start gap-1.5">
                        <FileText className="w-3 h-3 mt-0.5 shrink-0 text-ink-400" />
                        {gate.signOffNotes}
                      </p>
                    )}
                    <div className="flex items-center gap-3 mt-2 text-[11px] text-ink-400">
                      <span className="flex items-center gap-1">
                        <User className="w-3 h-3" />
                        {gate.advancedBy.fullName}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {new Date(gate.advancedAt).toLocaleDateString('en-GB', {
                          day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
                        })}
                      </span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Advance Modal ──────────────────────────────── */}
      {showAdvanceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 p-6">
            <h3 className="text-base font-semibold text-ink-900 mb-1">Advance to Next Stage</h3>
            <p className="text-xs text-ink-400 mb-4">
              {RIBA_STAGES[currentStage]?.label} → {RIBA_STAGES[currentStage + 1]?.label}
            </p>

            {/* Unmet prerequisites warning */}
            {unmetRequired.length > 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 mb-4">
                <p className="text-xs font-medium text-amber-800 mb-1.5">
                  {unmetRequired.length} required prerequisite{unmetRequired.length > 1 ? 's' : ''} not met:
                </p>
                <ul className="text-xs text-amber-700 space-y-1">
                  {unmetRequired.map((p, i) => (
                    <li key={i} className="flex items-center gap-1.5">
                      <AlertTriangle className="w-3 h-3 shrink-0" />
                      {p.title}
                    </li>
                  ))}
                </ul>
                <label className="flex items-center gap-2 mt-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={skipPrerequisites}
                    onChange={(e) => setSkipPrerequisites(e.target.checked)}
                    className="rounded border-amber-300 text-amber-600 focus:ring-amber-500"
                  />
                  <span className="text-xs text-amber-700 font-medium">Skip prerequisites (Admin/Owner only)</span>
                </label>
              </div>
            )}

            <label className="block text-xs font-medium text-ink-600 mb-1.5">Sign-off Notes (optional)</label>
            <textarea
              value={signOffNotes}
              onChange={(e) => setSignOffNotes(e.target.value)}
              className="w-full rounded-lg border border-surface-300 text-sm p-2.5 focus:ring-2 focus:ring-accent-500 focus:border-accent-500"
              rows={3}
              placeholder="Add sign-off notes for this stage transition..."
            />

            <div className="flex items-center justify-end gap-2 mt-4">
              <button
                onClick={() => setShowAdvanceModal(false)}
                className="px-3 py-1.5 text-xs font-medium rounded-md border border-surface-300 text-ink-600 hover:bg-surface-50"
              >
                Cancel
              </button>
              <button
                onClick={handleAdvance}
                disabled={advancing || (unmetRequired.length > 0 && !skipPrerequisites)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-accent-600 text-white hover:bg-accent-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {advancing && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Confirm Advance
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Rollback Modal ─────────────────────────────── */}
      {showRollbackModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 p-6">
            <h3 className="text-base font-semibold text-ink-900 mb-1">Roll Back Stage</h3>
            <p className="text-xs text-ink-400 mb-4">
              {RIBA_STAGES[currentStage]?.label} → {RIBA_STAGES[currentStage - 1]?.label}
            </p>

            <div className="rounded-lg border border-red-200 bg-red-50 p-3 mb-4">
              <p className="text-xs text-red-700">
                Rolling back a stage is restricted to Admins and Owners. This action is recorded in the audit trail.
              </p>
            </div>

            <label className="block text-xs font-medium text-ink-600 mb-1.5">Reason for rollback</label>
            <textarea
              value={signOffNotes}
              onChange={(e) => setSignOffNotes(e.target.value)}
              className="w-full rounded-lg border border-surface-300 text-sm p-2.5 focus:ring-2 focus:ring-accent-500 focus:border-accent-500"
              rows={3}
              placeholder="Explain why this stage is being rolled back..."
            />

            <div className="flex items-center justify-end gap-2 mt-4">
              <button
                onClick={() => setShowRollbackModal(false)}
                className="px-3 py-1.5 text-xs font-medium rounded-md border border-surface-300 text-ink-600 hover:bg-surface-50"
              >
                Cancel
              </button>
              <button
                onClick={handleRollback}
                disabled={rollingBack}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
              >
                {rollingBack && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Confirm Rollback
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

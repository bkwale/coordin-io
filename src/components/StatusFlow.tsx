'use client'

import { cn } from '@/lib/utils'
import { ChevronRight, ArrowLeft, Ban } from 'lucide-react'

/* ── Status definitions ────────────────────────────────── */

type TaskStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'BLOCKED' | 'READY_FOR_REVIEW' | 'CHANGES_REQUIRED' | 'COMPLETED'

const STATUS_META: Record<TaskStatus, { label: string; color: string; bgColor: string; dotColor: string }> = {
  NOT_STARTED: { label: 'Not started', color: 'text-ink-500', bgColor: 'bg-ink-50', dotColor: 'bg-ink-300' },
  IN_PROGRESS: { label: 'In progress', color: 'text-blue-700', bgColor: 'bg-blue-50', dotColor: 'bg-blue-500' },
  BLOCKED: { label: 'Blocked', color: 'text-red-700', bgColor: 'bg-red-50', dotColor: 'bg-red-500' },
  READY_FOR_REVIEW: { label: 'In review', color: 'text-amber-700', bgColor: 'bg-amber-50', dotColor: 'bg-amber-500' },
  CHANGES_REQUIRED: { label: 'Changes needed', color: 'text-orange-700', bgColor: 'bg-orange-50', dotColor: 'bg-orange-500' },
  COMPLETED: { label: 'Completed', color: 'text-emerald-700', bgColor: 'bg-emerald-50', dotColor: 'bg-emerald-500' },
}

/** Primary flow steps shown left to right */
const MAIN_FLOW: TaskStatus[] = ['NOT_STARTED', 'IN_PROGRESS', 'READY_FOR_REVIEW', 'COMPLETED']

/** Branch statuses shown below the main flow */
const BRANCH_STATUSES: TaskStatus[] = ['BLOCKED', 'CHANGES_REQUIRED']

/* ── Valid transitions (mirrors server-side state machine) ─ */

const VALID_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  NOT_STARTED: ['IN_PROGRESS'],
  IN_PROGRESS: ['READY_FOR_REVIEW', 'BLOCKED'],
  BLOCKED: ['IN_PROGRESS'],
  READY_FOR_REVIEW: ['COMPLETED', 'CHANGES_REQUIRED'],
  CHANGES_REQUIRED: ['IN_PROGRESS'],
  COMPLETED: [],
}

/* ── StatusFlow component ──────────────────────────────── */

/**
 * Visual state machine showing the task's progress through its lifecycle.
 * Highlights the current status and shows valid next steps.
 */
export function StatusFlow({ currentStatus }: { currentStatus: string }) {
  const current = currentStatus as TaskStatus
  const currentIdx = MAIN_FLOW.indexOf(current)
  const isBranch = BRANCH_STATUSES.includes(current)

  return (
    <div className="bg-white rounded-xl border border-ink-100 p-4">
      {/* Main flow: NOT_STARTED → IN_PROGRESS → READY_FOR_REVIEW → COMPLETED */}
      <div className="flex items-center gap-1 sm:gap-2">
        {MAIN_FLOW.map((status, idx) => {
          const meta = STATUS_META[status]
          const isActive = status === current
          const isPast = !isBranch && currentIdx > idx
          const isNext = VALID_TRANSITIONS[current]?.includes(status)

          return (
            <div key={status} className="flex items-center gap-1 sm:gap-2 flex-1">
              {/* Step indicator */}
              <div
                className={cn(
                  'flex items-center gap-2 px-3 py-2 rounded-lg text-[11px] sm:text-[12px] font-medium transition-all flex-1 min-w-0',
                  isActive && cn(meta.bgColor, meta.color, 'ring-2 ring-offset-1', `ring-current`),
                  isPast && 'bg-emerald-50 text-emerald-600',
                  !isActive && !isPast && !isNext && 'bg-ink-50 text-ink-400',
                  isNext && 'bg-ink-50 text-ink-600 ring-1 ring-ink-200 ring-dashed',
                )}
              >
                <span
                  className={cn(
                    'w-2 h-2 rounded-full shrink-0',
                    isActive && meta.dotColor,
                    isPast && 'bg-emerald-500',
                    !isActive && !isPast && 'bg-ink-300',
                  )}
                />
                <span className="truncate">{meta.label}</span>
              </div>

              {/* Arrow between steps */}
              {idx < MAIN_FLOW.length - 1 && (
                <ChevronRight className={cn(
                  'w-4 h-4 shrink-0',
                  isPast ? 'text-emerald-400' : 'text-ink-200',
                )} />
              )}
            </div>
          )
        })}
      </div>

      {/* Branch statuses (BLOCKED and CHANGES_REQUIRED) */}
      {(isBranch || VALID_TRANSITIONS[current]?.some(s => BRANCH_STATUSES.includes(s))) && (
        <div className="flex items-center gap-3 mt-3 ml-4 sm:ml-8">
          {BRANCH_STATUSES.map((status) => {
            const meta = STATUS_META[status]
            const isActive = status === current
            const isNext = VALID_TRANSITIONS[current]?.includes(status)

            if (!isActive && !isNext) return null

            return (
              <div key={status} className="flex items-center gap-2">
                {status === 'BLOCKED' ? (
                  <Ban className="w-3.5 h-3.5 text-ink-300" />
                ) : (
                  <ArrowLeft className="w-3.5 h-3.5 text-ink-300" />
                )}
                <div
                  className={cn(
                    'flex items-center gap-2 px-3 py-1.5 rounded-lg text-[11px] font-medium',
                    isActive && cn(meta.bgColor, meta.color, 'ring-2 ring-offset-1 ring-current'),
                    !isActive && isNext && 'bg-ink-50 text-ink-500 ring-1 ring-ink-200 ring-dashed',
                  )}
                >
                  <span className={cn('w-2 h-2 rounded-full', isActive ? meta.dotColor : 'bg-ink-300')} />
                  {meta.label}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

/* ── StatusTransitionDropdown ──────────────────────────── */

/**
 * Dropdown showing only valid transitions from the current status.
 * Calls onTransition with the selected status.
 */
export function StatusTransitionDropdown({
  currentStatus,
  onTransition,
  isReviewer,
  disabled,
}: {
  currentStatus: string
  onTransition: (newStatus: string) => void
  /** Whether the current user is the task's reviewer */
  isReviewer: boolean
  disabled?: boolean
}) {
  const current = currentStatus as TaskStatus
  const meta = STATUS_META[current]
  const validNext = VALID_TRANSITIONS[current] ?? []

  // Filter: reviewer transitions (COMPLETED, CHANGES_REQUIRED) only available to reviewers
  const REVIEWER_ONLY: TaskStatus[] = ['COMPLETED', 'CHANGES_REQUIRED']
  const available = validNext.filter((s) => {
    if (REVIEWER_ONLY.includes(s) && !isReviewer) return false
    return true
  })

  if (available.length === 0) {
    // Terminal or no valid transitions for this user
    return (
      <span className={cn(
        'inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[12px] font-medium',
        meta.bgColor, meta.color,
      )}>
        <span className={cn('w-2 h-2 rounded-full', meta.dotColor)} />
        {meta.label}
      </span>
    )
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Current status badge */}
      <span className={cn(
        'inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[12px] font-medium',
        meta.bgColor, meta.color,
      )}>
        <span className={cn('w-2 h-2 rounded-full', meta.dotColor)} />
        {meta.label}
      </span>

      {/* Arrow */}
      <ChevronRight className="w-4 h-4 text-ink-300" />

      {/* Available transitions as buttons */}
      {available.map((nextStatus) => {
        const nextMeta = STATUS_META[nextStatus]
        return (
          <button
            key={nextStatus}
            onClick={() => onTransition(nextStatus)}
            disabled={disabled}
            className={cn(
              'inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[12px] font-medium border transition-all',
              'hover:shadow-sm active:scale-95',
              disabled && 'opacity-50 cursor-not-allowed',
              nextMeta.bgColor, nextMeta.color, 'border-current/20',
            )}
          >
            <span className={cn('w-2 h-2 rounded-full', nextMeta.dotColor)} />
            {nextMeta.label}
          </button>
        )
      })}
    </div>
  )
}

/* ── StatusBadge (simple) ──────────────────────────────── */

export function TaskStatusBadge({ status }: { status: string }) {
  const meta = STATUS_META[status as TaskStatus] ?? STATUS_META.NOT_STARTED
  return (
    <span className={cn(
      'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium',
      meta.bgColor, meta.color,
    )}>
      <span className={cn('w-1.5 h-1.5 rounded-full', meta.dotColor)} />
      {meta.label}
    </span>
  )
}

/* ── PriorityBadge ─────────────────────────────────────── */

const PRIORITY_META: Record<string, { label: string; color: string; dotColor: string }> = {
  LOW: { label: 'Low', color: 'text-ink-500', dotColor: 'bg-ink-300' },
  MEDIUM: { label: 'Medium', color: 'text-blue-600', dotColor: 'bg-blue-400' },
  HIGH: { label: 'High', color: 'text-amber-600', dotColor: 'bg-amber-500' },
  CRITICAL: { label: 'Critical', color: 'text-red-600', dotColor: 'bg-red-500' },
}

export function PriorityBadge({ priority }: { priority: string }) {
  const meta = PRIORITY_META[priority] ?? PRIORITY_META.MEDIUM
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-[11px] font-medium', meta.color)}>
      <span className={cn('w-1.5 h-1.5 rounded-full', meta.dotColor)} />
      {meta.label}
    </span>
  )
}

/* ── Export helpers ─────────────────────────────────────── */

export { STATUS_META, VALID_TRANSITIONS }
export type { TaskStatus }

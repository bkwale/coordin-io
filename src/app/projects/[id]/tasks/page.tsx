'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import {
  Plus, Filter, ArrowUpDown, Loader2,
  AlertTriangle, RefreshCw, Calendar, X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useToast } from '@/components/Toast'
import { useApiMutation } from '@/hooks/use-api'
import { TaskStatusBadge, PriorityBadge } from '@/components/StatusFlow'
import { SkeletonRow } from '@/components/Skeleton'

/* ── Types ─────────────────────────────────────────────── */

interface TaskListItem {
  id: string
  title: string
  status: string
  priority: string
  dueDate: string | null
  stage: string | null
  owner: { id: string; fullName: string } | null
  reviewer: { id: string; fullName: string } | null
  checklist: { total: number; completed: number }
}

type FilterStatus = 'ALL' | 'NOT_STARTED' | 'IN_PROGRESS' | 'BLOCKED' | 'READY_FOR_REVIEW' | 'CHANGES_REQUIRED' | 'COMPLETED'
type SortField = 'priority' | 'dueDate' | 'status' | 'title'

const STATUS_FILTERS: { value: FilterStatus; label: string }[] = [
  { value: 'ALL', label: 'All' },
  { value: 'NOT_STARTED', label: 'Not started' },
  { value: 'IN_PROGRESS', label: 'In progress' },
  { value: 'BLOCKED', label: 'Blocked' },
  { value: 'READY_FOR_REVIEW', label: 'In review' },
  { value: 'CHANGES_REQUIRED', label: 'Changes needed' },
  { value: 'COMPLETED', label: 'Completed' },
]

/* ── Helpers ───────────────────────────────────────────── */

function formatDueDate(iso: string | null): { text: string; overdue: boolean } {
  if (!iso) return { text: '', overdue: false }
  const d = new Date(iso)
  const now = new Date()
  const diffMs = d.getTime() - now.getTime()
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays < 0) return { text: `${Math.abs(diffDays)}d overdue`, overdue: true }
  if (diffDays === 0) return { text: 'Due today', overdue: true }
  if (diffDays === 1) return { text: 'Tomorrow', overdue: false }
  if (diffDays <= 7) return { text: `${diffDays}d`, overdue: false }
  return { text: d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }), overdue: false }
}

/* ── Page ──────────────────────────────────────────────── */

export default function ProjectTasksPage() {
  const params = useParams()
  const projectId = params.id as string
  const { toast } = useToast()

  const [tasks, setTasks] = useState<TaskListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('ALL')
  const [sortField, setSortField] = useState<SortField>('priority')
  const [showMyTasks, setShowMyTasks] = useState(false)

  /* ── Create task form ──────────────────────────────── */
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newPriority, setNewPriority] = useState('MEDIUM')
  const [newDueDate, setNewDueDate] = useState('')
  const { mutate: createTask, loading: creating, error: createError, clearError: clearCreateError } =
    useApiMutation<TaskListItem>(`/api/projects/${projectId}/tasks`, 'POST')

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = newTitle.trim()
    if (!trimmed) return

    const body: Record<string, unknown> = { title: trimmed, priority: newPriority }
    if (newDueDate) body.dueDate = newDueDate

    const result = await createTask(body)
    if (result) {
      toast(`Task "${trimmed}" created`, 'success')
      setNewTitle('')
      setNewPriority('MEDIUM')
      setNewDueDate('')
      setShowCreateForm(false)
      clearCreateError()
      fetchTasks()
    } else {
      toast(createError || 'Failed to create task', 'error')
    }
  }

  const cancelCreate = () => {
    setShowCreateForm(false)
    setNewTitle('')
    setNewPriority('MEDIUM')
    setNewDueDate('')
    clearCreateError()
  }

  const fetchTasks = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const url = `/api/projects/${projectId}/tasks?all=true`
      const res = await fetch(url)
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error?.message || `Failed to load (${res.status})`)
      }
      const json = await res.json()
      setTasks(json.data.tasks)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    fetchTasks()
  }, [fetchTasks])

  /* ── Filter & sort ──────────────────────────────────── */

  let filtered = tasks
  if (statusFilter !== 'ALL') {
    filtered = filtered.filter((t) => t.status === statusFilter)
  }

  // Sort
  const PRIORITY_ORDER: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 }
  const STATUS_ORDER: Record<string, number> = {
    BLOCKED: 0, CHANGES_REQUIRED: 1, IN_PROGRESS: 2, READY_FOR_REVIEW: 3, NOT_STARTED: 4, COMPLETED: 5,
  }

  filtered.sort((a, b) => {
    switch (sortField) {
      case 'priority':
        return (PRIORITY_ORDER[a.priority] ?? 99) - (PRIORITY_ORDER[b.priority] ?? 99)
      case 'dueDate': {
        if (!a.dueDate && !b.dueDate) return 0
        if (!a.dueDate) return 1
        if (!b.dueDate) return -1
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
      }
      case 'status':
        return (STATUS_ORDER[a.status] ?? 99) - (STATUS_ORDER[b.status] ?? 99)
      case 'title':
        return a.title.localeCompare(b.title)
      default:
        return 0
    }
  })

  /* ── Stats ──────────────────────────────────────────── */

  const statusCounts = tasks.reduce<Record<string, number>>((acc, t) => {
    acc[t.status] = (acc[t.status] || 0) + 1
    return acc
  }, {})

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
          {Array.from({ length: 6 }).map((_, i) => (
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
        <button onClick={fetchTasks} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-ink-900 text-white text-[13px] font-medium hover:bg-ink-800 transition-colors">
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
          <h2 className="text-[18px] font-semibold text-ink-900">Tasks</h2>
          <p className="text-[12px] text-ink-400 mt-0.5">
            {tasks.length} total · {statusCounts['IN_PROGRESS'] || 0} in progress · {statusCounts['BLOCKED'] || 0} blocked
          </p>
        </div>
        {!showCreateForm && (
          <button
            onClick={() => setShowCreateForm(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-ink-900 text-white text-[12px] font-medium hover:bg-ink-800 transition-colors"
          >
            <Plus className="w-4 h-4" />
            New task
          </button>
        )}
      </div>

      {/* ── Create task form ───────────────────────────── */}
      {showCreateForm && (
        <form
          onSubmit={handleCreateTask}
          className="bg-white rounded-xl border-2 border-accent-200 p-5 space-y-4"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-[14px] font-semibold text-ink-900">New task</h3>
            <button
              type="button"
              onClick={cancelCreate}
              className="text-ink-400 hover:text-ink-600 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Title */}
          <div>
            <label htmlFor="task-title" className="block text-[11px] font-medium text-ink-500 mb-1">
              Title <span className="text-red-400">*</span>
            </label>
            <input
              id="task-title"
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="e.g. Review structural drawings for Block A"
              className="w-full px-3 py-2 text-[13px] border border-ink-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-300 focus:border-accent-400 placeholder:text-ink-300"
              autoFocus
              maxLength={500}
              required
            />
          </div>

          {/* Priority + Due date row */}
          <div className="flex gap-4">
            <div className="flex-1">
              <label htmlFor="task-priority" className="block text-[11px] font-medium text-ink-500 mb-1">
                Priority
              </label>
              <select
                id="task-priority"
                value={newPriority}
                onChange={(e) => setNewPriority(e.target.value)}
                className="w-full px-3 py-2 text-[13px] border border-ink-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-300 focus:border-accent-400 bg-white"
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="CRITICAL">Critical</option>
              </select>
            </div>
            <div className="flex-1">
              <label htmlFor="task-due" className="block text-[11px] font-medium text-ink-500 mb-1">
                Due date
              </label>
              <input
                id="task-due"
                type="date"
                value={newDueDate}
                onChange={(e) => setNewDueDate(e.target.value)}
                className="w-full px-3 py-2 text-[13px] border border-ink-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-300 focus:border-accent-400"
              />
            </div>
          </div>

          {/* Error */}
          {createError && (
            <p className="text-[12px] text-red-600 bg-red-50 px-3 py-2 rounded-lg">{createError}</p>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={cancelCreate}
              className="px-3.5 py-2 text-[12px] font-medium text-ink-500 hover:text-ink-700 transition-colors"
              disabled={creating}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={creating || !newTitle.trim()}
              className={cn(
                'flex items-center gap-1.5 px-4 py-2 rounded-lg text-[12px] font-medium transition-colors',
                creating || !newTitle.trim()
                  ? 'bg-ink-200 text-ink-400 cursor-not-allowed'
                  : 'bg-ink-900 text-white hover:bg-ink-800',
              )}
            >
              {creating && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Create task
            </button>
          </div>
        </form>
      )}

      {/* ── Filters bar ────────────────────────────────── */}
      <div className="flex items-center gap-3 flex-wrap">
        <Filter className="w-4 h-4 text-ink-300" />
        <div className="flex gap-1 flex-wrap">
          {STATUS_FILTERS.map((f) => {
            const count = f.value === 'ALL' ? tasks.length : (statusCounts[f.value] || 0)
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
          <ArrowUpDown className="w-3.5 h-3.5 text-ink-300" />
          <select
            value={sortField}
            onChange={(e) => setSortField(e.target.value as SortField)}
            className="text-[11px] text-ink-600 bg-transparent border-none outline-none cursor-pointer"
          >
            <option value="priority">Priority</option>
            <option value="dueDate">Due date</option>
            <option value="status">Status</option>
            <option value="title">Name</option>
          </select>
        </div>
      </div>

      {/* ── Task list ──────────────────────────────────── */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-ink-100 p-10 text-center">
          <p className="text-[14px] font-medium text-ink-600">No tasks match the filter</p>
          <p className="text-[12px] text-ink-400 mt-1">Try changing the filter or create a new task.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-ink-100 divide-y divide-ink-50">
          {filtered.map((task) => {
            const due = formatDueDate(task.dueDate)
            return (
              <Link
                key={task.id}
                href={`/tasks/${task.id}`}
                className="flex items-center gap-4 px-5 py-3.5 hover:bg-surface-50 transition-colors group"
              >
                {/* Priority dot */}
                <PriorityBadge priority={task.priority} />

                {/* Title + owner */}
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium text-ink-900 truncate group-hover:text-accent-700 transition-colors">
                    {task.title}
                  </p>
                  <p className="text-[11px] text-ink-400 mt-0.5">
                    {task.owner?.fullName || 'Unassigned'}
                    {task.stage && <span> · {task.stage.replace(/_/g, ' ')}</span>}
                  </p>
                </div>

                {/* Checklist progress */}
                {task.checklist.total > 0 && (
                  <span className="text-[11px] text-ink-400 shrink-0">
                    {task.checklist.completed}/{task.checklist.total}
                  </span>
                )}

                {/* Status */}
                <TaskStatusBadge status={task.status} />

                {/* Due date */}
                {due.text && (
                  <span className={cn(
                    'text-[11px] shrink-0 w-20 text-right',
                    due.overdue ? 'text-red-600 font-medium' : 'text-ink-400',
                  )}>
                    {due.text}
                  </span>
                )}
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}

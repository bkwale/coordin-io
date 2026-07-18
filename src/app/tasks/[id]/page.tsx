'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import {
  ChevronRight, User, Users, Calendar, Clock,
  MessageSquare, CheckSquare, Send, Plus, Loader2,
  AlertTriangle, RefreshCw, Square, CheckSquare2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useToast } from '@/components/Toast'
import { StatusFlow, StatusTransitionDropdown, PriorityBadge } from '@/components/StatusFlow'
import { SkeletonTaskDetail } from '@/components/Skeleton'

/* ── Types mirroring GET /api/tasks/[id] response ──────── */

interface TaskOwner {
  id: string
  fullName: string
}

interface TaskProject {
  id: string
  name: string
}

interface ChecklistItem {
  id: string
  label: string
  completed: boolean
  mandatory: boolean
  sortOrder: number
  completedAt: string | null
}

interface TaskComment {
  id: string
  content: string
  createdAt: string
  author: { id: string; fullName: string }
}

interface TaskDetail {
  id: string
  title: string
  description: string | null
  instructions: string | null
  status: string
  priority: string
  stage: string | null
  discipline: string | null
  block: string | null
  floor: string | null
  dueDate: string | null
  estimatedHours: number | null
  completedAt: string | null
  createdAt: string
  updatedAt: string
  projectId: string
  owner: TaskOwner | null
  reviewer: TaskOwner | null
  project: TaskProject
  checklistItems: ChecklistItem[]
  comments: TaskComment[]
}

/* ── Helpers ───────────────────────────────────────────── */

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

function formatDueDate(iso: string | null): { text: string; overdue: boolean } {
  if (!iso) return { text: 'No due date', overdue: false }
  const d = new Date(iso)
  const now = new Date()
  const diffMs = d.getTime() - now.getTime()
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays < 0) return { text: `${Math.abs(diffDays)}d overdue`, overdue: true }
  if (diffDays === 0) return { text: 'Due today', overdue: true }
  if (diffDays === 1) return { text: 'Due tomorrow', overdue: false }
  return { text: `Due in ${diffDays}d`, overdue: false }
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

/* ── Page ──────────────────────────────────────────────── */

export default function TaskDetailPage() {
  const params = useParams()
  const taskId = params.id as string
  const { toast } = useToast()

  const [task, setTask] = useState<TaskDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  // Mutation states
  const [transitionLoading, setTransitionLoading] = useState(false)
  const [commentText, setCommentText] = useState('')
  const [commentLoading, setCommentLoading] = useState(false)
  const [checklistLoading, setChecklistLoading] = useState<string | null>(null)
  const [newItemLabel, setNewItemLabel] = useState('')
  const [addingItem, setAddingItem] = useState(false)

  /* ── Fetch task ──────────────────────────────────────── */

  const fetchTask = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/tasks/${taskId}`)
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error?.message || `Failed to load (${res.status})`)
      }
      const json = await res.json()
      setTask(json.data.task)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }, [taskId])

  // Fetch current user profile for reviewer detection
  const fetchProfile = useCallback(async () => {
    try {
      const res = await fetch('/api/dashboard')
      if (res.ok) {
        const json = await res.json()
        setCurrentUserId(json.data?.profile?.id || null)
      }
    } catch {
      // non-critical — reviewer detection just won't work
    }
  }, [])

  useEffect(() => {
    fetchTask()
    fetchProfile()
  }, [fetchTask, fetchProfile])

  /* ── Status transition ──────────────────────────────── */

  async function handleTransition(newStatus: string) {
    if (!task) return
    setTransitionLoading(true)
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error?.message || `Failed to update status (${res.status})`)
      }
      const json = await res.json()
      // Optimistic: update task in state
      setTask((prev) => prev ? { ...prev, ...json.data.task, checklistItems: prev.checklistItems, comments: prev.comments } : prev)
      toast('Status updated', 'success')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to update status', 'error')
    } finally {
      setTransitionLoading(false)
    }
  }

  /* ── Add comment ─────────────────────────────────────── */

  async function handleAddComment(e: React.FormEvent) {
    e.preventDefault()
    if (!commentText.trim() || !task) return
    setCommentLoading(true)
    try {
      const res = await fetch(`/api/tasks/${taskId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: commentText.trim() }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error?.message || 'Failed to add comment')
      }
      const json = await res.json()
      setTask((prev) => prev ? {
        ...prev,
        comments: [...prev.comments, json.data.comment],
      } : prev)
      setCommentText('')
      toast('Comment added', 'success')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to add comment', 'error')
    } finally {
      setCommentLoading(false)
    }
  }

  /* ── Toggle checklist item ──────────────────────────── */

  async function handleToggleChecklist(item: ChecklistItem) {
    if (!task) return
    setChecklistLoading(item.id)

    // Optimistic update
    const prevItems = task.checklistItems
    setTask((prev) => prev ? {
      ...prev,
      checklistItems: prev.checklistItems.map((ci) =>
        ci.id === item.id ? { ...ci, completed: !ci.completed } : ci
      ),
    } : prev)

    try {
      const res = await fetch(`/api/tasks/${taskId}/checklist`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId: item.id, completed: !item.completed }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error?.message || 'Failed to update checklist')
      }
    } catch (err) {
      // Rollback
      setTask((prev) => prev ? { ...prev, checklistItems: prevItems } : prev)
      toast(err instanceof Error ? err.message : 'Failed to update checklist', 'error')
    } finally {
      setChecklistLoading(null)
    }
  }

  /* ── Add checklist item ─────────────────────────────── */

  async function handleAddChecklistItem(e: React.FormEvent) {
    e.preventDefault()
    if (!newItemLabel.trim() || !task) return
    setAddingItem(true)
    try {
      const res = await fetch(`/api/tasks/${taskId}/checklist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: newItemLabel.trim() }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error?.message || 'Failed to add item')
      }
      const json = await res.json()
      setTask((prev) => prev ? {
        ...prev,
        checklistItems: [...prev.checklistItems, json.data.item],
      } : prev)
      setNewItemLabel('')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to add item', 'error')
    } finally {
      setAddingItem(false)
    }
  }

  /* ── Loading ─────────────────────────────────────────── */

  if (loading) return <SkeletonTaskDetail />

  /* ── Error ───────────────────────────────────────────── */

  if (error || !task) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center">
          <AlertTriangle className="w-7 h-7 text-red-500" />
        </div>
        <div className="text-center">
          <p className="text-[15px] font-medium text-ink-900">Unable to load task</p>
          <p className="text-[13px] text-ink-400 mt-1 max-w-sm">{error || 'No data returned.'}</p>
        </div>
        <button
          onClick={fetchTask}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-ink-900 text-white text-[13px] font-medium hover:bg-ink-800 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Try again
        </button>
      </div>
    )
  }

  /* ── Computed values ─────────────────────────────────── */

  const dueInfo = formatDueDate(task.dueDate)
  const isReviewer = currentUserId === task.reviewer?.id
  const checklistCompleted = task.checklistItems.filter((i) => i.completed).length
  const checklistTotal = task.checklistItems.length

  /* ── Render ──────────────────────────────────────────── */

  return (
    <div className="space-y-6">
      {/* ── Breadcrumb ───────────────────────────────────── */}
      <div className="flex items-center gap-1.5 text-[12px] text-ink-400">
        <Link href="/my-work" className="hover:text-accent-600 transition-colors">My Work</Link>
        <ChevronRight className="w-3.5 h-3.5" />
        <Link href={`/projects/${task.projectId}`} className="hover:text-accent-600 transition-colors">
          {task.project.name}
        </Link>
        <ChevronRight className="w-3.5 h-3.5" />
        <span className="text-ink-600 font-medium truncate max-w-[200px]">{task.title}</span>
      </div>

      {/* ── Title & meta ─────────────────────────────────── */}
      <div>
        <h1 className="text-[22px] font-semibold text-ink-900 leading-tight">{task.title}</h1>
        <div className="flex items-center gap-3 mt-3 flex-wrap">
          <PriorityBadge priority={task.priority} />
          {task.stage && (
            <span className="text-[11px] text-ink-400 bg-ink-50 px-2 py-0.5 rounded-full">
              {task.stage.replace(/_/g, ' ')}
            </span>
          )}
          <span className={cn(
            'text-[11px] font-medium',
            dueInfo.overdue ? 'text-red-600' : 'text-ink-400',
          )}>
            <Calendar className="w-3 h-3 inline mr-1" />
            {dueInfo.text}
          </span>
          {task.estimatedHours && (
            <span className="text-[11px] text-ink-400">
              <Clock className="w-3 h-3 inline mr-1" />
              {task.estimatedHours}h estimated
            </span>
          )}
        </div>
      </div>

      {/* ── Status flow visualization ─────────────────────── */}
      <StatusFlow currentStatus={task.status} />

      {/* ── Status transition actions ─────────────────────── */}
      <div className="flex items-center gap-3">
        <span className="text-[12px] text-ink-400 font-medium">Status:</span>
        <StatusTransitionDropdown
          currentStatus={task.status}
          onTransition={handleTransition}
          isReviewer={isReviewer}
          disabled={transitionLoading}
        />
        {transitionLoading && <Loader2 className="w-4 h-4 text-ink-400 animate-spin" />}
      </div>

      {/* ── Main content: 2/3 + 1/3 layout ────────────────── */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* ── Left column (2/3) ─────────────────────────────── */}
        <div className="lg:col-span-2 space-y-6">
          {/* Description */}
          {(task.description || task.instructions) && (
            <div className="bg-white rounded-xl border border-ink-100 p-5">
              {task.description && (
                <div>
                  <h3 className="text-[13px] font-semibold text-ink-700 mb-2">Description</h3>
                  <p className="text-[13px] text-ink-600 whitespace-pre-wrap leading-relaxed">{task.description}</p>
                </div>
              )}
              {task.instructions && (
                <div className={task.description ? 'mt-4 pt-4 border-t border-ink-100' : ''}>
                  <h3 className="text-[13px] font-semibold text-ink-700 mb-2">Instructions</h3>
                  <p className="text-[13px] text-ink-600 whitespace-pre-wrap leading-relaxed">{task.instructions}</p>
                </div>
              )}
            </div>
          )}

          {/* ── Checklist ────────────────────────────────────── */}
          <div className="bg-white rounded-xl border border-ink-100">
            <div className="flex items-center justify-between px-5 py-4 border-b border-ink-50">
              <div className="flex items-center gap-2">
                <CheckSquare className="w-4 h-4 text-ink-400" />
                <h3 className="text-[13px] font-semibold text-ink-700">Checklist</h3>
                {checklistTotal > 0 && (
                  <span className="text-[11px] text-ink-400">
                    {checklistCompleted}/{checklistTotal}
                  </span>
                )}
              </div>
              {/* Progress bar */}
              {checklistTotal > 0 && (
                <div className="w-24 h-1.5 bg-ink-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                    style={{ width: `${(checklistCompleted / checklistTotal) * 100}%` }}
                  />
                </div>
              )}
            </div>

            {task.checklistItems.length === 0 ? (
              <div className="px-5 py-6 text-center">
                <p className="text-[12px] text-ink-400">No checklist items yet</p>
              </div>
            ) : (
              <div className="divide-y divide-ink-50">
                {task.checklistItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => handleToggleChecklist(item)}
                    disabled={checklistLoading === item.id}
                    className="w-full flex items-center gap-3 px-5 py-3 text-left hover:bg-surface-50 transition-colors group"
                  >
                    {checklistLoading === item.id ? (
                      <Loader2 className="w-4 h-4 text-ink-300 animate-spin shrink-0" />
                    ) : item.completed ? (
                      <CheckSquare2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    ) : (
                      <Square className="w-4 h-4 text-ink-300 group-hover:text-ink-500 shrink-0 transition-colors" />
                    )}
                    <span className={cn(
                      'text-[13px] flex-1',
                      item.completed ? 'text-ink-400 line-through' : 'text-ink-700',
                    )}>
                      {item.label}
                    </span>
                    {item.mandatory && !item.completed && (
                      <span className="text-[10px] text-red-500 font-medium shrink-0">Required</span>
                    )}
                  </button>
                ))}
              </div>
            )}

            {/* Add item form */}
            <form onSubmit={handleAddChecklistItem} className="flex items-center gap-2 px-5 py-3 border-t border-ink-50">
              <Plus className="w-4 h-4 text-ink-300 shrink-0" />
              <input
                type="text"
                value={newItemLabel}
                onChange={(e) => setNewItemLabel(e.target.value)}
                placeholder="Add an item..."
                className="flex-1 text-[13px] bg-transparent border-none outline-none placeholder:text-ink-300"
                maxLength={500}
              />
              {newItemLabel.trim() && (
                <button
                  type="submit"
                  disabled={addingItem}
                  className="text-[12px] text-accent-600 font-medium hover:text-accent-700 transition-colors disabled:opacity-50"
                >
                  {addingItem ? 'Adding...' : 'Add'}
                </button>
              )}
            </form>
          </div>

          {/* ── Comments ──────────────────────────────────── */}
          <div className="bg-white rounded-xl border border-ink-100">
            <div className="flex items-center gap-2 px-5 py-4 border-b border-ink-50">
              <MessageSquare className="w-4 h-4 text-ink-400" />
              <h3 className="text-[13px] font-semibold text-ink-700">
                Comments
                {task.comments.length > 0 && (
                  <span className="ml-1.5 text-ink-400 font-normal">{task.comments.length}</span>
                )}
              </h3>
            </div>

            {task.comments.length === 0 ? (
              <div className="px-5 py-6 text-center">
                <p className="text-[12px] text-ink-400">No comments yet. Be the first to comment.</p>
              </div>
            ) : (
              <div className="divide-y divide-ink-50">
                {task.comments.map((comment) => (
                  <div key={comment.id} className="px-5 py-3.5">
                    <div className="flex items-center gap-2 mb-1.5">
                      <div className="w-6 h-6 rounded-full bg-accent-100 flex items-center justify-center">
                        <span className="text-[10px] font-semibold text-accent-700">
                          {comment.author.fullName.split(' ').map(n => n[0]).join('')}
                        </span>
                      </div>
                      <span className="text-[12px] font-medium text-ink-700">{comment.author.fullName}</span>
                      <span className="text-[11px] text-ink-300">{timeAgo(comment.createdAt)}</span>
                    </div>
                    <p className="text-[13px] text-ink-600 ml-8 leading-relaxed whitespace-pre-wrap">{comment.content}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Add comment form */}
            <form onSubmit={handleAddComment} className="flex items-end gap-2 px-5 py-3 border-t border-ink-50">
              <textarea
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="Write a comment..."
                rows={1}
                className="flex-1 text-[13px] bg-surface-50 border border-ink-100 rounded-lg px-3 py-2 outline-none focus:border-accent-300 focus:ring-1 focus:ring-accent-200 resize-none placeholder:text-ink-300 transition-colors"
                maxLength={2000}
                onInput={(e) => {
                  const target = e.target as HTMLTextAreaElement
                  target.style.height = 'auto'
                  target.style.height = target.scrollHeight + 'px'
                }}
              />
              <button
                type="submit"
                disabled={!commentText.trim() || commentLoading}
                className={cn(
                  'p-2 rounded-lg transition-colors shrink-0',
                  commentText.trim()
                    ? 'bg-accent-600 text-white hover:bg-accent-700'
                    : 'bg-ink-100 text-ink-300 cursor-not-allowed',
                )}
              >
                {commentLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </button>
            </form>
          </div>
        </div>

        {/* ── Right column (1/3) — sidebar details ──────── */}
        <div className="space-y-4">
          {/* People */}
          <div className="bg-white rounded-xl border border-ink-100 p-5 space-y-4">
            <h3 className="text-[12px] font-semibold text-ink-400 uppercase tracking-wide">People</h3>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[12px] text-ink-400 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5" /> Owner
                </span>
                <span className="text-[13px] font-medium text-ink-700">
                  {task.owner?.fullName || 'Unassigned'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[12px] text-ink-400 flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5" /> Reviewer
                </span>
                <span className="text-[13px] font-medium text-ink-700">
                  {task.reviewer?.fullName || 'Unassigned'}
                </span>
              </div>
              {isReviewer && task.status === 'READY_FOR_REVIEW' && (
                <div className="mt-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg">
                  <p className="text-[11px] text-amber-700 font-medium">This task is awaiting your review</p>
                </div>
              )}
              {!isReviewer && task.status === 'READY_FOR_REVIEW' && task.reviewer && (
                <div className="mt-2 px-3 py-2 bg-ink-50 border border-ink-100 rounded-lg">
                  <p className="text-[11px] text-ink-500">Waiting for {task.reviewer.fullName}</p>
                </div>
              )}
            </div>
          </div>

          {/* Details */}
          <div className="bg-white rounded-xl border border-ink-100 p-5 space-y-4">
            <h3 className="text-[12px] font-semibold text-ink-400 uppercase tracking-wide">Details</h3>

            <div className="space-y-3 text-[12px]">
              <div className="flex items-center justify-between">
                <span className="text-ink-400">Project</span>
                <Link
                  href={`/projects/${task.projectId}`}
                  className="text-accent-600 font-medium hover:text-accent-700 transition-colors"
                >
                  {task.project.name}
                </Link>
              </div>
              {task.discipline && (
                <div className="flex items-center justify-between">
                  <span className="text-ink-400">Discipline</span>
                  <span className="text-ink-700">{task.discipline}</span>
                </div>
              )}
              {task.block && (
                <div className="flex items-center justify-between">
                  <span className="text-ink-400">Block</span>
                  <span className="text-ink-700">{task.block}</span>
                </div>
              )}
              {task.floor && (
                <div className="flex items-center justify-between">
                  <span className="text-ink-400">Floor</span>
                  <span className="text-ink-700">{task.floor}</span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-ink-400">Created</span>
                <span className="text-ink-700">{formatDate(task.createdAt)}</span>
              </div>
              {task.completedAt && (
                <div className="flex items-center justify-between">
                  <span className="text-ink-400">Completed</span>
                  <span className="text-emerald-600 font-medium">{formatDate(task.completedAt)}</span>
                </div>
              )}
            </div>
          </div>

          {/* What to do now — contextual guidance */}
          <div className="bg-white rounded-xl border border-ink-100 p-5">
            <h3 className="text-[12px] font-semibold text-ink-400 uppercase tracking-wide mb-3">What to do</h3>
            <WhatToDo status={task.status} isReviewer={isReviewer} checklistComplete={checklistCompleted === checklistTotal && checklistTotal > 0} />
          </div>
        </div>
      </div>
    </div>
  )
}

/* ── WhatToDo — contextual guidance per state ──────────── */

function WhatToDo({
  status,
  isReviewer,
  checklistComplete,
}: {
  status: string
  isReviewer: boolean
  checklistComplete: boolean
}) {
  const guidance: Record<string, { action: string; detail: string }> = {
    NOT_STARTED: {
      action: 'Start this task',
      detail: 'Click "In progress" above to begin working on it.',
    },
    IN_PROGRESS: {
      action: checklistComplete ? 'Submit for review' : 'Complete the checklist',
      detail: checklistComplete
        ? 'All checklist items are done. Click "In review" when ready.'
        : 'Work through the checklist items, then submit for review.',
    },
    BLOCKED: {
      action: 'Resolve the blocker',
      detail: 'Once the blocker is resolved, move this back to "In progress".',
    },
    READY_FOR_REVIEW: {
      action: isReviewer ? 'Review this task' : 'Waiting for review',
      detail: isReviewer
        ? 'Check the work and either approve (Complete) or request changes.'
        : 'The reviewer will check this and either approve or request changes.',
    },
    CHANGES_REQUIRED: {
      action: 'Address the feedback',
      detail: 'Review the comments, make changes, then move back to "In progress".',
    },
    COMPLETED: {
      action: 'This task is done',
      detail: 'No further action needed.',
    },
  }

  const item = guidance[status] || guidance.NOT_STARTED

  return (
    <div>
      <p className="text-[13px] font-medium text-ink-700">{item.action}</p>
      <p className="text-[12px] text-ink-400 mt-1">{item.detail}</p>
    </div>
  )
}

'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import {
  ChevronRight, User, Users, Calendar, Clock,
  MessageSquare, CheckSquare, Send, Plus, Loader2,
  AlertTriangle, RefreshCw, Square, CheckSquare2,
  Paperclip, FileText, Download, Trash2, Copy,
  Archive, ArchiveRestore, Link as LinkIcon, Milestone,
  GitBranch, ArrowRight, MoreHorizontal,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useToast } from '@/components/Toast'
import { StatusFlow, StatusTransitionDropdown, PriorityBadge } from '@/components/StatusFlow'
import { SkeletonTaskDetail } from '@/components/Skeleton'
import FileUpload, { type UploadResult } from '@/components/FileUpload'

/* ── Types mirroring GET /api/tasks/[id] response ──────── */

interface TaskOwner {
  id: string
  fullName: string
}

interface TaskProject {
  id: string
  name: string
  code: string | null
}

interface ChecklistItem {
  id: string
  label: string
  completed: boolean
  mandatory: boolean
  sortOrder: number
  completedAt: string | null
  assignee: { id: string; fullName: string } | null
  dueDate: string | null
}

interface TaskComment {
  id: string
  content: string
  createdAt: string
  author: { id: string; fullName: string }
}

interface TaskDep {
  id: string
  type: string
  dependsOn: { id: string; title: string; status: string }
}

interface TaskDepBy {
  id: string
  type: string
  task: { id: string; title: string; status: string }
}

interface TaskMilestone {
  id: string
  title: string
  status: string
  dueDate: string
}

interface TaskDetail {
  id: string
  title: string
  taskNumber: string
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
  archivedAt: string | null
  deliverable: string | null
  sharepointUrl: string | null
  createdAt: string
  updatedAt: string
  projectId: string
  owner: TaskOwner | null
  reviewer: TaskOwner | null
  project: TaskProject
  milestone: TaskMilestone | null
  attachments: string | null
  checklistItems: ChecklistItem[]
  comments: TaskComment[]
  dependsOn: TaskDep[]
  dependedOnBy: TaskDepBy[]
}

interface AttachmentFile {
  url: string
  fileName: string
  fileSize: number
  contentType: string
}

/* ── Helpers ───────────────────────────────────────────── */

function parseAttachments(raw: string | null): AttachmentFile[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

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
  const [projectMembers, setProjectMembers] = useState<{id: string; fullName: string}[]>([])
  const [actionMenuOpen, setActionMenuOpen] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [milestones, setMilestones] = useState<{id: string; title: string; status: string}[]>([])
  const [editingSharePoint, setEditingSharePoint] = useState(false)
  const [sharepointDraft, setSharepointDraft] = useState('')
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleDraft, setTitleDraft] = useState('')
  const [editingDescription, setEditingDescription] = useState(false)
  const [descriptionDraft, setDescriptionDraft] = useState('')
  const [editingDueDate, setEditingDueDate] = useState(false)
  const [dueDateDraft, setDueDateDraft] = useState('')
  const [fieldSaving, setFieldSaving] = useState(false)
  const [newItemMandatory, setNewItemMandatory] = useState(true)
  const [newItemAssignee, setNewItemAssignee] = useState('')

  /* ── Task actions (duplicate, archive, restore) ─────── */

  async function handleDuplicate() {
    setActionLoading(true)
    try {
      const res = await fetch(`/api/tasks/${taskId}/duplicate`, { method: 'POST' })
      if (!res.ok) throw new Error('Failed to duplicate')
      const json = await res.json()
      toast('Task duplicated', 'success')
      window.location.href = `/tasks/${json.data.task.id}`
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to duplicate', 'error')
    } finally {
      setActionLoading(false)
      setActionMenuOpen(false)
    }
  }

  async function handleArchive() {
    setActionLoading(true)
    try {
      const res = await fetch(`/api/tasks/${taskId}`, { method: 'DELETE' })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error?.message || 'Failed to archive')
      }
      toast('Task archived', 'success')
      fetchTask()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to archive', 'error')
    } finally {
      setActionLoading(false)
      setActionMenuOpen(false)
    }
  }

  async function handleRestore() {
    setActionLoading(true)
    try {
      const res = await fetch(`/api/tasks/${taskId}/restore`, { method: 'POST' })
      if (!res.ok) throw new Error('Failed to restore')
      toast('Task restored', 'success')
      fetchTask()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to restore', 'error')
    } finally {
      setActionLoading(false)
      setActionMenuOpen(false)
    }
  }

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

  // Fetch milestones for the task's project
  useEffect(() => {
    if (!task?.projectId) return
    fetch(`/api/projects/${task.projectId}/milestones`)
      .then(res => res.ok ? res.json() : null)
      .then(json => {
        if (json?.data?.milestones) {
          setMilestones(json.data.milestones.map((m: Record<string, unknown>) => ({
            id: m.id as string,
            title: m.title as string,
            status: (m.status as string) || '',
          })))
        }
      })
      .catch(() => {})
  }, [task?.projectId])

  // Fetch org members for owner/reviewer selects
  useEffect(() => {
    fetch('/api/staffing')
      .then(res => res.ok ? res.json() : null)
      .then(json => {
        if (!json?.data) return
        // MANAGER+ gets employees[], MEMBER gets directory[]
        const people: {id: string; fullName: string}[] =
          (json.data.employees ?? json.data.directory ?? []).map(
            (p: Record<string, unknown>) => ({ id: p.id as string, fullName: p.fullName as string })
          )
        setProjectMembers(people.sort((a, b) => a.fullName.localeCompare(b.fullName)))
      })
      .catch(() => {})
  }, [])

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
      setTask((prev) => prev ? {
        ...prev,
        ...json.data.task,
        checklistItems: prev.checklistItems,
        comments: prev.comments,
        dependsOn: prev.dependsOn,
        dependedOnBy: prev.dependedOnBy,
        milestone: prev.milestone,
        archivedAt: prev.archivedAt,
        deliverable: prev.deliverable,
        sharepointUrl: prev.sharepointUrl,
      } : prev)
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
        body: JSON.stringify({
          label: newItemLabel.trim(),
          mandatory: newItemMandatory,
          ...(newItemAssignee ? { assigneeId: newItemAssignee } : {}),
        }),
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
      setNewItemMandatory(true)
      setNewItemAssignee('')
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
        <span className="text-[11px] text-ink-400 bg-ink-50 px-2 py-0.5 rounded font-mono">{task.taskNumber}</span>
        <span className="text-ink-600 font-medium truncate max-w-[200px]">{task.title}</span>
      </div>

      {/* ── Archived banner ─────────────────────────────── */}
      {task.archivedAt && (
        <div className="flex items-center justify-between px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl">
          <div className="flex items-center gap-2">
            <Archive className="w-4 h-4 text-amber-600" />
            <span className="text-[13px] text-amber-700 font-medium">This task is archived</span>
            <span className="text-[11px] text-amber-500">({formatDate(task.archivedAt)})</span>
          </div>
          <button onClick={handleRestore} disabled={actionLoading} className="text-[12px] text-amber-700 font-medium hover:text-amber-800 flex items-center gap-1">
            <ArchiveRestore className="w-3.5 h-3.5" /> Restore
          </button>
        </div>
      )}

      {/* ── Title & meta ─────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-2.5 flex-1 min-w-0">
          <span className="text-[11px] text-ink-400 bg-ink-50 px-2 py-0.5 rounded font-mono shrink-0">{task.taskNumber}</span>
          {editingTitle ? (
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <input
                type="text"
                value={titleDraft}
                onChange={(e) => setTitleDraft(e.target.value)}
                className="flex-1 text-[22px] font-semibold text-ink-900 leading-tight bg-transparent border border-ink-200 rounded-lg px-2 py-1 outline-none focus:border-accent-300 focus:ring-1 focus:ring-accent-200"
                autoFocus
                disabled={fieldSaving}
                onKeyDown={async (e) => {
                  if (e.key === 'Escape') { setEditingTitle(false); return }
                  if (e.key === 'Enter') {
                    const val = titleDraft.trim()
                    if (!val) return
                    setFieldSaving(true)
                    try {
                      const res = await fetch(`/api/tasks/${taskId}`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ title: val }),
                      })
                      if (!res.ok) throw new Error('Failed to update title')
                      setTask(prev => prev ? { ...prev, title: val } : prev)
                      toast('Title updated', 'success')
                    } catch {
                      toast('Failed to update title', 'error')
                    }
                    setFieldSaving(false)
                    setEditingTitle(false)
                  }
                }}
              />
              <button
                onClick={async () => {
                  const val = titleDraft.trim()
                  if (!val) return
                  setFieldSaving(true)
                  try {
                    const res = await fetch(`/api/tasks/${taskId}`, {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ title: val }),
                    })
                    if (!res.ok) throw new Error('Failed to update title')
                    setTask(prev => prev ? { ...prev, title: val } : prev)
                    toast('Title updated', 'success')
                  } catch {
                    toast('Failed to update title', 'error')
                  }
                  setFieldSaving(false)
                  setEditingTitle(false)
                }}
                disabled={fieldSaving}
                className="text-[12px] text-accent-600 font-medium hover:text-accent-700 disabled:opacity-50 shrink-0"
              >
                {fieldSaving ? 'Saving...' : 'Save'}
              </button>
              <button
                onClick={() => setEditingTitle(false)}
                disabled={fieldSaving}
                className="text-[12px] text-ink-400 font-medium hover:text-ink-600 disabled:opacity-50 shrink-0"
              >
                Cancel
              </button>
            </div>
          ) : (
            <h1
              className="text-[22px] font-semibold text-ink-900 leading-tight cursor-pointer hover:text-accent-700 transition-colors"
              onClick={() => { setTitleDraft(task.title); setEditingTitle(true) }}
              title="Click to edit title"
            >
              {task.title}
            </h1>
          )}
        </div>

        {/* Action menu */}
        <div className="relative shrink-0">
          <button
            onClick={() => setActionMenuOpen(!actionMenuOpen)}
            className="p-2 rounded-lg hover:bg-ink-50 transition-colors"
          >
            <MoreHorizontal className="w-5 h-5 text-ink-400" />
          </button>
          {actionMenuOpen && (
            <div className="absolute right-0 top-10 z-20 w-48 bg-white rounded-xl shadow-lg border border-ink-100 py-1">
              <button
                onClick={handleDuplicate}
                disabled={actionLoading}
                className="w-full flex items-center gap-2 px-4 py-2.5 text-[13px] text-ink-700 hover:bg-surface-50 transition-colors"
              >
                <Copy className="w-4 h-4 text-ink-400" /> Duplicate
              </button>
              {!task.archivedAt ? (
                <button
                  onClick={handleArchive}
                  disabled={actionLoading}
                  className="w-full flex items-center gap-2 px-4 py-2.5 text-[13px] text-red-600 hover:bg-red-50 transition-colors"
                >
                  <Archive className="w-4 h-4" /> Archive
                </button>
              ) : (
                <button
                  onClick={handleRestore}
                  disabled={actionLoading}
                  className="w-full flex items-center gap-2 px-4 py-2.5 text-[13px] text-ink-700 hover:bg-surface-50 transition-colors"
                >
                  <ArchiveRestore className="w-4 h-4 text-ink-400" /> Restore
                </button>
              )}
            </div>
          )}
        </div>
      </div>
      <div className="flex items-center gap-3 flex-wrap">
        <PriorityBadge priority={task.priority} />
        {task.stage && (
          <span className="text-[11px] text-ink-400 bg-ink-50 px-2 py-0.5 rounded-full">
            {task.stage.replace(/_/g, ' ')}
          </span>
        )}
        {editingDueDate ? (
          <div className="flex items-center gap-1.5">
            <Calendar className="w-3 h-3 text-ink-400" />
            <input
              type="date"
              value={dueDateDraft}
              onChange={(e) => setDueDateDraft(e.target.value)}
              className="text-[11px] border border-ink-200 rounded px-2 py-0.5 outline-none focus:border-accent-300"
              autoFocus
              disabled={fieldSaving}
              onKeyDown={(e) => {
                if (e.key === 'Escape') setEditingDueDate(false)
              }}
            />
            <button
              onClick={async () => {
                const val = dueDateDraft || null
                setFieldSaving(true)
                try {
                  const res = await fetch(`/api/tasks/${taskId}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ dueDate: val }),
                  })
                  if (!res.ok) throw new Error('Failed to update due date')
                  setTask(prev => prev ? { ...prev, dueDate: val } : prev)
                  toast('Due date updated', 'success')
                } catch {
                  toast('Failed to update due date', 'error')
                }
                setFieldSaving(false)
                setEditingDueDate(false)
              }}
              disabled={fieldSaving}
              className="text-[11px] text-accent-600 font-medium hover:text-accent-700 disabled:opacity-50"
            >
              {fieldSaving ? 'Saving...' : 'Save'}
            </button>
            <button
              onClick={() => setEditingDueDate(false)}
              disabled={fieldSaving}
              className="text-[11px] text-ink-400 font-medium hover:text-ink-600 disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        ) : (
          <span
            className={cn(
              'text-[11px] font-medium cursor-pointer hover:underline',
              dueInfo.overdue ? 'text-red-600' : 'text-ink-400',
            )}
            onClick={() => {
              setDueDateDraft(task.dueDate ? task.dueDate.slice(0, 10) : '')
              setEditingDueDate(true)
            }}
            title="Click to edit due date"
          >
            <Calendar className="w-3 h-3 inline mr-1" />
            {dueInfo.text}
          </span>
        )}
        {task.estimatedHours && (
          <span className="text-[11px] text-ink-400">
            <Clock className="w-3 h-3 inline mr-1" />
            {task.estimatedHours}h estimated
          </span>
        )}
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
          <div className="bg-white rounded-xl border border-ink-100 p-5">
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-[13px] font-semibold text-ink-700">Description</h3>
                {!editingDescription && (
                  <button
                    onClick={() => { setDescriptionDraft(task.description || ''); setEditingDescription(true) }}
                    className="text-[10px] text-ink-300 hover:text-ink-500"
                  >
                    {task.description ? 'Edit' : '+ Add'}
                  </button>
                )}
              </div>
              {editingDescription ? (
                <div className="space-y-2">
                  <textarea
                    value={descriptionDraft}
                    onChange={(e) => setDescriptionDraft(e.target.value)}
                    className="w-full text-[13px] text-ink-600 bg-surface-50 border border-ink-200 rounded-lg px-3 py-2 outline-none focus:border-accent-300 focus:ring-1 focus:ring-accent-200 resize-y min-h-[80px] leading-relaxed placeholder:text-ink-300"
                    rows={4}
                    autoFocus
                    disabled={fieldSaving}
                    placeholder="Add a description..."
                  />
                  <div className="flex items-center gap-2">
                    <button
                      onClick={async () => {
                        const val = descriptionDraft.trim() || null
                        setFieldSaving(true)
                        try {
                          const res = await fetch(`/api/tasks/${taskId}`, {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ description: val }),
                          })
                          if (!res.ok) throw new Error('Failed to update description')
                          setTask(prev => prev ? { ...prev, description: val } : prev)
                          toast('Description updated', 'success')
                        } catch {
                          toast('Failed to update description', 'error')
                        }
                        setFieldSaving(false)
                        setEditingDescription(false)
                      }}
                      disabled={fieldSaving}
                      className="text-[12px] text-accent-600 font-medium hover:text-accent-700 disabled:opacity-50"
                    >
                      {fieldSaving ? 'Saving...' : 'Save'}
                    </button>
                    <button
                      onClick={() => setEditingDescription(false)}
                      disabled={fieldSaving}
                      className="text-[12px] text-ink-400 font-medium hover:text-ink-600 disabled:opacity-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : task.description ? (
                <p
                  className="text-[13px] text-ink-600 whitespace-pre-wrap leading-relaxed cursor-pointer hover:bg-surface-50 rounded-lg px-2 py-1 -mx-2 -my-1 transition-colors"
                  onClick={() => { setDescriptionDraft(task.description || ''); setEditingDescription(true) }}
                  title="Click to edit description"
                >
                  {task.description}
                </p>
              ) : (
                <p
                  className="text-[13px] text-ink-300 italic cursor-pointer hover:text-ink-500 transition-colors"
                  onClick={() => { setDescriptionDraft(''); setEditingDescription(true) }}
                >
                  No description. Click to add one.
                </p>
              )}
            </div>
            {task.instructions && (
              <div className={task.description || editingDescription ? 'mt-4 pt-4 border-t border-ink-100' : ''}>
                <h3 className="text-[13px] font-semibold text-ink-700 mb-2">Instructions</h3>
                <p className="text-[13px] text-ink-600 whitespace-pre-wrap leading-relaxed">{task.instructions}</p>
              </div>
            )}
          </div>

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
                    <div className="flex-1 min-w-0">
                      <span className={cn(
                        'text-[13px]',
                        item.completed ? 'text-ink-400 line-through' : 'text-ink-700',
                      )}>
                        {item.label}
                      </span>
                      {(item.assignee || item.dueDate) && (
                        <div className="flex items-center gap-2 mt-0.5">
                          {item.assignee && (
                            <span className="text-[10px] text-ink-400 flex items-center gap-0.5">
                              <User className="w-2.5 h-2.5" /> {item.assignee.fullName}
                            </span>
                          )}
                          {item.dueDate && (
                            <span className={cn(
                              'text-[10px] flex items-center gap-0.5',
                              new Date(item.dueDate) < new Date() && !item.completed ? 'text-red-500' : 'text-ink-400',
                            )}>
                              <Calendar className="w-2.5 h-2.5" /> {formatDate(item.dueDate)}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    {item.mandatory && !item.completed && (
                      <span className="text-[10px] text-red-500 font-medium shrink-0">Required</span>
                    )}
                  </button>
                ))}
              </div>
            )}

            {/* Add item form */}
            <form onSubmit={handleAddChecklistItem} className="border-t border-ink-50 px-5 py-3 space-y-2">
              <div className="flex items-center gap-2">
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
              </div>
              {newItemLabel.trim() && (
                <div className="flex items-center gap-3 ml-6">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newItemMandatory}
                      onChange={(e) => setNewItemMandatory(e.target.checked)}
                      className="w-3.5 h-3.5 rounded border-ink-300 text-accent-600 focus:ring-accent-300"
                    />
                    <span className="text-[11px] text-ink-500">Required</span>
                  </label>
                  <select
                    value={newItemAssignee}
                    onChange={(e) => setNewItemAssignee(e.target.value)}
                    className="text-[11px] text-ink-500 bg-transparent border border-ink-200 rounded px-1.5 py-0.5 cursor-pointer"
                  >
                    <option value="">Unassigned</option>
                    {projectMembers.map(m => (
                      <option key={m.id} value={m.id}>{m.fullName}</option>
                    ))}
                  </select>
                </div>
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

          {/* ── Attachments ──────────────────────────────── */}
          <div className="bg-white rounded-xl border border-ink-100">
            <div className="flex items-center gap-2 px-5 py-4 border-b border-ink-50">
              <Paperclip className="w-4 h-4 text-ink-400" />
              <h3 className="text-[13px] font-semibold text-ink-700">
                Attachments
                {(() => {
                  const parsed: AttachmentFile[] = parseAttachments(task.attachments)
                  return parsed.length > 0 ? <span className="ml-1.5 text-ink-400 font-normal">{parsed.length}</span> : null
                })()}
              </h3>
            </div>

            {/* Existing attachments */}
            {(() => {
              const parsed: AttachmentFile[] = parseAttachments(task.attachments)
              return parsed.length > 0 ? (
                <div className="divide-y divide-ink-50">
                  {parsed.map((att, idx) => (
                    <div key={idx} className="flex items-center gap-3 px-5 py-3">
                      <FileText className="w-4 h-4 text-ink-300 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <a href={att.url} target="_blank" rel="noopener noreferrer" className="text-[12px] font-medium text-accent-600 hover:underline truncate block">
                          {att.fileName}
                        </a>
                        <span className="text-[11px] text-ink-300">{(att.fileSize / 1024).toFixed(0)} KB</span>
                      </div>
                      <a href={att.url} target="_blank" rel="noopener noreferrer" className="p-1 text-ink-300 hover:text-ink-600">
                        <Download className="w-3.5 h-3.5" />
                      </a>
                      <button
                        onClick={async () => {
                          const updated = parsed.filter((_, i) => i !== idx)
                          try {
                            const res = await fetch(`/api/tasks/${taskId}`, {
                              method: 'PATCH',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ attachments: JSON.stringify(updated) }),
                            })
                            if (res.ok) {
                              setTask({ ...task, attachments: JSON.stringify(updated) })
                              toast('Attachment removed', 'success')
                            }
                          } catch { /* ignore */ }
                        }}
                        className="p-1 text-ink-300 hover:text-red-500"
                        title="Remove attachment"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : null
            })()}

            {/* Upload zone */}
            <div className="px-5 py-4">
              <FileUpload
                projectId={task.projectId}
                label="Drop files here or click to upload"
                multiple
                onFilesChange={async (files: UploadResult[]) => {
                  const completed = files.filter(f => f.url)
                  if (completed.length === 0) return
                  const existing: AttachmentFile[] = parseAttachments(task.attachments)
                  const newAtts: AttachmentFile[] = completed.map(f => ({
                    url: f.url,
                    fileName: f.fileName,
                    fileSize: f.fileSize,
                    contentType: f.contentType || 'application/octet-stream',
                  }))
                  const merged = [...existing, ...newAtts]
                  try {
                    const res = await fetch(`/api/tasks/${taskId}`, {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ attachments: JSON.stringify(merged) }),
                    })
                    if (res.ok) {
                      setTask({ ...task, attachments: JSON.stringify(merged) })
                      toast(`${newAtts.length} file${newAtts.length > 1 ? 's' : ''} attached`, 'success')
                    }
                  } catch { /* ignore */ }
                }}
              />
            </div>
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
                <select
                  value={task.owner?.id || ''}
                  onChange={async (e) => {
                    const val = e.target.value
                    try {
                      const res = await fetch(`/api/tasks/${taskId}`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ ownerId: val || null }),
                      })
                      if (!res.ok) throw new Error('Failed to update owner')
                      const json = await res.json()
                      setTask((prev) => prev ? { ...prev, ...json.data.task, checklistItems: prev.checklistItems, comments: prev.comments, dependsOn: prev.dependsOn, dependedOnBy: prev.dependedOnBy, milestone: prev.milestone, archivedAt: prev.archivedAt, deliverable: prev.deliverable, sharepointUrl: prev.sharepointUrl } : prev)
                      toast('Owner updated', 'success')
                    } catch {
                      toast('Failed to update owner', 'error')
                    }
                  }}
                  className="text-[13px] font-medium text-ink-700 bg-transparent border-0 cursor-pointer text-right appearance-none"
                >
                  <option value="">Unassigned</option>
                  {projectMembers.map((m) => (
                    <option key={m.id} value={m.id}>{m.fullName}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[12px] text-ink-400 flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5" /> Reviewer
                </span>
                <select
                  value={task.reviewer?.id || ''}
                  onChange={async (e) => {
                    const val = e.target.value
                    try {
                      const res = await fetch(`/api/tasks/${taskId}`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ reviewerId: val || null }),
                      })
                      if (!res.ok) throw new Error('Failed to update reviewer')
                      const json = await res.json()
                      setTask((prev) => prev ? { ...prev, ...json.data.task, checklistItems: prev.checklistItems, comments: prev.comments, dependsOn: prev.dependsOn, dependedOnBy: prev.dependedOnBy, milestone: prev.milestone, archivedAt: prev.archivedAt, deliverable: prev.deliverable, sharepointUrl: prev.sharepointUrl } : prev)
                      toast('Reviewer updated', 'success')
                    } catch {
                      toast('Failed to update reviewer', 'error')
                    }
                  }}
                  className="text-[13px] font-medium text-ink-700 bg-transparent border-0 cursor-pointer text-right appearance-none"
                >
                  <option value="">Unassigned</option>
                  {projectMembers.map((m) => (
                    <option key={m.id} value={m.id}>{m.fullName}</option>
                  ))}
                </select>
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
              {/* Milestone selector */}
              <div className="flex items-center justify-between">
                <span className="text-ink-400 flex items-center gap-1"><Milestone className="w-3 h-3" /> Milestone</span>
                <select
                  value={task.milestone?.id || ''}
                  onChange={async (e) => {
                    const val = e.target.value
                    try {
                      const res = await fetch(`/api/tasks/${taskId}`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ milestoneId: val || null }),
                      })
                      if (!res.ok) throw new Error('Failed to update milestone')
                      const selected = milestones.find(m => m.id === val)
                      setTask(prev => prev ? {
                        ...prev,
                        milestone: val ? { id: val, title: selected?.title || '', status: selected?.status || '', dueDate: '' } : null,
                      } : prev)
                      toast('Milestone updated', 'success')
                    } catch {
                      toast('Failed to update milestone', 'error')
                    }
                  }}
                  className="text-[13px] font-medium text-ink-700 bg-transparent border-0 cursor-pointer text-right appearance-none max-w-[150px]"
                >
                  <option value="">None</option>
                  {milestones.map(m => (
                    <option key={m.id} value={m.id}>{m.title}</option>
                  ))}
                </select>
              </div>
              {task.deliverable && (
                <div className="flex items-center justify-between">
                  <span className="text-ink-400">Deliverable</span>
                  <span className="text-ink-700 text-right max-w-[150px] truncate">{task.deliverable}</span>
                </div>
              )}
              {/* SharePoint URL — editable */}
              <div className="flex items-center justify-between">
                <span className="text-ink-400 flex items-center gap-1"><LinkIcon className="w-3 h-3" /> SharePoint</span>
                {editingSharePoint ? (
                  <div className="flex items-center gap-1.5">
                    <input
                      type="url"
                      value={sharepointDraft}
                      onChange={(e) => setSharepointDraft(e.target.value)}
                      className="text-[12px] border border-ink-200 rounded px-2 py-1 w-[140px] outline-none focus:border-accent-300"
                      placeholder="https://..."
                      autoFocus
                      onKeyDown={async (e) => {
                        if (e.key === 'Escape') { setEditingSharePoint(false); return }
                        if (e.key === 'Enter') {
                          const val = sharepointDraft.trim() || null
                          try {
                            const res = await fetch(`/api/tasks/${taskId}`, {
                              method: 'PATCH',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ sharepointUrl: val }),
                            })
                            if (!res.ok) throw new Error('Failed to update')
                            setTask(prev => prev ? { ...prev, sharepointUrl: val } : prev)
                            toast('SharePoint URL updated', 'success')
                          } catch {
                            toast('Failed to update SharePoint URL', 'error')
                          }
                          setEditingSharePoint(false)
                        }
                      }}
                    />
                    <button
                      onClick={async () => {
                        const val = sharepointDraft.trim() || null
                        try {
                          const res = await fetch(`/api/tasks/${taskId}`, {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ sharepointUrl: val }),
                          })
                          if (!res.ok) throw new Error('Failed to update')
                          setTask(prev => prev ? { ...prev, sharepointUrl: val } : prev)
                          toast('SharePoint URL updated', 'success')
                        } catch {
                          toast('Failed to update SharePoint URL', 'error')
                        }
                        setEditingSharePoint(false)
                      }}
                      className="text-[11px] text-accent-600 font-medium hover:text-accent-700"
                    >
                      Save
                    </button>
                  </div>
                ) : task.sharepointUrl ? (
                  <div className="flex items-center gap-1.5">
                    <a href={task.sharepointUrl} target="_blank" rel="noopener noreferrer" className="text-accent-600 font-medium hover:underline truncate max-w-[120px] text-[13px]">
                      Open folder
                    </a>
                    <button
                      onClick={() => { setSharepointDraft(task.sharepointUrl || ''); setEditingSharePoint(true) }}
                      className="text-[10px] text-ink-300 hover:text-ink-500"
                      title="Edit URL"
                    >
                      Edit
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => { setSharepointDraft(''); setEditingSharePoint(true) }}
                    className="text-[12px] text-accent-600 hover:text-accent-700 font-medium"
                  >
                    + Add link
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Dependencies */}
          {(task.dependsOn.length > 0 || task.dependedOnBy.length > 0) && (
            <div className="bg-white rounded-xl border border-ink-100 p-5 space-y-3">
              <h3 className="text-[12px] font-semibold text-ink-400 uppercase tracking-wide flex items-center gap-1.5">
                <GitBranch className="w-3.5 h-3.5" /> Dependencies
              </h3>
              {task.dependsOn.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[11px] text-ink-400 font-medium">Blocked by</p>
                  {task.dependsOn.map((dep) => (
                    <Link
                      key={dep.id}
                      href={`/tasks/${dep.dependsOn.id}`}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg bg-surface-50 hover:bg-surface-100 transition-colors"
                    >
                      <ArrowRight className="w-3 h-3 text-ink-300 rotate-180" />
                      <span className="text-[12px] text-ink-700 truncate flex-1">{dep.dependsOn.title}</span>
                      <span className={cn(
                        'text-[10px] font-medium px-1.5 py-0.5 rounded',
                        dep.dependsOn.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700',
                      )}>
                        {dep.dependsOn.status.replace(/_/g, ' ')}
                      </span>
                    </Link>
                  ))}
                </div>
              )}
              {task.dependedOnBy.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[11px] text-ink-400 font-medium">Blocking</p>
                  {task.dependedOnBy.map((dep) => (
                    <Link
                      key={dep.id}
                      href={`/tasks/${dep.task.id}`}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg bg-surface-50 hover:bg-surface-100 transition-colors"
                    >
                      <ArrowRight className="w-3 h-3 text-ink-300" />
                      <span className="text-[12px] text-ink-700 truncate flex-1">{dep.task.title}</span>
                      <span className={cn(
                        'text-[10px] font-medium px-1.5 py-0.5 rounded',
                        dep.task.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700',
                      )}>
                        {dep.task.status.replace(/_/g, ' ')}
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}

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

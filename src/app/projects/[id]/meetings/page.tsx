'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import {
  Plus, Filter, Loader2, AlertTriangle, RefreshCw, X,
  ChevronDown, ChevronRight, MessageSquare, ClipboardList,
  Calendar, Hash, User, FileText, Clock,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useToast } from '@/components/Toast'
import { useApiMutation } from '@/hooks/use-api'
import { SkeletonRow } from '@/components/Skeleton'

/* ── Constants ────────────────────────────────────────── */

const REVIEW_STATUSES = [
  'DRAFT', 'SCHEDULED', 'IN_PROGRESS', 'UNDER_REVIEW', 'COMPLETED', 'CLOSED',
] as const
type ReviewStatus = (typeof REVIEW_STATUSES)[number]

const REVIEW_TYPES = [
  'STAGE_1', 'STAGE_2', 'STAGE_3', 'STAGE_4', 'TECHNICAL',
  'BUILDABILITY', 'VALUE_ENGINEERING', 'POST_COMPLETION', 'OTHER',
] as const
type ReviewType = (typeof REVIEW_TYPES)[number]

const COMMENT_CLASSIFICATIONS = [
  'OBSERVATION', 'CONCERN', 'ACTION_REQUIRED', 'RECOMMENDATION', 'FOR_INFORMATION',
] as const
type CommentClassification = (typeof COMMENT_CLASSIFICATIONS)[number]

const COMMENT_SEVERITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const
type CommentSeverity = (typeof COMMENT_SEVERITIES)[number]

const COMMENT_STATUSES = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED', 'DEFERRED'] as const
type CommentStatus = (typeof COMMENT_STATUSES)[number]

/* ── Types ─────────────────────────────────────────────── */

interface DesignReview {
  id: string
  reviewNumber: string
  title: string
  reviewType: ReviewType
  status: ReviewStatus
  discipline: string | null
  stage: string | null
  scheduledDate: string | null
  summary: string | null
  commentCount: number
  createdAt: string
  createdBy: { id: string; fullName: string }
}

interface ReviewComment {
  id: string
  commentNumber: string
  description: string
  classification: CommentClassification
  severity: CommentSeverity
  status: CommentStatus
  owner: string | null
  dueDate: string | null
  createdAt: string
  createdBy: { id: string; fullName: string }
}

interface ReviewFormState {
  title: string
  reviewType: ReviewType
  discipline: string
  stage: string
  scheduledDate: string
  summary: string
}

interface CommentFormState {
  description: string
  classification: CommentClassification
  severity: CommentSeverity
  owner: string
  dueDate: string
}

/* ── Helpers ──────────────────────────────────────────── */

const fmtDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'

const labelOf = (s: string) => s.replace(/_/g, ' ')

function statusColor(s: ReviewStatus) {
  const map: Record<ReviewStatus, string> = {
    DRAFT: 'bg-gray-100 text-gray-700 border-gray-200',
    SCHEDULED: 'bg-blue-50 text-blue-700 border-blue-200',
    IN_PROGRESS: 'bg-yellow-50 text-yellow-700 border-yellow-200',
    UNDER_REVIEW: 'bg-purple-50 text-purple-700 border-purple-200',
    COMPLETED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    CLOSED: 'bg-slate-100 text-slate-600 border-slate-200',
  }
  return map[s]
}

function typeColor(t: ReviewType) {
  const map: Record<ReviewType, string> = {
    STAGE_1: 'bg-sky-50 text-sky-700 border-sky-200',
    STAGE_2: 'bg-cyan-50 text-cyan-700 border-cyan-200',
    STAGE_3: 'bg-teal-50 text-teal-700 border-teal-200',
    STAGE_4: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    TECHNICAL: 'bg-orange-50 text-orange-700 border-orange-200',
    BUILDABILITY: 'bg-amber-50 text-amber-700 border-amber-200',
    VALUE_ENGINEERING: 'bg-lime-50 text-lime-700 border-lime-200',
    POST_COMPLETION: 'bg-rose-50 text-rose-700 border-rose-200',
    OTHER: 'bg-gray-50 text-gray-600 border-gray-200',
  }
  return map[t]
}

function classColor(c: CommentClassification) {
  const map: Record<CommentClassification, string> = {
    OBSERVATION: 'bg-gray-100 text-gray-600 border-gray-200',
    CONCERN: 'bg-amber-50 text-amber-700 border-amber-200',
    ACTION_REQUIRED: 'bg-red-50 text-red-700 border-red-200',
    RECOMMENDATION: 'bg-blue-50 text-blue-700 border-blue-200',
    FOR_INFORMATION: 'bg-slate-50 text-slate-600 border-slate-200',
  }
  return map[c]
}

function sevColor(s: CommentSeverity) {
  const map: Record<CommentSeverity, string> = {
    LOW: 'bg-green-50 text-green-700 border-green-200',
    MEDIUM: 'bg-yellow-50 text-yellow-700 border-yellow-200',
    HIGH: 'bg-orange-50 text-orange-700 border-orange-200',
    CRITICAL: 'bg-red-50 text-red-700 border-red-200',
  }
  return map[s]
}

function cmtStatusColor(s: CommentStatus) {
  const map: Record<CommentStatus, string> = {
    OPEN: 'bg-blue-50 text-blue-700 border-blue-200',
    IN_PROGRESS: 'bg-yellow-50 text-yellow-700 border-yellow-200',
    RESOLVED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    CLOSED: 'bg-slate-100 text-slate-600 border-slate-200',
    DEFERRED: 'bg-gray-100 text-gray-600 border-gray-200',
  }
  return map[s]
}

const BLANK_REVIEW: ReviewFormState = {
  title: '', reviewType: 'STAGE_1', discipline: '', stage: '', scheduledDate: '', summary: '',
}
const BLANK_COMMENT: CommentFormState = {
  description: '', classification: 'OBSERVATION', severity: 'MEDIUM', owner: '', dueDate: '',
}

/* ── Page ──────────────────────────────────────────────── */

export default function DesignReviewsMeetingsPage() {
  const { id } = useParams<{ id: string }>()
  const { toast } = useToast()

  // Tab
  const [activeTab, setActiveTab] = useState<'reviews' | 'minutes'>('reviews')

  // Reviews data
  const [reviews, setReviews] = useState<DesignReview[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filters
  const [filterType, setFilterType] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterDiscipline, setFilterDiscipline] = useState('')
  const hasFilters = !!(filterType || filterStatus || filterDiscipline)

  // Expanded review + comments
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [comments, setComments] = useState<ReviewComment[]>([])
  const [cmtLoading, setCmtLoading] = useState(false)
  const [cmtError, setCmtError] = useState<string | null>(null)

  // Create review form
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [reviewForm, setReviewForm] = useState<ReviewFormState>(BLANK_REVIEW)
  const { mutate: createReview, loading: creatingReview, error: createReviewErr, clearError: clearReviewErr } =
    useApiMutation<DesignReview>(`/api/projects/${id}/design-reviews`, 'POST')

  // Create comment form
  const [showCmtForm, setShowCmtForm] = useState(false)
  const [cmtForm, setCmtForm] = useState<CommentFormState>(BLANK_COMMENT)
  const { mutate: createComment, loading: creatingCmt, error: createCmtErr, clearError: clearCmtErr } =
    useApiMutation<ReviewComment>(
      expandedId ? `/api/projects/${id}/design-reviews/${expandedId}/comments` : `/api/projects/${id}/design-reviews/_/comments`,
      'POST'
    )

  /* ── Fetch reviews ────────────────────────────────── */

  const fetchReviews = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const p = new URLSearchParams()
      if (filterType) p.set('reviewType', filterType)
      if (filterStatus) p.set('status', filterStatus)
      if (filterDiscipline.trim()) p.set('discipline', filterDiscipline.trim())
      const qs = p.toString()
      const res = await fetch(`/api/projects/${id}/design-reviews${qs ? `?${qs}` : ''}`)
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error?.message || `Failed to load reviews (${res.status})`)
      }
      const json = await res.json()
      if (json.data) setReviews(json.data.reviews || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally { setLoading(false) }
  }, [id, filterType, filterStatus, filterDiscipline])

  useEffect(() => { fetchReviews() }, [fetchReviews])

  /* ── Fetch comments ───────────────────────────────── */

  const fetchComments = useCallback(async (reviewId: string) => {
    setCmtLoading(true)
    setCmtError(null)
    setComments([])
    try {
      const res = await fetch(`/api/projects/${id}/design-reviews/${reviewId}/comments`)
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error?.message || `Failed to load comments (${res.status})`)
      }
      const json = await res.json()
      if (json.data) setComments(json.data.comments || [])
    } catch (err) {
      setCmtError(err instanceof Error ? err.message : 'Something went wrong')
    } finally { setCmtLoading(false) }
  }, [id])

  /* ── Toggle expand ────────────────────────────────── */

  const toggleExpand = (reviewId: string) => {
    if (expandedId === reviewId) {
      setExpandedId(null)
      setComments([])
      setCmtError(null)
      setShowCmtForm(false)
      setCmtForm(BLANK_COMMENT)
    } else {
      setExpandedId(reviewId)
      setShowCmtForm(false)
      setCmtForm(BLANK_COMMENT)
      fetchComments(reviewId)
    }
  }

  /* ── Create review ────────────────────────────────── */

  const handleCreateReview = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = reviewForm.title.trim()
    if (!trimmed) return

    const body: Record<string, unknown> = { title: trimmed, reviewType: reviewForm.reviewType }
    if (reviewForm.discipline.trim()) body.discipline = reviewForm.discipline.trim()
    if (reviewForm.stage.trim()) body.stage = reviewForm.stage.trim()
    if (reviewForm.scheduledDate) body.scheduledDate = reviewForm.scheduledDate
    if (reviewForm.summary.trim()) body.summary = reviewForm.summary.trim()

    const result = await createReview(body)
    if (result) {
      toast('Design review created', 'success')
      setReviewForm(BLANK_REVIEW)
      setShowCreateForm(false)
      clearReviewErr()
      fetchReviews()
    } else {
      toast(createReviewErr || 'Failed to create review', 'error')
    }
  }

  const cancelCreateReview = () => {
    setShowCreateForm(false)
    setReviewForm(BLANK_REVIEW)
    clearReviewErr()
  }

  /* ── Create comment ───────────────────────────────── */

  const handleCreateComment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!expandedId) return
    const trimmed = cmtForm.description.trim()
    if (!trimmed) return

    const body: Record<string, unknown> = {
      description: trimmed,
      classification: cmtForm.classification,
      severity: cmtForm.severity,
    }
    if (cmtForm.owner.trim()) body.owner = cmtForm.owner.trim()
    if (cmtForm.dueDate) body.dueDate = cmtForm.dueDate

    const result = await createComment(body)
    if (result) {
      toast('Comment added', 'success')
      setCmtForm(BLANK_COMMENT)
      setShowCmtForm(false)
      clearCmtErr()
      fetchComments(expandedId)
      fetchReviews()
    } else {
      toast(createCmtErr || 'Failed to add comment', 'error')
    }
  }

  const cancelCreateComment = () => {
    setShowCmtForm(false)
    setCmtForm(BLANK_COMMENT)
    clearCmtErr()
  }

  const clearFilters = () => { setFilterType(''); setFilterStatus(''); setFilterDiscipline('') }

  /* ── Render ─────────────────────────────────────────── */

  return (
    <div className="space-y-5">
      {/* Page header */}
      <div>
        <h2 className="text-[18px] font-semibold text-ink-900">Design Reviews &amp; Meetings</h2>
        <p className="text-[12px] text-ink-400 mt-0.5">Track design review sessions, comments and meeting actions</p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-ink-100">
        <button
          onClick={() => setActiveTab('reviews')}
          className={cn(
            'px-4 py-2.5 text-[13px] font-medium border-b-2 transition-colors -mb-px',
            activeTab === 'reviews' ? 'border-ink-900 text-ink-900' : 'border-transparent text-ink-400 hover:text-ink-600 hover:border-ink-200'
          )}
        >
          <span className="flex items-center gap-2">
            <ClipboardList className="w-4 h-4" />
            Design Reviews
            {!loading && reviews.length > 0 && (
              <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-ink-100 text-ink-600 text-[11px] font-medium">
                {reviews.length}
              </span>
            )}
          </span>
        </button>
        <button
          onClick={() => setActiveTab('minutes')}
          className={cn(
            'px-4 py-2.5 text-[13px] font-medium border-b-2 transition-colors -mb-px',
            activeTab === 'minutes' ? 'border-ink-900 text-ink-900' : 'border-transparent text-ink-400 hover:text-ink-600 hover:border-ink-200'
          )}
        >
          <span className="flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Meeting Minutes
          </span>
        </button>
      </div>

      {/* Meeting Minutes tab */}
      {activeTab === 'minutes' && (
        <div className="bg-white rounded-xl border border-ink-100 p-10 text-center">
          <FileText className="w-10 h-10 text-ink-200 mx-auto mb-3" />
          <p className="text-[14px] font-medium text-ink-600">Meeting minutes coming soon</p>
          <p className="text-[12px] text-ink-400 mt-1.5 max-w-md mx-auto">
            Meeting minutes will be available in a future update. Use Design Reviews to track review actions and decisions.
          </p>
        </div>
      )}

      {/* Design Reviews tab */}
      {activeTab === 'reviews' && (
        <>
          {/* Loading */}
          {loading && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <div className="h-5 w-36 bg-ink-100 animate-pulse rounded" />
                  <div className="h-3.5 w-52 bg-ink-100 animate-pulse rounded" />
                </div>
              </div>
              <div className="bg-white rounded-xl border border-ink-100 divide-y divide-ink-50">
                {Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)}
              </div>
            </div>
          )}

          {/* Error */}
          {!loading && error && (
            <div className="flex flex-col items-center justify-center min-h-[40vh] gap-4">
              <AlertTriangle className="w-8 h-8 text-red-500" />
              <p className="text-[13px] text-ink-600">{error}</p>
              <button onClick={fetchReviews} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-ink-900 text-white text-[13px] font-medium hover:bg-ink-800 transition-colors">
                <RefreshCw className="w-4 h-4" /> Try again
              </button>
            </div>
          )}

          {/* Content */}
          {!loading && !error && (
            <div className="space-y-4">
              {/* Sub-header */}
              <div className="flex items-start justify-between flex-wrap gap-3">
                <div>
                  <h3 className="text-[15px] font-semibold text-ink-900">
                    Design Reviews
                    <span className="ml-2 inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5 rounded-full bg-ink-100 text-ink-600 text-[11px] font-medium align-middle">
                      {reviews.length}
                    </span>
                  </h3>
                  <p className="text-[12px] text-ink-400 mt-0.5">Manage design review sessions and track action items</p>
                </div>
                {!showCreateForm && (
                  <button onClick={() => setShowCreateForm(true)} className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-ink-900 text-white text-[12px] font-medium hover:bg-ink-800 transition-colors">
                    <Plus className="w-4 h-4" /> New Review
                  </button>
                )}
              </div>

              {/* Create review form */}
              {showCreateForm && (
                <form onSubmit={handleCreateReview} className="bg-white rounded-xl border-2 border-accent-200 p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-[14px] font-semibold text-ink-900">New Design Review</h3>
                    <button type="button" onClick={cancelCreateReview} className="text-ink-400 hover:text-ink-600 transition-colors">
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div>
                    <label htmlFor="review-title" className="block text-[11px] font-medium text-ink-500 mb-1">
                      Title <span className="text-red-400">*</span>
                    </label>
                    <input id="review-title" type="text" value={reviewForm.title}
                      onChange={(e) => setReviewForm({ ...reviewForm, title: e.target.value })}
                      placeholder="e.g. Stage 2 Design Review — Structural"
                      className="w-full px-3 py-2 text-[13px] border border-ink-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-300 focus:border-accent-400 placeholder:text-ink-300"
                      autoFocus maxLength={300} required />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="review-type" className="block text-[11px] font-medium text-ink-500 mb-1">Review Type</label>
                      <select id="review-type" value={reviewForm.reviewType}
                        onChange={(e) => setReviewForm({ ...reviewForm, reviewType: e.target.value as ReviewType })}
                        className="w-full px-3 py-2 text-[13px] border border-ink-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-300 focus:border-accent-400 bg-white">
                        {REVIEW_TYPES.map((t) => <option key={t} value={t}>{labelOf(t)}</option>)}
                      </select>
                    </div>
                    <div>
                      <label htmlFor="review-discipline" className="block text-[11px] font-medium text-ink-500 mb-1">Discipline</label>
                      <input id="review-discipline" type="text" value={reviewForm.discipline}
                        onChange={(e) => setReviewForm({ ...reviewForm, discipline: e.target.value })}
                        placeholder="e.g. Structural, MEP, Architectural"
                        className="w-full px-3 py-2 text-[13px] border border-ink-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-300 focus:border-accent-400 placeholder:text-ink-300"
                        maxLength={200} />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="review-stage" className="block text-[11px] font-medium text-ink-500 mb-1">Stage</label>
                      <input id="review-stage" type="text" value={reviewForm.stage}
                        onChange={(e) => setReviewForm({ ...reviewForm, stage: e.target.value })}
                        placeholder="e.g. RIBA Stage 3"
                        className="w-full px-3 py-2 text-[13px] border border-ink-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-300 focus:border-accent-400 placeholder:text-ink-300"
                        maxLength={200} />
                    </div>
                    <div>
                      <label htmlFor="review-date" className="block text-[11px] font-medium text-ink-500 mb-1">Scheduled Date</label>
                      <input id="review-date" type="date" value={reviewForm.scheduledDate}
                        onChange={(e) => setReviewForm({ ...reviewForm, scheduledDate: e.target.value })}
                        className="w-full px-3 py-2 text-[13px] border border-ink-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-300 focus:border-accent-400" />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="review-summary" className="block text-[11px] font-medium text-ink-500 mb-1">Summary</label>
                    <textarea id="review-summary" value={reviewForm.summary}
                      onChange={(e) => setReviewForm({ ...reviewForm, summary: e.target.value })}
                      placeholder="Brief description of review scope and objectives..."
                      className="w-full px-3 py-2 text-[13px] border border-ink-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-300 focus:border-accent-400 placeholder:text-ink-300 min-h-[80px]"
                      maxLength={5000} />
                  </div>

                  {createReviewErr && (
                    <p className="text-[12px] text-red-600 bg-red-50 px-3 py-2 rounded-lg">{createReviewErr}</p>
                  )}

                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button type="button" onClick={cancelCreateReview}
                      className="px-3.5 py-2 text-[12px] font-medium text-ink-500 hover:text-ink-700 transition-colors" disabled={creatingReview}>
                      Cancel
                    </button>
                    <button type="submit" disabled={creatingReview || !reviewForm.title.trim()}
                      className={cn('flex items-center gap-1.5 px-4 py-2 rounded-lg text-[12px] font-medium transition-colors',
                        creatingReview || !reviewForm.title.trim()
                          ? 'bg-ink-200 text-ink-400 cursor-not-allowed' : 'bg-ink-900 text-white hover:bg-ink-800')}>
                      {creatingReview && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                      Create Review
                    </button>
                  </div>
                </form>
              )}

              {/* Filter bar */}
              <div className="flex items-center gap-3 flex-wrap">
                <Filter className="w-4 h-4 text-ink-300 shrink-0" />
                <select value={filterType} onChange={(e) => setFilterType(e.target.value)}
                  className="text-[11px] text-ink-600 bg-white border border-ink-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-accent-300">
                  <option value="">All types</option>
                  {REVIEW_TYPES.map((t) => <option key={t} value={t}>{labelOf(t)}</option>)}
                </select>
                <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
                  className="text-[11px] text-ink-600 bg-white border border-ink-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-accent-300">
                  <option value="">All statuses</option>
                  {REVIEW_STATUSES.map((s) => <option key={s} value={s}>{labelOf(s)}</option>)}
                </select>
                <input type="text" value={filterDiscipline} onChange={(e) => setFilterDiscipline(e.target.value)}
                  placeholder="Filter by discipline..."
                  className="text-[11px] text-ink-600 bg-white border border-ink-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-accent-300 placeholder:text-ink-300 w-44" />
                {hasFilters && (
                  <button onClick={clearFilters} className="flex items-center gap-1 text-[11px] text-ink-400 hover:text-ink-600 transition-colors">
                    <X className="w-3 h-3" /> Clear filters
                  </button>
                )}
              </div>

              {/* Quick stats */}
              {reviews.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {([
                    { label: 'Total', count: reviews.length, color: 'text-ink-700' },
                    { label: 'In Progress', count: reviews.filter(r => r.status === 'IN_PROGRESS').length, color: 'text-yellow-600' },
                    { label: 'Under Review', count: reviews.filter(r => r.status === 'UNDER_REVIEW').length, color: 'text-purple-600' },
                    { label: 'Completed', count: reviews.filter(r => r.status === 'COMPLETED').length, color: 'text-emerald-600' },
                  ] as const).map((stat) => (
                    <div key={stat.label} className="bg-white rounded-lg border border-ink-100 px-3 py-2.5 text-center">
                      <p className={cn('text-[16px] font-semibold', stat.color)}>{stat.count}</p>
                      <p className="text-[10px] text-ink-400 mt-0.5">{stat.label}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Reviews list — empty */}
              {reviews.length === 0 && (
                <div className="bg-white rounded-xl border border-ink-100 p-10 text-center">
                  <ClipboardList className="w-10 h-10 text-ink-200 mx-auto mb-3" />
                  <p className="text-[14px] font-medium text-ink-600">
                    {hasFilters ? 'No reviews match your filters' : 'No design reviews yet'}
                  </p>
                  <p className="text-[12px] text-ink-400 mt-1.5">
                    {hasFilters ? 'Try adjusting or clearing your filters.' : 'Create a design review to start tracking review sessions and actions.'}
                  </p>
                  {!hasFilters && !showCreateForm && (
                    <button onClick={() => setShowCreateForm(true)}
                      className="inline-flex items-center gap-1.5 mt-4 px-4 py-2 rounded-lg bg-ink-900 text-white text-[12px] font-medium hover:bg-ink-800 transition-colors">
                      <Plus className="w-4 h-4" /> New Review
                    </button>
                  )}
                </div>
              )}

              {/* Reviews list — populated */}
              {reviews.length > 0 && (
                <div className="space-y-2">
                  {reviews.map((review) => {
                    const isOpen = expandedId === review.id
                    return (
                      <div key={review.id}
                        className={cn('bg-white rounded-xl border transition-colors',
                          isOpen ? 'border-accent-200 shadow-sm' : 'border-ink-100 hover:border-ink-200')}>

                        {/* Card header */}
                        <button onClick={() => toggleExpand(review.id)} className="w-full text-left px-5 py-4 flex items-start gap-3">
                          <span className="mt-0.5 shrink-0 text-ink-300">
                            {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-[11px] font-mono text-ink-400">{review.reviewNumber}</span>
                              <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border', typeColor(review.reviewType))}>
                                {labelOf(review.reviewType)}
                              </span>
                              <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border', statusColor(review.status))}>
                                {labelOf(review.status)}
                              </span>
                            </div>
                            <h4 className="text-[13px] font-medium text-ink-900 mt-1 line-clamp-2">{review.title}</h4>
                            <div className="flex items-center gap-3 mt-2 flex-wrap">
                              {review.discipline && <span className="text-[11px] text-ink-400">{review.discipline}</span>}
                              {review.stage && (
                                <span className="flex items-center gap-1 text-[11px] text-ink-400">
                                  <Hash className="w-3 h-3" />{review.stage}
                                </span>
                              )}
                              {review.scheduledDate && (
                                <span className="flex items-center gap-1 text-[11px] text-ink-400">
                                  <Calendar className="w-3 h-3" />{fmtDate(review.scheduledDate)}
                                </span>
                              )}
                              <span className="flex items-center gap-1 text-[11px] text-ink-400">
                                <MessageSquare className="w-3 h-3" />
                                {review.commentCount} comment{review.commentCount !== 1 ? 's' : ''}
                              </span>
                            </div>
                          </div>
                        </button>

                        {/* Expanded section */}
                        {isOpen && (
                          <div className="border-t border-ink-100 px-5 py-4 space-y-4">
                            {/* Summary */}
                            {review.summary && (
                              <div className="bg-surface-50 rounded-lg p-3">
                                <p className="text-[11px] font-medium text-ink-500 mb-1">Summary</p>
                                <p className="text-[12px] text-ink-700 leading-relaxed whitespace-pre-wrap">{review.summary}</p>
                              </div>
                            )}

                            {/* Meta */}
                            <div className="flex items-center gap-4 text-[11px] text-ink-400">
                              <span className="flex items-center gap-1"><User className="w-3 h-3" />Created by {review.createdBy.fullName}</span>
                              <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{fmtDate(review.createdAt)}</span>
                            </div>

                            {/* Comments header */}
                            <div className="flex items-center justify-between pt-2">
                              <h4 className="text-[13px] font-semibold text-ink-800 flex items-center gap-1.5">
                                <MessageSquare className="w-4 h-4 text-ink-400" />
                                Comments &amp; Actions
                                {!cmtLoading && comments.length > 0 && (
                                  <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-ink-100 text-ink-600 text-[10px] font-medium">
                                    {comments.length}
                                  </span>
                                )}
                              </h4>
                              {!showCmtForm && (
                                <button onClick={(e) => { e.stopPropagation(); setShowCmtForm(true) }}
                                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-[11px] font-medium hover:bg-blue-700 transition-colors">
                                  <Plus className="w-3.5 h-3.5" /> Add Comment
                                </button>
                              )}
                            </div>

                            {/* Comment create form */}
                            {showCmtForm && (
                              <form onSubmit={handleCreateComment} className="rounded-lg border-2 border-blue-200 bg-blue-50/30 p-4 space-y-3">
                                <div className="flex items-center justify-between">
                                  <h5 className="text-[12px] font-semibold text-ink-800">New Comment</h5>
                                  <button type="button" onClick={cancelCreateComment} className="text-ink-400 hover:text-ink-600 transition-colors">
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </div>

                                <div>
                                  <label htmlFor="cmt-desc" className="block text-[10px] font-medium text-ink-500 mb-1">
                                    Description <span className="text-red-400">*</span>
                                  </label>
                                  <textarea id="cmt-desc" value={cmtForm.description}
                                    onChange={(e) => setCmtForm({ ...cmtForm, description: e.target.value })}
                                    placeholder="Describe the comment, observation or action item..."
                                    className="w-full px-3 py-2 text-[12px] border border-ink-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400 placeholder:text-ink-300 min-h-[60px] bg-white"
                                    autoFocus maxLength={5000} required />
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                  <div>
                                    <label htmlFor="cmt-class" className="block text-[10px] font-medium text-ink-500 mb-1">Classification</label>
                                    <select id="cmt-class" value={cmtForm.classification}
                                      onChange={(e) => setCmtForm({ ...cmtForm, classification: e.target.value as CommentClassification })}
                                      className="w-full px-2.5 py-1.5 text-[12px] border border-ink-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400 bg-white">
                                      {COMMENT_CLASSIFICATIONS.map((c) => <option key={c} value={c}>{labelOf(c)}</option>)}
                                    </select>
                                  </div>
                                  <div>
                                    <label htmlFor="cmt-sev" className="block text-[10px] font-medium text-ink-500 mb-1">Severity</label>
                                    <select id="cmt-sev" value={cmtForm.severity}
                                      onChange={(e) => setCmtForm({ ...cmtForm, severity: e.target.value as CommentSeverity })}
                                      className="w-full px-2.5 py-1.5 text-[12px] border border-ink-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400 bg-white">
                                      {COMMENT_SEVERITIES.map((s) => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                  </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                  <div>
                                    <label htmlFor="cmt-owner" className="block text-[10px] font-medium text-ink-500 mb-1">Owner</label>
                                    <input id="cmt-owner" type="text" value={cmtForm.owner}
                                      onChange={(e) => setCmtForm({ ...cmtForm, owner: e.target.value })}
                                      placeholder="Responsible party"
                                      className="w-full px-2.5 py-1.5 text-[12px] border border-ink-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400 placeholder:text-ink-300 bg-white"
                                      maxLength={200} />
                                  </div>
                                  <div>
                                    <label htmlFor="cmt-due" className="block text-[10px] font-medium text-ink-500 mb-1">Due Date</label>
                                    <input id="cmt-due" type="date" value={cmtForm.dueDate}
                                      onChange={(e) => setCmtForm({ ...cmtForm, dueDate: e.target.value })}
                                      className="w-full px-2.5 py-1.5 text-[12px] border border-ink-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400 bg-white" />
                                  </div>
                                </div>

                                {createCmtErr && (
                                  <p className="text-[11px] text-red-600 bg-red-50 px-3 py-2 rounded-lg">{createCmtErr}</p>
                                )}

                                <div className="flex items-center justify-end gap-2 pt-1">
                                  <button type="button" onClick={cancelCreateComment}
                                    className="px-3 py-1.5 text-[11px] font-medium text-ink-500 hover:text-ink-700 transition-colors" disabled={creatingCmt}>
                                    Cancel
                                  </button>
                                  <button type="submit" disabled={creatingCmt || !cmtForm.description.trim()}
                                    className={cn('flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-[11px] font-medium transition-colors',
                                      creatingCmt || !cmtForm.description.trim()
                                        ? 'bg-ink-200 text-ink-400 cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-blue-700')}>
                                    {creatingCmt && <Loader2 className="w-3 h-3 animate-spin" />}
                                    Add Comment
                                  </button>
                                </div>
                              </form>
                            )}

                            {/* Comments loading */}
                            {cmtLoading && (
                              <div className="space-y-1">
                                {Array.from({ length: 3 }).map((_, i) => <SkeletonRow key={i} />)}
                              </div>
                            )}

                            {/* Comments error */}
                            {cmtError && (
                              <div className="flex items-center gap-3 bg-red-50 rounded-lg px-4 py-3">
                                <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
                                <p className="text-[12px] text-red-700 flex-1">{cmtError}</p>
                                <button onClick={() => fetchComments(review.id)}
                                  className="text-[11px] text-red-600 font-medium hover:text-red-800 transition-colors">
                                  Retry
                                </button>
                              </div>
                            )}

                            {/* Comments empty */}
                            {!cmtLoading && !cmtError && comments.length === 0 && (
                              <div className="text-center py-6">
                                <MessageSquare className="w-6 h-6 text-ink-200 mx-auto mb-2" />
                                <p className="text-[12px] text-ink-400">No comments yet. Add a comment to track actions and decisions.</p>
                              </div>
                            )}

                            {/* Comments list */}
                            {!cmtLoading && !cmtError && comments.length > 0 && (
                              <div className="space-y-2">
                                {comments.map((cmt) => (
                                  <div key={cmt.id} className="rounded-lg border border-ink-100 px-4 py-3 hover:bg-surface-50 transition-colors">
                                    <div className="flex items-center gap-2 flex-wrap mb-1">
                                      <span className="text-[10px] font-mono text-ink-400">{cmt.commentNumber}</span>
                                      <span className={cn('inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium border', classColor(cmt.classification))}>
                                        {labelOf(cmt.classification)}
                                      </span>
                                      <span className={cn('inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium border', sevColor(cmt.severity))}>
                                        {cmt.severity}
                                      </span>
                                      <span className={cn('inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium border', cmtStatusColor(cmt.status))}>
                                        {labelOf(cmt.status)}
                                      </span>
                                    </div>
                                    <p className="text-[12px] text-ink-800 leading-relaxed">{cmt.description}</p>
                                    <div className="flex items-center gap-3 mt-2 flex-wrap">
                                      {cmt.owner && (
                                        <span className="flex items-center gap-1 text-[10px] text-ink-400">
                                          <User className="w-3 h-3" />{cmt.owner}
                                        </span>
                                      )}
                                      {cmt.dueDate && (
                                        <span className="flex items-center gap-1 text-[10px] text-ink-400">
                                          <Calendar className="w-3 h-3" />Due {fmtDate(cmt.dueDate)}
                                        </span>
                                      )}
                                      <span className="text-[10px] text-ink-400">
                                        {cmt.createdBy.fullName} &middot; {fmtDate(cmt.createdAt)}
                                      </span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}

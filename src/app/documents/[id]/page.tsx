'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import {
  FileText, ChevronRight, Clock, User, Shield,
  AlertTriangle, RefreshCw, CheckCircle2, XCircle,
  MessageSquare, Send, Loader2, ExternalLink,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useToast } from '@/components/Toast'
import { SkeletonTaskDetail } from '@/components/Skeleton'

/* ── Types mirroring GET /api/documents/[id] ───────────── */

interface ReviewerProfile {
  id: string
  fullName: string
  avatarUrl: string | null
}

interface DocumentReview {
  id: string
  outcome: string
  comments: string | null
  reviewedAt: string
  reviewer: ReviewerProfile
}

interface DocumentRevision {
  id: string
  revision: string
  status: string
  fileUrl: string
  issuePurpose: string | null
  issueDate: string | null
  supersededAt: string | null
  createdAt: string
  author: ReviewerProfile
  reviews: DocumentReview[]
}

interface DocumentProject {
  id: string
  name: string
  code: string
  organisationId: string
}

interface DocumentDetail {
  id: string
  title: string
  documentType: string
  discipline: string | null
  documentCode: string | null
  securityLevel: string
  currentRevision: string | null
  status: string
  createdAt: string
  projectId: string
  project: DocumentProject
  revisions: DocumentRevision[]
}

/* ── Helpers ───────────────────────────────────────────── */

const DOC_TYPE_LABELS: Record<string, string> = {
  DRAWING: 'Drawing', SPECIFICATION: 'Specification', SCHEDULE: 'Schedule',
  REPORT: 'Report', PHOTOGRAPH: 'Photograph', CORRESPONDENCE: 'Correspondence',
  CERTIFICATE: 'Certificate', OTHER: 'Other',
}

const DOC_STATUS_META: Record<string, { label: string; color: string; bgColor: string }> = {
  DRAFT: { label: 'Draft', color: 'text-ink-600', bgColor: 'bg-ink-50' },
  IN_REVIEW: { label: 'In review', color: 'text-amber-700', bgColor: 'bg-amber-50' },
  APPROVED_FOR_ISSUE: { label: 'Approved', color: 'text-emerald-700', bgColor: 'bg-emerald-50' },
  ISSUED: { label: 'Issued', color: 'text-blue-700', bgColor: 'bg-blue-50' },
  SUPERSEDED: { label: 'Superseded', color: 'text-ink-500', bgColor: 'bg-ink-50' },
}

const REVIEW_META: Record<string, { label: string; color: string; bgColor: string; icon: React.FC<{ className?: string }> }> = {
  APPROVED: { label: 'Approved', color: 'text-emerald-700', bgColor: 'bg-emerald-50', icon: CheckCircle2 },
  CHANGES_REQUIRED: { label: 'Changes required', color: 'text-orange-700', bgColor: 'bg-orange-50', icon: MessageSquare },
  REJECTED: { label: 'Rejected', color: 'text-red-700', bgColor: 'bg-red-50', icon: XCircle },
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

function initials(name: string): string {
  return name.split(' ').map(n => n[0]).join('').toUpperCase()
}

/* ── Page ──────────────────────────────────────────────── */

export default function DocumentDetailPage() {
  const params = useParams()
  const documentId = params.id as string
  const { toast } = useToast()

  const [doc, setDoc] = useState<DocumentDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Review form state
  const [reviewRevisionId, setReviewRevisionId] = useState<string | null>(null)
  const [reviewOutcome, setReviewOutcome] = useState<string>('')
  const [reviewComments, setReviewComments] = useState('')
  const [reviewLoading, setReviewLoading] = useState(false)

  const fetchDocument = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/documents/${documentId}`)
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error?.message || `Failed to load (${res.status})`)
      }
      const json = await res.json()
      setDoc(json.data.document)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }, [documentId])

  useEffect(() => {
    fetchDocument()
  }, [fetchDocument])

  /* ── Submit review ──────────────────────────────────── */

  async function handleSubmitReview(e: React.FormEvent) {
    e.preventDefault()
    if (!reviewRevisionId || !reviewOutcome) return
    setReviewLoading(true)
    try {
      const res = await fetch(`/api/document-revisions/${reviewRevisionId}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          outcome: reviewOutcome,
          comments: reviewComments.trim() || undefined,
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error?.message || 'Failed to submit review')
      }
      toast('Review submitted', 'success')
      setReviewRevisionId(null)
      setReviewOutcome('')
      setReviewComments('')
      fetchDocument() // Refresh to show the new review
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to submit review', 'error')
    } finally {
      setReviewLoading(false)
    }
  }

  /* ── Loading / Error ─────────────────────────────────── */

  if (loading) return <SkeletonTaskDetail />

  if (error || !doc) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <AlertTriangle className="w-8 h-8 text-red-500" />
        <p className="text-[13px] text-ink-600">{error || 'Document not found'}</p>
        <button onClick={fetchDocument} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-ink-900 text-white text-[13px] font-medium hover:bg-ink-800 transition-colors">
          <RefreshCw className="w-4 h-4" /> Try again
        </button>
      </div>
    )
  }

  const statusMeta = DOC_STATUS_META[doc.status] ?? DOC_STATUS_META.DRAFT
  const latestRevision = doc.revisions[0] ?? null

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-[12px] text-ink-400 flex-wrap">
        <Link href="/my-work" className="hover:text-accent-600 transition-colors">My Work</Link>
        <ChevronRight className="w-3.5 h-3.5" />
        <Link href={`/projects/${doc.projectId}`} className="hover:text-accent-600 transition-colors">
          {doc.project.name}
        </Link>
        <ChevronRight className="w-3.5 h-3.5" />
        <Link href={`/projects/${doc.projectId}/documents`} className="hover:text-accent-600 transition-colors">
          Documents
        </Link>
        <ChevronRight className="w-3.5 h-3.5" />
        <span className="text-ink-600 font-medium truncate max-w-[200px]">{doc.title}</span>
      </div>

      {/* Header */}
      <div>
        <div className="flex items-start gap-3 mb-2">
          <FileText className="w-6 h-6 text-ink-400 shrink-0 mt-0.5" />
          <div>
            <h1 className="text-[22px] font-semibold text-ink-900 leading-tight">{doc.title}</h1>
            {doc.documentCode && (
              <p className="text-[13px] text-ink-400 mt-0.5 font-mono">{doc.documentCode}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3 mt-3 flex-wrap">
          <span className={cn(
            'inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium',
            statusMeta.bgColor, statusMeta.color,
          )}>
            {statusMeta.label}
          </span>
          <span className="text-[11px] text-ink-400">
            {DOC_TYPE_LABELS[doc.documentType] || doc.documentType}
          </span>
          {doc.discipline && (
            <span className="text-[11px] text-ink-400">· {doc.discipline}</span>
          )}
          <span className="text-[11px] text-ink-400">
            <Shield className="w-3 h-3 inline mr-0.5" /> {doc.securityLevel}
          </span>
          {doc.currentRevision && (
            <span className="text-[12px] font-mono font-semibold text-ink-700">
              Rev {doc.currentRevision}
            </span>
          )}
        </div>
      </div>

      {/* Revision history */}
      <div className="space-y-4">
        <h2 className="text-[15px] font-semibold text-ink-900">Revision history</h2>

        {doc.revisions.length === 0 ? (
          <div className="bg-white rounded-xl border border-ink-100 p-8 text-center">
            <p className="text-[13px] text-ink-400">No revisions uploaded yet</p>
          </div>
        ) : (
          <div className="space-y-4">
            {doc.revisions.map((rev, idx) => {
              const isCurrent = idx === 0 && !rev.supersededAt
              const isConstructionIssue = rev.revision.startsWith('C')

              return (
                <div
                  key={rev.id}
                  className={cn(
                    'bg-white rounded-xl border p-5',
                    isCurrent ? 'border-accent-200 ring-1 ring-accent-100' : 'border-ink-100',
                    rev.supersededAt && 'opacity-60',
                  )}
                >
                  {/* Revision header */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <span className={cn(
                        'text-[14px] font-mono font-bold px-2.5 py-1 rounded-lg',
                        isCurrent ? 'bg-accent-100 text-accent-700' : 'bg-ink-100 text-ink-600',
                      )}>
                        {rev.revision}
                      </span>
                      {isCurrent && (
                        <span className="text-[11px] font-medium text-accent-600 bg-accent-50 px-2 py-0.5 rounded-full">
                          Current
                        </span>
                      )}
                      {isConstructionIssue && (
                        <span className="text-[11px] font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                          Construction issue
                        </span>
                      )}
                      {rev.supersededAt && (
                        <span className="text-[11px] text-ink-400">Superseded</span>
                      )}
                    </div>
                    {rev.fileUrl && (
                      <a
                        href={rev.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-[11px] text-accent-600 hover:text-accent-700 font-medium"
                      >
                        <ExternalLink className="w-3 h-3" /> View file
                      </a>
                    )}
                  </div>

                  {/* Revision details */}
                  <div className="flex items-center gap-4 text-[12px] text-ink-400 mb-3 flex-wrap">
                    <span className="flex items-center gap-1">
                      <User className="w-3 h-3" /> {rev.author.fullName}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" /> {formatDateTime(rev.createdAt)}
                    </span>
                    {rev.issuePurpose && (
                      <span>Purpose: {rev.issuePurpose}</span>
                    )}
                  </div>

                  {/* Reviews */}
                  {rev.reviews.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-ink-50 space-y-2">
                      <p className="text-[11px] font-semibold text-ink-400 uppercase tracking-wide">Reviews</p>
                      {rev.reviews.map((review) => {
                        const meta = REVIEW_META[review.outcome] ?? REVIEW_META.CHANGES_REQUIRED
                        const ReviewIcon = meta.icon
                        return (
                          <div key={review.id} className={cn('flex items-start gap-3 px-3 py-2.5 rounded-lg', meta.bgColor)}>
                            <ReviewIcon className={cn('w-4 h-4 shrink-0 mt-0.5', meta.color)} />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-0.5">
                                <span className={cn('text-[12px] font-semibold', meta.color)}>{meta.label}</span>
                                <span className="text-[11px] text-ink-400">by {review.reviewer.fullName}</span>
                                <span className="text-[11px] text-ink-300">{formatDate(review.reviewedAt)}</span>
                              </div>
                              {review.comments && (
                                <p className="text-[12px] text-ink-600 mt-1">{review.comments}</p>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {/* Review action — only for current revision */}
                  {isCurrent && (
                    <div className="mt-3 pt-3 border-t border-ink-50">
                      {reviewRevisionId === rev.id ? (
                        <form onSubmit={handleSubmitReview} className="space-y-3">
                          <div className="flex gap-2">
                            {(['APPROVED', 'CHANGES_REQUIRED', 'REJECTED'] as const).map((outcome) => {
                              const meta = REVIEW_META[outcome]
                              return (
                                <button
                                  key={outcome}
                                  type="button"
                                  onClick={() => setReviewOutcome(outcome)}
                                  className={cn(
                                    'px-3 py-1.5 rounded-lg text-[11px] font-medium border transition-all',
                                    reviewOutcome === outcome
                                      ? cn(meta.bgColor, meta.color, 'border-current/30 ring-1 ring-current/20')
                                      : 'bg-ink-50 text-ink-500 border-ink-100 hover:bg-ink-100',
                                  )}
                                >
                                  {meta.label}
                                </button>
                              )
                            })}
                          </div>
                          <textarea
                            value={reviewComments}
                            onChange={(e) => setReviewComments(e.target.value)}
                            placeholder="Add review comments (optional)..."
                            rows={2}
                            className="w-full text-[13px] bg-surface-50 border border-ink-100 rounded-lg px-3 py-2 outline-none focus:border-accent-300 focus:ring-1 focus:ring-accent-200 resize-none placeholder:text-ink-300"
                            maxLength={2000}
                          />
                          <div className="flex items-center gap-2">
                            <button
                              type="submit"
                              disabled={!reviewOutcome || reviewLoading}
                              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-ink-900 text-white text-[12px] font-medium hover:bg-ink-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {reviewLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                              Submit review
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setReviewRevisionId(null)
                                setReviewOutcome('')
                                setReviewComments('')
                              }}
                              className="px-4 py-2 rounded-lg text-[12px] text-ink-500 hover:bg-ink-50 transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                        </form>
                      ) : (
                        <button
                          onClick={() => setReviewRevisionId(rev.id)}
                          className="text-[12px] text-accent-600 font-medium hover:text-accent-700 transition-colors"
                        >
                          Submit a review
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

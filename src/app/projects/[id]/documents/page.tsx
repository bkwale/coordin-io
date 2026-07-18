'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import {
  FileText, Filter,
  AlertTriangle, RefreshCw,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { SkeletonRow } from '@/components/Skeleton'

/* ── Types mirroring GET /api/projects/[id]/documents ──── */

interface LatestRevision {
  id: string
  revision: string
  status: string
  authorId: string
  issuePurpose: string | null
  issueDate: string | null
  supersededAt: string | null
  createdAt: string
}

interface DocumentItem {
  id: string
  title: string
  documentType: string
  discipline: string | null
  documentCode: string | null
  securityLevel: string
  currentRevision: string | null
  status: string
  createdAt: string
  latestRevision: LatestRevision | null
}

type FilterType = 'ALL' | 'DRAWING' | 'SPECIFICATION' | 'SCHEDULE' | 'REPORT' | 'PHOTOGRAPH' | 'CORRESPONDENCE' | 'CERTIFICATE' | 'OTHER'

/* ── Helpers ───────────────────────────────────────────── */

const DOC_TYPE_LABELS: Record<string, string> = {
  DRAWING: 'Drawing',
  SPECIFICATION: 'Specification',
  SCHEDULE: 'Schedule',
  REPORT: 'Report',
  PHOTOGRAPH: 'Photograph',
  CORRESPONDENCE: 'Correspondence',
  CERTIFICATE: 'Certificate',
  OTHER: 'Other',
}

const DOC_STATUS_META: Record<string, { label: string; color: string; bgColor: string }> = {
  DRAFT: { label: 'Draft', color: 'text-ink-600', bgColor: 'bg-ink-50' },
  IN_REVIEW: { label: 'In review', color: 'text-amber-700', bgColor: 'bg-amber-50' },
  APPROVED_FOR_ISSUE: { label: 'Approved', color: 'text-emerald-700', bgColor: 'bg-emerald-50' },
  ISSUED: { label: 'Issued', color: 'text-blue-700', bgColor: 'bg-blue-50' },
  SUPERSEDED: { label: 'Superseded', color: 'text-ink-500', bgColor: 'bg-ink-50' },
}

const SECURITY_META: Record<string, { label: string; color: string }> = {
  INTERNAL: { label: 'Internal', color: 'text-ink-500' },
  CONSULTANT: { label: 'Consultant', color: 'text-blue-600' },
  CONTRACTOR: { label: 'Contractor', color: 'text-amber-600' },
  CLIENT_OPERATOR: { label: 'Client', color: 'text-purple-600' },
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

/* ── Page ──────────────────────────────────────────────── */

export default function DrawingRegisterPage() {
  const params = useParams()
  const projectId = params.id as string

  const [documents, setDocuments] = useState<DocumentItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [typeFilter, setTypeFilter] = useState<FilterType>('ALL')

  const fetchDocuments = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/projects/${projectId}/documents`)
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error?.message || `Failed to load (${res.status})`)
      }
      const json = await res.json()
      setDocuments(json.data.documents)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    fetchDocuments()
  }, [fetchDocuments])

  /* ── Filter ──────────────────────────────────────────── */

  const filtered = typeFilter === 'ALL'
    ? documents
    : documents.filter((d) => d.documentType === typeFilter)

  const typeCounts = documents.reduce<Record<string, number>>((acc, d) => {
    acc[d.documentType] = (acc[d.documentType] || 0) + 1
    return acc
  }, {})

  /* ── Loading ─────────────────────────────────────────── */

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-6 w-40 bg-ink-100 animate-pulse rounded" />
        <div className="bg-white rounded-xl border border-ink-100 divide-y divide-ink-50">
          {Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh] gap-4">
        <AlertTriangle className="w-8 h-8 text-red-500" />
        <p className="text-[13px] text-ink-600">{error}</p>
        <button onClick={fetchDocuments} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-ink-900 text-white text-[13px] font-medium hover:bg-ink-800 transition-colors">
          <RefreshCw className="w-4 h-4" /> Try again
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h2 className="text-[18px] font-semibold text-ink-900">Drawing Register</h2>
        <p className="text-[12px] text-ink-400 mt-0.5">
          {documents.length} document{documents.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Type filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <Filter className="w-4 h-4 text-ink-300" />
        <button
          onClick={() => setTypeFilter('ALL')}
          className={cn(
            'px-3 py-1.5 rounded-full text-[11px] font-medium transition-colors',
            typeFilter === 'ALL' ? 'bg-ink-900 text-white' : 'bg-ink-50 text-ink-500 hover:bg-ink-100',
          )}
        >
          All {documents.length}
        </button>
        {Object.entries(typeCounts).map(([type, count]) => (
          <button
            key={type}
            onClick={() => setTypeFilter(type as FilterType)}
            className={cn(
              'px-3 py-1.5 rounded-full text-[11px] font-medium transition-colors',
              typeFilter === type ? 'bg-ink-900 text-white' : 'bg-ink-50 text-ink-500 hover:bg-ink-100',
            )}
          >
            {DOC_TYPE_LABELS[type] || type} {count}
          </button>
        ))}
      </div>

      {/* Document list */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-ink-100 p-10 text-center">
          <FileText className="w-10 h-10 text-ink-300 mx-auto mb-3" />
          <p className="text-[14px] font-medium text-ink-600">No documents found</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-ink-100 overflow-hidden">
          {/* Table header */}
          <div className="hidden sm:grid grid-cols-12 gap-4 px-5 py-3 bg-surface-50 border-b border-ink-100 text-[11px] font-semibold text-ink-400 uppercase tracking-wide">
            <div className="col-span-4">Document</div>
            <div className="col-span-2">Type</div>
            <div className="col-span-1">Rev</div>
            <div className="col-span-2">Status</div>
            <div className="col-span-1">Security</div>
            <div className="col-span-2">Updated</div>
          </div>

          {/* Rows */}
          <div className="divide-y divide-ink-50">
            {filtered.map((doc) => {
              const statusMeta = DOC_STATUS_META[doc.status] ?? DOC_STATUS_META.DRAFT
              const secMeta = SECURITY_META[doc.securityLevel] ?? SECURITY_META.INTERNAL

              return (
                <Link
                  key={doc.id}
                  href={`/documents/${doc.id}`}
                  className="grid sm:grid-cols-12 gap-2 sm:gap-4 px-5 py-3.5 hover:bg-surface-50 transition-colors group items-center"
                >
                  {/* Document title */}
                  <div className="sm:col-span-4 min-w-0">
                    <p className="text-[13px] font-medium text-ink-900 truncate group-hover:text-accent-700 transition-colors">
                      {doc.title}
                    </p>
                    {doc.documentCode && (
                      <p className="text-[11px] text-ink-400 mt-0.5">{doc.documentCode}</p>
                    )}
                  </div>

                  {/* Type */}
                  <div className="sm:col-span-2">
                    <span className="text-[11px] text-ink-500">{DOC_TYPE_LABELS[doc.documentType] || doc.documentType}</span>
                  </div>

                  {/* Revision */}
                  <div className="sm:col-span-1">
                    <span className="text-[12px] font-mono font-medium text-ink-700">
                      {doc.currentRevision || '—'}
                    </span>
                  </div>

                  {/* Status */}
                  <div className="sm:col-span-2">
                    <span className={cn(
                      'inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium',
                      statusMeta.bgColor, statusMeta.color,
                    )}>
                      {statusMeta.label}
                    </span>
                  </div>

                  {/* Security */}
                  <div className="sm:col-span-1">
                    <span className={cn('text-[11px] font-medium', secMeta.color)}>
                      {secMeta.label}
                    </span>
                  </div>

                  {/* Updated */}
                  <div className="sm:col-span-2">
                    <span className="text-[11px] text-ink-400">
                      {doc.latestRevision ? formatDate(doc.latestRevision.createdAt) : formatDate(doc.createdAt)}
                    </span>
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import {
  FileText, Filter,
  AlertTriangle, RefreshCw,
  Send, Inbox, Plus,
  ChevronDown, ChevronRight,
  Clock, CheckCircle2, Eye,
  X, Loader2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { SkeletonRow } from '@/components/Skeleton'
import FileUpload, { type UploadResult } from '@/components/FileUpload'

// Re-export UploadResult so other files can import from here if needed
export type { UploadResult }

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

/* ── Transmittal types ───────────────────────────────────── */

type TransmittalReason = 'FOR_INFORMATION' | 'FOR_APPROVAL' | 'FOR_CONSTRUCTION'
type TransmittalStatus = 'DRAFT' | 'ISSUED' | 'ACKNOWLEDGED'

interface Transmittal {
  id: string
  number: string
  recipient: string
  dateSent: string
  reason: TransmittalReason
  coverNote: string
  documentIds: string[]
  status: TransmittalStatus
}

/* ── Info In types ───────────────────────────────────────── */

type InfoInDocType = 'DRAWING' | 'REPORT' | 'LETTER' | 'SCHEDULE' | 'OTHER'
type InfoInStatus = 'LOGGED' | 'UNDER_REVIEW' | 'RESPONDED' | 'CLOSED'

interface InfoInItem {
  id: string
  reference: string
  receivedFrom: string
  dateReceived: string
  title: string
  type: InfoInDocType
  responseRequiredBy: string
  status: InfoInStatus
  notes: string
}

/* ── Tab type ────────────────────────────────────────────── */

type TabKey = 'register' | 'info-out' | 'info-in'

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

const TRANSMITTAL_REASON_LABELS: Record<TransmittalReason, string> = {
  FOR_INFORMATION: 'For Information',
  FOR_APPROVAL: 'For Approval',
  FOR_CONSTRUCTION: 'For Construction',
}

const TRANSMITTAL_STATUS_META: Record<TransmittalStatus, { label: string; color: string; bgColor: string }> = {
  DRAFT: { label: 'Draft', color: 'text-slate-700', bgColor: 'bg-slate-100' },
  ISSUED: { label: 'Issued', color: 'text-blue-700', bgColor: 'bg-blue-50' },
  ACKNOWLEDGED: { label: 'Acknowledged', color: 'text-emerald-700', bgColor: 'bg-emerald-50' },
}

const INFOIN_TYPE_LABELS: Record<InfoInDocType, string> = {
  DRAWING: 'Drawing',
  REPORT: 'Report',
  LETTER: 'Letter',
  SCHEDULE: 'Schedule',
  OTHER: 'Other',
}

const INFOIN_STATUS_META: Record<InfoInStatus, { label: string; color: string; bgColor: string }> = {
  LOGGED: { label: 'Logged', color: 'text-amber-700', bgColor: 'bg-amber-50' },
  UNDER_REVIEW: { label: 'Under Review', color: 'text-blue-700', bgColor: 'bg-blue-50' },
  RESPONDED: { label: 'Responded', color: 'text-emerald-700', bgColor: 'bg-emerald-50' },
  CLOSED: { label: 'Closed', color: 'text-slate-700', bgColor: 'bg-slate-100' },
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function isOverdue(iso: string): boolean {
  if (!iso) return false
  return new Date(iso) < new Date()
}

/* ── Page ──────────────────────────────────────────────── */

export default function DocumentsPage() {
  const params = useParams()
  const projectId = params.id as string

  /* ── Shared state ─────────────────────────────────────── */
  const [activeTab, setActiveTab] = useState<TabKey>('register')

  /* ── Register state ───────────────────────────────────── */
  const [documents, setDocuments] = useState<DocumentItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [typeFilter, setTypeFilter] = useState<FilterType>('ALL')

  /* ── Create Document state ───────────────────────────── */
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [createLoading, setCreateLoading] = useState(false)
  const [cdTitle, setCdTitle] = useState('')
  const [cdDocumentType, setCdDocumentType] = useState<string>('DRAWING')
  const [cdDiscipline, setCdDiscipline] = useState('')
  const [cdDocumentCode, setCdDocumentCode] = useState('')
  const [cdSecurityLevel, setCdSecurityLevel] = useState<string>('INTERNAL')
  const [cdIssuePurpose, setCdIssuePurpose] = useState('')
  const [cdFileResults, setCdFileResults] = useState<UploadResult[]>([])

  /* ── Info Out (Transmittals) state ────────────────────── */
  const [transmittals, setTransmittals] = useState<Transmittal[]>([])
  const [showTransmittalForm, setShowTransmittalForm] = useState(false)
  const [expandedTransmittal, setExpandedTransmittal] = useState<string | null>(null)
  const [ttRecipient, setTtRecipient] = useState('')
  const [ttReason, setTtReason] = useState<TransmittalReason>('FOR_INFORMATION')
  const [ttCoverNote, setTtCoverNote] = useState('')
  const [ttSelectedDocIds, setTtSelectedDocIds] = useState<string[]>([])

  /* ── Info In state ────────────────────────────────────── */
  const [infoInItems, setInfoInItems] = useState<InfoInItem[]>([])
  const [showInfoInForm, setShowInfoInForm] = useState(false)
  const [iiReceivedFrom, setIiReceivedFrom] = useState('')
  const [iiTitle, setIiTitle] = useState('')
  const [iiType, setIiType] = useState<InfoInDocType>('OTHER')
  const [iiDeadline, setIiDeadline] = useState('')
  const [iiNotes, setIiNotes] = useState('')

  /* ── Fetch documents ──────────────────────────────────── */

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

  /* ── Transmittal handlers ─────────────────────────────── */

  function handleCreateTransmittal() {
    if (!ttRecipient.trim()) return

    const newTt: Transmittal = {
      id: crypto.randomUUID(),
      number: `TT-${String(transmittals.length + 1).padStart(3, '0')}`,
      recipient: ttRecipient.trim(),
      dateSent: new Date().toISOString(),
      reason: ttReason,
      coverNote: ttCoverNote.trim(),
      documentIds: ttSelectedDocIds,
      status: 'DRAFT',
    }
    setTransmittals((prev) => [newTt, ...prev])
    resetTransmittalForm()
  }

  function resetTransmittalForm() {
    setTtRecipient('')
    setTtReason('FOR_INFORMATION')
    setTtCoverNote('')
    setTtSelectedDocIds([])
    setShowTransmittalForm(false)
  }

  function toggleTransmittalDocSelection(docId: string) {
    setTtSelectedDocIds((prev) =>
      prev.includes(docId) ? prev.filter((id) => id !== docId) : [...prev, docId],
    )
  }

  function updateTransmittalStatus(id: string, status: TransmittalStatus) {
    setTransmittals((prev) =>
      prev.map((tt) => (tt.id === id ? { ...tt, status } : tt)),
    )
  }

  /* ── Info In handlers ─────────────────────────────────── */

  function handleCreateInfoIn() {
    if (!iiReceivedFrom.trim() || !iiTitle.trim()) return

    const newItem: InfoInItem = {
      id: crypto.randomUUID(),
      reference: `IN-${String(infoInItems.length + 1).padStart(3, '0')}`,
      receivedFrom: iiReceivedFrom.trim(),
      dateReceived: new Date().toISOString(),
      title: iiTitle.trim(),
      type: iiType,
      responseRequiredBy: iiDeadline,
      status: 'LOGGED',
      notes: iiNotes.trim(),
    }
    setInfoInItems((prev) => [newItem, ...prev])
    resetInfoInForm()
  }

  function resetInfoInForm() {
    setIiReceivedFrom('')
    setIiTitle('')
    setIiType('OTHER')
    setIiDeadline('')
    setIiNotes('')
    setShowInfoInForm(false)
  }

  function updateInfoInStatus(id: string, status: InfoInStatus) {
    setInfoInItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, status } : item)),
    )
  }

  /* ── Create document handler ──────────────────────────── */

  async function handleCreateDocument() {
    if (!cdTitle.trim()) return
    setCreateLoading(true)
    try {
      // Step 1: Create the document entry
      const docRes = await fetch(`/api/projects/${projectId}/documents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: cdTitle.trim(),
          documentType: cdDocumentType,
          discipline: cdDiscipline.trim() || undefined,
          documentCode: cdDocumentCode.trim() || undefined,
          securityLevel: cdSecurityLevel,
        }),
      })

      if (!docRes.ok) {
        const body = await docRes.json().catch(() => ({}))
        throw new Error(body.error?.message || 'Failed to create document')
      }

      const docJson = await docRes.json()
      const newDocId = docJson.data.document.id

      // Step 2: Create a revision for each uploaded file
      for (const fileResult of cdFileResults) {
        const revRes = await fetch(`/api/documents/${newDocId}/revisions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fileUrl: fileResult.url,
            issuePurpose: cdIssuePurpose.trim() || undefined,
          }),
        })

        if (!revRes.ok) {
          const body = await revRes.json().catch(() => ({}))
          console.error('Revision creation failed:', body)
        }
      }

      resetCreateForm()
      fetchDocuments()
    } catch (err) {
      console.error('Create document error:', err)
      // Keep form open so user can retry
    } finally {
      setCreateLoading(false)
    }
  }

  function resetCreateForm() {
    setCdTitle('')
    setCdDocumentType('DRAWING')
    setCdDiscipline('')
    setCdDocumentCode('')
    setCdSecurityLevel('INTERNAL')
    setCdIssuePurpose('')
    setCdFileResults([])
    setShowCreateForm(false)
  }

  /* ── Register filter ──────────────────────────────────── */

  const filtered = typeFilter === 'ALL'
    ? documents
    : documents.filter((d) => d.documentType === typeFilter)

  const typeCounts = documents.reduce<Record<string, number>>((acc, d) => {
    acc[d.documentType] = (acc[d.documentType] || 0) + 1
    return acc
  }, {})

  /* ── Tab config ───────────────────────────────────────── */

  const tabs: { key: TabKey; label: string; icon: React.ReactNode }[] = [
    { key: 'register', label: 'Register', icon: <FileText className="w-4 h-4" /> },
    { key: 'info-out', label: 'Info Out', icon: <Send className="w-4 h-4" /> },
    { key: 'info-in', label: 'Info In', icon: <Inbox className="w-4 h-4" /> },
  ]

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
      {/* Tab bar */}
      <div className="flex items-center gap-1 bg-ink-50 rounded-lg p-1">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-md text-[13px] font-medium transition-colors',
              activeTab === tab.key
                ? 'bg-white text-ink-900 shadow-sm'
                : 'text-ink-500 hover:text-ink-700',
            )}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* ── Tab 1: Register ─────────────────────────────── */}
      {activeTab === 'register' && (
        <>
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-[18px] font-semibold text-ink-900">Drawing Register</h2>
              <p className="text-[12px] text-ink-400 mt-0.5">
                {documents.length} document{documents.length !== 1 ? 's' : ''}
              </p>
            </div>
            <button
              onClick={() => setShowCreateForm(!showCreateForm)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-ink-900 text-white text-[13px] font-medium hover:bg-ink-800 transition-colors"
            >
              {showCreateForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              {showCreateForm ? 'Cancel' : 'Add Document'}
            </button>
          </div>

          {/* Create Document form */}
          {showCreateForm && (
            <div className="bg-white rounded-xl border border-ink-100 p-5 space-y-4">
              <h3 className="text-[14px] font-semibold text-ink-900">New Document</h3>

              <div className="grid sm:grid-cols-2 gap-4">
                {/* Title */}
                <div>
                  <label className="block text-[11px] font-semibold text-ink-500 uppercase tracking-wide mb-1.5">
                    Title <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={cdTitle}
                    onChange={(e) => setCdTitle(e.target.value)}
                    placeholder="e.g. Ground Floor Plan"
                    className="w-full px-3 py-2 rounded-lg border border-ink-200 text-[13px] text-ink-900 placeholder:text-ink-300 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-transparent"
                  />
                </div>

                {/* Document type */}
                <div>
                  <label className="block text-[11px] font-semibold text-ink-500 uppercase tracking-wide mb-1.5">
                    Document Type
                  </label>
                  <select
                    value={cdDocumentType}
                    onChange={(e) => setCdDocumentType(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-ink-200 text-[13px] text-ink-900 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-transparent bg-white"
                  >
                    {Object.entries(DOC_TYPE_LABELS).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                {/* Discipline */}
                <div>
                  <label className="block text-[11px] font-semibold text-ink-500 uppercase tracking-wide mb-1.5">
                    Discipline <span className="text-ink-300 font-normal">(optional)</span>
                  </label>
                  <input
                    type="text"
                    value={cdDiscipline}
                    onChange={(e) => setCdDiscipline(e.target.value)}
                    placeholder="e.g. Structural, Mechanical"
                    className="w-full px-3 py-2 rounded-lg border border-ink-200 text-[13px] text-ink-900 placeholder:text-ink-300 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-transparent"
                  />
                </div>

                {/* Document code */}
                <div>
                  <label className="block text-[11px] font-semibold text-ink-500 uppercase tracking-wide mb-1.5">
                    Document Code <span className="text-ink-300 font-normal">(optional)</span>
                  </label>
                  <input
                    type="text"
                    value={cdDocumentCode}
                    onChange={(e) => setCdDocumentCode(e.target.value)}
                    placeholder="e.g. STR-DWG-001"
                    className="w-full px-3 py-2 rounded-lg border border-ink-200 text-[13px] text-ink-900 placeholder:text-ink-300 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                {/* Security level */}
                <div>
                  <label className="block text-[11px] font-semibold text-ink-500 uppercase tracking-wide mb-1.5">
                    Security Level
                  </label>
                  <select
                    value={cdSecurityLevel}
                    onChange={(e) => setCdSecurityLevel(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-ink-200 text-[13px] text-ink-900 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-transparent bg-white"
                  >
                    <option value="INTERNAL">Internal</option>
                    <option value="CONSULTANT">Consultant</option>
                    <option value="CONTRACTOR">Contractor</option>
                    <option value="CLIENT_OPERATOR">Client / Operator</option>
                  </select>
                </div>

                {/* Issue purpose */}
                <div>
                  <label className="block text-[11px] font-semibold text-ink-500 uppercase tracking-wide mb-1.5">
                    Issue Purpose <span className="text-ink-300 font-normal">(optional)</span>
                  </label>
                  <input
                    type="text"
                    value={cdIssuePurpose}
                    onChange={(e) => setCdIssuePurpose(e.target.value)}
                    placeholder="e.g. For Information, For Construction"
                    className="w-full px-3 py-2 rounded-lg border border-ink-200 text-[13px] text-ink-900 placeholder:text-ink-300 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* File upload */}
              <FileUpload
                projectId={projectId}
                onFilesChange={(files) => setCdFileResults(files)}
                label="Attach Files (optional)"
                multiple
              />

              {/* Actions */}
              <div className="flex items-center gap-3 pt-2">
                <button
                  onClick={handleCreateDocument}
                  disabled={!cdTitle.trim() || createLoading}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-medium transition-colors',
                    cdTitle.trim() && !createLoading
                      ? 'bg-ink-900 text-white hover:bg-ink-800'
                      : 'bg-ink-100 text-ink-400 cursor-not-allowed',
                  )}
                >
                  {createLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  {createLoading ? 'Creating...' : 'Create Document'}
                </button>
                <button
                  onClick={resetCreateForm}
                  className="px-4 py-2 rounded-lg text-[13px] font-medium text-ink-500 hover:text-ink-700 hover:bg-ink-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

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
        </>
      )}

      {/* ── Tab 2: Info Out (Transmittals) ──────────────── */}
      {activeTab === 'info-out' && (
        <>
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-[18px] font-semibold text-ink-900">Info Out &mdash; Transmittals</h2>
              <p className="text-[12px] text-ink-400 mt-0.5">
                {transmittals.length} transmittal{transmittals.length !== 1 ? 's' : ''}
              </p>
            </div>
            <button
              onClick={() => setShowTransmittalForm(!showTransmittalForm)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-ink-900 text-white text-[13px] font-medium hover:bg-ink-800 transition-colors"
            >
              {showTransmittalForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              {showTransmittalForm ? 'Cancel' : 'Create Transmittal'}
            </button>
          </div>

          {/* Create form */}
          {showTransmittalForm && (
            <div className="bg-white rounded-xl border border-ink-100 p-5 space-y-4">
              <h3 className="text-[14px] font-semibold text-ink-900">New Transmittal</h3>

              <div className="grid sm:grid-cols-2 gap-4">
                {/* Recipient */}
                <div>
                  <label className="block text-[11px] font-semibold text-ink-500 uppercase tracking-wide mb-1.5">
                    Recipient
                  </label>
                  <input
                    type="text"
                    value={ttRecipient}
                    onChange={(e) => setTtRecipient(e.target.value)}
                    placeholder="Company or person name"
                    className="w-full px-3 py-2 rounded-lg border border-ink-200 text-[13px] text-ink-900 placeholder:text-ink-300 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-transparent"
                  />
                </div>

                {/* Reason */}
                <div>
                  <label className="block text-[11px] font-semibold text-ink-500 uppercase tracking-wide mb-1.5">
                    Reason
                  </label>
                  <select
                    value={ttReason}
                    onChange={(e) => setTtReason(e.target.value as TransmittalReason)}
                    className="w-full px-3 py-2 rounded-lg border border-ink-200 text-[13px] text-ink-900 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-transparent bg-white"
                  >
                    {Object.entries(TRANSMITTAL_REASON_LABELS).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Cover note */}
              <div>
                <label className="block text-[11px] font-semibold text-ink-500 uppercase tracking-wide mb-1.5">
                  Cover Note <span className="text-ink-300 font-normal">(optional)</span>
                </label>
                <textarea
                  value={ttCoverNote}
                  onChange={(e) => setTtCoverNote(e.target.value)}
                  rows={2}
                  placeholder="Additional notes for the recipient..."
                  className="w-full px-3 py-2 rounded-lg border border-ink-200 text-[13px] text-ink-900 placeholder:text-ink-300 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-transparent resize-none"
                />
              </div>

              {/* Document selection */}
              <div>
                <label className="block text-[11px] font-semibold text-ink-500 uppercase tracking-wide mb-1.5">
                  Select Documents
                </label>
                {documents.length === 0 ? (
                  <p className="text-[12px] text-ink-400">No documents in the register to attach.</p>
                ) : (
                  <div className="max-h-48 overflow-y-auto border border-ink-100 rounded-lg divide-y divide-ink-50">
                    {documents.map((doc) => (
                      <label
                        key={doc.id}
                        className="flex items-center gap-3 px-3 py-2 hover:bg-surface-50 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={ttSelectedDocIds.includes(doc.id)}
                          onChange={() => toggleTransmittalDocSelection(doc.id)}
                          className="rounded border-ink-300 text-accent-600 focus:ring-accent-500"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-[12px] font-medium text-ink-800 truncate">{doc.title}</p>
                          {doc.documentCode && (
                            <p className="text-[11px] text-ink-400">{doc.documentCode}</p>
                          )}
                        </div>
                        <span className="text-[11px] text-ink-400">{DOC_TYPE_LABELS[doc.documentType] || doc.documentType}</span>
                      </label>
                    ))}
                  </div>
                )}
                {ttSelectedDocIds.length > 0 && (
                  <p className="text-[11px] text-ink-500 mt-1">{ttSelectedDocIds.length} document{ttSelectedDocIds.length !== 1 ? 's' : ''} selected</p>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-3 pt-2">
                <button
                  onClick={handleCreateTransmittal}
                  disabled={!ttRecipient.trim()}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-medium transition-colors',
                    ttRecipient.trim()
                      ? 'bg-ink-900 text-white hover:bg-ink-800'
                      : 'bg-ink-100 text-ink-400 cursor-not-allowed',
                  )}
                >
                  <Send className="w-4 h-4" /> Create Transmittal
                </button>
                <button
                  onClick={resetTransmittalForm}
                  className="px-4 py-2 rounded-lg text-[13px] font-medium text-ink-500 hover:text-ink-700 hover:bg-ink-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Transmittal list */}
          {transmittals.length === 0 ? (
            <div className="bg-white rounded-xl border border-ink-100 p-10 text-center">
              <Send className="w-10 h-10 text-ink-300 mx-auto mb-3" />
              <p className="text-[14px] font-medium text-ink-600">No transmittals yet</p>
              <p className="text-[12px] text-ink-400 mt-1">Create a transmittal to send documents externally.</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-ink-100 overflow-hidden">
              {/* Table header */}
              <div className="hidden sm:grid grid-cols-12 gap-4 px-5 py-3 bg-surface-50 border-b border-ink-100 text-[11px] font-semibold text-ink-400 uppercase tracking-wide">
                <div className="col-span-2">Number</div>
                <div className="col-span-3">Recipient</div>
                <div className="col-span-2">Date Sent</div>
                <div className="col-span-2">Reason</div>
                <div className="col-span-1">Docs</div>
                <div className="col-span-2">Status</div>
              </div>

              {/* Rows */}
              <div className="divide-y divide-ink-50">
                {transmittals.map((tt) => {
                  const statusMeta = TRANSMITTAL_STATUS_META[tt.status]
                  const isExpanded = expandedTransmittal === tt.id

                  return (
                    <div key={tt.id}>
                      <button
                        onClick={() => setExpandedTransmittal(isExpanded ? null : tt.id)}
                        className="w-full grid sm:grid-cols-12 gap-2 sm:gap-4 px-5 py-3.5 hover:bg-surface-50 transition-colors items-center text-left"
                      >
                        {/* Number */}
                        <div className="sm:col-span-2 flex items-center gap-2">
                          {isExpanded
                            ? <ChevronDown className="w-3.5 h-3.5 text-ink-400" />
                            : <ChevronRight className="w-3.5 h-3.5 text-ink-400" />
                          }
                          <span className="text-[13px] font-mono font-medium text-ink-900">{tt.number}</span>
                        </div>

                        {/* Recipient */}
                        <div className="sm:col-span-3">
                          <span className="text-[13px] text-ink-700">{tt.recipient}</span>
                        </div>

                        {/* Date */}
                        <div className="sm:col-span-2">
                          <span className="text-[11px] text-ink-400">{formatDate(tt.dateSent)}</span>
                        </div>

                        {/* Reason */}
                        <div className="sm:col-span-2">
                          <span className="text-[11px] text-ink-500">{TRANSMITTAL_REASON_LABELS[tt.reason]}</span>
                        </div>

                        {/* Doc count */}
                        <div className="sm:col-span-1">
                          <span className="text-[12px] text-ink-500">{tt.documentIds.length}</span>
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
                      </button>

                      {/* Expanded detail */}
                      {isExpanded && (
                        <div className="px-5 pb-4 bg-surface-50 border-t border-ink-50">
                          {/* Cover note */}
                          {tt.coverNote && (
                            <div className="mb-3 mt-3">
                              <p className="text-[11px] font-semibold text-ink-400 uppercase tracking-wide mb-1">Cover Note</p>
                              <p className="text-[12px] text-ink-600">{tt.coverNote}</p>
                            </div>
                          )}

                          {/* Documents */}
                          <div className="mt-3">
                            <p className="text-[11px] font-semibold text-ink-400 uppercase tracking-wide mb-2">
                              Included Documents ({tt.documentIds.length})
                            </p>
                            {tt.documentIds.length === 0 ? (
                              <p className="text-[12px] text-ink-400">No documents attached.</p>
                            ) : (
                              <div className="space-y-1">
                                {tt.documentIds.map((docId) => {
                                  const doc = documents.find((d) => d.id === docId)
                                  return (
                                    <div key={docId} className="flex items-center gap-2 px-3 py-1.5 bg-white rounded-lg border border-ink-100">
                                      <FileText className="w-3.5 h-3.5 text-ink-300" />
                                      <span className="text-[12px] text-ink-700">
                                        {doc ? doc.title : docId}
                                      </span>
                                      {doc?.documentCode && (
                                        <span className="text-[11px] text-ink-400">{doc.documentCode}</span>
                                      )}
                                    </div>
                                  )
                                })}
                              </div>
                            )}
                          </div>

                          {/* Status actions */}
                          <div className="mt-4 flex items-center gap-2">
                            {tt.status === 'DRAFT' && (
                              <button
                                onClick={() => updateTransmittalStatus(tt.id, 'ISSUED')}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 text-[12px] font-medium hover:bg-blue-100 transition-colors"
                              >
                                <Send className="w-3.5 h-3.5" /> Mark Issued
                              </button>
                            )}
                            {tt.status === 'ISSUED' && (
                              <button
                                onClick={() => updateTransmittalStatus(tt.id, 'ACKNOWLEDGED')}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 text-[12px] font-medium hover:bg-emerald-100 transition-colors"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" /> Mark Acknowledged
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Tab 3: Info In (Incoming Documents) ─────────── */}
      {activeTab === 'info-in' && (
        <>
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-[18px] font-semibold text-ink-900">Info In &mdash; Incoming Documents</h2>
              <p className="text-[12px] text-ink-400 mt-0.5">
                {infoInItems.length} item{infoInItems.length !== 1 ? 's' : ''}
              </p>
            </div>
            <button
              onClick={() => setShowInfoInForm(!showInfoInForm)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-ink-900 text-white text-[13px] font-medium hover:bg-ink-800 transition-colors"
            >
              {showInfoInForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              {showInfoInForm ? 'Cancel' : 'Log Document'}
            </button>
          </div>

          {/* Create form */}
          {showInfoInForm && (
            <div className="bg-white rounded-xl border border-ink-100 p-5 space-y-4">
              <h3 className="text-[14px] font-semibold text-ink-900">Log Incoming Document</h3>

              <div className="grid sm:grid-cols-2 gap-4">
                {/* Received from */}
                <div>
                  <label className="block text-[11px] font-semibold text-ink-500 uppercase tracking-wide mb-1.5">
                    Received From
                  </label>
                  <input
                    type="text"
                    value={iiReceivedFrom}
                    onChange={(e) => setIiReceivedFrom(e.target.value)}
                    placeholder="Company or person name"
                    className="w-full px-3 py-2 rounded-lg border border-ink-200 text-[13px] text-ink-900 placeholder:text-ink-300 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-transparent"
                  />
                </div>

                {/* Title */}
                <div>
                  <label className="block text-[11px] font-semibold text-ink-500 uppercase tracking-wide mb-1.5">
                    Document Title
                  </label>
                  <input
                    type="text"
                    value={iiTitle}
                    onChange={(e) => setIiTitle(e.target.value)}
                    placeholder="e.g. Structural Drawings Rev A"
                    className="w-full px-3 py-2 rounded-lg border border-ink-200 text-[13px] text-ink-900 placeholder:text-ink-300 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                {/* Type */}
                <div>
                  <label className="block text-[11px] font-semibold text-ink-500 uppercase tracking-wide mb-1.5">
                    Type
                  </label>
                  <select
                    value={iiType}
                    onChange={(e) => setIiType(e.target.value as InfoInDocType)}
                    className="w-full px-3 py-2 rounded-lg border border-ink-200 text-[13px] text-ink-900 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-transparent bg-white"
                  >
                    {Object.entries(INFOIN_TYPE_LABELS).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                </div>

                {/* Response deadline */}
                <div>
                  <label className="block text-[11px] font-semibold text-ink-500 uppercase tracking-wide mb-1.5">
                    Response Required By <span className="text-ink-300 font-normal">(optional)</span>
                  </label>
                  <input
                    type="date"
                    value={iiDeadline}
                    onChange={(e) => setIiDeadline(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-ink-200 text-[13px] text-ink-900 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-[11px] font-semibold text-ink-500 uppercase tracking-wide mb-1.5">
                  Notes <span className="text-ink-300 font-normal">(optional)</span>
                </label>
                <textarea
                  value={iiNotes}
                  onChange={(e) => setIiNotes(e.target.value)}
                  rows={2}
                  placeholder="Any additional notes about this document..."
                  className="w-full px-3 py-2 rounded-lg border border-ink-200 text-[13px] text-ink-900 placeholder:text-ink-300 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-transparent resize-none"
                />
              </div>

              {/* Actions */}
              <div className="flex items-center gap-3 pt-2">
                <button
                  onClick={handleCreateInfoIn}
                  disabled={!iiReceivedFrom.trim() || !iiTitle.trim()}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-medium transition-colors',
                    iiReceivedFrom.trim() && iiTitle.trim()
                      ? 'bg-ink-900 text-white hover:bg-ink-800'
                      : 'bg-ink-100 text-ink-400 cursor-not-allowed',
                  )}
                >
                  <Inbox className="w-4 h-4" /> Log Document
                </button>
                <button
                  onClick={resetInfoInForm}
                  className="px-4 py-2 rounded-lg text-[13px] font-medium text-ink-500 hover:text-ink-700 hover:bg-ink-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Info In list */}
          {infoInItems.length === 0 ? (
            <div className="bg-white rounded-xl border border-ink-100 p-10 text-center">
              <Inbox className="w-10 h-10 text-ink-300 mx-auto mb-3" />
              <p className="text-[14px] font-medium text-ink-600">No incoming documents logged</p>
              <p className="text-[12px] text-ink-400 mt-1">Log received documents to track and manage responses.</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-ink-100 overflow-hidden">
              {/* Table header */}
              <div className="hidden sm:grid grid-cols-12 gap-4 px-5 py-3 bg-surface-50 border-b border-ink-100 text-[11px] font-semibold text-ink-400 uppercase tracking-wide">
                <div className="col-span-1">Ref</div>
                <div className="col-span-2">From</div>
                <div className="col-span-2">Received</div>
                <div className="col-span-2">Title</div>
                <div className="col-span-1">Type</div>
                <div className="col-span-2">Deadline</div>
                <div className="col-span-2">Status</div>
              </div>

              {/* Rows */}
              <div className="divide-y divide-ink-50">
                {infoInItems.map((item) => {
                  const statusMeta = INFOIN_STATUS_META[item.status]
                  const overdue = item.responseRequiredBy && isOverdue(item.responseRequiredBy) && item.status !== 'RESPONDED' && item.status !== 'CLOSED'

                  return (
                    <div key={item.id} className="px-5 py-3.5 hover:bg-surface-50 transition-colors">
                      <div className="grid sm:grid-cols-12 gap-2 sm:gap-4 items-center">
                        {/* Reference */}
                        <div className="sm:col-span-1">
                          <span className="text-[13px] font-mono font-medium text-ink-900">{item.reference}</span>
                        </div>

                        {/* From */}
                        <div className="sm:col-span-2">
                          <span className="text-[13px] text-ink-700">{item.receivedFrom}</span>
                        </div>

                        {/* Date received */}
                        <div className="sm:col-span-2">
                          <span className="text-[11px] text-ink-400">{formatDate(item.dateReceived)}</span>
                        </div>

                        {/* Title */}
                        <div className="sm:col-span-2 min-w-0">
                          <p className="text-[13px] text-ink-800 truncate">{item.title}</p>
                        </div>

                        {/* Type */}
                        <div className="sm:col-span-1">
                          <span className="text-[11px] text-ink-500">{INFOIN_TYPE_LABELS[item.type]}</span>
                        </div>

                        {/* Deadline */}
                        <div className="sm:col-span-2">
                          {item.responseRequiredBy ? (
                            <span className={cn(
                              'inline-flex items-center gap-1 text-[11px] font-medium',
                              overdue ? 'text-red-600' : 'text-ink-500',
                            )}>
                              {overdue && <AlertTriangle className="w-3 h-3" />}
                              {formatDate(item.responseRequiredBy)}
                            </span>
                          ) : (
                            <span className="text-[11px] text-ink-300">&mdash;</span>
                          )}
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
                      </div>

                      {/* Notes + status actions */}
                      <div className="mt-2 flex items-center justify-between">
                        <div>
                          {item.notes && (
                            <p className="text-[11px] text-ink-400">{item.notes}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {item.status === 'LOGGED' && (
                            <button
                              onClick={() => updateInfoInStatus(item.id, 'UNDER_REVIEW')}
                              className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-blue-50 text-blue-700 text-[11px] font-medium hover:bg-blue-100 transition-colors"
                            >
                              <Eye className="w-3 h-3" /> Start Review
                            </button>
                          )}
                          {item.status === 'UNDER_REVIEW' && (
                            <button
                              onClick={() => updateInfoInStatus(item.id, 'RESPONDED')}
                              className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-50 text-emerald-700 text-[11px] font-medium hover:bg-emerald-100 transition-colors"
                            >
                              <CheckCircle2 className="w-3 h-3" /> Mark Responded
                            </button>
                          )}
                          {item.status === 'RESPONDED' && (
                            <button
                              onClick={() => updateInfoInStatus(item.id, 'CLOSED')}
                              className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-100 text-slate-700 text-[11px] font-medium hover:bg-slate-200 transition-colors"
                            >
                              <Clock className="w-3 h-3" /> Close
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

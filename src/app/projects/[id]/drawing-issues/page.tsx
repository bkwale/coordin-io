'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import {
  Plus, Filter, Loader2, AlertTriangle, RefreshCw, X,
  FileText, Search, ChevronDown, ChevronRight, Eye,
  Layers, PenTool, Clock, CheckCircle2, Archive,
  ExternalLink, Upload, Hash, Building2, MapPin,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useToast } from '@/components/Toast'
import { useApiMutation } from '@/hooks/use-api'
import { SkeletonRow } from '@/components/Skeleton'

/* ══════════════════════════════════════════════════════════
   Types
   ══════════════════════════════════════════════════════════ */

type DrawingTab = 'register' | 'revisions' | 'transmittals'

interface DrawingRevision {
  id: string
  drawingId: string
  revision: string
  description: string | null
  status: DrawingStatusType
  suitability: string | null
  purposeOfIssue: string | null
  author: string | null
  checker: string | null
  approver: string | null
  issueDate: string | null
  fileUrl: string | null
  fileSize: number | null
  superseded: boolean
  comments: string | null
  transmittalRef: string | null
  createdAt: string
}

interface Drawing {
  id: string
  projectId: string
  drawingNumber: string
  title: string
  discipline: string | null
  originator: string | null
  building: string | null
  block: string | null
  level: string | null
  zone: string | null
  drawingType: string | null
  role: string | null
  sequence: string | null
  externalLink: string | null
  isCurrent: boolean
  createdAt: string
  updatedAt: string
  revisions: DrawingRevision[]
}

type DrawingStatusType =
  | 'WORK_IN_PROGRESS'
  | 'SHARED'
  | 'PUBLISHED'
  | 'SUPERSEDED'
  | 'ARCHIVED'

/* ══════════════════════════════════════════════════════════
   Constants & Helpers
   ══════════════════════════════════════════════════════════ */

const TABS: { key: DrawingTab; label: string; icon: typeof FileText }[] = [
  { key: 'register', label: 'Register', icon: Layers },
  { key: 'revisions', label: 'Revisions', icon: Clock },
  { key: 'transmittals', label: 'Transmittals', icon: FileText },
]

const DISCIPLINES = [
  'Architecture', 'Structure', 'Mechanical', 'Electrical', 'Plumbing',
  'Civil', 'Landscape', 'Interior', 'Fire', 'Acoustic',
]

const DRAWING_TYPES = [
  'Plan', 'Section', 'Elevation', 'Detail', 'Schedule',
  'Diagram', 'Assembly', 'General Arrangement', 'Layout',
]

const STATUS_META: Record<DrawingStatusType, { label: string; color: string; bg: string; icon: typeof PenTool }> = {
  WORK_IN_PROGRESS: { label: 'WIP', color: 'text-amber-700', bg: 'bg-amber-50', icon: PenTool },
  SHARED: { label: 'Shared', color: 'text-blue-700', bg: 'bg-blue-50', icon: Eye },
  PUBLISHED: { label: 'Published', color: 'text-emerald-700', bg: 'bg-emerald-50', icon: CheckCircle2 },
  SUPERSEDED: { label: 'Superseded', color: 'text-ink-500', bg: 'bg-ink-50', icon: Clock },
  ARCHIVED: { label: 'Archived', color: 'text-ink-400', bg: 'bg-ink-50', icon: Archive },
}

const SUITABILITY_CODES: Record<string, string> = {
  S0: 'S0 - Work in progress',
  S1: 'S1 - Coordination',
  S2: 'S2 - Information',
  S3: 'S3 - Review & comment',
  S4: 'S4 - Stage approval',
  S5: 'S5 - Construction',
  S6: 'S6 - PIM authorization',
  S7: 'S7 - AIM authorization',
}

const PURPOSE_OPTIONS = [
  'For Information',
  'For Comment',
  'For Approval',
  'For Construction',
  'For Coordination',
  'For Record',
  'As Built',
]

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function formatShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

function formatFileSize(bytes: number | null): string {
  if (!bytes) return '--'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/* ── Shared badge component ──────────────────────────────── */

function StatusBadge({ status }: { status: DrawingStatusType }) {
  const meta = STATUS_META[status] ?? STATUS_META.WORK_IN_PROGRESS
  const Icon = meta.icon
  return (
    <span className={cn('inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium shrink-0', meta.bg, meta.color)}>
      <Icon className="w-3 h-3" />
      {meta.label}
    </span>
  )
}

/* ══════════════════════════════════════════════════════════
   Main Page Component
   ══════════════════════════════════════════════════════════ */

export default function DrawingRegisterPage() {
  const params = useParams()
  const projectId = params.id as string
  const { toast } = useToast()

  /* ── Tab state ──────────────────────────────────────── */
  const [activeTab, setActiveTab] = useState<DrawingTab>('register')

  /* ── Data state ─────────────────────────────────────── */
  const [drawings, setDrawings] = useState<Drawing[]>([])
  const [allRevisions, setAllRevisions] = useState<(DrawingRevision & { drawingNumber?: string; drawingTitle?: string })[]>([])

  /* ── Loading / error ────────────────────────────────── */
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  /* ── Track which tabs have been fetched ─────────────── */
  const [fetched, setFetched] = useState<Set<DrawingTab>>(new Set())

  /* ── Filter state ───────────────────────────────────── */
  const [searchQuery, setSearchQuery] = useState('')
  const [disciplineFilter, setDisciplineFilter] = useState('ALL')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [showFilters, setShowFilters] = useState(false)

  /* ── Create form visibility ─────────────────────────── */
  const [showCreateDrawing, setShowCreateDrawing] = useState(false)
  const [showAddRevision, setShowAddRevision] = useState(false)

  /* ── Selected drawing for detail/revision view ──────── */
  const [selectedDrawing, setSelectedDrawing] = useState<Drawing | null>(null)
  const [selectedDrawingRevisions, setSelectedDrawingRevisions] = useState<DrawingRevision[]>([])
  const [loadingRevisions, setLoadingRevisions] = useState(false)

  /* ── Expanded rows ─────────────────────────────────── */
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())

  /* ══════════════════════════════════════════════════════
     Data Fetching
     ══════════════════════════════════════════════════════ */

  const fetchDrawings = useCallback(async (force = false) => {
    if (fetched.has('register') && !force) {
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (disciplineFilter !== 'ALL') params.set('discipline', disciplineFilter)
      if (statusFilter !== 'ALL') params.set('status', statusFilter)
      if (searchQuery.trim()) params.set('search', searchQuery.trim())

      const queryStr = params.toString()
      const url = `/api/projects/${projectId}/drawings${queryStr ? `?${queryStr}` : ''}`
      const res = await fetch(url)
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error?.message || `Failed to load drawings (${res.status})`)
      }
      const json = await res.json()
      setDrawings(json.data.drawings ?? [])
      setFetched((prev) => new Set(prev).add('register'))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }, [projectId, disciplineFilter, statusFilter, searchQuery, fetched])

  const fetchDrawingRevisions = useCallback(async (drawingId: string) => {
    setLoadingRevisions(true)
    try {
      const res = await fetch(`/api/projects/${projectId}/drawings/${drawingId}/revisions`)
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error?.message || `Failed to load revisions (${res.status})`)
      }
      const json = await res.json()
      setSelectedDrawingRevisions(json.data.revisions ?? [])
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to load revisions', 'error')
    } finally {
      setLoadingRevisions(false)
    }
  }, [projectId, toast])

  const refreshData = useCallback(() => {
    setFetched(new Set())
    fetchDrawings(true)
  }, [fetchDrawings])

  useEffect(() => {
    if (activeTab === 'register') {
      fetchDrawings()
    }
  }, [activeTab]) // eslint-disable-line react-hooks/exhaustive-deps

  // Re-fetch when filters change
  useEffect(() => {
    if (fetched.has('register')) {
      setFetched((prev) => {
        const next = new Set(prev)
        next.delete('register')
        return next
      })
    }
  }, [disciplineFilter, statusFilter]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (fetched.has('register') && searchQuery !== undefined) {
        setFetched((prev) => {
          const next = new Set(prev)
          next.delete('register')
          return next
        })
      }
    }, 300)
    return () => clearTimeout(timeout)
  }, [searchQuery]) // eslint-disable-line react-hooks/exhaustive-deps

  // Trigger fetch when 'register' is removed from fetched set
  useEffect(() => {
    if (!fetched.has('register') && activeTab === 'register') {
      fetchDrawings()
    }
  }, [fetched, activeTab, fetchDrawings])

  /* ══════════════════════════════════════════════════════
     Build all-revisions list for the Revisions tab
     ══════════════════════════════════════════════════════ */

  useEffect(() => {
    if (activeTab === 'revisions') {
      const revs: (DrawingRevision & { drawingNumber?: string; drawingTitle?: string })[] = []
      for (const d of drawings) {
        for (const r of d.revisions) {
          revs.push({ ...r, drawingNumber: d.drawingNumber, drawingTitle: d.title })
        }
      }
      revs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      setAllRevisions(revs)
    }
  }, [activeTab, drawings])

  /* ══════════════════════════════════════════════════════
     Mutation Hooks
     ══════════════════════════════════════════════════════ */

  const { mutate: createDrawing, loading: creatingDrawing, error: createDrawingError, clearError: clearDrawingError } =
    useApiMutation<Drawing>(`/api/projects/${projectId}/drawings`, 'POST')

  /* ══════════════════════════════════════════════════════
     Create Drawing Form State
     ══════════════════════════════════════════════════════ */

  const [dwgNumber, setDwgNumber] = useState('')
  const [dwgTitle, setDwgTitle] = useState('')
  const [dwgDiscipline, setDwgDiscipline] = useState('')
  const [dwgOriginator, setDwgOriginator] = useState('')
  const [dwgBuilding, setDwgBuilding] = useState('')
  const [dwgLevel, setDwgLevel] = useState('')
  const [dwgZone, setDwgZone] = useState('')
  const [dwgType, setDwgType] = useState('')
  const [dwgRole, setDwgRole] = useState('')
  const [dwgExternalLink, setDwgExternalLink] = useState('')
  const [dwgInitialRev, setDwgInitialRev] = useState('P01')
  const [dwgRevDescription, setDwgRevDescription] = useState('')
  const [dwgRevStatus, setDwgRevStatus] = useState<DrawingStatusType>('WORK_IN_PROGRESS')
  const [dwgSuitability, setDwgSuitability] = useState('')
  const [dwgPurpose, setDwgPurpose] = useState('')
  const [dwgAuthor, setDwgAuthor] = useState('')

  /* ── Add Revision Form State ──────────────────────── */
  const [revCode, setRevCode] = useState('')
  const [revDescription, setRevDescription] = useState('')
  const [revStatus, setRevStatus] = useState<DrawingStatusType>('WORK_IN_PROGRESS')
  const [revSuitability, setRevSuitability] = useState('')
  const [revPurpose, setRevPurpose] = useState('')
  const [revAuthor, setRevAuthor] = useState('')
  const [revChecker, setRevChecker] = useState('')
  const [revApprover, setRevApprover] = useState('')
  const [revComments, setRevComments] = useState('')
  const [revTransmittal, setRevTransmittal] = useState('')
  const [addingRevision, setAddingRevision] = useState(false)
  const [addRevisionError, setAddRevisionError] = useState<string | null>(null)

  /* ── Form reset ─────────────────────────────────────── */

  const resetDrawingForm = () => {
    setShowCreateDrawing(false)
    setDwgNumber(''); setDwgTitle(''); setDwgDiscipline('')
    setDwgOriginator(''); setDwgBuilding(''); setDwgLevel('')
    setDwgZone(''); setDwgType(''); setDwgRole('')
    setDwgExternalLink(''); setDwgInitialRev('P01')
    setDwgRevDescription(''); setDwgRevStatus('WORK_IN_PROGRESS')
    setDwgSuitability(''); setDwgPurpose(''); setDwgAuthor('')
    clearDrawingError()
  }

  const resetRevisionForm = () => {
    setShowAddRevision(false)
    setRevCode(''); setRevDescription('')
    setRevStatus('WORK_IN_PROGRESS'); setRevSuitability('')
    setRevPurpose(''); setRevAuthor(''); setRevChecker('')
    setRevApprover(''); setRevComments(''); setRevTransmittal('')
    setAddRevisionError(null)
  }

  /* ══════════════════════════════════════════════════════
     Create Handlers
     ══════════════════════════════════════════════════════ */

  const handleCreateDrawing = async (e: React.FormEvent) => {
    e.preventDefault()
    const body: Record<string, unknown> = {
      drawingNumber: dwgNumber.trim(),
      title: dwgTitle.trim(),
    }
    if (dwgDiscipline) body.discipline = dwgDiscipline
    if (dwgOriginator.trim()) body.originator = dwgOriginator.trim()
    if (dwgBuilding.trim()) body.building = dwgBuilding.trim()
    if (dwgLevel.trim()) body.level = dwgLevel.trim()
    if (dwgZone.trim()) body.zone = dwgZone.trim()
    if (dwgType) body.drawingType = dwgType
    if (dwgRole.trim()) body.role = dwgRole.trim()
    if (dwgExternalLink.trim()) body.externalLink = dwgExternalLink.trim()

    // Initial revision
    if (dwgInitialRev.trim()) {
      body.revision = dwgInitialRev.trim()
      if (dwgRevDescription.trim()) body.revisionDescription = dwgRevDescription.trim()
      body.revisionStatus = dwgRevStatus
      if (dwgSuitability) body.suitability = dwgSuitability
      if (dwgPurpose) body.purposeOfIssue = dwgPurpose
      if (dwgAuthor.trim()) body.author = dwgAuthor.trim()
    }

    const result = await createDrawing(body)
    if (result) {
      toast('Drawing created', 'success')
      resetDrawingForm()
      refreshData()
    }
  }

  const handleAddRevision = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedDrawing) return

    setAddingRevision(true)
    setAddRevisionError(null)

    try {
      const body: Record<string, unknown> = {
        revision: revCode.trim(),
      }
      if (revDescription.trim()) body.description = revDescription.trim()
      body.status = revStatus
      if (revSuitability) body.suitability = revSuitability
      if (revPurpose) body.purposeOfIssue = revPurpose
      if (revAuthor.trim()) body.author = revAuthor.trim()
      if (revChecker.trim()) body.checker = revChecker.trim()
      if (revApprover.trim()) body.approver = revApprover.trim()
      if (revComments.trim()) body.comments = revComments.trim()
      if (revTransmittal.trim()) body.transmittalRef = revTransmittal.trim()

      const res = await fetch(`/api/projects/${projectId}/drawings/${selectedDrawing.id}/revisions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(typeof json.error === 'string' ? json.error : json.error?.message || `Failed to create revision (${res.status})`)
      }

      toast('Revision added', 'success')
      resetRevisionForm()
      // Refresh the drawing detail view
      await fetchDrawingRevisions(selectedDrawing.id)
      refreshData()
    } catch (err) {
      setAddRevisionError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setAddingRevision(false)
    }
  }

  /* ══════════════════════════════════════════════════════
     Row Expansion
     ══════════════════════════════════════════════════════ */

  const toggleRow = (drawingId: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev)
      if (next.has(drawingId)) {
        next.delete(drawingId)
      } else {
        next.add(drawingId)
      }
      return next
    })
  }

  /* ══════════════════════════════════════════════════════
     View Drawing Detail
     ══════════════════════════════════════════════════════ */

  const viewDrawingDetail = async (drawing: Drawing) => {
    setSelectedDrawing(drawing)
    await fetchDrawingRevisions(drawing.id)
  }

  /* ══════════════════════════════════════════════════════
     Shared UI Helpers
     ══════════════════════════════════════════════════════ */

  const inputClass = 'w-full px-3 py-2 text-[13px] border border-ink-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-300 focus:border-accent-400 placeholder:text-ink-300'
  const selectClass = cn(inputClass, 'bg-white')
  const labelClass = 'block text-[11px] font-medium text-ink-500 mb-1'

  /* ══════════════════════════════════════════════════════
     Get current revision for a drawing
     ══════════════════════════════════════════════════════ */

  function getCurrentRevision(drawing: Drawing): DrawingRevision | null {
    if (!drawing.revisions || drawing.revisions.length === 0) return null
    const nonSuperseded = drawing.revisions.filter(r => !r.superseded)
    if (nonSuperseded.length > 0) return nonSuperseded[0]
    return drawing.revisions[0]
  }

  /* ══════════════════════════════════════════════════════
     Loading State
     ══════════════════════════════════════════════════════ */

  if (loading && !fetched.has('register')) {
    return (
      <div className="space-y-5">
        {/* Tab bar skeleton */}
        <div className="flex gap-1 overflow-x-auto pb-1">
          {TABS.map((t) => (
            <div key={t.key} className="h-9 w-28 bg-ink-100 animate-pulse rounded-lg shrink-0" />
          ))}
        </div>
        <div className="bg-white rounded-xl border border-ink-100 divide-y divide-ink-50">
          {Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} />)}
        </div>
      </div>
    )
  }

  /* ══════════════════════════════════════════════════════
     Error State
     ══════════════════════════════════════════════════════ */

  if (error) {
    return (
      <div className="space-y-5">
        <div className="flex gap-1 overflow-x-auto pb-1">
          {TABS.map((t) => {
            const Icon = t.icon
            return (
              <button
                key={t.key}
                onClick={() => { setError(null); setActiveTab(t.key) }}
                className={cn(
                  'flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[12px] font-medium transition-colors shrink-0',
                  activeTab === t.key ? 'bg-ink-900 text-white' : 'bg-ink-50 text-ink-500 hover:bg-ink-100',
                )}
              >
                <Icon className="w-3.5 h-3.5" />
                {t.label}
              </button>
            )
          })}
        </div>
        <div className="flex flex-col items-center justify-center min-h-[40vh] gap-4">
          <AlertTriangle className="w-8 h-8 text-red-500" />
          <p className="text-[13px] text-ink-600">{error}</p>
          <button onClick={refreshData} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-ink-900 text-white text-[13px] font-medium hover:bg-ink-800 transition-colors">
            <RefreshCw className="w-4 h-4" /> Try again
          </button>
        </div>
      </div>
    )
  }

  /* ══════════════════════════════════════════════════════
     Drawing Detail View
     ══════════════════════════════════════════════════════ */

  if (selectedDrawing) {
    const currentRev = getCurrentRevision(selectedDrawing)

    return (
      <div className="space-y-5">
        {/* Back button */}
        <button
          onClick={() => { setSelectedDrawing(null); resetRevisionForm() }}
          className="flex items-center gap-1 text-[12px] text-ink-500 hover:text-ink-700 transition-colors"
        >
          <ChevronRight className="w-3.5 h-3.5 rotate-180" /> Back to register
        </button>

        {/* Drawing header */}
        <div className="bg-white rounded-xl border border-ink-100 p-5">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="min-w-0">
              <div className="flex items-center gap-3 mb-1">
                <span className="text-[12px] font-mono text-ink-500 bg-ink-50 px-2 py-0.5 rounded">{selectedDrawing.drawingNumber}</span>
                {currentRev && <StatusBadge status={currentRev.status} />}
              </div>
              <h3 className="text-[16px] font-semibold text-ink-900">{selectedDrawing.title}</h3>
              <div className="flex items-center gap-4 mt-2 flex-wrap">
                {selectedDrawing.discipline && (
                  <span className="flex items-center gap-1 text-[11px] text-ink-500">
                    <Layers className="w-3 h-3" /> {selectedDrawing.discipline}
                  </span>
                )}
                {selectedDrawing.originator && (
                  <span className="flex items-center gap-1 text-[11px] text-ink-500">
                    <PenTool className="w-3 h-3" /> {selectedDrawing.originator}
                  </span>
                )}
                {selectedDrawing.building && (
                  <span className="flex items-center gap-1 text-[11px] text-ink-500">
                    <Building2 className="w-3 h-3" /> {selectedDrawing.building}
                  </span>
                )}
                {selectedDrawing.level && (
                  <span className="flex items-center gap-1 text-[11px] text-ink-500">
                    <MapPin className="w-3 h-3" /> Level {selectedDrawing.level}
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {selectedDrawing.externalLink && (
                <a
                  href={selectedDrawing.externalLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-2 text-[12px] font-medium text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" /> Open in BIM
                </a>
              )}
              <button
                onClick={() => setShowAddRevision(true)}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-ink-900 text-white text-[12px] font-medium hover:bg-ink-800 transition-colors"
              >
                <Plus className="w-4 h-4" /> Add revision
              </button>
            </div>
          </div>

          {/* Detail grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-4 mt-5 pt-5 border-t border-ink-100">
            {[
              { label: 'Drawing type', value: selectedDrawing.drawingType },
              { label: 'Role', value: selectedDrawing.role },
              { label: 'Block', value: selectedDrawing.block },
              { label: 'Zone', value: selectedDrawing.zone },
              { label: 'Sequence', value: selectedDrawing.sequence },
              { label: 'Current rev', value: currentRev?.revision },
            ].map((item) => (
              <div key={item.label}>
                <p className="text-[11px] text-ink-400">{item.label}</p>
                <p className="text-[13px] text-ink-900 font-medium mt-0.5">{item.value || '--'}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Add Revision Form */}
        {showAddRevision && (
          <form onSubmit={handleAddRevision} className="bg-white rounded-xl border-2 border-accent-200 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-[14px] font-semibold text-ink-900">New Revision</h3>
              <button type="button" onClick={resetRevisionForm} className="text-ink-400 hover:text-ink-600 transition-colors"><X className="w-4 h-4" /></button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className={labelClass}>Revision Code <span className="text-red-400">*</span></label>
                <input type="text" value={revCode} onChange={(e) => setRevCode(e.target.value)} placeholder="e.g. P02, C01" className={inputClass} required autoFocus maxLength={20} />
              </div>
              <div>
                <label className={labelClass}>Status</label>
                <select value={revStatus} onChange={(e) => setRevStatus(e.target.value as DrawingStatusType)} className={selectClass}>
                  {Object.entries(STATUS_META).filter(([k]) => k !== 'SUPERSEDED').map(([k, v]) => (
                    <option key={k} value={k}>{v.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>Suitability</label>
                <select value={revSuitability} onChange={(e) => setRevSuitability(e.target.value)} className={selectClass}>
                  <option value="">-- Select --</option>
                  {Object.entries(SUITABILITY_CODES).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className={labelClass}>Description</label>
              <textarea value={revDescription} onChange={(e) => setRevDescription(e.target.value)} placeholder="What changed in this revision..." className={cn(inputClass, 'min-h-[60px]')} maxLength={2000} />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className={labelClass}>Purpose of Issue</label>
                <select value={revPurpose} onChange={(e) => setRevPurpose(e.target.value)} className={selectClass}>
                  <option value="">-- Select --</option>
                  {PURPOSE_OPTIONS.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label className={labelClass}>Author</label>
                <input type="text" value={revAuthor} onChange={(e) => setRevAuthor(e.target.value)} placeholder="Author name" className={inputClass} maxLength={200} />
              </div>
              <div>
                <label className={labelClass}>Checker</label>
                <input type="text" value={revChecker} onChange={(e) => setRevChecker(e.target.value)} placeholder="Checker name" className={inputClass} maxLength={200} />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className={labelClass}>Approver</label>
                <input type="text" value={revApprover} onChange={(e) => setRevApprover(e.target.value)} placeholder="Approver name" className={inputClass} maxLength={200} />
              </div>
              <div>
                <label className={labelClass}>Transmittal Ref</label>
                <input type="text" value={revTransmittal} onChange={(e) => setRevTransmittal(e.target.value)} placeholder="e.g. TR-001" className={inputClass} maxLength={100} />
              </div>
            </div>

            <div>
              <label className={labelClass}>Comments</label>
              <textarea value={revComments} onChange={(e) => setRevComments(e.target.value)} placeholder="Additional notes..." className={cn(inputClass, 'min-h-[60px]')} maxLength={5000} />
            </div>

            {addRevisionError && <p className="text-[12px] text-red-600 bg-red-50 px-3 py-2 rounded-lg">{addRevisionError}</p>}

            <div className="flex items-center justify-end gap-2 pt-1">
              <button type="button" onClick={resetRevisionForm} className="px-3.5 py-2 text-[12px] font-medium text-ink-500 hover:text-ink-700 transition-colors" disabled={addingRevision}>Cancel</button>
              <button type="submit" disabled={addingRevision || !revCode.trim()}
                className={cn('flex items-center gap-1.5 px-4 py-2 rounded-lg text-[12px] font-medium transition-colors',
                  addingRevision || !revCode.trim() ? 'bg-ink-200 text-ink-400 cursor-not-allowed' : 'bg-ink-900 text-white hover:bg-ink-800')}>
                {addingRevision && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Add revision
              </button>
            </div>
          </form>
        )}

        {/* Revision history */}
        <div className="bg-white rounded-xl border border-ink-100">
          <div className="px-5 py-3 border-b border-ink-100">
            <h3 className="text-[13px] font-semibold text-ink-900">Revision History</h3>
          </div>

          {loadingRevisions ? (
            <div className="divide-y divide-ink-50">
              {Array.from({ length: 3 }).map((_, i) => <SkeletonRow key={i} />)}
            </div>
          ) : selectedDrawingRevisions.length === 0 ? (
            <div className="p-8 text-center">
              <Clock className="w-8 h-8 text-ink-200 mx-auto mb-2" />
              <p className="text-[13px] text-ink-400">No revisions yet</p>
            </div>
          ) : (
            <>
              <div className="hidden sm:grid grid-cols-12 gap-2 px-5 py-2.5 bg-surface-50 border-b border-ink-100 text-[11px] font-semibold text-ink-400 uppercase tracking-wide">
                <div className="col-span-1">Rev</div>
                <div className="col-span-3">Description</div>
                <div className="col-span-1">Status</div>
                <div className="col-span-1">Suit.</div>
                <div className="col-span-2">Purpose</div>
                <div className="col-span-1">Author</div>
                <div className="col-span-1">Transmittal</div>
                <div className="col-span-2">Date</div>
              </div>
              <div className="divide-y divide-ink-50">
                {selectedDrawingRevisions.map((rev) => (
                  <div key={rev.id} className={cn(
                    'grid sm:grid-cols-12 gap-2 px-5 py-3 items-center text-[13px]',
                    rev.superseded ? 'bg-ink-25 opacity-60' : 'hover:bg-surface-50',
                  )}>
                    <div className="sm:col-span-1">
                      <span className={cn(
                        'font-mono text-[12px] font-medium px-1.5 py-0.5 rounded',
                        rev.superseded ? 'text-ink-400 bg-ink-50' : 'text-ink-900 bg-accent-50',
                      )}>
                        {rev.revision}
                      </span>
                    </div>
                    <div className="sm:col-span-3 text-ink-700 truncate">{rev.description || '--'}</div>
                    <div className="sm:col-span-1"><StatusBadge status={rev.status} /></div>
                    <div className="sm:col-span-1 text-[11px] text-ink-500">{rev.suitability || '--'}</div>
                    <div className="sm:col-span-2 text-[11px] text-ink-500 truncate">{rev.purposeOfIssue || '--'}</div>
                    <div className="sm:col-span-1 text-[11px] text-ink-500 truncate">{rev.author || '--'}</div>
                    <div className="sm:col-span-1 text-[11px] text-ink-500 truncate">{rev.transmittalRef || '--'}</div>
                    <div className="sm:col-span-2 text-[11px] text-ink-400">{formatDate(rev.createdAt)}</div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    )
  }

  /* ══════════════════════════════════════════════════════
     Main Render
     ══════════════════════════════════════════════════════ */

  return (
    <div className="space-y-5">
      {/* ── Header ─────────────────────────────────────── */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-[18px] font-semibold text-ink-900">Drawing Register</h2>
          <p className="text-[12px] text-ink-400 mt-0.5">
            Drawing issue register, revision tracking and transmittals
          </p>
        </div>
        {activeTab === 'register' && !showCreateDrawing && (
          <button
            onClick={() => setShowCreateDrawing(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-ink-900 text-white text-[12px] font-medium hover:bg-ink-800 transition-colors"
          >
            <Plus className="w-4 h-4" />
            New drawing
          </button>
        )}
      </div>

      {/* ── Tab bar ────────────────────────────────────── */}
      <div className="flex gap-1 overflow-x-auto pb-1">
        {TABS.map((t) => {
          const Icon = t.icon
          return (
            <button
              key={t.key}
              onClick={() => { resetDrawingForm(); setActiveTab(t.key) }}
              className={cn(
                'flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[12px] font-medium transition-colors shrink-0',
                activeTab === t.key ? 'bg-ink-900 text-white' : 'bg-ink-50 text-ink-500 hover:bg-ink-100',
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              {t.label}
            </button>
          )
        })}
      </div>

      {/* ══════════════════════════════════════════════════
         TAB: Register
         ══════════════════════════════════════════════════ */}
      {activeTab === 'register' && (
        <div className="space-y-4">
          {/* Create Drawing Form */}
          {showCreateDrawing && (
            <form onSubmit={handleCreateDrawing} className="bg-white rounded-xl border-2 border-accent-200 p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-[14px] font-semibold text-ink-900">New Drawing</h3>
                <button type="button" onClick={resetDrawingForm} className="text-ink-400 hover:text-ink-600 transition-colors"><X className="w-4 h-4" /></button>
              </div>

              {/* Row 1: Number + Title */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div>
                  <label className={labelClass}>Drawing Number <span className="text-red-400">*</span></label>
                  <input type="text" value={dwgNumber} onChange={(e) => setDwgNumber(e.target.value)} placeholder="e.g. ALC-ARC-ZZ-00-DR-A-0001" className={inputClass} required autoFocus maxLength={100} />
                </div>
                <div className="sm:col-span-3">
                  <label className={labelClass}>Title <span className="text-red-400">*</span></label>
                  <input type="text" value={dwgTitle} onChange={(e) => setDwgTitle(e.target.value)} placeholder="e.g. Ground Floor Plan - Block A" className={inputClass} required maxLength={500} />
                </div>
              </div>

              {/* Row 2: Discipline, Type, Originator */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className={labelClass}>Discipline</label>
                  <select value={dwgDiscipline} onChange={(e) => setDwgDiscipline(e.target.value)} className={selectClass}>
                    <option value="">-- Select --</option>
                    {DISCIPLINES.map((d) => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Drawing Type</label>
                  <select value={dwgType} onChange={(e) => setDwgType(e.target.value)} className={selectClass}>
                    <option value="">-- Select --</option>
                    {DRAWING_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Originator</label>
                  <input type="text" value={dwgOriginator} onChange={(e) => setDwgOriginator(e.target.value)} placeholder="e.g. CWA Homes" className={inputClass} maxLength={200} />
                </div>
              </div>

              {/* Row 3: Building, Level, Zone, Role */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div>
                  <label className={labelClass}>Building</label>
                  <input type="text" value={dwgBuilding} onChange={(e) => setDwgBuilding(e.target.value)} placeholder="e.g. Block A" className={inputClass} maxLength={100} />
                </div>
                <div>
                  <label className={labelClass}>Level</label>
                  <input type="text" value={dwgLevel} onChange={(e) => setDwgLevel(e.target.value)} placeholder="e.g. 00, 01, R1" className={inputClass} maxLength={100} />
                </div>
                <div>
                  <label className={labelClass}>Zone</label>
                  <input type="text" value={dwgZone} onChange={(e) => setDwgZone(e.target.value)} placeholder="e.g. Zone 1" className={inputClass} maxLength={100} />
                </div>
                <div>
                  <label className={labelClass}>Role Code</label>
                  <input type="text" value={dwgRole} onChange={(e) => setDwgRole(e.target.value)} placeholder="e.g. A, S, M" className={inputClass} maxLength={50} />
                </div>
              </div>

              {/* Row 4: External Link */}
              <div>
                <label className={labelClass}>External Link (BIM / Model)</label>
                <input type="url" value={dwgExternalLink} onChange={(e) => setDwgExternalLink(e.target.value)} placeholder="https://..." className={inputClass} maxLength={2000} />
              </div>

              {/* Divider — Initial Revision */}
              <div className="border-t border-ink-100 pt-4">
                <h4 className="text-[12px] font-semibold text-ink-700 mb-3">Initial Revision</h4>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                  <div>
                    <label className={labelClass}>Revision Code</label>
                    <input type="text" value={dwgInitialRev} onChange={(e) => setDwgInitialRev(e.target.value)} placeholder="P01" className={inputClass} maxLength={20} />
                  </div>
                  <div>
                    <label className={labelClass}>Status</label>
                    <select value={dwgRevStatus} onChange={(e) => setDwgRevStatus(e.target.value as DrawingStatusType)} className={selectClass}>
                      {Object.entries(STATUS_META).filter(([k]) => k !== 'SUPERSEDED').map(([k, v]) => (
                        <option key={k} value={k}>{v.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>Suitability</label>
                    <select value={dwgSuitability} onChange={(e) => setDwgSuitability(e.target.value)} className={selectClass}>
                      <option value="">-- Select --</option>
                      {Object.entries(SUITABILITY_CODES).map(([k, v]) => (
                        <option key={k} value={k}>{v}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>Purpose of Issue</label>
                    <select value={dwgPurpose} onChange={(e) => setDwgPurpose(e.target.value)} className={selectClass}>
                      <option value="">-- Select --</option>
                      {PURPOSE_OPTIONS.map((p) => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3">
                  <div>
                    <label className={labelClass}>Description</label>
                    <input type="text" value={dwgRevDescription} onChange={(e) => setDwgRevDescription(e.target.value)} placeholder="Initial issue" className={inputClass} maxLength={2000} />
                  </div>
                  <div>
                    <label className={labelClass}>Author</label>
                    <input type="text" value={dwgAuthor} onChange={(e) => setDwgAuthor(e.target.value)} placeholder="Author name" className={inputClass} maxLength={200} />
                  </div>
                </div>
              </div>

              {createDrawingError && <p className="text-[12px] text-red-600 bg-red-50 px-3 py-2 rounded-lg">{createDrawingError}</p>}

              <div className="flex items-center justify-end gap-2 pt-1">
                <button type="button" onClick={resetDrawingForm} className="px-3.5 py-2 text-[12px] font-medium text-ink-500 hover:text-ink-700 transition-colors" disabled={creatingDrawing}>Cancel</button>
                <button type="submit" disabled={creatingDrawing || !dwgNumber.trim() || !dwgTitle.trim()}
                  className={cn('flex items-center gap-1.5 px-4 py-2 rounded-lg text-[12px] font-medium transition-colors',
                    creatingDrawing || !dwgNumber.trim() || !dwgTitle.trim() ? 'bg-ink-200 text-ink-400 cursor-not-allowed' : 'bg-ink-900 text-white hover:bg-ink-800')}>
                  {creatingDrawing && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Create drawing
                </button>
              </div>
            </form>
          )}

          {/* Filters */}
          <div className="flex items-center gap-3 flex-wrap">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-300" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search drawings..."
                className="w-full pl-9 pr-3 py-2 text-[13px] border border-ink-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-300 focus:border-accent-400 placeholder:text-ink-300"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-300 hover:text-ink-500">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Filter toggle */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12px] font-medium transition-colors',
                showFilters || disciplineFilter !== 'ALL' || statusFilter !== 'ALL'
                  ? 'bg-accent-50 text-accent-700 border border-accent-200'
                  : 'bg-ink-50 text-ink-500 hover:bg-ink-100',
              )}
            >
              <Filter className="w-3.5 h-3.5" />
              Filters
              {(disciplineFilter !== 'ALL' || statusFilter !== 'ALL') && (
                <span className="ml-1 w-4 h-4 rounded-full bg-accent-600 text-white text-[10px] flex items-center justify-center">
                  {(disciplineFilter !== 'ALL' ? 1 : 0) + (statusFilter !== 'ALL' ? 1 : 0)}
                </span>
              )}
            </button>

            {/* Refresh */}
            <button
              onClick={refreshData}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12px] font-medium text-ink-500 bg-ink-50 hover:bg-ink-100 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>

            {/* Drawing count */}
            <span className="text-[11px] text-ink-400 ml-auto">
              {drawings.length} drawing{drawings.length !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Filter dropdowns */}
          {showFilters && (
            <div className="flex items-center gap-4 flex-wrap bg-surface-50 rounded-lg p-3">
              <div>
                <label className="text-[11px] font-medium text-ink-400 block mb-1">Discipline</label>
                <select
                  value={disciplineFilter}
                  onChange={(e) => setDisciplineFilter(e.target.value)}
                  className="text-[12px] text-ink-600 bg-white border border-ink-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-accent-300"
                >
                  <option value="ALL">All disciplines</option>
                  {DISCIPLINES.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[11px] font-medium text-ink-400 block mb-1">Status</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="text-[12px] text-ink-600 bg-white border border-ink-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-accent-300"
                >
                  <option value="ALL">All statuses</option>
                  {Object.entries(STATUS_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>
              {(disciplineFilter !== 'ALL' || statusFilter !== 'ALL') && (
                <button
                  onClick={() => { setDisciplineFilter('ALL'); setStatusFilter('ALL') }}
                  className="text-[11px] text-red-600 hover:text-red-800 font-medium mt-4"
                >
                  Clear filters
                </button>
              )}
            </div>
          )}

          {/* Drawing List */}
          {drawings.length === 0 ? (
            <div className="bg-white rounded-xl border border-ink-100 p-10 text-center">
              <Layers className="w-10 h-10 text-ink-200 mx-auto mb-3" />
              <p className="text-[14px] font-medium text-ink-600">No drawings found</p>
              <p className="text-[12px] text-ink-400 mt-1">
                {searchQuery || disciplineFilter !== 'ALL' || statusFilter !== 'ALL'
                  ? 'Try adjusting the search or filters.'
                  : 'Create your first drawing to start building the register.'}
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-ink-100 overflow-hidden">
              {/* Table header */}
              <div className="hidden lg:grid grid-cols-12 gap-2 px-5 py-2.5 bg-surface-50 border-b border-ink-100 text-[11px] font-semibold text-ink-400 uppercase tracking-wide">
                <div className="col-span-1"></div>
                <div className="col-span-2">Number</div>
                <div className="col-span-3">Title</div>
                <div className="col-span-1">Discipline</div>
                <div className="col-span-1">Type</div>
                <div className="col-span-1">Rev</div>
                <div className="col-span-1">Status</div>
                <div className="col-span-2">Date</div>
              </div>

              <div className="divide-y divide-ink-50">
                {drawings.map((drawing) => {
                  const currentRev = getCurrentRevision(drawing)
                  const isExpanded = expandedRows.has(drawing.id)

                  return (
                    <div key={drawing.id}>
                      {/* Main row */}
                      <div className="grid lg:grid-cols-12 gap-2 px-5 py-3 hover:bg-surface-50 transition-colors items-center">
                        {/* Expand toggle */}
                        <div className="lg:col-span-1">
                          <button
                            onClick={() => toggleRow(drawing.id)}
                            className="p-1 rounded hover:bg-ink-100 transition-colors"
                          >
                            <ChevronDown className={cn('w-4 h-4 text-ink-400 transition-transform', isExpanded && 'rotate-180')} />
                          </button>
                        </div>

                        {/* Number */}
                        <div className="lg:col-span-2">
                          <button
                            onClick={() => viewDrawingDetail(drawing)}
                            className="text-[12px] font-mono font-medium text-accent-700 hover:text-accent-900 hover:underline transition-colors"
                          >
                            {drawing.drawingNumber}
                          </button>
                        </div>

                        {/* Title */}
                        <div className="lg:col-span-3">
                          <button
                            onClick={() => viewDrawingDetail(drawing)}
                            className="text-[13px] text-ink-900 font-medium truncate text-left hover:text-accent-700 transition-colors"
                          >
                            {drawing.title}
                          </button>
                          {drawing.originator && (
                            <p className="text-[11px] text-ink-400 mt-0.5">{drawing.originator}</p>
                          )}
                        </div>

                        {/* Discipline */}
                        <div className="lg:col-span-1">
                          <span className="text-[11px] text-ink-600">{drawing.discipline || '--'}</span>
                        </div>

                        {/* Type */}
                        <div className="lg:col-span-1">
                          <span className="text-[11px] text-ink-500">{drawing.drawingType || '--'}</span>
                        </div>

                        {/* Rev */}
                        <div className="lg:col-span-1">
                          {currentRev ? (
                            <span className="font-mono text-[12px] font-medium text-ink-900 bg-accent-50 px-1.5 py-0.5 rounded">
                              {currentRev.revision}
                            </span>
                          ) : (
                            <span className="text-[11px] text-ink-400">--</span>
                          )}
                        </div>

                        {/* Status */}
                        <div className="lg:col-span-1">
                          {currentRev ? (
                            <StatusBadge status={currentRev.status} />
                          ) : (
                            <span className="text-[11px] text-ink-400">--</span>
                          )}
                        </div>

                        {/* Date */}
                        <div className="lg:col-span-2 flex items-center gap-2">
                          <span className="text-[11px] text-ink-400">{formatDate(drawing.updatedAt)}</span>
                          {drawing.externalLink && (
                            <a
                              href={drawing.externalLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-500 hover:text-blue-700"
                              title="Open external link"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          )}
                        </div>
                      </div>

                      {/* Expanded details */}
                      {isExpanded && (
                        <div className="px-5 py-4 bg-surface-50 border-t border-ink-100">
                          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 mb-4">
                            {[
                              { label: 'Building', value: drawing.building },
                              { label: 'Block', value: drawing.block },
                              { label: 'Level', value: drawing.level },
                              { label: 'Zone', value: drawing.zone },
                              { label: 'Role', value: drawing.role },
                              { label: 'Sequence', value: drawing.sequence },
                            ].map((item) => (
                              <div key={item.label}>
                                <p className="text-[10px] text-ink-400 uppercase tracking-wide">{item.label}</p>
                                <p className="text-[12px] text-ink-700 mt-0.5">{item.value || '--'}</p>
                              </div>
                            ))}
                          </div>

                          {/* Inline revision list */}
                          {drawing.revisions && drawing.revisions.length > 0 && (
                            <div>
                              <p className="text-[11px] font-semibold text-ink-500 mb-2">Recent Revisions</p>
                              <div className="space-y-1">
                                {drawing.revisions.slice(0, 3).map((rev) => (
                                  <div key={rev.id} className="flex items-center gap-3 text-[12px]">
                                    <span className={cn(
                                      'font-mono font-medium px-1.5 py-0.5 rounded',
                                      rev.superseded ? 'text-ink-400 bg-ink-50 line-through' : 'text-ink-900 bg-accent-50',
                                    )}>
                                      {rev.revision}
                                    </span>
                                    <StatusBadge status={rev.status} />
                                    <span className="text-ink-500 truncate flex-1">{rev.description || 'No description'}</span>
                                    <span className="text-ink-400 shrink-0">{formatShortDate(rev.createdAt)}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          <div className="flex items-center gap-2 mt-3">
                            <button
                              onClick={() => viewDrawingDetail(drawing)}
                              className="flex items-center gap-1 px-3 py-1.5 text-[11px] font-medium text-accent-700 bg-accent-50 rounded-lg hover:bg-accent-100 transition-colors"
                            >
                              <Eye className="w-3 h-3" /> View details
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════
         TAB: Revisions
         ══════════════════════════════════════════════════ */}
      {activeTab === 'revisions' && (
        <div className="space-y-4">
          {allRevisions.length === 0 ? (
            <div className="bg-white rounded-xl border border-ink-100 p-10 text-center">
              <Clock className="w-10 h-10 text-ink-200 mx-auto mb-3" />
              <p className="text-[14px] font-medium text-ink-600">No revisions yet</p>
              <p className="text-[12px] text-ink-400 mt-1">Revisions will appear here as drawings are updated.</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-ink-100 overflow-hidden">
              <div className="hidden sm:grid grid-cols-12 gap-2 px-5 py-2.5 bg-surface-50 border-b border-ink-100 text-[11px] font-semibold text-ink-400 uppercase tracking-wide">
                <div className="col-span-2">Drawing</div>
                <div className="col-span-1">Rev</div>
                <div className="col-span-3">Title / Description</div>
                <div className="col-span-1">Status</div>
                <div className="col-span-1">Suit.</div>
                <div className="col-span-2">Purpose</div>
                <div className="col-span-2">Date</div>
              </div>
              <div className="divide-y divide-ink-50">
                {allRevisions.map((rev) => (
                  <div key={rev.id} className={cn(
                    'grid sm:grid-cols-12 gap-2 px-5 py-3 items-center text-[13px]',
                    rev.superseded ? 'opacity-50' : 'hover:bg-surface-50',
                  )}>
                    <div className="sm:col-span-2">
                      <span className="text-[12px] font-mono text-accent-700">{rev.drawingNumber}</span>
                    </div>
                    <div className="sm:col-span-1">
                      <span className={cn(
                        'font-mono text-[12px] font-medium px-1.5 py-0.5 rounded',
                        rev.superseded ? 'text-ink-400 bg-ink-50' : 'text-ink-900 bg-accent-50',
                      )}>
                        {rev.revision}
                      </span>
                    </div>
                    <div className="sm:col-span-3 min-w-0">
                      <p className="text-[12px] text-ink-700 truncate">{rev.drawingTitle}</p>
                      {rev.description && <p className="text-[11px] text-ink-400 truncate">{rev.description}</p>}
                    </div>
                    <div className="sm:col-span-1"><StatusBadge status={rev.status} /></div>
                    <div className="sm:col-span-1 text-[11px] text-ink-500">{rev.suitability || '--'}</div>
                    <div className="sm:col-span-2 text-[11px] text-ink-500 truncate">{rev.purposeOfIssue || '--'}</div>
                    <div className="sm:col-span-2 text-[11px] text-ink-400">{formatDate(rev.createdAt)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════
         TAB: Transmittals
         ══════════════════════════════════════════════════ */}
      {activeTab === 'transmittals' && (
        <div className="space-y-4">
          {(() => {
            // Build transmittal groups from revisions that have a transmittalRef
            const transmittalMap = new Map<string, (DrawingRevision & { drawingNumber?: string; drawingTitle?: string })[]>()
            for (const d of drawings) {
              for (const r of d.revisions) {
                if (r.transmittalRef) {
                  const existing = transmittalMap.get(r.transmittalRef) || []
                  existing.push({ ...r, drawingNumber: d.drawingNumber, drawingTitle: d.title })
                  transmittalMap.set(r.transmittalRef, existing)
                }
              }
            }

            if (transmittalMap.size === 0) {
              return (
                <div className="bg-white rounded-xl border border-ink-100 p-10 text-center">
                  <FileText className="w-10 h-10 text-ink-200 mx-auto mb-3" />
                  <p className="text-[14px] font-medium text-ink-600">No transmittals yet</p>
                  <p className="text-[12px] text-ink-400 mt-1">
                    Transmittals are created when revisions include a transmittal reference.
                  </p>
                </div>
              )
            }

            const entries = Array.from(transmittalMap.entries()).sort((a, b) => a[0].localeCompare(b[0]))

            return (
              <div className="space-y-4">
                {entries.map(([ref, revisions]) => (
                  <div key={ref} className="bg-white rounded-xl border border-ink-100">
                    <div className="px-5 py-3 border-b border-ink-100 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-[13px] font-semibold text-ink-900">{ref}</span>
                        <span className="text-[11px] text-ink-400">{revisions.length} drawing{revisions.length !== 1 ? 's' : ''}</span>
                      </div>
                      <span className="text-[11px] text-ink-400">
                        {formatDate(revisions[0]?.createdAt ?? new Date().toISOString())}
                      </span>
                    </div>
                    <div className="divide-y divide-ink-50">
                      {revisions.map((rev) => (
                        <div key={rev.id} className="flex items-center gap-4 px-5 py-3 text-[13px]">
                          <span className="text-[12px] font-mono text-accent-700 shrink-0 w-40 truncate">{rev.drawingNumber}</span>
                          <span className="font-mono text-[12px] font-medium text-ink-900 bg-accent-50 px-1.5 py-0.5 rounded shrink-0">{rev.revision}</span>
                          <span className="text-ink-700 truncate flex-1">{rev.drawingTitle}</span>
                          <StatusBadge status={rev.status} />
                          <span className="text-[11px] text-ink-400 shrink-0">{rev.purposeOfIssue || '--'}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )
          })()}
        </div>
      )}
    </div>
  )
}

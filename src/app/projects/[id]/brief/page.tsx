'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import {
  ChevronDown, ChevronRight, FileText, CheckCircle2,
  Clock, Edit3, Save, Loader2, AlertTriangle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useApiFetch } from '@/hooks/use-api'
import { ProgressBar } from '@/components/ProgressBar'

/* ── Types ─────────────────────────────────────────────── */

type SectionStatus = 'not_started' | 'draft' | 'complete' | 'approved'

interface BriefSectionData {
  content: string
  status: SectionStatus
  lastUpdated: string | null
  approvedBy: string
}

interface BriefData {
  [sectionKey: string]: BriefSectionData
}

interface ProjectDetail {
  id: string
  name: string
  code: string
}

/* ── Constants ─────────────────────────────────────────── */

const BRIEF_SECTIONS = [
  { key: 'client_requirements', label: 'Client Requirements', description: 'Core client needs, expectations, and deliverables' },
  { key: 'site_information', label: 'Site Information', description: 'Site surveys, constraints, access, and environmental data' },
  { key: 'design_intent', label: 'Design Intent', description: 'Architectural vision, spatial strategy, and design principles' },
  { key: 'budget', label: 'Budget', description: 'Cost plan, allowances, contingencies, and value engineering targets' },
  { key: 'programme', label: 'Programme', description: 'Key milestones, phasing, and delivery timeline' },
  { key: 'sustainability', label: 'Sustainability', description: 'Environmental targets, BREEAM, energy strategy, and net zero pathway' },
  { key: 'operator_requirements', label: 'Operator Requirements', description: 'Operational needs, maintenance access, and FM requirements' },
  { key: 'planning_context', label: 'Planning Context', description: 'Planning history, policy context, pre-app advice, and constraints' },
] as const

const STATUS_OPTIONS: { value: SectionStatus; label: string }[] = [
  { value: 'not_started', label: 'Not Started' },
  { value: 'draft', label: 'Draft' },
  { value: 'complete', label: 'Complete' },
  { value: 'approved', label: 'Approved' },
]

const STATUS_META: Record<SectionStatus, { label: string; badge: string; icon: typeof FileText }> = {
  not_started: { label: 'Not Started', badge: 'bg-slate-100 text-slate-500', icon: FileText },
  draft: { label: 'Draft', badge: 'bg-amber-50 text-amber-600', icon: Edit3 },
  complete: { label: 'Complete', badge: 'bg-blue-50 text-blue-600', icon: CheckCircle2 },
  approved: { label: 'Approved', badge: 'bg-emerald-50 text-emerald-600', icon: CheckCircle2 },
}

/* ── Helpers ───────────────────────────────────────────── */

function createEmptySection(): BriefSectionData {
  return {
    content: '',
    status: 'not_started',
    lastUpdated: null,
    approvedBy: '',
  }
}

function createEmptyBrief(): BriefData {
  const data: BriefData = {}
  BRIEF_SECTIONS.forEach(s => {
    data[s.key] = createEmptySection()
  })
  return data
}

function getStorageKey(projectId: string): string {
  return `coordin_brief_${projectId}`
}

function loadBrief(projectId: string): BriefData {
  if (typeof window === 'undefined') return createEmptyBrief()
  try {
    const raw = localStorage.getItem(getStorageKey(projectId))
    if (!raw) return createEmptyBrief()
    const parsed = JSON.parse(raw) as BriefData
    // Ensure all sections exist (handles adding new sections later)
    const merged = createEmptyBrief()
    Object.keys(merged).forEach(key => {
      if (parsed[key]) merged[key] = parsed[key]
    })
    return merged
  } catch {
    return createEmptyBrief()
  }
}

function saveBrief(projectId: string, data: BriefData): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(getStorageKey(projectId), JSON.stringify(data))
}

function formatDate(iso: string | null): string {
  if (!iso) return 'Never'
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/* ── Summary Stats ─────────────────────────────────────── */

function computeStats(data: BriefData) {
  const total = BRIEF_SECTIONS.length
  let notStarted = 0
  let draft = 0
  let complete = 0
  let approved = 0

  BRIEF_SECTIONS.forEach(s => {
    const status = data[s.key]?.status ?? 'not_started'
    if (status === 'not_started') notStarted++
    else if (status === 'draft') draft++
    else if (status === 'complete') complete++
    else if (status === 'approved') approved++
  })

  const progress = total > 0 ? Math.round(((complete + approved) / total) * 100) : 0

  return { total, notStarted, draft, complete, approved, progress }
}

/* ── Section Card ──────────────────────────────────────── */

interface SectionCardProps {
  sectionKey: string
  label: string
  description: string
  data: BriefSectionData
  expanded: boolean
  onToggle: () => void
  onSave: (key: string, content: string, status: SectionStatus, approvedBy: string) => void
  saving: string | null
}

function SectionCard({
  sectionKey, label, description, data, expanded, onToggle, onSave, saving,
}: SectionCardProps) {
  const [localContent, setLocalContent] = useState(data.content)
  const [localStatus, setLocalStatus] = useState<SectionStatus>(data.status)
  const [localApprovedBy, setLocalApprovedBy] = useState(data.approvedBy)

  // Sync from parent when data changes (e.g. on load)
  useEffect(() => {
    setLocalContent(data.content)
    setLocalStatus(data.status)
    setLocalApprovedBy(data.approvedBy)
  }, [data.content, data.status, data.approvedBy])

  const meta = STATUS_META[data.status]
  const StatusIcon = meta.icon
  const isSaving = saving === sectionKey
  const hasChanges =
    localContent !== data.content ||
    localStatus !== data.status ||
    localApprovedBy !== data.approvedBy

  return (
    <div className="bg-white rounded-2xl border border-surface-200 shadow-card overflow-hidden">
      {/* Header — always visible */}
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-surface-50/50 transition-colors"
      >
        <div className="text-ink-400">
          {expanded
            ? <ChevronDown className="w-4 h-4" />
            : <ChevronRight className="w-4 h-4" />
          }
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <StatusIcon className={cn('w-3.5 h-3.5 shrink-0', meta.badge.split(' ')[1])} />
            <span className="text-[15px] font-semibold text-ink-900 truncate">{label}</span>
          </div>
          {!expanded && (
            <p className="text-[12px] text-ink-400 mt-0.5 truncate">{description}</p>
          )}
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {data.lastUpdated && (
            <span className="hidden sm:flex items-center gap-1 text-[10px] text-ink-400">
              <Clock className="w-3 h-3" />
              {formatDate(data.lastUpdated)}
            </span>
          )}
          <span className={cn(
            'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium',
            meta.badge,
          )}>
            {meta.label}
          </span>
        </div>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="border-t border-surface-200 px-4 py-4 space-y-4">
          <p className="text-[12px] text-ink-500">{description}</p>

          {/* Content textarea */}
          <div>
            <label className="block text-[12px] font-medium text-ink-600 mb-1.5">
              Section Content
            </label>
            <textarea
              value={localContent}
              onChange={e => setLocalContent(e.target.value)}
              placeholder={`Enter ${label.toLowerCase()} details...`}
              rows={6}
              className={cn(
                'w-full rounded-xl border border-surface-200 bg-surface-50/50 px-3 py-2.5',
                'text-[13px] text-ink-800 placeholder:text-ink-300',
                'focus:outline-none focus:ring-2 focus:ring-accent-200 focus:border-accent-400',
                'resize-y transition-colors',
              )}
            />
          </div>

          {/* Status + Approved By row */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <label className="block text-[12px] font-medium text-ink-600 mb-1.5">
                Status
              </label>
              <select
                value={localStatus}
                onChange={e => setLocalStatus(e.target.value as SectionStatus)}
                className={cn(
                  'w-full rounded-xl border border-surface-200 bg-white px-3 py-2',
                  'text-[13px] text-ink-800',
                  'focus:outline-none focus:ring-2 focus:ring-accent-200 focus:border-accent-400',
                  'transition-colors',
                )}
              >
                {STATUS_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            <div className="flex-1">
              <label className="block text-[12px] font-medium text-ink-600 mb-1.5">
                Approved By
              </label>
              <input
                type="text"
                value={localApprovedBy}
                onChange={e => setLocalApprovedBy(e.target.value)}
                placeholder="Name of approver"
                className={cn(
                  'w-full rounded-xl border border-surface-200 bg-white px-3 py-2',
                  'text-[13px] text-ink-800 placeholder:text-ink-300',
                  'focus:outline-none focus:ring-2 focus:ring-accent-200 focus:border-accent-400',
                  'transition-colors',
                )}
              />
            </div>
          </div>

          {/* Last updated + Save */}
          <div className="flex items-center justify-between pt-1">
            <span className="text-[10px] text-ink-400">
              Last updated: {formatDate(data.lastUpdated)}
            </span>

            <button
              onClick={() => onSave(sectionKey, localContent, localStatus, localApprovedBy)}
              disabled={isSaving || !hasChanges}
              className={cn(
                'inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-[12px] font-medium',
                'transition-all duration-200',
                hasChanges
                  ? 'bg-accent-500 text-white hover:bg-accent-600 shadow-sm'
                  : 'bg-surface-100 text-ink-300 cursor-not-allowed',
              )}
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  Save
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

/* ── Summary Card ──────────────────────────────────────── */

interface SummaryCardProps {
  label: string
  value: string | number
  icon: typeof FileText
  accent: string
}

function SummaryCard({ label, value, icon: Icon, accent }: SummaryCardProps) {
  return (
    <div className="bg-white rounded-2xl border border-surface-200 shadow-card px-4 py-3.5">
      <div className="flex items-center gap-2.5">
        <div className={cn('p-2 rounded-xl', accent)}>
          <Icon className="w-4 h-4" />
        </div>
        <div>
          <p className="text-[20px] font-bold text-ink-900 leading-tight tabular-nums">{value}</p>
          <p className="text-[11px] text-ink-400 font-medium">{label}</p>
        </div>
      </div>
    </div>
  )
}

/* ── Skeleton loaders ─────────────────────────────────── */

function HeaderSkeleton() {
  return (
    <div className="animate-pulse space-y-2">
      <div className="h-6 w-48 bg-surface-200 rounded-lg" />
      <div className="h-4 w-72 bg-surface-200/60 rounded-lg" />
    </div>
  )
}

function SummarySkeleton() {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="bg-white rounded-2xl border border-surface-200 shadow-card px-4 py-3.5 animate-pulse">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-surface-200 rounded-xl" />
            <div className="space-y-1.5">
              <div className="h-5 w-10 bg-surface-200 rounded" />
              <div className="h-3 w-20 bg-surface-200/60 rounded" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

/* ── Page ──────────────────────────────────────────────── */

export default function ProjectBriefPage() {
  const params = useParams()
  const projectId = params.id as string

  /* Fetch project name from API */
  const { data: project, loading: projectLoading } = useApiFetch<ProjectDetail>(
    `/api/projects/${projectId}`,
  )

  /* Brief data — local state persisted to localStorage */
  const [briefData, setBriefData] = useState<BriefData>(createEmptyBrief)
  const [loaded, setLoaded] = useState(false)
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState<string | null>(null)

  // Load from localStorage on mount
  useEffect(() => {
    if (projectId) {
      setBriefData(loadBrief(projectId))
      setLoaded(true)
    }
  }, [projectId])

  /* Toggle expand/collapse */
  const toggleSection = useCallback((key: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }, [])

  /* Expand / collapse all */
  const expandAll = useCallback(() => {
    setExpandedSections(new Set(BRIEF_SECTIONS.map(s => s.key)))
  }, [])

  const collapseAll = useCallback(() => {
    setExpandedSections(new Set())
  }, [])

  /* Save a single section */
  const handleSave = useCallback((
    key: string,
    content: string,
    status: SectionStatus,
    approvedBy: string,
  ) => {
    setSaving(key)

    // Simulate a brief save delay for UX feedback
    setTimeout(() => {
      setBriefData(prev => {
        const updated: BriefData = {
          ...prev,
          [key]: {
            content,
            status,
            approvedBy,
            lastUpdated: new Date().toISOString(),
          },
        }
        saveBrief(projectId, updated)
        return updated
      })
      setSaving(null)
    }, 400)
  }, [projectId])

  /* Stats */
  const stats = computeStats(briefData)

  return (
    <div className="min-h-screen bg-surface-50 p-4 lg:p-6">
      {/* Header */}
      <div className="mb-6">
        {projectLoading ? (
          <HeaderSkeleton />
        ) : (
          <div>
            <h1 className="text-[15px] font-bold text-ink-900">
              Project Brief {project?.name ? `— ${project.name}` : ''}
            </h1>
            <p className="text-[12px] text-ink-400 mt-0.5">
              Define and track the project brief across {BRIEF_SECTIONS.length} key sections
            </p>
          </div>
        )}
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-2.5 px-4 py-3 rounded-xl bg-amber-50 border border-amber-200/60 mb-5">
        <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
        <p className="text-[12px] text-amber-700">
          Brief data is stored locally. API integration pending.
        </p>
      </div>

      {/* Progress bar */}
      <div className="bg-white rounded-2xl border border-surface-200 shadow-card px-4 py-4 mb-5">
        <ProgressBar
          value={stats.progress}
          label="Overall Brief Completeness"
          showPercent
        />
      </div>

      {/* Summary cards */}
      {!loaded ? (
        <SummarySkeleton />
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          <SummaryCard
            label="Sections Complete"
            value={stats.complete + stats.approved}
            icon={CheckCircle2}
            accent="bg-emerald-50 text-emerald-600"
          />
          <SummaryCard
            label="Sections In Draft"
            value={stats.draft}
            icon={Edit3}
            accent="bg-amber-50 text-amber-600"
          />
          <SummaryCard
            label="Sections Not Started"
            value={stats.notStarted}
            icon={FileText}
            accent="bg-slate-100 text-slate-500"
          />
          <SummaryCard
            label="Overall Progress"
            value={`${stats.progress}%`}
            icon={CheckCircle2}
            accent="bg-blue-50 text-blue-600"
          />
        </div>
      )}

      {/* Expand/Collapse all */}
      <div className="flex items-center justify-end gap-2 mb-3">
        <button
          onClick={expandAll}
          className="text-[11px] font-medium text-accent-500 hover:text-accent-600 transition-colors"
        >
          Expand all
        </button>
        <span className="text-ink-300">|</span>
        <button
          onClick={collapseAll}
          className="text-[11px] font-medium text-accent-500 hover:text-accent-600 transition-colors"
        >
          Collapse all
        </button>
      </div>

      {/* Section cards */}
      <div className="space-y-3">
        {BRIEF_SECTIONS.map(section => (
          <SectionCard
            key={section.key}
            sectionKey={section.key}
            label={section.label}
            description={section.description}
            data={briefData[section.key] ?? createEmptySection()}
            expanded={expandedSections.has(section.key)}
            onToggle={() => toggleSection(section.key)}
            onSave={handleSave}
            saving={saving}
          />
        ))}
      </div>
    </div>
  )
}

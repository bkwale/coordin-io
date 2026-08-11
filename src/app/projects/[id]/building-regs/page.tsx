'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import {
  Plus, Filter, Loader2, X, CheckCircle2, AlertTriangle,
  Shield, Flame, Leaf, FileText, RefreshCw, ChevronDown,
  ChevronRight, ClipboardList, ExternalLink, Clock,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useToast } from '@/components/Toast'
import { useApiMutation } from '@/hooks/use-api'
import { SkeletonRow, SkeletonCard } from '@/components/Skeleton'

/* ── Types ──────────────────────────────────────────────── */

type ComplianceRegisterType =
  | 'BRPD'
  | 'CDM'
  | 'BUILDING_REGS'
  | 'FIRE_SAFETY'
  | 'EDGE'
  | 'BREEAM'
  | 'LEED'

type ComplianceStatus =
  | 'NOT_STARTED'
  | 'IN_PROGRESS'
  | 'EVIDENCE_SUBMITTED'
  | 'UNDER_REVIEW'
  | 'COMPLIANT'
  | 'NON_COMPLIANT'
  | 'ACTION_REQUIRED'
  | 'APPROVED_WITH_CONDITION'
  | 'NOT_APPLICABLE'
  | 'CLOSED'

interface ComplianceRegister {
  id: string
  name: string
  description: string | null
  registerType: ComplianceRegisterType
  overallStatus: ComplianceStatus
  templateVersion: string | null
  createdAt: string
  updatedAt: string
  _count: { items: number }
}

interface ComplianceItem {
  id: string
  registerId: string
  requirement: string
  section: string | null
  source: string | null
  version: string | null
  status: ComplianceStatus
  ownerId: string | null
  owner: string | null
  dueDate: string | null
  evidenceUrl: string | null
  comments: string | null
  createdAt: string
  updatedAt: string
}

interface RegisterFormState {
  name: string
  registerType: ComplianceRegisterType
  description: string
  templateVersion: string
}

interface ItemFormState {
  requirement: string
  section: string
  source: string
  version: string
  ownerId: string
  dueDate: string
  comments: string
}

/* ── Tab configuration ──────────────────────────────────── */

type TabKey = 'brpd' | 'cdm' | 'building-regs' | 'fire-safety' | 'sustainability'

interface TabConfig {
  key: TabKey
  label: string
  icon: typeof Shield
  types: ComplianceRegisterType[]
  description: string
}

const TABS: TabConfig[] = [
  { key: 'brpd', label: 'BRPD', icon: Shield, types: ['BRPD'], description: 'Building Regulations Post-Departure' },
  { key: 'cdm', label: 'CDM', icon: FileText, types: ['CDM'], description: 'Construction Design & Management' },
  { key: 'building-regs', label: 'Building Regs', icon: CheckCircle2, types: ['BUILDING_REGS'], description: 'Building Regulations compliance' },
  { key: 'fire-safety', label: 'Fire Safety', icon: Flame, types: ['FIRE_SAFETY'], description: 'Fire safety regulations & assessments' },
  { key: 'sustainability', label: 'Sustainability', icon: Leaf, types: ['EDGE', 'BREEAM', 'LEED'], description: 'EDGE, BREEAM & LEED certifications' },
]

/* ── Status config ──────────────────────────────────────── */

const STATUS_CONFIG: Record<ComplianceStatus, { label: string; bg: string; text: string; dot: string }> = {
  NOT_STARTED:             { label: 'Not started',       bg: 'bg-gray-100',   text: 'text-gray-600',   dot: 'bg-gray-400' },
  IN_PROGRESS:             { label: 'In progress',       bg: 'bg-blue-50',    text: 'text-blue-700',   dot: 'bg-blue-500' },
  EVIDENCE_SUBMITTED:      { label: 'Evidence submitted', bg: 'bg-yellow-50',  text: 'text-yellow-700', dot: 'bg-yellow-500' },
  UNDER_REVIEW:            { label: 'Under review',      bg: 'bg-purple-50',  text: 'text-purple-700', dot: 'bg-purple-500' },
  COMPLIANT:               { label: 'Compliant',         bg: 'bg-green-50',   text: 'text-green-700',  dot: 'bg-green-500' },
  NON_COMPLIANT:           { label: 'Non-compliant',     bg: 'bg-red-50',     text: 'text-red-700',    dot: 'bg-red-500' },
  ACTION_REQUIRED:         { label: 'Action required',   bg: 'bg-orange-50',  text: 'text-orange-700', dot: 'bg-orange-500' },
  APPROVED_WITH_CONDITION: { label: 'Approved w/ cond.', bg: 'bg-teal-50',    text: 'text-teal-700',   dot: 'bg-teal-500' },
  NOT_APPLICABLE:          { label: 'N/A',               bg: 'bg-slate-50',   text: 'text-slate-500',  dot: 'bg-slate-400' },
  CLOSED:                  { label: 'Closed',            bg: 'bg-gray-50',    text: 'text-gray-500',   dot: 'bg-gray-400' },
}

const REGISTER_TYPE_LABELS: Record<ComplianceRegisterType, string> = {
  BRPD: 'BRPD',
  CDM: 'CDM',
  BUILDING_REGS: 'Building Regs',
  FIRE_SAFETY: 'Fire Safety',
  EDGE: 'EDGE',
  BREEAM: 'BREEAM',
  LEED: 'LEED',
}

/* ── Helpers ────────────────────────────────────────────── */

function formatDate(d: string | null): string {
  if (!d) return '-'
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function StatusBadge({ status }: { status: ComplianceStatus }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.NOT_STARTED
  return (
    <span className={cn('inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium', cfg.bg, cfg.text)}>
      <span className={cn('w-1.5 h-1.5 rounded-full', cfg.dot)} />
      {cfg.label}
    </span>
  )
}

function emptyRegisterForm(type: ComplianceRegisterType): RegisterFormState {
  return { name: '', registerType: type, description: '', templateVersion: '' }
}

const SOURCE_OPTIONS = [
  'CDM 2015',
  'Building Regulations',
  'BS EN Standards',
  'IFC GIIP',
  'RIBA',
  'Fire Safety Order',
  'BREEAM',
  'LEED',
  'EDGE',
  'Other',
]

function emptyItemForm(): ItemFormState {
  return { requirement: '', section: '', source: '', version: '', ownerId: '', dueDate: '', comments: '' }
}

/* ── Page component ─────────────────────────────────────── */

export default function CompliancePage() {
  const { id } = useParams<{ id: string }>()
  const { toast } = useToast()

  /* ── Tab state ─────────────────────────────────────── */
  const [activeTab, setActiveTab] = useState<TabKey>('brpd')
  const activeTabConfig = TABS.find(t => t.key === activeTab)!

  /* ── Register list state ───────────────────────────── */
  const [registers, setRegisters] = useState<ComplianceRegister[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  /* ── Expanded register + items ─────────────────────── */
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [items, setItems] = useState<ComplianceItem[]>([])
  const [itemsLoading, setItemsLoading] = useState(false)

  /* ── Create register form ──────────────────────────── */
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [registerForm, setRegisterForm] = useState<RegisterFormState>(emptyRegisterForm(activeTabConfig.types[0]))

  /* ── Create item form ──────────────────────────────── */
  const [showItemForm, setShowItemForm] = useState<string | null>(null)
  const [itemForm, setItemForm] = useState<ItemFormState>(emptyItemForm())

  /* ── Team members for owner dropdown ─────────────── */
  const [teamMembers, setTeamMembers] = useState<Array<{ id: string; fullName: string }>>([])
  useEffect(() => {
    fetch('/api/settings/team')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.members) setTeamMembers(data.members.map((m: { id: string; fullName: string }) => ({ id: m.id, fullName: m.fullName })))
      })
      .catch(() => {})
  }, [])

  /* ── Mutations ─────────────────────────────────────── */
  const { mutate: createRegister, loading: creatingRegister, error: createRegisterError, clearError: clearRegisterError } =
    useApiMutation<ComplianceRegister>(`/api/projects/${id}/compliance`, 'POST')

  /* ── Fetch registers ───────────────────────────────── */
  const fetchRegisters = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      activeTabConfig.types.forEach(t => params.append('registerType', t))
      const res = await fetch(`/api/projects/${id}/compliance?${params}`)
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error?.message || `Failed to load (${res.status})`)
      }
      const json = await res.json()
      if (json.data) setRegisters(json.data.registers || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }, [id, activeTab]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchRegisters()
  }, [fetchRegisters])

  /* ── Fetch items for expanded register ─────────────── */
  const fetchItems = useCallback(async (registerId: string) => {
    setItemsLoading(true)
    try {
      const res = await fetch(`/api/projects/${id}/compliance/${registerId}/items`)
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error?.message || `Failed to load items (${res.status})`)
      }
      const json = await res.json()
      setItems(json.data?.items || [])
    } catch {
      toast('Failed to load compliance items', 'error')
      setItems([])
    } finally {
      setItemsLoading(false)
    }
  }, [id, toast])

  /* ── Toggle expand ─────────────────────────────────── */
  const toggleExpand = (registerId: string) => {
    if (expandedId === registerId) {
      setExpandedId(null)
      setItems([])
      setShowItemForm(null)
    } else {
      setExpandedId(registerId)
      setShowItemForm(null)
      fetchItems(registerId)
    }
  }

  /* ── Reset on tab change ───────────────────────────── */
  useEffect(() => {
    setExpandedId(null)
    setItems([])
    setShowCreateForm(false)
    setShowItemForm(null)
    setRegisterForm(emptyRegisterForm(activeTabConfig.types[0]))
    setItemForm(emptyItemForm())
    clearRegisterError()
  }, [activeTab]) // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Create register handler ───────────────────────── */
  const handleCreateRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmedName = registerForm.name.trim()
    if (!trimmedName) return

    const body: Record<string, unknown> = {
      name: trimmedName,
      registerType: registerForm.registerType,
    }
    if (registerForm.description.trim()) body.description = registerForm.description.trim()
    if (registerForm.templateVersion.trim()) body.templateVersion = registerForm.templateVersion.trim()

    const result = await createRegister(body)
    if (result) {
      toast('Compliance register created', 'success')
      setShowCreateForm(false)
      setRegisterForm(emptyRegisterForm(activeTabConfig.types[0]))
      clearRegisterError()
      fetchRegisters()
    } else {
      toast(createRegisterError || 'Failed to create register', 'error')
    }
  }

  const cancelCreateRegister = () => {
    setShowCreateForm(false)
    setRegisterForm(emptyRegisterForm(activeTabConfig.types[0]))
    clearRegisterError()
  }

  /* ── Create item handler ───────────────────────────── */
  const handleCreateItem = async (e: React.FormEvent, registerId: string) => {
    e.preventDefault()
    const trimmedReq = itemForm.requirement.trim()
    if (!trimmedReq) return

    const body: Record<string, unknown> = { requirement: trimmedReq }
    if (itemForm.section.trim()) body.section = itemForm.section.trim()
    if (itemForm.source.trim()) body.source = itemForm.source.trim()
    if (itemForm.version.trim()) body.version = itemForm.version.trim()
    if (itemForm.ownerId.trim()) body.ownerId = itemForm.ownerId.trim()
    if (itemForm.dueDate) body.dueDate = itemForm.dueDate
    if (itemForm.comments.trim()) body.comments = itemForm.comments.trim()

    try {
      const res = await fetch(`/api/projects/${id}/compliance/${registerId}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(typeof json.error === 'string' ? json.error : json.error?.message || `Failed to create item (${res.status})`)
      }
      toast('Item added', 'success')
      setShowItemForm(null)
      setItemForm(emptyItemForm())
      fetchItems(registerId)
      fetchRegisters()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to add item', 'error')
    }
  }

  const cancelCreateItem = () => {
    setShowItemForm(null)
    setItemForm(emptyItemForm())
  }

  /* ── Progress calculation ──────────────────────────── */
  const getProgress = (registerItems: ComplianceItem[]) => {
    if (registerItems.length === 0) return { percent: 0, compliant: 0, total: 0 }
    const compliant = registerItems.filter(
      i => i.status === 'COMPLIANT' || i.status === 'APPROVED_WITH_CONDITION'
    ).length
    return {
      percent: Math.round((compliant / registerItems.length) * 100),
      compliant,
      total: registerItems.length,
    }
  }

  /* ── Register-level progress (estimated from _count) ─ */
  const getRegisterProgress = (register: ComplianceRegister) => {
    const total = register._count.items
    if (total === 0) return 0
    // When a register is fully compliant, show 100%
    if (register.overallStatus === 'COMPLIANT') return 100
    if (register.overallStatus === 'APPROVED_WITH_CONDITION') return 100
    if (register.overallStatus === 'NOT_STARTED') return 0
    // Rough estimate for other statuses
    if (register.overallStatus === 'IN_PROGRESS') return 25
    if (register.overallStatus === 'EVIDENCE_SUBMITTED') return 60
    if (register.overallStatus === 'UNDER_REVIEW') return 75
    return 0
  }

  /* ── Loading skeleton ──────────────────────────────── */
  if (loading) {
    return (
      <div className="space-y-5">
        <div className="space-y-1">
          <div className="h-6 w-72 bg-ink-100 animate-pulse rounded" />
          <div className="h-4 w-48 bg-ink-100 animate-pulse rounded" />
        </div>
        <div className="flex gap-1 border-b border-ink-100 pb-px">
          {TABS.map(t => (
            <div key={t.key} className="h-9 w-28 bg-ink-50 animate-pulse rounded-t-lg" />
          ))}
        </div>
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </div>
    )
  }

  /* ── Error state ───────────────────────────────────── */
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh] gap-4">
        <AlertTriangle className="w-8 h-8 text-red-500" />
        <p className="text-[13px] text-ink-600">{error}</p>
        <button
          onClick={fetchRegisters}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-ink-900 text-white text-[13px] font-medium hover:bg-ink-800 transition-colors"
        >
          <RefreshCw className="w-4 h-4" /> Try again
        </button>
      </div>
    )
  }

  /* ── Render ────────────────────────────────────────── */
  return (
    <div className="space-y-5">
      {/* ── Page header ──────────────────────────────── */}
      <div>
        <h2 className="text-[18px] font-semibold text-ink-900">Compliance &amp; Building Regulations</h2>
        <p className="text-[12px] text-ink-400 mt-0.5">
          Track regulatory compliance across BRPD, CDM, Building Regs, Fire Safety and Sustainability
        </p>
      </div>

      {/* ── Tab bar ──────────────────────────────────── */}
      <div className="flex gap-1 border-b border-ink-100 overflow-x-auto scrollbar-hide">
        {TABS.map(tab => {
          const Icon = tab.icon
          const isActive = activeTab === tab.key
          const tabRegisters = registers.filter(r => tab.types.includes(r.registerType))
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                'flex items-center gap-1.5 px-4 py-2.5 text-[12px] font-medium whitespace-nowrap border-b-2 transition-colors',
                isActive
                  ? 'border-ink-900 text-ink-900'
                  : 'border-transparent text-ink-400 hover:text-ink-600 hover:border-ink-200'
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              {tab.label}
              {tabRegisters.length > 0 && (
                <span className={cn(
                  'ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium',
                  isActive ? 'bg-ink-900 text-white' : 'bg-ink-100 text-ink-500'
                )}>
                  {tabRegisters.length}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* ── Tab content header ───────────────────────── */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h3 className="text-[15px] font-semibold text-ink-900 flex items-center gap-2">
            {(() => { const Icon = activeTabConfig.icon; return <Icon className="w-4 h-4 text-ink-500" /> })()}
            {activeTabConfig.label}
          </h3>
          <p className="text-[12px] text-ink-400 mt-0.5">
            {activeTabConfig.description} &mdash; {registers.length} register{registers.length !== 1 ? 's' : ''}
          </p>
        </div>
        {!showCreateForm && (
          <button
            onClick={() => setShowCreateForm(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-ink-900 text-white text-[12px] font-medium hover:bg-ink-800 transition-colors"
          >
            <Plus className="w-4 h-4" />
            New register
          </button>
        )}
      </div>

      {/* ── Create register form (slide-down panel) ──── */}
      {showCreateForm && (
        <form
          onSubmit={handleCreateRegister}
          className="bg-white rounded-xl border-2 border-accent-200 p-5 space-y-4"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-[14px] font-semibold text-ink-900">New compliance register</h3>
            <button type="button" onClick={cancelCreateRegister} className="text-ink-400 hover:text-ink-600 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Name */}
          <div>
            <label htmlFor="reg-name" className="block text-[11px] font-medium text-ink-500 mb-1">
              Register name <span className="text-red-400">*</span>
            </label>
            <input
              id="reg-name"
              type="text"
              value={registerForm.name}
              onChange={(e) => setRegisterForm(prev => ({ ...prev, name: e.target.value }))}
              placeholder="e.g. Part B Fire Safety Assessment"
              className="w-full px-3 py-2 text-[13px] border border-ink-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-300 focus:border-accent-400 placeholder:text-ink-300"
              autoFocus
              maxLength={200}
              required
            />
          </div>

          {/* Type + Template version */}
          <div className="flex gap-4">
            <div className="flex-1">
              <label htmlFor="reg-type" className="block text-[11px] font-medium text-ink-500 mb-1">
                Register type
              </label>
              <select
                id="reg-type"
                value={registerForm.registerType}
                onChange={(e) => setRegisterForm(prev => ({ ...prev, registerType: e.target.value as ComplianceRegisterType }))}
                className="w-full px-3 py-2 text-[13px] border border-ink-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-300 focus:border-accent-400 bg-white"
              >
                {activeTabConfig.types.map(t => (
                  <option key={t} value={t}>{REGISTER_TYPE_LABELS[t]}</option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <label htmlFor="reg-version" className="block text-[11px] font-medium text-ink-500 mb-1">
                Template version
              </label>
              <input
                id="reg-version"
                type="text"
                value={registerForm.templateVersion}
                onChange={(e) => setRegisterForm(prev => ({ ...prev, templateVersion: e.target.value }))}
                placeholder="e.g. v2.1"
                className="w-full px-3 py-2 text-[13px] border border-ink-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-300 focus:border-accent-400 placeholder:text-ink-300"
                maxLength={50}
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label htmlFor="reg-desc" className="block text-[11px] font-medium text-ink-500 mb-1">
              Description
            </label>
            <textarea
              id="reg-desc"
              value={registerForm.description}
              onChange={(e) => setRegisterForm(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Describe the scope and purpose of this register..."
              className="w-full px-3 py-2 text-[13px] border border-ink-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-300 focus:border-accent-400 placeholder:text-ink-300 min-h-[70px]"
              maxLength={2000}
            />
          </div>

          {/* Error */}
          {createRegisterError && (
            <p className="text-[12px] text-red-600 bg-red-50 px-3 py-2 rounded-lg">{createRegisterError}</p>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={cancelCreateRegister}
              className="px-3.5 py-2 text-[12px] font-medium text-ink-500 hover:text-ink-700 transition-colors"
              disabled={creatingRegister}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={creatingRegister || !registerForm.name.trim()}
              className={cn(
                'flex items-center gap-1.5 px-4 py-2 rounded-lg text-[12px] font-medium transition-colors',
                creatingRegister || !registerForm.name.trim()
                  ? 'bg-ink-200 text-ink-400 cursor-not-allowed'
                  : 'bg-ink-900 text-white hover:bg-ink-800',
              )}
            >
              {creatingRegister && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Create register
            </button>
          </div>
        </form>
      )}

      {/* ── Register list ────────────────────────────── */}
      {registers.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3 bg-white rounded-xl border border-ink-100">
          <ClipboardList className="w-10 h-10 text-ink-200" />
          <p className="text-[13px] text-ink-400">No {activeTabConfig.label} registers yet</p>
          <button
            onClick={() => setShowCreateForm(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-ink-900 text-white text-[12px] font-medium hover:bg-ink-800 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create first register
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {registers.map(register => {
            const isExpanded = expandedId === register.id
            const progressEstimate = getRegisterProgress(register)

            return (
              <div key={register.id} className="bg-white rounded-xl border border-ink-100 overflow-hidden">
                {/* ── Register card header ─────────────── */}
                <button
                  onClick={() => toggleExpand(register.id)}
                  className="w-full text-left px-5 py-4 hover:bg-ink-25 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <span className="mt-1 text-ink-400 shrink-0">
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4" />
                        ) : (
                          <ChevronRight className="w-4 h-4" />
                        )}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-[13px] font-semibold text-ink-900 truncate">
                            {register.name}
                          </h4>
                          <StatusBadge status={register.overallStatus} />
                          {activeTab === 'sustainability' && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-ink-50 text-ink-500">
                              {REGISTER_TYPE_LABELS[register.registerType]}
                            </span>
                          )}
                        </div>
                        {register.description && (
                          <p className="text-[12px] text-ink-400 mt-0.5 line-clamp-1">
                            {register.description}
                          </p>
                        )}
                        <div className="flex items-center gap-4 mt-2 text-[11px] text-ink-400">
                          <span className="flex items-center gap-1">
                            <ClipboardList className="w-3 h-3" />
                            {register._count.items} item{register._count.items !== 1 ? 's' : ''}
                          </span>
                          {register.templateVersion && (
                            <span className="flex items-center gap-1">
                              <FileText className="w-3 h-3" />
                              {register.templateVersion}
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatDate(register.updatedAt)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Progress indicator */}
                    <div className="shrink-0 w-20 pt-1">
                      <div className="text-[10px] text-ink-400 text-right mb-1">
                        {progressEstimate}%
                      </div>
                      <div className="h-1.5 bg-ink-100 rounded-full overflow-hidden">
                        <div
                          className={cn(
                            'h-full rounded-full transition-all duration-300',
                            progressEstimate === 100 ? 'bg-green-500' :
                            progressEstimate > 0 ? 'bg-blue-500' : 'bg-ink-200'
                          )}
                          style={{ width: `${progressEstimate}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </button>

                {/* ── Expanded items section ─────────────── */}
                {isExpanded && (
                  <div className="border-t border-ink-100">
                    {/* Items header */}
                    <div className="px-5 py-3 bg-ink-25 flex items-center justify-between">
                      <h4 className="text-[12px] font-semibold text-ink-600">
                        Compliance items
                      </h4>
                      {showItemForm !== register.id && (
                        <button
                          onClick={() => {
                            setShowItemForm(register.id)
                            setItemForm(emptyItemForm())
                          }}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[11px] font-medium text-accent-700 bg-accent-50 hover:bg-accent-100 transition-colors"
                        >
                          <Plus className="w-3 h-3" />
                          Add item
                        </button>
                      )}
                    </div>

                    {/* Items loading */}
                    {itemsLoading && (
                      <div className="divide-y divide-ink-50">
                        {Array.from({ length: 3 }).map((_, i) => (
                          <SkeletonRow key={i} />
                        ))}
                      </div>
                    )}

                    {/* Items list */}
                    {!itemsLoading && items.length > 0 && (
                      <>
                        {/* Progress bar */}
                        {(() => {
                          const progress = getProgress(items)
                          return (
                            <div className="px-5 py-2.5 bg-ink-25 border-b border-ink-100">
                              <div className="flex items-center justify-between mb-1.5">
                                <span className="text-[11px] text-ink-500">
                                  {progress.compliant} of {progress.total} compliant
                                </span>
                                <span className="text-[11px] font-medium text-ink-600">
                                  {progress.percent}%
                                </span>
                              </div>
                              <div className="h-2 bg-ink-100 rounded-full overflow-hidden">
                                <div
                                  className={cn(
                                    'h-full rounded-full transition-all duration-500',
                                    progress.percent === 100 ? 'bg-green-500' :
                                    progress.percent >= 50 ? 'bg-blue-500' :
                                    progress.percent > 0 ? 'bg-yellow-500' : 'bg-ink-200'
                                  )}
                                  style={{ width: `${progress.percent}%` }}
                                />
                              </div>
                            </div>
                          )
                        })()}

                        {/* Table header */}
                        <div className="hidden md:grid grid-cols-[1fr_120px_100px_100px_100px_80px] gap-2 px-5 py-2 border-b border-ink-100 bg-ink-25">
                          <span className="text-[10px] font-medium text-ink-400 uppercase tracking-wide">Requirement</span>
                          <span className="text-[10px] font-medium text-ink-400 uppercase tracking-wide">Source</span>
                          <span className="text-[10px] font-medium text-ink-400 uppercase tracking-wide">Status</span>
                          <span className="text-[10px] font-medium text-ink-400 uppercase tracking-wide">Owner</span>
                          <span className="text-[10px] font-medium text-ink-400 uppercase tracking-wide">Due date</span>
                          <span className="text-[10px] font-medium text-ink-400 uppercase tracking-wide">Evidence</span>
                        </div>

                        {/* Item rows */}
                        <div className="divide-y divide-ink-50">
                          {items.map(item => (
                            <div
                              key={item.id}
                              className="px-5 py-3 hover:bg-ink-25 transition-colors"
                            >
                              {/* Desktop row */}
                              <div className="hidden md:grid grid-cols-[1fr_120px_100px_100px_100px_80px] gap-2 items-center">
                                <div className="min-w-0">
                                  <p className="text-[12px] text-ink-800 font-medium truncate">
                                    {item.requirement}
                                  </p>
                                  {item.section && (
                                    <p className="text-[11px] text-ink-400 truncate">
                                      Section: {item.section}
                                    </p>
                                  )}
                                </div>
                                <span className="text-[11px] text-ink-500 truncate">
                                  {item.source || '-'}
                                </span>
                                <StatusBadge status={item.status} />
                                <select
                                  className="text-[11px] text-ink-500 truncate bg-transparent border-0 p-0 cursor-pointer hover:text-ink-700 focus:ring-0 focus:outline-none"
                                  value={item.ownerId || ''}
                                  onChange={async (e) => {
                                    const ownerId = e.target.value || null
                                    try {
                                      const res = await fetch(`/api/projects/${id}/compliance/${item.registerId}/items`, {
                                        method: 'PATCH',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ itemId: item.id, ownerId }),
                                      })
                                      if (res.ok) {
                                        const { item: updated } = await res.json()
                                        setItems(prev => prev.map(i => i.id === item.id ? { ...i, ownerId: updated.ownerId, owner: updated.owner } : i))
                                      }
                                    } catch {}
                                  }}
                                >
                                  <option value="">—</option>
                                  {teamMembers.map(m => (
                                    <option key={m.id} value={m.id}>{m.fullName}</option>
                                  ))}
                                </select>
                                <span className={cn(
                                  'text-[11px] truncate',
                                  item.dueDate && new Date(item.dueDate) < new Date()
                                    ? 'text-red-600 font-medium'
                                    : 'text-ink-500'
                                )}>
                                  {formatDate(item.dueDate)}
                                </span>
                                <span className="flex items-center justify-center">
                                  {item.evidenceUrl ? (
                                    <a
                                      href={item.evidenceUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-accent-600 hover:text-accent-700"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <ExternalLink className="w-3.5 h-3.5" />
                                    </a>
                                  ) : (
                                    <span className="text-[10px] text-ink-300">None</span>
                                  )}
                                </span>
                              </div>

                              {/* Mobile layout */}
                              <div className="md:hidden space-y-2">
                                <div className="flex items-start justify-between gap-2">
                                  <p className="text-[12px] text-ink-800 font-medium flex-1">
                                    {item.requirement}
                                  </p>
                                  <StatusBadge status={item.status} />
                                </div>
                                <div className="flex items-center gap-3 text-[11px] text-ink-400 flex-wrap">
                                  {item.section && <span>Section: {item.section}</span>}
                                  {item.source && <span>Source: {item.source}</span>}
                                  {item.owner && <span>Owner: {item.owner}</span>}
                                  {item.dueDate && (
                                    <span className={cn(
                                      new Date(item.dueDate) < new Date() ? 'text-red-600' : ''
                                    )}>
                                      Due: {formatDate(item.dueDate)}
                                    </span>
                                  )}
                                  {item.evidenceUrl && (
                                    <a
                                      href={item.evidenceUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-accent-600 hover:text-accent-700 flex items-center gap-0.5"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <ExternalLink className="w-3 h-3" />
                                      Evidence
                                    </a>
                                  )}
                                </div>
                                {item.comments && (
                                  <p className="text-[11px] text-ink-400 italic line-clamp-2">
                                    {item.comments}
                                  </p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </>
                    )}

                    {/* Empty items state */}
                    {!itemsLoading && items.length === 0 && (
                      <div className="flex flex-col items-center py-10 gap-2">
                        <ClipboardList className="w-7 h-7 text-ink-200" />
                        <p className="text-[12px] text-ink-400">No compliance items yet</p>
                        {showItemForm !== register.id && (
                          <button
                            onClick={() => {
                              setShowItemForm(register.id)
                              setItemForm(emptyItemForm())
                            }}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[11px] font-medium text-accent-700 bg-accent-50 hover:bg-accent-100 transition-colors mt-1"
                          >
                            <Plus className="w-3 h-3" />
                            Add first item
                          </button>
                        )}
                      </div>
                    )}

                    {/* ── Inline add item form ──────────── */}
                    {showItemForm === register.id && (
                      <div className="px-5 py-4 bg-accent-25 border-t border-accent-100">
                        <form onSubmit={(e) => handleCreateItem(e, register.id)} className="space-y-3">
                          <div className="flex items-center justify-between">
                            <h5 className="text-[12px] font-semibold text-ink-700">Add compliance item</h5>
                            <button type="button" onClick={cancelCreateItem} className="text-ink-400 hover:text-ink-600 transition-colors">
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          {/* Requirement */}
                          <div>
                            <label htmlFor="item-req" className="block text-[11px] font-medium text-ink-500 mb-1">
                              Requirement <span className="text-red-400">*</span>
                            </label>
                            <input
                              id="item-req"
                              type="text"
                              value={itemForm.requirement}
                              onChange={(e) => setItemForm(prev => ({ ...prev, requirement: e.target.value }))}
                              placeholder="e.g. Fire escape route signage in accordance with BS 5499-4"
                              className="w-full px-3 py-2 text-[13px] border border-ink-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-300 focus:border-accent-400 placeholder:text-ink-300"
                              autoFocus
                              maxLength={500}
                              required
                            />
                          </div>

                          {/* Section + Source + Version */}
                          <div className="flex gap-3">
                            <div className="flex-1">
                              <label htmlFor="item-section" className="block text-[11px] font-medium text-ink-500 mb-1">Section</label>
                              <input
                                id="item-section"
                                type="text"
                                value={itemForm.section}
                                onChange={(e) => setItemForm(prev => ({ ...prev, section: e.target.value }))}
                                placeholder="e.g. B1.3"
                                className="w-full px-3 py-2 text-[13px] border border-ink-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-300 focus:border-accent-400 placeholder:text-ink-300"
                                maxLength={100}
                              />
                            </div>
                            <div className="flex-1">
                              <label htmlFor="item-source" className="block text-[11px] font-medium text-ink-500 mb-1">Source</label>
                              <input
                                id="item-source"
                                type="text"
                                list="source-options"
                                value={itemForm.source}
                                onChange={(e) => setItemForm(prev => ({ ...prev, source: e.target.value }))}
                                placeholder="Select or type a source"
                                className="w-full px-3 py-2 text-[13px] border border-ink-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-300 focus:border-accent-400 placeholder:text-ink-300"
                                maxLength={200}
                              />
                              <datalist id="source-options">
                                {SOURCE_OPTIONS.map(opt => (
                                  <option key={opt} value={opt} />
                                ))}
                              </datalist>
                            </div>
                            <div className="w-24">
                              <label htmlFor="item-version" className="block text-[11px] font-medium text-ink-500 mb-1">Version</label>
                              <input
                                id="item-version"
                                type="text"
                                value={itemForm.version}
                                onChange={(e) => setItemForm(prev => ({ ...prev, version: e.target.value }))}
                                placeholder="v1.0"
                                className="w-full px-3 py-2 text-[13px] border border-ink-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-300 focus:border-accent-400 placeholder:text-ink-300"
                                maxLength={50}
                              />
                            </div>
                          </div>

                          {/* Owner + Due date */}
                          <div className="flex gap-3">
                            <div className="flex-1">
                              <label htmlFor="item-owner" className="block text-[11px] font-medium text-ink-500 mb-1">Owner</label>
                              <select
                                id="item-owner"
                                value={itemForm.ownerId}
                                onChange={(e) => setItemForm(prev => ({ ...prev, ownerId: e.target.value }))}
                                className="w-full px-3 py-2 text-[13px] border border-ink-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-300 focus:border-accent-400 bg-white"
                              >
                                <option value="">No owner</option>
                                {teamMembers.map((m) => (
                                  <option key={m.id} value={m.id}>{m.fullName}</option>
                                ))}
                              </select>
                            </div>
                            <div className="w-44">
                              <label htmlFor="item-due" className="block text-[11px] font-medium text-ink-500 mb-1">Due date</label>
                              <input
                                id="item-due"
                                type="date"
                                value={itemForm.dueDate}
                                onChange={(e) => setItemForm(prev => ({ ...prev, dueDate: e.target.value }))}
                                className="w-full px-3 py-2 text-[13px] border border-ink-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-300 focus:border-accent-400"
                              />
                            </div>
                          </div>

                          {/* Comments */}
                          <div>
                            <label htmlFor="item-comments" className="block text-[11px] font-medium text-ink-500 mb-1">Comments</label>
                            <textarea
                              id="item-comments"
                              value={itemForm.comments}
                              onChange={(e) => setItemForm(prev => ({ ...prev, comments: e.target.value }))}
                              placeholder="Additional notes or context..."
                              className="w-full px-3 py-2 text-[13px] border border-ink-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-300 focus:border-accent-400 placeholder:text-ink-300 min-h-[60px]"
                              maxLength={2000}
                            />
                          </div>

                          {/* Actions */}
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={cancelCreateItem}
                              className="px-3 py-1.5 text-[11px] font-medium text-ink-500 hover:text-ink-700 transition-colors"
                            >
                              Cancel
                            </button>
                            <button
                              type="submit"
                              disabled={!itemForm.requirement.trim()}
                              className={cn(
                                'flex items-center gap-1 px-3.5 py-1.5 rounded-lg text-[11px] font-medium transition-colors',
                                !itemForm.requirement.trim()
                                  ? 'bg-ink-200 text-ink-400 cursor-not-allowed'
                                  : 'bg-ink-900 text-white hover:bg-ink-800',
                              )}
                            >
                              Add item
                            </button>
                          </div>
                        </form>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ── Sustainability sub-type filter hint ───────── */}
      {activeTab === 'sustainability' && registers.length > 0 && (
        <div className="flex items-center gap-2 text-[11px] text-ink-400 pt-1">
          <Filter className="w-3 h-3" />
          <span>
            Showing {registers.filter(r => r.registerType === 'EDGE').length} EDGE,{' '}
            {registers.filter(r => r.registerType === 'BREEAM').length} BREEAM,{' '}
            {registers.filter(r => r.registerType === 'LEED').length} LEED registers
          </span>
        </div>
      )}

      {/* ── Summary stats ────────────────────────────── */}
      {registers.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <SummaryCard
            label="Total registers"
            value={registers.length}
            accent="ink"
          />
          <SummaryCard
            label="Compliant"
            value={registers.filter(r => r.overallStatus === 'COMPLIANT').length}
            accent="green"
          />
          <SummaryCard
            label="In progress"
            value={registers.filter(r => r.overallStatus === 'IN_PROGRESS' || r.overallStatus === 'UNDER_REVIEW' || r.overallStatus === 'EVIDENCE_SUBMITTED').length}
            accent="blue"
          />
          <SummaryCard
            label="Action required"
            value={registers.filter(r => {
              if (r._count.items === 0) return false
              const resolved = r.overallStatus === 'COMPLIANT' || r.overallStatus === 'APPROVED_WITH_CONDITION' || r.overallStatus === 'NOT_APPLICABLE' || r.overallStatus === 'CLOSED'
              return !resolved
            }).length}
            accent="red"
          />
        </div>
      )}
    </div>
  )
}

/* ── Summary card component ─────────────────────────────── */

function SummaryCard({
  label,
  value,
  accent,
}: {
  label: string
  value: number
  accent: 'ink' | 'green' | 'blue' | 'red'
}) {
  const accentClasses = {
    ink: 'border-ink-100',
    green: 'border-green-200 bg-green-25',
    blue: 'border-blue-200 bg-blue-25',
    red: 'border-red-200 bg-red-25',
  }
  const valueClasses = {
    ink: 'text-ink-900',
    green: 'text-green-700',
    blue: 'text-blue-700',
    red: 'text-red-700',
  }

  return (
    <div className={cn('rounded-xl border p-4', accentClasses[accent])}>
      <p className={cn('text-[20px] font-bold', valueClasses[accent])}>{value}</p>
      <p className="text-[11px] text-ink-400 mt-0.5">{label}</p>
    </div>
  )
}

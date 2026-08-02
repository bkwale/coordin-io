'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import {
  Plus, Filter, X, AlertTriangle, Shield,
  HelpCircle, Link2, Scale, ChevronDown,
  Calendar, User,
} from 'lucide-react'
import { cn } from '@/lib/utils'

/* ── Types ─────────────────────────────────────────────── */

type RaidCategory = 'risks' | 'assumptions' | 'issues' | 'dependencies' | 'decisions'
type ItemStatus = 'Open' | 'Mitigated' | 'Closed'
type ItemSeverity = 'Low' | 'Medium' | 'High' | 'Critical'

interface RaidItem {
  id: string
  category: RaidCategory
  number: string
  title: string
  description: string
  owner: string
  status: ItemStatus
  severity: ItemSeverity
  dueDate: string
  mitigation: string
  createdAt: string
}

/* ── Constants ─────────────────────────────────────────── */

const TABS: { key: RaidCategory; label: string; icon: typeof AlertTriangle; prefix: string }[] = [
  { key: 'risks', label: 'Risks', icon: AlertTriangle, prefix: 'R' },
  { key: 'assumptions', label: 'Assumptions', icon: HelpCircle, prefix: 'A' },
  { key: 'issues', label: 'Issues', icon: Shield, prefix: 'I' },
  { key: 'dependencies', label: 'Dependencies', icon: Link2, prefix: 'D' },
  { key: 'decisions', label: 'Decisions', icon: Scale, prefix: 'DEC' },
]

const STATUSES: ItemStatus[] = ['Open', 'Mitigated', 'Closed']
const SEVERITIES: ItemSeverity[] = ['Low', 'Medium', 'High', 'Critical']

const STATUS_COLORS: Record<ItemStatus, string> = {
  Open: 'bg-blue-50 text-blue-600',
  Mitigated: 'bg-amber-50 text-amber-600',
  Closed: 'bg-slate-50 text-slate-500',
}

const SEVERITY_COLORS: Record<ItemSeverity, string> = {
  Low: 'bg-slate-50 text-slate-500',
  Medium: 'bg-amber-50 text-amber-600',
  High: 'bg-orange-50 text-orange-600',
  Critical: 'bg-red-50 text-red-600',
}

/* ── Helpers ───────────────────────────────────────────── */

function storageKey(projectId: string): string {
  return `raid-log-${projectId}`
}

function loadItems(projectId: string): RaidItem[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(storageKey(projectId))
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveItems(projectId: string, items: RaidItem[]): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(storageKey(projectId), JSON.stringify(items))
}

function nextNumber(items: RaidItem[], category: RaidCategory): string {
  const tab = TABS.find(t => t.key === category)!
  const existing = items.filter(i => i.category === category)
  const seq = existing.length + 1
  return `${tab.prefix}-${seq.toString().padStart(3, '0')}`
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

/* ── Empty form state ──────────────────────────────────── */

function emptyForm(category: RaidCategory): Omit<RaidItem, 'id' | 'number' | 'createdAt'> {
  return {
    category,
    title: '',
    description: '',
    owner: '',
    status: 'Open',
    severity: 'Medium',
    dueDate: '',
    mitigation: '',
  }
}

/* ── Page ──────────────────────────────────────────────── */

export default function ProjectRegistersPage() {
  const params = useParams()
  const projectId = params.id as string

  const [items, setItems] = useState<RaidItem[]>([])
  const [activeTab, setActiveTab] = useState<RaidCategory>('risks')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(emptyForm('risks'))
  const [filterStatus, setFilterStatus] = useState<ItemStatus | 'All'>('All')
  const [filterSeverity, setFilterSeverity] = useState<ItemSeverity | 'All'>('All')
  const [showFilters, setShowFilters] = useState(false)

  /* ── Load from localStorage ──────────────────────────── */

  useEffect(() => {
    setItems(loadItems(projectId))
  }, [projectId])

  /* ── Persist ─────────────────────────────────────────── */

  const persist = useCallback((updated: RaidItem[]) => {
    setItems(updated)
    saveItems(projectId, updated)
  }, [projectId])

  /* ── Filtered items for active tab ───────────────────── */

  const tabItems = items.filter(i => i.category === activeTab)
  let filtered = tabItems
  if (filterStatus !== 'All') {
    filtered = filtered.filter(i => i.status === filterStatus)
  }
  if (filterSeverity !== 'All') {
    filtered = filtered.filter(i => i.severity === filterSeverity)
  }

  /* ── Counts per tab ──────────────────────────────────── */

  const countByTab = TABS.reduce<Record<RaidCategory, number>>((acc, tab) => {
    acc[tab.key] = items.filter(i => i.category === tab.key).length
    return acc
  }, {} as Record<RaidCategory, number>)

  /* ── Tab switch ──────────────────────────────────────── */

  const switchTab = (key: RaidCategory) => {
    setActiveTab(key)
    setShowForm(false)
    setForm(emptyForm(key))
    setFilterStatus('All')
    setFilterSeverity('All')
    setShowFilters(false)
  }

  /* ── Add item ────────────────────────────────────────── */

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title.trim()) return

    const newItem: RaidItem = {
      id: generateId(),
      category: activeTab,
      number: nextNumber(items, activeTab),
      title: form.title.trim(),
      description: form.description.trim(),
      owner: form.owner.trim(),
      status: form.status,
      severity: form.severity,
      dueDate: form.dueDate,
      mitigation: form.mitigation.trim(),
      createdAt: new Date().toISOString(),
    }

    persist([...items, newItem])
    setForm(emptyForm(activeTab))
    setShowForm(false)
  }

  const cancelForm = () => {
    setShowForm(false)
    setForm(emptyForm(activeTab))
  }

  /* ── Update item status inline ───────────────────────── */

  const updateStatus = (id: string, status: ItemStatus) => {
    const updated = items.map(i => (i.id === id ? { ...i, status } : i))
    persist(updated)
  }

  /* ── Delete item ─────────────────────────────────────── */

  const deleteItem = (id: string) => {
    persist(items.filter(i => i.id !== id))
  }

  /* ── Stats ───────────────────────────────────────────── */

  const openCount = tabItems.filter(i => i.status === 'Open').length
  const criticalCount = tabItems.filter(i => i.severity === 'Critical').length

  const activeTabMeta = TABS.find(t => t.key === activeTab)!
  const TabIcon = activeTabMeta.icon

  return (
    <div className="min-h-screen bg-surface-50 p-4 lg:p-6 space-y-5">
      {/* ── Header ─────────────────────────────────────── */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-[18px] font-semibold text-ink-900">RAID Log</h2>
          <p className="text-[12px] text-ink-400 mt-0.5">
            Risks, Assumptions, Issues, Dependencies & Decisions
          </p>
        </div>
        {!showForm && (
          <button
            onClick={() => {
              setForm(emptyForm(activeTab))
              setShowForm(true)
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-ink-900 text-white text-[12px] font-medium hover:bg-ink-800 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add {activeTabMeta.label.slice(0, -1)}
          </button>
        )}
      </div>

      {/* ── Info banner ────────────────────────────────── */}
      <div className="flex items-center gap-2 px-4 py-2.5 bg-blue-50 border border-blue-100 rounded-xl">
        <HelpCircle className="w-4 h-4 text-blue-400 shrink-0" />
        <p className="text-[12px] text-blue-600">
          Data is stored locally. API integration pending.
        </p>
      </div>

      {/* ── Tab bar ────────────────────────────────────── */}
      <div className="flex gap-1 bg-surface-100 rounded-xl p-1">
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => switchTab(tab.key)}
            className={cn(
              'flex-1 px-3 py-2 text-[12px] font-medium rounded-lg transition-all',
              activeTab === tab.key
                ? 'bg-white text-ink-900 shadow-card'
                : 'text-ink-400 hover:text-ink-700'
            )}
          >
            {tab.label}
            {countByTab[tab.key] > 0 && (
              <span className={cn(
                'ml-1.5 inline-flex items-center justify-center w-5 h-5 rounded-md text-[10px] font-bold',
                activeTab === tab.key ? 'bg-accent-50 text-accent-700' : 'bg-surface-200 text-ink-400'
              )}>
                {countByTab[tab.key]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Stats bar ──────────────────────────────────── */}
      <div className="flex items-center gap-4 text-[12px] text-ink-400">
        <TabIcon className="w-4 h-4 text-ink-300" />
        <span>{tabItems.length} total</span>
        <span className="text-ink-200">|</span>
        <span>{openCount} open</span>
        {criticalCount > 0 && (
          <>
            <span className="text-ink-200">|</span>
            <span className="text-red-500 font-medium">{criticalCount} critical</span>
          </>
        )}
      </div>

      {/* ── Add item form ──────────────────────────────── */}
      {showForm && (
        <form
          onSubmit={handleAdd}
          className="bg-white rounded-2xl border-2 border-accent-200 p-5 space-y-4 shadow-card"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-[15px] font-semibold text-ink-900">
              New {activeTabMeta.label.slice(0, -1)}
            </h3>
            <button
              type="button"
              onClick={cancelForm}
              className="text-ink-400 hover:text-ink-600 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Title */}
          <div>
            <label htmlFor="raid-title" className="block text-[11px] font-medium text-ink-500 mb-1">
              Title <span className="text-red-400">*</span>
            </label>
            <input
              id="raid-title"
              type="text"
              value={form.title}
              onChange={e => setForm({ ...form, title: e.target.value })}
              placeholder={`e.g. ${activeTab === 'risks' ? 'Delayed material delivery' : activeTab === 'assumptions' ? 'Client budget confirmed' : activeTab === 'issues' ? 'Drainage survey incomplete' : activeTab === 'dependencies' ? 'Structural engineer sign-off' : 'Use timber frame for Block B'}`}
              className="w-full px-3 py-2 text-[13px] border border-ink-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-300 focus:border-accent-400 placeholder:text-ink-300"
              autoFocus
              maxLength={300}
              required
            />
          </div>

          {/* Description */}
          <div>
            <label htmlFor="raid-desc" className="block text-[11px] font-medium text-ink-500 mb-1">
              Description
            </label>
            <textarea
              id="raid-desc"
              value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
              placeholder="Detail the context, impact, or rationale..."
              rows={3}
              className="w-full px-3 py-2 text-[13px] border border-ink-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-300 focus:border-accent-400 placeholder:text-ink-300 resize-none"
              maxLength={1000}
            />
          </div>

          {/* Row: Owner + Due date */}
          <div className="flex gap-4">
            <div className="flex-1">
              <label htmlFor="raid-owner" className="block text-[11px] font-medium text-ink-500 mb-1">
                Owner
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-ink-300" />
                <input
                  id="raid-owner"
                  type="text"
                  value={form.owner}
                  onChange={e => setForm({ ...form, owner: e.target.value })}
                  placeholder="Name or role"
                  className="w-full pl-9 pr-3 py-2 text-[13px] border border-ink-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-300 focus:border-accent-400 placeholder:text-ink-300"
                  maxLength={100}
                />
              </div>
            </div>
            <div className="flex-1">
              <label htmlFor="raid-due" className="block text-[11px] font-medium text-ink-500 mb-1">
                Due date
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-ink-300" />
                <input
                  id="raid-due"
                  type="date"
                  value={form.dueDate}
                  onChange={e => setForm({ ...form, dueDate: e.target.value })}
                  className="w-full pl-9 pr-3 py-2 text-[13px] border border-ink-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-300 focus:border-accent-400"
                />
              </div>
            </div>
          </div>

          {/* Row: Status + Severity */}
          <div className="flex gap-4">
            <div className="flex-1">
              <label htmlFor="raid-status" className="block text-[11px] font-medium text-ink-500 mb-1">
                Status
              </label>
              <div className="relative">
                <select
                  id="raid-status"
                  value={form.status}
                  onChange={e => setForm({ ...form, status: e.target.value as ItemStatus })}
                  className="w-full px-3 py-2 text-[13px] border border-ink-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-300 focus:border-accent-400 bg-white appearance-none"
                >
                  {STATUSES.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-ink-300 pointer-events-none" />
              </div>
            </div>
            <div className="flex-1">
              <label htmlFor="raid-severity" className="block text-[11px] font-medium text-ink-500 mb-1">
                Severity
              </label>
              <div className="relative">
                <select
                  id="raid-severity"
                  value={form.severity}
                  onChange={e => setForm({ ...form, severity: e.target.value as ItemSeverity })}
                  className="w-full px-3 py-2 text-[13px] border border-ink-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-300 focus:border-accent-400 bg-white appearance-none"
                >
                  {SEVERITIES.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-ink-300 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Mitigation / resolution */}
          <div>
            <label htmlFor="raid-mitigation" className="block text-[11px] font-medium text-ink-500 mb-1">
              {activeTab === 'decisions' ? 'Rationale' : activeTab === 'issues' ? 'Resolution' : 'Mitigation'}
            </label>
            <textarea
              id="raid-mitigation"
              value={form.mitigation}
              onChange={e => setForm({ ...form, mitigation: e.target.value })}
              placeholder={activeTab === 'decisions' ? 'Reasoning behind this decision...' : activeTab === 'issues' ? 'Steps to resolve...' : 'Steps to mitigate or manage...'}
              rows={2}
              className="w-full px-3 py-2 text-[13px] border border-ink-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-300 focus:border-accent-400 placeholder:text-ink-300 resize-none"
              maxLength={1000}
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={cancelForm}
              className="px-3.5 py-2 text-[12px] font-medium text-ink-500 hover:text-ink-700 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!form.title.trim()}
              className={cn(
                'flex items-center gap-1.5 px-4 py-2 rounded-lg text-[12px] font-medium transition-colors',
                !form.title.trim()
                  ? 'bg-ink-200 text-ink-400 cursor-not-allowed'
                  : 'bg-ink-900 text-white hover:bg-ink-800',
              )}
            >
              <Plus className="w-3.5 h-3.5" />
              Add {activeTabMeta.label.slice(0, -1)}
            </button>
          </div>
        </form>
      )}

      {/* ── Filters ────────────────────────────────────── */}
      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-medium transition-colors',
            showFilters || filterStatus !== 'All' || filterSeverity !== 'All'
              ? 'bg-accent-50 text-accent-700'
              : 'bg-ink-50 text-ink-500 hover:bg-ink-100'
          )}
        >
          <Filter className="w-3.5 h-3.5" />
          Filters
          {(filterStatus !== 'All' || filterSeverity !== 'All') && (
            <span className="w-4 h-4 bg-accent-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
              {(filterStatus !== 'All' ? 1 : 0) + (filterSeverity !== 'All' ? 1 : 0)}
            </span>
          )}
        </button>

        {showFilters && (
          <>
            {/* Status filter */}
            <div className="flex gap-1">
              <button
                onClick={() => setFilterStatus('All')}
                className={cn(
                  'px-3 py-1.5 rounded-full text-[11px] font-medium transition-colors',
                  filterStatus === 'All' ? 'bg-ink-900 text-white' : 'bg-ink-50 text-ink-500 hover:bg-ink-100'
                )}
              >
                All statuses
              </button>
              {STATUSES.map(s => (
                <button
                  key={s}
                  onClick={() => setFilterStatus(filterStatus === s ? 'All' : s)}
                  className={cn(
                    'px-3 py-1.5 rounded-full text-[11px] font-medium transition-colors',
                    filterStatus === s ? 'bg-ink-900 text-white' : 'bg-ink-50 text-ink-500 hover:bg-ink-100'
                  )}
                >
                  {s}
                </button>
              ))}
            </div>

            <span className="text-ink-200">|</span>

            {/* Severity filter */}
            <div className="flex gap-1">
              <button
                onClick={() => setFilterSeverity('All')}
                className={cn(
                  'px-3 py-1.5 rounded-full text-[11px] font-medium transition-colors',
                  filterSeverity === 'All' ? 'bg-ink-900 text-white' : 'bg-ink-50 text-ink-500 hover:bg-ink-100'
                )}
              >
                All severities
              </button>
              {SEVERITIES.map(s => (
                <button
                  key={s}
                  onClick={() => setFilterSeverity(filterSeverity === s ? 'All' : s)}
                  className={cn(
                    'px-3 py-1.5 rounded-full text-[11px] font-medium transition-colors',
                    filterSeverity === s ? 'bg-ink-900 text-white' : 'bg-ink-50 text-ink-500 hover:bg-ink-100'
                  )}
                >
                  {s}
                </button>
              ))}
            </div>

            {/* Clear filters */}
            {(filterStatus !== 'All' || filterSeverity !== 'All') && (
              <button
                onClick={() => { setFilterStatus('All'); setFilterSeverity('All') }}
                className="flex items-center gap-1 px-2 py-1.5 text-[11px] text-ink-400 hover:text-ink-600 transition-colors"
              >
                <X className="w-3 h-3" />
                Clear
              </button>
            )}
          </>
        )}
      </div>

      {/* ── Items list ─────────────────────────────────── */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-surface-200 shadow-card p-10 text-center">
          <TabIcon className="w-8 h-8 text-ink-200 mx-auto mb-3" />
          <p className="text-[15px] font-medium text-ink-600">
            {tabItems.length === 0
              ? `No ${activeTabMeta.label.toLowerCase()} recorded yet`
              : `No ${activeTabMeta.label.toLowerCase()} match the current filters`}
          </p>
          <p className="text-[12px] text-ink-400 mt-1">
            {tabItems.length === 0
              ? `Click "+ Add ${activeTabMeta.label.slice(0, -1)}" to create the first entry.`
              : 'Try changing the filter criteria.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(item => {
            const isOverdue = item.dueDate && new Date(item.dueDate) < new Date() && item.status !== 'Closed'
            return (
              <div
                key={item.id}
                className="bg-white rounded-2xl border border-surface-200 shadow-card px-5 py-4"
              >
                {/* Top row: number + title + badges */}
                <div className="flex items-start gap-3">
                  {/* Number badge */}
                  <span className="shrink-0 mt-0.5 px-2 py-0.5 rounded-md bg-surface-100 text-[10px] font-bold text-ink-500 tracking-wide">
                    {item.number}
                  </span>

                  {/* Title + description */}
                  <div className="flex-1 min-w-0">
                    <h4 className="text-[15px] font-medium text-ink-900 leading-snug">
                      {item.title}
                    </h4>
                    {item.description && (
                      <p className="text-[12px] text-ink-400 mt-1 line-clamp-2">
                        {item.description}
                      </p>
                    )}
                  </div>

                  {/* Status + severity badges */}
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-semibold', SEVERITY_COLORS[item.severity])}>
                      {item.severity}
                    </span>
                    <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-semibold', STATUS_COLORS[item.status])}>
                      {item.status}
                    </span>
                  </div>
                </div>

                {/* Meta row */}
                <div className="flex items-center gap-4 mt-3 flex-wrap">
                  {item.owner && (
                    <span className="flex items-center gap-1 text-[12px] text-ink-400">
                      <User className="w-3 h-3" />
                      {item.owner}
                    </span>
                  )}
                  {item.dueDate && (
                    <span className={cn(
                      'flex items-center gap-1 text-[12px]',
                      isOverdue ? 'text-red-600 font-medium' : 'text-ink-400'
                    )}>
                      <Calendar className="w-3 h-3" />
                      {new Date(item.dueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                      {isOverdue && ' (overdue)'}
                    </span>
                  )}
                  {item.mitigation && (
                    <span className="flex items-center gap-1 text-[12px] text-ink-400">
                      <Shield className="w-3 h-3" />
                      <span className="truncate max-w-[200px]">{item.mitigation}</span>
                    </span>
                  )}
                </div>

                {/* Actions row */}
                <div className="flex items-center gap-2 mt-3 pt-3 border-t border-surface-100">
                  {STATUSES.map(s => (
                    <button
                      key={s}
                      onClick={() => updateStatus(item.id, s)}
                      className={cn(
                        'px-2.5 py-1 rounded-md text-[10px] font-medium transition-colors',
                        item.status === s
                          ? STATUS_COLORS[s] + ' ring-1 ring-current/20'
                          : 'bg-surface-50 text-ink-400 hover:bg-surface-100'
                      )}
                    >
                      {s}
                    </button>
                  ))}

                  <div className="ml-auto">
                    <button
                      onClick={() => deleteItem(item.id)}
                      className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium text-ink-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                    >
                      <X className="w-3 h-3" />
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

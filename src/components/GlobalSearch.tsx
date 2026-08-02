'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Search, X, Loader2,
  FolderOpen, Users, CheckSquare, FileText,
  Pencil, Eye, ShieldCheck, Landmark,
  AlertCircle, HardHat, Wrench, CalendarDays,
  ArrowRight, Command,
} from 'lucide-react'
import { cn } from '@/lib/utils'

/* ── Types ─────────────────────────────────────────────── */

interface SearchResult {
  type: string
  id: string
  title: string
  description: string | null
  projectId: string | null
  projectName: string | null
  status: string | null
  link: string
  updatedAt: string
}

/* ── Icon mapping ──────────────────────────────────────── */

const TYPE_CONFIG: Record<string, {
  label: string
  icon: React.FC<{ className?: string }>
  color: string
}> = {
  project: { label: 'Projects', icon: FolderOpen, color: 'text-accent-500 bg-accent-50' },
  person: { label: 'People', icon: Users, color: 'text-violet-500 bg-violet-50' },
  task: { label: 'Tasks', icon: CheckSquare, color: 'text-blue-500 bg-blue-50' },
  document: { label: 'Documents', icon: FileText, color: 'text-emerald-500 bg-emerald-50' },
  drawing: { label: 'Drawings', icon: Pencil, color: 'text-amber-500 bg-amber-50' },
  design_review: { label: 'Design Reviews', icon: Eye, color: 'text-indigo-500 bg-indigo-50' },
  compliance: { label: 'Compliance', icon: ShieldCheck, color: 'text-teal-500 bg-teal-50' },
  planning: { label: 'Planning', icon: Landmark, color: 'text-sky-500 bg-sky-50' },
  observation: { label: 'Observations', icon: AlertCircle, color: 'text-orange-500 bg-orange-50' },
  snag: { label: 'Snags', icon: HardHat, color: 'text-red-500 bg-red-50' },
  service_request: { label: 'Requests', icon: Wrench, color: 'text-pink-500 bg-pink-50' },
  leave: { label: 'Leave', icon: CalendarDays, color: 'text-cyan-500 bg-cyan-50' },
}

function getTypeConfig(type: string) {
  return TYPE_CONFIG[type] || { label: type, icon: FileText, color: 'text-ink-400 bg-surface-100' }
}

/* ── Status badge ──────────────────────────────────────── */

function StatusBadge({ status }: { status: string | null }) {
  if (!status) return null

  const s = status.toLowerCase().replace(/_/g, ' ')
  const colorMap: Record<string, string> = {
    active: 'bg-emerald-50 text-emerald-600',
    completed: 'bg-slate-100 text-slate-500',
    open: 'bg-blue-50 text-blue-600',
    closed: 'bg-slate-100 text-slate-500',
    resolved: 'bg-emerald-50 text-emerald-600',
    in_progress: 'bg-blue-50 text-blue-600',
    'in progress': 'bg-blue-50 text-blue-600',
    draft: 'bg-slate-50 text-slate-500',
    approved: 'bg-emerald-50 text-emerald-600',
    submitted: 'bg-blue-50 text-blue-600',
    'not started': 'bg-slate-50 text-slate-500',
    blocked: 'bg-red-50 text-red-600',
    paused: 'bg-amber-50 text-amber-600',
    assigned: 'bg-blue-50 text-blue-600',
  }

  const color = colorMap[s] || 'bg-surface-100 text-ink-500'

  return (
    <span className={cn('text-[9px] font-medium px-1.5 py-0.5 rounded uppercase tracking-wide', color)}>
      {s}
    </span>
  )
}

/* ── GlobalSearch Component ────────────────────────────── */

export function GlobalSearch() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const router = useRouter()

  // ── Open/close ─────────────────────────────────────────
  const openSearch = useCallback(() => {
    setOpen(true)
    setQuery('')
    setResults([])
    setSelectedIndex(0)
    setError(null)
  }, [])

  const closeSearch = useCallback(() => {
    setOpen(false)
    setQuery('')
    setResults([])
    setError(null)
  }, [])

  // ── Cmd+K listener ─────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        if (open) closeSearch()
        else openSearch()
      }
      if (e.key === 'Escape' && open) {
        e.preventDefault()
        closeSearch()
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, openSearch, closeSearch])

  // ── Focus input on open ────────────────────────────────
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  // ── Debounced search ───────────────────────────────────
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)

    if (query.length < 2) {
      setResults([])
      setLoading(false)
      return
    }

    setLoading(true)
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}&limit=5`)
        if (!res.ok) throw new Error('Search failed')
        const json = await res.json()
        setResults(json.data.results || [])
        setError(null)
      } catch {
        setError('Search unavailable')
        setResults([])
      } finally {
        setLoading(false)
      }
    }, 300)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query])

  // ── Group results by type ──────────────────────────────
  const grouped = results.reduce<Record<string, SearchResult[]>>((acc, r) => {
    if (!acc[r.type]) acc[r.type] = []
    acc[r.type].push(r)
    return acc
  }, {})

  const flatResults = results
  const totalResults = flatResults.length

  // ── Keyboard navigation ────────────────────────────────
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex(i => Math.min(i + 1, totalResults - 1))
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex(i => Math.max(i - 1, 0))
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      if (totalResults > 0 && flatResults[selectedIndex]) {
        router.push(flatResults[selectedIndex].link)
        closeSearch()
      } else if (query.length >= 2) {
        // Navigate to full search page
        router.push(`/search?q=${encodeURIComponent(query)}`)
        closeSearch()
      }
    }
  }

  // ── Scroll selected into view ──────────────────────────
  useEffect(() => {
    if (listRef.current) {
      const selected = listRef.current.querySelector('[data-selected="true"]')
      if (selected) {
        selected.scrollIntoView({ block: 'nearest' })
      }
    }
  }, [selectedIndex])

  if (!open) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50"
        onClick={closeSearch}
      />

      {/* Modal */}
      <div className="fixed top-[15%] left-1/2 -translate-x-1/2 w-full max-w-xl z-50 px-4">
        <div className="bg-white rounded-xl border border-surface-200 shadow-elevated overflow-hidden">
          {/* Search input */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-surface-200">
            <Search className="w-4 h-4 text-ink-300 shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={e => {
                setQuery(e.target.value)
                setSelectedIndex(0)
              }}
              onKeyDown={handleKeyDown}
              placeholder="Search projects, tasks, documents, people..."
              className="flex-1 text-[13px] text-ink-900 placeholder:text-ink-300 bg-transparent outline-none"
              autoComplete="off"
              spellCheck={false}
            />
            {loading && <Loader2 className="w-4 h-4 text-ink-300 animate-spin shrink-0" />}
            {query && !loading && (
              <button
                onClick={() => { setQuery(''); setResults([]); inputRef.current?.focus() }}
                className="text-ink-300 hover:text-ink-500"
              >
                <X className="w-4 h-4" />
              </button>
            )}
            <kbd className="text-[10px] text-ink-300 border border-surface-200 rounded px-1.5 py-0.5 font-mono shrink-0">
              ESC
            </kbd>
          </div>

          {/* Results */}
          <div ref={listRef} className="max-h-[380px] overflow-y-auto">
            {/* Empty state: no query */}
            {query.length < 2 && !loading && (
              <div className="py-8 text-center">
                <Search className="w-8 h-8 text-ink-200 mx-auto mb-2" />
                <p className="text-[12px] text-ink-400">
                  Type at least 2 characters to search
                </p>
                <p className="text-[10px] text-ink-300 mt-1">
                  Search across projects, tasks, documents, people and more
                </p>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="py-8 text-center">
                <AlertCircle className="w-6 h-6 text-red-300 mx-auto mb-2" />
                <p className="text-[12px] text-red-500">{error}</p>
              </div>
            )}

            {/* No results */}
            {query.length >= 2 && !loading && !error && totalResults === 0 && (
              <div className="py-8 text-center">
                <Search className="w-6 h-6 text-ink-200 mx-auto mb-2" />
                <p className="text-[12px] text-ink-500">No results for &ldquo;{query}&rdquo;</p>
                <p className="text-[10px] text-ink-400 mt-1">Try a different search term</p>
              </div>
            )}

            {/* Grouped results */}
            {Object.entries(grouped).map(([type, items]) => {
              const config = getTypeConfig(type)
              return (
                <div key={type}>
                  <p className="text-[10px] font-semibold text-ink-400 uppercase tracking-wider px-4 pt-3 pb-1">
                    {config.label}
                  </p>
                  {items.map((item) => {
                    const globalIdx = flatResults.indexOf(item)
                    const isSelected = globalIdx === selectedIndex
                    const Icon = config.icon

                    return (
                      <button
                        key={`${item.type}-${item.id}`}
                        data-selected={isSelected}
                        onClick={() => {
                          router.push(item.link)
                          closeSearch()
                        }}
                        onMouseEnter={() => setSelectedIndex(globalIdx)}
                        className={cn(
                          'flex items-center gap-3 w-full px-4 py-2.5 text-left transition-colors',
                          isSelected ? 'bg-accent-50' : 'hover:bg-surface-50'
                        )}
                      >
                        <div className={cn(
                          'w-8 h-8 rounded-lg flex items-center justify-center shrink-0',
                          config.color
                        )}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className={cn(
                              'text-[12px] font-medium truncate',
                              isSelected ? 'text-accent-700' : 'text-ink-800'
                            )}>
                              {item.title}
                            </p>
                            <StatusBadge status={item.status} />
                          </div>
                          <p className="text-[10px] text-ink-400 truncate mt-0.5">
                            {item.projectName && item.type !== 'project' && (
                              <span className="text-ink-500">{item.projectName} &middot; </span>
                            )}
                            {item.description || ''}
                          </p>
                        </div>
                        {isSelected && (
                          <ArrowRight className="w-3.5 h-3.5 text-accent-400 shrink-0" />
                        )}
                      </button>
                    )
                  })}
                </div>
              )
            })}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-4 py-2 border-t border-surface-100 bg-surface-50/50">
            <div className="flex items-center gap-3">
              <span className="text-[10px] text-ink-300 flex items-center gap-1">
                <span className="font-mono">&uarr;&darr;</span> navigate
              </span>
              <span className="text-[10px] text-ink-300 flex items-center gap-1">
                <span className="font-mono">&crarr;</span> open
              </span>
              <span className="text-[10px] text-ink-300 flex items-center gap-1">
                <span className="font-mono">esc</span> close
              </span>
            </div>
            {query.length >= 2 && totalResults > 0 && (
              <button
                onClick={() => {
                  router.push(`/search?q=${encodeURIComponent(query)}`)
                  closeSearch()
                }}
                className="text-[10px] text-accent-500 hover:text-accent-600 font-medium flex items-center gap-1"
              >
                View all results <ArrowRight className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

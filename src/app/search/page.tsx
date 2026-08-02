'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Search, Loader2, X, Filter,
  FolderOpen, Users, CheckSquare, FileText,
  Pencil, Eye, ShieldCheck, Landmark,
  AlertCircle, HardHat, Wrench, CalendarDays,
  ArrowUpRight, ChevronLeft, ChevronRight,
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

/* ── Config ────────────────────────────────────────────── */

const TYPE_CONFIG: Record<string, {
  label: string
  icon: React.FC<{ className?: string }>
  color: string
  bg: string
}> = {
  project: { label: 'Projects', icon: FolderOpen, color: 'text-accent-500', bg: 'bg-accent-50' },
  person: { label: 'People', icon: Users, color: 'text-violet-500', bg: 'bg-violet-50' },
  task: { label: 'Tasks', icon: CheckSquare, color: 'text-blue-500', bg: 'bg-blue-50' },
  document: { label: 'Documents', icon: FileText, color: 'text-emerald-500', bg: 'bg-emerald-50' },
  drawing: { label: 'Drawings', icon: Pencil, color: 'text-amber-500', bg: 'bg-amber-50' },
  design_review: { label: 'Design Reviews', icon: Eye, color: 'text-indigo-500', bg: 'bg-indigo-50' },
  compliance: { label: 'Compliance', icon: ShieldCheck, color: 'text-teal-500', bg: 'bg-teal-50' },
  planning: { label: 'Planning', icon: Landmark, color: 'text-sky-500', bg: 'bg-sky-50' },
  observation: { label: 'Observations', icon: AlertCircle, color: 'text-orange-500', bg: 'bg-orange-50' },
  snag: { label: 'Snags', icon: HardHat, color: 'text-red-500', bg: 'bg-red-50' },
  service_request: { label: 'Requests', icon: Wrench, color: 'text-pink-500', bg: 'bg-pink-50' },
  leave: { label: 'Leave', icon: CalendarDays, color: 'text-cyan-500', bg: 'bg-cyan-50' },
}

const ALL_TYPES = Object.keys(TYPE_CONFIG)

function getTypeConfig(type: string) {
  return TYPE_CONFIG[type] || { label: type, icon: FileText, color: 'text-ink-400', bg: 'bg-surface-100' }
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
    'in progress': 'bg-blue-50 text-blue-600',
    draft: 'bg-slate-50 text-slate-500',
    approved: 'bg-emerald-50 text-emerald-600',
    submitted: 'bg-blue-50 text-blue-600',
    'not started': 'bg-slate-50 text-slate-500',
    blocked: 'bg-red-50 text-red-600',
    paused: 'bg-amber-50 text-amber-600',
  }
  const color = colorMap[s] || 'bg-surface-100 text-ink-500'
  return (
    <span className={cn('text-[9px] font-medium px-1.5 py-0.5 rounded uppercase tracking-wide', color)}>
      {s}
    </span>
  )
}

/* ── Page Content (needs Suspense for useSearchParams) ─── */

function SearchContent() {
  const searchParams = useSearchParams()
  const router = useRouter()

  const initialQuery = searchParams.get('q') || ''
  const initialType = searchParams.get('type') || ''

  const [query, setQuery] = useState(initialQuery)
  const [inputValue, setInputValue] = useState(initialQuery)
  const [typeFilter, setTypeFilter] = useState(initialType)
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const RESULTS_PER_PAGE = 20

  const doSearch = useCallback(async (q: string, type: string) => {
    if (q.length < 2) {
      setResults([])
      return
    }
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ q, limit: '20' })
      if (type) params.set('type', type)
      const res = await fetch(`/api/search?${params}`)
      if (!res.ok) throw new Error('Search failed')
      const json = await res.json()
      setResults(json.data.results || [])
    } catch {
      setError('Search unavailable. Please try again.')
      setResults([])
    } finally {
      setLoading(false)
    }
  }, [])

  // Initial search on mount
  useEffect(() => {
    if (initialQuery.length >= 2) {
      doSearch(initialQuery, initialType)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Re-search when type filter changes
  useEffect(() => {
    if (query.length >= 2) {
      doSearch(query, typeFilter)
      setPage(1)
    }
  }, [typeFilter]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setQuery(inputValue)
    setPage(1)
    doSearch(inputValue, typeFilter)
    // Update URL without navigation
    const url = new URL(window.location.href)
    url.searchParams.set('q', inputValue)
    if (typeFilter) url.searchParams.set('type', typeFilter)
    else url.searchParams.delete('type')
    window.history.replaceState({}, '', url.toString())
  }

  // ── Paginate ───────────────────────────────────────────
  const filteredResults = typeFilter
    ? results.filter(r => r.type === typeFilter)
    : results

  const totalPages = Math.max(1, Math.ceil(filteredResults.length / RESULTS_PER_PAGE))
  const pagedResults = filteredResults.slice(
    (page - 1) * RESULTS_PER_PAGE,
    page * RESULTS_PER_PAGE
  )

  // ── Type counts ────────────────────────────────────────
  const typeCounts = results.reduce<Record<string, number>>((acc, r) => {
    acc[r.type] = (acc[r.type] || 0) + 1
    return acc
  }, {})

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-[22px] font-semibold text-ink-900">Search</h1>
        <p className="text-[13px] text-ink-400 mt-1">
          Search across all projects, tasks, documents and more
        </p>
      </div>

      {/* Search bar */}
      <form onSubmit={handleSubmit} className="flex items-center gap-2">
        <div className="flex-1 flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-white border border-surface-200 focus-within:border-accent-300 focus-within:ring-2 focus-within:ring-accent-100 transition-all">
          <Search className="w-4 h-4 text-ink-300 shrink-0" />
          <input
            type="text"
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            placeholder="Search projects, tasks, documents, people..."
            className="flex-1 text-[13px] text-ink-900 placeholder:text-ink-300 bg-transparent outline-none"
            autoFocus
          />
          {inputValue && (
            <button
              type="button"
              onClick={() => {
                setInputValue('')
                setQuery('')
                setResults([])
              }}
              className="text-ink-300 hover:text-ink-500"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <button
          type="submit"
          className="px-4 py-2.5 rounded-xl bg-accent-500 text-white text-[12px] font-semibold hover:bg-accent-600 transition-colors"
        >
          Search
        </button>
      </form>

      {/* Type filter pills */}
      {results.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setTypeFilter('')}
            className={cn(
              'px-3 py-1.5 rounded-lg text-[11px] font-medium transition-colors border',
              !typeFilter
                ? 'bg-accent-50 text-accent-600 border-accent-200'
                : 'bg-white text-ink-500 border-surface-200 hover:bg-surface-50'
            )}
          >
            All ({results.length})
          </button>
          {Object.entries(typeCounts)
            .sort(([, a], [, b]) => b - a)
            .map(([type, count]) => {
              const config = getTypeConfig(type)
              return (
                <button
                  key={type}
                  onClick={() => setTypeFilter(typeFilter === type ? '' : type)}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-[11px] font-medium transition-colors border',
                    typeFilter === type
                      ? 'bg-accent-50 text-accent-600 border-accent-200'
                      : 'bg-white text-ink-500 border-surface-200 hover:bg-surface-50'
                  )}
                >
                  {config.label} ({count})
                </button>
              )
            })}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-5 h-5 text-accent-500 animate-spin" />
          <span className="ml-2 text-[12px] text-ink-400">Searching...</span>
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div className="bg-white rounded-xl border border-red-200 p-8 text-center">
          <AlertCircle className="w-6 h-6 text-red-400 mx-auto mb-2" />
          <p className="text-[12px] text-red-500">{error}</p>
        </div>
      )}

      {/* No results */}
      {!loading && !error && query.length >= 2 && filteredResults.length === 0 && (
        <div className="bg-white rounded-xl border border-surface-200 p-12 text-center">
          <Search className="w-10 h-10 text-ink-200 mx-auto mb-3" />
          <p className="text-[14px] font-medium text-ink-600">No results for &ldquo;{query}&rdquo;</p>
          <p className="text-[12px] text-ink-400 mt-1 max-w-sm mx-auto">
            Try different keywords or check the spelling.
            You can also filter by type using the pills above.
          </p>
        </div>
      )}

      {/* Results list */}
      {!loading && !error && pagedResults.length > 0 && (
        <div className="space-y-2">
          {pagedResults.map((item) => {
            const config = getTypeConfig(item.type)
            const Icon = config.icon

            return (
              <Link
                key={`${item.type}-${item.id}`}
                href={item.link}
                className="flex items-center gap-4 px-5 py-3.5 rounded-xl bg-white border border-surface-200 hover:border-accent-200 hover:shadow-sm transition-all group"
              >
                <div className={cn(
                  'w-10 h-10 rounded-xl flex items-center justify-center shrink-0',
                  config.bg
                )}>
                  <Icon className={cn('w-5 h-5', config.color)} />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-[13px] font-medium text-ink-800 group-hover:text-accent-600 transition-colors truncate">
                      {item.title}
                    </p>
                    <StatusBadge status={item.status} />
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={cn('text-[10px] font-medium uppercase tracking-wider px-1.5 py-0.5 rounded', config.bg, config.color)}>
                      {config.label}
                    </span>
                    {item.projectName && item.type !== 'project' && (
                      <span className="text-[11px] text-ink-400">
                        {item.projectName}
                      </span>
                    )}
                    {item.description && (
                      <>
                        <span className="text-ink-200">&middot;</span>
                        <span className="text-[11px] text-ink-400 truncate">
                          {item.description}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                <ArrowUpRight className="w-4 h-4 text-ink-300 group-hover:text-accent-500 shrink-0 transition-colors" />
              </Link>
            )
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className={cn(
              'px-3 py-1.5 rounded-lg text-[11px] font-medium border transition-colors',
              page === 1
                ? 'text-ink-300 border-surface-100 cursor-not-allowed'
                : 'text-ink-600 border-surface-200 hover:bg-surface-50'
            )}
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <span className="text-[11px] text-ink-500 tabular-nums">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className={cn(
              'px-3 py-1.5 rounded-lg text-[11px] font-medium border transition-colors',
              page === totalPages
                ? 'text-ink-300 border-surface-100 cursor-not-allowed'
                : 'text-ink-600 border-surface-200 hover:bg-surface-50'
            )}
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Empty initial state */}
      {!loading && !error && query.length < 2 && results.length === 0 && (
        <div className="bg-white rounded-xl border border-surface-200 p-12 text-center">
          <Search className="w-10 h-10 text-ink-200 mx-auto mb-3" />
          <p className="text-[14px] font-medium text-ink-600">Enter a search term</p>
          <p className="text-[12px] text-ink-400 mt-1 max-w-sm mx-auto">
            Search across projects, tasks, documents, people, observations, snags and more.
            Use <kbd className="px-1 py-0.5 text-[10px] font-mono bg-surface-100 rounded border border-surface-200">Cmd+K</kbd> to search from anywhere.
          </p>
        </div>
      )}
    </div>
  )
}

/* ── Page wrapper with Suspense ────────────────────────── */

export default function SearchPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-5 h-5 text-accent-500 animate-spin" />
      </div>
    }>
      <SearchContent />
    </Suspense>
  )
}

'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { FileText, Plus, Loader2, AlertTriangle, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { SkeletonRow } from '@/components/Skeleton'

/* ── Types ─────────────────────────────────────────────── */

interface FeeQuote {
  id: string
  quoteNumber: string
  title: string
  clientName: string
  netTotal: number
  grossTotal: number
  currency: string
  status: string
  createdAt: string
  validUntil: string | null
  createdBy: { id: string; fullName: string }
  project: { id: string; name: string; code: string | null } | null
  _count: { lineItems: number }
}

type FilterStatus = 'ALL' | 'DRAFT' | 'SENT' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED' | 'SUPERSEDED'

const STATUS_FILTERS: { value: FilterStatus; label: string }[] = [
  { value: 'ALL', label: 'All' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'SENT', label: 'Sent' },
  { value: 'ACCEPTED', label: 'Accepted' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'EXPIRED', label: 'Expired' },
]

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  DRAFT: { label: 'Draft', color: 'text-ink-500', bg: 'bg-ink-100' },
  SENT: { label: 'Sent', color: 'text-blue-600', bg: 'bg-blue-50' },
  ACCEPTED: { label: 'Accepted', color: 'text-emerald-600', bg: 'bg-emerald-50' },
  REJECTED: { label: 'Rejected', color: 'text-red-600', bg: 'bg-red-50' },
  EXPIRED: { label: 'Expired', color: 'text-amber-600', bg: 'bg-amber-50' },
  SUPERSEDED: { label: 'Superseded', color: 'text-ink-400', bg: 'bg-ink-50' },
}

/* ── Helpers ───────────────────────────────────────────── */

function formatAmount(amount: number, currency: string): string {
  const localeMap: Record<string, string> = { NGN: 'en-NG', GBP: 'en-GB', USD: 'en-US', EUR: 'de-DE' }
  return new Intl.NumberFormat(localeMap[currency] || 'en-GB', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amount)
}

function StatusBadge({ status }: { status: string }) {
  const meta = STATUS_META[status] || { label: status, color: 'text-ink-500', bg: 'bg-ink-100' }
  return (
    <span className={cn('text-[11px] font-medium px-2.5 py-0.5 rounded-full', meta.bg, meta.color)}>
      {meta.label}
    </span>
  )
}

/* ── Page ──────────────────────────────────────────────── */

export default function FeeQuotesPage() {
  const [quotes, setQuotes] = useState<FeeQuote[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('ALL')

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/fee-quotes')
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error?.message || body.error || 'Failed to load fee quotes')
      }
      const json = await res.json()
      setQuotes(json.data.quotes)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const filtered = statusFilter === 'ALL'
    ? quotes
    : quotes.filter(q => q.status === statusFilter)

  /* ── Render ──────────────────────────────────────── */

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold text-ink-900">Fee Quotes</h1>
          <p className="text-[13px] text-ink-400 mt-1">Create and manage fee proposals for your projects</p>
        </div>
        <Link
          href="/fee-quotes/new"
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-ink-900 text-white text-[13px] font-medium hover:bg-ink-800 transition-colors self-start shrink-0"
        >
          <Plus className="w-4 h-4" />
          New Quote
        </Link>
      </div>

      {/* Status filter tabs */}
      <div className="flex gap-1 flex-wrap">
        {STATUS_FILTERS.map(f => (
          <button
            key={f.value}
            onClick={() => setStatusFilter(f.value)}
            className={cn(
              'px-3 py-1.5 rounded-lg text-[12px] font-medium transition-colors',
              statusFilter === f.value
                ? 'bg-ink-900 text-white'
                : 'bg-ink-50 text-ink-500 hover:bg-ink-100',
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Error state */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-[13px] text-red-700">{error}</p>
          </div>
          <button onClick={fetchData} className="text-red-600 hover:text-red-700">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="bg-white rounded-xl border border-ink-100 divide-y divide-ink-50">
          {[1, 2, 3].map(i => <SkeletonRow key={i} />)}
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && filtered.length === 0 && (
        <div className="bg-white rounded-xl border border-ink-100 p-12 text-center">
          <FileText className="w-12 h-12 text-ink-200 mx-auto mb-4" />
          <p className="text-[15px] font-medium text-ink-700">
            {statusFilter === 'ALL' ? 'No fee quotes yet' : `No ${STATUS_META[statusFilter]?.label.toLowerCase() || statusFilter.toLowerCase()} quotes`}
          </p>
          <p className="text-[12px] text-ink-400 mt-2 max-w-md mx-auto">
            Fee quotes will appear here once you create your first proposal. Each quote tracks line items, stages, and approval status.
          </p>
        </div>
      )}

      {/* Quotes table */}
      {!loading && !error && filtered.length > 0 && (
        <div className="bg-white rounded-xl border border-ink-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-ink-100 bg-ink-25">
                  <th className="text-left px-4 py-3 font-medium text-ink-500">Quote #</th>
                  <th className="text-left px-4 py-3 font-medium text-ink-500">Title</th>
                  <th className="text-left px-4 py-3 font-medium text-ink-500">Client</th>
                  <th className="text-left px-4 py-3 font-medium text-ink-500">Project</th>
                  <th className="text-right px-4 py-3 font-medium text-ink-500">Net Total</th>
                  <th className="text-center px-4 py-3 font-medium text-ink-500">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-ink-500">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-50">
                {filtered.map(q => (
                  <tr key={q.id} className="hover:bg-ink-25 transition-colors">
                    <td className="px-4 py-3">
                      <Link href={`/fee-quotes/${q.id}`} className="text-accent-600 hover:text-accent-700 font-medium">
                        {q.quoteNumber}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-ink-700">
                      <Link href={`/fee-quotes/${q.id}`} className="hover:text-ink-900">
                        {q.title}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-ink-500">{q.clientName}</td>
                    <td className="px-4 py-3 text-ink-500">
                      {q.project ? (q.project.code || q.project.name) : '-'}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-ink-700">
                      {formatAmount(q.netTotal, q.currency)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <StatusBadge status={q.status} />
                    </td>
                    <td className="px-4 py-3 text-ink-400">
                      {new Date(q.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

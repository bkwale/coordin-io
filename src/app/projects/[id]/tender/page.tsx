'use client'

import { useParams } from 'next/navigation'
import Link from 'next/link'
import {
  FileText, Plus, Loader2, AlertTriangle, DollarSign,
  Calendar, Users, Award, ExternalLink, Package,
} from 'lucide-react'
import { cn, formatDate, formatCurrency } from '@/lib/utils'
import { useApiFetch } from '@/hooks/use-api'
import { SkeletonCard } from '@/components/Skeleton'

/* ══════════════════════════════════════════════════════════
   Types
   ══════════════════════════════════════════════════════════ */

interface TenderItem {
  id: string
  packageName: string
  discipline: string
  estimatedValue: number
  status: 'PREPARATION' | 'ISSUED' | 'RETURNED' | 'EVALUATION' | 'AWARDED' | 'CANCELLED'
  issueDate: string | null
  returnDate: string | null
  bidsReceived: number
  awardedTo: string | null
  createdAt: string
}

/* ══════════════════════════════════════════════════════════
   Constants & Helpers
   ══════════════════════════════════════════════════════════ */

const STATUS_LABELS: Record<TenderItem['status'], string> = {
  PREPARATION: 'Preparation',
  ISSUED: 'Issued',
  RETURNED: 'Returned',
  EVALUATION: 'Evaluation',
  AWARDED: 'Awarded',
  CANCELLED: 'Cancelled',
}

const STATUS_COLORS: Record<TenderItem['status'], string> = {
  PREPARATION: 'bg-slate-50 text-slate-500',
  ISSUED: 'bg-blue-50 text-blue-600',
  RETURNED: 'bg-amber-50 text-amber-600',
  EVALUATION: 'bg-violet-50 text-violet-600',
  AWARDED: 'bg-emerald-50 text-emerald-600',
  CANCELLED: 'bg-red-50 text-red-600',
}

const IN_PROGRESS_STATUSES: TenderItem['status'][] = [
  'PREPARATION', 'ISSUED', 'RETURNED', 'EVALUATION',
]

/* ══════════════════════════════════════════════════════════
   Summary Cards
   ══════════════════════════════════════════════════════════ */

function SummaryCards({ tenders }: { tenders: TenderItem[] }) {
  const total = tenders.length
  const inProgress = tenders.filter(t => IN_PROGRESS_STATUSES.includes(t.status)).length
  const awarded = tenders.filter(t => t.status === 'AWARDED').length
  const totalValue = tenders.reduce((sum, t) => sum + t.estimatedValue, 0)

  const cards = [
    {
      label: 'Total Tenders',
      value: total.toString(),
      icon: FileText,
      color: 'text-ink-600',
      bg: 'bg-ink-50',
    },
    {
      label: 'In Progress',
      value: inProgress.toString(),
      icon: Package,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
    },
    {
      label: 'Awarded',
      value: awarded.toString(),
      icon: Award,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
    },
    {
      label: 'Total Value',
      value: formatCurrency(totalValue),
      icon: DollarSign,
      color: 'text-violet-600',
      bg: 'bg-violet-50',
    },
  ]

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {cards.map(c => (
        <div
          key={c.label}
          className="bg-white rounded-2xl border border-surface-200 shadow-card p-4"
        >
          <div className="flex items-center gap-2 mb-2">
            <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center', c.bg)}>
              <c.icon className={cn('w-3.5 h-3.5', c.color)} />
            </div>
            <span className="text-[12px] text-ink-400">{c.label}</span>
          </div>
          <p className="text-[15px] font-semibold text-ink-900">{c.value}</p>
        </div>
      ))}
    </div>
  )
}

/* ══════════════════════════════════════════════════════════
   Tender Row
   ══════════════════════════════════════════════════════════ */

function TenderRow({ tender, projectId }: { tender: TenderItem; projectId: string }) {
  return (
    <Link
      href={`/projects/${projectId}/contract-admin`}
      className="block bg-white rounded-2xl border border-surface-200 shadow-card p-4 hover:border-brand-300 hover:shadow-md transition-all"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-brand-50 flex items-center justify-center shrink-0">
            <Package className="w-4 h-4 text-brand-600" />
          </div>
          <div className="min-w-0">
            <h3 className="text-[15px] font-medium text-ink-900 truncate">
              {tender.packageName}
            </h3>
            <p className="text-[12px] text-ink-400">{tender.discipline}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span
            className={cn(
              'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium',
              STATUS_COLORS[tender.status],
            )}
          >
            {STATUS_LABELS[tender.status]}
          </span>
          <ExternalLink className="w-3.5 h-3.5 text-ink-300" />
        </div>
      </div>

      {/* Details grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Estimated Value */}
        <div className="flex items-center gap-1.5">
          <DollarSign className="w-3.5 h-3.5 text-ink-300 shrink-0" />
          <div>
            <p className="text-[10px] text-ink-400 uppercase tracking-wide">Est. Value</p>
            <p className="text-[12px] font-medium text-ink-700">
              {formatCurrency(tender.estimatedValue)}
            </p>
          </div>
        </div>

        {/* Issue Date */}
        <div className="flex items-center gap-1.5">
          <Calendar className="w-3.5 h-3.5 text-ink-300 shrink-0" />
          <div>
            <p className="text-[10px] text-ink-400 uppercase tracking-wide">Issue Date</p>
            <p className="text-[12px] font-medium text-ink-700">
              {tender.issueDate ? formatDate(tender.issueDate) : '—'}
            </p>
          </div>
        </div>

        {/* Return Date */}
        <div className="flex items-center gap-1.5">
          <Calendar className="w-3.5 h-3.5 text-ink-300 shrink-0" />
          <div>
            <p className="text-[10px] text-ink-400 uppercase tracking-wide">Return Date</p>
            <p className="text-[12px] font-medium text-ink-700">
              {tender.returnDate ? formatDate(tender.returnDate) : '—'}
            </p>
          </div>
        </div>

        {/* Bids / Awarded */}
        <div className="flex items-center gap-1.5">
          <Users className="w-3.5 h-3.5 text-ink-300 shrink-0" />
          <div>
            <p className="text-[10px] text-ink-400 uppercase tracking-wide">
              {tender.awardedTo ? 'Awarded To' : 'Bids Received'}
            </p>
            <p className="text-[12px] font-medium text-ink-700">
              {tender.awardedTo || tender.bidsReceived}
            </p>
          </div>
        </div>
      </div>
    </Link>
  )
}

/* ══════════════════════════════════════════════════════════
   Empty State
   ══════════════════════════════════════════════════════════ */

function EmptyState({ projectId }: { projectId: string }) {
  return (
    <div className="bg-white rounded-2xl border border-surface-200 shadow-card p-8 text-center">
      <div className="w-12 h-12 rounded-xl bg-surface-100 flex items-center justify-center mx-auto mb-4">
        <Package className="w-6 h-6 text-ink-300" />
      </div>
      <h3 className="text-[15px] font-medium text-ink-900 mb-1">No tenders yet</h3>
      <p className="text-[12px] text-ink-400 mb-4 max-w-sm mx-auto">
        Create tender packages from the Contract Admin page to manage procurement across your project.
      </p>
      <Link
        href={`/projects/${projectId}/contract-admin`}
        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-brand-600 text-white text-[12px] font-medium hover:bg-brand-700 transition-colors"
      >
        <Plus className="w-3.5 h-3.5" />
        Create Tender
      </Link>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════
   Error State
   ══════════════════════════════════════════════════════════ */

function ErrorState({ message, projectId }: { message: string; projectId: string }) {
  return (
    <div className="bg-white rounded-2xl border border-surface-200 shadow-card p-8 text-center">
      <div className="w-12 h-12 rounded-xl bg-red-50 flex items-center justify-center mx-auto mb-4">
        <AlertTriangle className="w-6 h-6 text-red-500" />
      </div>
      <h3 className="text-[15px] font-medium text-ink-900 mb-1">Failed to load tenders</h3>
      <p className="text-[12px] text-ink-400 mb-4 max-w-sm mx-auto">{message}</p>
      <Link
        href={`/projects/${projectId}/contract-admin`}
        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-brand-600 text-white text-[12px] font-medium hover:bg-brand-700 transition-colors"
      >
        <Plus className="w-3.5 h-3.5" />
        Create Tender
      </Link>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════
   Loading State
   ══════════════════════════════════════════════════════════ */

function LoadingState() {
  return (
    <div className="space-y-4">
      {/* Summary skeleton */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
      {/* Row skeletons */}
      {Array.from({ length: 3 }).map((_, i) => (
        <SkeletonCard key={`row-${i}`} />
      ))}
    </div>
  )
}

/* ══════════════════════════════════════════════════════════
   Page
   ══════════════════════════════════════════════════════════ */

export default function TenderPage() {
  const { id } = useParams<{ id: string }>()

  const { data: tenders, loading, error } = useApiFetch<TenderItem[]>(
    `/api/projects/${id}/commercial/tenders`,
  )

  /* ── Loading ─────────────────────────────────────────── */

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-50 p-4 lg:p-6">
        <div className="flex items-center gap-2 mb-6">
          <Loader2 className="w-4 h-4 animate-spin text-brand-600" />
          <span className="text-[12px] text-ink-400">Loading tenders…</span>
        </div>
        <LoadingState />
      </div>
    )
  }

  /* ── Error ───────────────────────────────────────────── */

  if (error) {
    return (
      <div className="min-h-screen bg-surface-50 p-4 lg:p-6">
        <h1 className="text-[15px] font-semibold text-ink-900 mb-6">Tender Management</h1>
        <ErrorState message={error} projectId={id} />
      </div>
    )
  }

  /* ── Empty ───────────────────────────────────────────── */

  if (!tenders || tenders.length === 0) {
    return (
      <div className="min-h-screen bg-surface-50 p-4 lg:p-6">
        <h1 className="text-[15px] font-semibold text-ink-900 mb-6">Tender Management</h1>
        <EmptyState projectId={id} />
      </div>
    )
  }

  /* ── List ─────────────────────────────────────────────── */

  return (
    <div className="min-h-screen bg-surface-50 p-4 lg:p-6">
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[15px] font-semibold text-ink-900">Tender Management</h1>
          <p className="text-[12px] text-ink-400 mt-0.5">
            {tenders.length} tender{tenders.length !== 1 ? 's' : ''} across all packages
          </p>
        </div>
        <Link
          href={`/projects/${id}/contract-admin`}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-600 text-white text-[12px] font-medium hover:bg-brand-700 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          New Tender
        </Link>
      </div>

      {/* Summary cards */}
      <div className="mb-6">
        <SummaryCards tenders={tenders} />
      </div>

      {/* Tender list */}
      <div className="space-y-3">
        {tenders.map(tender => (
          <TenderRow key={tender.id} tender={tender} projectId={id} />
        ))}
      </div>

      {/* Footer link */}
      <div className="mt-6 text-center">
        <Link
          href={`/projects/${id}/contract-admin`}
          className="inline-flex items-center gap-1.5 text-[12px] text-brand-600 hover:text-brand-700 font-medium transition-colors"
        >
          <FileText className="w-3.5 h-3.5" />
          Open full Contract Admin
          <ExternalLink className="w-3 h-3" />
        </Link>
      </div>
    </div>
  )
}

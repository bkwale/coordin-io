'use client'

import { useEffect, useState } from 'react'
import {
  BarChart3, Loader2, AlertTriangle, RefreshCw,
  Send, Inbox, Award, Clock,
} from 'lucide-react'
import { cn } from '@/lib/utils'

/* ── Types ────────────────────────────────────────────────── */

interface TenderReturn {
  id: string
  contractorName: string
  amount: number | null
  recommended: boolean
  createdAt: string
}

interface Tender {
  id: string
  packageName: string
  status: string
  estimatedValue: number | null
  currency: string
  issueDate: string | null
  returnDate: string | null
  projectId: string
  returns: TenderReturn[]
  createdAt: string
}

interface Project {
  id: string
  name: string
  code: string
}

/* ── Helpers ──────────────────────────────────────────────── */

const fmt = new Intl.NumberFormat('en-GB', {
  style: 'currency',
  currency: 'GBP',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

function pct(value: number, total: number): number {
  if (total === 0) return 0
  return Math.min(100, Math.round((value / total) * 100))
}

const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-slate-100 text-slate-600',
  ISSUED: 'bg-blue-50 text-blue-600',
  RETURNS_RECEIVED: 'bg-amber-50 text-amber-600',
  UNDER_EVALUATION: 'bg-violet-50 text-violet-600',
  AWARDED: 'bg-emerald-50 text-emerald-600',
  CANCELLED: 'bg-red-50 text-red-600',
}

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Draft',
  ISSUED: 'Issued',
  RETURNS_RECEIVED: 'Returns Received',
  UNDER_EVALUATION: 'Under Evaluation',
  AWARDED: 'Awarded',
  CANCELLED: 'Cancelled',
}

/* ── Component ────────────────────────────────────────────── */

export default function QuoteAnalyticsPage() {
  const [tenders, setTenders] = useState<Tender[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState({ done: 0, total: 0 })

  async function fetchData() {
    setLoading(true)
    setError(null)
    setProgress({ done: 0, total: 0 })

    try {
      // Step 1: Get all projects
      const projRes = await fetch('/api/projects')
      if (!projRes.ok) throw new Error('Failed to load projects')
      const projJson = await projRes.json()
      const projects: Project[] = projJson.data?.projects ?? []

      if (projects.length === 0) {
        setTenders([])
        setLoading(false)
        return
      }

      setProgress({ done: 0, total: projects.length })

      // Step 2: Fetch tenders for each project
      const allTenders: Tender[] = []
      for (const project of projects) {
        try {
          const res = await fetch(`/api/projects/${project.id}/commercial/tenders`)
          if (res.ok) {
            const json = await res.json()
            const projectTenders = json.data?.tenders ?? []
            allTenders.push(...projectTenders)
          }
        } catch {
          // Skip projects with no tender data
        }
        setProgress(prev => ({ ...prev, done: prev.done + 1 }))
      }

      setTenders(allTenders)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [])

  /* ── Loading state ──────────────────────────────────────── */

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <Loader2 className="w-8 h-8 text-accent-500 animate-spin" />
        <p className="text-[13px] text-ink-400">
          {progress.total > 0
            ? `Loading tender data... ${progress.done}/${progress.total} projects`
            : 'Loading quote analytics...'}
        </p>
      </div>
    )
  }

  /* ── Error state ────────────────────────────────────────── */

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <AlertTriangle className="w-10 h-10 text-red-400" />
        <p className="text-[15px] font-medium text-ink-900">Unable to load quote analytics</p>
        <p className="text-[13px] text-ink-400">{error}</p>
        <button onClick={fetchData} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-ink-900 text-white text-[13px] font-medium hover:bg-ink-800">
          <RefreshCw className="w-4 h-4" /> Try again
        </button>
      </div>
    )
  }

  /* ── Empty state ────────────────────────────────────────── */

  if (tenders.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-[22px] font-semibold text-ink-900">Quote Analytics</h1>
          <p className="text-[13px] text-ink-400 mt-1">Conversion rates, pipeline value, and quote performance</p>
        </div>
        <div className="bg-white rounded-xl border border-ink-100 p-12 text-center">
          <BarChart3 className="w-12 h-12 text-ink-200 mx-auto mb-4" />
          <p className="text-[15px] font-medium text-ink-700">No quote data yet</p>
          <p className="text-[12px] text-ink-400 mt-2 max-w-md mx-auto">
            Add budgets to your projects to see analytics here.
          </p>
        </div>
      </div>
    )
  }

  /* ── Compute analytics ──────────────────────────────────── */

  // Status breakdown
  const statusCounts: Record<string, number> = {}
  for (const t of tenders) {
    statusCounts[t.status] = (statusCounts[t.status] || 0) + 1
  }

  // Core stats
  const totalPackages = tenders.length
  const issuedOrBeyond = tenders.filter(t => t.status !== 'DRAFT' && t.status !== 'CANCELLED')
  const packagesOut = issuedOrBeyond.length
  const tendersWithReturns = tenders.filter(t => t.returns.length > 0)
  const totalReturns = tenders.reduce((sum, t) => sum + t.returns.length, 0)
  const awardedTenders = tenders.filter(t => t.status === 'AWARDED')
  const awardRate = packagesOut > 0 ? pct(awardedTenders.length, packagesOut) : 0

  // Estimated vs returned comparison
  const tendersWithBothValues = tenders.filter(t =>
    t.estimatedValue && t.estimatedValue > 0 &&
    t.returns.some(r => r.amount && r.amount > 0)
  )

  let avgEstimate = 0
  let avgReturn = 0
  if (tendersWithBothValues.length > 0) {
    avgEstimate = tendersWithBothValues.reduce((sum, t) => sum + (t.estimatedValue || 0), 0) / tendersWithBothValues.length
    avgReturn = tendersWithBothValues.reduce((sum, t) => {
      const returnAmounts = t.returns.filter(r => r.amount && r.amount > 0).map(r => r.amount!)
      return sum + (returnAmounts.reduce((a, b) => a + b, 0) / returnAmounts.length)
    }, 0) / tendersWithBothValues.length
  }

  const maxEstReturn = Math.max(avgEstimate, avgReturn, 1)

  // Active tenders (not draft, not cancelled, not awarded)
  const activeTenders = tenders.filter(t =>
    ['ISSUED', 'RETURNS_RECEIVED', 'UNDER_EVALUATION'].includes(t.status)
  )

  // Status order for display
  const statusOrder = ['DRAFT', 'ISSUED', 'RETURNS_RECEIVED', 'UNDER_EVALUATION', 'AWARDED', 'CANCELLED']
  const orderedStatuses = statusOrder.filter(s => statusCounts[s] && statusCounts[s] > 0)

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-[22px] font-semibold text-ink-900">Quote Analytics</h1>
        <p className="text-[13px] text-ink-400 mt-1">
          {totalPackages} tender package{totalPackages !== 1 ? 's' : ''} across all projects
        </p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Packages out', value: String(packagesOut), icon: Send, accent: 'bg-blue-50 text-blue-600' },
          { label: 'Returns received', value: String(totalReturns), icon: Inbox, accent: 'bg-amber-50 text-amber-600' },
          { label: 'Award rate', value: `${awardRate}%`, icon: Award, accent: awardRate > 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-ink-50 text-ink-400' },
          { label: 'Active tenders', value: String(activeTenders.length), icon: Clock, accent: activeTenders.length > 0 ? 'bg-violet-50 text-violet-600' : 'bg-ink-50 text-ink-400' },
        ].map(({ label, value, icon: Icon, accent }) => (
          <div key={label} className="bg-white rounded-xl border border-ink-100 p-5 flex items-start gap-4">
            <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center shrink-0', accent)}>
              <Icon className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[28px] font-semibold text-ink-900 leading-tight">{value}</p>
              <p className="text-[12px] text-ink-400 mt-0.5">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Tender status breakdown + Estimate vs Return */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Status breakdown */}
        <section>
          <h2 className="text-[15px] font-semibold text-ink-900 mb-3">Tender Status Breakdown</h2>
          <div className="bg-white rounded-xl border border-ink-100 p-6">
            {/* Stacked bar */}
            <div className="h-8 rounded-lg overflow-hidden flex mb-4">
              {orderedStatuses.map(status => {
                const count = statusCounts[status] || 0
                const width = pct(count, totalPackages)
                const colors: Record<string, string> = {
                  DRAFT: 'bg-slate-300',
                  ISSUED: 'bg-blue-400',
                  RETURNS_RECEIVED: 'bg-amber-400',
                  UNDER_EVALUATION: 'bg-violet-400',
                  AWARDED: 'bg-emerald-400',
                  CANCELLED: 'bg-red-300',
                }
                return (
                  <div
                    key={status}
                    className={cn('h-full transition-all', colors[status] || 'bg-ink-200')}
                    style={{ width: `${width}%` }}
                    title={`${STATUS_LABELS[status] || status}: ${count}`}
                  />
                )
              })}
            </div>

            {/* Legend */}
            <div className="space-y-2">
              {orderedStatuses.map(status => {
                const count = statusCounts[status] || 0
                return (
                  <div key={status} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={cn('px-2 py-0.5 rounded text-[11px] font-medium', STATUS_COLORS[status] || 'bg-ink-50 text-ink-500')}>
                        {STATUS_LABELS[status] || status}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-semibold text-ink-700">{count}</span>
                      <span className="text-[11px] text-ink-400">({pct(count, totalPackages)}%)</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </section>

        {/* Estimate vs Return comparison */}
        <section>
          <h2 className="text-[15px] font-semibold text-ink-900 mb-3">Average Estimate vs Return</h2>
          <div className="bg-white rounded-xl border border-ink-100 p-6">
            {tendersWithBothValues.length === 0 ? (
              <div className="text-center py-6">
                <BarChart3 className="w-8 h-8 text-ink-200 mx-auto mb-2" />
                <p className="text-[13px] text-ink-400">Not enough data for comparison</p>
                <p className="text-[11px] text-ink-300 mt-1">
                  Requires tenders with both estimated values and returns
                </p>
              </div>
            ) : (
              <div className="space-y-5">
                {/* Estimate bar */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[13px] font-medium text-ink-700">Estimated value</span>
                    <span className="text-[13px] text-ink-500">{fmt.format(avgEstimate)}</span>
                  </div>
                  <div className="h-7 bg-ink-50 rounded overflow-hidden">
                    <div
                      className="h-full bg-blue-400 rounded transition-all duration-700"
                      style={{ width: `${pct(avgEstimate, maxEstReturn)}%` }}
                    />
                  </div>
                </div>

                {/* Return bar */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[13px] font-medium text-ink-700">Average return</span>
                    <span className="text-[13px] text-ink-500">{fmt.format(avgReturn)}</span>
                  </div>
                  <div className="h-7 bg-ink-50 rounded overflow-hidden">
                    <div
                      className={cn('h-full rounded transition-all duration-700',
                        avgReturn > avgEstimate ? 'bg-red-400' : 'bg-emerald-400'
                      )}
                      style={{ width: `${pct(avgReturn, maxEstReturn)}%` }}
                    />
                  </div>
                </div>

                {/* Variance indicator */}
                <div className="pt-3 border-t border-ink-50">
                  {avgEstimate > 0 && (
                    <div className="flex items-center gap-2">
                      <span className={cn('text-[13px] font-semibold',
                        avgReturn <= avgEstimate ? 'text-emerald-600' : 'text-red-600'
                      )}>
                        {avgReturn <= avgEstimate
                          ? `${pct(avgEstimate - avgReturn, avgEstimate)}% below estimate`
                          : `${pct(avgReturn - avgEstimate, avgEstimate)}% above estimate`
                        }
                      </span>
                      <span className="text-[11px] text-ink-400">
                        (based on {tendersWithBothValues.length} tender{tendersWithBothValues.length !== 1 ? 's' : ''})
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Active tenders timeline */}
      <section>
        <h2 className="text-[15px] font-semibold text-ink-900 mb-3">
          Active Tenders
          <span className="ml-2 text-[12px] font-medium text-ink-400">{activeTenders.length}</span>
        </h2>
        <div className="bg-white rounded-xl border border-ink-100">
          {activeTenders.length === 0 ? (
            <div className="p-8 text-center">
              <Clock className="w-8 h-8 text-ink-200 mx-auto mb-2" />
              <p className="text-[13px] text-ink-400">No active tenders</p>
            </div>
          ) : (
            <div className="divide-y divide-ink-50">
              {activeTenders.map(tender => {
                const now = new Date()
                const returnDate = tender.returnDate ? new Date(tender.returnDate) : null
                const isOverdue = returnDate && returnDate < now
                const daysLeft = returnDate
                  ? Math.ceil((returnDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
                  : null

                return (
                  <div key={tender.id} className="px-5 py-3.5 flex items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium text-ink-900 truncate">{tender.packageName}</p>
                      <div className="flex items-center gap-3 mt-1">
                        <span className={cn('px-2 py-0.5 rounded text-[11px] font-medium',
                          STATUS_COLORS[tender.status] || 'bg-ink-50 text-ink-500'
                        )}>
                          {STATUS_LABELS[tender.status] || tender.status}
                        </span>
                        {tender.returns.length > 0 && (
                          <span className="text-[11px] text-ink-400">
                            {tender.returns.length} return{tender.returns.length !== 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      {tender.estimatedValue && (
                        <p className="text-[13px] font-medium text-ink-700">{fmt.format(tender.estimatedValue)}</p>
                      )}
                      {daysLeft !== null && (
                        <p className={cn('text-[11px] mt-0.5',
                          isOverdue ? 'text-red-600 font-medium' : daysLeft <= 7 ? 'text-amber-600' : 'text-ink-400'
                        )}>
                          {isOverdue
                            ? `${Math.abs(daysLeft)} day${Math.abs(daysLeft) !== 1 ? 's' : ''} overdue`
                            : `${daysLeft} day${daysLeft !== 1 ? 's' : ''} until return`
                          }
                        </p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  )
}

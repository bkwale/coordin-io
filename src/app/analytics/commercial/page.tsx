'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  PoundSterling, Loader2, AlertTriangle, RefreshCw,
  TrendingUp, TrendingDown, ShieldAlert, ArrowRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'

/* ── Types ────────────────────────────────────────────────── */

interface ProjectSummary {
  projectId: string
  projectName: string
  projectCode: string
  budget: {
    totalBudgeted: number
    budgetCount: number
    approvedTotal: number
    approvedCount: number
  }
  committed: {
    poTotal: number
    poTaxTotal: number
    poCount: number
  }
  variations: {
    approvedTotal: number
    approvedCount: number
    pendingTotal: number
    pendingCount: number
  }
  invoicing: {
    totalInvoiced: number
    totalNet: number
    totalTax: number
    invoiceCount: number
    totalPaid: number
    paidCount: number
    outstanding: number
  }
  risks: {
    openExposure: number
    openCount: number
  }
  tenders: {
    statusBreakdown: Record<string, number>
    awardedValue: number
    awardedCount: number
  }
}

interface Project {
  id: string
  name: string
  code: string
  stage: string
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

/* ── Component ────────────────────────────────────────────── */

export default function CommercialAnalyticsPage() {
  const [summaries, setSummaries] = useState<ProjectSummary[]>([])
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
        setSummaries([])
        setLoading(false)
        return
      }

      setProgress({ done: 0, total: projects.length })

      // Step 2: Fetch commercial summary for each project
      const results: ProjectSummary[] = []
      for (const project of projects) {
        try {
          const res = await fetch(`/api/projects/${project.id}/commercial/summary`)
          if (res.ok) {
            const json = await res.json()
            const summary = json.data?.summary
            if (summary) {
              results.push({
                projectId: project.id,
                projectName: project.name,
                projectCode: project.code || project.id.slice(0, 8),
                ...summary,
              })
            }
          }
        } catch {
          // Skip projects with no commercial data
        }
        setProgress(prev => ({ ...prev, done: prev.done + 1 }))
      }

      setSummaries(results)
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
            ? `Loading commercial data... ${progress.done}/${progress.total} projects`
            : 'Loading commercial data...'}
        </p>
      </div>
    )
  }

  /* ── Error state ────────────────────────────────────────── */

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <AlertTriangle className="w-10 h-10 text-red-400" />
        <p className="text-[15px] font-medium text-ink-900">Unable to load commercial analytics</p>
        <p className="text-[13px] text-ink-400">{error}</p>
        <button onClick={fetchData} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-ink-900 text-white text-[13px] font-medium hover:bg-ink-800">
          <RefreshCw className="w-4 h-4" /> Try again
        </button>
      </div>
    )
  }

  /* ── Empty state ────────────────────────────────────────── */

  const hasData = summaries.some(s => s.budget.totalBudgeted > 0 || s.invoicing.totalInvoiced > 0)

  if (summaries.length === 0 || !hasData) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-[22px] font-semibold text-ink-900">Commercial Analytics</h1>
          <p className="text-[13px] text-ink-400 mt-1">Project profitability and fee recovery</p>
        </div>
        <div className="bg-white rounded-xl border border-ink-100 p-12 text-center">
          <PoundSterling className="w-12 h-12 text-ink-200 mx-auto mb-4" />
          <p className="text-[15px] font-medium text-ink-700">No commercial data yet</p>
          <p className="text-[12px] text-ink-400 mt-2 max-w-md mx-auto">
            Add budgets to your projects to see analytics here.
          </p>
        </div>
      </div>
    )
  }

  /* ── Aggregated data ────────────────────────────────────── */

  const totals = summaries.reduce(
    (acc, s) => ({
      budget: acc.budget + s.budget.totalBudgeted,
      approved: acc.approved + s.budget.approvedTotal,
      committed: acc.committed + s.committed.poTotal,
      invoiced: acc.invoiced + s.invoicing.totalInvoiced,
      paid: acc.paid + s.invoicing.totalPaid,
      outstanding: acc.outstanding + s.invoicing.outstanding,
      variationsApproved: acc.variationsApproved + s.variations.approvedTotal,
      variationsApprovedCount: acc.variationsApprovedCount + s.variations.approvedCount,
      variationsPending: acc.variationsPending + s.variations.pendingTotal,
      variationsPendingCount: acc.variationsPendingCount + s.variations.pendingCount,
      riskExposure: acc.riskExposure + s.risks.openExposure,
      riskCount: acc.riskCount + s.risks.openCount,
    }),
    {
      budget: 0, approved: 0, committed: 0, invoiced: 0,
      paid: 0, outstanding: 0,
      variationsApproved: 0, variationsApprovedCount: 0,
      variationsPending: 0, variationsPendingCount: 0,
      riskExposure: 0, riskCount: 0,
    },
  )

  // Top 5 projects by budget
  const top5 = [...summaries]
    .sort((a, b) => b.budget.totalBudgeted - a.budget.totalBudgeted)
    .slice(0, 5)

  const maxBudget = top5[0]?.budget.totalBudgeted || 1

  // Rejected variations = total count minus approved/pending
  const totalVariationCount = summaries.reduce(
    (acc, s) => acc + s.variations.approvedCount + s.variations.pendingCount,
    0,
  )

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-[22px] font-semibold text-ink-900">Commercial Analytics</h1>
        <p className="text-[13px] text-ink-400 mt-1">
          Aggregated across {summaries.length} project{summaries.length !== 1 ? 's' : ''} with commercial data
        </p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total budget', value: fmt.format(totals.budget), icon: PoundSterling, accent: 'bg-blue-50 text-blue-600' },
          { label: 'Committed (POs)', value: fmt.format(totals.committed), icon: TrendingUp, accent: 'bg-emerald-50 text-emerald-600' },
          { label: 'Total invoiced', value: fmt.format(totals.invoiced), icon: TrendingUp, accent: 'bg-violet-50 text-violet-600' },
          { label: 'Risk exposure', value: fmt.format(totals.riskExposure), icon: ShieldAlert, accent: totals.riskExposure > 0 ? 'bg-red-50 text-red-600' : 'bg-ink-50 text-ink-400' },
        ].map(({ label, value, icon: Icon, accent }) => (
          <div key={label} className="bg-white rounded-xl border border-ink-100 p-5 flex items-start gap-4">
            <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center shrink-0', accent)}>
              <Icon className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[20px] font-semibold text-ink-900 leading-tight truncate">{value}</p>
              <p className="text-[12px] text-ink-400 mt-0.5">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Budget vs Committed vs Invoiced bar chart */}
      <section>
        <h2 className="text-[15px] font-semibold text-ink-900 mb-4">Budget vs Committed vs Invoiced</h2>
        <div className="bg-white rounded-xl border border-ink-100 p-6">
          <div className="space-y-4">
            {[
              { label: 'Budget', value: totals.budget, color: 'bg-blue-500' },
              { label: 'Committed', value: totals.committed, color: 'bg-emerald-500' },
              { label: 'Invoiced', value: totals.invoiced, color: 'bg-violet-500' },
              { label: 'Paid', value: totals.paid, color: 'bg-green-500' },
            ].map(({ label, value, color }) => (
              <div key={label}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[13px] font-medium text-ink-700">{label}</span>
                  <span className="text-[13px] text-ink-500">{fmt.format(value)}</span>
                </div>
                <div className="h-6 bg-ink-50 rounded-md overflow-hidden">
                  <div
                    className={cn('h-full rounded-md transition-all duration-700', color)}
                    style={{ width: `${pct(value, totals.budget)}%` }}
                  />
                </div>
                <p className="text-[11px] text-ink-400 mt-0.5">{pct(value, totals.budget)}% of total budget</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Variation summary + Risk exposure (side by side on large screens) */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Variations */}
        <section>
          <h2 className="text-[15px] font-semibold text-ink-900 mb-3">Variation Summary</h2>
          <div className="bg-white rounded-xl border border-ink-100 divide-y divide-ink-50">
            {[
              {
                label: 'Approved',
                count: totals.variationsApprovedCount,
                value: totals.variationsApproved,
                dot: 'bg-emerald-500',
                bg: 'bg-emerald-50',
              },
              {
                label: 'Pending',
                count: totals.variationsPendingCount,
                value: totals.variationsPending,
                dot: 'bg-amber-500',
                bg: 'bg-amber-50',
              },
              {
                label: 'Total variations',
                count: totalVariationCount,
                value: totals.variationsApproved + totals.variationsPending,
                dot: 'bg-ink-400',
                bg: 'bg-ink-50',
              },
            ].map(({ label, count, value, dot, bg }) => (
              <div key={label} className="flex items-center justify-between px-5 py-3.5">
                <div className="flex items-center gap-3">
                  <span className={cn('w-2.5 h-2.5 rounded-full', dot)} />
                  <div>
                    <p className="text-[13px] font-medium text-ink-700">{label}</p>
                    <p className="text-[11px] text-ink-400">{count} variation{count !== 1 ? 's' : ''}</p>
                  </div>
                </div>
                <span className={cn('text-[13px] font-semibold px-3 py-1 rounded-lg', bg)}>
                  {fmt.format(value)}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* Risk Exposure */}
        <section>
          <h2 className="text-[15px] font-semibold text-ink-900 mb-3">Commercial Risk Exposure</h2>
          <div className="bg-white rounded-xl border border-ink-100 p-6">
            {totals.riskCount === 0 ? (
              <div className="text-center py-4">
                <ShieldAlert className="w-8 h-8 text-emerald-300 mx-auto mb-2" />
                <p className="text-[13px] text-ink-500">No open commercial risks</p>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-4 mb-5">
                  <div className={cn('w-12 h-12 rounded-lg flex items-center justify-center',
                    totals.riskExposure > totals.budget * 0.1 ? 'bg-red-50' : 'bg-amber-50'
                  )}>
                    <ShieldAlert className={cn('w-6 h-6',
                      totals.riskExposure > totals.budget * 0.1 ? 'text-red-500' : 'text-amber-500'
                    )} />
                  </div>
                  <div>
                    <p className="text-[22px] font-semibold text-ink-900">{fmt.format(totals.riskExposure)}</p>
                    <p className="text-[12px] text-ink-400">
                      {totals.riskCount} open risk{totals.riskCount !== 1 ? 's' : ''} across all projects
                    </p>
                  </div>
                </div>
                {totals.budget > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[12px] text-ink-400">Risk as % of budget</span>
                      <span className="text-[12px] font-medium text-ink-600">
                        {pct(totals.riskExposure, totals.budget)}%
                      </span>
                    </div>
                    <div className="h-3 bg-ink-50 rounded-full overflow-hidden">
                      <div
                        className={cn('h-full rounded-full',
                          pct(totals.riskExposure, totals.budget) > 10 ? 'bg-red-400' : 'bg-amber-400'
                        )}
                        style={{ width: `${Math.min(100, pct(totals.riskExposure, totals.budget))}%` }}
                      />
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </section>
      </div>

      {/* Top 5 projects by budget */}
      <section>
        <h2 className="text-[15px] font-semibold text-ink-900 mb-3">
          Top Projects by Budget
          <span className="ml-2 text-[12px] font-medium text-ink-400">{top5.length}</span>
        </h2>
        <div className="bg-white rounded-xl border border-ink-100 divide-y divide-ink-50">
          {top5.map((s, i) => (
            <Link
              key={s.projectId}
              href={`/projects/${s.projectId}/commercial`}
              className="flex items-center gap-4 px-5 py-3.5 hover:bg-surface-50 transition-colors"
            >
              <span className="text-[13px] font-semibold text-ink-300 w-6 text-center">{i + 1}</span>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-medium text-ink-900 truncate">{s.projectName}</p>
                <p className="text-[11px] text-ink-400">{s.projectCode}</p>
              </div>
              <div className="flex-1 min-w-0 hidden sm:block">
                <div className="h-4 bg-ink-50 rounded overflow-hidden">
                  <div
                    className="h-full bg-blue-400 rounded transition-all duration-500"
                    style={{ width: `${pct(s.budget.totalBudgeted, maxBudget)}%` }}
                  />
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="text-[13px] font-semibold text-ink-900">{fmt.format(s.budget.totalBudgeted)}</p>
                <p className="text-[11px] text-ink-400">
                  {s.invoicing.outstanding > 0 ? (
                    <span className="text-amber-600">{fmt.format(s.invoicing.outstanding)} outstanding</span>
                  ) : (
                    <span className="text-emerald-600">Fully paid</span>
                  )}
                </p>
              </div>
              <ArrowRight className="w-4 h-4 text-ink-300 shrink-0" />
            </Link>
          ))}
        </div>
      </section>

      {/* Outstanding summary */}
      <section>
        <h2 className="text-[15px] font-semibold text-ink-900 mb-3">Payment Summary</h2>
        <div className="bg-white rounded-xl border border-ink-100 p-6">
          <div className="grid grid-cols-3 gap-6 text-center">
            <div>
              <p className="text-[20px] font-semibold text-ink-900">{fmt.format(totals.invoiced)}</p>
              <p className="text-[12px] text-ink-400 mt-1">Total invoiced</p>
            </div>
            <div>
              <p className="text-[20px] font-semibold text-emerald-600">{fmt.format(totals.paid)}</p>
              <p className="text-[12px] text-ink-400 mt-1">Received</p>
            </div>
            <div>
              <p className={cn('text-[20px] font-semibold', totals.outstanding > 0 ? 'text-amber-600' : 'text-ink-900')}>
                {fmt.format(totals.outstanding)}
              </p>
              <p className="text-[12px] text-ink-400 mt-1">Outstanding</p>
            </div>
          </div>
          {totals.invoiced > 0 && (
            <div className="mt-5">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[12px] text-ink-400">Collection rate</span>
                <span className="text-[12px] font-medium text-ink-600">{pct(totals.paid, totals.invoiced)}%</span>
              </div>
              <div className="h-3 bg-ink-50 rounded-full overflow-hidden flex">
                <div
                  className="h-full bg-emerald-400 rounded-l-full"
                  style={{ width: `${pct(totals.paid, totals.invoiced)}%` }}
                />
                <div
                  className="h-full bg-amber-300"
                  style={{ width: `${pct(totals.outstanding, totals.invoiced)}%` }}
                />
              </div>
              <div className="flex items-center gap-4 mt-2">
                <span className="flex items-center gap-1.5 text-[11px] text-ink-400">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" /> Paid
                </span>
                <span className="flex items-center gap-1.5 text-[11px] text-ink-400">
                  <span className="w-2 h-2 rounded-full bg-amber-300" /> Outstanding
                </span>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}

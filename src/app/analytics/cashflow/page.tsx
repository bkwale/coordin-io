'use client'

import { useEffect, useState } from 'react'
import {
  TrendingUp, Loader2, AlertTriangle, RefreshCw,
  Clock, CheckCircle2, AlertCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'

/* ── Types ────────────────────────────────────────────────── */

interface Invoice {
  id: string
  invoiceNumber: string
  grossAmount: number
  paidAmount: number | null
  netAmount: number
  issueDate: string
  dueDate: string | null
  status: string
  projectId: string
}

interface Project {
  id: string
  name: string
  code: string
}

interface MonthlyData {
  month: string       // "2024-01", "2024-02" etc.
  label: string       // "Jan 2024"
  invoiced: number
  paid: number
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

function daysBetween(dateStr: string, now: Date): number {
  const d = new Date(dateStr)
  return Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24))
}

function monthKey(dateStr: string): string {
  const d = new Date(dateStr)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function monthLabel(key: string): string {
  const [year, month] = key.split('-')
  const d = new Date(parseInt(year), parseInt(month) - 1, 1)
  return d.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })
}

/* ── Component ────────────────────────────────────────────── */

export default function CashflowPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([])
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
        setInvoices([])
        setLoading(false)
        return
      }

      setProgress({ done: 0, total: projects.length })

      // Step 2: Fetch invoices for each project
      const allInvoices: Invoice[] = []
      for (const project of projects) {
        try {
          const res = await fetch(`/api/projects/${project.id}/commercial/invoices`)
          if (res.ok) {
            const json = await res.json()
            const projectInvoices = json.data?.invoices ?? []
            allInvoices.push(...projectInvoices)
          }
        } catch {
          // Skip projects with no invoice data
        }
        setProgress(prev => ({ ...prev, done: prev.done + 1 }))
      }

      setInvoices(allInvoices)
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
            ? `Loading invoice data... ${progress.done}/${progress.total} projects`
            : 'Loading cashflow data...'}
        </p>
      </div>
    )
  }

  /* ── Error state ────────────────────────────────────────── */

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <AlertTriangle className="w-10 h-10 text-red-400" />
        <p className="text-[15px] font-medium text-ink-900">Unable to load cashflow data</p>
        <p className="text-[13px] text-ink-400">{error}</p>
        <button onClick={fetchData} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-ink-900 text-white text-[13px] font-medium hover:bg-ink-800">
          <RefreshCw className="w-4 h-4" /> Try again
        </button>
      </div>
    )
  }

  /* ── Empty state ────────────────────────────────────────── */

  // Filter out cancelled/written-off invoices
  const activeInvoices = invoices.filter(inv => !['CANCELLED', 'WRITTEN_OFF'].includes(inv.status))

  if (activeInvoices.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-[22px] font-semibold text-ink-900">Cashflow Forecast</h1>
          <p className="text-[13px] text-ink-400 mt-1">Revenue projections and payment tracking</p>
        </div>
        <div className="bg-white rounded-xl border border-ink-100 p-12 text-center">
          <TrendingUp className="w-12 h-12 text-ink-200 mx-auto mb-4" />
          <p className="text-[15px] font-medium text-ink-700">No cashflow data yet</p>
          <p className="text-[12px] text-ink-400 mt-2 max-w-md mx-auto">
            Add budgets to your projects to see analytics here.
          </p>
        </div>
      </div>
    )
  }

  /* ── Compute analytics ──────────────────────────────────── */

  const now = new Date()

  // Total amounts
  const totalInvoiced = activeInvoices.reduce((sum, inv) => sum + inv.grossAmount, 0)
  const totalPaid = activeInvoices
    .filter(inv => inv.status === 'PAID')
    .reduce((sum, inv) => sum + (inv.paidAmount ?? inv.grossAmount), 0)
  const totalOutstanding = totalInvoiced - totalPaid

  // Collection rate
  const collectionRate = totalInvoiced > 0 ? pct(totalPaid, totalInvoiced) : 0

  // Monthly invoice totals
  const monthlyMap = new Map<string, { invoiced: number; paid: number }>()
  for (const inv of activeInvoices) {
    if (!inv.issueDate) continue
    const key = monthKey(inv.issueDate)
    const existing = monthlyMap.get(key) || { invoiced: 0, paid: 0 }
    existing.invoiced += inv.grossAmount
    if (inv.status === 'PAID') {
      existing.paid += inv.paidAmount ?? inv.grossAmount
    }
    monthlyMap.set(key, existing)
  }

  const monthlyData: MonthlyData[] = [...monthlyMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, data]) => ({
      month: key,
      label: monthLabel(key),
      ...data,
    }))

  const maxMonthly = Math.max(...monthlyData.map(m => m.invoiced), 1)

  // Cumulative cashflow
  let cumulative = 0
  const cumulativeData = monthlyData.map(m => {
    cumulative += m.paid
    return { ...m, cumulative }
  })
  const maxCumulative = cumulative || 1

  // Outstanding invoice aging
  const outstandingInvoices = activeInvoices.filter(inv =>
    inv.status !== 'PAID' && inv.dueDate
  )

  const aging = { days0_30: 0, days31_60: 0, days61_90: 0, days90plus: 0 }
  for (const inv of outstandingInvoices) {
    if (!inv.dueDate) continue
    const overdueDays = daysBetween(inv.dueDate, now)
    if (overdueDays <= 0) {
      aging.days0_30 += inv.grossAmount // Not yet due
    } else if (overdueDays <= 30) {
      aging.days0_30 += inv.grossAmount
    } else if (overdueDays <= 60) {
      aging.days31_60 += inv.grossAmount
    } else if (overdueDays <= 90) {
      aging.days61_90 += inv.grossAmount
    } else {
      aging.days90plus += inv.grossAmount
    }
  }

  const agingTotal = aging.days0_30 + aging.days31_60 + aging.days61_90 + aging.days90plus

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-[22px] font-semibold text-ink-900">Cashflow Forecast</h1>
        <p className="text-[13px] text-ink-400 mt-1">
          {activeInvoices.length} invoice{activeInvoices.length !== 1 ? 's' : ''} across all projects
        </p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total invoiced', value: fmt.format(totalInvoiced), icon: TrendingUp, accent: 'bg-blue-50 text-blue-600' },
          { label: 'Received', value: fmt.format(totalPaid), icon: CheckCircle2, accent: 'bg-emerald-50 text-emerald-600' },
          { label: 'Outstanding', value: fmt.format(totalOutstanding), icon: Clock, accent: totalOutstanding > 0 ? 'bg-amber-50 text-amber-600' : 'bg-ink-50 text-ink-400' },
          { label: 'Collection rate', value: `${collectionRate}%`, icon: TrendingUp, accent: collectionRate >= 80 ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600' },
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

      {/* Monthly invoiced chart */}
      <section>
        <h2 className="text-[15px] font-semibold text-ink-900 mb-4">Monthly Invoice Totals</h2>
        <div className="bg-white rounded-xl border border-ink-100 p-6">
          {monthlyData.length === 0 ? (
            <p className="text-[13px] text-ink-400 text-center py-4">No monthly data available</p>
          ) : (
            <div className="space-y-3">
              {monthlyData.map(m => (
                <div key={m.month}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[12px] font-medium text-ink-600 w-20 shrink-0">{m.label}</span>
                    <span className="text-[12px] text-ink-500">{fmt.format(m.invoiced)}</span>
                  </div>
                  <div className="h-5 bg-ink-50 rounded overflow-hidden flex">
                    <div
                      className="h-full bg-emerald-400 transition-all duration-500"
                      style={{ width: `${pct(m.paid, maxMonthly)}%` }}
                    />
                    <div
                      className="h-full bg-blue-300 transition-all duration-500"
                      style={{ width: `${pct(m.invoiced - m.paid, maxMonthly)}%` }}
                    />
                  </div>
                </div>
              ))}
              <div className="flex items-center gap-4 mt-3 pt-3 border-t border-ink-50">
                <span className="flex items-center gap-1.5 text-[11px] text-ink-400">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" /> Paid
                </span>
                <span className="flex items-center gap-1.5 text-[11px] text-ink-400">
                  <span className="w-2 h-2 rounded-full bg-blue-300" /> Unpaid
                </span>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Cumulative cashflow + Aging side by side */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Cumulative cashflow visualization */}
        <section>
          <h2 className="text-[15px] font-semibold text-ink-900 mb-3">Cumulative Cashflow</h2>
          <div className="bg-white rounded-xl border border-ink-100 p-6">
            {cumulativeData.length === 0 ? (
              <p className="text-[13px] text-ink-400 text-center py-4">No cashflow data available</p>
            ) : (
              <div className="relative">
                {/* Simple bar-based cumulative visualization */}
                <div className="space-y-2">
                  {cumulativeData.map(m => (
                    <div key={m.month} className="flex items-center gap-3">
                      <span className="text-[11px] text-ink-400 w-16 shrink-0 text-right">{m.label}</span>
                      <div className="flex-1 h-4 bg-ink-50 rounded overflow-hidden">
                        <div
                          className="h-full bg-emerald-400 rounded transition-all duration-500"
                          style={{ width: `${pct(m.cumulative, maxCumulative)}%` }}
                        />
                      </div>
                      <span className="text-[11px] text-ink-500 w-20 shrink-0">{fmt.format(m.cumulative)}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-4 pt-3 border-t border-ink-50">
                  <p className="text-[12px] text-ink-400">
                    Total received to date: <span className="font-semibold text-emerald-600">{fmt.format(cumulative)}</span>
                  </p>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Outstanding aging */}
        <section>
          <h2 className="text-[15px] font-semibold text-ink-900 mb-3">Outstanding Invoice Aging</h2>
          <div className="bg-white rounded-xl border border-ink-100 p-6">
            {agingTotal === 0 ? (
              <div className="text-center py-4">
                <CheckCircle2 className="w-8 h-8 text-emerald-300 mx-auto mb-2" />
                <p className="text-[13px] text-ink-500">No outstanding invoices</p>
              </div>
            ) : (
              <div className="space-y-4">
                {[
                  { label: '0 - 30 days', value: aging.days0_30, color: 'bg-emerald-400', textColor: 'text-emerald-600' },
                  { label: '31 - 60 days', value: aging.days31_60, color: 'bg-amber-400', textColor: 'text-amber-600' },
                  { label: '61 - 90 days', value: aging.days61_90, color: 'bg-orange-400', textColor: 'text-orange-600' },
                  { label: '90+ days', value: aging.days90plus, color: 'bg-red-400', textColor: 'text-red-600' },
                ].map(({ label, value, color, textColor }) => (
                  <div key={label}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[12px] text-ink-600">{label}</span>
                      <span className={cn('text-[12px] font-semibold', value > 0 ? textColor : 'text-ink-300')}>
                        {fmt.format(value)}
                      </span>
                    </div>
                    <div className="h-4 bg-ink-50 rounded overflow-hidden">
                      <div
                        className={cn('h-full rounded transition-all duration-500', color)}
                        style={{ width: `${pct(value, agingTotal)}%` }}
                      />
                    </div>
                  </div>
                ))}
                <div className="pt-3 border-t border-ink-50 flex items-center justify-between">
                  <span className="text-[12px] text-ink-400">Total outstanding</span>
                  <span className="text-[13px] font-semibold text-ink-900">{fmt.format(agingTotal)}</span>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Payment collection rate bar */}
      <section>
        <h2 className="text-[15px] font-semibold text-ink-900 mb-3">Payment Collection Rate</h2>
        <div className="bg-white rounded-xl border border-ink-100 p-6">
          <div className="flex items-center gap-6 mb-4">
            <div className={cn('w-16 h-16 rounded-xl flex items-center justify-center',
              collectionRate >= 80 ? 'bg-emerald-50' : collectionRate >= 50 ? 'bg-amber-50' : 'bg-red-50'
            )}>
              <span className={cn('text-[22px] font-bold',
                collectionRate >= 80 ? 'text-emerald-600' : collectionRate >= 50 ? 'text-amber-600' : 'text-red-600'
              )}>
                {collectionRate}%
              </span>
            </div>
            <div>
              <p className="text-[14px] font-medium text-ink-900">
                {collectionRate >= 80 ? 'Healthy collection rate' :
                 collectionRate >= 50 ? 'Collection rate needs attention' :
                 'Low collection rate'}
              </p>
              <p className="text-[12px] text-ink-400 mt-0.5">
                {fmt.format(totalPaid)} collected of {fmt.format(totalInvoiced)} invoiced
              </p>
            </div>
          </div>
          <div className="h-4 bg-ink-50 rounded-full overflow-hidden">
            <div
              className={cn('h-full rounded-full transition-all duration-700',
                collectionRate >= 80 ? 'bg-emerald-400' : collectionRate >= 50 ? 'bg-amber-400' : 'bg-red-400'
              )}
              style={{ width: `${collectionRate}%` }}
            />
          </div>
        </div>
      </section>
    </div>
  )
}

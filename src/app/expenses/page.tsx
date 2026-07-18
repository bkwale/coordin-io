'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  Wallet, Plus, Loader2, AlertTriangle, RefreshCw,
  X, ArrowRight, Ban,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useToast } from '@/components/Toast'
import { useApiMutation } from '@/hooks/use-api'
import { SkeletonRow } from '@/components/Skeleton'

/* ── Types ─────────────────────────────────────────────── */

interface ExpenseClaim {
  id: string
  category: string
  description: string
  amount: number
  currency: string
  receiptUrl: string | null
  status: string
  projectId: string | null
  createdAt: string
  profile: { id: string; fullName: string }
  approver: { id: string; fullName: string } | null
}

type FilterStatus = 'ALL' | 'DRAFT' | 'SUBMITTED' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED' | 'WITHDRAWN'

const STATUS_FILTERS: { value: FilterStatus; label: string }[] = [
  { value: 'ALL', label: 'All' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'SUBMITTED', label: 'Submitted' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'REJECTED', label: 'Rejected' },
]

const EXPENSE_CATEGORIES: { value: string; label: string }[] = [
  { value: 'TRAVEL', label: 'Travel' },
  { value: 'ACCOMMODATION', label: 'Accommodation' },
  { value: 'MEALS', label: 'Meals' },
  { value: 'EQUIPMENT', label: 'Equipment' },
  { value: 'SOFTWARE', label: 'Software' },
  { value: 'PRINTING', label: 'Printing' },
  { value: 'POSTAGE', label: 'Postage' },
  { value: 'TRAINING', label: 'Training' },
  { value: 'PPE', label: 'PPE' },
  { value: 'SITE_EXPENSES', label: 'Site expenses' },
  { value: 'OTHER', label: 'Other' },
]

const CURRENCIES: { value: string; label: string; symbol: string }[] = [
  { value: 'NGN', label: 'Naira (₦)', symbol: '₦' },
  { value: 'GBP', label: 'Pounds (£)', symbol: '£' },
  { value: 'USD', label: 'Dollars ($)', symbol: '$' },
  { value: 'EUR', label: 'Euros (€)', symbol: '€' },
]

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  DRAFT: { label: 'Draft', color: 'text-ink-500', bg: 'bg-ink-100' },
  SUBMITTED: { label: 'Submitted', color: 'text-blue-600', bg: 'bg-blue-50' },
  UNDER_REVIEW: { label: 'Under review', color: 'text-amber-600', bg: 'bg-amber-50' },
  APPROVED: { label: 'Approved', color: 'text-emerald-600', bg: 'bg-emerald-50' },
  REJECTED: { label: 'Rejected', color: 'text-red-600', bg: 'bg-red-50' },
  COMPLETED: { label: 'Completed', color: 'text-emerald-600', bg: 'bg-emerald-50' },
  WITHDRAWN: { label: 'Withdrawn', color: 'text-ink-400', bg: 'bg-ink-50' },
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

export default function ExpensesPage() {
  const { toast } = useToast()

  const [claims, setClaims] = useState<ExpenseClaim[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('ALL')

  // Create form state
  const [showForm, setShowForm] = useState(false)
  const [formCategory, setFormCategory] = useState('TRAVEL')
  const [formDescription, setFormDescription] = useState('')
  const [formAmount, setFormAmount] = useState('')
  const [formCurrency, setFormCurrency] = useState('NGN')
  const { mutate: createExpense, loading: creating } = useApiMutation<ExpenseClaim>('/api/expenses', 'POST')

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/expenses')
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error?.message || 'Failed to load expenses')
      }
      const json = await res.json()
      setClaims(json.data.claims)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  /* ── Create handler ──────────────────────────────── */

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    const amt = parseFloat(formAmount)
    if (!formDescription.trim() || isNaN(amt) || amt <= 0) return

    const result = await createExpense({
      category: formCategory,
      description: formDescription.trim(),
      amount: amt,
      currency: formCurrency,
    })

    if (result) {
      toast('Expense claim created', 'success')
      setShowForm(false)
      setFormCategory('TRAVEL')
      setFormDescription('')
      setFormAmount('')
      setFormCurrency('NGN')
      fetchData()
    } else {
      toast('Failed to create expense claim', 'error')
    }
  }

  const cancelForm = () => {
    setShowForm(false)
    setFormCategory('TRAVEL')
    setFormDescription('')
    setFormAmount('')
    setFormCurrency('NGN')
  }

  /* ── Quick actions ───────────────────────────────── */

  const handleStatusChange = async (id: string, newStatus: string) => {
    try {
      const res = await fetch(`/api/expenses/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error?.message || 'Failed to update')
      }
      toast(`Expense claim ${newStatus.toLowerCase().replace(/_/g, ' ')}`, 'success')
      fetchData()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to update', 'error')
    }
  }

  /* ── Filter ──────────────────────────────────────── */

  const filtered = statusFilter === 'ALL' ? claims : claims.filter((c) => c.status === statusFilter)
  const statusCounts = claims.reduce<Record<string, number>>((acc, c) => {
    acc[c.status] = (acc[c.status] || 0) + 1
    return acc
  }, {})

  // Summary totals per currency
  const pendingByCurrency = claims
    .filter((c) => ['SUBMITTED', 'UNDER_REVIEW'].includes(c.status))
    .reduce<Record<string, number>>((acc, c) => {
      acc[c.currency] = (acc[c.currency] || 0) + c.amount
      return acc
    }, {})
  const approvedByCurrency = claims
    .filter((c) => c.status === 'APPROVED' || c.status === 'COMPLETED')
    .reduce<Record<string, number>>((acc, c) => {
      acc[c.currency] = (acc[c.currency] || 0) + c.amount
      return acc
    }, {})

  const formatTotals = (byCurrency: Record<string, number>) => {
    const entries = Object.entries(byCurrency)
    if (entries.length === 0) return formatAmount(0, 'NGN')
    return entries.map(([cur, amt]) => formatAmount(amt, cur)).join(', ')
  }

  /* ── Loading ─────────────────────────────────────── */

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-40 bg-ink-100 animate-pulse rounded" />
        <div className="bg-white rounded-xl border border-ink-100 divide-y divide-ink-50">
          {Array.from({ length: 4 }).map((_, i) => <SkeletonRow key={i} />)}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh] gap-4">
        <AlertTriangle className="w-8 h-8 text-red-500" />
        <p className="text-[13px] text-ink-600">{error}</p>
        <button onClick={fetchData} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-ink-900 text-white text-[13px] font-medium hover:bg-ink-800 transition-colors">
          <RefreshCw className="w-4 h-4" /> Try again
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* ── Header ─────────────────────────────────── */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-[22px] font-semibold text-ink-900">Expenses</h1>
          <p className="text-[12px] text-ink-400 mt-0.5">
            {claims.length} claims · Pending: {formatTotals(pendingByCurrency)} · Approved: {formatTotals(approvedByCurrency)}
          </p>
        </div>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-ink-900 text-white text-[12px] font-medium hover:bg-ink-800 transition-colors"
          >
            <Plus className="w-4 h-4" />
            New expense
          </button>
        )}
      </div>

      {/* ── Create form ────────────────────────────── */}
      {showForm && (
        <form onSubmit={handleCreate} className="bg-white rounded-xl border-2 border-accent-200 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-[14px] font-semibold text-ink-900">New expense claim</h3>
            <button type="button" onClick={cancelForm} className="text-ink-400 hover:text-ink-600 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label htmlFor="exp-category" className="block text-[11px] font-medium text-ink-500 mb-1">Category</label>
              <select
                id="exp-category"
                value={formCategory}
                onChange={(e) => setFormCategory(e.target.value)}
                className="w-full px-3 py-2 text-[13px] border border-ink-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-300 bg-white"
              >
                {EXPENSE_CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="exp-amount" className="block text-[11px] font-medium text-ink-500 mb-1">
                Amount <span className="text-red-400">*</span>
              </label>
              <input
                id="exp-amount"
                type="number"
                step="0.01"
                min="0.01"
                value={formAmount}
                onChange={(e) => setFormAmount(e.target.value)}
                placeholder="0.00"
                className="w-full px-3 py-2 text-[13px] border border-ink-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-300"
                required
              />
            </div>
            <div>
              <label htmlFor="exp-currency" className="block text-[11px] font-medium text-ink-500 mb-1">Currency</label>
              <select
                id="exp-currency"
                value={formCurrency}
                onChange={(e) => setFormCurrency(e.target.value)}
                className="w-full px-3 py-2 text-[13px] border border-ink-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-300 bg-white"
              >
                {CURRENCIES.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="exp-desc" className="block text-[11px] font-medium text-ink-500 mb-1">
              Description <span className="text-red-400">*</span>
            </label>
            <input
              id="exp-desc"
              type="text"
              value={formDescription}
              onChange={(e) => setFormDescription(e.target.value)}
              placeholder="e.g. Taxi to site visit — Lekki Phase 1"
              className="w-full px-3 py-2 text-[13px] border border-ink-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-300 placeholder:text-ink-300"
              maxLength={1000}
              required
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-1">
            <button type="button" onClick={cancelForm} className="px-3.5 py-2 text-[12px] font-medium text-ink-500 hover:text-ink-700 transition-colors" disabled={creating}>
              Cancel
            </button>
            <button
              type="submit"
              disabled={creating || !formDescription.trim() || !formAmount}
              className={cn(
                'flex items-center gap-1.5 px-4 py-2 rounded-lg text-[12px] font-medium transition-colors',
                creating || !formDescription.trim() || !formAmount
                  ? 'bg-ink-200 text-ink-400 cursor-not-allowed'
                  : 'bg-ink-900 text-white hover:bg-ink-800',
              )}
            >
              {creating && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Create claim
            </button>
          </div>
        </form>
      )}

      {/* ── Filter bar ─────────────────────────────── */}
      <div className="flex gap-1 flex-wrap">
        {STATUS_FILTERS.map((f) => {
          const count = f.value === 'ALL' ? claims.length : (statusCounts[f.value] || 0)
          if (f.value !== 'ALL' && count === 0) return null
          return (
            <button
              key={f.value}
              onClick={() => setStatusFilter(f.value)}
              className={cn(
                'px-3 py-1.5 rounded-full text-[11px] font-medium transition-colors',
                statusFilter === f.value
                  ? 'bg-ink-900 text-white'
                  : 'bg-ink-50 text-ink-500 hover:bg-ink-100',
              )}
            >
              {f.label}
              {count > 0 && <span className={cn('ml-1', statusFilter === f.value ? 'text-ink-300' : 'text-ink-400')}>{count}</span>}
            </button>
          )
        })}
      </div>

      {/* ── Claims list ────────────────────────────── */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-ink-100 p-10 text-center">
          <Wallet className="w-10 h-10 text-ink-200 mx-auto mb-3" />
          <p className="text-[14px] font-medium text-ink-600">No expense claims</p>
          <p className="text-[12px] text-ink-400 mt-1">Click "New expense" to submit a claim.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-ink-100 divide-y divide-ink-50">
          {filtered.map((claim) => {
            const catLabel = EXPENSE_CATEGORIES.find((c) => c.value === claim.category)?.label || claim.category
            return (
              <div key={claim.id} className="flex items-center gap-4 px-5 py-4">
                {/* Category icon */}
                <div className="w-9 h-9 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0">
                  <Wallet className="w-4 h-4 text-emerald-500" />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium text-ink-900 truncate">{claim.description}</p>
                  <p className="text-[11px] text-ink-400 mt-0.5">
                    {catLabel} · {new Date(claim.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                  </p>
                </div>

                {/* Amount */}
                <span className="text-[13px] font-semibold text-ink-900 shrink-0">
                  {formatAmount(claim.amount, claim.currency)}
                </span>

                {/* Status */}
                <StatusBadge status={claim.status} />

                {/* Quick actions */}
                <div className="flex items-center gap-1.5 shrink-0">
                  {claim.status === 'DRAFT' && (
                    <>
                      <button
                        onClick={() => handleStatusChange(claim.id, 'SUBMITTED')}
                        className="p-1.5 rounded-md text-blue-500 hover:bg-blue-50 transition-colors"
                        title="Submit"
                      >
                        <ArrowRight className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleStatusChange(claim.id, 'WITHDRAWN')}
                        className="p-1.5 rounded-md text-ink-300 hover:bg-ink-50 transition-colors"
                        title="Withdraw"
                      >
                        <Ban className="w-4 h-4" />
                      </button>
                    </>
                  )}
                  {claim.status === 'SUBMITTED' && (
                    <button
                      onClick={() => handleStatusChange(claim.id, 'WITHDRAWN')}
                      className="p-1.5 rounded-md text-ink-300 hover:bg-ink-50 transition-colors"
                      title="Withdraw"
                    >
                      <Ban className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

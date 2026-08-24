'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, FileText, Edit, Send, Trash2, Check, X,
  Loader2, AlertTriangle, RefreshCw, Clock, Download, Mail,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useToast } from '@/components/Toast'
import { SkeletonRow } from '@/components/Skeleton'

/* ── Types ─────────────────────────────────────────────── */

interface LineItem {
  id: string
  description: string
  quantity: number
  unitPrice: number
  total: number
  sortOrder: number
}

interface FeeQuoteDetail {
  id: string
  quoteNumber: string
  title: string
  clientName: string
  clientEmail: string | null
  clientAddress: string | null
  description: string | null
  status: string
  netTotal: number
  taxRate: number
  taxAmount: number
  grossTotal: number
  currency: string
  validUntil: string | null
  sentAt: string | null
  acceptedAt: string | null
  rejectedAt: string | null
  notes: string | null
  termsAndConditions: string | null
  createdAt: string
  updatedAt: string
  createdBy: { id: string; fullName: string }
  project: { id: string; name: string; code: string | null } | null
  lineItems: LineItem[]
}

const STATUS_META: Record<string, { label: string; color: string; bg: string; icon: typeof FileText }> = {
  DRAFT: { label: 'Draft', color: 'text-ink-500', bg: 'bg-ink-100', icon: FileText },
  SENT: { label: 'Sent', color: 'text-blue-600', bg: 'bg-blue-50', icon: Send },
  ACCEPTED: { label: 'Accepted', color: 'text-emerald-600', bg: 'bg-emerald-50', icon: Check },
  REJECTED: { label: 'Rejected', color: 'text-red-600', bg: 'bg-red-50', icon: X },
  EXPIRED: { label: 'Expired', color: 'text-amber-600', bg: 'bg-amber-50', icon: Clock },
  SUPERSEDED: { label: 'Superseded', color: 'text-ink-400', bg: 'bg-ink-50', icon: FileText },
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

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function StatusBadge({ status }: { status: string }) {
  const meta = STATUS_META[status] || { label: status, color: 'text-ink-500', bg: 'bg-ink-100' }
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-[12px] font-medium px-3 py-1 rounded-full', meta.bg, meta.color)}>
      {meta.label}
    </span>
  )
}

/* ── Page ──────────────────────────────────────────────── */

export default function FeeQuoteDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const id = params.id as string

  const [quote, setQuote] = useState<FeeQuoteDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const fetchQuote = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/fee-quotes/${id}`)
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error?.message || body.error || 'Failed to load fee quote')
      }
      const json = await res.json()
      setQuote(json.data.quote)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    fetchQuote()
  }, [fetchQuote])

  /* ── Status transitions ────────────────────────── */

  const updateStatus = async (newStatus: string) => {
    setActionLoading(newStatus)
    try {
      const res = await fetch(`/api/fee-quotes/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error?.message || body.error || 'Failed to update status')
      }
      const json = await res.json()
      setQuote(json.data.quote)
      toast(`Quote ${newStatus.toLowerCase()}`, 'success')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Something went wrong', 'error')
    } finally {
      setActionLoading(null)
    }
  }

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this quote? This cannot be undone.')) return
    setActionLoading('DELETE')
    try {
      const res = await fetch(`/api/fee-quotes/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error?.message || body.error || 'Failed to delete quote')
      }
      toast('Quote deleted', 'success')
      router.push('/fee-quotes')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Something went wrong', 'error')
      setActionLoading(null)
    }
  }

  /* ── PDF download ─────────────────────────────── */

  const handleDownloadPdf = async () => {
    setActionLoading('PDF')
    try {
      const res = await fetch(`/api/fee-quotes/${id}/pdf`)
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error?.message || body.error || 'Failed to generate PDF')
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${quote?.quoteNumber || 'quote'}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast('PDF downloaded', 'success')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Something went wrong', 'error')
    } finally {
      setActionLoading(null)
    }
  }

  /* ── Send quote via email ────────────────────── */

  const handleSendEmail = async () => {
    if (!quote?.clientEmail) {
      toast('No client email address on this quote', 'error')
      return
    }
    if (!confirm(`Send this quote to ${quote.clientEmail}? The status will change to Sent.`)) return
    setActionLoading('SEND_EMAIL')
    try {
      const res = await fetch(`/api/fee-quotes/${id}/send`, { method: 'POST' })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error?.message || body.error || 'Failed to send quote')
      }
      const json = await res.json()
      setQuote(json.data.quote)
      toast(`Quote sent to ${quote.clientEmail}`, 'success')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Something went wrong', 'error')
    } finally {
      setActionLoading(null)
    }
  }

  /* ── Loading / Error / Not Found ───────────────── */

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Link href="/fee-quotes" className="text-ink-400 hover:text-ink-600">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="h-8 w-48 bg-ink-100 rounded animate-pulse" />
        </div>
        <div className="bg-white rounded-xl border border-ink-100 divide-y divide-ink-50">
          {[1, 2, 3].map(i => <SkeletonRow key={i} />)}
        </div>
      </div>
    )
  }

  if (error || !quote) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Link href="/fee-quotes" className="text-ink-400 hover:text-ink-600">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-[22px] font-semibold text-ink-900">Fee Quote</h1>
        </div>
        <div className="bg-white rounded-xl border border-ink-100 p-12 text-center">
          <AlertTriangle className="w-12 h-12 text-ink-200 mx-auto mb-4" />
          <p className="text-[15px] font-medium text-ink-700">{error || 'Quote not found'}</p>
          <div className="flex items-center justify-center gap-3 mt-4">
            <button onClick={fetchQuote} className="flex items-center gap-2 text-[13px] text-accent-600 hover:text-accent-700 font-medium">
              <RefreshCw className="w-4 h-4" /> Retry
            </button>
            <Link href="/fee-quotes" className="text-[13px] text-ink-400 hover:text-ink-600 font-medium">
              Back to Fee Quotes
            </Link>
          </div>
        </div>
      </div>
    )
  }

  /* ── Render ──────────────────────────────────────── */

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/fee-quotes" className="text-ink-400 hover:text-ink-600 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-[22px] font-semibold text-ink-900">{quote.quoteNumber}</h1>
              <StatusBadge status={quote.status} />
            </div>
            <p className="text-[13px] text-ink-400 mt-0.5">{quote.title}</p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 self-start shrink-0 flex-wrap">
          {/* Download PDF — available in any status */}
          <button
            onClick={handleDownloadPdf}
            disabled={actionLoading !== null}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-ink-200 text-[12px] font-medium text-ink-600 hover:bg-ink-50 transition-colors disabled:opacity-50"
          >
            {actionLoading === 'PDF' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
            Download PDF
          </button>

          {quote.status === 'DRAFT' && (
            <>
              <Link
                href={`/fee-quotes/${id}/edit`}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-ink-200 text-[12px] font-medium text-ink-600 hover:bg-ink-50 transition-colors"
              >
                <Edit className="w-3.5 h-3.5" />
                Edit
              </Link>
              <button
                onClick={handleSendEmail}
                disabled={actionLoading !== null || !quote.clientEmail}
                title={!quote.clientEmail ? 'Add a client email address before sending' : 'Email this quote to the client'}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-[12px] font-medium text-white hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {actionLoading === 'SEND_EMAIL' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Mail className="w-3.5 h-3.5" />}
                Send to Client
              </button>
              <button
                onClick={handleDelete}
                disabled={actionLoading !== null}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-200 text-[12px] font-medium text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
              >
                {actionLoading === 'DELETE' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                Delete
              </button>
            </>
          )}
          {quote.status === 'SENT' && (
            <>
              <button
                onClick={() => updateStatus('ACCEPTED')}
                disabled={actionLoading !== null}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 text-[12px] font-medium text-white hover:bg-emerald-700 transition-colors disabled:opacity-50"
              >
                {actionLoading === 'ACCEPTED' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                Mark Accepted
              </button>
              <button
                onClick={() => updateStatus('REJECTED')}
                disabled={actionLoading !== null}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-200 text-[12px] font-medium text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
              >
                {actionLoading === 'REJECTED' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
                Mark Rejected
              </button>
            </>
          )}
        </div>
      </div>

      {/* Quote details grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Client info */}
          <div className="bg-white rounded-xl border border-ink-100 p-6">
            <h2 className="text-[13px] font-semibold text-ink-500 uppercase tracking-wider mb-4">Client</h2>
            <div className="space-y-2">
              <p className="text-[15px] font-medium text-ink-900">{quote.clientName}</p>
              {quote.clientEmail && <p className="text-[13px] text-ink-500">{quote.clientEmail}</p>}
              {quote.clientAddress && <p className="text-[13px] text-ink-500 whitespace-pre-line">{quote.clientAddress}</p>}
            </div>
          </div>

          {/* Description */}
          {quote.description && (
            <div className="bg-white rounded-xl border border-ink-100 p-6">
              <h2 className="text-[13px] font-semibold text-ink-500 uppercase tracking-wider mb-3">Description</h2>
              <p className="text-[13px] text-ink-700 whitespace-pre-line">{quote.description}</p>
            </div>
          )}

          {/* Line items table */}
          <div className="bg-white rounded-xl border border-ink-100 overflow-hidden">
            <div className="px-6 pt-6 pb-3">
              <h2 className="text-[13px] font-semibold text-ink-500 uppercase tracking-wider">Line Items</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-ink-100 bg-ink-25">
                    <th className="text-left px-6 py-2.5 font-medium text-ink-500 w-8">#</th>
                    <th className="text-left px-4 py-2.5 font-medium text-ink-500">Description</th>
                    <th className="text-right px-4 py-2.5 font-medium text-ink-500">Qty</th>
                    <th className="text-right px-4 py-2.5 font-medium text-ink-500">Unit Price</th>
                    <th className="text-right px-6 py-2.5 font-medium text-ink-500">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-50">
                  {quote.lineItems.map((li, idx) => (
                    <tr key={li.id}>
                      <td className="px-6 py-3 text-ink-400">{idx + 1}</td>
                      <td className="px-4 py-3 text-ink-700">{li.description}</td>
                      <td className="px-4 py-3 text-right text-ink-500">{li.quantity}</td>
                      <td className="px-4 py-3 text-right font-mono text-ink-500">
                        {formatAmount(li.unitPrice, quote.currency)}
                      </td>
                      <td className="px-6 py-3 text-right font-mono text-ink-700">
                        {formatAmount(li.total, quote.currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t border-ink-200">
                  <tr>
                    <td colSpan={4} className="px-6 py-2.5 text-right text-ink-500">Net Total</td>
                    <td className="px-6 py-2.5 text-right font-mono text-ink-700">{formatAmount(quote.netTotal, quote.currency)}</td>
                  </tr>
                  <tr>
                    <td colSpan={4} className="px-6 py-2.5 text-right text-ink-500">Tax ({quote.taxRate}%)</td>
                    <td className="px-6 py-2.5 text-right font-mono text-ink-700">{formatAmount(quote.taxAmount, quote.currency)}</td>
                  </tr>
                  <tr className="border-t border-ink-200 font-semibold">
                    <td colSpan={4} className="px-6 py-3 text-right text-ink-900">Gross Total</td>
                    <td className="px-6 py-3 text-right font-mono text-ink-900">{formatAmount(quote.grossTotal, quote.currency)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Notes */}
          {quote.notes && (
            <div className="bg-white rounded-xl border border-ink-100 p-6">
              <h2 className="text-[13px] font-semibold text-ink-500 uppercase tracking-wider mb-3">Notes</h2>
              <p className="text-[13px] text-ink-700 whitespace-pre-line">{quote.notes}</p>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Summary card */}
          <div className="bg-white rounded-xl border border-ink-100 p-6 space-y-4">
            <h2 className="text-[13px] font-semibold text-ink-500 uppercase tracking-wider">Summary</h2>
            <dl className="space-y-3 text-[13px]">
              <div className="flex justify-between">
                <dt className="text-ink-400">Status</dt>
                <dd><StatusBadge status={quote.status} /></dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ink-400">Currency</dt>
                <dd className="text-ink-700 font-medium">{quote.currency}</dd>
              </div>
              {quote.project && (
                <div className="flex justify-between">
                  <dt className="text-ink-400">Project</dt>
                  <dd className="text-ink-700 font-medium">{quote.project.code || quote.project.name}</dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-ink-400">Created by</dt>
                <dd className="text-ink-700">{quote.createdBy.fullName}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ink-400">Created</dt>
                <dd className="text-ink-700">{formatDate(quote.createdAt)}</dd>
              </div>
              {quote.validUntil && (
                <div className="flex justify-between">
                  <dt className="text-ink-400">Valid Until</dt>
                  <dd className="text-ink-700">{formatDate(quote.validUntil)}</dd>
                </div>
              )}
            </dl>
          </div>

          {/* Status history */}
          <div className="bg-white rounded-xl border border-ink-100 p-6 space-y-4">
            <h2 className="text-[13px] font-semibold text-ink-500 uppercase tracking-wider">Status History</h2>
            <div className="space-y-3 text-[12px]">
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 rounded-full bg-ink-300 mt-1 shrink-0" />
                <div>
                  <p className="text-ink-700">Created</p>
                  <p className="text-ink-400">{formatDateTime(quote.createdAt)}</p>
                </div>
              </div>
              {quote.sentAt && (
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full bg-blue-500 mt-1 shrink-0" />
                  <div>
                    <p className="text-ink-700">Sent to client</p>
                    <p className="text-ink-400">{formatDateTime(quote.sentAt)}</p>
                  </div>
                </div>
              )}
              {quote.acceptedAt && (
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 mt-1 shrink-0" />
                  <div>
                    <p className="text-ink-700">Accepted by client</p>
                    <p className="text-ink-400">{formatDateTime(quote.acceptedAt)}</p>
                  </div>
                </div>
              )}
              {quote.rejectedAt && (
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full bg-red-500 mt-1 shrink-0" />
                  <div>
                    <p className="text-ink-700">Rejected by client</p>
                    <p className="text-ink-400">{formatDateTime(quote.rejectedAt)}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

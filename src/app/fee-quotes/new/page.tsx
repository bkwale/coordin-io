'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Plus, Trash2, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useToast } from '@/components/Toast'

/* ── Types ─────────────────────────────────────────────── */

interface LineItem {
  key: string
  description: string
  quantity: number
  unitPrice: number
}

const CURRENCIES = [
  { value: 'GBP', label: 'GBP (£)', symbol: '£' },
  { value: 'NGN', label: 'NGN (₦)', symbol: '₦' },
  { value: 'USD', label: 'USD ($)', symbol: '$' },
  { value: 'EUR', label: 'EUR (€)', symbol: '€' },
]

function getCurrencySymbol(code: string): string {
  return CURRENCIES.find(c => c.value === code)?.symbol || '£'
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

let keyCounter = 0
function nextKey(): string {
  return `li-${++keyCounter}-${Date.now()}`
}

/* ── Page ──────────────────────────────────────────────── */

export default function NewFeeQuotePage() {
  const router = useRouter()
  const { toast } = useToast()

  // Form state
  const [title, setTitle] = useState('')
  const [clientName, setClientName] = useState('')
  const [clientEmail, setClientEmail] = useState('')
  const [clientAddress, setClientAddress] = useState('')
  const [description, setDescription] = useState('')
  const [currency, setCurrency] = useState('GBP')
  const [taxRate, setTaxRate] = useState(20)
  const [validUntil, setValidUntil] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Line items
  const [lineItems, setLineItems] = useState<LineItem[]>([
    { key: nextKey(), description: '', quantity: 1, unitPrice: 0 },
  ])

  const addLineItem = () => {
    setLineItems(prev => [...prev, { key: nextKey(), description: '', quantity: 1, unitPrice: 0 }])
  }

  const removeLineItem = (key: string) => {
    if (lineItems.length <= 1) return
    setLineItems(prev => prev.filter(li => li.key !== key))
  }

  const updateLineItem = (key: string, field: keyof LineItem, value: string | number) => {
    setLineItems(prev =>
      prev.map(li => li.key === key ? { ...li, [field]: value } : li),
    )
  }

  // Calculations
  const netTotal = lineItems.reduce((sum, li) => sum + (li.quantity * li.unitPrice), 0)
  const taxAmount = Math.round(netTotal * (taxRate / 100) * 100) / 100
  const grossTotal = Math.round((netTotal + taxAmount) * 100) / 100

  // Submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !clientName.trim()) {
      toast('Title and client name are required', 'error')
      return
    }
    if (lineItems.some(li => !li.description.trim())) {
      toast('All line items need a description', 'error')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/fee-quotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          clientName: clientName.trim(),
          clientEmail: clientEmail.trim() || null,
          clientAddress: clientAddress.trim() || null,
          description: description.trim() || null,
          currency,
          taxRate,
          validUntil: validUntil || null,
          notes: notes.trim() || null,
          lineItems: lineItems.map(li => ({
            description: li.description.trim(),
            quantity: li.quantity,
            unitPrice: li.unitPrice,
          })),
        }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error?.message || body.error || 'Failed to create quote')
      }

      const json = await res.json()
      toast('Fee quote created', 'success')
      router.push(`/fee-quotes/${json.data.quote.id}`)
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Something went wrong', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/fee-quotes" className="text-ink-400 hover:text-ink-600 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-[22px] font-semibold text-ink-900">New Fee Quote</h1>
          <p className="text-[13px] text-ink-400 mt-0.5">Create a new fee proposal</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Quote details */}
        <div className="bg-white rounded-xl border border-ink-100 p-6 space-y-4">
          <h2 className="text-[15px] font-semibold text-ink-900">Quote Details</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[12px] font-medium text-ink-500 mb-1">Title *</label>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="e.g. Architectural Design Fee Proposal"
                className="w-full px-3 py-2 text-[13px] border border-ink-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-500/20 focus:border-accent-500"
                required
              />
            </div>
            <div>
              <label className="block text-[12px] font-medium text-ink-500 mb-1">Currency</label>
              <select
                value={currency}
                onChange={e => setCurrency(e.target.value)}
                className="w-full px-3 py-2 text-[13px] border border-ink-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-500/20 focus:border-accent-500"
              >
                {CURRENCIES.map(c => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[12px] font-medium text-ink-500 mb-1">Description</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={2}
              placeholder="Brief description of the scope of work..."
              className="w-full px-3 py-2 text-[13px] border border-ink-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-500/20 focus:border-accent-500 resize-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[12px] font-medium text-ink-500 mb-1">Valid Until</label>
              <input
                type="date"
                value={validUntil}
                onChange={e => setValidUntil(e.target.value)}
                className="w-full px-3 py-2 text-[13px] border border-ink-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-500/20 focus:border-accent-500"
              />
            </div>
            <div>
              <label className="block text-[12px] font-medium text-ink-500 mb-1">Tax Rate (%)</label>
              <input
                type="number"
                value={taxRate}
                onChange={e => setTaxRate(parseFloat(e.target.value) || 0)}
                min={0}
                max={100}
                step={0.5}
                className="w-full px-3 py-2 text-[13px] border border-ink-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-500/20 focus:border-accent-500"
              />
            </div>
          </div>
        </div>

        {/* Client info */}
        <div className="bg-white rounded-xl border border-ink-100 p-6 space-y-4">
          <h2 className="text-[15px] font-semibold text-ink-900">Client Information</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[12px] font-medium text-ink-500 mb-1">Client Name *</label>
              <input
                type="text"
                value={clientName}
                onChange={e => setClientName(e.target.value)}
                placeholder="e.g. Acme Developments Ltd"
                className="w-full px-3 py-2 text-[13px] border border-ink-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-500/20 focus:border-accent-500"
                required
              />
            </div>
            <div>
              <label className="block text-[12px] font-medium text-ink-500 mb-1">Client Email</label>
              <input
                type="email"
                value={clientEmail}
                onChange={e => setClientEmail(e.target.value)}
                placeholder="client@example.com"
                className="w-full px-3 py-2 text-[13px] border border-ink-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-500/20 focus:border-accent-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-[12px] font-medium text-ink-500 mb-1">Client Address</label>
            <textarea
              value={clientAddress}
              onChange={e => setClientAddress(e.target.value)}
              rows={2}
              placeholder="Full postal address..."
              className="w-full px-3 py-2 text-[13px] border border-ink-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-500/20 focus:border-accent-500 resize-none"
            />
          </div>
        </div>

        {/* Line items */}
        <div className="bg-white rounded-xl border border-ink-100 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-[15px] font-semibold text-ink-900">Line Items</h2>
            <button
              type="button"
              onClick={addLineItem}
              className="flex items-center gap-1 text-[12px] font-medium text-accent-600 hover:text-accent-700 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Item
            </button>
          </div>

          {/* Table header */}
          <div className="hidden sm:grid grid-cols-[1fr_100px_140px_120px_36px] gap-2 text-[11px] font-medium text-ink-400 uppercase tracking-wider px-1">
            <span>Description</span>
            <span className="text-right">Qty</span>
            <span className="text-right">Unit Price ({getCurrencySymbol(currency)})</span>
            <span className="text-right">Total</span>
            <span />
          </div>

          {lineItems.map((li, idx) => {
            const lineTotal = li.quantity * li.unitPrice
            return (
              <div key={li.key} className="grid grid-cols-1 sm:grid-cols-[1fr_100px_140px_120px_36px] gap-2 items-start">
                <div>
                  <label className="sm:hidden block text-[11px] font-medium text-ink-400 mb-1">Description</label>
                  <input
                    type="text"
                    value={li.description}
                    onChange={e => updateLineItem(li.key, 'description', e.target.value)}
                    placeholder={`Item ${idx + 1}`}
                    className="w-full px-3 py-2 text-[13px] border border-ink-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-500/20 focus:border-accent-500"
                    required
                  />
                </div>
                <div>
                  <label className="sm:hidden block text-[11px] font-medium text-ink-400 mb-1">Qty</label>
                  <input
                    type="number"
                    value={li.quantity}
                    onChange={e => updateLineItem(li.key, 'quantity', parseFloat(e.target.value) || 0)}
                    min={0.01}
                    step={0.01}
                    className="w-full px-3 py-2 text-[13px] border border-ink-200 rounded-lg text-right focus:outline-none focus:ring-2 focus:ring-accent-500/20 focus:border-accent-500"
                  />
                </div>
                <div>
                  <label className="sm:hidden block text-[11px] font-medium text-ink-400 mb-1">Unit Price</label>
                  <input
                    type="number"
                    value={li.unitPrice}
                    onChange={e => updateLineItem(li.key, 'unitPrice', parseFloat(e.target.value) || 0)}
                    min={0}
                    step={0.01}
                    className="w-full px-3 py-2 text-[13px] border border-ink-200 rounded-lg text-right focus:outline-none focus:ring-2 focus:ring-accent-500/20 focus:border-accent-500"
                  />
                </div>
                <div className="flex items-center justify-end h-[38px] text-[13px] font-mono text-ink-700 px-1">
                  {formatAmount(lineTotal, currency)}
                </div>
                <div className="flex items-center justify-center h-[38px]">
                  <button
                    type="button"
                    onClick={() => removeLineItem(li.key)}
                    disabled={lineItems.length <= 1}
                    className={cn(
                      'p-1 rounded transition-colors',
                      lineItems.length <= 1 ? 'text-ink-200 cursor-not-allowed' : 'text-ink-400 hover:text-red-500',
                    )}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )
          })}

          {/* Totals */}
          <div className="border-t border-ink-100 pt-4 space-y-2">
            <div className="flex justify-between text-[13px]">
              <span className="text-ink-500">Net Total</span>
              <span className="font-mono text-ink-700">{formatAmount(netTotal, currency)}</span>
            </div>
            <div className="flex justify-between text-[13px]">
              <span className="text-ink-500">Tax ({taxRate}%)</span>
              <span className="font-mono text-ink-700">{formatAmount(taxAmount, currency)}</span>
            </div>
            <div className="flex justify-between text-[15px] font-semibold border-t border-ink-100 pt-2">
              <span className="text-ink-900">Gross Total</span>
              <span className="font-mono text-ink-900">{formatAmount(grossTotal, currency)}</span>
            </div>
          </div>
        </div>

        {/* Notes */}
        <div className="bg-white rounded-xl border border-ink-100 p-6 space-y-4">
          <h2 className="text-[15px] font-semibold text-ink-900">Additional Notes</h2>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={3}
            placeholder="Any additional notes for the client..."
            className="w-full px-3 py-2 text-[13px] border border-ink-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-500/20 focus:border-accent-500 resize-none"
          />
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3">
          <Link
            href="/fee-quotes"
            className="px-4 py-2 text-[13px] font-medium text-ink-500 hover:text-ink-700 transition-colors"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={submitting}
            className={cn(
              'flex items-center gap-2 px-6 py-2 rounded-lg text-[13px] font-medium text-white transition-colors',
              submitting ? 'bg-ink-400 cursor-not-allowed' : 'bg-ink-900 hover:bg-ink-800',
            )}
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            Create Quote
          </button>
        </div>
      </form>
    </div>
  )
}

'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import {
  Plus, Loader2, Pencil, Trash2, TrendingUp, TrendingDown,
  Target, BarChart3, X, Save,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useToast } from '@/components/Toast'
import { useApiMutation } from '@/hooks/use-api'
import { SkeletonRow } from '@/components/Skeleton'

/* ── Types ─────────────────────────────────────────────── */

interface KeyMetric {
  id: string
  name: string
  category: string
  value: string | null
  unit: string | null
  targetValue: string | null
  status: string | null
  notes: string | null
  createdAt: string
  updatedAt: string
}

/* ── Constants ─────────────────────────────────────────── */

const CATEGORIES = ['GENERAL', 'HOSPITALITY', 'SUSTAINABILITY', 'CUSTOM'] as const

const CATEGORY_LABELS: Record<string, string> = {
  GENERAL: 'General',
  HOSPITALITY: 'Hospitality',
  SUSTAINABILITY: 'Sustainability',
  CUSTOM: 'Custom',
}

const CATEGORY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  GENERAL: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
  HOSPITALITY: { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
  SUSTAINABILITY: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  CUSTOM: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
}

const STATUS_LABELS: Record<string, string> = {
  ON_TARGET: 'On target',
  ABOVE: 'Above target',
  BELOW: 'Below target',
  NOT_SET: 'Not set',
}

const STATUS_META: Record<string, { icon: typeof TrendingUp; color: string; dotColor: string }> = {
  ON_TARGET: { icon: Target, color: 'text-emerald-600', dotColor: 'bg-emerald-500' },
  ABOVE: { icon: TrendingUp, color: 'text-amber-600', dotColor: 'bg-amber-500' },
  BELOW: { icon: TrendingDown, color: 'text-red-600', dotColor: 'bg-red-500' },
  NOT_SET: { icon: BarChart3, color: 'text-ink-400', dotColor: 'bg-ink-300' },
}

const EMPTY_FORM = {
  name: '',
  category: 'GENERAL' as string,
  value: '',
  unit: '',
  targetValue: '',
  status: 'NOT_SET',
  notes: '',
}

/* ── Page ──────────────────────────────────────────────── */

export default function KeyMetricsPage() {
  const params = useParams()
  const projectId = params.id as string
  const { toast } = useToast()

  const [metrics, setMetrics] = useState<KeyMetric[]>([])
  const [grouped, setGrouped] = useState<Record<string, KeyMetric[]>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Form state
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [editingId, setEditingId] = useState<string | null>(null)

  const { mutate: createMetric, loading: creating } = useApiMutation<{ metric: KeyMetric }>(
    `/api/projects/${projectId}/metrics`,
    'POST',
  )

  /* ── Fetch ─────────────────────────────────────────── */

  const fetchMetrics = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/projects/${projectId}/metrics`)
      if (!res.ok) throw new Error('Failed to load metrics')
      const json = await res.json()
      setMetrics(json.data?.metrics ?? [])
      setGrouped(json.data?.grouped ?? {})
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    fetchMetrics()
  }, [fetchMetrics])

  /* ── Handlers ──────────────────────────────────────── */

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) {
      toast('Metric name is required', 'error')
      return
    }

    if (editingId) {
      // Update existing metric
      try {
        const res = await fetch(`/api/projects/${projectId}/metrics/${editingId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: form.name,
            category: form.category,
            value: form.value || null,
            unit: form.unit || null,
            targetValue: form.targetValue || null,
            status: form.status,
            notes: form.notes || null,
          }),
        })
        if (!res.ok) throw new Error('Failed to update metric')
        toast('Metric updated', 'success')
        setEditingId(null)
        setShowForm(false)
        setForm(EMPTY_FORM)
        fetchMetrics()
      } catch {
        toast('Failed to update metric', 'error')
      }
    } else {
      // Create new metric
      const result = await createMetric({
        name: form.name,
        category: form.category,
        value: form.value || null,
        unit: form.unit || null,
        targetValue: form.targetValue || null,
        status: form.status,
        notes: form.notes || null,
      })
      if (result) {
        toast('Metric added', 'success')
        setShowForm(false)
        setForm(EMPTY_FORM)
        fetchMetrics()
      } else {
        toast('Failed to add metric', 'error')
      }
    }
  }

  const handleEdit = (metric: KeyMetric) => {
    setEditingId(metric.id)
    setForm({
      name: metric.name,
      category: metric.category,
      value: metric.value ?? '',
      unit: metric.unit ?? '',
      targetValue: metric.targetValue ?? '',
      status: metric.status ?? 'NOT_SET',
      notes: metric.notes ?? '',
    })
    setShowForm(true)
  }

  const handleDelete = async (metricId: string) => {
    try {
      const res = await fetch(`/api/projects/${projectId}/metrics/${metricId}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error('Failed to delete metric')
      toast('Metric removed', 'success')
      fetchMetrics()
    } catch {
      toast('Failed to remove metric', 'error')
    }
  }

  const handleCancel = () => {
    setShowForm(false)
    setEditingId(null)
    setForm(EMPTY_FORM)
  }

  /* ── Render ────────────────────────────────────────── */

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold text-ink-900">Key Metrics</h1>
        </div>
        <div className="space-y-3">
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-4">
        <h1 className="text-lg font-semibold text-ink-900">Key Metrics</h1>
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      </div>
    )
  }

  const categoryOrder = ['GENERAL', 'HOSPITALITY', 'SUSTAINABILITY', 'CUSTOM']

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-ink-900">Key Metrics</h1>
          <p className="text-xs text-ink-400 mt-1">
            Track project KPIs against targets
          </p>
        </div>
        <button
          onClick={() => { setShowForm(true); setEditingId(null); setForm(EMPTY_FORM) }}
          className="flex items-center gap-1.5 rounded-md bg-accent-600 px-3 py-2 text-xs font-medium text-white hover:bg-accent-700 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Metric
        </button>
      </div>

      {/* Add / Edit Form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="rounded-lg border border-surface-200 bg-white p-4 space-y-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-ink-800">
              {editingId ? 'Edit Metric' : 'New Metric'}
            </h3>
            <button type="button" onClick={handleCancel} className="text-ink-400 hover:text-ink-600">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {/* Name */}
            <div>
              <label className="block text-[11px] font-medium text-ink-500 mb-1">Name *</label>
              <input
                type="text"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Net Internal Area"
                className="w-full rounded-md border border-surface-300 px-3 py-2 text-sm text-ink-800 focus:border-accent-500 focus:ring-1 focus:ring-accent-500"
              />
            </div>

            {/* Category */}
            <div>
              <label className="block text-[11px] font-medium text-ink-500 mb-1">Category</label>
              <select
                value={form.category}
                onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                className="w-full rounded-md border border-surface-300 px-3 py-2 text-sm text-ink-800 focus:border-accent-500 focus:ring-1 focus:ring-accent-500"
              >
                {CATEGORIES.map(c => (
                  <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
                ))}
              </select>
            </div>

            {/* Status */}
            <div>
              <label className="block text-[11px] font-medium text-ink-500 mb-1">Status</label>
              <select
                value={form.status}
                onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                className="w-full rounded-md border border-surface-300 px-3 py-2 text-sm text-ink-800 focus:border-accent-500 focus:ring-1 focus:ring-accent-500"
              >
                <option value="NOT_SET">Not set</option>
                <option value="ON_TARGET">On target</option>
                <option value="ABOVE">Above target</option>
                <option value="BELOW">Below target</option>
              </select>
            </div>

            {/* Value */}
            <div>
              <label className="block text-[11px] font-medium text-ink-500 mb-1">Current Value</label>
              <input
                type="text"
                value={form.value}
                onChange={e => setForm(f => ({ ...f, value: e.target.value }))}
                placeholder="e.g. 12,500"
                className="w-full rounded-md border border-surface-300 px-3 py-2 text-sm text-ink-800 focus:border-accent-500 focus:ring-1 focus:ring-accent-500"
              />
            </div>

            {/* Unit */}
            <div>
              <label className="block text-[11px] font-medium text-ink-500 mb-1">Unit</label>
              <input
                type="text"
                value={form.unit}
                onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}
                placeholder="e.g. m², keys, %"
                className="w-full rounded-md border border-surface-300 px-3 py-2 text-sm text-ink-800 focus:border-accent-500 focus:ring-1 focus:ring-accent-500"
              />
            </div>

            {/* Target */}
            <div>
              <label className="block text-[11px] font-medium text-ink-500 mb-1">Target Value</label>
              <input
                type="text"
                value={form.targetValue}
                onChange={e => setForm(f => ({ ...f, targetValue: e.target.value }))}
                placeholder="e.g. 15,000"
                className="w-full rounded-md border border-surface-300 px-3 py-2 text-sm text-ink-800 focus:border-accent-500 focus:ring-1 focus:ring-accent-500"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-[11px] font-medium text-ink-500 mb-1">Notes</label>
            <textarea
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              rows={2}
              placeholder="Optional notes..."
              className="w-full rounded-md border border-surface-300 px-3 py-2 text-sm text-ink-800 focus:border-accent-500 focus:ring-1 focus:ring-accent-500 resize-none"
            />
          </div>

          <div className="flex items-center gap-2 pt-1">
            <button
              type="submit"
              disabled={creating}
              className="flex items-center gap-1.5 rounded-md bg-accent-600 px-4 py-2 text-xs font-medium text-white hover:bg-accent-700 transition-colors disabled:opacity-50"
            >
              {creating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              {editingId ? 'Update' : 'Save'}
            </button>
            <button
              type="button"
              onClick={handleCancel}
              className="rounded-md border border-surface-300 px-4 py-2 text-xs font-medium text-ink-600 hover:bg-surface-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Empty state */}
      {metrics.length === 0 && !showForm && (
        <div className="rounded-lg border border-dashed border-surface-300 bg-surface-50 p-8 text-center">
          <BarChart3 className="w-8 h-8 text-ink-300 mx-auto mb-3" />
          <p className="text-sm font-medium text-ink-600 mb-1">No metrics yet</p>
          <p className="text-xs text-ink-400 mb-4">
            Add key metrics to track project performance against targets.
          </p>
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-1.5 rounded-md bg-accent-600 px-3 py-2 text-xs font-medium text-white hover:bg-accent-700 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Add First Metric
          </button>
        </div>
      )}

      {/* Metrics grouped by category */}
      {categoryOrder.map(cat => {
        const catMetrics = grouped[cat]
        if (!catMetrics || catMetrics.length === 0) return null
        const catColors = CATEGORY_COLORS[cat] || CATEGORY_COLORS.GENERAL

        return (
          <div key={cat} className="space-y-3">
            <div className="flex items-center gap-2">
              <span className={cn('px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide', catColors.bg, catColors.text)}>
                {CATEGORY_LABELS[cat] || cat}
              </span>
              <span className="text-[11px] text-ink-400">{catMetrics.length} metric{catMetrics.length !== 1 ? 's' : ''}</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {catMetrics.map(metric => {
                const statusKey = metric.status || 'NOT_SET'
                const sm = STATUS_META[statusKey] || STATUS_META.NOT_SET
                const StatusIcon = sm.icon

                return (
                  <div
                    key={metric.id}
                    className={cn(
                      'rounded-lg border bg-white p-4 transition-shadow hover:shadow-sm',
                      catColors.border,
                    )}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-ink-800 truncate">{metric.name}</p>
                        {metric.notes && (
                          <p className="text-[11px] text-ink-400 mt-0.5 truncate">{metric.notes}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-1 ml-2 shrink-0">
                        <button
                          onClick={() => handleEdit(metric)}
                          className="p-1 rounded text-ink-400 hover:text-ink-600 hover:bg-surface-100 transition-colors"
                          title="Edit"
                        >
                          <Pencil className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => handleDelete(metric.id)}
                          className="p-1 rounded text-ink-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>

                    <div className="flex items-end justify-between">
                      <div>
                        <p className="text-xl font-bold text-ink-900">
                          {metric.value || 'Not provided'}
                          {metric.value && metric.unit && (
                            <span className="text-xs font-normal text-ink-400 ml-1">{metric.unit}</span>
                          )}
                        </p>
                        {metric.targetValue && (
                          <p className="text-[11px] text-ink-400 mt-0.5">
                            Target: {metric.targetValue}{metric.unit ? ` ${metric.unit}` : ''}
                          </p>
                        )}
                      </div>
                      <div className={cn('flex items-center gap-1 text-[11px] font-medium', sm.color)}>
                        <StatusIcon className="w-3.5 h-3.5" />
                        {STATUS_LABELS[statusKey] || 'Not set'}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

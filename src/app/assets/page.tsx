'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  Monitor, Plus, Loader2, AlertTriangle, RefreshCw,
  X, HardHat, Laptop, Smartphone, Tablet,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useToast } from '@/components/Toast'
import { useApiMutation } from '@/hooks/use-api'
import { SkeletonRow } from '@/components/Skeleton'

/* ── Types ─────────────────────────────────────────────── */

interface AssetAssignment {
  id: string
  assignedAt: string
  returnedAt: string | null
  profile: { id: string; fullName: string }
}

interface Asset {
  id: string
  assetTag: string
  name: string
  category: string
  serialNumber: string | null
  condition: string
  purchaseDate: string | null
  warrantyExpiry: string | null
  createdAt: string
  assignments: AssetAssignment[]
}

type FilterCategory = 'ALL' | 'LAPTOP' | 'MONITOR' | 'PHONE' | 'TABLET' | 'HELMET' | 'HI_VIS' | 'PPE_OTHER' | 'FURNITURE' | 'SOFTWARE' | 'OTHER'

const CATEGORY_FILTERS: { value: FilterCategory; label: string }[] = [
  { value: 'ALL', label: 'All' },
  { value: 'LAPTOP', label: 'Laptops' },
  { value: 'MONITOR', label: 'Monitors' },
  { value: 'PHONE', label: 'Phones' },
  { value: 'TABLET', label: 'Tablets' },
  { value: 'HELMET', label: 'Helmets' },
  { value: 'HI_VIS', label: 'Hi-vis' },
  { value: 'PPE_OTHER', label: 'Other PPE' },
  { value: 'FURNITURE', label: 'Furniture' },
  { value: 'SOFTWARE', label: 'Software' },
  { value: 'OTHER', label: 'Other' },
]

const ASSET_CATEGORIES: { value: string; label: string }[] = [
  { value: 'LAPTOP', label: 'Laptop' },
  { value: 'MONITOR', label: 'Monitor' },
  { value: 'PHONE', label: 'Phone' },
  { value: 'TABLET', label: 'Tablet' },
  { value: 'HELMET', label: 'Helmet' },
  { value: 'HI_VIS', label: 'Hi-vis' },
  { value: 'PPE_OTHER', label: 'Other PPE' },
  { value: 'FURNITURE', label: 'Furniture' },
  { value: 'SOFTWARE', label: 'Software' },
  { value: 'OTHER', label: 'Other' },
]

const CONDITION_META: Record<string, { label: string; color: string; bg: string }> = {
  NEW: { label: 'New', color: 'text-emerald-600', bg: 'bg-emerald-50' },
  GOOD: { label: 'Good', color: 'text-blue-600', bg: 'bg-blue-50' },
  REPAIR_REQUIRED: { label: 'Repair needed', color: 'text-amber-600', bg: 'bg-amber-50' },
  DAMAGED: { label: 'Damaged', color: 'text-red-600', bg: 'bg-red-50' },
  LOST: { label: 'Lost', color: 'text-red-600', bg: 'bg-red-50' },
  RETIRED: { label: 'Retired', color: 'text-ink-400', bg: 'bg-ink-50' },
}

/* ── Helpers ───────────────────────────────────────────── */

function CategoryIcon({ category }: { category: string }) {
  switch (category) {
    case 'LAPTOP':
      return <Laptop className="w-4 h-4 text-blue-500" />
    case 'MONITOR':
      return <Monitor className="w-4 h-4 text-indigo-500" />
    case 'PHONE':
      return <Smartphone className="w-4 h-4 text-green-500" />
    case 'TABLET':
      return <Tablet className="w-4 h-4 text-purple-500" />
    case 'HELMET':
    case 'HI_VIS':
    case 'PPE_OTHER':
      return <HardHat className="w-4 h-4 text-amber-500" />
    default:
      return <Monitor className="w-4 h-4 text-ink-400" />
  }
}

function ConditionBadge({ condition }: { condition: string }) {
  const meta = CONDITION_META[condition] || { label: condition, color: 'text-ink-500', bg: 'bg-ink-100' }
  return (
    <span className={cn('text-[11px] font-medium px-2.5 py-0.5 rounded-full', meta.bg, meta.color)}>
      {meta.label}
    </span>
  )
}

/* ── Page ──────────────────────────────────────────────── */

export default function AssetsPage() {
  const { toast } = useToast()

  const [assets, setAssets] = useState<Asset[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [categoryFilter, setCategoryFilter] = useState<FilterCategory>('ALL')

  // Create form state
  const [showForm, setShowForm] = useState(false)
  const [formName, setFormName] = useState('')
  const [formTag, setFormTag] = useState('')
  const [formCategory, setFormCategory] = useState('LAPTOP')
  const [formSerial, setFormSerial] = useState('')
  const { mutate: createAsset, loading: creating } = useApiMutation<Asset>('/api/assets', 'POST')

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/assets')
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error?.message || 'Failed to load assets')
      }
      const json = await res.json()
      setAssets(json.data.assets)
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
    if (!formName || !formTag) return

    const result = await createAsset({
      name: formName,
      assetTag: formTag,
      category: formCategory,
      serialNumber: formSerial || undefined,
    })

    if (result) {
      toast('Asset created', 'success')
      setShowForm(false)
      setFormName('')
      setFormTag('')
      setFormCategory('LAPTOP')
      setFormSerial('')
      fetchData()
    } else {
      toast('Failed to create asset', 'error')
    }
  }

  const cancelForm = () => {
    setShowForm(false)
    setFormName('')
    setFormTag('')
    setFormCategory('LAPTOP')
    setFormSerial('')
  }

  /* ── Filter ──────────────────────────────────────── */

  const filtered = categoryFilter === 'ALL' ? assets : assets.filter((a) => a.category === categoryFilter)
  const categoryCounts = assets.reduce<Record<string, number>>((acc, a) => {
    acc[a.category] = (acc[a.category] || 0) + 1
    return acc
  }, {})

  /* ── Loading ─────────────────────────────────────── */

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-36 bg-ink-100 animate-pulse rounded" />
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
          <h1 className="text-[22px] font-semibold text-ink-900">Asset Register</h1>
          <p className="text-[12px] text-ink-400 mt-0.5">
            {assets.length} assets
          </p>
        </div>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-ink-900 text-white text-[12px] font-medium hover:bg-ink-800 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add asset
          </button>
        )}
      </div>

      {/* ── Create form ────────────────────────────── */}
      {showForm && (
        <form onSubmit={handleCreate} className="bg-white rounded-xl border-2 border-accent-200 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-[14px] font-semibold text-ink-900">New asset</h3>
            <button type="button" onClick={cancelForm} className="text-ink-400 hover:text-ink-600 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="asset-name" className="block text-[11px] font-medium text-ink-500 mb-1">
                Name <span className="text-red-400">*</span>
              </label>
              <input
                id="asset-name"
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g. Dell Latitude 5540"
                className="w-full px-3 py-2 text-[13px] border border-ink-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-300 placeholder:text-ink-300"
                required
                maxLength={200}
              />
            </div>
            <div>
              <label htmlFor="asset-tag" className="block text-[11px] font-medium text-ink-500 mb-1">
                Asset tag <span className="text-red-400">*</span>
              </label>
              <input
                id="asset-tag"
                type="text"
                value={formTag}
                onChange={(e) => setFormTag(e.target.value)}
                placeholder="e.g. CWA-LAG-025"
                className="w-full px-3 py-2 text-[13px] border border-ink-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-300 placeholder:text-ink-300"
                required
                maxLength={50}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="asset-category" className="block text-[11px] font-medium text-ink-500 mb-1">Category</label>
              <select
                id="asset-category"
                value={formCategory}
                onChange={(e) => setFormCategory(e.target.value)}
                className="w-full px-3 py-2 text-[13px] border border-ink-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-300 bg-white"
              >
                {ASSET_CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="asset-serial" className="block text-[11px] font-medium text-ink-500 mb-1">Serial number</label>
              <input
                id="asset-serial"
                type="text"
                value={formSerial}
                onChange={(e) => setFormSerial(e.target.value)}
                placeholder="Optional"
                className="w-full px-3 py-2 text-[13px] border border-ink-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-300 placeholder:text-ink-300"
                maxLength={100}
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-1">
            <button type="button" onClick={cancelForm} className="px-3.5 py-2 text-[12px] font-medium text-ink-500 hover:text-ink-700 transition-colors" disabled={creating}>
              Cancel
            </button>
            <button
              type="submit"
              disabled={creating || !formName || !formTag}
              className={cn(
                'flex items-center gap-1.5 px-4 py-2 rounded-lg text-[12px] font-medium transition-colors',
                creating || !formName || !formTag
                  ? 'bg-ink-200 text-ink-400 cursor-not-allowed'
                  : 'bg-ink-900 text-white hover:bg-ink-800',
              )}
            >
              {creating && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Create asset
            </button>
          </div>
        </form>
      )}

      {/* ── Filter bar ─────────────────────────────── */}
      <div className="flex gap-1 flex-wrap">
        {CATEGORY_FILTERS.map((f) => {
          const count = f.value === 'ALL' ? assets.length : (categoryCounts[f.value] || 0)
          if (f.value !== 'ALL' && count === 0) return null
          return (
            <button
              key={f.value}
              onClick={() => setCategoryFilter(f.value)}
              className={cn(
                'px-3 py-1.5 rounded-full text-[11px] font-medium transition-colors',
                categoryFilter === f.value
                  ? 'bg-ink-900 text-white'
                  : 'bg-ink-50 text-ink-500 hover:bg-ink-100',
              )}
            >
              {f.label}
              {count > 0 && <span className={cn('ml-1', categoryFilter === f.value ? 'text-ink-300' : 'text-ink-400')}>{count}</span>}
            </button>
          )
        })}
      </div>

      {/* ── Asset list ─────────────────────────────── */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-ink-100 p-10 text-center">
          <Monitor className="w-10 h-10 text-ink-200 mx-auto mb-3" />
          <p className="text-[14px] font-medium text-ink-600">No assets</p>
          <p className="text-[12px] text-ink-400 mt-1">Click &quot;Add asset&quot; to register equipment.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-ink-100 divide-y divide-ink-50">
          {filtered.map((asset) => {
            const currentAssignment = asset.assignments[0] || null
            return (
              <div key={asset.id} className="flex items-center gap-4 px-5 py-4">
                {/* Icon */}
                <div className="w-9 h-9 rounded-lg bg-ink-50 flex items-center justify-center shrink-0">
                  <CategoryIcon category={asset.category} />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium text-ink-900 truncate">{asset.name}</p>
                  <p className="text-[11px] text-ink-400 mt-0.5">
                    {asset.assetTag}
                    {asset.serialNumber && <span> · SN: {asset.serialNumber}</span>}
                    {currentAssignment && (
                      <span className="text-blue-500"> · Assigned to {currentAssignment.profile.fullName}</span>
                    )}
                  </p>
                </div>

                {/* Condition badge */}
                <ConditionBadge condition={asset.condition} />
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

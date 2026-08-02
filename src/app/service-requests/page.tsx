'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import {
  FileText, Plus, Loader2, AlertTriangle, RefreshCw,
  X, ArrowRight, Ban, Clock, CheckCircle2, AlertCircle,
  ChevronDown, ChevronRight, Search, Filter, Calendar,
  User, Tag, MapPin, DollarSign, Paperclip, MessageSquare,
  ArrowLeft, Send, ThumbsUp, ThumbsDown, PlayCircle, Eye,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useToast } from '@/components/Toast'
import { useApiMutation } from '@/hooks/use-api'
import { SkeletonRow } from '@/components/Skeleton'

/* ── Types ─────────────────────────────────────────────── */

interface ServiceRequest {
  id: string
  requestNumber: string | null
  requestType: string
  category: string | null
  title: string
  description: string | null
  status: string
  priority: string
  location: string | null
  estimatedCost: number | null
  currency: string | null
  budgetCode: string | null
  requiredByDate: string | null
  serviceTarget: number | null
  fulfilmentNotes: string | null
  rejectionReason: string | null
  assignedTeamId: string | null
  attachmentUrls: string[]
  dynamicFields: Record<string, unknown> | null
  createdAt: string
  updatedAt: string
  approvedAt: string | null
  completedAt: string | null
  profile: { id: string; fullName: string; jobTitle?: string }
  approver: { id: string; fullName: string } | null
  assignedTo: { id: string; fullName: string } | null
  project: { id: string; name: string; code?: string } | null
  office: { id: string; name: string } | null
}

interface SummaryCounts {
  total: number
  pending: number
  inProgress: number
  completedThisMonth: number
}

type Tab = 'my' | 'all' | 'assigned'
type FilterStatus = 'ALL' | string

/* ── Constants ─────────────────────────────────────────── */

const TABS: { value: Tab; label: string }[] = [
  { value: 'my', label: 'My Requests' },
  { value: 'all', label: 'All Requests' },
  { value: 'assigned', label: 'Assigned to Me' },
]

const REQUEST_TYPES: { value: string; label: string; icon: string }[] = [
  { value: 'IT_SUPPORT', label: 'IT Support', icon: '💻' },
  { value: 'EQUIPMENT', label: 'Equipment', icon: '🔧' },
  { value: 'PPE', label: 'PPE', icon: '🦺' },
  { value: 'SOFTWARE_LICENCE', label: 'Software Licence', icon: '📀' },
  { value: 'TRAINING', label: 'Training', icon: '📚' },
  { value: 'BOOKS_STANDARDS', label: 'Books & Standards', icon: '📖' },
  { value: 'TRAVEL', label: 'Travel', icon: '✈️' },
  { value: 'FLIGHTS_ACCOMMODATION', label: 'Flights & Accommodation', icon: '🏨' },
  { value: 'OFFICE_SUPPLIES', label: 'Office Supplies', icon: '🖊️' },
  { value: 'ACCOUNT_PERMISSION', label: 'Account / Permission', icon: '🔑' },
  { value: 'PROCUREMENT_PURCHASE', label: 'Procurement / Purchase', icon: '🛒' },
  { value: 'OFFICE_FACILITIES', label: 'Office Facilities', icon: '🏢' },
  { value: 'HR_REQUEST', label: 'HR Request', icon: '👤' },
  { value: 'PROJECT_INFORMATION', label: 'Project Information', icon: '📋' },
  { value: 'VEHICLE_LOGISTICS', label: 'Vehicle / Logistics', icon: '🚗' },
  { value: 'CUSTOM', label: 'Custom', icon: '⚙️' },
]

const PRIORITIES: { value: string; label: string; color: string; bg: string }[] = [
  { value: 'LOW', label: 'Low', color: 'text-ink-500', bg: 'bg-ink-100' },
  { value: 'MEDIUM', label: 'Medium', color: 'text-blue-600', bg: 'bg-blue-50' },
  { value: 'HIGH', label: 'High', color: 'text-amber-600', bg: 'bg-amber-50' },
  { value: 'URGENT', label: 'Urgent', color: 'text-red-600', bg: 'bg-red-50' },
]

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  DRAFT: { label: 'Draft', color: 'text-ink-500', bg: 'bg-ink-100' },
  SUBMITTED: { label: 'Submitted', color: 'text-blue-600', bg: 'bg-blue-50' },
  UNDER_REVIEW: { label: 'Under Review', color: 'text-amber-600', bg: 'bg-amber-50' },
  LINE_MANAGER_APPROVED: { label: 'Manager Approved', color: 'text-teal-600', bg: 'bg-teal-50' },
  HR_APPROVED: { label: 'HR Approved', color: 'text-teal-600', bg: 'bg-teal-50' },
  APPROVED: { label: 'Approved', color: 'text-emerald-600', bg: 'bg-emerald-50' },
  REJECTED: { label: 'Rejected', color: 'text-red-600', bg: 'bg-red-50' },
  FULFILMENT_IN_PROGRESS: { label: 'In Progress', color: 'text-purple-600', bg: 'bg-purple-50' },
  COMPLETED: { label: 'Completed', color: 'text-emerald-700', bg: 'bg-emerald-100' },
  CANCELLED: { label: 'Cancelled', color: 'text-ink-400', bg: 'bg-ink-50' },
  WITHDRAWN: { label: 'Withdrawn', color: 'text-ink-400', bg: 'bg-ink-50' },
}

const STATUS_FILTERS: { value: string; label: string }[] = [
  { value: 'ALL', label: 'All' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'SUBMITTED', label: 'Submitted' },
  { value: 'UNDER_REVIEW', label: 'Under Review' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'FULFILMENT_IN_PROGRESS', label: 'In Progress' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'WITHDRAWN', label: 'Withdrawn' },
]

/* ── Type-specific form fields ─────────────────────────── */

const TYPE_CATEGORIES: Record<string, string[]> = {
  IT_SUPPORT: ['Hardware', 'Software', 'Network', 'Email/Access', 'Printer', 'Other'],
  EQUIPMENT: ['Site Equipment', 'Office Equipment', 'Safety Equipment', 'Measuring', 'Other'],
  PPE: ['Hard Hat', 'Hi-Vis', 'Safety Boots', 'Gloves', 'Eye Protection', 'Full Kit', 'Other'],
  SOFTWARE_LICENCE: ['AutoCAD', 'Revit', 'SketchUp', 'MS Office', 'Adobe CC', 'Other'],
  TRAINING: ['Health & Safety', 'Technical', 'Management', 'CPD', 'Certification', 'Other'],
  TRAVEL: ['Domestic', 'International', 'Site Visit', 'Client Meeting', 'Conference', 'Other'],
  FLIGHTS_ACCOMMODATION: ['Flights Only', 'Hotel Only', 'Both', 'Airport Transfer', 'Other'],
  PROCUREMENT_PURCHASE: ['Materials', 'Services', 'Subcontractor', 'Equipment', 'Other'],
  OFFICE_FACILITIES: ['Maintenance', 'Cleaning', 'Security', 'Furniture', 'IT Infrastructure', 'Other'],
  HR_REQUEST: ['Leave Query', 'Payroll', 'Benefits', 'Policy', 'Grievance', 'Other'],
  VEHICLE_LOGISTICS: ['Pool Car', 'Delivery', 'Collection', 'Hire Vehicle', 'Other'],
}

/* ── Helpers ───────────────────────────────────────────── */

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function formatShortDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

function StatusBadge({ status }: { status: string }) {
  const meta = STATUS_META[status] || { label: status, color: 'text-ink-500', bg: 'bg-ink-100' }
  return (
    <span className={cn('text-[11px] font-medium px-2.5 py-0.5 rounded-full whitespace-nowrap', meta.bg, meta.color)}>
      {meta.label}
    </span>
  )
}

function PriorityBadge({ priority }: { priority: string }) {
  const meta = PRIORITIES.find(p => p.value === priority) || PRIORITIES[1]
  return (
    <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded', meta.bg, meta.color)}>
      {meta.label}
    </span>
  )
}

function SummaryCard({ label, value, icon: Icon, color }: {
  label: string; value: number; icon: React.ElementType; color: string
}) {
  return (
    <div className="bg-white rounded-xl border border-ink-100 p-4 flex items-center gap-3">
      <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center', color)}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-[22px] font-semibold text-ink-900 leading-tight">{value}</p>
        <p className="text-[11px] text-ink-400 mt-0.5">{label}</p>
      </div>
    </div>
  )
}

/* ── Page ──────────────────────────────────────────────── */

export default function ServiceRequestsPage() {
  const { toast } = useToast()

  /* ── State ──────────────────────────────────────── */
  const [requests, setRequests] = useState<ServiceRequest[]>([])
  const [counts, setCounts] = useState<SummaryCounts>({ total: 0, pending: 0, inProgress: 0, completedThisMonth: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Tabs & filters
  const [activeTab, setActiveTab] = useState<Tab>('my')
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('ALL')
  const [typeFilter, setTypeFilter] = useState<string>('')
  const [priorityFilter, setPriorityFilter] = useState<string>('')
  const [searchQuery, setSearchQuery] = useState('')
  const [showFilters, setShowFilters] = useState(false)

  // Create form
  const [showForm, setShowForm] = useState(false)
  const [formType, setFormType] = useState('IT_SUPPORT')
  const [formTitle, setFormTitle] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [formPriority, setFormPriority] = useState('MEDIUM')
  const [formCategory, setFormCategory] = useState('')
  const [formLocation, setFormLocation] = useState('')
  const [formEstimatedCost, setFormEstimatedCost] = useState('')
  const [formRequiredByDate, setFormRequiredByDate] = useState('')
  const [formBudgetCode, setFormBudgetCode] = useState('')
  const { mutate: createRequest, loading: creating } = useApiMutation<ServiceRequest>('/api/service-requests', 'POST')

  // Detail panel
  const [selectedRequest, setSelectedRequest] = useState<ServiceRequest | null>(null)
  const [showDetail, setShowDetail] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [rejectionReason, setRejectionReason] = useState('')
  const [fulfilmentNotes, setFulfilmentNotes] = useState('')
  const [showRejectForm, setShowRejectForm] = useState(false)

  /* ── Fetch data ─────────────────────────────────── */
  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ tab: activeTab })
      if (typeFilter) params.set('type', typeFilter)
      if (statusFilter !== 'ALL') params.set('status', statusFilter)
      if (priorityFilter) params.set('priority', priorityFilter)

      const res = await fetch(`/api/service-requests?${params.toString()}`)
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error?.message || 'Failed to load service requests')
      }
      const json = await res.json()
      setRequests(json.data.requests)
      setCounts(json.data.counts)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }, [activeTab, typeFilter, statusFilter, priorityFilter])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  /* ── Fetch single request ───────────────────────── */
  const fetchDetail = useCallback(async (id: string) => {
    setDetailLoading(true)
    try {
      const res = await fetch(`/api/service-requests/${id}`)
      if (!res.ok) throw new Error('Failed to load request details')
      const json = await res.json()
      setSelectedRequest(json.data.serviceRequest)
      setShowDetail(true)
    } catch {
      toast('Failed to load request details', 'error')
    } finally {
      setDetailLoading(false)
    }
  }, [toast])

  /* ── Create handler ──────────────────────────────── */
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formTitle) return

    const result = await createRequest({
      requestType: formType,
      title: formTitle,
      description: formDescription || undefined,
      priority: formPriority,
      category: formCategory || undefined,
      location: formLocation || undefined,
      estimatedCost: formEstimatedCost ? parseFloat(formEstimatedCost) : undefined,
      requiredByDate: formRequiredByDate || undefined,
      budgetCode: formBudgetCode || undefined,
    })

    if (result) {
      toast('Service request created', 'success')
      resetForm()
      fetchData()
    } else {
      toast('Failed to create service request', 'error')
    }
  }

  const resetForm = () => {
    setShowForm(false)
    setFormType('IT_SUPPORT')
    setFormTitle('')
    setFormDescription('')
    setFormPriority('MEDIUM')
    setFormCategory('')
    setFormLocation('')
    setFormEstimatedCost('')
    setFormRequiredByDate('')
    setFormBudgetCode('')
  }

  /* ── Status change ───────────────────────────────── */
  const handleStatusChange = async (id: string, newStatus: string, extras?: Record<string, unknown>) => {
    try {
      const res = await fetch(`/api/service-requests/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus, ...extras }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error?.message || 'Failed to update')
      }
      const label = STATUS_META[newStatus]?.label || newStatus
      toast(`Request ${label.toLowerCase()}`, 'success')
      fetchData()
      if (selectedRequest?.id === id) {
        fetchDetail(id)
      }
      setShowRejectForm(false)
      setRejectionReason('')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to update', 'error')
    }
  }

  /* ── Filtered list ───────────────────────────────── */
  const filtered = useMemo(() => {
    let list = requests
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      list = list.filter(r =>
        r.title.toLowerCase().includes(q) ||
        r.requestNumber?.toLowerCase().includes(q) ||
        r.profile.fullName.toLowerCase().includes(q) ||
        r.description?.toLowerCase().includes(q)
      )
    }
    return list
  }, [requests, searchQuery])

  const statusCounts = useMemo(() => {
    return requests.reduce<Record<string, number>>((acc, r) => {
      acc[r.status] = (acc[r.status] || 0) + 1
      return acc
    }, {})
  }, [requests])

  /* ── Categories for selected type ────────────────── */
  const currentCategories = TYPE_CATEGORIES[formType] || []

  /* ── Loading state ──────────────────────────────── */
  if (loading && requests.length === 0) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-ink-100 animate-pulse rounded" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-ink-100 p-4 h-20 animate-pulse" />
          ))}
        </div>
        <div className="bg-white rounded-xl border border-ink-100 divide-y divide-ink-50">
          {Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)}
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
          <h1 className="text-[22px] font-semibold text-ink-900">Service Requests</h1>
          <p className="text-[12px] text-ink-400 mt-0.5">
            Raise, track, and manage service requests across your organisation
          </p>
        </div>
        {!showForm && !showDetail && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-ink-900 text-white text-[12px] font-medium hover:bg-ink-800 transition-colors"
          >
            <Plus className="w-4 h-4" />
            New request
          </button>
        )}
      </div>

      {/* ── Summary cards ──────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard label="Total requests" value={counts.total} icon={FileText} color="bg-blue-50 text-blue-500" />
        <SummaryCard label="Pending" value={counts.pending} icon={Clock} color="bg-amber-50 text-amber-500" />
        <SummaryCard label="In progress" value={counts.inProgress} icon={PlayCircle} color="bg-purple-50 text-purple-500" />
        <SummaryCard label="Completed this month" value={counts.completedThisMonth} icon={CheckCircle2} color="bg-emerald-50 text-emerald-500" />
      </div>

      {/* ── Detail panel (overlays the list) ─────── */}
      {showDetail && selectedRequest && (
        <RequestDetailPanel
          request={selectedRequest}
          loading={detailLoading}
          onClose={() => { setShowDetail(false); setSelectedRequest(null); setShowRejectForm(false) }}
          onStatusChange={handleStatusChange}
          rejectionReason={rejectionReason}
          setRejectionReason={setRejectionReason}
          fulfilmentNotes={fulfilmentNotes}
          setFulfilmentNotes={setFulfilmentNotes}
          showRejectForm={showRejectForm}
          setShowRejectForm={setShowRejectForm}
        />
      )}

      {/* ── Create form ────────────────────────────── */}
      {showForm && !showDetail && (
        <form onSubmit={handleCreate} className="bg-white rounded-xl border-2 border-accent-200 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-[14px] font-semibold text-ink-900">New service request</h3>
            <button type="button" onClick={resetForm} className="text-ink-400 hover:text-ink-600 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Row 1: Type + Priority */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label htmlFor="sr-type" className="block text-[11px] font-medium text-ink-500 mb-1">Type</label>
              <select
                id="sr-type"
                value={formType}
                onChange={(e) => { setFormType(e.target.value); setFormCategory('') }}
                className="w-full px-3 py-2 text-[13px] border border-ink-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-300 bg-white"
              >
                {REQUEST_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.icon} {t.label}</option>
                ))}
              </select>
            </div>

            {currentCategories.length > 0 && (
              <div>
                <label htmlFor="sr-category" className="block text-[11px] font-medium text-ink-500 mb-1">Category</label>
                <select
                  id="sr-category"
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value)}
                  className="w-full px-3 py-2 text-[13px] border border-ink-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-300 bg-white"
                >
                  <option value="">Select category</option>
                  {currentCategories.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label htmlFor="sr-priority" className="block text-[11px] font-medium text-ink-500 mb-1">Priority</label>
              <select
                id="sr-priority"
                value={formPriority}
                onChange={(e) => setFormPriority(e.target.value)}
                className="w-full px-3 py-2 text-[13px] border border-ink-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-300 bg-white"
              >
                {PRIORITIES.map((p) => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Row 2: Title */}
          <div>
            <label htmlFor="sr-title" className="block text-[11px] font-medium text-ink-500 mb-1">
              Title <span className="text-red-400">*</span>
            </label>
            <input
              id="sr-title"
              type="text"
              value={formTitle}
              onChange={(e) => setFormTitle(e.target.value)}
              placeholder="e.g. New laptop for site visits"
              className="w-full px-3 py-2 text-[13px] border border-ink-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-300 placeholder:text-ink-300"
              required
              maxLength={200}
            />
          </div>

          {/* Row 3: Description */}
          <div>
            <label htmlFor="sr-desc" className="block text-[11px] font-medium text-ink-500 mb-1">Description</label>
            <textarea
              id="sr-desc"
              value={formDescription}
              onChange={(e) => setFormDescription(e.target.value)}
              placeholder="Provide additional details about your request..."
              className="w-full px-3 py-2 text-[13px] border border-ink-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-300 placeholder:text-ink-300 resize-none"
              rows={3}
              maxLength={4000}
            />
          </div>

          {/* Row 4: Optional fields */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label htmlFor="sr-location" className="block text-[11px] font-medium text-ink-500 mb-1">Location</label>
              <input
                id="sr-location"
                type="text"
                value={formLocation}
                onChange={(e) => setFormLocation(e.target.value)}
                placeholder="e.g. Lagos Office"
                className="w-full px-3 py-2 text-[13px] border border-ink-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-300 placeholder:text-ink-300"
                maxLength={500}
              />
            </div>
            <div>
              <label htmlFor="sr-cost" className="block text-[11px] font-medium text-ink-500 mb-1">Estimated cost</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[12px] text-ink-400">GBP</span>
                <input
                  id="sr-cost"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formEstimatedCost}
                  onChange={(e) => setFormEstimatedCost(e.target.value)}
                  placeholder="0.00"
                  className="w-full pl-11 pr-3 py-2 text-[13px] border border-ink-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-300 placeholder:text-ink-300"
                />
              </div>
            </div>
            <div>
              <label htmlFor="sr-date" className="block text-[11px] font-medium text-ink-500 mb-1">Required by</label>
              <input
                id="sr-date"
                type="date"
                value={formRequiredByDate}
                onChange={(e) => setFormRequiredByDate(e.target.value)}
                className="w-full px-3 py-2 text-[13px] border border-ink-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-300"
              />
            </div>
          </div>

          {/* Row 5: Budget code */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label htmlFor="sr-budget" className="block text-[11px] font-medium text-ink-500 mb-1">Budget code</label>
              <input
                id="sr-budget"
                type="text"
                value={formBudgetCode}
                onChange={(e) => setFormBudgetCode(e.target.value)}
                placeholder="e.g. PROJ-001"
                className="w-full px-3 py-2 text-[13px] border border-ink-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-300 placeholder:text-ink-300"
                maxLength={50}
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-1">
            <button type="button" onClick={resetForm} className="px-3.5 py-2 text-[12px] font-medium text-ink-500 hover:text-ink-700 transition-colors" disabled={creating}>
              Cancel
            </button>
            <button
              type="submit"
              disabled={creating || !formTitle}
              className={cn(
                'flex items-center gap-1.5 px-4 py-2 rounded-lg text-[12px] font-medium transition-colors',
                creating || !formTitle
                  ? 'bg-ink-200 text-ink-400 cursor-not-allowed'
                  : 'bg-ink-900 text-white hover:bg-ink-800',
              )}
            >
              {creating && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Create request
            </button>
          </div>
        </form>
      )}

      {/* ── Tabs ──────────────────────────────────── */}
      {!showDetail && (
        <>
          <div className="flex items-center gap-6 border-b border-ink-100">
            {TABS.map((tab) => (
              <button
                key={tab.value}
                onClick={() => { setActiveTab(tab.value); setStatusFilter('ALL') }}
                className={cn(
                  'pb-2.5 text-[13px] font-medium border-b-2 transition-colors -mb-px',
                  activeTab === tab.value
                    ? 'border-ink-900 text-ink-900'
                    : 'border-transparent text-ink-400 hover:text-ink-600',
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* ── Search + filter bar ─────────────────── */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-300" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search requests..."
                className="w-full pl-9 pr-3 py-2 text-[13px] border border-ink-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-300 placeholder:text-ink-300"
              />
            </div>

            <button
              onClick={() => setShowFilters(!showFilters)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12px] font-medium transition-colors border',
                showFilters
                  ? 'border-accent-300 bg-accent-50 text-accent-700'
                  : 'border-ink-200 text-ink-500 hover:bg-ink-50',
              )}
            >
              <Filter className="w-3.5 h-3.5" />
              Filters
              {(typeFilter || priorityFilter) && (
                <span className="w-1.5 h-1.5 rounded-full bg-accent-500" />
              )}
            </button>

            <button
              onClick={fetchData}
              disabled={loading}
              className="p-2 rounded-lg text-ink-400 hover:text-ink-600 hover:bg-ink-50 transition-colors"
              title="Refresh"
            >
              <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
            </button>
          </div>

          {/* ── Expanded filters ───────────────────── */}
          {showFilters && (
            <div className="bg-ink-50 rounded-lg p-4 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-[11px] font-medium text-ink-500 mb-1">Type</label>
                  <select
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value)}
                    className="w-full px-3 py-2 text-[12px] border border-ink-200 rounded-lg bg-white"
                  >
                    <option value="">All types</option>
                    {REQUEST_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-ink-500 mb-1">Priority</label>
                  <select
                    value={priorityFilter}
                    onChange={(e) => setPriorityFilter(e.target.value)}
                    className="w-full px-3 py-2 text-[12px] border border-ink-200 rounded-lg bg-white"
                  >
                    <option value="">All priorities</option>
                    {PRIORITIES.map((p) => (
                      <option key={p.value} value={p.value}>{p.label}</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-end">
                  <button
                    onClick={() => { setTypeFilter(''); setPriorityFilter(''); setSearchQuery('') }}
                    className="px-3 py-2 text-[12px] text-ink-500 hover:text-ink-700 transition-colors"
                  >
                    Clear all
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── Status filter pills ────────────────── */}
          <div className="flex gap-1 flex-wrap">
            {STATUS_FILTERS.map((f) => {
              const count = f.value === 'ALL' ? requests.length : (statusCounts[f.value] || 0)
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

          {/* ── Request list ───────────────────────── */}
          {filtered.length === 0 ? (
            <div className="bg-white rounded-xl border border-ink-100 p-10 text-center">
              <FileText className="w-10 h-10 text-ink-200 mx-auto mb-3" />
              <p className="text-[14px] font-medium text-ink-600">No service requests</p>
              <p className="text-[12px] text-ink-400 mt-1">
                {searchQuery ? 'No requests match your search.' : 'Click "New request" to get started.'}
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-ink-100 divide-y divide-ink-50">
              {filtered.map((req) => (
                <button
                  key={req.id}
                  onClick={() => fetchDetail(req.id)}
                  className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-ink-25 transition-colors"
                >
                  {/* Icon */}
                  <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                    <span className="text-[16px]">{REQUEST_TYPES.find(t => t.value === req.requestType)?.icon || '📋'}</span>
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      {req.requestNumber && (
                        <span className="text-[10px] font-mono text-ink-400 bg-ink-50 px-1.5 py-0.5 rounded">
                          {req.requestNumber}
                        </span>
                      )}
                      <p className="text-[13px] font-medium text-ink-900 truncate">{req.title}</p>
                    </div>
                    <p className="text-[11px] text-ink-400 mt-0.5">
                      {REQUEST_TYPES.find((t) => t.value === req.requestType)?.label || req.requestType}
                      {' · '}{formatShortDate(req.createdAt)}
                      {' · '}{req.profile.fullName}
                      {req.project && ` · ${req.project.code || req.project.name}`}
                    </p>
                  </div>

                  {/* Priority + Status */}
                  <div className="flex items-center gap-2 shrink-0">
                    <PriorityBadge priority={req.priority} />
                    <StatusBadge status={req.status} />
                  </div>

                  <ChevronRight className="w-4 h-4 text-ink-300 shrink-0" />
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

/* ── Request Detail Panel ──────────────────────────────── */

function RequestDetailPanel({
  request,
  loading,
  onClose,
  onStatusChange,
  rejectionReason,
  setRejectionReason,
  fulfilmentNotes,
  setFulfilmentNotes,
  showRejectForm,
  setShowRejectForm,
}: {
  request: ServiceRequest
  loading: boolean
  onClose: () => void
  onStatusChange: (id: string, status: string, extras?: Record<string, unknown>) => void
  rejectionReason: string
  setRejectionReason: (v: string) => void
  fulfilmentNotes: string
  setFulfilmentNotes: (v: string) => void
  showRejectForm: boolean
  setShowRejectForm: (v: boolean) => void
}) {
  const typeMeta = REQUEST_TYPES.find(t => t.value === request.requestType)

  /* Workflow action buttons based on current status */
  const renderActions = () => {
    const actions: React.ReactNode[] = []
    const status = request.status

    if (status === 'DRAFT') {
      actions.push(
        <button
          key="submit"
          onClick={() => onStatusChange(request.id, 'SUBMITTED')}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-blue-600 text-white text-[12px] font-medium hover:bg-blue-700 transition-colors"
        >
          <Send className="w-3.5 h-3.5" /> Submit
        </button>,
        <button
          key="withdraw"
          onClick={() => onStatusChange(request.id, 'WITHDRAWN')}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-ink-200 text-ink-500 text-[12px] font-medium hover:bg-ink-50 transition-colors"
        >
          <Ban className="w-3.5 h-3.5" /> Withdraw
        </button>,
      )
    }

    if (status === 'SUBMITTED') {
      actions.push(
        <button
          key="review"
          onClick={() => onStatusChange(request.id, 'UNDER_REVIEW')}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-amber-500 text-white text-[12px] font-medium hover:bg-amber-600 transition-colors"
        >
          <Eye className="w-3.5 h-3.5" /> Start Review
        </button>,
        <button
          key="withdraw"
          onClick={() => onStatusChange(request.id, 'WITHDRAWN')}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-ink-200 text-ink-500 text-[12px] font-medium hover:bg-ink-50 transition-colors"
        >
          <Ban className="w-3.5 h-3.5" /> Withdraw
        </button>,
      )
    }

    if (status === 'UNDER_REVIEW') {
      actions.push(
        <button
          key="approve"
          onClick={() => onStatusChange(request.id, 'APPROVED')}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-600 text-white text-[12px] font-medium hover:bg-emerald-700 transition-colors"
        >
          <ThumbsUp className="w-3.5 h-3.5" /> Approve
        </button>,
        <button
          key="reject"
          onClick={() => setShowRejectForm(true)}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-red-600 text-white text-[12px] font-medium hover:bg-red-700 transition-colors"
        >
          <ThumbsDown className="w-3.5 h-3.5" /> Reject
        </button>,
      )
    }

    if (status === 'APPROVED') {
      actions.push(
        <button
          key="fulfil"
          onClick={() => onStatusChange(request.id, 'FULFILMENT_IN_PROGRESS')}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-purple-600 text-white text-[12px] font-medium hover:bg-purple-700 transition-colors"
        >
          <PlayCircle className="w-3.5 h-3.5" /> Start Fulfilment
        </button>,
      )
    }

    if (status === 'FULFILMENT_IN_PROGRESS') {
      actions.push(
        <button
          key="complete"
          onClick={() => onStatusChange(request.id, 'COMPLETED', fulfilmentNotes ? { fulfilmentNotes } : {})}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-600 text-white text-[12px] font-medium hover:bg-emerald-700 transition-colors"
        >
          <CheckCircle2 className="w-3.5 h-3.5" /> Mark Complete
        </button>,
      )
    }

    return actions
  }

  return (
    <div className="bg-white rounded-xl border border-ink-100 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-ink-100">
        <button
          onClick={onClose}
          className="flex items-center gap-1.5 text-[13px] text-ink-500 hover:text-ink-700 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to list
        </button>
        <div className="flex items-center gap-2">
          {renderActions()}
        </div>
      </div>

      {loading ? (
        <div className="p-8 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-ink-300" />
        </div>
      ) : (
        <div className="p-5 space-y-6">
          {/* Title + badges */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              {request.requestNumber && (
                <span className="text-[11px] font-mono text-ink-400 bg-ink-50 px-2 py-0.5 rounded">
                  {request.requestNumber}
                </span>
              )}
              <StatusBadge status={request.status} />
              <PriorityBadge priority={request.priority} />
            </div>
            <h2 className="text-[18px] font-semibold text-ink-900">{request.title}</h2>
            <p className="text-[12px] text-ink-400 mt-1">
              {typeMeta?.icon} {typeMeta?.label || request.requestType}
              {request.category && ` / ${request.category}`}
            </p>
          </div>

          {/* Reject form */}
          {showRejectForm && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 space-y-3">
              <p className="text-[13px] font-medium text-red-700">Reject this request</p>
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Reason for rejection..."
                className="w-full px-3 py-2 text-[13px] border border-red-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-300 placeholder:text-red-300 bg-white resize-none"
                rows={2}
              />
              <div className="flex items-center gap-2">
                <button
                  onClick={() => onStatusChange(request.id, 'REJECTED', { rejectionReason })}
                  className="px-3.5 py-2 rounded-lg bg-red-600 text-white text-[12px] font-medium hover:bg-red-700 transition-colors"
                >
                  Confirm Rejection
                </button>
                <button
                  onClick={() => { setShowRejectForm(false); setRejectionReason('') }}
                  className="px-3.5 py-2 text-[12px] text-ink-500 hover:text-ink-700 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Rejection reason display */}
          {request.rejectionReason && request.status === 'REJECTED' && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-[11px] font-medium text-red-600 mb-1">Rejection reason</p>
              <p className="text-[13px] text-red-700">{request.rejectionReason}</p>
            </div>
          )}

          {/* Detail grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left column */}
            <div className="space-y-4">
              {request.description && (
                <DetailField icon={MessageSquare} label="Description" value={request.description} />
              )}
              <DetailField icon={User} label="Requested by" value={`${request.profile.fullName}${request.profile.jobTitle ? ` (${request.profile.jobTitle})` : ''}`} />
              {request.approver && (
                <DetailField icon={User} label="Approver" value={request.approver.fullName} />
              )}
              {request.assignedTo && (
                <DetailField icon={User} label="Assigned to" value={request.assignedTo.fullName} />
              )}
              {request.project && (
                <DetailField icon={Tag} label="Project" value={`${request.project.code ? `[${request.project.code}] ` : ''}${request.project.name}`} />
              )}
              {request.office && (
                <DetailField icon={MapPin} label="Office" value={request.office.name} />
              )}
            </div>

            {/* Right column */}
            <div className="space-y-4">
              {request.location && (
                <DetailField icon={MapPin} label="Location" value={request.location} />
              )}
              {request.estimatedCost !== null && request.estimatedCost !== undefined && (
                <DetailField icon={DollarSign} label="Estimated cost" value={`${request.currency || 'GBP'} ${request.estimatedCost.toLocaleString('en-GB', { minimumFractionDigits: 2 })}`} />
              )}
              {request.budgetCode && (
                <DetailField icon={Tag} label="Budget code" value={request.budgetCode} />
              )}
              {request.requiredByDate && (
                <DetailField icon={Calendar} label="Required by" value={formatDate(request.requiredByDate)} />
              )}
              {request.serviceTarget && (
                <DetailField icon={Clock} label="SLA target" value={`${request.serviceTarget} business days`} />
              )}
              <DetailField icon={Calendar} label="Created" value={formatDate(request.createdAt)} />
              {request.approvedAt && (
                <DetailField icon={Calendar} label="Approved" value={formatDate(request.approvedAt)} />
              )}
              {request.completedAt && (
                <DetailField icon={Calendar} label="Completed" value={formatDate(request.completedAt)} />
              )}
            </div>
          </div>

          {/* Fulfilment notes (for in-progress requests) */}
          {request.status === 'FULFILMENT_IN_PROGRESS' && (
            <div className="border-t border-ink-100 pt-4 space-y-3">
              <p className="text-[12px] font-medium text-ink-600">Fulfilment notes</p>
              <textarea
                value={fulfilmentNotes || request.fulfilmentNotes || ''}
                onChange={(e) => setFulfilmentNotes(e.target.value)}
                placeholder="Add notes about the fulfilment progress..."
                className="w-full px-3 py-2 text-[13px] border border-ink-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-300 placeholder:text-ink-300 resize-none"
                rows={2}
              />
            </div>
          )}

          {/* Completed fulfilment notes */}
          {request.fulfilmentNotes && request.status === 'COMPLETED' && (
            <div className="border-t border-ink-100 pt-4">
              <p className="text-[11px] font-medium text-ink-500 mb-1">Fulfilment notes</p>
              <p className="text-[13px] text-ink-700">{request.fulfilmentNotes}</p>
            </div>
          )}

          {/* Status timeline */}
          <div className="border-t border-ink-100 pt-4">
            <p className="text-[12px] font-medium text-ink-600 mb-3">Status timeline</p>
            <div className="space-y-2">
              <TimelineStep label="Created" date={request.createdAt} active />
              {request.status !== 'DRAFT' && (
                <TimelineStep label="Submitted" date={request.createdAt} active={['SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'FULFILMENT_IN_PROGRESS', 'COMPLETED', 'REJECTED'].includes(request.status)} />
              )}
              {['UNDER_REVIEW', 'APPROVED', 'FULFILMENT_IN_PROGRESS', 'COMPLETED', 'REJECTED'].includes(request.status) && (
                <TimelineStep label="Under Review" date={null} active />
              )}
              {request.approvedAt && (
                <TimelineStep
                  label={request.status === 'REJECTED' ? 'Rejected' : 'Approved'}
                  date={request.approvedAt}
                  active
                  error={request.status === 'REJECTED'}
                />
              )}
              {['FULFILMENT_IN_PROGRESS', 'COMPLETED'].includes(request.status) && (
                <TimelineStep label="In Progress" date={null} active />
              )}
              {request.completedAt && (
                <TimelineStep label="Completed" date={request.completedAt} active />
              )}
              {request.status === 'WITHDRAWN' && (
                <TimelineStep label="Withdrawn" date={request.updatedAt} active error />
              )}
              {request.status === 'CANCELLED' && (
                <TimelineStep label="Cancelled" date={request.updatedAt} active error />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ── Sub-components ──────────────────────────────────────── */

function DetailField({ icon: Icon, label, value }: {
  icon: React.ElementType; label: string; value: string
}) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon className="w-4 h-4 text-ink-300 mt-0.5 shrink-0" />
      <div>
        <p className="text-[11px] font-medium text-ink-400">{label}</p>
        <p className="text-[13px] text-ink-700 mt-0.5 whitespace-pre-wrap">{value}</p>
      </div>
    </div>
  )
}

function TimelineStep({ label, date, active, error }: {
  label: string; date: string | null; active: boolean; error?: boolean
}) {
  return (
    <div className="flex items-center gap-3">
      <div className={cn(
        'w-2.5 h-2.5 rounded-full shrink-0',
        error ? 'bg-red-400' : active ? 'bg-emerald-400' : 'bg-ink-200',
      )} />
      <p className="text-[12px] text-ink-600 flex-1">{label}</p>
      {date && (
        <p className="text-[11px] text-ink-400">{formatDate(date)}</p>
      )}
    </div>
  )
}

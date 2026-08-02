'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import Link from 'next/link'
import {
  CheckCircle2, AlertTriangle, Clock, Eye, Search,
  FolderOpen, Loader2, RefreshCw, Bell, CalendarDays,
  Wallet, ChevronDown, ArrowUpDown, SlidersHorizontal,
  ClipboardList, FileCheck, ShieldCheck, MapPin, Bug,
  X, Filter, Calendar,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { SkeletonRow, SkeletonStats } from '@/components/Skeleton'

/* ═══════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════ */

interface DashboardProfile {
  fullName: string
  jobTitle: string | null
  status: string
  organisationName: string
}

interface DashboardStats {
  totalTasks: number
  overdueTasks: number
  inReviewTasks: number
  completedThisWeek: number
}

interface ProjectSummary {
  id: string
  name: string
  code: string
  stage: string
  healthStatus: string
  myTaskCount: number
  overdueTaskCount: number
  inReviewTaskCount: number
}

interface DashboardData {
  profile: DashboardProfile
  projects: ProjectSummary[]
  urgentTasks: TaskItem[]
  stats: DashboardStats
}

interface TaskItem {
  id: string
  title: string
  projectId: string
  projectName: string
  projectCode: string
  status: string
  priority: string
  dueDate: string | null
  estimatedHours: number | null
  type?: string
  assignedBy?: string
  createdAt?: string
}

interface ReviewItem {
  id: string
  title: string
  type: 'task' | 'document'
  projectName: string
  projectCode: string
  status: string
  submittedDate: string
  submittedBy: string
}

interface ApprovalItem {
  id: string
  type: 'leave' | 'expense' | 'budget' | 'variation'
  title: string
  requester: string
  date: string
  amount: string | null
  status: string
}

interface ObservationItem {
  id: string
  title: string
  projectName: string
  projectCode: string
  location: string
  priority: string
  status: string
  dueDate: string | null
  createdAt: string
}

interface SnagItem {
  id: string
  title: string
  projectName: string
  projectCode: string
  location: string
  category: string
  severity: string
  status: string
  dueDate: string | null
  createdAt: string
}

interface LeaveRequest {
  id: string
  leaveType: string
  startDate: string
  endDate: string
  days: number
  reason: string | null
  status: string
  createdAt: string
  approver: { id: string; fullName: string } | null
}

interface LeaveBalance {
  year: number
  allocation: number
  used: number
  carriedForward: number
  pending: number
  available: number
}

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
  approver: { id: string; fullName: string } | null
}

interface NotificationItem {
  id: string
  title: string
  body: string
  type: string
  read: boolean
  createdAt: string
  link: string | null
}

/* ═══════════════════════════════════════════════════════════
   Constants
   ═══════════════════════════════════════════════════════════ */

type TabKey = 'tasks' | 'reviews' | 'approvals' | 'observations' | 'snags' | 'leave' | 'expenses' | 'notifications'

const TABS: { key: TabKey; label: string; icon: React.FC<{ className?: string }> }[] = [
  { key: 'tasks', label: 'My Tasks', icon: ClipboardList },
  { key: 'reviews', label: 'My Reviews', icon: FileCheck },
  { key: 'approvals', label: 'My Approvals', icon: ShieldCheck },
  { key: 'observations', label: 'Observations', icon: MapPin },
  { key: 'snags', label: 'Snags', icon: Bug },
  { key: 'leave', label: 'My Leave', icon: CalendarDays },
  { key: 'expenses', label: 'My Expenses', icon: Wallet },
  { key: 'notifications', label: 'Notifications', icon: Bell },
]

type SortKey = 'dueDate' | 'createdAt' | 'priority' | 'project'

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'dueDate', label: 'Due date' },
  { value: 'createdAt', label: 'Date created' },
  { value: 'priority', label: 'Priority' },
  { value: 'project', label: 'Project' },
]

const TASK_STATUS_LABELS: Record<string, string> = {
  NOT_STARTED: 'Not started',
  IN_PROGRESS: 'In progress',
  READY_FOR_REVIEW: 'In review',
  COMPLETED: 'Completed',
  BLOCKED: 'Blocked',
  CHANGES_REQUIRED: 'Changes required',
}

const TASK_STATUS_COLORS: Record<string, string> = {
  NOT_STARTED: 'bg-ink-100 text-ink-600',
  IN_PROGRESS: 'bg-blue-50 text-blue-600',
  READY_FOR_REVIEW: 'bg-amber-50 text-amber-600',
  COMPLETED: 'bg-emerald-50 text-emerald-600',
  BLOCKED: 'bg-red-50 text-red-600',
  CHANGES_REQUIRED: 'bg-orange-50 text-orange-600',
}

const PRIORITY_ORDER: Record<string, number> = {
  CRITICAL: 0,
  HIGH: 1,
  MEDIUM: 2,
  LOW: 3,
  SAFETY_CRITICAL: 0,
  MAJOR: 1,
  MODERATE: 2,
  MINOR: 3,
}

const PRIORITY_LABELS: Record<string, string> = {
  CRITICAL: 'Critical',
  HIGH: 'High',
  MEDIUM: 'Medium',
  LOW: 'Low',
}

const PRIORITY_DOT_COLORS: Record<string, string> = {
  CRITICAL: 'bg-red-500',
  HIGH: 'bg-amber-500',
  MEDIUM: 'bg-blue-400',
  LOW: 'bg-ink-300',
  SAFETY_CRITICAL: 'bg-red-500',
  MAJOR: 'bg-amber-500',
  MODERATE: 'bg-blue-400',
  MINOR: 'bg-ink-300',
}

const LEAVE_STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  DRAFT: { label: 'Draft', color: 'text-ink-500', bg: 'bg-ink-100' },
  SUBMITTED: { label: 'Submitted', color: 'text-blue-600', bg: 'bg-blue-50' },
  UNDER_REVIEW: { label: 'Under review', color: 'text-amber-600', bg: 'bg-amber-50' },
  APPROVED: { label: 'Approved', color: 'text-emerald-600', bg: 'bg-emerald-50' },
  REJECTED: { label: 'Rejected', color: 'text-red-600', bg: 'bg-red-50' },
  FULFILMENT_IN_PROGRESS: { label: 'In progress', color: 'text-blue-600', bg: 'bg-blue-50' },
  COMPLETED: { label: 'Completed', color: 'text-emerald-600', bg: 'bg-emerald-50' },
  WITHDRAWN: { label: 'Withdrawn', color: 'text-ink-400', bg: 'bg-ink-50' },
}

const LEAVE_TYPE_LABELS: Record<string, string> = {
  ANNUAL: 'Annual leave',
  SICK: 'Sick leave',
  COMPASSIONATE: 'Compassionate leave',
  UNPAID: 'Unpaid leave',
}

const EXPENSE_CATEGORY_LABELS: Record<string, string> = {
  TRAVEL: 'Travel',
  ACCOMMODATION: 'Accommodation',
  MEALS: 'Meals',
  EQUIPMENT: 'Equipment',
  SOFTWARE: 'Software',
  PRINTING: 'Printing',
  POSTAGE: 'Postage',
  TRAINING: 'Training',
  PPE: 'PPE',
  SITE_EXPENSES: 'Site expenses',
  OTHER: 'Other',
}

const OBSERVATION_STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  OPEN: { label: 'Open', color: 'text-red-600', bg: 'bg-red-50' },
  IN_PROGRESS: { label: 'In progress', color: 'text-blue-600', bg: 'bg-blue-50' },
  RESOLVED: { label: 'Resolved', color: 'text-emerald-600', bg: 'bg-emerald-50' },
  CLOSED: { label: 'Closed', color: 'text-ink-400', bg: 'bg-ink-50' },
}

const SNAG_STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  OPEN: { label: 'Open', color: 'text-red-600', bg: 'bg-red-50' },
  ASSIGNED: { label: 'Assigned', color: 'text-blue-600', bg: 'bg-blue-50' },
  RECTIFICATION_SUBMITTED: { label: 'Fix submitted', color: 'text-amber-600', bg: 'bg-amber-50' },
  VERIFICATION: { label: 'Verification', color: 'text-violet-600', bg: 'bg-violet-50' },
  CLOSED: { label: 'Closed', color: 'text-emerald-600', bg: 'bg-emerald-50' },
  REOPENED: { label: 'Reopened', color: 'text-red-600', bg: 'bg-red-50' },
}

/* ═══════════════════════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════════════════════ */

function getGreeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

function formatDueDate(iso: string | null): string {
  if (!iso) return 'No due date'
  const d = new Date(iso)
  const now = new Date()
  const diffMs = d.getTime() - now.getTime()
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))
  if (diffDays < 0) return `${Math.abs(diffDays)}d overdue`
  if (diffDays === 0) return 'Due today'
  if (diffDays === 1) return 'Due tomorrow'
  return `Due in ${diffDays}d`
}

function isDueDateOverdue(iso: string | null): boolean {
  if (!iso) return false
  return new Date(iso) < new Date()
}

function formatShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

function formatDateRange(start: string, end: string): string {
  const s = new Date(start)
  const e = new Date(end)
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }
  if (s.getFullYear() !== new Date().getFullYear()) {
    return `${s.toLocaleDateString('en-GB', { ...opts, year: 'numeric' })} - ${e.toLocaleDateString('en-GB', { ...opts, year: 'numeric' })}`
  }
  return `${s.toLocaleDateString('en-GB', opts)} - ${e.toLocaleDateString('en-GB', opts)}`
}

function formatAmount(amount: number, currency: string): string {
  const localeMap: Record<string, string> = { NGN: 'en-NG', GBP: 'en-GB', USD: 'en-US', EUR: 'de-DE' }
  return new Intl.NumberFormat(localeMap[currency] || 'en-GB', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amount)
}

function timeAgo(iso: string): string {
  const now = new Date()
  const date = new Date(iso)
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return formatShortDate(iso)
}

function matchesSearch(text: string, query: string): boolean {
  if (!query) return true
  const lower = query.toLowerCase()
  return text.toLowerCase().includes(lower)
}

/* ═══════════════════════════════════════════════════════════
   Sub-components
   ═══════════════════════════════════════════════════════════ */

function StatusBadge({ status, meta }: { status: string; meta: Record<string, { label: string; color: string; bg: string }> }) {
  const m = meta[status] || { label: status.replace(/_/g, ' '), color: 'text-ink-500', bg: 'bg-ink-100' }
  return (
    <span className={cn('text-[11px] font-medium px-2.5 py-0.5 rounded-full whitespace-nowrap', m.bg, m.color)}>
      {m.label}
    </span>
  )
}

function PriorityDot({ priority }: { priority: string }) {
  return (
    <span className={cn(
      'w-2 h-2 rounded-full shrink-0',
      PRIORITY_DOT_COLORS[priority] || 'bg-ink-300',
    )} />
  )
}

function StatCard({ label, value, icon: Icon, accent }: {
  label: string
  value: number
  icon: React.FC<{ className?: string }>
  accent: string
}) {
  return (
    <div className="bg-white rounded-xl border border-ink-100 p-4 sm:p-5 flex items-start gap-3 sm:gap-4">
      <div className={cn('w-9 h-9 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center shrink-0', accent)}>
        <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
      </div>
      <div>
        <p className="text-[24px] sm:text-[28px] font-semibold text-ink-900 leading-tight">{value}</p>
        <p className="text-[11px] sm:text-[12px] text-ink-400 mt-0.5">{label}</p>
      </div>
    </div>
  )
}

function EmptyState({ icon: Icon, title, description }: {
  icon: React.FC<{ className?: string }>
  title: string
  description: string
}) {
  return (
    <div className="bg-white rounded-xl border border-ink-100 p-10 text-center">
      <Icon className="w-10 h-10 text-ink-200 mx-auto mb-3" />
      <p className="text-[14px] font-medium text-ink-600">{title}</p>
      <p className="text-[12px] text-ink-400 mt-1">{description}</p>
    </div>
  )
}

function LoadingSkeleton() {
  return (
    <div className="bg-white rounded-xl border border-ink-100 divide-y divide-ink-50">
      {Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)}
    </div>
  )
}

function ErrorPanel({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 gap-3">
      <AlertTriangle className="w-7 h-7 text-red-400" />
      <p className="text-[13px] text-ink-500">{message}</p>
      <button
        onClick={onRetry}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-ink-900 text-white text-[12px] font-medium hover:bg-ink-800 transition-colors"
      >
        <RefreshCw className="w-3.5 h-3.5" /> Retry
      </button>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════
   Filter bar component
   ═══════════════════════════════════════════════════════════ */

interface FilterBarProps {
  searchQuery: string
  onSearchChange: (v: string) => void
  projectFilter: string
  onProjectChange: (v: string) => void
  projects: ProjectSummary[]
  statusFilter: string
  onStatusChange: (v: string) => void
  statusOptions: { value: string; label: string }[]
  priorityFilter: string
  onPriorityChange: (v: string) => void
  showPriority: boolean
  sortBy: SortKey
  onSortChange: (v: SortKey) => void
  showFilters: boolean
  onToggleFilters: () => void
  dueDateFrom: string
  dueDateTo: string
  onDueDateFromChange: (v: string) => void
  onDueDateToChange: (v: string) => void
  dateSubmittedFrom: string
  dateSubmittedTo: string
  onDateSubmittedFromChange: (v: string) => void
  onDateSubmittedToChange: (v: string) => void
  typeFilter: string
  onTypeChange: (v: string) => void
  typeOptions: { value: string; label: string }[]
  assignedByFilter: string
  onAssignedByChange: (v: string) => void
  onClearAll: () => void
  activeFilterCount: number
}

function FilterBar({
  searchQuery, onSearchChange,
  projectFilter, onProjectChange, projects,
  statusFilter, onStatusChange, statusOptions,
  priorityFilter, onPriorityChange, showPriority,
  sortBy, onSortChange,
  showFilters, onToggleFilters,
  dueDateFrom, dueDateTo, onDueDateFromChange, onDueDateToChange,
  dateSubmittedFrom, dateSubmittedTo, onDateSubmittedFromChange, onDateSubmittedToChange,
  typeFilter, onTypeChange, typeOptions,
  assignedByFilter, onAssignedByChange,
  onClearAll, activeFilterCount,
}: FilterBarProps) {
  return (
    <div className="space-y-3">
      {/* Primary row: search + filter toggle + sort */}
      <div className="flex flex-col sm:flex-row gap-2">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-300" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search across all items..."
            className="w-full pl-9 pr-3 py-2 text-[13px] bg-white border border-ink-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-300 placeholder:text-ink-300"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-300 hover:text-ink-500 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex gap-2">
          {/* Filter toggle */}
          <button
            onClick={onToggleFilters}
            className={cn(
              'flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12px] font-medium transition-colors border',
              showFilters
                ? 'bg-ink-900 text-white border-ink-900'
                : 'bg-white text-ink-600 border-ink-200 hover:border-ink-300',
            )}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            Filters
            {activeFilterCount > 0 && (
              <span className={cn(
                'ml-0.5 text-[10px] px-1.5 py-0.5 rounded-full',
                showFilters ? 'bg-white/20 text-white' : 'bg-accent-100 text-accent-700',
              )}>
                {activeFilterCount}
              </span>
            )}
          </button>

          {/* Sort */}
          <div className="relative">
            <ArrowUpDown className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-ink-400 pointer-events-none" />
            <select
              value={sortBy}
              onChange={(e) => onSortChange(e.target.value as SortKey)}
              className="pl-8 pr-7 py-2 text-[12px] font-medium text-ink-600 bg-white border border-ink-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-300 appearance-none cursor-pointer"
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-ink-400 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Expanded filters */}
      {showFilters && (
        <div className="bg-white rounded-xl border border-ink-100 p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Project filter */}
            <div>
              <label className="block text-[11px] font-medium text-ink-500 mb-1">Project</label>
              <select
                value={projectFilter}
                onChange={(e) => onProjectChange(e.target.value)}
                className="w-full px-2.5 py-1.5 text-[12px] bg-white border border-ink-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-300"
              >
                <option value="">All projects</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.code} - {p.name}</option>
                ))}
              </select>
            </div>

            {/* Status filter */}
            {statusOptions.length > 0 && (
              <div>
                <label className="block text-[11px] font-medium text-ink-500 mb-1">Status</label>
                <select
                  value={statusFilter}
                  onChange={(e) => onStatusChange(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-[12px] bg-white border border-ink-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-300"
                >
                  <option value="">All statuses</option>
                  {statusOptions.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Priority filter */}
            {showPriority && (
              <div>
                <label className="block text-[11px] font-medium text-ink-500 mb-1">Priority</label>
                <select
                  value={priorityFilter}
                  onChange={(e) => onPriorityChange(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-[12px] bg-white border border-ink-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-300"
                >
                  <option value="">All priorities</option>
                  <option value="CRITICAL">Critical</option>
                  <option value="HIGH">High</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="LOW">Low</option>
                </select>
              </div>
            )}

            {/* Type filter */}
            {typeOptions.length > 0 && (
              <div>
                <label className="block text-[11px] font-medium text-ink-500 mb-1">Type</label>
                <select
                  value={typeFilter}
                  onChange={(e) => onTypeChange(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-[12px] bg-white border border-ink-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-300"
                >
                  <option value="">All types</option>
                  {typeOptions.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Due date range */}
            <div>
              <label className="block text-[11px] font-medium text-ink-500 mb-1">Due from</label>
              <input
                type="date"
                value={dueDateFrom}
                onChange={(e) => onDueDateFromChange(e.target.value)}
                className="w-full px-2.5 py-1.5 text-[12px] border border-ink-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-300"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-ink-500 mb-1">Due to</label>
              <input
                type="date"
                value={dueDateTo}
                onChange={(e) => onDueDateToChange(e.target.value)}
                className="w-full px-2.5 py-1.5 text-[12px] border border-ink-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-300"
              />
            </div>

            {/* Date submitted range */}
            <div>
              <label className="block text-[11px] font-medium text-ink-500 mb-1">Submitted from</label>
              <input
                type="date"
                value={dateSubmittedFrom}
                onChange={(e) => onDateSubmittedFromChange(e.target.value)}
                className="w-full px-2.5 py-1.5 text-[12px] border border-ink-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-300"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-ink-500 mb-1">Submitted to</label>
              <input
                type="date"
                value={dateSubmittedTo}
                onChange={(e) => onDateSubmittedToChange(e.target.value)}
                className="w-full px-2.5 py-1.5 text-[12px] border border-ink-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-300"
              />
            </div>

            {/* Assigned by */}
            <div>
              <label className="block text-[11px] font-medium text-ink-500 mb-1">Assigned by</label>
              <input
                type="text"
                value={assignedByFilter}
                onChange={(e) => onAssignedByChange(e.target.value)}
                placeholder="Name..."
                className="w-full px-2.5 py-1.5 text-[12px] border border-ink-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-300 placeholder:text-ink-300"
              />
            </div>
          </div>

          {/* Clear all */}
          {activeFilterCount > 0 && (
            <div className="mt-3 pt-3 border-t border-ink-50 flex justify-end">
              <button
                onClick={onClearAll}
                className="flex items-center gap-1 text-[11px] text-ink-400 hover:text-ink-600 font-medium transition-colors"
              >
                <X className="w-3 h-3" />
                Clear all filters
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════
   Status options per tab
   ═══════════════════════════════════════════════════════════ */

function getStatusOptionsForTab(tab: TabKey): { value: string; label: string }[] {
  switch (tab) {
    case 'tasks':
      return [
        { value: 'NOT_STARTED', label: 'Not started' },
        { value: 'IN_PROGRESS', label: 'In progress' },
        { value: 'READY_FOR_REVIEW', label: 'In review' },
        { value: 'BLOCKED', label: 'Blocked' },
        { value: 'CHANGES_REQUIRED', label: 'Changes required' },
        { value: 'COMPLETED', label: 'Completed' },
      ]
    case 'reviews':
      return [
        { value: 'READY_FOR_REVIEW', label: 'Pending review' },
        { value: 'COMPLETED', label: 'Reviewed' },
      ]
    case 'approvals':
      return [
        { value: 'SUBMITTED', label: 'Pending' },
        { value: 'APPROVED', label: 'Approved' },
        { value: 'REJECTED', label: 'Rejected' },
      ]
    case 'observations':
      return [
        { value: 'OPEN', label: 'Open' },
        { value: 'IN_PROGRESS', label: 'In progress' },
        { value: 'RESOLVED', label: 'Resolved' },
        { value: 'CLOSED', label: 'Closed' },
      ]
    case 'snags':
      return [
        { value: 'OPEN', label: 'Open' },
        { value: 'ASSIGNED', label: 'Assigned' },
        { value: 'RECTIFICATION_SUBMITTED', label: 'Fix submitted' },
        { value: 'VERIFICATION', label: 'Verification' },
        { value: 'CLOSED', label: 'Closed' },
        { value: 'REOPENED', label: 'Reopened' },
      ]
    case 'leave':
      return [
        { value: 'DRAFT', label: 'Draft' },
        { value: 'SUBMITTED', label: 'Submitted' },
        { value: 'UNDER_REVIEW', label: 'Under review' },
        { value: 'APPROVED', label: 'Approved' },
        { value: 'REJECTED', label: 'Rejected' },
        { value: 'WITHDRAWN', label: 'Withdrawn' },
      ]
    case 'expenses':
      return [
        { value: 'DRAFT', label: 'Draft' },
        { value: 'SUBMITTED', label: 'Submitted' },
        { value: 'APPROVED', label: 'Approved' },
        { value: 'REJECTED', label: 'Rejected' },
      ]
    case 'notifications':
      return [
        { value: 'unread', label: 'Unread' },
        { value: 'read', label: 'Read' },
      ]
    default:
      return []
  }
}

function getTypeOptionsForTab(tab: TabKey): { value: string; label: string }[] {
  switch (tab) {
    case 'leave':
      return [
        { value: 'ANNUAL', label: 'Annual leave' },
        { value: 'SICK', label: 'Sick leave' },
        { value: 'COMPASSIONATE', label: 'Compassionate leave' },
        { value: 'UNPAID', label: 'Unpaid leave' },
      ]
    case 'expenses':
      return Object.entries(EXPENSE_CATEGORY_LABELS).map(([v, l]) => ({ value: v, label: l }))
    case 'approvals':
      return [
        { value: 'leave', label: 'Leave' },
        { value: 'expense', label: 'Expense' },
        { value: 'budget', label: 'Budget' },
        { value: 'variation', label: 'Variation' },
      ]
    default:
      return []
  }
}

/* ═══════════════════════════════════════════════════════════
   Main page component
   ═══════════════════════════════════════════════════════════ */

export default function MyWorkPage() {
  // ── Global state ────────────────────────────────────────
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null)
  const [dashboardLoading, setDashboardLoading] = useState(true)
  const [dashboardError, setDashboardError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<TabKey>('tasks')

  // ── Filter state ────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState('')
  const [projectFilter, setProjectFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [priorityFilter, setPriorityFilter] = useState('')
  const [sortBy, setSortBy] = useState<SortKey>('dueDate')
  const [showFilters, setShowFilters] = useState(false)
  const [dueDateFrom, setDueDateFrom] = useState('')
  const [dueDateTo, setDueDateTo] = useState('')
  const [dateSubmittedFrom, setDateSubmittedFrom] = useState('')
  const [dateSubmittedTo, setDateSubmittedTo] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [assignedByFilter, setAssignedByFilter] = useState('')

  // ── Section data (lazy-loaded) ──────────────────────────
  const [tasks, setTasks] = useState<TaskItem[]>([])
  const [tasksLoaded, setTasksLoaded] = useState(false)
  const [tasksLoading, setTasksLoading] = useState(false)
  const [tasksError, setTasksError] = useState<string | null>(null)

  const [reviews, setReviews] = useState<ReviewItem[]>([])
  const [reviewsLoaded, setReviewsLoaded] = useState(false)
  const [reviewsLoading, setReviewsLoading] = useState(false)
  const [reviewsError, setReviewsError] = useState<string | null>(null)

  const [approvals, setApprovals] = useState<ApprovalItem[]>([])
  const [approvalsLoaded, setApprovalsLoaded] = useState(false)
  const [approvalsLoading, setApprovalsLoading] = useState(false)
  const [approvalsError, setApprovalsError] = useState<string | null>(null)

  const [observations, setObservations] = useState<ObservationItem[]>([])
  const [observationsLoaded, setObservationsLoaded] = useState(false)
  const [observationsLoading, setObservationsLoading] = useState(false)
  const [observationsError, setObservationsError] = useState<string | null>(null)

  const [snags, setSnags] = useState<SnagItem[]>([])
  const [snagsLoaded, setSnagsLoaded] = useState(false)
  const [snagsLoading, setSnagsLoading] = useState(false)
  const [snagsError, setSnagsError] = useState<string | null>(null)

  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([])
  const [leaveBalance, setLeaveBalance] = useState<LeaveBalance | null>(null)
  const [leaveLoaded, setLeaveLoaded] = useState(false)
  const [leaveLoading, setLeaveLoading] = useState(false)
  const [leaveError, setLeaveError] = useState<string | null>(null)

  const [expenses, setExpenses] = useState<ExpenseClaim[]>([])
  const [expensesLoaded, setExpensesLoaded] = useState(false)
  const [expensesLoading, setExpensesLoading] = useState(false)
  const [expensesError, setExpensesError] = useState<string | null>(null)

  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [notificationsLoaded, setNotificationsLoaded] = useState(false)
  const [notificationsLoading, setNotificationsLoading] = useState(false)
  const [notificationsError, setNotificationsError] = useState<string | null>(null)

  // ── Dashboard fetch ─────────────────────────────────────

  const fetchDashboard = useCallback(async () => {
    setDashboardLoading(true)
    setDashboardError(null)
    try {
      const res = await fetch('/api/dashboard')
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error?.message || `Failed to load (${res.status})`)
      }
      const json = await res.json()
      setDashboardData(json.data)
    } catch (err) {
      setDashboardError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setDashboardLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchDashboard()
  }, [fetchDashboard])

  // ── Lazy loaders for each section ───────────────────────

  const fetchTasks = useCallback(async () => {
    if (tasksLoaded && !tasksError) return
    setTasksLoading(true)
    setTasksError(null)
    try {
      // Fetch tasks from all projects the user has access to
      const res = await fetch('/api/dashboard')
      if (!res.ok) throw new Error('Failed to load tasks')
      const json = await res.json()
      const data = json.data as DashboardData

      // Compile all tasks across projects by fetching project tasks
      const allTasks: TaskItem[] = []
      for (const project of data.projects) {
        try {
          const pRes = await fetch(`/api/projects/${project.id}/tasks`)
          if (pRes.ok) {
            const pJson = await pRes.json()
            const projectTasks = (pJson.data?.tasks || pJson.data || []) as Array<{
              id: string; title: string; status: string; priority: string;
              dueDate: string | null; estimatedHours: number | null;
              type?: string; createdAt?: string;
              owner?: { fullName: string } | null
              createdBy?: { fullName: string } | null
            }>
            for (const t of projectTasks) {
              allTasks.push({
                id: t.id,
                title: t.title,
                projectId: project.id,
                projectName: project.name,
                projectCode: project.code,
                status: t.status,
                priority: t.priority,
                dueDate: t.dueDate,
                estimatedHours: t.estimatedHours,
                type: t.type,
                createdAt: t.createdAt,
                assignedBy: t.createdBy?.fullName || undefined,
              })
            }
          }
        } catch {
          // Skip projects that fail
        }
      }
      setTasks(allTasks)
      setTasksLoaded(true)
    } catch (err) {
      setTasksError(err instanceof Error ? err.message : 'Failed to load tasks')
    } finally {
      setTasksLoading(false)
    }
  }, [tasksLoaded, tasksError])

  const fetchReviews = useCallback(async () => {
    if (reviewsLoaded && !reviewsError) return
    setReviewsLoading(true)
    setReviewsError(null)
    try {
      // Reviews come from tasks with READY_FOR_REVIEW where user is reviewer
      // Build from dashboard data
      const res = await fetch('/api/dashboard')
      if (!res.ok) throw new Error('Failed to load reviews')
      const json = await res.json()
      const data = json.data as DashboardData

      const reviewItems: ReviewItem[] = []
      for (const project of data.projects) {
        if (project.inReviewTaskCount === 0) continue
        try {
          const pRes = await fetch(`/api/projects/${project.id}/tasks`)
          if (pRes.ok) {
            const pJson = await pRes.json()
            const projectTasks = (pJson.data?.tasks || pJson.data || []) as Array<{
              id: string; title: string; status: string; createdAt?: string;
              owner?: { fullName: string } | null
            }>
            for (const t of projectTasks) {
              if (t.status === 'READY_FOR_REVIEW') {
                reviewItems.push({
                  id: t.id,
                  title: t.title,
                  type: 'task',
                  projectName: project.name,
                  projectCode: project.code,
                  status: t.status,
                  submittedDate: t.createdAt || new Date().toISOString(),
                  submittedBy: t.owner?.fullName || 'Unknown',
                })
              }
            }
          }
        } catch {
          // Skip
        }
      }
      setReviews(reviewItems)
      setReviewsLoaded(true)
    } catch (err) {
      setReviewsError(err instanceof Error ? err.message : 'Failed to load reviews')
    } finally {
      setReviewsLoading(false)
    }
  }, [reviewsLoaded, reviewsError])

  const fetchApprovals = useCallback(async () => {
    if (approvalsLoaded && !approvalsError) return
    setApprovalsLoading(true)
    setApprovalsError(null)
    try {
      // Approvals aggregate leave + expenses + budgets + variations
      const approvalItems: ApprovalItem[] = []

      // Fetch leave requests with SUBMITTED/UNDER_REVIEW status (approver view)
      try {
        const leaveRes = await fetch('/api/leave/requests')
        if (leaveRes.ok) {
          const leaveJson = await leaveRes.json()
          const requests = (leaveJson.data?.requests || []) as Array<{
            id: string; leaveType: string; status: string; createdAt: string;
            days: number; profile?: { fullName: string }
          }>
          for (const r of requests) {
            if (['SUBMITTED', 'UNDER_REVIEW'].includes(r.status)) {
              approvalItems.push({
                id: r.id,
                type: 'leave',
                title: `${LEAVE_TYPE_LABELS[r.leaveType] || r.leaveType} - ${r.days} days`,
                requester: r.profile?.fullName || 'Unknown',
                date: r.createdAt,
                amount: null,
                status: r.status,
              })
            }
          }
        }
      } catch {
        // Skip
      }

      // Fetch expense claims pending approval
      try {
        const expRes = await fetch('/api/expenses')
        if (expRes.ok) {
          const expJson = await expRes.json()
          const claims = (expJson.data?.claims || []) as Array<{
            id: string; description: string; status: string; amount: number; currency: string;
            createdAt: string; profile?: { fullName: string }
          }>
          for (const c of claims) {
            if (['SUBMITTED', 'UNDER_REVIEW'].includes(c.status)) {
              approvalItems.push({
                id: c.id,
                type: 'expense',
                title: c.description,
                requester: c.profile?.fullName || 'Unknown',
                date: c.createdAt,
                amount: formatAmount(c.amount, c.currency),
                status: c.status,
              })
            }
          }
        }
      } catch {
        // Skip
      }

      setApprovals(approvalItems)
      setApprovalsLoaded(true)
    } catch (err) {
      setApprovalsError(err instanceof Error ? err.message : 'Failed to load approvals')
    } finally {
      setApprovalsLoading(false)
    }
  }, [approvalsLoaded, approvalsError])

  const fetchObservations = useCallback(async () => {
    if (observationsLoaded && !observationsError) return
    setObservationsLoading(true)
    setObservationsError(null)
    try {
      const res = await fetch('/api/dashboard')
      if (!res.ok) throw new Error('Failed to load observations')
      const json = await res.json()
      const data = json.data as DashboardData

      const obsItems: ObservationItem[] = []
      for (const project of data.projects) {
        try {
          const oRes = await fetch(`/api/projects/${project.id}/observations`)
          if (oRes.ok) {
            const oJson = await oRes.json()
            const obs = (oJson.data?.observations || oJson.data || []) as Array<{
              id: string; description: string; location?: string; priority?: string;
              status: string; dueDate?: string | null; createdAt?: string
            }>
            for (const o of obs) {
              obsItems.push({
                id: o.id,
                title: o.description || 'Observation',
                projectName: project.name,
                projectCode: project.code,
                location: o.location || 'Not specified',
                priority: o.priority || 'MEDIUM',
                status: o.status,
                dueDate: o.dueDate || null,
                createdAt: o.createdAt || new Date().toISOString(),
              })
            }
          }
        } catch {
          // Skip
        }
      }
      setObservations(obsItems)
      setObservationsLoaded(true)
    } catch (err) {
      setObservationsError(err instanceof Error ? err.message : 'Failed to load observations')
    } finally {
      setObservationsLoading(false)
    }
  }, [observationsLoaded, observationsError])

  const fetchSnags = useCallback(async () => {
    if (snagsLoaded && !snagsError) return
    setSnagsLoading(true)
    setSnagsError(null)
    try {
      const res = await fetch('/api/dashboard')
      if (!res.ok) throw new Error('Failed to load snags')
      const json = await res.json()
      const data = json.data as DashboardData

      const snagItems: SnagItem[] = []
      for (const project of data.projects) {
        try {
          const sRes = await fetch(`/api/projects/${project.id}/snags`)
          if (sRes.ok) {
            const sJson = await sRes.json()
            const sData = (sJson.data?.snags || sJson.data || []) as Array<{
              id: string; description: string; location?: string; category?: string;
              severity?: string; status: string; dueDate?: string | null; createdAt?: string
            }>
            for (const s of sData) {
              snagItems.push({
                id: s.id,
                title: s.description || 'Snag',
                projectName: project.name,
                projectCode: project.code,
                location: s.location || 'Not specified',
                category: s.category || 'OTHER',
                severity: s.severity || 'MODERATE',
                status: s.status,
                dueDate: s.dueDate || null,
                createdAt: s.createdAt || new Date().toISOString(),
              })
            }
          }
        } catch {
          // Skip
        }
      }
      setSnags(snagItems)
      setSnagsLoaded(true)
    } catch (err) {
      setSnagsError(err instanceof Error ? err.message : 'Failed to load snags')
    } finally {
      setSnagsLoading(false)
    }
  }, [snagsLoaded, snagsError])

  const fetchLeave = useCallback(async () => {
    if (leaveLoaded && !leaveError) return
    setLeaveLoading(true)
    setLeaveError(null)
    try {
      const [balRes, reqRes] = await Promise.all([
        fetch('/api/leave/balance'),
        fetch('/api/leave/requests'),
      ])
      if (!balRes.ok || !reqRes.ok) throw new Error('Failed to load leave data')
      const balJson = await balRes.json()
      const reqJson = await reqRes.json()
      setLeaveBalance(balJson.data)
      setLeaveRequests(reqJson.data?.requests || [])
      setLeaveLoaded(true)
    } catch (err) {
      setLeaveError(err instanceof Error ? err.message : 'Failed to load leave')
    } finally {
      setLeaveLoading(false)
    }
  }, [leaveLoaded, leaveError])

  const fetchExpenses = useCallback(async () => {
    if (expensesLoaded && !expensesError) return
    setExpensesLoading(true)
    setExpensesError(null)
    try {
      const res = await fetch('/api/expenses')
      if (!res.ok) throw new Error('Failed to load expenses')
      const json = await res.json()
      setExpenses(json.data?.claims || [])
      setExpensesLoaded(true)
    } catch (err) {
      setExpensesError(err instanceof Error ? err.message : 'Failed to load expenses')
    } finally {
      setExpensesLoading(false)
    }
  }, [expensesLoaded, expensesError])

  const fetchNotifications = useCallback(async () => {
    if (notificationsLoaded && !notificationsError) return
    setNotificationsLoading(true)
    setNotificationsError(null)
    try {
      // Build notifications from dashboard activity
      // In production these would come from /api/notifications
      const notifs: NotificationItem[] = []

      // Generate from dashboard data if available
      if (dashboardData) {
        for (const task of dashboardData.urgentTasks.slice(0, 10)) {
          const isOverdue = task.dueDate && isDueDateOverdue(task.dueDate)
          notifs.push({
            id: `task-${task.id}`,
            title: isOverdue ? 'Task overdue' : 'Task needs attention',
            body: `${task.title} (${task.projectCode})`,
            type: isOverdue ? 'warning' : 'info',
            read: false,
            createdAt: task.dueDate || new Date().toISOString(),
            link: `/tasks/${task.id}`,
          })
        }
      }

      setNotifications(notifs)
      setNotificationsLoaded(true)
    } catch (err) {
      setNotificationsError(err instanceof Error ? err.message : 'Failed to load notifications')
    } finally {
      setNotificationsLoading(false)
    }
  }, [notificationsLoaded, notificationsError, dashboardData])

  // ── Trigger lazy load on tab change ─────────────────────

  useEffect(() => {
    switch (activeTab) {
      case 'tasks': fetchTasks(); break
      case 'reviews': fetchReviews(); break
      case 'approvals': fetchApprovals(); break
      case 'observations': fetchObservations(); break
      case 'snags': fetchSnags(); break
      case 'leave': fetchLeave(); break
      case 'expenses': fetchExpenses(); break
      case 'notifications': fetchNotifications(); break
    }
  }, [activeTab, fetchTasks, fetchReviews, fetchApprovals, fetchObservations, fetchSnags, fetchLeave, fetchExpenses, fetchNotifications])

  // ── Reset filters on tab change ─────────────────────────

  const handleTabChange = (tab: TabKey) => {
    setActiveTab(tab)
    setStatusFilter('')
    setPriorityFilter('')
    setTypeFilter('')
  }

  // ── Count active filters ────────────────────────────────

  const activeFilterCount = useMemo(() => {
    let count = 0
    if (projectFilter) count++
    if (statusFilter) count++
    if (priorityFilter) count++
    if (typeFilter) count++
    if (dueDateFrom) count++
    if (dueDateTo) count++
    if (dateSubmittedFrom) count++
    if (dateSubmittedTo) count++
    if (assignedByFilter) count++
    return count
  }, [projectFilter, statusFilter, priorityFilter, typeFilter, dueDateFrom, dueDateTo, dateSubmittedFrom, dateSubmittedTo, assignedByFilter])

  const clearAllFilters = () => {
    setSearchQuery('')
    setProjectFilter('')
    setStatusFilter('')
    setPriorityFilter('')
    setDueDateFrom('')
    setDueDateTo('')
    setDateSubmittedFrom('')
    setDateSubmittedTo('')
    setTypeFilter('')
    setAssignedByFilter('')
  }

  // ── Generic sort + filter ───────────────────────────────

  function applyDateRangeFilter<T>(items: T[], getDate: (item: T) => string | null, from: string, to: string): T[] {
    let filtered = items
    if (from) {
      const fromDate = new Date(from)
      filtered = filtered.filter((item) => {
        const d = getDate(item)
        return d ? new Date(d) >= fromDate : false
      })
    }
    if (to) {
      const toDate = new Date(to)
      toDate.setHours(23, 59, 59, 999)
      filtered = filtered.filter((item) => {
        const d = getDate(item)
        return d ? new Date(d) <= toDate : false
      })
    }
    return filtered
  }

  function sortItems<T>(items: T[], getDueDate: (i: T) => string | null, getCreatedAt: (i: T) => string, getPriority: (i: T) => string, getProject: (i: T) => string): T[] {
    return [...items].sort((a, b) => {
      switch (sortBy) {
        case 'dueDate': {
          const aDate = getDueDate(a)
          const bDate = getDueDate(b)
          if (!aDate && !bDate) return 0
          if (!aDate) return 1
          if (!bDate) return -1
          return new Date(aDate).getTime() - new Date(bDate).getTime()
        }
        case 'createdAt':
          return new Date(getCreatedAt(b)).getTime() - new Date(getCreatedAt(a)).getTime()
        case 'priority':
          return (PRIORITY_ORDER[getPriority(a)] ?? 99) - (PRIORITY_ORDER[getPriority(b)] ?? 99)
        case 'project':
          return getProject(a).localeCompare(getProject(b))
        default:
          return 0
      }
    })
  }

  // ── Filtered + sorted data per section ──────────────────

  const filteredTasks = useMemo(() => {
    let items = tasks
    if (searchQuery) items = items.filter((t) => matchesSearch(`${t.title} ${t.projectName} ${t.projectCode}`, searchQuery))
    if (projectFilter) items = items.filter((t) => t.projectId === projectFilter)
    if (statusFilter) items = items.filter((t) => t.status === statusFilter)
    if (priorityFilter) items = items.filter((t) => t.priority === priorityFilter)
    if (typeFilter) items = items.filter((t) => t.type === typeFilter)
    if (assignedByFilter) items = items.filter((t) => t.assignedBy && matchesSearch(t.assignedBy, assignedByFilter))
    items = applyDateRangeFilter(items, (t) => t.dueDate, dueDateFrom, dueDateTo)
    items = applyDateRangeFilter(items, (t) => t.createdAt || null, dateSubmittedFrom, dateSubmittedTo)
    return sortItems(items, (t) => t.dueDate, (t) => t.createdAt || '', (t) => t.priority, (t) => t.projectName)
  }, [tasks, searchQuery, projectFilter, statusFilter, priorityFilter, sortBy, dueDateFrom, dueDateTo, dateSubmittedFrom, dateSubmittedTo, typeFilter, assignedByFilter])

  const tasksByProject = useMemo(() => {
    const groups: Record<string, { projectName: string; projectCode: string; projectId: string; tasks: TaskItem[] }> = {}
    for (const task of filteredTasks) {
      if (!groups[task.projectId]) {
        groups[task.projectId] = { projectName: task.projectName, projectCode: task.projectCode, projectId: task.projectId, tasks: [] }
      }
      groups[task.projectId].tasks.push(task)
    }
    return Object.values(groups)
  }, [filteredTasks])

  const filteredReviews = useMemo(() => {
    let items = reviews
    if (searchQuery) items = items.filter((r) => matchesSearch(`${r.title} ${r.projectName} ${r.submittedBy}`, searchQuery))
    if (projectFilter) items = items.filter((r) => matchesSearch(r.projectName, projectFilter) || matchesSearch(r.projectCode, projectFilter))
    if (statusFilter) items = items.filter((r) => r.status === statusFilter)
    return sortItems(items, () => null, (r) => r.submittedDate, () => 'MEDIUM', (r) => r.projectName)
  }, [reviews, searchQuery, projectFilter, statusFilter, sortBy])

  const filteredApprovals = useMemo(() => {
    let items = approvals
    if (searchQuery) items = items.filter((a) => matchesSearch(`${a.title} ${a.requester}`, searchQuery))
    if (statusFilter) items = items.filter((a) => a.status === statusFilter)
    if (typeFilter) items = items.filter((a) => a.type === typeFilter)
    return [...items].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  }, [approvals, searchQuery, statusFilter, typeFilter, sortBy])

  const filteredObservations = useMemo(() => {
    let items = observations
    if (searchQuery) items = items.filter((o) => matchesSearch(`${o.title} ${o.projectName} ${o.location}`, searchQuery))
    if (projectFilter) items = items.filter((o) => matchesSearch(o.projectName, projectFilter) || matchesSearch(o.projectCode, projectFilter))
    if (statusFilter) items = items.filter((o) => o.status === statusFilter)
    if (priorityFilter) items = items.filter((o) => o.priority === priorityFilter)
    items = applyDateRangeFilter(items, (o) => o.dueDate, dueDateFrom, dueDateTo)
    return sortItems(items, (o) => o.dueDate, (o) => o.createdAt, (o) => o.priority, (o) => o.projectName)
  }, [observations, searchQuery, projectFilter, statusFilter, priorityFilter, sortBy, dueDateFrom, dueDateTo])

  const filteredSnags = useMemo(() => {
    let items = snags
    if (searchQuery) items = items.filter((s) => matchesSearch(`${s.title} ${s.projectName} ${s.location}`, searchQuery))
    if (projectFilter) items = items.filter((s) => matchesSearch(s.projectName, projectFilter) || matchesSearch(s.projectCode, projectFilter))
    if (statusFilter) items = items.filter((s) => s.status === statusFilter)
    if (priorityFilter) items = items.filter((s) => s.severity === priorityFilter)
    items = applyDateRangeFilter(items, (s) => s.dueDate, dueDateFrom, dueDateTo)
    return sortItems(items, (s) => s.dueDate, (s) => s.createdAt, (s) => s.severity, (s) => s.projectName)
  }, [snags, searchQuery, projectFilter, statusFilter, priorityFilter, sortBy, dueDateFrom, dueDateTo])

  const filteredLeave = useMemo(() => {
    let items = leaveRequests
    if (searchQuery) items = items.filter((l) => matchesSearch(`${LEAVE_TYPE_LABELS[l.leaveType] || l.leaveType} ${l.reason || ''}`, searchQuery))
    if (statusFilter) items = items.filter((l) => l.status === statusFilter)
    if (typeFilter) items = items.filter((l) => l.leaveType === typeFilter)
    items = applyDateRangeFilter(items, (l) => l.startDate, dueDateFrom, dueDateTo)
    items = applyDateRangeFilter(items, (l) => l.createdAt, dateSubmittedFrom, dateSubmittedTo)
    return [...items].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  }, [leaveRequests, searchQuery, statusFilter, typeFilter, dueDateFrom, dueDateTo, dateSubmittedFrom, dateSubmittedTo])

  const filteredExpenses = useMemo(() => {
    let items = expenses
    if (searchQuery) items = items.filter((e) => matchesSearch(`${e.description} ${EXPENSE_CATEGORY_LABELS[e.category] || e.category}`, searchQuery))
    if (statusFilter) items = items.filter((e) => e.status === statusFilter)
    if (typeFilter) items = items.filter((e) => e.category === typeFilter)
    items = applyDateRangeFilter(items, () => null, dueDateFrom, dueDateTo)
    items = applyDateRangeFilter(items, (e) => e.createdAt, dateSubmittedFrom, dateSubmittedTo)
    return [...items].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  }, [expenses, searchQuery, statusFilter, typeFilter, dueDateFrom, dueDateTo, dateSubmittedFrom, dateSubmittedTo])

  const filteredNotifications = useMemo(() => {
    let items = notifications
    if (searchQuery) items = items.filter((n) => matchesSearch(`${n.title} ${n.body}`, searchQuery))
    if (statusFilter === 'unread') items = items.filter((n) => !n.read)
    if (statusFilter === 'read') items = items.filter((n) => n.read)
    return [...items].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  }, [notifications, searchQuery, statusFilter])

  // ── Compute summary stats ───────────────────────────────

  const summaryStats = useMemo(() => {
    if (!dashboardData) return { totalItems: 0, overdue: 0, pendingApprovals: 0, upcomingDeadlines: 0 }
    const { stats } = dashboardData
    const now = new Date()
    const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)

    const upcomingDeadlines = dashboardData.urgentTasks.filter((t) => {
      if (!t.dueDate) return false
      const d = new Date(t.dueDate)
      return d >= now && d <= nextWeek
    }).length

    return {
      totalItems: stats.totalTasks + (leaveLoaded ? leaveRequests.length : 0) + (expensesLoaded ? expenses.length : 0),
      overdue: stats.overdueTasks,
      pendingApprovals: stats.inReviewTasks + (approvalsLoaded ? approvals.length : 0),
      upcomingDeadlines,
    }
  }, [dashboardData, leaveLoaded, leaveRequests, expensesLoaded, expenses, approvalsLoaded, approvals])

  // ── Tab badge counts ────────────────────────────────────

  const tabCounts = useMemo(() => {
    return {
      tasks: tasksLoaded ? tasks.filter((t) => t.status !== 'COMPLETED').length : (dashboardData?.stats.totalTasks || 0),
      reviews: reviewsLoaded ? reviews.length : (dashboardData?.stats.inReviewTasks || 0),
      approvals: approvalsLoaded ? approvals.length : 0,
      observations: observationsLoaded ? observations.filter((o) => o.status !== 'CLOSED').length : 0,
      snags: snagsLoaded ? snags.filter((s) => s.status !== 'CLOSED').length : 0,
      leave: leaveLoaded ? leaveRequests.length : 0,
      expenses: expensesLoaded ? expenses.length : 0,
      notifications: notificationsLoaded ? notifications.filter((n) => !n.read).length : 0,
    }
  }, [tasks, tasksLoaded, reviews, reviewsLoaded, approvals, approvalsLoaded, observations, observationsLoaded, snags, snagsLoaded, leaveRequests, leaveLoaded, expenses, expensesLoaded, notifications, notificationsLoaded, dashboardData])

  /* ═══════════════════════════════════════════════════════
     Render — Loading state
     ═══════════════════════════════════════════════════════ */

  if (dashboardLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-64 bg-ink-100 animate-pulse rounded" />
        <SkeletonStats count={4} />
        <div className="h-10 w-full bg-ink-100 animate-pulse rounded-lg" />
        <div className="bg-white rounded-xl border border-ink-100 divide-y divide-ink-50">
          {Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} />)}
        </div>
      </div>
    )
  }

  /* ═══════════════════════════════════════════════════════
     Render — Error state
     ═══════════════════════════════════════════════════════ */

  if (dashboardError || !dashboardData) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center">
          <AlertTriangle className="w-7 h-7 text-red-500" />
        </div>
        <div className="text-center">
          <p className="text-[15px] font-medium text-ink-900">Unable to load your work</p>
          <p className="text-[13px] text-ink-400 mt-1 max-w-sm">{dashboardError || 'No data returned.'}</p>
        </div>
        <button
          onClick={fetchDashboard}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-ink-900 text-white text-[13px] font-medium hover:bg-ink-800 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Try again
        </button>
      </div>
    )
  }

  /* ═══════════════════════════════════════════════════════
     Render — Data loaded
     ═══════════════════════════════════════════════════════ */

  const { profile, projects } = dashboardData
  const greeting = getGreeting()
  const firstName = profile.fullName.split(' ')[0]

  return (
    <div className="space-y-6">
      {/* ── Header ─────────────────────────────────────── */}
      <div>
        <h1 className="text-[22px] sm:text-[24px] font-semibold text-ink-900">
          {greeting}, {firstName}
        </h1>
        <p className="text-[12px] sm:text-[13px] text-ink-400 mt-1">
          {profile.jobTitle ? `${profile.jobTitle} · ` : ''}{profile.organisationName}
        </p>
      </div>

      {/* ── Summary stat cards ─────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard
          label="Total items"
          value={summaryStats.totalItems}
          icon={ClipboardList}
          accent="bg-blue-50 text-blue-600"
        />
        <StatCard
          label="Overdue"
          value={summaryStats.overdue}
          icon={AlertTriangle}
          accent={summaryStats.overdue > 0 ? 'bg-red-50 text-red-600' : 'bg-ink-50 text-ink-400'}
        />
        <StatCard
          label="Pending approvals"
          value={summaryStats.pendingApprovals}
          icon={ShieldCheck}
          accent="bg-amber-50 text-amber-600"
        />
        <StatCard
          label="Due this week"
          value={summaryStats.upcomingDeadlines}
          icon={Calendar}
          accent="bg-violet-50 text-violet-600"
        />
      </div>

      {/* ── Tab navigation ─────────────────────────────── */}
      <div className="border-b border-ink-100 -mx-1 overflow-x-auto">
        <div className="flex min-w-max px-1">
          {TABS.map(({ key, label, icon: TabIcon }) => {
            const count = tabCounts[key]
            const isActive = activeTab === key
            return (
              <button
                key={key}
                onClick={() => handleTabChange(key)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-2.5 text-[12px] sm:text-[13px] font-medium border-b-2 transition-colors whitespace-nowrap',
                  isActive
                    ? 'border-accent-600 text-accent-700'
                    : 'border-transparent text-ink-400 hover:text-ink-600 hover:border-ink-200',
                )}
              >
                <TabIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                <span className="hidden sm:inline">{label}</span>
                <span className="sm:hidden">{label.replace('My ', '')}</span>
                {count > 0 && (
                  <span className={cn(
                    'text-[10px] px-1.5 py-0.5 rounded-full',
                    isActive ? 'bg-accent-100 text-accent-700' : 'bg-ink-100 text-ink-500',
                  )}>
                    {count}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Filter bar ─────────────────────────────────── */}
      <FilterBar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        projectFilter={projectFilter}
        onProjectChange={setProjectFilter}
        projects={projects}
        statusFilter={statusFilter}
        onStatusChange={setStatusFilter}
        statusOptions={getStatusOptionsForTab(activeTab)}
        priorityFilter={priorityFilter}
        onPriorityChange={setPriorityFilter}
        showPriority={['tasks', 'observations', 'snags'].includes(activeTab)}
        sortBy={sortBy}
        onSortChange={setSortBy}
        showFilters={showFilters}
        onToggleFilters={() => setShowFilters(!showFilters)}
        dueDateFrom={dueDateFrom}
        dueDateTo={dueDateTo}
        onDueDateFromChange={setDueDateFrom}
        onDueDateToChange={setDueDateTo}
        dateSubmittedFrom={dateSubmittedFrom}
        dateSubmittedTo={dateSubmittedTo}
        onDateSubmittedFromChange={setDateSubmittedFrom}
        onDateSubmittedToChange={setDateSubmittedTo}
        typeFilter={typeFilter}
        onTypeChange={setTypeFilter}
        typeOptions={getTypeOptionsForTab(activeTab)}
        assignedByFilter={assignedByFilter}
        onAssignedByChange={setAssignedByFilter}
        onClearAll={clearAllFilters}
        activeFilterCount={activeFilterCount}
      />

      {/* ── Tab content ────────────────────────────────── */}
      <div>
        {/* ── My Tasks ─────────────────────────────────── */}
        {activeTab === 'tasks' && (
          <>
            {tasksLoading && <LoadingSkeleton />}
            {tasksError && <ErrorPanel message={tasksError} onRetry={() => { setTasksLoaded(false); fetchTasks() }} />}
            {tasksLoaded && !tasksLoading && filteredTasks.length === 0 && (
              <EmptyState icon={ClipboardList} title="No tasks found" description="Tasks assigned to you will appear here." />
            )}
            {tasksLoaded && !tasksLoading && tasksByProject.length > 0 && (
              <div className="space-y-4">
                {tasksByProject.map((group) => (
                  <div key={group.projectId}>
                    <div className="flex items-center gap-2 mb-2">
                      <Link href={`/projects/${group.projectId}`} className="text-[13px] font-semibold text-ink-700 hover:text-accent-700 transition-colors">
                        {group.projectCode} - {group.projectName}
                      </Link>
                      <span className="text-[11px] text-ink-400">{group.tasks.length}</span>
                    </div>
                    <div className="bg-white rounded-xl border border-ink-100 divide-y divide-ink-50">
                      {group.tasks.map((task) => (
                        <Link
                          key={task.id}
                          href={`/tasks/${task.id}`}
                          className="flex items-center gap-3 sm:gap-4 px-4 sm:px-5 py-3 group hover:bg-surface-50 transition-colors"
                        >
                          <PriorityDot priority={task.priority} />
                          <div className="flex-1 min-w-0">
                            <p className="text-[13px] font-medium text-ink-900 truncate group-hover:text-accent-700 transition-colors">{task.title}</p>
                            <p className="text-[11px] text-ink-400 mt-0.5 truncate">
                              {PRIORITY_LABELS[task.priority] || task.priority}
                              {task.estimatedHours ? ` · ${task.estimatedHours}h` : ''}
                            </p>
                          </div>
                          <StatusBadge status={task.status} meta={Object.fromEntries(
                            Object.entries(TASK_STATUS_LABELS).map(([k, v]) => [k, { label: v, color: TASK_STATUS_COLORS[k]?.split(' ')[1] || 'text-ink-500', bg: TASK_STATUS_COLORS[k]?.split(' ')[0] || 'bg-ink-100' }])
                          )} />
                          <span className={cn(
                            'text-[11px] shrink-0 w-20 text-right hidden sm:block',
                            isDueDateOverdue(task.dueDate) ? 'text-red-600 font-medium' : 'text-ink-400',
                          )}>
                            {formatDueDate(task.dueDate)}
                          </span>
                        </Link>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ── My Reviews ───────────────────────────────── */}
        {activeTab === 'reviews' && (
          <>
            {reviewsLoading && <LoadingSkeleton />}
            {reviewsError && <ErrorPanel message={reviewsError} onRetry={() => { setReviewsLoaded(false); fetchReviews() }} />}
            {reviewsLoaded && !reviewsLoading && filteredReviews.length === 0 && (
              <EmptyState icon={FileCheck} title="No reviews pending" description="Documents and tasks awaiting your review will appear here." />
            )}
            {reviewsLoaded && !reviewsLoading && filteredReviews.length > 0 && (
              <div className="bg-white rounded-xl border border-ink-100 divide-y divide-ink-50">
                {filteredReviews.map((review) => (
                  <Link
                    key={review.id}
                    href={`/tasks/${review.id}`}
                    className="flex items-center gap-3 sm:gap-4 px-4 sm:px-5 py-3.5 group hover:bg-surface-50 transition-colors"
                  >
                    <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center shrink-0">
                      {review.type === 'task' ? <ClipboardList className="w-4 h-4 text-amber-500" /> : <FileCheck className="w-4 h-4 text-amber-500" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium text-ink-900 truncate group-hover:text-accent-700 transition-colors">{review.title}</p>
                      <p className="text-[11px] text-ink-400 mt-0.5">
                        {review.projectCode} · Submitted by {review.submittedBy} · {formatShortDate(review.submittedDate)}
                      </p>
                    </div>
                    <span className="text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-600 shrink-0">
                      Pending review
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </>
        )}

        {/* ── My Approvals ─────────────────────────────── */}
        {activeTab === 'approvals' && (
          <>
            {approvalsLoading && <LoadingSkeleton />}
            {approvalsError && <ErrorPanel message={approvalsError} onRetry={() => { setApprovalsLoaded(false); fetchApprovals() }} />}
            {approvalsLoaded && !approvalsLoading && filteredApprovals.length === 0 && (
              <EmptyState icon={ShieldCheck} title="No approvals pending" description="Leave requests, expenses, and other items awaiting your approval will appear here." />
            )}
            {approvalsLoaded && !approvalsLoading && filteredApprovals.length > 0 && (
              <div className="bg-white rounded-xl border border-ink-100 divide-y divide-ink-50">
                {filteredApprovals.map((approval) => (
                  <div
                    key={approval.id}
                    className="flex items-center gap-3 sm:gap-4 px-4 sm:px-5 py-3.5"
                  >
                    <div className={cn(
                      'w-8 h-8 rounded-lg flex items-center justify-center shrink-0',
                      approval.type === 'leave' ? 'bg-blue-50' : approval.type === 'expense' ? 'bg-emerald-50' : 'bg-violet-50',
                    )}>
                      {approval.type === 'leave' && <CalendarDays className="w-4 h-4 text-blue-500" />}
                      {approval.type === 'expense' && <Wallet className="w-4 h-4 text-emerald-500" />}
                      {approval.type === 'budget' && <FolderOpen className="w-4 h-4 text-violet-500" />}
                      {approval.type === 'variation' && <FolderOpen className="w-4 h-4 text-violet-500" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium text-ink-900 truncate">{approval.title}</p>
                      <p className="text-[11px] text-ink-400 mt-0.5">
                        {approval.type.charAt(0).toUpperCase() + approval.type.slice(1)} · {approval.requester} · {formatShortDate(approval.date)}
                      </p>
                    </div>
                    {approval.amount && (
                      <span className="text-[13px] font-semibold text-ink-900 shrink-0">{approval.amount}</span>
                    )}
                    <StatusBadge status={approval.status} meta={LEAVE_STATUS_META} />
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ── Observations ─────────────────────────────── */}
        {activeTab === 'observations' && (
          <>
            {observationsLoading && <LoadingSkeleton />}
            {observationsError && <ErrorPanel message={observationsError} onRetry={() => { setObservationsLoaded(false); fetchObservations() }} />}
            {observationsLoaded && !observationsLoading && filteredObservations.length === 0 && (
              <EmptyState icon={MapPin} title="No observations" description="Site observations assigned to you will appear here." />
            )}
            {observationsLoaded && !observationsLoading && filteredObservations.length > 0 && (
              <div className="bg-white rounded-xl border border-ink-100 divide-y divide-ink-50">
                {filteredObservations.map((obs) => (
                  <Link
                    key={obs.id}
                    href={`/observations/${obs.id}`}
                    className="flex items-center gap-3 sm:gap-4 px-4 sm:px-5 py-3.5 group hover:bg-surface-50 transition-colors"
                  >
                    <PriorityDot priority={obs.priority} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium text-ink-900 truncate group-hover:text-accent-700 transition-colors">{obs.title}</p>
                      <p className="text-[11px] text-ink-400 mt-0.5 truncate">
                        {obs.projectCode} · {obs.location}
                      </p>
                    </div>
                    <StatusBadge status={obs.status} meta={OBSERVATION_STATUS_META} />
                    <span className={cn(
                      'text-[11px] shrink-0 w-20 text-right hidden sm:block',
                      isDueDateOverdue(obs.dueDate) ? 'text-red-600 font-medium' : 'text-ink-400',
                    )}>
                      {formatDueDate(obs.dueDate)}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </>
        )}

        {/* ── Snags ────────────────────────────────────── */}
        {activeTab === 'snags' && (
          <>
            {snagsLoading && <LoadingSkeleton />}
            {snagsError && <ErrorPanel message={snagsError} onRetry={() => { setSnagsLoaded(false); fetchSnags() }} />}
            {snagsLoaded && !snagsLoading && filteredSnags.length === 0 && (
              <EmptyState icon={Bug} title="No snags" description="Snag list items assigned to you will appear here." />
            )}
            {snagsLoaded && !snagsLoading && filteredSnags.length > 0 && (
              <div className="bg-white rounded-xl border border-ink-100 divide-y divide-ink-50">
                {filteredSnags.map((snag) => (
                  <Link
                    key={snag.id}
                    href={`/snags/${snag.id}`}
                    className="flex items-center gap-3 sm:gap-4 px-4 sm:px-5 py-3.5 group hover:bg-surface-50 transition-colors"
                  >
                    <PriorityDot priority={snag.severity} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium text-ink-900 truncate group-hover:text-accent-700 transition-colors">{snag.title}</p>
                      <p className="text-[11px] text-ink-400 mt-0.5 truncate">
                        {snag.projectCode} · {snag.location} · {snag.category.replace(/_/g, ' ')}
                      </p>
                    </div>
                    <StatusBadge status={snag.status} meta={SNAG_STATUS_META} />
                    <span className={cn(
                      'text-[11px] shrink-0 w-20 text-right hidden sm:block',
                      isDueDateOverdue(snag.dueDate) ? 'text-red-600 font-medium' : 'text-ink-400',
                    )}>
                      {formatDueDate(snag.dueDate)}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </>
        )}

        {/* ── My Leave ─────────────────────────────────── */}
        {activeTab === 'leave' && (
          <>
            {leaveLoading && <LoadingSkeleton />}
            {leaveError && <ErrorPanel message={leaveError} onRetry={() => { setLeaveLoaded(false); fetchLeave() }} />}
            {leaveLoaded && !leaveLoading && (
              <div className="space-y-4">
                {/* Leave balance summary */}
                {leaveBalance && (
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    <div className="bg-white rounded-xl border border-ink-100 p-4 flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                        <CalendarDays className="w-4 h-4 text-blue-500" />
                      </div>
                      <div>
                        <p className="text-[22px] font-semibold text-ink-900 leading-tight">{leaveBalance.allocation}</p>
                        <p className="text-[11px] text-ink-400">Allocation</p>
                      </div>
                    </div>
                    <div className="bg-white rounded-xl border border-ink-100 p-4 flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-ink-50 flex items-center justify-center shrink-0">
                        <CheckCircle2 className="w-4 h-4 text-ink-400" />
                      </div>
                      <div>
                        <p className="text-[22px] font-semibold text-ink-900 leading-tight">{leaveBalance.used}</p>
                        <p className="text-[11px] text-ink-400">Used</p>
                      </div>
                    </div>
                    <div className="bg-white rounded-xl border border-ink-100 p-4 flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center shrink-0">
                        <Clock className="w-4 h-4 text-amber-500" />
                      </div>
                      <div>
                        <p className="text-[22px] font-semibold text-ink-900 leading-tight">{leaveBalance.pending}</p>
                        <p className="text-[11px] text-ink-400">Pending</p>
                      </div>
                    </div>
                    <div className="bg-white rounded-xl border border-ink-100 p-4 flex items-start gap-3">
                      <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center shrink-0', leaveBalance.available <= 3 ? 'bg-red-50' : 'bg-emerald-50')}>
                        <CalendarDays className={cn('w-4 h-4', leaveBalance.available <= 3 ? 'text-red-500' : 'text-emerald-500')} />
                      </div>
                      <div>
                        <p className="text-[22px] font-semibold text-ink-900 leading-tight">{leaveBalance.available}</p>
                        <p className="text-[11px] text-ink-400">Available</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Leave requests list */}
                {filteredLeave.length === 0 ? (
                  <EmptyState icon={CalendarDays} title="No leave requests" description="Your leave requests will appear here." />
                ) : (
                  <div className="bg-white rounded-xl border border-ink-100 divide-y divide-ink-50">
                    {filteredLeave.map((req) => (
                      <div key={req.id} className="flex items-center gap-3 sm:gap-4 px-4 sm:px-5 py-3.5">
                        <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                          <CalendarDays className="w-4 h-4 text-blue-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-medium text-ink-900">
                            {LEAVE_TYPE_LABELS[req.leaveType] || req.leaveType}
                          </p>
                          <p className="text-[11px] text-ink-400 mt-0.5">
                            {formatDateRange(req.startDate, req.endDate)} · {req.days} {req.days === 1 ? 'day' : 'days'}
                            {req.reason && ` · ${req.reason}`}
                          </p>
                        </div>
                        <StatusBadge status={req.status} meta={LEAVE_STATUS_META} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* ── My Expenses ──────────────────────────────── */}
        {activeTab === 'expenses' && (
          <>
            {expensesLoading && <LoadingSkeleton />}
            {expensesError && <ErrorPanel message={expensesError} onRetry={() => { setExpensesLoaded(false); fetchExpenses() }} />}
            {expensesLoaded && !expensesLoading && filteredExpenses.length === 0 && (
              <EmptyState icon={Wallet} title="No expense claims" description="Your expense claims will appear here." />
            )}
            {expensesLoaded && !expensesLoading && filteredExpenses.length > 0 && (
              <div className="bg-white rounded-xl border border-ink-100 divide-y divide-ink-50">
                {filteredExpenses.map((claim) => (
                  <div key={claim.id} className="flex items-center gap-3 sm:gap-4 px-4 sm:px-5 py-3.5">
                    <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0">
                      <Wallet className="w-4 h-4 text-emerald-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium text-ink-900 truncate">{claim.description}</p>
                      <p className="text-[11px] text-ink-400 mt-0.5">
                        {EXPENSE_CATEGORY_LABELS[claim.category] || claim.category} · {formatShortDate(claim.createdAt)}
                      </p>
                    </div>
                    <span className="text-[13px] font-semibold text-ink-900 shrink-0">
                      {formatAmount(claim.amount, claim.currency)}
                    </span>
                    <StatusBadge status={claim.status} meta={LEAVE_STATUS_META} />
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ── Notifications ────────────────────────────── */}
        {activeTab === 'notifications' && (
          <>
            {notificationsLoading && <LoadingSkeleton />}
            {notificationsError && <ErrorPanel message={notificationsError} onRetry={() => { setNotificationsLoaded(false); fetchNotifications() }} />}
            {notificationsLoaded && !notificationsLoading && filteredNotifications.length === 0 && (
              <EmptyState icon={Bell} title="No notifications" description="You're all caught up. Notifications will appear here when there's activity." />
            )}
            {notificationsLoaded && !notificationsLoading && filteredNotifications.length > 0 && (
              <div className="bg-white rounded-xl border border-ink-100 divide-y divide-ink-50">
                {filteredNotifications.map((notif) => (
                  <div key={notif.id} className="flex items-start gap-3 sm:gap-4 px-4 sm:px-5 py-3.5">
                    <div className={cn(
                      'w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5',
                      notif.type === 'warning' ? 'bg-amber-50' : notif.type === 'error' ? 'bg-red-50' : 'bg-blue-50',
                    )}>
                      {notif.type === 'warning' && <AlertTriangle className="w-4 h-4 text-amber-500" />}
                      {notif.type === 'error' && <AlertTriangle className="w-4 h-4 text-red-500" />}
                      {notif.type === 'info' && <Bell className="w-4 h-4 text-blue-500" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className={cn('text-[13px] font-medium truncate', notif.read ? 'text-ink-500' : 'text-ink-900')}>
                          {notif.title}
                        </p>
                        {!notif.read && <span className="w-1.5 h-1.5 rounded-full bg-accent-500 shrink-0" />}
                      </div>
                      <p className="text-[12px] text-ink-400 mt-0.5 truncate">{notif.body}</p>
                    </div>
                    <span className="text-[11px] text-ink-400 shrink-0 whitespace-nowrap">{timeAgo(notif.createdAt)}</span>
                    {notif.link && (
                      <Link
                        href={notif.link}
                        className="text-[11px] text-accent-600 hover:text-accent-700 font-medium shrink-0 transition-colors"
                      >
                        View
                      </Link>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

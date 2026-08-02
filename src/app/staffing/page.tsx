'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import {
  Users, AlertTriangle, RefreshCw, Briefcase, UserCheck, BarChart3,
  Calendar, Clock, FileText, ChevronDown, ChevronRight, Search,
  Building2, Shield, GraduationCap, ClipboardList, TrendingUp,
  UserPlus, Mail, X, AlertCircle, CheckCircle2, Timer,
  CalendarDays, BookOpen, Wrench, ChevronLeft,
} from 'lucide-react'
import { SkeletonRow } from '@/components/Skeleton'

/* ================================================================
   TYPES
   ================================================================ */

interface Employee {
  id: string
  fullName: string
  email: string
  jobTitle: string | null
  status: string
  startDate: string | null
  officeId: string | null
  orgPermission: string
  office: string | null
  department: string | null
  role: string | null
  onboardingComplete: boolean
  leaveAllocation: number
}

interface StaffingMetrics {
  totalEmployees: number
  activeEmployees: number
  onboarding: number
  avgUtilisation: number
  overAllocated: number
  underAllocated: number
  totalCapacityHours: number
  totalAllocatedHours: number
  pendingLeave: number
  leaveNext30: number
  leaveNext60: number
  expiringDocuments: number
  probationsDue: number
}

interface OfficeBreakdown {
  name: string
  count: number
}

interface ExpiringDoc {
  id: string
  title: string
  documentType: string
  expiryDate: string
  profile: { fullName: string }
}

interface StaffingData {
  metrics: StaffingMetrics
  byOffice: OfficeBreakdown[]
  byDepartment: Record<string, number>
  expiringDocs: ExpiringDoc[]
  employees: Employee[]
}

interface EmployeeDetail {
  employee: {
    id: string
    fullName: string
    email: string
    phone: string | null
    jobTitle: string | null
    avatarUrl: string | null
    orgPermission: string
    status: string
    startDate: string | null
    office: { id: string; name: string; city: string; country: string } | null
    role: { id: string; title: string; department: string | null; level: string | null } | null
    manager: { id: string; fullName: string; jobTitle: string | null } | null
    emergencyContact: { name: string | null; phone: string | null; relation: string | null } | null
    onboardingComplete: boolean
    mentorId: string | null
    qualificationPathway: string | null
    leaveAllocation: number
  }
  projects: { membershipId: string; role: string | null; project: { id: string; name: string; code: string | null; status: string; stage: string } }[]
  leaveBalances: { id: string; year: number; entitlement: number; used: number; remaining: number }[]
  training: { id: string; completedAt: string; module: { id: string; title: string; category: string | null } }[]
  cpd: { id: string; activityDate: string; title: string; hours: number; provider: string | null }[]
  assets: { id: string; asset: { id: string; name: string; assetTag: string | null; category: string } }[]
  hrDocuments: { id: string; title: string; documentType: string; expiryDate: string | null; acknowledged: boolean; isConfidential: boolean; createdAt: string }[]
  allocations: { id: string; weekStarting: string; hoursAllocated: number; role: string | null; project: { id: string; name: string; code: string | null } }[]
  probationReviews: { id: string; reviewType: string; scheduledDate: string; completedDate: string | null; outcome: string | null; objectives: string | null; feedback: string | null }[]
}

interface Allocation {
  id: string
  profileId: string
  projectId: string
  weekStarting: string
  hoursAllocated: number
  role: string | null
  profile: { id: string; fullName: string; jobTitle: string | null }
  project: { id: string; name: string; code: string | null; status: string }
}

interface AllocationsData {
  allocations: Allocation[]
  approvedLeave: { id: string; profileId: string; leaveType: string; startDate: string; endDate: string; totalDays: number; profile: { fullName: string } }[]
  employees: { id: string; fullName: string; jobTitle: string | null; office: { name: string } | null }[]
  projects: { id: string; name: string; code: string | null }[]
  weekStarting: string
  weeksCount: number
}

interface ProbationReview {
  id: string
  reviewType: string
  scheduledDate: string
  completedDate: string | null
  outcome: string | null
  objectives: string | null
  feedback: string | null
  profile: { id: string; fullName: string; jobTitle: string | null; startDate: string | null }
}

/* ================================================================
   CONSTANTS
   ================================================================ */

type TabKey = 'people' | 'resource-plan' | 'leave-admin' | 'onboarding' | 'reports'

const TABS: { key: TabKey; label: string; icon: React.ElementType }[] = [
  { key: 'people', label: 'People', icon: Users },
  { key: 'resource-plan', label: 'Resource Plan', icon: BarChart3 },
  { key: 'leave-admin', label: 'Leave Admin', icon: Calendar },
  { key: 'onboarding', label: 'Onboarding', icon: ClipboardList },
  { key: 'reports', label: 'Reports', icon: TrendingUp },
]

const STATUS_COLORS: Record<string, { label: string; color: string; bg: string }> = {
  ACTIVE: { label: 'Active', color: 'text-emerald-600', bg: 'bg-emerald-50' },
  INVITED: { label: 'Invited', color: 'text-blue-600', bg: 'bg-blue-50' },
  ONBOARDING: { label: 'Onboarding', color: 'text-blue-600', bg: 'bg-blue-50' },
  DEACTIVATED: { label: 'Deactivated', color: 'text-ink-400', bg: 'bg-ink-50' },
}

const DOC_TYPE_LABELS: Record<string, string> = {
  CONTRACT: 'Contract',
  OFFER_LETTER: 'Offer Letter',
  RIGHT_TO_WORK: 'Right to Work',
  VISA: 'Visa',
  DBS_CHECK: 'DBS Check',
  PROFESSIONAL_MEMBERSHIP: 'Prof. Membership',
  QUALIFICATION: 'Qualification',
  TRAINING_CERTIFICATE: 'Training Cert',
  PERFORMANCE_REVIEW: 'Performance Review',
  DISCIPLINARY: 'Disciplinary',
  GRIEVANCE: 'Grievance',
  POLICY_ACKNOWLEDGEMENT: 'Policy Ack.',
  OTHER: 'Other',
}

/* ================================================================
   HELPERS
   ================================================================ */

function formatDate(iso: string | null): string {
  if (!iso) return '-'
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function daysUntil(iso: string): number {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
}

function getMonday(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  d.setDate(diff)
  d.setHours(0, 0, 0, 0)
  return d
}

function formatWeek(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

/* ================================================================
   MAIN COMPONENT
   ================================================================ */

export default function StaffingPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('people')
  const [data, setData] = useState<StaffingData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // People tab state
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [officeFilter, setOfficeFilter] = useState<string>('all')
  const [departmentFilter, setDepartmentFilter] = useState<string>('all')
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null)
  const [employeeDetail, setEmployeeDetail] = useState<EmployeeDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailSection, setDetailSection] = useState<string>('overview')

  // Resource plan tab state
  const [allocationsData, setAllocationsData] = useState<AllocationsData | null>(null)
  const [allocationsLoading, setAllocationsLoading] = useState(false)
  const [weekOffset, setWeekOffset] = useState(0)

  // Onboarding tab state
  const [probationReviews, setProbationReviews] = useState<ProbationReview[]>([])
  const [probationLoading, setProbationLoading] = useState(false)

  /* ── Data fetching ─────────────────────────────────────────── */

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/staffing')
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}))
        throw new Error(errBody.error?.message || 'Failed to load staffing data')
      }
      const json = await res.json()
      setData(json.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchEmployeeDetail = useCallback(async (profileId: string) => {
    setDetailLoading(true)
    try {
      const res = await fetch(`/api/staffing/employees/${profileId}`)
      if (!res.ok) throw new Error('Failed to load employee details')
      const json = await res.json()
      setEmployeeDetail(json.data)
    } catch {
      setEmployeeDetail(null)
    } finally {
      setDetailLoading(false)
    }
  }, [])

  const fetchAllocations = useCallback(async () => {
    setAllocationsLoading(true)
    try {
      const monday = getMonday(new Date())
      monday.setDate(monday.getDate() + weekOffset * 7)
      const res = await fetch(`/api/staffing/allocations?weekStarting=${monday.toISOString()}&weeks=4`)
      if (!res.ok) throw new Error('Failed to load allocations')
      const json = await res.json()
      setAllocationsData(json.data)
    } catch {
      setAllocationsData(null)
    } finally {
      setAllocationsLoading(false)
    }
  }, [weekOffset])

  const fetchProbationReviews = useCallback(async () => {
    setProbationLoading(true)
    try {
      const res = await fetch('/api/staffing/probation?pending=true')
      if (!res.ok) throw new Error('Failed to load probation reviews')
      const json = await res.json()
      setProbationReviews(json.data?.reviews ?? [])
    } catch {
      setProbationReviews([])
    } finally {
      setProbationLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  useEffect(() => {
    if (selectedEmployeeId) {
      fetchEmployeeDetail(selectedEmployeeId)
    }
  }, [selectedEmployeeId, fetchEmployeeDetail])

  useEffect(() => {
    if (activeTab === 'resource-plan') {
      fetchAllocations()
    }
  }, [activeTab, fetchAllocations])

  useEffect(() => {
    if (activeTab === 'onboarding') {
      fetchProbationReviews()
    }
  }, [activeTab, fetchProbationReviews])

  /* ── Filtered employees ────────────────────────────────────── */

  const filteredEmployees = useMemo(() => {
    if (!data) return []
    return data.employees.filter((e) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase()
        if (
          !e.fullName.toLowerCase().includes(q) &&
          !e.email.toLowerCase().includes(q) &&
          !(e.jobTitle ?? '').toLowerCase().includes(q)
        ) return false
      }
      if (statusFilter !== 'all' && e.status !== statusFilter) return false
      if (officeFilter !== 'all' && (e.office ?? 'Unassigned') !== officeFilter) return false
      if (departmentFilter !== 'all' && (e.department ?? 'Unassigned') !== departmentFilter) return false
      return true
    })
  }, [data, searchQuery, statusFilter, officeFilter, departmentFilter])

  const uniqueOffices = useMemo(() => {
    if (!data) return []
    const offices = new Set(data.employees.map((e) => e.office ?? 'Unassigned'))
    return Array.from(offices).sort()
  }, [data])

  const uniqueDepartments = useMemo(() => {
    if (!data) return []
    const depts = new Set(data.employees.map((e) => e.department ?? 'Unassigned'))
    return Array.from(depts).sort()
  }, [data])

  /* ── Loading skeleton ──────────────────────────────────────── */

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-40 bg-ink-100 animate-pulse rounded" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 bg-ink-100 animate-pulse rounded-xl" />
          ))}
        </div>
        <div className="bg-white rounded-xl border border-ink-100 divide-y divide-ink-50">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonRow key={i} />
          ))}
        </div>
      </div>
    )
  }

  /* ── Error state ───────────────────────────────────────────── */

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh] gap-4">
        <AlertTriangle className="w-8 h-8 text-red-500" />
        <p className="text-[13px] text-ink-600">{error}</p>
        <button
          onClick={fetchData}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-ink-900 text-white text-[13px] font-medium hover:bg-ink-800 transition-colors"
        >
          <RefreshCw className="w-4 h-4" /> Try again
        </button>
      </div>
    )
  }

  if (!data) return null

  const { metrics } = data

  /* ================================================================
     RENDER — People Tab
     ================================================================ */

  function renderPeopleTab() {
    return (
      <div className="space-y-6">
        {/* ── Metrics cards ──────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          <MetricCard icon={Users} iconColor="text-ink-400" iconBg="bg-ink-50" label="Total employees" value={metrics.totalEmployees} />
          <MetricCard icon={UserCheck} iconColor="text-emerald-500" iconBg="bg-emerald-50" label="Active" value={metrics.activeEmployees} />
          <MetricCard icon={BarChart3} iconColor="text-blue-500" iconBg="bg-blue-50" label="Avg utilisation" value={`${metrics.avgUtilisation}%`} />
          <MetricCard icon={Calendar} iconColor="text-amber-500" iconBg="bg-amber-50" label="Pending leave" value={metrics.pendingLeave} />
          <MetricCard icon={AlertCircle} iconColor="text-red-500" iconBg="bg-red-50" label="Expiring docs" value={metrics.expiringDocuments} />
        </div>

        {/* ── Secondary metrics ──────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl border border-ink-100 p-4">
            <p className="text-[11px] text-ink-400 uppercase tracking-wide">Onboarding</p>
            <p className="text-[18px] font-semibold text-ink-900 mt-1">{metrics.onboarding}</p>
          </div>
          <div className="bg-white rounded-xl border border-ink-100 p-4">
            <p className="text-[11px] text-ink-400 uppercase tracking-wide">Over-allocated</p>
            <p className="text-[18px] font-semibold text-red-600 mt-1">{metrics.overAllocated}</p>
          </div>
          <div className="bg-white rounded-xl border border-ink-100 p-4">
            <p className="text-[11px] text-ink-400 uppercase tracking-wide">Leave (30 days)</p>
            <p className="text-[18px] font-semibold text-ink-900 mt-1">{metrics.leaveNext30}</p>
          </div>
          <div className="bg-white rounded-xl border border-ink-100 p-4">
            <p className="text-[11px] text-ink-400 uppercase tracking-wide">Probation due</p>
            <p className="text-[18px] font-semibold text-ink-900 mt-1">{metrics.probationsDue}</p>
          </div>
        </div>

        {/* ── By-office / By-department breakdown ────────────── */}
        {(data!.byOffice.length > 0 || Object.keys(data!.byDepartment).length > 0) && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {data!.byOffice.length > 0 && (
              <div className="bg-white rounded-xl border border-ink-100 p-5">
                <h3 className="text-[13px] font-semibold text-ink-700 mb-3 flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-ink-400" /> By Office
                </h3>
                <div className="space-y-2">
                  {data!.byOffice.map((o) => (
                    <div key={o.name} className="flex items-center justify-between">
                      <span className="text-[13px] text-ink-600">{o.name}</span>
                      <span className="text-[13px] font-medium text-ink-900">{o.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {Object.keys(data!.byDepartment).length > 0 && (
              <div className="bg-white rounded-xl border border-ink-100 p-5">
                <h3 className="text-[13px] font-semibold text-ink-700 mb-3 flex items-center gap-2">
                  <Briefcase className="w-4 h-4 text-ink-400" /> By Department
                </h3>
                <div className="space-y-2">
                  {Object.entries(data!.byDepartment).map(([dept, count]) => (
                    <div key={dept} className="flex items-center justify-between">
                      <span className="text-[13px] text-ink-600">{dept}</span>
                      <span className="text-[13px] font-medium text-ink-900">{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Expiring documents alert ───────────────────────── */}
        {data!.expiringDocs.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
            <h3 className="text-[13px] font-semibold text-amber-800 mb-3 flex items-center gap-2">
              <AlertCircle className="w-4 h-4" /> Documents expiring within 60 days
            </h3>
            <div className="space-y-2">
              {data!.expiringDocs.map((doc) => (
                <div key={doc.id} className="flex items-center justify-between text-[12px]">
                  <span className="text-amber-900">
                    {doc.profile.fullName} — {DOC_TYPE_LABELS[doc.documentType] ?? doc.documentType}: {doc.title}
                  </span>
                  <span className="text-amber-700 font-medium">
                    {daysUntil(doc.expiryDate)} days
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Search & filters ───────────────────────────────── */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="relative flex-1 min-w-0 w-full sm:w-auto">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-300" />
            <input
              type="text"
              placeholder="Search employees..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-[13px] border border-ink-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-ink-900/10"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-[13px] border border-ink-200 rounded-lg px-3 py-2 bg-white"
          >
            <option value="all">All statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="ONBOARDING">Onboarding</option>
            <option value="INVITED">Invited</option>
            <option value="DEACTIVATED">Deactivated</option>
          </select>
          {uniqueOffices.length > 1 && (
            <select
              value={officeFilter}
              onChange={(e) => setOfficeFilter(e.target.value)}
              className="text-[13px] border border-ink-200 rounded-lg px-3 py-2 bg-white"
            >
              <option value="all">All offices</option>
              {uniqueOffices.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          )}
          {uniqueDepartments.length > 1 && (
            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="text-[13px] border border-ink-200 rounded-lg px-3 py-2 bg-white"
            >
              <option value="all">All departments</option>
              {uniqueDepartments.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          )}
        </div>

        {/* ── Employee table ─────────────────────────────────── */}
        <div className="bg-white rounded-xl border border-ink-100 divide-y divide-ink-50">
          {/* Table header */}
          <div className="grid grid-cols-[1fr_1fr_auto_auto] gap-4 px-5 py-3">
            <p className="text-[11px] font-medium text-ink-400 uppercase tracking-wide">Name</p>
            <p className="text-[11px] font-medium text-ink-400 uppercase tracking-wide">Role / Dept</p>
            <p className="text-[11px] font-medium text-ink-400 uppercase tracking-wide w-20 text-right">Office</p>
            <p className="text-[11px] font-medium text-ink-400 uppercase tracking-wide w-24 text-right">Status</p>
          </div>
          {filteredEmployees.length === 0 ? (
            <div className="px-5 py-8 text-center">
              <p className="text-[13px] text-ink-400">No employees match your filters</p>
            </div>
          ) : (
            filteredEmployees.map((emp) => {
              const statusMeta = STATUS_COLORS[emp.status] ?? { label: emp.status, color: 'text-ink-500', bg: 'bg-ink-100' }
              const isSelected = selectedEmployeeId === emp.id
              return (
                <button
                  key={emp.id}
                  onClick={() => {
                    setSelectedEmployeeId(isSelected ? null : emp.id)
                    setDetailSection('overview')
                  }}
                  className={`w-full grid grid-cols-[1fr_1fr_auto_auto] gap-4 items-center px-5 py-3.5 text-left hover:bg-ink-25 transition-colors ${isSelected ? 'bg-ink-50' : ''}`}
                >
                  <div className="min-w-0 flex items-center gap-2">
                    {isSelected ? <ChevronDown className="w-4 h-4 text-ink-400 shrink-0" /> : <ChevronRight className="w-4 h-4 text-ink-300 shrink-0" />}
                    <div className="min-w-0">
                      <p className="text-[13px] font-medium text-ink-900 truncate">{emp.fullName}</p>
                      <p className="text-[11px] text-ink-400 truncate">{emp.email}</p>
                    </div>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[13px] text-ink-600 truncate">{emp.jobTitle || emp.role || 'No role'}</p>
                    {emp.department && <p className="text-[11px] text-ink-400 truncate">{emp.department}</p>}
                  </div>
                  <p className="text-[12px] text-ink-500 w-20 text-right truncate">{emp.office ?? '-'}</p>
                  <div className="w-24 text-right">
                    <span className={`text-[11px] font-medium px-2.5 py-0.5 rounded-full ${statusMeta.bg} ${statusMeta.color}`}>
                      {statusMeta.label}
                    </span>
                  </div>
                </button>
              )
            })
          )}
        </div>

        {/* ── Employee detail panel ──────────────────────────── */}
        {selectedEmployeeId && (
          <EmployeeDetailPanel
            detail={employeeDetail}
            loading={detailLoading}
            section={detailSection}
            onSectionChange={setDetailSection}
            onClose={() => setSelectedEmployeeId(null)}
          />
        )}
      </div>
    )
  }

  /* ================================================================
     RENDER — Resource Plan Tab
     ================================================================ */

  function renderResourcePlanTab() {
    if (allocationsLoading) {
      return (
        <div className="space-y-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-12 bg-ink-100 animate-pulse rounded-lg" />
          ))}
        </div>
      )
    }

    if (!allocationsData) {
      return (
        <EmptyState
          icon={BarChart3}
          title="Resource Plan"
          description="Resource allocations will appear here once team members are assigned hours against projects."
        />
      )
    }

    const { employees: allocEmployees, projects: allocProjects, allocations: allocs, approvedLeave } = allocationsData

    // Build week columns
    const startDate = new Date(allocationsData.weekStarting)
    const weeks: string[] = []
    for (let i = 0; i < 4; i++) {
      const d = new Date(startDate)
      d.setDate(startDate.getDate() + i * 7)
      weeks.push(d.toISOString())
    }

    // Build allocation map: profileId -> weekIso -> total hours
    const allocMap = new Map<string, Map<string, number>>()
    for (const a of allocs) {
      if (!allocMap.has(a.profileId)) allocMap.set(a.profileId, new Map())
      const weekKey = new Date(a.weekStarting).toISOString().split('T')[0]
      const current = allocMap.get(a.profileId)!.get(weekKey) ?? 0
      allocMap.get(a.profileId)!.set(weekKey, current + a.hoursAllocated)
    }

    // Leave map: profileId -> set of week ISOs where on leave
    const leaveMap = new Map<string, Set<string>>()
    for (const l of approvedLeave) {
      if (!leaveMap.has(l.profileId)) leaveMap.set(l.profileId, new Set())
      const lStart = new Date(l.startDate)
      const lEnd = new Date(l.endDate)
      for (const w of weeks) {
        const wDate = new Date(w)
        const wEnd = new Date(wDate)
        wEnd.setDate(wDate.getDate() + 7)
        if (lStart < wEnd && lEnd >= wDate) {
          leaveMap.get(l.profileId)!.add(new Date(w).toISOString().split('T')[0])
        }
      }
    }

    return (
      <div className="space-y-4">
        {/* ── Navigation ─────────────────────────────────────── */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button onClick={() => setWeekOffset((p) => p - 4)} className="p-2 rounded-lg hover:bg-ink-50 transition-colors">
              <ChevronLeft className="w-4 h-4 text-ink-600" />
            </button>
            <h3 className="text-[14px] font-medium text-ink-900">
              {formatWeek(weeks[0])} - {formatWeek(weeks[weeks.length - 1])}
            </h3>
            <button onClick={() => setWeekOffset((p) => p + 4)} className="p-2 rounded-lg hover:bg-ink-50 transition-colors">
              <ChevronRight className="w-4 h-4 text-ink-600" />
            </button>
          </div>
          <button onClick={() => setWeekOffset(0)} className="text-[12px] text-ink-500 hover:text-ink-700 px-3 py-1 rounded border border-ink-200">
            This week
          </button>
        </div>

        {/* ── Project summary ────────────────────────────────── */}
        {allocProjects.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {allocProjects.map((p) => (
              <span key={p.id} className="text-[11px] px-2 py-1 bg-blue-50 text-blue-700 rounded-full">
                {p.code ?? p.name}
              </span>
            ))}
          </div>
        )}

        {/* ── Grid ───────────────────────────────────────────── */}
        <div className="bg-white rounded-xl border border-ink-100 overflow-x-auto">
          <table className="w-full min-w-[600px]">
            <thead>
              <tr className="border-b border-ink-100">
                <th className="text-left text-[11px] font-medium text-ink-400 uppercase tracking-wide px-4 py-3 w-48">Employee</th>
                {weeks.map((w) => (
                  <th key={w} className="text-center text-[11px] font-medium text-ink-400 uppercase tracking-wide px-3 py-3 w-28">
                    w/c {formatWeek(w)}
                  </th>
                ))}
                <th className="text-center text-[11px] font-medium text-ink-400 uppercase tracking-wide px-3 py-3 w-20">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-50">
              {allocEmployees.map((emp) => {
                const empAllocs = allocMap.get(emp.id)
                const empLeave = leaveMap.get(emp.id)
                let total = 0
                return (
                  <tr key={emp.id} className="hover:bg-ink-25">
                    <td className="px-4 py-3">
                      <p className="text-[13px] font-medium text-ink-900 truncate">{emp.fullName}</p>
                      <p className="text-[11px] text-ink-400 truncate">{emp.jobTitle ?? emp.office?.name ?? ''}</p>
                    </td>
                    {weeks.map((w) => {
                      const weekKey = new Date(w).toISOString().split('T')[0]
                      const hours = empAllocs?.get(weekKey) ?? 0
                      total += hours
                      const onLeave = empLeave?.has(weekKey)
                      const overAllocated = hours > 40
                      return (
                        <td key={w} className="text-center px-3 py-3">
                          {onLeave && (
                            <span className="block text-[10px] text-amber-600 mb-0.5">Leave</span>
                          )}
                          <span className={`text-[13px] font-medium ${
                            overAllocated ? 'text-red-600' : hours > 0 ? 'text-ink-900' : 'text-ink-300'
                          }`}>
                            {hours > 0 ? `${hours}h` : '-'}
                          </span>
                          {overAllocated && (
                            <span className="block text-[10px] text-red-500">Over</span>
                          )}
                        </td>
                      )
                    })}
                    <td className="text-center px-3 py-3">
                      <span className="text-[13px] font-semibold text-ink-900">{total > 0 ? `${total}h` : '-'}</span>
                    </td>
                  </tr>
                )
              })}
              {allocEmployees.length === 0 && (
                <tr>
                  <td colSpan={weeks.length + 2} className="px-4 py-8 text-center text-[13px] text-ink-400">
                    No active employees to show
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* ── Capacity summary ───────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl border border-ink-100 p-4">
            <p className="text-[11px] text-ink-400 uppercase tracking-wide">Team capacity</p>
            <p className="text-[18px] font-semibold text-ink-900 mt-1">{metrics.totalCapacityHours}h</p>
            <p className="text-[11px] text-ink-400">{metrics.activeEmployees} people x 40h</p>
          </div>
          <div className="bg-white rounded-xl border border-ink-100 p-4">
            <p className="text-[11px] text-ink-400 uppercase tracking-wide">Allocated</p>
            <p className="text-[18px] font-semibold text-ink-900 mt-1">{metrics.totalAllocatedHours}h</p>
          </div>
          <div className="bg-white rounded-xl border border-ink-100 p-4">
            <p className="text-[11px] text-ink-400 uppercase tracking-wide">Over-allocated</p>
            <p className={`text-[18px] font-semibold mt-1 ${metrics.overAllocated > 0 ? 'text-red-600' : 'text-ink-900'}`}>
              {metrics.overAllocated}
            </p>
          </div>
          <div className="bg-white rounded-xl border border-ink-100 p-4">
            <p className="text-[11px] text-ink-400 uppercase tracking-wide">Under-utilised</p>
            <p className="text-[18px] font-semibold text-amber-600 mt-1">{metrics.underAllocated}</p>
          </div>
        </div>
      </div>
    )
  }

  /* ================================================================
     RENDER — Leave Admin Tab
     ================================================================ */

  function renderLeaveAdminTab() {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* ── Entitlement config ─────────────────────────────── */}
          <div className="bg-white rounded-xl border border-ink-100 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-emerald-50 rounded-lg flex items-center justify-center">
                <Calendar className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <h3 className="text-[14px] font-semibold text-ink-900">Entitlement by Grade</h3>
                <p className="text-[11px] text-ink-400">Leave allocation per role level</p>
              </div>
            </div>
            <div className="space-y-2 text-[12px]">
              <div className="flex justify-between py-1 border-b border-ink-50">
                <span className="text-ink-600">Senior Management</span>
                <span className="text-ink-900 font-medium">30 days</span>
              </div>
              <div className="flex justify-between py-1 border-b border-ink-50">
                <span className="text-ink-600">Management</span>
                <span className="text-ink-900 font-medium">28 days</span>
              </div>
              <div className="flex justify-between py-1 border-b border-ink-50">
                <span className="text-ink-600">Senior Staff</span>
                <span className="text-ink-900 font-medium">27 days</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-ink-600">Staff</span>
                <span className="text-ink-900 font-medium">25 days</span>
              </div>
            </div>
            <p className="text-[11px] text-ink-400 mt-3">
              Configure these values in Settings &gt; Leave Policies
            </p>
          </div>

          {/* ── Working patterns ────────────────────────────────── */}
          <div className="bg-white rounded-xl border border-ink-100 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
                <Clock className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h3 className="text-[14px] font-semibold text-ink-900">Working Patterns</h3>
                <p className="text-[11px] text-ink-400">Standard week configurations</p>
              </div>
            </div>
            <div className="space-y-2 text-[12px]">
              <div className="flex justify-between py-1 border-b border-ink-50">
                <span className="text-ink-600">Full-time (5 days)</span>
                <span className="text-ink-900 font-medium">Mon-Fri, 40h</span>
              </div>
              <div className="flex justify-between py-1 border-b border-ink-50">
                <span className="text-ink-600">Part-time (4 days)</span>
                <span className="text-ink-900 font-medium">Mon-Thu, 32h</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-ink-600">Compressed</span>
                <span className="text-ink-900 font-medium">Mon-Thu, 40h</span>
              </div>
            </div>
            <p className="text-[11px] text-ink-400 mt-3">
              Assign patterns to individual employees via their profile
            </p>
          </div>

          {/* ── Public holidays ──────────────────────────────────── */}
          <div className="bg-white rounded-xl border border-ink-100 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-amber-50 rounded-lg flex items-center justify-center">
                <CalendarDays className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <h3 className="text-[14px] font-semibold text-ink-900">Public Holidays</h3>
                <p className="text-[11px] text-ink-400">Calendars by office location</p>
              </div>
            </div>
            <div className="space-y-2 text-[12px]">
              {data!.byOffice.length > 0 ? (
                data!.byOffice.map((o) => (
                  <div key={o.name} className="flex justify-between py-1 border-b border-ink-50">
                    <span className="text-ink-600">{o.name}</span>
                    <span className="text-ink-400">Calendar not set</span>
                  </div>
                ))
              ) : (
                <p className="text-ink-400">No offices configured. Add offices in Settings.</p>
              )}
            </div>
            <p className="text-[11px] text-ink-400 mt-3">
              Configure holiday calendars in Settings &gt; Offices
            </p>
          </div>
        </div>

        {/* ── Approval routes ─────────────────────────────────── */}
        <div className="bg-white rounded-xl border border-ink-100 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-purple-50 rounded-lg flex items-center justify-center">
              <Shield className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <h3 className="text-[14px] font-semibold text-ink-900">Approval Routes</h3>
              <p className="text-[11px] text-ink-400">Leave request approval workflow</p>
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex items-center gap-3 text-[12px]">
              <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-[10px] font-bold">1</div>
              <span className="text-ink-700">Employee submits request</span>
            </div>
            <div className="flex items-center gap-3 text-[12px]">
              <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-[10px] font-bold">2</div>
              <span className="text-ink-700">Line manager reviews and approves</span>
            </div>
            <div className="flex items-center gap-3 text-[12px]">
              <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-[10px] font-bold">3</div>
              <span className="text-ink-700">HR/Admin gives final approval (if required)</span>
            </div>
            <div className="flex items-center gap-3 text-[12px]">
              <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-[10px] font-bold">4</div>
              <span className="text-ink-700">Leave confirmed and calendar updated</span>
            </div>
          </div>
          <p className="text-[11px] text-ink-400 mt-4">
            Approval routes are determined by the employee&apos;s line manager assignment. Update manager assignments in employee profiles.
          </p>
        </div>

        {/* ── Leave summary metrics ───────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <MetricCard icon={Timer} iconColor="text-amber-500" iconBg="bg-amber-50" label="Pending requests" value={metrics.pendingLeave} />
          <MetricCard icon={Calendar} iconColor="text-blue-500" iconBg="bg-blue-50" label="Staff off (30 days)" value={metrics.leaveNext30} />
          <MetricCard icon={CalendarDays} iconColor="text-purple-500" iconBg="bg-purple-50" label="Staff off (60 days)" value={metrics.leaveNext60} />
        </div>
      </div>
    )
  }

  /* ================================================================
     RENDER — Onboarding Tab
     ================================================================ */

  function renderOnboardingTab() {
    const onboardingEmployees = data!.employees.filter((e) => e.status === 'ONBOARDING' || (e.status === 'ACTIVE' && !e.onboardingComplete))
    const recentJoiners = data!.employees
      .filter((e) => e.startDate && daysUntil(e.startDate) > -90)
      .sort((a, b) => new Date(b.startDate!).getTime() - new Date(a.startDate!).getTime())
      .slice(0, 10)

    return (
      <div className="space-y-6">
        {/* ── Onboarding employees ───────────────────────────── */}
        <div className="bg-white rounded-xl border border-ink-100 p-5">
          <h3 className="text-[14px] font-semibold text-ink-900 mb-4 flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-blue-500" />
            Currently onboarding ({onboardingEmployees.length})
          </h3>
          {onboardingEmployees.length === 0 ? (
            <p className="text-[13px] text-ink-400">No employees currently in onboarding.</p>
          ) : (
            <div className="space-y-3">
              {onboardingEmployees.map((emp) => (
                <div key={emp.id} className="flex items-center justify-between p-3 bg-ink-25 rounded-lg">
                  <div>
                    <p className="text-[13px] font-medium text-ink-900">{emp.fullName}</p>
                    <p className="text-[11px] text-ink-400">{emp.jobTitle ?? 'No role'} | Started {formatDate(emp.startDate)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {emp.onboardingComplete ? (
                      <span className="text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-600">Complete</span>
                    ) : (
                      <span className="text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-600">In progress</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Onboarding checklist template ──────────────────── */}
        <div className="bg-white rounded-xl border border-ink-100 p-5">
          <h3 className="text-[14px] font-semibold text-ink-900 mb-4 flex items-center gap-2">
            <ClipboardList className="w-4 h-4 text-ink-400" />
            Standard onboarding checklist
          </h3>
          <div className="space-y-2">
            {[
              { label: 'Employment contract signed', category: 'Documents' },
              { label: 'Right to work verified', category: 'Documents' },
              { label: 'DBS check submitted', category: 'Documents' },
              { label: 'Payroll details submitted', category: 'Payroll' },
              { label: 'Bank details provided', category: 'Payroll' },
              { label: 'IT equipment issued', category: 'IT Setup' },
              { label: 'Email and system access created', category: 'IT Setup' },
              { label: 'Software licences assigned', category: 'IT Setup' },
              { label: 'Health & safety induction', category: 'Training' },
              { label: 'Fire safety briefing', category: 'Training' },
              { label: 'Company policies acknowledged', category: 'Policies' },
              { label: 'Data protection / GDPR training', category: 'Training' },
              { label: 'Line manager introduction', category: 'Orientation' },
              { label: 'Team introductions', category: 'Orientation' },
              { label: 'Probation objectives set', category: 'Probation' },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-3 py-1.5 text-[12px]">
                <div className="w-4 h-4 rounded border border-ink-300 shrink-0" />
                <span className="text-ink-700 flex-1">{item.label}</span>
                <span className="text-ink-400 text-[11px]">{item.category}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Probation reviews ──────────────────────────────── */}
        <div className="bg-white rounded-xl border border-ink-100 p-5">
          <h3 className="text-[14px] font-semibold text-ink-900 mb-4 flex items-center gap-2">
            <GraduationCap className="w-4 h-4 text-purple-500" />
            Probation reviews due
          </h3>
          {probationLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-12 bg-ink-100 animate-pulse rounded-lg" />
              ))}
            </div>
          ) : probationReviews.length === 0 ? (
            <p className="text-[13px] text-ink-400">No pending probation reviews.</p>
          ) : (
            <div className="space-y-3">
              {probationReviews.map((r) => (
                <div key={r.id} className="flex items-center justify-between p-3 bg-ink-25 rounded-lg">
                  <div>
                    <p className="text-[13px] font-medium text-ink-900">{r.profile.fullName}</p>
                    <p className="text-[11px] text-ink-400">{r.reviewType} review | Due {formatDate(r.scheduledDate)}</p>
                  </div>
                  <div>
                    {daysUntil(r.scheduledDate) < 0 ? (
                      <span className="text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-red-50 text-red-600">Overdue</span>
                    ) : daysUntil(r.scheduledDate) <= 7 ? (
                      <span className="text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-600">Due soon</span>
                    ) : (
                      <span className="text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-600">{daysUntil(r.scheduledDate)} days</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Recent joiners ─────────────────────────────────── */}
        {recentJoiners.length > 0 && (
          <div className="bg-white rounded-xl border border-ink-100 p-5">
            <h3 className="text-[14px] font-semibold text-ink-900 mb-4">Recent joiners (last 90 days)</h3>
            <div className="space-y-2">
              {recentJoiners.map((emp) => (
                <div key={emp.id} className="flex items-center justify-between py-2 border-b border-ink-50 last:border-0">
                  <div>
                    <p className="text-[13px] font-medium text-ink-900">{emp.fullName}</p>
                    <p className="text-[11px] text-ink-400">{emp.jobTitle ?? 'No role'}</p>
                  </div>
                  <span className="text-[12px] text-ink-500">{formatDate(emp.startDate)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── 30/60/90 check-in framework ────────────────────── */}
        <div className="bg-white rounded-xl border border-ink-100 p-5">
          <h3 className="text-[14px] font-semibold text-ink-900 mb-4">30 / 60 / 90 Day Check-in Framework</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 bg-blue-50 rounded-lg">
              <p className="text-[13px] font-semibold text-blue-800">30-day</p>
              <ul className="text-[11px] text-blue-700 mt-2 space-y-1 list-disc list-inside">
                <li>Settling in and comfort level</li>
                <li>Understanding of role and team</li>
                <li>Initial training progress</li>
                <li>Any concerns or blockers</li>
              </ul>
            </div>
            <div className="p-4 bg-purple-50 rounded-lg">
              <p className="text-[13px] font-semibold text-purple-800">60-day</p>
              <ul className="text-[11px] text-purple-700 mt-2 space-y-1 list-disc list-inside">
                <li>Contributing to projects</li>
                <li>Building working relationships</li>
                <li>Technical competency progress</li>
                <li>Feedback on processes</li>
              </ul>
            </div>
            <div className="p-4 bg-emerald-50 rounded-lg">
              <p className="text-[13px] font-semibold text-emerald-800">90-day</p>
              <ul className="text-[11px] text-emerald-700 mt-2 space-y-1 list-disc list-inside">
                <li>Independent work capability</li>
                <li>Probation objectives review</li>
                <li>Confirmation / extension decision</li>
                <li>Development plan for next 6 months</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    )
  }

  /* ================================================================
     RENDER — Reports Tab
     ================================================================ */

  function renderReportsTab() {
    return (
      <div className="space-y-6">
        {/* ── Summary metrics ────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          <MetricCard icon={Users} iconColor="text-ink-400" iconBg="bg-ink-50" label="Total headcount" value={metrics.totalEmployees} />
          <MetricCard icon={UserCheck} iconColor="text-emerald-500" iconBg="bg-emerald-50" label="Active" value={metrics.activeEmployees} />
          <MetricCard icon={BarChart3} iconColor="text-blue-500" iconBg="bg-blue-50" label="Utilisation" value={`${metrics.avgUtilisation}%`} />
          <MetricCard icon={Briefcase} iconColor="text-purple-500" iconBg="bg-purple-50" label="Capacity (weekly)" value={`${metrics.totalCapacityHours}h`} />
        </div>

        {/* ── Capacity by office ──────────────────────────────── */}
        {data!.byOffice.length > 0 && (
          <div className="bg-white rounded-xl border border-ink-100 p-5">
            <h3 className="text-[14px] font-semibold text-ink-900 mb-4 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-ink-400" /> Capacity by Office
            </h3>
            <div className="space-y-3">
              {data!.byOffice.map((office) => {
                const capacity = office.count * 40
                return (
                  <div key={office.name}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[13px] text-ink-700">{office.name}</span>
                      <span className="text-[12px] text-ink-500">{office.count} people | {capacity}h/week</span>
                    </div>
                    <div className="w-full bg-ink-100 rounded-full h-2">
                      <div
                        className="bg-blue-500 h-2 rounded-full"
                        style={{ width: `${Math.min((office.count / metrics.activeEmployees) * 100, 100)}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ── Skills matrix placeholder ───────────────────────── */}
        <div className="bg-white rounded-xl border border-ink-100 p-5">
          <h3 className="text-[14px] font-semibold text-ink-900 mb-4 flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-ink-400" /> Skills Matrix
          </h3>
          <div className="text-center py-8">
            <GraduationCap className="w-10 h-10 text-ink-200 mx-auto mb-3" />
            <p className="text-[13px] text-ink-500">Skills matrix will populate as employees record their professional skills, software proficiencies, and memberships.</p>
            <p className="text-[11px] text-ink-400 mt-2">Assign skills via employee profiles or bulk import.</p>
          </div>
        </div>

        {/* ── Training/membership expiry ──────────────────────── */}
        <div className="bg-white rounded-xl border border-ink-100 p-5">
          <h3 className="text-[14px] font-semibold text-ink-900 mb-4 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-500" /> Training & Membership Expiry
          </h3>
          {data!.expiringDocs.length > 0 ? (
            <div className="space-y-2">
              {data!.expiringDocs.map((doc) => (
                <div key={doc.id} className="flex items-center justify-between py-2 border-b border-ink-50 last:border-0">
                  <div>
                    <p className="text-[13px] text-ink-900">{doc.profile.fullName}</p>
                    <p className="text-[11px] text-ink-400">{DOC_TYPE_LABELS[doc.documentType] ?? doc.documentType}: {doc.title}</p>
                  </div>
                  <div className="text-right">
                    <p className={`text-[12px] font-medium ${daysUntil(doc.expiryDate) <= 14 ? 'text-red-600' : 'text-amber-600'}`}>
                      {daysUntil(doc.expiryDate)} days
                    </p>
                    <p className="text-[11px] text-ink-400">{formatDate(doc.expiryDate)}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[13px] text-ink-400">No training or memberships expiring within 60 days.</p>
          )}
        </div>

        {/* ── Leave impact ────────────────────────────────────── */}
        <div className="bg-white rounded-xl border border-ink-100 p-5">
          <h3 className="text-[14px] font-semibold text-ink-900 mb-4 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-blue-500" /> Leave Impact
          </h3>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-4 bg-ink-25 rounded-lg">
              <p className="text-[20px] font-semibold text-ink-900">{metrics.pendingLeave}</p>
              <p className="text-[11px] text-ink-400 mt-1">Pending approval</p>
            </div>
            <div className="text-center p-4 bg-ink-25 rounded-lg">
              <p className="text-[20px] font-semibold text-ink-900">{metrics.leaveNext30}</p>
              <p className="text-[11px] text-ink-400 mt-1">Off in 30 days</p>
            </div>
            <div className="text-center p-4 bg-ink-25 rounded-lg">
              <p className="text-[20px] font-semibold text-ink-900">{metrics.leaveNext60}</p>
              <p className="text-[11px] text-ink-400 mt-1">Off in 60 days</p>
            </div>
          </div>
        </div>

        {/* ── Export placeholder ──────────────────────────────── */}
        <div className="bg-white rounded-xl border border-ink-100 p-5 text-center">
          <Wrench className="w-8 h-8 text-ink-200 mx-auto mb-3" />
          <p className="text-[13px] font-medium text-ink-700">Report Export</p>
          <p className="text-[11px] text-ink-400 mt-1">CSV and PDF export for capacity, utilisation, and skills reports will be available in a future release.</p>
        </div>
      </div>
    )
  }

  /* ================================================================
     MAIN RENDER
     ================================================================ */

  return (
    <div className="space-y-6">
      {/* ── Header ──────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[20px] sm:text-[22px] font-semibold text-ink-900">Staffing</h1>
          <p className="text-[13px] text-ink-400 mt-1">
            {metrics.activeEmployees} active employee{metrics.activeEmployees !== 1 ? 's' : ''} &middot; People management and resource planning
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchData}
            className="p-2 rounded-lg hover:bg-ink-50 transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4 text-ink-400" />
          </button>
        </div>
      </div>

      {/* ── Tabs ────────────────────────────────────────────── */}
      <div className="border-b border-ink-100 overflow-x-auto">
        <div className="flex gap-0 min-w-max">
          {TABS.map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.key
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 px-4 py-3 text-[13px] font-medium border-b-2 transition-colors whitespace-nowrap ${
                  isActive
                    ? 'border-ink-900 text-ink-900'
                    : 'border-transparent text-ink-400 hover:text-ink-600 hover:border-ink-200'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Tab content ─────────────────────────────────────── */}
      {activeTab === 'people' && renderPeopleTab()}
      {activeTab === 'resource-plan' && renderResourcePlanTab()}
      {activeTab === 'leave-admin' && renderLeaveAdminTab()}
      {activeTab === 'onboarding' && renderOnboardingTab()}
      {activeTab === 'reports' && renderReportsTab()}
    </div>
  )
}

/* ================================================================
   SUB-COMPONENTS
   ================================================================ */

function MetricCard({
  icon: Icon,
  iconColor,
  iconBg,
  label,
  value,
}: {
  icon: React.ElementType
  iconColor: string
  iconBg: string
  label: string
  value: string | number
}) {
  return (
    <div className="bg-white rounded-xl border border-ink-100 p-4">
      <div className="flex items-center gap-2 mb-2">
        <div className={`w-8 h-8 rounded-lg ${iconBg} flex items-center justify-center`}>
          <Icon className={`w-4 h-4 ${iconColor}`} />
        </div>
      </div>
      <p className="text-[20px] font-semibold text-ink-900">{value}</p>
      <p className="text-[11px] text-ink-400 mt-0.5">{label}</p>
    </div>
  )
}

function EmptyState({ icon: Icon, title, description }: { icon: React.ElementType; title: string; description: string }) {
  return (
    <div className="bg-white rounded-xl border border-ink-100 p-12 text-center">
      <Icon className="w-12 h-12 text-ink-200 mx-auto mb-4" />
      <p className="text-[15px] font-medium text-ink-700">{title}</p>
      <p className="text-[12px] text-ink-400 mt-2 max-w-md mx-auto">{description}</p>
    </div>
  )
}

/* ── Employee Detail Panel ─────────────────────────────────────── */

const DETAIL_SECTIONS = [
  { key: 'overview', label: 'Overview', icon: Users },
  { key: 'projects', label: 'Projects', icon: Briefcase },
  { key: 'documents', label: 'Documents', icon: FileText },
  { key: 'training', label: 'Training & CPD', icon: GraduationCap },
  { key: 'assets', label: 'Equipment', icon: Wrench },
  { key: 'allocations', label: 'Allocations', icon: BarChart3 },
  { key: 'probation', label: 'Probation', icon: ClipboardList },
]

function EmployeeDetailPanel({
  detail,
  loading,
  section,
  onSectionChange,
  onClose,
}: {
  detail: EmployeeDetail | null
  loading: boolean
  section: string
  onSectionChange: (s: string) => void
  onClose: () => void
}) {
  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-ink-100 p-6 space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-6 bg-ink-100 animate-pulse rounded" />
        ))}
      </div>
    )
  }

  if (!detail) {
    return (
      <div className="bg-white rounded-xl border border-ink-100 p-6 text-center">
        <p className="text-[13px] text-ink-400">Unable to load employee details</p>
      </div>
    )
  }

  const { employee: emp } = detail

  return (
    <div className="bg-white rounded-xl border border-ink-100 overflow-hidden">
      {/* ── Header ──────────────────────────────────────────── */}
      <div className="px-6 py-4 border-b border-ink-100 flex items-center justify-between">
        <div>
          <h2 className="text-[16px] font-semibold text-ink-900">{emp.fullName}</h2>
          <p className="text-[12px] text-ink-400">{emp.jobTitle ?? 'No role'} | {emp.office?.name ?? 'No office'}</p>
        </div>
        <button onClick={onClose} className="p-2 rounded-lg hover:bg-ink-50 transition-colors">
          <X className="w-4 h-4 text-ink-400" />
        </button>
      </div>

      {/* ── Section tabs ────────────────────────────────────── */}
      <div className="border-b border-ink-100 overflow-x-auto">
        <div className="flex gap-0 px-4 min-w-max">
          {DETAIL_SECTIONS.map((s) => {
            const Icon = s.icon
            return (
              <button
                key={s.key}
                onClick={() => onSectionChange(s.key)}
                className={`flex items-center gap-1.5 px-3 py-2.5 text-[12px] font-medium border-b-2 transition-colors whitespace-nowrap ${
                  section === s.key
                    ? 'border-ink-900 text-ink-900'
                    : 'border-transparent text-ink-400 hover:text-ink-600'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {s.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Section content ─────────────────────────────────── */}
      <div className="p-6">
        {section === 'overview' && <OverviewSection detail={detail} />}
        {section === 'projects' && <ProjectsSection detail={detail} />}
        {section === 'documents' && <DocumentsSection detail={detail} />}
        {section === 'training' && <TrainingSection detail={detail} />}
        {section === 'assets' && <AssetsSection detail={detail} />}
        {section === 'allocations' && <AllocationsSection detail={detail} />}
        {section === 'probation' && <ProbationSection detail={detail} />}
      </div>
    </div>
  )
}

/* ── Overview Section ──────────────────────────────────────────── */

function OverviewSection({ detail }: { detail: EmployeeDetail }) {
  const { employee: emp } = detail

  return (
    <div className="space-y-5">
      {/* Personal & contact */}
      <div>
        <h4 className="text-[12px] font-semibold text-ink-400 uppercase tracking-wide mb-3">Personal & Contact</h4>
        <div className="grid grid-cols-2 gap-3 text-[13px]">
          <InfoRow label="Email" value={emp.email} />
          <InfoRow label="Phone" value={emp.phone ?? '-'} />
          <InfoRow label="Status" value={STATUS_COLORS[emp.status]?.label ?? emp.status} />
          <InfoRow label="Permission" value={emp.orgPermission} />
          <InfoRow label="Start date" value={formatDate(emp.startDate)} />
          <InfoRow label="Qualification" value={emp.qualificationPathway ?? '-'} />
        </div>
      </div>

      {/* Office, dept, role, manager */}
      <div>
        <h4 className="text-[12px] font-semibold text-ink-400 uppercase tracking-wide mb-3">Organisation</h4>
        <div className="grid grid-cols-2 gap-3 text-[13px]">
          <InfoRow label="Office" value={emp.office ? `${emp.office.name}, ${emp.office.city}` : '-'} />
          <InfoRow label="Role" value={emp.role?.title ?? '-'} />
          <InfoRow label="Department" value={emp.role?.department ?? '-'} />
          <InfoRow label="Level" value={emp.role?.level ?? '-'} />
          <InfoRow label="Manager" value={emp.manager?.fullName ?? '-'} />
          <InfoRow label="Leave allocation" value={`${emp.leaveAllocation} days`} />
        </div>
      </div>

      {/* Emergency contact */}
      {emp.emergencyContact && (
        <div>
          <h4 className="text-[12px] font-semibold text-ink-400 uppercase tracking-wide mb-3">Emergency Contact</h4>
          <div className="grid grid-cols-2 gap-3 text-[13px]">
            <InfoRow label="Name" value={emp.emergencyContact.name ?? '-'} />
            <InfoRow label="Phone" value={emp.emergencyContact.phone ?? '-'} />
            <InfoRow label="Relation" value={emp.emergencyContact.relation ?? '-'} />
          </div>
        </div>
      )}

      {/* Leave balances */}
      {detail.leaveBalances.length > 0 && (
        <div>
          <h4 className="text-[12px] font-semibold text-ink-400 uppercase tracking-wide mb-3">Leave Balances</h4>
          <div className="space-y-2">
            {detail.leaveBalances.map((lb) => (
              <div key={lb.id} className="flex items-center justify-between text-[12px] py-1 border-b border-ink-50">
                <span className="text-ink-600">{lb.year}</span>
                <span className="text-ink-900">
                  {lb.used} used / {lb.entitlement} total ({lb.remaining} remaining)
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/* ── Projects Section ──────────────────────────────────────────── */

function ProjectsSection({ detail }: { detail: EmployeeDetail }) {
  if (detail.projects.length === 0) {
    return <p className="text-[13px] text-ink-400">No project assignments.</p>
  }
  return (
    <div className="space-y-2">
      {detail.projects.map((p) => {
        const statusColor = p.project.status === 'ACTIVE' ? 'text-emerald-600 bg-emerald-50' : 'text-ink-500 bg-ink-50'
        return (
          <div key={p.membershipId} className="flex items-center justify-between p-3 bg-ink-25 rounded-lg">
            <div>
              <p className="text-[13px] font-medium text-ink-900">
                {p.project.code ? `${p.project.code} — ` : ''}{p.project.name}
              </p>
              <p className="text-[11px] text-ink-400">
                {p.role ?? 'Team member'} | {p.project.stage}
              </p>
            </div>
            <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${statusColor}`}>
              {p.project.status}
            </span>
          </div>
        )
      })}
    </div>
  )
}

/* ── Documents Section ─────────────────────────────────────────── */

function DocumentsSection({ detail }: { detail: EmployeeDetail }) {
  if (detail.hrDocuments.length === 0) {
    return (
      <div className="text-center py-6">
        <FileText className="w-8 h-8 text-ink-200 mx-auto mb-2" />
        <p className="text-[13px] text-ink-400">No HR documents on file.</p>
        <p className="text-[11px] text-ink-400 mt-1">Documents can be added by admins from the HR documents section.</p>
      </div>
    )
  }
  return (
    <div className="space-y-2">
      {detail.hrDocuments.map((doc) => {
        const isExpiring = doc.expiryDate && daysUntil(doc.expiryDate) <= 60 && daysUntil(doc.expiryDate) > 0
        const isExpired = doc.expiryDate && daysUntil(doc.expiryDate) <= 0
        return (
          <div key={doc.id} className="flex items-center justify-between p-3 bg-ink-25 rounded-lg">
            <div className="flex items-center gap-3">
              <FileText className="w-4 h-4 text-ink-400 shrink-0" />
              <div>
                <p className="text-[13px] font-medium text-ink-900">{doc.title}</p>
                <p className="text-[11px] text-ink-400">
                  {DOC_TYPE_LABELS[doc.documentType] ?? doc.documentType}
                  {doc.isConfidential && ' | Confidential'}
                  {doc.expiryDate && ` | Expires ${formatDate(doc.expiryDate)}`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isExpired && (
                <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-red-50 text-red-600">Expired</span>
              )}
              {isExpiring && (
                <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-600">Expiring</span>
              )}
              {doc.acknowledged ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              ) : (
                <span className="text-[11px] text-ink-400">Not acknowledged</span>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

/* ── Training Section ──────────────────────────────────────────── */

function TrainingSection({ detail }: { detail: EmployeeDetail }) {
  return (
    <div className="space-y-6">
      {/* Training completions */}
      <div>
        <h4 className="text-[12px] font-semibold text-ink-400 uppercase tracking-wide mb-3">Training completions</h4>
        {detail.training.length === 0 ? (
          <p className="text-[13px] text-ink-400">No training records.</p>
        ) : (
          <div className="space-y-2">
            {detail.training.map((t) => (
              <div key={t.id} className="flex items-center justify-between py-2 border-b border-ink-50">
                <div>
                  <p className="text-[13px] text-ink-900">{t.module.title}</p>
                  <p className="text-[11px] text-ink-400">{t.module.category ?? 'General'}</p>
                </div>
                <span className="text-[12px] text-ink-500">{formatDate(t.completedAt)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* CPD records */}
      <div>
        <h4 className="text-[12px] font-semibold text-ink-400 uppercase tracking-wide mb-3">CPD Records</h4>
        {detail.cpd.length === 0 ? (
          <p className="text-[13px] text-ink-400">No CPD records.</p>
        ) : (
          <div className="space-y-2">
            {detail.cpd.map((c) => (
              <div key={c.id} className="flex items-center justify-between py-2 border-b border-ink-50">
                <div>
                  <p className="text-[13px] text-ink-900">{c.title}</p>
                  <p className="text-[11px] text-ink-400">{c.provider ?? 'Self-directed'} | {c.hours}h</p>
                </div>
                <span className="text-[12px] text-ink-500">{formatDate(c.activityDate)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

/* ── Assets Section ────────────────────────────────────────────── */

function AssetsSection({ detail }: { detail: EmployeeDetail }) {
  if (detail.assets.length === 0) {
    return (
      <div className="text-center py-6">
        <Wrench className="w-8 h-8 text-ink-200 mx-auto mb-2" />
        <p className="text-[13px] text-ink-400">No equipment assigned.</p>
      </div>
    )
  }
  return (
    <div className="space-y-2">
      {detail.assets.map((a) => (
        <div key={a.id} className="flex items-center justify-between p-3 bg-ink-25 rounded-lg">
          <div>
            <p className="text-[13px] font-medium text-ink-900">{a.asset.name}</p>
            <p className="text-[11px] text-ink-400">
              {a.asset.category}{a.asset.assetTag ? ` | ${a.asset.assetTag}` : ''}
            </p>
          </div>
        </div>
      ))}
    </div>
  )
}

/* ── Allocations Section ───────────────────────────────────────── */

function AllocationsSection({ detail }: { detail: EmployeeDetail }) {
  if (detail.allocations.length === 0) {
    return (
      <div className="text-center py-6">
        <BarChart3 className="w-8 h-8 text-ink-200 mx-auto mb-2" />
        <p className="text-[13px] text-ink-400">No resource allocations recorded.</p>
        <p className="text-[11px] text-ink-400 mt-1">Allocations are managed from the Resource Plan tab.</p>
      </div>
    )
  }
  return (
    <div className="space-y-2">
      {detail.allocations.map((a) => (
        <div key={a.id} className="flex items-center justify-between p-3 bg-ink-25 rounded-lg">
          <div>
            <p className="text-[13px] font-medium text-ink-900">
              {a.project.code ? `${a.project.code} — ` : ''}{a.project.name}
            </p>
            <p className="text-[11px] text-ink-400">
              w/c {formatWeek(a.weekStarting)} | {a.role ?? 'General'}
            </p>
          </div>
          <span className={`text-[13px] font-medium ${a.hoursAllocated > 40 ? 'text-red-600' : 'text-ink-900'}`}>
            {a.hoursAllocated}h
          </span>
        </div>
      ))}
    </div>
  )
}

/* ── Probation Section ─────────────────────────────────────────── */

function ProbationSection({ detail }: { detail: EmployeeDetail }) {
  if (detail.probationReviews.length === 0) {
    return (
      <div className="text-center py-6">
        <ClipboardList className="w-8 h-8 text-ink-200 mx-auto mb-2" />
        <p className="text-[13px] text-ink-400">No probation reviews scheduled.</p>
        <p className="text-[11px] text-ink-400 mt-1">Probation reviews are created by admins from the Onboarding tab.</p>
      </div>
    )
  }
  return (
    <div className="space-y-3">
      {detail.probationReviews.map((r) => {
        const isComplete = !!r.completedDate
        const isOverdue = !isComplete && daysUntil(r.scheduledDate) < 0
        return (
          <div key={r.id} className="p-4 bg-ink-25 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[13px] font-medium text-ink-900">{r.reviewType} review</p>
              {isComplete ? (
                <span className={`text-[11px] font-medium px-2.5 py-0.5 rounded-full ${
                  r.outcome === 'Pass' ? 'bg-emerald-50 text-emerald-600' :
                  r.outcome === 'Fail' ? 'bg-red-50 text-red-600' :
                  'bg-amber-50 text-amber-600'
                }`}>
                  {r.outcome ?? 'Completed'}
                </span>
              ) : isOverdue ? (
                <span className="text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-red-50 text-red-600">Overdue</span>
              ) : (
                <span className="text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-600">Scheduled</span>
              )}
            </div>
            <div className="text-[12px] text-ink-500 space-y-1">
              <p>Scheduled: {formatDate(r.scheduledDate)}</p>
              {r.completedDate && <p>Completed: {formatDate(r.completedDate)}</p>}
              {r.objectives && <p className="mt-2 text-ink-600">Objectives: {r.objectives}</p>}
              {r.feedback && <p className="text-ink-600">Feedback: {r.feedback}</p>}
            </div>
          </div>
        )
      })}
    </div>
  )
}

/* ── Info Row Helper ───────────────────────────────────────────── */

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] text-ink-400">{label}</p>
      <p className="text-[13px] text-ink-900">{value}</p>
    </div>
  )
}

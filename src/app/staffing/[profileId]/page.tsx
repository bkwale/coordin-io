'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  ArrowLeft, User, Briefcase, Calendar, BarChart3, GraduationCap,
  Wrench, FileText, ChevronDown, ChevronRight, AlertTriangle,
  RefreshCw, Mail, Phone, MapPin, Shield, Clock, Heart,
  Building2, Users, Pencil, X, Save, Loader2, Plus, ExternalLink,
  Upload, Lock, Award, AlertCircle, Link2, Send,
} from 'lucide-react'
import { SkeletonRow } from '@/components/Skeleton'
import { useToast } from '@/components/Toast'

/* ================================================================
   TYPES
   ================================================================ */

interface EmployeeProfileData {
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
    department: string | null
    availabilityStatus: string | null
    emergencyContact: { name: string | null; phone: string | null; relation: string | null } | null
  }
  employment: {
    contractType: string | null
    employmentType: string | null
    probationLength: number | null
    probationStatus: string | null
    probationStartDate: string | null
    probationEndDate: string | null
    salary: number | null
    salaryFrequency: string | null
    salaryCurrency: string | null
    benefits: string | null
    hmoProvider: string | null
    hmoPlan: string | null
    dependants: number | null
    pensionProvider: string | null
    pensionContribution: number | null
    workingPattern: string | null
    workingHours: number | null
    noticePeriod: string | null
  } | null
  leave: {
    annualEntitlement: number
    used: number
    pending: number
    remaining: number
    sicknessCount: number
  }
  projects: {
    membershipId: string
    role: string | null
    project: { id: string; name: string; code: string | null; status: string; stage: string }
    weeklyHours: number | null
  }[]
  capacity: {
    totalAllocatedHours: number
    standardWeeklyHours: number
    availableCapacity: number
  }
  training: {
    mandatoryComplete: number
    totalCompletions: number
    cpdHours: number
    completions: {
      id: string
      completedAt: string
      module: { id: string; title: string; category: string | null }
    }[]
  }
  assets: {
    id: string
    asset: { id: string; name: string; assetTag: string | null; category: string }
  }[]
  hrDocumentCounts: Record<string, number>
  isAdmin: boolean
  isSelf: boolean
}

interface TrainingRecord {
  id: string
  title: string
  provider: string | null
  category: string
  description: string | null
  mandatory: boolean
  durationMinutes: number | null
  contentUrl: string | null
  cpdHours: number
  expiryDate: string | null
  renewalDate: string | null
  expiryStatus: 'current' | 'expiring' | 'expired'
  profileId: string | null
  completions: Array<{ id: string; completedAt: string | null; profileId: string }>
  completionCount: number
  createdAt: string
}

interface HRDocumentRecord {
  id: string
  profileId: string
  documentType: string
  title: string
  description: string | null
  fileUrl: string | null
  expiryDate: string | null
  isConfidential: boolean
  uploadedById: string | null
  createdAt: string
  profile?: { id: string; fullName: string; jobTitle: string | null }
}

/* ================================================================
   CONSTANTS
   ================================================================ */

const STATUS_STYLES: Record<string, { label: string; color: string; bg: string }> = {
  ACTIVE: { label: 'Active', color: 'text-emerald-600', bg: 'bg-emerald-50' },
  INVITED: { label: 'Invited', color: 'text-blue-600', bg: 'bg-blue-50' },
  ONBOARDING: { label: 'Onboarding', color: 'text-blue-600', bg: 'bg-blue-50' },
  DEACTIVATED: { label: 'Deactivated', color: 'text-ink-400', bg: 'bg-ink-50' },
}

const AVAILABILITY_STYLES: Record<string, { label: string; color: string; bg: string }> = {
  available: { label: 'Available', color: 'text-emerald-600', bg: 'bg-emerald-50' },
  partially_available: { label: 'Partially available', color: 'text-amber-600', bg: 'bg-amber-50' },
  unavailable: { label: 'Unavailable', color: 'text-red-600', bg: 'bg-red-50' },
  on_leave: { label: 'On leave', color: 'text-blue-600', bg: 'bg-blue-50' },
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
  OTHER: 'Other',
}

type SectionKey = 'overview' | 'employment' | 'leave' | 'projects' | 'training' | 'assets' | 'documents'

const SECTIONS: { key: SectionKey; label: string; icon: React.ElementType; adminOnly?: boolean }[] = [
  { key: 'overview', label: 'Overview', icon: User },
  { key: 'employment', label: 'Employment', icon: Briefcase, adminOnly: true },
  { key: 'leave', label: 'Leave & Absence', icon: Calendar },
  { key: 'projects', label: 'Projects & Capacity', icon: BarChart3 },
  { key: 'training', label: 'Training & CPD', icon: GraduationCap },
  { key: 'assets', label: 'Assets', icon: Wrench },
  { key: 'documents', label: 'Documents', icon: FileText },
]

/* ================================================================
   HELPERS
   ================================================================ */

function formatDate(iso: string | null | undefined): string {
  if (!iso) return 'Not provided'
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function displayValue(val: string | number | null | undefined): string {
  if (val === null || val === undefined || val === '') return 'Not provided'
  if (typeof val === 'number' && isNaN(val)) return 'Not provided'
  return String(val)
}

function formatCurrency(amount: number | null | undefined, currency: string | null | undefined): string {
  if (amount === null || amount === undefined) return 'Not provided'
  if (isNaN(amount)) return 'Not provided'
  const cur = currency || 'GBP'
  try {
    return new Intl.NumberFormat('en-GB', { style: 'currency', currency: cur }).format(amount)
  } catch {
    return `${cur} ${amount.toLocaleString()}`
  }
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

/* ================================================================
   MAIN COMPONENT
   ================================================================ */

export default function EmployeeProfilePage() {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const profileId = params.profileId as string

  const [data, setData] = useState<EmployeeProfileData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedSections, setExpandedSections] = useState<Set<SectionKey>>(
    new Set(['overview', 'leave', 'projects'])
  )
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editForm, setEditForm] = useState<Record<string, string | number | null>>({})
  const [sendingOnboardingEmail, setSendingOnboardingEmail] = useState(false)

  const fetchProfile = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/staffing/employees/${profileId}/profile`)
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}))
        throw new Error(errBody.error || 'Failed to load profile')
      }
      const json = await res.json()
      setData(json.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }, [profileId])

  useEffect(() => {
    fetchProfile()
  }, [fetchProfile])

  const toggleSection = (key: SectionKey) => {
    setExpandedSections((prev) => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }

  const startEditing = () => {
    if (!data) return
    const emp = data.employee
    const employment = data.employment
    setEditForm({
      phone: emp.phone ?? '',
      emergencyName: emp.emergencyContact?.name ?? '',
      emergencyPhone: emp.emergencyContact?.phone ?? '',
      emergencyRelation: emp.emergencyContact?.relation ?? '',
      availabilityStatus: emp.availabilityStatus ?? '',
      ...(data.isAdmin
        ? {
            jobTitle: emp.jobTitle ?? '',
            department: emp.department ?? '',
            contractType: employment?.contractType ?? '',
            employmentType: employment?.employmentType ?? '',
            salary: employment?.salary ?? '',
            salaryFrequency: employment?.salaryFrequency ?? '',
            salaryCurrency: employment?.salaryCurrency ?? '',
            benefits: employment?.benefits ?? '',
            hmoProvider: employment?.hmoProvider ?? '',
            hmoPlan: employment?.hmoPlan ?? '',
            dependants: employment?.dependants ?? '',
            pensionProvider: employment?.pensionProvider ?? '',
            pensionContribution: employment?.pensionContribution ?? '',
            workingPattern: employment?.workingPattern ?? '',
            workingHours: employment?.workingHours ?? '',
            noticePeriod: employment?.noticePeriod ?? '',
            probationLength: employment?.probationLength ?? '',
            probationStatus: employment?.probationStatus ?? '',
            probationStartDate: employment?.probationStartDate
              ? new Date(employment.probationStartDate).toISOString().split('T')[0]
              : '',
            probationEndDate: employment?.probationEndDate
              ? new Date(employment.probationEndDate).toISOString().split('T')[0]
              : '',
          }
        : {}),
    })
    setEditing(true)
  }

  const cancelEditing = () => {
    setEditing(false)
    setEditForm({})
  }

  const saveChanges = async () => {
    setSaving(true)
    try {
      // Build the payload, only sending non-empty changed fields
      const payload: Record<string, unknown> = {}
      for (const [key, value] of Object.entries(editForm)) {
        if (value !== '' && value !== null) {
          // Convert numeric fields
          if (['salary', 'dependants', 'pensionContribution', 'workingHours', 'probationLength'].includes(key)) {
            const num = Number(value)
            if (!isNaN(num)) {
              payload[key] = num
            }
          } else {
            payload[key] = value
          }
        }
      }

      const res = await fetch(`/api/staffing/employees/${profileId}/profile`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}))
        throw new Error(errBody.error || 'Failed to save changes')
      }

      toast('Profile updated successfully', 'success')
      setEditing(false)
      setEditForm({})
      fetchProfile()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to save', 'error')
    } finally {
      setSaving(false)
    }
  }

  const sendOnboardingEmail = async () => {
    setSendingOnboardingEmail(true)
    try {
      const res = await fetch(`/api/staffing/employees/${profileId}/onboarding-email`, {
        method: 'POST',
      })
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}))
        throw new Error(errBody.error || 'Failed to send onboarding email')
      }
      toast('Onboarding email sent successfully', 'success')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to send email', 'error')
    } finally {
      setSendingOnboardingEmail(false)
    }
  }

  /* ── Loading ──────────────────────────────────────────────── */

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 bg-ink-100 animate-pulse rounded-lg" />
          <div className="h-6 w-48 bg-ink-100 animate-pulse rounded" />
        </div>
        <div className="bg-white rounded-xl border border-ink-100 p-6 space-y-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonRow key={i} />
          ))}
        </div>
      </div>
    )
  }

  /* ── Error ────────────────────────────────────────────────── */

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh] gap-4">
        <AlertTriangle className="w-8 h-8 text-red-500" />
        <p className="text-[13px] text-ink-600">{error || 'Failed to load profile'}</p>
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/staffing')}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-ink-200 text-[13px] text-ink-600 hover:bg-ink-50 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Back to staffing
          </button>
          <button
            onClick={fetchProfile}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-ink-900 text-white text-[13px] font-medium hover:bg-ink-800 transition-colors"
          >
            <RefreshCw className="w-4 h-4" /> Try again
          </button>
        </div>
      </div>
    )
  }

  const { employee: emp, employment, leave, projects, capacity, training, assets, hrDocumentCounts, isAdmin, isSelf } = data
  const canEdit = isAdmin || isSelf
  const statusStyle = STATUS_STYLES[emp.status] ?? { label: emp.status, color: 'text-ink-500', bg: 'bg-ink-100' }
  const availStyle = emp.availabilityStatus
    ? AVAILABILITY_STYLES[emp.availabilityStatus] ?? { label: emp.availabilityStatus, color: 'text-ink-500', bg: 'bg-ink-100' }
    : null

  const visibleSections = SECTIONS.filter((s) => {
    if (s.adminOnly && !isAdmin && !isSelf) return false
    return true
  })

  /* ================================================================
     RENDER
     ================================================================ */

  return (
    <div className="space-y-6">
      {/* ── Back + actions ───────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => router.push('/staffing')}
          className="flex items-center gap-2 text-[13px] text-ink-500 hover:text-ink-700 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to staffing
        </button>
        <div className="flex items-center gap-2">
          {isAdmin && (emp.status === 'ONBOARDING' || emp.status === 'INVITED') && !editing && (
            <button
              onClick={sendOnboardingEmail}
              disabled={sendingOnboardingEmail}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-blue-200 bg-blue-50 text-blue-700 text-[13px] font-medium hover:bg-blue-100 transition-colors disabled:opacity-50"
            >
              {sendingOnboardingEmail ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              {sendingOnboardingEmail ? 'Sending...' : 'Send Onboarding Email'}
            </button>
          )}
          {canEdit && !editing && (
            <button
              onClick={startEditing}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-ink-900 text-white text-[13px] font-medium hover:bg-ink-800 transition-colors"
            >
              <Pencil className="w-4 h-4" /> Edit profile
            </button>
          )}
          {editing && (
            <>
              <button
                onClick={cancelEditing}
                className="flex items-center gap-2 px-4 py-2 rounded-lg border border-ink-200 text-[13px] text-ink-600 hover:bg-ink-50 transition-colors"
              >
                <X className="w-4 h-4" /> Cancel
              </button>
              <button
                onClick={saveChanges}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-ink-900 text-white text-[13px] font-medium hover:bg-ink-800 transition-colors disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {saving ? 'Saving...' : 'Save changes'}
              </button>
            </>
          )}
          <button
            onClick={fetchProfile}
            className="p-2 rounded-lg hover:bg-ink-50 transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4 text-ink-400" />
          </button>
        </div>
      </div>

      {/* ── Profile header card ──────────────────────────────── */}
      <div className="bg-white rounded-xl border border-ink-100 p-6">
        <div className="flex items-start gap-5">
          {/* Avatar */}
          <div className="w-16 h-16 rounded-full bg-ink-100 flex items-center justify-center shrink-0">
            {emp.avatarUrl ? (
              <img src={emp.avatarUrl} alt={emp.fullName} className="w-16 h-16 rounded-full object-cover" />
            ) : (
              <span className="text-[20px] font-semibold text-ink-500">{getInitials(emp.fullName)}</span>
            )}
          </div>

          {/* Name + info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-[20px] font-semibold text-ink-900">{emp.fullName}</h1>
              <span className={`text-[11px] font-medium px-2.5 py-0.5 rounded-full ${statusStyle.bg} ${statusStyle.color}`}>
                {statusStyle.label}
              </span>
              {availStyle && (
                <span className={`text-[11px] font-medium px-2.5 py-0.5 rounded-full ${availStyle.bg} ${availStyle.color}`}>
                  {availStyle.label}
                </span>
              )}
            </div>
            <p className="text-[14px] text-ink-600 mt-1">{emp.jobTitle || 'No title'}</p>
            <p className="text-[12px] text-ink-400 mt-0.5">
              {emp.department || emp.role?.department || 'No department'}
              {emp.office ? ` | ${emp.office.name}, ${emp.office.city}` : ''}
            </p>

            {/* Quick info row */}
            <div className="flex flex-wrap items-center gap-4 mt-3 text-[12px] text-ink-500">
              <span className="flex items-center gap-1">
                <Mail className="w-3.5 h-3.5" /> {emp.email}
              </span>
              {emp.phone && (
                <span className="flex items-center gap-1">
                  <Phone className="w-3.5 h-3.5" /> {emp.phone}
                </span>
              )}
              {emp.office && (
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5" /> {emp.office.name}
                </span>
              )}
              {emp.manager && (
                <span className="flex items-center gap-1">
                  <Users className="w-3.5 h-3.5" /> {emp.manager.fullName}
                </span>
              )}
              {emp.startDate && (
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" /> Started {formatDate(emp.startDate)}
                </span>
              )}
            </div>

            {/* Emergency contact summary */}
            {emp.emergencyContact && (emp.emergencyContact.name || emp.emergencyContact.phone) && (
              <div className="mt-3 text-[11px] text-ink-400 flex items-center gap-1">
                <Heart className="w-3.5 h-3.5 text-red-400" />
                Emergency: {emp.emergencyContact.name || 'Not provided'} ({emp.emergencyContact.relation || 'Not provided'}) {emp.emergencyContact.phone || ''}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Accordion sections ───────────────────────────────── */}
      {visibleSections.map((section) => {
        const isExpanded = expandedSections.has(section.key)
        const Icon = section.icon
        return (
          <div key={section.key} className="bg-white rounded-xl border border-ink-100 overflow-hidden">
            <button
              onClick={() => toggleSection(section.key)}
              className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-ink-25 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-ink-50 flex items-center justify-center">
                  <Icon className="w-4 h-4 text-ink-500" />
                </div>
                <span className="text-[14px] font-semibold text-ink-900">{section.label}</span>
                {section.adminOnly && (
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-600">
                    HR/Admin
                  </span>
                )}
              </div>
              {isExpanded
                ? <ChevronDown className="w-4 h-4 text-ink-400" />
                : <ChevronRight className="w-4 h-4 text-ink-400" />
              }
            </button>
            {isExpanded && (
              <div className="px-6 pb-6 border-t border-ink-50">
                {section.key === 'overview' && (
                  <OverviewContent
                    data={data}
                    editing={editing}
                    editForm={editForm}
                    onEditChange={(key, val) => setEditForm((prev) => ({ ...prev, [key]: val }))}
                  />
                )}
                {section.key === 'employment' && (
                  <EmploymentContent
                    data={data}
                    editing={editing}
                    editForm={editForm}
                    onEditChange={(key, val) => setEditForm((prev) => ({ ...prev, [key]: val }))}
                  />
                )}
                {section.key === 'leave' && <LeaveContent data={data} />}
                {section.key === 'projects' && <ProjectsContent data={data} />}
                {section.key === 'training' && <TrainingContent data={data} />}
                {section.key === 'assets' && <AssetsContent data={data} />}
                {section.key === 'documents' && <DocumentsContent data={data} />}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

/* ================================================================
   SECTION COMPONENTS
   ================================================================ */

function OverviewContent({
  data,
  editing,
  editForm,
  onEditChange,
}: {
  data: EmployeeProfileData
  editing: boolean
  editForm: Record<string, string | number | null>
  onEditChange: (key: string, val: string) => void
}) {
  const { employee: emp } = data

  return (
    <div className="space-y-6 pt-4">
      {/* Personal & contact */}
      <div>
        <h4 className="text-[12px] font-semibold text-ink-400 uppercase tracking-wide mb-3">Personal & Contact</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <FieldDisplay label="Email" value={emp.email} />
          {editing ? (
            <FieldEdit
              label="Phone"
              value={String(editForm.phone ?? '')}
              onChange={(v) => onEditChange('phone', v)}
              type="tel"
            />
          ) : (
            <FieldDisplay label="Phone" value={displayValue(emp.phone)} />
          )}
          <FieldDisplay label="Status" value={STATUS_STYLES[emp.status]?.label ?? emp.status} />
          <FieldDisplay label="Permission level" value={emp.orgPermission} />
          <FieldDisplay label="Start date" value={formatDate(emp.startDate)} />
          {editing ? (
            <FieldEdit
              label="Availability"
              value={String(editForm.availabilityStatus ?? '')}
              onChange={(v) => onEditChange('availabilityStatus', v)}
              type="select"
              options={[
                { value: '', label: 'Select...' },
                { value: 'available', label: 'Available' },
                { value: 'partially_available', label: 'Partially available' },
                { value: 'unavailable', label: 'Unavailable' },
                { value: 'on_leave', label: 'On leave' },
              ]}
            />
          ) : (
            <FieldDisplay label="Availability" value={displayValue(emp.availabilityStatus)} />
          )}
        </div>
      </div>

      {/* Organisation */}
      <div>
        <h4 className="text-[12px] font-semibold text-ink-400 uppercase tracking-wide mb-3">Organisation</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <FieldDisplay label="Office" value={emp.office ? `${emp.office.name}, ${emp.office.city}` : 'Not provided'} />
          <FieldDisplay label="Role" value={displayValue(emp.role?.title)} />
          <FieldDisplay label="Department" value={displayValue(emp.department || emp.role?.department)} />
          <FieldDisplay label="Level" value={displayValue(emp.role?.level)} />
          <FieldDisplay label="Line manager" value={displayValue(emp.manager?.fullName)} />
          {editing && data.isAdmin ? (
            <FieldEdit
              label="Job title"
              value={String(editForm.jobTitle ?? '')}
              onChange={(v) => onEditChange('jobTitle', v)}
            />
          ) : (
            <FieldDisplay label="Job title" value={displayValue(emp.jobTitle)} />
          )}
        </div>
      </div>

      {/* Emergency contact */}
      <div>
        <h4 className="text-[12px] font-semibold text-ink-400 uppercase tracking-wide mb-3">Emergency Contact</h4>
        {editing ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <FieldEdit
              label="Contact name"
              value={String(editForm.emergencyName ?? '')}
              onChange={(v) => onEditChange('emergencyName', v)}
            />
            <FieldEdit
              label="Contact phone"
              value={String(editForm.emergencyPhone ?? '')}
              onChange={(v) => onEditChange('emergencyPhone', v)}
              type="tel"
            />
            <FieldEdit
              label="Relationship"
              value={String(editForm.emergencyRelation ?? '')}
              onChange={(v) => onEditChange('emergencyRelation', v)}
            />
          </div>
        ) : emp.emergencyContact ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <FieldDisplay label="Name" value={displayValue(emp.emergencyContact.name)} />
            <FieldDisplay label="Phone" value={displayValue(emp.emergencyContact.phone)} />
            <FieldDisplay label="Relationship" value={displayValue(emp.emergencyContact.relation)} />
          </div>
        ) : (
          <p className="text-[13px] text-ink-400">Not provided</p>
        )}
      </div>
    </div>
  )
}

function EmploymentContent({
  data,
  editing,
  editForm,
  onEditChange,
}: {
  data: EmployeeProfileData
  editing: boolean
  editForm: Record<string, string | number | null>
  onEditChange: (key: string, val: string) => void
}) {
  const employment = data.employment

  if (!employment) {
    return <p className="text-[13px] text-ink-400 pt-4">Employment details are only visible to HR and the employee.</p>
  }

  const renderField = (label: string, key: string, value: string, opts?: { type?: string; options?: { value: string; label: string }[] }) => {
    if (editing && data.isAdmin) {
      return (
        <FieldEdit
          label={label}
          value={String(editForm[key] ?? '')}
          onChange={(v) => onEditChange(key, v)}
          type={opts?.type}
          options={opts?.options}
        />
      )
    }
    return <FieldDisplay label={label} value={value} />
  }

  return (
    <div className="space-y-6 pt-4">
      {/* Contract */}
      <div>
        <h4 className="text-[12px] font-semibold text-ink-400 uppercase tracking-wide mb-3">Contract</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {renderField('Contract type', 'contractType', displayValue(employment.contractType), {
            type: 'select',
            options: [
              { value: '', label: 'Select...' },
              { value: 'Permanent', label: 'Permanent' },
              { value: 'Fixed-term', label: 'Fixed-term' },
              { value: 'Temporary', label: 'Temporary' },
              { value: 'Zero-hours', label: 'Zero-hours' },
            ],
          })}
          {renderField('Employment type', 'employmentType', displayValue(employment.employmentType), {
            type: 'select',
            options: [
              { value: '', label: 'Select...' },
              { value: 'Full-time', label: 'Full-time' },
              { value: 'Part-time', label: 'Part-time' },
              { value: 'Contractor', label: 'Contractor' },
            ],
          })}
          {renderField('Probation end', 'probationEndDate', formatDate(employment.probationEndDate), { type: 'date' })}
          {renderField('Notice period', 'noticePeriod', displayValue(employment.noticePeriod))}
        </div>
      </div>

      {/* Probation */}
      <div>
        <h4 className="text-[12px] font-semibold text-ink-400 uppercase tracking-wide mb-3">Probation</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {renderField('Status', 'probationStatus', displayValue(employment.probationStatus), {
            type: 'select',
            options: [
              { value: '', label: 'Select...' },
              { value: 'PROBATION', label: 'Probation' },
              { value: 'CONFIRMED', label: 'Confirmed' },
              { value: 'EXTENDED', label: 'Extended' },
              { value: 'COMPLETED', label: 'Completed' },
            ],
          })}
          {renderField('Length (months)', 'probationLength', employment.probationLength !== null && employment.probationLength !== undefined ? `${employment.probationLength} months` : 'Not provided', { type: 'number' })}
          {renderField('Start date', 'probationStartDate', formatDate(employment.probationStartDate), { type: 'date' })}
          {renderField('End date', 'probationEndDate', formatDate(employment.probationEndDate), { type: 'date' })}
        </div>
      </div>

      {/* Compensation */}
      <div>
        <h4 className="text-[12px] font-semibold text-ink-400 uppercase tracking-wide mb-3">Compensation</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {editing && data.isAdmin ? (
            <>
              <FieldEdit
                label="Salary"
                value={String(editForm.salary ?? '')}
                onChange={(v) => onEditChange('salary', v)}
                type="number"
              />
              <FieldEdit
                label="Currency"
                value={String(editForm.salaryCurrency ?? '')}
                onChange={(v) => onEditChange('salaryCurrency', v)}
                type="select"
                options={[
                  { value: '', label: 'Select...' },
                  { value: 'GBP', label: 'GBP' },
                  { value: 'NGN', label: 'NGN' },
                  { value: 'EUR', label: 'EUR' },
                  { value: 'USD', label: 'USD' },
                ]}
              />
              <FieldEdit
                label="Frequency"
                value={String(editForm.salaryFrequency ?? '')}
                onChange={(v) => onEditChange('salaryFrequency', v)}
                type="select"
                options={[
                  { value: '', label: 'Select...' },
                  { value: 'Annual', label: 'Annual' },
                  { value: 'Monthly', label: 'Monthly' },
                  { value: 'Daily', label: 'Daily' },
                  { value: 'Hourly', label: 'Hourly' },
                ]}
              />
            </>
          ) : (
            <>
              <FieldDisplay label="Salary" value={formatCurrency(employment.salary, employment.salaryCurrency)} />
              <FieldDisplay label="Frequency" value={displayValue(employment.salaryFrequency)} />
            </>
          )}
          {renderField('Benefits', 'benefits', displayValue(employment.benefits))}
        </div>
      </div>

      {/* Health & pension */}
      <div>
        <h4 className="text-[12px] font-semibold text-ink-400 uppercase tracking-wide mb-3">Health & Pension</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {renderField('HMO provider', 'hmoProvider', displayValue(employment.hmoProvider))}
          {renderField('HMO plan', 'hmoPlan', displayValue(employment.hmoPlan))}
          {renderField('Dependants', 'dependants', employment.dependants !== null && employment.dependants !== undefined ? String(employment.dependants) : 'Not provided', { type: 'number' })}
          {renderField('Pension provider', 'pensionProvider', displayValue(employment.pensionProvider))}
          {renderField('Pension contribution', 'pensionContribution', employment.pensionContribution !== null && employment.pensionContribution !== undefined ? `${employment.pensionContribution}%` : 'Not provided', { type: 'number' })}
        </div>
      </div>

      {/* Working pattern */}
      <div>
        <h4 className="text-[12px] font-semibold text-ink-400 uppercase tracking-wide mb-3">Working Pattern</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {renderField('Pattern', 'workingPattern', displayValue(employment.workingPattern), {
            type: 'select',
            options: [
              { value: '', label: 'Select...' },
              { value: 'Mon-Fri', label: 'Monday to Friday' },
              { value: 'Mon-Thu', label: 'Monday to Thursday' },
              { value: 'Flexible', label: 'Flexible' },
              { value: 'Shift', label: 'Shift' },
            ],
          })}
          {renderField('Hours per week', 'workingHours', employment.workingHours !== null && employment.workingHours !== undefined ? `${employment.workingHours}h` : 'Not provided', { type: 'number' })}
        </div>
      </div>
    </div>
  )
}

function LeaveContent({ data }: { data: EmployeeProfileData }) {
  const { leave } = data

  return (
    <div className="space-y-4 pt-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 bg-ink-25 rounded-lg text-center">
          <p className="text-[20px] font-semibold text-ink-900">{leave.annualEntitlement}</p>
          <p className="text-[11px] text-ink-400 mt-1">Annual entitlement</p>
        </div>
        <div className="p-4 bg-ink-25 rounded-lg text-center">
          <p className="text-[20px] font-semibold text-ink-900">{leave.used}</p>
          <p className="text-[11px] text-ink-400 mt-1">Days used</p>
        </div>
        <div className="p-4 bg-amber-50 rounded-lg text-center">
          <p className="text-[20px] font-semibold text-amber-700">{leave.pending}</p>
          <p className="text-[11px] text-amber-600 mt-1">Pending approval</p>
        </div>
        <div className="p-4 bg-emerald-50 rounded-lg text-center">
          <p className="text-[20px] font-semibold text-emerald-700">{leave.remaining}</p>
          <p className="text-[11px] text-emerald-600 mt-1">Available</p>
        </div>
      </div>

      {/* Leave bar */}
      <div>
        <div className="flex items-center justify-between mb-1 text-[11px] text-ink-400">
          <span>Leave usage</span>
          <span>{leave.used} of {leave.annualEntitlement} days used</span>
        </div>
        <div className="w-full bg-ink-100 rounded-full h-2.5">
          <div
            className="bg-blue-500 h-2.5 rounded-full transition-all"
            style={{ width: `${Math.min((leave.used / Math.max(leave.annualEntitlement, 1)) * 100, 100)}%` }}
          />
        </div>
      </div>

      <div className="flex items-center justify-between text-[12px] text-ink-500 pt-2">
        <span className="flex items-center gap-1">
          <Shield className="w-3.5 h-3.5 text-ink-400" />
          Sickness records: {leave.sicknessCount}
        </span>
        <a href="/leave" className="text-blue-600 hover:underline">View full leave history</a>
      </div>
    </div>
  )
}

function ProjectsContent({ data }: { data: EmployeeProfileData }) {
  const { projects, capacity } = data

  return (
    <div className="space-y-4 pt-4">
      {/* Capacity summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="p-4 bg-ink-25 rounded-lg text-center">
          <p className="text-[20px] font-semibold text-ink-900">{capacity.totalAllocatedHours}h</p>
          <p className="text-[11px] text-ink-400 mt-1">Allocated this week</p>
        </div>
        <div className="p-4 bg-ink-25 rounded-lg text-center">
          <p className="text-[20px] font-semibold text-ink-900">{capacity.standardWeeklyHours}h</p>
          <p className="text-[11px] text-ink-400 mt-1">Standard hours</p>
        </div>
        <div className={`p-4 rounded-lg text-center ${capacity.availableCapacity > 0 ? 'bg-emerald-50' : 'bg-red-50'}`}>
          <p className={`text-[20px] font-semibold ${capacity.availableCapacity > 0 ? 'text-emerald-700' : 'text-red-700'}`}>
            {capacity.availableCapacity}h
          </p>
          <p className={`text-[11px] mt-1 ${capacity.availableCapacity > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
            Available capacity
          </p>
        </div>
      </div>

      {/* Project list */}
      {projects.length === 0 ? (
        <div className="text-center py-6">
          <Briefcase className="w-8 h-8 text-ink-200 mx-auto mb-2" />
          <p className="text-[13px] text-ink-400">No current project assignments</p>
        </div>
      ) : (
        <div className="space-y-2">
          {projects.map((p) => {
            const statusColor = p.project.status === 'ACTIVE' ? 'text-emerald-600 bg-emerald-50' : 'text-ink-500 bg-ink-50'
            return (
              <div key={p.membershipId} className="flex items-center justify-between p-3 bg-ink-25 rounded-lg">
                <div>
                  <p className="text-[13px] font-medium text-ink-900">
                    {p.project.code ? `${p.project.code} - ` : ''}{p.project.name}
                  </p>
                  <p className="text-[11px] text-ink-400">
                    {p.role ?? 'Team member'} | {p.project.stage}
                    {p.weeklyHours !== null ? ` | ${p.weeklyHours}h/week` : ''}
                  </p>
                </div>
                <span className={`text-[11px] font-medium px-2.5 py-0.5 rounded-full ${statusColor}`}>
                  {p.project.status}
                </span>
              </div>
            )
          })}
        </div>
      )}

      <div className="text-right">
        <a href="/staffing" className="text-[12px] text-blue-600 hover:underline">View resource allocation</a>
      </div>
    </div>
  )
}

function TrainingContent({ data }: { data: EmployeeProfileData }) {
  const { training, isAdmin } = data
  const { toast } = useToast()
  const params = useParams()
  const profileId = params.profileId as string

  const [trainingRecords, setTrainingRecords] = useState<TrainingRecord[]>([])
  const [loadingRecords, setLoadingRecords] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Add form state
  const [formTitle, setFormTitle] = useState('')
  const [formProvider, setFormProvider] = useState('')
  const [formCategory, setFormCategory] = useState('CPD')
  const [formCompletedDate, setFormCompletedDate] = useState('')
  const [formCpdHours, setFormCpdHours] = useState('')
  const [formMandatory, setFormMandatory] = useState(false)
  const [formCertificateUrl, setFormCertificateUrl] = useState('')
  const [formExpiryDate, setFormExpiryDate] = useState('')
  const [formNotes, setFormNotes] = useState('')

  // Fetch training records
  const fetchRecords = useCallback(async () => {
    setLoadingRecords(true)
    try {
      const res = await fetch(`/api/staffing/training?profileId=${profileId}`)
      if (res.ok) {
        const json = await res.json()
        setTrainingRecords(json.data?.records || [])
      }
    } catch {
      // Silent fail — summary stats still visible from profile data
    } finally {
      setLoadingRecords(false)
    }
  }, [profileId])

  useEffect(() => {
    fetchRecords()
  }, [fetchRecords])

  const handleSubmit = async () => {
    if (!formTitle.trim()) {
      toast('Title is required', 'error')
      return
    }
    setSubmitting(true)
    try {
      const payload: Record<string, unknown> = {
        title: formTitle,
        provider: formProvider || undefined,
        category: formCategory,
        completedDate: formCompletedDate || undefined,
        cpdHours: formCpdHours ? parseFloat(formCpdHours) : undefined,
        isMandatory: formMandatory,
        certificateUrl: formCertificateUrl || undefined,
        expiryDate: formExpiryDate || undefined,
        notes: formNotes || undefined,
        profileId,
      }
      const res = await fetch('/api/staffing/training', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}))
        throw new Error(errBody.error || 'Failed to create training record')
      }
      toast('Training record created', 'success')
      setShowAddForm(false)
      resetForm()
      fetchRecords()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to create', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const resetForm = () => {
    setFormTitle('')
    setFormProvider('')
    setFormCategory('CPD')
    setFormCompletedDate('')
    setFormCpdHours('')
    setFormMandatory(false)
    setFormCertificateUrl('')
    setFormExpiryDate('')
    setFormNotes('')
  }

  // Calculate annual CPD hours (current year)
  const currentYear = new Date().getFullYear()
  const annualCpdHours = trainingRecords.reduce((sum, r) => {
    if (r.completions && r.completions.length > 0) {
      const yearCompletions = r.completions.filter((c: { completedAt: string | null }) => {
        if (!c.completedAt) return false
        return new Date(c.completedAt).getFullYear() === currentYear
      })
      if (yearCompletions.length > 0) return sum + (r.cpdHours || 0)
    }
    return sum
  }, 0)

  // Categorize records by expiry status
  const expiringRecords = trainingRecords.filter((r) => r.expiryStatus === 'expiring')
  const expiredRecords = trainingRecords.filter((r) => r.expiryStatus === 'expired')

  const CATEGORY_STYLES: Record<string, { label: string; color: string; bg: string }> = {
    MANDATORY: { label: 'Mandatory', color: 'text-red-600', bg: 'bg-red-50' },
    PROFESSIONAL: { label: 'Professional', color: 'text-blue-600', bg: 'bg-blue-50' },
    CPD: { label: 'CPD', color: 'text-violet-600', bg: 'bg-violet-50' },
    HEALTH_SAFETY: { label: 'Health & Safety', color: 'text-amber-600', bg: 'bg-amber-50' },
    COMPLIANCE: { label: 'Compliance', color: 'text-emerald-600', bg: 'bg-emerald-50' },
  }

  return (
    <div className="space-y-4 pt-4">
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 bg-ink-25 rounded-lg text-center">
          <p className="text-[20px] font-semibold text-ink-900">{training.mandatoryComplete}</p>
          <p className="text-[11px] text-ink-400 mt-1">Mandatory complete</p>
        </div>
        <div className="p-4 bg-ink-25 rounded-lg text-center">
          <p className="text-[20px] font-semibold text-ink-900">{training.totalCompletions}</p>
          <p className="text-[11px] text-ink-400 mt-1">Total completions</p>
        </div>
        <div className="p-4 bg-ink-25 rounded-lg text-center">
          <p className="text-[20px] font-semibold text-ink-900">{training.cpdHours}</p>
          <p className="text-[11px] text-ink-400 mt-1">CPD hours (all time)</p>
        </div>
        <div className="p-4 bg-violet-50 rounded-lg text-center">
          <p className="text-[20px] font-semibold text-violet-700">{annualCpdHours}</p>
          <p className="text-[11px] text-violet-600 mt-1">CPD hours ({currentYear})</p>
        </div>
      </div>

      {/* Expiry alerts */}
      {(expiringRecords.length > 0 || expiredRecords.length > 0) && (
        <div className="space-y-2">
          {expiredRecords.map((r) => (
            <div key={r.id} className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
              <span className="text-[12px] text-red-700">
                <strong>{r.title}</strong> — expired {formatDate(r.expiryDate)}
              </span>
            </div>
          ))}
          {expiringRecords.map((r) => (
            <div key={r.id} className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg">
              <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
              <span className="text-[12px] text-amber-700">
                <strong>{r.title}</strong> — expires {formatDate(r.expiryDate)}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Add training button */}
      {isAdmin && (
        <div className="flex justify-end">
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-ink-900 text-white text-[12px] font-medium hover:bg-ink-800 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> Add Training Record
          </button>
        </div>
      )}

      {/* Add training form */}
      {showAddForm && (
        <div className="bg-ink-25 border border-ink-100 rounded-xl p-4 space-y-4">
          <h4 className="text-[13px] font-semibold text-ink-900">New Training Record</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] text-ink-400 mb-1">Title *</label>
              <input
                type="text"
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                placeholder="e.g. Fire Safety Training"
                className="w-full text-[13px] border border-ink-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-ink-900/10"
              />
            </div>
            <div>
              <label className="block text-[11px] text-ink-400 mb-1">Provider</label>
              <input
                type="text"
                value={formProvider}
                onChange={(e) => setFormProvider(e.target.value)}
                placeholder="e.g. RICS, RIBA, In-house"
                className="w-full text-[13px] border border-ink-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-ink-900/10"
              />
            </div>
            <div>
              <label className="block text-[11px] text-ink-400 mb-1">Category</label>
              <select
                value={formCategory}
                onChange={(e) => setFormCategory(e.target.value)}
                className="w-full text-[13px] border border-ink-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-ink-900/10"
              >
                <option value="MANDATORY">Mandatory</option>
                <option value="PROFESSIONAL">Professional</option>
                <option value="CPD">CPD</option>
                <option value="HEALTH_SAFETY">Health &amp; Safety</option>
                <option value="COMPLIANCE">Compliance</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] text-ink-400 mb-1">Completed date</label>
              <input
                type="date"
                value={formCompletedDate}
                onChange={(e) => setFormCompletedDate(e.target.value)}
                className="w-full text-[13px] border border-ink-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-ink-900/10"
              />
            </div>
            <div>
              <label className="block text-[11px] text-ink-400 mb-1">CPD hours</label>
              <input
                type="number"
                value={formCpdHours}
                onChange={(e) => setFormCpdHours(e.target.value)}
                placeholder="0"
                min="0"
                step="0.5"
                className="w-full text-[13px] border border-ink-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-ink-900/10"
              />
            </div>
            <div>
              <label className="block text-[11px] text-ink-400 mb-1">Expiry date</label>
              <input
                type="date"
                value={formExpiryDate}
                onChange={(e) => setFormExpiryDate(e.target.value)}
                className="w-full text-[13px] border border-ink-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-ink-900/10"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-[11px] text-ink-400 mb-1">Certificate URL</label>
              <input
                type="url"
                value={formCertificateUrl}
                onChange={(e) => setFormCertificateUrl(e.target.value)}
                placeholder="https://..."
                className="w-full text-[13px] border border-ink-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-ink-900/10"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-[11px] text-ink-400 mb-1">Notes</label>
              <textarea
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
                rows={2}
                className="w-full text-[13px] border border-ink-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-ink-900/10 resize-none"
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="training-mandatory"
                checked={formMandatory}
                onChange={(e) => setFormMandatory(e.target.checked)}
                className="w-4 h-4 rounded border-ink-300"
              />
              <label htmlFor="training-mandatory" className="text-[12px] text-ink-600">Mandatory training</label>
            </div>
          </div>
          <div className="flex items-center gap-2 justify-end pt-2">
            <button
              onClick={() => { setShowAddForm(false); resetForm() }}
              className="px-3 py-1.5 rounded-lg border border-ink-200 text-[12px] text-ink-600 hover:bg-ink-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-ink-900 text-white text-[12px] font-medium hover:bg-ink-800 transition-colors disabled:opacity-50"
            >
              {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              {submitting ? 'Saving...' : 'Save record'}
            </button>
          </div>
        </div>
      )}

      {/* Training records list */}
      {loadingRecords ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => <SkeletonRow key={i} />)}
        </div>
      ) : trainingRecords.length === 0 && training.completions.length === 0 ? (
        <div className="text-center py-6">
          <GraduationCap className="w-8 h-8 text-ink-200 mx-auto mb-2" />
          <p className="text-[13px] text-ink-400">No training records</p>
        </div>
      ) : (
        <div>
          <h4 className="text-[12px] font-semibold text-ink-400 uppercase tracking-wide mb-3">Training Records</h4>
          <div className="space-y-2">
            {trainingRecords.length > 0 ? trainingRecords.map((r) => {
              const catStyle = CATEGORY_STYLES[r.category] || { label: r.category, color: 'text-ink-500', bg: 'bg-ink-50' }
              const statusColor = r.expiryStatus === 'expired'
                ? 'border-l-red-400'
                : r.expiryStatus === 'expiring'
                  ? 'border-l-amber-400'
                  : 'border-l-emerald-400'

              return (
                <div key={r.id} className={`flex items-center justify-between p-3 bg-ink-25 rounded-lg border-l-4 ${statusColor}`}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-[13px] font-medium text-ink-900">{r.title}</p>
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${catStyle.bg} ${catStyle.color}`}>
                        {catStyle.label}
                      </span>
                      {r.mandatory && (
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-red-50 text-red-600">
                          Required
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-3 mt-1 text-[11px] text-ink-400">
                      {r.provider && <span>{r.provider}</span>}
                      {r.cpdHours > 0 && <span>{r.cpdHours} CPD hrs</span>}
                      {r.completions && r.completions.length > 0 && (
                        <span className="text-emerald-600">Completed {formatDate((r.completions[0] as { completedAt: string | null }).completedAt)}</span>
                      )}
                      {r.expiryDate && (
                        <span className={r.expiryStatus === 'expired' ? 'text-red-600' : r.expiryStatus === 'expiring' ? 'text-amber-600' : ''}>
                          {r.expiryStatus === 'expired' ? 'Expired' : 'Expires'} {formatDate(r.expiryDate)}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    {r.contentUrl && (
                      <a
                        href={r.contentUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 rounded-lg hover:bg-ink-100 transition-colors"
                        title="View certificate"
                      >
                        <Award className="w-4 h-4 text-blue-500" />
                      </a>
                    )}
                    <span className={`w-2 h-2 rounded-full shrink-0 ${
                      r.expiryStatus === 'expired' ? 'bg-red-400' :
                      r.expiryStatus === 'expiring' ? 'bg-amber-400' : 'bg-emerald-400'
                    }`} />
                  </div>
                </div>
              )
            }) : training.completions.map((t) => (
              <div key={t.id} className="flex items-center justify-between py-2 border-b border-ink-50 last:border-0">
                <div>
                  <p className="text-[13px] text-ink-900">{t.module.title}</p>
                  <p className="text-[11px] text-ink-400">{t.module.category ?? 'General'}</p>
                </div>
                <span className="text-[12px] text-ink-500">{formatDate(t.completedAt)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function AssetsContent({ data }: { data: EmployeeProfileData }) {
  const { assets } = data

  if (assets.length === 0) {
    return (
      <div className="text-center py-6 pt-4">
        <Wrench className="w-8 h-8 text-ink-200 mx-auto mb-2" />
        <p className="text-[13px] text-ink-400">No equipment currently assigned</p>
      </div>
    )
  }

  return (
    <div className="space-y-2 pt-4">
      {assets.map((a) => (
        <div key={a.id} className="flex items-center justify-between p-3 bg-ink-25 rounded-lg">
          <div className="flex items-center gap-3">
            <Wrench className="w-4 h-4 text-ink-400 shrink-0" />
            <div>
              <p className="text-[13px] font-medium text-ink-900">{a.asset.name}</p>
              <p className="text-[11px] text-ink-400">
                {a.asset.category}{a.asset.assetTag ? ` | ${a.asset.assetTag}` : ''}
              </p>
            </div>
          </div>
        </div>
      ))}
      <div className="text-right pt-2">
        <a href="/assets" className="text-[12px] text-blue-600 hover:underline">View assets page</a>
      </div>
    </div>
  )
}

function DocumentsContent({ data }: { data: EmployeeProfileData }) {
  const { hrDocumentCounts, isAdmin } = data
  const { toast } = useToast()
  const params = useParams()
  const profileId = params.profileId as string

  const [documents, setDocuments] = useState<HRDocumentRecord[]>([])
  const [loadingDocs, setLoadingDocs] = useState(false)
  const [showUploadForm, setShowUploadForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [uploading, setUploading] = useState(false)

  // Upload form state
  const [docInputMode, setDocInputMode] = useState<'upload' | 'link'>('upload')
  const [docType, setDocType] = useState('CONTRACT')
  const [docTitle, setDocTitle] = useState('')
  const [docExpiryDate, setDocExpiryDate] = useState('')
  const [docConfidential, setDocConfidential] = useState(false)
  const [uploadedFileUrl, setUploadedFileUrl] = useState('')
  const [uploadedFileName, setUploadedFileName] = useState('')
  const [linkUrl, setLinkUrl] = useState('')

  const entries = Object.entries(hrDocumentCounts)
  const totalDocs = entries.reduce((sum, [, count]) => sum + count, 0)

  // Fetch documents
  const fetchDocuments = useCallback(async () => {
    setLoadingDocs(true)
    try {
      const res = await fetch(`/api/staffing/hr-documents?profileId=${profileId}`)
      if (res.ok) {
        const json = await res.json()
        setDocuments(json.data?.documents || [])
      }
    } catch {
      // Silent fail
    } finally {
      setLoadingDocs(false)
    }
  }, [profileId])

  useEffect(() => {
    fetchDocuments()
  }, [fetchDocuments])

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('profileId', profileId)

      const res = await fetch('/api/staffing/hr-documents/upload', {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}))
        throw new Error(errBody.error || 'Upload failed')
      }

      const json = await res.json()
      setUploadedFileUrl(json.data?.url || '')
      setUploadedFileName(json.data?.fileName || file.name)
      if (!docTitle) setDocTitle(file.name.replace(/\.[^/.]+$/, ''))
      toast('File uploaded', 'success')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Upload failed', 'error')
    } finally {
      setUploading(false)
    }
  }

  const handleSubmitDocument = async () => {
    if (!docTitle.trim()) {
      toast('Title is required', 'error')
      return
    }
    if (docInputMode === 'link' && !linkUrl.trim()) {
      toast('URL is required when linking a document', 'error')
      return
    }
    setSubmitting(true)
    try {
      const payload: Record<string, unknown> = {
        profileId,
        documentType: docType,
        title: docTitle,
        expiryDate: docExpiryDate || undefined,
        isConfidential: docConfidential,
      }
      if (docInputMode === 'link') {
        payload.type = 'LINK'
        payload.url = linkUrl
      } else {
        payload.fileUrl = uploadedFileUrl || undefined
      }
      const res = await fetch('/api/staffing/hr-documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}))
        throw new Error(errBody.error || 'Failed to create document record')
      }
      toast('Document added', 'success')
      setShowUploadForm(false)
      resetDocForm()
      fetchDocuments()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to create', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const resetDocForm = () => {
    setDocInputMode('upload')
    setDocType('CONTRACT')
    setDocTitle('')
    setDocExpiryDate('')
    setDocConfidential(false)
    setUploadedFileUrl('')
    setUploadedFileName('')
    setLinkUrl('')
  }

  const DOC_TYPE_OPTIONS = [
    { value: 'CONTRACT', label: 'Contract' },
    { value: 'OFFER_LETTER', label: 'Offer Letter' },
    { value: 'RIGHT_TO_WORK', label: 'Right to Work' },
    { value: 'VISA', label: 'Visa' },
    { value: 'DBS_CHECK', label: 'DBS Check' },
    { value: 'PROFESSIONAL_MEMBERSHIP', label: 'Professional Membership' },
    { value: 'QUALIFICATION', label: 'Qualification' },
    { value: 'TRAINING_CERTIFICATE', label: 'Training Certificate' },
    { value: 'PERFORMANCE_REVIEW', label: 'Performance Review' },
    { value: 'DISCIPLINARY', label: 'Disciplinary' },
    { value: 'GRIEVANCE', label: 'Grievance' },
    { value: 'POLICY_ACKNOWLEDGEMENT', label: 'Policy Acknowledgement' },
    { value: 'OTHER', label: 'Other' },
  ]

  return (
    <div className="space-y-4 pt-4">
      {/* Summary counts */}
      {totalDocs > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {entries.slice(0, 4).map(([type, count]) => (
            <div key={type} className="p-3 bg-ink-25 rounded-lg">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-ink-400" />
                <span className="text-[13px] font-medium text-ink-900">{count}</span>
              </div>
              <p className="text-[11px] text-ink-400 mt-1">{DOC_TYPE_LABELS[type] ?? type}</p>
            </div>
          ))}
        </div>
      )}

      {/* Add document button */}
      {isAdmin && (
        <div className="flex justify-end">
          <button
            onClick={() => setShowUploadForm(!showUploadForm)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-ink-900 text-white text-[12px] font-medium hover:bg-ink-800 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> Add Document
          </button>
        </div>
      )}

      {/* Upload form */}
      {showUploadForm && (
        <div className="bg-ink-25 border border-ink-100 rounded-xl p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-[13px] font-semibold text-ink-900">Add HR Document</h4>
            <div className="flex items-center bg-ink-100 rounded-lg p-0.5">
              <button
                onClick={() => setDocInputMode('upload')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-[11px] font-medium transition-colors ${
                  docInputMode === 'upload'
                    ? 'bg-white text-ink-900 shadow-sm'
                    : 'text-ink-500 hover:text-ink-700'
                }`}
              >
                <Upload className="w-3 h-3" /> Upload File
              </button>
              <button
                onClick={() => setDocInputMode('link')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-[11px] font-medium transition-colors ${
                  docInputMode === 'link'
                    ? 'bg-white text-ink-900 shadow-sm'
                    : 'text-ink-500 hover:text-ink-700'
                }`}
              >
                <Link2 className="w-3 h-3" /> Link URL
              </button>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] text-ink-400 mb-1">Document type *</label>
              <select
                value={docType}
                onChange={(e) => setDocType(e.target.value)}
                className="w-full text-[13px] border border-ink-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-ink-900/10"
              >
                {DOC_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] text-ink-400 mb-1">Title *</label>
              <input
                type="text"
                value={docTitle}
                onChange={(e) => setDocTitle(e.target.value)}
                placeholder={docInputMode === 'link' ? 'e.g. Employment Contract (SharePoint)' : 'e.g. Employment Contract 2024'}
                className="w-full text-[13px] border border-ink-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-ink-900/10"
              />
            </div>
            <div>
              <label className="block text-[11px] text-ink-400 mb-1">Expiry date</label>
              <input
                type="date"
                value={docExpiryDate}
                onChange={(e) => setDocExpiryDate(e.target.value)}
                className="w-full text-[13px] border border-ink-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-ink-900/10"
              />
            </div>
            {docInputMode === 'upload' ? (
              <div>
                <label className="block text-[11px] text-ink-400 mb-1">File</label>
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-ink-200 text-[12px] text-ink-600 hover:bg-ink-50 transition-colors cursor-pointer">
                    {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                    {uploading ? 'Uploading...' : 'Choose file'}
                    <input
                      type="file"
                      onChange={handleFileUpload}
                      accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx"
                      className="hidden"
                    />
                  </label>
                  {uploadedFileName && (
                    <span className="text-[11px] text-emerald-600 truncate max-w-[200px]">
                      {uploadedFileName}
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <div>
                <label className="block text-[11px] text-ink-400 mb-1">URL *</label>
                <input
                  type="url"
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  placeholder="https://company.sharepoint.com/..."
                  className="w-full text-[13px] border border-ink-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-ink-900/10"
                />
              </div>
            )}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="doc-confidential"
                checked={docConfidential}
                onChange={(e) => setDocConfidential(e.target.checked)}
                className="w-4 h-4 rounded border-ink-300"
              />
              <label htmlFor="doc-confidential" className="text-[12px] text-ink-600 flex items-center gap-1">
                <Lock className="w-3 h-3" /> Confidential (HR/Admin only)
              </label>
            </div>
          </div>
          <div className="flex items-center gap-2 justify-end pt-2">
            <button
              onClick={() => { setShowUploadForm(false); resetDocForm() }}
              className="px-3 py-1.5 rounded-lg border border-ink-200 text-[12px] text-ink-600 hover:bg-ink-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmitDocument}
              disabled={submitting || uploading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-ink-900 text-white text-[12px] font-medium hover:bg-ink-800 transition-colors disabled:opacity-50"
            >
              {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              {submitting ? 'Saving...' : 'Save document'}
            </button>
          </div>
        </div>
      )}

      {/* Document list */}
      {loadingDocs ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => <SkeletonRow key={i} />)}
        </div>
      ) : documents.length === 0 ? (
        <div className="text-center py-6">
          <FileText className="w-8 h-8 text-ink-200 mx-auto mb-2" />
          <p className="text-[13px] text-ink-400">No HR documents on file</p>
          {isAdmin && (
            <p className="text-[11px] text-ink-400 mt-1">Use the Upload Document button above to add documents.</p>
          )}
        </div>
      ) : (
        <div>
          <h4 className="text-[12px] font-semibold text-ink-400 uppercase tracking-wide mb-3">Documents on File</h4>
          <div className="space-y-2">
            {documents.map((doc) => {
              const now = new Date()
              const isExpired = doc.expiryDate && new Date(doc.expiryDate) < now
              const isExpiring = doc.expiryDate && !isExpired &&
                new Date(doc.expiryDate) <= new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000)

              return (
                <div
                  key={doc.id}
                  className={`flex items-center justify-between p-3 bg-ink-25 rounded-lg border-l-4 ${
                    isExpired ? 'border-l-red-400' : isExpiring ? 'border-l-amber-400' : 'border-l-ink-200'
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-[13px] font-medium text-ink-900">{doc.title}</p>
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-blue-50 text-blue-600">
                        {DOC_TYPE_LABELS[doc.documentType] ?? doc.documentType}
                      </span>
                      {doc.isConfidential && (
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-red-50 text-red-600 flex items-center gap-0.5">
                          <Lock className="w-2.5 h-2.5" /> Confidential
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-3 mt-1 text-[11px] text-ink-400">
                      <span>Added {formatDate(doc.createdAt)}</span>
                      {doc.expiryDate && (
                        <span className={isExpired ? 'text-red-600' : isExpiring ? 'text-amber-600' : ''}>
                          {isExpired ? 'Expired' : 'Expires'} {formatDate(doc.expiryDate)}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    {doc.fileUrl && (
                      <a
                        href={doc.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-ink-100 transition-colors text-[11px] text-blue-600"
                        title="View/download document"
                      >
                        <ExternalLink className="w-3.5 h-3.5" /> View
                      </a>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

/* ================================================================
   FIELD COMPONENTS
   ================================================================ */

function FieldDisplay({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] text-ink-400">{label}</p>
      <p className="text-[13px] text-ink-900 mt-0.5">{value}</p>
    </div>
  )
}

function FieldEdit({
  label,
  value,
  onChange,
  type = 'text',
  options,
}: {
  label: string
  value: string
  onChange: (val: string) => void
  type?: string
  options?: { value: string; label: string }[]
}) {
  return (
    <div>
      <label className="block text-[11px] text-ink-400 mb-1">{label}</label>
      {type === 'select' && options ? (
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full text-[13px] border border-ink-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-ink-900/10"
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      ) : (
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full text-[13px] border border-ink-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-ink-900/10"
        />
      )}
    </div>
  )
}

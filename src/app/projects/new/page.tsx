'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { useToast } from '@/components/Toast'

// ═══════════════════════════════════════════════════════
// Static configuration — dropdown options & step metadata
// ═══════════════════════════════════════════════════════

const STEPS = [
  { number: 1, title: 'General Information', desc: 'Project name, client, and key dates' },
  { number: 2, title: 'Location', desc: 'Site address and planning authorities' },
  { number: 3, title: 'Development Type', desc: 'Build type and existing conditions' },
  { number: 4, title: 'Client & Operator', desc: 'Operator and hospitality details' },
  { number: 5, title: 'Work Stages', desc: 'Framework and stage planning' },
  { number: 6, title: 'Compliance', desc: 'Regulatory and certification requirements' },
  { number: 7, title: 'Metrics', desc: 'Areas, units, and budget (optional)' },
  { number: 8, title: 'Project Team', desc: 'Assign roles and team members' },
  { number: 9, title: 'Review', desc: 'Confirm and create project' },
]

const CLIENT_TYPES = [
  { value: 'PRIVATE', label: 'Private' },
  { value: 'DEVELOPER', label: 'Developer' },
  { value: 'CORPORATE', label: 'Corporate' },
  { value: 'HOTEL_OWNER', label: 'Hotel Owner' },
  { value: 'HOTEL_OPERATOR', label: 'Hotel Operator' },
  { value: 'GOVERNMENT', label: 'Government' },
  { value: 'INTERNAL', label: 'Internal Development' },
]

const PROJECT_TYPES = [
  { value: 'HOTEL', label: 'Hotel' },
  { value: 'RESIDENTIAL', label: 'Residential' },
  { value: 'MIXED_USE', label: 'Mixed Use' },
  { value: 'RESORT', label: 'Resort' },
  { value: 'REFURBISHMENT', label: 'Refurbishment' },
  { value: 'OFFICE_FIT_OUT', label: 'Office Fit-Out' },
]

const CURRENCIES = [
  { value: 'NGN', label: 'NGN (₦)' },
  { value: 'GBP', label: 'GBP (£)' },
  { value: 'USD', label: 'USD ($)' },
  { value: 'EUR', label: 'EUR (€)' },
]

const DEVELOPMENT_TYPES = [
  { value: 'NEW_BUILD', label: 'New Build' },
  { value: 'CONVERSION', label: 'Conversion' },
  { value: 'REFURBISHMENT', label: 'Refurbishment' },
  { value: 'EXTENSION', label: 'Extension' },
  { value: 'COMPLETION', label: 'Completion of Existing Structure' },
  { value: 'FIT_OUT', label: 'Fit-out' },
  { value: 'MIXED', label: 'Mixed Development' },
]

const MANAGEMENT_TYPES = [
  { value: 'FRANCHISE', label: 'Franchise' },
  { value: 'MANAGEMENT_CONTRACT', label: 'Management Contract' },
  { value: 'OWNER_OPERATED', label: 'Owner Operated' },
  { value: 'LEASE', label: 'Lease' },
]

const WORK_STAGE_FRAMEWORKS = [
  { value: 'RIBA', label: 'RIBA Plan of Work (0-7)' },
  { value: 'NIGERIAN_CWA', label: 'Nigerian / CWA Stages' },
  { value: 'INTERNATIONAL', label: 'International' },
  { value: 'DESIGN_BUILD', label: 'Design-and-Build' },
  { value: 'CUSTOM', label: 'Custom' },
]

const DEVELOPMENT_STATUSES = [
  { value: 'PRE_PLANNING', label: 'Pre-planning' },
  { value: 'PLANNING', label: 'Planning' },
  { value: 'DESIGN', label: 'Design' },
  { value: 'CONSTRUCTION', label: 'Construction' },
  { value: 'COMPLETED', label: 'Completed' },
]

const PROJECT_ROLES = [
  { value: 'PROJECT_LEAD', label: 'Project Lead' },
  { value: 'PROJECT_ARCHITECT', label: 'Project Architect' },
  { value: 'DESIGN_LEAD', label: 'Design Lead' },
  { value: 'SENIOR_ARCHITECT', label: 'Senior Architect' },
  { value: 'ARCHITECT', label: 'Architect' },
  { value: 'TEAM_MEMBER', label: 'Team Member' },
  { value: 'EXTERNAL_CONSULTANT', label: 'External Consultant' },
  { value: 'CONTRACTOR', label: 'Contractor' },
]

const FRAMEWORK_STAGES: Record<string, { id: string; name: string }[]> = {
  RIBA: [
    { id: '0', name: 'Stage 0 — Strategic Definition' },
    { id: '1', name: 'Stage 1 — Preparation and Briefing' },
    { id: '2', name: 'Stage 2 — Concept Design' },
    { id: '3', name: 'Stage 3 — Spatial Coordination' },
    { id: '4', name: 'Stage 4 — Technical Design' },
    { id: '5', name: 'Stage 5 — Manufacturing and Construction' },
    { id: '6', name: 'Stage 6 — Handover' },
    { id: '7', name: 'Stage 7 — Use' },
  ],
  NIGERIAN_CWA: [
    { id: 'A', name: 'Stage A — Inception and Briefing' },
    { id: 'B', name: 'Stage B — Feasibility' },
    { id: 'C', name: 'Stage C — Design Development' },
    { id: 'D', name: 'Stage D — Contract Documentation' },
    { id: 'E', name: 'Stage E — Construction' },
    { id: 'F', name: 'Stage F — Handover and Defects' },
  ],
  INTERNATIONAL: [
    { id: '1', name: 'Stage 1 — Conceptualisation' },
    { id: '2', name: 'Stage 2 — Preliminary Design' },
    { id: '3', name: 'Stage 3 — Developed Design' },
    { id: '4', name: 'Stage 4 — Detailed Design' },
    { id: '5', name: 'Stage 5 — Construction' },
    { id: '6', name: 'Stage 6 — Handover' },
  ],
  DESIGN_BUILD: [
    { id: '1', name: "Stage 1 — Employer's Requirements" },
    { id: '2', name: "Stage 2 — Contractor's Proposals" },
    { id: '3', name: 'Stage 3 — Construction' },
    { id: '4', name: 'Stage 4 — Handover' },
  ],
}

// ── Types ─────────────────────────────────────────────

interface OrgMember {
  id: string
  fullName: string
  email: string
  jobTitle?: string
}

interface TeamAssignment {
  profileId: string
  projectRole: string
}

interface ExternalConsultant {
  name: string
  organisation: string
  role: string
}

// ── Shared CSS ────────────────────────────────────────

const fieldCls = 'w-full px-3 py-2.5 border border-surface-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 bg-white'
const labelCls = 'text-[11px] text-ink-400 uppercase tracking-[0.08em] font-semibold block mb-2'

// ── Initial form state ────────────────────────────────

const INITIAL = {
  // Step 1 — General
  name: '',
  code: '',
  clientBrand: '',
  clientType: '',
  projectType: '',
  description: '',
  currency: '',
  startDate: '',
  targetCompletion: '',
  projectManagerId: '',
  // Step 2 — Location
  siteCountry: '',
  siteCountryOther: '',
  siteRegion: '',
  siteCity: '',
  siteAddress: '',
  sitePostcode: '',
  mapLatitude: '',
  mapLongitude: '',
  planningAuthority: '',
  buildingControlAuthority: '',
  // Step 3 — Development
  developmentType: '',
  existingBuildingOccupied: false as boolean,
  existingFrameRetained: false as boolean,
  constructionStarted: false as boolean,
  existingPlanningApproval: false as boolean,
  existingContractor: false as boolean,
  // Step 4 — Operator
  operatorName: '',
  operatorBrand: '',
  managementType: '',
  targetKeys: '',
  currentKeys: '',
  modelRoomRequired: false as boolean,
  operatorContact: '',
  operatorStandardVersion: '',
  // Step 5
  workStageFramework: '',
  // Step 6 — Compliance
  isBRPD: false as boolean,
  isCDM: false as boolean,
  compBuildingRegs: false as boolean,
  compPlanning: false as boolean,
  compFireSafety: false as boolean,
  compEDGE: false as boolean,
  compBREEAM: false as boolean,
  compLEED: false as boolean,
  compOperatorReqs: false as boolean,
  complianceCustom: '',
  // Step 7 — Metrics
  siteArea: '',
  grossFloorArea: '',
  netInternalArea: '',
  numberOfBlocks: '',
  numberOfFloors: '',
  numberOfUnits: '',
  parkingSpaces: '',
  accessibleParking: '',
  fohArea: '',
  bohArea: '',
  budget: '',
  developmentStatus: '',
  targetOpeningDate: '',
}

// ═══════════════════════════════════════════════════════
// Page component
// ═══════════════════════════════════════════════════════

export default function NewProjectPage() {
  const router = useRouter()
  const { toast } = useToast()

  const [step, setStep] = useState(1)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [created, setCreated] = useState(false)

  const [form, setForm] = useState(INITIAL)
  const [orgMembers, setOrgMembers] = useState<OrgMember[]>([])
  const [teamMembers, setTeamMembers] = useState<TeamAssignment[]>([])
  const [externalConsultants, setExternalConsultants] = useState<ExternalConsultant[]>([])

  // Team-add selectors (controlled)
  const [addProfileId, setAddProfileId] = useState('')
  const [addRole, setAddRole] = useState('TEAM_MEMBER')

  // ── Updater ─────────────────────────────────────────
  const update = (key: string, value: string | boolean) => {
    setForm(prev => ({ ...prev, [key]: value }) as typeof INITIAL)
    setError(null)
  }

  // ── Fetch org members ───────────────────────────────
  useEffect(() => {
    fetch('/api/settings/team')
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (d?.members) setOrgMembers(d.members) })
      .catch(() => {})
  }, [])

  // ── Derived ─────────────────────────────────────────
  const isHospitality = form.projectType === 'HOTEL' || form.projectType === 'RESORT'
  const resolvedCountry = form.siteCountry === 'OTHER' ? form.siteCountryOther : form.siteCountry
  const stages = form.workStageFramework ? FRAMEWORK_STAGES[form.workStageFramework] || [] : []

  // ── Validation ──────────────────────────────────────
  const handleNext = () => {
    if (step === 1 && !form.name.trim()) {
      setError('Project name is required')
      return
    }
    setStep(prev => Math.min(prev + 1, STEPS.length))
  }
  const handlePrev = () => setStep(prev => Math.max(prev - 1, 1))

  // ── Build payload ───────────────────────────────────
  const buildPayload = (asDraft: boolean) => {
    const p: Record<string, unknown> = {
      name: form.name.trim(),
      status: asDraft ? 'DRAFT' : 'ACTIVE',
    }

    const setStr = (k: string, v: string) => { const t = v.trim(); if (t) p[k] = t }
    const setNum = (k: string, v: string) => { const n = parseFloat(v); if (!isNaN(n)) p[k] = n }
    const setInt = (k: string, v: string) => { const n = parseInt(v, 10); if (!isNaN(n)) p[k] = n }

    // Step 1
    setStr('code', form.code)
    setStr('clientBrand', form.clientBrand)
    if (form.clientType) p.clientType = form.clientType
    if (form.projectType) p.projectType = form.projectType
    setStr('description', form.description)
    if (form.currency) p.currency = form.currency
    if (form.startDate) p.startDate = form.startDate
    if (form.targetCompletion) p.targetCompletion = form.targetCompletion

    // Step 2 — build location summary + individual fields
    const locParts = [form.siteCity, form.siteRegion, resolvedCountry].filter(Boolean)
    if (locParts.length) p.location = locParts.join(', ')
    if (resolvedCountry) p.siteCountry = resolvedCountry
    setStr('siteRegion', form.siteRegion)
    setStr('siteCity', form.siteCity)
    setStr('siteAddress', form.siteAddress)
    setStr('sitePostcode', form.sitePostcode)
    setNum('mapLatitude', form.mapLatitude)
    setNum('mapLongitude', form.mapLongitude)
    setStr('planningAuthority', form.planningAuthority)
    setStr('buildingControlAuthority', form.buildingControlAuthority)

    // Step 3
    if (form.developmentType) p.developmentType = form.developmentType

    // Step 4 — hospitality only
    if (isHospitality) {
      setStr('operatorName', form.operatorName)
      setStr('operatorBrand', form.operatorBrand)
      if (form.managementType) p.managementType = form.managementType
      setInt('targetKeys', form.targetKeys)
      setInt('currentKeys', form.currentKeys)
      if (form.modelRoomRequired) p.modelRoomRequired = true
      setStr('operatorContact', form.operatorContact)
      setStr('operatorStandardVersion', form.operatorStandardVersion)
    }

    // Step 5
    if (form.workStageFramework) p.workStageFramework = form.workStageFramework

    // Step 6
    p.isBRPD = form.isBRPD
    p.isCDM = form.isCDM
    const fw: string[] = []
    if (form.compBuildingRegs) fw.push('BUILDING_REGS')
    if (form.compPlanning) fw.push('PLANNING')
    if (form.compFireSafety) fw.push('FIRE_SAFETY')
    if (form.compEDGE) fw.push('EDGE')
    if (form.compBREEAM) fw.push('BREEAM')
    if (form.compLEED) fw.push('LEED')
    if (form.compOperatorReqs) fw.push('OPERATOR_REQS')
    if (form.complianceCustom.trim()) fw.push(form.complianceCustom.trim())
    if (fw.length) p.complianceFrameworks = fw.join(',')

    // Step 7
    setNum('siteArea', form.siteArea)
    setNum('grossFloorArea', form.grossFloorArea)
    setNum('netInternalArea', form.netInternalArea)
    setInt('numberOfBlocks', form.numberOfBlocks)
    setInt('numberOfFloors', form.numberOfFloors)
    setInt('numberOfUnits', form.numberOfUnits)
    setInt('parkingSpaces', form.parkingSpaces)
    setInt('accessibleParking', form.accessibleParking)
    setNum('fohArea', form.fohArea)
    setNum('bohArea', form.bohArea)
    setNum('budget', form.budget)
    if (form.developmentStatus) p.developmentStatus = form.developmentStatus
    if (form.targetOpeningDate) p.targetOpeningDate = form.targetOpeningDate

    return p
  }

  // ── Submit ──────────────────────────────────────────
  const handleSubmit = async (asDraft: boolean) => {
    setSubmitting(true)
    setError(null)

    try {
      const payload = buildPayload(asDraft)
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const b = await res.json().catch(() => null)
        throw new Error(b?.error || `Failed to create project (${res.status})`)
      }

      const { project } = await res.json()

      // Add team members (PM first, then extras)
      const allMembers = [...teamMembers]
      if (form.projectManagerId && !allMembers.some(m => m.profileId === form.projectManagerId)) {
        allMembers.unshift({ profileId: form.projectManagerId, projectRole: 'PROJECT_LEAD' })
      }
      for (const member of allMembers) {
        try {
          await fetch(`/api/projects/${project.id}/members`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ profileId: member.profileId, projectRole: member.projectRole }),
          })
        } catch {
          // non-blocking — continue adding other members
        }
      }

      toast(asDraft ? 'Project saved as draft' : 'Project created successfully', 'success')
      setCreated(true)
      setTimeout(() => router.push('/projects'), 1500)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setSubmitting(false)
    }
  }

  // ── Success screen ──────────────────────────────────
  if (created) {
    return (
      <div className="max-w-lg mx-auto mt-12 sm:mt-20 text-center px-4">
        <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-xl sm:text-2xl font-display text-slate-900 mb-2">Project Created</h2>
        <p className="text-sm text-slate-500">Redirecting to projects...</p>
      </div>
    )
  }

  // ── Render ──────────────────────────────────────────
  const pct = Math.round(((step - 1) / STEPS.length) * 100)

  return (
    <div className="space-y-4 sm:space-y-6 animate-fade-in">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-slate-400 pt-2 sm:pt-0">
        <Link href="/projects" className="hover:text-brand-600 transition-colors">Projects</Link>
        <span>/</span>
        <span className="text-slate-600 font-medium">New Project</span>
      </div>

      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-display text-slate-900">Create New Project</h1>
        <p className="text-sm text-slate-500 mt-1">Step {step} of {STEPS.length} — {STEPS[step - 1].title}</p>
      </div>

      {/* ── Progress bar + step indicators ───────────── */}
      <div className="card-premium p-4 sm:p-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-semibold text-ink-400 uppercase tracking-[0.1em]">Progress</span>
          <span className="text-sm font-medium text-slate-900">{pct}%</span>
        </div>
        <div className="w-full h-2 bg-surface-100 rounded-full overflow-hidden">
          <div className="h-full bg-brand-500 transition-all duration-300" style={{ width: `${pct}%` }} />
        </div>
        <div className="flex gap-1 mt-3 overflow-x-auto pb-1">
          {STEPS.map(s => (
            <button
              key={s.number}
              onClick={() => { if (s.number <= step) setStep(s.number) }}
              className={cn(
                'flex-1 min-w-0 py-1.5 rounded text-[10px] font-medium transition-all text-center truncate px-1',
                s.number === step
                  ? 'bg-brand-50 text-brand-700 border border-brand-200'
                  : s.number < step
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 cursor-pointer'
                  : 'bg-surface-50 text-slate-400 border border-surface-200'
              )}
            >
              <span className="hidden xl:inline">{s.title}</span>
              <span className="xl:hidden">{s.number}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Form body ────────────────────────────────── */}
      <div className="card-premium p-4 sm:p-6 space-y-5">
        <div>
          <h2 className="text-base sm:text-lg font-display text-slate-900">{STEPS[step - 1].title}</h2>
          <p className="text-sm text-slate-500 mt-1">{STEPS[step - 1].desc}</p>
        </div>
        <div className="border-t border-surface-200/60" />

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
        )}

        {/* ═══ Step 1 — General Information ═══════════ */}
        {step === 1 && (
          <div className="space-y-4">
            <div>
              <label className={labelCls}>Project Name *</label>
              <input type="text" value={form.name} onChange={e => update('name', e.target.value)} placeholder="e.g. Riverside House Extension" className={`${fieldCls} placeholder:text-ink-300`} autoFocus />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Project Number / Code</label>
                <input type="text" value={form.code} onChange={e => update('code', e.target.value)} placeholder="e.g. RH-2026-001" className={`${fieldCls} placeholder:text-ink-300`} />
              </div>
              <div>
                <label className={labelCls}>Client Name</label>
                <input type="text" value={form.clientBrand} onChange={e => update('clientBrand', e.target.value)} placeholder="e.g. Harris Family Trust" className={`${fieldCls} placeholder:text-ink-300`} />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Client Type</label>
                <select value={form.clientType} onChange={e => update('clientType', e.target.value)} className={fieldCls}>
                  <option value="">Select client type...</option>
                  {CLIENT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Sector / Project Type</label>
                <select value={form.projectType} onChange={e => update('projectType', e.target.value)} className={fieldCls}>
                  <option value="">Select type...</option>
                  {PROJECT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className={labelCls}>Description</label>
              <textarea value={form.description} onChange={e => update('description', e.target.value)} placeholder="Brief project overview..." rows={3} className={`${fieldCls} placeholder:text-ink-300 resize-none`} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className={labelCls}>Currency</label>
                <select value={form.currency} onChange={e => update('currency', e.target.value)} className={fieldCls}>
                  <option value="">Organisation default</option>
                  {CURRENCIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Start Date</label>
                <input type="date" value={form.startDate} onChange={e => update('startDate', e.target.value)} className={fieldCls} />
              </div>
              <div>
                <label className={labelCls}>Target Completion</label>
                <input type="date" value={form.targetCompletion} onChange={e => update('targetCompletion', e.target.value)} className={fieldCls} />
              </div>
            </div>
            {orgMembers.length > 0 && (
              <div>
                <label className={labelCls}>Project Manager</label>
                <select value={form.projectManagerId} onChange={e => update('projectManagerId', e.target.value)} className={fieldCls}>
                  <option value="">Select project manager...</option>
                  {orgMembers.map(m => <option key={m.id} value={m.id}>{m.fullName}</option>)}
                </select>
              </div>
            )}
          </div>
        )}

        {/* ═══ Step 2 — Location ══════════════════════ */}
        {step === 2 && (
          <div className="space-y-4">
            <div>
              <label className={labelCls}>Country</label>
              <select value={form.siteCountry} onChange={e => update('siteCountry', e.target.value)} className={fieldCls}>
                <option value="">Select country...</option>
                <option value="United Kingdom">United Kingdom</option>
                <option value="Nigeria">Nigeria</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
            {form.siteCountry === 'OTHER' && (
              <div>
                <label className={labelCls}>Country Name</label>
                <input type="text" value={form.siteCountryOther} onChange={e => update('siteCountryOther', e.target.value)} placeholder="Enter country name..." className={`${fieldCls} placeholder:text-ink-300`} />
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>State or Region</label>
                <input type="text" value={form.siteRegion} onChange={e => update('siteRegion', e.target.value)} placeholder="e.g. Lagos State" className={`${fieldCls} placeholder:text-ink-300`} />
              </div>
              <div>
                <label className={labelCls}>City</label>
                <input type="text" value={form.siteCity} onChange={e => update('siteCity', e.target.value)} placeholder="e.g. Lagos" className={`${fieldCls} placeholder:text-ink-300`} />
              </div>
            </div>
            <div>
              <label className={labelCls}>Full Address</label>
              <textarea value={form.siteAddress} onChange={e => update('siteAddress', e.target.value)} placeholder="Full site address..." rows={2} className={`${fieldCls} placeholder:text-ink-300 resize-none`} />
            </div>
            <div>
              <label className={labelCls}>Postcode</label>
              <input type="text" value={form.sitePostcode} onChange={e => update('sitePostcode', e.target.value)} placeholder="e.g. SW1A 1AA" className={`${fieldCls} placeholder:text-ink-300`} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Latitude (optional)</label>
                <input type="number" step="any" value={form.mapLatitude} onChange={e => update('mapLatitude', e.target.value)} placeholder="e.g. 6.5244" className={`${fieldCls} placeholder:text-ink-300`} />
              </div>
              <div>
                <label className={labelCls}>Longitude (optional)</label>
                <input type="number" step="any" value={form.mapLongitude} onChange={e => update('mapLongitude', e.target.value)} placeholder="e.g. 3.3792" className={`${fieldCls} placeholder:text-ink-300`} />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Local Planning Authority</label>
                <input
                  type="text"
                  value={form.planningAuthority}
                  onChange={e => update('planningAuthority', e.target.value)}
                  placeholder={
                    form.siteCountry === 'United Kingdom'
                      ? 'e.g. Westminster City Council'
                      : form.siteCountry === 'Nigeria'
                      ? 'e.g. Lagos State Physical Planning Permit Authority'
                      : 'Enter authority name...'
                  }
                  className={`${fieldCls} placeholder:text-ink-300`}
                />
                {form.siteCountry === 'United Kingdom' && (
                  <p className="text-[11px] text-slate-400 mt-1">UK local planning authority for this site</p>
                )}
                {form.siteCountry === 'Nigeria' && (
                  <p className="text-[11px] text-slate-400 mt-1">Nigerian state planning authority or FCT equivalent</p>
                )}
              </div>
              <div>
                <label className={labelCls}>Building Control Authority</label>
                <input
                  type="text"
                  value={form.buildingControlAuthority}
                  onChange={e => update('buildingControlAuthority', e.target.value)}
                  placeholder={
                    form.siteCountry === 'United Kingdom'
                      ? 'e.g. Approved Inspector or Local Authority'
                      : 'Enter authority name...'
                  }
                  className={`${fieldCls} placeholder:text-ink-300`}
                />
              </div>
            </div>
          </div>
        )}

        {/* ═══ Step 3 — Development Type ══════════════ */}
        {step === 3 && (
          <div className="space-y-4">
            <div>
              <label className={labelCls}>Development Type</label>
              <select value={form.developmentType} onChange={e => update('developmentType', e.target.value)} className={fieldCls}>
                <option value="">Select development type...</option>
                {DEVELOPMENT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Existing Conditions</label>
              <div className="space-y-2">
                {([
                  ['existingBuildingOccupied', 'Existing building occupied'],
                  ['existingFrameRetained', 'Existing structural frame retained'],
                  ['constructionStarted', 'Construction already started'],
                  ['existingPlanningApproval', 'Existing planning approval'],
                  ['existingContractor', 'Existing contractor'],
                ] as const).map(([key, label]) => (
                  <label key={key} className="flex items-center gap-3 p-3 border border-surface-200 rounded-lg hover:bg-surface-50 cursor-pointer transition-colors">
                    <input
                      type="checkbox"
                      checked={form[key] as boolean}
                      onChange={e => update(key, e.target.checked)}
                      className="w-4 h-4 rounded border-surface-300 text-brand-600 focus:ring-brand-500"
                    />
                    <span className="text-sm text-slate-700">{label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ═══ Step 4 — Client & Operator ═════════════ */}
        {step === 4 && (
          <div className="space-y-4">
            {isHospitality ? (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Operator Name</label>
                    <input type="text" value={form.operatorName} onChange={e => update('operatorName', e.target.value)} placeholder="e.g. Accor" className={`${fieldCls} placeholder:text-ink-300`} />
                  </div>
                  <div>
                    <label className={labelCls}>Operator Brand</label>
                    <input type="text" value={form.operatorBrand} onChange={e => update('operatorBrand', e.target.value)} placeholder="e.g. Ibis Styles" className={`${fieldCls} placeholder:text-ink-300`} />
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Management Type</label>
                  <select value={form.managementType} onChange={e => update('managementType', e.target.value)} className={fieldCls}>
                    <option value="">Select management type...</option>
                    {MANAGEMENT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Number of Keys (target)</label>
                    <input type="number" value={form.targetKeys} onChange={e => update('targetKeys', e.target.value)} placeholder="e.g. 200" className={`${fieldCls} placeholder:text-ink-300`} min={0} />
                  </div>
                  <div>
                    <label className={labelCls}>Current Keys (if existing)</label>
                    <input type="number" value={form.currentKeys} onChange={e => update('currentKeys', e.target.value)} placeholder="e.g. 150" className={`${fieldCls} placeholder:text-ink-300`} min={0} />
                  </div>
                </div>
                <label className="flex items-center gap-3 p-3 border border-surface-200 rounded-lg hover:bg-surface-50 cursor-pointer transition-colors">
                  <input type="checkbox" checked={form.modelRoomRequired} onChange={e => update('modelRoomRequired', e.target.checked)} className="w-4 h-4 rounded border-surface-300 text-brand-600 focus:ring-brand-500" />
                  <span className="text-sm text-slate-700">Model room required</span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Operator Approval Contact</label>
                    <input type="text" value={form.operatorContact} onChange={e => update('operatorContact', e.target.value)} placeholder="Name or email..." className={`${fieldCls} placeholder:text-ink-300`} />
                  </div>
                  <div>
                    <label className={labelCls}>Operator Standard Version</label>
                    <input type="text" value={form.operatorStandardVersion} onChange={e => update('operatorStandardVersion', e.target.value)} placeholder="e.g. v2024.1" className={`${fieldCls} placeholder:text-ink-300`} />
                  </div>
                </div>
              </>
            ) : (
              <div className="py-8 text-center">
                <div className="w-12 h-12 rounded-full bg-surface-100 flex items-center justify-center mx-auto mb-3">
                  <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 0h.008v.008h-.008V7.5Z" />
                  </svg>
                </div>
                <p className="text-sm text-slate-600 font-medium">Not applicable for this project type</p>
                <p className="text-xs text-slate-400 mt-1">
                  Operator and hospitality fields apply only to Hotel and Resort projects.
                </p>
              </div>
            )}
          </div>
        )}

        {/* ═══ Step 5 — Work Stages ═══════════════════ */}
        {step === 5 && (
          <div className="space-y-4">
            <div>
              <label className={labelCls}>Framework</label>
              <select value={form.workStageFramework} onChange={e => update('workStageFramework', e.target.value)} className={fieldCls}>
                <option value="">Select framework...</option>
                {WORK_STAGE_FRAMEWORKS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
              </select>
            </div>
            {stages.length > 0 && (
              <div>
                <label className={labelCls}>Stages</label>
                <div className="space-y-2">
                  {stages.map((s, i) => (
                    <div key={s.id} className={cn(
                      'flex items-center gap-3 p-3 border rounded-lg',
                      i === 0 ? 'border-brand-200 bg-brand-50/30' : 'border-surface-200',
                    )}>
                      <div className="w-8 h-8 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-xs font-bold shrink-0">
                        {s.id}
                      </div>
                      <span className="text-sm text-slate-700 flex-1">{s.name}</span>
                    </div>
                  ))}
                </div>
                <p className="text-[11px] text-slate-400 mt-2">Stage target dates can be set after project creation.</p>
              </div>
            )}
            {form.workStageFramework === 'CUSTOM' && (
              <p className="text-sm text-slate-500">Custom stage definitions can be configured after project creation.</p>
            )}
          </div>
        )}

        {/* ═══ Step 6 — Compliance ════════════════════ */}
        {step === 6 && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">Select all applicable compliance and certification requirements.</p>

            {/* BRPD + CDM — separate booleans */}
            <div className="space-y-2">
              <label className="flex items-start gap-3 p-3 border border-surface-200 rounded-lg hover:bg-surface-50 cursor-pointer transition-colors">
                <input type="checkbox" checked={form.isBRPD} onChange={e => update('isBRPD', e.target.checked)} className="w-4 h-4 rounded border-surface-300 text-brand-600 focus:ring-brand-500 mt-0.5" />
                <div>
                  <span className="text-sm text-slate-700 font-medium block">Building Regulations Principal Designer (BRPD)</span>
                  <span className="text-[11px] text-slate-400">Statutory duty under the Building Safety Act</span>
                </div>
              </label>
              <label className="flex items-start gap-3 p-3 border border-surface-200 rounded-lg hover:bg-surface-50 cursor-pointer transition-colors">
                <input type="checkbox" checked={form.isCDM} onChange={e => update('isCDM', e.target.checked)} className="w-4 h-4 rounded border-surface-300 text-brand-600 focus:ring-brand-500 mt-0.5" />
                <div>
                  <span className="text-sm text-slate-700 font-medium block">CDM Principal Designer</span>
                  <span className="text-[11px] text-slate-400">Construction (Design and Management) Regulations</span>
                </div>
              </label>
            </div>

            <div className="border-t border-surface-200/60" />

            {/* Compliance frameworks — stored as comma-separated */}
            <div className="space-y-2">
              {([
                ['compBuildingRegs', 'Building regulations'],
                ['compPlanning', 'Planning'],
                ['compFireSafety', 'Fire and life safety'],
                ['compEDGE', 'EDGE'],
                ['compBREEAM', 'BREEAM'],
                ['compLEED', 'LEED'],
                ['compOperatorReqs', 'Operator requirements'],
              ] as const).map(([key, label]) => (
                <label key={key} className="flex items-center gap-3 p-3 border border-surface-200 rounded-lg hover:bg-surface-50 cursor-pointer transition-colors">
                  <input
                    type="checkbox"
                    checked={form[key] as boolean}
                    onChange={e => update(key, e.target.checked)}
                    className="w-4 h-4 rounded border-surface-300 text-brand-600 focus:ring-brand-500"
                  />
                  <span className="text-sm text-slate-700">{label}</span>
                </label>
              ))}
            </div>

            <div>
              <label className={labelCls}>Custom Compliance Register</label>
              <input type="text" value={form.complianceCustom} onChange={e => update('complianceCustom', e.target.value)} placeholder="e.g. WELL Standard, Passivhaus..." className={`${fieldCls} placeholder:text-ink-300`} />
            </div>
          </div>
        )}

        {/* ═══ Step 7 — Metrics ═══════════════════════ */}
        {step === 7 && (
          <div className="space-y-4">
            <p className="text-sm text-slate-500">All fields are optional and can be updated later.</p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className={labelCls}>Site Area (m2)</label>
                <input type="number" step="any" value={form.siteArea} onChange={e => update('siteArea', e.target.value)} className={`${fieldCls} placeholder:text-ink-300`} min={0} />
              </div>
              <div>
                <label className={labelCls}>GFA / Built-up Area (m2)</label>
                <input type="number" step="any" value={form.grossFloorArea} onChange={e => update('grossFloorArea', e.target.value)} className={`${fieldCls} placeholder:text-ink-300`} min={0} />
              </div>
              <div>
                <label className={labelCls}>NIA (m2)</label>
                <input type="number" step="any" value={form.netInternalArea} onChange={e => update('netInternalArea', e.target.value)} className={`${fieldCls} placeholder:text-ink-300`} min={0} />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className={labelCls}>Number of Blocks</label>
                <input type="number" value={form.numberOfBlocks} onChange={e => update('numberOfBlocks', e.target.value)} className={`${fieldCls} placeholder:text-ink-300`} min={0} />
              </div>
              <div>
                <label className={labelCls}>Number of Floors</label>
                <input type="number" value={form.numberOfFloors} onChange={e => update('numberOfFloors', e.target.value)} className={`${fieldCls} placeholder:text-ink-300`} min={0} />
              </div>
              <div>
                <label className={labelCls}>Keys or Units</label>
                <input type="number" value={form.numberOfUnits} onChange={e => update('numberOfUnits', e.target.value)} className={`${fieldCls} placeholder:text-ink-300`} min={0} />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Parking Spaces</label>
                <input type="number" value={form.parkingSpaces} onChange={e => update('parkingSpaces', e.target.value)} className={`${fieldCls} placeholder:text-ink-300`} min={0} />
              </div>
              <div>
                <label className={labelCls}>Accessible Parking</label>
                <input type="number" value={form.accessibleParking} onChange={e => update('accessibleParking', e.target.value)} className={`${fieldCls} placeholder:text-ink-300`} min={0} />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>FOH Area (m2)</label>
                <input type="number" step="any" value={form.fohArea} onChange={e => update('fohArea', e.target.value)} className={`${fieldCls} placeholder:text-ink-300`} min={0} />
              </div>
              <div>
                <label className={labelCls}>BOH Area (m2)</label>
                <input type="number" step="any" value={form.bohArea} onChange={e => update('bohArea', e.target.value)} className={`${fieldCls} placeholder:text-ink-300`} min={0} />
              </div>
            </div>

            <div>
              <label className={labelCls}>Budget</label>
              <input type="number" step="any" value={form.budget} onChange={e => update('budget', e.target.value)} placeholder="Total project budget" className={`${fieldCls} placeholder:text-ink-300`} min={0} />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Development Status</label>
                <select value={form.developmentStatus} onChange={e => update('developmentStatus', e.target.value)} className={fieldCls}>
                  <option value="">Select status...</option>
                  {DEVELOPMENT_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
              {isHospitality && (
                <div>
                  <label className={labelCls}>Target Opening Date</label>
                  <input type="date" value={form.targetOpeningDate} onChange={e => update('targetOpeningDate', e.target.value)} className={fieldCls} />
                </div>
              )}
            </div>
          </div>
        )}

        {/* ═══ Step 8 — Project Team ══════════════════ */}
        {step === 8 && (
          <div className="space-y-4">
            <p className="text-sm text-slate-500">Assign team members to the project. Members can also be added later.</p>

            {/* Add member row */}
            {orgMembers.length > 0 && (
              <div className="flex flex-col sm:flex-row gap-2">
                <select value={addProfileId} onChange={e => setAddProfileId(e.target.value)} className={`${fieldCls} flex-1`}>
                  <option value="">Select team member...</option>
                  {orgMembers
                    .filter(m => !teamMembers.some(tm => tm.profileId === m.id))
                    .map(m => <option key={m.id} value={m.id}>{m.fullName}</option>)
                  }
                </select>
                <select value={addRole} onChange={e => setAddRole(e.target.value)} className={`${fieldCls} sm:w-48`}>
                  {PROJECT_ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
                <button
                  type="button"
                  onClick={() => {
                    if (addProfileId) {
                      setTeamMembers(prev => [...prev, { profileId: addProfileId, projectRole: addRole }])
                      setAddProfileId('')
                      setAddRole('TEAM_MEMBER')
                    }
                  }}
                  className="px-4 py-2.5 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 transition-colors shrink-0"
                >
                  Add
                </button>
              </div>
            )}

            {/* Current team list */}
            {teamMembers.length > 0 && (
              <div className="space-y-2">
                {teamMembers.map((tm, i) => {
                  const member = orgMembers.find(m => m.id === tm.profileId)
                  const role = PROJECT_ROLES.find(r => r.value === tm.projectRole)
                  return (
                    <div key={`${tm.profileId}-${i}`} className="flex items-center justify-between p-3 border border-surface-200 rounded-lg">
                      <div>
                        <p className="text-sm font-medium text-slate-900">{member?.fullName || tm.profileId}</p>
                        <p className="text-xs text-slate-500">{role?.label || tm.projectRole}</p>
                      </div>
                      <button type="button" onClick={() => setTeamMembers(prev => prev.filter((_, idx) => idx !== i))} className="text-xs text-red-500 hover:text-red-700 transition-colors px-2 py-1">
                        Remove
                      </button>
                    </div>
                  )
                })}
              </div>
            )}

            {/* External consultants */}
            <div className="border-t border-surface-200/60 pt-4">
              <label className={labelCls}>External Consultants</label>
              <p className="text-xs text-slate-400 mb-3">Free-text entries for external team members not in your organisation.</p>
              {externalConsultants.map((ec, i) => (
                <div key={i} className="flex flex-col sm:flex-row gap-2 mb-2">
                  <input type="text" value={ec.name} onChange={e => { const u = [...externalConsultants]; u[i] = { ...ec, name: e.target.value }; setExternalConsultants(u) }} placeholder="Name" className={`${fieldCls} placeholder:text-ink-300 flex-1`} />
                  <input type="text" value={ec.organisation} onChange={e => { const u = [...externalConsultants]; u[i] = { ...ec, organisation: e.target.value }; setExternalConsultants(u) }} placeholder="Organisation" className={`${fieldCls} placeholder:text-ink-300 flex-1`} />
                  <input type="text" value={ec.role} onChange={e => { const u = [...externalConsultants]; u[i] = { ...ec, role: e.target.value }; setExternalConsultants(u) }} placeholder="Role" className={`${fieldCls} placeholder:text-ink-300 flex-1`} />
                  <button type="button" onClick={() => setExternalConsultants(prev => prev.filter((_, idx) => idx !== i))} className="text-red-500 hover:text-red-700 text-lg px-2 shrink-0">
                    &times;
                  </button>
                </div>
              ))}
              <button type="button" onClick={() => setExternalConsultants(prev => [...prev, { name: '', organisation: '', role: '' }])} className="text-sm text-brand-600 hover:text-brand-700 font-medium transition-colors">
                + Add external consultant
              </button>
            </div>
          </div>
        )}

        {/* ═══ Step 9 — Review ════════════════════════ */}
        {step === 9 && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600 font-medium">Review your project details before creating.</p>

            {/* General */}
            <ReviewSection title="General Information">
              <Row label="Project Name" value={form.name} />
              {form.code && <Row label="Code" value={form.code} />}
              {form.clientBrand && <Row label="Client" value={form.clientBrand} />}
              {form.clientType && <Row label="Client Type" value={CLIENT_TYPES.find(t => t.value === form.clientType)?.label || form.clientType} />}
              {form.projectType && <Row label="Project Type" value={PROJECT_TYPES.find(t => t.value === form.projectType)?.label || form.projectType} />}
              {form.currency && <Row label="Currency" value={form.currency} />}
              {form.startDate && <Row label="Start Date" value={new Date(form.startDate).toLocaleDateString('en-GB')} />}
              {form.targetCompletion && <Row label="Target Completion" value={new Date(form.targetCompletion).toLocaleDateString('en-GB')} />}
              {form.projectManagerId && <Row label="Project Manager" value={orgMembers.find(m => m.id === form.projectManagerId)?.fullName || '—'} />}
              {form.description && <DescRow label="Description" value={form.description} />}
            </ReviewSection>

            {/* Location */}
            {(resolvedCountry || form.siteCity || form.siteAddress) && (
              <ReviewSection title="Location">
                {resolvedCountry && <Row label="Country" value={resolvedCountry} />}
                {form.siteRegion && <Row label="Region" value={form.siteRegion} />}
                {form.siteCity && <Row label="City" value={form.siteCity} />}
                {form.siteAddress && <DescRow label="Address" value={form.siteAddress} />}
                {form.sitePostcode && <Row label="Postcode" value={form.sitePostcode} />}
                {form.mapLatitude && <Row label="Latitude" value={form.mapLatitude} />}
                {form.mapLongitude && <Row label="Longitude" value={form.mapLongitude} />}
                {form.planningAuthority && <Row label="Planning Authority" value={form.planningAuthority} />}
                {form.buildingControlAuthority && <Row label="Building Control" value={form.buildingControlAuthority} />}
              </ReviewSection>
            )}

            {/* Development */}
            {form.developmentType && (
              <ReviewSection title="Development Type">
                <Row label="Type" value={DEVELOPMENT_TYPES.find(t => t.value === form.developmentType)?.label || form.developmentType} />
                {form.existingBuildingOccupied && <Row label="Existing building" value="Occupied" />}
                {form.existingFrameRetained && <Row label="Structural frame" value="Retained" />}
                {form.constructionStarted && <Row label="Construction" value="Already started" />}
                {form.existingPlanningApproval && <Row label="Planning approval" value="Exists" />}
                {form.existingContractor && <Row label="Contractor" value="Exists" />}
              </ReviewSection>
            )}

            {/* Hospitality */}
            {isHospitality && (form.operatorName || form.operatorBrand || form.managementType) && (
              <ReviewSection title="Client & Operator">
                {form.operatorName && <Row label="Operator" value={form.operatorName} />}
                {form.operatorBrand && <Row label="Brand" value={form.operatorBrand} />}
                {form.managementType && <Row label="Management" value={MANAGEMENT_TYPES.find(t => t.value === form.managementType)?.label || form.managementType} />}
                {form.targetKeys && <Row label="Target Keys" value={form.targetKeys} />}
                {form.currentKeys && <Row label="Current Keys" value={form.currentKeys} />}
                {form.modelRoomRequired && <Row label="Model Room" value="Required" />}
                {form.operatorContact && <Row label="Approval Contact" value={form.operatorContact} />}
                {form.operatorStandardVersion && <Row label="Standard Version" value={form.operatorStandardVersion} />}
              </ReviewSection>
            )}

            {/* Work Stages */}
            {form.workStageFramework && (
              <ReviewSection title="Work Stages">
                <Row label="Framework" value={WORK_STAGE_FRAMEWORKS.find(f => f.value === form.workStageFramework)?.label || form.workStageFramework} />
              </ReviewSection>
            )}

            {/* Compliance */}
            {(form.isBRPD || form.isCDM || form.compBuildingRegs || form.compPlanning || form.compFireSafety || form.compEDGE || form.compBREEAM || form.compLEED || form.compOperatorReqs || form.complianceCustom) && (
              <ReviewSection title="Compliance">
                {form.isBRPD && <Row label="BRPD" value="Yes" />}
                {form.isCDM && <Row label="CDM" value="Yes" />}
                {form.compBuildingRegs && <Row label="Building Regulations" value="Yes" />}
                {form.compPlanning && <Row label="Planning" value="Yes" />}
                {form.compFireSafety && <Row label="Fire and Life Safety" value="Yes" />}
                {form.compEDGE && <Row label="EDGE" value="Yes" />}
                {form.compBREEAM && <Row label="BREEAM" value="Yes" />}
                {form.compLEED && <Row label="LEED" value="Yes" />}
                {form.compOperatorReqs && <Row label="Operator Requirements" value="Yes" />}
                {form.complianceCustom && <Row label="Custom" value={form.complianceCustom} />}
              </ReviewSection>
            )}

            {/* Metrics */}
            {(form.siteArea || form.grossFloorArea || form.budget || form.numberOfUnits) && (
              <ReviewSection title="Metrics">
                {form.siteArea && <Row label="Site Area" value={`${form.siteArea} m2`} />}
                {form.grossFloorArea && <Row label="GFA" value={`${form.grossFloorArea} m2`} />}
                {form.netInternalArea && <Row label="NIA" value={`${form.netInternalArea} m2`} />}
                {form.numberOfBlocks && <Row label="Blocks" value={form.numberOfBlocks} />}
                {form.numberOfFloors && <Row label="Floors" value={form.numberOfFloors} />}
                {form.numberOfUnits && <Row label="Keys/Units" value={form.numberOfUnits} />}
                {form.parkingSpaces && <Row label="Parking" value={form.parkingSpaces} />}
                {form.accessibleParking && <Row label="Accessible Parking" value={form.accessibleParking} />}
                {form.fohArea && <Row label="FOH" value={`${form.fohArea} m2`} />}
                {form.bohArea && <Row label="BOH" value={`${form.bohArea} m2`} />}
                {form.budget && <Row label="Budget" value={form.budget} />}
                {form.developmentStatus && <Row label="Status" value={DEVELOPMENT_STATUSES.find(s => s.value === form.developmentStatus)?.label || form.developmentStatus} />}
                {form.targetOpeningDate && <Row label="Opening Date" value={new Date(form.targetOpeningDate).toLocaleDateString('en-GB')} />}
              </ReviewSection>
            )}

            {/* Team */}
            {(teamMembers.length > 0 || form.projectManagerId) && (
              <ReviewSection title="Project Team">
                {form.projectManagerId && (
                  <Row label="Project Manager" value={orgMembers.find(m => m.id === form.projectManagerId)?.fullName || '—'} />
                )}
                {teamMembers.map(tm => {
                  const member = orgMembers.find(m => m.id === tm.profileId)
                  const role = PROJECT_ROLES.find(r => r.value === tm.projectRole)
                  return <Row key={tm.profileId} label={role?.label || tm.projectRole} value={member?.fullName || tm.profileId} />
                })}
                {externalConsultants.filter(ec => ec.name).map((ec, i) => (
                  <Row key={`ext-${i}`} label={ec.role || 'External'} value={`${ec.name}${ec.organisation ? ` (${ec.organisation})` : ''}`} />
                ))}
              </ReviewSection>
            )}
          </div>
        )}

        {/* ── Divider + navigation ───────────────────── */}
        <div className="border-t border-surface-200/60" />

        <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <button
            onClick={handlePrev}
            disabled={step === 1}
            className={cn(
              'px-4 py-2.5 text-sm font-medium rounded-lg transition-colors text-center',
              step === 1 ? 'text-slate-300 cursor-not-allowed' : 'text-slate-700 hover:text-slate-900 hover:bg-surface-50',
            )}
          >
            Previous
          </button>

          {step < STEPS.length ? (
            <button onClick={handleNext} className="px-6 py-2.5 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 transition-colors shadow-sm text-center">
              Next
            </button>
          ) : (
            <div className="flex flex-col sm:flex-row gap-2">
              <button
                onClick={() => handleSubmit(true)}
                disabled={submitting}
                className={cn(
                  'px-5 py-2.5 text-sm font-medium rounded-lg border transition-colors text-center',
                  submitting ? 'text-slate-300 border-surface-200 cursor-not-allowed' : 'text-slate-700 border-surface-300 hover:bg-surface-50',
                )}
              >
                Save as Draft
              </button>
              <button
                onClick={() => handleSubmit(false)}
                disabled={submitting}
                className={cn(
                  'px-6 py-2.5 text-white text-sm font-medium rounded-lg shadow-sm transition-colors text-center',
                  submitting ? 'bg-brand-400 cursor-not-allowed' : 'bg-brand-600 hover:bg-brand-700',
                )}
              >
                {submitting ? 'Creating...' : 'Create Project'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════
// Helper sub-components
// ═══════════════════════════════════════════════════════

function ReviewSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-surface-50 rounded-lg p-4 space-y-2">
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">{title}</p>
      {children}
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col sm:flex-row sm:justify-between gap-0.5 sm:gap-4 text-sm">
      <span className="text-slate-500 text-xs sm:text-sm">{label}</span>
      <span className="font-medium text-slate-900">{value || '—'}</span>
    </div>
  )
}

function DescRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="pt-2 border-t border-surface-200">
      <p className="text-slate-500 text-xs mb-1">{label}</p>
      <p className="text-slate-700 text-sm">{value}</p>
    </div>
  )
}

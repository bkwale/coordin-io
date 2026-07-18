'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { cn } from '@/lib/utils'

// ── Wizard step definitions (static config — no DB) ──────

const STEPS = [
  { number: 1, title: 'Project Details', description: 'Name, type, and client information' },
  { number: 2, title: 'Location & Stage', description: 'Site location and current project stage' },
  { number: 3, title: 'Review & Create', description: 'Confirm details and create the project' },
]

const PROJECT_TYPES = [
  { value: 'HOTEL', label: 'Hotel' },
  { value: 'RESIDENTIAL', label: 'Residential' },
  { value: 'MIXED_USE', label: 'Mixed Use' },
  { value: 'RESORT', label: 'Resort' },
  { value: 'REFURBISHMENT', label: 'Refurbishment' },
  { value: 'OFFICE_FIT_OUT', label: 'Office Fit-Out' },
]

const PROJECT_STAGES = [
  { value: 'BRIEF', label: 'Brief' },
  { value: 'CONCEPT', label: 'Concept' },
  { value: 'SPATIAL_COORDINATION', label: 'Spatial Coordination' },
  { value: 'WORKING_DRAWINGS', label: 'Working Drawings' },
  { value: 'CONSTRUCTION', label: 'Construction' },
  { value: 'HANDOVER', label: 'Handover' },
  { value: 'OPERATIONS', label: 'Operations' },
]

const CURRENCIES = [
  { value: 'NGN', label: 'NGN (₦)' },
  { value: 'GBP', label: 'GBP (£)' },
  { value: 'USD', label: 'USD ($)' },
  { value: 'EUR', label: 'EUR (€)' },
]

export default function NewProjectPage() {
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState(1)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [created, setCreated] = useState(false)

  const [formData, setFormData] = useState({
    name: '',
    code: '',
    description: '',
    projectType: '',
    clientBrand: '',
    location: '',
    stage: 'BRIEF',
    currency: '',
    startDate: '',
    targetCompletion: '',
  })

  const updateField = (key: string, value: string) => {
    setFormData(prev => ({ ...prev, [key]: value }))
    setError(null)
  }

  const isStep1Valid = formData.name.trim().length > 0

  const handleNext = () => {
    if (currentStep === 1 && !isStep1Valid) {
      setError('Project name is required')
      return
    }
    setCurrentStep(prev => Math.min(prev + 1, STEPS.length))
  }

  const handlePrev = () => setCurrentStep(prev => Math.max(prev - 1, 1))

  const handleCreate = async () => {
    setSubmitting(true)
    setError(null)

    try {
      const payload: Record<string, string> = { name: formData.name.trim() }
      if (formData.code) payload.code = formData.code.trim()
      if (formData.description) payload.description = formData.description.trim()
      if (formData.projectType) payload.projectType = formData.projectType
      if (formData.clientBrand) payload.clientBrand = formData.clientBrand.trim()
      if (formData.location) payload.location = formData.location.trim()
      if (formData.stage) payload.stage = formData.stage
      if (formData.currency) payload.currency = formData.currency
      if (formData.startDate) payload.startDate = formData.startDate
      if (formData.targetCompletion) payload.targetCompletion = formData.targetCompletion

      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => null)
        throw new Error(body?.error || `Failed to create project (${res.status})`)
      }

      setCreated(true)
      setTimeout(() => router.push('/projects'), 1500)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setSubmitting(false)
    }
  }

  // Success screen
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

  const completionPercent = Math.round(((currentStep - 1) / STEPS.length) * 100)

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
        <p className="text-sm text-slate-500 mt-1">Step {currentStep} of {STEPS.length} — {STEPS[currentStep - 1].title}</p>
      </div>

      {/* Progress Bar */}
      <div className="card-premium p-4 sm:p-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-semibold text-ink-400 uppercase tracking-[0.1em]">Progress</span>
          <span className="text-sm font-medium text-slate-900">{completionPercent}%</span>
        </div>
        <div className="w-full h-2 bg-surface-100 rounded-full overflow-hidden">
          <div className="h-full bg-brand-500 transition-all duration-300" style={{ width: `${completionPercent}%` }} />
        </div>
        {/* Step indicators — horizontal on mobile */}
        <div className="flex gap-2 mt-3">
          {STEPS.map(s => (
            <button
              key={s.number}
              onClick={() => {
                if (s.number <= currentStep) setCurrentStep(s.number)
              }}
              className={cn(
                'flex-1 py-2 rounded-lg text-[11px] font-medium transition-all text-center',
                s.number === currentStep
                  ? 'bg-brand-50 text-brand-700 border border-brand-200'
                  : s.number < currentStep
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 cursor-pointer'
                  : 'bg-surface-50 text-slate-400 border border-surface-200'
              )}
            >
              <span className="hidden sm:inline">{s.title}</span>
              <span className="sm:hidden">Step {s.number}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Form Content */}
      <div className="card-premium p-4 sm:p-6 space-y-5">
        <div>
          <h2 className="text-base sm:text-lg font-display text-slate-900">{STEPS[currentStep - 1].title}</h2>
          <p className="text-sm text-slate-500 mt-1">{STEPS[currentStep - 1].description}</p>
        </div>

        <div className="border-t border-surface-200/60" />

        {/* Error */}
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
        )}

        {/* Step 1: Project Details */}
        {currentStep === 1 && (
          <div className="space-y-4">
            <div>
              <label className="text-[11px] text-ink-400 uppercase tracking-[0.08em] font-semibold block mb-2">Project Name *</label>
              <input
                type="text"
                value={formData.name}
                onChange={e => updateField('name', e.target.value)}
                placeholder="e.g. Riverside House Extension"
                className="w-full px-3 py-2.5 border border-surface-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 placeholder:text-ink-300 bg-white"
                autoFocus
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-[11px] text-ink-400 uppercase tracking-[0.08em] font-semibold block mb-2">Project Code</label>
                <input
                  type="text"
                  value={formData.code}
                  onChange={e => updateField('code', e.target.value)}
                  placeholder="e.g. RH-2026-001"
                  className="w-full px-3 py-2.5 border border-surface-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 placeholder:text-ink-300 bg-white"
                />
              </div>
              <div>
                <label className="text-[11px] text-ink-400 uppercase tracking-[0.08em] font-semibold block mb-2">Client / Brand</label>
                <input
                  type="text"
                  value={formData.clientBrand}
                  onChange={e => updateField('clientBrand', e.target.value)}
                  placeholder="e.g. Harris Family Trust"
                  className="w-full px-3 py-2.5 border border-surface-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 placeholder:text-ink-300 bg-white"
                />
              </div>
            </div>
            <div>
              <label className="text-[11px] text-ink-400 uppercase tracking-[0.08em] font-semibold block mb-2">Project Type</label>
              <select
                value={formData.projectType}
                onChange={e => updateField('projectType', e.target.value)}
                className="w-full px-3 py-2.5 border border-surface-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 bg-white"
              >
                <option value="">Select type...</option>
                {PROJECT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[11px] text-ink-400 uppercase tracking-[0.08em] font-semibold block mb-2">Description</label>
              <textarea
                value={formData.description}
                onChange={e => updateField('description', e.target.value)}
                placeholder="Brief project overview..."
                rows={3}
                className="w-full px-3 py-2.5 border border-surface-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 placeholder:text-ink-300 bg-white resize-none"
              />
            </div>
          </div>
        )}

        {/* Step 2: Location & Stage */}
        {currentStep === 2 && (
          <div className="space-y-4">
            <div>
              <label className="text-[11px] text-ink-400 uppercase tracking-[0.08em] font-semibold block mb-2">Location</label>
              <input
                type="text"
                value={formData.location}
                onChange={e => updateField('location', e.target.value)}
                placeholder="e.g. Lagos, Nigeria"
                className="w-full px-3 py-2.5 border border-surface-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 placeholder:text-ink-300 bg-white"
              />
            </div>
            <div>
              <label className="text-[11px] text-ink-400 uppercase tracking-[0.08em] font-semibold block mb-3">Project Stage</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {PROJECT_STAGES.map(s => (
                  <button
                    key={s.value}
                    type="button"
                    onClick={() => updateField('stage', s.value)}
                    className={cn(
                      'p-3 rounded-lg border-2 transition-all text-center',
                      formData.stage === s.value
                        ? 'border-brand-500 bg-brand-50'
                        : 'border-surface-200 hover:border-surface-300 bg-white'
                    )}
                  >
                    <p className={cn(
                      'text-[11px] sm:text-xs font-semibold leading-tight',
                      formData.stage === s.value ? 'text-brand-700' : 'text-slate-500'
                    )}>
                      {s.label}
                    </p>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-[11px] text-ink-400 uppercase tracking-[0.08em] font-semibold block mb-2">Currency</label>
              <select
                value={formData.currency}
                onChange={e => updateField('currency', e.target.value)}
                className="w-full px-3 py-2.5 border border-surface-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 bg-white"
              >
                <option value="">Organisation default</option>
                {CURRENCIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-[11px] text-ink-400 uppercase tracking-[0.08em] font-semibold block mb-2">Start Date</label>
                <input
                  type="date"
                  value={formData.startDate}
                  onChange={e => updateField('startDate', e.target.value)}
                  className="w-full px-3 py-2.5 border border-surface-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 bg-white"
                />
              </div>
              <div>
                <label className="text-[11px] text-ink-400 uppercase tracking-[0.08em] font-semibold block mb-2">Target Completion</label>
                <input
                  type="date"
                  value={formData.targetCompletion}
                  onChange={e => updateField('targetCompletion', e.target.value)}
                  className="w-full px-3 py-2.5 border border-surface-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 bg-white"
                />
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Review & Create */}
        {currentStep === 3 && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600 font-medium">Confirm details before creating</p>
            <div className="bg-surface-50 rounded-lg p-4 space-y-3 text-sm">
              <Row label="Project Name" value={formData.name} />
              {formData.code && <Row label="Code" value={formData.code} />}
              {formData.clientBrand && <Row label="Client" value={formData.clientBrand} />}
              {formData.projectType && <Row label="Type" value={PROJECT_TYPES.find(t => t.value === formData.projectType)?.label || formData.projectType} />}
              <Row label="Stage" value={PROJECT_STAGES.find(s => s.value === formData.stage)?.label || formData.stage} />
              {formData.location && <Row label="Location" value={formData.location} />}
              {formData.currency && <Row label="Currency" value={formData.currency} />}
              {formData.startDate && <Row label="Start" value={new Date(formData.startDate).toLocaleDateString('en-GB')} />}
              {formData.targetCompletion && <Row label="Target Completion" value={new Date(formData.targetCompletion).toLocaleDateString('en-GB')} />}
              {formData.description && (
                <div className="pt-2 border-t border-surface-200">
                  <p className="text-slate-500 text-xs mb-1">Description</p>
                  <p className="text-slate-700">{formData.description}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Divider */}
        <div className="border-t border-surface-200/60" />

        {/* Buttons */}
        <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <button
            onClick={handlePrev}
            disabled={currentStep === 1}
            className={cn(
              'px-4 py-2.5 text-sm font-medium rounded-lg transition-colors text-center',
              currentStep === 1
                ? 'text-slate-300 cursor-not-allowed'
                : 'text-slate-700 hover:text-slate-900 hover:bg-surface-50'
            )}
          >
            Previous
          </button>

          {currentStep < STEPS.length ? (
            <button
              onClick={handleNext}
              className="px-6 py-2.5 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 transition-colors shadow-sm text-center"
            >
              Next
            </button>
          ) : (
            <button
              onClick={handleCreate}
              disabled={submitting}
              className={cn(
                'px-6 py-2.5 text-white text-sm font-medium rounded-lg shadow-sm transition-colors text-center',
                submitting
                  ? 'bg-brand-400 cursor-not-allowed'
                  : 'bg-brand-600 hover:bg-brand-700'
              )}
            >
              {submitting ? 'Creating...' : 'Create Project'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col sm:flex-row sm:justify-between gap-0.5 sm:gap-4">
      <span className="text-slate-500 text-xs sm:text-sm">{label}</span>
      <span className="font-medium text-slate-900 text-sm">{value || '—'}</span>
    </div>
  )
}

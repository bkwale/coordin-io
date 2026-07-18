'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { getProjectWizardSteps, USERS } from '@/lib/mock-data'
import { WizardStepStatus, RIBA_STAGES, RIBAStage } from '@/lib/types'
import { cn, wizardStepStatusColor, wizardStepStatusLabel } from '@/lib/utils'

export default function NewProjectPage() {
  const router = useRouter()
  const steps = getProjectWizardSteps()

  const [currentStep, setCurrentStep] = useState(1)
  const [stepStatuses, setStepStatuses] = useState<Record<number, WizardStepStatus>>(
    Object.fromEntries(steps.map((s) => [s.number, 'not_started' as WizardStepStatus]))
  )
  const [submitted, setSubmitted] = useState(false)

  // Form data storage
  const [formData, setFormData] = useState({
    name: '',
    client: '',
    project_ref: '',
    sector: '',
    building_type: '',
    gross_internal_area: '',
    address: '',
    local_authority: '',
    conservation_area: false,
    current_stage: 0 as RIBAStage,
    target_completion_date: '',
    project_lead: '',
    team_members: '',
    brief_summary: '',
    key_requirements: '',
    budget_min: '',
    budget_max: '',
    fee_basis: '',
    agreed_fee: '',
    payment_schedule: '',
    bsa_applicable: false,
    cdm_role: '',
    building_regs_route: '',
  })

  const step = steps[currentStep - 1]
  const isLastStep = currentStep === steps.length
  const canSkip = step ? !step.required : false
  const isStepComplete = stepStatuses[currentStep] === 'complete'

  // Guard: wizard steps not yet loaded from database
  if (!steps.length || !step) {
    return (
      <div className="max-w-lg mx-auto mt-20 text-center">
        <h2 className="text-xl font-display text-slate-900 mb-2">Project Wizard</h2>
        <p className="text-sm text-slate-500">Project creation wizard is being migrated to the new system. Coming soon.</p>
        <Link href="/" className="text-sm text-brand-600 hover:text-brand-700 mt-4 inline-block">← Back to Dashboard</Link>
      </div>
    )
  }

  // Update form field
  const updateField = (key: string, value: any) => {
    setFormData((prev) => ({ ...prev, [key]: value }))
  }

  // Next button handler
  const handleNext = () => {
    if (isLastStep) {
      handleCreate()
    } else {
      const newStatuses = { ...stepStatuses, [currentStep]: 'complete' as WizardStepStatus }
      setStepStatuses(newStatuses)
      setCurrentStep((prev) => prev + 1)
    }
  }

  // Previous button handler
  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep((prev) => prev - 1)
    }
  }

  // Skip button handler (only for optional steps)
  const handleSkip = () => {
    if (canSkip && currentStep < steps.length) {
      const newStatuses = { ...stepStatuses, [currentStep]: 'skipped' as WizardStepStatus }
      setStepStatuses(newStatuses)
      setCurrentStep((prev) => prev + 1)
    }
  }

  // Jump to step
  const jumpToStep = (num: number) => {
    setCurrentStep(num)
  }

  // Create project
  const handleCreate = () => {
    setSubmitted(true)
    setTimeout(() => router.push('/'), 1500)
  }

  // Calculate completion percentage
  const completedSteps = Object.values(stepStatuses).filter((s) => s === 'complete' || s === 'skipped').length
  const completionPercent = Math.round((completedSteps / steps.length) * 100)

  // Success screen
  if (submitted) {
    return (
      <div className="max-w-lg mx-auto mt-20 text-center">
        <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-2xl font-display text-slate-900 mb-2">Project Created</h2>
        <p className="text-sm text-slate-500">Your new project is ready. Redirecting to dashboard...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-slate-400">
        <Link href="/" className="hover:text-brand-600 transition-colors">Dashboard</Link>
        <span>/</span>
        <span className="text-slate-600 font-medium">New Project</span>
      </div>

      {/* Header */}
      <div>
        <h1 className="text-2xl font-display text-slate-900">Create New Project</h1>
        <p className="text-sm text-slate-500 mt-1">Step {currentStep} of {steps.length}</p>
      </div>

      {/* Progress Bar */}
      <div className="card-premium p-6">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[11px] font-semibold text-ink-400 uppercase tracking-[0.1em]">Progress</span>
          <span className="text-sm font-medium text-slate-900">{completionPercent}%</span>
        </div>
        <div className="w-full h-2 bg-surface-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-brand-500 transition-all duration-300"
            style={{ width: `${completionPercent}%` }}
          />
        </div>
      </div>

      {/* Main Layout: Sidebar + Content */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left Sidebar: Step Navigator */}
        <div className="lg:col-span-1">
          <div className="card-premium p-4 space-y-2 sticky top-6">
            {steps.map((s) => {
              const status = stepStatuses[s.number]
              const isCurrent = s.number === currentStep
              return (
                <button
                  key={s.number}
                  onClick={() => jumpToStep(s.number)}
                  className={cn(
                    'w-full text-left px-3 py-3 rounded-lg border transition-all',
                    isCurrent
                      ? 'bg-brand-50 border-brand-500'
                      : 'border-surface-200/60 hover:bg-surface-50'
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div className={cn(
                      'w-5 h-5 rounded-full flex items-center justify-center text-xs font-semibold shrink-0',
                      status === 'complete' ? 'bg-emerald-500 text-white' :
                      status === 'skipped' ? 'bg-amber-500 text-white' :
                      isCurrent ? 'bg-brand-500 text-white' :
                      'bg-slate-200 text-slate-600'
                    )}>
                      {status === 'complete' ? '✓' : status === 'skipped' ? '−' : s.number}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={cn(
                        'text-xs font-semibold leading-tight',
                        isCurrent ? 'text-brand-700' : 'text-slate-600'
                      )}>
                        {s.title}
                      </p>
                      <p className="text-[10px] text-slate-400 mt-0.5 leading-tight">{wizardStepStatusLabel(status)}</p>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Right Content: Step Form */}
        <div className="lg:col-span-3">
          <div className="card-premium p-6 space-y-6">
            {/* Step Header */}
            <div>
              <h2 className="text-lg font-display text-slate-900">{step.title}</h2>
              <p className="text-sm text-slate-600 mt-1">{step.description}</p>
              {step.help_text && (
                <p className="text-xs text-slate-500 mt-3 italic">Info: {step.help_text}</p>
              )}
            </div>

            {/* Divider */}
            <div className="border-t border-surface-200/60" />

            {/* Step Content */}
            <div className="space-y-5">
              {currentStep === 1 && (
                <>
                  <div>
                    <label className="text-[11px] text-ink-400 uppercase tracking-[0.08em] font-semibold block mb-2">Project Name *</label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => updateField('name', e.target.value)}
                      placeholder="e.g. Riverside House Extension"
                      className="w-full px-3 py-2.5 border border-surface-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 placeholder:text-ink-300 bg-white"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-ink-400 uppercase tracking-[0.08em] font-semibold block mb-2">Client Name *</label>
                    <input
                      type="text"
                      value={formData.client}
                      onChange={(e) => updateField('client', e.target.value)}
                      placeholder="e.g. Harris Family Trust"
                      className="w-full px-3 py-2.5 border border-surface-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 placeholder:text-ink-300 bg-white"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-ink-400 uppercase tracking-[0.08em] font-semibold block mb-2">Project Reference</label>
                    <input
                      type="text"
                      value={formData.project_ref}
                      onChange={(e) => updateField('project_ref', e.target.value)}
                      placeholder="e.g. RH-2026-001"
                      className="w-full px-3 py-2.5 border border-surface-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 placeholder:text-ink-300 bg-white"
                    />
                  </div>
                </>
              )}

              {currentStep === 2 && (
                <>
                  <div>
                    <label className="text-[11px] text-ink-400 uppercase tracking-[0.08em] font-semibold block mb-2">Sector *</label>
                    <select
                      value={formData.sector}
                      onChange={(e) => updateField('sector', e.target.value)}
                      className="w-full px-3 py-2.5 border border-surface-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 bg-white"
                    >
                      <option value="">Select sector...</option>
                      <option value="residential">Residential</option>
                      <option value="commercial">Commercial</option>
                      <option value="education">Education</option>
                      <option value="healthcare">Healthcare</option>
                      <option value="mixed-use">Mixed-Use</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] text-ink-400 uppercase tracking-[0.08em] font-semibold block mb-2">Building Type *</label>
                    <input
                      type="text"
                      value={formData.building_type}
                      onChange={(e) => updateField('building_type', e.target.value)}
                      placeholder="e.g. Detached House, Office Block"
                      className="w-full px-3 py-2.5 border border-surface-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 placeholder:text-ink-300 bg-white"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-ink-400 uppercase tracking-[0.08em] font-semibold block mb-2">Gross Internal Area (m²) *</label>
                    <input
                      type="number"
                      value={formData.gross_internal_area}
                      onChange={(e) => updateField('gross_internal_area', e.target.value)}
                      placeholder="e.g. 1500"
                      className="w-full px-3 py-2.5 border border-surface-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 placeholder:text-ink-300 bg-white"
                    />
                  </div>
                </>
              )}

              {currentStep === 3 && (
                <>
                  <div>
                    <label className="text-[11px] text-ink-400 uppercase tracking-[0.08em] font-semibold block mb-2">Address *</label>
                    <textarea
                      value={formData.address}
                      onChange={(e) => updateField('address', e.target.value)}
                      placeholder="Full site address..."
                      rows={3}
                      className="w-full px-3 py-2.5 border border-surface-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 placeholder:text-ink-300 bg-white resize-none"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-ink-400 uppercase tracking-[0.08em] font-semibold block mb-2">Local Authority *</label>
                    <input
                      type="text"
                      value={formData.local_authority}
                      onChange={(e) => updateField('local_authority', e.target.value)}
                      placeholder="e.g. Royal Borough of Kingston upon Thames"
                      className="w-full px-3 py-2.5 border border-surface-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 placeholder:text-ink-300 bg-white"
                    />
                  </div>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.conservation_area}
                      onChange={(e) => updateField('conservation_area', e.target.checked)}
                      className="w-4 h-4 rounded border-surface-200"
                    />
                    <span className="text-sm text-slate-700">Conservation Area</span>
                  </label>
                </>
              )}

              {currentStep === 4 && (
                <>
                  <div>
                    <label className="text-[11px] text-ink-400 uppercase tracking-[0.08em] font-semibold block mb-3">RIBA Stage *</label>
                    <div className="grid grid-cols-4 gap-2">
                      {(Object.entries(RIBA_STAGES) as [string, string][]).map(([s, label]) => {
                        const stage = Number(s) as RIBAStage
                        const isSelected = stage === formData.current_stage
                        return (
                          <button
                            key={stage}
                            type="button"
                            onClick={() => updateField('current_stage', stage)}
                            className={cn(
                              'p-3 rounded-lg border-2 transition-all text-center',
                              isSelected
                                ? 'border-brand-500 bg-brand-50'
                                : 'border-surface-200 hover:border-surface-300 bg-white'
                            )}
                          >
                            <p className={cn(
                              'text-lg font-bold',
                              isSelected ? 'text-brand-700' : 'text-slate-400'
                            )}>
                              {stage}
                            </p>
                            <p className={cn(
                              'text-[10px] font-medium leading-tight mt-1',
                              isSelected ? 'text-brand-600' : 'text-slate-500'
                            )}>
                              {label.split(' ')[0]}
                            </p>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                  <div>
                    <label className="text-[11px] text-ink-400 uppercase tracking-[0.08em] font-semibold block mb-2">Target Completion Date</label>
                    <input
                      type="date"
                      value={formData.target_completion_date}
                      onChange={(e) => updateField('target_completion_date', e.target.value)}
                      className="w-full px-3 py-2.5 border border-surface-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 bg-white"
                    />
                  </div>
                </>
              )}

              {currentStep === 5 && (
                <>
                  <div>
                    <label className="text-[11px] text-ink-400 uppercase tracking-[0.08em] font-semibold block mb-2">Project Lead *</label>
                    <select
                      value={formData.project_lead}
                      onChange={(e) => updateField('project_lead', e.target.value)}
                      className="w-full px-3 py-2.5 border border-surface-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 bg-white"
                    >
                      <option value="">Select project lead...</option>
                      {USERS.filter((u) => u.role === 'project_lead' || u.role === 'practice_owner').map((u) => (
                        <option key={u.id} value={u.id}>{u.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] text-ink-400 uppercase tracking-[0.08em] font-semibold block mb-2">Team Members</label>
                    <textarea
                      value={formData.team_members}
                      onChange={(e) => updateField('team_members', e.target.value)}
                      placeholder="Add team members (one per line, or comma-separated)"
                      rows={3}
                      className="w-full px-3 py-2.5 border border-surface-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 placeholder:text-ink-300 bg-white resize-none"
                    />
                  </div>
                </>
              )}

              {currentStep === 6 && (
                <>
                  <div>
                    <label className="text-[11px] text-ink-400 uppercase tracking-[0.08em] font-semibold block mb-2">Brief Summary</label>
                    <textarea
                      value={formData.brief_summary}
                      onChange={(e) => updateField('brief_summary', e.target.value)}
                      placeholder="High-level overview of the project..."
                      rows={3}
                      className="w-full px-3 py-2.5 border border-surface-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 placeholder:text-ink-300 bg-white resize-none"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-ink-400 uppercase tracking-[0.08em] font-semibold block mb-2">Key Requirements</label>
                    <textarea
                      value={formData.key_requirements}
                      onChange={(e) => updateField('key_requirements', e.target.value)}
                      placeholder="Client requirements and constraints..."
                      rows={3}
                      className="w-full px-3 py-2.5 border border-surface-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 placeholder:text-ink-300 bg-white resize-none"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[11px] text-ink-400 uppercase tracking-[0.08em] font-semibold block mb-2">Budget Min</label>
                      <input
                        type="number"
                        value={formData.budget_min}
                        onChange={(e) => updateField('budget_min', e.target.value)}
                        placeholder="£"
                        className="w-full px-3 py-2.5 border border-surface-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 placeholder:text-ink-300 bg-white"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-ink-400 uppercase tracking-[0.08em] font-semibold block mb-2">Budget Max</label>
                      <input
                        type="number"
                        value={formData.budget_max}
                        onChange={(e) => updateField('budget_max', e.target.value)}
                        placeholder="£"
                        className="w-full px-3 py-2.5 border border-surface-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 placeholder:text-ink-300 bg-white"
                      />
                    </div>
                  </div>
                </>
              )}

              {currentStep === 7 && (
                <>
                  <div>
                    <label className="text-[11px] text-ink-400 uppercase tracking-[0.08em] font-semibold block mb-2">Fee Basis</label>
                    <select
                      value={formData.fee_basis}
                      onChange={(e) => updateField('fee_basis', e.target.value)}
                      className="w-full px-3 py-2.5 border border-surface-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 bg-white"
                    >
                      <option value="">Select basis...</option>
                      <option value="fixed">Fixed Fee</option>
                      <option value="time-based">Time-Based</option>
                      <option value="percentage">Percentage</option>
                      <option value="capped">Capped</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] text-ink-400 uppercase tracking-[0.08em] font-semibold block mb-2">Agreed Fee</label>
                    <input
                      type="number"
                      value={formData.agreed_fee}
                      onChange={(e) => updateField('agreed_fee', e.target.value)}
                      placeholder="£"
                      className="w-full px-3 py-2.5 border border-surface-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 placeholder:text-ink-300 bg-white"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-ink-400 uppercase tracking-[0.08em] font-semibold block mb-2">Payment Schedule</label>
                    <textarea
                      value={formData.payment_schedule}
                      onChange={(e) => updateField('payment_schedule', e.target.value)}
                      placeholder="e.g. 50% on signature, 50% on completion"
                      rows={2}
                      className="w-full px-3 py-2.5 border border-surface-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 placeholder:text-ink-300 bg-white resize-none"
                    />
                  </div>
                </>
              )}

              {currentStep === 8 && (
                <>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.bsa_applicable}
                      onChange={(e) => updateField('bsa_applicable', e.target.checked)}
                      className="w-4 h-4 rounded border-surface-200"
                    />
                    <span className="text-sm text-slate-700">Building Safety Act Applicable</span>
                  </label>
                  <div>
                    <label className="text-[11px] text-ink-400 uppercase tracking-[0.08em] font-semibold block mb-2">CDM Role</label>
                    <select
                      value={formData.cdm_role}
                      onChange={(e) => updateField('cdm_role', e.target.value)}
                      className="w-full px-3 py-2.5 border border-surface-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 bg-white"
                    >
                      <option value="">Select role...</option>
                      <option value="client">Client</option>
                      <option value="designer">Designer</option>
                      <option value="principal_designer">Principal Designer</option>
                      <option value="contractor">Contractor</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] text-ink-400 uppercase tracking-[0.08em] font-semibold block mb-2">Building Regulations Route</label>
                    <select
                      value={formData.building_regs_route}
                      onChange={(e) => updateField('building_regs_route', e.target.value)}
                      className="w-full px-3 py-2.5 border border-surface-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 bg-white"
                    >
                      <option value="">Select route...</option>
                      <option value="full_plans">Full Plans</option>
                      <option value="building_notice">Building Notice</option>
                      <option value="initial_notice">Initial Notice</option>
                      <option value="regularisation">Regularisation</option>
                    </select>
                  </div>
                </>
              )}

              {currentStep === 9 && (
                <div className="py-8 text-center">
                  <p className="text-sm text-slate-600">Dutyholder appointments will be configured after project creation</p>
                </div>
              )}

              {currentStep === 10 && (
                <div className="py-8 text-center">
                  <p className="text-sm text-slate-600">Document templates selected from practice library</p>
                </div>
              )}

              {currentStep === 11 && (
                <div className="py-8 text-center">
                  <p className="text-sm text-slate-600">Integration links configured in Settings → Integrations</p>
                </div>
              )}

              {currentStep === 12 && (
                <div className="space-y-4">
                  <p className="text-sm text-slate-600 font-medium">Review all project details before creating</p>
                  <div className="bg-surface-50 rounded-lg p-4 space-y-2 text-sm">
                    <div className="flex justify-between"><span className="text-slate-600">Project Name:</span><span className="font-medium text-slate-900">{formData.name || '—'}</span></div>
                    <div className="flex justify-between"><span className="text-slate-600">Client:</span><span className="font-medium text-slate-900">{formData.client || '—'}</span></div>
                    <div className="flex justify-between"><span className="text-slate-600">Sector:</span><span className="font-medium text-slate-900">{formData.sector || '—'}</span></div>
                    <div className="flex justify-between"><span className="text-slate-600">RIBA Stage:</span><span className="font-medium text-slate-900">{RIBA_STAGES[formData.current_stage]}</span></div>
                    <div className="flex justify-between"><span className="text-slate-600">Project Lead:</span><span className="font-medium text-slate-900">{USERS.find(u => u.id === formData.project_lead)?.name || '—'}</span></div>
                  </div>
                </div>
              )}
            </div>

            {/* Divider */}
            <div className="border-t border-surface-200/60" />

            {/* Button Group */}
            <div className="flex items-center justify-between gap-3">
              <button
                onClick={handlePrevious}
                disabled={currentStep === 1}
                className={cn(
                  'px-4 py-2.5 text-sm font-medium rounded-lg transition-colors',
                  currentStep === 1
                    ? 'text-slate-400 cursor-not-allowed'
                    : 'text-slate-700 hover:text-slate-900 hover:bg-surface-50'
                )}
              >
                Previous
              </button>

              <div className="flex items-center gap-3">
                {canSkip && !isLastStep && (
                  <button
                    onClick={handleSkip}
                    className="px-4 py-2.5 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-surface-50 rounded-lg transition-colors"
                  >
                    Skip
                  </button>
                )}
                <button
                  onClick={handleNext}
                  className="px-6 py-2.5 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 transition-colors shadow-sm"
                >
                  {isLastStep ? 'Create Project' : 'Next'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import {
  AlertCircle,
  Banknote,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  FileText,
  Heart,
  Loader2,
  Lock,
  PartyPopper,
  Phone,
  Shield,
  User,
} from 'lucide-react'
import { useToast } from '@/components/Toast'

// ────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────

type StepName = 'PERSONAL_DETAILS' | 'BANK_DETAILS' | 'HMO_ENROLMENT' | 'DOCUMENT_UPLOAD'

interface StepInfo {
  id: string
  step: StepName
  title: string
  status: string
  completedAt: string | null
}

interface VerifyResponse {
  data: {
    tokenId: string
    employee: {
      id: string
      fullName: string
      email: string
      jobTitle: string | null
      startDate: string | null
    }
    organisation: { id: string; name: string }
    managerName: string | null
    expiresAt: string
    steps: StepInfo[]
    allCompleted: boolean
  }
}

// Step config
const STEP_CONFIG: Record<StepName, { icon: typeof User; label: string; description: string }> = {
  PERSONAL_DETAILS: {
    icon: User,
    label: 'Personal Details',
    description: 'Confirm your name, phone, and emergency contact',
  },
  BANK_DETAILS: {
    icon: Banknote,
    label: 'Bank Details',
    description: 'Add your bank account for payroll',
  },
  HMO_ENROLMENT: {
    icon: Heart,
    label: 'Health Insurance',
    description: 'Enrol in your health plan and add dependants',
  },
  DOCUMENT_UPLOAD: {
    icon: FileText,
    label: 'Documents',
    description: 'Review and acknowledge required documents',
  },
}

// ────────────────────────────────────────────────────────
// Main page component
// ────────────────────────────────────────────────────────

export default function SelfServiceWelcomePage() {
  const params = useParams()
  const token = typeof params.token === 'string' ? params.token : ''
  const { toast } = useToast()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<VerifyResponse['data'] | null>(null)
  const [activeStep, setActiveStep] = useState<StepName | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Verify token on mount
  useEffect(() => {
    if (!token) return
    fetch(`/api/onboarding/self-service/verify?token=${token}`)
      .then(async (res) => {
        const json = await res.json()
        if (!res.ok) throw new Error(json.error || 'Invalid link')
        setData(json.data)
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false))
  }, [token])

  // Refresh progress
  const refreshProgress = useCallback(async () => {
    try {
      const res = await fetch(`/api/onboarding/self-service/verify?token=${token}`)
      const json = await res.json()
      if (res.ok) setData(json.data)
    } catch { /* silent */ }
  }, [token])

  // Submit step
  const submitStep = useCallback(async (step: StepName, stepData: Record<string, unknown>) => {
    setSubmitting(true)
    try {
      const res = await fetch('/api/onboarding/self-service/steps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, step, data: stepData }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to save')
      toast('Step completed successfully', 'success')
      setActiveStep(null)
      await refreshProgress()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to save'
      toast(message, 'error')
    } finally {
      setSubmitting(false)
    }
  }, [token, toast, refreshProgress])

  // ── Loading state ──
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-3" />
          <p className="text-gray-500">Verifying your invitation...</p>
        </div>
      </div>
    )
  }

  // ── Error state ──
  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 max-w-md w-full text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Unable to load onboarding</h1>
          <p className="text-gray-500 mb-6">{error || 'Something went wrong. Please try again or contact your HR team.'}</p>
          <a href="mailto:support@coordin.io" className="text-blue-600 hover:underline text-sm">
            Contact support
          </a>
        </div>
      </div>
    )
  }

  // ── All complete ──
  if (data.allCompleted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 max-w-md w-full text-center">
          <PartyPopper className="h-12 w-12 text-green-500 mx-auto mb-4" />
          <h1 className="text-xl font-semibold text-gray-900 mb-2">You&apos;re all set!</h1>
          <p className="text-gray-500 mb-2">
            All onboarding steps are complete. Your HR team has been notified.
          </p>
          <p className="text-sm text-gray-400">
            Welcome to {data.organisation.name}!
          </p>
        </div>
      </div>
    )
  }

  const completedCount = data.steps.filter((s) => s.status === 'COMPLETED').length
  const totalCount = data.steps.length
  const progressPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-2xl mx-auto px-4 py-4 sm:py-6">
          <div className="flex items-center gap-3 mb-1">
            <Shield className="h-6 w-6 text-blue-600 flex-shrink-0" />
            <h1 className="text-lg sm:text-xl font-semibold text-gray-900">{data.organisation.name}</h1>
          </div>
          <p className="text-gray-500 text-sm sm:text-base">
            Welcome{data.employee.fullName ? `, ${data.employee.fullName}` : ''}! Complete these steps to finish your onboarding.
          </p>
          {data.managerName && (
            <p className="text-xs text-gray-400 mt-1">
              Your manager: {data.managerName}
            </p>
          )}
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 sm:py-8">
        {/* GDPR notice */}
        <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 mb-6 text-xs text-blue-700">
          <Lock className="h-3.5 w-3.5 inline-block mr-1.5 -mt-0.5" />
          Your information is processed under Article 6(1)(b) GDPR for employment purposes.
          Bank details are encrypted and stored securely.
        </div>

        {/* Progress bar */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">{completedCount} of {totalCount} steps complete</span>
            <span className="text-sm text-gray-500">{progressPct}%</span>
          </div>
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-600 rounded-full transition-all duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        {/* Expiry notice */}
        <div className="flex items-center gap-2 text-xs text-gray-400 mb-6">
          <Clock className="h-3.5 w-3.5" />
          <span>This link expires {new Date(data.expiresAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
        </div>

        {/* Step cards */}
        <div className="space-y-3">
          {data.steps.map((step) => {
            const config = STEP_CONFIG[step.step as StepName]
            if (!config) return null
            const isCompleted = step.status === 'COMPLETED'
            const isActive = activeStep === step.step
            const Icon = config.icon

            return (
              <div key={step.id}>
                <button
                  onClick={() => {
                    if (isCompleted) return
                    setActiveStep(isActive ? null : (step.step as StepName))
                  }}
                  disabled={isCompleted}
                  className={`w-full text-left rounded-lg border p-4 transition-all ${
                    isCompleted
                      ? 'bg-green-50 border-green-200 cursor-default'
                      : isActive
                        ? 'bg-white border-blue-300 shadow-sm ring-1 ring-blue-100'
                        : 'bg-white border-gray-200 hover:border-gray-300 hover:shadow-sm'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`flex-shrink-0 h-10 w-10 rounded-full flex items-center justify-center ${
                      isCompleted ? 'bg-green-100' : isActive ? 'bg-blue-100' : 'bg-gray-100'
                    }`}>
                      {isCompleted ? (
                        <Check className="h-5 w-5 text-green-600" />
                      ) : (
                        <Icon className={`h-5 w-5 ${isActive ? 'text-blue-600' : 'text-gray-500'}`} />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`font-medium text-sm ${isCompleted ? 'text-green-700' : 'text-gray-900'}`}>
                        {config.label}
                      </p>
                      <p className={`text-xs ${isCompleted ? 'text-green-600' : 'text-gray-500'}`}>
                        {isCompleted ? 'Completed' : config.description}
                      </p>
                    </div>
                    {!isCompleted && (
                      <ChevronRight className={`h-4 w-4 text-gray-400 transition-transform ${isActive ? 'rotate-90' : ''}`} />
                    )}
                    {isCompleted && (
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                    )}
                  </div>
                </button>

                {/* Step form — expanded */}
                {isActive && !isCompleted && (
                  <div className="mt-2 bg-white border border-gray-200 rounded-lg p-4 sm:p-6">
                    <StepForm
                      step={step.step as StepName}
                      submitting={submitting}
                      onSubmit={(formData) => submitStep(step.step as StepName, formData)}
                      onCancel={() => setActiveStep(null)}
                    />
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Help text */}
        <p className="text-xs text-gray-400 text-center mt-8">
          Having trouble? Contact your HR team or email{' '}
          <a href="mailto:support@coordin.io" className="text-blue-500 hover:underline">support@coordin.io</a>
        </p>
      </main>
    </div>
  )
}

// ────────────────────────────────────────────────────────
// Step forms
// ────────────────────────────────────────────────────────

function StepForm({
  step,
  submitting,
  onSubmit,
  onCancel,
}: {
  step: StepName
  submitting: boolean
  onSubmit: (data: Record<string, unknown>) => void
  onCancel: () => void
}) {
  switch (step) {
    case 'PERSONAL_DETAILS':
      return <PersonalDetailsForm submitting={submitting} onSubmit={onSubmit} onCancel={onCancel} />
    case 'BANK_DETAILS':
      return <BankDetailsForm submitting={submitting} onSubmit={onSubmit} onCancel={onCancel} />
    case 'HMO_ENROLMENT':
      return <HmoEnrolmentForm submitting={submitting} onSubmit={onSubmit} onCancel={onCancel} />
    case 'DOCUMENT_UPLOAD':
      return <DocumentUploadForm submitting={submitting} onSubmit={onSubmit} onCancel={onCancel} />
  }
}

// Shared field component
function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  )
}

const inputClass = 'w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none'

// ── Personal Details ──
function PersonalDetailsForm({ submitting, onSubmit, onCancel }: { submitting: boolean; onSubmit: (d: Record<string, unknown>) => void; onCancel: () => void }) {
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [emergencyName, setEmergencyName] = useState('')
  const [emergencyPhone, setEmergencyPhone] = useState('')
  const [emergencyRelation, setEmergencyRelation] = useState('')

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit({ fullName, phone, emergencyName, emergencyPhone, emergencyRelation }) }} className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <User className="h-4 w-4 text-blue-600" />
        <h3 className="font-medium text-sm text-gray-900">Personal Details</h3>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Full Name" required>
          <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} className={inputClass} placeholder="Your full name" required />
        </Field>
        <Field label="Phone Number">
          <div className="relative">
            <Phone className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
            <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className={`${inputClass} pl-9`} placeholder="+44 7xxx xxx xxx" />
          </div>
        </Field>
      </div>

      <div className="border-t border-gray-100 pt-4 mt-4">
        <p className="text-xs text-gray-500 mb-3">Emergency Contact</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Field label="Name">
            <input type="text" value={emergencyName} onChange={(e) => setEmergencyName(e.target.value)} className={inputClass} placeholder="Contact name" />
          </Field>
          <Field label="Phone">
            <input type="tel" value={emergencyPhone} onChange={(e) => setEmergencyPhone(e.target.value)} className={inputClass} placeholder="Phone number" />
          </Field>
          <Field label="Relationship">
            <input type="text" value={emergencyRelation} onChange={(e) => setEmergencyRelation(e.target.value)} className={inputClass} placeholder="e.g. Spouse" />
          </Field>
        </div>
      </div>

      <FormButtons submitting={submitting} onCancel={onCancel} />
    </form>
  )
}

// ── Bank Details ──
function BankDetailsForm({ submitting, onSubmit, onCancel }: { submitting: boolean; onSubmit: (d: Record<string, unknown>) => void; onCancel: () => void }) {
  const [bankAccountName, setBankAccountName] = useState('')
  const [bankAccountNumber, setBankAccountNumber] = useState('')
  const [bankSortCode, setBankSortCode] = useState('')
  const [bankName, setBankName] = useState('')

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit({ bankAccountName, bankAccountNumber, bankSortCode, bankName }) }} className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <Banknote className="h-4 w-4 text-blue-600" />
        <h3 className="font-medium text-sm text-gray-900">Bank Details for Payroll</h3>
      </div>

      <div className="bg-amber-50 border border-amber-100 rounded-md p-3 text-xs text-amber-700">
        <Lock className="h-3.5 w-3.5 inline-block mr-1.5 -mt-0.5" />
        Your bank details are encrypted and stored securely. They will be reviewed by your HR team before being used for payroll.
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Account Holder Name" required>
          <input type="text" value={bankAccountName} onChange={(e) => setBankAccountName(e.target.value)} className={inputClass} placeholder="Name on account" required />
        </Field>
        <Field label="Bank Name">
          <input type="text" value={bankName} onChange={(e) => setBankName(e.target.value)} className={inputClass} placeholder="e.g. Barclays" />
        </Field>
        <Field label="Account Number" required>
          <input type="text" value={bankAccountNumber} onChange={(e) => setBankAccountNumber(e.target.value)} className={inputClass} placeholder="8-digit account number" maxLength={8} required />
        </Field>
        <Field label="Sort Code">
          <input type="text" value={bankSortCode} onChange={(e) => setBankSortCode(e.target.value)} className={inputClass} placeholder="XX-XX-XX" maxLength={8} />
        </Field>
      </div>

      <FormButtons submitting={submitting} onCancel={onCancel} />
    </form>
  )
}

// ── HMO Enrolment ──
function HmoEnrolmentForm({ submitting, onSubmit, onCancel }: { submitting: boolean; onSubmit: (d: Record<string, unknown>) => void; onCancel: () => void }) {
  const [hmoProvider, setHmoProvider] = useState('')
  const [hmoPlan, setHmoPlan] = useState('')
  const [dependants, setDependants] = useState(0)

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit({ hmoProvider, hmoPlan, dependants }) }} className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <Heart className="h-4 w-4 text-blue-600" />
        <h3 className="font-medium text-sm text-gray-900">Health Insurance (HMO) Enrolment</h3>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="HMO Provider">
          <input type="text" value={hmoProvider} onChange={(e) => setHmoProvider(e.target.value)} className={inputClass} placeholder="e.g. AXA Mansard" />
        </Field>
        <Field label="Plan Type">
          <input type="text" value={hmoPlan} onChange={(e) => setHmoPlan(e.target.value)} className={inputClass} placeholder="e.g. Family Plan" />
        </Field>
      </div>

      <Field label="Number of Dependants">
        <input type="number" min={0} max={20} value={dependants} onChange={(e) => setDependants(parseInt(e.target.value) || 0)} className={`${inputClass} w-32`} />
        <p className="text-xs text-gray-400 mt-1">Include spouse and children if applicable</p>
      </Field>

      <FormButtons submitting={submitting} onCancel={onCancel} />
    </form>
  )
}

// ── Document Upload ──
function DocumentUploadForm({ submitting, onSubmit, onCancel }: { submitting: boolean; onSubmit: (d: Record<string, unknown>) => void; onCancel: () => void }) {
  const [acknowledged, setAcknowledged] = useState(false)

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit({ acknowledgedDocuments: acknowledged ? ['all'] : [] }) }} className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <FileText className="h-4 w-4 text-blue-600" />
        <h3 className="font-medium text-sm text-gray-900">Required Documents</h3>
      </div>

      <p className="text-sm text-gray-500">
        Please review the following policies and acknowledge that you have read and understood them. Your HR team may also ask you to upload specific documents.
      </p>

      <div className="bg-gray-50 border border-gray-200 rounded-md p-4 space-y-3">
        <div className="flex items-start gap-3 text-sm text-gray-700">
          <FileText className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
          <span>Employee Handbook</span>
        </div>
        <div className="flex items-start gap-3 text-sm text-gray-700">
          <FileText className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
          <span>Health & Safety Policy</span>
        </div>
        <div className="flex items-start gap-3 text-sm text-gray-700">
          <FileText className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
          <span>Data Protection & Privacy Notice</span>
        </div>
        <div className="flex items-start gap-3 text-sm text-gray-700">
          <FileText className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
          <span>IT Acceptable Use Policy</span>
        </div>
      </div>

      <label className="flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={acknowledged}
          onChange={(e) => setAcknowledged(e.target.checked)}
          className="mt-1 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
        />
        <span className="text-sm text-gray-700">
          I confirm that I have read and understood all the above policies and documents.
        </span>
      </label>

      <FormButtons submitting={submitting} onCancel={onCancel} disabled={!acknowledged} />
    </form>
  )
}

// Shared submit/cancel buttons
function FormButtons({ submitting, onCancel, disabled }: { submitting: boolean; onCancel: () => void; disabled?: boolean }) {
  return (
    <div className="flex items-center justify-end gap-3 pt-2">
      <button type="button" onClick={onCancel} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">
        Cancel
      </button>
      <button
        type="submit"
        disabled={submitting || disabled}
        className="px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
      >
        {submitting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Saving...
          </>
        ) : (
          'Save & Continue'
        )}
      </button>
    </div>
  )
}

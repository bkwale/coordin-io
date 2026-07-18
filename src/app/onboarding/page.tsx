'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  AlertCircle,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  FileText,
  GraduationCap,
  Loader2,
  PartyPopper,
  ShieldCheck,
  User,
} from 'lucide-react'

// ────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────

type OnboardingStep = 'welcome' | 'policies' | 'training' | 'profile' | 'complete'

type StepProgress = {
  welcome: { completed: boolean }
  policies: { completed: boolean; total: number; acknowledged: number }
  training: { completed: boolean; total: number; done: number }
  profile: { completed: boolean; fieldsComplete: number; fieldsTotal: number }
}

type PolicyItem = {
  id: string
  title: string
  category: string
  revision: string
  mandatory: boolean
  content: string | null
  fileUrl: string | null
  acknowledged: boolean
  acknowledgedAt: string | null
  openedAt: string | null
}

type TrainingItem = {
  id: string
  title: string
  description: string | null
  mandatory: boolean
  durationMinutes: number | null
  contentUrl: string | null
  completed: boolean
  completedAt: string | null
  score: number | null
}

// ────────────────────────────────────────────────────────
// Constants
// ────────────────────────────────────────────────────────

const STEPS: { key: OnboardingStep; label: string; icon: typeof FileText }[] = [
  { key: 'welcome', label: 'Welcome', icon: PartyPopper },
  { key: 'policies', label: 'Policies', icon: FileText },
  { key: 'training', label: 'Training', icon: GraduationCap },
  { key: 'profile', label: 'Profile', icon: User },
  { key: 'complete', label: 'Complete', icon: CheckCircle2 },
]

// ────────────────────────────────────────────────────────
// Component
// ────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState<OnboardingStep>('welcome')
  const [progress, setProgress] = useState<StepProgress | null>(null)
  const [policies, setPolicies] = useState<PolicyItem[]>([])
  const [training, setTraining] = useState<TrainingItem[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [profileForm, setProfileForm] = useState({
    phone: '',
    emergencyName: '',
    emergencyPhone: '',
  })
  const [completing, setCompleting] = useState(false)

  // ── Fetch progress ────────────────────────────────────
  const fetchProgress = useCallback(async () => {
    try {
      const res = await fetch('/api/onboarding')
      if (!res.ok) throw new Error('Failed to load onboarding progress')
      const json = await res.json()
      setProgress(json.data?.steps ?? json.steps)
    } catch {
      setError('Could not load your onboarding progress. Please refresh.')
    }
  }, [])

  // ── Fetch policies ────────────────────────────────────
  const fetchPolicies = useCallback(async () => {
    try {
      const res = await fetch('/api/onboarding/policies')
      if (!res.ok) throw new Error('Failed to load policies')
      const json = await res.json()
      setPolicies(json.data?.policies ?? json.policies ?? [])
    } catch {
      setError('Could not load policies.')
    }
  }, [])

  // ── Fetch training ────────────────────────────────────
  const fetchTraining = useCallback(async () => {
    try {
      const res = await fetch('/api/onboarding/training')
      if (!res.ok) throw new Error('Failed to load training')
      const json = await res.json()
      setTraining(json.data?.training ?? json.training ?? [])
    } catch {
      setError('Could not load training items.')
    }
  }, [])

  // ── Initial load ──────────────────────────────────────
  useEffect(() => {
    async function init() {
      setLoading(true)
      await Promise.all([fetchProgress(), fetchPolicies(), fetchTraining()])
      setLoading(false)
    }
    init()
  }, [fetchProgress, fetchPolicies, fetchTraining])

  // ── Acknowledge a policy ──────────────────────────────
  async function acknowledgePolicy(policyId: string) {
    setActionLoading(policyId)
    setError('')
    try {
      // Mark as opened first
      await fetch(`/api/onboarding/policies/${policyId}/open`, { method: 'POST' })
      // Then acknowledge
      const res = await fetch(`/api/onboarding/policies/${policyId}/acknowledge`, {
        method: 'POST',
      })
      if (!res.ok) {
        const json = await res.json()
        throw new Error(json.error || 'Failed to acknowledge policy')
      }
      // Refresh data
      await Promise.all([fetchPolicies(), fetchProgress()])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setActionLoading(null)
    }
  }

  // ── Complete a training item ──────────────────────────
  async function completeTraining(trainingId: string) {
    setActionLoading(trainingId)
    setError('')
    try {
      const res = await fetch(`/api/onboarding/training/${trainingId}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      if (!res.ok) {
        const json = await res.json()
        throw new Error(json.error || 'Failed to complete training')
      }
      await Promise.all([fetchTraining(), fetchProgress()])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setActionLoading(null)
    }
  }

  // ── Complete onboarding ───────────────────────────────
  async function finishOnboarding() {
    setCompleting(true)
    setError('')
    try {
      const res = await fetch('/api/onboarding/complete', { method: 'POST' })
      if (!res.ok) {
        const json = await res.json()
        throw new Error(json.error || 'Could not complete onboarding')
      }
      setCurrentStep('complete')
      setTimeout(() => router.push('/dashboard'), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setCompleting(false)
    }
  }

  // ── Step navigation ───────────────────────────────────
  const stepIndex = STEPS.findIndex((s) => s.key === currentStep)

  function goNext() {
    if (stepIndex < STEPS.length - 1) {
      setCurrentStep(STEPS[stepIndex + 1].key)
      setError('')
    }
  }

  function goBack() {
    if (stepIndex > 0) {
      setCurrentStep(STEPS[stepIndex - 1].key)
      setError('')
    }
  }

  // ── Can proceed checks ────────────────────────────────
  const canProceedFromPolicies = progress?.policies?.completed ?? false
  const canProceedFromTraining = progress?.training?.completed ?? false
  const canFinish = canProceedFromPolicies && canProceedFromTraining

  // ── Loading state ─────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-surface-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-accent-500 animate-spin mx-auto mb-3" />
          <p className="text-ink-500 text-[14px]">Loading your onboarding...</p>
        </div>
      </div>
    )
  }

  // ── Complete state ────────────────────────────────────
  if (currentStep === 'complete') {
    return (
      <div className="min-h-screen bg-surface-50 flex items-center justify-center px-6">
        <div className="text-center max-w-md animate-fade-in">
          <div className="w-16 h-16 rounded-full bg-gradient-success flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-8 h-8 text-white" />
          </div>
          <h1 className="font-display text-display text-ink-900 mb-3">You&apos;re all set</h1>
          <p className="text-ink-500 text-[15px] leading-relaxed mb-6">
            Onboarding complete. Your account is now active and you can access all assigned projects and tasks.
          </p>
          <p className="text-ink-400 text-[13px]">Redirecting to your dashboard...</p>
        </div>
      </div>
    )
  }

  // ── Main wizard ───────────────────────────────────────
  return (
    <div className="min-h-screen bg-surface-50">
      {/* Header */}
      <header className="bg-white border-b border-surface-200">
        <div className="max-w-3xl mx-auto px-6 py-5 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-accent flex items-center justify-center text-white font-display text-base">
            C
          </div>
          <div>
            <span className="font-display text-[17px] text-ink-900">coordin.io</span>
            <span className="text-ink-400 text-[13px] ml-2">Onboarding</span>
          </div>
        </div>
      </header>

      {/* Progress bar */}
      <div className="bg-white border-b border-surface-200">
        <div className="max-w-3xl mx-auto px-6 py-4">
          <div className="flex items-center gap-1">
            {STEPS.map((step, i) => {
              const isActive = i === stepIndex
              const isDone = i < stepIndex
              const Icon = step.icon
              return (
                <div key={step.key} className="flex items-center flex-1 last:flex-none">
                  <button
                    onClick={() => {
                      if (isDone || isActive) {
                        setCurrentStep(step.key)
                        setError('')
                      }
                    }}
                    disabled={!isDone && !isActive}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[13px] font-medium transition-colors ${
                      isActive
                        ? 'bg-accent-50 text-accent-700'
                        : isDone
                        ? 'text-emerald-600 hover:bg-emerald-50 cursor-pointer'
                        : 'text-ink-300 cursor-default'
                    }`}
                  >
                    {isDone ? (
                      <Check className="w-4 h-4" />
                    ) : (
                      <Icon className="w-4 h-4" />
                    )}
                    <span className="hidden sm:inline">{step.label}</span>
                  </button>
                  {i < STEPS.length - 1 && (
                    <ChevronRight className={`w-4 h-4 mx-1 flex-shrink-0 ${
                      isDone ? 'text-emerald-300' : 'text-ink-200'
                    }`} />
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Content */}
      <main className="max-w-3xl mx-auto px-6 py-8">
        {/* Error banner */}
        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-red-700 text-[14px] font-medium">Something went wrong</p>
              <p className="text-red-600 text-[13px] mt-0.5">{error}</p>
            </div>
          </div>
        )}

        {/* ─── Welcome Step ───────────────────────────── */}
        {currentStep === 'welcome' && (
          <div className="animate-fade-in">
            <div className="bg-white rounded-2xl border border-surface-200 shadow-card overflow-hidden">
              <div className="px-8 pt-8 pb-6">
                <h1 className="font-display text-display text-ink-900 mb-3">
                  Welcome to the team
                </h1>
                <p className="text-ink-500 text-[15px] leading-relaxed max-w-lg">
                  Before you get started, we need to walk you through a few things. This should take about 15-20 minutes.
                </p>
              </div>

              <div className="px-8 pb-8">
                <div className="space-y-3">
                  <StepPreview
                    icon={FileText}
                    title="Read & acknowledge policies"
                    description={`${progress?.policies?.total ?? 0} mandatory documents to review`}
                    done={progress?.policies?.completed ?? false}
                  />
                  <StepPreview
                    icon={GraduationCap}
                    title="Complete training items"
                    description={`${progress?.training?.total ?? 0} training modules to complete`}
                    done={progress?.training?.completed ?? false}
                  />
                  <StepPreview
                    icon={User}
                    title="Set up your profile"
                    description="Emergency contact and personal details"
                    done={progress?.profile?.completed ?? false}
                  />
                </div>

                <button
                  onClick={goNext}
                  className="mt-6 bg-gradient-accent text-white font-semibold text-[14px] px-6 py-3 rounded-lg hover:opacity-90 transition-opacity flex items-center gap-2"
                >
                  Let&apos;s get started
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ─── Policies Step ──────────────────────────── */}
        {currentStep === 'policies' && (
          <div className="animate-fade-in">
            <div className="mb-6">
              <h2 className="font-display text-heading text-ink-900 mb-1">
                Policies &amp; Documents
              </h2>
              <p className="text-ink-500 text-[14px]">
                Read and acknowledge each mandatory policy.
                {progress?.policies && (
                  <span className="ml-1 text-ink-400">
                    ({progress.policies.acknowledged}/{progress.policies.total} done)
                  </span>
                )}
              </p>
            </div>

            <div className="space-y-3">
              {policies.map((policy) => (
                <div
                  key={policy.id}
                  className={`bg-white rounded-xl border shadow-card p-5 transition-all ${
                    policy.acknowledged
                      ? 'border-emerald-200 bg-emerald-50/30'
                      : 'border-surface-200'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1">
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${
                        policy.acknowledged
                          ? 'bg-emerald-100 text-emerald-600'
                          : 'bg-accent-50 text-accent-600'
                      }`}>
                        {policy.acknowledged ? (
                          <Check className="w-4 h-4" />
                        ) : (
                          <BookOpen className="w-4 h-4" />
                        )}
                      </div>
                      <div>
                        <h3 className="font-semibold text-[14px] text-ink-900">
                          {policy.title}
                        </h3>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[12px] text-ink-400 bg-surface-100 px-2 py-0.5 rounded">
                            {policy.category.replace(/_/g, ' ')}
                          </span>
                          <span className="text-[12px] text-ink-400">
                            Rev. {policy.revision}
                          </span>
                        </div>
                        {policy.content && (
                          <p className="text-[13px] text-ink-500 mt-2 leading-relaxed line-clamp-3">
                            {policy.content}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex-shrink-0">
                      {policy.acknowledged ? (
                        <div className="flex items-center gap-1.5 text-emerald-600 text-[13px] font-medium">
                          <ShieldCheck className="w-4 h-4" />
                          Acknowledged
                        </div>
                      ) : (
                        <button
                          onClick={() => acknowledgePolicy(policy.id)}
                          disabled={actionLoading === policy.id}
                          className="bg-accent-500 text-white text-[13px] font-semibold px-4 py-2 rounded-lg hover:bg-accent-600 transition-colors disabled:opacity-50 flex items-center gap-2"
                        >
                          {actionLoading === policy.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Check className="w-3.5 h-3.5" />
                          )}
                          Acknowledge
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {policies.length === 0 && (
              <div className="bg-white rounded-xl border border-surface-200 p-8 text-center">
                <FileText className="w-8 h-8 text-ink-300 mx-auto mb-2" />
                <p className="text-ink-400 text-[14px]">No mandatory policies found.</p>
              </div>
            )}

            <div className="flex items-center justify-between mt-8">
              <button
                onClick={goBack}
                className="text-ink-500 text-[14px] font-medium hover:text-ink-700 transition-colors"
              >
                Back
              </button>
              <button
                onClick={goNext}
                disabled={!canProceedFromPolicies}
                className="bg-gradient-accent text-white font-semibold text-[14px] px-6 py-3 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
              >
                Continue to Training
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ─── Training Step ──────────────────────────── */}
        {currentStep === 'training' && (
          <div className="animate-fade-in">
            <div className="mb-6">
              <h2 className="font-display text-heading text-ink-900 mb-1">
                Mandatory Training
              </h2>
              <p className="text-ink-500 text-[14px]">
                Complete each training module below.
                {progress?.training && (
                  <span className="ml-1 text-ink-400">
                    ({progress.training.done}/{progress.training.total} done)
                  </span>
                )}
              </p>
            </div>

            <div className="space-y-3">
              {training.map((item) => (
                <div
                  key={item.id}
                  className={`bg-white rounded-xl border shadow-card p-5 transition-all ${
                    item.completed
                      ? 'border-emerald-200 bg-emerald-50/30'
                      : 'border-surface-200'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1">
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${
                        item.completed
                          ? 'bg-emerald-100 text-emerald-600'
                          : 'bg-amber-50 text-amber-600'
                      }`}>
                        {item.completed ? (
                          <Check className="w-4 h-4" />
                        ) : (
                          <GraduationCap className="w-4 h-4" />
                        )}
                      </div>
                      <div>
                        <h3 className="font-semibold text-[14px] text-ink-900">
                          {item.title}
                        </h3>
                        {item.durationMinutes && (
                          <div className="flex items-center gap-1 mt-1 text-[12px] text-ink-400">
                            <Clock className="w-3.5 h-3.5" />
                            {item.durationMinutes} min
                          </div>
                        )}
                        {item.description && (
                          <p className="text-[13px] text-ink-500 mt-2 leading-relaxed">
                            {item.description}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex-shrink-0">
                      {item.completed ? (
                        <div className="flex items-center gap-1.5 text-emerald-600 text-[13px] font-medium">
                          <CheckCircle2 className="w-4 h-4" />
                          Completed
                        </div>
                      ) : (
                        <button
                          onClick={() => completeTraining(item.id)}
                          disabled={actionLoading === item.id}
                          className="bg-amber-500 text-white text-[13px] font-semibold px-4 py-2 rounded-lg hover:bg-amber-600 transition-colors disabled:opacity-50 flex items-center gap-2"
                        >
                          {actionLoading === item.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Check className="w-3.5 h-3.5" />
                          )}
                          Mark Complete
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {training.length === 0 && (
              <div className="bg-white rounded-xl border border-surface-200 p-8 text-center">
                <GraduationCap className="w-8 h-8 text-ink-300 mx-auto mb-2" />
                <p className="text-ink-400 text-[14px]">No mandatory training items found.</p>
              </div>
            )}

            <div className="flex items-center justify-between mt-8">
              <button
                onClick={goBack}
                className="text-ink-500 text-[14px] font-medium hover:text-ink-700 transition-colors"
              >
                Back
              </button>
              <button
                onClick={goNext}
                disabled={!canProceedFromTraining}
                className="bg-gradient-accent text-white font-semibold text-[14px] px-6 py-3 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
              >
                Continue to Profile
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ─── Profile Step ───────────────────────────── */}
        {currentStep === 'profile' && (
          <div className="animate-fade-in">
            <div className="mb-6">
              <h2 className="font-display text-heading text-ink-900 mb-1">
                Complete Your Profile
              </h2>
              <p className="text-ink-500 text-[14px]">
                These details help us keep you safe on site and in the office. All fields are optional but recommended.
              </p>
            </div>

            <div className="bg-white rounded-2xl border border-surface-200 shadow-card p-6 space-y-5">
              <div>
                <label className="block text-[13px] font-semibold text-ink-700 mb-1.5">
                  Phone number
                </label>
                <input
                  type="tel"
                  value={profileForm.phone}
                  onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                  className="w-full px-3.5 py-2.5 border border-surface-300 rounded-lg text-[14px] focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-transparent"
                  placeholder="+234 801 234 5678"
                />
              </div>

              <div className="pt-3 border-t border-surface-200">
                <p className="text-[13px] font-semibold text-ink-700 mb-3">
                  Emergency Contact
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[13px] text-ink-500 mb-1.5">
                      Contact name
                    </label>
                    <input
                      type="text"
                      value={profileForm.emergencyName}
                      onChange={(e) => setProfileForm({ ...profileForm, emergencyName: e.target.value })}
                      className="w-full px-3.5 py-2.5 border border-surface-300 rounded-lg text-[14px] focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-transparent"
                      placeholder="Full name"
                    />
                  </div>
                  <div>
                    <label className="block text-[13px] text-ink-500 mb-1.5">
                      Contact phone
                    </label>
                    <input
                      type="tel"
                      value={profileForm.emergencyPhone}
                      onChange={(e) => setProfileForm({ ...profileForm, emergencyPhone: e.target.value })}
                      className="w-full px-3.5 py-2.5 border border-surface-300 rounded-lg text-[14px] focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-transparent"
                      placeholder="+234 801 234 5678"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between mt-8">
              <button
                onClick={goBack}
                className="text-ink-500 text-[14px] font-medium hover:text-ink-700 transition-colors"
              >
                Back
              </button>
              <button
                onClick={finishOnboarding}
                disabled={!canFinish || completing}
                className="bg-gradient-success text-white font-semibold text-[14px] px-6 py-3 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {completing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Completing...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    Complete Onboarding
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

// ────────────────────────────────────────────────────────
// Sub-components
// ────────────────────────────────────────────────────────

function StepPreview({
  icon: Icon,
  title,
  description,
  done,
}: {
  icon: typeof FileText
  title: string
  description: string
  done: boolean
}) {
  return (
    <div className={`flex items-center gap-4 p-4 rounded-xl border transition-colors ${
      done ? 'bg-emerald-50/50 border-emerald-200' : 'bg-surface-50 border-surface-200'
    }`}>
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
        done ? 'bg-emerald-100 text-emerald-600' : 'bg-accent-50 text-accent-500'
      }`}>
        {done ? <Check className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
      </div>
      <div className="flex-1">
        <h3 className={`font-semibold text-[14px] ${done ? 'text-emerald-700' : 'text-ink-900'}`}>
          {title}
        </h3>
        <p className="text-ink-400 text-[13px]">{description}</p>
      </div>
      {done && <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0" />}
    </div>
  )
}

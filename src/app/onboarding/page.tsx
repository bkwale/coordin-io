'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  AlertCircle,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Clock,
  FileText,
  GraduationCap,
  Loader2,
  PartyPopper,
  ShieldCheck,
  User,
} from 'lucide-react'
import { useToast } from '@/components/Toast'

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

type AssignmentData = {
  id: string
  templateId: string
  startDate: string
  status: string
  progress: number
  template: { id: string; name: string }
}

type OnboardingTask = {
  id: string
  title: string
  category: string
  stage: string
  status: string
  dueDate: string | null
  assigneeName: string
  completedAt: string | null
  evidenceUrl: string
  evidenceNote: string
  responsibleRole: string
  requiresEvidence: boolean
  requiresApproval: boolean
  description: string
  approvedAt: string | null
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

const STAGE_META: Record<string, { label: string; color: string }> = {
  BEFORE_START: { label: 'Before Start', color: 'bg-blue-100 text-blue-800' },
  DAY_ONE: { label: 'Day One', color: 'bg-green-100 text-green-800' },
  ROLE_SPECIFIC: { label: 'Role Specific', color: 'bg-purple-100 text-purple-800' },
  PROBATION: { label: 'Probation', color: 'bg-amber-100 text-amber-800' },
}

const TASK_STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-gray-100 text-gray-700',
  IN_PROGRESS: 'bg-blue-100 text-blue-700',
  COMPLETED: 'bg-green-100 text-green-700',
  OVERDUE: 'bg-red-100 text-red-700',
  WAIVED: 'bg-gray-100 text-gray-500',
}

// ────────────────────────────────────────────────────────
// Component
// ────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const router = useRouter()
  const { toast } = useToast()
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
  const [profileSaving, setProfileSaving] = useState(false)
  const [profileSaved, setProfileSaved] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  // Template-based onboarding state
  const [hasAssignment, setHasAssignment] = useState(false)
  const [assignment, setAssignment] = useState<AssignmentData | null>(null)
  const [groupedTasks, setGroupedTasks] = useState<Record<string, OnboardingTask[]>>({})

  // ── Check for template assignment ─────────────────────
  const checkAssignment = useCallback(async () => {
    try {
      const res = await fetch('/api/onboarding/assignments?mine=true&status=ACTIVE')
      if (!res.ok) return false
      const json = await res.json()
      const assignments = json.data?.assignments ?? []
      if (assignments.length > 0) {
        setHasAssignment(true)
        setAssignment(assignments[0])
        return true
      }
      return false
    } catch {
      return false
    }
  }, [])

  // ── Fetch assignment tasks ────────────────────────────
  const fetchAssignmentTasks = useCallback(async (assignmentId: string) => {
    try {
      const res = await fetch(`/api/onboarding/assignments/${assignmentId}/tasks`)
      if (!res.ok) return
      const json = await res.json()
      setGroupedTasks(json.data?.tasks ?? {})
      // Update assignment progress from response
      if (json.data?.assignment) {
        setAssignment((prev) => prev ? { ...prev, progress: json.data.assignment.progress, status: json.data.assignment.status } : prev)
      }
    } catch {
      // Non-fatal
    }
  }, [])

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

  // ── Phone validation ──────────────────────────────────
  function validatePhone(value: string): string | null {
    if (!value.trim()) return null // optional field
    // Allow digits, spaces, hyphens, parentheses, plus sign, dots
    const cleaned = value.replace(/[\s\-().]/g, '')
    if (!/^\+?\d{7,15}$/.test(cleaned)) {
      return 'Enter a valid phone number (e.g. +44 7911 123456, 07911123456, or +234 801 234 5678)'
    }
    return null
  }

  // ── Save profile independently ──────────────────────
  async function saveProfile() {
    setProfileSaving(true)
    setError('')
    setFieldErrors({})

    // Validate fields
    const errors: Record<string, string> = {}
    const phoneError = validatePhone(profileForm.phone)
    if (phoneError) errors.phone = phoneError
    const emergencyPhoneError = validatePhone(profileForm.emergencyPhone)
    if (emergencyPhoneError) errors.emergencyPhone = emergencyPhoneError

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      setProfileSaving(false)
      return false
    }

    try {
      const res = await fetch('/api/settings/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: profileForm.phone || undefined,
          emergencyContactName: profileForm.emergencyName || undefined,
          emergencyContactPhone: profileForm.emergencyPhone || undefined,
        }),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        const msg = json.error?.message || json.error || 'Failed to save profile'
        throw new Error(msg)
      }
      setProfileSaved(true)
      toast('Profile saved', 'success')
      return true
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to save profile'
      setError(msg)
      return false
    } finally {
      setProfileSaving(false)
    }
  }

  // ── Initial load ──────────────────────────────────────
  useEffect(() => {
    async function init() {
      setLoading(true)
      // Check for template-based assignment first
      const hasTemplateBased = await checkAssignment()
      if (!hasTemplateBased) {
        // Fall back to legacy wizard
        await Promise.all([fetchProgress(), fetchPolicies(), fetchTraining()])
      }
      setLoading(false)
    }
    init()
  }, [checkAssignment, fetchProgress, fetchPolicies, fetchTraining])

  // Load tasks when assignment is available
  useEffect(() => {
    if (assignment?.id) {
      fetchAssignmentTasks(assignment.id)
    }
  }, [assignment?.id, fetchAssignmentTasks])

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
    setFieldErrors({})

    // Save profile data first
    const profileOk = await saveProfile()
    if (!profileOk) {
      setCompleting(false)
      return
    }

    try {
      const res = await fetch('/api/onboarding/complete', { method: 'POST' })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        const detail = json.error?.message || json.error || 'Could not complete onboarding'
        const missing = json.error?.details?.missing
        if (missing && Array.isArray(missing)) {
          throw new Error(`Onboarding incomplete: ${missing.join('; ')}`)
        }
        throw new Error(detail)
      }
      setCurrentStep('complete')
      setTimeout(() => router.push('/dashboard'), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not complete onboarding')
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

  // ── Handle task update (employee) ────────────────────
  async function handleTaskAction(taskId: string, updates: Record<string, unknown>) {
    if (!assignment) return
    setActionLoading(taskId)
    try {
      const res = await fetch(`/api/onboarding/assignments/${assignment.id}/tasks`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId, ...updates }),
      })
      if (!res.ok) {
        const json = await res.json()
        throw new Error(json.error || 'Failed to update task')
      }
      toast('Task updated', 'success')
      await fetchAssignmentTasks(assignment.id)
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to update task', 'error')
    } finally {
      setActionLoading(null)
    }
  }

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

  // ── Template-based onboarding view ────────────────────
  if (hasAssignment && assignment) {
    const stageOrder = ['BEFORE_START', 'DAY_ONE', 'ROLE_SPECIFIC', 'PROBATION']
    const allTasks = stageOrder.flatMap((s) => groupedTasks[s] ?? [])
    const completedCount = allTasks.filter((t) => t.status === 'COMPLETED' || t.status === 'WAIVED').length
    const totalCount = allTasks.length
    const progressPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0

    return (
      <div className="min-h-screen bg-surface-50">
        <header className="bg-white border-b border-surface-200">
          <div className="max-w-3xl mx-auto px-6 py-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-accent flex items-center justify-center text-white font-display text-base">
                C
              </div>
              <div>
                <span className="font-display text-[17px] text-ink-900">coordin.io</span>
                <span className="text-ink-400 text-[13px] ml-2">Onboarding</span>
              </div>
            </div>
            <h1 className="font-display text-[20px] text-ink-900 mb-1">{assignment.template.name}</h1>
            <p className="text-ink-400 text-[13px]">
              Started {new Date(assignment.startDate).toLocaleDateString()} &middot; {completedCount}/{totalCount} tasks complete
            </p>
            {/* Progress bar */}
            <div className="mt-3 flex items-center gap-3">
              <div className="flex-1 h-2.5 bg-surface-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${progressPct === 100 ? 'bg-emerald-500' : 'bg-accent-500'}`}
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <span className="text-[13px] font-semibold text-ink-700 w-12 text-right">{progressPct}%</span>
            </div>
          </div>
        </header>

        <main className="max-w-3xl mx-auto px-6 py-8 space-y-6">
          {stageOrder.map((stageKey) => {
            const tasks = groupedTasks[stageKey] ?? []
            if (tasks.length === 0) return null
            const meta = STAGE_META[stageKey] ?? { label: stageKey, color: 'bg-gray-100 text-gray-700' }
            const stageCompleted = tasks.filter((t) => t.status === 'COMPLETED' || t.status === 'WAIVED').length
            return (
              <div key={stageKey}>
                <div className="flex items-center justify-between mb-3">
                  <span className={`text-[12px] font-semibold px-2.5 py-1 rounded ${meta.color}`}>
                    {meta.label}
                  </span>
                  <span className="text-[12px] text-ink-400">{stageCompleted}/{tasks.length} complete</span>
                </div>
                <div className="space-y-2">
                  {tasks.map((task) => {
                    const isDone = task.status === 'COMPLETED' || task.status === 'WAIVED'
                    const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && !isDone
                    return (
                      <div
                        key={task.id}
                        className={`bg-white rounded-xl border shadow-card p-4 transition-all ${
                          isDone ? 'border-emerald-200 bg-emerald-50/30' : isOverdue ? 'border-red-200' : 'border-surface-200'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-start gap-3 flex-1">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${
                              isDone ? 'bg-emerald-100 text-emerald-600' : isOverdue ? 'bg-red-100 text-red-600' : 'bg-accent-50 text-accent-600'
                            }`}>
                              {isDone ? <Check className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
                            </div>
                            <div>
                              <h3 className="font-semibold text-[14px] text-ink-900">{task.title}</h3>
                              {task.description !== 'Not provided' && (
                                <p className="text-[13px] text-ink-500 mt-1">{task.description}</p>
                              )}
                              <div className="flex items-center gap-3 mt-1.5 text-[12px] text-ink-400">
                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${TASK_STATUS_COLORS[task.status] ?? 'bg-gray-100 text-gray-700'}`}>
                                  {task.status}
                                </span>
                                {task.dueDate && (
                                  <span className={isOverdue ? 'text-red-600 font-medium' : ''}>
                                    Due: {new Date(task.dueDate).toLocaleDateString()}
                                  </span>
                                )}
                                {task.category !== 'Not provided' && <span>{task.category}</span>}
                                {task.responsibleRole !== 'Not provided' && <span>{task.responsibleRole}</span>}
                                {task.requiresEvidence && <span className="text-amber-600">Evidence required</span>}
                              </div>
                              {task.evidenceUrl !== 'Not provided' && (
                                <div className="mt-1.5 text-[12px] text-blue-600">
                                  <a href={task.evidenceUrl} target="_blank" rel="noopener noreferrer" className="hover:underline">View evidence</a>
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="flex-shrink-0 flex items-center gap-2">
                            {!isDone && task.responsibleRole === 'EMPLOYEE' && (
                              <>
                                {task.status === 'PENDING' && (
                                  <button
                                    onClick={() => handleTaskAction(task.id, { status: 'IN_PROGRESS' })}
                                    disabled={actionLoading === task.id}
                                    className="text-accent-600 text-[13px] font-semibold px-3 py-1.5 rounded-lg hover:bg-accent-50 transition-colors disabled:opacity-50 flex items-center gap-1.5"
                                  >
                                    {actionLoading === task.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ChevronRight className="w-3.5 h-3.5" />}
                                    Start
                                  </button>
                                )}
                                {(task.status === 'IN_PROGRESS' || task.status === 'OVERDUE') && (
                                  <button
                                    onClick={() => handleTaskAction(task.id, { status: 'COMPLETED' })}
                                    disabled={actionLoading === task.id}
                                    className="bg-emerald-500 text-white text-[13px] font-semibold px-3 py-1.5 rounded-lg hover:bg-emerald-600 transition-colors disabled:opacity-50 flex items-center gap-1.5"
                                  >
                                    {actionLoading === task.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                                    Complete
                                  </button>
                                )}
                              </>
                            )}
                            {isDone && (
                              <div className="flex items-center gap-1.5 text-emerald-600 text-[13px] font-medium">
                                <CheckCircle2 className="w-4 h-4" />
                                Done
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}

          {totalCount === 0 && (
            <div className="bg-white rounded-xl border border-surface-200 p-8 text-center">
              <ClipboardList className="w-8 h-8 text-ink-300 mx-auto mb-2" />
              <p className="text-ink-400 text-[14px]">No onboarding tasks have been set up yet.</p>
            </div>
          )}
        </main>
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
              <p className="text-red-700 text-[14px] font-medium">
                {error.startsWith('Onboarding incomplete') ? 'Onboarding incomplete' :
                 error.startsWith('Enter a valid') ? 'Validation error' :
                 error.includes('Failed to save') ? 'Profile save failed' :
                 'An error occurred'}
              </p>
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
                  onChange={(e) => {
                    setProfileForm({ ...profileForm, phone: e.target.value })
                    setFieldErrors((prev) => { const next = { ...prev }; delete next.phone; return next })
                  }}
                  className={`w-full px-3.5 py-2.5 border rounded-lg text-[14px] focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-transparent ${fieldErrors.phone ? 'border-red-400' : 'border-surface-300'}`}
                  placeholder="+44 7911 123456 or 07911123456"
                />
                {fieldErrors.phone && (
                  <p className="text-red-600 text-[12px] mt-1">{fieldErrors.phone}</p>
                )}
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
                      onChange={(e) => {
                        setProfileForm({ ...profileForm, emergencyPhone: e.target.value })
                        setFieldErrors((prev) => { const next = { ...prev }; delete next.emergencyPhone; return next })
                      }}
                      className={`w-full px-3.5 py-2.5 border rounded-lg text-[14px] focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-transparent ${fieldErrors.emergencyPhone ? 'border-red-400' : 'border-surface-300'}`}
                      placeholder="+44 7911 123456 or 07911123456"
                    />
                    {fieldErrors.emergencyPhone && (
                      <p className="text-red-600 text-[12px] mt-1">{fieldErrors.emergencyPhone}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Save profile independently */}
              <div className="pt-3 border-t border-surface-200 flex items-center gap-3">
                <button
                  onClick={saveProfile}
                  disabled={profileSaving}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent-500 text-white text-[13px] font-semibold hover:bg-accent-600 transition-colors disabled:opacity-50"
                >
                  {profileSaving ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Check className="w-3.5 h-3.5" />
                  )}
                  Save profile
                </button>
                {profileSaved && (
                  <span className="text-emerald-600 text-[13px] font-medium flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4" /> Saved
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between mt-8">
              <div className="flex items-center gap-3">
                <button
                  onClick={goBack}
                  className="text-ink-500 text-[14px] font-medium hover:text-ink-700 transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={async () => {
                    await saveProfile()
                    toast('Progress saved — you can return to finish onboarding later', 'success')
                  }}
                  disabled={profileSaving}
                  className="text-ink-400 text-[13px] font-medium hover:text-ink-600 transition-colors underline underline-offset-2"
                >
                  Save and continue later
                </button>
              </div>
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

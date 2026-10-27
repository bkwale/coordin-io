'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  Users, RefreshCw, ClipboardList, UserCheck, Clock,
  ChevronDown, ChevronRight, Plus, X, Check, Trash2,
  FileText, AlertCircle, Loader2, Shield, Settings,
  Calendar, CheckCircle2, AlertTriangle, Edit2, Save,
  Building, MapPin, Send, Eye, FileCheck,
} from 'lucide-react'
import { SkeletonRow } from '@/components/Skeleton'
import { useToast } from '@/components/Toast'

/* ================================================================
   TYPES
   ================================================================ */

interface OfficeSummary {
  id: string
  name: string
  region: string | null
}

interface TemplateSummary {
  id: string
  name: string
  roleLevel: string
  description: string
  officeId: string | null
  region: string | null
  officeName: string | null
  isDefault: boolean
  isActive: boolean
  totalItems: number
  stageCounts: Record<string, number>
  assignmentCount: number
}

interface TemplateItem {
  id: string
  stage: string
  category: string | null
  title: string
  description: string | null
  responsibleRole: string | null
  daysFromStart: number
  requiresEvidence: boolean
  requiresApproval: boolean
  sortOrder: number
}

interface TemplateDetail {
  id: string
  name: string
  roleLevel: string
  description: string
  isDefault: boolean
  isActive: boolean
  totalItems: number
  groupedItems: Record<string, TemplateItem[]>
}

interface AssignmentSummary {
  id: string
  templateId: string
  profileId: string
  employee: {
    id: string
    fullName: string
    jobTitle: string | null
    email: string | null
    startDate: string | null
    avatarUrl: string | null
  }
  template: { id: string; name: string; roleLevel: string | null }
  startDate: string
  status: string
  progress: number
  completedAt: string | null
  taskSummary: { total: number; completed: number; overdue: number }
  stageBreakdown: Record<string, { total: number; completed: number }>
}

interface OnboardingTaskDetail {
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
  approvedByName: string
  approvedAt: string | null
  comment: string
  responsibleRole: string
  requiresEvidence: boolean
  requiresApproval: boolean
  description: string
  isAdHoc: boolean
  documentStatus: string | null
  documentSentAt: string | null
  documentViewedAt: string | null
  documentAcknowledgedAt: string | null
}

/* ================================================================
   CONSTANTS
   ================================================================ */

type TabKey = 'templates' | 'active' | 'probation'

const TABS: { key: TabKey; label: string; icon: React.ElementType }[] = [
  { key: 'templates', label: 'Templates', icon: ClipboardList },
  { key: 'active', label: 'Active Onboarding', icon: UserCheck },
  { key: 'probation', label: 'Probation', icon: Clock },
]

const STAGES = [
  { key: 'BEFORE_START', label: 'Before Start', color: 'bg-blue-100 text-blue-800' },
  { key: 'DAY_ONE', label: 'Day One', color: 'bg-green-100 text-green-800' },
  { key: 'ROLE_SPECIFIC', label: 'Role Specific', color: 'bg-purple-100 text-purple-800' },
  { key: 'PROBATION', label: 'Probation', color: 'bg-amber-100 text-amber-800' },
]

const RESPONSIBLE_ROLES = ['HR', 'MANAGER', 'IT', 'EMPLOYEE'] as const

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-gray-100 text-gray-700',
  IN_PROGRESS: 'bg-blue-100 text-blue-700',
  COMPLETED: 'bg-green-100 text-green-700',
  OVERDUE: 'bg-red-100 text-red-700',
  WAIVED: 'bg-gray-100 text-gray-500',
}

const DOC_STATUS_META: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  NOT_SENT: { label: 'Not Sent', color: 'bg-gray-100 text-gray-600', icon: FileText },
  SENT: { label: 'Sent', color: 'bg-blue-100 text-blue-700', icon: Send },
  VIEWED: { label: 'Viewed', color: 'bg-amber-100 text-amber-700', icon: Eye },
  ACKNOWLEDGED: { label: 'Acknowledged', color: 'bg-green-100 text-green-700', icon: FileCheck },
}

/* ================================================================
   COMPONENT
   ================================================================ */

export default function OnboardingManagePage() {
  const { toast } = useToast()
  const [activeTab, setActiveTab] = useState<TabKey>('templates')
  const [loading, setLoading] = useState(true)

  // Templates state
  const [templates, setTemplates] = useState<TemplateSummary[]>([])
  const [expandedTemplate, setExpandedTemplate] = useState<string | null>(null)
  const [templateDetail, setTemplateDetail] = useState<TemplateDetail | null>(null)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [createForm, setCreateForm] = useState({ name: '', roleLevel: '', description: '', officeId: '', region: '' })
  const [saving, setSaving] = useState(false)
  const [offices, setOffices] = useState<OfficeSummary[]>([])

  // Item add state
  const [addingItemStage, setAddingItemStage] = useState<string | null>(null)
  const [itemForm, setItemForm] = useState({
    title: '', category: '', responsibleRole: 'HR',
    daysFromStart: 0, requiresEvidence: false, requiresApproval: false,
  })

  // Assignments state
  const [assignments, setAssignments] = useState<AssignmentSummary[]>([])
  const [expandedAssignment, setExpandedAssignment] = useState<string | null>(null)
  const [assignmentTasks, setAssignmentTasks] = useState<Record<string, OnboardingTaskDetail[]> | null>(null)
  const [showAssignForm, setShowAssignForm] = useState(false)
  const [assignForm, setAssignForm] = useState({ templateId: '', profileId: '', startDate: '' })
  const [employees, setEmployees] = useState<{ id: string; fullName: string }[]>([])

  // Ad-hoc task state
  const [showAdHocForm, setShowAdHocForm] = useState<string | null>(null)
  const [adHocForm, setAdHocForm] = useState({
    title: '', stage: 'BEFORE_START', category: '', description: '',
    dueDate: '', notifyEmployee: true, acknowledgementRequired: false,
  })

  // Probation state
  const [probationReviews, setProbationReviews] = useState<{
    id: string; reviewType: string; scheduledDate: string; completedDate: string | null
    outcome: string | null; profile: { id: string; fullName: string; jobTitle: string | null; startDate: string | null }
  }[]>([])

  // ── Data fetching ────────────────────────────────────────

  const fetchTemplates = useCallback(async () => {
    try {
      const res = await fetch('/api/onboarding/templates')
      if (!res.ok) throw new Error('Failed to load templates')
      const json = await res.json()
      setTemplates(json.data?.templates ?? [])
    } catch {
      toast('Failed to load templates', 'error')
    }
  }, [toast])

  const fetchAssignments = useCallback(async () => {
    try {
      const res = await fetch('/api/onboarding/assignments')
      if (!res.ok) throw new Error('Failed to load assignments')
      const json = await res.json()
      setAssignments(json.data?.assignments ?? [])
    } catch {
      toast('Failed to load assignments', 'error')
    }
  }, [toast])

  const fetchProbation = useCallback(async () => {
    try {
      const res = await fetch('/api/staffing/probation?pending=true')
      if (!res.ok) throw new Error('Failed to load probation reviews')
      const json = await res.json()
      setProbationReviews(json.data?.reviews ?? [])
    } catch {
      toast('Failed to load probation reviews', 'error')
    }
  }, [toast])

  const fetchEmployees = useCallback(async () => {
    try {
      const res = await fetch('/api/staffing')
      if (!res.ok) return
      const json = await res.json()
      const emps = json.data?.employees ?? []
      setEmployees(emps.map((e: { id: string; fullName: string }) => ({ id: e.id, fullName: e.fullName })))
    } catch {
      // Non-fatal
    }
  }, [])

  const fetchOffices = useCallback(async () => {
    try {
      const res = await fetch('/api/settings/offices')
      if (!res.ok) return
      const json = await res.json()
      const list = json.data?.offices ?? []
      setOffices(list.map((o: { id: string; name: string; region: string | null }) => ({ id: o.id, name: o.name, region: o.region })))
    } catch {
      // Non-fatal
    }
  }, [])

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      // Safety timeout: never let loading stay stuck for more than 15s
      await Promise.race([
        Promise.all([fetchTemplates(), fetchAssignments(), fetchProbation(), fetchEmployees(), fetchOffices()]),
        new Promise((resolve) => setTimeout(resolve, 15000)),
      ])
    } catch {
      // Swallow — individual fetches handle their own errors
    }
    setLoading(false)
  }, [fetchTemplates, fetchAssignments, fetchProbation, fetchEmployees, fetchOffices])

  useEffect(() => { fetchAll() }, [fetchAll])

  // ── Template detail ──────────────────────────────────────

  const loadTemplateDetail = async (templateId: string) => {
    if (expandedTemplate === templateId) {
      setExpandedTemplate(null)
      setTemplateDetail(null)
      return
    }
    setExpandedTemplate(templateId)
    try {
      const res = await fetch(`/api/onboarding/templates/${templateId}`)
      if (!res.ok) throw new Error('Failed to load template')
      const json = await res.json()
      setTemplateDetail(json.data?.template ?? null)
    } catch {
      toast('Failed to load template details', 'error')
    }
  }

  // ── Create template ──────────────────────────────────────

  const handleCreateTemplate = async () => {
    if (!createForm.name.trim()) {
      toast('Template name is required', 'error')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/onboarding/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: createForm.name,
          roleLevel: createForm.roleLevel || null,
          description: createForm.description || null,
          officeId: createForm.officeId || null,
          region: createForm.region || null,
        }),
      })
      if (!res.ok) {
        const json = await res.json()
        throw new Error(json.error || 'Failed to create template')
      }
      toast('Template created', 'success')
      setShowCreateForm(false)
      setCreateForm({ name: '', roleLevel: '', description: '', officeId: '', region: '' })
      await fetchTemplates()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to create template', 'error')
    } finally {
      setSaving(false)
    }
  }

  // ── Delete template ──────────────────────────────────────

  const handleDeleteTemplate = async (templateId: string) => {
    try {
      const res = await fetch(`/api/onboarding/templates/${templateId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete')
      toast('Template deactivated', 'success')
      setExpandedTemplate(null)
      setTemplateDetail(null)
      await fetchTemplates()
    } catch {
      toast('Failed to deactivate template', 'error')
    }
  }

  // ── Set default template ─────────────────────────────────

  const handleSetDefault = async (templateId: string) => {
    try {
      const res = await fetch(`/api/onboarding/templates/${templateId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isDefault: true }),
      })
      if (!res.ok) throw new Error('Failed to set default')
      toast('Default template updated', 'success')
      await fetchTemplates()
    } catch {
      toast('Failed to set default template', 'error')
    }
  }

  // ── Add item to template ─────────────────────────────────

  const handleAddItem = async (templateId: string) => {
    if (!itemForm.title.trim()) {
      toast('Item title is required', 'error')
      return
    }
    if (!addingItemStage) return

    setSaving(true)
    try {
      const res = await fetch(`/api/onboarding/templates/${templateId}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stage: addingItemStage,
          title: itemForm.title,
          category: itemForm.category || null,
          responsibleRole: itemForm.responsibleRole,
          daysFromStart: itemForm.daysFromStart,
          requiresEvidence: itemForm.requiresEvidence,
          requiresApproval: itemForm.requiresApproval,
        }),
      })
      if (!res.ok) throw new Error('Failed to add item')
      toast('Item added', 'success')
      setAddingItemStage(null)
      setItemForm({ title: '', category: '', responsibleRole: 'HR', daysFromStart: 0, requiresEvidence: false, requiresApproval: false })
      await loadTemplateDetail(templateId)
      // Force re-expand to refresh
      setExpandedTemplate(null)
      setTimeout(() => loadTemplateDetail(templateId), 100)
      await fetchTemplates()
    } catch {
      toast('Failed to add item', 'error')
    } finally {
      setSaving(false)
    }
  }

  // ── Remove item ──────────────────────────────────────────

  const handleRemoveItem = async (templateId: string, itemId: string) => {
    try {
      const res = await fetch(`/api/onboarding/templates/${templateId}/items`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId }),
      })
      if (!res.ok) throw new Error('Failed to remove item')
      toast('Item removed', 'success')
      setExpandedTemplate(null)
      setTimeout(() => loadTemplateDetail(templateId), 100)
      await fetchTemplates()
    } catch {
      toast('Failed to remove item', 'error')
    }
  }

  // ── Assign template ──────────────────────────────────────

  const handleAssign = async () => {
    if (!assignForm.templateId || !assignForm.profileId || !assignForm.startDate) {
      toast('All fields are required', 'error')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/onboarding/assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(assignForm),
      })
      if (!res.ok) {
        const json = await res.json()
        throw new Error(json.error || 'Failed to assign template')
      }
      toast('Template assigned successfully', 'success')
      setShowAssignForm(false)
      setAssignForm({ templateId: '', profileId: '', startDate: '' })
      await fetchAssignments()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to assign template', 'error')
    } finally {
      setSaving(false)
    }
  }

  // ── Load assignment tasks ────────────────────────────────

  const loadAssignmentTasks = async (assignmentId: string) => {
    if (expandedAssignment === assignmentId) {
      setExpandedAssignment(null)
      setAssignmentTasks(null)
      return
    }
    setExpandedAssignment(assignmentId)
    try {
      const res = await fetch(`/api/onboarding/assignments/${assignmentId}/tasks`)
      if (!res.ok) throw new Error('Failed to load tasks')
      const json = await res.json()
      setAssignmentTasks(json.data?.tasks ?? null)
    } catch {
      toast('Failed to load tasks', 'error')
    }
  }

  // ── Update task ──────────────────────────────────────────

  const handleUpdateTask = async (assignmentId: string, taskId: string, updates: Record<string, unknown>) => {
    try {
      const res = await fetch(`/api/onboarding/assignments/${assignmentId}/tasks`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId, ...updates }),
      })
      if (!res.ok) {
        const json = await res.json()
        throw new Error(json.error || 'Failed to update task')
      }
      toast('Task updated', 'success')
      // Refresh tasks and assignments
      setExpandedAssignment(null)
      setTimeout(() => loadAssignmentTasks(assignmentId), 100)
      await fetchAssignments()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to update task', 'error')
    }
  }

  // ── Create ad-hoc task ───────────────────────────────────

  const handleCreateAdHocTask = async (assignmentId: string) => {
    if (!adHocForm.title.trim()) {
      toast('Task title is required', 'error')
      return
    }
    setSaving(true)
    try {
      const res = await fetch(`/api/onboarding/assignments/${assignmentId}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: adHocForm.title,
          stage: adHocForm.stage,
          category: adHocForm.category || null,
          description: adHocForm.description || null,
          dueDate: adHocForm.dueDate || null,
          notifyEmployee: adHocForm.notifyEmployee,
          acknowledgementRequired: adHocForm.acknowledgementRequired,
        }),
      })
      if (!res.ok) {
        const json = await res.json()
        throw new Error(json.error || 'Failed to create task')
      }
      toast('Ad-hoc task created', 'success')
      setShowAdHocForm(null)
      setAdHocForm({ title: '', stage: 'BEFORE_START', category: '', description: '', dueDate: '', notifyEmployee: true, acknowledgementRequired: false })
      // Refresh tasks
      setExpandedAssignment(null)
      setTimeout(() => loadAssignmentTasks(assignmentId), 100)
      await fetchAssignments()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to create task', 'error')
    } finally {
      setSaving(false)
    }
  }

  // ── Update document status ──────────────────────────────

  const handleDocStatus = async (assignmentId: string, taskId: string, newStatus: string) => {
    await handleUpdateTask(assignmentId, taskId, { documentStatus: newStatus })
  }

  // ── Render: Templates Tab ────────────────────────────────

  function renderTemplatesTab() {
    return (
      <div className="space-y-4 mt-4">
        {/* Create button */}
        <div className="flex justify-end">
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="flex items-center gap-2 px-4 py-2 bg-ink-900 text-white rounded-lg text-[13px] font-medium hover:bg-ink-800 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create Template
          </button>
        </div>

        {/* Create form */}
        {showCreateForm && (
          <div className="bg-white border border-ink-200 rounded-xl p-4 space-y-3">
            <h3 className="text-[14px] font-semibold text-ink-900">New Template</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-[12px] font-medium text-ink-500 mb-1">Template Name *</label>
                <input
                  value={createForm.name}
                  onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                  className="w-full px-3 py-2 border border-ink-200 rounded-lg text-[13px]"
                  placeholder="e.g. Architect Onboarding"
                />
              </div>
              <div>
                <label className="block text-[12px] font-medium text-ink-500 mb-1">Target Role</label>
                <input
                  value={createForm.roleLevel}
                  onChange={(e) => setCreateForm({ ...createForm, roleLevel: e.target.value })}
                  className="w-full px-3 py-2 border border-ink-200 rounded-lg text-[13px]"
                  placeholder="e.g. Senior Architect"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-[12px] font-medium text-ink-500 mb-1">
                  <Building className="w-3 h-3 inline mr-1" />
                  Office (optional)
                </label>
                <select
                  value={createForm.officeId}
                  onChange={(e) => setCreateForm({ ...createForm, officeId: e.target.value })}
                  className="w-full px-3 py-2 border border-ink-200 rounded-lg text-[13px]"
                >
                  <option value="">Org-wide (all offices)</option>
                  {offices.map((o) => (
                    <option key={o.id} value={o.id}>{o.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[12px] font-medium text-ink-500 mb-1">
                  <MapPin className="w-3 h-3 inline mr-1" />
                  Region (optional)
                </label>
                <select
                  value={createForm.region}
                  onChange={(e) => setCreateForm({ ...createForm, region: e.target.value })}
                  className="w-full px-3 py-2 border border-ink-200 rounded-lg text-[13px]"
                >
                  <option value="">Any region</option>
                  <option value="UK">UK</option>
                  <option value="NG">Nigeria</option>
                  <option value="EE">Estonia</option>
                  <option value="EU">EU</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-[12px] font-medium text-ink-500 mb-1">Description</label>
              <textarea
                value={createForm.description}
                onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                className="w-full px-3 py-2 border border-ink-200 rounded-lg text-[13px]"
                rows={2}
                placeholder="Describe what this template covers..."
              />
            </div>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowCreateForm(false)}
                className="px-3 py-1.5 text-[13px] text-ink-500 hover:text-ink-700"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateTemplate}
                disabled={saving}
                className="flex items-center gap-1.5 px-4 py-1.5 bg-ink-900 text-white rounded-lg text-[13px] font-medium disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                Create
              </button>
            </div>
          </div>
        )}

        {/* Template list */}
        {templates.length === 0 && !loading ? (
          <div className="text-center py-12 text-ink-400 text-[13px]">
            <ClipboardList className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p>No onboarding templates yet</p>
            <p className="text-[12px] mt-1">Create your first template to get started</p>
          </div>
        ) : (
          templates.map((t) => (
            <div key={t.id} className="bg-white border border-ink-200 rounded-xl overflow-hidden">
              {/* Template header */}
              <button
                onClick={() => loadTemplateDetail(t.id)}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-ink-25 transition-colors"
              >
                <div className="flex items-center gap-3 text-left">
                  {expandedTemplate === t.id ? (
                    <ChevronDown className="w-4 h-4 text-ink-400" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-ink-400" />
                  )}
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[14px] font-medium text-ink-900">{t.name}</span>
                      {t.isDefault && (
                        <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-[10px] font-semibold uppercase">
                          Default
                        </span>
                      )}
                    </div>
                    <div className="text-[12px] text-ink-400 mt-0.5">
                      {t.roleLevel !== 'Not provided' ? t.roleLevel : 'All roles'} &middot; {t.totalItems} item{t.totalItems !== 1 ? 's' : ''} &middot; {t.assignmentCount} assignment{t.assignmentCount !== 1 ? 's' : ''}
                      {t.officeName && <> &middot; <Building className="w-3 h-3 inline" /> {t.officeName}</>}
                      {t.region && <> &middot; <MapPin className="w-3 h-3 inline" /> {t.region}</>}
                      {!t.officeId && !t.region && <> &middot; Org-wide</>}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {STAGES.map((s) => (
                    <span key={s.key} className={`px-2 py-0.5 rounded text-[10px] font-medium ${s.color}`}>
                      {s.label}: {t.stageCounts[s.key] ?? 0}
                    </span>
                  ))}
                </div>
              </button>

              {/* Template detail */}
              {expandedTemplate === t.id && templateDetail && (
                <div className="border-t border-ink-100 p-4">
                  {/* Actions */}
                  <div className="flex gap-2 mb-4">
                    {!t.isDefault && (
                      <button
                        onClick={() => handleSetDefault(t.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      >
                        <Shield className="w-3.5 h-3.5" />
                        Set as Default
                      </button>
                    )}
                    <button
                      onClick={() => handleDeleteTemplate(t.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Deactivate
                    </button>
                  </div>

                  {/* Items by stage */}
                  {STAGES.map((stage) => {
                    const items = templateDetail.groupedItems[stage.key] ?? []
                    return (
                      <div key={stage.key} className="mb-4">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className={`text-[12px] font-semibold px-2 py-1 rounded ${stage.color}`}>
                            {stage.label} ({items.length})
                          </h4>
                          <button
                            onClick={() => {
                              setAddingItemStage(addingItemStage === stage.key ? null : stage.key)
                              setItemForm({ title: '', category: '', responsibleRole: 'HR', daysFromStart: 0, requiresEvidence: false, requiresApproval: false })
                            }}
                            className="flex items-center gap-1 text-[11px] text-ink-500 hover:text-ink-700"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            Add Item
                          </button>
                        </div>

                        {/* Add item form */}
                        {addingItemStage === stage.key && (
                          <div className="bg-ink-50 rounded-lg p-3 mb-2 space-y-2">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                              <input
                                value={itemForm.title}
                                onChange={(e) => setItemForm({ ...itemForm, title: e.target.value })}
                                className="px-2 py-1.5 border border-ink-200 rounded text-[12px]"
                                placeholder="Task title *"
                              />
                              <input
                                value={itemForm.category}
                                onChange={(e) => setItemForm({ ...itemForm, category: e.target.value })}
                                className="px-2 py-1.5 border border-ink-200 rounded text-[12px]"
                                placeholder="Category (e.g. IT Setup)"
                              />
                              <select
                                value={itemForm.responsibleRole}
                                onChange={(e) => setItemForm({ ...itemForm, responsibleRole: e.target.value })}
                                className="px-2 py-1.5 border border-ink-200 rounded text-[12px]"
                              >
                                {RESPONSIBLE_ROLES.map((r) => (
                                  <option key={r} value={r}>{r}</option>
                                ))}
                              </select>
                            </div>
                            <div className="flex items-center gap-4">
                              <label className="flex items-center gap-1.5 text-[12px] text-ink-600">
                                <span>Days from start:</span>
                                <input
                                  type="number"
                                  value={itemForm.daysFromStart}
                                  onChange={(e) => setItemForm({ ...itemForm, daysFromStart: parseInt(e.target.value) || 0 })}
                                  className="w-16 px-2 py-1 border border-ink-200 rounded text-[12px]"
                                  min={0}
                                />
                              </label>
                              <label className="flex items-center gap-1.5 text-[12px] text-ink-600">
                                <input
                                  type="checkbox"
                                  checked={itemForm.requiresEvidence}
                                  onChange={(e) => setItemForm({ ...itemForm, requiresEvidence: e.target.checked })}
                                  className="rounded"
                                />
                                Evidence required
                              </label>
                              <label className="flex items-center gap-1.5 text-[12px] text-ink-600">
                                <input
                                  type="checkbox"
                                  checked={itemForm.requiresApproval}
                                  onChange={(e) => setItemForm({ ...itemForm, requiresApproval: e.target.checked })}
                                  className="rounded"
                                />
                                Approval required
                              </label>
                            </div>
                            <div className="flex gap-2 justify-end">
                              <button
                                onClick={() => setAddingItemStage(null)}
                                className="px-2 py-1 text-[12px] text-ink-500 hover:text-ink-700"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={() => handleAddItem(t.id)}
                                disabled={saving}
                                className="flex items-center gap-1 px-3 py-1 bg-ink-900 text-white rounded text-[12px] font-medium disabled:opacity-50"
                              >
                                {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                                Add
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Items list */}
                        {items.length === 0 ? (
                          <p className="text-[12px] text-ink-400 italic pl-2">No items in this stage</p>
                        ) : (
                          <div className="space-y-1">
                            {(items as TemplateItem[]).map((item) => (
                              <div key={item.id} className="flex items-center justify-between px-3 py-2 bg-white rounded-lg border border-ink-100">
                                <div className="flex-1">
                                  <span className="text-[13px] text-ink-800">{item.title}</span>
                                  <div className="flex items-center gap-3 mt-0.5 text-[11px] text-ink-400">
                                    {item.category && <span>{item.category}</span>}
                                    <span>{item.responsibleRole ?? 'Not provided'}</span>
                                    <span>Day {item.daysFromStart}</span>
                                    {item.requiresEvidence && <span className="text-amber-600">Evidence</span>}
                                    {item.requiresApproval && <span className="text-blue-600">Approval</span>}
                                  </div>
                                </div>
                                <button
                                  onClick={() => handleRemoveItem(t.id, item.id)}
                                  className="p-1 text-ink-300 hover:text-red-500 transition-colors"
                                  title="Remove item"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    )
  }

  // ── Render: Active Onboarding Tab ────────────────────────

  function renderActiveTab() {
    const activeAssignments = assignments.filter((a) => a.status === 'ACTIVE')

    return (
      <div className="space-y-4 mt-4">
        {/* Assign button */}
        <div className="flex justify-end">
          <button
            onClick={() => setShowAssignForm(!showAssignForm)}
            className="flex items-center gap-2 px-4 py-2 bg-ink-900 text-white rounded-lg text-[13px] font-medium hover:bg-ink-800 transition-colors"
          >
            <UserCheck className="w-4 h-4" />
            Assign Template
          </button>
        </div>

        {/* Assign form */}
        {showAssignForm && (
          <div className="bg-white border border-ink-200 rounded-xl p-4 space-y-3">
            <h3 className="text-[14px] font-semibold text-ink-900">Assign Onboarding Template</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-[12px] font-medium text-ink-500 mb-1">Template *</label>
                <select
                  value={assignForm.templateId}
                  onChange={(e) => setAssignForm({ ...assignForm, templateId: e.target.value })}
                  className="w-full px-3 py-2 border border-ink-200 rounded-lg text-[13px]"
                >
                  <option value="">Select template...</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[12px] font-medium text-ink-500 mb-1">Employee *</label>
                <select
                  value={assignForm.profileId}
                  onChange={(e) => setAssignForm({ ...assignForm, profileId: e.target.value })}
                  className="w-full px-3 py-2 border border-ink-200 rounded-lg text-[13px]"
                >
                  <option value="">Select employee...</option>
                  {employees.map((e) => (
                    <option key={e.id} value={e.id}>{e.fullName}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[12px] font-medium text-ink-500 mb-1">Start Date *</label>
                <input
                  type="date"
                  value={assignForm.startDate}
                  onChange={(e) => setAssignForm({ ...assignForm, startDate: e.target.value })}
                  className="w-full px-3 py-2 border border-ink-200 rounded-lg text-[13px]"
                />
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowAssignForm(false)}
                className="px-3 py-1.5 text-[13px] text-ink-500 hover:text-ink-700"
              >
                Cancel
              </button>
              <button
                onClick={handleAssign}
                disabled={saving}
                className="flex items-center gap-1.5 px-4 py-1.5 bg-ink-900 text-white rounded-lg text-[13px] font-medium disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                Assign
              </button>
            </div>
          </div>
        )}

        {/* Assignment list */}
        {activeAssignments.length === 0 && !loading ? (
          <div className="text-center py-12 text-ink-400 text-[13px]">
            <UserCheck className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p>No active onboarding assignments</p>
            <p className="text-[12px] mt-1">Assign a template to an employee to begin their onboarding</p>
          </div>
        ) : (
          activeAssignments.map((a) => (
            <div key={a.id} className="bg-white border border-ink-200 rounded-xl overflow-hidden">
              <button
                onClick={() => loadAssignmentTasks(a.id)}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-ink-25 transition-colors"
              >
                <div className="flex items-center gap-3 text-left">
                  {expandedAssignment === a.id ? (
                    <ChevronDown className="w-4 h-4 text-ink-400" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-ink-400" />
                  )}
                  <div className="w-8 h-8 rounded-full bg-ink-100 flex items-center justify-center">
                    <Users className="w-4 h-4 text-ink-500" />
                  </div>
                  <div>
                    <span className="text-[14px] font-medium text-ink-900">{a.employee.fullName}</span>
                    <div className="text-[12px] text-ink-400 mt-0.5">
                      {a.template.name} &middot; Started {new Date(a.startDate).toLocaleDateString()}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  {/* Progress bar */}
                  <div className="flex items-center gap-2">
                    <div className="w-32 h-2 bg-ink-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          a.progress === 100 ? 'bg-green-500' : a.taskSummary.overdue > 0 ? 'bg-amber-500' : 'bg-blue-500'
                        }`}
                        style={{ width: `${a.progress}%` }}
                      />
                    </div>
                    <span className="text-[12px] font-medium text-ink-600 w-10 text-right">{a.progress}%</span>
                  </div>
                  {/* Task summary */}
                  <div className="flex items-center gap-2 text-[11px]">
                    <span className="text-green-600">{a.taskSummary.completed} done</span>
                    <span className="text-ink-300">/</span>
                    <span className="text-ink-500">{a.taskSummary.total} total</span>
                    {a.taskSummary.overdue > 0 && (
                      <span className="text-red-600 font-medium">{a.taskSummary.overdue} overdue</span>
                    )}
                  </div>
                </div>
              </button>

              {/* Stage breakdown */}
              {expandedAssignment === a.id && (
                <div className="border-t border-ink-100">
                  {/* Stage progress bars */}
                  <div className="px-4 py-3 grid grid-cols-4 gap-2">
                    {STAGES.map((stage) => {
                      const sb = a.stageBreakdown[stage.key]
                      const pct = sb ? (sb.total > 0 ? Math.round((sb.completed / sb.total) * 100) : 0) : 0
                      return (
                        <div key={stage.key} className="text-center">
                          <div className="text-[10px] font-medium text-ink-500 mb-1">{stage.label}</div>
                          <div className="w-full h-1.5 bg-ink-100 rounded-full overflow-hidden">
                            <div className="h-full bg-ink-700 rounded-full" style={{ width: `${pct}%` }} />
                          </div>
                          <div className="text-[10px] text-ink-400 mt-0.5">
                            {sb ? `${sb.completed}/${sb.total}` : '0/0'}
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {/* Add ad-hoc task button */}
                  <div className="px-4 py-2 border-t border-ink-100">
                    <button
                      onClick={() => setShowAdHocForm(showAdHocForm === a.id ? null : a.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium text-purple-700 hover:bg-purple-50 rounded-lg transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add Ad-Hoc Task
                    </button>

                    {showAdHocForm === a.id && (
                      <div className="mt-3 p-4 bg-purple-50/50 border border-purple-200 rounded-xl space-y-3">
                        <h5 className="text-[13px] font-semibold text-purple-800">New Ad-Hoc Task</h5>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="col-span-2">
                            <label className="block text-[11px] font-medium text-ink-500 mb-1">Title *</label>
                            <input
                              type="text"
                              value={adHocForm.title}
                              onChange={(e) => setAdHocForm({ ...adHocForm, title: e.target.value })}
                              placeholder="e.g. Sign health & safety declaration"
                              className="w-full px-3 py-2 border border-ink-200 rounded-lg text-[13px]"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-medium text-ink-500 mb-1">Stage *</label>
                            <select
                              value={adHocForm.stage}
                              onChange={(e) => setAdHocForm({ ...adHocForm, stage: e.target.value })}
                              className="w-full px-3 py-2 border border-ink-200 rounded-lg text-[13px]"
                            >
                              {STAGES.map((s) => (
                                <option key={s.key} value={s.key}>{s.label}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-[11px] font-medium text-ink-500 mb-1">Category</label>
                            <input
                              type="text"
                              value={adHocForm.category}
                              onChange={(e) => setAdHocForm({ ...adHocForm, category: e.target.value })}
                              placeholder="e.g. Compliance, IT Setup"
                              className="w-full px-3 py-2 border border-ink-200 rounded-lg text-[13px]"
                            />
                          </div>
                          <div className="col-span-2">
                            <label className="block text-[11px] font-medium text-ink-500 mb-1">Description</label>
                            <textarea
                              value={adHocForm.description}
                              onChange={(e) => setAdHocForm({ ...adHocForm, description: e.target.value })}
                              placeholder="Brief description of what needs to be done..."
                              rows={2}
                              className="w-full px-3 py-2 border border-ink-200 rounded-lg text-[13px]"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-medium text-ink-500 mb-1">Due Date</label>
                            <input
                              type="date"
                              value={adHocForm.dueDate}
                              onChange={(e) => setAdHocForm({ ...adHocForm, dueDate: e.target.value })}
                              className="w-full px-3 py-2 border border-ink-200 rounded-lg text-[13px]"
                            />
                          </div>
                          <div className="flex items-end gap-4 pb-1">
                            <label className="flex items-center gap-2 text-[12px] text-ink-600 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={adHocForm.notifyEmployee}
                                onChange={(e) => setAdHocForm({ ...adHocForm, notifyEmployee: e.target.checked })}
                                className="rounded border-ink-300"
                              />
                              Notify employee
                            </label>
                            <label className="flex items-center gap-2 text-[12px] text-ink-600 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={adHocForm.acknowledgementRequired}
                                onChange={(e) => setAdHocForm({ ...adHocForm, acknowledgementRequired: e.target.checked })}
                                className="rounded border-ink-300"
                              />
                              Require acknowledgement
                            </label>
                          </div>
                        </div>
                        <div className="flex gap-2 justify-end">
                          <button
                            onClick={() => { setShowAdHocForm(null); setAdHocForm({ title: '', stage: 'BEFORE_START', category: '', description: '', dueDate: '', notifyEmployee: true, acknowledgementRequired: false }) }}
                            className="px-3 py-1.5 text-[12px] text-ink-500 hover:text-ink-700"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => handleCreateAdHocTask(a.id)}
                            disabled={saving || !adHocForm.title}
                            className="flex items-center gap-1.5 px-4 py-1.5 bg-purple-700 text-white rounded-lg text-[12px] font-medium disabled:opacity-50"
                          >
                            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                            Add Task
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Tasks by stage */}
                  {assignmentTasks && (
                    <div className="px-4 pb-4 space-y-3">
                      {STAGES.map((stage) => {
                        const tasks = (assignmentTasks[stage.key] ?? []) as OnboardingTaskDetail[]
                        if (tasks.length === 0) return null
                        return (
                          <div key={stage.key}>
                            <h5 className={`text-[11px] font-semibold px-2 py-1 rounded inline-block mb-2 ${stage.color}`}>
                              {stage.label}
                            </h5>
                            <div className="space-y-1">
                              {tasks.map((task) => {
                                const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && task.status !== 'COMPLETED' && task.status !== 'WAIVED'
                                return (
                                  <div key={task.id} className="flex items-center justify-between px-3 py-2 bg-ink-25 rounded-lg">
                                    <div className="flex-1">
                                      <div className="flex items-center gap-2">
                                        <span className="text-[13px] text-ink-800">{task.title}</span>
                                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${STATUS_COLORS[task.status] ?? 'bg-gray-100 text-gray-700'}`}>
                                          {task.status}
                                        </span>
                                        {task.isAdHoc && (
                                          <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-purple-100 text-purple-700">
                                            AD-HOC
                                          </span>
                                        )}
                                        {isOverdue && (
                                          <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-red-100 text-red-700">
                                            OVERDUE
                                          </span>
                                        )}
                                        {task.documentStatus && (() => {
                                          const dm = DOC_STATUS_META[task.documentStatus]
                                          if (!dm) return null
                                          const Icon = dm.icon
                                          return (
                                            <span className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${dm.color}`}>
                                              <Icon className="w-3 h-3" />
                                              {dm.label}
                                            </span>
                                          )
                                        })()}
                                      </div>
                                      <div className="flex items-center gap-3 mt-0.5 text-[11px] text-ink-400">
                                        <span>{task.responsibleRole}</span>
                                        {task.dueDate && <span>Due: {new Date(task.dueDate).toLocaleDateString()}</span>}
                                        {task.assigneeName !== 'Not provided' && <span>Assigned: {task.assigneeName}</span>}
                                        {task.evidenceUrl !== 'Not provided' && (
                                          <a href={task.evidenceUrl} className="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer">
                                            Evidence
                                          </a>
                                        )}
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-1">
                                      {/* Document status progression buttons */}
                                      {task.documentStatus === 'NOT_SENT' && (
                                        <button
                                          onClick={() => handleDocStatus(a.id, task.id, 'SENT')}
                                          className="flex items-center gap-1 px-2 py-1 text-[11px] text-blue-700 hover:bg-blue-50 rounded transition-colors"
                                          title="Mark as sent"
                                        >
                                          <Send className="w-3.5 h-3.5" />
                                          Send
                                        </button>
                                      )}
                                      {task.documentStatus === 'SENT' && (
                                        <button
                                          onClick={() => handleDocStatus(a.id, task.id, 'VIEWED')}
                                          className="flex items-center gap-1 px-2 py-1 text-[11px] text-amber-700 hover:bg-amber-50 rounded transition-colors"
                                          title="Mark as viewed"
                                        >
                                          <Eye className="w-3.5 h-3.5" />
                                          Viewed
                                        </button>
                                      )}
                                      {task.status !== 'COMPLETED' && task.status !== 'WAIVED' && (
                                        <button
                                          onClick={() => handleUpdateTask(a.id, task.id, { status: 'COMPLETED' })}
                                          className="flex items-center gap-1 px-2 py-1 text-[11px] text-green-700 hover:bg-green-50 rounded transition-colors"
                                          title="Mark complete"
                                        >
                                          <CheckCircle2 className="w-3.5 h-3.5" />
                                          Complete
                                        </button>
                                      )}
                                      {task.requiresApproval && !task.approvedAt && task.status === 'COMPLETED' && (
                                        <button
                                          onClick={() => handleUpdateTask(a.id, task.id, { approved: true })}
                                          className="flex items-center gap-1 px-2 py-1 text-[11px] text-blue-700 hover:bg-blue-50 rounded transition-colors"
                                          title="Approve"
                                        >
                                          <Shield className="w-3.5 h-3.5" />
                                          Approve
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    )
  }

  // ── Render: Probation Tab ────────────────────────────────

  function renderProbationTab() {
    // Filter assignments in probation stage
    const probationAssignments = assignments.filter((a) => {
      const probationStage = a.stageBreakdown['PROBATION']
      return a.status === 'ACTIVE' && probationStage && probationStage.total > 0
    })

    return (
      <div className="space-y-4 mt-4">
        {/* Probation overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white border border-ink-200 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Calendar className="w-4 h-4 text-amber-500" />
              <span className="text-[12px] font-medium text-ink-500">In Probation</span>
            </div>
            <span className="text-2xl font-semibold text-ink-900">{probationAssignments.length}</span>
          </div>
          <div className="bg-white border border-ink-200 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-4 h-4 text-blue-500" />
              <span className="text-[12px] font-medium text-ink-500">Pending Reviews</span>
            </div>
            <span className="text-2xl font-semibold text-ink-900">{probationReviews.length}</span>
          </div>
          <div className="bg-white border border-ink-200 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-4 h-4 text-red-500" />
              <span className="text-[12px] font-medium text-ink-500">Overdue Reviews</span>
            </div>
            <span className="text-2xl font-semibold text-ink-900">
              {probationReviews.filter((r) => new Date(r.scheduledDate) < new Date() && !r.completedDate).length}
            </span>
          </div>
        </div>

        {/* Probation employees */}
        <div className="bg-white border border-ink-200 rounded-xl">
          <div className="px-4 py-3 border-b border-ink-100">
            <h3 className="text-[14px] font-semibold text-ink-900">Employees in Probation</h3>
          </div>
          {probationAssignments.length === 0 ? (
            <div className="text-center py-8 text-ink-400 text-[13px]">
              <Clock className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p>No employees currently in probation stage</p>
            </div>
          ) : (
            <div className="divide-y divide-ink-100">
              {probationAssignments.map((a) => {
                const probation = a.stageBreakdown['PROBATION']
                const pct = probation ? (probation.total > 0 ? Math.round((probation.completed / probation.total) * 100) : 0) : 0
                return (
                  <div key={a.id} className="flex items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center">
                        <Users className="w-4 h-4 text-amber-600" />
                      </div>
                      <div>
                        <span className="text-[13px] font-medium text-ink-900">{a.employee.fullName}</span>
                        <div className="text-[12px] text-ink-400">
                          Started {new Date(a.startDate).toLocaleDateString()} &middot; {a.template.name}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <div className="text-[12px] font-medium text-ink-600">Probation: {pct}%</div>
                        <div className="w-20 h-1.5 bg-ink-100 rounded-full overflow-hidden mt-1">
                          <div className="h-full bg-amber-500 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                      <a
                        href="/staffing"
                        className="text-[12px] text-blue-600 hover:underline"
                      >
                        View Reviews
                      </a>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Scheduled reviews */}
        <div className="bg-white border border-ink-200 rounded-xl">
          <div className="px-4 py-3 border-b border-ink-100">
            <h3 className="text-[14px] font-semibold text-ink-900">Scheduled Reviews</h3>
            <p className="text-[12px] text-ink-400 mt-0.5">30/60/90-day review schedule</p>
          </div>
          {probationReviews.length === 0 ? (
            <div className="text-center py-8 text-ink-400 text-[13px]">
              <Calendar className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p>No pending probation reviews</p>
            </div>
          ) : (
            <div className="divide-y divide-ink-100">
              {probationReviews.map((r) => {
                const isOverdue = new Date(r.scheduledDate) < new Date() && !r.completedDate
                return (
                  <div key={r.id} className="flex items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isOverdue ? 'bg-red-100' : 'bg-blue-100'}`}>
                        <FileText className={`w-4 h-4 ${isOverdue ? 'text-red-600' : 'text-blue-600'}`} />
                      </div>
                      <div>
                        <span className="text-[13px] font-medium text-ink-900">
                          {r.profile.fullName} &mdash; {r.reviewType}
                        </span>
                        <div className="text-[12px] text-ink-400">
                          {r.profile.jobTitle ?? 'Not provided'} &middot; Scheduled: {new Date(r.scheduledDate).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {isOverdue && (
                        <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded text-[10px] font-semibold">
                          OVERDUE
                        </span>
                      )}
                      {r.outcome && (
                        <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                          r.outcome === 'PASS' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                        }`}>
                          {r.outcome}
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    )
  }

  // ── Main render ──────────────────────────────────────────

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto p-6 space-y-4">
        <SkeletonRow className="h-8 w-64" />
        <SkeletonRow className="h-4 w-96" />
        <div className="space-y-3 mt-6">
          <SkeletonRow className="h-16" />
          <SkeletonRow className="h-16" />
          <SkeletonRow className="h-16" />
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-0">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-[20px] sm:text-[22px] font-semibold text-ink-900">Onboarding Management</h1>
          <p className="text-[13px] text-ink-400 mt-1">
            {templates.length} template{templates.length !== 1 ? 's' : ''} &middot; {assignments.filter((a) => a.status === 'ACTIVE').length} active assignment{assignments.filter((a) => a.status === 'ACTIVE').length !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={fetchAll}
          className="p-2 rounded-lg hover:bg-ink-50 transition-colors"
          title="Refresh"
        >
          <RefreshCw className="w-4 h-4 text-ink-400" />
        </button>
      </div>

      {/* Tabs */}
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

      {/* Tab content */}
      {activeTab === 'templates' && renderTemplatesTab()}
      {activeTab === 'active' && renderActiveTab()}
      {activeTab === 'probation' && renderProbationTab()}
    </div>
  )
}

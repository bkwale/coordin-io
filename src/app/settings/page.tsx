'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Building2, Users, CreditCard, Hash, Globe, Puzzle, Shield,
  Save, Plus, Mail, CheckCircle, XCircle, Clock, UserPlus,
  ChevronRight, Loader2, Pencil, X, Trash2, Star,
  ScrollText, Download, ChevronLeft, Filter, CalendarDays,
  Link2, Copy, Ban, LockKeyhole, FileText, ClipboardList,
  ChevronDown, ChevronUp,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ── Types ──────────────────────────────────────────────────

interface OfficeData {
  id: string
  name: string
  city: string
  country: string
  isHeadOffice: boolean
}

interface OrgData {
  id: string
  name: string
  slug: string
  logoUrl: string | null
  defaultCurrency: string
  currencies: string[]
  offices: OfficeData[]
  createdAt: string
}

interface TeamMember {
  id: string
  fullName: string
  email: string
  jobTitle: string | null
  phone: string | null
  orgPermission: string
  orgPermissionLabel?: string
  status: string
  startDate: string | null
  officeId: string | null
  office: { name: string; city: string } | null
  role: { name: string; level: string } | null
}

interface TeamData {
  members: TeamMember[]
  offices: Array<{ id: string; name: string; city: string }>
  total: number
  active: number
  viewerPermission?: string
  viewerProfileId?: string
}

// ── Settings Tabs ──────────────────────────────────────────

const SETTINGS_TABS = [
  { key: 'organisation', label: 'Organisation', icon: Building2, description: 'Practice profile & details' },
  { key: 'team', label: 'Team & Roles', icon: Users, description: 'Staff, invitations & permissions' },
  { key: 'billing', label: 'Billing & Currency', icon: CreditCard, description: 'Currency, tax & fee defaults' },
  { key: 'numbering', label: 'Document Numbering', icon: Hash, description: 'Auto-numbering templates' },
  { key: 'regional', label: 'Regional', icon: Globe, description: 'Locale, timezone & date format' },
  { key: 'integrations', label: 'Integrations', icon: Puzzle, description: 'Connected services' },
  { key: 'governance', label: 'AI Governance', icon: Shield, description: 'AI source permissions & audit' },
  { key: 'notifications', label: 'Notifications', icon: Mail, description: 'Email & in-app preferences' },
  { key: 'audit', label: 'Audit Trail', icon: ScrollText, description: 'Activity log & export' },
  { key: 'approvals', label: 'Approval Workflows', icon: CheckCircle, description: 'Configure approval routes' },
  { key: 'externalLinks', label: 'External Links', icon: Link2, description: 'Manage external link shortcuts' },
  { key: 'holidays', label: 'Public Holidays', icon: CalendarDays, description: 'Manage public holidays' },
  { key: 'leavePolicies', label: 'Leave Policies', icon: FileText, description: 'Entitlement rules by grade & type' },
  { key: 'onboarding', label: 'Onboarding', icon: ClipboardList, description: 'Templates & task options' },
] as const

type TabKey = typeof SETTINGS_TABS[number]['key']

const CURRENCY_OPTIONS = [
  { value: 'GBP', label: 'GBP — British Pounds (£)', symbol: '£' },
  { value: 'USD', label: 'USD — US Dollars ($)', symbol: '$' },
  { value: 'EUR', label: 'EUR — Euros (€)', symbol: '€' },
  { value: 'NGN', label: 'NGN — Nigerian Naira (₦)', symbol: '₦' },
]

// ── Main Page ──────────────────────────────────────────────

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('organisation')

  return (
    <div className="min-h-screen bg-surface-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="font-display text-[2rem] text-ink-900">Settings</h1>
          <p className="text-[13px] text-ink-400 mt-1">
            Manage your practice, team, and platform configuration
          </p>
        </div>

        <div className="flex flex-col lg:flex-row gap-6 lg:gap-8">
          {/* Left Rail Navigation */}
          <nav className="w-full lg:w-64 shrink-0 hidden lg:block">
            <div className="sticky top-8 space-y-1">
              {SETTINGS_TABS.map((tab) => {
                const Icon = tab.icon
                const isActive = activeTab === tab.key
                return (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={cn(
                      'w-full flex items-start gap-3 px-3 py-3 rounded-lg text-left transition-all',
                      isActive
                        ? 'bg-white shadow-sm border border-surface-200 text-ink-900'
                        : 'text-ink-500 hover:bg-white/60 hover:text-ink-700'
                    )}
                  >
                    <Icon className={cn('w-5 h-5 mt-0.5 shrink-0', isActive ? 'text-accent-600' : 'text-ink-300')} />
                    <div>
                      <p className={cn('text-[13px] font-medium', isActive && 'text-ink-900')}>{tab.label}</p>
                      <p className="text-[11px] text-ink-300 mt-0.5">{tab.description}</p>
                    </div>
                  </button>
                )
              })}
            </div>
          </nav>

          {/* Mobile Tab Bar */}
          <div className="lg:hidden w-full mb-6">
            <select
              value={activeTab}
              onChange={(e) => setActiveTab(e.target.value as TabKey)}
              className="w-full px-4 py-3 rounded-lg border border-surface-200 bg-white text-[13px] text-ink-900"
            >
              {SETTINGS_TABS.map((tab) => (
                <option key={tab.key} value={tab.key}>{tab.label}</option>
              ))}
            </select>
          </div>

          {/* Content Panel */}
          <div className="flex-1 min-w-0">
            <div className="bg-white rounded-xl border border-surface-200 p-6 sm:p-8">
              {activeTab === 'organisation' && <OrganisationSection />}
              {activeTab === 'team' && <TeamSection />}
              {activeTab === 'billing' && <BillingSection />}
              {activeTab === 'numbering' && <NumberingSection />}
              {activeTab === 'regional' && <RegionalSection />}
              {activeTab === 'integrations' && <IntegrationsSection />}
              {activeTab === 'governance' && <GovernanceSection />}
              {activeTab === 'notifications' && <NotificationPreferencesSection />}
              {activeTab === 'audit' && <AuditSection />}
              {activeTab === 'approvals' && <ApprovalRoutesSection />}
              {activeTab === 'externalLinks' && <ExternalLinksSection />}
              {activeTab === 'holidays' && <PublicHolidaysSection />}
              {activeTab === 'leavePolicies' && <LeavePoliciesSection />}
              {activeTab === 'onboarding' && <OnboardingSection />}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Offices Manager (inline CRUD) ─────────────────────────

function OfficesManager({ offices, onUpdate }: { offices: OfficeData[]; onUpdate: (offices: OfficeData[]) => void }) {
  const [editing, setEditing] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ name: '', city: '', country: '', isHeadOffice: false })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function startEdit(office: OfficeData) {
    setEditing(office.id)
    setForm({ name: office.name, city: office.city, country: office.country, isHeadOffice: office.isHeadOffice })
    setAdding(false)
    setError(null)
  }

  function startAdd() {
    setAdding(true)
    setEditing(null)
    setForm({ name: '', city: '', country: '', isHeadOffice: false })
    setError(null)
  }

  function cancel() {
    setEditing(null)
    setAdding(false)
    setError(null)
  }

  async function handleSave() {
    setBusy(true)
    setError(null)
    try {
      if (adding) {
        const res = await fetch('/api/settings/offices', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        })
        if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Failed to create'); }
        const { office } = await res.json()
        const updated = form.isHeadOffice
          ? offices.map((o) => ({ ...o, isHeadOffice: false }))
          : [...offices]
        onUpdate([...updated, office])
      } else if (editing) {
        const res = await fetch('/api/settings/offices', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editing, ...form }),
        })
        if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Failed to update'); }
        const { office } = await res.json()
        const updated = form.isHeadOffice
          ? offices.map((o) => o.id === editing ? office : { ...o, isHeadOffice: false })
          : offices.map((o) => o.id === editing ? office : o)
        onUpdate(updated)
      }
      cancel()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete(officeId: string) {
    if (!confirm('Delete this office? Members must be reassigned first.')) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/settings/offices', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: officeId }),
      })
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Failed to delete'); }
      onUpdate(offices.filter((o) => o.id !== officeId))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setBusy(false)
    }
  }

  async function handleSetHeadOffice(officeId: string) {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/settings/offices', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: officeId, isHeadOffice: true }),
      })
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Failed to update'); }
      onUpdate(offices.map((o) => ({ ...o, isHeadOffice: o.id === officeId })))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setBusy(false)
    }
  }

  return (
    <FieldGroup label="Offices" hint={`${offices.length} registered`}>
      {error && (
        <div className="mb-3 p-2.5 bg-red-50 border border-red-200 rounded-lg text-[12px] text-red-700">{error}</div>
      )}

      {offices.length > 0 ? (
        <div className="space-y-2">
          {offices.map((office) => (
            <div key={office.id}>
              {editing === office.id ? (
                <div className="p-3 bg-surface-100 rounded-lg space-y-3 border border-surface-300">
                  <div className="grid grid-cols-3 gap-2">
                    <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Office name" className="settings-input text-[12px]" />
                    <input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="City" className="settings-input text-[12px]" />
                    <input value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} placeholder="Country" className="settings-input text-[12px]" />
                  </div>
                  <label className="flex items-center gap-2 text-[12px] text-ink-600 cursor-pointer">
                    <input type="checkbox" checked={form.isHeadOffice} onChange={(e) => setForm({ ...form, isHeadOffice: e.target.checked })} className="rounded" />
                    Head Office
                  </label>
                  <div className="flex gap-2">
                    <button onClick={handleSave} disabled={busy || !form.name || !form.city} className="px-3 py-1.5 bg-ink-900 text-white text-[11px] font-medium rounded-md hover:bg-ink-800 disabled:opacity-50">
                      {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Save'}
                    </button>
                    <button onClick={cancel} className="px-3 py-1.5 text-[11px] text-ink-500 hover:text-ink-700">Cancel</button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between p-3 bg-surface-50 rounded-lg group">
                  <div className="flex items-center gap-2">
                    <div>
                      <p className="text-[13px] font-medium text-ink-900 flex items-center gap-1.5">
                        {office.name}
                        {office.isHeadOffice && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-amber-100 text-amber-700 text-[10px] font-medium rounded-full">
                            <Star className="w-2.5 h-2.5" /> HQ
                          </span>
                        )}
                      </p>
                      <p className="text-[11px] text-ink-400">{office.city}, {office.country}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {!office.isHeadOffice && (
                      <button onClick={() => handleSetHeadOffice(office.id)} title="Set as head office" className="p-1.5 text-ink-300 hover:text-amber-600 rounded-md hover:bg-surface-100">
                        <Star className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button onClick={() => startEdit(office)} title="Edit office" className="p-1.5 text-ink-300 hover:text-ink-700 rounded-md hover:bg-surface-100">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => handleDelete(office.id)} title="Delete office" className="p-1.5 text-ink-300 hover:text-red-600 rounded-md hover:bg-surface-100">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-[13px] text-ink-300 italic">No offices configured yet</p>
      )}

      {adding ? (
        <div className="mt-3 p-3 bg-surface-100 rounded-lg space-y-3 border border-surface-300">
          <div className="grid grid-cols-3 gap-2">
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Office name" className="settings-input text-[12px]" />
            <input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="City" className="settings-input text-[12px]" />
            <input value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} placeholder="Country" className="settings-input text-[12px]" />
          </div>
          <label className="flex items-center gap-2 text-[12px] text-ink-600 cursor-pointer">
            <input type="checkbox" checked={form.isHeadOffice} onChange={(e) => setForm({ ...form, isHeadOffice: e.target.checked })} className="rounded" />
            Head Office
          </label>
          <div className="flex gap-2">
            <button onClick={handleSave} disabled={busy || !form.name || !form.city} className="px-3 py-1.5 bg-ink-900 text-white text-[11px] font-medium rounded-md hover:bg-ink-800 disabled:opacity-50">
              {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Add Office'}
            </button>
            <button onClick={cancel} className="px-3 py-1.5 text-[11px] text-ink-500 hover:text-ink-700">Cancel</button>
          </div>
        </div>
      ) : (
        <button onClick={startAdd} className="mt-3 flex items-center gap-1.5 text-[12px] text-brand-600 hover:text-brand-700 font-medium">
          <Plus className="w-3.5 h-3.5" /> Add Office
        </button>
      )}
    </FieldGroup>
  )
}

// ── Section: Organisation Profile ──────────────────────────

function OrganisationSection() {
  const [org, setOrg] = useState<OrgData | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [form, setForm] = useState({ name: '', logoUrl: '', defaultCurrency: 'GBP' as string })

  useEffect(() => {
    fetch('/api/settings/organisation')
      .then((r) => {
        if (!r.ok) throw new Error('Failed to load organisation')
        return r.json()
      })
      .then((data) => {
        setOrg(data)
        setForm({
          name: data.name || '',
          logoUrl: data.logoUrl || '',
          defaultCurrency: data.defaultCurrency || 'GBP',
        })
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  async function handleSave() {
    setSaving(true)
    setSaved(false)
    try {
      const res = await fetch('/api/settings/organisation', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (res.ok) {
        const data = await res.json()
        setOrg({ ...org!, ...data })
        setSaved(true)
        setTimeout(() => setSaved(false), 3000)
      }
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <LoadingState />

  return (
    <div>
      <SectionHeader
        title="Organisation Profile"
        description="Your practice details — this information appears on documents, invoices and project records"
      />

      <div className="space-y-6 mt-8">
        {/* Practice Name */}
        <FieldGroup label="Practice Name" required>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="settings-input"
            placeholder="e.g. Mitchell Architects"
          />
        </FieldGroup>

        {/* Slug / URL */}
        <FieldGroup label="URL Slug" hint="Used in your portal URL">
          <div className="flex items-center gap-2">
            <span className="text-[13px] text-ink-300">coordin.io/portal/</span>
            <span className="text-[13px] font-medium text-ink-700">{org?.slug || '—'}</span>
          </div>
        </FieldGroup>

        {/* Logo URL */}
        <FieldGroup label="Logo URL" hint="Link to your practice logo (square, min 200×200px)">
          <input
            type="url"
            value={form.logoUrl}
            onChange={(e) => setForm({ ...form, logoUrl: e.target.value })}
            className="settings-input"
            placeholder="https://example.com/logo.png"
          />
          {form.logoUrl && (
            <div className="mt-3 w-16 h-16 rounded-lg border border-surface-200 overflow-hidden bg-surface-50">
              <img src={form.logoUrl} alt="Logo preview" className="w-full h-full object-contain" />
            </div>
          )}
        </FieldGroup>

        {/* Default Currency */}
        <FieldGroup label="Default Currency" required>
          <select
            value={form.defaultCurrency}
            onChange={(e) => setForm({ ...form, defaultCurrency: e.target.value })}
            className="settings-input"
          >
            {CURRENCY_OPTIONS.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </FieldGroup>

        {/* Offices */}
        <OfficesManager offices={org?.offices || []} onUpdate={(offices) => setOrg(org ? { ...org, offices } : null)} />

        {/* Member Since */}
        <FieldGroup label="Member Since">
          <p className="text-[13px] text-ink-600">
            {org?.createdAt ? new Date(org.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'}
          </p>
        </FieldGroup>
      </div>

      {/* Save Button */}
      <div className="mt-8 pt-6 border-t border-surface-200 flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 bg-ink-900 text-white text-[13px] font-medium rounded-lg hover:bg-ink-800 disabled:opacity-60 transition-colors"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save Changes
        </button>
        {saved && (
          <span className="flex items-center gap-1.5 text-[12px] text-emerald-600 font-medium">
            <CheckCircle className="w-4 h-4" /> Saved
          </span>
        )}
      </div>
    </div>
  )
}

// ── Section: Team & Roles ──────────────────────────────────

function TeamSection() {
  const [team, setTeam] = useState<TeamData | null>(null)
  const [loading, setLoading] = useState(true)

  // Invite form state
  const [showInvite, setShowInvite] = useState(false)
  const [invEmail, setInvEmail] = useState('')
  const [invName, setInvName] = useState('')
  const [invJob, setInvJob] = useState('')
  const [invRole, setInvRole] = useState('MEMBER')
  const [invSending, setInvSending] = useState(false)
  const [invError, setInvError] = useState<string | null>(null)
  const [invSuccess, setInvSuccess] = useState(false)

  // Inline edit state
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({ jobTitle: '', orgPermission: '', status: '', officeId: '' })
  const [editSaving, setEditSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const fetchTeam = useCallback(() => {
    setLoading(true)
    fetch('/api/settings/team')
      .then((r) => {
        if (!r.ok) throw new Error('Failed to load team')
        return r.json()
      })
      .then(setTeam)
      .catch(() => setTeam({ members: [], offices: [], total: 0, active: 0 }))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    fetchTeam()
  }, [fetchTeam])

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!invEmail.trim() || !invName.trim()) return
    setInvSending(true)
    setInvError(null)
    try {
      const res = await fetch('/api/invitations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: invEmail.trim(),
          fullName: invName.trim(),
          jobTitle: invJob.trim() || undefined,
          orgPermission: invRole,
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || `Failed to send invitation (${res.status})`)
      }
      setInvSuccess(true)
      setInvEmail('')
      setInvName('')
      setInvJob('')
      setInvRole('MEMBER')
      fetchTeam()
      setTimeout(() => {
        setInvSuccess(false)
        setShowInvite(false)
      }, 2000)
    } catch (err) {
      setInvError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setInvSending(false)
    }
  }

  if (loading) return <LoadingState />

  const statusIcon = (status: string) => {
    switch (status) {
      case 'ACTIVE': return <CheckCircle className="w-4 h-4 text-emerald-500" />
      case 'ONBOARDING': return <Clock className="w-4 h-4 text-blue-500" />
      case 'INVITED': return <Mail className="w-4 h-4 text-amber-500" />
      case 'DEACTIVATED': return <XCircle className="w-4 h-4 text-red-400" />
      default: return <Clock className="w-4 h-4 text-ink-300" />
    }
  }

  const permissionLabel = (p: string) => {
    switch (p) {
      case 'OWNER': return 'Practice Principal'
      case 'ADMIN': return 'Practice Manager'
      case 'HR': return 'HR Manager'
      case 'LEGAL': return 'Legal'
      case 'FINANCE': return 'Finance'
      case 'COMMERCIAL': return 'Commercial'
      case 'MANAGER': return 'Project Lead'
      case 'MEMBER': return 'Team Member'
      case 'VIEWER': return 'External'
      default: return p
    }
  }

  const viewerPermission = team?.viewerPermission || 'MEMBER'
  const viewerProfileId = team?.viewerProfileId || ''
  const canEditTeam = ['OWNER', 'ADMIN', 'HR'].includes(viewerPermission)

  const permissionOptions = (() => {
    const all = [
      { value: 'OWNER', label: 'Practice Principal' },
      { value: 'ADMIN', label: 'Practice Manager' },
      { value: 'HR', label: 'HR Manager' },
      { value: 'LEGAL', label: 'Legal' },
      { value: 'FINANCE', label: 'Finance' },
      { value: 'COMMERCIAL', label: 'Commercial' },
      { value: 'MANAGER', label: 'Project Lead' },
      { value: 'MEMBER', label: 'Team Member' },
      { value: 'VIEWER', label: 'External' },
    ]
    if (viewerPermission === 'OWNER') return all
    if (['ADMIN', 'HR'].includes(viewerPermission)) return all.filter((o) => !['OWNER'].includes(o.value))
    return all.filter((o) => ['MANAGER', 'MEMBER', 'VIEWER'].includes(o.value))
  })()

  const startEdit = (member: TeamMember) => {
    setEditingId(member.id)
    setEditForm({
      jobTitle: member.jobTitle || '',
      orgPermission: member.orgPermission,
      status: member.status,
      officeId: member.officeId || '',
    })
    setSaveError(null)
  }

  const cancelEdit = () => {
    setEditingId(null)
    setSaveError(null)
  }

  const handleEditSave = async () => {
    if (!editingId) return
    setEditSaving(true)
    setSaveError(null)
    try {
      const res = await fetch(`/api/staffing/employees/${editingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobTitle: editForm.jobTitle || undefined,
          orgPermission: editForm.orgPermission,
          status: editForm.status,
          officeId: editForm.officeId || null,
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || `Failed to save (${res.status})`)
      }
      setEditingId(null)
      fetchTeam()
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setEditSaving(false)
    }
  }

  return (
    <div>
      <SectionHeader
        title="Team & Roles"
        description="Manage your practice team — invite new staff, assign roles, and control permissions"
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4 mt-6 mb-8">
        <div className="bg-surface-50 rounded-lg p-4 text-center">
          <p className="text-2xl font-semibold text-ink-900">{team?.total || 0}</p>
          <p className="text-[11px] text-ink-400 mt-1">Total Members</p>
        </div>
        <div className="bg-surface-50 rounded-lg p-4 text-center">
          <p className="text-2xl font-semibold text-emerald-600">{team?.active || 0}</p>
          <p className="text-[11px] text-ink-400 mt-1">Active</p>
        </div>
        <div className="bg-surface-50 rounded-lg p-4 text-center">
          <p className="text-2xl font-semibold text-amber-600">
            {team?.members?.filter((m) => m.status === 'INVITED').length || 0}
          </p>
          <p className="text-[11px] text-ink-400 mt-1">Pending Invites</p>
        </div>
      </div>

      {/* Invite Button + Form */}
      <div className="mb-4">
        <div className="flex justify-end">
          <button
            onClick={() => { setShowInvite(!showInvite); setInvError(null); setInvSuccess(false) }}
            className="flex items-center gap-2 px-4 py-2 bg-ink-900 text-white text-[13px] font-medium rounded-lg hover:bg-ink-800 transition-colors"
          >
            <UserPlus className="w-4 h-4" />
            {showInvite ? 'Cancel' : 'Invite Team Member'}
          </button>
        </div>

        {showInvite && (
          <form onSubmit={handleInvite} className="mt-4 p-4 bg-surface-50 rounded-lg border border-surface-200 space-y-3">
            <p className="text-[13px] font-medium text-ink-900">Send Invitation</p>
            {invError && (
              <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg text-[12px] text-red-700">{invError}</div>
            )}
            {invSuccess && (
              <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg text-[12px] text-emerald-700 flex items-center gap-2">
                <CheckCircle className="w-4 h-4" /> Invitation sent successfully
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] text-ink-400 uppercase tracking-[0.08em] font-semibold block mb-1.5">Full Name *</label>
                <input
                  type="text"
                  value={invName}
                  onChange={(e) => setInvName(e.target.value)}
                  placeholder="e.g. Jane Doe"
                  required
                  className="w-full px-3 py-2 border border-surface-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-accent-500/20 focus:border-accent-500 bg-white"
                />
              </div>
              <div>
                <label className="text-[11px] text-ink-400 uppercase tracking-[0.08em] font-semibold block mb-1.5">Email *</label>
                <input
                  type="email"
                  value={invEmail}
                  onChange={(e) => setInvEmail(e.target.value)}
                  placeholder="e.g. jane@company.com"
                  required
                  className="w-full px-3 py-2 border border-surface-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-accent-500/20 focus:border-accent-500 bg-white"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] text-ink-400 uppercase tracking-[0.08em] font-semibold block mb-1.5">Job Title</label>
                <input
                  type="text"
                  value={invJob}
                  onChange={(e) => setInvJob(e.target.value)}
                  placeholder="e.g. Project Architect"
                  className="w-full px-3 py-2 border border-surface-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-accent-500/20 focus:border-accent-500 bg-white"
                />
              </div>
              <div>
                <label className="text-[11px] text-ink-400 uppercase tracking-[0.08em] font-semibold block mb-1.5">Role</label>
                <select
                  value={invRole}
                  onChange={(e) => setInvRole(e.target.value)}
                  className="w-full px-3 py-2 border border-surface-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-accent-500/20 focus:border-accent-500 bg-white"
                >
                  {permissionOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={invSending || !invEmail.trim() || !invName.trim()}
                className="flex items-center gap-2 px-4 py-2 bg-accent-600 text-white text-[13px] font-medium rounded-lg hover:bg-accent-700 disabled:opacity-60 transition-colors"
              >
                {invSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                {invSending ? 'Sending...' : 'Send Invitation'}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Team List */}
      {team?.members && team.members.length > 0 ? (
        <div className="border border-surface-200 rounded-lg overflow-x-auto -mx-4 sm:mx-0">
          <table className="w-full min-w-[640px]">
            <thead>
              <tr className="bg-surface-50 border-b border-surface-200">
                <th className="text-left py-3 px-4 text-[10px] font-semibold text-ink-400 uppercase tracking-wider">Name</th>
                <th className="text-left py-3 px-4 text-[10px] font-semibold text-ink-400 uppercase tracking-wider">Role</th>
                <th className="text-left py-3 px-4 text-[10px] font-semibold text-ink-400 uppercase tracking-wider">Permission</th>
                <th className="text-left py-3 px-4 text-[10px] font-semibold text-ink-400 uppercase tracking-wider">Office</th>
                <th className="text-left py-3 px-4 text-[10px] font-semibold text-ink-400 uppercase tracking-wider">Status</th>
                {canEditTeam && (
                  <th className="text-left py-3 px-4 text-[10px] font-semibold text-ink-400 uppercase tracking-wider">Actions</th>
                )}
              </tr>
            </thead>
            <tbody>
              {team.members.map((member) => {
                const isEditing = editingId === member.id
                const isSelf = member.id === viewerProfileId
                return (
                  <tr key={member.id} className={cn(
                    'border-b border-surface-200/60 transition-colors',
                    isEditing ? 'bg-accent-50/30' : 'hover:bg-surface-50/50'
                  )}>
                    <td className="py-3 px-4">
                      <div>
                        <p className="text-[13px] font-medium text-ink-900">{member.fullName}</p>
                        <p className="text-[11px] text-ink-400">{member.email}</p>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      {isEditing ? (
                        <input
                          type="text"
                          value={editForm.jobTitle}
                          onChange={(e) => setEditForm({ ...editForm, jobTitle: e.target.value })}
                          placeholder="Job title"
                          className="w-full px-2 py-1.5 border border-surface-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-accent-500/20 focus:border-accent-500 bg-white"
                        />
                      ) : (
                        <p className="text-[13px] text-ink-600">{member.role?.name || member.jobTitle || '—'}</p>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      {isEditing && !isSelf ? (
                        <select
                          value={editForm.orgPermission}
                          onChange={(e) => setEditForm({ ...editForm, orgPermission: e.target.value })}
                          className="w-full px-2 py-1.5 border border-surface-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-accent-500/20 focus:border-accent-500 bg-white"
                        >
                          {permissionOptions.map((opt) => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                      ) : (
                        <span className={cn(
                          'inline-block text-[11px] font-medium px-2 py-0.5 rounded-full',
                          member.orgPermission === 'OWNER' ? 'bg-purple-50 text-purple-700' :
                          member.orgPermission === 'ADMIN' ? 'bg-blue-50 text-blue-700' :
                          member.orgPermission === 'HR' ? 'bg-teal-50 text-teal-700' :
                          member.orgPermission === 'MANAGER' ? 'bg-amber-50 text-amber-700' :
                          member.orgPermission === 'VIEWER' ? 'bg-surface-100 text-ink-400' :
                          'bg-surface-100 text-ink-500'
                        )}>
                          {member.orgPermissionLabel || permissionLabel(member.orgPermission)}
                          {isEditing && isSelf && (
                            <span className="ml-1 text-[10px] text-ink-300">(own)</span>
                          )}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-[13px] text-ink-500">
                      {isEditing ? (
                        <select
                          value={editForm.officeId}
                          onChange={(e) => setEditForm({ ...editForm, officeId: e.target.value })}
                          className="w-full px-2 py-1.5 border border-surface-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-accent-500/20 focus:border-accent-500 bg-white"
                        >
                          <option value="">No office</option>
                          {(team?.offices || []).map((office) => (
                            <option key={office.id} value={office.id}>{office.name} — {office.city}</option>
                          ))}
                        </select>
                      ) : (
                        member.office?.name || '—'
                      )}
                    </td>
                    <td className="py-3 px-4">
                      {isEditing && !isSelf ? (
                        <select
                          value={editForm.status}
                          onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                          className="w-full px-2 py-1.5 border border-surface-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-accent-500/20 focus:border-accent-500 bg-white"
                        >
                          <option value="ACTIVE">Active</option>
                          <option value="DEACTIVATED">Deactivated</option>
                        </select>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          {statusIcon(member.status)}
                          <span className="text-[12px] text-ink-500 capitalize">{member.status.toLowerCase()}</span>
                        </div>
                      )}
                    </td>
                    {canEditTeam && (
                      <td className="py-3 px-4">
                        {isEditing ? (
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={handleEditSave}
                              disabled={editSaving}
                              className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 disabled:opacity-50 transition-colors"
                              title="Save"
                            >
                              {editSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                            </button>
                            <button
                              onClick={cancelEdit}
                              disabled={editSaving}
                              className="p-1.5 rounded-lg bg-surface-100 text-ink-400 hover:bg-surface-200 disabled:opacity-50 transition-colors"
                              title="Cancel"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => startEdit(member)}
                            className="p-1.5 rounded-lg text-ink-300 hover:bg-surface-100 hover:text-ink-600 transition-colors"
                            title="Edit member"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                        )}
                        {saveError && isEditing && (
                          <p className="text-[11px] text-red-600 mt-1 max-w-[160px]">{saveError}</p>
                        )}
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState
          icon={Users}
          title="No team members yet"
          description="Invite your first team member to get started"
        />
      )}
    </div>
  )
}

// ── Section: Billing & Currency ────────────────────────────

function BillingSection() {
  const [org, setOrg] = useState<OrgData | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [selectedCurrencies, setSelectedCurrencies] = useState<string[]>([])

  useEffect(() => {
    fetch('/api/settings/organisation')
      .then((r) => {
        if (!r.ok) throw new Error('Failed to load organisation')
        return r.json()
      })
      .then((data) => {
        setOrg(data)
        setSelectedCurrencies(data.currencies || [])
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  function toggleCurrency(currency: string) {
    setSelectedCurrencies((prev) =>
      prev.includes(currency) ? prev.filter((c) => c !== currency) : [...prev, currency]
    )
  }

  async function handleSave() {
    setSaving(true)
    setSaved(false)
    try {
      const res = await fetch('/api/settings/organisation', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currencies: selectedCurrencies }),
      })
      if (res.ok) {
        setSaved(true)
        setTimeout(() => setSaved(false), 3000)
      }
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <LoadingState />

  return (
    <div>
      <SectionHeader
        title="Billing & Currency"
        description="Configure currencies and billing defaults for your practice"
      />

      <div className="space-y-6 mt-8">
        {/* Default Currency (read-only, set in Org Profile) */}
        <FieldGroup label="Default Currency" hint="Set in Organisation Profile">
          <div className="flex items-center gap-2 p-3 bg-surface-50 rounded-lg">
            <span className="text-lg font-semibold text-ink-900">
              {CURRENCY_OPTIONS.find((c) => c.value === org?.defaultCurrency)?.symbol || '£'}
            </span>
            <span className="text-[13px] text-ink-600">
              {CURRENCY_OPTIONS.find((c) => c.value === org?.defaultCurrency)?.label || org?.defaultCurrency}
            </span>
          </div>
        </FieldGroup>

        {/* Active Currencies */}
        <FieldGroup label="Active Currencies" hint="Currencies available for projects and invoicing">
          <div className="space-y-2">
            {CURRENCY_OPTIONS.map((c) => (
              <label
                key={c.value}
                className={cn(
                  'flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors',
                  selectedCurrencies.includes(c.value)
                    ? 'border-accent-300 bg-accent-50/30'
                    : 'border-surface-200 hover:border-surface-300'
                )}
              >
                <input
                  type="checkbox"
                  checked={selectedCurrencies.includes(c.value)}
                  onChange={() => toggleCurrency(c.value)}
                  className="rounded border-surface-300 text-accent-600 focus:ring-accent-500"
                />
                <span className="text-lg w-6 text-center">{c.symbol}</span>
                <span className="text-[13px] text-ink-700">{c.label}</span>
              </label>
            ))}
          </div>
        </FieldGroup>

        {/* Tax / VAT */}
        <FieldGroup label="Default VAT Rate" hint="Applied to fee proposals and invoices">
          <div className="flex items-center gap-2">
            <input
              type="number"
              defaultValue={20}
              min={0}
              max={100}
              step={0.5}
              className="settings-input w-24 text-center"
            />
            <span className="text-[13px] text-ink-400">%</span>
          </div>
        </FieldGroup>

        {/* Payment Terms */}
        <FieldGroup label="Default Payment Terms">
          <select className="settings-input" defaultValue="30">
            <option value="7">7 days</option>
            <option value="14">14 days</option>
            <option value="30">30 days</option>
            <option value="45">45 days</option>
            <option value="60">60 days</option>
            <option value="90">90 days</option>
          </select>
        </FieldGroup>
      </div>

      <div className="mt-8 pt-6 border-t border-surface-200 flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 bg-ink-900 text-white text-[13px] font-medium rounded-lg hover:bg-ink-800 disabled:opacity-60 transition-colors"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save Changes
        </button>
        {saved && (
          <span className="flex items-center gap-1.5 text-[12px] text-emerald-600 font-medium">
            <CheckCircle className="w-4 h-4" /> Saved
          </span>
        )}
      </div>
    </div>
  )
}

// ── Section: Document Numbering ────────────────────────────

function NumberingSection() {
  const [numbering, setNumbering] = useState<Record<string, { format: string; active: boolean }>>({
    project: { format: '{OFFICE}-{YEAR}-{SEQ:3}', active: true },
    quote: { format: 'Q-{YEAR}-{SEQ:3}', active: true },
    drawing: { format: '{PROJECT}-{SEQ:2}', active: true },
  })
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [editFormat, setEditFormat] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch('/api/org-settings')
      .then((r) => r.json())
      .then((data) => {
        if (data.data?.settings?.numbering) {
          const n = data.data.settings.numbering
          setNumbering({
            project: { format: n.project?.format ?? '{OFFICE}-{YEAR}-{SEQ:3}', active: n.project?.active ?? true },
            quote: { format: n.quote?.format ?? 'Q-{YEAR}-{SEQ:3}', active: n.quote?.active ?? true },
            drawing: { format: n.drawing?.format ?? '{PROJECT}-{SEQ:2}', active: n.drawing?.active ?? true },
          })
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const previewFormat = (fmt: string) => {
    return fmt
      .replace('{OFFICE}', 'LON')
      .replace('{YEAR}', '2026')
      .replace('{YY}', '26')
      .replace('{PROJECT}', 'LON-2026-001')
      .replace(/\{SEQ:(\d+)\}/g, (_m, n) => '1'.padStart(Number(n), '0'))
  }

  const saveTemplate = async (key: string, format: string) => {
    setSaving(true)
    try {
      await fetch('/api/org-settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: { numbering: { [key]: { format } } } }),
      })
      setNumbering((prev) => ({ ...prev, [key]: { ...prev[key], format } }))
      setEditingKey(null)
    } catch {
      // silent
    } finally {
      setSaving(false)
    }
  }

  const labels: Record<string, string> = { project: 'Project Numbers', quote: 'Quote Numbers', drawing: 'Drawing Issue Numbers' }

  if (loading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-brand-500" /></div>
  }

  return (
    <div>
      <SectionHeader
        title="Document Numbering"
        description="Configure automatic numbering for projects, quotes, and drawing issues"
      />

      <div className="mt-6 space-y-4">
        {Object.entries(numbering).map(([key, tmpl]) => (
          <div key={key} className="flex items-center justify-between p-4 bg-surface-50 rounded-lg">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <p className="text-[13px] font-medium text-ink-900">{labels[key]}</p>
                <span className={cn(
                  'text-[10px] px-2 py-0.5 rounded-full font-medium',
                  tmpl.active ? 'bg-emerald-50 text-emerald-700' : 'bg-surface-100 text-surface-500',
                )}>{tmpl.active ? 'Active' : 'Inactive'}</span>
              </div>
              {editingKey === key ? (
                <div className="mt-2 flex items-center gap-2">
                  <input
                    type="text"
                    value={editFormat}
                    onChange={(e) => setEditFormat(e.target.value)}
                    className="settings-input flex-1 text-[12px] font-mono"
                  />
                  <button
                    onClick={() => saveTemplate(key, editFormat)}
                    disabled={saving}
                    className="text-[12px] text-white bg-brand-600 px-3 py-1.5 rounded-lg hover:bg-brand-700 font-medium"
                  >
                    {saving ? 'Saving...' : 'Save'}
                  </button>
                  <button
                    onClick={() => setEditingKey(null)}
                    className="text-[12px] text-surface-500 hover:text-surface-700"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <>
                  <p className="text-[11px] text-ink-400 mt-1">Format: {tmpl.format}</p>
                  <p className="text-[11px] text-ink-500 mt-0.5">Preview: <span className="font-mono font-medium">{previewFormat(tmpl.format)}</span></p>
                </>
              )}
            </div>
            {editingKey !== key && (
              <button
                onClick={() => { setEditingKey(key); setEditFormat(tmpl.format) }}
                className="text-[12px] text-accent-600 hover:text-accent-700 font-medium"
              >
                Edit
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Format Reference */}
      <div className="mt-8 p-4 bg-blue-50 rounded-lg border border-blue-100">
        <p className="text-[12px] font-medium text-blue-800 mb-2">Format Tokens</p>
        <div className="grid grid-cols-2 gap-2 text-[11px]">
          <div><code className="bg-blue-100 px-1.5 py-0.5 rounded text-blue-900">{'{YEAR}'}</code> → 2026</div>
          <div><code className="bg-blue-100 px-1.5 py-0.5 rounded text-blue-900">{'{YY}'}</code> → 26</div>
          <div><code className="bg-blue-100 px-1.5 py-0.5 rounded text-blue-900">{'{SEQ:N}'}</code> → 001</div>
          <div><code className="bg-blue-100 px-1.5 py-0.5 rounded text-blue-900">{'{OFFICE}'}</code> → LON</div>
        </div>
      </div>
    </div>
  )
}

// ── Section: Regional ──────────────────────────────────────

function RegionalSection() {
  const [regional, setRegional] = useState({
    timezone: 'Europe/London',
    dateFormat: 'DD/MM/YYYY',
    numberFormat: 'en-GB',
    weekStart: 'monday',
    language: 'en',
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    fetch('/api/org-settings')
      .then((r) => r.json())
      .then((data) => {
        if (data.data?.settings?.regional) {
          setRegional((prev) => ({ ...prev, ...data.data.settings.regional }))
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const update = (key: string, value: string) => {
    setRegional((prev) => ({ ...prev, [key]: value }))
    setDirty(true)
  }

  const save = async () => {
    setSaving(true)
    try {
      await fetch('/api/org-settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: { regional } }),
      })
      setDirty(false)
    } catch {
      // silent
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-brand-500" /></div>
  }

  return (
    <div>
      <SectionHeader
        title="Regional Settings"
        description="Locale, timezone, and formatting preferences"
      />

      <div className="space-y-6 mt-8">
        <FieldGroup label="Timezone">
          <select className="settings-input" value={regional.timezone} onChange={(e) => update('timezone', e.target.value)}>
            <option value="Europe/London">Europe/London (GMT/BST)</option>
            <option value="Europe/Berlin">Europe/Berlin (CET/CEST)</option>
            <option value="America/New_York">America/New_York (EST/EDT)</option>
            <option value="Africa/Lagos">Africa/Lagos (WAT)</option>
            <option value="Asia/Dubai">Asia/Dubai (GST)</option>
          </select>
        </FieldGroup>

        <FieldGroup label="Date Format">
          <select className="settings-input" value={regional.dateFormat} onChange={(e) => update('dateFormat', e.target.value)}>
            <option value="DD/MM/YYYY">DD/MM/YYYY — 18/07/2026</option>
            <option value="MM/DD/YYYY">MM/DD/YYYY — 07/18/2026</option>
            <option value="YYYY-MM-DD">YYYY-MM-DD — 2026-07-18</option>
            <option value="D MMM YYYY">D MMM YYYY — 18 Jul 2026</option>
          </select>
        </FieldGroup>

        <FieldGroup label="Number Format">
          <select className="settings-input" value={regional.numberFormat} onChange={(e) => update('numberFormat', e.target.value)}>
            <option value="en-GB">1,234.56 (UK/US)</option>
            <option value="de-DE">1.234,56 (EU)</option>
          </select>
        </FieldGroup>

        <FieldGroup label="Week Starts On">
          <select className="settings-input" value={regional.weekStart} onChange={(e) => update('weekStart', e.target.value)}>
            <option value="monday">Monday</option>
            <option value="sunday">Sunday</option>
          </select>
        </FieldGroup>

        <FieldGroup label="Language">
          <select className="settings-input" value={regional.language} onChange={(e) => update('language', e.target.value)}>
            <option value="en">English</option>
          </select>
          <p className="text-[11px] text-ink-300 mt-1">More languages coming soon</p>
        </FieldGroup>
      </div>

      <div className="mt-8 pt-6 border-t border-surface-200">
        <button
          onClick={save}
          disabled={!dirty || saving}
          className={cn(
            'flex items-center gap-2 px-5 py-2.5 text-[13px] font-medium rounded-lg transition-colors',
            dirty
              ? 'bg-ink-900 text-white hover:bg-ink-800'
              : 'bg-surface-100 text-surface-400 cursor-not-allowed',
          )}
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save Changes
        </button>
      </div>
    </div>
  )
}

// ── Section: Integrations ──────────────────────────────────

function IntegrationsSection() {
  const integrations = [
    { name: 'Xero', description: 'Sync invoices and financial data', status: 'available', category: 'Accounting' },
    { name: 'QuickBooks', description: 'Accounting and bookkeeping', status: 'available', category: 'Accounting' },
    { name: 'Microsoft 365', description: 'Calendar, email and file sync', status: 'coming', category: 'Productivity' },
    { name: 'Google Workspace', description: 'Calendar, email and drive', status: 'coming', category: 'Productivity' },
    { name: 'Slack', description: 'Team notifications and alerts', status: 'available', category: 'Communication' },
    { name: 'Revit', description: 'BIM model data sync', status: 'coming', category: 'Design Tools' },
  ]

  return (
    <div>
      <SectionHeader
        title="Integrations"
        description="Connect Coordin.io with the tools your practice already uses"
      />

      <div className="mt-6 space-y-4">
        {integrations.map((integration) => (
          <div key={integration.name} className="flex items-center justify-between p-4 bg-surface-50 rounded-lg">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <p className="text-[13px] font-medium text-ink-900">{integration.name}</p>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-surface-200 text-ink-400 font-medium">
                  {integration.category}
                </span>
              </div>
              <p className="text-[11px] text-ink-400 mt-1">{integration.description}</p>
            </div>
            {integration.status === 'available' ? (
              <button className="text-[12px] text-accent-600 hover:text-accent-700 font-medium px-3 py-1.5 border border-accent-200 rounded-lg hover:bg-accent-50 transition-colors">
                Connect
              </button>
            ) : (
              <span className="text-[11px] text-ink-300 font-medium">Coming Soon</span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Section: AI Governance ──────────────────────────────────

function GovernanceSection() {
  const sourceCategories = [
    { key: 'project_data', label: 'Project Data', description: 'Risk registers, tasks, issues, approvals', enabled: true },
    { key: 'project_documents', label: 'Project Documents', description: 'Drawings, specifications, transmittals', enabled: true },
    { key: 'knowledge_base', label: 'Knowledge Base', description: 'Office procedures, templates, lessons learned', enabled: true },
    { key: 'reference_uploads', label: 'Reference Uploads', description: 'External reference materials', enabled: false },
    { key: 'fee_data', label: 'Fee Data', description: 'Fee schedules, cost data, fee clause templates', enabled: false },
  ]

  return (
    <div>
      <SectionHeader
        title="AI Governance"
        description="Control what data the AI assistant can access and review audit logs"
      />

      <div className="mt-6">
        <h3 className="text-[13px] font-semibold text-ink-900 mb-4">Source Permissions</h3>
        <div className="space-y-2">
          {sourceCategories.map((cat) => (
            <div key={cat.key} className="flex items-center justify-between p-4 bg-surface-50 rounded-lg">
              <div className="flex-1">
                <p className="text-[13px] font-medium text-ink-900">{cat.label}</p>
                <p className="text-[11px] text-ink-400 mt-0.5">{cat.description}</p>
              </div>
              <div className="flex items-center gap-2 ml-4">
                <span className={cn('w-2.5 h-2.5 rounded-full', cat.enabled ? 'bg-emerald-500' : 'bg-surface-300')} />
                <span className={cn('text-[11px] font-medium uppercase tracking-wide', cat.enabled ? 'text-emerald-700' : 'text-ink-400')}>
                  {cat.enabled ? 'Enabled' : 'Disabled'}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-8 pt-6 border-t border-surface-200">
        <h3 className="text-[13px] font-semibold text-ink-900 mb-2">Audit Log</h3>
        <p className="text-[11px] text-ink-400 mb-4">All AI prompts and outputs are logged for governance review</p>
        <div className="p-6 bg-surface-50 rounded-lg text-center">
          <p className="text-[13px] text-ink-300">No AI interactions logged yet</p>
        </div>
      </div>
    </div>
  )
}

// ── Section: Audit Trail ──────────────────────────────────

interface AuditEvent {
  id: string
  action: string
  actionLabel: string
  entityType: string
  entityId: string
  metadata: unknown
  actorId: string
  actorName: string | null
  actorEmail: string | null
  actorRole: string | null
  createdAt: string
  ipAddress: string | null
}

const QUICK_FILTERS = [
  { label: 'All', value: '' },
  { label: 'HR (All)', value: 'hr' },
  { label: 'Staffing', value: 'staffing.' },
  { label: 'Leave', value: 'leave.' },
  { label: 'Expenses', value: 'expense.' },
  { label: 'Onboarding', value: 'onboarding.' },
  { label: 'Invitations', value: 'invitation.' },
  { label: 'Requests', value: 'request.' },
  { label: 'Assets', value: 'asset.' },
  { label: 'Projects', value: 'project.' },
  { label: 'Tasks', value: 'task.' },
  { label: 'Documents', value: 'document.' },
  { label: 'Security', value: 'security.' },
  { label: 'Commercial', value: 'commercial.' },
  { label: 'Site', value: 'site.' },
]

function AuditSection() {
  const [events, setEvents] = useState<AuditEvent[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [offset, setOffset] = useState(0)
  const [actionFilter, setActionFilter] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)
  const [accessDenied, setAccessDenied] = useState(false)
  const limit = 50

  const fetchEvents = useCallback(() => {
    setLoading(true)
    const params = new URLSearchParams()
    params.set('limit', String(limit))
    params.set('offset', String(offset))
    if (actionFilter) params.set('action', actionFilter)
    if (fromDate) params.set('from', fromDate)
    if (toDate) params.set('to', toDate)

    fetch(`/api/audit?${params}`)
      .then((r) => {
        if (r.status === 403) {
          setAccessDenied(true)
          return null
        }
        if (!r.ok) throw new Error('Failed to load')
        return r.json()
      })
      .then((data) => {
        if (!data) return
        setEvents(data.data?.events || [])
        setTotal(data.data?.total || 0)
      })
      .catch(() => setEvents([]))
      .finally(() => setLoading(false))
  }, [offset, actionFilter, fromDate, toDate])

  useEffect(() => {
    fetchEvents()
  }, [fetchEvents])

  function handleFilterChange(value: string) {
    setActionFilter(value)
    setOffset(0)
  }

  function handleDateChange(field: 'from' | 'to', value: string) {
    if (field === 'from') setFromDate(value)
    else setToDate(value)
    setOffset(0)
  }

  async function handleExport() {
    if (!fromDate || !toDate) {
      setExportError('Select both From and To dates to export')
      return
    }
    setExporting(true)
    setExportError(null)
    try {
      const params = new URLSearchParams()
      params.set('from', fromDate)
      params.set('to', toDate)
      if (actionFilter) params.set('action', actionFilter)

      const res = await fetch(`/api/audit/export?${params}`)
      if (res.status === 429) {
        setExportError('Please wait 1 minute between exports')
        return
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || 'Export failed')
      }

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `audit-${fromDate}-to-${toDate}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      setExportError(err instanceof Error ? err.message : 'Export failed')
    } finally {
      setExporting(false)
    }
  }

  if (accessDenied) {
    return (
      <div>
        <SectionHeader
          title="Audit Trail"
          description="You do not have permission to view the audit trail. Contact your Practice Principal."
        />
      </div>
    )
  }

  return (
    <div>
      <SectionHeader
        title="Audit Trail"
        description="Review all actions taken within your organisation — filter by type, person, or date range"
      />

      {/* Filters */}
      <div className="mt-6 space-y-4">
        {/* Quick Filter Presets */}
        <div className="flex flex-wrap gap-2">
          {QUICK_FILTERS.map((f) => (
            <button
              key={f.label}
              onClick={() => handleFilterChange(f.value)}
              className={cn(
                'px-3 py-1.5 text-[11px] font-medium rounded-full border transition-colors',
                actionFilter === f.value
                  ? 'bg-ink-900 text-white border-ink-900'
                  : 'bg-white text-ink-500 border-surface-200 hover:border-surface-300 hover:text-ink-700'
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Date Range + Export */}
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-[10px] font-semibold text-ink-400 uppercase tracking-wider mb-1">From</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => handleDateChange('from', e.target.value)}
              className="px-3 py-2 border border-surface-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-accent-500/20 focus:border-accent-500 bg-white"
            />
          </div>
          <div>
            <label className="block text-[10px] font-semibold text-ink-400 uppercase tracking-wider mb-1">To</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => handleDateChange('to', e.target.value)}
              className="px-3 py-2 border border-surface-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-accent-500/20 focus:border-accent-500 bg-white"
            />
          </div>
          <button
            onClick={handleExport}
            disabled={exporting || !fromDate || !toDate}
            className="flex items-center gap-2 px-4 py-2 bg-ink-900 text-white text-[12px] font-medium rounded-lg hover:bg-ink-800 disabled:opacity-50 transition-colors"
          >
            {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            Export CSV
          </button>
        </div>

        {exportError && (
          <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg text-[12px] text-red-700">{exportError}</div>
        )}
      </div>

      {/* Summary */}
      <div className="mt-4 mb-2 flex items-center justify-between">
        <span className="text-[11px] text-ink-400">{total} events found</span>
        {(actionFilter || fromDate || toDate) && (
          <button
            onClick={() => { setActionFilter(''); setFromDate(''); setToDate(''); setOffset(0) }}
            className="text-[11px] text-accent-600 hover:text-accent-700 font-medium"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Events Table */}
      {loading ? (
        <LoadingState />
      ) : events.length === 0 ? (
        <EmptyState
          icon={ScrollText}
          title="No audit events"
          description={actionFilter || fromDate ? 'Try adjusting your filters' : 'Actions will appear here as they happen'}
        />
      ) : (
        <>
          <div className="border border-surface-200 rounded-lg overflow-x-auto -mx-4 sm:mx-0">
            <table className="w-full min-w-[700px]">
              <thead>
                <tr className="bg-surface-50 border-b border-surface-200">
                  <th className="text-left py-3 px-4 text-[10px] font-semibold text-ink-400 uppercase tracking-wider">Time</th>
                  <th className="text-left py-3 px-4 text-[10px] font-semibold text-ink-400 uppercase tracking-wider">Action</th>
                  <th className="text-left py-3 px-4 text-[10px] font-semibold text-ink-400 uppercase tracking-wider">Entity</th>
                  <th className="text-left py-3 px-4 text-[10px] font-semibold text-ink-400 uppercase tracking-wider">Actor</th>
                  <th className="text-left py-3 px-4 text-[10px] font-semibold text-ink-400 uppercase tracking-wider">Role</th>
                </tr>
              </thead>
              <tbody>
                {events.map((event) => (
                  <tr key={event.id} className="border-b border-surface-200/60 hover:bg-surface-50/50 transition-colors">
                    <td className="py-3 px-4 text-[12px] text-ink-500 whitespace-nowrap">
                      {new Date(event.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}{' '}
                      <span className="text-ink-300">
                        {new Date(event.createdAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-[12px] text-ink-700">{event.actionLabel}</span>
                      <span className="block text-[10px] text-ink-300 font-mono mt-0.5">{event.action}</span>
                    </td>
                    <td className="py-3 px-4 text-[12px] text-ink-500">
                      {event.entityType}
                      <span className="text-ink-300 ml-1 font-mono text-[10px]">{event.entityId.slice(0, 8)}</span>
                    </td>
                    <td className="py-3 px-4 text-[12px] text-ink-600">
                      {event.actorName || event.actorEmail || 'System'}
                    </td>
                    <td className="py-3 px-4">
                      {event.actorRole && (
                        <span className={cn(
                          'inline-block text-[10px] font-medium px-2 py-0.5 rounded-full',
                          event.actorRole === 'OWNER' ? 'bg-purple-50 text-purple-700' :
                          event.actorRole === 'ADMIN' ? 'bg-blue-50 text-blue-700' :
                          event.actorRole === 'HR' ? 'bg-teal-50 text-teal-700' :
                          'bg-surface-100 text-ink-500'
                        )}>
                          {event.actorRole === 'OWNER' ? 'Principal' :
                           event.actorRole === 'ADMIN' ? 'Manager' :
                           event.actorRole === 'HR' ? 'HR' :
                           event.actorRole}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {total > limit && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-[11px] text-ink-400">
                {offset + 1}–{Math.min(offset + limit, total)} of {total}
              </p>
              <div className="flex gap-2">
                <button
                  disabled={offset === 0}
                  onClick={() => setOffset(Math.max(0, offset - limit))}
                  className="p-2 rounded-lg border border-surface-200 disabled:opacity-40 hover:bg-surface-50"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  disabled={offset + limit >= total}
                  onClick={() => setOffset(offset + limit)}
                  className="p-2 rounded-lg border border-surface-200 disabled:opacity-40 hover:bg-surface-50"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ── Shared Components ──────────────────────────────────────

function SectionHeader({ title, description }: { title: string; description: string }) {
  return (
    <div className="pb-6 border-b border-surface-200">
      <h2 className="font-display text-xl text-ink-900">{title}</h2>
      <p className="text-[13px] text-ink-400 mt-1">{description}</p>
    </div>
  )
}

// ── Approval Routes Section ─────────────────────────────

interface ApprovalRoute {
  id: string
  requestType: string
  name: string
  isDefault: boolean
  isActive: boolean
  priority: number
  conditions: Record<string, unknown> | null
  steps: ApprovalRouteStep[]
}

interface ApprovalRouteStep {
  id: string
  stepOrder: number
  label: string
  approverType: string
  approverRole: string | null
  approverId: string | null
  canSkipIfSameAsPrevious: boolean
  escalationDays: number | null
}

const REQUEST_TYPE_LABELS: Record<string, string> = {
  LEAVE: 'Leave',
  EXPENSE: 'Expense',
  SERVICE_REQUEST: 'Service Request',
  TRAVEL: 'Travel',
}

const APPROVER_TYPE_LABELS: Record<string, string> = {
  LINE_MANAGER: 'Line Manager',
  PROJECT_MANAGER: 'Project Manager',
  ROLE: 'Role-based',
  SPECIFIC_PERSON: 'Specific Person',
}

function ApprovalRoutesSection() {
  const [routes, setRoutes] = useState<ApprovalRoute[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [saving, setSaving] = useState(false)

  // Edit route state
  const [editingRouteId, setEditingRouteId] = useState<string | null>(null)
  const [editRouteForm, setEditRouteForm] = useState({ name: '', isDefault: false, isActive: true, priority: 0 })
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)

  // New route form state
  const [newRoute, setNewRoute] = useState({
    name: '',
    requestType: 'LEAVE' as string,
    isDefault: false,
    priority: 0,
    steps: [{ label: 'Step 1', approverType: 'LINE_MANAGER', approverRole: '', approverId: '', canSkipIfSameAsPrevious: false, escalationDays: '' }] as Array<{
      label: string; approverType: string; approverRole: string; approverId: string; canSkipIfSameAsPrevious: boolean; escalationDays: string
    }>,
  })

  const fetchRoutes = useCallback(async () => {
    try {
      const res = await fetch('/api/approval-routes')
      if (!res.ok) throw new Error('Failed to load')
      const data = await res.json()
      setRoutes(data.routes || [])
    } catch {
      setError('Failed to load approval routes')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchRoutes() }, [fetchRoutes])

  const toggleActive = async (route: ApprovalRoute) => {
    try {
      await fetch(`/api/approval-routes/${route.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !route.isActive }),
      })
      fetchRoutes()
    } catch { /* silent */ }
  }

  const deleteRoute = async (route: ApprovalRoute) => {
    if (!confirm(`Delete "${route.name}"?`)) return
    try {
      const res = await fetch(`/api/approval-routes/${route.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json()
        alert(data.error?.message || 'Cannot delete route')
        return
      }
      fetchRoutes()
    } catch { /* silent */ }
  }

  const startEditRoute = (route: ApprovalRoute) => {
    setEditingRouteId(route.id)
    setEditRouteForm({
      name: route.name,
      isDefault: route.isDefault,
      isActive: route.isActive,
      priority: route.priority,
    })
    setEditError(null)
    setExpandedId(route.id)
  }

  const cancelEditRoute = () => {
    setEditingRouteId(null)
    setEditError(null)
  }

  const saveEditRoute = async () => {
    if (!editingRouteId || !editRouteForm.name.trim()) return
    setEditSaving(true)
    setEditError(null)
    try {
      const res = await fetch(`/api/approval-routes/${editingRouteId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editRouteForm.name,
          isDefault: editRouteForm.isDefault,
          isActive: editRouteForm.isActive,
          priority: editRouteForm.priority,
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error?.message || 'Failed to update route')
      }
      setEditingRouteId(null)
      fetchRoutes()
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setEditSaving(false)
    }
  }

  const createRoute = async () => {
    if (!newRoute.name.trim()) return
    setSaving(true)
    try {
      const body = {
        name: newRoute.name,
        requestType: newRoute.requestType,
        isDefault: newRoute.isDefault,
        priority: newRoute.priority,
        steps: newRoute.steps.map(s => ({
          label: s.label,
          approverType: s.approverType,
          approverRole: s.approverRole || undefined,
          approverId: s.approverId || undefined,
          canSkipIfSameAsPrevious: s.canSkipIfSameAsPrevious,
          escalationDays: s.escalationDays ? parseInt(s.escalationDays) : undefined,
        })),
      }
      const res = await fetch('/api/approval-routes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const data = await res.json()
        alert(data.error?.message || 'Failed to create route')
        return
      }
      setShowCreate(false)
      setNewRoute({
        name: '', requestType: 'LEAVE', isDefault: false, priority: 0,
        steps: [{ label: 'Step 1', approverType: 'LINE_MANAGER', approverRole: '', approverId: '', canSkipIfSameAsPrevious: false, escalationDays: '' }],
      })
      fetchRoutes()
    } catch {
      alert('Failed to create route')
    } finally {
      setSaving(false)
    }
  }

  const addStep = () => {
    setNewRoute(prev => ({
      ...prev,
      steps: [...prev.steps, {
        label: `Step ${prev.steps.length + 1}`,
        approverType: 'LINE_MANAGER',
        approverRole: '', approverId: '',
        canSkipIfSameAsPrevious: false, escalationDays: '',
      }],
    }))
  }

  const removeStep = (idx: number) => {
    if (newRoute.steps.length <= 1) return
    setNewRoute(prev => ({
      ...prev,
      steps: prev.steps.filter((_, i) => i !== idx),
    }))
  }

  const updateStep = (idx: number, field: string, value: unknown) => {
    setNewRoute(prev => ({
      ...prev,
      steps: prev.steps.map((s, i) => i === idx ? { ...s, [field]: value } : s),
    }))
  }

  if (loading) return <LoadingState />
  if (error) return <div className="text-red-500 text-sm p-4">{error}</div>

  // Group by request type
  const grouped = routes.reduce<Record<string, ApprovalRoute[]>>((acc, r) => {
    const key = r.requestType
    if (!acc[key]) acc[key] = []
    acc[key].push(r)
    return acc
  }, {})

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Approval Workflows"
        description="Configure multi-step approval routes for leave, expenses, service requests, and travel."
      />

      <div className="flex justify-end">
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-600 text-white rounded-lg text-[13px] font-medium hover:bg-brand-700 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          New Route
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="bg-surface-50 border border-surface-200 rounded-lg p-4 space-y-4">
          <h3 className="font-medium text-ink-800 text-sm">Create Approval Route</h3>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-ink-500 uppercase mb-1">Name</label>
              <input
                value={newRoute.name}
                onChange={e => setNewRoute(prev => ({ ...prev, name: e.target.value }))}
                className="w-full px-3 py-1.5 border border-surface-200 rounded-md text-sm"
                placeholder="e.g. Standard Leave Approval"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-ink-500 uppercase mb-1">Request Type</label>
              <select
                value={newRoute.requestType}
                onChange={e => setNewRoute(prev => ({ ...prev, requestType: e.target.value }))}
                className="w-full px-3 py-1.5 border border-surface-200 rounded-md text-sm"
              >
                {Object.entries(REQUEST_TYPE_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex gap-4 items-center">
            <label className="flex items-center gap-2 text-sm text-ink-600">
              <input
                type="checkbox"
                checked={newRoute.isDefault}
                onChange={e => setNewRoute(prev => ({ ...prev, isDefault: e.target.checked }))}
              />
              Default route
            </label>
            <div className="flex items-center gap-2">
              <label className="text-[11px] font-semibold text-ink-500 uppercase">Priority</label>
              <input
                type="number"
                value={newRoute.priority}
                onChange={e => setNewRoute(prev => ({ ...prev, priority: parseInt(e.target.value) || 0 }))}
                className="w-16 px-2 py-1 border border-surface-200 rounded text-sm"
                min={0} max={100}
              />
            </div>
          </div>

          {/* Steps */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-semibold text-ink-500 uppercase">Approval Steps</label>
              <button onClick={addStep} className="text-brand-600 text-xs font-medium hover:text-brand-700">+ Add Step</button>
            </div>

            {newRoute.steps.map((step, idx) => (
              <div key={idx} className="bg-white border border-surface-200 rounded-md p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-ink-500">Step {idx + 1}</span>
                  {newRoute.steps.length > 1 && (
                    <button onClick={() => removeStep(idx)} className="text-red-400 hover:text-red-600">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    value={step.label}
                    onChange={e => updateStep(idx, 'label', e.target.value)}
                    className="px-2 py-1 border border-surface-200 rounded text-sm"
                    placeholder="Step label"
                  />
                  <select
                    value={step.approverType}
                    onChange={e => updateStep(idx, 'approverType', e.target.value)}
                    className="px-2 py-1 border border-surface-200 rounded text-sm"
                  >
                    {Object.entries(APPROVER_TYPE_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {step.approverType === 'ROLE' && (
                    <input
                      value={step.approverRole}
                      onChange={e => updateStep(idx, 'approverRole', e.target.value)}
                      className="px-2 py-1 border border-surface-200 rounded text-sm"
                      placeholder="Role (e.g. HR)"
                    />
                  )}
                  <input
                    value={step.escalationDays}
                    onChange={e => updateStep(idx, 'escalationDays', e.target.value)}
                    className="px-2 py-1 border border-surface-200 rounded text-sm"
                    placeholder="Escalation days"
                    type="number"
                  />
                  <label className="flex items-center gap-1 text-xs text-ink-500">
                    <input
                      type="checkbox"
                      checked={step.canSkipIfSameAsPrevious}
                      onChange={e => updateStep(idx, 'canSkipIfSameAsPrevious', e.target.checked)}
                    />
                    Skip if same approver
                  </label>
                </div>
              </div>
            ))}
          </div>

          <div className="flex gap-2 pt-2">
            <button
              onClick={createRoute}
              disabled={saving || !newRoute.name.trim()}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-brand-600 text-white rounded-lg text-[13px] font-medium hover:bg-brand-700 disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              Create Route
            </button>
            <button
              onClick={() => setShowCreate(false)}
              className="px-4 py-1.5 border border-surface-200 rounded-lg text-[13px] text-ink-500 hover:bg-surface-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Routes grouped by type */}
      {routes.length === 0 ? (
        <EmptyState
          icon={CheckCircle}
          title="No approval routes configured"
          description="Create routes to enable multi-step approval workflows for leave, expenses, and service requests."
        />
      ) : (
        Object.entries(grouped).map(([type, typeRoutes]) => (
          <div key={type} className="space-y-2">
            <h3 className="text-xs font-semibold text-ink-500 uppercase tracking-wider">
              {REQUEST_TYPE_LABELS[type] || type}
            </h3>

            {typeRoutes.map(route => {
              const isEditing = editingRouteId === route.id
              return (
              <div key={route.id} className="border border-surface-200 rounded-lg overflow-hidden">
                <div
                  className="flex items-center justify-between px-4 py-3 bg-white cursor-pointer hover:bg-surface-25"
                  onClick={() => setExpandedId(expandedId === route.id ? null : route.id)}
                >
                  <div className="flex items-center gap-3">
                    <ChevronRight className={cn('w-4 h-4 text-ink-300 transition-transform', expandedId === route.id && 'rotate-90')} />
                    <span className="text-sm font-medium text-ink-800">{route.name}</span>
                    {route.isDefault && (
                      <span className="px-1.5 py-0.5 bg-brand-50 text-brand-600 text-[10px] font-semibold rounded">DEFAULT</span>
                    )}
                    {!route.isActive && (
                      <span className="px-1.5 py-0.5 bg-amber-50 text-amber-600 text-[10px] font-semibold rounded">INACTIVE</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-ink-400">{route.steps.length} step{route.steps.length !== 1 ? 's' : ''}</span>
                    <button
                      onClick={e => { e.stopPropagation(); toggleActive(route) }}
                      className={cn(
                        'px-2 py-0.5 rounded text-[10px] font-medium',
                        route.isActive ? 'bg-green-50 text-green-600 hover:bg-green-100' : 'bg-surface-100 text-ink-400 hover:bg-surface-200',
                      )}
                    >
                      {route.isActive ? 'Active' : 'Inactive'}
                    </button>
                    <button
                      onClick={e => { e.stopPropagation(); startEditRoute(route) }}
                      className="p-1 text-ink-300 hover:text-accent-600"
                      title="Edit route"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={e => { e.stopPropagation(); deleteRoute(route) }}
                      className="p-1 text-red-300 hover:text-red-500"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {expandedId === route.id && (
                  <div className="border-t border-surface-100 px-4 py-3 bg-surface-25 space-y-2">
                    {/* Inline edit form */}
                    {isEditing ? (
                      <div className="space-y-3">
                        {editError && (
                          <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg text-[12px] text-red-700">{editError}</div>
                        )}
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[11px] font-semibold text-ink-500 uppercase mb-1">Name</label>
                            <input
                              value={editRouteForm.name}
                              onChange={e => setEditRouteForm(prev => ({ ...prev, name: e.target.value }))}
                              className="w-full px-3 py-1.5 border border-surface-200 rounded-md text-[13px] focus:outline-none focus:ring-2 focus:ring-accent-500/20 focus:border-accent-500 bg-white"
                              placeholder="Route name"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-semibold text-ink-500 uppercase mb-1">Priority</label>
                            <input
                              type="number"
                              value={editRouteForm.priority}
                              onChange={e => setEditRouteForm(prev => ({ ...prev, priority: parseInt(e.target.value) || 0 }))}
                              className="w-full px-3 py-1.5 border border-surface-200 rounded-md text-[13px] focus:outline-none focus:ring-2 focus:ring-accent-500/20 focus:border-accent-500 bg-white"
                              min={0} max={100}
                            />
                          </div>
                        </div>
                        <div className="flex gap-4 items-center">
                          <label className="flex items-center gap-2 text-[12px] text-ink-600 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={editRouteForm.isDefault}
                              onChange={e => setEditRouteForm(prev => ({ ...prev, isDefault: e.target.checked }))}
                              className="rounded border-surface-300 text-accent-600 focus:ring-accent-500"
                            />
                            Default route
                          </label>
                          <label className="flex items-center gap-2 text-[12px] text-ink-600 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={editRouteForm.isActive}
                              onChange={e => setEditRouteForm(prev => ({ ...prev, isActive: e.target.checked }))}
                              className="rounded border-surface-300 text-accent-600 focus:ring-accent-500"
                            />
                            Active
                          </label>
                        </div>
                        <div className="flex gap-2 pt-1">
                          <button
                            onClick={saveEditRoute}
                            disabled={editSaving || !editRouteForm.name.trim()}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-ink-900 text-white text-[11px] font-medium rounded-md hover:bg-ink-800 disabled:opacity-50 transition-colors"
                          >
                            {editSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                            Save
                          </button>
                          <button
                            onClick={cancelEditRoute}
                            disabled={editSaving}
                            className="px-3 py-1.5 text-[11px] text-ink-500 hover:text-ink-700"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="text-xs text-ink-400">
                          Priority: {route.priority} | Conditions: {route.conditions ? JSON.stringify(route.conditions) : 'None'}
                        </div>
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="text-ink-400 border-b border-surface-100">
                              <th className="text-left py-1 font-medium">#</th>
                              <th className="text-left py-1 font-medium">Label</th>
                              <th className="text-left py-1 font-medium">Approver Type</th>
                              <th className="text-left py-1 font-medium">Skip if Same</th>
                              <th className="text-left py-1 font-medium">Escalation</th>
                            </tr>
                          </thead>
                          <tbody>
                            {route.steps.map(step => (
                              <tr key={step.id} className="border-b border-surface-50 text-ink-600">
                                <td className="py-1.5">{step.stepOrder}</td>
                                <td className="py-1.5">{step.label}</td>
                                <td className="py-1.5">{APPROVER_TYPE_LABELS[step.approverType] || step.approverType}{step.approverRole ? ` (${step.approverRole})` : ''}</td>
                                <td className="py-1.5">{step.canSkipIfSameAsPrevious ? 'Yes' : 'No'}</td>
                                <td className="py-1.5">{step.escalationDays ? `${step.escalationDays} days` : '—'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </>
                    )}
                  </div>
                )}
              </div>
              )
            })}
          </div>
        ))
      )}
    </div>
  )
}

// ── External Links Section ──────────────────────────────

interface ExternalLinkData {
  id: string
  entityType: string
  entityId: string
  linkType: string
  url: string
  label: string
  createdBy: { id: string; fullName: string } | null
  createdAt: string
}

const LINK_TYPE_OPTIONS = [
  { value: 'EXTERNAL_URL', label: 'External URL' },
  { value: 'SHAREPOINT_FOLDER', label: 'SharePoint Folder' },
  { value: 'SHAREPOINT_DOCUMENT', label: 'SharePoint Document' },
]

const ENTITY_TYPE_OPTIONS = [
  { value: 'project', label: 'Project' },
  { value: 'task', label: 'Task' },
  { value: 'expense', label: 'Expense' },
  { value: 'document', label: 'Document' },
  { value: 'leave_request', label: 'Leave Request' },
  { value: 'service_request', label: 'Service Request' },
  { value: 'asset', label: 'Asset' },
  { value: 'drawing', label: 'Drawing' },
  { value: 'compliance_item', label: 'Compliance Item' },
  { value: 'planning_application', label: 'Planning Application' },
  { value: 'fee_quote', label: 'Fee Quote' },
  { value: 'milestone', label: 'Milestone' },
]

const LINK_TYPE_LABELS: Record<string, string> = {
  EXTERNAL_URL: 'External URL',
  SHAREPOINT_FOLDER: 'SharePoint Folder',
  SHAREPOINT_DOCUMENT: 'SharePoint Document',
}

function ExternalLinksSection() {
  const [links, setLinks] = useState<ExternalLinkData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState({
    label: '', url: '', linkType: 'EXTERNAL_URL', entityType: 'project', entityId: '',
  })

  const fetchLinks = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/external-links')
      if (!res.ok) throw new Error('Failed to load external links')
      const data = await res.json()
      setLinks(data.links ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchLinks() }, [fetchLinks])

  function resetForm() {
    setForm({ label: '', url: '', linkType: 'EXTERNAL_URL', entityType: 'project', entityId: '' })
    setShowForm(false)
    setEditingId(null)
  }

  function startEdit(link: ExternalLinkData) {
    setEditingId(link.id)
    setForm({
      label: link.label,
      url: link.url,
      linkType: link.linkType,
      entityType: link.entityType,
      entityId: link.entityId,
    })
    setShowForm(true)
  }

  async function handleSave() {
    setBusy(true)
    setError(null)
    try {
      if (editingId) {
        const res = await fetch(`/api/external-links/${editingId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            label: form.label,
            url: form.url,
            linkType: form.linkType,
          }),
        })
        if (!res.ok) {
          const e = await res.json()
          throw new Error(e.error || 'Failed to update')
        }
      } else {
        const res = await fetch('/api/external-links', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            label: form.label,
            url: form.url,
            linkType: form.linkType,
            entityType: form.entityType,
            entityId: form.entityId,
          }),
        })
        if (!res.ok) {
          const e = await res.json()
          throw new Error(e.error || 'Failed to create')
        }
      }
      resetForm()
      await fetchLinks()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save')
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this external link?')) return
    setBusy(true)
    try {
      const res = await fetch(`/api/external-links/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const e = await res.json()
        throw new Error(e.error || 'Failed to delete')
      }
      await fetchLinks()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete')
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <LoadingState />

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-ink-900">External Links</h2>
          <p className="text-[12px] text-ink-400 mt-1">
            Manage external link shortcuts attached to projects, tasks, and other entities across your organisation.
          </p>
        </div>
        <button
          onClick={() => { resetForm(); setShowForm(true) }}
          className="flex items-center gap-1.5 px-3 py-2 bg-accent-600 text-white text-[13px] rounded-lg hover:bg-accent-700 transition-colors"
        >
          <Plus className="w-4 h-4" /> Add Link
        </button>
      </div>

      {error && (
        <div className="text-[13px] text-red-600 bg-red-50 px-4 py-2 rounded-lg">{error}</div>
      )}

      {/* Add / Edit Form */}
      {showForm && (
        <div className="border border-surface-200 rounded-lg p-4 bg-surface-50 space-y-4">
          <p className="text-[13px] font-medium text-ink-700">
            {editingId ? 'Edit Link' : 'Add Link'}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[12px] text-ink-500 mb-1">Title *</label>
              <input
                value={form.label}
                onChange={(e) => setForm({ ...form, label: e.target.value })}
                placeholder="e.g. Project Specifications"
                className="w-full px-3 py-2 rounded-lg border border-surface-200 text-[13px] focus:outline-none focus:ring-2 focus:ring-accent-500/20 focus:border-accent-500 bg-white"
              />
            </div>
            <div>
              <label className="block text-[12px] text-ink-500 mb-1">URL *</label>
              <input
                type="url"
                value={form.url}
                onChange={(e) => setForm({ ...form, url: e.target.value })}
                placeholder="https://example.com/resource"
                className="w-full px-3 py-2 rounded-lg border border-surface-200 text-[13px] focus:outline-none focus:ring-2 focus:ring-accent-500/20 focus:border-accent-500 bg-white"
              />
            </div>
            <div>
              <label className="block text-[12px] text-ink-500 mb-1">Link Type</label>
              <select
                value={form.linkType}
                onChange={(e) => setForm({ ...form, linkType: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-surface-200 text-[13px] focus:outline-none focus:ring-2 focus:ring-accent-500/20 focus:border-accent-500 bg-white"
              >
                {LINK_TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            {!editingId && (
              <>
                <div>
                  <label className="block text-[12px] text-ink-500 mb-1">Entity Type *</label>
                  <select
                    value={form.entityType}
                    onChange={(e) => setForm({ ...form, entityType: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-surface-200 text-[13px] focus:outline-none focus:ring-2 focus:ring-accent-500/20 focus:border-accent-500 bg-white"
                  >
                    {ENTITY_TYPE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[12px] text-ink-500 mb-1">Entity ID *</label>
                  <input
                    value={form.entityId}
                    onChange={(e) => setForm({ ...form, entityId: e.target.value })}
                    placeholder="Entity identifier"
                    className="w-full px-3 py-2 rounded-lg border border-surface-200 text-[13px] focus:outline-none focus:ring-2 focus:ring-accent-500/20 focus:border-accent-500 bg-white"
                  />
                </div>
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleSave}
              disabled={busy || !form.label || !form.url || (!editingId && !form.entityId)}
              className="flex items-center gap-1.5 px-4 py-2 bg-accent-600 text-white text-[13px] rounded-lg hover:bg-accent-700 disabled:opacity-50 transition-colors"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {editingId ? 'Update' : 'Save'}
            </button>
            <button
              onClick={resetForm}
              className="px-4 py-2 text-[13px] text-ink-500 hover:text-ink-700"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Links Table */}
      {links.length === 0 ? (
        <EmptyState icon={Link2} title="No external links" description="Add your first external link to get started." />
      ) : (
        <div className="border border-surface-200 rounded-lg overflow-hidden">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="bg-surface-50 border-b border-surface-200">
                <th className="text-left px-4 py-3 text-[10px] font-semibold text-ink-400 uppercase tracking-wider">Title</th>
                <th className="text-left px-4 py-3 text-[10px] font-semibold text-ink-400 uppercase tracking-wider">URL</th>
                <th className="text-left px-4 py-3 text-[10px] font-semibold text-ink-400 uppercase tracking-wider hidden sm:table-cell">Type</th>
                <th className="text-left px-4 py-3 text-[10px] font-semibold text-ink-400 uppercase tracking-wider hidden md:table-cell">Entity</th>
                <th className="text-left px-4 py-3 text-[10px] font-semibold text-ink-400 uppercase tracking-wider hidden lg:table-cell">Created By</th>
                <th className="text-right px-4 py-3 text-[10px] font-semibold text-ink-400 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody>
              {links.map((link) => (
                <tr key={link.id} className="border-b border-surface-100 last:border-0 hover:bg-surface-50/50 transition-colors">
                  <td className="px-4 py-3 text-[13px] text-ink-900 font-medium">{link.label}</td>
                  <td className="px-4 py-3 max-w-[200px] truncate">
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[12px] text-accent-600 hover:text-accent-700 hover:underline"
                    >
                      {link.url}
                    </a>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <span className="inline-block text-[11px] font-medium px-2 py-0.5 rounded-full bg-surface-100 text-ink-500">
                      {LINK_TYPE_LABELS[link.linkType] || link.linkType}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-ink-500 hidden md:table-cell">
                    <span className="text-[12px]">{link.entityType}</span>
                    <span className="text-ink-300 ml-1 font-mono text-[10px]">{link.entityId.slice(0, 8)}</span>
                  </td>
                  <td className="px-4 py-3 text-ink-500 hidden lg:table-cell text-[12px]">
                    {link.createdBy?.fullName || '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => startEdit(link)}
                        className="p-1.5 text-ink-400 hover:text-ink-600 rounded"
                        title="Edit"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(link.id)}
                        className="p-1.5 text-ink-400 hover:text-red-600 rounded"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function FieldGroup({
  label, hint, required, children,
}: {
  label: string; hint?: string; required?: boolean; children: React.ReactNode
}) {
  return (
    <div>
      <label className="block text-[12px] font-semibold text-ink-600 uppercase tracking-wider mb-2">
        {label}
        {required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {hint && <p className="text-[11px] text-ink-300 mb-2">{hint}</p>}
      {children}
    </div>
  )
}

// ── Public Holidays Section ───────────────────────────────

type HolidayType = 'PUBLIC_HOLIDAY' | 'BLACKOUT_DATE' | 'COMPANY_CLOSURE'

interface PublicHoliday {
  id: string
  name: string
  date: string
  country: string
  isRecurring: boolean
  officeId: string | null
  office: { id: string; name: string } | null
  type: HolidayType
}

// ── Notification Preferences Section ─────────────────────

const NOTIFICATION_CATEGORIES: Array<{
  label: string
  events: Array<{ key: string; label: string }>
}> = [
  {
    label: 'Tasks',
    events: [
      { key: 'task.assigned', label: 'Task assigned to me' },
      { key: 'task.status_changed', label: 'Task status changed' },
      { key: 'task.overdue', label: 'Task overdue' },
      { key: 'task.comment', label: 'Task comment' },
    ],
  },
  {
    label: 'Documents',
    events: [
      { key: 'document.review_requested', label: 'Document review requested' },
      { key: 'document.reviewed', label: 'Document reviewed' },
      { key: 'document.issued', label: 'Document issued' },
    ],
  },
  {
    label: 'Leave',
    events: [
      { key: 'leave.requested', label: 'Leave requested (for approvers)' },
      { key: 'leave.decision', label: 'Leave decision' },
    ],
  },
  {
    label: 'Expenses',
    events: [
      { key: 'expense.submitted', label: 'Expense submitted (for approvers)' },
      { key: 'expense.decision', label: 'Expense decision' },
    ],
  },
  {
    label: 'Timesheets',
    events: [
      { key: 'timesheet.submitted', label: 'Timesheet submitted (for approvers)' },
      { key: 'timesheet.decision', label: 'Timesheet decision' },
    ],
  },
  {
    label: 'Onboarding & Probation',
    events: [
      { key: 'onboarding.task_assigned', label: 'Onboarding task assigned' },
      { key: 'onboarding.task_due', label: 'Onboarding task due' },
      { key: 'probation.review_scheduled', label: 'Probation review scheduled' },
      { key: 'probation.review_due', label: 'Probation review due' },
    ],
  },
  {
    label: 'Projects',
    events: [
      { key: 'project.member_added', label: 'Added to project' },
      { key: 'project.member_removed', label: 'Removed from project' },
      { key: 'project.update', label: 'Project update' },
      { key: 'project.health_changed', label: 'Project health changed' },
      { key: 'project.milestone_due', label: 'Milestone due' },
    ],
  },
  {
    label: 'Approvals',
    events: [
      { key: 'approval.requested', label: 'Approval requested' },
      { key: 'approval.completed', label: 'Approval completed' },
      { key: 'approval.rejected', label: 'Approval rejected' },
      { key: 'approval.escalated', label: 'Approval escalated' },
    ],
  },
  {
    label: 'Other',
    events: [
      { key: 'mention', label: 'Mentioned in a comment' },
      { key: 'compliance.action_due', label: 'Compliance action due' },
      { key: 'training.expiring', label: 'Training expiring' },
    ],
  },
]

function NotificationPreferencesSection() {
  const [preferences, setPreferences] = useState<Record<string, { inApp: boolean; email: boolean }>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    fetch('/api/notification-preferences')
      .then((r) => r.json())
      .then((data) => {
        if (data.data?.preferences) setPreferences(data.data.preferences)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const toggle = (eventKey: string, channel: 'inApp' | 'email') => {
    setPreferences((prev) => ({
      ...prev,
      [eventKey]: {
        ...prev[eventKey],
        [channel]: !(prev[eventKey]?.[channel] ?? true),
      },
    }))
    setDirty(true)
  }

  const toggleAll = (channel: 'inApp' | 'email', value: boolean) => {
    setPreferences((prev) => {
      const next = { ...prev }
      for (const cat of NOTIFICATION_CATEGORIES) {
        for (const ev of cat.events) {
          next[ev.key] = { ...next[ev.key], [channel]: value }
        }
      }
      return next
    })
    setDirty(true)
  }

  const save = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/notification-preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preferences }),
      })
      const data = await res.json()
      if (data.data?.preferences) setPreferences(data.data.preferences)
      setDirty(false)
    } catch {
      // silent
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-brand-500" />
      </div>
    )
  }

  // Check if all are enabled for the toggle-all buttons
  const allEvents = NOTIFICATION_CATEGORIES.flatMap((c) => c.events)
  const allInApp = allEvents.every((e) => preferences[e.key]?.inApp !== false)
  const allEmail = allEvents.every((e) => preferences[e.key]?.email !== false)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-surface-900">Notification Preferences</h2>
          <p className="text-sm text-surface-500 mt-1">Control which notifications you receive via email and in-app.</p>
        </div>
        <button
          onClick={save}
          disabled={!dirty || saving}
          className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
            dirty
              ? 'bg-brand-600 text-white hover:bg-brand-700'
              : 'bg-surface-100 text-surface-400 cursor-not-allowed',
          )}
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save
        </button>
      </div>

      {/* Toggle-all row */}
      <div className="flex items-center gap-6 border-b border-surface-200 pb-3">
        <span className="text-sm font-medium text-surface-700 flex-1">Enable / disable all</span>
        <label className="flex items-center gap-2 text-xs text-surface-600">
          <input
            type="checkbox"
            checked={allInApp}
            onChange={() => toggleAll('inApp', !allInApp)}
            className="rounded border-surface-300 text-brand-600 focus:ring-brand-500"
          />
          In-App
        </label>
        <label className="flex items-center gap-2 text-xs text-surface-600">
          <input
            type="checkbox"
            checked={allEmail}
            onChange={() => toggleAll('email', !allEmail)}
            className="rounded border-surface-300 text-brand-600 focus:ring-brand-500"
          />
          Email
        </label>
      </div>

      {/* Categories */}
      {NOTIFICATION_CATEGORIES.map((cat) => (
        <div key={cat.label}>
          <h3 className="text-sm font-semibold text-surface-800 mb-2">{cat.label}</h3>
          <div className="space-y-1">
            {cat.events.map((ev) => {
              const inApp = preferences[ev.key]?.inApp ?? true
              const email = preferences[ev.key]?.email ?? true
              return (
                <div key={ev.key} className="flex items-center gap-6 py-1.5">
                  <span className="text-sm text-surface-700 flex-1">{ev.label}</span>
                  <label className="flex items-center gap-2 text-xs text-surface-600">
                    <input
                      type="checkbox"
                      checked={inApp}
                      onChange={() => toggle(ev.key, 'inApp')}
                      className="rounded border-surface-300 text-brand-600 focus:ring-brand-500"
                    />
                    In-App
                  </label>
                  <label className="flex items-center gap-2 text-xs text-surface-600">
                    <input
                      type="checkbox"
                      checked={email}
                      onChange={() => toggle(ev.key, 'email')}
                      className="rounded border-surface-300 text-brand-600 focus:ring-brand-500"
                    />
                    Email
                  </label>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Leave Policies Section ───────────────────────────────

interface LeavePolicyData {
  id: string
  name: string
  leaveType: string
  entitlementDays: number
  carryOverDays: number
  grade: string | null
  isDefault: boolean
  createdAt: string
  updatedAt: string
}

const LEAVE_TYPE_OPTIONS = [
  { value: 'ANNUAL', label: 'Annual' },
  { value: 'SICK', label: 'Sick' },
  { value: 'COMPASSIONATE', label: 'Compassionate' },
  { value: 'PARENTAL', label: 'Parental' },
  { value: 'MATERNITY', label: 'Maternity' },
  { value: 'PATERNITY', label: 'Paternity' },
  { value: 'STUDY', label: 'Study' },
  { value: 'CPD_TRAINING', label: 'CPD / Training' },
  { value: 'UNPAID', label: 'Unpaid' },
  { value: 'TOIL', label: 'TOIL' },
  { value: 'BUSINESS_TRAVEL', label: 'Business Travel' },
  { value: 'OTHER', label: 'Other' },
]

const LEAVE_TYPE_LABELS: Record<string, string> = Object.fromEntries(
  LEAVE_TYPE_OPTIONS.map((o) => [o.value, o.label])
)

function LeavePoliciesSection() {
  const [policies, setPolicies] = useState<LeavePolicyData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [filterType, setFilterType] = useState('')
  const [form, setForm] = useState({
    name: '', leaveType: 'ANNUAL', entitlementDays: 25, carryOverDays: 0, grade: '', isDefault: false,
  })

  const fetchPolicies = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (filterType) params.set('leaveType', filterType)
      const res = await fetch(`/api/leave-policies?${params}`)
      if (!res.ok) throw new Error('Failed to load leave policies')
      const data = await res.json()
      setPolicies(data.data?.policies ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [filterType])

  useEffect(() => { fetchPolicies() }, [fetchPolicies])

  function resetForm() {
    setForm({ name: '', leaveType: 'ANNUAL', entitlementDays: 25, carryOverDays: 0, grade: '', isDefault: false })
    setShowForm(false)
    setEditingId(null)
  }

  function startEdit(p: LeavePolicyData) {
    setEditingId(p.id)
    setForm({
      name: p.name,
      leaveType: p.leaveType,
      entitlementDays: p.entitlementDays,
      carryOverDays: p.carryOverDays,
      grade: p.grade ?? '',
      isDefault: p.isDefault,
    })
    setShowForm(true)
  }

  async function handleSave() {
    setBusy(true)
    setError(null)
    try {
      const payload = {
        name: form.name,
        leaveType: form.leaveType,
        entitlementDays: form.entitlementDays,
        carryOverDays: form.carryOverDays,
        grade: form.grade || null,
        isDefault: form.isDefault,
      }
      const url = editingId ? `/api/leave-policies/${editingId}` : '/api/leave-policies'
      const method = editingId ? 'PATCH' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const e = await res.json()
        throw new Error(e.data?.error || e.error || 'Failed to save')
      }
      resetForm()
      await fetchPolicies()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save')
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this leave policy?')) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/leave-policies/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const e = await res.json()
        throw new Error(e.data?.error || e.error || 'Failed to delete')
      }
      await fetchPolicies()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete')
    } finally {
      setBusy(false)
    }
  }

  async function handleToggleDefault(p: LeavePolicyData) {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/leave-policies/${p.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isDefault: !p.isDefault }),
      })
      if (!res.ok) {
        const e = await res.json()
        throw new Error(e.data?.error || e.error || 'Failed to update')
      }
      await fetchPolicies()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update')
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <LoadingState />

  // Group by leave type for display
  const grouped = policies.reduce<Record<string, LeavePolicyData[]>>((acc, p) => {
    const key = p.leaveType
    if (!acc[key]) acc[key] = []
    acc[key].push(p)
    return acc
  }, {})

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-ink-900">Leave Policies</h2>
          <p className="text-[12px] text-ink-400 mt-1">
            Define entitlement rules by leave type and grade. Policies resolve: individual override, then grade match, then org default.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-3 py-2 rounded-lg border border-surface-200 text-[13px]"
          >
            <option value="">All types</option>
            {LEAVE_TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <button
            onClick={() => { resetForm(); setShowForm(true) }}
            className="flex items-center gap-1.5 px-3 py-2 bg-accent-600 text-white text-[13px] rounded-lg hover:bg-accent-700"
          >
            <Plus className="w-4 h-4" /> Add Policy
          </button>
        </div>
      </div>

      {error && (
        <div className="text-[13px] text-red-600 bg-red-50 px-4 py-2 rounded-lg">{error}</div>
      )}

      {/* Add / Edit Form */}
      {showForm && (
        <div className="border border-surface-200 rounded-lg p-4 bg-surface-50 space-y-4">
          <p className="text-[13px] font-medium text-ink-700">
            {editingId ? 'Edit Policy' : 'Create Policy'}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[12px] text-ink-500 mb-1">Name *</label>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Senior Staff, Probation, Default"
                className="w-full px-3 py-2 rounded-lg border border-surface-200 text-[13px] focus:outline-none focus:ring-2 focus:ring-accent-500/20 focus:border-accent-500 bg-white"
              />
            </div>
            <div>
              <label className="block text-[12px] text-ink-500 mb-1">Leave Type *</label>
              <select
                value={form.leaveType}
                onChange={(e) => setForm({ ...form, leaveType: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-surface-200 text-[13px] focus:outline-none focus:ring-2 focus:ring-accent-500/20 focus:border-accent-500 bg-white"
              >
                {LEAVE_TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[12px] text-ink-500 mb-1">Entitlement Days *</label>
              <input
                type="number"
                value={form.entitlementDays}
                onChange={(e) => setForm({ ...form, entitlementDays: parseInt(e.target.value) || 0 })}
                min={0}
                max={365}
                className="w-full px-3 py-2 rounded-lg border border-surface-200 text-[13px] focus:outline-none focus:ring-2 focus:ring-accent-500/20 focus:border-accent-500 bg-white"
              />
            </div>
            <div>
              <label className="block text-[12px] text-ink-500 mb-1">Carry-Over Days</label>
              <input
                type="number"
                value={form.carryOverDays}
                onChange={(e) => setForm({ ...form, carryOverDays: parseInt(e.target.value) || 0 })}
                min={0}
                max={365}
                className="w-full px-3 py-2 rounded-lg border border-surface-200 text-[13px] focus:outline-none focus:ring-2 focus:ring-accent-500/20 focus:border-accent-500 bg-white"
              />
            </div>
            <div>
              <label className="block text-[12px] text-ink-500 mb-1">Grade (optional)</label>
              <input
                value={form.grade}
                onChange={(e) => setForm({ ...form, grade: e.target.value })}
                placeholder="e.g. Senior Management, Staff"
                className="w-full px-3 py-2 rounded-lg border border-surface-200 text-[13px] focus:outline-none focus:ring-2 focus:ring-accent-500/20 focus:border-accent-500 bg-white"
              />
              <p className="text-[10px] text-ink-300 mt-1">If set, applies only to employees with this grade</p>
            </div>
          </div>
          <label className="flex items-center gap-2 text-[13px] text-ink-600">
            <input
              type="checkbox"
              checked={form.isDefault}
              onChange={(e) => setForm({ ...form, isDefault: e.target.checked })}
              className="rounded border-surface-300"
            />
            Default policy for this leave type (one per type)
          </label>
          <div className="flex items-center gap-2">
            <button
              onClick={handleSave}
              disabled={busy || !form.name || !form.leaveType || form.entitlementDays < 0}
              className="flex items-center gap-1.5 px-4 py-2 bg-accent-600 text-white text-[13px] rounded-lg hover:bg-accent-700 disabled:opacity-50"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {editingId ? 'Update' : 'Save'}
            </button>
            <button
              onClick={resetForm}
              className="px-4 py-2 text-[13px] text-ink-500 hover:text-ink-700"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Policies Table */}
      {policies.length === 0 ? (
        <EmptyState icon={FileText} title="No leave policies" description="Create your first leave policy to define entitlement rules." />
      ) : (
        Object.entries(grouped).map(([type, typePolicies]) => (
          <div key={type} className="space-y-2">
            <h3 className="text-xs font-semibold text-ink-500 uppercase tracking-wider">
              {LEAVE_TYPE_LABELS[type] || type}
            </h3>
            <div className="border border-surface-200 rounded-lg overflow-hidden">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="bg-surface-50 border-b border-surface-200">
                    <th className="text-left px-4 py-3 text-[10px] font-semibold text-ink-400 uppercase tracking-wider">Name</th>
                    <th className="text-left px-4 py-3 text-[10px] font-semibold text-ink-400 uppercase tracking-wider">Entitlement</th>
                    <th className="text-left px-4 py-3 text-[10px] font-semibold text-ink-400 uppercase tracking-wider hidden sm:table-cell">Carry-Over</th>
                    <th className="text-left px-4 py-3 text-[10px] font-semibold text-ink-400 uppercase tracking-wider hidden sm:table-cell">Grade</th>
                    <th className="text-left px-4 py-3 text-[10px] font-semibold text-ink-400 uppercase tracking-wider">Default</th>
                    <th className="text-right px-4 py-3 text-[10px] font-semibold text-ink-400 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {typePolicies.map((p) => (
                    <tr key={p.id} className="border-b border-surface-100 last:border-0 hover:bg-surface-50/50 transition-colors">
                      <td className="px-4 py-3 text-ink-900 font-medium">{p.name}</td>
                      <td className="px-4 py-3 text-ink-600">{p.entitlementDays} days</td>
                      <td className="px-4 py-3 text-ink-500 hidden sm:table-cell">{p.carryOverDays} days</td>
                      <td className="px-4 py-3 text-ink-500 hidden sm:table-cell">
                        {p.grade ? (
                          <span className="inline-block text-[11px] font-medium px-2 py-0.5 rounded-full bg-surface-100 text-ink-600">{p.grade}</span>
                        ) : (
                          <span className="text-ink-300">All grades</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => handleToggleDefault(p)}
                          disabled={busy}
                          className={cn(
                            'px-2 py-0.5 rounded text-[10px] font-medium transition-colors',
                            p.isDefault
                              ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                              : 'bg-surface-100 text-ink-400 hover:bg-surface-200'
                          )}
                        >
                          {p.isDefault ? 'Default' : 'Set default'}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => startEdit(p)}
                            className="p-1.5 text-ink-400 hover:text-ink-600 rounded"
                            title="Edit"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(p.id)}
                            className="p-1.5 text-ink-400 hover:text-red-600 rounded"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))
      )}

      {/* Resolution info */}
      <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-100">
        <p className="text-[12px] font-medium text-blue-800 mb-2">How policies resolve</p>
        <ol className="list-decimal list-inside text-[11px] text-blue-700 space-y-1">
          <li>Individual override: employee has a specific policy assigned on their profile</li>
          <li>Grade match: employee's grade matches a policy for that leave type</li>
          <li>Org default: the default policy for that leave type applies to everyone else</li>
        </ol>
      </div>
    </div>
  )
}

// ── Public Holidays Section ──────────────────────────────

function HolidayTypeBadge({ type }: { type: HolidayType }) {
  switch (type) {
    case 'PUBLIC_HOLIDAY':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-[11px] font-medium">
          <CalendarDays className="w-3 h-3" /> Public Holiday
        </span>
      )
    case 'BLACKOUT_DATE':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-50 text-red-700 text-[11px] font-medium">
          <Ban className="w-3 h-3" /> Blackout Date
        </span>
      )
    case 'COMPANY_CLOSURE':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 text-[11px] font-medium">
          <LockKeyhole className="w-3 h-3" /> Company Closure
        </span>
      )
    default:
      return null
  }
}

const HOLIDAY_TYPE_OPTIONS: Array<{ value: HolidayType; label: string }> = [
  { value: 'PUBLIC_HOLIDAY', label: 'Public Holiday' },
  { value: 'BLACKOUT_DATE', label: 'Blackout Date' },
  { value: 'COMPANY_CLOSURE', label: 'Company Closure' },
]

function PublicHolidaysSection() {
  const [holidays, setHolidays] = useState<PublicHoliday[]>([])
  const [offices, setOffices] = useState<Array<{ id: string; name: string }>>([])
  const [year, setYear] = useState(new Date().getFullYear())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState({
    name: '', date: '', country: 'GB', isRecurring: false, officeId: '', type: 'PUBLIC_HOLIDAY' as HolidayType,
  })

  // Filters
  const [officeFilter, setOfficeFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')

  // Bulk copy state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [showCopyDialog, setShowCopyDialog] = useState(false)
  const [copyTargetOffice, setCopyTargetOffice] = useState('')
  const [copying, setCopying] = useState(false)

  const fetchHolidays = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ year: String(year) })
      if (officeFilter) params.set('officeId', officeFilter)
      if (typeFilter) params.set('type', typeFilter)

      const [hRes, oRes] = await Promise.all([
        fetch(`/api/public-holidays?${params}`),
        fetch('/api/settings/org'),
      ])
      if (!hRes.ok) throw new Error('Failed to load holidays')
      const hData = await hRes.json()
      setHolidays(hData.holidays ?? [])
      if (oRes.ok) {
        const oData = await oRes.json()
        setOffices((oData.organisation?.offices ?? []).map((o: OfficeData) => ({ id: o.id, name: o.name })))
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [year, officeFilter, typeFilter])

  useEffect(() => { fetchHolidays() }, [fetchHolidays])

  function resetForm() {
    setForm({ name: '', date: '', country: 'GB', isRecurring: false, officeId: '', type: 'PUBLIC_HOLIDAY' })
    setShowForm(false)
    setEditingId(null)
  }

  function startEdit(h: PublicHoliday) {
    setEditingId(h.id)
    setForm({
      name: h.name,
      date: h.date.substring(0, 10),
      country: h.country,
      isRecurring: h.isRecurring,
      officeId: h.officeId ?? '',
      type: h.type ?? 'PUBLIC_HOLIDAY',
    })
    setShowForm(true)
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleSelectAll() {
    if (selectedIds.size === holidays.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(holidays.map((h) => h.id)))
    }
  }

  async function handleBulkCopy() {
    if (!copyTargetOffice || selectedIds.size === 0) return
    setCopying(true)
    setError(null)
    try {
      const toCopy = holidays.filter((h) => selectedIds.has(h.id))
      for (const h of toCopy) {
        const res = await fetch('/api/public-holidays', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: h.name,
            date: h.date.substring(0, 10),
            country: h.country,
            isRecurring: h.isRecurring,
            officeId: copyTargetOffice,
            type: h.type ?? 'PUBLIC_HOLIDAY',
          }),
        })
        if (!res.ok) {
          const e = await res.json()
          throw new Error(e.error || `Failed to copy "${h.name}"`)
        }
      }
      setShowCopyDialog(false)
      setCopyTargetOffice('')
      setSelectedIds(new Set())
      await fetchHolidays()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to copy holidays')
    } finally {
      setCopying(false)
    }
  }

  async function handleSave() {
    setBusy(true)
    setError(null)
    try {
      const payload = {
        name: form.name,
        date: form.date,
        country: form.country,
        isRecurring: form.isRecurring,
        officeId: form.officeId || null,
        type: form.type,
      }
      const url = editingId ? `/api/public-holidays/${editingId}` : '/api/public-holidays'
      const method = editingId ? 'PATCH' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const e = await res.json()
        throw new Error(e.error || 'Failed to save')
      }
      resetForm()
      await fetchHolidays()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save')
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this entry?')) return
    setBusy(true)
    try {
      const res = await fetch(`/api/public-holidays/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete')
      setSelectedIds((prev) => { const next = new Set(prev); next.delete(id); return next })
      await fetchHolidays()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete')
    } finally {
      setBusy(false)
    }
  }

  const currentYear = new Date().getFullYear()

  if (loading) return <LoadingState />

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-semibold text-ink-900">Holidays & Closures</h2>
          <p className="text-[12px] text-ink-400 mt-1">
            Manage public holidays, blackout dates, and company closures. These affect team calendars and working-day calculations.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={year}
            onChange={(e) => setYear(parseInt(e.target.value))}
            className="px-3 py-2 rounded-lg border border-surface-200 text-[13px]"
          >
            {[currentYear - 1, currentYear, currentYear + 1, currentYear + 2].map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <button
            onClick={() => { resetForm(); setShowForm(true) }}
            className="flex items-center gap-1.5 px-3 py-2 bg-accent-600 text-white text-[13px] rounded-lg hover:bg-accent-700"
          >
            <Plus className="w-4 h-4" /> Add Entry
          </button>
        </div>
      </div>

      {/* Filters Row */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5">
          <Filter className="w-4 h-4 text-ink-300" />
          <span className="text-[12px] text-ink-400 font-medium">Filters:</span>
        </div>
        <select
          value={officeFilter}
          onChange={(e) => setOfficeFilter(e.target.value)}
          className="px-3 py-1.5 rounded-lg border border-surface-200 text-[12px] bg-white"
        >
          <option value="">All Offices</option>
          {offices.map((o) => (
            <option key={o.id} value={o.id}>{o.name}</option>
          ))}
        </select>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="px-3 py-1.5 rounded-lg border border-surface-200 text-[12px] bg-white"
        >
          <option value="">All Types</option>
          {HOLIDAY_TYPE_OPTIONS.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
        {(officeFilter || typeFilter) && (
          <button
            onClick={() => { setOfficeFilter(''); setTypeFilter('') }}
            className="text-[11px] text-accent-600 hover:text-accent-700 font-medium"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Bulk Actions Bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 p-3 bg-accent-50 border border-accent-200 rounded-lg">
          <span className="text-[12px] font-medium text-accent-700">
            {selectedIds.size} selected
          </span>
          <button
            onClick={() => setShowCopyDialog(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-accent-600 text-white text-[12px] rounded-lg hover:bg-accent-700"
          >
            <Copy className="w-3.5 h-3.5" /> Copy to Another Office
          </button>
          <button
            onClick={() => setSelectedIds(new Set())}
            className="text-[12px] text-ink-500 hover:text-ink-700"
          >
            Clear selection
          </button>
        </div>
      )}

      {/* Copy Dialog */}
      {showCopyDialog && (
        <div className="border border-surface-200 rounded-lg p-4 bg-surface-50 space-y-3">
          <p className="text-[13px] font-medium text-ink-700">
            Copy {selectedIds.size} holiday{selectedIds.size > 1 ? 's' : ''} to another office
          </p>
          <select
            value={copyTargetOffice}
            onChange={(e) => setCopyTargetOffice(e.target.value)}
            className="w-full max-w-xs px-3 py-2 rounded-lg border border-surface-200 text-[13px]"
          >
            <option value="">Select target office...</option>
            {offices.map((o) => (
              <option key={o.id} value={o.id}>{o.name}</option>
            ))}
          </select>
          <div className="flex items-center gap-2">
            <button
              onClick={handleBulkCopy}
              disabled={copying || !copyTargetOffice}
              className="flex items-center gap-1.5 px-4 py-2 bg-accent-600 text-white text-[13px] rounded-lg hover:bg-accent-700 disabled:opacity-50"
            >
              {copying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Copy className="w-4 h-4" />}
              Copy
            </button>
            <button
              onClick={() => { setShowCopyDialog(false); setCopyTargetOffice('') }}
              className="px-4 py-2 text-[13px] text-ink-500 hover:text-ink-700"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="text-[13px] text-red-600 bg-red-50 px-4 py-2 rounded-lg">{error}</div>
      )}

      {/* Add / Edit Form */}
      {showForm && (
        <div className="border border-surface-200 rounded-lg p-4 bg-surface-50 space-y-4">
          <p className="text-[13px] font-medium text-ink-700">
            {editingId ? 'Edit Entry' : 'Add Entry'}
          </p>

          {/* Type + Office — prominent top row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[12px] text-ink-500 mb-1 font-semibold">Type *</label>
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value as HolidayType })}
                className="w-full px-3 py-2 rounded-lg border border-surface-200 text-[13px]"
              >
                {HOLIDAY_TYPE_OPTIONS.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[12px] text-ink-500 mb-1 font-semibold">Office *</label>
              <select
                value={form.officeId}
                onChange={(e) => setForm({ ...form, officeId: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-surface-200 text-[13px]"
              >
                <option value="">All offices (global)</option>
                {offices.map((o) => (
                  <option key={o.id} value={o.id}>{o.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[12px] text-ink-500 mb-1">Name *</label>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Christmas Day"
                className="w-full px-3 py-2 rounded-lg border border-surface-200 text-[13px]"
              />
            </div>
            <div>
              <label className="block text-[12px] text-ink-500 mb-1">Date *</label>
              <input
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-surface-200 text-[13px]"
              />
            </div>
            <div>
              <label className="block text-[12px] text-ink-500 mb-1">Country</label>
              <input
                value={form.country}
                onChange={(e) => setForm({ ...form, country: e.target.value })}
                placeholder="GB"
                className="w-full px-3 py-2 rounded-lg border border-surface-200 text-[13px]"
              />
            </div>
          </div>
          <label className="flex items-center gap-2 text-[13px] text-ink-600">
            <input
              type="checkbox"
              checked={form.isRecurring}
              onChange={(e) => setForm({ ...form, isRecurring: e.target.checked })}
              className="rounded border-surface-300"
            />
            Recurring annually
          </label>
          <div className="flex items-center gap-2">
            <button
              onClick={handleSave}
              disabled={busy || !form.name || !form.date}
              className="flex items-center gap-1.5 px-4 py-2 bg-accent-600 text-white text-[13px] rounded-lg hover:bg-accent-700 disabled:opacity-50"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {editingId ? 'Update' : 'Save'}
            </button>
            <button
              onClick={resetForm}
              className="px-4 py-2 text-[13px] text-ink-500 hover:text-ink-700"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Holiday List */}
      {holidays.length === 0 ? (
        <EmptyState icon={CalendarDays} title="No entries found" description={`No holidays, closures, or blackout dates for ${year}${officeFilter || typeFilter ? ' with current filters' : ''}. Add your first entry above.`} />
      ) : (
        <div className="border border-surface-200 rounded-lg overflow-hidden">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="bg-surface-50 border-b border-surface-200">
                <th className="w-10 px-3 py-3">
                  <input
                    type="checkbox"
                    checked={selectedIds.size === holidays.length && holidays.length > 0}
                    onChange={toggleSelectAll}
                    className="rounded border-surface-300"
                    title="Select all"
                  />
                </th>
                <th className="text-left px-4 py-3 font-medium text-ink-500">Name</th>
                <th className="text-left px-4 py-3 font-medium text-ink-500 hidden sm:table-cell">Type</th>
                <th className="text-left px-4 py-3 font-medium text-ink-500">Date</th>
                <th className="text-left px-4 py-3 font-medium text-ink-500 hidden sm:table-cell">Office</th>
                <th className="text-left px-4 py-3 font-medium text-ink-500 hidden md:table-cell">Country</th>
                <th className="text-left px-4 py-3 font-medium text-ink-500 hidden md:table-cell">Recurring</th>
                <th className="text-right px-4 py-3 font-medium text-ink-500">Actions</th>
              </tr>
            </thead>
            <tbody>
              {holidays.map((h) => (
                <tr key={h.id} className={cn(
                  'border-b border-surface-100 last:border-0 transition-colors',
                  selectedIds.has(h.id) ? 'bg-accent-50/40' : 'hover:bg-surface-50/50'
                )}>
                  <td className="w-10 px-3 py-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(h.id)}
                      onChange={() => toggleSelect(h.id)}
                      className="rounded border-surface-300"
                    />
                  </td>
                  <td className="px-4 py-3 text-ink-900 font-medium">{h.name}</td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <HolidayTypeBadge type={h.type ?? 'PUBLIC_HOLIDAY'} />
                  </td>
                  <td className="px-4 py-3 text-ink-600">
                    {new Date(h.date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
                  </td>
                  <td className="px-4 py-3 text-ink-500 hidden sm:table-cell">
                    {h.office?.name ?? <span className="text-ink-300">All offices</span>}
                  </td>
                  <td className="px-4 py-3 text-ink-500 hidden md:table-cell">{h.country}</td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    {h.isRecurring ? (
                      <span className="inline-flex items-center gap-1 text-emerald-600 text-[11px] font-medium">
                        <CheckCircle className="w-3.5 h-3.5" /> Yes
                      </span>
                    ) : (
                      <span className="text-ink-300 text-[11px]">No</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => startEdit(h)}
                        className="p-1.5 text-ink-400 hover:text-ink-600 rounded"
                        title="Edit"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(h.id)}
                        className="p-1.5 text-ink-400 hover:text-red-600 rounded"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── Onboarding Section ────────────────────────────────────

interface OnboardingTemplate {
  id: string
  name: string
  roleLevel: string | null
  description: string | null
  isDefault: boolean
  isActive: boolean
  totalItems: number
  stageCounts: Record<string, number>
}

interface OnboardingTemplateItem {
  id: string
  stage: string
  category: string | null
  title: string
  description: string | null
  responsibleRole: string | null
  daysFromStart: number
  requiresEvidence: boolean
  requiresApproval: boolean
  notifyEmployee: boolean
  actionRequired: boolean
  acknowledgementRequired: boolean
  dueDate: string | null
  sortOrder: number
}

interface OnboardingTemplateDetail {
  id: string
  name: string
  items: OnboardingTemplateItem[]
}

const ONBOARDING_STAGES = [
  { value: 'BEFORE_START', label: 'Before Start' },
  { value: 'DAY_ONE', label: 'Day One' },
  { value: 'ROLE_SPECIFIC', label: 'Role Specific' },
  { value: 'PROBATION', label: 'Probation' },
]

const RESPONSIBLE_ROLES = [
  { value: 'HR', label: 'HR' },
  { value: 'MANAGER', label: 'Manager' },
  { value: 'IT', label: 'IT' },
  { value: 'EMPLOYEE', label: 'Employee' },
]

function OnboardingSection() {
  const [templates, setTemplates] = useState<OnboardingTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [detail, setDetail] = useState<OnboardingTemplateDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [showItemForm, setShowItemForm] = useState(false)
  const [editingItemId, setEditingItemId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [itemForm, setItemForm] = useState({
    stage: 'BEFORE_START',
    title: '',
    description: '',
    category: '',
    responsibleRole: '',
    daysFromStart: 0,
    requiresEvidence: false,
    requiresApproval: false,
    notifyEmployee: false,
    actionRequired: false,
    acknowledgementRequired: false,
    dueDate: '',
    sortOrder: 0,
  })

  const fetchTemplates = useCallback(async () => {
    try {
      const res = await fetch('/api/onboarding/templates')
      if (!res.ok) throw new Error('Failed to load templates')
      const data = await res.json()
      setTemplates(data.data?.templates ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load templates')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchTemplates() }, [fetchTemplates])

  async function fetchDetail(templateId: string) {
    setDetailLoading(true)
    try {
      const res = await fetch(`/api/onboarding/templates/${templateId}`)
      if (!res.ok) throw new Error('Failed to load template')
      const data = await res.json()
      setDetail(data.data?.template ?? null)
    } catch {
      setError('Failed to load template details')
    } finally {
      setDetailLoading(false)
    }
  }

  function toggleExpand(templateId: string) {
    if (expandedId === templateId) {
      setExpandedId(null)
      setDetail(null)
      setShowItemForm(false)
      setEditingItemId(null)
    } else {
      setExpandedId(templateId)
      fetchDetail(templateId)
      setShowItemForm(false)
      setEditingItemId(null)
    }
  }

  function resetItemForm() {
    setItemForm({
      stage: 'BEFORE_START', title: '', description: '', category: '',
      responsibleRole: '', daysFromStart: 0, requiresEvidence: false,
      requiresApproval: false, notifyEmployee: false, actionRequired: false,
      acknowledgementRequired: false, dueDate: '', sortOrder: 0,
    })
    setShowItemForm(false)
    setEditingItemId(null)
  }

  function startEditItem(item: OnboardingTemplateItem) {
    setEditingItemId(item.id)
    setShowItemForm(true)
    setItemForm({
      stage: item.stage,
      title: item.title,
      description: item.description ?? '',
      category: item.category ?? '',
      responsibleRole: item.responsibleRole ?? '',
      daysFromStart: item.daysFromStart,
      requiresEvidence: item.requiresEvidence,
      requiresApproval: item.requiresApproval,
      notifyEmployee: item.notifyEmployee,
      actionRequired: item.actionRequired,
      acknowledgementRequired: item.acknowledgementRequired,
      dueDate: item.dueDate ? item.dueDate.slice(0, 10) : '',
      sortOrder: item.sortOrder,
    })
  }

  async function handleSaveItem() {
    if (!expandedId || !itemForm.title.trim()) return
    setBusy(true)
    setError(null)
    try {
      if (editingItemId) {
        // Update existing item
        const res = await fetch(`/api/onboarding/templates/${expandedId}/items`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            itemId: editingItemId,
            stage: itemForm.stage,
            title: itemForm.title,
            description: itemForm.description || null,
            category: itemForm.category || null,
            responsibleRole: itemForm.responsibleRole || null,
            daysFromStart: itemForm.daysFromStart,
            requiresEvidence: itemForm.requiresEvidence,
            requiresApproval: itemForm.requiresApproval,
            notifyEmployee: itemForm.notifyEmployee,
            actionRequired: itemForm.actionRequired,
            acknowledgementRequired: itemForm.acknowledgementRequired,
            dueDate: itemForm.dueDate || null,
            sortOrder: itemForm.sortOrder,
          }),
        })
        if (!res.ok) throw new Error('Failed to update item')
      } else {
        // Create new item
        const res = await fetch(`/api/onboarding/templates/${expandedId}/items`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            stage: itemForm.stage,
            title: itemForm.title,
            description: itemForm.description || null,
            category: itemForm.category || null,
            responsibleRole: itemForm.responsibleRole || null,
            daysFromStart: itemForm.daysFromStart,
            requiresEvidence: itemForm.requiresEvidence,
            requiresApproval: itemForm.requiresApproval,
            notifyEmployee: itemForm.notifyEmployee,
            actionRequired: itemForm.actionRequired,
            acknowledgementRequired: itemForm.acknowledgementRequired,
            dueDate: itemForm.dueDate || null,
            sortOrder: itemForm.sortOrder,
          }),
        })
        if (!res.ok) throw new Error('Failed to create item')
      }
      resetItemForm()
      await fetchDetail(expandedId)
      await fetchTemplates()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save item')
    } finally {
      setBusy(false)
    }
  }

  async function handleDeleteItem(itemId: string) {
    if (!expandedId) return
    setBusy(true)
    try {
      const res = await fetch(`/api/onboarding/templates/${expandedId}/items`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId }),
      })
      if (!res.ok) throw new Error('Failed to delete item')
      await fetchDetail(expandedId)
      await fetchTemplates()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete item')
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <LoadingState />

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Onboarding Templates"
        description="Manage onboarding templates and task options for new employees."
      />

      {error && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-100 text-[12px] text-red-700">
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline">Dismiss</button>
        </div>
      )}

      {templates.length === 0 ? (
        <EmptyState icon={ClipboardList} title="No onboarding templates" description="Templates are created from the onboarding management page." />
      ) : (
        <div className="space-y-3">
          {templates.map((t) => (
            <div key={t.id} className="border border-surface-200 rounded-lg overflow-hidden">
              {/* Template header row */}
              <button
                onClick={() => toggleExpand(t.id)}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-surface-50 transition-colors text-left"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <ClipboardList className="w-4 h-4 text-ink-300 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium text-ink-900 truncate">
                      {t.name}
                      {t.isDefault && (
                        <span className="ml-2 inline-block text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-accent-50 text-accent-700">Default</span>
                      )}
                    </p>
                    <p className="text-[11px] text-ink-400">{t.totalItems} items &middot; {t.roleLevel ?? 'All roles'}</p>
                  </div>
                </div>
                {expandedId === t.id ? (
                  <ChevronUp className="w-4 h-4 text-ink-300 shrink-0" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-ink-300 shrink-0" />
                )}
              </button>

              {/* Expanded detail */}
              {expandedId === t.id && (
                <div className="border-t border-surface-200 px-4 py-4 bg-surface-50/50">
                  {detailLoading ? (
                    <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-ink-300" /></div>
                  ) : detail ? (
                    <div className="space-y-4">
                      {/* Items grouped by stage */}
                      {ONBOARDING_STAGES.map(({ value: stageVal, label: stageLabel }) => {
                        const stageItems = detail.items.filter((i) => i.stage === stageVal)
                        if (stageItems.length === 0) return null
                        return (
                          <div key={stageVal}>
                            <h4 className="text-[11px] font-semibold text-ink-500 uppercase tracking-wider mb-2">{stageLabel}</h4>
                            <div className="space-y-1">
                              {stageItems.map((item) => (
                                <div key={item.id} className="flex items-start justify-between gap-2 px-3 py-2 bg-white rounded border border-surface-100">
                                  <div className="min-w-0 flex-1">
                                    <p className="text-[13px] text-ink-900 font-medium">{item.title}</p>
                                    <div className="flex flex-wrap items-center gap-2 mt-1">
                                      {item.responsibleRole && (
                                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface-100 text-ink-500">{item.responsibleRole}</span>
                                      )}
                                      {item.notifyEmployee && (
                                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-700">Notify</span>
                                      )}
                                      {item.actionRequired && (
                                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-700">Action Required</span>
                                      )}
                                      {item.acknowledgementRequired && (
                                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-50 text-purple-700">Ack Required</span>
                                      )}
                                      {item.dueDate && (
                                        <span className="text-[10px] text-ink-400">Due: {new Date(item.dueDate).toLocaleDateString()}</span>
                                      )}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-1 shrink-0">
                                    <button onClick={() => startEditItem(item)} className="p-1 text-ink-400 hover:text-ink-600 rounded" title="Edit">
                                      <Pencil className="w-3.5 h-3.5" />
                                    </button>
                                    <button onClick={() => handleDeleteItem(item.id)} disabled={busy} className="p-1 text-ink-400 hover:text-red-600 rounded" title="Delete">
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )
                      })}

                      {detail.items.length === 0 && (
                        <p className="text-[12px] text-ink-400 text-center py-4">No items in this template yet.</p>
                      )}

                      {/* Add / Edit item form */}
                      {!showItemForm ? (
                        <button
                          onClick={() => { resetItemForm(); setShowItemForm(true) }}
                          className="flex items-center gap-1.5 text-[12px] text-accent-600 hover:text-accent-700 font-medium"
                        >
                          <Plus className="w-3.5 h-3.5" /> Add Item
                        </button>
                      ) : (
                        <div className="mt-3 p-4 bg-white rounded-lg border border-surface-200 space-y-3">
                          <p className="text-[12px] font-semibold text-ink-700">{editingItemId ? 'Edit Item' : 'New Item'}</p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <label className="block text-[11px] text-ink-500 mb-1">Title *</label>
                              <input
                                value={itemForm.title}
                                onChange={(e) => setItemForm({ ...itemForm, title: e.target.value })}
                                className="w-full px-3 py-2 rounded-lg border border-surface-200 text-[13px] focus:outline-none focus:ring-2 focus:ring-accent-500/20 focus:border-accent-500 bg-white"
                                placeholder="e.g. IT equipment setup"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] text-ink-500 mb-1">Stage</label>
                              <select
                                value={itemForm.stage}
                                onChange={(e) => setItemForm({ ...itemForm, stage: e.target.value })}
                                className="w-full px-3 py-2 rounded-lg border border-surface-200 text-[13px] focus:outline-none focus:ring-2 focus:ring-accent-500/20 focus:border-accent-500 bg-white"
                              >
                                {ONBOARDING_STAGES.map((s) => (
                                  <option key={s.value} value={s.value}>{s.label}</option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="block text-[11px] text-ink-500 mb-1">Responsible Role</label>
                              <select
                                value={itemForm.responsibleRole}
                                onChange={(e) => setItemForm({ ...itemForm, responsibleRole: e.target.value })}
                                className="w-full px-3 py-2 rounded-lg border border-surface-200 text-[13px] focus:outline-none focus:ring-2 focus:ring-accent-500/20 focus:border-accent-500 bg-white"
                              >
                                <option value="">None</option>
                                {RESPONSIBLE_ROLES.map((r) => (
                                  <option key={r.value} value={r.value}>{r.label}</option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="block text-[11px] text-ink-500 mb-1">Category</label>
                              <input
                                value={itemForm.category}
                                onChange={(e) => setItemForm({ ...itemForm, category: e.target.value })}
                                className="w-full px-3 py-2 rounded-lg border border-surface-200 text-[13px] focus:outline-none focus:ring-2 focus:ring-accent-500/20 focus:border-accent-500 bg-white"
                                placeholder="e.g. IT, HR, Safety"
                              />
                            </div>
                            <div className="sm:col-span-2">
                              <label className="block text-[11px] text-ink-500 mb-1">Description</label>
                              <textarea
                                value={itemForm.description}
                                onChange={(e) => setItemForm({ ...itemForm, description: e.target.value })}
                                rows={2}
                                className="w-full px-3 py-2 rounded-lg border border-surface-200 text-[13px] focus:outline-none focus:ring-2 focus:ring-accent-500/20 focus:border-accent-500 bg-white resize-none"
                                placeholder="Optional description"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] text-ink-500 mb-1">Days from Start</label>
                              <input
                                type="number"
                                value={itemForm.daysFromStart}
                                onChange={(e) => setItemForm({ ...itemForm, daysFromStart: parseInt(e.target.value) || 0 })}
                                min={0}
                                max={365}
                                className="w-full px-3 py-2 rounded-lg border border-surface-200 text-[13px] focus:outline-none focus:ring-2 focus:ring-accent-500/20 focus:border-accent-500 bg-white"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] text-ink-500 mb-1">Due Date</label>
                              <input
                                type="date"
                                value={itemForm.dueDate}
                                onChange={(e) => setItemForm({ ...itemForm, dueDate: e.target.value })}
                                className="w-full px-3 py-2 rounded-lg border border-surface-200 text-[13px] focus:outline-none focus:ring-2 focus:ring-accent-500/20 focus:border-accent-500 bg-white"
                              />
                            </div>
                          </div>

                          {/* Checkbox options */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-surface-100">
                            <label className="flex items-center gap-2 text-[12px] text-ink-600">
                              <input
                                type="checkbox"
                                checked={itemForm.notifyEmployee}
                                onChange={(e) => setItemForm({ ...itemForm, notifyEmployee: e.target.checked })}
                                className="rounded border-surface-300"
                              />
                              Notify Employee
                            </label>
                            <label className="flex items-center gap-2 text-[12px] text-ink-600">
                              <input
                                type="checkbox"
                                checked={itemForm.actionRequired}
                                onChange={(e) => setItemForm({ ...itemForm, actionRequired: e.target.checked })}
                                className="rounded border-surface-300"
                              />
                              Action Required
                            </label>
                            <label className="flex items-center gap-2 text-[12px] text-ink-600">
                              <input
                                type="checkbox"
                                checked={itemForm.acknowledgementRequired}
                                onChange={(e) => setItemForm({ ...itemForm, acknowledgementRequired: e.target.checked })}
                                className="rounded border-surface-300"
                              />
                              Acknowledgement Required
                            </label>
                            <label className="flex items-center gap-2 text-[12px] text-ink-600">
                              <input
                                type="checkbox"
                                checked={itemForm.requiresEvidence}
                                onChange={(e) => setItemForm({ ...itemForm, requiresEvidence: e.target.checked })}
                                className="rounded border-surface-300"
                              />
                              Requires Evidence
                            </label>
                            <label className="flex items-center gap-2 text-[12px] text-ink-600">
                              <input
                                type="checkbox"
                                checked={itemForm.requiresApproval}
                                onChange={(e) => setItemForm({ ...itemForm, requiresApproval: e.target.checked })}
                                className="rounded border-surface-300"
                              />
                              Requires Approval
                            </label>
                          </div>

                          <div className="flex items-center gap-2 pt-2">
                            <button
                              onClick={handleSaveItem}
                              disabled={busy || !itemForm.title.trim()}
                              className="flex items-center gap-1.5 px-4 py-2 bg-accent-600 text-white text-[12px] rounded-lg hover:bg-accent-700 disabled:opacity-50"
                            >
                              {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                              {editingItemId ? 'Update' : 'Save'}
                            </button>
                            <button
                              onClick={resetItemForm}
                              className="px-4 py-2 text-[12px] text-ink-500 hover:text-ink-700"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function LoadingState() {
  return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="w-6 h-6 animate-spin text-ink-300" />
    </div>
  )
}

function EmptyState({ icon: Icon, title, description }: { icon: React.FC<{ className?: string }>; title: string; description: string }) {
  return (
    <div className="text-center py-12 bg-surface-50 rounded-lg">
      <Icon className="w-10 h-10 text-ink-200 mx-auto mb-3" />
      <p className="text-[13px] font-medium text-ink-500">{title}</p>
      <p className="text-[11px] text-ink-300 mt-1">{description}</p>
    </div>
  )
}

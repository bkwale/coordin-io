'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Building2, Users, CreditCard, Hash, Globe, Puzzle, Shield,
  Save, Plus, Mail, CheckCircle, XCircle, Clock, UserPlus,
  ChevronRight, Loader2,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ── Types ──────────────────────────────────────────────────

interface OrgData {
  id: string
  name: string
  slug: string
  logoUrl: string | null
  defaultCurrency: string
  currencies: string[]
  offices: Array<{ id: string; name: string; city: string; country: string }>
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
  office: { name: string; city: string } | null
  role: { name: string; level: string } | null
}

interface TeamData {
  members: TeamMember[]
  total: number
  active: number
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
            </div>
          </div>
        </div>
      </div>
    </div>
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
        <FieldGroup label="Offices" hint={`${org?.offices?.length || 0} registered`}>
          {org?.offices && org.offices.length > 0 ? (
            <div className="space-y-2">
              {org.offices.map((office) => (
                <div key={office.id} className="flex items-center justify-between p-3 bg-surface-50 rounded-lg">
                  <div>
                    <p className="text-[13px] font-medium text-ink-900">{office.name}</p>
                    <p className="text-[11px] text-ink-400">{office.city}, {office.country}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-ink-300" />
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[13px] text-ink-300 italic">No offices configured yet</p>
          )}
        </FieldGroup>

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

  useEffect(() => {
    fetch('/api/settings/team')
      .then((r) => {
        if (!r.ok) throw new Error('Failed to load team')
        return r.json()
      })
      .then(setTeam)
      .catch(() => setTeam({ members: [], total: 0, active: 0 }))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <LoadingState />

  const statusIcon = (status: string) => {
    switch (status) {
      case 'ACTIVE': return <CheckCircle className="w-4 h-4 text-emerald-500" />
      case 'INVITED': return <Mail className="w-4 h-4 text-amber-500" />
      case 'DEACTIVATED': return <XCircle className="w-4 h-4 text-red-400" />
      default: return <Clock className="w-4 h-4 text-ink-300" />
    }
  }

  const permissionLabel = (p: string) => {
    switch (p) {
      case 'OWNER': return 'Practice Principal'
      case 'ADMIN': return 'Practice Manager'
      case 'MANAGER': return 'Project Lead'
      case 'MEMBER': return 'Team Member'
      case 'VIEWER': return 'External'
      default: return p
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

      {/* Invite Button */}
      <div className="flex justify-end mb-4">
        <button className="flex items-center gap-2 px-4 py-2 bg-ink-900 text-white text-[13px] font-medium rounded-lg hover:bg-ink-800 transition-colors">
          <UserPlus className="w-4 h-4" />
          Invite Team Member
        </button>
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
              </tr>
            </thead>
            <tbody>
              {team.members.map((member) => (
                <tr key={member.id} className="border-b border-surface-200/60 hover:bg-surface-50/50 transition-colors">
                  <td className="py-3 px-4">
                    <div>
                      <p className="text-[13px] font-medium text-ink-900">{member.fullName}</p>
                      <p className="text-[11px] text-ink-400">{member.email}</p>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <p className="text-[13px] text-ink-600">{member.role?.name || member.jobTitle || '—'}</p>
                  </td>
                  <td className="py-3 px-4">
                    <span className={cn(
                      'inline-block text-[11px] font-medium px-2 py-0.5 rounded-full',
                      member.orgPermission === 'OWNER' ? 'bg-purple-50 text-purple-700' :
                      member.orgPermission === 'ADMIN' ? 'bg-blue-50 text-blue-700' :
                      member.orgPermission === 'MANAGER' ? 'bg-amber-50 text-amber-700' :
                      member.orgPermission === 'VIEWER' ? 'bg-surface-100 text-ink-400' :
                      'bg-surface-100 text-ink-500'
                    )}>
                      {member.orgPermissionLabel || permissionLabel(member.orgPermission)}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-[13px] text-ink-500">
                    {member.office?.name || '—'}
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-1.5">
                      {statusIcon(member.status)}
                      <span className="text-[12px] text-ink-500 capitalize">{member.status.toLowerCase()}</span>
                    </div>
                  </td>
                </tr>
              ))}
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
  return (
    <div>
      <SectionHeader
        title="Document Numbering"
        description="Configure automatic numbering for projects, quotes, and drawing issues"
      />

      <div className="mt-6 space-y-4">
        {[
          { title: 'Project Numbers', description: 'Format: {OFFICE}-{YEAR}-{SEQ:3}', example: 'LON-2026-001', active: true },
          { title: 'Quote Numbers', description: 'Format: Q-{YEAR}-{SEQ:3}', example: 'Q-2026-042', active: true },
          { title: 'Drawing Issue Numbers', description: 'Format: {PROJECT}-{SEQ:2}', example: 'LON-2026-001-01', active: true },
        ].map((tmpl) => (
          <div key={tmpl.title} className="flex items-center justify-between p-4 bg-surface-50 rounded-lg">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <p className="text-[13px] font-medium text-ink-900">{tmpl.title}</p>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-medium">Active</span>
              </div>
              <p className="text-[11px] text-ink-400 mt-1">{tmpl.description}</p>
              <p className="text-[11px] text-ink-500 mt-0.5">Preview: <span className="font-mono font-medium">{tmpl.example}</span></p>
            </div>
            <button className="text-[12px] text-accent-600 hover:text-accent-700 font-medium">Edit</button>
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
  return (
    <div>
      <SectionHeader
        title="Regional Settings"
        description="Locale, timezone, and formatting preferences"
      />

      <div className="space-y-6 mt-8">
        <FieldGroup label="Timezone">
          <select className="settings-input" defaultValue="Europe/London">
            <option value="Europe/London">Europe/London (GMT/BST)</option>
            <option value="Europe/Berlin">Europe/Berlin (CET/CEST)</option>
            <option value="America/New_York">America/New_York (EST/EDT)</option>
            <option value="Africa/Lagos">Africa/Lagos (WAT)</option>
            <option value="Asia/Dubai">Asia/Dubai (GST)</option>
          </select>
        </FieldGroup>

        <FieldGroup label="Date Format">
          <select className="settings-input" defaultValue="DD/MM/YYYY">
            <option value="DD/MM/YYYY">DD/MM/YYYY — 18/07/2026</option>
            <option value="MM/DD/YYYY">MM/DD/YYYY — 07/18/2026</option>
            <option value="YYYY-MM-DD">YYYY-MM-DD — 2026-07-18</option>
            <option value="D MMM YYYY">D MMM YYYY — 18 Jul 2026</option>
          </select>
        </FieldGroup>

        <FieldGroup label="Number Format">
          <select className="settings-input" defaultValue="en-GB">
            <option value="en-GB">1,234.56 (UK/US)</option>
            <option value="de-DE">1.234,56 (EU)</option>
          </select>
        </FieldGroup>

        <FieldGroup label="Week Starts On">
          <select className="settings-input" defaultValue="monday">
            <option value="monday">Monday</option>
            <option value="sunday">Sunday</option>
          </select>
        </FieldGroup>

        <FieldGroup label="Language">
          <select className="settings-input" defaultValue="en">
            <option value="en">English</option>
          </select>
          <p className="text-[11px] text-ink-300 mt-1">More languages coming soon</p>
        </FieldGroup>
      </div>

      <div className="mt-8 pt-6 border-t border-surface-200">
        <button className="flex items-center gap-2 px-5 py-2.5 bg-ink-900 text-white text-[13px] font-medium rounded-lg hover:bg-ink-800 transition-colors">
          <Save className="w-4 h-4" />
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

// ── Shared Components ──────────────────────────────────────

function SectionHeader({ title, description }: { title: string; description: string }) {
  return (
    <div className="pb-6 border-b border-surface-200">
      <h2 className="font-display text-xl text-ink-900">{title}</h2>
      <p className="text-[13px] text-ink-400 mt-1">{description}</p>
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

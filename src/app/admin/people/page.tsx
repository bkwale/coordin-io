'use client'

import { useState } from 'react'
import { Mail, Plus, UserPlus, Copy, Check, Clock, CheckCircle2, XCircle } from 'lucide-react'

type InvitationForm = {
  fullName: string
  email: string
  jobTitle: string
  officeId: string
  startDate: string
  annualLeave: number
}

type InvitationRecord = {
  id: string
  fullName: string
  email: string
  jobTitle: string | null
  status: string
  token: string
  expiresAt: string
  createdAt: string
  createdBy: { fullName: string }
}

const initialForm: InvitationForm = {
  fullName: '',
  email: '',
  jobTitle: '',
  officeId: '',
  startDate: '',
  annualLeave: 25,
}

export default function PeopleAdminPage() {
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<InvitationForm>(initialForm)
  const [submitting, setSubmitting] = useState(false)
  const [invitations, setInvitations] = useState<InvitationRecord[]>([])
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  function updateField(field: keyof InvitationForm, value: string | number) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError('')
    setSuccess('')

    try {
      const res = await fetch('/api/invitations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error || 'Failed to create invitation')
        setSubmitting(false)
        return
      }

      const data = await res.json()
      setSuccess(`Invitation created for ${form.fullName}`)
      setInvitations(prev => [data.invitation, ...prev])
      setForm(initialForm)
      setShowForm(false)
    } catch {
      setError('Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }

  function copyLink(token: string, id: string) {
    const url = `${window.location.origin}/activate/${token}`
    navigator.clipboard.writeText(url)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const statusIcon = (status: string) => {
    switch (status) {
      case 'ACTIVATED': return <CheckCircle2 className="w-4 h-4 text-emerald-500" />
      case 'EXPIRED': return <Clock className="w-4 h-4 text-amber-500" />
      case 'REVOKED': return <XCircle className="w-4 h-4 text-red-500" />
      default: return <Mail className="w-4 h-4 text-blue-500" />
    }
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-display text-ink-900">People</h1>
          <p className="text-ink-500 text-[15px] mt-1">Invite and manage team members</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-gradient-accent text-white font-semibold text-[14px] px-5 py-2.5 rounded-lg hover:opacity-90 transition-opacity flex items-center gap-2"
        >
          <UserPlus className="w-4 h-4" />
          Invite employee
        </button>
      </div>

      {/* Feedback */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-[13px]">
          {error}
        </div>
      )}
      {success && (
        <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-700 text-[13px]">
          {success}
        </div>
      )}

      {/* Invitation form */}
      {showForm && (
        <div className="bg-white rounded-xl border border-surface-200 shadow-card p-6 mb-6">
          <h2 className="font-display text-lg text-ink-900 mb-4 flex items-center gap-2">
            <Plus className="w-5 h-5" />
            New employee invitation
          </h2>
          <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[13px] font-semibold text-ink-700 mb-1">Full name *</label>
              <input
                type="text"
                value={form.fullName}
                onChange={e => updateField('fullName', e.target.value)}
                className="w-full px-3 py-2 border border-surface-300 rounded-lg text-[14px] focus:outline-none focus:ring-2 focus:ring-accent-500"
                required
              />
            </div>
            <div>
              <label className="block text-[13px] font-semibold text-ink-700 mb-1">Company email *</label>
              <input
                type="email"
                value={form.email}
                onChange={e => updateField('email', e.target.value)}
                className="w-full px-3 py-2 border border-surface-300 rounded-lg text-[14px] focus:outline-none focus:ring-2 focus:ring-accent-500"
                required
              />
            </div>
            <div>
              <label className="block text-[13px] font-semibold text-ink-700 mb-1">Job title</label>
              <input
                type="text"
                value={form.jobTitle}
                onChange={e => updateField('jobTitle', e.target.value)}
                className="w-full px-3 py-2 border border-surface-300 rounded-lg text-[14px] focus:outline-none focus:ring-2 focus:ring-accent-500"
                placeholder="e.g. Graduate Architectural Assistant"
              />
            </div>
            <div>
              <label className="block text-[13px] font-semibold text-ink-700 mb-1">Start date</label>
              <input
                type="date"
                value={form.startDate}
                onChange={e => updateField('startDate', e.target.value)}
                className="w-full px-3 py-2 border border-surface-300 rounded-lg text-[14px] focus:outline-none focus:ring-2 focus:ring-accent-500"
              />
            </div>
            <div>
              <label className="block text-[13px] font-semibold text-ink-700 mb-1">Annual leave (days)</label>
              <input
                type="number"
                value={form.annualLeave}
                onChange={e => updateField('annualLeave', parseFloat(e.target.value))}
                className="w-full px-3 py-2 border border-surface-300 rounded-lg text-[14px] focus:outline-none focus:ring-2 focus:ring-accent-500"
                min={0}
                max={50}
              />
            </div>
            <div className="col-span-2 flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => { setShowForm(false); setForm(initialForm) }}
                className="px-4 py-2 text-[14px] font-medium text-ink-600 hover:bg-surface-50 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="bg-gradient-accent text-white font-semibold text-[14px] px-5 py-2 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {submitting ? 'Creating...' : 'Send invitation'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Invitations list */}
      <div className="bg-white rounded-xl border border-surface-200 shadow-card">
        <div className="px-5 py-4 border-b border-surface-200">
          <h2 className="font-semibold text-ink-900 text-[15px]">Invitations</h2>
        </div>
        {invitations.length === 0 ? (
          <div className="p-8 text-center text-ink-400 text-[14px]">
            No invitations yet. Click &quot;Invite employee&quot; to get started.
          </div>
        ) : (
          <div className="divide-y divide-surface-100">
            {invitations.map(inv => (
              <div key={inv.id} className="px-5 py-3.5 flex items-center gap-4">
                <div className="w-9 h-9 rounded-full bg-surface-100 flex items-center justify-center">
                  {statusIcon(inv.status)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-ink-900 text-[14px] truncate">{inv.fullName}</p>
                  <p className="text-ink-500 text-[12px]">{inv.email} · {inv.jobTitle || 'No title'}</p>
                </div>
                <span className={`text-[12px] font-bold px-2.5 py-1 rounded-full ${
                  inv.status === 'ACTIVATED' ? 'bg-emerald-50 text-emerald-700' :
                  inv.status === 'EXPIRED' ? 'bg-amber-50 text-amber-700' :
                  inv.status === 'REVOKED' ? 'bg-red-50 text-red-700' :
                  'bg-blue-50 text-blue-700'
                }`}>
                  {inv.status}
                </span>
                {(inv.status === 'PENDING' || inv.status === 'SENT') && (
                  <button
                    onClick={() => copyLink(inv.token, inv.id)}
                    className="text-ink-400 hover:text-ink-600 transition-colors p-1.5"
                    title="Copy invitation link"
                  >
                    {copiedId === inv.id ? (
                      <Check className="w-4 h-4 text-emerald-500" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

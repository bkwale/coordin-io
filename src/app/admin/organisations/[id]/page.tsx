'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Users, FolderKanban, Plus, X, CheckCircle } from 'lucide-react'

interface OrgDetail {
  organisation: {
    id: string
    name: string
    slug: string
    default_currency: string
    created_at: string
  }
  users: Array<{
    id: string
    full_name: string
    email: string
    job_title: string | null
    orgPermission: string
    status: string
    created_at: string
  }>
  projects: Array<{
    id: string
    name: string
    code: string | null
    status: string
    stage: string
    health_status: string
    created_at: string
  }>
}

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: 'bg-emerald-100 text-emerald-700',
  INVITED: 'bg-blue-100 text-blue-700',
  ONBOARDING: 'bg-amber-100 text-amber-700',
  DEACTIVATED: 'bg-red-100 text-red-700',
}

const HEALTH_COLORS: Record<string, string> = {
  GREEN: 'bg-emerald-400',
  AMBER: 'bg-amber-400',
  RED: 'bg-red-400',
}

export default function OrgDetailPage() {
  const params = useParams()
  const orgId = params.id as string

  const [data, setData] = useState<OrgDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [showAddUser, setShowAddUser] = useState(false)
  const [success, setSuccess] = useState<string | null>(null)

  // Add user form
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [jobTitle, setJobTitle] = useState('')
  const [permission, setPermission] = useState('MEMBER')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  function loadOrg() {
    fetch(`/api/admin/organisations/${orgId}`)
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadOrg() }, [orgId])

  async function handleAddUser(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setFormError(null)

    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organisationId: orgId,
          fullName,
          email,
          jobTitle: jobTitle || undefined,
          orgPermission: permission,
        }),
      })

      const result = await res.json()
      if (!res.ok) {
        setFormError(result.error)
        return
      }

      setSuccess(`User "${fullName}" added`)
      setShowAddUser(false)
      setFullName('')
      setEmail('')
      setJobTitle('')
      setPermission('MEMBER')
      loadOrg()
    } catch {
      setFormError('Network error')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="animate-pulse">
        <div className="h-6 bg-slate-200 rounded w-48 mb-4" />
        <div className="h-4 bg-slate-100 rounded w-32 mb-8" />
        <div className="h-40 bg-slate-100 rounded-xl" />
      </div>
    )
  }

  if (!data) {
    return <p className="text-slate-500">Organisation not found</p>
  }

  const { organisation: org, users, projects } = data

  return (
    <div>
      <Link
        href="/admin/organisations"
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-4"
      >
        <ArrowLeft className="w-4 h-4" /> All Organisations
      </Link>

      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">{org.name}</h1>
          <p className="text-sm text-slate-400 mt-1">
            /{org.slug} · {org.default_currency} · Created{' '}
            {new Date(org.created_at).toLocaleDateString()}
          </p>
        </div>
      </div>

      {success && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 mb-6 flex items-center gap-3">
          <CheckCircle className="w-5 h-5 text-emerald-500" />
          <p className="text-sm text-emerald-700">{success}</p>
          <button onClick={() => setSuccess(null)} className="ml-auto">
            <X className="w-4 h-4 text-emerald-400" />
          </button>
        </div>
      )}

      {/* Users Section */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
            <Users className="w-5 h-5 text-slate-400" />
            Users ({users.length})
          </h2>
          <button
            onClick={() => setShowAddUser(!showAddUser)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 text-white rounded-lg text-xs font-medium hover:bg-slate-800"
          >
            {showAddUser ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
            {showAddUser ? 'Cancel' : 'Add User'}
          </button>
        </div>

        {showAddUser && (
          <form onSubmit={handleAddUser} className="bg-slate-50 rounded-lg p-4 mb-4 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                type="text"
                required
                placeholder="Full Name *"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="px-3 py-2 rounded-lg border border-slate-200 text-sm"
              />
              <input
                type="email"
                required
                placeholder="Email *"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="px-3 py-2 rounded-lg border border-slate-200 text-sm"
              />
              <input
                type="text"
                placeholder="Job Title"
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
                className="px-3 py-2 rounded-lg border border-slate-200 text-sm"
              />
              <select
                value={permission}
                onChange={(e) => setPermission(e.target.value)}
                className="px-3 py-2 rounded-lg border border-slate-200 text-sm"
              >
                <option value="OWNER">Owner</option>
                <option value="ADMIN">Admin</option>
                <option value="MANAGER">Manager</option>
                <option value="MEMBER">Member</option>
                <option value="VIEWER">Viewer</option>
              </select>
            </div>
            {formError && <p className="text-sm text-red-600">{formError}</p>}
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-medium disabled:opacity-60"
            >
              {submitting ? 'Adding...' : 'Add User'}
            </button>
          </form>
        )}

        {users.length === 0 ? (
          <p className="text-sm text-slate-400 py-4 text-center">No users yet</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {users.map((user) => (
              <div key={user.id} className="flex items-center justify-between py-3">
                <div>
                  <p className="text-sm font-medium text-slate-900">{user.full_name}</p>
                  <p className="text-xs text-slate-400">{user.email}</p>
                </div>
                <div className="flex items-center gap-3">
                  {user.job_title && (
                    <span className="text-xs text-slate-500">{user.job_title}</span>
                  )}
                  <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                    {user.orgPermission}
                  </span>
                  <span
                    className={`text-xs font-medium px-2 py-0.5 rounded ${STATUS_COLORS[user.status] || 'bg-slate-100 text-slate-600'}`}
                  >
                    {user.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Projects Section */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2 mb-4">
          <FolderKanban className="w-5 h-5 text-slate-400" />
          Projects ({projects.length})
        </h2>

        {projects.length === 0 ? (
          <p className="text-sm text-slate-400 py-4 text-center">No projects yet</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {projects.map((project) => (
              <div key={project.id} className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-2.5 h-2.5 rounded-full ${HEALTH_COLORS[project.health_status] || 'bg-slate-300'}`}
                  />
                  <div>
                    <p className="text-sm font-medium text-slate-900">{project.name}</p>
                    <p className="text-xs text-slate-400">
                      {project.code ? `${project.code} · ` : ''}
                      {project.stage}
                    </p>
                  </div>
                </div>
                <span
                  className={`text-xs font-medium px-2 py-0.5 rounded ${STATUS_COLORS[project.status] || 'bg-slate-100 text-slate-600'}`}
                >
                  {project.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

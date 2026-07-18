'use client'

import { useEffect, useState } from 'react'
import { Users, Search } from 'lucide-react'

interface User {
  id: string
  full_name: string
  email: string
  job_title: string | null
  orgPermission: string
  status: string
  auth_user_id: string | null
  created_at: string
  org_name: string
  org_slug: string
}

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: 'bg-emerald-100 text-emerald-700',
  INVITED: 'bg-blue-100 text-blue-700',
  ONBOARDING: 'bg-amber-100 text-amber-700',
  DEACTIVATED: 'bg-red-100 text-red-700',
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    fetch('/api/admin/users')
      .then((r) => r.json())
      .then((data) => setUsers(data.users || []))
      .finally(() => setLoading(false))
  }, [])

  const filtered = users.filter(
    (u) =>
      u.full_name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      u.org_name.toLowerCase().includes(search.toLowerCase()),
  )

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">All Users</h1>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search users..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 pr-4 py-2 rounded-lg border border-slate-200 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-slate-400"
          />
        </div>
      </div>

      {loading ? (
        <div className="bg-white rounded-xl border border-slate-200 p-8 animate-pulse">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex gap-4 py-3">
              <div className="h-4 bg-slate-200 rounded w-32" />
              <div className="h-4 bg-slate-100 rounded w-48" />
              <div className="h-4 bg-slate-100 rounded w-24" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <Users className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-500">
            {search ? 'No users match your search' : 'No users yet'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-5 py-3">
                  Name
                </th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-5 py-3">
                  Email
                </th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-5 py-3">
                  Organisation
                </th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-5 py-3">
                  Role
                </th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-5 py-3">
                  Status
                </th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-5 py-3">
                  Auth
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((user) => (
                <tr key={user.id} className="hover:bg-slate-50">
                  <td className="px-5 py-3">
                    <p className="text-sm font-medium text-slate-900">{user.full_name}</p>
                    {user.job_title && (
                      <p className="text-xs text-slate-400">{user.job_title}</p>
                    )}
                  </td>
                  <td className="px-5 py-3 text-sm text-slate-600">{user.email}</td>
                  <td className="px-5 py-3 text-sm text-slate-600">{user.org_name}</td>
                  <td className="px-5 py-3">
                    <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                      {user.orgPermission}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className={`text-xs font-medium px-2 py-0.5 rounded ${STATUS_COLORS[user.status] || 'bg-slate-100'}`}
                    >
                      {user.status}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    {user.auth_user_id ? (
                      <span className="text-xs text-emerald-600 font-medium">Linked</span>
                    ) : (
                      <span className="text-xs text-slate-400">Not linked</span>
                    )}
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

'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Building2, Users, FolderKanban, Activity, AlertTriangle } from 'lucide-react'

interface Stats {
  organisations: number
  users: number
  activeUsers: number
  projects: number
  recentAuditEvents: number
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/admin/stats')
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json()
          throw new Error(data.error || 'Failed to load stats')
        }
        return res.json()
      })
      .then(setStats)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 mb-6">Platform Dashboard</h1>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white rounded-xl border border-slate-200 p-5 animate-pulse">
              <div className="h-4 bg-slate-200 rounded w-24 mb-3" />
              <div className="h-8 bg-slate-200 rounded w-16" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 mb-6">Platform Dashboard</h1>
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5" />
          <div>
            <p className="font-medium text-red-800">Access denied</p>
            <p className="text-sm text-red-600 mt-1">{error}</p>
            <p className="text-sm text-red-600 mt-2">
              You need to be a platform super admin to access this page.
              Sign in with an authorised account.
            </p>
          </div>
        </div>
      </div>
    )
  }

  const cards = [
    {
      label: 'Organisations',
      value: stats?.organisations ?? 0,
      icon: Building2,
      color: 'text-blue-600 bg-blue-50',
      href: '/admin/organisations',
    },
    {
      label: 'Total Users',
      value: stats?.users ?? 0,
      sub: `${stats?.activeUsers ?? 0} active`,
      icon: Users,
      color: 'text-emerald-600 bg-emerald-50',
      href: '/admin/users',
    },
    {
      label: 'Projects',
      value: stats?.projects ?? 0,
      icon: FolderKanban,
      color: 'text-violet-600 bg-violet-50',
      href: '#',
    },
    {
      label: 'Audit Events (7d)',
      value: stats?.recentAuditEvents ?? 0,
      icon: Activity,
      color: 'text-amber-600 bg-amber-50',
      href: '/admin/audit',
    },
  ]

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900 mb-6">Platform Dashboard</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-10">
        {cards.map(({ label, value, sub, icon: Icon, color, href }) => (
          <Link
            key={label}
            href={href}
            className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-md transition-shadow"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-slate-500">{label}</span>
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${color}`}>
                <Icon className="w-4 h-4" />
              </div>
            </div>
            <p className="text-3xl font-bold text-slate-900">{value}</p>
            {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
          </Link>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Quick Actions</h2>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/admin/organisations?action=new"
            className="px-4 py-2.5 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800 transition-colors"
          >
            + New Organisation
          </Link>
          <Link
            href="/admin/users"
            className="px-4 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors"
          >
            Manage Users
          </Link>
          <Link
            href="/admin/audit"
            className="px-4 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors"
          >
            View Audit Log
          </Link>
        </div>
      </div>
    </div>
  )
}

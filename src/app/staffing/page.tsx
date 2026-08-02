'use client'

import { useEffect, useState, useCallback } from 'react'
import { Users, AlertTriangle, RefreshCw, Briefcase, UserCheck, BarChart3 } from 'lucide-react'
import { SkeletonRow } from '@/components/Skeleton'

/* -- Types ------------------------------------------------- */

interface TeamMember {
  id: string
  fullName: string
  email: string
  jobTitle: string | null
  orgPermission: string
  orgPermissionLabel: string
  status: string
  startDate: string | null
  office: string | null
  role: string | null
}

interface TeamData {
  members: TeamMember[]
  total: number
  active: number
}

interface Project {
  _count: { tasks: number; memberships: number }
}

/* -- Helpers ----------------------------------------------- */

function safePercent(numerator: number, denominator: number): string {
  if (denominator === 0) return 'Not available'
  const value = (numerator / denominator) * 100
  if (!isFinite(value) || isNaN(value)) return 'Not available'
  return `${Math.round(value)}%`
}

const STATUS_COLORS: Record<string, { label: string; color: string; bg: string }> = {
  ACTIVE: { label: 'Active', color: 'text-emerald-600', bg: 'bg-emerald-50' },
  INACTIVE: { label: 'Inactive', color: 'text-ink-400', bg: 'bg-ink-50' },
  ONBOARDING: { label: 'Onboarding', color: 'text-blue-600', bg: 'bg-blue-50' },
  OFFBOARDING: { label: 'Offboarding', color: 'text-amber-600', bg: 'bg-amber-50' },
}

/* -- Page -------------------------------------------------- */

export default function StaffingPage() {
  const [teamData, setTeamData] = useState<TeamData | null>(null)
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [teamRes, projRes] = await Promise.all([
        fetch('/api/settings/team'),
        fetch('/api/projects'),
      ])
      if (!teamRes.ok || !projRes.ok) {
        const errBody = await (teamRes.ok ? projRes : teamRes).json().catch(() => ({}))
        throw new Error(errBody.error?.message || 'Failed to load staffing data')
      }
      const teamJson = await teamRes.json()
      const projJson = await projRes.json()
      setTeamData(teamJson)
      setProjects(projJson.data?.projects ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  /* -- Loading skeleton ----------------------------------- */

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-40 bg-ink-100 animate-pulse rounded" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 bg-ink-100 animate-pulse rounded-xl" />
          ))}
        </div>
        <div className="bg-white rounded-xl border border-ink-100 divide-y divide-ink-50">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonRow key={i} />
          ))}
        </div>
      </div>
    )
  }

  /* -- Error state ---------------------------------------- */

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh] gap-4">
        <AlertTriangle className="w-8 h-8 text-red-500" />
        <p className="text-[13px] text-ink-600">{error}</p>
        <button
          onClick={fetchData}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-ink-900 text-white text-[13px] font-medium hover:bg-ink-800 transition-colors"
        >
          <RefreshCw className="w-4 h-4" /> Try again
        </button>
      </div>
    )
  }

  /* -- Compute metrics ------------------------------------ */

  const members = teamData?.members ?? []
  const totalStaff = teamData?.total ?? 0
  const activeStaff = teamData?.active ?? 0

  // Unique profiles assigned to projects (sum of memberships across projects, capped at totalStaff)
  const totalMemberships = projects.reduce((sum, p) => sum + (p._count?.memberships ?? 0), 0)
  const assignedToProjects = Math.min(totalMemberships, totalStaff)

  const utilisationRate = safePercent(assignedToProjects, totalStaff)

  /* -- Empty state ---------------------------------------- */

  if (members.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-[20px] sm:text-[22px] font-semibold text-ink-900">Staffing</h1>
          <p className="text-[13px] text-ink-400 mt-1">Resource allocation and capacity planning</p>
        </div>
        <div className="bg-white rounded-xl border border-ink-100 p-12 text-center">
          <Users className="w-12 h-12 text-ink-200 mx-auto mb-4" />
          <p className="text-[15px] font-medium text-ink-700">No staffing data yet</p>
          <p className="text-[12px] text-ink-400 mt-2 max-w-md mx-auto">
            Team capacity, utilisation rates, and resource forecasts will appear once team members are assigned to projects.
          </p>
        </div>
      </div>
    )
  }

  /* -- Main render ---------------------------------------- */

  const summaryCards = [
    { label: 'Total staff', value: totalStaff, icon: Users, iconColor: 'text-ink-400', iconBg: 'bg-ink-50' },
    { label: 'Active staff', value: activeStaff, icon: UserCheck, iconColor: 'text-emerald-500', iconBg: 'bg-emerald-50' },
    { label: 'Assigned to projects', value: assignedToProjects, icon: Briefcase, iconColor: 'text-blue-500', iconBg: 'bg-blue-50' },
    { label: 'Utilisation rate', value: utilisationRate, icon: BarChart3, iconColor: 'text-amber-500', iconBg: 'bg-amber-50' },
  ]

  return (
    <div className="space-y-6">
      {/* -- Header ---------------------------------------- */}
      <div>
        <h1 className="text-[20px] sm:text-[22px] font-semibold text-ink-900">Staffing</h1>
        <p className="text-[13px] text-ink-400 mt-1">
          {totalStaff} team member{totalStaff !== 1 ? 's' : ''} &middot; Resource allocation and capacity planning
        </p>
      </div>

      {/* -- Summary cards --------------------------------- */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {summaryCards.map((card) => {
          const Icon = card.icon
          return (
            <div key={card.label} className="bg-white rounded-xl border border-ink-100 p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className={`w-8 h-8 rounded-lg ${card.iconBg} flex items-center justify-center`}>
                  <Icon className={`w-4 h-4 ${card.iconColor}`} />
                </div>
              </div>
              <p className="text-[20px] font-semibold text-ink-900">{card.value}</p>
              <p className="text-[11px] text-ink-400 mt-0.5">{card.label}</p>
            </div>
          )
        })}
      </div>

      {/* -- Team table ------------------------------------ */}
      <div className="bg-white rounded-xl border border-ink-100 divide-y divide-ink-50">
        {/* Table header */}
        <div className="grid grid-cols-[1fr_1fr_auto] gap-4 px-5 py-3">
          <p className="text-[11px] font-medium text-ink-400 uppercase tracking-wide">Name</p>
          <p className="text-[11px] font-medium text-ink-400 uppercase tracking-wide">Role</p>
          <p className="text-[11px] font-medium text-ink-400 uppercase tracking-wide w-24 text-right">Status</p>
        </div>
        {/* Rows */}
        {members.map((member) => {
          const statusMeta = STATUS_COLORS[member.status] ?? { label: member.status, color: 'text-ink-500', bg: 'bg-ink-100' }
          return (
            <div key={member.id} className="grid grid-cols-[1fr_1fr_auto] gap-4 items-center px-5 py-3.5">
              <div className="min-w-0">
                <p className="text-[13px] font-medium text-ink-900 truncate">{member.fullName}</p>
                <p className="text-[11px] text-ink-400 truncate">{member.email}</p>
              </div>
              <p className="text-[13px] text-ink-600 truncate">
                {member.jobTitle || member.orgPermissionLabel || 'No role'}
              </p>
              <div className="w-24 text-right">
                <span className={`text-[11px] font-medium px-2.5 py-0.5 rounded-full ${statusMeta.bg} ${statusMeta.color}`}>
                  {statusMeta.label}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

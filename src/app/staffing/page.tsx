'use client'

import { useMemo } from 'react'
import { Breadcrumb } from '@/components/Breadcrumb'
import { SummaryCard } from '@/components/SummaryCard'
import { cn, utilisationColor, formatDate, leaveTypeColor, leaveTypeLabel, leaveStatusColor, leaveStatusLabel } from '@/lib/utils'
import {
  getStaffAllocations,
  getStaffCapacities,
  getProject,
  getUser,
  getLeaveRecords,
  getUpcomingLeave,
  getPendingLeaveRequests,
  getLeaveEntitlements,
  getLeaveEntitlement,
  getBankHolidays,
  getUpcomingBankHolidays,
  getUserLeaveRecords,
} from '@/lib/mock-data'
import { StaffAllocation, StaffCapacity } from '@/lib/types'

interface UserWithMetrics {
  userId: string
  name: string
  role: string
  capacity: StaffCapacity
  allocations: StaffAllocation[]
  totalAllocated: number
  utilisationPercent: number
  status: 'under' | 'optimal' | 'over'
  excessHours?: number
}

interface ProjectAllocationGroup {
  projectId: string
  name: string
  client: string
  totalHours: number
  allocations: Array<{
    userId: string
    userName: string
    roleOnProject: string
    hoursPerWeek: number
    periodStart: string
    periodEnd: string
  }>
}

export default function StaffingForecastPage() {
  const staffMetrics = useMemo(() => {
    const capacities = getStaffCapacities()
    const allocations = getStaffAllocations()

    const metrics: UserWithMetrics[] = capacities.map(capacity => {
      const user = getUser(capacity.user_id)
      const userAllocations = allocations.filter(a => a.user_id === capacity.user_id)
      const totalAllocated = userAllocations.reduce((sum, a) => sum + a.hours_per_week, 0)
      const utilisationPercent = Math.round((totalAllocated / capacity.weekly_capacity_hours) * 100)

      let status: 'under' | 'optimal' | 'over' = 'optimal'
      if (utilisationPercent < 70) status = 'under'
      if (utilisationPercent > 100) status = 'over'

      return {
        userId: capacity.user_id,
        name: user?.name || 'Unknown',
        role: user?.role || 'N/A',
        capacity,
        allocations: userAllocations,
        totalAllocated,
        utilisationPercent,
        status,
        excessHours: utilisationPercent > 100 ? totalAllocated - capacity.weekly_capacity_hours : 0,
      }
    })

    return metrics
  }, [])

  const projectAllocations = useMemo(() => {
    const allocations = getStaffAllocations()
    const grouped: Record<string, ProjectAllocationGroup> = {}

    allocations.forEach(alloc => {
      if (!grouped[alloc.project_id]) {
        const project = getProject(alloc.project_id)
        grouped[alloc.project_id] = {
          projectId: alloc.project_id,
          name: project?.name || 'Unknown',
          client: project?.client || 'N/A',
          totalHours: 0,
          allocations: [],
        }
      }

      const user = getUser(alloc.user_id)
      grouped[alloc.project_id].totalHours += alloc.hours_per_week
      grouped[alloc.project_id].allocations.push({
        userId: alloc.user_id,
        userName: user?.name || 'Unknown',
        roleOnProject: alloc.role_on_project,
        hoursPerWeek: alloc.hours_per_week,
        periodStart: alloc.start_date,
        periodEnd: alloc.end_date,
      })
    })

    return Object.values(grouped)
      .sort((a, b) => b.totalHours - a.totalHours)
  }, [])

  const summaryMetrics = useMemo(() => {
    return {
      teamSize: staffMetrics.length,
      avgUtilisation: Math.round(staffMetrics.reduce((sum, m) => sum + m.utilisationPercent, 0) / staffMetrics.length),
      overAllocated: staffMetrics.filter(m => m.status === 'over').length,
      underAllocated: staffMetrics.filter(m => m.status === 'under').length,
    }
  }, [staffMetrics])

  const sortedByUtilisation = [...staffMetrics].sort((a, b) => b.utilisationPercent - a.utilisationPercent)
  const overAllocatedMembers = staffMetrics.filter(m => m.status === 'over')

  // Leave data
  const upcomingLeave = getUpcomingLeave(60)
  const pendingRequests = getPendingLeaveRequests()
  const entitlements = getLeaveEntitlements()
  const upcomingBankHols = getUpcomingBankHolidays(90)
  const allLeave = getLeaveRecords()
  const totalLeaveDaysBooked = allLeave.filter(l => l.status === 'approved' || l.status === 'pending').reduce((sum, l) => sum + l.days, 0)

  return (
    <div className="max-w-6xl animate-fade-in">
      {/* ━━━ HEADER ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section className="pb-10">
        <Breadcrumb items={[{ label: 'Dashboard', href: '/' }, { label: 'Staffing & Leave' }]} />
        <div className="mt-6">
          <h1 className="font-display text-[2rem] text-ink-900 tracking-tight mb-2">
            Staffing & Leave
          </h1>
          <p className="text-[13px] text-ink-400 mt-1">{summaryMetrics.teamSize} team members &middot; {summaryMetrics.avgUtilisation}% avg utilisation</p>
        </div>
      </section>

      {/* ━━━ SUMMARY CARDS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section className="pb-8">
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <SummaryCard label="Team Size" value={summaryMetrics.teamSize} />
          <SummaryCard
            label="Avg Utilisation"
            value={summaryMetrics.avgUtilisation}
            textColor={summaryMetrics.avgUtilisation > 100 ? 'text-red-600' : 'text-emerald-600'}
          />
          <SummaryCard
            label="Over-allocated"
            value={summaryMetrics.overAllocated}
            bgColor={summaryMetrics.overAllocated > 0 ? 'bg-red-50' : 'bg-white'}
            borderColor={summaryMetrics.overAllocated > 0 ? 'border-red-200' : 'border-surface-200'}
            textColor={summaryMetrics.overAllocated > 0 ? 'text-red-700' : 'text-ink-900'}
          />
          <SummaryCard
            label="Pending Leave"
            value={pendingRequests.length}
            bgColor={pendingRequests.length > 0 ? 'bg-amber-50' : 'bg-white'}
            borderColor={pendingRequests.length > 0 ? 'border-amber-200' : 'border-surface-200'}
            textColor={pendingRequests.length > 0 ? 'text-amber-700' : 'text-ink-900'}
          />
          <SummaryCard
            label="Off Next 60d"
            value={upcomingLeave.length}
            bgColor="bg-blue-50"
            borderColor="border-blue-200"
            textColor="text-blue-700"
          />
        </div>
      </section>

      {/* ━━━ LEAVE & AVAILABILITY ━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section className="pb-8">
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Upcoming Leave + Pending Approvals */}
          <div className="xl:col-span-2 space-y-6">
            {/* Upcoming Leave */}
            <div>
              <h2 className="text-[15px] font-semibold text-ink-900 mb-4">Upcoming Leave</h2>
              <div className="card-premium overflow-hidden">
                {upcomingLeave.length === 0 ? (
                  <p className="p-5 text-[12px] text-ink-300 italic">No upcoming leave in the next 60 days.</p>
                ) : (
                  <table className="w-full text-[13px]">
                    <thead>
                      <tr className="border-b border-surface-200">
                        <th className="px-5 py-3 text-left text-[10px] text-ink-400 uppercase tracking-[0.1em] font-semibold">Person</th>
                        <th className="px-4 py-3 text-left text-[10px] text-ink-400 uppercase tracking-[0.1em] font-semibold">Type</th>
                        <th className="px-4 py-3 text-left text-[10px] text-ink-400 uppercase tracking-[0.1em] font-semibold">Dates</th>
                        <th className="px-4 py-3 text-center text-[10px] text-ink-400 uppercase tracking-[0.1em] font-semibold">Days</th>
                        <th className="px-5 py-3 text-left text-[10px] text-ink-400 uppercase tracking-[0.1em] font-semibold">Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {upcomingLeave.map(leave => {
                        const user = getUser(leave.user_id)
                        return (
                          <tr key={leave.id} className="border-b border-surface-100 stripe-row">
                            <td className="px-5 py-3.5">
                              <div className="flex items-center gap-2.5">
                                <span className="w-7 h-7 rounded-full bg-accent-100 flex items-center justify-center text-[10px] font-bold text-accent-600">
                                  {user?.name.split(' ').map(n => n[0]).join('') || '?'}
                                </span>
                                <span className="font-medium text-ink-900">{user?.name || 'Unknown'}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3.5">
                              <span className={cn('status-pill', leaveTypeColor(leave.leave_type))}>
                                {leaveTypeLabel(leave.leave_type)}
                              </span>
                            </td>
                            <td className="px-4 py-3.5 text-ink-600">
                              <span className="font-mono text-[11px] tabular-nums">
                                {formatDate(leave.start_date)} – {formatDate(leave.end_date)}
                              </span>
                            </td>
                            <td className="px-4 py-3.5 text-center font-semibold text-ink-700">{leave.days}</td>
                            <td className="px-5 py-3.5 text-[11px] text-ink-400 max-w-[200px] truncate">{leave.notes || '—'}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            {/* Pending Leave Requests */}
            {pendingRequests.length > 0 && (
              <div>
                <h2 className="text-[15px] font-semibold text-ink-900 mb-4">
                  Pending Requests
                  <span className="ml-2 inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-bold">{pendingRequests.length}</span>
                </h2>
                <div className="space-y-3">
                  {pendingRequests.map(req => {
                    const user = getUser(req.user_id)
                    return (
                      <div key={req.id} className="card-premium p-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center text-[11px] font-bold text-amber-700">
                            {user?.name.split(' ').map(n => n[0]).join('') || '?'}
                          </span>
                          <div>
                            <p className="text-[13px] font-medium text-ink-900">{user?.name}</p>
                            <p className="text-[11px] text-ink-400 mt-0.5">
                              {leaveTypeLabel(req.leave_type)} · {formatDate(req.start_date)} – {formatDate(req.end_date)} · {req.days} day{req.days > 1 ? 's' : ''}
                            </p>
                            {req.notes && <p className="text-[11px] text-ink-300 mt-0.5">{req.notes}</p>}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 ml-4">
                          <button className="px-3 py-1.5 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors">
                            Approve
                          </button>
                          <button className="px-3 py-1.5 text-[11px] font-semibold text-red-700 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors">
                            Decline
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Right sidebar — Entitlements + Bank Holidays */}
          <div className="space-y-6">
            {/* Leave Entitlements */}
            <div className="card-premium p-5">
              <h3 className="text-[11px] font-semibold text-ink-400 uppercase tracking-[0.1em] mb-4">Leave Entitlements</h3>
              <div className="space-y-4">
                {entitlements.map(ent => {
                  const user = getUser(ent.user_id)
                  const remaining = ent.total_days + ent.carried_over - ent.used_days - ent.pending_days
                  const usedPercent = Math.round(((ent.used_days + ent.pending_days) / (ent.total_days + ent.carried_over)) * 100)

                  return (
                    <div key={ent.user_id}>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[12px] font-medium text-ink-700">{user?.name}</span>
                        <span className="text-[11px] font-mono tabular-nums text-ink-400">
                          {remaining}d left
                        </span>
                      </div>
                      <div className="w-full h-2 bg-surface-200 rounded-full overflow-hidden">
                        <div className="h-full rounded-full flex">
                          {/* Used (solid) */}
                          <div
                            className="h-full bg-accent-500"
                            style={{ width: `${Math.round((ent.used_days / (ent.total_days + ent.carried_over)) * 100)}%` }}
                          />
                          {/* Pending (striped/lighter) */}
                          <div
                            className="h-full bg-accent-200"
                            style={{ width: `${Math.round((ent.pending_days / (ent.total_days + ent.carried_over)) * 100)}%` }}
                          />
                        </div>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-[10px] text-ink-300">
                        <span>{ent.used_days}d used</span>
                        <span>{ent.pending_days}d pending</span>
                        {ent.carried_over > 0 && <span>+{ent.carried_over}d carried</span>}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Upcoming Bank Holidays */}
            <div className="card-premium p-5">
              <h3 className="text-[11px] font-semibold text-ink-400 uppercase tracking-[0.1em] mb-4">Bank Holidays</h3>
              {upcomingBankHols.length === 0 ? (
                <p className="text-[12px] text-ink-300 italic">No bank holidays in the next 90 days.</p>
              ) : (
                <div className="space-y-2.5">
                  {upcomingBankHols.map(hol => (
                    <div key={hol.date} className="flex items-center justify-between">
                      <div>
                        <p className="text-[12px] font-medium text-ink-700">{hol.name}</p>
                        <p className="text-[10px] text-ink-300 font-mono tabular-nums mt-0.5">{formatDate(hol.date)}</p>
                      </div>
                      <span className="w-2 h-2 rounded-full bg-emerald-400" />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Absence Types Legend */}
            <div className="card-premium p-5">
              <h3 className="text-[11px] font-semibold text-ink-400 uppercase tracking-[0.1em] mb-4">Absence Types</h3>
              <div className="space-y-2">
                {(['holiday', 'sick', 'cpd', 'parental', 'compassionate', 'unpaid'] as const).map(type => (
                  <div key={type} className="flex items-center gap-2">
                    <span className={cn('status-pill text-[10px]', leaveTypeColor(type))}>{leaveTypeLabel(type)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ━━━ UTILISATION HEATMAP ━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section className="pb-8">
        <h2 className="text-[15px] font-semibold text-ink-900 mb-4">Team Utilisation</h2>
        <div className="card-premium p-6 space-y-5">
          {sortedByUtilisation.map(member => (
            <div key={member.userId} className="flex items-center gap-4">
              <div className="w-36 flex-shrink-0">
                <p className="text-[13px] font-medium text-ink-900">{member.name}</p>
                <p className="text-[11px] text-ink-400 mt-0.5">{member.role}</p>
              </div>

              <div className="flex-1 h-7 bg-surface-200/60 rounded-lg overflow-hidden">
                <div
                  className={cn(
                    'h-full rounded-lg transition-all',
                    utilisationColor(member.status)
                  )}
                  style={{
                    width: `${Math.min(member.utilisationPercent, 100)}%`,
                  }}
                />
              </div>

              <div className="w-14 text-right flex-shrink-0">
                <p className={cn(
                  'text-[13px] font-semibold tabular-nums font-mono',
                  member.status === 'over' ? 'text-red-600' :
                  member.status === 'optimal' ? 'text-emerald-600' :
                  'text-blue-600'
                )}>
                  {member.utilisationPercent}%
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ━━━ CAPACITY OVERVIEW TABLE ━━━━━━━━━━━━━━━━━━━━━ */}
      <section className="pb-8">
        <h2 className="text-[15px] font-semibold text-ink-900 mb-4">Capacity Overview</h2>
        <div className="card-premium overflow-hidden">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-surface-200">
                <th className="px-5 py-3 text-left text-[10px] text-ink-400 uppercase tracking-[0.1em] font-semibold">Name</th>
                <th className="px-4 py-3 text-left text-[10px] text-ink-400 uppercase tracking-[0.1em] font-semibold">Role</th>
                <th className="px-4 py-3 text-center text-[10px] text-ink-400 uppercase tracking-[0.1em] font-semibold">Weekly Cap</th>
                <th className="px-4 py-3 text-center text-[10px] text-ink-400 uppercase tracking-[0.1em] font-semibold">Allocated</th>
                <th className="px-4 py-3 text-center text-[10px] text-ink-400 uppercase tracking-[0.1em] font-semibold">Available</th>
                <th className="px-4 py-3 text-center text-[10px] text-ink-400 uppercase tracking-[0.1em] font-semibold">Leave (Next 60d)</th>
                <th className="px-4 py-3 text-center text-[10px] text-ink-400 uppercase tracking-[0.1em] font-semibold">Utilisation</th>
                <th className="px-5 py-3 text-center text-[10px] text-ink-400 uppercase tracking-[0.1em] font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {staffMetrics.map(member => {
                const available = member.capacity.weekly_capacity_hours - member.totalAllocated
                const userUpcoming = getUpcomingLeave(60).filter(l => l.user_id === member.userId)
                const upcomingDays = userUpcoming.reduce((sum, l) => sum + l.days, 0)

                return (
                  <tr
                    key={member.userId}
                    className={cn(
                      'border-b border-surface-100 stripe-row',
                      member.status === 'over' && 'bg-red-50/30'
                    )}
                  >
                    <td className="px-5 py-3.5 font-medium text-ink-900">{member.name}</td>
                    <td className="px-4 py-3.5 text-ink-500">{member.role}</td>
                    <td className="px-4 py-3.5 text-center tabular-nums font-mono">{member.capacity.weekly_capacity_hours}h</td>
                    <td className="px-4 py-3.5 text-center tabular-nums font-mono font-medium">{member.totalAllocated}h</td>
                    <td className={cn(
                      'px-4 py-3.5 text-center tabular-nums font-mono font-medium',
                      available < 0 ? 'text-red-600' : 'text-emerald-600'
                    )}>
                      {available}h
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      {upcomingDays > 0 ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 text-[11px] font-semibold">
                          {upcomingDays}d
                        </span>
                      ) : (
                        <span className="text-ink-200">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-center tabular-nums font-mono">{member.utilisationPercent}%</td>
                    <td className="px-5 py-3.5 text-center">
                      <span className={cn(
                        'status-pill',
                        member.status === 'under' && 'bg-blue-50 text-blue-600',
                        member.status === 'optimal' && 'bg-emerald-50 text-emerald-600',
                        member.status === 'over' && 'bg-red-50 text-red-600'
                      )}>
                        {member.status === 'under' && 'Under'}
                        {member.status === 'optimal' && 'Optimal'}
                        {member.status === 'over' && 'Over'}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* ━━━ PROJECT ALLOCATIONS ━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section className="pb-8">
        <h2 className="text-[15px] font-semibold text-ink-900 mb-4">Project Allocations</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {projectAllocations.map(project => (
            <div key={project.projectId} className="card-premium p-5">
              <div className="mb-4">
                <p className="text-[13px] font-medium text-ink-900">{project.name}</p>
                <p className="text-[11px] text-ink-400 mt-0.5">{project.client}</p>
              </div>

              <div className="space-y-3 mb-4 pb-4 border-b border-surface-100">
                {project.allocations.map((alloc, i) => (
                  <div key={`${project.projectId}-${alloc.userId}-${i}`} className="text-[12px]">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium text-ink-900">{alloc.userName}</p>
                        <p className="text-ink-400 mt-0.5">{alloc.roleOnProject}</p>
                      </div>
                      <span className="text-ink-600 font-medium tabular-nums font-mono">{alloc.hoursPerWeek}h/w</span>
                    </div>
                    <p className="text-[10px] text-ink-300 mt-1.5 font-mono tabular-nums">
                      {formatDate(alloc.periodStart)} – {formatDate(alloc.periodEnd)}
                    </p>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between">
                <p className="text-[11px] text-ink-400 font-semibold uppercase tracking-[0.08em]">Total</p>
                <p className="text-[13px] font-semibold text-ink-900 tabular-nums font-mono">{project.totalHours}h/w</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ━━━ CAPACITY WARNINGS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {overAllocatedMembers.length > 0 && (
        <section className="pb-10">
          <h2 className="text-[15px] font-semibold text-ink-900 mb-4">Capacity Warnings</h2>
          <div className="space-y-3">
            {overAllocatedMembers.map(member => {
              const lowestPriorityProject = member.allocations.length > 0
                ? [...member.allocations].sort((a, b) => a.hours_per_week - b.hours_per_week)[0]
                : null
              const lowestProjectName = lowestPriorityProject ? getProject(lowestPriorityProject.project_id)?.name : 'a project'
              const suggestionHours = Math.round(member.excessHours || 0)

              return (
                <div
                  key={member.userId}
                  className="bg-red-50 border border-red-200 rounded-xl p-4"
                >
                  <p className="text-[13px] font-medium text-ink-900 mb-2">{member.name}</p>
                  <div className="grid grid-cols-3 gap-4 mb-3 text-[12px]">
                    <div>
                      <p className="text-ink-400 text-[10px] uppercase tracking-[0.08em] font-semibold">Current</p>
                      <p className="text-ink-900 font-medium mt-1 font-mono tabular-nums">{member.totalAllocated}h/w</p>
                    </div>
                    <div>
                      <p className="text-ink-400 text-[10px] uppercase tracking-[0.08em] font-semibold">Capacity</p>
                      <p className="text-ink-900 font-medium mt-1 font-mono tabular-nums">{member.capacity.weekly_capacity_hours}h/w</p>
                    </div>
                    <div>
                      <p className="text-ink-400 text-[10px] uppercase tracking-[0.08em] font-semibold">Excess</p>
                      <p className="text-red-600 font-medium mt-1 font-mono tabular-nums">{suggestionHours}h/w</p>
                    </div>
                  </div>
                  <p className="text-[12px] text-red-700">
                    Consider reassigning {suggestionHours}h from <span className="font-medium">{lowestProjectName}</span>.
                  </p>
                </div>
              )
            })}
          </div>
        </section>
      )}
    </div>
  )
}

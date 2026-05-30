'use client'

import { useParams } from 'next/navigation'
import { useState } from 'react'
import { getProject, getProjectBuildingRegs, getProjectInspections, getUser, USERS } from '@/lib/mock-data'
import { BuildingRegRecord, BuildingInspection } from '@/lib/types'
import { cn, formatDate, isOverdue, buildingRegStatusColor, inspectionStatusColor } from '@/lib/utils'

import { SummaryCard } from '@/components/SummaryCard'
import { StatusBadge } from '@/components/StatusBadge'
import { EmptyState } from '@/components/EmptyState'
import { TabBar } from '@/components/TabBar'

export default function BuildingRegsPage() {
  const params = useParams()
  const project = getProject(params.id as string)

  if (!project) return <EmptyState message="Project not found." />

  const buildingRegs = getProjectBuildingRegs(project.id)
  const inspections = getProjectInspections(project.id)

  const [activeTab, setActiveTab] = useState('all')

  const filteredRegs = buildingRegs.filter(reg => {
    if (activeTab === 'all') return true
    if (activeTab === 'submitted') return ['submitted', 'in_progress', 'approved', 'rejected', 'conditional'].includes(reg.status)
    if (activeTab === 'approved') return reg.status === 'approved'
    if (activeTab === 'conditional') return reg.status === 'conditional'
    return true
  })

  const totalApplications = buildingRegs.length
  const approvedCount = buildingRegs.filter(r => r.status === 'approved').length
  const pendingCount = buildingRegs.filter(r => ['submitted', 'in_progress', 'conditional'].includes(r.status)).length
  const upcomingInspections = inspections.filter(i => i.status === 'scheduled').length

  const inspectionsByReg = buildingRegs.reduce((acc, reg) => {
    acc[reg.id] = inspections.filter(i => i.building_reg_id === reg.id)
    return acc
  }, {} as Record<string, BuildingInspection[]>)

  const completedInspections = inspections.filter(i => i.completed_date).sort(
    (a, b) => new Date(b.completed_date!).getTime() - new Date(a.completed_date!).getTime()
  )

  return (
    <div className="space-y-6 sm:space-y-8 animate-fade-in">
      <div>
        <h1 className="text-xl sm:text-2xl font-display font-bold text-ink-900">Building Regulations</h1>
        <p className="text-sm text-ink-400 mt-1">{project.name} — {project.client}</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <SummaryCard value={totalApplications} label="Total Applications" />
        <SummaryCard value={approvedCount} label="Approved" textColor="text-emerald-600" />
        <SummaryCard value={pendingCount} label="Pending/In Progress" textColor="text-amber-600" />
        <SummaryCard value={upcomingInspections} label="Inspections Due" textColor="text-blue-600" />
      </div>

      {/* Tab Filter */}
      <TabBar
        tabs={[
          { key: 'all', label: 'All', count: buildingRegs.length },
          { key: 'submitted', label: 'Submitted', count: buildingRegs.filter(r => ['submitted', 'in_progress', 'approved', 'rejected', 'conditional'].includes(r.status)).length },
          { key: 'approved', label: 'Approved', count: approvedCount },
          { key: 'conditional', label: 'Conditional', count: buildingRegs.filter(r => r.status === 'conditional').length },
        ]}
        activeKey={activeTab}
        onSelect={setActiveTab}
      />

      {/* Building Regulations Records */}
      <div className="card-premium">
        <div className="p-5 border-b border-surface-200/60">
          <h2 className="text-[15px] font-semibold text-ink-900">Applications</h2>
        </div>

        {filteredRegs.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-sm text-ink-400">No applications in this filter.</p>
          </div>
        ) : (
          <div className="divide-y divide-surface-200/60">
            {filteredRegs.map(reg => (
              <div key={reg.id} className="p-5">
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <StatusBadge label={reg.status} colorClass={buildingRegStatusColor(reg.status)} />
                        <span className="text-[10px] font-bold text-ink-300">{reg.reference}</span>
                        <span className="text-[10px] font-medium text-ink-400">{reg.submission_route.replace(/_/g, ' ')}</span>
                      </div>
                      <h3 className="text-sm font-semibold text-ink-900">{reg.title}</h3>
                      <p className="text-xs text-ink-500 mt-1">{reg.description}</p>
                    </div>
                  </div>

                  {/* Key Details */}
                  <div className="flex flex-wrap gap-4 text-xs text-ink-400 pt-2">
                    {reg.inspector_name && (
                      <span>Inspector: <span className="font-medium text-ink-600">{reg.inspector_name}</span></span>
                    )}
                    {reg.submitted_date && (
                      <span>Submitted: <span className="font-medium text-ink-600">{formatDate(reg.submitted_date)}</span></span>
                    )}
                    {reg.decision_date && (
                      <span>Decision: <span className="font-medium text-ink-600">{formatDate(reg.decision_date)}</span></span>
                    )}
                  </div>

                  {/* Conditions (if conditional) */}
                  {reg.status === 'conditional' && reg.conditions && (
                    <div className="mt-3 p-3 bg-surface-50 rounded-lg border border-surface-200/50">
                      <p className="text-[11px] font-semibold text-ink-400 uppercase tracking-[0.08em] mb-1">Conditions</p>
                      <p className="text-xs text-ink-600">{reg.conditions}</p>
                    </div>
                  )}

                  {/* Inspector Notes (if present) */}
                  {reg.inspection_notes && (
                    <div className="mt-3 p-3 bg-surface-50 rounded-lg border border-surface-200/50">
                      <p className="text-[11px] font-semibold text-ink-400 uppercase tracking-[0.08em] mb-1">Notes</p>
                      <p className="text-xs text-ink-600">{reg.inspection_notes}</p>
                    </div>
                  )}

                  {/* Inspections for this reg */}
                  {inspectionsByReg[reg.id]?.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-surface-200/40">
                      <p className="text-[11px] font-semibold text-ink-400 uppercase tracking-[0.08em] mb-2">Related Inspections</p>
                      <div className="space-y-2">
                        {inspectionsByReg[reg.id].map(insp => (
                          <div key={insp.id} className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-2">
                              <span className="text-ink-600 font-medium">{insp.inspection_type}</span>
                              <StatusBadge label={insp.status} colorClass={inspectionStatusColor(insp.status)} />
                            </div>
                            <span className="text-ink-400">
                              {insp.completed_date ? formatDate(insp.completed_date) : formatDate(insp.scheduled_date)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Inspections Section */}
      {inspections.length > 0 && (
        <div className="border-t border-surface-200/60 pt-10 mt-10">
          <h2 className="text-sm font-semibold text-ink-900 mb-5 font-display">Inspection Schedule</h2>

          {/* Upcoming Inspections */}
          {inspections.filter(i => i.status === 'scheduled').length > 0 && (
            <div className="mb-8">
              <h3 className="text-[11px] font-semibold text-ink-400 uppercase tracking-[0.08em] mb-3">Upcoming</h3>
              <div className="card-premium overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="border-b border-surface-200/60 bg-surface-50">
                    <tr>
                      <th className="px-5 py-3 text-left text-[11px] font-semibold text-ink-400 uppercase tracking-[0.08em]">Type</th>
                      <th className="px-5 py-3 text-left text-[11px] font-semibold text-ink-400 uppercase tracking-[0.08em]">Scheduled Date</th>
                      <th className="px-5 py-3 text-left text-[11px] font-semibold text-ink-400 uppercase tracking-[0.08em]">Status</th>
                      <th className="px-5 py-3 text-left text-[11px] font-semibold text-ink-400 uppercase tracking-[0.08em]">Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-200/60">
                    {inspections.filter(i => i.status === 'scheduled').map(insp => (
                      <tr key={insp.id} className="stripe-row hover:bg-surface-50 transition-colors">
                        <td className="px-5 py-4 text-xs font-medium text-ink-900">{insp.inspection_type}</td>
                        <td className="px-5 py-4 text-xs text-ink-600">{formatDate(insp.scheduled_date)}</td>
                        <td className="px-5 py-4">
                          <StatusBadge label={insp.status} colorClass={inspectionStatusColor(insp.status)} />
                        </td>
                        <td className="px-5 py-4 text-xs text-ink-500 max-w-xs truncate">
                          {insp.inspector_notes ? insp.inspector_notes : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Completed Inspections */}
          {completedInspections.length > 0 && (
            <div>
              <h3 className="text-[11px] font-semibold text-ink-400 uppercase tracking-[0.08em] mb-3">Completed</h3>
              <div className="card-premium overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="border-b border-surface-200/60 bg-surface-50">
                    <tr>
                      <th className="px-5 py-3 text-left text-[11px] font-semibold text-ink-400 uppercase tracking-[0.08em]">Type</th>
                      <th className="px-5 py-3 text-left text-[11px] font-semibold text-ink-400 uppercase tracking-[0.08em]">Completed Date</th>
                      <th className="px-5 py-3 text-left text-[11px] font-semibold text-ink-400 uppercase tracking-[0.08em]">Status</th>
                      <th className="px-5 py-3 text-left text-[11px] font-semibold text-ink-400 uppercase tracking-[0.08em]">Follow-up</th>
                      <th className="px-5 py-3 text-left text-[11px] font-semibold text-ink-400 uppercase tracking-[0.08em]">Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-200/60">
                    {completedInspections.map(insp => (
                      <tr key={insp.id} className="stripe-row hover:bg-surface-50 transition-colors">
                        <td className="px-5 py-4 text-xs font-medium text-ink-900">{insp.inspection_type}</td>
                        <td className="px-5 py-4 text-xs text-ink-600">{formatDate(insp.completed_date!)}</td>
                        <td className="px-5 py-4">
                          <StatusBadge label={insp.status} colorClass={inspectionStatusColor(insp.status)} />
                        </td>
                        <td className="px-5 py-4">
                          {insp.follow_up_required ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold bg-amber-100 text-amber-700">
                              Required
                            </span>
                          ) : (
                            <span className="text-xs text-ink-400">—</span>
                          )}
                        </td>
                        <td className="px-5 py-4 text-xs text-ink-500 max-w-xs truncate">
                          {insp.inspector_notes ? insp.inspector_notes : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {inspections.length === 0 && (
            <div className="text-center py-8">
              <p className="text-sm text-ink-400">No inspections scheduled.</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

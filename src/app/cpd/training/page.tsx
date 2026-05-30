'use client'

import { useState } from 'react'
import { getAllTrainingPlans, USERS, getUser } from '@/lib/mock-data'
import { TrainingPlan } from '@/lib/types'
import { cn, formatDate, trainingPlanStatusColor, isOverdue } from '@/lib/utils'
import { Breadcrumb } from '@/components/Breadcrumb'
import { SummaryCard } from '@/components/SummaryCard'
import { StatusBadge } from '@/components/StatusBadge'
import { TabBar } from '@/components/TabBar'
import { EmptyState } from '@/components/EmptyState'

export default function TrainingPlans() {
  const allPlans = getAllTrainingPlans()
  const [statusFilter, setStatusFilter] = useState('all')

  // Count by status
  const totalPlans = allPlans.length
  const inProgressCount = allPlans.filter(p => p.status === 'in_progress').length
  const completedCount = allPlans.filter(p => p.status === 'completed').length
  const overdueCount = allPlans.filter(p => p.status === 'overdue').length

  // Filter plans by status
  let filteredPlans = allPlans
  if (statusFilter !== 'all') {
    filteredPlans = allPlans.filter(p => p.status === statusFilter)
  }

  // Get status label
  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'not_started': return 'Not Started'
      case 'in_progress': return 'In Progress'
      case 'completed': return 'Completed'
      case 'overdue': return 'Overdue'
      default: return status
    }
  }

  const tabs = [
    { key: 'all', label: 'All', count: totalPlans },
    { key: 'in_progress', label: 'In Progress', count: inProgressCount },
    { key: 'overdue', label: 'Overdue', count: overdueCount },
    { key: 'completed', label: 'Completed', count: completedCount },
  ]

  return (
    <div className="max-w-6xl animate-fade-in">
      {/* Breadcrumb */}
      <section className="pb-8">
        <Breadcrumb items={[
          { label: 'Dashboard', href: '/' },
          { label: 'CPD & Training', href: '/cpd' },
          { label: 'Training Plans' },
        ]} />
      </section>

      {/* Hero */}
      <section className="pb-16">
        <h1 className="font-display text-[2rem] leading-tight text-ink-900">
          Training Plans
        </h1>
      </section>

      {/* Summary Cards */}
      <section className="pb-16">
        <div className="border-t border-surface-200 pt-10">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-12">
            <SummaryCard label="Total Plans" value={totalPlans} bgColor="bg-white" />
            <SummaryCard label="In Progress" value={inProgressCount} bgColor="bg-white" />
            <SummaryCard label="Overdue" value={overdueCount} bgColor="bg-white" />
            <SummaryCard label="Completed" value={completedCount} bgColor="bg-white" />
          </div>
        </div>
      </section>

      {/* Filter Tabs */}
      <section className="pb-8">
        <TabBar
          tabs={tabs}
          activeKey={statusFilter}
          onSelect={setStatusFilter}
        />
      </section>

      {/* Training Plans Table */}
      <section className="pb-16">
        {filteredPlans.length === 0 ? (
          <EmptyState message="No training plans found." />
        ) : (
          <div className="card-premium overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-surface-200/60">
                  <th className="px-6 py-4 text-left text-[11px] text-ink-300 uppercase tracking-[0.08em] font-semibold">User</th>
                  <th className="px-6 py-4 text-left text-[11px] text-ink-300 uppercase tracking-[0.08em] font-semibold">Plan Title</th>
                  <th className="px-6 py-4 text-left text-[11px] text-ink-300 uppercase tracking-[0.08em] font-semibold">Objective</th>
                  <th className="px-6 py-4 text-left text-[11px] text-ink-300 uppercase tracking-[0.08em] font-semibold">Due Date</th>
                  <th className="px-6 py-4 text-left text-[11px] text-ink-300 uppercase tracking-[0.08em] font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredPlans.map(plan => {
                  const user = getUser(plan.user_id)
                  const isOverdueStatus = plan.status === 'overdue' || (plan.status !== 'completed' && isOverdue(plan.due_date))

                  return (
                    <tr
                      key={plan.id}
                      className={cn(
                        'stripe-row border-b border-surface-200/60 hover:bg-surface-50 transition-colors',
                        isOverdueStatus && 'bg-red-50'
                      )}
                    >
                      <td className="px-6 py-4">
                        <div>
                          <p className="text-[12px] font-semibold text-ink-900">{user?.name || 'Unknown'}</p>
                          <p className="text-[10px] text-ink-400">{user?.role}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-[12px] font-semibold text-ink-900">{plan.title}</p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-[12px] text-ink-600 max-w-xs">{plan.objective}</p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-[12px] text-ink-600">{formatDate(plan.due_date)}</p>
                      </td>
                      <td className="px-6 py-4">
                        <StatusBadge
                          label={getStatusLabel(plan.status)}
                          colorClass={trainingPlanStatusColor(plan.status as any)}
                        />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Manager Notes Section */}
      {filteredPlans.some(p => p.manager_notes) && (
        <section className="pb-16">
          <div className="border-t border-surface-200 pt-10">
            <h2 className="font-display text-[1.5rem] text-ink-900 mb-8">Manager Notes</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {filteredPlans.filter(p => p.manager_notes).map(plan => {
                const user = getUser(plan.user_id)

                return (
                  <div
                    key={plan.id}
                    className="card-premium p-5"
                  >
                    <div className="mb-4">
                      <p className="text-[12px] font-semibold text-ink-900">{plan.title}</p>
                      <p className="text-[11px] text-ink-400 mt-1">{user?.name}</p>
                    </div>
                    <div className="bg-surface-50 rounded-lg p-4 border border-surface-200/60">
                      <p className="text-[12px] text-ink-700 leading-relaxed">{plan.manager_notes}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </section>
      )}
    </div>
  )
}

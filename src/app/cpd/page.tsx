'use client'

import { useState } from 'react'
import Link from 'next/link'
import { getAllCPDRecords, USERS, getUserCPDRecords } from '@/lib/mock-data'
import { CPDRecord } from '@/lib/types'
import { cn, formatDate, proficiencyColor, isOverdue } from '@/lib/utils'
import { Breadcrumb } from '@/components/Breadcrumb'
import { SummaryCard } from '@/components/SummaryCard'
import { StatusBadge } from '@/components/StatusBadge'
import { TabBar } from '@/components/TabBar'

export default function CPDDashboard() {
  const allCPDRecords = getAllCPDRecords()
  const u1Records = getUserCPDRecords('u1')

  // Summary metrics
  const totalHours = allCPDRecords.reduce((sum, r) => sum + r.hours, 0)
  const mandatoryComplete = allCPDRecords.filter(r => r.mandatory_flag).length
  const teamMembers = Array.from(new Set(allCPDRecords.map(r => r.user_id))).length

  // Filter state
  const [myCPDTab, setMyCPDTab] = useState('all')
  const [teamTab, setTeamTab] = useState('all')

  // Filter "My CPD" records
  let filteredMyCPD = u1Records
  if (myCPDTab === 'mandatory') {
    filteredMyCPD = filteredMyCPD.filter(r => r.mandatory_flag)
  } else if (myCPDTab !== 'all') {
    filteredMyCPD = filteredMyCPD.filter(r => r.cpd_topic === myCPDTab)
  }

  // Get unique topics
  const topics = Array.from(new Set(allCPDRecords.map(r => r.cpd_topic)))

  // Team overview data
  const teamOverview = USERS.map(user => {
    const userRecords = getUserCPDRecords(user.id)
    return {
      user,
      totalHours: userRecords.reduce((sum, r) => sum + r.hours, 0),
      mandatoryCount: userRecords.filter(r => r.mandatory_flag).length,
      latestDate: userRecords.length > 0
        ? userRecords.sort((a, b) => new Date(b.completion_date).getTime() - new Date(a.completion_date).getTime())[0]?.completion_date
        : undefined,
    }
  }).filter(t => t.totalHours > 0 || t.mandatoryCount > 0)

  const myCPDTabs = [
    { key: 'all', label: 'All', count: u1Records.length },
    { key: 'mandatory', label: 'Mandatory', count: u1Records.filter(r => r.mandatory_flag).length },
    ...topics.map(topic => ({ key: topic, label: topic, count: u1Records.filter(r => r.cpd_topic === topic).length })),
  ]

  return (
    <div className="max-w-6xl animate-fade-in">
      {/* Breadcrumb */}
      <section className="pb-8">
        <Breadcrumb items={[
          { label: 'Dashboard', href: '/' },
          { label: 'CPD & Training' },
        ]} />
      </section>

      {/* Hero */}
      <section className="pb-16">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-6">
          <h1 className="font-display text-[2rem] leading-tight text-ink-900">
            CPD & Training
          </h1>
          <div className="flex gap-2">
            <Link
              href="/cpd/competence"
              className="text-[11px] text-ink-400 hover:text-accent-600 transition-colors uppercase tracking-[0.1em] font-medium"
            >
              Competence Matrix →
            </Link>
            <Link
              href="/cpd/training"
              className="text-[11px] text-ink-400 hover:text-accent-600 transition-colors uppercase tracking-[0.1em] font-medium ml-4"
            >
              Training Plans →
            </Link>
          </div>
        </div>
      </section>

      {/* Summary Cards */}
      <section className="pb-16">
        <div className="border-t border-surface-200 pt-10">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-12">
            <SummaryCard label="Total CPD Hours" value={totalHours} bgColor="bg-white" />
            <SummaryCard label="Mandatory Topics" value={mandatoryComplete} bgColor="bg-white" />
            <SummaryCard label="Team Members" value={teamMembers} bgColor="bg-white" />
            <SummaryCard label="Overdue Plans" value={0} bgColor="bg-white" />
          </div>
        </div>
      </section>

      {/* My CPD Section */}
      <section className="pb-16">
        <div className="border-t border-surface-200 pt-10">
          <h2 className="font-display text-[1.5rem] text-ink-900 mb-8">My CPD</h2>

          <div className="mb-6">
            <TabBar
              tabs={myCPDTabs.slice(0, 4)}
              activeKey={myCPDTab}
              onSelect={setMyCPDTab}
            />
          </div>

          {filteredMyCPD.length === 0 ? (
            <div className="card-premium p-10 text-center">
              <p className="text-[13px] text-ink-300">No CPD records found.</p>
            </div>
          ) : (
            <div className="card-premium overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-surface-200/60">
                    <th className="px-6 py-4 text-left text-[11px] text-ink-300 uppercase tracking-[0.08em] font-semibold">Title</th>
                    <th className="px-6 py-4 text-left text-[11px] text-ink-300 uppercase tracking-[0.08em] font-semibold">Provider</th>
                    <th className="px-6 py-4 text-left text-[11px] text-ink-300 uppercase tracking-[0.08em] font-semibold">Topic</th>
                    <th className="px-6 py-4 text-left text-[11px] text-ink-300 uppercase tracking-[0.08em] font-semibold">Hours</th>
                    <th className="px-6 py-4 text-left text-[11px] text-ink-300 uppercase tracking-[0.08em] font-semibold">Date</th>
                    <th className="px-6 py-4 text-left text-[11px] text-ink-300 uppercase tracking-[0.08em] font-semibold">Type</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMyCPD.map(record => (
                    <tr key={record.id} className="stripe-row border-b border-surface-200/60 hover:bg-surface-50 transition-colors">
                      <td className="px-6 py-4 text-[12px] text-ink-900 font-medium">{record.title}</td>
                      <td className="px-6 py-4 text-[12px] text-ink-600">{record.provider}</td>
                      <td className="px-6 py-4 text-[12px] text-ink-600">{record.cpd_topic}</td>
                      <td className="px-6 py-4 text-[12px] text-ink-900 font-semibold">{record.hours}h</td>
                      <td className="px-6 py-4 text-[12px] text-ink-500">{formatDate(record.completion_date)}</td>
                      <td className="px-6 py-4">
                        {record.mandatory_flag && (
                          <StatusBadge label="Mandatory" colorClass="bg-red-100 text-red-700" />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {/* Team Overview Section */}
      <section className="pb-16">
        <div className="border-t border-surface-200 pt-10">
          <h2 className="font-display text-[1.5rem] text-ink-900 mb-8">Team Overview</h2>

          {teamOverview.length === 0 ? (
            <div className="card-premium p-10 text-center">
              <p className="text-[13px] text-ink-300">No team CPD data available.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {teamOverview.map(item => (
                <div
                  key={item.user.id}
                  className="card-premium p-5"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-[13px] font-semibold text-ink-900">{item.user.name}</h3>
                      <p className="text-[11px] text-ink-400">{item.user.role}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3 pt-4 border-t border-surface-200/60">
                    <div>
                      <p className="text-[11px] text-ink-400 uppercase tracking-[0.08em] font-semibold">Hours</p>
                      <p className="text-[18px] font-light tracking-tight text-ink-900 mt-1">{item.totalHours}</p>
                    </div>
                    <div>
                      <p className="text-[11px] text-ink-400 uppercase tracking-[0.08em] font-semibold">Mandatory</p>
                      <p className="text-[18px] font-light tracking-tight text-ink-900 mt-1">{item.mandatoryCount}</p>
                    </div>
                    <div>
                      <p className="text-[11px] text-ink-400 uppercase tracking-[0.08em] font-semibold">Latest</p>
                      <p className="text-[11px] text-ink-600 mt-1">{item.latestDate ? formatDate(item.latestDate) : '—'}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  )
}

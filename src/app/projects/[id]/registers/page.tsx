'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import { PROJECTS, getProjectIssues, getProjectChanges, getProjectRisks, getUser } from '@/lib/mock-data'
import { cn, issueStatusColor, changeStatusColor, riskRegisterStatusColor, riskScoreColor, formatDate } from '@/lib/utils'

import { SummaryCard } from '@/components/SummaryCard'
import { TabBar } from '@/components/TabBar'
import { StatusBadge } from '@/components/StatusBadge'
import { EmptyState } from '@/components/EmptyState'

type RegisterTab = 'issues' | 'changes' | 'risks'

export default function ProjectRegistersPage() {
  const params = useParams()
  const project = PROJECTS.find(p => p.id === params.id)
  const [activeTab, setActiveTab] = useState<RegisterTab>('issues')

  if (!project) return <EmptyState message="Project not found." />

  const issues = getProjectIssues(project.id)
  const changes = getProjectChanges(project.id)
  const risks = getProjectRisks(project.id)

  const tabs: { key: RegisterTab; label: string; count: number }[] = [
    { key: 'issues', label: 'Issues', count: issues.length },
    { key: 'changes', label: 'Changes', count: changes.length },
    { key: 'risks', label: 'Risk Register', count: risks.length },
  ]

  const openIssues = issues.filter(i => i.status === 'open' || i.status === 'in_progress').length
  const openChanges = changes.filter(c => c.approval_status === 'raised' || c.approval_status === 'under_review').length
  const openRisks = risks.filter(r => r.status === 'open').length

  return (
    <div className="space-y-6 sm:space-y-8 animate-fade-in">
      <div>
        <h1 className="text-[2rem] sm:text-[2.5rem] font-display font-bold text-ink-900">Issues, Changes & Risks</h1>
        <p className="text-sm text-slate-500 mt-1">{project.name} — {project.client}</p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <SummaryCard value={openIssues} label="Open Issues" />
        <SummaryCard value={openChanges} label="Open Changes" />
        <SummaryCard value={openRisks} label="Open Risks" />
      </div>

      <TabBar tabs={tabs} activeKey={activeTab} onSelect={(key) => setActiveTab(key as RegisterTab)} />

      {activeTab === 'issues' && (
        <div className="space-y-3">
          {issues.length === 0 ? (
            <EmptyState message="No issues recorded." />
          ) : (
            issues.map(issue => {
              const owner = getUser(issue.owner_user_id)
              return (
                <div key={issue.id} className="card-premium p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1.5">
                        <StatusBadge label={issue.status.replace('_', ' ')} colorClass={issueStatusColor(issue.status)} />
                        <span className="text-[10px] font-medium text-slate-400 uppercase">{issue.issue_type}</span>
                      </div>
                      <h3 className="text-sm font-semibold text-slate-900">{issue.title}</h3>
                      <p className="text-xs text-slate-500 mt-1">{issue.description}</p>
                      <div className="flex items-center gap-4 mt-2 text-xs text-slate-400">
                        {owner && <span>Owner: <span className="text-slate-600">{owner.name}</span></span>}
                        <span>Raised: {formatDate(issue.raised_date)}</span>
                        {issue.resolved_date && <span>Resolved: {formatDate(issue.resolved_date)}</span>}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}

      {activeTab === 'changes' && (
        <div className="space-y-3">
          {changes.length === 0 ? (
            <EmptyState message="No changes recorded." />
          ) : (
            changes.map(change => {
              const initiator = getUser(change.initiated_by_user_id)
              return (
                <div key={change.id} className="card-premium p-5">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <StatusBadge label={change.approval_status.replace('_', ' ')} colorClass={changeStatusColor(change.approval_status)} />
                      <span className="text-[10px] font-medium text-slate-400 uppercase">{change.change_type}</span>
                    </div>
                    <h3 className="text-sm font-semibold text-slate-900">{change.title}</h3>
                    <p className="text-xs text-slate-500 mt-1">{change.description}</p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3">
                      {change.commercial_effect_note && (
                        <div className="p-2.5 bg-slate-50 rounded-lg">
                          <p className="text-[10px] font-bold text-slate-400 uppercase mb-0.5">Commercial Effect</p>
                          <p className="text-xs text-slate-700">{change.commercial_effect_note}</p>
                        </div>
                      )}
                      {change.programme_effect_note && (
                        <div className="p-2.5 bg-slate-50 rounded-lg">
                          <p className="text-[10px] font-bold text-slate-400 uppercase mb-0.5">Programme Effect</p>
                          <p className="text-xs text-slate-700">{change.programme_effect_note}</p>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-4 mt-2 text-xs text-slate-400">
                      {initiator && <span>Raised by: <span className="text-slate-600">{initiator.name}</span></span>}
                      <span>{formatDate(change.date_raised)}</span>
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}

      {activeTab === 'risks' && (
        <div className="space-y-3">
          {risks.length === 0 ? (
            <EmptyState message="No risks in register." />
          ) : (
            risks.map(risk => {
              const owner = getUser(risk.owner_user_id)
              return (
                <div key={risk.id} className="card-premium p-5">
                  <div className="flex items-start gap-3">
                    <div className={cn('w-3 h-3 rounded-full mt-1 shrink-0', riskScoreColor(risk.probability, risk.impact))} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1.5">
                        <StatusBadge label={risk.status} colorClass={riskRegisterStatusColor(risk.status)} />
                        <span className="text-[10px] font-medium text-slate-400 uppercase">{risk.risk_type}</span>
                      </div>
                      <h3 className="text-sm font-semibold text-slate-900">{risk.title}</h3>
                      <p className="text-xs text-slate-500 mt-1">{risk.description}</p>

                      <div className="flex items-center gap-3 mt-3">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] text-slate-400">Probability:</span>
                          <span className="text-[10px] font-bold text-slate-600 uppercase">{risk.probability}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] text-slate-400">Impact:</span>
                          <span className="text-[10px] font-bold text-slate-600 uppercase">{risk.impact}</span>
                        </div>
                      </div>

                      <div className="p-2.5 bg-slate-50 rounded-lg mt-2">
                        <p className="text-[10px] font-bold text-slate-400 uppercase mb-0.5">Mitigation</p>
                        <p className="text-xs text-slate-700">{risk.mitigation}</p>
                      </div>

                      <div className="flex items-center gap-4 mt-2 text-xs text-slate-400">
                        {owner && <span>Owner: <span className="text-slate-600">{owner.name}</span></span>}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}

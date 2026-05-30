'use client'

import { useState } from 'react'
import Link from 'next/link'
import { getAllProjectCommercials, PROJECTS, getAllHealthSnapshots, getProjectHealthSnapshots, getAllHealthAlerts, getUnacknowledgedAlerts } from '@/lib/mock-data'
import { cn, commercialHealthColor, commercialHealthDot, formatCurrency, formatPercent, healthScoreColor, healthScoreBg, healthAlertSeverityColor, healthAlertSeverityDot, healthAlertCategoryLabel, formatDate, timeAgo } from '@/lib/utils'
import { Breadcrumb } from '@/components/Breadcrumb'

export default function PortfolioHealth() {
  const commercials = getAllProjectCommercials()
  const allSnapshots = getAllHealthSnapshots()
  const allAlerts = getAllHealthAlerts()
  const unacknowledgedAlerts = getUnacknowledgedAlerts()

  // Health distribution
  const healthyCount = commercials.filter(c => c.health_flag === 'healthy').length
  const watchCount = commercials.filter(c => c.health_flag === 'watch').length
  const atRiskCount = commercials.filter(c => c.health_flag === 'at_risk').length
  const criticalCount = commercials.filter(c => c.health_flag === 'critical').length

  const healthyProjects = commercials.filter(c => c.health_flag === 'healthy').map(c => PROJECTS.find(p => p.id === c.project_id)?.name || 'Unknown')
  const watchProjects = commercials.filter(c => c.health_flag === 'watch').map(c => PROJECTS.find(p => p.id === c.project_id)?.name || 'Unknown')
  const atRiskProjects = commercials.filter(c => c.health_flag === 'at_risk').map(c => PROJECTS.find(p => p.id === c.project_id)?.name || 'Unknown')
  const criticalProjects = commercials.filter(c => c.health_flag === 'critical').map(c => PROJECTS.find(p => p.id === c.project_id)?.name || 'Unknown')

  // Key metrics
  const totalActiveProjects = commercials.length
  const totalAgreedFees = commercials.reduce((sum, c) => sum + c.agreed_fee, 0)
  const avgUtilisation = 78 // Static for now
  const nearLossProjects = commercials.filter(c => c.current_margin_percent < 5).length
  const overspendProjects = commercials.filter(c => c.current_margin_percent < 0).length
  const debtorsValue = commercials.reduce((sum, c) => sum + (c.fee_invoiced - c.fee_paid), 0)

  // Alert summary: group unacknowledged alerts by severity
  const criticalAlerts = unacknowledgedAlerts.filter(a => a.severity === 'critical').length
  const warningAlerts = unacknowledgedAlerts.filter(a => a.severity === 'warning').length
  const infoAlerts = unacknowledgedAlerts.filter(a => a.severity === 'info').length

  // At-risk projects (health_flag = at_risk or critical)
  const atRiskAndCriticalProjects = commercials.filter(c => c.health_flag === 'at_risk' || c.health_flag === 'critical')

  // Helper: get trend direction for a project
  const getTrendDirection = (projectId: string) => {
    const snapshots = getProjectHealthSnapshots(projectId).sort((a, b) => new Date(b.snapshot_date).getTime() - new Date(a.snapshot_date).getTime())
    if (snapshots.length < 2) return '→'
    const current = snapshots[0].health_score
    const previous = snapshots[1].health_score
    if (current > previous) return '↑'
    if (current < previous) return '↓'
    return '→'
  }

  // Helper: get latest snapshot date for a project
  const getLatestSnapshotDate = (projectId: string) => {
    const snapshots = getProjectHealthSnapshots(projectId).sort((a, b) => new Date(b.snapshot_date).getTime() - new Date(a.snapshot_date).getTime())
    return snapshots.length > 0 ? snapshots[0].snapshot_date : null
  }

  // Helper: get mini sparkline data (last 6 snapshots) for a project
  const getSparklineData = (projectId: string) => {
    const snapshots = getProjectHealthSnapshots(projectId).sort((a, b) => new Date(a.snapshot_date).getTime() - new Date(b.snapshot_date).getTime())
    return snapshots.slice(-6).map(s => s.health_score)
  }

  // Helper: get alert count for a project
  const getProjectAlertCount = (projectId: string) => {
    return allAlerts.filter(a => a.project_id === projectId && !a.acknowledged_flag).length
  }

  // Helper: get most critical alert for a project
  const getMostCriticalAlert = (projectId: string) => {
    const projectAlerts = allAlerts.filter(a => a.project_id === projectId && !a.acknowledged_flag)
    const sortOrder = { critical: 0, warning: 1, info: 2 }
    return projectAlerts.sort((a, b) => sortOrder[a.severity as keyof typeof sortOrder] - sortOrder[b.severity as keyof typeof sortOrder])[0]
  }

  return (
    <div className="max-w-7xl animate-fade-in">
      {/* ━━━ BREADCRUMB & HEADER ━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section className="pb-12">
        <Breadcrumb items={[
          { label: 'Dashboard', href: '/' },
          { label: 'Analytics', href: '/analytics' },
          { label: 'Portfolio Health' }
        ]} />
        <div className="mt-4">
          <h1 className="font-display text-[2rem] text-ink-900 mb-2">Portfolio Health</h1>
          <p className="text-[13px] text-ink-400">High-level view of practice performance and project risk</p>
        </div>

        {/* Navigation links */}
        <div className="flex gap-6 text-[12px] mt-6">
          <Link href="/analytics/commercial" className="text-ink-400 hover:text-accent-600 transition-colors">
            ← Commercial Performance
          </Link>
          <Link href="/analytics/cashflow" className="text-ink-400 hover:text-accent-600 transition-colors">
            Cashflow Forecast →
          </Link>
        </div>
      </section>

      {/* ━━━ HEALTH DISTRIBUTION ━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section className="pb-16">
        <div className="border-t border-surface-200/60 pt-10">
          <h2 className="font-display text-[1.5rem] text-ink-900 mb-6">Health Distribution</h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
            {/* Healthy */}
            <div className="card-premium p-5">
              <div className="flex items-baseline gap-2 mb-4">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span className="text-[11px] text-ink-400 uppercase tracking-[0.08em] font-semibold">Healthy</span>
              </div>
              <p className="text-4xl font-light text-emerald-600 mb-4">{healthyCount}</p>
              {healthyProjects.length > 0 && (
                <div className="space-y-1.5 pt-3 border-t border-surface-200">
                  {healthyProjects.slice(0, 3).map((name, i) => (
                    <p key={i} className="text-[11px] text-ink-600 truncate">{name}</p>
                  ))}
                  {healthyProjects.length > 3 && (
                    <p className="text-[10px] text-ink-300 italic">+{healthyProjects.length - 3} more</p>
                  )}
                </div>
              )}
            </div>

            {/* Watch */}
            <div className="card-premium p-5">
              <div className="flex items-baseline gap-2 mb-4">
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                <span className="text-[11px] text-ink-400 uppercase tracking-[0.08em] font-semibold">Watch</span>
              </div>
              <p className="text-4xl font-light text-amber-600 mb-4">{watchCount}</p>
              {watchProjects.length > 0 && (
                <div className="space-y-1.5 pt-3 border-t border-surface-200">
                  {watchProjects.slice(0, 3).map((name, i) => (
                    <p key={i} className="text-[11px] text-ink-600 truncate">{name}</p>
                  ))}
                  {watchProjects.length > 3 && (
                    <p className="text-[10px] text-ink-300 italic">+{watchProjects.length - 3} more</p>
                  )}
                </div>
              )}
            </div>

            {/* At Risk */}
            <div className="card-premium p-5">
              <div className="flex items-baseline gap-2 mb-4">
                <span className="w-2 h-2 rounded-full bg-orange-500" />
                <span className="text-[11px] text-ink-400 uppercase tracking-[0.08em] font-semibold">At Risk</span>
              </div>
              <p className="text-4xl font-light text-orange-600 mb-4">{atRiskCount}</p>
              {atRiskProjects.length > 0 && (
                <div className="space-y-1.5 pt-3 border-t border-surface-200">
                  {atRiskProjects.slice(0, 3).map((name, i) => (
                    <p key={i} className="text-[11px] text-ink-600 truncate">{name}</p>
                  ))}
                  {atRiskProjects.length > 3 && (
                    <p className="text-[10px] text-ink-300 italic">+{atRiskProjects.length - 3} more</p>
                  )}
                </div>
              )}
            </div>

            {/* Critical */}
            <div className="card-premium p-5">
              <div className="flex items-baseline gap-2 mb-4">
                <span className="w-2 h-2 rounded-full bg-red-500" />
                <span className="text-[11px] text-ink-400 uppercase tracking-[0.08em] font-semibold">Critical</span>
              </div>
              <p className="text-4xl font-light text-red-600 mb-4">{criticalCount}</p>
              {criticalProjects.length > 0 && (
                <div className="space-y-1.5 pt-3 border-t border-surface-200">
                  {criticalProjects.slice(0, 3).map((name, i) => (
                    <p key={i} className="text-[11px] text-ink-600 truncate">{name}</p>
                  ))}
                  {criticalProjects.length > 3 && (
                    <p className="text-[10px] text-ink-300 italic">+{criticalProjects.length - 3} more</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ━━━ KEY METRICS GRID ━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section className="pb-16">
        <div className="border-t border-surface-200/60 pt-10">
          <h2 className="font-display text-[1.5rem] text-ink-900 mb-6">Key Metrics</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            <div className="card-premium p-5">
              <p className="text-[11px] text-ink-400 uppercase tracking-[0.08em] font-semibold mb-3">Total Active Projects</p>
              <p className="text-3xl font-light text-ink-900 mb-1">{totalActiveProjects}</p>
              <p className="text-[10px] text-ink-300">Projects in portfolio</p>
            </div>

            <div className="card-premium p-5">
              <p className="text-[11px] text-ink-400 uppercase tracking-[0.08em] font-semibold mb-3">Total Agreed Fee Value</p>
              <p className="text-3xl font-light text-ink-900 mb-1 font-mono">{formatCurrency(totalAgreedFees)}</p>
              <p className="text-[10px] text-ink-300">Across all contracts</p>
            </div>

            <div className="card-premium p-5">
              <p className="text-[11px] text-ink-400 uppercase tracking-[0.08em] font-semibold mb-3">Avg Utilisation</p>
              <p className="text-3xl font-light text-ink-900 mb-1">{formatPercent(avgUtilisation)}</p>
              <p className="text-[10px] text-ink-300">Team capacity</p>
            </div>

            <div className={`rounded-2xl border shadow-card p-5 ${nearLossProjects > 0 ? 'bg-amber-50 border-amber-200' : 'bg-white border-surface-200'}`}>
              <p className="text-[11px] text-ink-400 uppercase tracking-[0.08em] font-semibold mb-3">Near-Loss Projects</p>
              <p className={`text-3xl font-light mb-1 ${nearLossProjects > 0 ? 'text-amber-600' : 'text-ink-900'}`}>{nearLossProjects}</p>
              <p className="text-[10px] text-ink-400">Margin &lt; 5%</p>
            </div>

            <div className={`rounded-2xl border shadow-card p-5 ${overspendProjects > 0 ? 'bg-red-50 border-red-200' : 'bg-white border-surface-200'}`}>
              <p className="text-[11px] text-ink-400 uppercase tracking-[0.08em] font-semibold mb-3">Overspend Projects</p>
              <p className={`text-3xl font-light mb-1 ${overspendProjects > 0 ? 'text-red-600' : 'text-ink-900'}`}>{overspendProjects}</p>
              <p className="text-[10px] text-ink-400">Negative margin</p>
            </div>

            <div className="card-premium p-5">
              <p className="text-[11px] text-ink-400 uppercase tracking-[0.08em] font-semibold mb-3">Debtors Value</p>
              <p className="text-3xl font-light text-ink-900 mb-1 font-mono">{formatCurrency(debtorsValue)}</p>
              <p className="text-[10px] text-ink-300">Invoiced but not paid</p>
            </div>
          </div>
        </div>
      </section>

      {/* ━━━ HEALTH SCORE TRENDS ━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section className="pb-16">
        <div className="border-t border-surface-200/60 pt-10">
          <h2 className="font-display text-[1.5rem] text-ink-900 mb-6">Health Score Trends</h2>
          <div className="card-premium overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-surface-200 bg-surface-50">
                    <th className="text-left px-5 py-4 text-[11px] text-ink-300 uppercase tracking-[0.08em] font-semibold">Project</th>
                    <th className="text-center px-5 py-4 text-[11px] text-ink-300 uppercase tracking-[0.08em] font-semibold">Current Score</th>
                    <th className="text-center px-5 py-4 text-[11px] text-ink-300 uppercase tracking-[0.08em] font-semibold">Trend</th>
                    <th className="text-center px-5 py-4 text-[11px] text-ink-300 uppercase tracking-[0.08em] font-semibold">6-Month Sparkline</th>
                    <th className="text-left px-5 py-4 text-[11px] text-ink-300 uppercase tracking-[0.08em] font-semibold">Latest Update</th>
                  </tr>
                </thead>
                <tbody>
                  {PROJECTS.map((project, i) => {
                    const snapshots = getProjectHealthSnapshots(project.id).sort((a, b) => new Date(b.snapshot_date).getTime() - new Date(a.snapshot_date).getTime())
                    const currentScore = snapshots.length > 0 ? snapshots[0].health_score : 0
                    const sparklineData = getSparklineData(project.id)
                    const maxScore = 100
                    const trend = getTrendDirection(project.id)
                    const latestDate = getLatestSnapshotDate(project.id)

                    return (
                      <tr key={i} className="stripe-row border-b border-surface-200 hover:bg-surface-50/50 transition-colors">
                        <td className="px-5 py-4 text-[12px] font-medium text-ink-900">{project.name}</td>

                        {/* Current Score */}
                        <td className="text-center px-5 py-4">
                          <div className="inline-flex items-center gap-2">
                            <span className={cn('text-lg font-semibold', healthScoreColor(currentScore))}>{currentScore}</span>
                            <div className={cn('w-1 h-6 rounded-sm', healthScoreBg(currentScore))} />
                          </div>
                        </td>

                        {/* Trend */}
                        <td className="text-center px-5 py-4">
                          <span className={cn('text-[14px] font-semibold', trend === '↑' ? 'text-emerald-600' : trend === '↓' ? 'text-red-600' : 'text-ink-300')}>
                            {trend}
                          </span>
                        </td>

                        {/* Mini Sparkline */}
                        <td className="text-center px-5 py-4">
                          <div className="inline-flex items-end gap-0.5 h-10">
                            {sparklineData.length > 0 ? (
                              sparklineData.map((score, idx) => (
                                <div
                                  key={idx}
                                  className={cn('w-1.5 rounded-sm', healthScoreBg(score))}
                                  style={{ height: `${(score / maxScore) * 100}%` }}
                                  title={`${score}`}
                                />
                              ))
                            ) : (
                              <span className="text-[10px] text-ink-300">No data</span>
                            )}
                          </div>
                        </td>

                        {/* Latest Update */}
                        <td className="px-5 py-4 text-[10px] text-ink-400">
                          {latestDate ? timeAgo(latestDate) : 'Never'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      {/* ━━━ CROSS-PROJECT ALERT SUMMARY ━━━━━━━━━━━━━━━━ */}
      <section className="pb-16">
        <div className="border-t border-surface-200/60 pt-10">
          <h2 className="font-display text-[1.5rem] text-ink-900 mb-6">Alert Summary</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Critical Alerts */}
            <Link href="/projects?filter=critical_alerts" className="card-premium p-5 cursor-pointer">
              <div className="flex items-baseline gap-2 mb-4">
                <span className="w-2 h-2 rounded-full bg-red-500" />
                <span className="text-[11px] text-ink-400 uppercase tracking-[0.08em] font-semibold">Critical Alerts</span>
              </div>
              <p className="text-4xl font-light text-red-600 mb-2">{criticalAlerts}</p>
              <p className="text-[10px] text-ink-400">Unacknowledged</p>
              {criticalAlerts > 0 && (
                <div className="pt-3 border-t border-surface-200 mt-3">
                  <p className="text-[10px] text-ink-500 italic">Requires immediate action</p>
                </div>
              )}
            </Link>

            {/* Warning Alerts */}
            <Link href="/projects?filter=warning_alerts" className="card-premium p-5 cursor-pointer">
              <div className="flex items-baseline gap-2 mb-4">
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                <span className="text-[11px] text-ink-400 uppercase tracking-[0.08em] font-semibold">Warning Alerts</span>
              </div>
              <p className="text-4xl font-light text-amber-600 mb-2">{warningAlerts}</p>
              <p className="text-[10px] text-ink-400">Unacknowledged</p>
              {warningAlerts > 0 && (
                <div className="pt-3 border-t border-surface-200 mt-3">
                  <p className="text-[10px] text-ink-500 italic">Monitor closely</p>
                </div>
              )}
            </Link>

            {/* Info Alerts */}
            <div className="card-premium p-5">
              <div className="flex items-baseline gap-2 mb-4">
                <span className="w-2 h-2 rounded-full bg-blue-500" />
                <span className="text-[11px] text-ink-400 uppercase tracking-[0.08em] font-semibold">Info Alerts</span>
              </div>
              <p className="text-4xl font-light text-blue-600 mb-2">{infoAlerts}</p>
              <p className="text-[10px] text-ink-400">Unacknowledged</p>
              {infoAlerts > 0 && (
                <div className="pt-3 border-t border-surface-200 mt-3">
                  <p className="text-[10px] text-ink-500 italic">Informational only</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ━━━ AT-RISK PROJECT DEEP DIVE ━━━━━━━━━━━━━━━━━━ */}
      {atRiskAndCriticalProjects.length > 0 && (
        <section className="pb-16">
          <div className="border-t border-surface-200/60 pt-10">
            <h2 className="font-display text-[1.5rem] text-ink-900 mb-6">At-Risk Projects</h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {atRiskAndCriticalProjects.map((commercial, i) => {
                const project = PROJECTS.find(p => p.id === commercial.project_id)
                const snapshots = getProjectHealthSnapshots(commercial.project_id).sort((a, b) => new Date(b.snapshot_date).getTime() - new Date(a.snapshot_date).getTime())
                const currentScore = snapshots.length > 0 ? snapshots[0].health_score : 0
                const alertCount = getProjectAlertCount(commercial.project_id)
                const mostCriticalAlert = getMostCriticalAlert(commercial.project_id)
                const isCritical = commercial.health_flag === 'critical'

                return (
                  <Link key={i} href={`/projects/${commercial.project_id}/health`} className={cn('rounded-2xl border shadow-card p-5 hover:shadow-lg transition-shadow', isCritical ? 'bg-red-50 border-red-200' : 'bg-orange-50 border-orange-200')}>
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="text-[13px] font-semibold text-ink-900 mb-1">{project?.name || 'Unknown'}</h3>
                        <p className={cn('text-[11px] font-semibold uppercase tracking-[0.08em]', isCritical ? 'text-red-600' : 'text-orange-600')}>
                          {isCritical ? 'Critical' : 'At Risk'}
                        </p>
                      </div>
                      <div className={cn('w-12 h-12 rounded-lg flex items-center justify-center font-semibold text-lg', healthScoreBg(currentScore), healthScoreColor(currentScore))}>
                        {currentScore}
                      </div>
                    </div>

                    <div className="space-y-3 pt-4 border-t border-surface-200/60">
                      {/* Forecast Margin Trend */}
                      <div>
                        <p className="text-[10px] text-ink-400 uppercase tracking-[0.08em] font-semibold mb-1">Forecast Margin</p>
                        <p className={cn('text-[13px] font-semibold', commercial.current_margin_percent < 0 ? 'text-red-600' : 'text-amber-600')}>
                          {formatPercent(commercial.current_margin_percent / 100)}
                        </p>
                      </div>

                      {/* Burn Ratio */}
                      <div>
                        <p className="text-[10px] text-ink-400 uppercase tracking-[0.08em] font-semibold mb-1">Burn Ratio</p>
                        <p className="text-[13px] font-semibold text-ink-900">
                          {commercial.agreed_fee > 0 ? formatPercent((commercial.fee_invoiced / commercial.agreed_fee) * 100) : 'N/A'}
                        </p>
                      </div>

                      {/* Active Alerts */}
                      <div>
                        <p className="text-[10px] text-ink-400 uppercase tracking-[0.08em] font-semibold mb-1">Active Alerts</p>
                        <p className="text-[13px] font-semibold text-ink-900">{alertCount}</p>
                      </div>

                      {/* Most Critical Alert */}
                      {mostCriticalAlert && (
                        <div className="pt-3 border-t border-surface-200/60">
                          <p className="text-[10px] text-ink-400 uppercase tracking-[0.08em] font-semibold mb-2">Top Priority</p>
                          <div className={cn('rounded px-2.5 py-1.5', mostCriticalAlert.severity === 'critical' ? 'bg-red-100 border border-red-300' : mostCriticalAlert.severity === 'warning' ? 'bg-amber-100 border border-amber-300' : 'bg-blue-100 border border-blue-300')}>
                            <p className={cn('text-[10px] font-semibold', mostCriticalAlert.severity === 'critical' ? 'text-red-700' : mostCriticalAlert.severity === 'warning' ? 'text-amber-700' : 'text-blue-700')}>
                              {healthAlertCategoryLabel(mostCriticalAlert.category)}
                            </p>
                            <p className="text-[9px] text-ink-500 mt-0.5">{mostCriticalAlert.description}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </Link>
                )
              })}
            </div>
          </div>
        </section>
      )}

      {/* ━━━ PROJECT RISK MATRIX ━━━━━━━━━━━━━━━━━━━━━━ */}
      <section className="pb-16">
        <div className="border-t border-surface-200/60 pt-10">
          <h2 className="font-display text-[1.5rem] text-ink-900 mb-6">Project Risk Matrix</h2>
          <div className="card-premium overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-surface-200 bg-surface-50">
                    <th className="text-left px-5 py-4 text-[11px] text-ink-300 uppercase tracking-[0.08em] font-semibold">Project</th>
                    <th className="text-center px-5 py-4 text-[11px] text-ink-300 uppercase tracking-[0.08em] font-semibold">Health</th>
                    <th className="text-center px-5 py-4 text-[11px] text-ink-300 uppercase tracking-[0.08em] font-semibold">Score</th>
                    <th className="text-center px-5 py-4 text-[11px] text-ink-300 uppercase tracking-[0.08em] font-semibold">Alerts</th>
                    <th className="text-center px-5 py-4 text-[11px] text-ink-300 uppercase tracking-[0.08em] font-semibold">Overspend</th>
                    <th className="text-center px-5 py-4 text-[11px] text-ink-300 uppercase tracking-[0.08em] font-semibold">Margin</th>
                    <th className="text-right px-5 py-4 text-[11px] text-ink-300 uppercase tracking-[0.08em] font-semibold">Recovery %</th>
                  </tr>
                </thead>
                <tbody>
                  {commercials.map((commercial, i) => {
                    const project = PROJECTS.find(p => p.id === commercial.project_id)
                    const isOverspend = commercial.current_margin_percent < 0
                    const isLowMargin = commercial.current_margin_percent < 5 && commercial.current_margin_percent >= 0
                    const recovery = commercial.agreed_fee > 0 ? (commercial.fee_invoiced / commercial.agreed_fee) : 0
                    const recoveryStatus = recovery >= 0.9 ? 'green' : recovery >= 0.7 ? 'amber' : 'red'
                    const snapshots = getProjectHealthSnapshots(commercial.project_id).sort((a, b) => new Date(b.snapshot_date).getTime() - new Date(a.snapshot_date).getTime())
                    const currentScore = snapshots.length > 0 ? snapshots[0].health_score : 0
                    const alertCount = getProjectAlertCount(commercial.project_id)

                    return (
                      <tr key={i} className="stripe-row border-b border-surface-200 hover:bg-surface-50/50 transition-colors">
                        <td className="px-5 py-4 text-[12px] font-medium text-ink-900">{project?.name || 'Unknown'}</td>

                        {/* Health */}
                        <td className="text-center px-5 py-4">
                          <div className="inline-flex items-center gap-1.5">
                            {commercialHealthDot(commercial.health_flag)}
                            <span className="text-[10px] font-medium capitalize">{commercial.health_flag}</span>
                          </div>
                        </td>

                        {/* Health Score */}
                        <td className="text-center px-5 py-4">
                          <div className="inline-flex items-center gap-2">
                            <span className={cn('text-sm font-semibold', healthScoreColor(currentScore))}>{currentScore}</span>
                            <div className={cn('w-1 h-4 rounded-sm', healthScoreBg(currentScore))} />
                          </div>
                        </td>

                        {/* Active Alerts */}
                        <td className="text-center px-5 py-4">
                          <div className="inline-flex items-center justify-center w-5 h-5 rounded-full" style={{
                            backgroundColor: alertCount > 2 ? '#fee2e2' : alertCount > 0 ? '#fef3c7' : '#f0fdf4'
                          }}>
                            <span style={{
                              color: alertCount > 2 ? '#dc2626' : alertCount > 0 ? '#d97706' : '#16a34a'
                            }} className="text-[11px] font-bold">
                              {alertCount}
                            </span>
                          </div>
                        </td>

                        {/* Overspend */}
                        <td className="text-center px-5 py-4">
                          <div className="inline-flex items-center justify-center w-5 h-5 rounded-full" style={{
                            backgroundColor: isOverspend ? '#fee2e2' : '#f0fdf4'
                          }}>
                            <span style={{ color: isOverspend ? '#dc2626' : '#16a34a' }} className="text-[12px] font-bold">
                              {isOverspend ? '!' : '✓'}
                            </span>
                          </div>
                        </td>

                        {/* Margin */}
                        <td className="text-center px-5 py-4">
                          <div className="inline-flex items-center justify-center w-5 h-5 rounded-full" style={{
                            backgroundColor: isOverspend ? '#fee2e2' : isLowMargin ? '#fef3c7' : '#f0fdf4'
                          }}>
                            <span style={{
                              color: isOverspend ? '#dc2626' : isLowMargin ? '#d97706' : '#16a34a'
                            }} className="text-[12px] font-bold">
                              {isOverspend ? '!' : isLowMargin ? '⚠' : '✓'}
                            </span>
                          </div>
                        </td>

                        {/* Fee Recovery */}
                        <td className="text-right px-5 py-4">
                          <div className="inline-flex flex-col items-end gap-1">
                            <div className="inline-flex items-center justify-center w-5 h-5 rounded-full" style={{
                              backgroundColor: recoveryStatus === 'green' ? '#f0fdf4' : recoveryStatus === 'amber' ? '#fef3c7' : '#fee2e2'
                            }}>
                              <span style={{
                                color: recoveryStatus === 'green' ? '#16a34a' : recoveryStatus === 'amber' ? '#d97706' : '#dc2626'
                              }} className="text-[11px] font-bold">
                                {recoveryStatus === 'green' ? '✓' : recoveryStatus === 'amber' ? '⚠' : '!'}
                              </span>
                            </div>
                            <span className="text-[10px] text-ink-400 font-mono">{formatPercent(recovery)}</span>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

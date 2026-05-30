'use client'

import { useParams } from 'next/navigation'
import { useState } from 'react'
import Link from 'next/link'

import {
  getProject,
  getProjectHealthSnapshots,
  getProjectHealthAlerts,
  getBurnBudgetMetrics,
  getProjectTasks,
  getProjectCommercial,
} from '@/lib/mock-data'
import {
  cn,
  formatDate,
  formatCurrency,
  formatPercent,
  healthScoreColor,
  healthScoreBg,
  healthAlertSeverityColor,
  healthAlertSeverityDot,
  healthAlertCategoryLabel,
  healthAlertCategoryIcon,
  burnRatioColor,
  burnRatioBg,
  formatBurnRatio,
  varianceColor,
  timeAgo,
} from '@/lib/utils'
import { calculateCompletion, calculateStageCompletion } from '@/lib/risk-engine'

const RIBA_STAGES = ['Preparation', 'Concept', 'Developed Design', 'Technical Design', 'Manufacturing & Construction', 'Handover']
const SEVERITY_LEVELS = ['Critical', 'Warning', 'Info']

export default function ProjectHealthPage() {
  const params = useParams()

  const projectId = params.id as string

  // Data loading
  const project = getProject(projectId)
  const snapshots = getProjectHealthSnapshots(projectId)
  const latestSnapshot = snapshots[snapshots.length - 1]
  const prevSnapshot = snapshots.length > 1 ? snapshots[snapshots.length - 2] : null
  const allAlerts = getProjectHealthAlerts(projectId)
  const burnMetrics = getBurnBudgetMetrics(projectId)
  const tasks = getProjectTasks(projectId)
  const commercial = getProjectCommercial(projectId)

  // Local state
  const [alertFilter, setAlertFilter] = useState<'All' | 'Critical' | 'Warning' | 'Info'>('All')
  const [expandedAlert, setExpandedAlert] = useState<string | null>(null)

  if (!project) {
    return (
      <div className="min-h-screen bg-surface-50 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="card-premium p-8 text-center">
            <p className="text-ink-600 mb-4">Project not found</p>
            <Link
              href="/projects"
              className="text-accent-600 hover:text-accent-700 font-medium text-[13px]"
            >
              Back to Projects
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // Filter alerts
  const filteredAlerts =
    alertFilter === 'All'
      ? allAlerts
      : allAlerts.filter((a) => a.severity.toLowerCase() === alertFilter.toLowerCase())

  // Trend data (last 7 snapshots)
  const trendSnapshots = snapshots.slice(-7)

  // Stage completion grid
  const currentStageIndex = project.current_stage || 0
  const stageCompletions = Array.from({ length: currentStageIndex + 1 }, (_, i) => i).map((stageNum) => ({
    stage: RIBA_STAGES[stageNum],
    completion: calculateStageCompletion(tasks, stageNum),
  }))

  // Trend calculation
  const scoreTrend =
    latestSnapshot && prevSnapshot
      ? latestSnapshot.health_score - prevSnapshot.health_score
      : 0

  const getTrendArrow = (trend: number) => {
    if (trend > 2) return '↑'
    if (trend < -2) return '↓'
    return '→'
  }

  const getTrendColor = (trend: number) => {
    if (trend > 0) return 'text-green-600'
    if (trend < 0) return 'text-red-600'
    return 'text-ink-400'
  }

  return (
    <div className="min-h-screen bg-surface-50 animate-fade-in">
      {/* Header */}
      <div className="bg-white border-b border-surface-200">
        <div className="max-w-7xl mx-auto px-8 py-6">
          <div>
            <h1 className="font-display text-[2rem] text-ink-900">Project Health</h1>
            <p className="text-[13px] text-ink-500 mt-1">{project.name}</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-8 py-10 space-y-10">
        {/* Health Score Card */}
        <div
          className={cn(
            'rounded-2xl border border-surface-200 shadow-card p-8',
            healthScoreBg(latestSnapshot?.health_score || 0)
          )}
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[11px] text-ink-400 uppercase tracking-[0.08em] font-semibold mb-3">
                Health Score
              </p>
              <div className="flex items-baseline gap-3">
                <span
                  className={cn(
                    'text-6xl font-semibold',
                    healthScoreColor(latestSnapshot?.health_score || 0)
                  )}
                >
                  {Math.round(latestSnapshot?.health_score || 0)}
                </span>
                <span
                  className={cn(
                    'text-2xl font-semibold',
                    getTrendColor(scoreTrend)
                  )}
                >
                  {getTrendArrow(scoreTrend)}
                </span>
              </div>
              <p className="text-[13px] text-ink-500 mt-2">
                {latestSnapshot?.health_score >= 75
                  ? 'On track'
                  : latestSnapshot?.health_score >= 50
                    ? 'At risk'
                    : 'Critical'}
              </p>
            </div>
            <div className="space-y-4 text-right">
              <div>
                <p className="text-[11px] text-ink-400 uppercase tracking-[0.08em] font-semibold mb-1">
                  Forecast Margin
                </p>
                <p
                  className={cn(
                    'text-lg font-semibold',
                    (latestSnapshot?.forecast_margin || 0) >= 0
                      ? 'text-green-600'
                      : 'text-red-600'
                  )}
                >
                  {formatPercent(latestSnapshot?.forecast_margin || 0)}
                </p>
              </div>
              <div>
                <p className="text-[11px] text-ink-400 uppercase tracking-[0.08em] font-semibold mb-1">
                  Burn Ratio
                </p>
                <p
                  className={cn(
                    'text-lg font-semibold',
                    burnRatioColor(latestSnapshot?.burn_ratio || 0)
                  )}
                >
                  {formatBurnRatio(latestSnapshot?.burn_ratio || 0)}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Alerts Section */}
        <div className="space-y-4">
          <div>
            <h2 className="font-display text-[1.5rem] text-ink-900 mb-4">Alerts</h2>
            <div className="flex gap-2">
              {(['All', 'Critical', 'Warning', 'Info'] as const).map((level) => (
                <button
                  key={level}
                  onClick={() => setAlertFilter(level)}
                  className={cn(
                    'px-4 py-2 rounded-lg text-[12px] font-medium transition-colors',
                    alertFilter === level
                      ? 'bg-ink-900 text-white'
                      : 'bg-surface-100 text-ink-600 hover:bg-surface-200'
                  )}
                >
                  {level}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            {filteredAlerts.length === 0 ? (
              <div className="card-premium p-6 text-center">
                <p className="text-[13px] text-ink-500">No {alertFilter !== 'All' ? alertFilter.toLowerCase() : ''} alerts</p>
              </div>
            ) : (
              filteredAlerts.map((alert) => (
                <div
                  key={alert.id}
                  className="card-premium p-5"
                >
                  <div
                    className="flex items-start gap-4 cursor-pointer"
                    onClick={() =>
                      setExpandedAlert(expandedAlert === alert.id ? null : alert.id)
                    }
                  >
                    {/* Severity dot */}
                    <div
                      className={cn(
                        'w-2 h-2 rounded-full mt-2 flex-shrink-0',
                        healthAlertSeverityDot(alert.severity)
                      )}
                    />

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-lg">{healthAlertCategoryIcon(alert.category)}</span>
                        <h3 className="text-[13px] font-semibold text-ink-900">{alert.title}</h3>
                        <span
                          className={cn(
                            'text-[10px] font-semibold px-2 py-1 rounded',
                            healthAlertSeverityColor(alert.severity)
                          )}
                        >
                          {alert.severity}
                        </span>
                      </div>
                      <p className="text-[12px] text-ink-500 mb-3">{alert.description}</p>

                      {expandedAlert === alert.id && alert.suggested_action && (
                        <div className="bg-surface-50 rounded-lg p-3 mb-3 border border-surface-200">
                          <p className="text-[11px] text-ink-400 uppercase tracking-[0.08em] font-semibold mb-2">
                            Suggested Action
                          </p>
                          <p className="text-[12px] text-ink-700">{alert.suggested_action}</p>
                        </div>
                      )}

                      <div className="flex items-center gap-3">
                        <span className="text-[11px] text-ink-400">
                          {timeAgo(alert.created_at)}
                        </span>
                        {alert.acknowledged_flag && (
                          <span className="text-[11px] bg-green-100 text-green-700 px-2 py-1 rounded">
                            Acknowledged
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Burn vs Budget */}
        <div className="space-y-4 border-t border-surface-200/60 pt-10">
          <h2 className="font-display text-[1.5rem] text-ink-900">Burn vs Budget</h2>
          <div className="card-premium overflow-hidden">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="border-b border-surface-200 bg-surface-50">
                  <th className="px-6 py-4 text-left text-[11px] text-ink-400 uppercase tracking-[0.08em] font-semibold">
                    Stage
                  </th>
                  <th className="px-6 py-4 text-left text-[11px] text-ink-400 uppercase tracking-[0.08em] font-semibold">
                    Budgeted
                  </th>
                  <th className="px-6 py-4 text-left text-[11px] text-ink-400 uppercase tracking-[0.08em] font-semibold">
                    Actual
                  </th>
                  <th className="px-6 py-4 text-left text-[11px] text-ink-400 uppercase tracking-[0.08em] font-semibold">
                    Burn Ratio
                  </th>
                  <th className="px-6 py-4 text-left text-[11px] text-ink-400 uppercase tracking-[0.08em] font-semibold">
                    Variance
                  </th>
                  <th className="px-6 py-4 text-left text-[11px] text-ink-400 uppercase tracking-[0.08em] font-semibold">
                    Progress
                  </th>
                </tr>
              </thead>
              <tbody>
                {burnMetrics.map((metric) => {
                  const burnRatio = metric.actual_hours / (metric.budgeted_hours || 1)
                  const variance = ((metric.actual_hours - metric.budgeted_hours) / (metric.budgeted_hours || 1)) * 100
                  const maxHours = Math.max(metric.budgeted_hours, metric.actual_hours)

                  return (
                    <tr key={metric.stage} className="stripe-row border-b border-surface-100 hover:bg-surface-50 transition-colors">
                      <td className="px-6 py-4 text-ink-900 font-medium">{metric.stage}</td>
                      <td className="px-6 py-4 text-ink-600">{metric.budgeted_hours}h</td>
                      <td className="px-6 py-4 text-ink-600">{metric.actual_hours}h</td>
                      <td className="px-6 py-4">
                        <span
                          className={cn(
                            'px-2 py-1 rounded text-[11px] font-semibold',
                            burnRatioBg(burnRatio)
                          )}
                        >
                          {formatBurnRatio(burnRatio)}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={cn('font-semibold', varianceColor(variance))}>
                          {variance > 0 ? '+' : ''}{variance.toFixed(1)}%
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="w-full bg-surface-200 rounded-full h-2 overflow-hidden">
                          <div
                            className={cn(
                              'h-full rounded-full',
                              burnRatioBg(burnRatio)
                            )}
                            style={{
                              width: `${Math.min(100, (metric.actual_hours / maxHours) * 100)}%`,
                            }}
                          />
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Stage Completion */}
        <div className="space-y-4 border-t border-surface-200/60 pt-10">
          <h2 className="font-display text-[1.5rem] text-ink-900">Stage Completion</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {stageCompletions.map(({ stage, completion }) => (
              <div key={stage} className="card-premium p-5">
                <p className="text-[11px] text-ink-400 uppercase tracking-[0.08em] font-semibold mb-3">
                  {stage}
                </p>
                <div className="space-y-2">
                  <p className="text-2xl font-semibold text-ink-900">
                    {formatPercent(completion)}
                  </p>
                  <div className="w-full bg-surface-200 rounded-full h-2 overflow-hidden">
                    <div
                      className={cn(
                        'h-full rounded-full transition-all',
                        completion >= 75
                          ? 'bg-green-500'
                          : completion >= 50
                            ? 'bg-amber-500'
                            : 'bg-red-500'
                      )}
                      style={{ width: `${completion}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Health Trend */}
        <div className="space-y-4 border-t border-surface-200/60 pt-10">
          <h2 className="font-display text-[1.5rem] text-ink-900">Health Trend</h2>
          <div className="card-premium overflow-hidden">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="border-b border-surface-200 bg-surface-50">
                  <th className="px-6 py-4 text-left text-[11px] text-ink-400 uppercase tracking-[0.08em] font-semibold">
                    Date
                  </th>
                  <th className="px-6 py-4 text-left text-[11px] text-ink-400 uppercase tracking-[0.08em] font-semibold">
                    Score
                  </th>
                  <th className="px-6 py-4 text-left text-[11px] text-ink-400 uppercase tracking-[0.08em] font-semibold">
                    Margin
                  </th>
                  <th className="px-6 py-4 text-left text-[11px] text-ink-400 uppercase tracking-[0.08em] font-semibold">
                    Burn Ratio
                  </th>
                  <th className="px-6 py-4 text-left text-[11px] text-ink-400 uppercase tracking-[0.08em] font-semibold">
                    Flags
                  </th>
                </tr>
              </thead>
              <tbody>
                {trendSnapshots.map((snapshot) => (
                  <tr
                    key={snapshot.id}
                    className={cn(
                      'stripe-row border-b border-surface-100 transition-colors',
                      snapshot.health_score >= 75
                        ? 'hover:bg-green-50'
                        : snapshot.health_score >= 50
                          ? 'hover:bg-amber-50'
                          : 'hover:bg-red-50'
                    )}
                  >
                    <td className="px-6 py-4 text-ink-600">
                      {formatDate(snapshot.snapshot_date)}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={cn(
                          'font-semibold px-2 py-1 rounded text-[11px]',
                          healthScoreBg(snapshot.health_score)
                        )}
                      >
                        {Math.round(snapshot.health_score)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={cn(
                          'font-semibold',
                          snapshot.forecast_margin >= 0
                            ? 'text-green-600'
                            : 'text-red-600'
                        )}
                      >
                        {formatPercent(snapshot.forecast_margin)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={cn(
                          'px-2 py-1 rounded text-[11px] font-semibold',
                          burnRatioBg(snapshot.burn_ratio)
                        )}
                      >
                        {formatBurnRatio(snapshot.burn_ratio)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-2">
                        {snapshot.near_loss_flag && (
                          <span className="bg-red-100 text-red-700 text-[10px] px-2 py-1 rounded">
                            Near Loss
                          </span>
                        )}
                        {snapshot.billing_risk_flag && (
                          <span className="bg-amber-100 text-amber-700 text-[10px] px-2 py-1 rounded">
                            Billing Risk
                          </span>
                        )}
                        {snapshot.quote_review_flag && (
                          <span className="bg-blue-100 text-blue-700 text-[10px] px-2 py-1 rounded">
                            Quote Review
                          </span>
                        )}
                        {!snapshot.near_loss_flag &&
                          !snapshot.billing_risk_flag &&
                          !snapshot.quote_review_flag && (
                            <span className="text-ink-400 text-[10px]">—</span>
                          )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Commercial Summary */}
        {commercial && (
        <div className="space-y-4 border-t border-surface-200/60 pt-10">
          <h2 className="font-display text-[1.5rem] text-ink-900">Commercial Summary</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <div className="card-premium p-5">
              <p className="text-[11px] text-ink-400 uppercase tracking-[0.08em] font-semibold mb-2">
                Agreed Fee
              </p>
              <p className="text-xl font-semibold text-ink-900">
                {formatCurrency(commercial.agreed_fee)}
              </p>
            </div>
            <div className="card-premium p-5">
              <p className="text-[11px] text-ink-400 uppercase tracking-[0.08em] font-semibold mb-2">
                Invoiced
              </p>
              <p className="text-xl font-semibold text-ink-900">
                {formatCurrency(commercial.fee_invoiced)}
              </p>
            </div>
            <div className="card-premium p-5">
              <p className="text-[11px] text-ink-400 uppercase tracking-[0.08em] font-semibold mb-2">
                Paid
              </p>
              <p className="text-xl font-semibold text-green-600">
                {formatCurrency(commercial.fee_paid)}
              </p>
            </div>
            <div className="card-premium p-5">
              <p className="text-[11px] text-ink-400 uppercase tracking-[0.08em] font-semibold mb-2">
                WIP
              </p>
              <p className="text-xl font-semibold text-ink-900">
                {formatCurrency(commercial.wip_value)}
              </p>
            </div>
            <div className="card-premium p-5">
              <p className="text-[11px] text-ink-400 uppercase tracking-[0.08em] font-semibold mb-2">
                Expenses
              </p>
              <p className="text-xl font-semibold text-ink-900">
                {formatCurrency(commercial.expenses)}
              </p>
            </div>
            <div className="card-premium p-5">
              <p className="text-[11px] text-ink-400 uppercase tracking-[0.08em] font-semibold mb-2">
                Margin %
              </p>
              <p
                className={cn(
                  'text-xl font-semibold',
                  commercial.current_margin_percent >= 15
                    ? 'text-green-600'
                    : commercial.current_margin_percent >= 10
                      ? 'text-amber-600'
                      : 'text-red-600'
                )}
              >
                {formatPercent(commercial.current_margin_percent)}
              </p>
            </div>
          </div>
        </div>
        )}
      </div>
    </div>
  )
}

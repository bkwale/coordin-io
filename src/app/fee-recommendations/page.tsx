'use client'

import { getFeeRecommendations, getProject, PROJECTS } from '@/lib/mock-data'
import { FeeRecommendation, RIBA_STAGES } from '@/lib/types'
import { cn, formatDate, formatCurrency, confidenceBadgeColor } from '@/lib/utils'
import { Breadcrumb } from '@/components/Breadcrumb'
import { SummaryCard } from '@/components/SummaryCard'
import { EmptyState } from '@/components/EmptyState'

export default function FeeRecommendationsPage() {
  const recommendations = getFeeRecommendations()

  // Calculate summary metrics
  const highConfidenceCount = recommendations.filter(r => r.confidence_level === 'high').length
  const avgFeeRangeLow = recommendations.length > 0
    ? Math.round(recommendations.reduce((sum, r) => sum + r.recommended_fee_low, 0) / recommendations.length)
    : 0
  const avgFeeRangeHigh = recommendations.length > 0
    ? Math.round(recommendations.reduce((sum, r) => sum + r.recommended_fee_high, 0) / recommendations.length)
    : 0

  const stageSplitColors: Record<number, string> = {
    0: '#6366f1', // indigo
    1: '#8b5cf6', // violet
    2: '#0ea5e9', // sky
    3: '#06b6d4', // cyan
    4: '#0c85f1', // brand blue
    5: '#f59e0b', // amber
    6: '#10b981', // emerald
    7: '#6b7280', // gray
  }

  return (
    <div className="max-w-6xl animate-fade-in">
      {/* ━━━ HEADER ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section className="pb-16">
        <Breadcrumb
          items={[
            { label: 'Dashboard', href: '/' },
            { label: 'Fee Recommendations' },
          ]}
        />
        <div className="mt-8">
          <h1 className="font-display text-[2rem] text-ink-900 mb-2">
            Fee Recommendations
          </h1>
          <p className="text-[13px] text-ink-400">
            Benchmark fees against similar projects and generate informed estimates
          </p>
        </div>
      </section>

      {/* ━━━ SUMMARY CARDS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {recommendations.length > 0 && (
        <section className="pb-16">
          <div className="border-t border-surface-300 pt-10">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
              <div className="card-premium p-4 text-center">
                <p className="text-2xl font-light tracking-tight text-ink-900">{recommendations.length}</p>
                <p className="text-[11px] text-ink-400 font-medium mt-1.5 tracking-wide">Recommendations Generated</p>
              </div>
              <div className="card-premium p-4 text-center">
                <p className="text-2xl font-light tracking-tight text-ink-900">{highConfidenceCount}</p>
                <p className="text-[11px] text-ink-400 font-medium mt-1.5 tracking-wide">High Confidence</p>
              </div>
              <div className="card-premium p-4 text-center">
                <p className="text-2xl font-light tracking-tight text-ink-900">{formatCurrency(avgFeeRangeLow)} — {formatCurrency(avgFeeRangeHigh)}</p>
                <p className="text-[11px] text-ink-400 font-medium mt-1.5 tracking-wide">Avg Fee Range</p>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ━━━ RECOMMENDATION CARDS ━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section className="pb-16">
        <div className="border-t border-surface-300 pt-10">
          {recommendations.length === 0 ? (
            <EmptyState message="No fee recommendations available yet. Start by creating a project to generate benchmarks." />
          ) : (
            <div className="space-y-6">
              {recommendations.map(rec => {
                const similarProjects = rec.similar_project_ids
                  .map(id => PROJECTS.find(p => p.id === id))
                  .filter((p): p is typeof PROJECTS[0] => !!p)

                return (
                  <div
                    key={rec.id}
                    className="card-premium p-6"
                  >
                    {/* ─── Header ─── */}
                    <div className="flex items-start justify-between mb-6">
                      <div>
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-display text-[1.125rem] text-ink-900">
                            {rec.project_type}
                          </h3>
                          <span className="status-pill bg-surface-100 text-ink-600">
                            {rec.sector}
                          </span>
                          <span
                            className={cn(
                              'status-pill',
                              rec.confidence_level === 'high'
                                ? 'bg-emerald-50 text-emerald-700'
                                : rec.confidence_level === 'medium'
                                  ? 'bg-amber-50 text-amber-700'
                                  : 'bg-red-50 text-red-700'
                            )}
                          >
                            {rec.confidence_level} Confidence
                          </span>
                        </div>
                        <p className="text-[12px] text-ink-400">
                          {rec.complexity.charAt(0).toUpperCase() + rec.complexity.slice(1)} complexity •{' '}
                          {rec.procurement_route}
                        </p>
                      </div>
                    </div>

                    {/* ─── Fee Range (Prominent) ─── */}
                    <div className="mb-8 pb-8 border-b border-surface-200/60">
                      <p className="text-[11px] text-ink-400 uppercase tracking-[0.1em] mb-2">Recommended Fee Range</p>
                      <p className="font-display text-[1.5rem] text-ink-900">
                        {formatCurrency(rec.recommended_fee_low)} — {formatCurrency(rec.recommended_fee_high)}
                      </p>
                    </div>

                    {/* ─── Details Grid (2x3) ─── */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-6 mb-8 pb-8 border-b border-surface-200/60">
                      {/* Scale Estimate */}
                      <div>
                        <p className="text-[10px] text-ink-400 uppercase tracking-[0.1em] mb-2 font-semibold">
                          Scale Estimate
                        </p>
                        <p className="text-[13px] text-ink-900 font-medium">
                          {formatCurrency(rec.scale_estimate)}
                        </p>
                      </div>

                      {/* Procurement Route */}
                      <div>
                        <p className="text-[10px] text-ink-400 uppercase tracking-[0.1em] mb-2 font-semibold">
                          Procurement Route
                        </p>
                        <p className="text-[13px] text-ink-900 font-medium capitalize">
                          {rec.procurement_route.replace(/_/g, ' ')}
                        </p>
                      </div>

                      {/* Complexity */}
                      <div>
                        <p className="text-[10px] text-ink-400 uppercase tracking-[0.1em] mb-2 font-semibold">
                          Complexity
                        </p>
                        <p className="text-[13px] text-ink-900 font-medium capitalize">
                          {rec.complexity}
                        </p>
                      </div>

                      {/* Stage Scope */}
                      <div>
                        <p className="text-[10px] text-ink-400 uppercase tracking-[0.1em] mb-2 font-semibold">
                          Stage Scope
                        </p>
                        <p className="text-[13px] text-ink-900 font-medium">
                          {rec.stage_scope}
                        </p>
                      </div>

                      {/* Overhead % */}
                      <div>
                        <p className="text-[10px] text-ink-400 uppercase tracking-[0.1em] mb-2 font-semibold">
                          Overhead %
                        </p>
                        <p className="text-[13px] text-ink-900 font-medium">
                          {rec.overhead_percent.toFixed(1)}%
                        </p>
                      </div>

                      {/* Target Margin % */}
                      <div>
                        <p className="text-[10px] text-ink-400 uppercase tracking-[0.1em] mb-2 font-semibold">
                          Target Margin %
                        </p>
                        <p className="text-[13px] text-ink-900 font-medium">
                          {rec.margin_percent.toFixed(1)}%
                        </p>
                      </div>
                    </div>

                    {/* ─── Stage Split (Horizontal Bar) ─── */}
                    <div className="mb-8 pb-8 border-b border-surface-200/60">
                      <p className="text-[10px] text-ink-400 uppercase tracking-[0.1em] mb-4 font-semibold">
                        Recommended Stage Split
                      </p>
                      <div className="flex gap-1 h-8 mb-3 rounded-lg overflow-hidden bg-surface-100">
                        {Object.entries(rec.recommended_stage_split).map(([stageNum, percent]) => {
                          const stage = parseInt(stageNum) as unknown as import('@/lib/types').RIBAStage
                          const color = stageSplitColors[stage] || '#ccc'
                          return (
                            <div
                              key={stage}
                              style={{
                                flex: percent,
                                backgroundColor: color,
                              }}
                              className="transition-all"
                              title={`${RIBA_STAGES[stage]}: ${percent}%`}
                            />
                          )
                        })}
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {Object.entries(rec.recommended_stage_split).map(([stageNum, percent]) => {
                          const stage = parseInt(stageNum) as unknown as import('@/lib/types').RIBAStage
                          return (
                            <div key={stage} className="text-center">
                              <p className="text-[9px] text-ink-400 uppercase tracking-[0.08em] mb-1">
                                {RIBA_STAGES[stage]}
                              </p>
                              <p className="text-[13px] font-semibold text-ink-900">
                                {percent}%
                              </p>
                            </div>
                          )
                        })}
                      </div>
                    </div>

                    {/* ─── Staffing Mix ─── */}
                    <div className="mb-8 pb-8 border-b border-surface-200/60">
                      <p className="text-[10px] text-ink-400 uppercase tracking-[0.1em] mb-2 font-semibold">
                        Staffing Mix
                      </p>
                      <p className="text-[13px] text-ink-700 leading-relaxed">
                        {rec.staffing_mix_notes}
                      </p>
                    </div>

                    {/* ─── Similar Projects ─── */}
                    <div className="mb-8 pb-8 border-b border-surface-200/60">
                      <p className="text-[10px] text-ink-400 uppercase tracking-[0.1em] mb-3 font-semibold">
                        Similar Projects
                      </p>
                      {similarProjects.length === 0 ? (
                        <p className="text-[12px] text-ink-300 italic">No similar projects found.</p>
                      ) : (
                        <div className="space-y-1.5">
                          {similarProjects.map(project => (
                            <div key={project.id} className="flex items-center gap-2">
                              <span className="w-1 h-1 rounded-full bg-ink-300" />
                              <a
                                href={`/projects/${project.id}`}
                                className="text-[12px] text-accent-600 hover:text-accent-700 hover:underline transition-colors"
                              >
                                {project.name}
                              </a>
                              <span className="text-[11px] text-ink-300">• {project.client}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* ─── Notes ─── */}
                    {rec.notes && (
                      <div className="mb-8">
                        <p className="text-[10px] text-ink-400 uppercase tracking-[0.1em] mb-2 font-semibold">
                          Notes
                        </p>
                        <p className="text-[12px] text-ink-600 leading-relaxed italic">
                          "{rec.notes}"
                        </p>
                      </div>
                    )}

                    {/* ─── Confidence Assessment ─── */}
                    <div className="bg-surface-50 rounded-lg p-4">
                      <p className="text-[10px] text-ink-400 uppercase tracking-[0.1em] mb-2 font-semibold">
                        Confidence Assessment
                      </p>
                      <p className="text-[12px] text-ink-700">
                        This recommendation is based on historical project data analysis. The{' '}
                        <span className="font-semibold">
                          {rec.confidence_level}
                        </span>
                        {' '}confidence level indicates the reliability of this estimate given the available comparable project data.
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </section>

      {/* ━━━ ASSUMPTIONS SECTION ━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {recommendations.length > 0 && (
        <section className="pb-16">
          <div className="border-t border-surface-200/60 pt-10 mt-10">
            <h2 className="font-display text-[1.5rem] text-ink-900 mb-4">
              Assumptions
            </h2>
            <p className="text-[13px] text-ink-400 mb-6">
              Adjust assumptions to refine recommendations. This feature will be interactive in a future release.
            </p>

            {recommendations.length > 0 && (
              <div className="card-premium p-6">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
                  <div>
                    <p className="text-[10px] text-ink-400 uppercase tracking-[0.1em] mb-2 font-semibold">
                      Project Type
                    </p>
                    <p className="text-[13px] text-ink-600">
                      {recommendations[0]?.project_type}
                    </p>
                  </div>

                  <div>
                    <p className="text-[10px] text-ink-400 uppercase tracking-[0.1em] mb-2 font-semibold">
                      Sector
                    </p>
                    <p className="text-[13px] text-ink-600">
                      {recommendations[0]?.sector}
                    </p>
                  </div>

                  <div>
                    <p className="text-[10px] text-ink-400 uppercase tracking-[0.1em] mb-2 font-semibold">
                      Scale
                    </p>
                    <p className="text-[13px] text-ink-600">
                      {formatCurrency(recommendations[0]?.scale_estimate || 0)}
                    </p>
                  </div>

                  <div>
                    <p className="text-[10px] text-ink-400 uppercase tracking-[0.1em] mb-2 font-semibold">
                      Procurement Route
                    </p>
                    <p className="text-[13px] text-ink-600 capitalize">
                      {recommendations[0]?.procurement_route.replace(/_/g, ' ')}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  )
}

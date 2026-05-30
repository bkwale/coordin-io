'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import { PROJECTS, getProjectTenders, getTenderReturns, getTenderEvaluations } from '@/lib/mock-data'
import { cn, tenderStatusColor, formatDate } from '@/lib/utils'

import { StatusBadge } from '@/components/StatusBadge'
import { EmptyState } from '@/components/EmptyState'

export default function TenderPage() {
  const params = useParams()
  const project = PROJECTS.find(p => p.id === params.id)
  const [selectedTender, setSelectedTender] = useState<string | null>(null)

  if (!project) return <EmptyState message="Project not found." />

  const tenders = getProjectTenders(project.id)
  const activeTender = selectedTender ? tenders.find(t => t.id === selectedTender) : tenders[0] || null
  const returns = activeTender ? getTenderReturns(activeTender.id) : []

  return (
    <div className="space-y-6 sm:space-y-8 animate-fade-in">
      <div>
        <h1 className="text-[2rem] sm:text-[2.5rem] font-display font-bold text-ink-900">Tender Workspace</h1>
        <p className="text-sm text-ink-400 mt-1">{project.name} — {project.client}</p>
      </div>

      {tenders.length === 0 ? (
        <EmptyState message="No tender records for this project." />
      ) : (
        <>
          {/* Tender Selector */}
          {tenders.length > 1 && (
            <div className="flex gap-2">
              {tenders.map(t => (
                <button
                  key={t.id}
                  onClick={() => setSelectedTender(t.id)}
                  className={cn(
                    'px-4 py-2 rounded-lg text-xs font-medium border transition-colors',
                    (activeTender?.id === t.id)
                      ? 'bg-brand-50 border-brand-200 text-brand-700'
                      : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                  )}
                >
                  {t.tender_name}
                </button>
              ))}
            </div>
          )}

          {activeTender && (
            <>
              {/* Tender Summary */}
              <div className="card-premium p-5">
                <div className="flex items-center gap-2 mb-3">
                  <StatusBadge label={activeTender.status} colorClass={tenderStatusColor(activeTender.status)} />
                </div>
                <h2 className="text-base font-bold text-slate-900">{activeTender.tender_name}</h2>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4">
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Procurement</p>
                    <p className="text-sm font-medium text-slate-800 mt-0.5">{activeTender.procurement_route}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase">ITT Issued</p>
                    <p className="text-sm font-medium text-slate-800 mt-0.5">{activeTender.itt_issue_date ? formatDate(activeTender.itt_issue_date) : '—'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Return Date</p>
                    <p className="text-sm font-medium text-slate-800 mt-0.5">{activeTender.return_date ? formatDate(activeTender.return_date) : '—'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Returns</p>
                    <p className="text-sm font-medium text-slate-800 mt-0.5">{returns.length} bidder{returns.length !== 1 ? 's' : ''}</p>
                  </div>
                </div>

                {activeTender.notes && (
                  <div className="p-2.5 bg-slate-50 rounded-lg mt-3">
                    <p className="text-xs text-slate-600">{activeTender.notes}</p>
                  </div>
                )}
              </div>

              {/* Tender Returns */}
              {returns.length > 0 && (
                <div className="card-premium">
                  <div className="p-5 border-b border-slate-100">
                    <h2 className="text-[15px] font-semibold text-ink-900">Tender Returns</h2>
                  </div>

                  {/* Desktop Table */}
                  <div className="hidden sm:block overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="border-b border-slate-100">
                          <th className="px-5 py-3 text-[10px] font-bold text-slate-400 uppercase">Bidder</th>
                          <th className="px-5 py-3 text-[10px] font-bold text-slate-400 uppercase">Returned</th>
                          <th className="px-5 py-3 text-[10px] font-bold text-slate-400 uppercase">Compliance</th>
                          <th className="px-5 py-3 text-[10px] font-bold text-slate-400 uppercase">Price</th>
                          <th className="px-5 py-3 text-[10px] font-bold text-slate-400 uppercase">Weighted Score</th>
                          <th className="px-5 py-3 text-[10px] font-bold text-slate-400 uppercase">Notes</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {returns.map(ret => {
                          const evals = getTenderEvaluations(ret.id)
                          const weightedScore = evals.reduce((sum, e) => sum + (e.weighting / 100) * e.score, 0)
                          return (
                            <tr key={ret.id} className="stripe-row hover:bg-slate-50">
                              <td className="px-5 py-3 text-sm font-medium text-slate-900">{ret.bidder_name}</td>
                              <td className="px-5 py-3 text-xs text-slate-600">{formatDate(ret.return_date)}</td>
                              <td className="px-5 py-3">
                                <StatusBadge
                                  label={ret.compliance_status}
                                  colorClass={ret.compliance_status === 'Compliant' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}
                                  uppercase={false}
                                />
                              </td>
                              <td className="px-5 py-3 text-sm font-bold text-slate-900">{ret.price_summary}</td>
                              <td className="px-5 py-3">
                                {evals.length > 0 ? (
                                  <span className="text-sm font-bold text-brand-600">{weightedScore.toFixed(1)}</span>
                                ) : <span className="text-xs text-slate-400">—</span>}
                              </td>
                              <td className="px-5 py-3 text-xs text-slate-500 max-w-[200px] truncate">{ret.notes}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile Cards */}
                  <div className="sm:hidden divide-y divide-slate-100">
                    {returns.map(ret => {
                      const evals = getTenderEvaluations(ret.id)
                      const weightedScore = evals.reduce((sum, e) => sum + (e.weighting / 100) * e.score, 0)
                      return (
                        <div key={ret.id} className="p-4">
                          <div className="flex items-center justify-between mb-2">
                            <h3 className="text-sm font-semibold text-slate-900">{ret.bidder_name}</h3>
                            <StatusBadge
                              label={ret.compliance_status}
                              colorClass={ret.compliance_status === 'Compliant' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}
                              uppercase={false}
                            />
                          </div>
                          <div className="flex items-center gap-4 text-xs text-slate-500">
                            <span className="font-bold text-slate-900">{ret.price_summary}</span>
                            {evals.length > 0 && <span className="text-brand-600 font-bold">Score: {weightedScore.toFixed(1)}</span>}
                          </div>
                          {ret.notes && <p className="text-xs text-slate-400 mt-1">{ret.notes}</p>}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Evaluation Matrix */}
              {returns.some(r => getTenderEvaluations(r.id).length > 0) && (
                <div className="card-premium p-5">
                  <h2 className="text-[15px] font-semibold text-ink-900 mb-3">Evaluation Matrix</h2>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-slate-100">
                          <th className="pb-2 pr-4 text-[10px] font-bold text-slate-400 uppercase">Criterion</th>
                          <th className="pb-2 pr-4 text-[10px] font-bold text-slate-400 uppercase">Weight</th>
                          {returns.filter(r => r.compliance_status === 'Compliant').map(r => (
                            <th key={r.id} className="pb-2 pr-4 text-[10px] font-bold text-slate-400 uppercase">{r.bidder_name}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {['Price', 'Quality', 'Programme'].map(criterion => (
                          <tr key={criterion} className="stripe-row">
                            <td className="py-2 pr-4 font-medium text-slate-700">{criterion}</td>
                            <td className="py-2 pr-4 text-slate-500">
                              {getTenderEvaluations(returns[0].id).find(e => e.criterion_name === criterion)?.weighting || 0}%
                            </td>
                            {returns.filter(r => r.compliance_status === 'Compliant').map(r => {
                              const evalItem = getTenderEvaluations(r.id).find(e => e.criterion_name === criterion)
                              const weighted = evalItem ? (evalItem.weighting / 100) * evalItem.score : 0
                              return (
                                <td key={r.id} className="py-2 pr-4">
                                  {evalItem ? (
                                    <span className="font-medium text-slate-900">
                                      {evalItem.score} <span className="text-slate-400">({weighted.toFixed(1)})</span>
                                    </span>
                                  ) : '—'}
                                </td>
                              )
                            })}
                          </tr>
                        ))}
                        <tr className="border-t-2 border-slate-200">
                          <td className="py-2 pr-4 font-bold text-slate-900">Total</td>
                          <td className="py-2 pr-4 font-bold text-slate-900">100%</td>
                          {returns.filter(r => r.compliance_status === 'Compliant').map(r => {
                            const evals = getTenderEvaluations(r.id)
                            const total = evals.reduce((sum, e) => sum + (e.weighting / 100) * e.score, 0)
                            return (
                              <td key={r.id} className="py-2 pr-4 font-bold text-brand-600 text-sm">{total.toFixed(1)}</td>
                            )
                          })}
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  )
}

'use client'

import { useEffect, useState, useMemo } from 'react'
import { useParams } from 'next/navigation'
import {
  Plus, Filter, X, AlertTriangle, Shield, HardHat,
  Flame, Construction, ChevronDown, Grid3X3,
} from 'lucide-react'
import { cn } from '@/lib/utils'

/* ── Types ─────────────────────────────────────────────── */

type RiskStatus = 'Open' | 'Under Review' | 'Accepted' | 'Closed'

interface DesignRisk {
  id: string
  riskNo: string
  hazardDescription: string
  cdmCategory: string
  likelihood: number
  severity: number
  designMitigation: string
  residualLikelihood: number
  residualSeverity: number
  responsibleDesigner: string
  status: RiskStatus
  createdAt: string
}

/* ── Constants ─────────────────────────────────────────── */

const CDM_CATEGORIES = [
  'Falls from height',
  'Structural collapse',
  'Services strikes (underground/overhead)',
  'Confined spaces',
  'Fire',
  'Manual handling',
  'Hazardous materials',
  'Working at height',
  'Temporary works',
] as const

const STATUSES: RiskStatus[] = ['Open', 'Under Review', 'Accepted', 'Closed']

const STATUS_STYLES: Record<RiskStatus, string> = {
  'Open': 'bg-red-50 text-red-600',
  'Under Review': 'bg-amber-50 text-amber-600',
  'Accepted': 'bg-emerald-50 text-emerald-600',
  'Closed': 'bg-slate-50 text-slate-500',
}

function riskColor(score: number): { bg: string; fill: string; text: string } {
  if (score >= 16) return { bg: 'bg-red-100', fill: 'bg-red-500', text: 'text-red-700' }
  if (score >= 10) return { bg: 'bg-orange-100', fill: 'bg-orange-500', text: 'text-orange-700' }
  if (score >= 5) return { bg: 'bg-amber-100', fill: 'bg-amber-500', text: 'text-amber-700' }
  return { bg: 'bg-emerald-100', fill: 'bg-emerald-500', text: 'text-emerald-700' }
}

function storageKey(projectId: string) {
  return `coordin-design-risks-${projectId}`
}

function nextRiskNo(risks: DesignRisk[]): string {
  const max = risks.reduce((m, r) => {
    const n = parseInt(r.riskNo.replace('DR-', ''), 10)
    return isNaN(n) ? m : Math.max(m, n)
  }, 0)
  return `DR-${String(max + 1).padStart(3, '0')}`
}

/* ── Page ──────────────────────────────────────────────── */

export default function DesignRisksPage() {
  const params = useParams()
  const projectId = params.id as string

  const [risks, setRisks] = useState<DesignRisk[]>([])
  const [loaded, setLoaded] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [showMatrix, setShowMatrix] = useState(false)
  const [filterCategory, setFilterCategory] = useState('')
  const [filterStatus, setFilterStatus] = useState('')

  /* ── Persistence ──────────────────────────────────────── */

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey(projectId))
      if (raw) setRisks(JSON.parse(raw))
    } catch { /* ignore */ }
    setLoaded(true)
  }, [projectId])

  useEffect(() => {
    if (!loaded) return
    localStorage.setItem(storageKey(projectId), JSON.stringify(risks))
  }, [risks, loaded, projectId])

  /* ── Form state ───────────────────────────────────────── */

  const [fHazard, setFHazard] = useState('')
  const [fCategory, setFCategory] = useState(CDM_CATEGORIES[0])
  const [fLikelihood, setFLikelihood] = useState(3)
  const [fSeverity, setFSeverity] = useState(3)
  const [fMitigation, setFMitigation] = useState('')
  const [fResLikelihood, setFResLikelihood] = useState(2)
  const [fResSeverity, setFResSeverity] = useState(2)
  const [fDesigner, setFDesigner] = useState('')

  const resetForm = () => {
    setShowForm(false)
    setFHazard('')
    setFCategory(CDM_CATEGORIES[0])
    setFLikelihood(3)
    setFSeverity(3)
    setFMitigation('')
    setFResLikelihood(2)
    setFResSeverity(2)
    setFDesigner('')
  }

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault()
    if (!fHazard.trim() || !fMitigation.trim()) return
    const risk: DesignRisk = {
      id: crypto.randomUUID(),
      riskNo: nextRiskNo(risks),
      hazardDescription: fHazard.trim(),
      cdmCategory: fCategory,
      likelihood: fLikelihood,
      severity: fSeverity,
      designMitigation: fMitigation.trim(),
      residualLikelihood: fResLikelihood,
      residualSeverity: fResSeverity,
      responsibleDesigner: fDesigner.trim() || 'Unassigned',
      status: 'Open',
      createdAt: new Date().toISOString(),
    }
    setRisks((prev) => [...prev, risk])
    resetForm()
  }

  const updateStatus = (id: string, status: RiskStatus) => {
    setRisks((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)))
  }

  /* ── Derived ──────────────────────────────────────────── */

  const filtered = useMemo(() => {
    return risks.filter((r) => {
      if (filterCategory && r.cdmCategory !== filterCategory) return false
      if (filterStatus && r.status !== filterStatus) return false
      return true
    })
  }, [risks, filterCategory, filterStatus])

  const totalRisks = risks.length
  const highCritical = risks.filter((r) => r.likelihood * r.severity >= 10).length
  const underReview = risks.filter((r) => r.status === 'Under Review').length
  const accepted = risks.filter((r) => r.status === 'Accepted').length

  const summaryCards = [
    { label: 'Total Risks', count: totalRisks, color: 'text-ink-600', bg: 'bg-white', border: 'border-surface-200', icon: Shield },
    { label: 'High / Critical', count: highCritical, color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200', icon: AlertTriangle },
    { label: 'Under Review', count: underReview, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200', icon: HardHat },
    { label: 'Accepted', count: accepted, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200', icon: Construction },
  ]

  /* ── Risk matrix data ─────────────────────────────────── */

  const matrixCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    risks.forEach((r) => {
      const key = `${r.likelihood}-${r.severity}`
      counts[key] = (counts[key] || 0) + 1
    })
    return counts
  }, [risks])

  /* ── Render ─────────────────────────────────────────── */

  if (!loaded) return null

  return (
    <div className="min-h-screen bg-surface-50 p-4 lg:p-6 space-y-5">
      {/* ── Info banner ──────────────────────────────────── */}
      <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-50 border border-blue-200">
        <AlertTriangle className="w-4 h-4 text-blue-500 shrink-0" />
        <p className="text-[12px] text-blue-700">Data is stored locally. API integration pending.</p>
      </div>

      {/* ── Header ───────────────────────────────────────── */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-[15px] font-semibold text-ink-900">Design Risk Register</h2>
          <p className="text-[12px] text-ink-400 mt-0.5">CDM compliance &mdash; hazard identification &amp; design mitigation</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowMatrix(!showMatrix)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-surface-200 bg-white text-ink-600 text-[12px] font-medium hover:bg-surface-50 transition-colors"
          >
            <Grid3X3 className="w-4 h-4" />
            Risk Matrix
          </button>
          {!showForm && (
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-ink-900 text-white text-[12px] font-medium hover:bg-ink-800 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Risk
            </button>
          )}
        </div>
      </div>

      {/* ── Summary cards ────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {summaryCards.map((card) => (
          <div key={card.label} className={cn('rounded-2xl border p-4 shadow-card', card.bg, card.border)}>
            <div className="flex items-center gap-2 mb-2">
              <card.icon className={cn('w-4 h-4', card.color)} />
              <p className="text-[10px] font-medium text-ink-500 uppercase tracking-wide">{card.label}</p>
            </div>
            <p className={cn('text-[24px] font-bold', card.color)}>{card.count}</p>
          </div>
        ))}
      </div>

      {/* ── 5x5 Risk Matrix ──────────────────────────────── */}
      {showMatrix && (
        <div className="bg-white rounded-2xl border border-surface-200 shadow-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[15px] font-semibold text-ink-900">5 x 5 Risk Matrix</h3>
            <button onClick={() => setShowMatrix(false)} className="text-ink-400 hover:text-ink-600 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex gap-4">
            {/* Y axis label */}
            <div className="flex flex-col items-center justify-center">
              <span className="text-[10px] font-medium text-ink-400 writing-mode-vertical rotate-180" style={{ writingMode: 'vertical-rl' }}>
                Likelihood &rarr;
              </span>
            </div>
            <div className="flex-1">
              <div className="grid grid-cols-6 gap-1">
                {/* Header row */}
                <div />
                {[1, 2, 3, 4, 5].map((s) => (
                  <div key={s} className="text-center text-[10px] font-medium text-ink-500 pb-1">{s}</div>
                ))}
                {/* Matrix rows — likelihood 5 down to 1 */}
                {[5, 4, 3, 2, 1].map((l) => (
                  <>
                    <div key={`l-${l}`} className="flex items-center justify-center text-[10px] font-medium text-ink-500 pr-1">
                      {l}
                    </div>
                    {[1, 2, 3, 4, 5].map((s) => {
                      const score = l * s
                      const rc = riskColor(score)
                      const count = matrixCounts[`${l}-${s}`] || 0
                      return (
                        <div
                          key={`${l}-${s}`}
                          className={cn(
                            'aspect-square rounded-lg flex flex-col items-center justify-center text-[10px] font-medium relative',
                            rc.bg, rc.text,
                          )}
                        >
                          <span>{score}</span>
                          {count > 0 && (
                            <span className={cn('absolute -top-1 -right-1 w-4 h-4 rounded-full text-white text-[8px] flex items-center justify-center', rc.fill)}>
                              {count}
                            </span>
                          )}
                        </div>
                      )
                    })}
                  </>
                ))}
              </div>
              {/* X axis label */}
              <p className="text-center text-[10px] font-medium text-ink-400 mt-2">Severity &rarr;</p>
              {/* Legend */}
              <div className="flex items-center gap-4 mt-3 justify-center">
                {[
                  { label: '1-4 Low', ...riskColor(1) },
                  { label: '5-9 Medium', ...riskColor(5) },
                  { label: '10-15 High', ...riskColor(10) },
                  { label: '16-25 Critical', ...riskColor(16) },
                ].map((item) => (
                  <div key={item.label} className="flex items-center gap-1.5">
                    <span className={cn('w-3 h-3 rounded', item.bg)} />
                    <span className="text-[10px] text-ink-500">{item.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Add risk form (slide-down) ───────────────────── */}
      {showForm && (
        <form onSubmit={handleAdd} className="bg-white rounded-2xl border-2 border-accent-200 shadow-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-[15px] font-semibold text-ink-900">Add Design Risk</h3>
            <button type="button" onClick={resetForm} className="text-ink-400 hover:text-ink-600 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Row 1: Hazard + Category */}
          <div className="flex gap-4">
            <div className="flex-[2]">
              <label className="block text-[10px] font-medium text-ink-500 mb-1">
                Hazard Description <span className="text-red-400">*</span>
              </label>
              <textarea
                value={fHazard}
                onChange={(e) => setFHazard(e.target.value)}
                placeholder="Describe the identified hazard..."
                className="w-full px-3 py-2 text-[12px] border border-ink-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-300 focus:border-accent-400 placeholder:text-ink-300 min-h-[72px]"
                required
              />
            </div>
            <div className="flex-1">
              <label className="block text-[10px] font-medium text-ink-500 mb-1">CDM Category</label>
              <select
                value={fCategory}
                onChange={(e) => setFCategory(e.target.value)}
                className="w-full px-3 py-2 text-[12px] border border-ink-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-300 focus:border-accent-400 bg-white"
              >
                {CDM_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Row 2: Risk rating */}
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-[10px] font-medium text-ink-500 mb-1">Likelihood (1-5)</label>
              <select value={fLikelihood} onChange={(e) => setFLikelihood(Number(e.target.value))} className="w-full px-3 py-2 text-[12px] border border-ink-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-300 bg-white">
                {[1, 2, 3, 4, 5].map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
            <div className="flex-1">
              <label className="block text-[10px] font-medium text-ink-500 mb-1">Severity (1-5)</label>
              <select value={fSeverity} onChange={(e) => setFSeverity(Number(e.target.value))} className="w-full px-3 py-2 text-[12px] border border-ink-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-300 bg-white">
                {[1, 2, 3, 4, 5].map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
            <div className="flex-1">
              <label className="block text-[10px] font-medium text-ink-500 mb-1">Risk Score</label>
              <div className={cn('px-3 py-2 text-[12px] font-bold rounded-lg text-center', riskColor(fLikelihood * fSeverity).bg, riskColor(fLikelihood * fSeverity).text)}>
                {fLikelihood * fSeverity}
              </div>
            </div>
          </div>

          {/* Row 3: Mitigation */}
          <div>
            <label className="block text-[10px] font-medium text-ink-500 mb-1">
              Design Mitigation <span className="text-red-400">*</span>
            </label>
            <textarea
              value={fMitigation}
              onChange={(e) => setFMitigation(e.target.value)}
              placeholder="How will the design eliminate or reduce this risk?"
              className="w-full px-3 py-2 text-[12px] border border-ink-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-300 focus:border-accent-400 placeholder:text-ink-300 min-h-[60px]"
              required
            />
          </div>

          {/* Row 4: Residual risk + designer */}
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-[10px] font-medium text-ink-500 mb-1">Residual Likelihood</label>
              <select value={fResLikelihood} onChange={(e) => setFResLikelihood(Number(e.target.value))} className="w-full px-3 py-2 text-[12px] border border-ink-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-300 bg-white">
                {[1, 2, 3, 4, 5].map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
            <div className="flex-1">
              <label className="block text-[10px] font-medium text-ink-500 mb-1">Residual Severity</label>
              <select value={fResSeverity} onChange={(e) => setFResSeverity(Number(e.target.value))} className="w-full px-3 py-2 text-[12px] border border-ink-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-300 bg-white">
                {[1, 2, 3, 4, 5].map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
            <div className="flex-1">
              <label className="block text-[10px] font-medium text-ink-500 mb-1">Residual Score</label>
              <div className={cn('px-3 py-2 text-[12px] font-bold rounded-lg text-center', riskColor(fResLikelihood * fResSeverity).bg, riskColor(fResLikelihood * fResSeverity).text)}>
                {fResLikelihood * fResSeverity}
              </div>
            </div>
            <div className="flex-1">
              <label className="block text-[10px] font-medium text-ink-500 mb-1">Responsible Designer</label>
              <input
                type="text"
                value={fDesigner}
                onChange={(e) => setFDesigner(e.target.value)}
                placeholder="e.g. J. Smith"
                className="w-full px-3 py-2 text-[12px] border border-ink-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-300 focus:border-accent-400 placeholder:text-ink-300"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-1">
            <button type="button" onClick={resetForm} className="px-3.5 py-2 text-[12px] font-medium text-ink-500 hover:text-ink-700 transition-colors">
              Cancel
            </button>
            <button
              type="submit"
              disabled={!fHazard.trim() || !fMitigation.trim()}
              className={cn(
                'flex items-center gap-1.5 px-4 py-2 rounded-lg text-[12px] font-medium transition-colors',
                !fHazard.trim() || !fMitigation.trim()
                  ? 'bg-ink-200 text-ink-400 cursor-not-allowed'
                  : 'bg-ink-900 text-white hover:bg-ink-800',
              )}
            >
              <Plus className="w-3.5 h-3.5" />
              Add Risk
            </button>
          </div>
        </form>
      )}

      {/* ── Filter bar ───────────────────────────────────── */}
      <div className="flex items-center gap-3 flex-wrap">
        <Filter className="w-4 h-4 text-ink-300" />
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className="text-[12px] text-ink-600 bg-white border border-ink-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-accent-300"
        >
          <option value="">All CDM categories</option>
          {CDM_CATEGORIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="text-[12px] text-ink-600 bg-white border border-ink-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-accent-300"
        >
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        {(filterCategory || filterStatus) && (
          <button
            onClick={() => { setFilterCategory(''); setFilterStatus('') }}
            className="flex items-center gap-1 text-[12px] text-ink-400 hover:text-ink-600 transition-colors"
          >
            <X className="w-3.5 h-3.5" /> Clear
          </button>
        )}
        <span className="ml-auto text-[12px] text-ink-400">
          {filtered.length} risk{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* ── Risk register table ──────────────────────────── */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-surface-200 shadow-card p-10 text-center">
          <Shield className="w-10 h-10 text-ink-200 mx-auto mb-3" />
          <p className="text-[15px] font-medium text-ink-600">No design risks recorded</p>
          <p className="text-[12px] text-ink-400 mt-1">
            {risks.length > 0 ? 'No risks match the current filters.' : 'Add your first CDM design risk to start building the register.'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-surface-200 shadow-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-surface-200 bg-surface-50">
                  <th className="px-4 py-3 text-[10px] font-medium text-ink-500 uppercase tracking-wide">Risk No.</th>
                  <th className="px-4 py-3 text-[10px] font-medium text-ink-500 uppercase tracking-wide">Hazard</th>
                  <th className="px-4 py-3 text-[10px] font-medium text-ink-500 uppercase tracking-wide">CDM Category</th>
                  <th className="px-4 py-3 text-[10px] font-medium text-ink-500 uppercase tracking-wide text-center">L x S = Score</th>
                  <th className="px-4 py-3 text-[10px] font-medium text-ink-500 uppercase tracking-wide">Design Mitigation</th>
                  <th className="px-4 py-3 text-[10px] font-medium text-ink-500 uppercase tracking-wide text-center">Residual</th>
                  <th className="px-4 py-3 text-[10px] font-medium text-ink-500 uppercase tracking-wide">Designer</th>
                  <th className="px-4 py-3 text-[10px] font-medium text-ink-500 uppercase tracking-wide">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100">
                {filtered.map((risk) => {
                  const score = risk.likelihood * risk.severity
                  const residual = risk.residualLikelihood * risk.residualSeverity
                  const scoreColor = riskColor(score)
                  const residualColor = riskColor(residual)

                  return (
                    <tr key={risk.id} className="hover:bg-surface-50 transition-colors group">
                      <td className="px-4 py-3 text-[12px] font-mono text-ink-500 whitespace-nowrap">{risk.riskNo}</td>
                      <td className="px-4 py-3 text-[12px] text-ink-900 max-w-[200px]">
                        <p className="line-clamp-2">{risk.hazardDescription}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-ink-50 text-ink-600 whitespace-nowrap">
                          <Flame className="w-3 h-3" />
                          {risk.cdmCategory}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        <span className="text-[12px] text-ink-500">{risk.likelihood} x {risk.severity} = </span>
                        <span className={cn('inline-flex items-center justify-center w-7 h-7 rounded-lg text-[12px] font-bold', scoreColor.bg, scoreColor.text)}>
                          {score}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[12px] text-ink-700 max-w-[200px]">
                        <p className="line-clamp-2">{risk.designMitigation}</p>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={cn('inline-flex items-center justify-center w-7 h-7 rounded-lg text-[12px] font-bold', residualColor.bg, residualColor.text)}>
                          {residual}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[12px] text-ink-600 whitespace-nowrap">{risk.responsibleDesigner}</td>
                      <td className="px-4 py-3">
                        <div className="relative">
                          <select
                            value={risk.status}
                            onChange={(e) => updateStatus(risk.id, e.target.value as RiskStatus)}
                            className={cn(
                              'appearance-none text-[10px] font-medium px-2.5 py-1 pr-6 rounded-full border-0 cursor-pointer focus:outline-none focus:ring-2 focus:ring-accent-300',
                              STATUS_STYLES[risk.status],
                            )}
                          >
                            {STATUSES.map((s) => (
                              <option key={s} value={s}>{s}</option>
                            ))}
                          </select>
                          <ChevronDown className="w-3 h-3 absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none text-current opacity-50" />
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

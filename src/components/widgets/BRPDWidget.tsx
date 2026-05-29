import Link from 'next/link'
import { WidgetCard, WidgetStat, WidgetDivider } from './WidgetCard'
import { PROJECTS, BRPD_GATEWAYS, BRPD_REQUIREMENTS, COMPLIANCE_STATEMENTS } from '@/lib/mock-data'
import { cn } from '@/lib/utils'
import { BRPDRequirement, ComplianceStatement } from '@/lib/types'

export function BRPDWidget() {
  const brpdProjects = PROJECTS.filter(p => p.status === 'active').length // Simplified — all active projects assumed BRPD-enabled
  const gateways = BRPD_GATEWAYS || []
  const requirements = (BRPD_REQUIREMENTS || []) as BRPDRequirement[]
  const statements = (COMPLIANCE_STATEMENTS || []) as ComplianceStatement[]

  const openActions = requirements.filter(r => r.status === 'in_progress' || r.status === 'not_started').length
  const overdueReqs = requirements.filter(r => r.target_date && new Date(r.target_date) < new Date() && r.status !== 'verified' && r.status !== 'evidenced').length
  const compliantStatements = statements.filter(s => s.status === 'approved').length
  const totalStatements = statements.length

  const readinessScore = totalStatements > 0 ? Math.round((compliantStatements / totalStatements) * 100) : 0

  return (
    <WidgetCard
      title="BRPD / Compliance"
      icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" /></svg>}
    >
      <div className="grid grid-cols-3 gap-3">
        <WidgetStat label="Open Actions" value={openActions} color={openActions > 0 ? 'text-amber-600' : 'text-emerald-600'} />
        <WidgetStat label="Overdue Items" value={overdueReqs} color={overdueReqs > 0 ? 'text-red-600' : 'text-emerald-600'} />
        <WidgetStat label="Readiness" value={`${readinessScore}%`} color={readinessScore >= 80 ? 'text-emerald-600' : readinessScore >= 50 ? 'text-amber-600' : 'text-red-600'} />
      </div>

      {overdueReqs > 0 && (
        <>
          <WidgetDivider />
          <div className="px-3 py-2 rounded-lg bg-red-50 border border-red-100">
            <p className="text-[11px] font-medium text-red-700">{overdueReqs} BRPD requirement{overdueReqs > 1 ? 's' : ''} overdue</p>
            <p className="text-[10px] text-red-500 mt-0.5">Review required before next gateway</p>
          </div>
        </>
      )}

      <WidgetDivider />

      {/* Compliance progress */}
      <p className="text-[10px] font-semibold text-ink-400 uppercase tracking-wider mb-2">Compliance Progress</p>
      <div className="w-full bg-surface-100 rounded-full h-2">
        <div
          className={cn('h-2 rounded-full transition-all', readinessScore >= 80 ? 'bg-emerald-500' : readinessScore >= 50 ? 'bg-amber-400' : 'bg-red-500')}
          style={{ width: `${readinessScore}%` }}
        />
      </div>
      <p className="text-[10px] text-ink-400 mt-1">{compliantStatements} of {totalStatements} compliance statements met</p>

      <WidgetDivider />

      <Link href="/projects" className="text-[11px] text-accent-500 hover:text-accent-600 font-semibold transition-colors">
        View BRPD projects →
      </Link>
    </WidgetCard>
  )
}

import Link from 'next/link'
import { WidgetCard, WidgetStat, WidgetDivider } from './WidgetCard'
import { PROJECTS, BRPD_GATEWAYS, BRPD_REQUIREMENTS, COMPLIANCE_STATEMENTS } from '@/lib/mock-data'
import { cn } from '@/lib/utils'
import { BRPDRequirement, ComplianceStatement } from '@/lib/types'
import { ShieldCheck } from 'lucide-react'

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
      icon={<ShieldCheck className="w-4 h-4" />}
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

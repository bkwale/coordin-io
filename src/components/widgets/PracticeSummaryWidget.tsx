import Link from 'next/link'
import { WidgetCard, WidgetStat, WidgetDivider } from './WidgetCard'
import { PROJECTS, ALL_TASKS, APPROVALS, getOpenInvoiceValue, getDashboardKPIs } from '@/lib/mock-data'
import { isOverdue } from '@/lib/utils'

export function PracticeSummaryWidget() {
  const kpis = getDashboardKPIs()
  const activeProjects = PROJECTS.filter(p => p.status === 'active')
  const overdueTasks = ALL_TASKS.filter(t => isOverdue(t.due_date) && t.status !== 'done')
  const pendingApprovals = APPROVALS.filter(a => a.status === 'pending')
  const openInvoice = getOpenInvoiceValue()

  return (
    <WidgetCard
      title="Practice Summary"
      icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></svg>}
    >
      <div className="grid grid-cols-4 gap-4">
        <WidgetStat label="Active Projects" value={activeProjects.length} />
        <WidgetStat label="At Risk" value={kpis.projects_at_risk} color={kpis.projects_at_risk > 0 ? 'text-red-600' : 'text-emerald-600'} />
        <WidgetStat label="Overdue Tasks" value={overdueTasks.length} color={overdueTasks.length > 0 ? 'text-amber-600' : 'text-emerald-600'} />
        <WidgetStat label="Approvals" value={pendingApprovals.length} color={pendingApprovals.length > 0 ? 'text-blue-600' : 'text-ink-900'} />
      </div>

      <WidgetDivider />

      <div className="grid grid-cols-2 gap-4">
        <WidgetStat label="Open Invoice Value" value={`£${(openInvoice / 1000).toFixed(0)}k`} />
        <WidgetStat label="BRPD Deadlines" value={kpis.brpd_deadlines} color={kpis.brpd_deadlines > 0 ? 'text-amber-600' : 'text-emerald-600'} />
      </div>

      <WidgetDivider />

      <div className="flex items-center justify-between">
        <Link href="/projects" className="text-[11px] text-accent-500 hover:text-accent-600 font-semibold transition-colors">
          View all projects →
        </Link>
        <Link href="/approvals" className="text-[11px] text-accent-500 hover:text-accent-600 font-semibold transition-colors">
          View approvals →
        </Link>
      </div>
    </WidgetCard>
  )
}

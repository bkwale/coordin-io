import Link from 'next/link'
import { WidgetCard, WidgetDivider } from './WidgetCard'
import { PROJECTS, getProjectTasks, getUser, INVOICES } from '@/lib/mock-data'
import { calculateRisks, calculateHealth } from '@/lib/risk-engine'
import { isOverdue, cn } from '@/lib/utils'
import { AlertTriangle } from 'lucide-react'

interface RiskRow {
  projectId: string
  projectName: string
  client: string
  lead: string
  stage: number
  burnRatio?: number
  overdueItems: number
  riskReason: string
  health: 'red' | 'amber'
}

export function JobsAtRiskWidget() {
  const riskRows: RiskRow[] = []

  PROJECTS.filter(p => p.status === 'active').forEach(p => {
    const tasks = getProjectTasks(p.id)
    const risks = calculateRisks(p, tasks)
    const overdueTasks = tasks.filter(t => isOverdue(t.due_date) && t.status !== 'done')
    const health = calculateHealth(risks, overdueTasks)
    const overdueInvoices = INVOICES.filter(i => i.project_id === p.id && i.status === 'overdue')
    const lead = p.project_lead_user_id ? getUser(p.project_lead_user_id) : undefined

    if (health === 'red' || health === 'amber') {
      let reason = ''
      if (overdueInvoices.length > 0) reason = 'Invoice overdue'
      else if (tasks.some(t => t.status === 'blocked')) reason = 'Stage blocked'
      else if (overdueTasks.length > 2) reason = `${overdueTasks.length} overdue tasks`
      else if (risks.filter(r => r.severity === 'high').length > 0) reason = 'High risk items'
      else reason = 'Needs review'

      riskRows.push({
        projectId: p.id,
        projectName: p.name,
        client: p.client,
        lead: lead?.name || 'Unassigned',
        stage: p.current_stage,
        overdueItems: overdueTasks.length,
        riskReason: reason,
        health: health as 'red' | 'amber',
      })
    }
  })

  // Sort: red first, then by overdue count
  riskRows.sort((a, b) => {
    if (a.health !== b.health) return a.health === 'red' ? -1 : 1
    return b.overdueItems - a.overdueItems
  })

  return (
    <WidgetCard
      title="Jobs At Risk"
      icon={<AlertTriangle className="w-4 h-4" />}
    >
      {riskRows.length === 0 ? (
        <p className="text-[12px] text-ink-300 italic">No projects at risk — all clear.</p>
      ) : (
        <div className="space-y-2">
          {riskRows.map(row => (
            <Link
              key={row.projectId}
              href={`/projects/${row.projectId}/health`}
              className="block px-3 py-2.5 -mx-1 rounded-lg hover:bg-surface-50 transition-colors group"
            >
              <div className="flex items-start justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className={cn('w-2 h-2 rounded-full shrink-0', row.health === 'red' ? 'bg-red-500' : 'bg-amber-400')} />
                    <p className="text-[12px] font-medium text-ink-800 group-hover:text-accent-600 transition-colors truncate">{row.projectName}</p>
                  </div>
                  <p className="text-[10px] text-ink-400 mt-0.5 ml-4">{row.client} · Stage {row.stage} · {row.lead}</p>
                </div>
                <span className={cn('status-pill text-[9px] shrink-0 ml-2', row.health === 'red' ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600')}>
                  {row.riskReason}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}

      <WidgetDivider />

      <Link href="/analytics/portfolio" className="text-[11px] text-accent-500 hover:text-accent-600 font-semibold transition-colors">
        Portfolio health →
      </Link>
    </WidgetCard>
  )
}

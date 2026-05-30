import Link from 'next/link'
import { WidgetCard } from './WidgetCard'
import { getProjectUpdates, INVOICES, APPROVALS, FEE_QUOTE_RECORDS, USERS } from '@/lib/mock-data'
import { cn } from '@/lib/utils'
import { Clock } from 'lucide-react'

interface ActivityItem {
  id: string
  label: string
  detail: string
  timestamp: string
  type: 'project' | 'quote' | 'invoice' | 'approval' | 'staff'
  href?: string
}

export function RecentActivityWidget() {
  const activities: ActivityItem[] = []

  // Project updates
  getProjectUpdates().slice(0, 5).forEach(u => {
    activities.push({
      id: u.id,
      label: u.project_name,
      detail: u.description,
      timestamp: u.timestamp,
      type: 'project',
      href: `/projects/${u.project_id}`,
    })
  })

  // Recent invoices
  INVOICES.filter(i => i.status !== 'draft').forEach(i => {
    activities.push({
      id: i.id,
      label: `Invoice ${i.invoice_number}`,
      detail: `${i.status === 'paid' ? 'Paid' : i.status === 'overdue' ? 'Overdue' : 'Sent'} — £${i.total_amount.toLocaleString()}`,
      timestamp: i.updated_at,
      type: 'invoice',
    })
  })

  // Recent quote events
  FEE_QUOTE_RECORDS.filter(q => q.status === 'accepted' || q.status === 'viewed').forEach(q => {
    activities.push({
      id: q.id,
      label: `Quote ${q.quote_reference}`,
      detail: `${q.status === 'accepted' ? 'Accepted' : 'Viewed'} — ${q.quote_title}`,
      timestamp: q.updated_at,
      type: 'quote',
      href: `/fee-quotes/${q.id}`,
    })
  })

  // Sort by timestamp, newest first
  activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

  const typeColor = (type: ActivityItem['type']) => {
    switch (type) {
      case 'project': return 'bg-blue-400'
      case 'quote': return 'bg-violet-400'
      case 'invoice': return 'bg-emerald-400'
      case 'approval': return 'bg-amber-400'
      case 'staff': return 'bg-sky-400'
    }
  }

  const timeAgo = (ts: string) => {
    const diff = Date.now() - new Date(ts).getTime()
    const hours = Math.floor(diff / 3600000)
    if (hours < 1) return 'Just now'
    if (hours < 24) return `${hours}h ago`
    const days = Math.floor(hours / 24)
    if (days < 7) return `${days}d ago`
    return `${Math.floor(days / 7)}w ago`
  }

  return (
    <WidgetCard
      title="Recent Activity"
      icon={<Clock className="w-4 h-4" />}
    >
      <div className="space-y-0.5">
        {activities.slice(0, 10).map(item => {
          const content = (
            <div className="flex items-start gap-3 py-2 px-2 -mx-2 rounded-lg hover:bg-surface-50 transition-colors group">
              <span className={cn('w-2 h-2 rounded-full mt-1.5 shrink-0', typeColor(item.type))} />
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-medium text-ink-700 group-hover:text-accent-600 transition-colors truncate">{item.label}</p>
                <p className="text-[10px] text-ink-400 mt-0.5 line-clamp-1">{item.detail}</p>
              </div>
              <span className="text-[9px] text-ink-300 shrink-0 tabular-nums">{timeAgo(item.timestamp)}</span>
            </div>
          )
          return item.href ? <Link key={item.id} href={item.href}>{content}</Link> : <div key={item.id}>{content}</div>
        })}
      </div>
    </WidgetCard>
  )
}

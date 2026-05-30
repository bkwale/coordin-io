import Link from 'next/link'
import { WidgetCard, WidgetDivider } from './WidgetCard'
import { getProjectUpdates } from '@/lib/mock-data'
import { cn, updateSeverityDot } from '@/lib/utils'
import { Newspaper } from 'lucide-react'

export function ProjectUpdatesWidget() {
  const updates = getProjectUpdates()

  const eventTypeLabel = (type: string) => {
    switch (type) {
      case 'milestone': return 'Milestone'
      case 'upload_missing': return 'Upload Missing'
      case 'planning_due': return 'Planning'
      case 'approval_returned': return 'Approval'
      case 'stage_blocked': return 'Blocked'
      case 'drawing_issued': return 'Drawing Issue'
      case 'brpd_upload': return 'BRPD'
      case 'site_query': return 'Site Query'
      case 'invoice_issued': return 'Invoice'
      case 'quote_accepted': return 'Quote'
      default: return type
    }
  }

  const timeAgo = (ts: string) => {
    const diff = Date.now() - new Date(ts).getTime()
    const hours = Math.floor(diff / 3600000)
    if (hours < 1) return 'Just now'
    if (hours < 24) return `${hours}h ago`
    const days = Math.floor(hours / 24)
    return `${days}d ago`
  }

  return (
    <WidgetCard
      title="Project Updates"
      icon={<Newspaper className="w-4 h-4" />}
    >
      <div className="space-y-0.5">
        {updates.slice(0, 8).map(update => (
          <Link
            key={update.id}
            href={`/projects/${update.project_id}`}
            className="flex items-start gap-3 py-2.5 px-2 -mx-2 rounded-lg hover:bg-surface-50 transition-colors group"
          >
            <span className={cn('w-2 h-2 rounded-full mt-1.5 shrink-0', updateSeverityDot(update.severity))} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-[11px] font-medium text-ink-800 group-hover:text-accent-600 transition-colors truncate">{update.project_name}</p>
                <span className="status-pill text-[8px] bg-surface-100 text-ink-500">{eventTypeLabel(update.event_type)}</span>
              </div>
              <p className="text-[10px] text-ink-500 mt-0.5 line-clamp-1">{update.description}</p>
              <p className="text-[9px] text-ink-300 mt-0.5">{timeAgo(update.timestamp)}{update.actor ? ` · ${update.actor}` : ''}</p>
            </div>
          </Link>
        ))}
      </div>
    </WidgetCard>
  )
}

import Link from 'next/link'
import { WidgetCard, WidgetDivider } from './WidgetCard'
import { getProjectUpdates } from '@/lib/mock-data'
import { cn, updateSeverityDot } from '@/lib/utils'

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
      icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 7.5h1.5m-1.5 3h1.5m-7.5 3h7.5m-7.5 3h7.5m3-9h3.375c.621 0 1.125.504 1.125 1.125V18a2.25 2.25 0 01-2.25 2.25M16.5 7.5V18a2.25 2.25 0 002.25 2.25M16.5 7.5V4.875c0-.621-.504-1.125-1.125-1.125H4.125C3.504 3.75 3 4.254 3 4.875V18a2.25 2.25 0 002.25 2.25h13.5M6 7.5h3v3H6v-3z" /></svg>}
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

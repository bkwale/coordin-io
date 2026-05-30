import Link from 'next/link'
import { WidgetCard, WidgetDivider } from './WidgetCard'
import { PROJECTS, FEE_QUOTE_RECORDS, INVOICES, getUpcomingBankHolidays, getUpcomingLeave, BRPD_REQUIREMENTS } from '@/lib/mock-data'
import { cn, formatDate } from '@/lib/utils'
import { BRPDRequirement } from '@/lib/types'
import { Calendar } from 'lucide-react'

interface CalendarEvent {
  date: string
  label: string
  project?: string
  type: 'deadline' | 'invoice' | 'quote' | 'holiday' | 'leave' | 'brpd'
}

export function CalendarDeadlinesWidget() {
  const events: CalendarEvent[] = []
  const now = new Date()
  const in30Days = new Date(now.getTime() + 30 * 86400000)

  // Quote expiry dates
  FEE_QUOTE_RECORDS.filter(q => q.valid_until && new Date(q.valid_until) >= now && new Date(q.valid_until) <= in30Days && (q.status === 'sent' || q.status === 'viewed')).forEach(q => {
    events.push({ date: q.valid_until, label: `Quote expires: ${q.quote_title}`, project: q.quote_title, type: 'quote' })
  })

  // Invoice due dates
  INVOICES.filter(i => new Date(i.due_date) >= now && new Date(i.due_date) <= in30Days && ['sent', 'viewed', 'due'].includes(i.status)).forEach(i => {
    events.push({ date: i.due_date, label: `Invoice due: ${i.invoice_number}`, project: i.description, type: 'invoice' })
  })

  // BRPD deadlines
  if (BRPD_REQUIREMENTS) {
    (BRPD_REQUIREMENTS as BRPDRequirement[]).filter(r => r.target_date && new Date(r.target_date) >= now && new Date(r.target_date) <= in30Days).forEach(r => {
      events.push({ date: r.target_date, label: `BRPD: ${r.title}`, type: 'brpd' })
    })
  }

  // Bank holidays
  getUpcomingBankHolidays(30).forEach(h => {
    events.push({ date: h.date, label: h.name, type: 'holiday' })
  })

  // Sort by date
  events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

  const typeColor = (type: CalendarEvent['type']) => {
    switch (type) {
      case 'deadline': return 'bg-red-400'
      case 'invoice': return 'bg-emerald-400'
      case 'quote': return 'bg-blue-400'
      case 'holiday': return 'bg-violet-400'
      case 'leave': return 'bg-sky-400'
      case 'brpd': return 'bg-amber-400'
    }
  }

  const typePill = (type: CalendarEvent['type']) => {
    switch (type) {
      case 'deadline': return 'bg-red-50 text-red-600'
      case 'invoice': return 'bg-emerald-50 text-emerald-600'
      case 'quote': return 'bg-blue-50 text-blue-600'
      case 'holiday': return 'bg-violet-50 text-violet-600'
      case 'leave': return 'bg-sky-50 text-sky-600'
      case 'brpd': return 'bg-amber-50 text-amber-600'
    }
  }

  return (
    <WidgetCard
      title="Calendar & Deadlines"
      icon={<Calendar className="w-4 h-4" />}
    >
      {events.length === 0 ? (
        <p className="text-[12px] text-ink-300 italic">No upcoming deadlines</p>
      ) : (
        <div className="space-y-1.5">
          {events.slice(0, 8).map((event, i) => (
            <div key={i} className="flex items-center gap-3 py-1.5">
              <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', typeColor(event.type))} />
              <div className="flex-1 min-w-0">
                <p className="text-[11px] text-ink-700 truncate">{event.label}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className={cn('status-pill text-[8px]', typePill(event.type))}>{event.type}</span>
                <span className="text-[10px] text-ink-400 tabular-nums font-mono">{formatDate(event.date)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </WidgetCard>
  )
}

'use client'

import { useEffect, useState } from 'react'
import { Calendar, AlertTriangle } from 'lucide-react'
import { WidgetCard, WidgetStat, WidgetRow, WidgetDivider } from './WidgetCard'
import { cn } from '@/lib/utils'

interface UrgentTask {
  id: string
  title: string
  projectName: string
  projectCode: string
  status: string
  priority: string
  dueDate: string | null
  estimatedHours: number | null
}

export function CalendarDeadlinesWidget() {
  const [tasks, setTasks] = useState<UrgentTask[]>([])
  const [overdue, setOverdue] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchDeadlines() {
      try {
        const res = await fetch('/api/dashboard')
        if (!res.ok) throw new Error('Failed to load deadlines')
        const json = await res.json()
        setTasks(json.data?.urgentTasks ?? [])
        setOverdue(json.data?.stats?.overdueTasks ?? 0)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong')
      } finally {
        setLoading(false)
      }
    }
    fetchDeadlines()
  }, [])

  function isPast(dateStr: string | null): boolean {
    if (!dateStr) return false
    return new Date(dateStr) < new Date()
  }

  function formatDate(dateStr: string | null): string {
    if (!dateStr) return 'No date'
    return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  }

  const displayTasks = tasks.slice(0, 5)

  return (
    <WidgetCard
      title="Upcoming Deadlines"
      icon={<Calendar className="w-4 h-4" />}
      isLoading={loading}
    >
      {error ? (
        <p className="text-[12px] text-red-500">{error}</p>
      ) : (
        <>
          {overdue > 0 && (
            <>
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
                <WidgetStat label="Overdue" value={overdue} color="text-red-600" />
              </div>
              <WidgetDivider />
            </>
          )}

          {displayTasks.length === 0 ? (
            <p className="text-[12px] text-ink-400">No upcoming deadlines</p>
          ) : (
            <div className="space-y-0.5">
              {displayTasks.map(task => (
                <WidgetRow key={task.id} href={`/projects`}>
                  <div className="min-w-0 flex-1">
                    <p className="text-[12px] font-medium text-ink-800 truncate">{task.title}</p>
                    <p className="text-[10px] text-ink-400 truncate">{task.projectCode} &middot; {task.projectName}</p>
                  </div>
                  <span
                    className={cn(
                      'text-[11px] font-medium shrink-0 ml-2',
                      isPast(task.dueDate) ? 'text-red-600' : 'text-ink-500'
                    )}
                  >
                    {formatDate(task.dueDate)}
                  </span>
                </WidgetRow>
              ))}
            </div>
          )}
        </>
      )}
    </WidgetCard>
  )
}

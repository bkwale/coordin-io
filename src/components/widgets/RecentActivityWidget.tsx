'use client'

import { useEffect, useState } from 'react'
import { Activity } from 'lucide-react'
import { cn } from '@/lib/utils'
import { WidgetCard, WidgetStat, WidgetRow, WidgetDivider } from './WidgetCard'

interface DashboardProject {
  id: string
  name: string
  code: string
  healthStatus: string
  myTaskCount: number
  overdueTaskCount: number
  inReviewTaskCount: number
}

interface DashboardData {
  stats: {
    totalTasks: number
    overdueTasks: number
    inReviewTasks: number
    completedThisWeek: number
  }
  projects: DashboardProject[]
}

export function RecentActivityWidget() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/dashboard')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load activity')
        return res.json()
      })
      .then((json) => {
        setData(json.data ?? null)
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  const activeProjects = (data?.projects ?? [])
    .filter((p) => p.myTaskCount > 0)
    .slice(0, 5)

  return (
    <WidgetCard
      title="Recent Activity"
      icon={<Activity className="w-4 h-4" />}
      isLoading={loading}
    >
      {error ? (
        <p className="text-[12px] text-ink-400">{error}</p>
      ) : !data ? (
        <p className="text-[12px] text-ink-400">No activity data</p>
      ) : (
        <>
          {/* Stats row */}
          <div className="flex items-center justify-around mb-4">
            <WidgetStat
              label="Completed this week"
              value={data.stats.completedThisWeek}
              color="text-emerald-600"
            />
            <WidgetStat
              label="In review"
              value={data.stats.inReviewTasks}
              color="text-blue-600"
            />
            <WidgetStat
              label="Overdue"
              value={data.stats.overdueTasks}
              color={data.stats.overdueTasks > 0 ? 'text-red-600' : 'text-ink-900'}
            />
          </div>

          <WidgetDivider />

          {/* Active projects */}
          {activeProjects.length === 0 ? (
            <p className="text-[12px] text-ink-400 mt-2">No active project tasks</p>
          ) : (
            <div className="space-y-0 mt-1">
              {activeProjects.map((project, i) => (
                <div key={project.id}>
                  {i > 0 && <WidgetDivider />}
                  <WidgetRow href={`/projects/${project.id}/tasks`}>
                    <span className="text-[13px] text-ink-700 font-medium truncate">
                      {project.name}
                    </span>
                    <span className={cn(
                      'text-[10px] font-medium px-2 py-0.5 rounded-full shrink-0',
                      'bg-surface-100 text-ink-600'
                    )}>
                      {project.myTaskCount} {project.myTaskCount === 1 ? 'task' : 'tasks'}
                    </span>
                  </WidgetRow>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </WidgetCard>
  )
}

'use client'

import { useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { WidgetCard, WidgetRow, WidgetDivider } from './WidgetCard'

interface Project {
  id: string
  name: string
  code: string
  status: string
  updatedAt: string
  _count: { tasks: number; memberships: number }
}

function formatRelativeTime(dateStr: string): string {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diffMs = now - then
  const diffMin = Math.floor(diffMs / 60_000)
  const diffHr = Math.floor(diffMs / 3_600_000)
  const diffDay = Math.floor(diffMs / 86_400_000)

  if (diffMin < 60) return `${Math.max(1, diffMin)}m ago`
  if (diffHr < 24) return `${diffHr}h ago`
  if (diffDay < 7) return `${diffDay}d ago`
  return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

export function ProjectUpdatesWidget() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/projects')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load projects')
        return res.json()
      })
      .then((json) => {
        const all: Project[] = json.data?.projects ?? []
        setProjects(all.slice(0, 5))
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  return (
    <WidgetCard
      title="Recent Updates"
      icon={<RefreshCw className="w-4 h-4" />}
      isLoading={loading}
    >
      {error ? (
        <p className="text-[12px] text-ink-400">{error}</p>
      ) : projects.length === 0 ? (
        <p className="text-[12px] text-ink-400">No recent updates</p>
      ) : (
        <div className="space-y-0">
          {projects.map((project, i) => (
            <div key={project.id}>
              {i > 0 && <WidgetDivider />}
              <WidgetRow href={`/projects/${project.id}`}>
                <div className="flex flex-col min-w-0">
                  <span className="text-[13px] text-ink-700 font-medium truncate">
                    {project.name}
                  </span>
                  <span className="text-[11px] text-ink-400">{project.code}</span>
                </div>
                <span className="text-[11px] text-ink-400 shrink-0">
                  {formatRelativeTime(project.updatedAt)}
                </span>
              </WidgetRow>
            </div>
          ))}
        </div>
      )}
    </WidgetCard>
  )
}

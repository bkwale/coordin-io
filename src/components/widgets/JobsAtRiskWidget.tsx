'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { WidgetCard, WidgetRow, WidgetDivider } from './WidgetCard'

interface Project {
  id: string
  name: string
  code: string
  status: string
  healthStatus: 'GREEN' | 'AMBER' | 'RED'
  _count: { tasks: number; memberships: number }
}

const HEALTH_CONFIG = {
  RED: { label: 'At Risk', dotClass: 'bg-red-500', textClass: 'text-red-700' },
  AMBER: { label: 'Needs Attention', dotClass: 'bg-amber-500', textClass: 'text-amber-700' },
  GREEN: { label: 'On Track', dotClass: 'bg-emerald-500', textClass: 'text-emerald-700' },
} as const

export function JobsAtRiskWidget() {
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
        const atRisk = all
          .filter((p) => p.status === 'ACTIVE' && (p.healthStatus === 'RED' || p.healthStatus === 'AMBER'))
          .sort((a, b) => {
            if (a.healthStatus === 'RED' && b.healthStatus !== 'RED') return -1
            if (a.healthStatus !== 'RED' && b.healthStatus === 'RED') return 1
            return 0
          })
        setProjects(atRisk)
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  return (
    <WidgetCard
      title="Jobs at Risk"
      icon={<AlertTriangle className="w-4 h-4" />}
      isLoading={loading}
    >
      {error ? (
        <p className="text-[12px] text-ink-400">{error}</p>
      ) : projects.length === 0 ? (
        <p className="text-[12px] text-emerald-600 font-medium">All projects on track</p>
      ) : (
        <div className="space-y-0">
          {projects.map((project, i) => {
            const config = HEALTH_CONFIG[project.healthStatus]
            return (
              <div key={project.id}>
                {i > 0 && <WidgetDivider />}
                <WidgetRow href={`/projects/${project.id}`}>
                  <span className="text-[13px] text-ink-700 font-medium truncate">
                    {project.name}
                  </span>
                  <span className={cn('flex items-center gap-1.5 text-[11px] font-medium shrink-0', config.textClass)}>
                    <span className={cn('w-2 h-2 rounded-full', config.dotClass)} />
                    {config.label}
                  </span>
                </WidgetRow>
              </div>
            )
          })}
        </div>
      )}
    </WidgetCard>
  )
}

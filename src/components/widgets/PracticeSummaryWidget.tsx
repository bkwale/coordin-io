'use client'

import { useEffect, useState } from 'react'
import { Briefcase } from 'lucide-react'
import { WidgetCard, WidgetStat } from './WidgetCard'
import { cn } from '@/lib/utils'

interface Project {
  id: string
  status: 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'ARCHIVED'
  healthStatus: 'GREEN' | 'AMBER' | 'RED'
}

export function PracticeSummaryWidget() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchProjects() {
      try {
        const res = await fetch('/api/projects')
        if (!res.ok) throw new Error('Failed to load projects')
        const json = await res.json()
        setProjects(json.data?.projects ?? [])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong')
      } finally {
        setLoading(false)
      }
    }
    fetchProjects()
  }, [])

  const total = projects.length
  const active = projects.filter(p => p.status === 'ACTIVE').length
  const paused = projects.filter(p => p.status === 'PAUSED').length
  const completed = projects.filter(p => p.status === 'COMPLETED').length

  return (
    <WidgetCard
      title="Practice Summary"
      icon={<Briefcase className="w-4 h-4" />}
      isLoading={loading}
    >
      {error ? (
        <p className="text-[12px] text-red-500">{error}</p>
      ) : total === 0 ? (
        <p className="text-[12px] text-ink-400">No projects found</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <WidgetStat label="Total" value={total} />
          <WidgetStat label="Active" value={active} color="text-emerald-600" />
          <WidgetStat label="Paused" value={paused} color="text-amber-600" />
          <WidgetStat label="Completed" value={completed} color="text-blue-600" />
        </div>
      )}
    </WidgetCard>
  )
}

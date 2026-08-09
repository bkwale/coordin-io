'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { FolderOpen, Plus, Loader2, AlertTriangle, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Project {
  id: string
  name: string
  code: string
  stage: string
  healthStatus: string
  status: string
  client: string | null
  createdAt: string
}

const HEALTH_COLORS: Record<string, string> = {
  GREEN: 'bg-emerald-400',
  AMBER: 'bg-amber-400',
  RED: 'bg-red-400',
  GREY: 'bg-slate-300',
}

const STAGE_LABELS: Record<string, string> = {
  STRATEGIC_DEFINITION: 'Strategic Definition',
  PREPARATION_AND_BRIEFING: 'Preparation & Briefing',
  CONCEPT_DESIGN: 'Concept Design',
  SPATIAL_COORDINATION: 'Spatial Coordination',
  TECHNICAL_DESIGN: 'Technical Design',
  MANUFACTURING_AND_CONSTRUCTION: 'Manufacturing & Construction',
  HANDOVER: 'Handover',
  USE: 'Use',
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function fetchProjects() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/projects')
      if (!res.ok) throw new Error('Failed to load projects')
      const json = await res.json()
      setProjects(json.data?.projects || json.data || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchProjects() }, [])

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <Loader2 className="w-8 h-8 text-accent-500 animate-spin" />
        <p className="text-[13px] text-ink-400">Loading projects...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <AlertTriangle className="w-10 h-10 text-red-400" />
        <p className="text-[15px] font-medium text-ink-900">Unable to load projects</p>
        <p className="text-[13px] text-ink-400">{error}</p>
        <button onClick={fetchProjects} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-ink-900 text-white text-[13px] font-medium hover:bg-ink-800">
          <RefreshCw className="w-4 h-4" /> Try again
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold text-ink-900">Projects</h1>
          <p className="text-[13px] text-ink-400 mt-1">{projects.length} {projects.length === 1 ? 'project' : 'projects'}</p>
        </div>
        <Link
          href="/projects/new"
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-ink-900 text-white text-[13px] font-medium hover:bg-ink-800 transition-colors self-start shrink-0"
        >
          <Plus className="w-4 h-4" />
          New Project
        </Link>
      </div>

      {projects.length === 0 ? (
        <div className="bg-white rounded-xl border border-ink-100 p-12 text-center">
          <FolderOpen className="w-12 h-12 text-ink-200 mx-auto mb-4" />
          <p className="text-[15px] font-medium text-ink-700">No projects yet</p>
          <p className="text-[12px] text-ink-400 mt-2 max-w-md mx-auto">
            Create your first project to start tracking tasks, documents, and progress.
          </p>
          <Link
            href="/projects/new"
            className="inline-flex items-center gap-2 mt-4 px-4 py-2 rounded-lg bg-ink-900 text-white text-[13px] font-medium hover:bg-ink-800 transition-colors"
          >
            <Plus className="w-4 h-4" /> Create Project
          </Link>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map(project => (
            <Link
              key={project.id}
              href={`/projects/${project.id}`}
              className="bg-white rounded-xl border border-ink-100 p-5 hover:shadow-md hover:-translate-y-0.5 transition-all group"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="min-w-0">
                  <p className="text-[14px] font-semibold text-ink-900 truncate group-hover:text-accent-700 transition-colors">
                    {project.name}
                  </p>
                  <p className="text-[11px] text-ink-400 mt-0.5">{project.code}</p>
                </div>
                <span className={cn(
                  'w-2.5 h-2.5 rounded-full shrink-0 mt-1',
                  HEALTH_COLORS[project.healthStatus] || 'bg-ink-200',
                )} />
              </div>
              <p className="text-[11px] text-ink-400 mb-2">
                Stage: <span className="text-ink-600 font-medium">
                  {STAGE_LABELS[project.stage] || project.stage.replace(/_/g, ' ')}
                </span>
              </p>
              {project.client && (
                <p className="text-[11px] text-ink-400">
                  Client: <span className="text-ink-600">{project.client}</span>
                </p>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

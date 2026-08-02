'use client'

import { useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'

/**
 * Site Queries redirect — service requests filtered by project.
 *
 * Redirects to the main service requests page with a project filter.
 * The full service request module lives at /service-requests.
 */
export default function SiteQueriesPage() {
  const router = useRouter()
  const params = useParams()
  const projectId = params?.id as string

  useEffect(() => {
    if (projectId) {
      router.replace(`/service-requests?projectId=${projectId}&tab=all`)
    } else {
      router.replace('/service-requests')
    }
  }, [projectId, router])

  return (
    <div className="flex items-center justify-center min-h-[40vh]">
      <div className="text-center space-y-2">
        <div className="w-6 h-6 border-2 border-ink-300 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-[13px] text-ink-400">Redirecting to service requests...</p>
      </div>
    </div>
  )
}

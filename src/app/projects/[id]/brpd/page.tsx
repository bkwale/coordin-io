'use client'

import { useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'

/**
 * BRPD page — redirects to Building Regs which already has BRPD as its first tab.
 * This avoids duplicate content while keeping the sidebar link functional.
 */
export default function BRPDPage() {
  const params = useParams()
  const router = useRouter()
  const projectId = params.id as string

  useEffect(() => {
    router.replace(`/projects/${projectId}/building-regs`)
  }, [projectId, router])

  return (
    <div className="min-h-screen bg-surface-50 flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="w-5 h-5 text-accent-500 animate-spin" />
        <p className="text-[12px] text-ink-400">
          Redirecting to Building Regulations &amp; BRPD...
        </p>
      </div>
    </div>
  )
}

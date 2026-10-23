'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useProfile } from '@/hooks/useProfile'

/**
 * /profile → redirects to /staffing/[profileId]
 * Handles legacy bookmarks and direct navigation.
 */
export default function ProfileRedirect() {
  const router = useRouter()
  const { profile } = useProfile()

  useEffect(() => {
    if (profile?.id) {
      router.replace(`/staffing/${profile.id}`)
    }
  }, [profile, router])

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <p className="text-white/40 text-sm">Redirecting to your profile…</p>
    </div>
  )
}

'use client'

import { useEffect, useState } from 'react'

interface ProfileData {
  id: string
  fullName: string
  email: string
  jobTitle: string | null
  orgPermission: string
  managerId: string | null
  organisationId: string
}

export function useProfile() {
  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/me')
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        setProfile(data?.data ?? data?.profile ?? data ?? null)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  return { profile, loading }
}

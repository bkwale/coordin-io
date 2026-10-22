'use client'

import { useEffect, useState } from 'react'

export interface FeatureState {
  key: string
  label: string
  description: string
  enabled: boolean
  default: boolean
  hasOverride: boolean
  enabledAt: string | null
  enabledBy: string | null
}

export function useOrgFeatures() {
  const [features, setFeatures] = useState<FeatureState[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/org/features')
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        setFeatures(data?.data ?? [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const isEnabled = (featureKey: string): boolean => {
    const feature = features.find(f => f.key === featureKey)
    return feature?.enabled ?? false
  }

  const toggleFeature = async (featureKey: string, enabled: boolean) => {
    const res = await fetch('/api/org/features', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ featureKey, enabled }),
    })
    if (res.ok) {
      setFeatures(prev =>
        prev.map(f =>
          f.key === featureKey ? { ...f, enabled, hasOverride: true } : f
        )
      )
    }
    return res.ok
  }

  return { features, loading, isEnabled, toggleFeature }
}

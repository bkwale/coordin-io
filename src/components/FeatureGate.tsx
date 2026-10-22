'use client'

import { useOrgFeatures } from '@/lib/hooks/useOrgFeatures'
import { FEATURE_REGISTRY, type FeatureKey } from '@/lib/feature-flags'
import { ShieldOff } from 'lucide-react'
import Link from 'next/link'

interface FeatureGateProps {
  feature: FeatureKey
  children: React.ReactNode
  fallback?: React.ReactNode
}

/**
 * Wraps a page or section — renders children only when the feature is enabled.
 * Shows a "feature disabled" message otherwise.
 */
export function FeatureGate({ feature, children, fallback }: FeatureGateProps) {
  const { isEnabled, loading } = useOrgFeatures()

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="animate-pulse text-white/30 text-sm">Loading…</div>
      </div>
    )
  }

  if (!isEnabled(feature)) {
    if (fallback) return <>{fallback}</>

    const config = FEATURE_REGISTRY[feature]
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center px-6">
        <div className="w-16 h-16 rounded-2xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center mb-6">
          <ShieldOff className="w-7 h-7 text-white/20" />
        </div>
        <h2 className="text-lg font-semibold text-white/80 mb-2">
          {config?.label ?? 'Feature'} is not enabled
        </h2>
        <p className="text-sm text-white/40 max-w-md mb-6">
          This module hasn&apos;t been turned on for your organisation.
          Contact your admin to enable it in Settings.
        </p>
        <Link
          href="/"
          className="text-sm text-indigo-400 hover:text-indigo-300 transition-colors"
        >
          ← Back to Dashboard
        </Link>
      </div>
    )
  }

  return <>{children}</>
}

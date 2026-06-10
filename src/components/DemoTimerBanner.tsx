'use client'

import { useDemoTimer } from './DemoTimerProvider'
import { Clock, ExternalLink } from 'lucide-react'
import Link from 'next/link'

/**
 * Thin banner that replaces DemoBanner when the timed demo is active.
 * Shows a countdown. When expired, the DemoExpiredOverlay takes over.
 */
export function DemoTimerBanner() {
  const { isActive, expired, timeRemaining, remainingMs } = useDemoTimer()

  // Don't show if no timer running, or if expired (overlay handles that)
  if (!isActive || expired) return null

  // Warn state: under 2 minutes
  const isWarning = remainingMs !== null && remainingMs < 2 * 60 * 1000

  return (
    <div
      className={`text-[13px] flex items-center justify-center gap-3 px-4 py-2.5 rounded-xl mb-4 transition-colors ${
        isWarning
          ? 'bg-amber-500 text-white'
          : 'bg-gradient-accent text-white'
      }`}
    >
      <Clock className="w-4 h-4 opacity-80" />
      <span className="opacity-90">
        Demo trial — <strong className="font-semibold tabular-nums">{timeRemaining}</strong> remaining
      </span>
      <Link
        href="/book-demo"
        className="inline-flex items-center gap-1 font-semibold text-white/95 hover:text-white underline underline-offset-2"
      >
        Book a full demo
        <ExternalLink className="w-3.5 h-3.5" />
      </Link>
    </div>
  )
}

'use client'

import { useDemoTimer } from './DemoTimerProvider'
import Link from 'next/link'
import { ArrowRight, Clock, LogIn } from 'lucide-react'

/**
 * Full-screen overlay that appears when the 10-minute demo expires.
 * Forces the user to create an account or sign in — no dismiss option.
 */
export function DemoExpiredOverlay() {
  const { expired } = useDemoTimer()

  if (!expired) return null

  return (
    <div className="fixed inset-0 z-[100] bg-ink-900/70 backdrop-blur-sm flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-elevated max-w-md w-full overflow-hidden animate-fade-in">
        {/* Header */}
        <div className="bg-gradient-accent px-8 pt-8 pb-6 text-white">
          <div className="flex items-center gap-2.5 mb-3">
            <Clock className="w-5 h-5 opacity-80" />
            <span className="text-[13px] font-medium opacity-80">Demo trial ended</span>
          </div>
          <h2 className="font-display text-2xl leading-tight mb-2">
            Your 10-minute preview is over
          </h2>
          <p className="text-[14px] opacity-80 leading-relaxed">
            Create a free account to unlock the full platform — projects, quotes, timesheets and more.
          </p>
        </div>

        {/* Actions */}
        <div className="p-8 space-y-4">
          <Link
            href="/signup"
            className="w-full bg-gradient-accent text-white font-semibold text-[14px] py-3.5 rounded-lg hover:opacity-90 transition-opacity flex items-center justify-center gap-2 shadow-glow-indigo"
          >
            Create your account
            <ArrowRight className="w-4 h-4" />
          </Link>

          <Link
            href="/login"
            className="w-full border border-surface-200 text-ink-700 font-semibold text-[14px] py-3.5 rounded-lg hover:bg-surface-50 transition-colors flex items-center justify-center gap-2"
          >
            <LogIn className="w-4 h-4" />
            Already have an account? Sign in
          </Link>

          <p className="text-center text-[12px] text-ink-400 pt-1">
            Free to start. No credit card required.
          </p>
        </div>
      </div>
    </div>
  )
}

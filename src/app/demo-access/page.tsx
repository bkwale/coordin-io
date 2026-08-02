'use client'

import { useEffect } from 'react'
import { Clock, Play } from 'lucide-react'
import { startDemoTimer, getDemoStart } from '@/lib/demo-timer'

export default function DemoAccessPage() {
  useEffect(() => {
    // Start the 10-minute demo timer (only if not already running)
    if (getDemoStart() === null) {
      startDemoTimer()
    }

    // Full page navigation to dashboard after welcome screen.
    // Must use window.location.href (not router.push) so the browser sends
    // the freshly-set demo cookie to middleware on the very first request.
    const timer = setTimeout(() => {
      window.location.href = '/dashboard'
    }, 3000)
    return () => clearTimeout(timer)
  }, [])

  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-6">
      <div className="text-center animate-fade-in max-w-md">
        {/* Logo */}
        <div className="flex justify-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-gradient-accent flex items-center justify-center text-white font-display text-3xl shadow-glow-indigo">
            C
          </div>
        </div>

        <h1 className="font-display text-display text-ink-900 mb-3">
          Welcome to Coordin.io
        </h1>
        <p className="text-[15px] text-ink-500 mb-4 leading-relaxed">
          You have <strong className="text-ink-700">10 minutes</strong> to explore the full platform with sample project data, fee quotes, and team timesheets.
        </p>

        {/* Timer info */}
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent-50 border border-accent-200 text-[13px] text-accent-700 font-medium mb-6">
          <Clock className="w-4 h-4" />
          10-minute demo trial starting...
        </div>

        {/* Progress indicator */}
        <div className="flex justify-center mb-6">
          <div className="w-48 h-1.5 rounded-full bg-surface-200 overflow-hidden">
            <div
              className="h-full bg-gradient-accent rounded-full"
              style={{ animation: 'fillBar 3s linear forwards' }}
            />
          </div>
        </div>
        <p className="text-[11px] text-ink-400 mb-6">Redirecting to dashboard...</p>

        <a
          href="/dashboard"
          className="inline-flex items-center gap-2 bg-gradient-accent text-white font-semibold text-[14px] px-6 py-3 rounded-lg hover:opacity-90 transition-opacity shadow-glow-indigo"
        >
          <Play className="w-4 h-4" />
          Start exploring now
        </a>

        {/* Inline keyframes for the progress bar */}
        <style jsx>{`
          @keyframes fillBar {
            from { width: 0%; }
            to { width: 100%; }
          }
        `}</style>
      </div>
    </div>
  )
}

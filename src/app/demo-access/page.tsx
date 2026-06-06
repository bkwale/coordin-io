'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

export default function DemoAccessPage() {
  const router = useRouter()

  useEffect(() => {
    const timer = setTimeout(() => {
      router.push('/')
    }, 3000)
    return () => clearTimeout(timer)
  }, [router])

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
        <p className="text-[15px] text-ink-500 mb-8 leading-relaxed">
          You now have access to the demo environment with sample project data, fee quotes, and team timesheets.
        </p>

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

        <Link
          href="/"
          className="inline-flex items-center gap-2 bg-gradient-accent text-white font-semibold text-[14px] px-6 py-3 rounded-lg hover:opacity-90 transition-opacity shadow-glow-indigo"
        >
          Go to dashboard now
          <ArrowRight className="w-4 h-4" />
        </Link>

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

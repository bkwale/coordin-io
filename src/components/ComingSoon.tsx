'use client'

import { Construction } from 'lucide-react'

interface ComingSoonProps {
  title: string
  description?: string
}

export function ComingSoon({ title, description }: ComingSoonProps) {
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-[2rem] sm:text-[2.5rem] font-display font-bold text-ink-900">{title}</h1>
        {description && <p className="text-sm text-ink-400 mt-1">{description}</p>}
      </div>

      <div className="card-premium p-12 text-center">
        <div className="flex justify-center mb-4">
          <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center">
            <Construction className="w-7 h-7 text-amber-500" />
          </div>
        </div>
        <h2 className="text-lg font-semibold text-ink-900 mb-2">Coming Soon</h2>
        <p className="text-sm text-ink-500 max-w-md mx-auto">
          This feature is currently in development and will be available in a future release.
        </p>
      </div>
    </div>
  )
}

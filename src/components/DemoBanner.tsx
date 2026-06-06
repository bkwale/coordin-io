'use client'

import { useState } from 'react'
import { X, ExternalLink } from 'lucide-react'

export function DemoBanner() {
  const [dismissed, setDismissed] = useState(false)

  if (dismissed) return null

  return (
    <div className="bg-gradient-accent text-white text-[13px] flex items-center justify-center gap-4 px-4 py-2.5 rounded-xl mb-4">
      <span className="opacity-90">You are viewing a demo environment with sample data.</span>
      <a
        href="#"
        className="inline-flex items-center gap-1 font-semibold text-white/95 hover:text-white underline underline-offset-2"
      >
        Book a call
        <ExternalLink className="w-3.5 h-3.5" />
      </a>
      <button
        onClick={() => setDismissed(true)}
        className="ml-2 p-0.5 rounded hover:bg-white/20 transition-colors"
        aria-label="Dismiss demo banner"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}

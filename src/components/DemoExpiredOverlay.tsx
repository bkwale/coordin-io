'use client'

import { useState } from 'react'
import { useDemoTimer } from './DemoTimerProvider'
import { useRouter } from 'next/navigation'
import { ArrowRight, CheckCircle, Clock, Sparkles } from 'lucide-react'

/**
 * Full-screen overlay that appears when the 10-minute demo expires.
 * Blocks all interaction until the user signs up / books a demo.
 * Submits to /api/demo-signup for email notifications.
 */
export function DemoExpiredOverlay() {
  const { expired, reset } = useDemoTimer()
  const router = useRouter()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [practiceName, setPracticeName] = useState('')
  const [practiceSize, setPracticeSize] = useState('')
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!expired) return null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const res = await fetch('/api/demo-signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email,
          practice_name: practiceName,
          practice_size: practiceSize,
          source: 'demo_expired',
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to submit. Please try again.')
      }

      setSubmitted(true)
    } catch (err: any) {
      setError(err.message || 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  function handleBookDemo() {
    reset()
    router.push('/book-demo')
  }

  return (
    <div className="fixed inset-0 z-[100] bg-ink-900/70 backdrop-blur-sm flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-elevated max-w-md w-full overflow-hidden animate-fade-in">
        {submitted ? (
          /* ── Success state ──────────────────────── */
          <div className="p-8 text-center">
            <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-5">
              <CheckCircle className="w-7 h-7 text-emerald-600" />
            </div>
            <h2 className="font-display text-2xl text-ink-900 mb-2">You&rsquo;re on the list</h2>
            <p className="text-[14px] text-ink-500 leading-relaxed mb-6">
              We&rsquo;ve sent a confirmation to <strong className="text-ink-700">{email}</strong>.
              Our team will reach out shortly to schedule your personalised demo.
            </p>
            <button
              onClick={handleBookDemo}
              className="bg-gradient-accent text-white font-semibold text-[14px] px-6 py-3 rounded-lg hover:opacity-90 transition-opacity inline-flex items-center gap-2 shadow-glow-indigo"
            >
              Book a full demo now
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        ) : (
          /* ── Signup form ────────────────────────── */
          <>
            <div className="bg-gradient-accent px-8 pt-8 pb-6 text-white">
              <div className="flex items-center gap-2.5 mb-3">
                <Clock className="w-5 h-5 opacity-80" />
                <span className="text-[13px] font-medium opacity-80">Demo trial ended</span>
              </div>
              <h2 className="font-display text-2xl leading-tight mb-2">
                Ready to see the full platform?
              </h2>
              <p className="text-[14px] opacity-80 leading-relaxed">
                Sign up below and we&rsquo;ll schedule a personalised walkthrough for your practice.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="p-8 space-y-4">
              {error && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-[13px] text-red-700">
                  {error}
                </div>
              )}

              <div>
                <label htmlFor="demo-name" className="block text-[11px] font-semibold text-ink-400 uppercase tracking-wider mb-1.5">
                  Your name <span className="text-red-400">*</span>
                </label>
                <input
                  id="demo-name"
                  type="text"
                  required
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Full name"
                  className="w-full px-3.5 py-2.5 rounded-lg border border-surface-200 bg-white text-[13px] text-ink-900 placeholder:text-ink-300 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-accent-500 transition-shadow"
                />
              </div>

              <div>
                <label htmlFor="demo-email" className="block text-[11px] font-semibold text-ink-400 uppercase tracking-wider mb-1.5">
                  Email <span className="text-red-400">*</span>
                </label>
                <input
                  id="demo-email"
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@practice.com"
                  className="w-full px-3.5 py-2.5 rounded-lg border border-surface-200 bg-white text-[13px] text-ink-900 placeholder:text-ink-300 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-accent-500 transition-shadow"
                />
              </div>

              <div>
                <label htmlFor="demo-practice" className="block text-[11px] font-semibold text-ink-400 uppercase tracking-wider mb-1.5">
                  Practice name
                </label>
                <input
                  id="demo-practice"
                  type="text"
                  value={practiceName}
                  onChange={e => setPracticeName(e.target.value)}
                  placeholder="Your practice or studio"
                  className="w-full px-3.5 py-2.5 rounded-lg border border-surface-200 bg-white text-[13px] text-ink-900 placeholder:text-ink-300 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-accent-500 transition-shadow"
                />
              </div>

              <div>
                <label htmlFor="demo-size" className="block text-[11px] font-semibold text-ink-400 uppercase tracking-wider mb-1.5">
                  Team size
                </label>
                <select
                  id="demo-size"
                  value={practiceSize}
                  onChange={e => setPracticeSize(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-surface-200 bg-white text-[13px] text-ink-900 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-accent-500 transition-shadow"
                >
                  <option value="">Select...</option>
                  <option value="1-5">1–5 people</option>
                  <option value="6-15">6–15 people</option>
                  <option value="16-25">16–25 people</option>
                  <option value="25+">25+ people</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-accent text-white font-semibold text-[14px] py-3.5 rounded-lg hover:opacity-90 transition-opacity flex items-center justify-center gap-2 shadow-glow-indigo mt-2 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {loading ? 'Submitting...' : 'Sign up for a demo'}
                {!loading && <Sparkles className="w-4 h-4" />}
              </button>

              <p className="text-center text-[12px] text-ink-400 pt-1">
                No credit card required. We&rsquo;ll reach out within 24 hours.
              </p>
            </form>
          </>
        )}
      </div>
    </div>
  )
}

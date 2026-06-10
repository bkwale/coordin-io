'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowRight, AlertCircle, Info } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

/* ── Shared Marketing Nav ──────────────────────────── */
function AuthNav() {
  return (
    <nav className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-surface-200/60">
      <div className="flex items-center justify-between px-6 sm:px-10 py-3.5 max-w-7xl mx-auto">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-accent flex items-center justify-center text-white font-display text-lg">
            C
          </div>
          <span className="font-display text-xl text-ink-900">Coordin.io</span>
        </Link>
        <div className="flex items-center gap-8">
          <Link href="/" className="text-[13px] font-medium text-ink-500 hover:text-ink-900 hidden sm:block">
            Home
          </Link>
          <Link href="/signup" className="text-[13px] font-medium text-accent-600 hover:text-accent-700">
            Sign Up
          </Link>
        </div>
      </div>
    </nav>
  )
}

/* ── Main Page ─────────────────────────────────────── */
export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const isDemoMode = !process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL.includes('YOUR_PROJECT')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const supabase = createClient()
      const { error } = await supabase.auth.signInWithPassword({ email, password })

      if (error) {
        setError(error.message)
        return
      }

      router.push('/dashboard')
    } catch (err) {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-white">
      <AuthNav />

      <section className="max-w-md mx-auto px-6 sm:px-10 pt-20 sm:pt-28 pb-20 animate-fade-in">
        <h1 className="font-display text-[2.5rem] sm:text-[3rem] leading-[1.05] text-ink-900 text-center mb-3">
          Welcome back
        </h1>
        <p className="text-[15px] text-ink-500 text-center mb-10 max-w-sm mx-auto leading-relaxed">
          Sign in to your Coordin.io account to pick up where you left off.
        </p>

        {isDemoMode && (
          <div className="card-static p-4 mb-6 flex items-start gap-3 bg-accent-50/50 border-accent-200">
            <Info className="w-5 h-5 text-accent-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-[13px] text-ink-700 font-medium mb-1">Demo mode</p>
              <p className="text-[12px] text-ink-500 leading-relaxed mb-2">
                Supabase is not configured. You can explore the platform without an account.
              </p>
              <Link
                href="/demo-access"
                className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-accent-600 hover:text-accent-700"
              >
                Try the 10-min demo <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="card-static shadow-premium p-6 sm:p-8 text-left space-y-5">
          {error && (
            <div className="flex items-start gap-2.5 p-3.5 rounded-lg bg-red-50 border border-red-200">
              <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-[13px] text-red-700">{error}</p>
            </div>
          )}

          {/* Email */}
          <div>
            <label htmlFor="email" className="block text-[11px] font-semibold text-ink-400 uppercase tracking-wider mb-1.5">
              Email <span className="text-red-400">*</span>
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@practice.com"
              className="w-full px-3.5 py-2.5 rounded-lg border border-surface-200 bg-white text-[13px] text-ink-900 placeholder:text-ink-300 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-accent-500 transition-shadow"
            />
          </div>

          {/* Password */}
          <div>
            <label htmlFor="password" className="block text-[11px] font-semibold text-ink-400 uppercase tracking-wider mb-1.5">
              Password <span className="text-red-400">*</span>
            </label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Your password"
              className="w-full px-3.5 py-2.5 rounded-lg border border-surface-200 bg-white text-[13px] text-ink-900 placeholder:text-ink-300 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-accent-500 transition-shadow"
            />
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-accent text-white font-semibold text-[14px] py-3.5 rounded-lg hover:opacity-90 transition-opacity flex items-center justify-center gap-2 shadow-glow-indigo mt-2 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? 'Signing in...' : 'Sign in'}
            {!loading && <ArrowRight className="w-4 h-4" />}
          </button>

          <div className="text-center space-y-2 pt-1">
            <Link
              href="/forgot-password"
              className="block text-[13px] text-ink-500 hover:text-ink-900"
            >
              Forgot password?
            </Link>
            <p className="text-[13px] text-ink-500">
              Don&rsquo;t have an account?{' '}
              <Link href="/signup" className="text-accent-600 hover:text-accent-700 font-medium">
                Sign up
              </Link>
            </p>
          </div>
        </form>
      </section>
    </div>
  )
}

'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowRight, AlertCircle, CheckCircle, Info } from 'lucide-react'
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
          <Link href="/login" className="text-[13px] font-medium text-accent-600 hover:text-accent-700">
            Sign In
          </Link>
        </div>
      </div>
    </nav>
  )
}

/* ── Main Page ─────────────────────────────────────── */
export default function SignupPage() {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  const isDemoMode = !process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL.includes('YOUR_PROJECT')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }

    setLoading(true)

    try {
      const supabase = createClient()
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName },
        },
      })

      if (error) {
        setError(error.message)
        return
      }

      setSuccess(true)
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
          Create your account
        </h1>
        <p className="text-[15px] text-ink-500 text-center mb-10 max-w-sm mx-auto leading-relaxed">
          Start tracking projects, quotes and team performance in minutes.
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

        {success ? (
          <div className="card-static shadow-premium p-8 animate-fade-in text-center">
            <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-6 h-6 text-emerald-600" />
            </div>
            <h3 className="font-display text-xl text-ink-900 mb-2">Check your email</h3>
            <p className="text-[13px] text-ink-500 leading-relaxed mb-4">
              We&rsquo;ve sent a confirmation link to <strong className="text-ink-700">{email}</strong>. Click it to activate your account.
            </p>
            <Link
              href="/login"
              className="text-[13px] text-accent-600 hover:text-accent-700 font-medium"
            >
              Back to sign in
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="card-static shadow-premium p-6 sm:p-8 text-left space-y-5">
            {error && (
              <div className="flex items-start gap-2.5 p-3.5 rounded-lg bg-red-50 border border-red-200">
                <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-[13px] text-red-700">{error}</p>
              </div>
            )}

            {/* Full Name */}
            <div>
              <label htmlFor="fullName" className="block text-[11px] font-semibold text-ink-400 uppercase tracking-wider mb-1.5">
                Full name <span className="text-red-400">*</span>
              </label>
              <input
                id="fullName"
                type="text"
                required
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                placeholder="Your full name"
                className="w-full px-3.5 py-2.5 rounded-lg border border-surface-200 bg-white text-[13px] text-ink-900 placeholder:text-ink-300 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-accent-500 transition-shadow"
              />
            </div>

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
                placeholder="At least 6 characters"
                className="w-full px-3.5 py-2.5 rounded-lg border border-surface-200 bg-white text-[13px] text-ink-900 placeholder:text-ink-300 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-accent-500 transition-shadow"
              />
            </div>

            {/* Confirm Password */}
            <div>
              <label htmlFor="confirmPassword" className="block text-[11px] font-semibold text-ink-400 uppercase tracking-wider mb-1.5">
                Confirm password <span className="text-red-400">*</span>
              </label>
              <input
                id="confirmPassword"
                type="password"
                required
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="Re-enter your password"
                className="w-full px-3.5 py-2.5 rounded-lg border border-surface-200 bg-white text-[13px] text-ink-900 placeholder:text-ink-300 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-accent-500 transition-shadow"
              />
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-accent text-white font-semibold text-[14px] py-3.5 rounded-lg hover:opacity-90 transition-opacity flex items-center justify-center gap-2 shadow-glow-indigo mt-2 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? 'Creating account...' : 'Create account'}
              {!loading && <ArrowRight className="w-4 h-4" />}
            </button>

            <p className="text-center text-[13px] text-ink-500 pt-1">
              Already have an account?{' '}
              <Link href="/login" className="text-accent-600 hover:text-accent-700 font-medium">
                Sign in
              </Link>
            </p>
          </form>
        )}
      </section>
    </div>
  )
}

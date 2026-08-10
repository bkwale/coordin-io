'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowRight, AlertCircle, CheckCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

/* -- Shared Marketing Nav -------------------------------- */
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

/* -- Main Page ------------------------------------------- */
export default function ResetPasswordPage() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)

    try {
      const supabase = createClient()
      const { error } = await supabase.auth.updateUser({ password })

      if (error) {
        setError(error.message)
        return
      }

      setSuccess(true)
    } catch {
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
          Set new password
        </h1>
        <p className="text-[15px] text-ink-500 text-center mb-10 max-w-sm mx-auto leading-relaxed">
          Enter your new password below.
        </p>

        {success ? (
          <div className="card-static shadow-premium p-8 animate-fade-in text-center">
            <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-6 h-6 text-emerald-600" />
            </div>
            <h3 className="font-display text-xl text-ink-900 mb-2">Password updated</h3>
            <p className="text-[13px] text-ink-500 leading-relaxed mb-4">
              Your password has been changed successfully.
            </p>
            <Link
              href="/login"
              className="text-[13px] text-accent-600 hover:text-accent-700 font-medium"
            >
              Sign in with new password
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

            {/* New Password */}
            <div>
              <label htmlFor="password" className="block text-[11px] font-semibold text-ink-400 uppercase tracking-wider mb-1.5">
                New password <span className="text-red-400">*</span>
              </label>
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="At least 8 characters"
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
              {loading ? 'Updating password...' : 'Update password'}
              {!loading && <ArrowRight className="w-4 h-4" />}
            </button>

            <p className="text-center text-[13px] text-ink-500 pt-1">
              <Link href="/login" className="text-accent-600 hover:text-accent-700 font-medium">
                Back to sign in
              </Link>
            </p>
          </form>
        )}
      </section>
    </div>
  )
}

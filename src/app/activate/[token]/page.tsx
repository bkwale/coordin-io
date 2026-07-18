'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { AlertCircle, CheckCircle2, Clock, Loader2, ShieldCheck } from 'lucide-react'

type InvitationData = {
  email: string
  fullName: string
  jobTitle: string | null
  organisationName: string
  organisationLogo: string | null
  expiresAt: string
}

type PageState = 'loading' | 'ready' | 'creating' | 'success' | 'error' | 'expired'

export default function ActivatePage() {
  const { token } = useParams<{ token: string }>()
  const [state, setState] = useState<PageState>('loading')
  const [invitation, setInvitation] = useState<InvitationData | null>(null)
  const [error, setError] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  // Validate token on load
  useEffect(() => {
    async function validate() {
      try {
        const res = await fetch(`/api/invitations/${token}`)
        const json = await res.json()
        const payload = json.data ?? json // handle both wrapped and unwrapped responses

        if (!res.ok) {
          if (payload.status === 'expired') {
            setState('expired')
          } else {
            setError(payload.error || 'Invalid invitation')
            setState('error')
          }
          return
        }

        // Check if this is an error-state invitation (activated/revoked/expired)
        if (payload.status && payload.error) {
          if (payload.status === 'expired') {
            setState('expired')
          } else {
            setError(payload.error)
            setState('error')
          }
          return
        }

        setInvitation(payload.invitation)
        setState('ready')
      } catch {
        setError('Failed to validate invitation')
        setState('error')
      }
    }
    validate()
  }, [token])

  async function handleActivate(e: React.FormEvent) {
    e.preventDefault()

    if (password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    setState('creating')
    setError('')

    try {
      // 1. Create Supabase auth account
      const supabase = createClient()
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: invitation!.email,
        password,
        options: {
          data: { full_name: invitation!.fullName },
        },
      })

      if (authError || !authData.user) {
        setError(authError?.message || 'Failed to create account')
        setState('ready')
        return
      }

      // 2. Activate the invitation (server verifies session — no need to send authUserId)
      const activateRes = await fetch(`/api/invitations/${token}/activate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })

      if (!activateRes.ok) {
        const data = await activateRes.json()
        setError(data.error || 'Failed to activate account')
        setState('ready')
        return
      }

      setState('success')

      // Redirect to onboarding after brief delay
      setTimeout(() => {
        window.location.href = '/onboarding'
      }, 2000)
    } catch {
      setError('Something went wrong. Please try again.')
      setState('ready')
    }
  }

  // ── Expired state ──
  if (state === 'expired') {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center px-6">
        <div className="text-center max-w-md">
          <Clock className="w-12 h-12 text-amber-500 mx-auto mb-4" />
          <h1 className="font-display text-2xl text-ink-900 mb-2">Invitation expired</h1>
          <p className="text-ink-500 text-[15px]">
            This invitation link has expired. Please contact your administrator to request a new one.
          </p>
        </div>
      </div>
    )
  }

  // ── Error state ──
  if (state === 'error' && !invitation) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center px-6">
        <div className="text-center max-w-md">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h1 className="font-display text-2xl text-ink-900 mb-2">Invalid invitation</h1>
          <p className="text-ink-500 text-[15px]">{error}</p>
        </div>
      </div>
    )
  }

  // ── Loading state ──
  if (state === 'loading' || !invitation) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-accent-600 animate-spin" />
      </div>
    )
  }

  // ── Success state ──
  if (state === 'success') {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center px-6">
        <div className="text-center max-w-md animate-fade-in">
          <CheckCircle2 className="w-14 h-14 text-emerald-500 mx-auto mb-4" />
          <h1 className="font-display text-2xl text-ink-900 mb-2">Welcome to {invitation.organisationName}</h1>
          <p className="text-ink-500 text-[15px]">
            Your account is ready. Redirecting you to onboarding...
          </p>
        </div>
      </div>
    )
  }

  // ── Ready state — show activation form ──
  return (
    <div className="min-h-screen bg-surface-50 flex items-center justify-center px-6">
      <div className="w-full max-w-md">
        {/* Card */}
        <div className="bg-white rounded-2xl shadow-elevated border border-surface-200 overflow-hidden">
          {/* Header */}
          <div className="px-8 pt-8 pb-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-gradient-accent flex items-center justify-center text-white font-display text-lg">
                C
              </div>
              <span className="font-display text-lg text-ink-900">coordin.io</span>
            </div>

            <h1 className="font-display text-2xl text-ink-900 mb-2">
              Welcome to {invitation.organisationName}
            </h1>
            <p className="text-ink-500 text-[15px] leading-relaxed">
              You have been invited to join as{' '}
              <strong className="text-ink-700">{invitation.jobTitle || 'Team Member'}</strong>.
            </p>
          </div>

          {/* Invitation details */}
          <div className="mx-8 mb-6 p-4 bg-surface-50 rounded-xl border border-surface-200">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-accent-100 text-accent-700 font-bold flex items-center justify-center text-sm">
                {invitation.fullName.split(' ').map(n => n[0]).join('')}
              </div>
              <div>
                <p className="font-semibold text-ink-900 text-[14px]">{invitation.fullName}</p>
                <p className="text-ink-500 text-[13px]">{invitation.email}</p>
              </div>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleActivate} className="px-8 pb-8 space-y-4">
            <div>
              <label className="block text-[13px] font-semibold text-ink-700 mb-1.5">
                Create password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3.5 py-2.5 border border-surface-300 rounded-lg text-[14px] focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-transparent"
                placeholder="Min. 8 characters"
                required
                minLength={8}
              />
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-ink-700 mb-1.5">
                Confirm password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-3.5 py-2.5 border border-surface-300 rounded-lg text-[14px] focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-transparent"
                placeholder="Re-enter password"
                required
              />
            </div>

            {error && (
              <p className="text-red-600 text-[13px] flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={state === 'creating'}
              className="w-full bg-gradient-accent text-white font-semibold text-[14px] py-3 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {state === 'creating' ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Creating account...
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  Create account
                </>
              )}
            </button>

            <p className="text-center text-[12px] text-ink-400 pt-1">
              By creating an account you agree to your organisation&apos;s policies.
            </p>
          </form>
        </div>
      </div>
    </div>
  )
}

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowRight,
  FileText,
  Activity,
  Shield,
  ChevronDown,
} from 'lucide-react'

/* ── Marketing nav bar ───────────────────────────── */
function MarketingNav() {
  return (
    <nav className="flex items-center justify-between px-6 sm:px-10 py-5 max-w-6xl mx-auto">
      <Link href="/welcome" className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-gradient-accent flex items-center justify-center text-white font-display text-lg">
          C
        </div>
        <span className="font-display text-xl text-ink-900">Coordin.io</span>
      </Link>
      <div className="flex items-center gap-6">
        <Link
          href="/faq"
          className="text-[13px] font-medium text-ink-500 hover:text-ink-900"
        >
          FAQ
        </Link>
        <Link
          href="/"
          className="text-[13px] font-medium text-accent-600 hover:text-accent-700"
        >
          Sign In
        </Link>
      </div>
    </nav>
  )
}

/* ── Mock dashboard preview ──────────────────────── */
function DashboardPreview() {
  const kpis = [
    { label: 'Active Projects', value: '12', color: 'bg-accent-50 text-accent-600' },
    { label: 'Quotes Sent', value: '8', color: 'bg-emerald-50 text-emerald-600' },
    { label: 'Team Utilisation', value: '84%', color: 'bg-amber-50 text-amber-600' },
    { label: 'BRPD Compliance', value: '96%', color: 'bg-violet-50 text-violet-600' },
  ]

  return (
    <div className="max-w-5xl mx-auto px-6 sm:px-10 mt-12 mb-16 animate-fade-in" style={{ animationDelay: '0.3s', animationFillMode: 'both' }}>
      <div className="bg-white rounded-2xl shadow-elevated border border-surface-200 overflow-hidden">
        {/* Title bar */}
        <div className="flex items-center gap-2 px-5 py-3 bg-surface-50 border-b border-surface-200">
          <div className="flex gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
            <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
          </div>
          <span className="text-[11px] font-medium text-ink-400 ml-2">Executive Dashboard</span>
        </div>
        {/* KPI grid */}
        <div className="p-5 sm:p-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {kpis.map(k => (
              <div key={k.label} className="rounded-xl bg-surface-50 border border-surface-200 p-4">
                <p className="text-[10px] font-semibold text-ink-400 uppercase tracking-wider mb-2">{k.label}</p>
                <p className="text-2xl font-semibold text-ink-900 tabular-nums">{k.value}</p>
              </div>
            ))}
          </div>
          {/* Placeholder rows */}
          <div className="mt-4 space-y-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="flex gap-3 items-center">
                <div className="h-3 rounded-full bg-surface-200" style={{ width: `${60 + i * 10}%` }} />
                <div className="h-3 w-12 rounded-full bg-surface-200" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

/* ── Value proposition cards ─────────────────────── */
const VALUE_PROPS = [
  {
    icon: FileText,
    title: 'Quotes & Proposals',
    description: 'Create, send, and track fee quotes with built-in RIBA stage templates.',
  },
  {
    icon: Activity,
    title: 'Project Health',
    description: 'See which jobs are at risk, track deadlines, and monitor team capacity.',
  },
  {
    icon: Shield,
    title: 'BRPD Compliance',
    description: 'Manage dutyholder coordination, compliance statements, and gateway readiness.',
  },
]

/* ── Main page ───────────────────────────────────── */
export default function WelcomePage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [practiceName, setPracticeName] = useState('')
  const [role, setRole] = useState('')
  const [practiceSize, setPracticeSize] = useState('')
  const [submitted, setSubmitted] = useState(false)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitted(true)
    setTimeout(() => router.push('/demo-access'), 2000)
  }

  return (
    <div className="min-h-screen bg-white">
      <MarketingNav />

      {/* ── Hero ──────────────────────────────────── */}
      <section className="text-center pt-8 sm:pt-14 pb-6 px-6 sm:px-10 animate-fade-in">
        {/* Logo mark */}
        <div className="flex justify-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-gradient-accent flex items-center justify-center text-white font-display text-3xl shadow-glow-indigo">
            C
          </div>
        </div>

        <h1 className="font-display text-display-lg sm:text-[3rem] sm:leading-[1.05] text-ink-900 max-w-2xl mx-auto">
          Project control for the built environment
        </h1>
        <p className="text-[15px] text-ink-500 max-w-xl mx-auto mt-4 leading-relaxed">
          Quotes, timesheets, project health, and BRPD compliance &mdash; one platform for your whole practice.
        </p>

        {/* ── Badge ──────────────────────────────── */}
        <div className="flex justify-center mt-6 mb-8">
          <span className="status-pill bg-accent-50 text-accent-600 border border-accent-200">
            <span className="w-1.5 h-1.5 rounded-full bg-accent-500 animate-pulse-soft" />
            Design Partner Programme
          </span>
        </div>

        {/* ── Form card ──────────────────────────── */}
        <div className="max-w-md mx-auto">
          {submitted ? (
            <div className="card-static shadow-premium p-8 animate-fade-in text-center">
              <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="font-display text-xl text-ink-900 mb-2">You are in.</h2>
              <p className="text-[13px] text-ink-500">Redirecting you to the demo environment...</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="card-static shadow-premium p-6 sm:p-8 text-left space-y-4">
              {/* Email */}
              <div>
                <label htmlFor="email" className="block text-[11px] font-semibold text-ink-400 uppercase tracking-wider mb-1.5">
                  Work email
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

              {/* Practice name */}
              <div>
                <label htmlFor="practice" className="block text-[11px] font-semibold text-ink-400 uppercase tracking-wider mb-1.5">
                  Practice name
                </label>
                <input
                  id="practice"
                  type="text"
                  value={practiceName}
                  onChange={e => setPracticeName(e.target.value)}
                  placeholder="Maple Architects"
                  className="w-full px-3.5 py-2.5 rounded-lg border border-surface-200 bg-white text-[13px] text-ink-900 placeholder:text-ink-300 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-accent-500 transition-shadow"
                />
              </div>

              {/* Role */}
              <div>
                <label htmlFor="role" className="block text-[11px] font-semibold text-ink-400 uppercase tracking-wider mb-1.5">
                  Your role
                </label>
                <div className="relative">
                  <select
                    id="role"
                    value={role}
                    onChange={e => setRole(e.target.value)}
                    className="w-full appearance-none px-3.5 py-2.5 rounded-lg border border-surface-200 bg-white text-[13px] text-ink-900 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-accent-500 transition-shadow pr-10"
                  >
                    <option value="">Select...</option>
                    <option value="practice_owner">Practice Owner</option>
                    <option value="director">Director</option>
                    <option value="project_lead">Project Lead</option>
                    <option value="associate">Associate</option>
                    <option value="other">Other</option>
                  </select>
                  <ChevronDown className="w-4 h-4 text-ink-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>

              {/* Practice size */}
              <div>
                <label htmlFor="size" className="block text-[11px] font-semibold text-ink-400 uppercase tracking-wider mb-1.5">
                  Practice size
                </label>
                <div className="relative">
                  <select
                    id="size"
                    value={practiceSize}
                    onChange={e => setPracticeSize(e.target.value)}
                    className="w-full appearance-none px-3.5 py-2.5 rounded-lg border border-surface-200 bg-white text-[13px] text-ink-900 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-accent-500 transition-shadow pr-10"
                  >
                    <option value="">Select...</option>
                    <option value="1-5">1-5</option>
                    <option value="6-15">6-15</option>
                    <option value="16-30">16-30</option>
                    <option value="30+">30+</option>
                  </select>
                  <ChevronDown className="w-4 h-4 text-ink-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>

              {/* CTA */}
              <button
                type="submit"
                className="w-full bg-gradient-accent text-white font-semibold text-[14px] py-3 rounded-lg hover:opacity-90 transition-opacity flex items-center justify-center gap-2 shadow-glow-indigo mt-2"
              >
                Request early access
                <ArrowRight className="w-4 h-4" />
              </button>

              <p className="text-center text-[11px] text-ink-400 mt-3">
                Join our design partner programme. Instant demo access.
              </p>
            </form>
          )}
        </div>
      </section>

      {/* ── Dashboard screenshot ─────────────────── */}
      <DashboardPreview />

      {/* ── Value props ──────────────────────────── */}
      <section className="max-w-5xl mx-auto px-6 sm:px-10 pb-20">
        <div className="grid sm:grid-cols-3 gap-6">
          {VALUE_PROPS.map(vp => (
            <div key={vp.title} className="card-static p-6 text-center">
              <div className="w-10 h-10 rounded-xl bg-accent-50 flex items-center justify-center mx-auto mb-4">
                <vp.icon className="w-5 h-5 text-accent-600" />
              </div>
              <h3 className="font-display text-lg text-ink-900 mb-2">{vp.title}</h3>
              <p className="text-[13px] text-ink-500 leading-relaxed">{vp.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Footer ───────────────────────────────── */}
      <footer className="border-t border-surface-200 py-8 px-6 sm:px-10">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-[13px] text-ink-400">Coordin.io &mdash; Built for practices that build.</p>
          <div className="flex items-center gap-6">
            <Link href="/faq" className="text-[13px] text-ink-500 hover:text-ink-900">FAQ</Link>
            <a href="mailto:hello@coordin.io" className="text-[13px] text-ink-500 hover:text-ink-900">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  )
}

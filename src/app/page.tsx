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
  BarChart3,
  Clock,
  CheckCircle,
} from 'lucide-react'

/* ── Smooth scroll helper ───────────────────────── */
function scrollTo(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
}

/* ── Sticky Nav ─────────────────────────────────── */
function MarketingNav() {
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
          <button
            onClick={() => scrollTo('features')}
            className="text-[13px] font-medium text-ink-500 hover:text-ink-900 hidden sm:block"
          >
            Features
          </button>
          <Link
            href="/faq"
            className="text-[13px] font-medium text-ink-500 hover:text-ink-900 hidden sm:block"
          >
            FAQ
          </Link>
          <Link
            href="/dashboard"
            className="text-[13px] font-medium text-accent-600 hover:text-accent-700"
          >
            Sign In
          </Link>
        </div>
      </div>
    </nav>
  )
}

/* ── Mock: Dashboard Preview (browser chrome) ───── */
function DashboardPreview() {
  const kpis = [
    { label: 'Active Projects', value: '12', sub: '+2 this month', color: 'text-accent-600' },
    { label: 'Quotes Sent', value: '8', sub: '3 awaiting', color: 'text-emerald-600' },
    { label: 'Team Utilisation', value: '84%', sub: 'Target: 80%', color: 'text-amber-600' },
    { label: 'BRPD Compliance', value: '96%', sub: '1 action due', color: 'text-violet-600' },
  ]

  const rows = [
    { name: 'Whitmore House', stage: 'Stage 3', health: 'bg-emerald-400', fee: '£42,500' },
    { name: 'Kensington Mews', stage: 'Stage 4', health: 'bg-amber-400', fee: '£67,200' },
    { name: 'Park Lane Mixed-Use', stage: 'Stage 2', health: 'bg-emerald-400', fee: '£128,000' },
  ]

  return (
    <section className="max-w-6xl mx-auto px-6 sm:px-10 mt-16 mb-24 animate-fade-in" style={{ animationDelay: '0.35s', animationFillMode: 'both' }}>
      <div className="rounded-2xl shadow-elevated border border-surface-200 overflow-hidden bg-white">
        {/* Browser chrome */}
        <div className="flex items-center gap-2 px-5 py-3 bg-surface-50 border-b border-surface-200">
          <div className="flex gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
            <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
          </div>
          <div className="flex-1 flex justify-center">
            <div className="bg-white border border-surface-200 rounded-md px-4 py-1 text-[11px] text-ink-400 font-medium">
              app.coordin.io/dashboard
            </div>
          </div>
        </div>
        {/* Dashboard content */}
        <div className="p-6 sm:p-8">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-display text-xl text-ink-900">Executive Dashboard</h3>
            <span className="text-[11px] text-ink-400 font-medium">Last updated: 2 min ago</span>
          </div>
          {/* KPI grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {kpis.map(k => (
              <div key={k.label} className="rounded-xl bg-surface-50 border border-surface-200 p-4">
                <p className="text-[10px] font-semibold text-ink-400 uppercase tracking-wider mb-1.5">{k.label}</p>
                <p className={`text-2xl font-semibold tabular-nums ${k.color}`}>{k.value}</p>
                <p className="text-[10px] text-ink-400 mt-1">{k.sub}</p>
              </div>
            ))}
          </div>
          {/* Project rows */}
          <div className="mt-6">
            <div className="grid grid-cols-[1fr_auto_auto_auto] gap-4 px-3 py-2 text-[10px] font-semibold text-ink-400 uppercase tracking-wider border-b border-surface-200">
              <span>Project</span>
              <span>Stage</span>
              <span>Health</span>
              <span className="text-right">Fee</span>
            </div>
            {rows.map(r => (
              <div key={r.name} className="grid grid-cols-[1fr_auto_auto_auto] gap-4 px-3 py-3 items-center border-b border-surface-100 last:border-0">
                <span className="text-[13px] font-medium text-ink-900">{r.name}</span>
                <span className="text-[11px] text-ink-500 font-medium">{r.stage}</span>
                <span className={`w-2.5 h-2.5 rounded-full ${r.health}`} />
                <span className="text-[13px] text-ink-700 tabular-nums text-right">{r.fee}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

/* ── Mock: Quote Card ───────────────────────────── */
function MockQuoteCard() {
  const items = [
    { stage: 'Stage 1 — Preparation & Briefing', fee: '£4,200' },
    { stage: 'Stage 2 — Concept Design', fee: '£8,500' },
    { stage: 'Stage 3 — Spatial Coordination', fee: '£12,800' },
    { stage: 'Stage 4 — Technical Design', fee: '£16,000' },
  ]

  return (
    <div className="card-static shadow-elevated p-6 max-w-sm w-full">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-[10px] font-semibold text-ink-400 uppercase tracking-wider">Quote</p>
          <p className="text-[15px] font-semibold text-ink-900 mt-0.5">QT-2024-0042</p>
        </div>
        <span className="status-pill bg-amber-50 text-amber-700 border border-amber-200">Awaiting</span>
      </div>
      <div className="border-t border-surface-200 pt-3 mb-3">
        <p className="text-[11px] text-ink-400 font-medium">Client</p>
        <p className="text-[13px] text-ink-900 font-medium">Hartley Developments Ltd</p>
      </div>
      <div className="space-y-2">
        {items.map(it => (
          <div key={it.stage} className="flex items-center justify-between py-1.5 border-b border-surface-100 last:border-0">
            <span className="text-[12px] text-ink-700">{it.stage}</span>
            <span className="text-[12px] text-ink-900 font-semibold tabular-nums">{it.fee}</span>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between mt-4 pt-3 border-t border-surface-200">
        <span className="text-[12px] font-semibold text-ink-500">Total Fee</span>
        <span className="text-[16px] font-semibold text-accent-600 tabular-nums">£41,500</span>
      </div>
    </div>
  )
}

/* ── Mock: Project Health Card ──────────────────── */
function MockProjectHealthCard() {
  const projects = [
    { name: 'Whitmore House', health: 'bg-emerald-400', stage: 'Stage 3', risk: null },
    { name: 'Kensington Mews', health: 'bg-amber-400', stage: 'Stage 4', risk: 'Fee overrun risk' },
    { name: 'Clerkenwell Retrofit', health: 'bg-red-400', stage: 'Stage 2', risk: 'BRPD gateway overdue' },
  ]

  return (
    <div className="card-static shadow-elevated p-6 max-w-sm w-full">
      <div className="flex items-center gap-2 mb-5">
        <Activity className="w-4 h-4 text-accent-500" />
        <h4 className="text-[14px] font-semibold text-ink-900">Project Health</h4>
      </div>
      <div className="space-y-3">
        {projects.map(p => (
          <div key={p.name} className="flex items-start gap-3 p-3 rounded-lg bg-surface-50 border border-surface-200">
            <span className={`w-2.5 h-2.5 rounded-full mt-1 flex-shrink-0 ${p.health}`} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className="text-[13px] font-medium text-ink-900">{p.name}</span>
                <span className="text-[10px] text-ink-400 font-medium">{p.stage}</span>
              </div>
              {p.risk && (
                <span className="inline-block mt-1.5 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-red-50 text-red-600 border border-red-200">
                  {p.risk}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ── Mock: Timesheet Grid ───────────────────────── */
function MockTimesheetCard() {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
  const rows = [
    { task: 'Whitmore — Stage 3 coord.', hours: [2, 3, 1.5, 4, 2] },
    { task: 'Kensington — Detail drawings', hours: [4, 3, 5, 2, 4] },
    { task: 'CPD / Admin', hours: [1, 1.5, 1, 1.5, 1] },
  ]

  return (
    <div className="card-static shadow-elevated p-6 max-w-sm w-full">
      <div className="flex items-center gap-2 mb-5">
        <Clock className="w-4 h-4 text-accent-500" />
        <h4 className="text-[14px] font-semibold text-ink-900">Weekly Timesheet</h4>
        <span className="text-[10px] text-ink-400 font-medium ml-auto">W/C 27 Jan</span>
      </div>
      {/* Header */}
      <div className="grid grid-cols-[1fr_repeat(5,36px)] gap-1 mb-2 px-1">
        <span className="text-[10px] font-semibold text-ink-400 uppercase tracking-wider">Task</span>
        {days.map(d => (
          <span key={d} className="text-[10px] font-semibold text-ink-400 uppercase tracking-wider text-center">{d}</span>
        ))}
      </div>
      {/* Rows */}
      <div className="space-y-1">
        {rows.map(r => (
          <div key={r.task} className="grid grid-cols-[1fr_repeat(5,36px)] gap-1 items-center px-1 py-1.5 rounded-md hover:bg-surface-50">
            <span className="text-[11px] text-ink-700 truncate">{r.task}</span>
            {r.hours.map((h, i) => (
              <span key={i} className="text-[12px] text-ink-900 font-medium text-center tabular-nums bg-surface-50 rounded py-0.5">{h}</span>
            ))}
          </div>
        ))}
      </div>
      {/* Totals */}
      <div className="grid grid-cols-[1fr_repeat(5,36px)] gap-1 items-center px-1 pt-2 mt-2 border-t border-surface-200">
        <span className="text-[11px] font-semibold text-ink-500">Daily total</span>
        {[7, 7.5, 7.5, 7.5, 7].map((t, i) => (
          <span key={i} className="text-[12px] text-accent-600 font-semibold text-center tabular-nums">{t}</span>
        ))}
      </div>
    </div>
  )
}

/* ── Feature Section (alternating layout) ───────── */
function FeatureSection({
  title,
  description,
  learnMoreHref,
  mockup,
  reverse = false,
  id,
}: {
  title: string
  description: string
  learnMoreHref: string
  mockup: React.ReactNode
  reverse?: boolean
  id?: string
}) {
  return (
    <div
      id={id}
      className={`flex flex-col ${reverse ? 'lg:flex-row-reverse' : 'lg:flex-row'} items-center gap-12 lg:gap-20`}
    >
      {/* Text */}
      <div className="flex-1 max-w-lg">
        <h2 className="font-display text-[2rem] sm:text-[2.5rem] leading-[1.1] text-ink-900 mb-4">
          {title}
        </h2>
        <p className="text-[15px] text-ink-500 leading-relaxed mb-6">
          {description}
        </p>
        <Link
          href={learnMoreHref}
          className="inline-flex items-center gap-1.5 text-[14px] font-semibold text-accent-600 hover:text-accent-700"
        >
          Learn more
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
      {/* Mockup */}
      <div className="flex-1 flex justify-center">
        {mockup}
      </div>
    </div>
  )
}

/* ── Main Page ──────────────────────────────────── */
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
      <section className="text-center pt-20 sm:pt-28 pb-8 px-6 sm:px-10 animate-fade-in">
        <h1 className="font-display text-[3.5rem] sm:text-[4.5rem] leading-[1.05] text-ink-900 max-w-3xl mx-auto">
          Project control for the built environment
        </h1>
        <p className="text-[17px] text-ink-500 max-w-xl mx-auto mt-6 leading-relaxed">
          Quotes, timesheets, project health, and BRPD compliance &mdash; one platform for your whole practice.
        </p>

        {/* CTA buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-10">
          <button
            onClick={() => scrollTo('waitlist')}
            className="bg-gradient-accent text-white font-semibold text-[14px] px-7 py-3.5 rounded-lg hover:opacity-90 transition-opacity flex items-center gap-2 shadow-glow-indigo"
          >
            Request early access
            <ArrowRight className="w-4 h-4" />
          </button>
          <button
            onClick={() => scrollTo('features')}
            className="border border-surface-200 text-ink-700 font-semibold text-[14px] px-7 py-3.5 rounded-lg hover:border-ink-300 hover:text-ink-900 transition-colors"
          >
            Explore features
          </button>
        </div>
      </section>

      {/* ── Full-width product screenshot ─────────── */}
      <DashboardPreview />

      {/* ── Feature sections ─────────────────────── */}
      <section id="features" className="max-w-6xl mx-auto px-6 sm:px-10 py-20 space-y-28">
        {/* A: Quotes & Proposals */}
        <FeatureSection
          title="Quotes & Proposals"
          description="Create, send, and track fee quotes aligned to RIBA stages. Five built-in templates — from planning applications to BRPD services."
          learnMoreHref="/faq"
          mockup={<MockQuoteCard />}
        />

        {/* B: Project Health & Compliance */}
        <FeatureSection
          title="Project Health & Compliance"
          description="See which jobs are at risk before they become problems. Track BRPD compliance, deadlines, and team workload from one dashboard."
          learnMoreHref="/faq"
          mockup={<MockProjectHealthCard />}
          reverse
        />

        {/* C: Timesheets & Resourcing */}
        <FeatureSection
          title="Timesheets & Resourcing"
          description="Staff log time against real tasks and RIBA stages. Managers review by project, spot missing entries, and compare time against fee assumptions."
          learnMoreHref="/faq"
          mockup={<MockTimesheetCard />}
        />
      </section>

      {/* ── Waitlist form section ────────────────── */}
      <section id="waitlist" className="py-24 px-6 sm:px-10 bg-surface-50">
        <div className="max-w-md mx-auto text-center animate-fade-in">
          <h2 className="font-display text-[2rem] sm:text-[2.5rem] leading-[1.1] text-ink-900 mb-3">
            Join the design partner programme
          </h2>
          <p className="text-[15px] text-ink-500 leading-relaxed mb-10">
            Get instant access to the demo environment. We&rsquo;re onboarding practices now.
          </p>

          {submitted ? (
            <div className="card-static shadow-premium p-8 animate-fade-in text-center">
              <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-6 h-6 text-emerald-600" />
              </div>
              <h3 className="font-display text-xl text-ink-900 mb-2">You are in.</h3>
              <p className="text-[13px] text-ink-500">Redirecting you to the demo environment&hellip;</p>
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
                Instant demo access. No credit card required.
              </p>
            </form>
          )}
        </div>
      </section>

      {/* ── Social proof ─────────────────────────── */}
      <section className="py-14 px-6 sm:px-10 text-center">
        <p className="text-[14px] text-ink-400 tracking-wide">
          Built with input from practising architects in the UK
        </p>
      </section>

      {/* ── Footer ───────────────────────────────── */}
      <footer className="border-t border-surface-200 py-10 px-6 sm:px-10">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex flex-col items-center sm:items-start gap-1.5">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-gradient-accent flex items-center justify-center text-white font-display text-sm">
                C
              </div>
              <span className="font-display text-lg text-ink-900">Coordin.io</span>
            </div>
            <p className="text-[12px] text-ink-400">Project control for the built environment.</p>
          </div>
          <div className="flex items-center gap-6">
            <Link href="/faq" className="text-[13px] text-ink-500 hover:text-ink-900">
              FAQ
            </Link>
            <a href="mailto:hello@coordin.io" className="text-[13px] text-ink-500 hover:text-ink-900">
              Contact
            </a>
          </div>
        </div>
        <div className="max-w-6xl mx-auto mt-8 pt-6 border-t border-surface-200">
          <p className="text-[11px] text-ink-300 text-center">
            &copy; {new Date().getFullYear()} Coordin.io. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  )
}

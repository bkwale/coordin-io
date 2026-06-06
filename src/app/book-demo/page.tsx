'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowRight, CheckCircle, ChevronDown } from 'lucide-react'

/* ── Shared Marketing Nav ──────────────────────────── */
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
          <Link href="/use-cases" className="text-[13px] font-medium text-ink-500 hover:text-ink-900 hidden sm:block">
            Use Cases
          </Link>
          <Link href="/faq" className="text-[13px] font-medium text-ink-500 hover:text-ink-900 hidden sm:block">
            FAQ
          </Link>
          <Link href="/book-demo" className="text-[13px] font-medium text-ink-900 hidden sm:block">
            Book a Demo
          </Link>
          <Link href="/dashboard" className="text-[13px] font-medium text-accent-600 hover:text-accent-700">
            Sign In
          </Link>
        </div>
      </div>
    </nav>
  )
}

/* ── Shared Footer ─────────────────────────────────── */
function MarketingFooter() {
  return (
    <footer className="border-t border-surface-200 py-10 px-6 sm:px-10">
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-gradient-accent flex items-center justify-center text-white font-display text-sm">
            C
          </div>
          <span className="font-display text-lg text-ink-900">Coordin.io</span>
        </div>
        <div className="flex items-center gap-6">
          <Link href="/faq" className="text-[13px] text-ink-500 hover:text-ink-900">FAQ</Link>
          <a href="mailto:hello@coordin.io" className="text-[13px] text-ink-500 hover:text-ink-900">Contact</a>
        </div>
      </div>
      <div className="max-w-6xl mx-auto mt-8 pt-6 border-t border-surface-200">
        <p className="text-[11px] text-ink-300 text-center">
          &copy; {new Date().getFullYear()} Coordin.io. All rights reserved.
        </p>
      </div>
    </footer>
  )
}

/* ── Main Page ─────────────────────────────────────── */
export default function BookDemoPage() {
  const router = useRouter()
  const [submitted, setSubmitted] = useState(false)

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [practiceName, setPracticeName] = useState('')
  const [role, setRole] = useState('')
  const [practiceSize, setPracticeSize] = useState('')
  const [interests, setInterests] = useState<string[]>([])
  const [currentTools, setCurrentTools] = useState('')

  function toggleInterest(value: string) {
    setInterests(prev =>
      prev.includes(value) ? prev.filter(i => i !== value) : [...prev, value]
    )
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitted(true)
    setTimeout(() => router.push('/demo-access'), 2000)
  }

  const interestOptions = [
    'Quote workflow',
    'Project health',
    'BRPD workspace',
    'Timesheets',
    'Executive dashboard',
    'Full platform demo',
  ]

  return (
    <div className="min-h-screen bg-white">
      <MarketingNav />

      <section className="max-w-lg mx-auto px-6 sm:px-10 pt-20 sm:pt-28 pb-20 animate-fade-in">
        <h1 className="font-display text-[2.5rem] sm:text-[3rem] leading-[1.05] text-ink-900 text-center mb-3">
          Book a full demo
        </h1>
        <p className="text-[15px] text-ink-500 text-center mb-12 max-w-md mx-auto leading-relaxed">
          See the workflow that matters most to your practice. Tell us what you&rsquo;d like to explore and we&rsquo;ll prepare a focused demo.
        </p>

        {submitted ? (
          <div className="card-static shadow-premium p-8 animate-fade-in text-center">
            <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-6 h-6 text-emerald-600" />
            </div>
            <h3 className="font-display text-xl text-ink-900 mb-2">Demo booked.</h3>
            <p className="text-[13px] text-ink-500">We&rsquo;ll be in touch within 24 hours. Redirecting to the demo&hellip;</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="card-static shadow-premium p-6 sm:p-8 text-left space-y-5">
            {/* Name */}
            <div>
              <label htmlFor="name" className="block text-[11px] font-semibold text-ink-400 uppercase tracking-wider mb-1.5">
                Name <span className="text-red-400">*</span>
              </label>
              <input
                id="name"
                type="text"
                required
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Your full name"
                className="w-full px-3.5 py-2.5 rounded-lg border border-surface-200 bg-white text-[13px] text-ink-900 placeholder:text-ink-300 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-accent-500 transition-shadow"
              />
            </div>

            {/* Work email */}
            <div>
              <label htmlFor="email" className="block text-[11px] font-semibold text-ink-400 uppercase tracking-wider mb-1.5">
                Work email <span className="text-red-400">*</span>
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

            {/* Your role */}
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
                  <option value="technologist">Technologist</option>
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

            {/* What do you want to see? */}
            <div>
              <label className="block text-[11px] font-semibold text-ink-400 uppercase tracking-wider mb-3">
                What do you want to see?
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {interestOptions.map(option => (
                  <label
                    key={option}
                    className="flex items-center gap-2.5 cursor-pointer group"
                  >
                    <input
                      type="checkbox"
                      checked={interests.includes(option)}
                      onChange={() => toggleInterest(option)}
                      className="w-4 h-4 rounded border-surface-300 text-accent-600 focus:ring-accent-500"
                    />
                    <span className="text-[13px] text-ink-700 group-hover:text-ink-900">{option}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Current tools */}
            <div>
              <label htmlFor="tools" className="block text-[11px] font-semibold text-ink-400 uppercase tracking-wider mb-1.5">
                Current tools you use <span className="text-ink-300">(optional)</span>
              </label>
              <input
                id="tools"
                type="text"
                value={currentTools}
                onChange={e => setCurrentTools(e.target.value)}
                placeholder="e.g. Excel, Xero, Monday.com"
                className="w-full px-3.5 py-2.5 rounded-lg border border-surface-200 bg-white text-[13px] text-ink-900 placeholder:text-ink-300 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-accent-500 transition-shadow"
              />
            </div>

            {/* Submit */}
            <button
              type="submit"
              className="w-full bg-gradient-accent text-white font-semibold text-[14px] py-3.5 rounded-lg hover:opacity-90 transition-opacity flex items-center justify-center gap-2 shadow-glow-indigo mt-2"
            >
              Book my demo
              <ArrowRight className="w-4 h-4" />
            </button>

            <p className="text-center text-[13px] text-ink-500 mt-4">
              Or{' '}
              <Link href="/dashboard" className="text-accent-600 hover:text-accent-700 font-medium">
                explore the demo yourself &rarr;
              </Link>
            </p>
          </form>
        )}
      </section>

      <MarketingFooter />
    </div>
  )
}

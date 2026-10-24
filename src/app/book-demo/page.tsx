'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowRight, CheckCircle, ChevronDown, Menu, X } from 'lucide-react'

/* ── Design tokens (matches Option C landing page) ── */
const lp = {
  bg: '#f8f7f4',
  text: '#1a1a18',
  secondary: '#6b6a65',
  muted: '#8a8880',
  border: '#d8d6d0',
  accent: '#6366f1',
}

/* ── Nav ─────────────────────────────────────────── */
function Nav() {
  const [open, setOpen] = useState(false)

  return (
    <nav className="border-b" style={{ borderColor: lp.border }}>
      <div className="flex items-center justify-between px-6 sm:px-10 lg:px-16 py-5 max-w-[1200px] mx-auto">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#1a1a18] flex items-center justify-center text-white text-lg font-semibold">
            C
          </div>
          <span className="text-xl font-light tracking-tight" style={{ color: lp.text }}>
            Coordin.io
          </span>
        </Link>

        {/* Desktop links */}
        <div className="hidden sm:flex items-center gap-8">
          <Link href="/features/brpd" className="text-[13px] transition-colors" style={{ color: lp.secondary }}>
            Features
          </Link>
          <Link href="/use-cases" className="text-[13px] transition-colors" style={{ color: lp.secondary }}>
            Use Cases
          </Link>
          <Link href="/faq" className="text-[13px] transition-colors" style={{ color: lp.secondary }}>
            FAQ
          </Link>
          <Link href="/login" className="text-[13px] font-medium" style={{ color: lp.text }}>
            Sign In
          </Link>
        </div>

        {/* Mobile: Sign In + hamburger */}
        <div className="flex sm:hidden items-center gap-4">
          <Link href="/login" className="text-[13px] font-medium" style={{ color: lp.text }}>
            Sign In
          </Link>
          <button
            onClick={() => setOpen(!open)}
            aria-label={open ? 'Close menu' : 'Open menu'}
            className="p-1"
          >
            {open ? <X className="w-5 h-5" style={{ color: lp.text }} /> : <Menu className="w-5 h-5" style={{ color: lp.text }} />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="sm:hidden border-t px-6 py-4 flex flex-col gap-4" style={{ borderColor: lp.border }}>
          <Link href="/features/brpd" onClick={() => setOpen(false)} className="text-[14px] py-1" style={{ color: lp.secondary }}>
            Features
          </Link>
          <Link href="/use-cases" onClick={() => setOpen(false)} className="text-[14px] py-1" style={{ color: lp.secondary }}>
            Use Cases
          </Link>
          <Link href="/faq" onClick={() => setOpen(false)} className="text-[14px] py-1" style={{ color: lp.secondary }}>
            FAQ
          </Link>
          <Link
            href="/book-demo"
            onClick={() => setOpen(false)}
            className="inline-flex items-center gap-2 text-[14px] font-medium mt-1"
            style={{ color: lp.text }}
          >
            Book a demo <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      )}
    </nav>
  )
}

/* ── Footer ──────────────────────────────────────── */
function Footer() {
  return (
    <footer style={{ borderTop: `1px solid ${lp.border}` }}>
      <div className="px-6 sm:px-10 lg:px-16 max-w-[1200px] mx-auto py-8 flex items-center justify-between">
        <p className="text-[12px]" style={{ color: lp.muted }}>
          &copy; {new Date().getFullYear()} Coordin.io
        </p>
        <div className="flex items-center gap-6">
          <a href="#" className="text-[12px] transition-colors hover:opacity-70" style={{ color: lp.muted }}>
            Privacy
          </a>
          <a href="#" className="text-[12px] transition-colors hover:opacity-70" style={{ color: lp.muted }}>
            Terms
          </a>
          <a href="mailto:hello@coordin.io" className="text-[12px] transition-colors hover:opacity-70" style={{ color: lp.muted }}>
            Contact
          </a>
        </div>
      </div>
    </footer>
  )
}

/* ── Main Page ───────────────────────────────────── */
export default function BookDemoPage() {
  const router = useRouter()
  const [submitted, setSubmitted] = useState(false)
  const [mobileMenu, setMobileMenu] = useState(false)

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

  /* shared input styles */
  const inputStyle: React.CSSProperties = {
    border: `1px solid ${lp.border}`,
    color: lp.text,
  }

  return (
    <div style={{ backgroundColor: lp.bg, minHeight: '100vh' }}>
      <Nav />

      <section className="max-w-lg mx-auto px-6 sm:px-10 pt-20 sm:pt-28 pb-20">
        <h1
          className="text-[2.5rem] sm:text-[3rem] leading-[1.05] font-light tracking-tight text-center mb-3"
          style={{ color: lp.text }}
        >
          Book a full demo
        </h1>
        <p
          className="text-[15px] text-center mb-12 max-w-md mx-auto leading-relaxed"
          style={{ color: lp.secondary }}
        >
          See the workflow that matters most to your practice. Tell us what you&rsquo;d like to explore and we&rsquo;ll prepare a focused demo.
        </p>

        {submitted ? (
          <div
            className="rounded-xl shadow-lg p-8 text-center"
            style={{ backgroundColor: '#ffffff', border: `1px solid ${lp.border}` }}
          >
            <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-6 h-6 text-emerald-600" />
            </div>
            <h3 className="text-xl font-medium mb-2" style={{ color: lp.text }}>
              Demo booked.
            </h3>
            <p className="text-[13px]" style={{ color: lp.secondary }}>
              We&rsquo;ll be in touch within 24 hours. Redirecting to the demo&hellip;
            </p>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="rounded-xl shadow-lg p-6 sm:p-8 text-left space-y-5"
            style={{ backgroundColor: '#ffffff', border: `1px solid ${lp.border}` }}
          >
            {/* Name */}
            <div>
              <label
                htmlFor="name"
                className="block text-[11px] font-medium uppercase tracking-wider mb-1.5"
                style={{ color: lp.muted }}
              >
                Name <span className="text-red-400">*</span>
              </label>
              <input
                id="name"
                type="text"
                required
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Your full name"
                className="w-full px-3.5 py-2.5 rounded-lg bg-white text-[13px] focus:outline-none focus:ring-2 transition-shadow"
                style={{
                  ...inputStyle,
                  '--tw-ring-color': lp.accent,
                } as React.CSSProperties}
              />
            </div>

            {/* Work email */}
            <div>
              <label
                htmlFor="email"
                className="block text-[11px] font-medium uppercase tracking-wider mb-1.5"
                style={{ color: lp.muted }}
              >
                Work email <span className="text-red-400">*</span>
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@practice.com"
                className="w-full px-3.5 py-2.5 rounded-lg bg-white text-[13px] focus:outline-none focus:ring-2 transition-shadow"
                style={{
                  ...inputStyle,
                  '--tw-ring-color': lp.accent,
                } as React.CSSProperties}
              />
            </div>

            {/* Practice name */}
            <div>
              <label
                htmlFor="practice"
                className="block text-[11px] font-medium uppercase tracking-wider mb-1.5"
                style={{ color: lp.muted }}
              >
                Practice name
              </label>
              <input
                id="practice"
                type="text"
                value={practiceName}
                onChange={e => setPracticeName(e.target.value)}
                placeholder="Maple Architects"
                className="w-full px-3.5 py-2.5 rounded-lg bg-white text-[13px] focus:outline-none focus:ring-2 transition-shadow"
                style={{
                  ...inputStyle,
                  '--tw-ring-color': lp.accent,
                } as React.CSSProperties}
              />
            </div>

            {/* Your role */}
            <div>
              <label
                htmlFor="role"
                className="block text-[11px] font-medium uppercase tracking-wider mb-1.5"
                style={{ color: lp.muted }}
              >
                Your role
              </label>
              <div className="relative">
                <select
                  id="role"
                  value={role}
                  onChange={e => setRole(e.target.value)}
                  className="w-full appearance-none px-3.5 py-2.5 rounded-lg bg-white text-[13px] focus:outline-none focus:ring-2 transition-shadow pr-10"
                  style={{
                    ...inputStyle,
                    '--tw-ring-color': lp.accent,
                  } as React.CSSProperties}
                >
                  <option value="">Select...</option>
                  <option value="practice_owner">Practice Owner</option>
                  <option value="director">Director</option>
                  <option value="project_lead">Project Lead</option>
                  <option value="associate">Associate</option>
                  <option value="technologist">Technologist</option>
                  <option value="other">Other</option>
                </select>
                <ChevronDown className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: lp.muted }} />
              </div>
            </div>

            {/* Practice size */}
            <div>
              <label
                htmlFor="size"
                className="block text-[11px] font-medium uppercase tracking-wider mb-1.5"
                style={{ color: lp.muted }}
              >
                Practice size
              </label>
              <div className="relative">
                <select
                  id="size"
                  value={practiceSize}
                  onChange={e => setPracticeSize(e.target.value)}
                  className="w-full appearance-none px-3.5 py-2.5 rounded-lg bg-white text-[13px] focus:outline-none focus:ring-2 transition-shadow pr-10"
                  style={{
                    ...inputStyle,
                    '--tw-ring-color': lp.accent,
                  } as React.CSSProperties}
                >
                  <option value="">Select...</option>
                  <option value="1-5">1-5</option>
                  <option value="6-15">6-15</option>
                  <option value="16-30">16-30</option>
                  <option value="30+">30+</option>
                </select>
                <ChevronDown className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: lp.muted }} />
              </div>
            </div>

            {/* What do you want to see? */}
            <div>
              <label
                className="block text-[11px] font-medium uppercase tracking-wider mb-3"
                style={{ color: lp.muted }}
              >
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
                      className="w-4 h-4 rounded"
                      style={{ accentColor: lp.accent }}
                    />
                    <span className="text-[13px]" style={{ color: lp.secondary }}>
                      {option}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* Current tools */}
            <div>
              <label
                htmlFor="tools"
                className="block text-[11px] font-medium uppercase tracking-wider mb-1.5"
                style={{ color: lp.muted }}
              >
                Current tools you use{' '}
                <span style={{ color: lp.border }}>(optional)</span>
              </label>
              <input
                id="tools"
                type="text"
                value={currentTools}
                onChange={e => setCurrentTools(e.target.value)}
                placeholder="e.g. Excel, Xero, Monday.com"
                className="w-full px-3.5 py-2.5 rounded-lg bg-white text-[13px] focus:outline-none focus:ring-2 transition-shadow"
                style={{
                  ...inputStyle,
                  '--tw-ring-color': lp.accent,
                } as React.CSSProperties}
              />
            </div>

            {/* Submit */}
            <button
              type="submit"
              className="w-full text-white font-semibold text-[14px] py-3.5 rounded-lg hover:opacity-90 transition-opacity flex items-center justify-center gap-2 mt-2"
              style={{ backgroundColor: lp.text }}
            >
              Book my demo
              <ArrowRight className="w-4 h-4" />
            </button>

            <p className="text-center text-[13px] mt-4" style={{ color: lp.secondary }}>
              Or{' '}
              <Link
                href="/demo-access"
                className="font-medium hover:opacity-70 transition-opacity"
                style={{ color: lp.accent }}
              >
                explore the demo yourself &rarr;
              </Link>
            </p>
          </form>
        )}
      </section>

      <Footer />
    </div>
  )
}

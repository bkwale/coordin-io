'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowRight, Menu, X, Users, FileCheck, ShieldCheck, BarChart3, History, Bell } from 'lucide-react'

/* ── Design tokens (matches landing page Option C) ── */
const lp = {
  bg: '#f8f7f4',
  text: '#1a1a18',
  secondary: '#6b6a65',
  muted: '#8a8880',
  border: '#d8d6d0',
  accent: '#6366f1',
}

/* ── Nav ───────────────────────────────────────── */
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

/* ── Footer ────────────────────────────────────── */
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

/* ── Feature data ─────────────────────────────── */
const features = [
  {
    num: '01',
    icon: <Users className="w-5 h-5" style={{ color: lp.accent }} />,
    title: 'Dutyholder Register',
    description: 'Manage all dutyholders in one place — roles, appointments, contact details and responsibilities clearly tracked per project.',
  },
  {
    num: '02',
    icon: <FileCheck className="w-5 h-5" style={{ color: lp.accent }} />,
    title: 'Prescribed Document Tracking',
    description: 'Track prescribed documents against regulatory requirements. Know what has been submitted, what is outstanding and what needs updating.',
  },
  {
    num: '03',
    icon: <ShieldCheck className="w-5 h-5" style={{ color: lp.accent }} />,
    title: 'Compliance Statements',
    description: 'Generate and manage compliance statements with full audit trails. Evidence is linked to specific requirements and gateway stages.',
  },
  {
    num: '04',
    icon: <BarChart3 className="w-5 h-5" style={{ color: lp.accent }} />,
    title: 'Gateway Readiness',
    description: 'Visual readiness tracker for each gateway stage. See at a glance what is complete, in progress or blocking submission.',
  },
  {
    num: '05',
    icon: <History className="w-5 h-5" style={{ color: lp.accent }} />,
    title: 'Changelog & Evidence',
    description: 'Every action, upload and decision is logged with timestamps. Build a defensible audit trail without extra admin.',
  },
  {
    num: '06',
    icon: <Bell className="w-5 h-5" style={{ color: lp.accent }} />,
    title: 'Deadline Monitoring',
    description: 'Automated alerts for upcoming gateway deadlines, expiring documents and overdue actions. Never miss a submission date.',
  },
]

/* ── Main Page ─────────────────────────────────── */
export default function BRPDFeaturePage() {
  return (
    <div style={{ backgroundColor: lp.bg, minHeight: '100vh' }}>
      <Nav />

      {/* Hero */}
      <section className="px-6 sm:px-10 lg:px-16 max-w-[1200px] mx-auto pt-20 sm:pt-28 pb-16 sm:pb-20">
        <p
          className="text-[10px] font-medium uppercase tracking-[0.2em] mb-6"
          style={{ color: lp.muted, fontFamily: "'Space Mono', monospace" }}
        >
          Feature
        </p>
        <h1
          className="text-[clamp(2.2rem,5vw,3.8rem)] font-light leading-[1.1] tracking-tight max-w-[680px]"
          style={{ color: lp.text }}
        >
          BRPD Compliance Workspace
        </h1>
        <p
          className="mt-6 text-[15px] sm:text-[17px] leading-relaxed max-w-[520px]"
          style={{ color: lp.secondary }}
        >
          Manage Building Regulations Principal Designer coordination in one place &mdash; dutyholders, prescribed documents, evidence, gateway readiness and deadlines.
        </p>
      </section>

      {/* What it does */}
      <section className="px-6 sm:px-10 lg:px-16 max-w-[1200px] mx-auto pb-24 sm:pb-32">
        <p
          className="text-[10px] font-medium uppercase tracking-[0.2em] mb-8"
          style={{ color: lp.muted, fontFamily: "'Space Mono', monospace" }}
        >
          What it does
        </p>
        <div className="border-l-2 pl-6 max-w-[680px]" style={{ borderColor: lp.border }}>
          <p
            className="text-[15px] leading-relaxed"
            style={{ color: lp.secondary }}
          >
            The BRPD Compliance Workspace gives principal designers and practice directors a single, auditable environment
            to coordinate all Building Regulations Principal Designer responsibilities. Instead of scattering dutyholder records
            across spreadsheets, prescribed documents across shared drives, and compliance evidence across email threads,
            Coordin brings everything into one workspace. Track dutyholder appointments, manage prescribed documents against
            regulatory requirements, upload and version evidence, monitor gateway readiness, and maintain a complete changelog
            of every compliance action taken — all linked to your live projects.
          </p>
        </div>
      </section>

      {/* Key Features */}
      <section className="px-6 sm:px-10 lg:px-16 max-w-[1200px] mx-auto pb-24 sm:pb-32">
        <p
          className="text-[10px] font-medium uppercase tracking-[0.2em] mb-12"
          style={{ color: lp.muted, fontFamily: "'Space Mono', monospace" }}
        >
          Key features
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-16 gap-y-12">
          {features.map((f) => (
            <div key={f.num} className="border-l-2 pl-6" style={{ borderColor: lp.border }}>
              <p
                className="text-[10px] font-medium tracking-[0.15em] mb-2"
                style={{ color: lp.muted, fontFamily: "'Space Mono', monospace" }}
              >
                {f.num}
              </p>
              <div className="flex items-center gap-2.5 mb-2">
                {f.icon}
                <h3
                  className="text-[18px] font-medium"
                  style={{ color: lp.text }}
                >
                  {f.title}
                </h3>
              </div>
              <p
                className="text-[14px] leading-relaxed"
                style={{ color: lp.secondary }}
              >
                {f.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Who uses it */}
      <section
        className="py-16 sm:py-20"
        style={{ borderTop: `1px solid ${lp.border}`, borderBottom: `1px solid ${lp.border}` }}
      >
        <div className="px-6 sm:px-10 lg:px-16 max-w-[1200px] mx-auto">
          <p
            className="text-[10px] font-medium uppercase tracking-[0.2em] mb-6"
            style={{ color: lp.muted, fontFamily: "'Space Mono', monospace" }}
          >
            Who uses it
          </p>
          <p
            className="text-[15px] leading-relaxed max-w-[520px]"
            style={{ color: lp.secondary }}
          >
            BRPD leads, compliance managers, principal designers, practice directors.
          </p>
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 sm:px-10 lg:px-16 max-w-[1200px] mx-auto py-24 sm:py-32 text-center">
        <h2
          className="text-[clamp(1.8rem,4vw,2.8rem)] font-light tracking-tight mb-4"
          style={{ color: lp.text }}
        >
          See BRPD in the demo
        </h2>
        <p className="text-[15px] mb-10" style={{ color: lp.muted }}>
          30 minutes. Your workflows. No slide deck.
        </p>
        <Link
          href="/book-demo"
          className="inline-flex items-center gap-2 px-8 py-3.5 rounded-lg text-white text-[14px] font-medium transition-opacity hover:opacity-90"
          style={{ backgroundColor: lp.text }}
        >
          Book a demo <ArrowRight className="w-4 h-4" />
        </Link>
        <div className="mt-4">
          <Link
            href="/demo-access"
            className="text-[13px] transition-colors hover:opacity-70"
            style={{ color: lp.muted }}
          >
            Or try it yourself
          </Link>
        </div>
      </section>

      <Footer />
    </div>
  )
}

'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowRight, Menu, X, Layers, FileText, Calculator, GitBranch } from 'lucide-react'

/* ══════════════════════════════════════════════════
   Coordin.io — Quote to Project Feature
   Option C design language
   ══════════════════════════════════════════════════ */

/* ── Design tokens ────────────────────────────────── */
const lp = {
  bg: '#f8f7f4',
  text: '#1a1a18',
  secondary: '#6b6a65',
  muted: '#8a8880',
  border: '#d8d6d0',
  accent: '#6366f1',
}

/* ── Nav ──────────────────────────────────────────── */
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

/* ── Footer ───────────────────────────────────────── */
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

/* ── Main Page ─────────────────────────────────────── */
export default function QuotesFeaturePage() {
  const templates = [
    { name: 'Planning / Pre-App', description: 'Scope and fees for planning applications, pre-app advice and feasibility studies.' },
    { name: 'Technical / Delivery', description: 'Detailed design, technical coordination and construction-stage services.' },
    { name: 'Full Appointment', description: 'End-to-end RIBA Stage 0-7 appointment covering the full project lifecycle.' },
    { name: 'BRPD Services', description: 'Principal Designer coordination, gateway submissions and compliance management.' },
    { name: 'CDM PD Services', description: 'CDM Principal Designer duties including pre-construction information and H&S file.' },
  ]

  const lifecycle = [
    { label: 'Draft', bg: '#e5e5e3', color: lp.secondary },
    { label: 'Internal Review', bg: '#dbeafe', color: '#1d4ed8' },
    { label: 'Ready to Send', bg: '#e0e7ff', color: '#4338ca' },
    { label: 'Sent', bg: '#fef3c7', color: '#b45309' },
    { label: 'Viewed', bg: '#f3e8ff', color: '#7e22ce' },
    { label: 'Accepted', bg: '#d1fae5', color: '#047857' },
    { label: 'Converted to Project', bg: '#e0e7ff', color: lp.accent },
  ]

  return (
    <div className="min-h-screen" style={{ backgroundColor: lp.bg }}>
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
          Quote to Project Workflow
        </h1>
        <p
          className="mt-6 text-[15px] sm:text-[17px] leading-relaxed max-w-[520px]"
          style={{ color: lp.secondary }}
        >
          Create, send and track fee quotes with RIBA-aligned templates. Convert accepted quotes directly into live projects.
        </p>
      </section>

      {/* Two Modes */}
      <section className="px-6 sm:px-10 lg:px-16 max-w-[1200px] mx-auto pb-24 sm:pb-32">
        <p
          className="text-[10px] font-medium uppercase tracking-[0.2em] mb-8"
          style={{ color: lp.muted, fontFamily: "'Space Mono', monospace" }}
        >
          Two modes
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
          <div className="border-l-2 pl-6" style={{ borderColor: lp.border }}>
            <div className="flex items-center gap-2.5 mb-3">
              <Layers className="w-5 h-5" style={{ color: lp.accent }} />
              <h3 className="text-[18px] font-medium" style={{ color: lp.text }}>
                Linked to existing project
              </h3>
            </div>
            <p className="text-[14px] leading-relaxed" style={{ color: lp.secondary }}>
              Attach a quote to an existing project in Coordin. Fee stages, client details and project metadata are pre-populated.
              Ideal for additional services, variations or phased appointments on live projects.
            </p>
          </div>
          <div className="border-l-2 pl-6" style={{ borderColor: lp.border }}>
            <div className="flex items-center gap-2.5 mb-3">
              <FileText className="w-5 h-5" style={{ color: lp.accent }} />
              <h3 className="text-[18px] font-medium" style={{ color: lp.text }}>
                Standalone quote
              </h3>
            </div>
            <p className="text-[14px] leading-relaxed" style={{ color: lp.secondary }}>
              Create a quote from scratch for a new enquiry. Once accepted, convert it into a live project with one click.
              All fee data, scope and assumptions transfer automatically.
            </p>
          </div>
        </div>
      </section>

      {/* 5 Templates */}
      <section
        className="py-16 sm:py-20"
        style={{ borderTop: `1px solid ${lp.border}`, borderBottom: `1px solid ${lp.border}` }}
      >
        <div className="px-6 sm:px-10 lg:px-16 max-w-[1200px] mx-auto">
          <p
            className="text-[10px] font-medium uppercase tracking-[0.2em] mb-8"
            style={{ color: lp.muted, fontFamily: "'Space Mono', monospace" }}
          >
            5 RIBA-aligned templates
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {templates.map((t) => (
              <div key={t.name} className="border-l-2 pl-5" style={{ borderColor: lp.border }}>
                <h3 className="text-[15px] font-medium mb-2" style={{ color: lp.text }}>{t.name}</h3>
                <p className="text-[13px] leading-relaxed" style={{ color: lp.secondary }}>{t.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Quote Builder */}
      <section className="px-6 sm:px-10 lg:px-16 max-w-[1200px] mx-auto py-24 sm:py-32">
        <div className="border-l-2 pl-6 max-w-[680px]" style={{ borderColor: lp.border }}>
          <p
            className="text-[10px] font-medium tracking-[0.15em] uppercase mb-2"
            style={{ color: lp.muted, fontFamily: "'Space Mono', monospace" }}
          >
            03
          </p>
          <div className="flex items-center gap-2.5 mb-3">
            <Calculator className="w-5 h-5" style={{ color: lp.accent }} />
            <h2 className="text-[1.6rem] sm:text-[2rem] font-light leading-[1.15] tracking-tight" style={{ color: lp.text }}>
              Quote builder
            </h2>
          </div>
          <p className="text-[15px] leading-relaxed" style={{ color: lp.secondary }}>
            12-tab builder covering scope, stage fees, optional extras, meetings, travel, design freeze, exclusions, terms and acceptance.
            Every section is designed for architectural and engineering practices — no generic invoicing tool compromises.
          </p>
        </div>
      </section>

      {/* Quote Lifecycle */}
      <section
        className="py-16 sm:py-20"
        style={{ borderTop: `1px solid ${lp.border}`, borderBottom: `1px solid ${lp.border}` }}
      >
        <div className="px-6 sm:px-10 lg:px-16 max-w-[1200px] mx-auto">
          <div className="flex items-center gap-2.5 mb-8">
            <GitBranch className="w-5 h-5" style={{ color: lp.accent }} />
            <p
              className="text-[10px] font-medium uppercase tracking-[0.2em]"
              style={{ color: lp.muted, fontFamily: "'Space Mono', monospace" }}
            >
              Quote lifecycle
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {lifecycle.map((step, i) => (
              <div key={step.label} className="flex items-center gap-3">
                <span
                  className="inline-block px-3 py-1.5 rounded-full text-[12px] font-semibold"
                  style={{ backgroundColor: step.bg, color: step.color }}
                >
                  {step.label}
                </span>
                {i < lifecycle.length - 1 && (
                  <ArrowRight className="w-4 h-4" style={{ color: lp.border }} />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 sm:px-10 lg:px-16 max-w-[1200px] mx-auto py-24 sm:py-32 text-center">
        <h2
          className="text-[clamp(1.8rem,4vw,2.8rem)] font-light tracking-tight mb-4"
          style={{ color: lp.text }}
        >
          See Quote to Project in the demo
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

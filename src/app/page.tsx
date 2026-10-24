'use client'

import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

/* ══════════════════════════════════════════════════
   Coordin.io — Landing Page
   Option C: The architect's portfolio
   Typography-driven · warm neutrals · generous whitespace
   ══════════════════════════════════════════════════ */

/* ── Design tokens (landing page only) ─────────── */
const lp = {
  bg: '#f8f7f4',
  text: '#1a1a18',
  secondary: '#6b6a65',
  muted: '#8a8880',
  border: '#d8d6d0',
  accent: '#6366f1', // bridges to app accent
}

/* ── Nav ───────────────────────────────────────── */
function Nav() {
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
        <div className="flex items-center gap-6 sm:gap-8">
          <Link
            href="/features/brpd"
            className="text-[13px] hidden sm:block transition-colors"
            style={{ color: lp.secondary }}
          >
            Features
          </Link>
          <Link
            href="/use-cases"
            className="text-[13px] hidden sm:block transition-colors"
            style={{ color: lp.secondary }}
          >
            Use Cases
          </Link>
          <Link
            href="/faq"
            className="text-[13px] hidden sm:block transition-colors"
            style={{ color: lp.secondary }}
          >
            FAQ
          </Link>
          <Link
            href="/login"
            className="text-[13px] font-medium"
            style={{ color: lp.text }}
          >
            Sign In
          </Link>
        </div>
      </div>
    </nav>
  )
}

/* ── Hero ──────────────────────────────────────── */
function Hero() {
  return (
    <section className="px-6 sm:px-10 lg:px-16 max-w-[1200px] mx-auto pt-20 sm:pt-28 pb-16 sm:pb-20">
      <h1
        className="text-[clamp(2.2rem,5vw,3.8rem)] font-light leading-[1.1] tracking-tight max-w-[680px]"
        style={{ color: lp.text }}
      >
        Project control for architects who build.
      </h1>
      <p
        className="mt-6 text-[15px] sm:text-[17px] leading-relaxed max-w-[520px]"
        style={{ color: lp.secondary }}
      >
        Quotes, delivery, compliance and commercial health in one platform. Built around RIBA stages and real practice workflow.
      </p>
      <Link
        href="/book-demo"
        className="inline-flex items-center gap-2 mt-10 text-[14px] font-medium border-b-2 pb-1 transition-opacity hover:opacity-70"
        style={{ color: lp.text, borderColor: lp.text }}
      >
        Book a demo <ArrowRight className="w-4 h-4" />
      </Link>
    </section>
  )
}

/* ── Product screenshot ────────────────────────── */
function ProductPreview() {
  const kpis = [
    { label: 'Active Projects', value: '12', sub: '+2 this month' },
    { label: 'Quotes Sent', value: '8', sub: '3 awaiting' },
    { label: 'Team Utilisation', value: '84%', sub: 'Target: 80%' },
    { label: 'BRPD Compliance', value: '96%', sub: '1 action due' },
  ]

  const rows = [
    { name: 'Whitmore House', stage: 'Stage 3', health: '#22c55e', fee: '£42,500' },
    { name: 'Kensington Mews', stage: 'Stage 4', health: '#f59e0b', fee: '£67,200' },
    { name: 'Park Lane Mixed-Use', stage: 'Stage 2', health: '#22c55e', fee: '£128,000' },
  ]

  return (
    <section className="px-6 sm:px-10 lg:px-16 max-w-[1200px] mx-auto pb-24 sm:pb-32">
      <div
        className="rounded-xl overflow-hidden shadow-lg"
        style={{ border: `1px solid ${lp.border}` }}
      >
        {/* Browser chrome */}
        <div
          className="flex items-center gap-2 px-5 py-3"
          style={{ backgroundColor: '#f0efec', borderBottom: `1px solid ${lp.border}` }}
        >
          <div className="flex gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-[#ff5f57]" />
            <div className="w-2.5 h-2.5 rounded-full bg-[#febc2e]" />
            <div className="w-2.5 h-2.5 rounded-full bg-[#28c840]" />
          </div>
          <div className="flex-1 flex justify-center">
            <div
              className="rounded-md px-4 py-1 text-[11px] font-medium"
              style={{ backgroundColor: '#fff', border: `1px solid ${lp.border}`, color: lp.muted }}
            >
              app.coordin.io
            </div>
          </div>
        </div>

        {/* Dashboard content — uses app colors */}
        <div className="p-6 sm:p-8 bg-white">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-md bg-gradient-to-br from-[#6366f1] to-[#8b5cf6] flex items-center justify-center text-white text-sm font-semibold">
                C
              </div>
              <span className="font-semibold text-lg text-gray-900">CWA Homes</span>
            </div>
            <div className="flex gap-4 text-[12px] text-gray-500 font-medium">
              <span className="text-gray-900 border-b-2 border-[#6366f1] pb-1">Overview</span>
              <span className="hidden sm:inline">Tasks</span>
              <span className="hidden sm:inline">Documents</span>
              <span className="hidden sm:inline">Commercial</span>
              <span className="hidden sm:inline">Compliance</span>
            </div>
          </div>

          {/* KPI strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {kpis.map(k => (
              <div key={k.label} className="rounded-lg bg-gray-50 border border-gray-100 p-4">
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">{k.label}</p>
                <p className="text-2xl font-semibold text-gray-900 tabular-nums">{k.value}</p>
                <p className="text-[10px] text-gray-400 mt-0.5">{k.sub}</p>
              </div>
            ))}
          </div>

          {/* Project table */}
          <div className="mt-5">
            <div className="grid grid-cols-[1fr_auto_auto_auto] gap-4 px-3 py-2 text-[10px] font-semibold text-gray-400 uppercase tracking-wider border-b border-gray-100">
              <span>Project</span>
              <span>Stage</span>
              <span>Health</span>
              <span className="text-right">Fee</span>
            </div>
            {rows.map(r => (
              <div key={r.name} className="grid grid-cols-[1fr_auto_auto_auto] gap-4 px-3 py-3 items-center border-b border-gray-50 last:border-0">
                <span className="text-[13px] font-medium text-gray-900">{r.name}</span>
                <span className="text-[11px] text-gray-500 font-medium">{r.stage}</span>
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: r.health }} />
                <span className="text-[13px] text-gray-700 tabular-nums text-right">{r.fee}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

/* ── Features grid ─────────────────────────────── */
const features = [
  {
    num: '01',
    title: 'Quote to project',
    desc: 'Create RIBA-aligned quotes, send them professionally, convert accepted work into live projects. Fee assumptions carry through.',
  },
  {
    num: '02',
    title: 'Project health',
    desc: 'See fee risk, stage overspend and project drift before they become problems. At-risk jobs surface automatically.',
  },
  {
    num: '03',
    title: 'BRPD compliance',
    desc: 'Dutyholders, prescribed documents, evidence uploads, actions and deadlines. One workspace instead of scattered spreadsheets.',
  },
  {
    num: '04',
    title: 'Timesheets',
    desc: 'Staff book time against real project tasks and RIBA stages. Managers review by project, task and stage. Weekly completion takes minutes.',
  },
  {
    num: '05',
    title: 'E-invoicing',
    desc: 'Peppol and UBL 2.1 compliant. Inbound PDF extraction, outbound quote-to-invoice conversion. Xero sync built in.',
  },
  {
    num: '06',
    title: 'RIBA stage tracking',
    desc: 'Formal stage gates with prerequisite checklists. Advance and rollback controls. Full audit trail of every transition.',
  },
]

function Features() {
  return (
    <section className="px-6 sm:px-10 lg:px-16 max-w-[1200px] mx-auto pb-24 sm:pb-32">
      <p
        className="text-[10px] font-medium uppercase tracking-[0.2em] mb-12"
        style={{ color: lp.muted, fontFamily: "'Space Mono', monospace" }}
      >
        What it does
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-16 gap-y-12">
        {features.map(f => (
          <div key={f.num} className="border-l-2 pl-6" style={{ borderColor: lp.border }}>
            <p
              className="text-[10px] font-medium tracking-[0.15em] mb-2"
              style={{ color: lp.muted, fontFamily: "'Space Mono', monospace" }}
            >
              {f.num}
            </p>
            <h3
              className="text-[18px] font-medium mb-2"
              style={{ color: lp.text }}
            >
              {f.title}
            </h3>
            <p
              className="text-[14px] leading-relaxed"
              style={{ color: lp.secondary }}
            >
              {f.desc}
            </p>
          </div>
        ))}
      </div>
    </section>
  )
}

/* ── Trust strip ───────────────────────────────── */
const stats = [
  { value: '7', label: 'Connected workflows in one platform' },
  { value: 'RIBA', label: 'Aligned to the Plan of Work stages 0–7' },
  { value: 'Peppol', label: 'EU e-invoicing mandate ready from day one' },
  { value: 'BRPD', label: 'Compliance workspace built into every project' },
]

function TrustStrip() {
  return (
    <section
      className="py-16 sm:py-20"
      style={{ borderTop: `1px solid ${lp.border}`, borderBottom: `1px solid ${lp.border}` }}
    >
      <div className="px-6 sm:px-10 lg:px-16 max-w-[1200px] mx-auto">
        <p
          className="text-[10px] font-medium uppercase tracking-[0.2em] mb-10"
          style={{ color: lp.muted, fontFamily: "'Space Mono', monospace" }}
        >
          Built for practice
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-10">
          {stats.map(s => (
            <div key={s.value}>
              <p
                className="text-[28px] sm:text-[32px] font-light tracking-tight"
                style={{ color: lp.text }}
              >
                {s.value}
              </p>
              <p
                className="text-[13px] leading-snug mt-1"
                style={{ color: lp.muted }}
              >
                {s.label}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ── CTA ───────────────────────────────────────── */
function CTA() {
  return (
    <section className="px-6 sm:px-10 lg:px-16 max-w-[1200px] mx-auto py-24 sm:py-32 text-center">
      <h2
        className="text-[clamp(1.8rem,4vw,2.8rem)] font-light tracking-tight mb-4"
        style={{ color: lp.text }}
      >
        See it working.
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

/* ── Page ──────────────────────────────────────── */
export default function LandingPage() {
  return (
    <div style={{ backgroundColor: lp.bg, minHeight: '100vh' }}>
      <Nav />
      <Hero />
      <ProductPreview />
      <Features />
      <TrustStrip />
      <CTA />
      <Footer />
    </div>
  )
}

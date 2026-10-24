'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowRight, Menu, X } from 'lucide-react'

/* ══════════════════════════════════════════════════
   Coordin.io — Use Cases
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
          <Link href="/use-cases" className="text-[13px] font-medium transition-colors" style={{ color: lp.text }}>
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
          <Link href="/use-cases" onClick={() => setOpen(false)} className="text-[14px] py-1 font-medium" style={{ color: lp.text }}>
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

/* ── Use Case Section ─────────────────────────────── */
function UseCaseSection({
  number,
  title,
  problem,
  solution,
  outcomes,
  ctaLabel,
}: {
  number: string
  title: string
  problem: string
  solution: string
  outcomes: string[]
  ctaLabel: string
}) {
  return (
    <section className="py-16 border-b last:border-0" style={{ borderColor: lp.border }}>
      <div className="max-w-3xl mx-auto border-l-2 pl-6" style={{ borderColor: lp.border }}>
        <p
          className="text-[10px] font-medium tracking-[0.2em] uppercase mb-3"
          style={{ color: lp.muted, fontFamily: "'Space Mono', monospace" }}
        >
          {number}
        </p>
        <h2
          className="text-[1.6rem] sm:text-[2rem] font-light leading-[1.15] tracking-tight mb-4"
          style={{ color: lp.text }}
        >
          {title}
        </h2>
        <p className="italic text-[15px] mb-4 leading-relaxed" style={{ color: lp.muted }}>
          {problem}
        </p>
        <p className="text-[15px] leading-relaxed mb-6" style={{ color: lp.secondary }}>
          {solution}
        </p>
        <ul className="space-y-2 mb-8">
          {outcomes.map((item, i) => (
            <li key={i} className="flex items-start gap-2.5">
              <span className="mt-[9px] shrink-0" style={{ color: lp.secondary }}>&ndash;</span>
              <span className="text-[14px] leading-relaxed" style={{ color: lp.secondary }}>
                {item}
              </span>
            </li>
          ))}
        </ul>
        <Link
          href="/book-demo"
          className="inline-flex items-center gap-1.5 text-[14px] font-medium underline underline-offset-4 transition-opacity hover:opacity-70"
          style={{ color: lp.text }}
        >
          {ctaLabel}
        </Link>
      </div>
    </section>
  )
}

/* ── Main Page ────────────────────────────────────── */
export default function UseCasesPage() {
  return (
    <div className="min-h-screen" style={{ backgroundColor: lp.bg }}>
      <Nav />

      {/* Hero */}
      <section className="px-6 sm:px-10 lg:px-16 max-w-[1200px] mx-auto pt-20 sm:pt-28 pb-12">
        <p
          className="text-[10px] font-medium uppercase tracking-[0.2em] mb-6"
          style={{ color: lp.muted, fontFamily: "'Space Mono', monospace" }}
        >
          Use cases
        </p>
        <h1
          className="text-[clamp(2.2rem,5vw,3.8rem)] font-light leading-[1.1] tracking-tight max-w-[680px]"
          style={{ color: lp.text }}
        >
          5 workflows that run your practice
        </h1>
        <p
          className="mt-6 text-[15px] sm:text-[17px] leading-relaxed max-w-[520px]"
          style={{ color: lp.secondary }}
        >
          Coordin replaces disconnected tools with one connected platform for quotes, projects, compliance, timesheets and practice oversight.
        </p>
      </section>

      {/* Use Cases */}
      <div className="px-6 sm:px-10 lg:px-16 max-w-[1200px] mx-auto">
        <UseCaseSection
          number="01"
          title="Quote to Project"
          problem="Practices create quotes in disconnected documents — Word, Excel, email threads — losing assumptions, fee logic and audit trails along the way."
          solution="Coordin lets you create, send, track and convert quotes in one workflow. Quotes are built from RIBA-aligned templates, tracked through a clear lifecycle (Draft, Sent, Viewed, Accepted), and converted directly into live projects with all fee data intact."
          outcomes={[
            'Five RIBA-aligned quote templates covering planning, delivery, BRPD and CDM PD services',
            'Tracked status lifecycle — know exactly when a client views or accepts your quote',
            'Linked or standalone mode — attach to an existing project or create from scratch',
            'One-click conversion from accepted quote to live project with fee stages pre-populated',
            'Stage-based fee breakdown with optional extras, meetings, travel and exclusions',
          ]}
          ctaLabel="See Quote to Project in the demo →"
        />

        <UseCaseSection
          number="02"
          title="Project Health & Commercial Control"
          problem="Jobs drift off-track before directors ever see it — budgets overspend, invoices go unsent, and fee assumptions erode without visibility."
          solution="Coordin provides real-time project health scoring so you can see fee risk, overspend, billing gaps, overdue milestones and scope drift at a glance — before problems become losses."
          outcomes={[
            'Live health scoring visible at project, team and practice level',
            'At-risk projects flagged automatically based on fee burn, timeline and billing data',
            'Fee review triggers when spend approaches or exceeds quoted amounts',
            'Near-loss detection highlights projects heading toward negative margin',
            'Executive dashboard insight across all active projects in one view',
          ]}
          ctaLabel="See Project Health in the demo →"
        />

        <UseCaseSection
          number="03"
          title="BRPD Compliance Workspace"
          problem="BRPD coordination is spread across spreadsheets, PDFs, email and shared drives — making it impossible to prove compliance or track readiness."
          solution="Coordin gives you a dedicated workspace to manage dutyholders, prescribed documents, evidence uploads, compliance actions and gateway readiness — all in one auditable location."
          outcomes={[
            'Dutyholder register with roles, appointments and contact details in one place',
            'Prescribed document tracking aligned to regulatory requirements',
            'Evidence upload with version control and visibility of who uploaded what and when',
            'Changelog and audit trail for every compliance action taken',
            'Deadline tracking with alerts for upcoming gateway submissions',
          ]}
          ctaLabel="See BRPD in the demo →"
        />

        <UseCaseSection
          number="04"
          title="Timesheets Linked to Real Work"
          problem="Timesheets are disconnected from real tasks — staff log hours into generic buckets with no link to projects, stages or deliverables."
          solution="Coordin lets staff book time against real tasks and RIBA stages so managers can see where effort is going, compare actuals to fee assumptions, and approve entries with confidence."
          outcomes={[
            'Time logged against real tasks, not generic categories',
            'Stage-linked entries so fee burn is visible per RIBA stage',
            'Manager review workflow with approve, query and reject actions',
            'Fee vs. time comparison showing whether quoted hours match reality',
            'Faster timesheet completion with pre-populated task lists from active projects',
          ]}
          ctaLabel="See Timesheets in the demo →"
        />

        <UseCaseSection
          number="05"
          title="Executive Practice Dashboard"
          problem="There is no single place to see projects, people, money and compliance together — directors rely on asking around or checking multiple tools."
          solution="Coordin provides an executive dashboard showing at-risk projects, open quotes, timesheet gaps, BRPD status and upcoming deadlines — all on one screen, updated in real time."
          outcomes={[
            'Live overview of every active project with health status and stage',
            'Commercial risk visibility — fee overruns, unbilled work, near-loss projects',
            'Staff utilisation and capacity visible without asking team leads',
            'BRPD compliance status across all regulated projects',
            'Pipeline view showing quotes in progress and conversion rates',
          ]}
          ctaLabel="See the Executive Dashboard in the demo →"
        />
      </div>

      <Footer />
    </div>
  )
}

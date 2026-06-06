'use client'

import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

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
          <Link href="/use-cases" className="text-[13px] font-medium text-ink-900 hidden sm:block">
            Use Cases
          </Link>
          <Link href="/faq" className="text-[13px] font-medium text-ink-500 hover:text-ink-900 hidden sm:block">
            FAQ
          </Link>
          <Link href="/book-demo" className="text-[13px] font-medium text-ink-500 hover:text-ink-900 hidden sm:block">
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

/* ── Use Case Section ──────────────────────────────── */
function UseCaseSection({
  number,
  title,
  problem,
  solution,
  outcomes,
  ctaLabel,
}: {
  number: number
  title: string
  problem: string
  solution: string
  outcomes: string[]
  ctaLabel: string
}) {
  return (
    <section className="py-16 border-b border-surface-200 last:border-0 animate-fade-in">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-baseline gap-4 mb-4">
          <span className="text-[3rem] font-display text-accent-200 leading-none">{number}</span>
          <h2 className="font-display text-[2rem] sm:text-[2.5rem] leading-[1.1] text-ink-900">
            {title}
          </h2>
        </div>
        <p className="italic text-ink-500 text-[15px] mb-4">{problem}</p>
        <p className="text-[15px] text-ink-700 leading-relaxed mb-6">{solution}</p>
        <ul className="space-y-2 mb-8">
          {outcomes.map((item, i) => (
            <li key={i} className="flex items-start gap-2.5">
              <span className="w-1.5 h-1.5 rounded-full bg-accent-500 mt-2 shrink-0" />
              <span className="text-[14px] text-ink-600 leading-relaxed">{item}</span>
            </li>
          ))}
        </ul>
        <Link
          href="/book-demo"
          className="inline-flex items-center gap-1.5 text-[14px] font-semibold text-accent-600 hover:text-accent-700"
        >
          {ctaLabel}
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </section>
  )
}

/* ── Main Page ─────────────────────────────────────── */
export default function UseCasesPage() {
  return (
    <div className="min-h-screen bg-white">
      <MarketingNav />

      {/* Hero */}
      <section className="text-center pt-20 sm:pt-28 pb-12 px-6 sm:px-10 animate-fade-in">
        <h1 className="font-display text-[3rem] sm:text-[4rem] leading-[1.05] text-ink-900 max-w-3xl mx-auto">
          5 workflows that run your practice
        </h1>
        <p className="text-[17px] text-ink-500 max-w-2xl mx-auto mt-6 leading-relaxed">
          Coordin replaces disconnected tools with one connected platform for quotes, projects, compliance, timesheets and practice oversight.
        </p>
      </section>

      {/* Use Cases */}
      <div className="max-w-4xl mx-auto px-6 sm:px-10">
        <UseCaseSection
          number={1}
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
          number={2}
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
          number={3}
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
          number={4}
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
          number={5}
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

      <MarketingFooter />
    </div>
  )
}

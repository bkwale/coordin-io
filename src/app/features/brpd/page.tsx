'use client'

import Link from 'next/link'
import { ArrowRight, Users, FileCheck, ShieldCheck, BarChart3, History, Bell } from 'lucide-react'

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
          <Link href="/book-demo" className="text-[13px] font-medium text-ink-500 hover:text-ink-900 hidden sm:block">
            Book a Demo
          </Link>
          <Link href="/demo-access" className="text-[13px] font-medium text-accent-600 hover:text-accent-700">
            Try the Demo
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

/* ── Feature Card ──────────────────────────────────── */
function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="card-static p-6 border border-surface-200 rounded-xl">
      <div className="w-10 h-10 rounded-lg bg-accent-50 flex items-center justify-center mb-4">
        {icon}
      </div>
      <h3 className="text-[15px] font-semibold text-ink-900 mb-2">{title}</h3>
      <p className="text-[13px] text-ink-500 leading-relaxed">{description}</p>
    </div>
  )
}

/* ── Main Page ─────────────────────────────────────── */
export default function BRPDFeaturePage() {
  const features = [
    {
      icon: <Users className="w-5 h-5 text-accent-600" />,
      title: 'Dutyholder Register',
      description: 'Manage all dutyholders in one place — roles, appointments, contact details and responsibilities clearly tracked per project.',
    },
    {
      icon: <FileCheck className="w-5 h-5 text-accent-600" />,
      title: 'Prescribed Document Tracking',
      description: 'Track prescribed documents against regulatory requirements. Know what has been submitted, what is outstanding and what needs updating.',
    },
    {
      icon: <ShieldCheck className="w-5 h-5 text-accent-600" />,
      title: 'Compliance Statements',
      description: 'Generate and manage compliance statements with full audit trails. Evidence is linked to specific requirements and gateway stages.',
    },
    {
      icon: <BarChart3 className="w-5 h-5 text-accent-600" />,
      title: 'Gateway Readiness',
      description: 'Visual readiness tracker for each gateway stage. See at a glance what is complete, in progress or blocking submission.',
    },
    {
      icon: <History className="w-5 h-5 text-accent-600" />,
      title: 'Changelog & Evidence',
      description: 'Every action, upload and decision is logged with timestamps. Build a defensible audit trail without extra admin.',
    },
    {
      icon: <Bell className="w-5 h-5 text-accent-600" />,
      title: 'Deadline Monitoring',
      description: 'Automated alerts for upcoming gateway deadlines, expiring documents and overdue actions. Never miss a submission date.',
    },
  ]

  return (
    <div className="min-h-screen bg-white">
      <MarketingNav />

      {/* Hero */}
      <section className="text-center pt-20 sm:pt-28 pb-12 px-6 sm:px-10 animate-fade-in">
        <h1 className="font-display text-[3rem] sm:text-[4rem] leading-[1.05] text-ink-900 max-w-3xl mx-auto">
          BRPD Compliance Workspace
        </h1>
        <p className="text-[17px] text-ink-500 max-w-2xl mx-auto mt-6 leading-relaxed">
          Manage Building Regulations Principal Designer coordination in one place &mdash; dutyholders, prescribed documents, evidence, gateway readiness and deadlines.
        </p>
      </section>

      {/* What it does */}
      <section className="max-w-3xl mx-auto px-6 sm:px-10 py-16 animate-fade-in">
        <h2 className="font-display text-[2rem] leading-[1.1] text-ink-900 mb-6">What it does</h2>
        <p className="text-[15px] text-ink-600 leading-relaxed">
          The BRPD Compliance Workspace gives principal designers and practice directors a single, auditable environment
          to coordinate all Building Regulations Principal Designer responsibilities. Instead of scattering dutyholder records
          across spreadsheets, prescribed documents across shared drives, and compliance evidence across email threads,
          Coordin brings everything into one workspace. Track dutyholder appointments, manage prescribed documents against
          regulatory requirements, upload and version evidence, monitor gateway readiness, and maintain a complete changelog
          of every compliance action taken — all linked to your live projects.
        </p>
      </section>

      {/* Key Features */}
      <section className="max-w-5xl mx-auto px-6 sm:px-10 py-16 animate-fade-in">
        <h2 className="font-display text-[2rem] leading-[1.1] text-ink-900 mb-10 text-center">Key features</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((f) => (
            <FeatureCard key={f.title} icon={f.icon} title={f.title} description={f.description} />
          ))}
        </div>
      </section>

      {/* Who uses it */}
      <section className="max-w-3xl mx-auto px-6 sm:px-10 py-16 animate-fade-in">
        <h2 className="font-display text-[2rem] leading-[1.1] text-ink-900 mb-6">Who uses it</h2>
        <p className="text-[15px] text-ink-600 leading-relaxed">
          BRPD leads, compliance managers, principal designers, practice directors.
        </p>
      </section>

      {/* CTA */}
      <section className="text-center py-20 px-6 sm:px-10 bg-surface-50 animate-fade-in">
        <h2 className="font-display text-[2rem] sm:text-[2.5rem] leading-[1.1] text-ink-900 mb-6">
          See BRPD in the demo
        </h2>
        <Link
          href="/book-demo"
          className="inline-flex items-center gap-2 bg-gradient-accent text-white font-semibold text-[14px] px-7 py-3.5 rounded-lg hover:opacity-90 transition-opacity shadow-glow-indigo"
        >
          Book a demo
          <ArrowRight className="w-4 h-4" />
        </Link>
      </section>

      <MarketingFooter />
    </div>
  )
}

'use client'

import Link from 'next/link'
import { ArrowRight, FileText, Layers, Calculator, GitBranch } from 'lucide-react'

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
    { label: 'Draft', color: 'bg-surface-200 text-ink-600' },
    { label: 'Internal Review', color: 'bg-blue-100 text-blue-700' },
    { label: 'Ready to Send', color: 'bg-indigo-100 text-indigo-700' },
    { label: 'Sent', color: 'bg-amber-100 text-amber-700' },
    { label: 'Viewed', color: 'bg-purple-100 text-purple-700' },
    { label: 'Accepted', color: 'bg-emerald-100 text-emerald-700' },
    { label: 'Converted to Project', color: 'bg-accent-100 text-accent-700' },
  ]

  return (
    <div className="min-h-screen bg-white">
      <MarketingNav />

      {/* Hero */}
      <section className="text-center pt-20 sm:pt-28 pb-12 px-6 sm:px-10 animate-fade-in">
        <h1 className="font-display text-[3rem] sm:text-[4rem] leading-[1.05] text-ink-900 max-w-3xl mx-auto">
          Quote to Project Workflow
        </h1>
        <p className="text-[17px] text-ink-500 max-w-2xl mx-auto mt-6 leading-relaxed">
          Create, send and track fee quotes with RIBA-aligned templates. Convert accepted quotes directly into live projects.
        </p>
      </section>

      {/* Two Modes */}
      <section className="max-w-4xl mx-auto px-6 sm:px-10 py-16 animate-fade-in">
        <h2 className="font-display text-[2rem] leading-[1.1] text-ink-900 mb-8 text-center">Two modes</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div className="card-static p-6 border border-surface-200 rounded-xl">
            <div className="w-10 h-10 rounded-lg bg-accent-50 flex items-center justify-center mb-4">
              <Layers className="w-5 h-5 text-accent-600" />
            </div>
            <h3 className="text-[15px] font-semibold text-ink-900 mb-2">Linked to existing project</h3>
            <p className="text-[13px] text-ink-500 leading-relaxed">
              Attach a quote to an existing project in Coordin. Fee stages, client details and project metadata are pre-populated.
              Ideal for additional services, variations or phased appointments on live projects.
            </p>
          </div>
          <div className="card-static p-6 border border-surface-200 rounded-xl">
            <div className="w-10 h-10 rounded-lg bg-accent-50 flex items-center justify-center mb-4">
              <FileText className="w-5 h-5 text-accent-600" />
            </div>
            <h3 className="text-[15px] font-semibold text-ink-900 mb-2">Standalone quote</h3>
            <p className="text-[13px] text-ink-500 leading-relaxed">
              Create a quote from scratch for a new enquiry. Once accepted, convert it into a live project with one click.
              All fee data, scope and assumptions transfer automatically.
            </p>
          </div>
        </div>
      </section>

      {/* 5 Templates */}
      <section className="max-w-4xl mx-auto px-6 sm:px-10 py-16 bg-surface-50 animate-fade-in">
        <h2 className="font-display text-[2rem] leading-[1.1] text-ink-900 mb-8 text-center">5 RIBA-aligned templates</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {templates.map((t) => (
            <div key={t.name} className="bg-white p-5 rounded-xl border border-surface-200">
              <h3 className="text-[14px] font-semibold text-ink-900 mb-2">{t.name}</h3>
              <p className="text-[13px] text-ink-500 leading-relaxed">{t.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Quote Builder */}
      <section className="max-w-3xl mx-auto px-6 sm:px-10 py-16 animate-fade-in">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-lg bg-accent-50 flex items-center justify-center shrink-0">
            <Calculator className="w-5 h-5 text-accent-600" />
          </div>
          <div>
            <h2 className="font-display text-[2rem] leading-[1.1] text-ink-900 mb-4">Quote builder</h2>
            <p className="text-[15px] text-ink-600 leading-relaxed">
              12-tab builder covering scope, stage fees, optional extras, meetings, travel, design freeze, exclusions, terms and acceptance.
              Every section is designed for architectural and engineering practices — no generic invoicing tool compromises.
            </p>
          </div>
        </div>
      </section>

      {/* Quote Lifecycle */}
      <section className="max-w-4xl mx-auto px-6 sm:px-10 py-16 animate-fade-in">
        <div className="flex items-start gap-4 mb-8">
          <div className="w-10 h-10 rounded-lg bg-accent-50 flex items-center justify-center shrink-0">
            <GitBranch className="w-5 h-5 text-accent-600" />
          </div>
          <div>
            <h2 className="font-display text-[2rem] leading-[1.1] text-ink-900">Quote lifecycle</h2>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {lifecycle.map((step, i) => (
            <div key={step.label} className="flex items-center gap-3">
              <span className={`inline-block px-3 py-1.5 rounded-full text-[12px] font-semibold ${step.color}`}>
                {step.label}
              </span>
              {i < lifecycle.length - 1 && (
                <ArrowRight className="w-4 h-4 text-ink-300" />
              )}
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="text-center py-20 px-6 sm:px-10 bg-surface-50 animate-fade-in">
        <h2 className="font-display text-[2rem] sm:text-[2.5rem] leading-[1.1] text-ink-900 mb-6">
          See Quote to Project in the demo
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

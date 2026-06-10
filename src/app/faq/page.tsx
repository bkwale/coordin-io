'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

/* ── FAQ data ────────────────────────────────────── */
const FAQ_ITEMS = [
  {
    question: 'What is Coordin.io?',
    answer:
      'Coordin.io is a project control and practice management platform for multidisciplinary built-environment practices. It helps you manage RIBA-staged projects, create and track fee quotes, monitor team timesheets, and stay on top of BRPD compliance — all from one executive dashboard.',
  },
  {
    question: 'Who is Coordin.io for?',
    answer:
      'Architects, structural engineers, MEP consultants, QS firms, interior designers, and any practice working in the built environment. It’s designed for practices with 5–30+ staff who need better visibility of project health, commercial performance, and team capacity.',
  },
  {
    question: 'What features are included?',
    answer:
      'The platform includes an executive dashboard with 10 customisable widgets, fee quote builder with 5 RIBA-aligned templates (including BRPD and CDM PD), staff timesheets with task-linked entry, project health scoring, BRPD compliance tracking, leave management, invoice tracking, and more.',
  },
  {
    question: 'Does Coordin.io support BRPD compliance?',
    answer:
      'Yes. Coordin.io includes dedicated BRPD features: dutyholder coordination, compliance statements, gateway readiness tracking, requirement monitoring, and a BRPD-specific quote template for Principal Designer services.',
  },
  {
    question: 'How much does Coordin.io cost?',
    answer:
      'We’re currently onboarding design partners at a discounted founder rate. Contact us for pricing details — we offer per-practice pricing that scales with your team size.',
  },
  {
    question: 'What integrations are planned?',
    answer:
      'Xero and QuickBooks for accounting, Microsoft 365 for calendar and email, SharePoint for document storage, and Stripe for subscription billing. We’re building integrations based on what our design partners need most.',
  },
  {
    question: 'Is my data secure?',
    answer:
      'Coordin.io is built on Supabase (PostgreSQL) with row-level security, hosted on Vercel with HTTPS everywhere. We follow UK data protection standards and will be GDPR compliant at launch.',
  },
  {
    question: 'How do I get started?',
    answer:
      'Request early access on our home page. You’ll get instant access to a demo environment, and we’ll be in touch to discuss the design partner programme.',
  },
]

/* ── Marketing nav ───────────────────────────────── */
function FAQNav() {
  return (
    <nav className="flex items-center justify-between px-6 sm:px-10 py-5 max-w-6xl mx-auto">
      <Link href="/" className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-gradient-accent flex items-center justify-center text-white font-display text-lg">
          C
        </div>
        <span className="font-display text-xl text-ink-900">Coordin.io</span>
      </Link>
      <div className="flex items-center gap-6">
        <Link
          href="/"
          className="text-[13px] font-medium text-ink-500 hover:text-ink-900"
        >
          Request Access
        </Link>
        <Link
          href="/demo-access"
          className="text-[13px] font-medium text-accent-600 hover:text-accent-700"
        >
          Try the Demo
        </Link>
      </div>
    </nav>
  )
}

/* ── Accordion item ──────────────────────────────── */
function AccordionItem({
  question,
  answer,
  isOpen,
  onToggle,
}: {
  question: string
  answer: string
  isOpen: boolean
  onToggle: () => void
}) {
  return (
    <div className="border-b border-surface-200">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between py-5 text-left gap-4 group"
      >
        <span className="text-[15px] font-medium text-ink-900 group-hover:text-accent-600 transition-colors">
          {question}
        </span>
        <ChevronDown
          className={cn(
            'w-5 h-5 text-ink-400 shrink-0 transition-transform duration-200',
            isOpen && 'rotate-180'
          )}
        />
      </button>
      <div
        className={cn(
          'overflow-hidden transition-all duration-200',
          isOpen ? 'max-h-96 pb-5' : 'max-h-0'
        )}
      >
        <p className="text-[13px] text-ink-500 leading-relaxed pr-8">{answer}</p>
      </div>
    </div>
  )
}

/* ── Main page ───────────────────────────────────── */
export default function FAQPage() {
  const [openIndex, setOpenIndex] = useState<number | null>(0)

  return (
    <div className="min-h-screen bg-white">
      <FAQNav />

      <section className="max-w-3xl mx-auto px-6 sm:px-10 pt-10 sm:pt-16 pb-20 animate-fade-in">
        <h1 className="font-display text-display-lg text-ink-900 text-center mb-3">
          Frequently Asked Questions
        </h1>
        <p className="text-[15px] text-ink-500 text-center mb-12 max-w-lg mx-auto">
          Everything you need to know about Coordin.io and the design partner programme.
        </p>

        <div className="border-t border-surface-200">
          {FAQ_ITEMS.map((item, i) => (
            <AccordionItem
              key={i}
              question={item.question}
              answer={item.answer}
              isOpen={openIndex === i}
              onToggle={() => setOpenIndex(openIndex === i ? null : i)}
            />
          ))}
        </div>

        {/* CTA */}
        <div className="text-center mt-12">
          <p className="text-[13px] text-ink-500 mb-4">Still have questions?</p>
          <div className="flex items-center justify-center gap-4">
            <a
              href="mailto:hello@coordin.io"
              className="text-[13px] font-medium text-accent-600 hover:text-accent-700"
            >
              Get in touch
            </a>
            <span className="text-ink-300">|</span>
            <Link
              href="/"
              className="text-[13px] font-medium text-accent-600 hover:text-accent-700"
            >
              Request early access
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────── */}
      <footer className="border-t border-surface-200 py-8 px-6 sm:px-10">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-[13px] text-ink-400">Coordin.io &mdash; Built for practices that build.</p>
          <div className="flex items-center gap-6">
            <Link href="/" className="text-[13px] text-ink-500 hover:text-ink-900">Home</Link>
            <a href="mailto:hello@coordin.io" className="text-[13px] text-ink-500 hover:text-ink-900">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  )
}

'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ChevronDown, Menu, X } from 'lucide-react'

/* ── Design tokens (Option C) ──────────────────── */
const lp = {
  bg: '#f8f7f4',
  text: '#1a1a18',
  secondary: '#6b6a65',
  muted: '#8a8880',
  border: '#d8d6d0',
  accent: '#6366f1',
}

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

/* ── Nav ─────────────────────────────────────────── */
const NAV_LINKS = [
  { label: 'Features', href: '/features/brpd' },
  { label: 'Use Cases', href: '/use-cases' },
  { label: 'FAQ', href: '/faq' },
  { label: 'Sign In', href: '/login' },
]

function FAQNav() {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <nav
      className="flex items-center justify-between px-6 sm:px-10 py-5 max-w-6xl mx-auto"
      style={{ color: lp.text }}
    >
      {/* Logo */}
      <Link href="/" className="flex items-center gap-2.5">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-lg font-semibold"
          style={{ backgroundColor: lp.text }}
        >
          C
        </div>
        <span className="text-xl font-semibold" style={{ color: lp.text }}>
          Coordin.io
        </span>
      </Link>

      {/* Desktop links */}
      <div className="hidden md:flex items-center gap-8">
        {NAV_LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="text-[13px] font-medium transition-opacity hover:opacity-60"
            style={{ color: lp.secondary }}
          >
            {link.label}
          </Link>
        ))}
      </div>

      {/* Mobile hamburger */}
      <button
        className="md:hidden"
        onClick={() => setMobileOpen(!mobileOpen)}
        aria-label="Toggle menu"
      >
        {mobileOpen ? (
          <X className="w-6 h-6" style={{ color: lp.text }} />
        ) : (
          <Menu className="w-6 h-6" style={{ color: lp.text }} />
        )}
      </button>

      {/* Mobile dropdown */}
      {mobileOpen && (
        <div
          className="absolute top-[68px] left-0 right-0 z-50 px-6 py-4 flex flex-col gap-4 border-b md:hidden"
          style={{
            backgroundColor: lp.bg,
            borderColor: lp.border,
          }}
        >
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-[14px] font-medium transition-opacity hover:opacity-60"
              style={{ color: lp.text }}
              onClick={() => setMobileOpen(false)}
            >
              {link.label}
            </Link>
          ))}
          <Link
            href="/"
            className="text-[14px] font-medium transition-opacity hover:opacity-60"
            style={{ color: lp.text }}
            onClick={() => setMobileOpen(false)}
          >
            Book a demo
          </Link>
        </div>
      )}
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
    <div style={{ borderBottom: `1px solid ${lp.border}` }}>
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between py-5 text-left gap-4 group"
      >
        <span
          className="text-[15px] font-medium transition-opacity group-hover:opacity-70"
          style={{ color: lp.text }}
        >
          {question}
        </span>
        <ChevronDown
          className={`w-5 h-5 shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
          style={{ color: lp.muted }}
        />
      </button>
      <div
        className={`overflow-hidden transition-all duration-200 ${isOpen ? 'max-h-96 pb-5' : 'max-h-0'}`}
      >
        <p
          className="text-[13px] leading-relaxed pr-8"
          style={{ color: lp.secondary }}
        >
          {answer}
        </p>
      </div>
    </div>
  )
}

/* ── Main page ───────────────────────────────────── */
export default function FAQPage() {
  const [openIndex, setOpenIndex] = useState<number | null>(0)

  return (
    <div className="min-h-screen relative" style={{ backgroundColor: lp.bg }}>
      <FAQNav />

      <section className="max-w-3xl mx-auto px-6 sm:px-10 pt-10 sm:pt-16 pb-20">
        {/* Section label */}
        <p
          className="text-[10px] font-medium uppercase tracking-[0.2em] text-center mb-4"
          style={{
            fontFamily: "'Space Mono', monospace",
            color: lp.muted,
          }}
        >
          FAQ
        </p>

        <h1
          className="text-3xl sm:text-4xl font-semibold text-center mb-3"
          style={{ color: lp.text }}
        >
          Frequently Asked Questions
        </h1>
        <p
          className="text-[15px] text-center mb-12 max-w-lg mx-auto"
          style={{ color: lp.secondary }}
        >
          Everything you need to know about Coordin.io and the design partner programme.
        </p>

        <div style={{ borderTop: `1px solid ${lp.border}` }}>
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
          <p className="text-[13px] mb-4" style={{ color: lp.secondary }}>
            Still have questions?
          </p>
          <div className="flex items-center justify-center gap-4">
            <a
              href="mailto:hello@coordin.io"
              className="text-[13px] font-medium transition-opacity hover:opacity-60"
              style={{ color: lp.text }}
            >
              Get in touch
            </a>
            <span style={{ color: lp.border }}>|</span>
            <Link
              href="/"
              className="text-[13px] font-medium transition-opacity hover:opacity-60"
              style={{ color: lp.text }}
            >
              Request early access
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────── */}
      <footer
        className="py-8 px-6 sm:px-10"
        style={{ borderTop: `1px solid ${lp.border}` }}
      >
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-[13px]" style={{ color: lp.muted }}>
            &copy; {new Date().getFullYear()} Coordin.io
          </p>
          <div className="flex items-center gap-6">
            <Link
              href="/privacy"
              className="text-[13px] transition-opacity hover:opacity-60"
              style={{ color: lp.secondary }}
            >
              Privacy
            </Link>
            <Link
              href="/terms"
              className="text-[13px] transition-opacity hover:opacity-60"
              style={{ color: lp.secondary }}
            >
              Terms
            </Link>
            <a
              href="mailto:hello@coordin.io"
              className="text-[13px] transition-opacity hover:opacity-60"
              style={{ color: lp.secondary }}
            >
              Contact
            </a>
          </div>
        </div>
      </footer>
    </div>
  )
}

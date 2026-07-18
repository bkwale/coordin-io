'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowRight,
  FileText,
  Activity,
  Shield,
  ChevronDown,
  BarChart3,
  Clock,
  CheckCircle,
  Building2,
  Users,
  Briefcase,
  PenTool,
  Ruler,
  Zap,
  DollarSign,
  LayoutDashboard,
  ClipboardCheck,
  Link2,
  Replace,
} from 'lucide-react'

/* ── Smooth scroll helper ───────────────────────── */
function scrollTo(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
}

/* ── Sticky Nav ─────────────────────────────────── */
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
          <button
            onClick={() => scrollTo('use-cases')}
            className="text-[13px] font-medium text-ink-500 hover:text-ink-900 hidden sm:block"
          >
            Features
          </button>
          <Link
            href="/use-cases"
            className="text-[13px] font-medium text-ink-500 hover:text-ink-900 hidden sm:block"
          >
            Use Cases
          </Link>
          <Link
            href="/faq"
            className="text-[13px] font-medium text-ink-500 hover:text-ink-900 hidden sm:block"
          >
            FAQ
          </Link>
          <Link
            href="/book-demo"
            className="text-[13px] font-medium text-ink-500 hover:text-ink-900 hidden sm:block"
          >
            Book a Demo
          </Link>
          <Link
            href="/demo-access"
            className="text-[13px] font-medium text-accent-600 hover:text-accent-700"
          >
            Try the Demo
          </Link>
          <Link
            href="/login"
            className="text-[13px] font-medium text-white bg-ink-900 hover:bg-ink-800 px-4 py-2 rounded-lg"
          >
            Sign In
          </Link>
        </div>
      </div>
    </nav>
  )
}

/* ── Mock: Dashboard Preview (browser chrome) ───── */
function DashboardPreview() {
  const kpis = [
    { label: 'Active Projects', value: '12', sub: '+2 this month', color: 'text-accent-600' },
    { label: 'Quotes Sent', value: '8', sub: '3 awaiting', color: 'text-emerald-600' },
    { label: 'Team Utilisation', value: '84%', sub: 'Target: 80%', color: 'text-amber-600' },
    { label: 'BRPD Compliance', value: '96%', sub: '1 action due', color: 'text-violet-600' },
  ]

  const rows = [
    { name: 'Whitmore House', stage: 'Stage 3', health: 'bg-emerald-400', fee: '£42,500' },
    { name: 'Kensington Mews', stage: 'Stage 4', health: 'bg-amber-400', fee: '£67,200' },
    { name: 'Park Lane Mixed-Use', stage: 'Stage 2', health: 'bg-emerald-400', fee: '£128,000' },
  ]

  return (
    <section className="max-w-6xl mx-auto px-6 sm:px-10 mt-16 mb-24 animate-fade-in" style={{ animationDelay: '0.35s', animationFillMode: 'both' }}>
      <div className="rounded-2xl shadow-elevated border border-surface-200 overflow-hidden bg-white">
        {/* Browser chrome */}
        <div className="flex items-center gap-2 px-5 py-3 bg-surface-50 border-b border-surface-200">
          <div className="flex gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
            <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
          </div>
          <div className="flex-1 flex justify-center">
            <div className="bg-white border border-surface-200 rounded-md px-4 py-1 text-[11px] text-ink-400 font-medium">
              app.coordin.io/dashboard
            </div>
          </div>
        </div>
        {/* Dashboard content */}
        <div className="p-6 sm:p-8">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-display text-xl text-ink-900">Executive Dashboard</h3>
            <span className="text-[11px] text-ink-400 font-medium">Last updated: 2 min ago</span>
          </div>
          {/* KPI grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {kpis.map(k => (
              <div key={k.label} className="rounded-xl bg-surface-50 border border-surface-200 p-4">
                <p className="text-[10px] font-semibold text-ink-400 uppercase tracking-wider mb-1.5">{k.label}</p>
                <p className={`text-2xl font-semibold tabular-nums ${k.color}`}>{k.value}</p>
                <p className="text-[10px] text-ink-400 mt-1">{k.sub}</p>
              </div>
            ))}
          </div>
          {/* Project rows */}
          <div className="mt-6">
            <div className="grid grid-cols-[1fr_auto_auto_auto] gap-4 px-3 py-2 text-[10px] font-semibold text-ink-400 uppercase tracking-wider border-b border-surface-200">
              <span>Project</span>
              <span>Stage</span>
              <span>Health</span>
              <span className="text-right">Fee</span>
            </div>
            {rows.map(r => (
              <div key={r.name} className="grid grid-cols-[1fr_auto_auto_auto] gap-4 px-3 py-3 items-center border-b border-surface-100 last:border-0">
                <span className="text-[13px] font-medium text-ink-900">{r.name}</span>
                <span className="text-[11px] text-ink-500 font-medium">{r.stage}</span>
                <span className={`w-2.5 h-2.5 rounded-full ${r.health}`} />
                <span className="text-[13px] text-ink-700 tabular-nums text-right">{r.fee}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

/* ── Browser Chrome Wrapper ────────────────────── */
function BrowserChrome({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card-static shadow-elevated overflow-hidden w-[300px] flex-shrink-0">
      <div className="flex items-center gap-2 px-3 py-2 bg-surface-50 border-b border-surface-200">
        <div className="flex gap-1">
          <div className="w-2 h-2 rounded-full bg-red-400" />
          <div className="w-2 h-2 rounded-full bg-amber-400" />
          <div className="w-2 h-2 rounded-full bg-emerald-400" />
        </div>
        <span className="text-[10px] text-ink-400 font-medium truncate">{title}</span>
      </div>
      <div className="p-4">{children}</div>
    </div>
  )
}

/* ── Mock: Quote Card ───────────────────────────── */
function MockQuoteCard() {
  const items = [
    { stage: 'Stage 1 — Preparation & Briefing', fee: '£4,200' },
    { stage: 'Stage 2 — Concept Design', fee: '£8,500' },
    { stage: 'Stage 3 — Spatial Coordination', fee: '£12,800' },
    { stage: 'Stage 4 — Technical Design', fee: '£16,000' },
  ]

  return (
    <div className="card-static shadow-elevated p-6 max-w-sm w-full">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-[10px] font-semibold text-ink-400 uppercase tracking-wider">Quote</p>
          <p className="text-[15px] font-semibold text-ink-900 mt-0.5">QT-2024-0042</p>
        </div>
        <span className="inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">Awaiting</span>
      </div>
      <div className="border-t border-surface-200 pt-3 mb-3">
        <p className="text-[11px] text-ink-400 font-medium">Client</p>
        <p className="text-[13px] text-ink-900 font-medium">Hartley Developments Ltd</p>
      </div>
      <div className="space-y-2">
        {items.map(it => (
          <div key={it.stage} className="flex items-center justify-between py-1.5 border-b border-surface-100 last:border-0">
            <span className="text-[12px] text-ink-700">{it.stage}</span>
            <span className="text-[12px] text-ink-900 font-semibold tabular-nums">{it.fee}</span>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between mt-4 pt-3 border-t border-surface-200">
        <span className="text-[12px] font-semibold text-ink-500">Total Fee</span>
        <span className="text-[16px] font-semibold text-accent-600 tabular-nums">{'£'}41,500</span>
      </div>
    </div>
  )
}

/* ── Mock: Project Health Card ──────────────────── */
function MockProjectHealthCard() {
  const projects = [
    { name: 'Whitmore House', health: 'bg-emerald-400', stage: 'Stage 3', risk: null },
    { name: 'Kensington Mews', health: 'bg-amber-400', stage: 'Stage 4', risk: 'Fee overrun risk' },
    { name: 'Clerkenwell Retrofit', health: 'bg-red-400', stage: 'Stage 2', risk: 'BRPD gateway overdue' },
  ]

  return (
    <div className="card-static shadow-elevated p-6 max-w-sm w-full">
      <div className="flex items-center gap-2 mb-5">
        <Activity className="w-4 h-4 text-accent-500" />
        <h4 className="text-[14px] font-semibold text-ink-900">Project Health</h4>
      </div>
      <div className="space-y-3">
        {projects.map(p => (
          <div key={p.name} className="flex items-start gap-3 p-3 rounded-lg bg-surface-50 border border-surface-200">
            <span className={`w-2.5 h-2.5 rounded-full mt-1 flex-shrink-0 ${p.health}`} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className="text-[13px] font-medium text-ink-900">{p.name}</span>
                <span className="text-[10px] text-ink-400 font-medium">{p.stage}</span>
              </div>
              {p.risk && (
                <span className="inline-block mt-1.5 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-red-50 text-red-600 border border-red-200">
                  {p.risk}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ── Mock: BRPD Card ───────────────────────────── */
function MockBRPDCard() {
  const items = [
    { name: 'Principal Designer appointed', status: 'Complete', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    { name: 'Pre-construction information pack', status: 'In Progress', color: 'bg-amber-50 text-amber-700 border-amber-200' },
    { name: 'Fire safety strategy upload', status: 'Overdue', color: 'bg-red-50 text-red-600 border-red-200' },
  ]

  return (
    <div className="card-static shadow-elevated p-6 max-w-sm w-full">
      <div className="flex items-center gap-2 mb-5">
        <Shield className="w-4 h-4 text-accent-500" />
        <h4 className="text-[14px] font-semibold text-ink-900">BRPD Workspace</h4>
      </div>
      <div className="space-y-3">
        {items.map(item => (
          <div key={item.name} className="flex items-center justify-between p-3 rounded-lg bg-surface-50 border border-surface-200">
            <span className="text-[12px] text-ink-700 font-medium">{item.name}</span>
            <span className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full border ${item.color}`}>
              {item.status}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ── Mock: Timesheet Grid ───────────────────────── */
function MockTimesheetCard() {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
  const rows = [
    { task: 'Whitmore — Stage 3 coord.', hours: [2, 3, 1.5, 4, 2] },
    { task: 'Kensington — Detail drawings', hours: [4, 3, 5, 2, 4] },
    { task: 'CPD / Admin', hours: [1, 1.5, 1, 1.5, 1] },
  ]

  return (
    <div className="card-static shadow-elevated p-6 max-w-sm w-full">
      <div className="flex items-center gap-2 mb-5">
        <Clock className="w-4 h-4 text-accent-500" />
        <h4 className="text-[14px] font-semibold text-ink-900">Weekly Timesheet</h4>
        <span className="text-[10px] text-ink-400 font-medium ml-auto">W/C 27 Jan</span>
      </div>
      {/* Header */}
      <div className="grid grid-cols-[1fr_repeat(5,36px)] gap-1 mb-2 px-1">
        <span className="text-[10px] font-semibold text-ink-400 uppercase tracking-wider">Task</span>
        {days.map(d => (
          <span key={d} className="text-[10px] font-semibold text-ink-400 uppercase tracking-wider text-center">{d}</span>
        ))}
      </div>
      {/* Rows */}
      <div className="space-y-1">
        {rows.map(r => (
          <div key={r.task} className="grid grid-cols-[1fr_repeat(5,36px)] gap-1 items-center px-1 py-1.5 rounded-md hover:bg-surface-50">
            <span className="text-[11px] text-ink-700 truncate">{r.task}</span>
            {r.hours.map((h, i) => (
              <span key={i} className="text-[12px] text-ink-900 font-medium text-center tabular-nums bg-surface-50 rounded py-0.5">{h}</span>
            ))}
          </div>
        ))}
      </div>
      {/* Totals */}
      <div className="grid grid-cols-[1fr_repeat(5,36px)] gap-1 items-center px-1 pt-2 mt-2 border-t border-surface-200">
        <span className="text-[11px] font-semibold text-ink-500">Daily total</span>
        {[7, 7.5, 7.5, 7.5, 7].map((t, i) => (
          <span key={i} className="text-[12px] text-accent-600 font-semibold text-center tabular-nums">{t}</span>
        ))}
      </div>
    </div>
  )
}

/* ── Mock: Mini Dashboard Card ─────────────────── */
function MockMiniDashboardCard() {
  const kpis = [
    { label: 'Active Projects', value: '12', color: 'text-accent-600' },
    { label: 'At Risk', value: '3', color: 'text-red-600' },
    { label: 'Quotes Pipeline', value: '£285k', color: 'text-emerald-600' },
    { label: 'BRPD Actions', value: '4', color: 'text-amber-600' },
  ]

  return (
    <div className="card-static shadow-elevated p-6 max-w-sm w-full">
      <div className="flex items-center gap-2 mb-5">
        <BarChart3 className="w-4 h-4 text-accent-500" />
        <h4 className="text-[14px] font-semibold text-ink-900">Executive Overview</h4>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {kpis.map(k => (
          <div key={k.label} className="rounded-lg bg-surface-50 border border-surface-200 p-3">
            <p className="text-[10px] font-semibold text-ink-400 uppercase tracking-wider mb-1">{k.label}</p>
            <p className={`text-xl font-semibold tabular-nums ${k.color}`}>{k.value}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ── Use Case Section ──────────────────────────── */
function UseCaseSection({
  number,
  title,
  problem,
  solution,
  bullets,
  mockup,
  reverse = false,
}: {
  number: string
  title: string
  problem: string
  solution: string
  bullets: string[]
  mockup: React.ReactNode
  reverse?: boolean
}) {
  return (
    <div className={`flex flex-col ${reverse ? 'lg:flex-row-reverse' : 'lg:flex-row'} items-center gap-12 lg:gap-20`}>
      {/* Text */}
      <div className="flex-1 max-w-lg">
        <p className="text-[12px] font-semibold text-accent-600 uppercase tracking-wider mb-2">{number}</p>
        <h3 className="font-display text-[2rem] sm:text-[2.5rem] leading-[1.1] text-ink-900 mb-4">
          {title}
        </h3>
        <p className="text-[14px] text-ink-400 italic leading-relaxed mb-4">{problem}</p>
        <p className="text-[15px] text-ink-700 leading-relaxed mb-5">{solution}</p>
        <ul className="space-y-2 mb-6">
          {bullets.map(b => (
            <li key={b} className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
              <span className="text-[13px] text-ink-700">{b}</span>
            </li>
          ))}
        </ul>
        <Link
          href="/book-demo"
          className="inline-flex items-center gap-1.5 text-[14px] font-semibold text-accent-600 hover:text-accent-700"
        >
          See {title.toLowerCase()} in the demo
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
      {/* Mockup */}
      <div className="flex-1 flex justify-center">
        {mockup}
      </div>
    </div>
  )
}

/* ── Main Page ──────────────────────────────────── */
export default function WelcomePage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [practiceName, setPracticeName] = useState('')
  const [role, setRole] = useState('')
  const [practiceSize, setPracticeSize] = useState('')
  const [interests, setInterests] = useState<string[]>([])
  const [currentTools, setCurrentTools] = useState('')
  const [submitted, setSubmitted] = useState(false)

  function toggleInterest(val: string) {
    setInterests(prev =>
      prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val]
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

  const audienceCards = [
    { icon: Building2, role: 'Architects', desc: 'Manage projects from briefing through to completion' },
    { icon: Ruler, role: 'Architectural Technologists', desc: 'Track technical design and coordination stages' },
    { icon: Briefcase, role: 'Practice Owners', desc: 'See commercial health and team utilisation at a glance' },
    { icon: PenTool, role: 'Interior Designers', desc: 'Quote and deliver fit-out and interiors projects' },
    { icon: Building2, role: 'Structural Engineers', desc: 'Coordinate structural stages with the design team' },
    { icon: Zap, role: 'MEP Engineers', desc: 'Track MEP deliverables and compliance requirements' },
    { icon: DollarSign, role: 'QS / Commercial Leads', desc: 'Monitor fee risk, quotes and invoice pipelines' },
  ]

  return (
    <div className="min-h-screen bg-white">
      <MarketingNav />

      {/* ── Section 1: Hero ─────────────────────────── */}
      <section className="text-center pt-20 sm:pt-28 pb-8 px-6 sm:px-10 animate-fade-in">
        <h1 className="font-display text-[3.5rem] sm:text-[4.5rem] leading-[1.05] text-ink-900 max-w-4xl mx-auto">
          Built for architects. Powerful for the whole design team.
        </h1>
        <p className="text-[17px] text-ink-500 max-w-2xl mx-auto mt-6 leading-relaxed">
          Create quotes, start projects properly, track project health, manage BRPD compliance and capture staff time in one connected platform.
        </p>

        {/* CTA buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-10">
          <Link
            href="/book-demo"
            className="bg-gradient-accent text-white font-semibold text-[14px] px-7 py-3.5 rounded-lg hover:opacity-90 transition-opacity flex items-center gap-2 shadow-glow-indigo"
          >
            Book a full demo
            <ArrowRight className="w-4 h-4" />
          </Link>
          <button
            onClick={() => scrollTo('use-cases')}
            className="border border-surface-200 text-ink-700 font-semibold text-[14px] px-7 py-3.5 rounded-lg hover:border-ink-300 hover:text-ink-900 transition-colors"
          >
            Explore the 5 workflows
          </button>
        </div>

        {/* Trust line */}
        <p className="text-[13px] text-ink-400 mt-6">
          Designed by architects, for architects. Built for real project delivery.
        </p>
      </section>

      {/* ── Full-width product screenshot ─────────── */}
      <DashboardPreview />

      {/* ── Section 2: Product Proof Strip ─────────── */}
      <section className="py-20 px-6 sm:px-10 animate-fade-in">
        <div className="max-w-6xl mx-auto">
          <h2 className="font-display text-[2rem] sm:text-[2.5rem] leading-[1.1] text-ink-900 text-center mb-12">
            One platform. Five core workflows.
          </h2>
          <div className="flex gap-6 overflow-x-auto pb-4 -mx-6 px-6 snap-x snap-mandatory">
            {/* Card 1: Executive Dashboard */}
            <BrowserChrome title="Executive Dashboard">
              <div className="grid grid-cols-2 gap-2 mb-3">
                {[
                  { label: 'Projects', val: '12' },
                  { label: 'At Risk', val: '3' },
                  { label: 'Utilisation', val: '84%' },
                  { label: 'Compliance', val: '96%' },
                ].map(k => (
                  <div key={k.label} className="rounded-md bg-surface-50 border border-surface-200 p-2">
                    <p className="text-[9px] text-ink-400 uppercase font-semibold">{k.label}</p>
                    <p className="text-[14px] font-semibold text-ink-900">{k.val}</p>
                  </div>
                ))}
              </div>
              <div className="space-y-1.5">
                {['Whitmore House', 'Kensington Mews'].map(n => (
                  <div key={n} className="flex items-center justify-between py-1 border-b border-surface-100">
                    <span className="text-[11px] text-ink-700">{n}</span>
                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  </div>
                ))}
              </div>
            </BrowserChrome>

            {/* Card 2: Quote Builder */}
            <BrowserChrome title="Quote Builder">
              <div className="mb-3">
                <p className="text-[10px] text-ink-400 font-semibold uppercase">Quote</p>
                <p className="text-[13px] font-semibold text-ink-900">QT-2024-0042</p>
                <span className="inline-block mt-1 text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">Awaiting</span>
              </div>
              <div className="space-y-1.5">
                {[
                  { s: 'Stage 1 — Briefing', f: '£4,200' },
                  { s: 'Stage 2 — Concept', f: '£8,500' },
                  { s: 'Stage 3 — Spatial', f: '£12,800' },
                ].map(it => (
                  <div key={it.s} className="flex justify-between py-1 border-b border-surface-100">
                    <span className="text-[10px] text-ink-700">{it.s}</span>
                    <span className="text-[10px] text-ink-900 font-semibold">{it.f}</span>
                  </div>
                ))}
              </div>
              <div className="flex justify-between mt-2 pt-2 border-t border-surface-200">
                <span className="text-[10px] text-ink-500 font-semibold">Total</span>
                <span className="text-[12px] text-accent-600 font-semibold">{'£'}41,500</span>
              </div>
            </BrowserChrome>

            {/* Card 3: Project Health */}
            <BrowserChrome title="Project Health">
              <div className="space-y-2">
                {[
                  { name: 'Whitmore House', dot: 'bg-emerald-400', risk: null },
                  { name: 'Kensington Mews', dot: 'bg-amber-400', risk: 'Fee risk' },
                  { name: 'Clerkenwell', dot: 'bg-red-400', risk: 'Overdue' },
                ].map(p => (
                  <div key={p.name} className="flex items-center gap-2 p-2 rounded-md bg-surface-50 border border-surface-200">
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${p.dot}`} />
                    <span className="text-[11px] text-ink-700 flex-1">{p.name}</span>
                    {p.risk && (
                      <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-red-50 text-red-600 border border-red-200">{p.risk}</span>
                    )}
                  </div>
                ))}
              </div>
            </BrowserChrome>

            {/* Card 4: BRPD Workspace */}
            <BrowserChrome title="BRPD Workspace">
              <div className="space-y-2">
                {[
                  { name: 'PD appointed', status: 'Done', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
                  { name: 'Pre-con info pack', status: 'In Progress', color: 'bg-amber-50 text-amber-700 border-amber-200' },
                  { name: 'Fire strategy', status: 'Overdue', color: 'bg-red-50 text-red-600 border-red-200' },
                ].map(item => (
                  <div key={item.name} className="flex items-center justify-between p-2 rounded-md bg-surface-50 border border-surface-200">
                    <span className="text-[11px] text-ink-700">{item.name}</span>
                    <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full border ${item.color}`}>{item.status}</span>
                  </div>
                ))}
              </div>
            </BrowserChrome>

            {/* Card 5: Timesheets */}
            <BrowserChrome title="Timesheets">
              <div className="space-y-1.5">
                <div className="grid grid-cols-[1fr_repeat(5,24px)] gap-0.5 mb-1">
                  <span className="text-[9px] text-ink-400 font-semibold">Task</span>
                  {['M', 'T', 'W', 'T', 'F'].map(d => (
                    <span key={d} className="text-[9px] text-ink-400 font-semibold text-center">{d}</span>
                  ))}
                </div>
                {[
                  { task: 'Whitmore coord.', hrs: [2, 3, 1.5, 4, 2] },
                  { task: 'Kensington dtl.', hrs: [4, 3, 5, 2, 4] },
                  { task: 'Admin', hrs: [1, 1.5, 1, 1.5, 1] },
                ].map(r => (
                  <div key={r.task} className="grid grid-cols-[1fr_repeat(5,24px)] gap-0.5 items-center">
                    <span className="text-[10px] text-ink-700 truncate">{r.task}</span>
                    {r.hrs.map((h, i) => (
                      <span key={i} className="text-[10px] text-ink-900 font-medium text-center bg-surface-50 rounded py-0.5">{h}</span>
                    ))}
                  </div>
                ))}
              </div>
            </BrowserChrome>
          </div>
        </div>
      </section>

      {/* ── Section 3: The 5 Use Cases ─────────────── */}
      <section id="use-cases" className="max-w-6xl mx-auto px-6 sm:px-10 py-20 space-y-28 animate-fade-in">
        <UseCaseSection
          number="01 — Quote to Project"
          title="Quote to Project"
          problem="Practices often create quotes in disconnected documents, then lose the commercial assumptions once the project starts."
          solution="Create a quote for a new or existing project, send it professionally, track status, and convert accepted work into a live project."
          bullets={[
            'Quote templates aligned to RIBA stages',
            'Tracked send, view and accept status',
            'Existing-project or new-project mode',
            'Quote-to-project conversion in one click',
            'Stage-based fee structure carried forward',
          ]}
          mockup={<MockQuoteCard />}
        />

        <UseCaseSection
          number="02 — Project Health and Commercial Control"
          title="Project Health and Commercial Control"
          problem="Jobs drift before directors can see the warning signs."
          solution="See fee risk, stage overspend, billing pressure, overdue tasks and project drift before they become problems."
          bullets={[
            'Project health visibility across the practice',
            'At-risk jobs surfaced automatically',
            'Fee review warnings before overspend',
            'Near-loss alerts for senior staff',
            'Director dashboard insight in real time',
          ]}
          mockup={<MockProjectHealthCard />}
          reverse
        />

        <UseCaseSection
          number="03 — BRPD Compliance Workspace"
          title="BRPD Compliance Workspace"
          problem="BRPD coordination is often spread across spreadsheets, PDFs, folders and emails."
          solution="Manage dutyholders, prescribed documents, evidence uploads, missing consultant information, actions, readiness and deadlines in one workspace."
          bullets={[
            'Dutyholder register with clear responsibilities',
            'Prescribed document tracking per gateway',
            'Consultant upload visibility and chasing',
            'Changelog and evidence audit trail',
            'Readiness and deadline tracking per project',
          ]}
          mockup={<MockBRPDCard />}
        />

        <UseCaseSection
          number="04 — Timesheets Linked to Real Work"
          title="Timesheets Linked to Real Work"
          problem="Timesheets are often disconnected from the tasks and stages staff actually work on."
          solution="Let staff book time against real project tasks and stages, from early briefing through technical and construction stages."
          bullets={[
            'Time booked against real tasks, not generic codes',
            'Stage-linked booking for accurate fee tracking',
            'Manager review by project, task and stage',
            'Better fee assumption comparison over time',
            'Faster weekly completion for staff',
          ]}
          mockup={<MockTimesheetCard />}
          reverse
        />

        <UseCaseSection
          number="05 — Executive Practice Dashboard"
          title="Executive Practice Dashboard"
          problem="Senior staff lack one place to understand projects, people, money and compliance."
          solution="Give directors and senior staff an executive dashboard for projects at risk, quotes, invoices, timesheets, BRPD actions, deadlines and staffing issues."
          bullets={[
            'Live overview of the entire practice',
            'Project and commercial risk at a glance',
            'Staff and timesheet visibility per project',
            'BRPD compliance visibility across all jobs',
            'Quote and invoice pipeline tracking',
          ]}
          mockup={<MockMiniDashboardCard />}
        />
      </section>

      {/* ── Section 4: Why Coordin ─────────────────── */}
      <section id="why-coordin" className="py-20 px-6 sm:px-10 bg-surface-50 animate-fade-in">
        <div className="max-w-6xl mx-auto">
          <h2 className="font-display text-[2rem] sm:text-[2.5rem] leading-[1.1] text-ink-900 text-center mb-12">
            Why Coordin?
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                icon: LayoutDashboard,
                title: 'Built around architecture and project delivery workflows',
                desc: 'Not adapted from generic PM tools. Designed for how practices actually work.',
              },
              {
                icon: Link2,
                title: 'Connects quote, project setup and delivery',
                desc: 'Commercial assumptions flow from quote to live project. Nothing gets lost.',
              },
              {
                icon: ClipboardCheck,
                title: 'Gives commercial and compliance visibility in one system',
                desc: 'No separate trackers for fees, health and BRPD. One view for senior staff.',
              },
              {
                icon: Replace,
                title: 'Replaces disconnected spreadsheets, emails and trackers',
                desc: 'One platform instead of five tools stitched together.',
              },
            ].map(card => (
              <div key={card.title} className="card-static p-6">
                <card.icon className="w-6 h-6 text-accent-500 mb-4" />
                <h3 className="text-[14px] font-semibold text-ink-900 mb-2">{card.title}</h3>
                <p className="text-[13px] text-ink-500 leading-relaxed">{card.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Section 5: Who It Is For ───────────────── */}
      <section className="py-20 px-6 sm:px-10 animate-fade-in">
        <div className="max-w-6xl mx-auto">
          <h2 className="font-display text-[2rem] sm:text-[2.5rem] leading-[1.1] text-ink-900 text-center mb-12">
            Built for your whole team
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {audienceCards.map(card => (
              <div key={card.role} className="card-static p-5 flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-accent-50 flex items-center justify-center flex-shrink-0">
                  <card.icon className="w-5 h-5 text-accent-600" />
                </div>
                <div>
                  <h3 className="text-[14px] font-semibold text-ink-900 mb-1">{card.role}</h3>
                  <p className="text-[12px] text-ink-500 leading-relaxed">{card.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Section 6: Designed by Architects ──────── */}
      <section className="py-20 px-6 sm:px-10 bg-surface-50 animate-fade-in">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="font-display text-[2rem] sm:text-[2.5rem] leading-[1.1] text-ink-900 mb-6">
            Designed by architects, for architects
          </h2>
          <p className="text-[15px] text-ink-500 leading-relaxed mb-6">
            Generic project tools don&rsquo;t understand architecture practice. Coordin connects quote creation, project setup, delivery, commercial health and BRPD workflow in one platform. Built around real studio and delivery needs.
          </p>
          <p className="text-[13px] text-ink-400 font-medium">
            Built with input from practising UK architects.
          </p>
        </div>
      </section>

      {/* ── Section 7: Demo CTA Block ──────────────── */}
      <section id="book-demo-section" className="py-24 px-6 sm:px-10 animate-fade-in">
        <div className="max-w-lg mx-auto">
          <div className="text-center mb-10">
            <h2 className="font-display text-[2rem] sm:text-[2.5rem] leading-[1.1] text-ink-900 mb-3">
              Book a full demo
            </h2>
            <p className="text-[15px] text-ink-500 leading-relaxed">
              See the workflow that matters most to your practice. Choose what you&rsquo;d like to explore.
            </p>
          </div>

          {submitted ? (
            <div className="card-static shadow-premium p-8 animate-fade-in text-center">
              <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-6 h-6 text-emerald-600" />
              </div>
              <h3 className="font-display text-xl text-ink-900 mb-2">You&rsquo;re in.</h3>
              <p className="text-[13px] text-ink-500">Redirecting you to demo access&hellip;</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="card-static shadow-premium p-6 sm:p-8 text-left space-y-4">
              {/* Name */}
              <div>
                <label htmlFor="name" className="block text-[11px] font-semibold text-ink-400 uppercase tracking-wider mb-1.5">
                  Name
                </label>
                <input
                  id="name"
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Your name"
                  className="w-full px-3.5 py-2.5 rounded-lg border border-surface-200 bg-white text-[13px] text-ink-900 placeholder:text-ink-300 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-accent-500 transition-shadow"
                />
              </div>

              {/* Work email */}
              <div>
                <label htmlFor="email" className="block text-[11px] font-semibold text-ink-400 uppercase tracking-wider mb-1.5">
                  Work email *
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@practice.com"
                  className="w-full px-3.5 py-2.5 rounded-lg border border-surface-200 bg-white text-[13px] text-ink-900 placeholder:text-ink-300 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-accent-500 transition-shadow"
                />
              </div>

              {/* Practice name */}
              <div>
                <label htmlFor="practice" className="block text-[11px] font-semibold text-ink-400 uppercase tracking-wider mb-1.5">
                  Practice name
                </label>
                <input
                  id="practice"
                  type="text"
                  value={practiceName}
                  onChange={e => setPracticeName(e.target.value)}
                  placeholder="Maple Architects"
                  className="w-full px-3.5 py-2.5 rounded-lg border border-surface-200 bg-white text-[13px] text-ink-900 placeholder:text-ink-300 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-accent-500 transition-shadow"
                />
              </div>

              {/* Role */}
              <div>
                <label htmlFor="role" className="block text-[11px] font-semibold text-ink-400 uppercase tracking-wider mb-1.5">
                  Your role
                </label>
                <div className="relative">
                  <select
                    id="role"
                    value={role}
                    onChange={e => setRole(e.target.value)}
                    className="w-full appearance-none px-3.5 py-2.5 rounded-lg border border-surface-200 bg-white text-[13px] text-ink-900 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-accent-500 transition-shadow pr-10"
                  >
                    <option value="">Select...</option>
                    <option value="practice_owner">Practice Owner</option>
                    <option value="director">Director</option>
                    <option value="project_lead">Project Lead</option>
                    <option value="associate">Associate</option>
                    <option value="technologist">Architectural Technologist</option>
                    <option value="engineer">Engineer</option>
                    <option value="other">Other</option>
                  </select>
                  <ChevronDown className="w-4 h-4 text-ink-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>

              {/* Practice size */}
              <div>
                <label htmlFor="size" className="block text-[11px] font-semibold text-ink-400 uppercase tracking-wider mb-1.5">
                  Practice size
                </label>
                <div className="relative">
                  <select
                    id="size"
                    value={practiceSize}
                    onChange={e => setPracticeSize(e.target.value)}
                    className="w-full appearance-none px-3.5 py-2.5 rounded-lg border border-surface-200 bg-white text-[13px] text-ink-900 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-accent-500 transition-shadow pr-10"
                  >
                    <option value="">Select...</option>
                    <option value="1-5">1-5</option>
                    <option value="6-15">6-15</option>
                    <option value="16-30">16-30</option>
                    <option value="31-50">31-50</option>
                    <option value="50+">50+</option>
                  </select>
                  <ChevronDown className="w-4 h-4 text-ink-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>

              {/* What do you want to see? */}
              <div>
                <label className="block text-[11px] font-semibold text-ink-400 uppercase tracking-wider mb-2">
                  What do you want to see?
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {interestOptions.map(opt => (
                    <label key={opt} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={interests.includes(opt)}
                        onChange={() => toggleInterest(opt)}
                        className="w-4 h-4 rounded border-surface-300 text-accent-600 focus:ring-accent-500"
                      />
                      <span className="text-[12px] text-ink-700">{opt}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Current tools */}
              <div>
                <label htmlFor="tools" className="block text-[11px] font-semibold text-ink-400 uppercase tracking-wider mb-1.5">
                  Current tools (optional)
                </label>
                <input
                  id="tools"
                  type="text"
                  value={currentTools}
                  onChange={e => setCurrentTools(e.target.value)}
                  placeholder="e.g. Excel, Monday, Xero..."
                  className="w-full px-3.5 py-2.5 rounded-lg border border-surface-200 bg-white text-[13px] text-ink-900 placeholder:text-ink-300 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-accent-500 transition-shadow"
                />
              </div>

              {/* CTA */}
              <button
                type="submit"
                className="w-full bg-gradient-accent text-white font-semibold text-[14px] py-3 rounded-lg hover:opacity-90 transition-opacity flex items-center justify-center gap-2 shadow-glow-indigo mt-2"
              >
                Book my demo
                <ArrowRight className="w-4 h-4" />
              </button>

              <p className="text-center text-[11px] text-ink-400 mt-3">
                Or request early access to explore the demo yourself.
              </p>
            </form>
          )}
        </div>
      </section>

      {/* ── Section 8: Footer ──────────────────────── */}
      <footer className="border-t border-surface-200 py-14 px-6 sm:px-10 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10 mb-12">
            {/* Logo + tagline */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 rounded-md bg-gradient-accent flex items-center justify-center text-white font-display text-sm">
                  C
                </div>
                <span className="font-display text-lg text-ink-900">Coordin.io</span>
              </div>
              <p className="text-[12px] text-ink-400 leading-relaxed">
                Project control for architects and design teams. One platform for quotes, delivery, compliance and commercial health.
              </p>
            </div>

            {/* Product */}
            <div>
              <h4 className="text-[11px] font-semibold text-ink-400 uppercase tracking-wider mb-4">Product</h4>
              <ul className="space-y-2.5">
                <li><Link href="/features/brpd" className="text-[13px] text-ink-500 hover:text-ink-900">BRPD</Link></li>
                <li><Link href="/features/quotes" className="text-[13px] text-ink-500 hover:text-ink-900">Quotes</Link></li>
                <li><Link href="/use-cases" className="text-[13px] text-ink-500 hover:text-ink-900">Use Cases</Link></li>
                <li><Link href="/faq" className="text-[13px] text-ink-500 hover:text-ink-900">FAQ</Link></li>
              </ul>
            </div>

            {/* Company */}
            <div>
              <h4 className="text-[11px] font-semibold text-ink-400 uppercase tracking-wider mb-4">Company</h4>
              <ul className="space-y-2.5">
                <li><Link href="/book-demo" className="text-[13px] text-ink-500 hover:text-ink-900">Book a Demo</Link></li>
                <li><a href="mailto:hello@coordin.io" className="text-[13px] text-ink-500 hover:text-ink-900">Contact</a></li>
                <li><a href="#" className="text-[13px] text-ink-500 hover:text-ink-900">Privacy</a></li>
                <li><a href="#" className="text-[13px] text-ink-500 hover:text-ink-900">Terms</a></li>
              </ul>
            </div>

            {/* Access */}
            <div>
              <h4 className="text-[11px] font-semibold text-ink-400 uppercase tracking-wider mb-4">Access</h4>
              <ul className="space-y-2.5">
                <li><Link href="/login" className="text-[13px] text-ink-500 hover:text-ink-900">Sign In</Link></li>
                <li><Link href="/demo-access" className="text-[13px] text-ink-500 hover:text-ink-900">Try the Demo</Link></li>
                <li><a href="#" className="text-[13px] text-ink-500 hover:text-ink-900">Design Partner Programme</a></li>
              </ul>
              <Link
                href="/book-demo"
                className="inline-flex items-center gap-1.5 mt-5 bg-gradient-accent text-white font-semibold text-[12px] px-4 py-2 rounded-lg hover:opacity-90 transition-opacity"
              >
                Book a demo
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>

          {/* Bottom bar */}
          <div className="pt-6 border-t border-surface-200">
            <p className="text-[11px] text-ink-300 text-center">
              &copy; {new Date().getFullYear()} Coordin.io. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}

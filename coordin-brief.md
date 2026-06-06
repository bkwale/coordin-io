# Coordin.io — Product Brief

**Last updated:** 6 June 2026
**Author:** Wale Koleosho
**Status:** Post-demo, first paying practice confirmed (~£180/month). Building to Ayo's PRD.

---

## Mission

Give built-environment practices a single control centre for projects, people, money, and compliance.

## What It Is

Coordin.io is a project control and practice management platform for multidisciplinary built-environment practices (5–25 staff). It tracks projects through RIBA stages, manages fee quotes and invoicing, monitors team resourcing and leave, enforces BRPD compliance, and surfaces risks before they become problems.

Positioned for **architects who lead multidisciplinary teams** — structural engineers, MEP, QS, interior designers working alongside the architect as practice lead.

Previously named ArchitectOps. Rebranded May 2026. Domain: coordin.io

## Stage

**Post-demo → building to first paying customer's requirements.**

- Phases 1–5 complete (core platform, executive dashboard, quote system, timesheets)
- Demo delivered to beta partner — well received, studio ready to onboard at ~£180/month
- Landing page live at coordin.io with waitlist form
- Design system fully refreshed (18-point improvement plan executed)
- No backend yet — mock data only
- No auth or multi-tenancy

## Current State

### What's built (mock data, frontend only)

| Area | Routes | Key Features |
|------|--------|-------------|
| **Homepage** | `/` | 8-section marketing page per website PRD: hero (architect-first headline, dual CTAs), product proof strip (5 screenshot cards), 5 use cases with problem/solution/CTA, Why Coordin (4 differentiators), Who It's For (7 audience cards), Designed By Architects, demo booking form (name, email, practice, role, size, interest checkboxes, current tools), full footer (3 columns) |
| **Use Cases** | `/use-cases` | 5 workflows expanded: Quote to Project, Project Health, BRPD Compliance, Timesheets, Executive Dashboard |
| **BRPD Feature** | `/features/brpd` | Dedicated BRPD feature page: what it does, 6 feature cards, who uses it, CTA |
| **Quotes Feature** | `/features/quotes` | Quote workflow page: 2 modes, 5 templates, 12-tab builder, lifecycle flow, CTA |
| **Book a Demo** | `/book-demo` | Dedicated demo booking form with interest checkboxes and current tools field |
| **Executive Dashboard** | `/dashboard` | 10 widgets, 7 KPI cards, quick-view filters (Today/Week/Practice/Commercial/Staff/BRPD), demo banner |
| **Projects** | `/projects`, `/projects/new`, `/projects/[id]` + 14 sub-routes | RIBA stage tracking, task management, risk detection engine, 12-step creation wizard, tabbed workspace (6 tabs) |
| **Quote System** | `/fee-quotes`, `/fee-quotes/new`, `/fee-quotes/[id]`, `/fee-quotes/[id]/edit` | 11 core statuses + 3 optional, linked/standalone modes, 5 templates (Planning, Technical, Full Service, BRPD, CDM PD), 12-tab builder, 12 line item types, commercial assumptions (meetings, mileage, expenses, design freeze, deposit), quote-to-project conversion |
| **Timesheets** | `/timesheets`, `/timesheets/review` | Weekly timesheet page with task-linked entry, stage grouping (10 categories), week navigation, assigned tasks panel, billable/non-billable indicator, manager review (by project/person/stage) |
| **Analytics** | 5 routes | Portfolio health, commercial performance, cashflow forecast, drawing issue intelligence, quote performance |
| **Staffing** | `/staffing` | Team capacity, utilisation, leave management (holiday/sick/CPD/parental), bank holidays, entitlements |
| **Invoicing** | Data model only | 6 invoices (all statuses), Xero sync status, overdue tracking |
| **Overheads** | Data model only | 13 entries across 10 categories |
| **BRPD Compliance** | `/projects/[id]/brpd`, `/projects/[id]/brpd/changelog` | Dutyholder coordination, compliance statements (7), requirements tracker (8), BRPD gateways (3), changelog |
| **CPD & Training** | `/cpd`, `/cpd/competence`, `/cpd/training` | CPD dashboard, competence matrix, training plans |
| **Knowledge Base** | `/knowledge`, `/knowledge/[id]` | Article library with detail pages |
| **AI Teammate** | `/ai`, `/projects/[id]/ai` | Global and project-scoped chat (mock) |
| **Portal** | `/portal` | External collaboration portal (mock) |
| **Settings** | 4 routes | Admin controls, role-based visibility, integration hub, numbering templates |
| **News & Regulations** | Widget only | 8 items across architecture, construction, regulations, planning, company |
| **FAQ** | `/faq` | 8 accordion items covering product, BRPD, pricing, integrations, security |
| **Demo Access** | `/demo-access` | Post-waitlist redirect with auto-forward to dashboard |

**Total: 50+ routes (including 6 marketing pages), 256 unit tests, 0 type errors.**

### What's NOT built

| Gap | Impact | When Needed |
|-----|--------|-------------|
| Backend (Supabase) | No real data, no persistence | Next priority |
| Authentication | No login, no user sessions | Next priority |
| Multi-tenancy / RLS | Every user sees everything | With auth |
| Data access layer (services/) | Mock data imported directly — Supabase migration will touch every file | Before backend |
| Integration APIs (Xero, Outlook, SharePoint) | Integrations page is UI only | After backend |
| CI pipeline (GitHub Actions) | 256 tests run manually only | This week |
| Quote PDF generation | Builder exists but no PDF export | Ayo's PRD Package B |
| Quote email sending | Send modal exists but no actual email | Ayo's PRD Package B |
| Timesheet exports (PDF/CSV) | Download stubs exist, no actual export | Ayo's PRD Package C |
| Dark mode | Design system structured for it but not implemented | Later |
| Waitlist email storage | Form captures data client-side only — no backend to store leads | Need Supabase or external form service |

## Users

### Primary persona
**Practice Owner / Director** — runs a 5–25 person architecture or multidisciplinary practice. Needs a single screen that answers: what needs attention, which jobs are at risk, where's the money, who's available, are we compliant.

### Secondary personas
- **Project Lead** — manages 2–5 projects. Needs task tracking, stage progression, document control, drawing issue workflows.
- **Team Member** — needs timesheet entry, task visibility, document access.
- **Finance / Admin Lead** — needs invoice tracking, quote pipeline, overhead monitoring, Xero sync.
- **BRPD Lead** — needs compliance tracking, dutyholder coordination, gateway readiness.

### Beta partner
Lead architect at a Worcester-based practice. She provided the original product requirements and idea for Coordin.io based on real practice pain points. Demo delivered — studio ready to onboard at ~£180/month.

See `/private/beta-partner.md` for full details (not committed to git).

### Commercial context
- Beta partner also leads a major international hotel development programme ($300M, 10 hotels, 8 cities)
- Coordin.io could serve as programme-wide project control platform for all consultants on the programme
- BMS/GRMS specialist requirements flagged — Coordin.io tracks consultant deliverables, doesn't replace specialist systems

## Constraints

- **Solo founder build.** No engineering team. Claude is the co-builder.
- **No budget for infrastructure yet.** Vercel free tier + Supabase free tier for beta.
- **Product originated from a real architect's real needs** — not speculative. Beta partner defined the requirements.
- **Scale implication:** Beta partner's projects span local UK commissions to large international hotel programmes. Coordin.io must handle both scales.
- **First revenue target:** ~£180/month from beta partner's studio.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14 (App Router), React 18, TypeScript |
| Styling | Tailwind CSS 3, custom design system (card-premium, card-static, card-interactive, status-pill, stripe-row) |
| Icons | Lucide React (replaced all inline SVGs) |
| Fonts | DM Sans (body), Instrument Serif (display), JetBrains Mono (data) |
| Backend (planned) | Supabase (PostgreSQL, Auth, RLS, Edge Functions) |
| Deployment | Vercel |
| Testing | Vitest (256 unit tests) |
| Repo | github.com/bkwale/coordin-io |
| Domain | coordin.io |

## Design Direction

Inspired by Stripe (clean, premium, data-dense), Monday.com (widget modularity), and Programa (landing page style, project visibility). Landing page uses Programa's style — large serif headline, full-width product screenshots, alternating feature sections.

### Design system

**Typography scale (5 named sizes):**
- `micro` (10px) — pill badges, tertiary labels
- `caption` (11px) — secondary info, timestamps, metadata
- `body` (13px) — primary content, table cells, form labels
- `subtitle` (15px) — section headings
- `display` (2rem+) — page titles (Instrument Serif)

**Card system (3 variants):**
- `card-premium` — hover lift + shadow increase. For clickable/linked cards.
- `card-static` — no hover effect. For display-only containers.
- `card-interactive` — focus ring on `:focus-within`. For form containers.

**Component patterns:**
- Status pills standardised to `-50` background / `-600` text
- Lucide icons throughout
- EmptyState, NotificationBell, DemoBanner, CommandPalette (⌘K), WidgetCard with loading skeletons
- Collapsible sidebar (72 → 16 units), 14 items across 4 sections
- Tabbed project workspace (6 tabs covering 14 sub-routes)
- Dashboard filters dim (opacity 40%) instead of hiding
- Touch targets: 44px minimum on coarse-pointer devices
- Page subtitles on all key pages

**Marketing pages:**
- Separate layout (no sidebar, white background)
- Programa-style: large serif headlines, full-width product mockups, alternating feature sections
- Sticky nav with backdrop blur

## Quote System (per Ayo's PRD)

### Statuses (11 core + 3 optional)
Draft → Internal Review → Ready to Send → Sent → Viewed → Revised → Accepted → Declined → Expired → Superseded → Converted to Project
Optional: Follow-up Required, Awaiting Client Clarification, Awaiting Deposit

### Modes
- **Linked to existing project** — inherits client, stage scope, project number
- **Standalone** — captures client/project details, converts to project on acceptance

### Templates (5)
1. Planning / Pre-App (pre-app, planning application, Stage 2-3)
2. Technical / Delivery (Stage 4, tender, design coordination, working drawings)
3. Full Appointment / Multidisciplinary (multi-stage, architecture + interiors + CA)
4. BRPD Services (Principal Designer, compliance, dutyholder support)
5. CDM PD Services (design risk coordination, pre-construction information, H&S)

### Quote builder (12 tabs)
Overview → Client & Project → Appointment Type → Scope → Stage Line Items → Optional Extras → Meetings & Communication → Travel & Expenses → Design Freeze → Exclusions → Terms & Conditions → Preview & Send

### Line item types (12)
stage_service, additional_service, optional_service, consultant_coordination, travel_mileage, expense_allowance, cgi_render, contract_admin, interior_design, brpd_service, cdm_pd_service, other_custom

## Timesheet System (per Ayo's PRD)

### Staff page (/timesheets)
- Weekly view with daily entry support
- Task-linked: book time against project + task + stage + category
- 10 categories: marketing/bid, strategic definition, briefing, concept design, planning/spatial, technical design, tender, construction/CA, handover/use, admin/CPD/office
- Week navigation (previous/next), assigned tasks panel, recently used tasks
- Billable/non-billable indicator, missing time alerts

### Manager review (/timesheets/review)
- Review by project, person, or stage
- Flag high non-billable time
- Compare actual time vs quote fee assumptions
- Download/export stubs

## 3rd Party Integrations

### P1 — Must have
| Integration | Purpose | API |
|------------|---------|-----|
| **Xero** | Invoice sync, payment tracking, overhead reconciliation | Xero OAuth 2.0 |
| **Microsoft Outlook / 365** | Calendar, email, deadline syncing | Microsoft Graph |
| **SharePoint / OneDrive** | Document storage, BRPD evidence uploads | Microsoft Graph |
| **Stripe** | Subscription billing for Coordin.io | Stripe Billing |

### P2 — Important (growth)
QuickBooks, Google Calendar, Gmail, Microsoft Teams, Azure AD SSO, Google SSO, Planning Portal, LABC Portal, RSS/RIBA feeds

### P3 — Nice to have (scale)
Slack, HubSpot, BreatheHR/CharlieHR, Google Drive, Dropbox, Google Maps/OS Maps

## Competitive Landscape

| Competitor | What They Do | Coordin.io Advantage |
|-----------|-------------|---------------------|
| Programa | Interior design project management, specifications | Built-environment focus (not interior-only), BRPD compliance, RIBA staging, fee quotes |
| Synergy | Time & fee management, invoicing | Modern UX, widget dashboard, BRPD, quote templates |
| Rapport3 | Project management for architects | Multi-discipline support, compliance engine, executive dashboard |
| Xero/QuickBooks | Accounting | Project-first with accounting integration, not the reverse |
| Monday.com | Generic project management | Built-environment specific: RIBA stages, building regs, BRPD, tenders |

### Differentiators
1. **BRPD compliance engine** — native dutyholder tracking, gateway readiness, compliance statements
2. **Quote-to-project pipeline** — 5 RIBA-aligned templates, 12-tab builder, conversion rules
3. **Executive dashboard** — widget-based control centre for practice owners
4. **Built-environment specific** — not generic PM adapted for architects

## Recent Decisions

| Date | Decision | Rationale |
|------|----------|-----------|
| 6 Jun 2026 | Website PRD fully implemented | 8-section homepage, 4 new marketing pages (use-cases, BRPD, quotes, book-demo), architect-first positioning, 5 use case structure |
| 6 Jun 2026 | Landing page redesigned Programa-style | Beta partner (Ayo) requested Programa-style design |
| 6 Jun 2026 | Routing fixed: `/` = landing page, `/dashboard` = app | coordin.io should show marketing page first, not the app |
| 6 Jun 2026 | Ayo's PRD implemented (Packages A-D) | Quote system rebuild, timesheet pages, manager review — all requested by paying beta partner |
| 6 Jun 2026 | FAQ page built | 8 accordion items at /faq |
| 6 Jun 2026 | Domain purchased: coordin.io | Live on Vercel |
| 30 May 2026 | 18-point design improvement plan executed | Type scale, card variants, Lucide icons, collapsible sidebar, tabbed workspace, ⌘K, notifications |
| 30 May 2026 | Rebrand from ArchitectOps to Coordin.io | Multidisciplinary positioning |
| 30 May 2026 | Executive dashboard with 10 widgets | Spec-driven from Coordin.io dashboard PDF |
| 30 May 2026 | 3rd party integration roadmap defined | P1: Xero, Outlook/365, SharePoint, Stripe |

## Where I Want Pressure

- What's the fastest path to real data (Supabase) so Ayo's team can start using it?
- Should the waitlist form store to Supabase or use an external service (Formspree, etc.)?
- What's the right pricing for the first 5 design partners?
- How do we handle the Accor/Shoreline programme opportunity without over-building?

## Roadmap

### Next (immediate)
- Connect waitlist form to backend (Supabase or Formspree)
- Supabase project setup (auth, database, RLS)
- Data access layer (services/ folder)
- 4 core tables: users, projects, tasks, quotes
- Login / signup flow
- CI pipeline (GitHub Actions)

### Phase 6
- Quote PDF generation + email sending
- Timesheet exports (PDF/CSV)
- Invoicing backend + Xero integration
- Dashboard with real data

### Phase 7
- Microsoft 365 integration (Outlook + SharePoint)
- AI teammate (project status summaries)
- Mobile-responsive polish
- Stripe billing for subscriptions

### Phase 8
- Multi-tenancy (practice onboarding)
- Programme-level view (for Shoreline-scale clients)
- QuickBooks + Google Workspace integrations
- Public launch

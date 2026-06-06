# Coordin.io — Product Brief

**Last updated:** 30 May 2026
**Author:** Wale Koleosho
**Status:** Pre-beta, demo scheduled with Worcester practice owner (w/c 2 June 2026)

---

## Mission

Give built-environment practices a single control centre for projects, people, money, and compliance.

## What It Is

Coordin.io is a project control and practice management platform for multidisciplinary built-environment practices (5–25 staff). It tracks projects through RIBA stages, manages fee quotes and invoicing, monitors team resourcing and leave, enforces BRPD compliance, and surfaces risks before they become problems.

Positioned for **architects who lead multidisciplinary teams** — structural engineers, MEP, QS, interior designers working alongside the architect as practice lead.

Previously named ArchitectOps. Rebranded May 2026.

## Stage

**Build → approaching first beta demo.**

- Phases 1–4 complete (core platform, all major features)
- Phase 5 Wave 1 complete (executive dashboard, timesheets, invoices, overheads, news)
- Design refresh complete — all 41 pages on new design system
- No backend yet — mock data only
- No auth or multi-tenancy

## Current State

### What's built (mock data, frontend only)

| Area | Routes | Key Features |
|------|--------|-------------|
| **Executive Dashboard** | `/` | 10 widgets, 7 KPI cards, quick-view filters (Today/Week/Practice/Commercial/Staff/BRPD) |
| **Projects** | `/projects`, `/projects/new`, `/projects/[id]` + 14 sub-routes | RIBA stage tracking, task management, risk detection engine, 12-step creation wizard |
| **Project Workspaces** | 14 sub-routes per project | Registers, meetings, design risks, contract admin, planning, tenders, site queries, building regs, BRPD, changelog, drawing issues, documents, health scorecard, brief builder |
| **Commercial** | `/fee-quotes`, `/fee-recommendations`, `/opportunities` | Fee quote builder (visual editor), quote analytics, pipeline, fee benchmarks |
| **Analytics** | `/analytics/portfolio`, `/analytics/commercial`, `/analytics/cashflow`, `/analytics/drawing-issues`, `/analytics/quotes` | Portfolio health, commercial performance, cashflow forecast, drawing issue intelligence, quote performance |
| **Staffing** | `/staffing` | Team capacity, utilisation, leave management (holiday/sick/CPD/parental), bank holidays, entitlements |
| **Timesheets** | Data model only | 15 entries, weekly summaries, missing-timesheet detection |
| **Invoicing** | Data model only | 6 invoices (all statuses), Xero sync status, overdue tracking |
| **Overheads** | Data model only | 13 entries across 10 categories (rent, software, insurance, etc.) |
| **CPD & Training** | `/cpd`, `/cpd/competence`, `/cpd/training` | CPD dashboard, competence matrix, training plans |
| **Knowledge Base** | `/knowledge`, `/knowledge/[id]` | Article library with detail pages |
| **AI Teammate** | `/ai`, `/projects/[id]/ai` | Global and project-scoped chat (mock) |
| **Portal** | `/portal` | External collaboration portal (mock) |
| **Settings** | `/settings/admin`, `/settings/integrations`, `/settings/international`, `/settings/numbering` | Admin controls, role-based visibility, integration hub (Xero/QB/Outlook), numbering templates |
| **News & Regulations** | Widget only | 8 items across architecture, construction, regulations, planning, company |

**Total: 41 routes, 256 unit tests, 0 integration tests, 0 type errors.**

### What's NOT built

| Gap | Impact | When Needed |
|-----|--------|-------------|
| Backend (Supabase) | No real data, no persistence | Phase 5 Wave 2 |
| Authentication | No login, no user sessions | Phase 5 Wave 2 |
| Multi-tenancy / RLS | Every user sees everything | Phase 5 Wave 2 |
| Data access layer (services/) | Mock data imported directly by 41 pages — Supabase migration will touch every file | Before backend |
| Integration APIs (Xero, Outlook, SharePoint) | Integrations page is UI only | Phase 6 |
| CI pipeline (GitHub Actions) | 256 tests run manually only | This week |
| Monitoring / SLOs | No error tracking, no uptime target | Before beta |
| Component / integration tests | All 256 tests are unit-level on utils and mock data | Before beta |
| Dark mode | Design system structured for it but not implemented | Phase 7 |

## Users

### Primary persona
**Practice Owner / Director** — runs a 5–25 person architecture or multidisciplinary practice. Needs a single screen that answers: what needs attention, which jobs are at risk, where's the money, who's available, are we compliant.

### Secondary personas
- **Project Lead** — manages 2–5 projects. Needs task tracking, stage progression, document control, drawing issue workflows.
- **Team Member** — needs timesheet entry, task visibility, document access.
- **Finance / Admin Lead** — needs invoice tracking, quote pipeline, overhead monitoring, Xero sync.
- **BRPD Lead** — needs compliance tracking, dutyholder coordination, gateway readiness.

### Beta partner
Lead architect at a Worcester-based practice. She provided the original product requirements and idea for Coordin.io based on real practice pain points. Demo scheduled week commencing 2 June 2026.

See `/private/beta-partner.md` for full details (not committed to git).

## Constraints

- **Solo founder build.** No engineering team. Claude is the co-builder.
- **No budget for infrastructure yet.** Vercel free tier + Supabase free tier for beta.
- **Product originated from a real architect's real needs** — not speculative.
- **Scale implication:** Beta partner's projects span local UK commissions to large international hotel programmes. Coordin.io must handle both scales.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14 (App Router), React 18, TypeScript |
| Styling | Tailwind CSS 3, custom design system (card-premium, status-pill, stripe-row) |
| Fonts | DM Sans (body), Instrument Serif (display), JetBrains Mono (data) |
| Backend (planned) | Supabase (PostgreSQL, Auth, RLS, Edge Functions) |
| Deployment | Vercel |
| Testing | Vitest (256 unit tests) |
| Repo | github.com/bkwale/coordin-io |

## Design Direction

Inspired by Stripe (clean, premium, data-dense) and Monday.com (widget modularity, accessible colours). Also drawing from Programa (project visibility) and Quotient (commercial status design).

### Design principles
- Simple, modern, clean — not flashy
- Dense with information but not cluttered
- Professional and calm — executive control centre, not a homepage
- Easy to scan — practice owner should answer their top 3 questions in 10 seconds
- Desktop-first, clear tablet layout, reduced mobile widget set

### Design system

**Typography scale (formalised):**
- `micro` (10px) — pill badges, tertiary labels
- `caption` (11px) — secondary info, timestamps, metadata
- `body` (13px) — primary content, table cells, form labels
- `subtitle` (15px) — section headings
- `display` (2rem+) — page titles (Instrument Serif)
- KPI values use DM Sans (not serif) for digit readability

**Card system (3 variants):**
- `card-premium` — hover lift + shadow increase. For clickable/linked cards only.
- `card-static` — no hover effect. For display-only containers (KPI cards, widget shells).
- `card-interactive` — focus ring on `:focus-within`. For form containers.

**Status pills:**
- Standardised to `-50` background / `-600` text across all colour functions
- No borders on pills — background contrast provides definition

**Component patterns:**
- `status-pill` — rounded badges with category colours
- `stripe-row` — subtle accent tint on hover for table rows
- `animate-fade-in` — page entrance animation per page
- Lucide icons throughout (replaced all inline SVGs)
- `EmptyState` component — consistent muted icon + single-line message pattern
- `NotificationBell` — functional dropdown with real project update data
- `WidgetCard` — supports `isLoading` prop for skeleton states
- `CommandPalette` — ⌘K search across projects, people, quotes, pages

**Layout:**
- Collapsible sidebar (72 → 16 units) with icon-only mode + tooltips
- Sidebar restructured from 25+ items to 14 items across 4 sections (Main, Insights, More, Settings)
- Project workspace uses tabbed layout (6 tabs: Overview, Tasks & Actions, Documents, Commercial, Compliance, Planning)
- Dashboard filters dim non-matching widgets (opacity 40%) instead of hiding them
- Touch targets: 44px minimum on coarse-pointer devices
- Page subtitles on all key pages (contextual data summaries below titles)

## 3rd Party Integrations

### P1 — Must have (beta / early customers)

| Integration | Purpose | API |
|------------|---------|-----|
| **Xero** | Invoice sync, payment tracking, overhead reconciliation. UK practices live in Xero. | Xero OAuth 2.0 API |
| **Microsoft Outlook / 365** | Meeting scheduling, deadline syncing, project milestones in calendar, email notifications | Microsoft Graph API |
| **SharePoint / OneDrive** | Document storage, transmittals, BRPD evidence uploads. Most UK practices use SharePoint. | Microsoft Graph API |
| **Stripe** | Subscription billing for Coordin.io itself | Stripe Billing API |

### P2 — Important (growth phase)

| Integration | Purpose | API |
|------------|---------|-----|
| **QuickBooks** | Alternative accounting for practices not on Xero | QuickBooks Online API |
| **Google Calendar** | Calendar sync for Google Workspace practices | Google Calendar API |
| **Gmail** | Email notifications, drawing issue emails for Google practices | Gmail API |
| **Microsoft Teams** | Practice team notifications, approval alerts | Microsoft Graph API |
| **Microsoft Entra ID (Azure AD)** | SSO for practices on Microsoft 365 | OIDC / SAML |
| **Google Workspace** | SSO alternative | Google Identity |
| **Planning Portal** | Auto-check planning application status, determination dates | Planning Portal API |
| **LABC Portal** | Building control submissions, inspection scheduling | LABC API |
| **RSS / RIBA feeds** | News & regulations widget content | RSS / Atom |

### P3 — Nice to have (scale phase)

| Integration | Purpose | API |
|------------|---------|-----|
| **Slack** | Team notifications for Slack-using practices | Slack Web API |
| **HubSpot** | Opportunity pipeline, client contact management | HubSpot CRM API |
| **BreatheHR / CharlieHR** | Leave, absence, staff records (UK SME HR) | REST APIs |
| **Google Drive** | Alternative document storage | Google Drive API |
| **Dropbox** | Alternative document storage | Dropbox API |
| **Google Maps / OS Maps** | Site location, planning context | Maps APIs |

### Integration architecture (planned)
- Edge Functions (Supabase) for webhook handlers and OAuth token management
- Per-practice integration credentials stored encrypted in Supabase
- Sync status visible on executive dashboard (unsynced invoices, connection health)
- Webhook-driven where possible (Xero, Stripe) to minimise polling

## Competitive Landscape

| Competitor | What They Do | Coordin.io Advantage |
|-----------|-------------|---------------------|
| Programa | Project dashboards, branding, modularity | Deeper compliance (BRPD), fee quote builder, commercial analytics |
| Synergy | Time & fee management, invoicing | Modern UX, widget dashboard, AI teammate, BRPD compliance |
| Rapport3 | Project management for architects | Broader multi-discipline support, compliance engine |
| Xero/QuickBooks | Accounting | Coordin.io is project-first with accounting integration, not the other way around |
| Monday.com | Generic project management | Built-environment specific: RIBA stages, building regs, BRPD, tenders |

### Differentiators
1. **BRPD compliance engine** — no competitor does this natively with dutyholder tracking, gateway readiness, compliance statements
2. **Executive dashboard** — widget-based control centre designed for practice owners, not just project managers
3. **Quote-to-invoice pipeline** — connected commercial flow with Xero sync
4. **AI teammate** — project-scoped and practice-wide AI assistant (planned)

## Open Questions

1. **Backend timing:** Build Supabase backend before or after the Worcester demo? (Current answer: demo with mock data first, backend after.)
2. **Pricing model:** Per-user? Per-practice? Tiered by practice size? Not decided.
3. **Multidisciplinary vs architect-first:** Product features are architect-native (RIBA, BRPD). Name is multidisciplinary. Needs resolution — current recommendation is architect-first positioning.
4. **AI teammate scope:** What's the simplest AI feature that a practice owner would pay for? Hypothesis: one-paragraph project status summary from real data.
5. **Integration priority:** Xero first? Outlook first? SharePoint? Depends on beta tester feedback.

## Recent Decisions

| Date | Decision | Rationale |
|------|----------|-----------|
| 30 May 2026 | Rebrand from ArchitectOps to Coordin.io | Multidisciplinary positioning, cleaner brand |
| 30 May 2026 | Build executive dashboard as widget grid | Spec-driven: 10 widgets, 7 KPIs, filter bar |
| 30 May 2026 | Add Phase 5 data models (timesheets, invoices, overheads, news) | Dashboard needs data to render meaningfully |
| 30 May 2026 | Design refresh rolled out to all 41 pages | Consistent premium feel across entire product |
| 30 May 2026 | 3rd party integration roadmap defined | P1: Xero, Outlook/365, SharePoint, Stripe |
| 30 May 2026 | 18-point design improvement plan executed | Type scale, card variants, Lucide icons, collapsible sidebar, tabbed project workspace, ⌘K command palette, notification bell, touch targets, page subtitles, loading skeletons |
| 30 May 2026 | Sidebar restructured from 25+ to 14 items | 4 sections: Main, Insights, More, Settings. Collapsible to 16px icon-only mode |
| 30 May 2026 | Project workspace now tabbed | 6 tabs replace 14 separate nav destinations. Routes preserved, navigation simplified |
| 29 May 2026 | Design refresh — Stripe/Monday.com direction | Previous design felt too basic for practice-owner beta |
| 29 May 2026 | Leave management added to Staffing page | Practice owners expect holiday/absence tracking |

## Where I Want Pressure

- Is the feature scope right for a first demo, or is it too much?
- Is the positioning (architect-first) correct, or am I limiting the market too early?
- Which integration should be built first after Supabase?
- Is the design system premium enough for a practice owner paying £X/month?

## Roadmap

### Phase 5 Wave 2 (next)
- Supabase project setup (auth, database, RLS)
- Data access layer (services/ folder)
- 4 core tables: users, projects, tasks, quotes
- Login / signup flow
- CI pipeline (GitHub Actions: lint + tsc + vitest)

### Phase 5 Wave 3
- Invoicing backend + Xero integration (P1)
- Timesheet entry UI + approval workflow
- Dashboard with real data

### Phase 6
- Microsoft 365 integration (Outlook calendar + SharePoint documents)
- AI teammate (project status summaries)
- Mobile-responsive polish
- Stripe billing for Coordin.io subscriptions

### Phase 7
- Multi-tenancy (practice onboarding)
- QuickBooks + Google Workspace integrations (P2)
- Planning Portal / LABC integrations
- Pricing + billing
- Public launch

# Coordin.io — Product Brief

**Last updated:** 25 August 2026
**Author:** Wale Koleosho
**Status:** Live on Vercel. Full-stack platform — Supabase backend, 50+ API routes, 1421 unit tests, CI green. First paying practice confirmed (~£180/month).

---

## Mission

Give built-environment practices a single control centre for projects, people, money, and compliance.

## What It Is

Coordin.io is a project control and practice management platform for multidisciplinary built-environment practices (5–25 staff). It tracks projects through RIBA stages, manages fee quotes and invoicing, monitors team resourcing and leave, enforces BRPD compliance, and surfaces risks before they become problems.

Positioned for **architects who lead multidisciplinary teams** — structural engineers, MEP, QS, interior designers working alongside the architect as practice lead.

Previously named ArchitectOps. Rebranded May 2026. Domain: coordin.io

## Stage

**Live platform — building toward first paying customer onboarding.**

- Full-stack application deployed to Vercel with Supabase (PostgreSQL) backend
- 50+ API routes, all authenticated with org-scoped multi-tenancy
- 1421 unit tests + 88-case E2E test plan with Playwright suite
- GitHub Actions CI pipeline (typecheck + test + build verification)
- Resend email integration (invitations, quotes, notifications, password recovery)
- 8-role permission system (OWNER, ADMIN, MANAGER, HR, LEGAL, FINANCE, COMMERCIAL, MEMBER, VIEWER)
- Demo delivered to beta partner — studio ready to onboard at ~£180/month

## Current State

### What's Built (Full-Stack — Real Data)

| Area | Routes | Key Features |
|------|--------|-------------|
| **Auth** | `/login`, `/signup`, `/forgot-password`, `/activate/[token]` | Supabase Auth, invitation tokens (crypto.randomBytes), password recovery emails, role-based activation |
| **Onboarding** | `/onboarding` | Template-driven multi-step wizard (profile, policies, training), progress tracking |
| **Dashboard** | `/dashboard` | 10 real-data widgets, KPI cards, project health, quick-view filters |
| **My Work** | `/my-work` | 8 sections + 9 filters, tasks/reviews/approvals aggregated across projects |
| **Projects** | `/projects`, `/projects/new`, `/projects/[id]` + 14 sub-routes | RIBA stage tracking, 9-step creation wizard, table/Kanban/Gantt views, milestones with calculated status, task dependencies, document revisions |
| **Tasks** | `/projects/[id]/tasks`, task detail | Edit modal, status stepper, duplicate/archive/delete, dependency CRUD, enhanced checklists |
| **Documents** | `/projects/[id]/documents` | Drawing register, revision auto-numbering, file upload (PDF/images), Info Out transmittals, Info In |
| **Fee Quotes** | `/fee-quotes`, `/fee-quotes/new`, `/fee-quotes/[id]` | CRUD + PDF generation + email sending, 11 statuses, linked/standalone modes, 5 RIBA templates, 12-tab builder |
| **Timesheets** | `/timesheets`, `/timesheets/review` | Weekly entry, task-linked, 10 categories, manager review/approval, CSV + PDF export with filters |
| **Leave** | `/leave` | Full approval workflow, team calendar (holidays + leave + travel + milestones), public holiday CRUD, department/office/manager filters |
| **Expenses** | `/expenses` | Project linking, cost codes, supplier, category, receipt upload, approval engine integration |
| **Staffing** | `/staffing` | Employee table with status badges + onboarding progress, slide-out drawer, HR docs upload, training CRUD, salary audit trail |
| **Approvals** | `/approvals` | Configurable approval routes (multi-step, escalation timeout), approve/reject with comments, wired into leave + expenses + service requests |
| **Settings** | `/settings` (unified left-rail) | Organisation profile, team & roles (edit/remove), billing & currency, notification preferences, regional settings, document numbering, audit trail |
| **Audit Trail** | `/settings` → Audit | HR-scoped filtering, CSV export, org-level event log |
| **Compliance** | `/projects/[id]/compliance`, `/projects/[id]/brpd` | BRPD dutyholder coordination, compliance statements, building regulations |
| **Analytics** | 5 routes | Portfolio health, commercial performance, cashflow forecast, drawing issues, quote performance |
| **Global Search** | `/search` | Cross-module search with Cmd+K command palette |
| **Notifications** | `/notifications` | Cross-module notifications with email delivery via Resend, user preference controls |
| **Knowledge Base** | `/knowledge`, `/knowledge/[id]` | Article library with real data |
| **Marketing** | `/`, `/use-cases`, `/features/brpd`, `/features/quotes`, `/book-demo`, `/faq`, `/demo-access` | 8-section homepage, 5 use case pages, timed demo (10 min), demo signup with Resend emails |
| **Admin** | `/admin` | Platform admin backoffice (super-admin only) |

### Backend Infrastructure

| Component | Implementation |
|-----------|---------------|
| **Database** | Supabase PostgreSQL (eu-central-1), Prisma ORM, 30+ models |
| **Auth** | Supabase Auth + withAuth() middleware, invitation token system |
| **Permissions** | canPerform() matrix — 8 roles, lateral isolation, tier-based hierarchy |
| **API Routes** | 50+ Next.js API routes, all authenticated + org-scoped |
| **Email** | Resend integration — invitations, quotes, notifications, password recovery |
| **File Upload** | Direct upload to Supabase Storage (PDF, images) |
| **Validation** | Input validation helpers (requireUUID, requireNumber, requireDate, maxLength) |
| **Rate Limiting** | Applied to auth endpoints + demo signup |
| **Security Headers** | CSP, X-Frame-Options, HSTS via next.config.js |
| **Error Reporting** | Structured error handling across all routes |
| **CI/CD** | GitHub Actions — tsc + vitest + Next.js build verification on every push |

### Test Coverage

| Layer | Count | Framework |
|-------|-------|-----------|
| **Unit tests** | 1421 | Vitest |
| **Integration tests** | 21 (DB) + route-level | Vitest + real Supabase |
| **E2E test plan** | 88 cases | Documented (E2E-TEST-PLAN.md) |
| **E2E automated** | 54 specs across 9 files | Playwright (not yet in CI) |
| **Schema contract** | Validates all Prisma queries | Vitest |

### What's NOT Built

| Gap | Impact | When Needed |
|-----|--------|-------------|
| Integration APIs (Xero, Outlook, SharePoint) | UI pages exist, no backend connectors | After first customer onboarding |
| Invoicing backend | Data model only, 6 sample invoices | Phase 7 |
| AI Teammate | Chat UI exists (mock) | Phase 7 |
| Client Portal | External collaboration (mock) | Phase 7 |
| Dark mode | Design system structured for it | Later |
| Stripe billing | Subscription payments | Before public launch |
| E2E tests in CI | Playwright suite built, not wired into GitHub Actions | Next sprint |

## Users

### Primary persona
**Practice Owner / Director** — runs a 5–25 person architecture or multidisciplinary practice. Needs a single screen that answers: what needs attention, which jobs are at risk, where's the money, who's available, are we compliant.

### Secondary personas
- **Project Lead** — manages 2–5 projects. Needs task tracking, stage progression, document control, drawing issue workflows.
- **Team Member** — needs timesheet entry, task visibility, document access.
- **HR Manager** — needs staffing, onboarding, training, leave management, audit trail.
- **Finance / Admin Lead** — needs invoice tracking, quote pipeline, expense approvals, overhead monitoring.
- **BRPD Lead** — needs compliance tracking, dutyholder coordination, gateway readiness.

### Beta partner
Lead architect at a Worcester-based practice. She provided the original product requirements and idea for Coordin.io based on real practice pain points. Demo delivered — studio ready to onboard at ~£180/month.

See `/private/beta-partner.md` for full details (not committed to git).

### Commercial context
- Beta partner also leads a major international hotel development programme ($300M, 10 hotels, 8 cities)
- Coordin.io could serve as programme-wide project control platform for all consultants on the programme

## Constraints

- **Solo founder build.** No engineering team. Claude is the co-builder.
- **No budget for infrastructure yet.** Vercel free tier + Supabase free tier for beta.
- **Product originated from a real architect's real needs** — not speculative. Beta partner defined the requirements.
- **Scale implication:** Beta partner's projects span local UK commissions to large international hotel programmes. Coordin.io must handle both scales.
- **First revenue target:** ~£180/month from beta partner's studio.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16 (App Router + Turbopack), React, TypeScript |
| Styling | Tailwind CSS, custom design system |
| Icons | Lucide React |
| Fonts | DM Sans (body), Instrument Serif (display), JetBrains Mono (data) |
| Backend | Supabase (PostgreSQL, Auth, Storage, RLS) |
| ORM | Prisma |
| Email | Resend |
| Deployment | Vercel |
| Testing | Vitest (1421 unit tests) + Playwright (E2E) |
| CI/CD | GitHub Actions (tsc + test + build) |
| Repo | github.com/bkwale/coordin-io |
| Domain | coordin.io |

## Permission System

8 roles with tiered hierarchy and lateral isolation:

| Role | Level | Access |
|------|-------|--------|
| OWNER | 100 | Full platform access, all settings |
| ADMIN | 90 | All features except owner-only settings |
| MANAGER | 70 | Project management, team review, timesheet approval |
| HR | 60 | Staffing, onboarding, training, leave, audit trail |
| LEGAL | 60 | Compliance, contracts (lateral — no HR access) |
| FINANCE | 60 | Quotes, expenses, invoicing (lateral — no HR access) |
| COMMERCIAL | 60 | Commercial analytics, quotes (lateral — no HR access) |
| MEMBER | 30 | Own tasks, timesheets, leave requests |
| VIEWER | 10 | Read-only access to assigned projects |

## Approval Engine

Configurable multi-step approval routes with escalation:
- Admin-defined routes (matching by type + amount thresholds)
- Step-by-step advancement with approve/reject/request-info actions
- Email notifications at each step
- Timeout-based escalation
- Wired into: leave requests, expense claims, service requests

## Quote System

### Statuses (11 core + 3 optional)
Draft → Internal Review → Ready to Send → Sent → Viewed → Revised → Accepted → Declined → Expired → Superseded → Converted to Project
Optional: Follow-up Required, Awaiting Client Clarification, Awaiting Deposit

### Features
- **PDF generation** — server-side via PDFKit (portrait A4), download button in UI
- **Email sending** — via Resend, send modal with recipient/subject/message
- **Linked or standalone** modes — linked inherits project context, standalone converts on acceptance
- **5 RIBA templates** — Planning, Technical, Full Service, BRPD, CDM PD
- **12-tab builder** — Overview → Client & Project → Appointment → Scope → Stage Items → Extras → Meetings → Travel → Design Freeze → Exclusions → Terms → Preview

## Timesheet System

### Staff page (/timesheets)
- Weekly view with daily entry, task-linked (project + task + stage + category)
- 10 categories: marketing/bid, strategic definition, briefing, concept design, planning/spatial, technical design, tender, construction/CA, handover/use, admin/CPD/office
- Week navigation, assigned tasks panel, billable/non-billable indicator

### Manager review (/timesheets/review)
- Review by project, person, or stage
- Approve/reject individual timesheets
- CSV + PDF export with manager filters (project, person, date range, status)
- PDF uses landscape A4 via PDFKit with org name header

## Recent Decisions

| Date | Decision | Rationale |
|------|----------|-----------|
| 25 Aug 2026 | Playwright E2E suite + test plan | 88 test cases, 9 spec files, page object pattern, role-based auth |
| 25 Aug 2026 | Hardcoded data audit | Fixed email fallbacks (noreply@coordin.io), API key validation, demo signup |
| 25 Aug 2026 | Timesheet CSV + PDF exports | Manager-filtered exports with OWASP CSV injection protection |
| 24 Aug 2026 | Quote PDF + email sending | PDFKit generation, Resend delivery, download/send UI |
| 24 Aug 2026 | GitHub Actions CI | Two-job pipeline — typecheck+test, then build verification |
| 23 Aug 2026 | Sprint 6 complete | Notification preferences, regional settings, document numbering |
| 22 Aug 2026 | Sprint 5 complete | Expense expansion, ExternalLink layer, Excel/PDF export utility |
| 22 Aug 2026 | Sprint 4 complete | Public holidays, leave filters, team calendar |
| 21 Aug 2026 | Sprint 3 complete | Approval workflow engine with configurable routes + escalation |
| 21 Aug 2026 | Sprint 2 complete | Milestones, project edit, SharePoint links |
| 20 Aug 2026 | Sprint 1 complete | Task workflow — duplicate, archive, dependencies, enhanced checklists |
| 20 Aug 2026 | Sprint 0 complete | 8-role permission foundation with lateral isolation |

## Where I Want Pressure

- What's the fastest path to onboarding Ayo's team with real data?
- Integration priority — Xero first or SharePoint first?
- Pricing strategy for the first 5 design partners
- How to handle the Accor/Shoreline programme opportunity without over-building
- E2E test coverage — wire into CI now or wait for integration tests?

## Roadmap

### Next (immediate)
- Wire Playwright E2E into GitHub Actions CI
- Onboard beta partner with real org data
- Xero integration (P1 — invoice sync)

### Phase 7
- Microsoft 365 integration (Outlook + SharePoint)
- Invoicing backend + Xero sync
- Client portal (external collaboration)
- AI teammate (project status summaries)

### Phase 8
- Stripe billing for subscriptions
- Programme-level view (for Shoreline-scale clients)
- QuickBooks + Google Workspace integrations
- Public launch

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
2. **Quote-to-project pipeline** — 5 RIBA-aligned templates, PDF generation, email sending
3. **Executive dashboard** — widget-based control centre with real data
4. **Built-environment specific** — not generic PM adapted for architects
5. **Approval workflow engine** — configurable multi-step routes with escalation

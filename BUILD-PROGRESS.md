# Coordin.io — Build Progress

## Phase 1 — COMPLETE
Core RIBA stage tracking, project dashboards, task management, risk detection engine.

## Phase 2 — COMPLETE

### Wave 1 (Complete)
- Approvals queue
- Registers (Issues, Changes, Risk Register)
- Meetings & Actions
- Enhanced practice dashboard

### Wave 2 (Complete)
- Design Risk workspace
- Contract Administration
- Planning & Site Context
- Tender / ITT / Evaluation
- Site Queries

### Wave 3 (Complete — built in Phase 3 Wave 1)
- Building Regulations: `/projects/[id]/building-regs`
- BRPD / Dutyholder Coordination: `/projects/[id]/brpd`
- Enhanced Documents Register: `/projects/[id]/documents`

## Phase 3

### Wave 1 — Foundation (COMPLETE)
| Feature | Route | Status |
|---------|-------|--------|
| Building Regulations | `/projects/[id]/building-regs` | Done |
| BRPD / Dutyholders | `/projects/[id]/brpd` | Done |
| Enhanced Documents | `/projects/[id]/documents` | Done |
| Knowledge Base Library | `/knowledge` | Done |
| Knowledge Article Detail | `/knowledge/[id]` | Done |
| CPD Dashboard | `/cpd` | Done |
| Competence Matrix | `/cpd/competence` | Done |
| Training Plans | `/cpd/training` | Done |
| Admin Controls | `/settings/admin` | Done |
| International Settings | `/settings/international` | Done |

**Types added:** 25+ new interfaces and type aliases
**Mock data:** 13 new data arrays, 22 new helper functions
**Sidebar:** Updated with Knowledge Base, CPD & Training, Settings sections
**Project workspaces:** Added Building Regs, BRPD, Documents links

### Wave 2 — Intelligence (COMPLETE)
| Feature | Route | Status |
|---------|-------|--------|
| Drawing Issue Intelligence | `/analytics/drawing-issues` | Done |
| Commercial Analytics | `/analytics/commercial` | Done |
| Cashflow Forecast | `/analytics/cashflow` | Done |
| Portfolio Health Dashboard | `/analytics/portfolio` | Done |
| Staffing Forecasts | `/staffing` | Done |

**Types added:** 8 new interfaces (DrawingIssueRecord, ProjectCommercial, CashflowForecast, StaffAllocation, StaffCapacity, etc.)
**Mock data:** 5 new data arrays (14 drawing issues, 6 project commercials, 9 cashflow months, 12 allocations, 5 capacities), 9 helper functions
**Sidebar:** Added Analytics section (Portfolio, Commercial, Cashflow, Drawing Issues) + Staffing nav item

### Wave 3 — Commercial (COMPLETE)
| Feature | Route | Status |
|---------|-------|--------|
| Fee Recommendations | `/fee-recommendations` | Done |
| Fee Quote Builder | `/fee-quotes` + `/fee-quotes/[id]` | Done |
| Opportunities / Proposals | `/opportunities` | Done |

**Types added:** FeeRecommendation, FeeQuoteRecord, FeeQuoteStatus, FeeQuoteLineItem, Opportunity, OpportunityStatus
**Mock data:** 3 fee recommendations, 4 fee quotes with 16 line items, 6 opportunities, 9 helper functions
**Utils:** feeQuoteStatusColor/Label, opportunityStatusColor/Label, confidenceBadgeColor, formatCurrency/formatPercent reused
**Sidebar:** Added Commercial section (Fee Benchmarks, Fee Quotes, Opportunities)

### Wave 4 — AI & Integrations (COMPLETE)
| Feature | Route | Status |
|---------|-------|--------|
| AI Teammate (Global Chat) | `/ai` | Done |
| AI Teammate (Project Panel) | `/projects/[id]/ai` | Done |
| Integrations Hub (Xero/QB/Outlook/etc) | `/settings/integrations` | Done |
| External Collaboration Portal | `/portal` | Done |

**Types added:** AIConversation, AIMessage, AISource, AISuggestedPrompt, Integration, IntegrationProvider, IntegrationStatus, PortalInvite, PortalSharedItem, PortalAccessLevel
**Mock data:** 3 AI conversations (8 messages), 10 suggested prompts, 6 integrations (accounting/calendar/storage), 5 portal invites, 6 shared items, 12 helper functions
**Utils:** integrationStatusColor/Label/Dot, portalAccessLabel/Color, portalItemTypeIcon, timeAgo
**Sidebar:** Added AI Teammate, Portal (Navigate); Integrations (Settings)

## Phase 4 — COMPLETE

### Wave 1 — Commercial Foundation (COMPLETE)
| Feature | Route | Status |
|---------|-------|--------|
| Enhanced Fee Quote Builder | `/fee-quotes/[id]/edit` | Done |
| Fee Quote Analytics | `/analytics/quotes` | Done |
| Numbering & Templates Admin | `/settings/numbering` | Done |
| Fee Quotes List (rebuilt) | `/fee-quotes` | Done |

**Types updated:** FeeQuoteRecord (22 new fields), FeeQuoteLineItem (10 new fields), FeeQuoteStatus (8 statuses), Task (5 new fields)
**Types added:** FeeQuoteSection, FeeQuoteView, FeeQuoteTemplate, TermsLibraryItem, ExclusionsLibraryItem, ProjectHealthSnapshot, TaskScheduleMetric, ProjectNumberTemplate, QuoteNumberTemplate, DrawingIssueTemplate, QuoteSectionType
**Mock data:** 6 fee quotes (all statuses), 19 line items, 11 quote sections, 10 view tracking entries, 3 templates, 4 terms library, 5 exclusions library, 17 health snapshots, 7 numbering templates, 10 new helper functions
**Utils:** Updated feeQuoteStatusColor/Label (8 statuses), added quoteSectionTypeLabel, numberingPreview, quoteNeedsFollowUp, healthScoreColor/Bg
**Sidebar:** Added Quote Performance (Analytics), Numbering (Settings)

### Wave 2 — Health Engine (COMPLETE)
| Feature | Route | Status |
|---------|-------|--------|
| Project Health 2.0 (scorecards, alerts, burn vs budget) | `/projects/[id]/health` | Done |
| Portfolio Health & Commercial Analytics 2.0 | `/analytics/portfolio` (upgrade) | Done |
| Quote-to-Project Linking (acceptance → project creation) | `/fee-quotes/[id]` (upgrade) | Done |
| Quote Analytics Dashboard | `/analytics/quotes` (upgrade) | Done |

**Types added:** ProjectHealthAlert, BurnBudgetMetric, QuoteProjectLink, QuoteConversionMetric, HealthAlertSeverity, HealthAlertCategory
**Mock data:** 9 health alerts, 9 burn-budget metrics, 5 quote-project links, 5 conversion metrics, 7 new helper functions
**Utils:** healthAlertSeverityColor/Dot, healthAlertCategoryLabel/Icon, burnRatioColor/Bg, varianceColor, formatBurnRatio
**Project workspace:** Added Health link to project dashboard
**Upgrades:** Portfolio (health trends, alert summary, at-risk deep dive), Quote detail (project linking workflow), Quote analytics (win rate by sector, pipeline forecast, time-to-accept)

### Wave 3 — Compliance (COMPLETE)
| Feature | Route | Status |
|---------|-------|--------|
| BRPD Workspace 2.0 (compliance statements, requirements tracker) | `/projects/[id]/brpd` (upgrade) | Done |
| BRPD Changelog & Document Control | `/projects/[id]/brpd/changelog` | Done |
| Drawing Issue & Email Workflow | `/projects/[id]/drawing-issues` | Done |

**Types added:** ComplianceStatement, ComplianceStatementStatus, BRPDRequirement, BRPDRequirementStatus, BRPDChangelogEntry, BRPDChangeType, DrawingIssueWorkflow, DrawingWorkflowStatus, DrawingEmail, DrawingEmailDirection
**Mock data:** 7 compliance statements, 8 BRPD requirements, 10 changelog entries, 6 drawing workflows, 11 drawing emails, 10 helper functions
**Utils:** complianceStatementStatusColor/Label, brpdRequirementStatusColor/Label, brpdChangeTypeLabel/Color, drawingWorkflowStatusColor/Label, drawingEmailDirectionLabel/Color, requirementCategoryLabel/Color
**Project workspaces:** Added BRPD Changelog, Drawing Issues links

### Wave 4 — Project Creation (COMPLETE)
| Feature | Route | Status |
|---------|-------|--------|
| New Project / Brief Creation 2.0 (12-step wizard) | `/projects/new` (upgrade) | Done |
| Project Brief Document Builder | `/projects/[id]/brief` | Done |
| Xero / QuickBooks Quote Linkage | `/settings/integrations` (upgrade) | Done |
| Role-Based Visibility Controls | `/settings/admin` (upgrade) | Done |

**Types added:** WizardStepStatus, WizardStep, BriefSectionStatus, BriefSection, ProjectBrief, AccountingSyncStatus, QuoteAccountingLink, FeatureArea, RoleVisibilityRule
**Mock data:** 12 wizard steps, 2 project briefs (12 brief sections), 5 quote accounting links, 18 role visibility rules, 10 helper functions
**Utils:** wizardStepStatusColor/Label, briefSectionStatusColor/Label, accountingSyncStatusColor/Label, featureAreaLabel, roleLabel
**Project workspaces:** Added Brief link to project dashboard

## Current Route Map

### Top-level routes
- `/my-work` — Employee landing page (real data via /api/dashboard)
- `/` — Practice Overview Dashboard
- `/projects` — Projects listing
- `/projects/new` — New project form
- `/projects/[id]` — Project dashboard
- `/approvals` — Approvals queue
- `/knowledge` — Knowledge Base library
- `/knowledge/[id]` — Knowledge article detail
- `/cpd` — CPD Dashboard
- `/cpd/competence` — Competence Matrix
- `/cpd/training` — Training Plans
- `/staffing` — Staffing Forecast & Utilisation
- `/analytics/portfolio` — Portfolio Health Dashboard
- `/analytics/commercial` — Commercial Performance
- `/analytics/cashflow` — Cashflow Forecast
- `/analytics/drawing-issues` — Drawing Issue Intelligence
- `/fee-recommendations` — Fee Benchmarks & Recommendations
- `/fee-quotes` — Fee Quotes dashboard (rebuilt Phase 4)
- `/fee-quotes/[id]` — Fee Quote detail (line items, terms)
- `/fee-quotes/[id]/edit` — Fee Quote visual builder (Phase 4)
- `/analytics/quotes` — Quote Performance analytics (Phase 4)
- `/opportunities` — Opportunities & Pipeline
- `/ai` — AI Teammate (global portfolio chat)
- `/projects/[id]/ai` — AI Teammate (project-scoped chat)
- `/portal` — External Collaboration Portal
- `/settings/admin` — Admin Controls (AI governance + Role-Based Visibility) (Phase 4 upgrade)
- `/settings/international` — International & Jurisdiction settings
- `/settings/integrations` — Integrations Hub (Xero, Outlook, SharePoint, Quote Sync) (Phase 4 upgrade)
- `/settings/numbering` — Numbering & Templates Admin (Phase 4)

### Task routes
- `/tasks/[id]` — Task detail (status flow, checklist, comments, reviewer UI)

### Project sub-routes (`/projects/[id]/...`)
- `/tasks` — Task list (filter by status, sort by priority/date/name)
- `/registers` — Issues, Changes & Risk Register
- `/meetings` — Meetings & Actions
- `/design-risks` — Design Risk workspace
- `/contract-admin` — Contract Administration
- `/planning` — Planning & Site Context
- `/tender` — Tender / ITT / Evaluation
- `/site-queries` — Site Queries
- `/building-regs` — Building Regulations
- `/brpd` — BRPD & Dutyholder Coordination (Phase 4 upgrade)
- `/brpd/changelog` — BRPD Changelog & Document Control (Phase 4)
- `/drawing-issues` — Drawing Issue & Email Workflow (Phase 4)
- `/brief` — Project Brief Document Builder (Phase 4)
- `/documents` — Drawing Register (real data, type filters)

### Document routes
- `/documents/[id]` — Document detail (revision history, review submission)
- `/health` — Project Health Scorecard (Phase 4)

## Data Model Summary
- **6 projects**, **5 users**, **107 tasks**
- **Phase 2:** 6 approvals, 6 issues, 4 changes, 5 risk items, 7 meetings, 10 actions, 5 design risks, 2 contract admin records, 5 contract events, 4 planning records, 5 site constraints, 3 tenders, 4 returns, 9 evaluations, 5 site queries
- **Phase 2 Wave 3:** 4 building reg records, 6 inspections, 7 dutyholders, 3 BRPD gateways, 8 documents, 3 transmittals
- **Phase 3 Wave 1:** 5 knowledge articles, 8 CPD records, 8 competencies, 15 user competencies, 4 training plans, 2 jurisdiction packs, 1 org settings, 5 AI source permissions, 3 AI logs
- **Phase 3 Wave 2:** 14 drawing issues, 6 project commercials, 9 cashflow months, 12 staff allocations, 5 staff capacities
- **Phase 3 Wave 3:** 3 fee recommendations, 4 fee quotes, 16 line items, 6 opportunities
- **Phase 3 Wave 4:** 3 AI conversations (8 messages), 10 suggested prompts, 6 integrations, 5 portal invites, 6 shared items
- **Phase 4 Wave 1:** 6 fee quotes (all statuses), 19 line items, 11 quote sections, 10 view tracking entries, 3 quote templates, 4 terms library items, 5 exclusions library items, 17 health snapshots, 3 project number templates, 1 quote number template, 3 drawing issue templates
- **Phase 4 Wave 2:** 9 health alerts, 9 burn-budget metrics, 5 quote-project links, 5 conversion metrics
- **Phase 4 Wave 3:** 7 compliance statements, 8 BRPD requirements, 10 changelog entries, 6 drawing workflows, 11 drawing emails
- **Phase 4 Wave 4:** 12 wizard steps, 2 project briefs (12 brief sections), 5 quote accounting links, 18 role visibility rules
- **Phase 5:** 15 timesheet entries, 6 invoices (all statuses), 13 overhead entries (10 categories), 8 news items, 10 project updates

## Phase 5 — IN PROGRESS (Rebrand: Coordin.io)

### Wave 1 — Executive Dashboard (COMPLETE)
| Feature | Route/Component | Status |
|---------|----------------|--------|
| Rebrand: ArchitectOps → Coordin.io | Global (package.json, layout, sidebar, docs) | Done |
| Timesheets data model | types.ts + mock-data.ts | Done |
| Invoices data model (full pipeline) | types.ts + mock-data.ts | Done |
| Overhead categories | types.ts + mock-data.ts | Done |
| News & Regulations data model | types.ts + mock-data.ts | Done |
| Project Updates feed | types.ts + mock-data.ts | Done |
| Dashboard KPI engine | mock-data.ts (getDashboardKPIs, helpers) | Done |
| WidgetCard shell component | components/widgets/WidgetCard.tsx | Done |
| Practice Summary Widget | components/widgets/PracticeSummaryWidget.tsx | Done |
| Staff & Resourcing Widget | components/widgets/StaffResourcingWidget.tsx | Done |
| Financial Health Widget | components/widgets/FinancialHealthWidget.tsx | Done |
| Quote & Invoice Pipeline Widget | components/widgets/QuoteInvoiceWidget.tsx | Done |
| Jobs At Risk Widget | components/widgets/JobsAtRiskWidget.tsx | Done |
| Calendar & Deadlines Widget | components/widgets/CalendarDeadlinesWidget.tsx | Done |
| Project Updates Widget | components/widgets/ProjectUpdatesWidget.tsx | Done |
| BRPD / Compliance Widget | components/widgets/BRPDWidget.tsx | Done |
| News & Regulations Widget | components/widgets/NewsWidget.tsx | Done |
| Recent Activity Widget | components/widgets/RecentActivityWidget.tsx | Done |
| Executive Dashboard page (widget grid) | `/` (page.tsx rewrite) | Done |
| Quick-view filter bar | `/` (Today/Week/Practice/Commercial/Staff/BRPD) | Done |
| 7 KPI cards row | `/` (Active, At Risk, Missing TS, Open Invoices, Quotes, BRPD, Approvals) | Done |

**Types added:** TimesheetEntry, TimesheetWeekSummary, TimesheetStatus, Invoice, InvoiceLineItem, InvoiceStatus, OverheadEntry, OverheadSummary, OverheadCategory, NewsItem, NewsCategory, DashboardKPIs, ProjectUpdate
**Mock data:** 15 timesheet entries, 6 invoices, 13 overhead entries, 8 news items, 10 project updates, 20+ helper functions
**Utils:** timesheetStatusColor/Label, invoiceStatusColor/Label, overheadCategoryColor/Label, newsCategoryColor/Label, updateSeverityColor/Dot
**Components:** 11 new widget components in components/widgets/

### Wave 2 — Quote Workflow + Timesheets + Landing (COMPLETE)
| Feature | Route/Component | Status |
|---------|----------------|--------|
| Quote statuses expanded (11 core + 3 optional) | types.ts | Done |
| Quote modes (linked/standalone) | types.ts + mock-data.ts | Done |
| 5 quote templates (Planning, Technical, Full Service, BRPD, CDM PD) | mock-data.ts | Done |
| Expanded quote data model (commercial assumptions, presentation fields) | types.ts | Done |
| 12 line item types | types.ts | Done |
| New quote chooser (mode + template selection) | `/fee-quotes/new` | Done |
| 12-tab quote builder | `/fee-quotes/[id]/edit` (rewrite) | Done |
| Quote template type badges on list page | `/fee-quotes` (upgrade) | Done |
| Timesheet data model (task_category, task_id, notes) | types.ts | Done |
| Weekly timesheet page | `/timesheets` | Done |
| Manager timesheet review | `/timesheets/review` | Done |
| Landing page with waitlist form | `/welcome` | Done |
| Demo access redirect | `/demo-access` | Done |
| FAQ page (8 accordion items) | `/faq` | Done |
| Demo banner component | components/DemoBanner.tsx | Done |
| Conditional layout (marketing vs app) | layout.tsx (upgrade) | Done |
| Collapsible sidebar with route groups | components/Sidebar.tsx (upgrade) | Done |
| Tabbed project workspace (6 tabs) | projects/[id]/layout.tsx | Done |
| Command palette (⌘K) | components/CommandPalette.tsx | Done |
| Notification bell (functional) | components/NotificationBell.tsx | Done |

**Types updated:** FeeQuoteStatus (11+3), QuoteMode, QuoteTemplateType, QuoteLineType (12 types), TimesheetCategory (10 categories), expanded FeeQuoteRecord (40+ fields), expanded FeeQuoteLineItem, expanded TimesheetEntry
**Mock data:** 5 quote templates, updated 6 quotes + 19 line items, updated 15 timesheet entries
**New routes:** /fee-quotes/new, /timesheets, /timesheets/review, /welcome, /demo-access, /faq
**New components:** DemoBanner, CommandPalette, NotificationBell

### Wave 3 — Backend Foundation (COMPLETE)
| Feature | Route/Component | Status |
|---------|----------------|--------|
| Supabase schema + migration SQL (11 tables, RLS, triggers) | `supabase/migrations/001_initial_schema.sql` | Done |
| Supabase browser + server client | `src/lib/supabase/client.ts`, `server.ts` | Done |
| Auth pages (login, signup, forgot-password) | `/auth/login`, `/auth/signup`, `/auth/forgot-password` | Done |
| Auth callback route | `/auth/callback` | Done |
| Env template + Vercel env vars (5 vars) | `.env.local`, Vercel dashboard | Done |
| Services layer v1 (data access abstraction) | `src/lib/services/` (9 files, 8 entities) | Done |
| Services layer v2 (Purple Team review applied) | `src/lib/services/` (11 files) | Done |

**Services layer v2 architecture (Purple Team review):**
- `ServiceResult<T>` return type: `{ data, error }` — callers can show error states
- Dependency injection: pass server Supabase client from Server Components
- Pagination: `limit`/`offset` on all list queries (default 100)
- Circuit breaker: 3 failures in 30s → skip Supabase for 60s (`resilience.ts`)
- Query timeout: 5s `AbortController` on every query (`resilience.ts`)
- Structured logging: service/operation/mode/error code (`logger.ts`)
- `getOrgId()` helper: auto-fetches `organisation_id` for all org-scoped inserts
- Error ≠ mock data: Supabase errors surface to callers, never fall back to demo data
- Explicit column selection on all queries (no `select('*')`)

**Files created:**
- `src/lib/services/config.ts` — `isSupabaseConfigured()`, `getOrgId()`, `resolveClient()`, `ServiceResult<T>`, `QueryOptions`
- `src/lib/services/logger.ts` — `createServiceLogger()` structured logging factory
- `src/lib/services/resilience.ts` — circuit breaker (`isCircuitOpen`, `recordFailure`, `recordSuccess`), `queryTimeout()`
- `src/lib/services/projects.ts` — 5 functions (getProjects, getProject, getProjectsByStatus, createProject, updateProject)
- `src/lib/services/tasks.ts` — 6 functions (getTasks, getTasksByProject, getTask, getOverdueTasks, createTask, updateTask)
- `src/lib/services/quotes.ts` — 6 functions + 3 sub-entities (quotes, line_items, templates)
- `src/lib/services/timesheets.ts` — 6 functions (getTimesheetEntries, getTimesheetsByUser, getTimesheetsByProject, getTimesheetsByWeek, createTimesheetEntry, updateTimesheetEntry)
- `src/lib/services/invoices.ts` — 6 functions (getInvoices, getInvoice, getInvoicesByProject, getOverdueInvoices, createInvoice, updateInvoiceStatus)
- `src/lib/services/leave.ts` — 5 functions (getLeaveRecords, getLeaveByUser, getPendingLeave, createLeaveRequest, updateLeaveStatus)
- `src/lib/services/profiles.ts` — 4 functions (getProfiles, getProfile, getCurrentProfile, updateProfile)
- `src/lib/services/waitlist.ts` — 2 functions (getWaitlistEntries, addToWaitlist)
- `src/lib/services/index.ts` — barrel export for all services

**Supabase schema (11 tables):** organisations, profiles, projects, tasks, quotes, quote_line_items, quote_templates, timesheet_entries, invoices, leave_records, waitlist
**RLS:** Org-scoped multi-tenancy via `get_user_org_id()` helper, waitlist has public insert
**Triggers:** `handle_new_user()` (auto-create profile on signup), `handle_updated_at()` (6 tables)
**Vercel env vars:** NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, RESEND_API_KEY, TEAM_NOTIFICATION_EMAIL, RESEND_FROM_EMAIL

## Phase 6 — CWA Homes Operating System (Prisma + Real Data)

### Sprint 1 — Identity & Invitation (COMPLETE)
| Feature | Route/File | Status |
|---------|-----------|--------|
| Prisma v7 + PrismaPg adapter | `src/lib/prisma.ts` | Done |
| Full data model (30+ entities, 6 sprints) | `prisma/schema.prisma` (986 lines) | Done |
| Multi-currency support (NGN, GBP, USD, EUR) | `src/lib/currency.ts` | Done |
| Secure token generation (crypto.randomBytes) | `src/lib/tokens.ts` | Done |
| Server-side auth verification | `src/app/api/invitations/[token]/activate/route.ts` | Done |
| withAuth() middleware wrapper | `src/lib/with-auth.ts` | Done |
| Centralised error infrastructure | `src/lib/errors.ts` (8 error classes) | Done |
| Standard API response helpers | `src/lib/api-response.ts` | Done |
| Audit event recording | `src/lib/audit.ts` | Done |
| Invitation API (create, list, validate, activate) | `src/app/api/invitations/` | Done |
| Invitation activation UI | `src/app/activate/[token]/page.tsx` | Done |
| Health check endpoint | `src/app/api/health/route.ts` | Done |
| Orphaned account detection | Activation route (ORPHAN_RISK logging) | Done |
| Mock data cleared | `src/lib/mock-data.ts` (empty stubs) | Done |
| Seed data (gitignored) | `private/seed.ts` (11 sections) | Done |
| Unit tests | 7 test files, 176 tests | Done |

**Security:** Invitation tokens are 64-char hex (crypto.randomBytes), NOT predictable CUIDs. Server verifies Supabase session — never trusts client-supplied authUserId. Email match validation prevents invitation hijacking.

**Infrastructure:** PgBouncer compatibility via DIRECT_URL (port 5432) for interactive transactions. Error classes with Prisma error wrapping. Structured audit trail for all mutations.

### Sprint 2 — Onboarding Wizard (COMPLETE)
| Feature | Route/File | Status |
|---------|-----------|--------|
| Onboarding progress API | `src/app/api/onboarding/route.ts` (GET) | Done |
| Policies API (list + acknowledge + open) | `src/app/api/onboarding/policies/` (3 routes) | Done |
| Training API (list + complete) | `src/app/api/onboarding/training/` (2 routes) | Done |
| Onboarding completion API | `src/app/api/onboarding/complete/route.ts` (POST) | Done |
| Onboarding wizard UI (5-step wizard) | `src/app/onboarding/page.tsx` | Done |
| Training seed data (4 modules) | `private/seed.ts` (section 10) | Done |
| Onboarding unit tests | `src/lib/__tests__/onboarding.test.ts` (26 tests) | Done |
| Layout update (no sidebar for /onboarding) | `src/app/layout.tsx` | Done |

**Wizard flow:** Welcome → Policies (read & acknowledge 4 mandatory docs) → Training (complete 4 modules: 60/120/45/90 min) → Profile (phone, emergency contact) → Complete (status: ONBOARDING → ACTIVE)

**API design:** All routes use withAuth() wrapper. Policies/training use upsert for idempotent acknowledgements. Completion endpoint validates all mandatory items before allowing status change. Full audit trail on every mutation.

**Verification:** 0 type errors (tsc --noEmit). 202/202 tests passing across 8 test files.

### Sprint 3 — Task Management & Drawing Register (COMPLETE)
| Feature | Route/File | Status |
|---------|-----------|--------|
| withProjectAccess() middleware | `src/lib/with-project-access.ts` | Done |
| Task status state machine | `src/lib/task-transitions.ts` | Done |
| Document revision auto-numbering | `src/lib/revision-numbering.ts` | Done |
| Projects API (list, create, detail, update) | `src/app/api/projects/` (2 routes) | Done |
| Project members API (list, add) | `src/app/api/projects/[id]/members/route.ts` | Done |
| Tasks API (list, create, detail, update) | `src/app/api/projects/[id]/tasks/` + `src/app/api/tasks/[id]/` | Done |
| Task comments API | `src/app/api/tasks/[id]/comments/route.ts` | Done |
| Task checklist API | `src/app/api/tasks/[id]/checklist/route.ts` | Done |
| Documents/Drawing Register API | `src/app/api/projects/[id]/documents/route.ts` | Done |
| Document detail + revisions API | `src/app/api/documents/[id]/` (2 routes) | Done |
| Document revision review API | `src/app/api/document-revisions/[id]/review/route.ts` | Done |
| Dashboard API (aggregated "what do I need today") | `src/app/api/dashboard/route.ts` | Done |
| My Work UI (employee landing page) | `src/app/my-work/page.tsx` | Done |
| Sidebar update (My Work nav item) | `src/components/Sidebar.tsx` | Done |
| Sprint 3 seed data (documents, revisions, checklist, comments) | `private/seed.ts` (sections 12-15) | Done |
| Task transition tests (25 tests) | `src/lib/__tests__/task-transitions.test.ts` | Done |
| Revision numbering tests (19 tests) | `src/lib/__tests__/revision-numbering.test.ts` | Done |

**Architecture:** withProjectAccess() higher-order wrapper extends withAuth() with project membership verification. Admins/Owners bypass membership check. Optional minProjectRole parameter enforces role hierarchy (GRADUATE < PROJECT_ARCHITECT < PROJECT_LEAD).

**Task state machine:** NOT_STARTED → IN_PROGRESS → READY_FOR_REVIEW → COMPLETED. Branch paths: IN_PROGRESS → BLOCKED → IN_PROGRESS, READY_FOR_REVIEW → CHANGES_REQUIRED → IN_PROGRESS. COMPLETED is terminal. Reviewer-only transitions: COMPLETED, CHANGES_REQUIRED.

**Document revisions:** Auto-numbered P01, P02... (preliminary) and C01, C02... (construction). Pure functions for formatting/parsing + DB query for next code. C revisions always sort after P revisions.

**Dashboard API:** Single GET returns profile summary, projects with task counts (my tasks, overdue, in review), urgent tasks (overdue + due today + high/critical priority), and weekly stats — all in one response.

**My Work UI:** Post-onboarding employee landing page. Time-of-day greeting, 4 stat cards (active tasks, overdue, awaiting review, completed this week), urgent tasks list with priority dots and due date badges, project grid with health status indicators and task counts. Full loading/error states with retry.

**API routes (12 total):** 5 project routes (list, create, detail, update, members), 4 task routes (list/create per project, detail/update per task, comments, checklist), 3 document routes (drawing register, document detail, revision review), 1 dashboard route.

**Seed data:** 5 drawing register documents, 5 document revisions, 5 task checklist items, 2 task comments. Total seed script now has 15 sections.

**Verification:** 0 type errors (tsc --noEmit). 246/246 tests passing across 10 test files.

### Sprint 3 Hardening — PT Review Fixes (COMPLETE)
| Fix | File(s) | Status |
|-----|---------|--------|
| Input validation module | `src/lib/validation.ts` (170 lines) | Done |
| Validation applied to all 10 mutation routes | 10 API route files | Done |
| withTaskAccess() middleware | `src/lib/with-task-access.ts` (95 lines) | Done |
| withDocumentAccess() + withRevisionAccess() middleware | `src/lib/with-document-access.ts` (170 lines) | Done |
| 5 routes refactored to use new middleware | tasks/[id]/, comments, checklist, revisions, review | Done |
| Transaction wrapping for multi-step writes | revisions + document review routes | Done |
| canReviewWork() enforcement | document-revisions/[id]/review route | Done |
| Rate limiting (in-memory sliding window) | `src/lib/rate-limit.ts` (100 lines) | Done |
| Rate limiting wired into withAuth() | `src/lib/with-auth.ts` | Done |
| Request timing (>2s warnings) | `src/lib/with-auth.ts` | Done |
| Health endpoint latency reporting | `src/app/api/health/route.ts` | Done |

**Verification:** 0 type errors (tsc --noEmit). 246/246 tests passing across 10 test files.

**Validation module:** requireString, optionalString, requireId, optionalId, isValidId, requireEnum, optionalEnum, optionalNumber, optionalDate, parseBody (64KB body size guard).

**Rate limiting:** Per-user sliding window. Presets: standard (100/min), strict (20/min), auth (10/min). Stale entry cleanup every 5 minutes.

**Middleware stack:** withAuth → withProjectAccess → withTaskAccess / withDocumentAccess / withRevisionAccess. Each layer adds context (profile, project, task/document/revision) and verifies org boundary + membership.

### UI Work Loop Sprint (COMPLETE — PT-recommended)
| Feature | Route/File | Status |
|---------|-----------|--------|
| useApiFetch + useApiMutation hooks | `src/hooks/use-api.ts` | Done |
| Toast notification system | `src/components/Toast.tsx` + layout wiring | Done |
| Loading skeletons (card, row, stats, task detail) | `src/components/Skeleton.tsx` | Done |
| StatusFlow visual state machine | `src/components/StatusFlow.tsx` | Done |
| StatusTransitionDropdown (valid-states only) | `src/components/StatusFlow.tsx` | Done |
| TaskStatusBadge + PriorityBadge | `src/components/StatusFlow.tsx` | Done |
| Task detail page (full work loop) | `src/app/tasks/[id]/page.tsx` | Done |
| Task list page (filter, sort, status counts) | `src/app/projects/[id]/tasks/page.tsx` | Done |
| Project dashboard (real data, task breakdown) | `src/app/projects/[id]/page.tsx` (rewrite) | Done |
| Drawing register (real data, type filters) | `src/app/projects/[id]/documents/page.tsx` (rewrite) | Done |
| Document detail + revision review | `src/app/documents/[id]/page.tsx` | Done |
| Project layout — Tasks tab added | `src/app/projects/[id]/layout.tsx` (updated) | Done |
| My Work urgent tasks — now clickable | `src/app/my-work/page.tsx` (updated) | Done |
| StatusFlow component tests (14 tests) | `src/components/__tests__/StatusFlow.test.ts` | Done |

**Complete employee work loop:** My Work → Task detail → status transition → comment → checklist → project overview → task list → drawing register → document detail → revision review.

**StatusFlow state machine:** Visual 4-step flow (Not started → In progress → In review → Completed) with branch states (Blocked, Changes needed) shown below. Ring highlight on current status, dashed ring on valid next steps. StatusTransitionDropdown shows only valid transitions and filters reviewer-only transitions (COMPLETED, CHANGES_REQUIRED) to the actual reviewer.

**Task detail page:** Status flow visualization, transition buttons, description/instructions, checklist with optimistic toggles + add item, comments with add form, sidebar with people (reviewer alert when awaiting review), details, and "What to do" contextual guidance per state.

**Project dashboard (real data):** Health badge, stat cards (total/in-progress/review/completed), blocked tasks alert, stacked progress bar, task status breakdown, team members with roles, project details sidebar, quick links to tasks and documents.

**Document review UI:** Drawing register with type filters + table layout, document detail with full revision history (revision badges, author, date, reviews with outcome styling), inline review form (approve/changes required/reject with comments).

**Frontend patterns established:** useApiFetch/useApiMutation hooks, ToastProvider context, Skeleton loading components, error toast on mutation failure, optimistic updates with rollback.

**Verification:** 0 type errors (tsc --noEmit). 260/260 tests passing across 11 test files.

### UI Work Loop — PT Round 2 Fixes (COMPLETE)
| Fix | File | Status |
|-----|------|--------|
| "New task" button + inline create form (title, priority, due date) | `src/app/projects/[id]/tasks/page.tsx` | Done |
| useApiFetch refactored: useRef → useEffect with AbortController cleanup | `src/hooks/use-api.ts` | Done |
| Verification — 0 type errors, 260/260 tests | — | Done |

**Create task form:** Inline form in task list header with title (required, maxLength 500), priority dropdown (Low/Medium/High/Critical), optional due date picker. POSTs to existing `POST /api/projects/[id]/tasks`. Success toast, auto-refresh list, error display. Cancel resets form.

**useApiFetch lifecycle fix:** Replaced `useRef` + conditional first-render pattern with proper `useEffect`. Now correctly re-fetches when URL changes, cleans up in-flight requests on unmount via `AbortController`, and avoids state updates after unmount. Abort errors silently swallowed.

### Sprint 4 — Leave & Expenses (COMPLETE)
| Feature | Route/File | Status |
|---------|-----------|--------|
| Request status state machine | `src/lib/request-transitions.ts` | Done |
| Leave calculation utilities | `src/lib/leave-utils.ts` | Done |
| Leave balance API | `src/app/api/leave/balance/route.ts` (GET) | Done |
| Leave requests API (list + create) | `src/app/api/leave/requests/route.ts` (GET, POST) | Done |
| Leave request detail API (get + status update) | `src/app/api/leave/requests/[id]/route.ts` (GET, PATCH) | Done |
| Expense claims API (list + create) | `src/app/api/expenses/route.ts` (GET, POST) | Done |
| Expense claim detail API (get + status update) | `src/app/api/expenses/[id]/route.ts` (GET, PATCH) | Done |
| Leave management UI | `src/app/leave/page.tsx` | Done |
| Expenses management UI | `src/app/expenses/page.tsx` | Done |
| Sidebar update (Leave + Expenses nav) | `src/components/Sidebar.tsx` (updated) | Done |
| Audit actions update | `src/lib/audit.ts` (updated) | Done |
| Sprint 4 seed data | `private/seed.ts` (sections 16-18) | Done |
| Request transitions tests (28 tests) | `src/lib/__tests__/request-transitions.test.ts` | Done |
| Leave utils tests (34 tests) | `src/lib/__tests__/leave-utils.test.ts` | Done |

**Request state machine:** DRAFT → SUBMITTED → UNDER_REVIEW → APPROVED → FULFILMENT_IN_PROGRESS → COMPLETED. Branch paths: DRAFT/SUBMITTED → WITHDRAWN, UNDER_REVIEW → REJECTED. Role-based guards: requester (SUBMITTED, WITHDRAWN), approver (UNDER_REVIEW, APPROVED, REJECTED), admin (FULFILMENT_IN_PROGRESS, COMPLETED). Shared across leave, expenses, and future service requests.

**Leave calculations:** Working days (Mon-Fri only), balance checks (allocation + carried forward - used - pending), overlap detection (blocks overlapping requests except WITHDRAWN/REJECTED), max 25 working days per request. Balance auto-updates on annual leave approval via $transaction.

**Multi-currency expenses:** NGN, GBP, USD, EUR with Intl.NumberFormat formatting. Per-currency totals in header (not misleading cross-currency aggregation). Categories: Travel, Accommodation, Meals, Equipment, Software, Printing, Postage, Training, PPE, Site expenses, Other. Amount validation: >0, <1M.

**Auto-approver assignment:** Both leave requests and expense claims auto-assign the user's managerId as approver on creation. Approver can be overridden by admin.

**API routes (8 endpoints):** 2 leave routes (balance, requests list/create), 2 leave detail routes (get, status update), 2 expense routes (list, create), 2 expense detail routes (get, status update).

**Seed data:** 3 leave balance records, 4 leave requests (approved/submitted/draft across types), 5 expense claims (multi-currency: NGN, GBP, EUR).

### Sprint 4 Hardening — PT Review Fixes (COMPLETE)
| Fix | File(s) | Status |
|-----|---------|--------|
| Admin transition authorization (isAdminTransition enforcement) | `leave/requests/[id]/route.ts`, `expenses/[id]/route.ts` | Done |
| Dead code removal (unused employeeProfile fetch) | `leave/requests/route.ts` | Done |
| Multi-currency totals (per-currency breakdown, not hardcoded NGN) | `expenses/page.tsx` | Done |
| Eliminate redundant re-fetch (return update result directly) | `leave/requests/[id]/route.ts`, `expenses/[id]/route.ts` | Done |
| Safe ID extraction (regex instead of pathname.split().pop()) | `leave/requests/[id]/route.ts`, `expenses/[id]/route.ts` | Done |

**Security fix:** Admin transitions (FULFILMENT_IN_PROGRESS, COMPLETED) now require ADMIN or OWNER orgPermission. Previously, any authenticated user who knew the request ID could escalate status — a privilege escalation vulnerability.

**Verification:** 0 type errors (tsc --noEmit). 322/322 tests passing across 13 test files.

### Sprint 5 — CPD, Service Requests & Assets (COMPLETE)
| Feature | Route/File | Status |
|---------|-----------|--------|
| CPD Records API (list + create) | `src/app/api/cpd/route.ts` (GET, POST) | Done |
| CPD Record detail (get + status transitions) | `src/app/api/cpd/[id]/route.ts` (GET, PATCH) | Done |
| Competency Records API (list + create) | `src/app/api/competency/route.ts` (GET, POST) | Done |
| Competency Record detail (get + update) | `src/app/api/competency/[id]/route.ts` (GET, PATCH) | Done |
| Supervision Records API (list + create) | `src/app/api/supervision/route.ts` (GET, POST) | Done |
| Supervision Record detail (get + update) | `src/app/api/supervision/[id]/route.ts` (GET, PATCH) | Done |
| Service Requests API (list + create) | `src/app/api/service-requests/route.ts` (GET, POST) | Done |
| Service Request detail (get + status transitions) | `src/app/api/service-requests/[id]/route.ts` (GET, PATCH) | Done |
| Assets API (list + create) | `src/app/api/assets/route.ts` (GET, POST) | Done |
| Asset detail (get + update) | `src/app/api/assets/[id]/route.ts` (GET, PATCH) | Done |
| Asset assignment (assign + return) | `src/app/api/assets/[id]/assign/route.ts` (POST, PATCH) | Done |
| CPD records UI | `src/app/cpd/records/page.tsx` | Done |
| Service requests UI | `src/app/service-requests/page.tsx` | Done |
| Assets register UI | `src/app/assets/page.tsx` | Done |
| Sidebar update (Requests + Assets nav) | `src/components/Sidebar.tsx` (updated) | Done |
| Audit actions update (CPD, competency, supervision, request, asset) | `src/lib/audit.ts` (updated) | Done |
| Sprint 5 seed data (sections 19-23) | `private/seed.ts` (updated) | Done |
| CPD status tests (26 tests) | `src/lib/__tests__/cpd.test.ts` | Done |
| Service request tests (19 tests) | `src/lib/__tests__/service-requests.test.ts` | Done |

**CPD state machine:** DRAFT → SUBMITTED → VERIFIED (terminal) or RETURNED → SUBMITTED (resubmit). Owner submits, manager/admin verifies or returns. Separate from the RequestStatus state machine — CPDStatus is its own 4-state enum.

**Service requests:** Uses the shared RequestStatus state machine from Sprint 4. 9 request types: IT_SUPPORT, EQUIPMENT, PPE, SOFTWARE_LICENCE, TRAINING, BOOKS_STANDARDS, TRAVEL, FLIGHTS_ACCOMMODATION, OFFICE_SUPPLIES. Full role-based enforcement (requester/approver/admin transitions).

**Asset management:** Admin-only create/update. Assignment workflow with assign/return tracking. 10 categories (LAPTOP, MONITOR, PHONE, TABLET, HELMET, HI_VIS, PPE_OTHER, FURNITURE, SOFTWARE, OTHER). 6 condition states (NEW, GOOD, REPAIR_REQUIRED, DAMAGED, LOST, RETIRED).

**API routes (11 files, 22 endpoints):** 2 CPD routes, 2 competency routes, 2 supervision routes, 2 service request routes, 3 asset routes (including assign).

**Verification:** 0 type errors. 412/412 tests passing across 16 test files.

### Sprint 6 — Site Observations & Snag Management (COMPLETE)
| Feature | Route/File | Status |
|---------|-----------|--------|
| Snag status state machine | `src/lib/snag-transitions.ts` | Done |
| Site Observations API (project-scoped) | `src/app/api/projects/[id]/observations/route.ts` (GET, POST) | Done |
| Observation detail | `src/app/api/observations/[id]/route.ts` (GET, PATCH) | Done |
| Snags API (project-scoped) | `src/app/api/projects/[id]/snags/route.ts` (GET, POST) | Done |
| Snag detail (get + status transitions) | `src/app/api/snags/[id]/route.ts` (GET, PATCH) | Done |
| Site observations UI | `src/app/projects/[id]/observations/page.tsx` | Done |
| Snags UI | `src/app/projects/[id]/snags/page.tsx` | Done |
| Project layout update (Observations + Snags tabs) | `src/app/projects/[id]/layout.tsx` (updated) | Done |
| Snag transition tests (45 tests) | `src/lib/__tests__/snag-transitions.test.ts` | Done |
| Sprint 6 seed data (sections 24-25) | `private/seed.ts` (updated) | Done |

**Snag state machine:** OPEN → ASSIGNED → RECTIFICATION_SUBMITTED → VERIFICATION → CLOSED (terminal). Branch: VERIFICATION → REOPENED → ASSIGNED (loop). ASSIGNED requires setting responsibleOrg. CLOSED sets verifiedBy/verifiedAt/closedAt. REOPENED clears verification data. Field updates only allowed in OPEN/ASSIGNED status.

**Site observations:** Project-scoped via withProjectAccess. Block/floor/room location data. Photo URL arrays. Optional GPS coordinates (lat/lng). Block/floor filters on list view.

**Snags:** Full defect tracking with 8 categories (ARCHITECTURAL, MEP, STRUCTURAL, FIRE, HEALTH_SAFETY, FINISH, FF_AND_E, EXTERNAL_WORKS), 4 severity levels (MINOR, MODERATE, MAJOR, SAFETY_CRITICAL), and the 6-state rectification workflow. Drawing/spec reference linking. Rectification photo evidence. Quick-action buttons for valid transitions.

**Verification:** 0 type errors. 412/412 tests passing across 16 test files.

### Sprint 5+6 PT Hardening (COMPLETE)

Purple Team review surfaced 2 fixes, both applied:

1. **Competency GET silent fallback** — `competency/route.ts` silently fell back to returning the requester's own records when they lacked access to another employee's records. Fixed: now throws `PermissionError`. Schneier flagged this as information leakage through behaviour.
2. **Missing audit on observation PATCH** — `observations/[id]/route.ts` had no audit event on update, unlike every other PATCH route in the system. Fixed: added `site.observation_updated` audit event.

**Verification:** 0 type errors. 412/412 tests passing across 16 test files.

## All 6 Sprints Complete

| Sprint | Scope | Tests | Status |
|--------|-------|-------|--------|
| 1 | Identity & Invitation | 176 | COMPLETE |
| 2 | Onboarding Wizard | 26 | COMPLETE |
| 3 | Tasks & Drawing Register | 64 | COMPLETE |
| 4 | Leave & Expenses | 62 | COMPLETE |
| 5 | CPD, Requests & Assets | 45 | COMPLETE |
| 6 | Site & Snags | 45 | COMPLETE |
| **Total** | **Full Graduate Assistant vertical slice** | **412** | **COMPLETE** |

## Post-Sprint — Platform Hardening

### Admin Backoffice (COMPLETE)
| Feature | Route/File | Status |
|---------|-----------|--------|
| Platform admin table | Supabase `platform_admins` table | Done |
| withSuperAdmin middleware | `src/lib/with-super-admin.ts` | Done |
| Admin API routes (orgs, users, invitations) | `src/app/api/admin/` (6 routes) | Done |
| Admin UI (org management, user management) | `src/app/admin/` (3 pages) | Done |
| Admin layout (sidebar, auth gate) | `src/app/admin/layout.tsx` | Done |

### Unified Settings Page (COMPLETE)
| Feature | Route/File | Status |
|---------|-----------|--------|
| Unified settings page (7 sections, left-rail nav) | `src/app/settings/page.tsx` | Done |
| Organisation Profile section (live data) | `/api/settings/organisation` (GET, PATCH) | Done |
| Team & Roles section (live data, role badges) | `/api/settings/team` (GET) | Done |
| Billing & Currency section | Settings page inline | Done |
| Integrations, AI Governance, Security, Notifications sections | Settings page inline | Done |
| Sidebar update (single Settings item) | `src/components/Sidebar.tsx` | Done |

### Role-Based Permission Matrix (COMPLETE)
| Feature | Route/File | Status |
|---------|-----------|--------|
| canPerform() permission matrix (45+ combos, 12 features) | `src/lib/role-permissions.ts` | Done |
| Practice-friendly role labels (5 roles) | `src/lib/role-permissions.ts` | Done |
| Consequence tiers for audit logging | `src/lib/role-permissions.ts` | Done |
| Permissions API endpoint | `src/app/api/settings/permissions/route.ts` | Done |
| canPerform wired into Organisation + Team APIs | `src/app/api/settings/organisation/route.ts`, `team/route.ts` | Done |
| Role labels rendered in Team UI | `src/app/settings/page.tsx` | Done |

**Permission matrix design (Purple Team):** Hard-coded per PT recommendation — no DB lookups, no custom permission builder. Five roles (OWNER/ADMIN/MANAGER/MEMBER/VIEWER), 12 feature areas, 45+ permission combinations. Financial data (fees/margins/invoices) restricted to ADMIN+OWNER. External-facing actions (issue docs, send invoices) OWNER-only for sending. AI respects role visibility. VIEWER = client portal only, not junior staff.

**Role labels:** OWNER→Practice Principal, ADMIN→Practice Manager, MANAGER→Project Lead, MEMBER→Team Member, VIEWER→External.

### Email Delivery for Invitations (COMPLETE)
| Feature | Route/File | Status |
|---------|-----------|--------|
| Resend email wrapper + HTML/text templates | `src/lib/email.ts` | Done |
| Email auto-sent on invitation creation | `src/app/api/invitations/route.ts` (updated) | Done |
| Resend invitation endpoint | `src/app/api/invitations/resend/route.ts` | Done |
| Invitation status auto-updated to SENT on delivery | Invitation route | Done |
| Email delivery result in API response + audit trail | Invitation route | Done |
| Vercel env vars (RESEND_API_KEY, RESEND_FROM_EMAIL, NEXT_PUBLIC_APP_URL) | Vercel dashboard | Done |

**Email template:** Branded HTML email with activation button, plain text fallback, expiry date. Non-blocking — invitation creation succeeds even if email fails (status stays PENDING vs SENT). Resend endpoint extends expired invitations automatically.

## Phase 7 — Bug Report 06 Build Plan

### Sprint 0: Permission Foundation (COMPLETE)
| Feature | File(s) | Status |
|---------|---------|--------|
| Add LEGAL, FINANCE, COMMERCIAL to OrgPermission enum | `prisma/schema.prisma` | Done |
| Extend canPerform() matrix for 3 new roles (4 features, 3 actions each) | `src/lib/role-permissions.ts` | Done |
| Lateral role isolation in hasOrgPermission() via TIER_MAP | `src/lib/role-permissions.ts` | Done |
| Update audit trail HR_VISIBLE_PREFIXES for new roles | `src/app/api/audit/route.ts` | Done |
| Permission matrix tests for all 9 roles × new features | `src/lib/__tests__/permissions.test.ts` | Done |
| Crispin QA review (3 issues fixed) | — | Done |

**Architecture:** 9 org roles total: OWNER (Tier 0), ADMIN (Tier 1), HR/LEGAL/FINANCE/COMMERCIAL (Tier 3 — lateral peers), MANAGER (Tier 4), MEMBER (Tier 5), VIEWER (Tier 6). Lateral roles cannot see each other's data. `hasOrgPermission()` uses `TIER_MAP` — lower tier number = more access, but lateral roles at same tier are isolated by `canPerform()` feature checks.

### Sprint 1: Task Workflow Complete (COMPLETE)
| Feature | File(s) | Status |
|---------|---------|--------|
| TaskDependency model + TaskDependencyType enum | `prisma/schema.prisma` | Done |
| Task fields: milestoneId, deliverable, sharepointUrl, archivedAt | `prisma/schema.prisma` | Done |
| ChecklistItem: assigneeId + dueDate | `prisma/schema.prisma` | Done |
| Task duplicate API (POST /tasks/[id]/duplicate) | `src/app/api/tasks/[id]/duplicate/route.ts` | Done |
| Task soft-delete archive (DELETE /tasks/[id]) | `src/app/api/tasks/[id]/route.ts` | Done |
| Task restore (POST /tasks/[id]/restore) | `src/app/api/tasks/[id]/restore/route.ts` | Done |
| Dependency CRUD (GET/POST/DELETE /tasks/[id]/dependencies) | `src/app/api/tasks/[id]/dependencies/route.ts` | Done |
| GET/PATCH extended for new fields + includes | `src/app/api/tasks/[id]/route.ts` | Done |
| Checklist assignee + dueDate support | `src/app/api/tasks/[id]/checklist/route.ts` | Done |
| Project tasks: archive filter, new field support | `src/app/api/projects/[id]/tasks/route.ts` | Done |
| Task detail UI: action menu, archived banner, dependencies sidebar | `src/app/tasks/[id]/page.tsx` | Done |
| Milestone, deliverable, SharePoint link display | `src/app/tasks/[id]/page.tsx` | Done |
| Checklist assignee names + due dates | `src/app/tasks/[id]/page.tsx` | Done |
| Cross-org boundary check on dependencies (M1) | `src/app/api/tasks/[id]/dependencies/route.ts` | Done |
| Permission guard on restore (M2) | `src/app/api/tasks/[id]/restore/route.ts` | Done |
| Safe JSON.parse for attachments (M3) | `src/app/tasks/[id]/page.tsx` | Done |
| Optimistic UI preserves dependencies/milestone (S8) | `src/app/tasks/[id]/page.tsx` | Done |
| Sprint 1 tests (35 tests) | `src/lib/__tests__/sprint1-task-workflow.test.ts` | Done |

**Schema:** TaskDependency model with unique constraint on (taskId, dependsOnId), cascade deletes. Task model extended with milestone relation, deliverable, sharepointUrl, archivedAt for soft-delete. ChecklistItem extended with assignee relation and dueDate.

**Security:** Dependencies endpoint validates target task belongs to same organisation (prevents cross-org data leak). Restore endpoint requires isOwner || isManager. Attachments JSON parsed safely with try/catch fallback.

**Verification:** 0 type errors. 1296 tests passing (35 new). Commit 6a6ab9e pushed.

### Sprint 2: Milestones & Project Edit (COMPLETE)
| Feature | File(s) | Status |
|---------|---------|--------|
| Milestone model + MilestoneStatus enum | `prisma/schema.prisma` | Done |
| Milestone API — calculated status from linked tasks | `src/app/api/projects/[id]/milestones/route.ts` | Done |
| Project edit form — all fields editable | `src/app/projects/[id]/page.tsx` | Done |
| Project enum fixes (stage, status, sector values) | `prisma/schema.prisma` | Done |
| Project SharePoint link support | `src/app/api/projects/[id]/route.ts` | Done |
| Document count fix (real count from DB) | `src/app/api/projects/[id]/route.ts` | Done |
| Milestone UI — progress bars, project milestone tab | `src/app/projects/[id]/page.tsx` | Done |
| Sprint 2 tests (21 tests) | `src/lib/__tests__/sprint2-milestone-status.test.ts` | Done |
| Crispin QA review + fixes | — | Done |

**Architecture:** Milestone status auto-calculated from linked tasks: NOT_STARTED (all tasks not started), IN_PROGRESS (any task started), AT_RISK (any task overdue), COMPLETED (all tasks done), OVERDUE (milestone past due with incomplete tasks). Project edit uses PATCH with field-level validation.

**Verification:** 0 type errors. 1317 tests passing (21 new). Commit f158e13 pushed.

### Sprint 3: Approval Workflow Engine (COMPLETE)
| Feature | File(s) | Status |
|---------|---------|--------|
| ApprovalRoute + ApprovalRouteStep + ApprovalInstance models | `prisma/schema.prisma` | Done |
| Approval engine core — route matching, step creation, advance/reject | `src/lib/approval-engine.ts` | Done |
| Approval API routes — CRUD + process approvals | `src/app/api/approvals/route.ts` | Done |
| Wire expenses + leave + service requests into engine | Multiple route files | Done |
| Approval email notifications + escalation timeout | `src/lib/approval-engine.ts` | Done |
| Admin UI for approval route configuration | `src/app/settings/page.tsx` | Done |
| Sprint 3 tests | `src/lib/__tests__/` | Done |
| Crispin QA review + fixes | — | Done |

**Architecture:** Configurable multi-step approval routes with sequential/parallel steps. Route matching by entity type + conditions (amount thresholds, department). Escalation timeout auto-advances stale approvals. Email notifications on each step transition.

**Verification:** 0 type errors. All tests passing. Commit a429422 pushed.

### Sprint 4: Leave & Calendar Enhancement (COMPLETE)
| Feature | File(s) | Status |
|---------|---------|--------|
| PublicHoliday model | `prisma/schema.prisma` | Done |
| Leave filter fields (department, office, manager, type, date range) | `src/app/api/leave/route.ts` | Done |
| Leave filters API — advanced querying | `src/app/api/leave/route.ts` | Done |
| Public holiday CRUD API + admin UI | `src/app/api/public-holidays/route.ts` | Done |
| Leave approval UI — approve/reject/request-info with comments | `src/app/leave/page.tsx` | Done |
| Team calendar — holidays, leave, travel, milestones | `src/app/leave/page.tsx` | Done |
| Sprint 4 tests | `src/lib/__tests__/` | Done |
| Crispin QA review + fixes | — | Done |

**Architecture:** Team calendar aggregates public holidays, approved leave, travel bookings, and project milestones into a unified monthly view. Leave approval supports three actions: approve, reject, request-info (sends back with comment). Public holidays are org-scoped with country/region support.

**Verification:** 0 type errors. All tests passing. Commit b172800 pushed.

### Sprint 5: Expenses & External Links (COMPLETE)
| Feature | File(s) | Status |
|---------|---------|--------|
| ExpenseClaim expansion — category, costCode, supplier, projectId | `prisma/schema.prisma` | Done |
| ExternalLink model — unified SharePoint/link layer | `prisma/schema.prisma` | Done |
| Expense API — new fields, filters, project linking | `src/app/api/expenses/route.ts` | Done |
| ExternalLink API — CRUD + unified SharePoint layer | `src/app/api/external-links/route.ts` | Done |
| Export utility — CSV generation with OWASP injection protection | `src/lib/export-utils.ts` | Done |
| Expense UI — project picker, cost code, supplier, category | `src/app/expenses/page.tsx` | Done |
| Sprint 5 tests (32 tests) | `src/lib/__tests__/sprint5-export-external.test.ts` | Done |
| Crispin QA review + fixes | — | Done |

**Architecture:** `generateCsv()` utility with `escapeCsvField()` (OWASP CSV injection protection against =, +, -, @, \t, \r prefixes) and `getNestedValue()` for nested object paths. Column registry pattern — each module registers its exportable columns in `EXPORT_COLUMNS` map. ExternalLink model supports SharePoint, OneDrive, Google Drive, and generic URLs with entity polymorphism (projectId, taskId, documentId).

**Verification:** 0 type errors. All tests passing. Commit a04bd7f pushed.

### Sprint 6: Timesheet Review & Settings (COMPLETE)
| Feature | File(s) | Status |
|---------|---------|--------|
| Timesheet Review — manager approval UI | `src/app/timesheets/review/page.tsx` | Done |
| Notification Preferences API + UI | `src/app/api/notification-preferences/route.ts` | Done |
| Settings persistence — Regional + Document Numbering | `src/app/api/settings/route.ts` | Done |
| Sprint 6 tests | `src/lib/__tests__/` | Done |
| Crispin QA review + fixes | — | Done |

**Architecture:** Timesheet review page with status filters (SUBMITTED, APPROVED, etc.), bulk approve/reject, and per-entry drill-down. Notification preferences stored per-profile with granular channel control (in-app, email) per event type. Regional settings (timezone, date format, currency) and document numbering templates (project, quote, drawing issue patterns) persisted at org level.

**Verification:** 0 type errors. All tests passing. Commit e45d15a pushed.

### Post-Sprint: CI Pipeline (COMPLETE)
| Feature | File(s) | Status |
|---------|---------|--------|
| GitHub Actions CI — test job | `.github/workflows/ci.yml` | Done |
| GitHub Actions CI — build verification job | `.github/workflows/ci.yml` | Done |
| Concurrency control (cancel in-flight on new push) | `.github/workflows/ci.yml` | Done |
| Lazy-init Resend client (fix CI build) | `src/lib/notifications.ts` | Done |

**Architecture:** Two-job pipeline: `test` (vitest run) and `build` (next build) with concurrency group per branch. Placeholder env vars for CI (NEXT_PUBLIC_SUPABASE_URL, etc.). Resend client lazy-initialized to avoid import-time crashes when RESEND_API_KEY is absent.

**Verification:** CI green on GitHub Actions. Commits b3260b3 + b7e5e5f pushed.

### Post-Sprint: Quote PDF & Email (COMPLETE)
| Feature | File(s) | Status |
|---------|---------|--------|
| Quote PDF generation (PDFKit, portrait A4) | `src/lib/quote-pdf.ts` | Done |
| Quote email sending API | `src/app/api/fee-quotes/[id]/send/route.ts` | Done |
| Download PDF + Send buttons in Quote UI | `src/app/fee-quotes/[id]/page.tsx` | Done |
| Quote PDF tests (12 tests) | `src/__tests__/quote-pdf.test.ts` | Done |
| Crispin QA review + fixes | — | Done |

**Architecture:** PDFKit portrait A4 with org header, accent line, client/project info, scope table (8 columns), terms/exclusions sections, totals box, page footers. Email via Resend with PDF attachment + HTML body. Send endpoint validates quote is in READY_TO_SEND/SENT status, updates status to SENT with sentAt timestamp.

**Verification:** 0 type errors. 1421 tests passing. Commit 254f52f pushed.

### Post-Sprint: Timesheet Exports (COMPLETE)
| Feature | File(s) | Status |
|---------|---------|--------|
| Timesheet PDF generation (PDFKit, landscape A4) | `src/lib/timesheet-pdf.ts` | Done |
| Timesheet export API — CSV + PDF with filters | `src/app/api/timesheets/export/route.ts` | Done |
| Entry-level CSV columns in export registry | `src/lib/export-utils.ts` | Done |
| Download buttons — My Timesheets + Manager view | `src/app/timesheets/page.tsx` | Done |
| Download buttons — Timesheet Review | `src/app/timesheets/review/page.tsx` | Done |
| Timesheet export tests (12 tests) | `src/__tests__/timesheet-pdf.test.ts` | Done |
| Crispin QA review + all 8 fixes applied | — | Done |

**Architecture:** Landscape A4 PDF with org header (queried from DB), employee info, week metadata row, 8-column entry table, totals row, page footers. Export API supports CSV (entries or summary detail level) and PDF formats with filters: date range, status, project, profile (manager view). Manager view requires ADMIN/OWNER/MANAGER permission. 500-week safety cap with truncation warning. OWASP CSV injection protection. Cache-Control: no-store on all responses.

**Verification:** 0 type errors. 1421 tests passing. Commit cd5cc57 pushed.

## Phase 7 Summary

| Sprint | Scope | New Tests | Commit |
|--------|-------|-----------|--------|
| 0 | Permission Foundation (9 roles, lateral isolation) | 198 | e4f4e00 |
| 1 | Task Workflow (duplicate, archive, dependencies) | 35 | 6a6ab9e |
| 2 | Milestones + Project Edit | 21 | f158e13 |
| 3 | Approval Workflow Engine | — | a429422 |
| 4 | Leave + Calendar + Public Holidays | — | b172800 |
| 5 | Expenses + External Links + Export Utility | 32 | a04bd7f |
| 6 | Timesheet Review + Settings Persistence | — | e45d15a |
| CI | GitHub Actions pipeline | — | b3260b3 |
| Quote | PDF generation + email sending | 12 | 254f52f |
| Timesheets | CSV + PDF export with manager filters | 12 | cd5cc57 |
| **Total** | **Phase 7 complete** | **1421** | **10 commits** |

### Post-Sprint: Beta Feedback UI Fixes (COMPLETE)
| Fix | Feature | File(s) | Status |
|-----|---------|---------|--------|
| 1 | LEGAL, FINANCE, COMMERCIAL in role dropdown + invitation form | `src/app/settings/page.tsx` | Done |
| 2 | Task detail — milestone selector, SharePoint URL inline edit, enhanced checklist | `src/app/tasks/[id]/page.tsx` | Done |
| 3 | Milestone editing via modal | `src/app/projects/[id]/page.tsx` | Done |
| 4 | Approval route inline editing | `src/app/settings/page.tsx` | Done |
| 5 | Leave admin — blackout dates CRUD + individual allowance editing | `src/app/leave/page.tsx`, `src/app/api/blackout-dates/` | Done |
| 6 | External links management UI (full CRUD) | `src/app/settings/page.tsx` | Done |
| 7 | Task list CSV export + timesheet review dept/employee filters | `src/app/projects/[id]/tasks/page.tsx`, `src/app/timesheets/review/page.tsx` | Done |
| 8 | Task numbering — server-computed stable {code}-{num} | `src/app/api/projects/[id]/tasks/route.ts`, `src/app/api/tasks/[id]/route.ts` | Done |

**Architecture:** 18 UI gaps identified from beta partner (Ayo) feedback — features were built API-first but missing UI controls. BlackoutDate model added to Prisma schema with API routes. Task numbering computed server-side from creation order within project (no schema migration needed). All fixes follow ship-vertically pattern: API + UI control + Crispin QA verification.

**Verification:** 0 type errors. 1421 tests passing. Schema pushed to Supabase. Commit a041769 pushed.

# Coordin.io — E2E Test Plan

**Version:** 1.0
**Date:** 25 August 2026
**Author:** Wale Koleosho
**Framework:** Playwright
**Coverage:** 136 API routes, 83 pages

---

## 1. Test Environment

| Item | Value |
|------|-------|
| Base URL | `http://localhost:3000` (dev) / `https://www.coordin.io` (prod) |
| Auth | Supabase Auth — test user seeded per org |
| Database | Supabase PostgreSQL (test org isolated) |
| Browser matrix | Chromium (primary), Firefox, WebKit |
| CI | GitHub Actions — runs on PR and push to main |

### Test Users

| Role | Email | Purpose |
|------|-------|---------|
| OWNER | `owner@test.coordin.io` | Full access — create projects, manage team, settings |
| ADMIN | `admin@test.coordin.io` | Admin operations — invitations, approvals |
| MANAGER | `manager@test.coordin.io` | Team management — timesheet review, leave approval |
| HR | `hr@test.coordin.io` | HR operations — staffing, onboarding |
| MEMBER | `member@test.coordin.io` | Standard user — tasks, timesheets, expenses |
| VIEWER | `viewer@test.coordin.io` | Read-only access |

---

## 2. Test Categories

### 2.1 Authentication & Onboarding (P0 — Critical)

| ID | Test Case | Steps | Expected |
|----|-----------|-------|----------|
| AUTH-01 | Login with valid credentials | Navigate `/login`, enter email/password, submit | Redirect to `/dashboard` |
| AUTH-02 | Login with invalid credentials | Enter wrong password | Error message, stay on `/login` |
| AUTH-03 | Forgot password flow | Navigate `/forgot-password`, enter email, submit | Success message, email sent |
| AUTH-04 | Password reset flow | Click reset link, enter new password | Password updated, redirect to `/login` |
| AUTH-05 | Signup flow | Navigate `/signup`, fill form, submit | Account created, redirect to onboarding |
| AUTH-06 | Session persistence | Login, close tab, reopen | Still authenticated |
| AUTH-07 | Logout | Click logout in sidebar | Redirect to `/login`, session cleared |
| AUTH-08 | Invitation activation | Navigate `/activate/[token]` with valid token | Account activated, redirect to onboarding |
| AUTH-09 | Expired invitation token | Navigate `/activate/[token]` with expired token | Error message displayed |
| AUTH-10 | Onboarding wizard completion | Complete all onboarding steps | Status updated, redirect to dashboard |

### 2.2 Dashboard & Navigation (P0 — Critical)

| ID | Test Case | Steps | Expected |
|----|-----------|-------|----------|
| NAV-01 | Dashboard loads with widgets | Login, navigate to `/dashboard` | 10 widgets render with data |
| NAV-02 | My Work page | Navigate to `/my-work` | Tasks, timesheets, approvals sections visible |
| NAV-03 | Sidebar navigation | Click each sidebar item | Correct page loads, active state updates |
| NAV-04 | Sidebar collapse/expand | Click collapse toggle | Sidebar collapses to icons, expands on click |
| NAV-05 | Global search | Press Cmd+K, type query | Search results appear, click navigates |
| NAV-06 | Notifications bell | Click notification bell | Notification dropdown with items |
| NAV-07 | Breadcrumb navigation | Navigate into project → task | Breadcrumbs show correct hierarchy |
| NAV-08 | Mobile responsive layout | Resize to 768px | Sidebar becomes hamburger menu |

### 2.3 Projects (P0 — Critical)

| ID | Test Case | Steps | Expected |
|----|-----------|-------|----------|
| PRJ-01 | Projects list loads | Navigate to `/projects` | Table/Kanban/Gantt views available |
| PRJ-02 | Create new project | Click "New Project", complete 9-step wizard | Project created, redirect to project dashboard |
| PRJ-03 | Project dashboard | Navigate to `/projects/[id]` | Overview with health, tasks, milestones |
| PRJ-04 | Edit project | Click edit, change fields, save | Fields updated, toast confirmation |
| PRJ-05 | Project tabs navigation | Click each project sub-tab | Correct sub-page loads |
| PRJ-06 | View switching (Table/Kanban/Gantt) | Toggle between views on projects list | View changes, data persists |
| PRJ-07 | Project filters | Apply status/stage/sector filters | List filters correctly |

### 2.4 Tasks (P0 — Critical)

| ID | Test Case | Steps | Expected |
|----|-----------|-------|----------|
| TSK-01 | Task list loads | Navigate to project tasks | Task list with filters |
| TSK-02 | Create task | Click "Add Task", fill form, submit | Task created, appears in list |
| TSK-03 | Task detail page | Click task row | Detail page with status, checklist, comments |
| TSK-04 | Status transitions | Change status via dropdown | Status updates, only valid transitions shown |
| TSK-05 | Assign task | Select owner/reviewer from dropdown | Assignment saved |
| TSK-06 | Checklist CRUD | Add/check/delete checklist items | Items persist correctly |
| TSK-07 | Duplicate task | Click duplicate in action menu | New task created with copied fields |
| TSK-08 | Archive/restore task | Archive task, filter to archived, restore | Task hidden/shown correctly |
| TSK-09 | Task dependencies | Add dependency, verify blocked status | Dependency displayed in sidebar |
| TSK-10 | Reviewer-only transitions | Login as non-reviewer, try COMPLETED | Transition not available |

### 2.5 Documents & File Upload (P1 — High)

| ID | Test Case | Steps | Expected |
|----|-----------|-------|----------|
| DOC-01 | Drawing register loads | Navigate to project documents | Document list with type filters |
| DOC-02 | Upload document | Click upload, select file, submit | File uploaded, revision created |
| DOC-03 | Document revision history | Click document, view revisions | Revision list with auto-numbering |
| DOC-04 | Submit document for review | Click "Submit for Review" | Status changes, reviewer notified |
| DOC-05 | Review document | Login as reviewer, approve/reject | Status updated, notification sent |
| DOC-06 | Multi-file upload | Upload 3 files at once | All files uploaded, progress shown |

### 2.6 Timesheets (P0 — Critical)

| ID | Test Case | Steps | Expected |
|----|-----------|-------|----------|
| TMS-01 | Weekly timesheet loads | Navigate to `/timesheets` | Current week with entry form |
| TMS-02 | Add timesheet entry | Fill project, stage, hours, submit | Entry saved, totals update |
| TMS-03 | Week navigation | Click previous/next week | Different week loads |
| TMS-04 | Submit timesheet | Click submit button | Status → SUBMITTED, locked for editing |
| TMS-05 | Manager review | Login as manager, navigate to `/timesheets/review` | Team timesheets listed |
| TMS-06 | Approve/reject timesheet | Click approve/reject on submitted week | Status updates, employee notified |
| TMS-07 | Export CSV (personal) | Click CSV download on My Timesheets | CSV file downloads |
| TMS-08 | Export PDF (personal) | Click PDF download on My Timesheets | PDF file downloads with correct layout |
| TMS-09 | Export CSV (manager) | Click CSV download on Manager view | CSV includes team data |
| TMS-10 | Export PDF (manager) | Click PDF download on Manager view | PDF with all team entries |

### 2.7 Fee Quotes (P0 — Critical)

| ID | Test Case | Steps | Expected |
|----|-----------|-------|----------|
| QTE-01 | Quote list loads | Navigate to `/fee-quotes` | Quotes listed with status badges |
| QTE-02 | Create quote | Click "New Quote", fill form, save | Quote created as DRAFT |
| QTE-03 | Quote detail page | Click quote row | Detail with line items, terms |
| QTE-04 | Edit quote | Modify line items, save | Changes persisted |
| QTE-05 | Download PDF | Click "Download PDF" | PDF downloads with correct formatting |
| QTE-06 | Send quote via email | Click "Send", confirm | Email sent, status → SENT |
| QTE-07 | Quote status transitions | Progress quote through statuses | Valid transitions only |

### 2.8 Leave & Expenses (P1 — High)

| ID | Test Case | Steps | Expected |
|----|-----------|-------|----------|
| LEV-01 | Submit leave request | Fill leave form, submit | Request created as SUBMITTED |
| LEV-02 | Leave balance display | View leave page | Remaining days shown correctly |
| LEV-03 | Approve leave | Login as approver, approve request | Status → APPROVED, balance deducted |
| LEV-04 | Team calendar | View team calendar | Shows holidays, leave, milestones |
| EXP-01 | Submit expense | Fill expense form with receipt, submit | Expense created |
| EXP-02 | Expense with project link | Select project, cost code, category | Fields saved correctly |
| EXP-03 | Approve expense | Login as approver, approve | Status → APPROVED |
| EXP-04 | Export expenses CSV | Click export | CSV downloads with all fields |

### 2.9 Staffing & HR (P1 — High)

| ID | Test Case | Steps | Expected |
|----|-----------|-------|----------|
| STF-01 | Staffing page loads | Navigate to `/staffing` | Team list with status badges |
| STF-02 | Employee drawer | Click employee row | Slide-out drawer with profile |
| STF-03 | HR-only fields visible to HR | Login as HR, view employee | Salary, documents visible |
| STF-04 | MEMBER restricted view | Login as MEMBER, view staffing | Only name, role, office, location |
| STF-05 | Invite team member | Go to Settings → Team, click Invite | Invitation sent, listed as pending |

### 2.10 Settings & Admin (P1 — High)

| ID | Test Case | Steps | Expected |
|----|-----------|-------|----------|
| SET-01 | Settings page loads | Navigate to `/settings` | Left-rail with all sections |
| SET-02 | Edit organisation profile | Change org name, save | Name updated across app |
| SET-03 | Role management | Change user role in Team & Roles | Permission change reflected |
| SET-04 | Notification preferences | Toggle email/in-app per event type | Preferences saved |
| SET-05 | Regional settings | Change timezone, currency, date format | Persisted to org settings |
| SET-06 | Audit trail | Navigate to Settings → Audit | Audit events listed with filters |
| SET-07 | Audit export CSV | Click export | CSV downloads |

### 2.11 Approvals (P1 — High)

| ID | Test Case | Steps | Expected |
|----|-----------|-------|----------|
| APR-01 | Approvals queue loads | Navigate to `/approvals` | Pending approvals listed |
| APR-02 | Approve item | Click approve on pending item | Status updated, next step triggered |
| APR-03 | Reject item | Click reject with comment | Status → REJECTED, requester notified |
| APR-04 | Multi-step approval | Submit item requiring 2 approvers | Steps advance sequentially |

### 2.12 Role-Based Access Control (P0 — Critical)

| ID | Test Case | Steps | Expected |
|----|-----------|-------|----------|
| RBAC-01 | VIEWER cannot create | Login as VIEWER, try creating task | Create button hidden or action blocked |
| RBAC-02 | MEMBER cannot access admin | Login as MEMBER, navigate to `/admin` | Redirect or access denied |
| RBAC-03 | MANAGER can review timesheets | Login as MANAGER, access review page | Page loads with team data |
| RBAC-04 | HR cannot see FINANCE data | Login as HR, check lateral isolation | Finance-scoped data not visible |
| RBAC-05 | Cross-org isolation | API call with wrong org ID | 404 or 403 returned |
| RBAC-06 | Unauthenticated API access | Call API without auth header | 401 returned |

### 2.13 Marketing & Public Pages (P2 — Medium)

| ID | Test Case | Steps | Expected |
|----|-----------|-------|----------|
| MKT-01 | Landing page loads | Navigate to `/` | Hero, features, CTA visible |
| MKT-02 | Demo access flow | Navigate to `/demo-access` | Timer starts, redirects to dashboard |
| MKT-03 | Demo signup form | Fill demo signup form, submit | Confirmation shown, emails sent |
| MKT-04 | FAQ accordion | Click FAQ items | Answers expand/collapse |
| MKT-05 | Feature pages | Navigate to `/features/brpd`, `/features/quotes` | Content renders |

### 2.14 API Health & Edge Cases (P1 — High)

| ID | Test Case | Steps | Expected |
|----|-----------|-------|----------|
| API-01 | Health endpoint | GET `/api/health` | 200 with DB status |
| API-02 | Rate limiting | Send 100+ requests in 1 minute | 429 after limit |
| API-03 | Invalid UUID in URL | GET `/api/projects/not-a-uuid` | 400 validation error |
| API-04 | Invalid date params | GET `/api/timesheets/export?dateFrom=invalid` | 400 validation error |
| API-05 | Empty state pages | View page with no data | Empty state illustration, not error |
| API-06 | Concurrent edits | Two users edit same task | Last write wins, no crash |

---

## 3. Test Data Strategy

### Seeding
- Use Prisma seed script to create test org with users, projects, tasks, timesheets, quotes
- Each test run starts with clean state via transaction rollback or fresh seed
- Test org ID isolated from production data

### Fixtures
- Reusable page objects for login, navigation, form filling
- Shared auth state via Playwright's `storageState` (login once, reuse)
- Factory functions for creating test entities via API

---

## 4. Priority Matrix

| Priority | Category | Test Count | Rationale |
|----------|----------|------------|-----------|
| P0 | Auth, Dashboard, Projects, Tasks, Timesheets, Quotes, RBAC | 51 | Core revenue flows |
| P1 | Documents, Leave/Expenses, Staffing, Settings, Approvals, API | 32 | Important operational flows |
| P2 | Marketing pages | 5 | Public-facing but not transactional |
| **Total** | | **88** | |

---

## 5. CI Integration

```yaml
# Runs after unit tests pass
e2e:
  needs: test
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
    - run: npm ci
    - run: npx playwright install --with-deps chromium
    - run: npm run build
    - run: npx playwright test
```

### Parallelism
- Playwright shards across 3 workers
- Each shard gets its own test user to avoid conflicts
- Retry failed tests once before marking as failed

---

## 6. Reporting

- HTML report generated per run (`playwright-report/`)
- Screenshots on failure (stored as artifacts)
- Trace files for debugging flaky tests
- Slack notification on CI failure (when Slack integration added)

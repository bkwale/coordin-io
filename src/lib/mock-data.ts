import { User, Project, Task, RIBAStage, ApprovalRequest, Issue, Change, RiskRegisterItem, Meeting, MeetingAction, DesignRisk, ContractAdminRecord, ContractEvent, PlanningRecord, SiteConstraint, TenderRecord, TenderReturn, TenderEvaluation, SiteQuery, BuildingRegRecord, BuildingInspection, DutyholderRecord, BRPDGateway, DocumentRecord, DocumentTransmittal, KnowledgeArticle, CPDRecord, Competency, UserCompetency, TrainingPlan, JurisdictionPack, OrganisationSettings, AISourcePermission, AILog, DrawingIssueRecord, ProjectCommercial, CashflowForecast, StaffAllocation, StaffCapacity, FeeRecommendation, FeeQuoteRecord, FeeQuoteLineItem, Opportunity, AISuggestedPrompt, AIConversation, AIMessage, AISource, Integration, PortalInvite, PortalSharedItem, FeeQuoteSection, FeeQuoteView, FeeQuoteTemplate, TermsLibraryItem, ExclusionsLibraryItem, ProjectHealthSnapshot, TaskScheduleMetric, ProjectNumberTemplate, QuoteNumberTemplate, DrawingIssueTemplate, ProjectHealthAlert, BurnBudgetMetric, QuoteProjectLink, QuoteConversionMetric, ComplianceStatement, BRPDRequirement, BRPDChangelogEntry, DrawingIssueWorkflow, DrawingEmail, WizardStep, BriefSection, ProjectBrief, QuoteAccountingLink, RoleVisibilityRule, LeaveRecord, BankHoliday, LeaveEntitlement, TimesheetEntry, TimesheetWeekSummary, Invoice, InvoiceLineItem, OverheadEntry, OverheadSummary, OverheadCategory, NewsItem, DashboardKPIs, ProjectUpdate } from './types'
import { STAGE_TEMPLATES } from './stage-templates'

// ── Demo Users ──────────────────────────────────────────────

export const USERS: User[] = [
  { id: 'u1', name: 'Sarah Mitchell', email: 'sarah@studiomitchell.co.uk', role: 'practice_owner', created_at: '2024-01-01', updated_at: '2024-01-01' },
  { id: 'u2', name: 'James Chen', email: 'james@studiomitchell.co.uk', role: 'project_lead', created_at: '2024-01-01', updated_at: '2024-01-01' },
  { id: 'u3', name: 'Priya Sharma', email: 'priya@studiomitchell.co.uk', role: 'project_lead', created_at: '2024-02-15', updated_at: '2024-02-15' },
  { id: 'u4', name: 'Tom Davies', email: 'tom@studiomitchell.co.uk', role: 'team_member', created_at: '2024-03-01', updated_at: '2024-03-01' },
  { id: 'u5', name: 'Amara Okafor', email: 'amara@studiomitchell.co.uk', role: 'team_member', created_at: '2024-04-01', updated_at: '2024-04-01' },
]

// ── Helper to generate tasks from templates ─────────────────

let taskIdCounter = 0
function generateTasksForProject(
  projectId: string,
  currentStage: RIBAStage,
  overrides?: Partial<Record<string, Partial<Task>>>
): Task[] {
  const tasks: Task[] = []
  const now = new Date()

  for (let stage = 0 as RIBAStage; stage <= currentStage; stage++) {
    const templates = STAGE_TEMPLATES.filter(t => t.stage === stage)
    templates.forEach(template => {
      taskIdCounter++
      const id = `t${taskIdCounter}`
      const isPastStage = stage < currentStage
      const baseTask: Task = {
        id,
        project_id: projectId,
        title: template.task_title,
        description: template.task_description,
        stage: template.stage,
        status: isPastStage ? 'done' : 'not_started',
        owner_user_id: undefined,
        due_date: undefined,
        required_flag: template.required_flag,
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
      }
      const override = overrides?.[id] || overrides?.[template.task_title]
      tasks.push({ ...baseTask, ...override })
    })
  }
  return tasks
}

// ── Demo Projects ───────────────────────────────────────────

export const PROJECTS: Project[] = [
  {
    id: 'p1',
    name: 'Riverside House Extension',
    client: 'Harris Family Trust',
    description: 'Two-storey rear extension and loft conversion to Grade II listed property.',
    start_date: '2025-09-01',
    target_completion_date: '2026-06-30',
    current_stage: 3,
    status: 'active',
    project_lead_user_id: 'u2',
    created_by_user_id: 'u1',
    created_at: '2025-09-01',
    updated_at: '2026-03-18',
    last_activity_at: '2026-03-18',
  },
  {
    id: 'p2',
    name: 'Clapham Mixed-Use Block',
    client: 'Meridian Developments',
    description: 'New-build 12-unit residential with ground floor commercial. Pre-app in progress.',
    start_date: '2025-11-15',
    target_completion_date: '2027-03-01',
    current_stage: 2,
    status: 'active',
    project_lead_user_id: 'u3',
    created_by_user_id: 'u1',
    created_at: '2025-11-15',
    updated_at: '2026-03-15',
    last_activity_at: '2026-03-15',
  },
  {
    id: 'p3',
    name: 'Weybridge School Refurb',
    client: 'Surrey County Council',
    description: 'Internal refurbishment of existing primary school. Phased summer works.',
    start_date: '2025-06-01',
    target_completion_date: '2026-04-15',
    current_stage: 4,
    status: 'active',
    project_lead_user_id: 'u2',
    created_by_user_id: 'u1',
    created_at: '2025-06-01',
    updated_at: '2026-03-10',
    last_activity_at: '2026-03-10',
  },
  {
    id: 'p4',
    name: 'Southwark Community Hub',
    client: 'LB Southwark',
    description: 'Community centre with flexible workspace and youth facilities.',
    start_date: '2026-01-10',
    target_completion_date: '2027-09-01',
    current_stage: 1,
    status: 'active',
    project_lead_user_id: 'u3',
    created_by_user_id: 'u1',
    created_at: '2026-01-10',
    updated_at: '2026-03-01',
    last_activity_at: '2026-03-01',
  },
  {
    id: 'p5',
    name: 'Dulwich Garden Studio',
    client: 'Patterson Residence',
    description: 'Detached garden office / studio with green roof.',
    start_date: '2025-10-01',
    target_completion_date: '2026-05-01',
    current_stage: 5,
    status: 'active',
    project_lead_user_id: 'u2',
    created_by_user_id: 'u1',
    created_at: '2025-10-01',
    updated_at: '2026-03-19',
    last_activity_at: '2026-03-19',
  },
  {
    id: 'p6',
    name: 'Brixton Workspace Conversion',
    client: 'Acre Lane Partners',
    description: 'Light industrial to co-working conversion. Planning granted.',
    start_date: '2025-04-01',
    target_completion_date: '2026-01-15',
    current_stage: 2,
    status: 'paused',
    project_lead_user_id: undefined,
    created_by_user_id: 'u1',
    created_at: '2025-04-01',
    updated_at: '2025-12-10',
    last_activity_at: '2025-12-10',
  },
]

// ── Generate all tasks with realistic overrides ─────────────

const d = (days: number) => {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return date.toISOString().split('T')[0]
}

// Project 1: Stage 3, mostly healthy but some overdue
const p1Tasks = generateTasksForProject('p1', 3, {
  'Develop coordinated design': { status: 'in_progress', owner_user_id: 'u2', due_date: d(14) },
  'Review planning submission package': { status: 'in_progress', owner_user_id: 'u4', due_date: d(-3) }, // overdue!
  'Confirm key spatial decisions': { status: 'not_started', owner_user_id: 'u2', due_date: d(21) },
  'Cost plan review': { status: 'not_started', due_date: d(28) },
})

// Project 2: Stage 2, concept sign-off overdue
const p2Tasks = generateTasksForProject('p2', 2, {
  'Develop concept proposals': { status: 'done', owner_user_id: 'u3' },
  'Review planning strategy': { status: 'in_progress', owner_user_id: 'u3', due_date: d(7) },
  'Coordinate initial consultant input': { status: 'not_started', owner_user_id: 'u5', due_date: d(14) },
  'Prepare outline specification': { status: 'not_started', due_date: d(21) },
  'Client concept sign-off': { status: 'not_started', owner_user_id: 'u3', due_date: d(-5) }, // overdue required!
})

// Project 3: Stage 4, behind schedule
const p3Tasks = generateTasksForProject('p3', 4, {
  'Complete technical design information': { status: 'in_progress', owner_user_id: 'u2', due_date: d(-10) }, // very overdue
  'Coordinate consultant technical input': { status: 'not_started', owner_user_id: undefined, due_date: d(-2) }, // overdue + no owner
  'Review issue package': { status: 'not_started', due_date: d(7) },
  'Prepare construction issue drawings': { status: 'not_started', due_date: d(14) },
  'Building control submission': { status: 'not_started', due_date: d(21) },
})

// Project 4: Stage 1, healthy and early
const p4Tasks = generateTasksForProject('p4', 1, {
  'Prepare project brief': { status: 'in_progress', owner_user_id: 'u3', due_date: d(10) },
  'Confirm site information': { status: 'done', owner_user_id: 'u5' },
  'Define project programme': { status: 'not_started', owner_user_id: 'u3', due_date: d(21) },
  'Appoint consultant team': { status: 'not_started', due_date: d(30) },
  'Prepare feasibility studies': { status: 'not_started', due_date: d(28) },
})

// Project 5: Stage 5, on site and progressing
const p5Tasks = generateTasksForProject('p5', 5, {
  'Record construction queries': { status: 'in_progress', owner_user_id: 'u2', due_date: d(7) },
  'Monitor site information flow': { status: 'in_progress', owner_user_id: 'u4', due_date: d(14) },
  'Review progress against design intent': { status: 'not_started', owner_user_id: 'u2', due_date: d(21) },
  'Review material submissions': { status: 'not_started', due_date: d(28) },
})

// Project 6: Paused, stale, stage 2 incomplete
const p6Tasks = generateTasksForProject('p6', 2, {
  'Develop concept proposals': { status: 'in_progress', owner_user_id: undefined, due_date: d(-45) }, // very overdue, no owner
  'Review planning strategy': { status: 'not_started', due_date: d(-30) },
  'Client concept sign-off': { status: 'not_started', due_date: d(-20) },
})

export const ALL_TASKS: Task[] = [
  ...p1Tasks,
  ...p2Tasks,
  ...p3Tasks,
  ...p4Tasks,
  ...p5Tasks,
  ...p6Tasks,
]

// ── Phase 2: Approvals ──────────────────────────────────────

export const APPROVALS: ApprovalRequest[] = [
  {
    id: 'apr1', project_id: 'p1', item_type: 'task', item_id: 't5',
    item_title: 'Review planning submission package',
    submitted_by_user_id: 'u4', reviewer_user_id: 'u1',
    status: 'pending', submitted_at: d(-2),
    created_at: d(-2), updated_at: d(-2),
  },
  {
    id: 'apr2', project_id: 'p2', item_type: 'document', item_id: 'doc1',
    item_title: 'Concept Design Report v2',
    submitted_by_user_id: 'u3', reviewer_user_id: 'u1',
    status: 'pending', submitted_at: d(-5),
    created_at: d(-5), updated_at: d(-5),
  },
  {
    id: 'apr3', project_id: 'p3', item_type: 'task', item_id: 't15',
    item_title: 'Complete technical design information',
    submitted_by_user_id: 'u2', reviewer_user_id: 'u1',
    status: 'returned', submitted_at: d(-10), reviewed_at: d(-7),
    reviewer_comments: 'Missing structural coordination details. Please update sections 3.2 and 4.1.',
    created_at: d(-10), updated_at: d(-7),
  },
  {
    id: 'apr4', project_id: 'p5', item_type: 'document', item_id: 'doc2',
    item_title: 'Green Roof Specification',
    submitted_by_user_id: 'u2', reviewer_user_id: 'u1',
    status: 'approved', submitted_at: d(-14), reviewed_at: d(-12),
    created_at: d(-14), updated_at: d(-12),
  },
  {
    id: 'apr5', project_id: 'p4', item_type: 'task', item_id: 't20',
    item_title: 'Prepare project brief',
    submitted_by_user_id: 'u3', reviewer_user_id: 'u1',
    status: 'pending', submitted_at: d(-1),
    created_at: d(-1), updated_at: d(-1),
  },
  {
    id: 'apr6', project_id: 'p1', item_type: 'document', item_id: 'doc3',
    item_title: 'Heritage Impact Assessment',
    submitted_by_user_id: 'u2', reviewer_user_id: 'u1',
    status: 'approved', submitted_at: d(-20), reviewed_at: d(-18),
    created_at: d(-20), updated_at: d(-18),
  },
]

// ── Phase 2: Issues ─────────────────────────────────────────

export const ISSUES: Issue[] = [
  {
    id: 'iss1', project_id: 'p1', issue_type: 'Design Coordination',
    title: 'Structural beam clashes with existing window opening',
    description: 'Steel beam at first floor level conflicts with listed window that must be retained.',
    owner_user_id: 'u2', status: 'open', raised_date: d(-5),
  },
  {
    id: 'iss2', project_id: 'p1', issue_type: 'Planning',
    title: 'Conservation officer queries on rear elevation material',
    description: 'LPA conservation officer has raised concerns about proposed zinc cladding.',
    owner_user_id: 'u2', status: 'in_progress', raised_date: d(-12),
  },
  {
    id: 'iss3', project_id: 'p3', issue_type: 'Site',
    title: 'Asbestos found in ceiling void above reception',
    description: 'Survey revealed asbestos-containing materials not on original report.',
    owner_user_id: 'u2', status: 'open', raised_date: d(-3),
  },
  {
    id: 'iss4', project_id: 'p5', issue_type: 'Construction',
    title: 'Foundation depth exceeded specification',
    description: 'Ground conditions required deeper foundations than designed. 300mm additional excavation.',
    owner_user_id: 'u4', status: 'resolved', raised_date: d(-20), resolved_date: d(-8),
  },
  {
    id: 'iss5', project_id: 'p2', issue_type: 'Client',
    title: 'Client wants additional retail unit in ground floor layout',
    description: 'Meridian has asked whether the commercial ground floor can be subdivided into 2 units.',
    owner_user_id: 'u3', status: 'open', raised_date: d(-7),
  },
  {
    id: 'iss6', project_id: 'p3', issue_type: 'Programme',
    title: 'Summer works window at risk due to delayed approvals',
    description: 'Building control submission delay may push main works past school holiday window.',
    owner_user_id: 'u2', status: 'in_progress', raised_date: d(-15),
  },
]

// ── Phase 2: Changes ────────────────────────────────────────

export const CHANGES: Change[] = [
  {
    id: 'chg1', project_id: 'p1', change_type: 'Design',
    title: 'Switch from zinc to lead cladding on rear elevation',
    description: 'Conservation officer preference. Lead more appropriate for Grade II context.',
    initiated_by_user_id: 'u2', date_raised: d(-10),
    commercial_effect_note: 'Additional £3,200 material cost. Lead more labour-intensive to install.',
    programme_effect_note: 'No programme impact — specialist subcontractor available.',
    approval_status: 'approved',
  },
  {
    id: 'chg2', project_id: 'p3', change_type: 'Scope',
    title: 'Add acoustic treatment to hall ceiling',
    description: 'Surrey CC request for improved acoustics in main hall. Not in original brief.',
    initiated_by_user_id: 'u2', date_raised: d(-8),
    commercial_effect_note: 'Approx £8,500 additional. Provisional sum to be agreed.',
    programme_effect_note: '1 week additional in hall fit-out phase.',
    approval_status: 'under_review',
  },
  {
    id: 'chg3', project_id: 'p5', change_type: 'Design',
    title: 'Increase roof insulation to 0.11 U-value',
    description: 'Client wants improved thermal performance beyond Building Regs minimum.',
    initiated_by_user_id: 'u4', date_raised: d(-18),
    commercial_effect_note: '£1,800 uplift in insulation specification.',
    programme_effect_note: 'None — same installation method.',
    approval_status: 'approved',
  },
  {
    id: 'chg4', project_id: 'p2', change_type: 'Client Brief',
    title: 'Subdivide ground floor commercial into two units',
    description: 'Client requests two smaller retail units instead of one large commercial space.',
    initiated_by_user_id: 'u3', date_raised: d(-4),
    commercial_effect_note: 'Additional partition, M&E separation. Estimate £15,000-20,000.',
    programme_effect_note: 'May require revised planning application — 8-12 week delay risk.',
    approval_status: 'raised',
  },
]

// ── Phase 2: Risk Register ──────────────────────────────────

export const RISK_REGISTER: RiskRegisterItem[] = [
  {
    id: 'rr1', project_id: 'p1', risk_type: 'Planning',
    title: 'Listed building consent refusal',
    description: 'Conservation officer may not support proposed contemporary rear extension.',
    probability: 'medium', impact: 'high', owner_user_id: 'u2',
    mitigation: 'Pre-app dialogue ongoing. Material change to lead cladding addresses key concern.',
    status: 'open',
  },
  {
    id: 'rr2', project_id: 'p3', risk_type: 'Programme',
    title: 'School holiday works window missed',
    description: 'Main hall works must complete during summer break. Delay to BC submission threatens this.',
    probability: 'high', impact: 'high', owner_user_id: 'u2',
    mitigation: 'Escalate BC submission. Prepare phasing plan B for term-time works if needed.',
    status: 'open',
  },
  {
    id: 'rr3', project_id: 'p2', risk_type: 'Commercial',
    title: 'Ground floor subdivision triggers new planning application',
    description: 'Change to two retail units may constitute material amendment to planning consent.',
    probability: 'high', impact: 'medium', owner_user_id: 'u3',
    mitigation: 'Seek pre-application advice from LPA before committing to design change.',
    status: 'open',
  },
  {
    id: 'rr4', project_id: 'p5', risk_type: 'Site',
    title: 'Ground conditions worse than survey predicted',
    description: 'Initial foundation excavation showed softer ground at formation level.',
    probability: 'low', impact: 'medium', owner_user_id: 'u4',
    mitigation: 'Deeper foundations already installed. Monitoring settlement.',
    status: 'mitigated',
  },
  {
    id: 'rr5', project_id: 'p4', risk_type: 'Budget',
    title: 'Community consultation delays briefing stage',
    description: 'Southwark community engagement process may extend Stage 1 timeline.',
    probability: 'medium', impact: 'low', owner_user_id: 'u3',
    mitigation: 'Build 4-week buffer into programme for consultation period.',
    status: 'open',
  },
]

// ── Phase 2: Meetings ───────────────────────────────────────

export const MEETINGS: Meeting[] = [
  {
    id: 'm1', project_id: 'p1', meeting_type: 'design_team',
    title: 'Design Team Meeting #14',
    meeting_date: d(-3), location: 'Studio Mitchell Office',
    organiser_user_id: 'u2',
    notes: 'Reviewed coordinated layout. Agreed to progress MEP coordination next week.',
  },
  {
    id: 'm2', project_id: 'p1', meeting_type: 'client_review',
    title: 'Client Review — Stage 3 Progress',
    meeting_date: d(-10), location: 'Client Residence',
    organiser_user_id: 'u2',
    notes: 'Client happy with layout progression. Concerned about rear elevation materials.',
  },
  {
    id: 'm3', project_id: 'p3', meeting_type: 'site_meeting',
    title: 'Site Visit — Asbestos Assessment',
    meeting_date: d(-2), location: 'Weybridge Primary School',
    organiser_user_id: 'u2',
    notes: 'Specialist surveyor confirmed ACMs in ceiling void. R&D survey booked.',
  },
  {
    id: 'm4', project_id: 'p2', meeting_type: 'client_review',
    title: 'Client Briefing — Concept Options',
    meeting_date: d(-7), location: 'Meridian Developments Office',
    organiser_user_id: 'u3',
    notes: 'Presented 3 massing options. Client prefers Option B with ground floor subdivision.',
  },
  {
    id: 'm5', project_id: 'p5', meeting_type: 'contractor',
    title: 'Contractor Progress Meeting #8',
    meeting_date: d(-1), location: 'Dulwich Site',
    organiser_user_id: 'u2',
    notes: 'Green roof substrate delivery confirmed for next Thursday. Glazing on programme.',
  },
  {
    id: 'm6', project_id: 'p4', meeting_type: 'consultant',
    title: 'Consultant Kick-off Meeting',
    meeting_date: d(-14), location: 'Teams Call',
    organiser_user_id: 'u3',
    notes: 'Structural and M&E consultants appointed. Agreed scope and fee basis.',
  },
  {
    id: 'm7', project_id: 'p3', meeting_type: 'design_team',
    title: 'Design Team Meeting #22',
    meeting_date: d(2), location: 'Studio Mitchell Office',
    organiser_user_id: 'u2',
    notes: '',
  },
]

// ── Phase 2: Meeting Actions ────────────────────────────────

export const MEETING_ACTIONS: MeetingAction[] = [
  { id: 'ma1', meeting_id: 'm1', action_description: 'Issue updated coordinated layout to structural engineer', assigned_to_user_id: 'u2', due_date: d(2), status: 'open' },
  { id: 'ma2', meeting_id: 'm1', action_description: 'Confirm M&E consultant availability for coordination workshop', assigned_to_user_id: 'u4', due_date: d(5), status: 'open' },
  { id: 'ma3', meeting_id: 'm2', action_description: 'Prepare rear elevation material samples for client review', assigned_to_user_id: 'u2', due_date: d(-3), status: 'overdue' },
  { id: 'ma4', meeting_id: 'm3', action_description: 'Obtain asbestos R&D survey quote', assigned_to_user_id: 'u2', due_date: d(3), status: 'open' },
  { id: 'ma5', meeting_id: 'm3', action_description: 'Notify Surrey CC of asbestos discovery', assigned_to_user_id: 'u2', due_date: d(0), status: 'done' },
  { id: 'ma6', meeting_id: 'm4', action_description: 'Develop Option B with subdivided ground floor', assigned_to_user_id: 'u3', due_date: d(10), status: 'open' },
  { id: 'ma7', meeting_id: 'm4', action_description: 'Check planning implications of unit subdivision', assigned_to_user_id: 'u5', due_date: d(5), status: 'open' },
  { id: 'ma8', meeting_id: 'm5', action_description: 'Confirm green roof membrane spec with supplier', assigned_to_user_id: 'u4', due_date: d(4), status: 'open' },
  { id: 'ma9', meeting_id: 'm6', action_description: 'Share site survey data pack with consultants', assigned_to_user_id: 'u3', due_date: d(-7), status: 'done' },
  { id: 'ma10', meeting_id: 'm6', action_description: 'Agree consultant fee proposals', assigned_to_user_id: 'u1', due_date: d(-3), status: 'overdue' },
]

// ── Phase 2 Wave 2: Design Risks ────────────────────────────

export const DESIGN_RISKS: DesignRisk[] = [
  {
    id: 'dr1', project_id: 'p1', stage_code: 3,
    title: 'Structural intervention at party wall',
    description: 'New steel frame bears onto existing party wall. Risk of differential movement and cracking to neighbour property.',
    unusual_or_significant_flag: true,
    mitigation: 'Independent structural survey of party wall. Movement joints at interface. Party wall agreement in place.',
    residual_risk_note: 'Monitor during construction. Pre-condition survey completed.',
    owner_user_id: 'u2', review_status: 'under_review',
    created_at: d(-15), updated_at: d(-3),
  },
  {
    id: 'dr2', project_id: 'p1', stage_code: 3,
    title: 'Flat roof drainage falls insufficient',
    description: 'Existing structure limits achievable falls on new flat roof extension. Risk of ponding.',
    unusual_or_significant_flag: false,
    mitigation: 'Tapered insulation to achieve 1:60 minimum falls. Secondary outlet specified.',
    owner_user_id: 'u4', review_status: 'accepted',
    created_at: d(-20), updated_at: d(-10),
  },
  {
    id: 'dr3', project_id: 'p3', stage_code: 4,
    title: 'Acoustic separation between classrooms below spec',
    description: 'Existing block walls may not achieve BB93 requirements after refurbishment.',
    unusual_or_significant_flag: true,
    mitigation: 'Acoustic testing before works. IWL system to be specified if needed.',
    owner_user_id: 'u2', review_status: 'open',
    created_at: d(-8), updated_at: d(-2),
  },
  {
    id: 'dr4', project_id: 'p2', stage_code: 2,
    title: 'Daylight to rear habitable rooms',
    description: 'Massing Option B reduces daylight factor to rear bedrooms below BRE minimum.',
    unusual_or_significant_flag: false,
    mitigation: 'Daylight study commissioned. May require layout adjustment or larger window openings.',
    owner_user_id: 'u3', review_status: 'open',
    created_at: d(-6), updated_at: d(-4),
  },
  {
    id: 'dr5', project_id: 'p5', stage_code: 5,
    title: 'Green roof waterproofing warranty gap',
    description: 'Main roof and green roof supplier warranties do not overlap. 10-year gap in cover.',
    unusual_or_significant_flag: true,
    mitigation: 'Negotiate combined warranty. Alternatively, require collateral warranty from green roof installer.',
    residual_risk_note: 'Client accepts risk if combined warranty not achievable.',
    owner_user_id: 'u2', review_status: 'under_review',
    created_at: d(-12), updated_at: d(-1),
  },
]

// ── Phase 2 Wave 2: Contract Administration ─────────────────

export const CONTRACT_ADMIN_RECORDS: ContractAdminRecord[] = [
  {
    id: 'ca1', project_id: 'p3',
    procurement_route: 'traditional', contract_form: 'JCT_MW',
    administrator_role: 'Contract Administrator — Studio Mitchell Architects',
    key_dates_json: JSON.stringify({ possession: d(-30), practical_completion: d(45), defects_end: d(410) }),
    notes: 'Minor works contract. Single-stage tender completed.',
  },
  {
    id: 'ca2', project_id: 'p5',
    procurement_route: 'design_and_build', contract_form: 'JCT_DB',
    administrator_role: 'Employer Agent — Studio Mitchell Architects',
    key_dates_json: JSON.stringify({ possession: d(-60), practical_completion: d(30), defects_end: d(395) }),
    notes: 'D&B contract with employer requirements. Novated design team.',
  },
]

export const CONTRACT_EVENTS: ContractEvent[] = [
  {
    id: 'ce1', project_id: 'p3', event_type: 'Architect Instruction',
    event_ref: 'AI-001', title: 'Asbestos removal — revised specification',
    description: 'Instruction to contractor to proceed with licensed asbestos removal in ceiling void.',
    issue_date: d(-2), response_due_date: d(5),
    status: 'issued', created_by_user_id: 'u2',
    created_at: d(-2), updated_at: d(-2),
  },
  {
    id: 'ce2', project_id: 'p3', event_type: 'Extension of Time',
    event_ref: 'EOT-001', title: 'EOT claim — asbestos discovery delay',
    description: 'Contractor claims 2-week extension due to unforeseen asbestos.',
    issue_date: d(-1), response_due_date: d(12),
    status: 'issued', created_by_user_id: 'u2',
    created_at: d(-1), updated_at: d(-1),
  },
  {
    id: 'ce3', project_id: 'p5', event_type: 'Architect Instruction',
    event_ref: 'AI-003', title: 'Increase roof insulation specification',
    description: 'Revised insulation build-up to achieve 0.11 U-value as per client instruction.',
    issue_date: d(-14), response_due_date: d(-7),
    status: 'responded', created_by_user_id: 'u2',
    created_at: d(-14), updated_at: d(-6),
  },
  {
    id: 'ce4', project_id: 'p5', event_type: 'Interim Valuation',
    event_ref: 'IV-004', title: 'Interim Valuation #4',
    description: 'Monthly valuation for payment certification.',
    issue_date: d(-5), response_due_date: d(-1),
    status: 'overdue', created_by_user_id: 'u2',
    created_at: d(-5), updated_at: d(-5),
  },
  {
    id: 'ce5', project_id: 'p3', event_type: 'Architect Instruction',
    event_ref: 'AI-002', title: 'Acoustic ceiling treatment to main hall',
    description: 'Instruction to include acoustic treatment per change request.',
    issue_date: d(-4), response_due_date: d(10),
    status: 'draft', created_by_user_id: 'u2',
    created_at: d(-4), updated_at: d(-4),
  },
]

// ── Phase 2 Wave 2: Planning Records ────────────────────────

export const PLANNING_RECORDS: PlanningRecord[] = [
  {
    id: 'pl1', project_id: 'p1', record_type: 'Full Planning Application',
    reference: '2025/LB/0342', title: 'Two-storey rear extension and loft conversion',
    description: 'Full planning application including heritage statement.',
    date_submitted: '2025-11-15', date_determined: '2026-02-20',
    status: 'Approved with conditions',
    notes: 'Condition 3 requires materials sample panel before commencement.',
  },
  {
    id: 'pl2', project_id: 'p1', record_type: 'Listed Building Consent',
    reference: '2025/LB/0343', title: 'Internal and external alterations to Grade II listed dwelling',
    description: 'LBC application for structural alterations and new openings.',
    date_submitted: '2025-11-15',
    status: 'Pending determination',
    notes: 'Conservation officer site visit scheduled.',
  },
  {
    id: 'pl3', project_id: 'p2', record_type: 'Pre-application',
    reference: 'PRE/2025/0089', title: 'Pre-app for 12-unit mixed-use development',
    description: 'Pre-application meeting with LPA planning officer.',
    date_submitted: '2025-12-01', date_determined: '2026-01-15',
    status: 'Feedback received',
    notes: 'Positive on principle. Height concerns on south elevation.',
  },
  {
    id: 'pl4', project_id: 'p4', record_type: 'Pre-application',
    reference: 'PRE/2026/0015', title: 'Community hub feasibility discussion',
    description: 'Initial planning guidance meeting with Southwark planning team.',
    date_submitted: '2026-02-10',
    status: 'Meeting scheduled',
  },
]

export const SITE_CONSTRAINTS: SiteConstraint[] = [
  {
    id: 'sc1', project_id: 'p1', constraint_type: 'Listed Building',
    title: 'Grade II Listed — Harris House',
    description: 'Property is Grade II listed. All external and structural changes require LBC.',
    severity: 'high',
    mitigation: 'LBC application submitted alongside planning. Heritage consultant engaged.',
  },
  {
    id: 'sc2', project_id: 'p1', constraint_type: 'Conservation Area',
    title: 'Riverside Conservation Area',
    description: 'Site within designated conservation area. Enhanced design scrutiny applies.',
    severity: 'medium',
    mitigation: 'Design approach follows conservation area guidance. Materials palette agreed with CO.',
  },
  {
    id: 'sc3', project_id: 'p3', constraint_type: 'Access',
    title: 'School operational during partial works',
    description: 'School remains operational during Phase 1 works. Strict safeguarding requirements.',
    severity: 'high',
    mitigation: 'Hoarding and segregated access routes. DBS checks for all site operatives.',
  },
  {
    id: 'sc4', project_id: 'p2', constraint_type: 'Flood Risk',
    title: 'Flood Zone 2 — partial site coverage',
    description: 'Rear portion of site within Environment Agency Flood Zone 2.',
    severity: 'medium',
    mitigation: 'FRA completed. Finished floor levels raised 300mm above predicted flood level.',
  },
  {
    id: 'sc5', project_id: 'p5', constraint_type: 'Trees',
    title: 'Protected oak tree (TPO)',
    description: 'Mature oak on south boundary covered by TPO. Root protection area extends into build zone.',
    severity: 'medium',
    mitigation: 'Foundation design uses mini-piles to avoid root zone. Arboricultural method statement approved.',
  },
]

// ── Phase 2 Wave 2: Tenders ─────────────────────────────────

export const TENDER_RECORDS: TenderRecord[] = [
  {
    id: 'tr1', project_id: 'p3',
    tender_name: 'Main Works Contract — Weybridge School Refurb',
    procurement_route: 'Single-stage selective', itt_issue_date: '2025-12-01', return_date: '2026-01-15',
    status: 'awarded',
    notes: 'Awarded to Meridian Construction Ltd. 4 tenders received.',
  },
  {
    id: 'tr2', project_id: 'p5',
    tender_name: 'Garden Studio — D&B Contract',
    procurement_route: 'Negotiated D&B', itt_issue_date: '2025-09-15', return_date: '2025-10-10',
    status: 'awarded',
    notes: 'Negotiated with Patterson Build Ltd on D&B basis.',
  },
  {
    id: 'tr3', project_id: 'p1',
    tender_name: 'Riverside House Extension — Main Contract',
    procurement_route: 'Single-stage selective', itt_issue_date: d(14), return_date: d(42),
    status: 'preparation',
    notes: 'Tender pack in preparation. 5 contractors on shortlist.',
  },
]

export const TENDER_RETURNS: TenderReturn[] = [
  {
    id: 'tret1', tender_record_id: 'tr1', bidder_name: 'Meridian Construction Ltd',
    return_date: '2026-01-14', compliance_status: 'Compliant',
    price_summary: '£342,500', notes: 'Lowest compliant tender.',
  },
  {
    id: 'tret2', tender_record_id: 'tr1', bidder_name: 'Oakwood Builders',
    return_date: '2026-01-15', compliance_status: 'Compliant',
    price_summary: '£368,200', notes: 'Good quality submission. Higher programme risk.',
  },
  {
    id: 'tret3', tender_record_id: 'tr1', bidder_name: 'Summit Projects',
    return_date: '2026-01-15', compliance_status: 'Non-compliant',
    price_summary: '£310,000', notes: 'Excluded provisional sums. Non-compliant.',
  },
  {
    id: 'tret4', tender_record_id: 'tr1', bidder_name: 'Hayfield Contracting',
    return_date: '2026-01-13', compliance_status: 'Compliant',
    price_summary: '£385,900', notes: 'Highest tender. Strong quality score.',
  },
]

export const TENDER_EVALUATIONS: TenderEvaluation[] = [
  { id: 'te1', tender_return_id: 'tret1', criterion_name: 'Price', weighting: 60, score: 95, evaluator_user_id: 'u1', notes: 'Lowest price.' },
  { id: 'te2', tender_return_id: 'tret1', criterion_name: 'Quality', weighting: 30, score: 78, evaluator_user_id: 'u2', notes: 'Good methodology.' },
  { id: 'te3', tender_return_id: 'tret1', criterion_name: 'Programme', weighting: 10, score: 80, evaluator_user_id: 'u2', notes: 'Achievable programme.' },
  { id: 'te4', tender_return_id: 'tret2', criterion_name: 'Price', weighting: 60, score: 72, evaluator_user_id: 'u1' },
  { id: 'te5', tender_return_id: 'tret2', criterion_name: 'Quality', weighting: 30, score: 85, evaluator_user_id: 'u2', notes: 'Strongest quality submission.' },
  { id: 'te6', tender_return_id: 'tret2', criterion_name: 'Programme', weighting: 10, score: 65, evaluator_user_id: 'u2', notes: '2 weeks longer than others.' },
  { id: 'te7', tender_return_id: 'tret4', criterion_name: 'Price', weighting: 60, score: 55, evaluator_user_id: 'u1' },
  { id: 'te8', tender_return_id: 'tret4', criterion_name: 'Quality', weighting: 30, score: 90, evaluator_user_id: 'u2', notes: 'Excellent quality.' },
  { id: 'te9', tender_return_id: 'tret4', criterion_name: 'Programme', weighting: 10, score: 85, evaluator_user_id: 'u2' },
]

// ── Phase 2 Wave 2: Site Queries ────────────────────────────

export const SITE_QUERIES: SiteQuery[] = [
  {
    id: 'sq1', project_id: 'p5', title: 'Foundation depth at point F3',
    description: 'Contractor requests clarification on foundation depth at grid intersection F3 — drawing shows 1200mm but ground conditions suggest 1500mm needed.',
    raised_by_user_id: 'u4', owner_user_id: 'u2', due_date: d(3),
    status: 'open', created_at: d(-1), updated_at: d(-1),
  },
  {
    id: 'sq2', project_id: 'p5', title: 'DPM overlap detail at threshold',
    description: 'How should DPM lap be detailed at the sliding door threshold where it meets external drainage channel?',
    raised_by_user_id: 'u4', owner_user_id: 'u2', due_date: d(5),
    status: 'open', created_at: d(-2), updated_at: d(-2),
  },
  {
    id: 'sq3', project_id: 'p5', title: 'Structural steel finish in exposed area',
    description: 'Exposed steel beam in studio — should this be intumescent painted or left as galvanised?',
    raised_by_user_id: 'u4', owner_user_id: 'u2', due_date: d(-2),
    status: 'responded', response_notes: 'Intumescent paint to achieve 60min fire rating. Colour RAL 9005 to match joinery.',
    created_at: d(-7), updated_at: d(-2),
  },
  {
    id: 'sq4', project_id: 'p3', title: 'Ceiling void access hatch locations',
    description: 'Asbestos survey requires additional access hatches in corridors. Confirm positions.',
    raised_by_user_id: 'u2', owner_user_id: 'u2', due_date: d(1),
    status: 'open', created_at: d(-3), updated_at: d(-3),
  },
  {
    id: 'sq5', project_id: 'p3', title: 'Fire door ironmongery spec',
    description: 'Existing fire doors being replaced. Confirm ironmongery schedule for FD30S doors.',
    raised_by_user_id: 'u4', owner_user_id: 'u2', due_date: d(-5),
    status: 'closed', response_notes: 'Ironmongery schedule issued as drawing SK-42 Rev A.',
    created_at: d(-14), updated_at: d(-5),
  },
]

// ── Phase 2 Wave 3: Building Regulations Data ─────────────

export const BUILDING_REG_RECORDS: BuildingRegRecord[] = [
  {
    id: 'br1', project_id: 'p1', submission_route: 'full_plans', reference: 'BC/2025/4821',
    title: 'Full Plans Application — Rear Extension', description: 'Structural alterations, thermal upgrades, and drainage modifications for two-storey rear extension.',
    submitted_date: '2025-12-15', decision_date: '2026-02-10', status: 'conditional',
    inspector_name: 'David Hargreaves', conditions: 'Fire stopping details required before commencement. Acoustic test results needed at completion.',
    created_at: '2025-12-15', updated_at: '2026-02-10'
  },
  {
    id: 'br2', project_id: 'p3', submission_route: 'full_plans', reference: 'BC/2025/3156',
    title: 'Full Plans — School Internal Refurbishment', description: 'Fire compartmentation, structural alterations, M&E upgrades, and accessibility improvements.',
    submitted_date: '2025-10-01', decision_date: '2025-11-20', status: 'approved',
    inspector_name: 'Rachel Ford',
    created_at: '2025-10-01', updated_at: '2025-11-20'
  },
  {
    id: 'br3', project_id: 'p5', submission_route: 'building_notice', reference: 'BN/2025/8934',
    title: 'Building Notice — Garden Studio', description: 'Detached ancillary garden building under building notice procedure.',
    submitted_date: '2025-11-01', status: 'in_progress',
    inspector_name: 'David Hargreaves',
    created_at: '2025-11-01', updated_at: '2026-01-15'
  },
  {
    id: 'br4', project_id: 'p2', submission_route: 'full_plans', reference: 'BC/2026/0412',
    title: 'Full Plans — Mixed-Use New Build', description: 'Full building control application for 12-unit residential with commercial ground floor.',
    status: 'not_submitted',
    created_at: '2026-02-01', updated_at: '2026-02-01'
  },
]

export const BUILDING_INSPECTIONS: BuildingInspection[] = [
  { id: 'bi1', building_reg_id: 'br1', project_id: 'p1', inspection_type: 'Foundation', scheduled_date: '2026-04-20', status: 'scheduled', follow_up_required: false },
  { id: 'bi2', building_reg_id: 'br2', project_id: 'p3', inspection_type: 'Structural Frame', scheduled_date: '2026-01-15', completed_date: '2026-01-15', status: 'passed', inspector_notes: 'Steel frame connections verified. Fire protection to steelwork satisfactory.', follow_up_required: false },
  { id: 'bi3', building_reg_id: 'br2', project_id: 'p3', inspection_type: 'Fire Compartmentation', scheduled_date: '2026-02-20', completed_date: '2026-02-20', status: 'requires_revisit', inspector_notes: 'Fire stopping to service penetrations in corridor ceiling incomplete. Revisit required.', follow_up_required: true },
  { id: 'bi4', building_reg_id: 'br2', project_id: 'p3', inspection_type: 'Completion', scheduled_date: '2026-04-10', status: 'scheduled', follow_up_required: false },
  { id: 'bi5', building_reg_id: 'br3', project_id: 'p5', inspection_type: 'Foundation', scheduled_date: '2026-01-20', completed_date: '2026-01-20', status: 'passed', inspector_notes: 'Pad foundations cast to correct depth. Ground bearing confirmed.', follow_up_required: false },
  { id: 'bi6', building_reg_id: 'br3', project_id: 'p5', inspection_type: 'Structural Envelope', scheduled_date: '2026-03-01', completed_date: '2026-03-01', status: 'passed', follow_up_required: false },
]

// ── Phase 2 Wave 3: BRPD / Dutyholder Data ────────────────

export const DUTYHOLDER_RECORDS: DutyholderRecord[] = [
  { id: 'dh1', project_id: 'p1', role: 'client', organisation_name: 'Harris Family Trust', contact_name: 'William Harris', contact_email: 'w.harris@harrisfamily.co.uk', appointed_date: '2025-09-01', compliance_status: 'compliant', notes: 'Client duties briefing completed.' },
  { id: 'dh2', project_id: 'p1', role: 'principal_designer', organisation_name: 'Studio Mitchell', contact_name: 'Sarah Mitchell', contact_email: 'sarah@studiomitchell.co.uk', appointed_date: '2025-09-15', competence_evidence: 'ARB registered. 15 years practice. PD training certificate 2025.', compliance_status: 'compliant' },
  { id: 'dh3', project_id: 'p3', role: 'client', organisation_name: 'Surrey County Council', contact_name: 'Helen Price', contact_email: 'h.price@surreycc.gov.uk', appointed_date: '2025-06-01', compliance_status: 'compliant' },
  { id: 'dh4', project_id: 'p3', role: 'principal_designer', organisation_name: 'Studio Mitchell', contact_name: 'James Chen', appointed_date: '2025-06-15', competence_evidence: 'ARB registered. CDM awareness + PD training.', compliance_status: 'compliant' },
  { id: 'dh5', project_id: 'p3', role: 'principal_contractor', organisation_name: 'Westfield Construction', contact_name: 'Mark Thomas', contact_email: 'm.thomas@westfield.co.uk', appointed_date: '2025-08-01', competence_evidence: 'SSIP accredited. CSCS Gold Card.', compliance_status: 'pending_review' },
  { id: 'dh6', project_id: 'p2', role: 'client', organisation_name: 'Meridian Developments', contact_name: 'Paul Kensington', contact_email: 'pk@meridiandev.co.uk', appointed_date: '2025-11-15', compliance_status: 'compliant' },
  { id: 'dh7', project_id: 'p2', role: 'principal_designer', organisation_name: 'Studio Mitchell', contact_name: 'Priya Sharma', appointed_date: '2025-12-01', compliance_status: 'compliant' },
]

export const BRPD_GATEWAYS: BRPDGateway[] = [
  { id: 'gw1', project_id: 'p2', gateway_number: 1, title: 'Gateway 1 — Planning', description: 'Pre-construction gateway before planning application.', target_date: '2026-06-01', status: 'not_started' },
  { id: 'gw2', project_id: 'p2', gateway_number: 2, title: 'Gateway 2 — Before Construction', description: 'Approval to commence construction works.', target_date: '2027-01-01', status: 'not_started' },
  { id: 'gw3', project_id: 'p2', gateway_number: 3, title: 'Gateway 3 — Completion', description: 'Final certificate and registration.', target_date: '2027-09-01', status: 'not_started' },
]

// ── Phase 2 Wave 3: Enhanced Documents Data ───────────────

export const DOCUMENT_RECORDS: DocumentRecord[] = [
  { id: 'doc1', project_id: 'p1', title: 'General Arrangement Plans', document_ref: 'P1-SM-XX-ZZ-DR-A-0100', category: 'drawing', status: 'approved', revision: 'P03', stage: 3, uploaded_by_user_id: 'u2', description: 'Ground and first floor GA plans at 1:50.', created_at: '2026-01-10', updated_at: '2026-03-05' },
  { id: 'doc2', project_id: 'p1', title: 'Structural Engineers Report', document_ref: 'P1-BWB-XX-ZZ-RP-S-0001', category: 'report', status: 'approved', revision: 'V2', stage: 3, uploaded_by_user_id: 'u4', description: 'Structural appraisal and beam schedule.', created_at: '2025-12-20', updated_at: '2026-02-14' },
  { id: 'doc3', project_id: 'p1', title: 'Outline Specification', document_ref: 'P1-SM-XX-ZZ-SP-A-0001', category: 'specification', status: 'for_review', revision: 'D01', stage: 3, uploaded_by_user_id: 'u2', description: 'NBS-based outline spec for Stage 3 issue.', created_at: '2026-03-01', updated_at: '2026-03-10' },
  { id: 'doc4', project_id: 'p3', title: 'Construction Issue Drawings', document_ref: 'P3-SM-XX-ZZ-DR-A-0200', category: 'drawing', status: 'approved', revision: 'C01', stage: 4, uploaded_by_user_id: 'u2', description: 'Full set of construction issue drawings.', created_at: '2026-02-01', updated_at: '2026-02-20' },
  { id: 'doc5', project_id: 'p3', title: 'Asbestos Management Plan', document_ref: 'P3-EXP-XX-ZZ-RP-H-0001', category: 'report', status: 'approved', revision: 'V1', stage: 4, uploaded_by_user_id: 'u4', description: 'R&D survey results and management plan.', created_at: '2025-09-15', updated_at: '2025-10-01' },
  { id: 'doc6', project_id: 'p5', title: 'Planning Drawings', document_ref: 'P5-SM-XX-ZZ-DR-A-0100', category: 'drawing', status: 'approved', revision: 'P02', stage: 3, uploaded_by_user_id: 'u2', description: 'Planning submission drawings for garden studio.', created_at: '2025-11-01', updated_at: '2025-11-15' },
  { id: 'doc7', project_id: 'p1', title: 'Client Brief Confirmation', document_ref: 'P1-SM-XX-ZZ-CO-A-0001', category: 'correspondence', status: 'approved', revision: 'V1', stage: 1, uploaded_by_user_id: 'u1', created_at: '2025-09-15', updated_at: '2025-09-15' },
  { id: 'doc8', project_id: 'p2', title: 'Concept Design Report', document_ref: 'P2-SM-XX-ZZ-RP-A-0001', category: 'report', status: 'draft', revision: 'D01', stage: 2, uploaded_by_user_id: 'u3', description: 'Stage 2 concept design report with options.', created_at: '2026-03-01', updated_at: '2026-03-12' },
]

export const DOCUMENT_TRANSMITTALS: DocumentTransmittal[] = [
  { id: 'dt1', project_id: 'p1', transmittal_ref: 'TN-P1-001', recipient: 'Harris Family Trust', issued_date: '2026-03-05', document_ids: ['doc1', 'doc2'], purpose: 'for_approval', notes: 'Stage 3 spatial coordination issue for client review.', status: 'issued' },
  { id: 'dt2', project_id: 'p3', transmittal_ref: 'TN-P3-005', recipient: 'Westfield Construction', issued_date: '2026-02-20', document_ids: ['doc4'], purpose: 'for_construction', notes: 'Construction issue drawings — full set.', status: 'acknowledged' },
  { id: 'dt3', project_id: 'p1', transmittal_ref: 'TN-P1-002', recipient: 'BWB Consulting', issued_date: '2026-03-10', document_ids: ['doc3'], purpose: 'for_comment', notes: 'Draft specification for structural review.', status: 'draft' },
]

// ── Phase 3: Knowledge Base Data ──────────────────────────

export const KNOWLEDGE_ARTICLES: KnowledgeArticle[] = [
  {
    id: 'ka1', organisation_id: 'org1', title: 'Party Wall Act — Key Considerations',
    summary: 'Essential guidance on Party Wall procedures for residential extensions and conversions.',
    body_markdown: '# Party Wall Act — Key Considerations\n\nWhen a project involves work to a shared boundary or party wall, the Party Wall etc. Act 1996 applies.\n\n## When Does It Apply?\n- Building on or at the boundary\n- Cutting into a party wall\n- Excavating near neighbouring buildings\n\n## Key Steps\n1. Serve notice at least 2 months before work\n2. Obtain agreement or appoint surveyors\n3. Prepare a schedule of condition\n4. Ensure award is in place before starting\n\n## Common Pitfalls\n- Starting work before notices served\n- Assuming verbal agreement is sufficient\n- Forgetting about excavation notices',
    category: 'guidance', tags: ['party-wall', 'residential', 'legal'], related_stage: 3,
    related_sector: 'residential', owner_user_id: 'u1', published_flag: true,
    created_at: '2025-08-01', updated_at: '2025-08-01'
  },
  {
    id: 'ka2', organisation_id: 'org1', title: 'Stage 2 Client Presentation Checklist',
    summary: 'Standard checklist for preparing and delivering concept design presentations.',
    body_markdown: '# Stage 2 Client Presentation Checklist\n\n## Before the Meeting\n- [ ] Concept options finalised (min. 2)\n- [ ] Cost estimates received from QS\n- [ ] Planning risk assessment updated\n- [ ] Presentation boards/slides prepared\n- [ ] Model/3D views rendered\n\n## During Presentation\n- [ ] Brief recap of Stage 1 outcomes\n- [ ] Present options with pros/cons\n- [ ] Discuss budget implications\n- [ ] Record client preferences\n- [ ] Confirm next steps and timeline\n\n## After the Meeting\n- [ ] Issue meeting minutes within 48 hours\n- [ ] Update project brief with decisions\n- [ ] Confirm preferred option in writing',
    category: 'checklist', tags: ['stage-2', 'client', 'presentation'], related_stage: 2,
    owner_user_id: 'u1', published_flag: true,
    created_at: '2025-06-15', updated_at: '2025-10-20'
  },
  {
    id: 'ka3', organisation_id: 'org1', title: 'Lessons Learned — Weybridge School Phasing',
    summary: 'Key takeaways from phased construction in occupied school environment.',
    body_markdown: '# Lessons Learned — Weybridge School Phasing\n\n## Context\nPhased summer works to an occupied primary school required careful coordination.\n\n## What Went Well\n- Early engagement with school leadership\n- Phasing plan aligned with term dates\n- Contractor pre-start meeting covered safeguarding\n\n## What Could Improve\n- Allow more float between phases (2 weeks minimum)\n- DBS checks for all site personnel should be confirmed 4 weeks before, not 2\n- Temporary signage and wayfinding needs its own budget line\n\n## Recommendations\n- For any education project, start safeguarding planning at Stage 2\n- Include phasing as a design risk item from Stage 3',
    category: 'lessons_learned', tags: ['education', 'phasing', 'school'], related_stage: 5,
    related_sector: 'education', owner_user_id: 'u2', published_flag: true,
    created_at: '2026-02-01', updated_at: '2026-02-01'
  },
  {
    id: 'ka4', organisation_id: 'org1', title: 'Standard Fee Exclusions — Residential',
    summary: 'Reusable exclusions text for residential project fee proposals.',
    body_markdown: '# Standard Fee Exclusions — Residential\n\nThe following are typically excluded from our fee proposals for residential projects:\n\n- Party wall surveyor fees and notices\n- Specialist surveys (structural, drainage, ecological, arboricultural)\n- Planning application fees\n- Building control submission fees\n- CDM Principal Designer fees (quoted separately where applicable)\n- Interior design, furniture, and fittings\n- Landscape design beyond immediate curtilage\n- Rights of light assessments\n- Section 106 / CIL payments\n- VAT',
    category: 'fee_clause', tags: ['fees', 'residential', 'exclusions'],
    owner_user_id: 'u1', published_flag: true,
    created_at: '2025-05-01', updated_at: '2026-01-15'
  },
  {
    id: 'ka5', organisation_id: 'org1', title: 'Office QA Procedure — Drawing Issue',
    summary: 'Standard office procedure for quality checking and issuing drawings.',
    body_markdown: '# Office QA Procedure — Drawing Issue\n\n## Before Issue\n1. Self-check against brief and previous revision\n2. Peer review by another team member\n3. Check title block, revision, date, status\n4. Confirm correct file naming convention\n5. Run clash check against consultant drawings where available\n\n## Issue Process\n1. Update document register\n2. Prepare transmittal note\n3. Issue via agreed platform (email/Asite/BIM360)\n4. File confirmation of receipt\n\n## After Issue\n1. Update project dashboard\n2. Note any comments received\n3. Log any required revisions',
    category: 'office_procedure', tags: ['qa', 'drawings', 'process'],
    owner_user_id: 'u1', published_flag: true,
    created_at: '2025-04-01', updated_at: '2025-11-01'
  },
]

// ── Phase 3: CPD & Competence Data ────────────────────────

export const CPD_RECORDS: CPDRecord[] = [
  { id: 'cpd1', user_id: 'u1', title: 'Building Safety Act — PD Responsibilities', provider: 'RIBA', cpd_topic: 'Building Safety', hours: 4, completion_date: '2025-11-15', mandatory_flag: true, notes: 'Annual mandatory CPD on BSA.' },
  { id: 'cpd2', user_id: 'u1', title: 'Fire Safety in Residential Design', provider: 'RIBA', cpd_topic: 'Fire Safety', hours: 3, completion_date: '2025-09-20', mandatory_flag: true },
  { id: 'cpd3', user_id: 'u2', title: 'NEC4 Contract Administration', provider: 'ICE', cpd_topic: 'Contract Administration', hours: 8, completion_date: '2026-01-10', mandatory_flag: false },
  { id: 'cpd4', user_id: 'u2', title: 'Passivhaus Design Principles', provider: 'PHI', cpd_topic: 'Sustainability', hours: 16, completion_date: '2025-06-01', mandatory_flag: false },
  { id: 'cpd5', user_id: 'u3', title: 'Building Safety Act — PD Responsibilities', provider: 'RIBA', cpd_topic: 'Building Safety', hours: 4, completion_date: '2025-11-20', mandatory_flag: true },
  { id: 'cpd6', user_id: 'u4', title: 'CDM Awareness for Designers', provider: 'CITB', cpd_topic: 'Health & Safety', hours: 8, completion_date: '2025-07-15', mandatory_flag: true },
  { id: 'cpd7', user_id: 'u5', title: 'Revit Advanced Detailing', provider: 'Autodesk', cpd_topic: 'Digital Skills', hours: 12, completion_date: '2026-02-01', mandatory_flag: false },
  { id: 'cpd8', user_id: 'u3', title: 'Part L 2021 — Conservation of Fuel & Power', provider: 'RIBA', cpd_topic: 'Building Regulations', hours: 3, completion_date: '2025-10-05', mandatory_flag: true },
]

export const COMPETENCIES: Competency[] = [
  { id: 'comp1', organisation_id: 'org1', name: 'Residential Design', category: 'Design', description: 'Experience designing residential projects from brief through to completion.' },
  { id: 'comp2', organisation_id: 'org1', name: 'Conservation & Listed Buildings', category: 'Design', description: 'Knowledge of heritage regulations, listed building consent procedures.' },
  { id: 'comp3', organisation_id: 'org1', name: 'Contract Administration', category: 'Management', description: 'Ability to administer building contracts (JCT, NEC).' },
  { id: 'comp4', organisation_id: 'org1', name: 'Principal Designer (CDM)', category: 'Compliance', description: 'Competence to fulfil PD role under CDM/Building Safety Act.' },
  { id: 'comp5', organisation_id: 'org1', name: 'BIM / Digital Delivery', category: 'Digital', description: 'Proficiency in BIM workflows, Revit, and digital coordination.' },
  { id: 'comp6', organisation_id: 'org1', name: 'Planning Applications', category: 'Management', description: 'Experience preparing and managing planning applications.' },
  { id: 'comp7', organisation_id: 'org1', name: 'Sustainability & Part L', category: 'Technical', description: 'Knowledge of energy performance, Part L compliance, sustainability strategies.' },
  { id: 'comp8', organisation_id: 'org1', name: 'Education Sector', category: 'Sector', description: 'Experience with school and education facility design.' },
]

export const USER_COMPETENCIES: UserCompetency[] = [
  { id: 'uc1', user_id: 'u1', competency_id: 'comp1', proficiency_level: 'expert', last_reviewed_at: '2025-12-01' },
  { id: 'uc2', user_id: 'u1', competency_id: 'comp2', proficiency_level: 'advanced', last_reviewed_at: '2025-12-01' },
  { id: 'uc3', user_id: 'u1', competency_id: 'comp3', proficiency_level: 'advanced', last_reviewed_at: '2025-12-01' },
  { id: 'uc4', user_id: 'u1', competency_id: 'comp4', proficiency_level: 'expert', last_reviewed_at: '2025-12-01' },
  { id: 'uc5', user_id: 'u2', competency_id: 'comp1', proficiency_level: 'advanced', last_reviewed_at: '2025-11-15' },
  { id: 'uc6', user_id: 'u2', competency_id: 'comp3', proficiency_level: 'intermediate', last_reviewed_at: '2025-11-15' },
  { id: 'uc7', user_id: 'u2', competency_id: 'comp5', proficiency_level: 'advanced', last_reviewed_at: '2025-11-15' },
  { id: 'uc8', user_id: 'u2', competency_id: 'comp8', proficiency_level: 'advanced', last_reviewed_at: '2025-11-15' },
  { id: 'uc9', user_id: 'u3', competency_id: 'comp1', proficiency_level: 'intermediate', last_reviewed_at: '2025-10-01' },
  { id: 'uc10', user_id: 'u3', competency_id: 'comp6', proficiency_level: 'advanced', last_reviewed_at: '2025-10-01' },
  { id: 'uc11', user_id: 'u3', competency_id: 'comp7', proficiency_level: 'advanced', last_reviewed_at: '2025-10-01' },
  { id: 'uc12', user_id: 'u4', competency_id: 'comp5', proficiency_level: 'intermediate', last_reviewed_at: '2026-01-01' },
  { id: 'uc13', user_id: 'u4', competency_id: 'comp4', proficiency_level: 'basic', evidence_url: 'https://example.com/cdm-cert', last_reviewed_at: '2025-12-15' },
  { id: 'uc14', user_id: 'u5', competency_id: 'comp5', proficiency_level: 'advanced', last_reviewed_at: '2026-02-01' },
  { id: 'uc15', user_id: 'u5', competency_id: 'comp1', proficiency_level: 'basic', last_reviewed_at: '2026-02-01' },
]

export const TRAINING_PLANS: TrainingPlan[] = [
  { id: 'tp1', user_id: 'u4', title: 'CDM Principal Designer Competence', objective: 'Complete RIBA PD training course and 2 supervised PD appointments.', due_date: '2026-06-30', status: 'in_progress', manager_notes: 'Tom to shadow Sarah on Riverside project PD duties.' },
  { id: 'tp2', user_id: 'u5', title: 'Contract Administration Foundation', objective: 'Complete ICE NEC4 course and assist on one contract admin role.', due_date: '2026-09-01', status: 'not_started', manager_notes: 'Amara interested in broadening into CA. Book for next available course.' },
  { id: 'tp3', user_id: 'u3', title: 'Conservation & Heritage Skills', objective: 'RIBA Conservation course + supervised listed building project.', due_date: '2026-12-01', status: 'not_started' },
  { id: 'tp4', user_id: 'u2', title: 'Part L 2021 Compliance Update', objective: 'Complete RIBA Part L CPD. Already strong on sustainability — formalise.', due_date: '2026-04-30', status: 'overdue' },
]

// ── Phase 3: Internationalisation Data ────────────────────

export const JURISDICTION_PACKS: JurisdictionPack[] = [
  {
    id: 'jp1', country: 'United Kingdom', region: 'England & Wales', language: 'en',
    currency: 'GBP', units: 'metric', date_format: 'DD/MM/YYYY',
    stage_labels: { 0: 'Strategic Definition', 1: 'Preparation & Briefing', 2: 'Concept Design', 3: 'Spatial Coordination', 4: 'Technical Design', 5: 'Manufacturing & Construction', 6: 'Handover', 7: 'Use' },
    terminology_notes: 'Uses RIBA Plan of Work 2020 stage names.',
    reference_guidance_notes: 'Building Regulations England & Wales. Planning (Town & Country Planning Act). CDM 2015. Building Safety Act 2022.'
  },
  {
    id: 'jp2', country: 'United Kingdom', region: 'Scotland', language: 'en',
    currency: 'GBP', units: 'metric', date_format: 'DD/MM/YYYY',
    stage_labels: { 0: 'Strategic Definition', 1: 'Preparation & Briefing', 2: 'Concept Design', 3: 'Spatial Coordination', 4: 'Technical Design', 5: 'Manufacturing & Construction', 6: 'Handover', 7: 'Use' },
    terminology_notes: 'Uses RIBA stages. Building Standards (Scotland) differ from England.',
    reference_guidance_notes: 'Building (Scotland) Act 2003. Town & Country Planning (Scotland) Act 1997.'
  },
]

export const ORGANISATION_SETTINGS: OrganisationSettings[] = [
  {
    id: 'os1', organisation_id: 'org1', default_currency: 'GBP', default_units: 'metric',
    date_format: 'DD/MM/YYYY', jurisdiction_pack_id: 'jp1',
    project_number_template: '{YEAR}-{SEQ:3}',
    terminology_overrides: {}
  },
]

// ── Phase 3: Admin Controls Data ──────────────────────────

export const AI_SOURCE_PERMISSIONS: AISourcePermission[] = [
  { id: 'asp1', organisation_id: 'org1', source_category: 'project_data', enabled: true, updated_at: '2026-01-01' },
  { id: 'asp2', organisation_id: 'org1', source_category: 'project_documents', enabled: true, updated_at: '2026-01-01' },
  { id: 'asp3', organisation_id: 'org1', source_category: 'knowledge_base', enabled: true, updated_at: '2026-01-01' },
  { id: 'asp4', organisation_id: 'org1', source_category: 'reference_uploads', enabled: false, updated_at: '2026-01-01' },
  { id: 'asp5', organisation_id: 'org1', source_category: 'fee_data', enabled: false, updated_at: '2026-01-01' },
]

export const AI_LOGS: AILog[] = [
  { id: 'al1', organisation_id: 'org1', user_id: 'u2', project_id: 'p1', prompt: 'What are the open risks on Riverside House?', response_summary: 'Identified 3 open risks: overdue required task in Stage 3, fire stopping condition from building control, and party wall notice pending.', source_categories_used: ['project_data'], confidence_level: 'high', created_at: '2026-03-15' },
  { id: 'al2', organisation_id: 'org1', user_id: 'u1', prompt: 'What does our office procedure say about drawing issue QA?', response_summary: 'Referenced Office QA Procedure — Drawing Issue article. Outlined 5-step pre-issue check and 3-step post-issue process.', source_categories_used: ['knowledge_base'], confidence_level: 'high', created_at: '2026-03-16' },
  { id: 'al3', organisation_id: 'org1', user_id: 'u3', project_id: 'p2', prompt: 'Are there any similar mixed-use projects we can learn from?', response_summary: 'No direct match in completed projects. Suggested reviewing Brixton Workspace Conversion for commercial conversion lessons.', source_categories_used: ['project_data', 'knowledge_base'], confidence_level: 'medium', created_at: '2026-03-18' },
]

// ── Phase 3 Wave 2: Drawing Issue Intelligence Data ───────

export const DRAWING_ISSUE_RECORDS: DrawingIssueRecord[] = [
  { id: 'di1', project_id: 'p1', drawing_ref: 'P1-SM-XX-00-DR-A-0100', drawing_title: 'Ground Floor GA', issue_type: 'planning', stage: 2, issued_date: '2025-12-01', issued_to: 'LB Richmond Planning', revision: 'P01', created_by_user_id: 'u2' },
  { id: 'di2', project_id: 'p1', drawing_ref: 'P1-SM-XX-00-DR-A-0100', drawing_title: 'Ground Floor GA', issue_type: 'planning', stage: 2, issued_date: '2026-01-10', issued_to: 'LB Richmond Planning', revision: 'P02', supersedes: 'P01', notes: 'Updated to address planner comments on rear elevation setback.', created_by_user_id: 'u2' },
  { id: 'di3', project_id: 'p1', drawing_ref: 'P1-SM-XX-00-DR-A-0100', drawing_title: 'Ground Floor GA', issue_type: 'working', stage: 3, issued_date: '2026-02-15', issued_to: 'BWB Consulting', revision: 'W01', created_by_user_id: 'u2' },
  { id: 'di4', project_id: 'p1', drawing_ref: 'P1-SM-XX-01-DR-A-0101', drawing_title: 'First Floor GA', issue_type: 'planning', stage: 2, issued_date: '2025-12-01', issued_to: 'LB Richmond Planning', revision: 'P01', created_by_user_id: 'u2' },
  { id: 'di5', project_id: 'p1', drawing_ref: 'P1-SM-XX-ZZ-DR-A-0200', drawing_title: 'Elevations Sheet 1', issue_type: 'planning', stage: 2, issued_date: '2025-12-01', issued_to: 'LB Richmond Planning', revision: 'P01', created_by_user_id: 'u2' },
  { id: 'di6', project_id: 'p1', drawing_ref: 'P1-SM-XX-ZZ-DR-A-0200', drawing_title: 'Elevations Sheet 1', issue_type: 'planning', stage: 2, issued_date: '2026-01-10', issued_to: 'LB Richmond Planning', revision: 'P02', supersedes: 'P01', created_by_user_id: 'u2' },
  { id: 'di7', project_id: 'p3', drawing_ref: 'P3-SM-XX-00-DR-A-0100', drawing_title: 'Ground Floor Demolition', issue_type: 'tender', stage: 4, issued_date: '2025-11-01', issued_to: 'Tender Package', revision: 'T01', created_by_user_id: 'u2' },
  { id: 'di8', project_id: 'p3', drawing_ref: 'P3-SM-XX-00-DR-A-0100', drawing_title: 'Ground Floor Demolition', issue_type: 'construction', stage: 4, issued_date: '2026-01-15', issued_to: 'Westfield Construction', revision: 'C01', notes: 'Construction issue. Minor amendments from tender.', created_by_user_id: 'u2' },
  { id: 'di9', project_id: 'p3', drawing_ref: 'P3-SM-XX-00-DR-A-0101', drawing_title: 'Ground Floor Proposed', issue_type: 'construction', stage: 4, issued_date: '2026-01-15', issued_to: 'Westfield Construction', revision: 'C01', created_by_user_id: 'u2' },
  { id: 'di10', project_id: 'p3', drawing_ref: 'P3-SM-XX-00-DR-A-0101', drawing_title: 'Ground Floor Proposed', issue_type: 'construction', stage: 4, issued_date: '2026-03-01', issued_to: 'Westfield Construction', revision: 'C02', supersedes: 'C01', notes: 'Re-issue: updated classroom layout per client change request.', created_by_user_id: 'u2' },
  { id: 'di11', project_id: 'p5', drawing_ref: 'P5-SM-XX-00-DR-A-0100', drawing_title: 'Floor Plan & Roof Plan', issue_type: 'planning', stage: 3, issued_date: '2025-11-01', issued_to: 'LB Southwark Planning', revision: 'P01', created_by_user_id: 'u2' },
  { id: 'di12', project_id: 'p5', drawing_ref: 'P5-SM-XX-00-DR-A-0100', drawing_title: 'Floor Plan & Roof Plan', issue_type: 'construction', stage: 5, issued_date: '2026-02-01', issued_to: 'TBC Builders', revision: 'C01', created_by_user_id: 'u2' },
  { id: 'di13', project_id: 'p2', drawing_ref: 'P2-SM-XX-00-DR-A-0100', drawing_title: 'Typical Floor Plan', issue_type: 'sketch', stage: 2, issued_date: '2026-02-01', issued_to: 'Meridian Developments', revision: 'SK01', created_by_user_id: 'u3' },
  { id: 'di14', project_id: 'p2', drawing_ref: 'P2-SM-XX-ZZ-DR-A-0200', drawing_title: 'Street Elevation', issue_type: 'sketch', stage: 2, issued_date: '2026-02-01', issued_to: 'Meridian Developments', revision: 'SK01', created_by_user_id: 'u3' },
]

// ── Phase 3 Wave 2: Commercial Reporting Data ─────────────

export const PROJECT_COMMERCIALS: ProjectCommercial[] = [
  { id: 'pc1', project_id: 'p1', agreed_fee: 48000, fee_invoiced: 32000, fee_paid: 28000, wip_value: 6500, expenses: 1200, time_logged_hours: 420, estimated_hours_remaining: 180, approved_variations: 2500, current_margin_percent: 22, forecast_margin_percent: 18, stage_overspend_flag: false, health_flag: 'healthy', last_updated: '2026-03-18' },
  { id: 'pc2', project_id: 'p2', agreed_fee: 165000, fee_invoiced: 28000, fee_paid: 28000, wip_value: 14000, expenses: 3500, time_logged_hours: 310, estimated_hours_remaining: 1200, approved_variations: 0, current_margin_percent: 25, forecast_margin_percent: 20, stage_overspend_flag: false, health_flag: 'healthy', last_updated: '2026-03-15' },
  { id: 'pc3', project_id: 'p3', agreed_fee: 72000, fee_invoiced: 65000, fee_paid: 58000, wip_value: 4200, expenses: 2800, time_logged_hours: 680, estimated_hours_remaining: 120, approved_variations: 5000, current_margin_percent: 12, forecast_margin_percent: 8, stage_overspend_flag: true, health_flag: 'watch', last_updated: '2026-03-10' },
  { id: 'pc4', project_id: 'p4', agreed_fee: 195000, fee_invoiced: 12000, fee_paid: 12000, wip_value: 8000, expenses: 500, time_logged_hours: 95, estimated_hours_remaining: 1800, approved_variations: 0, current_margin_percent: 30, forecast_margin_percent: 28, stage_overspend_flag: false, health_flag: 'healthy', last_updated: '2026-03-01' },
  { id: 'pc5', project_id: 'p5', agreed_fee: 18000, fee_invoiced: 16000, fee_paid: 14000, wip_value: 1800, expenses: 400, time_logged_hours: 195, estimated_hours_remaining: 25, approved_variations: 0, current_margin_percent: 15, forecast_margin_percent: 12, stage_overspend_flag: true, health_flag: 'at_risk', last_updated: '2026-03-19' },
  { id: 'pc6', project_id: 'p6', agreed_fee: 85000, fee_invoiced: 35000, fee_paid: 30000, wip_value: 0, expenses: 1800, time_logged_hours: 380, estimated_hours_remaining: 550, approved_variations: 0, current_margin_percent: 18, forecast_margin_percent: -5, stage_overspend_flag: false, health_flag: 'critical', last_updated: '2025-12-10' },
]

export const CASHFLOW_FORECASTS: CashflowForecast[] = [
  { id: 'cf1', organisation_id: 'org1', month: '2026-01', projected_income: 42000, projected_expenses: 35000, actual_income: 45000, actual_expenses: 33000, pipeline_value: 15000 },
  { id: 'cf2', organisation_id: 'org1', month: '2026-02', projected_income: 38000, projected_expenses: 34000, actual_income: 36000, actual_expenses: 35500, pipeline_value: 22000 },
  { id: 'cf3', organisation_id: 'org1', month: '2026-03', projected_income: 52000, projected_expenses: 36000, actual_income: 48000, actual_expenses: 37000, pipeline_value: 28000 },
  { id: 'cf4', organisation_id: 'org1', month: '2026-04', projected_income: 45000, projected_expenses: 36000, pipeline_value: 35000 },
  { id: 'cf5', organisation_id: 'org1', month: '2026-05', projected_income: 50000, projected_expenses: 37000, pipeline_value: 40000 },
  { id: 'cf6', organisation_id: 'org1', month: '2026-06', projected_income: 55000, projected_expenses: 38000, pipeline_value: 45000 },
  { id: 'cf7', organisation_id: 'org1', month: '2026-07', projected_income: 40000, projected_expenses: 35000, pipeline_value: 30000 },
  { id: 'cf8', organisation_id: 'org1', month: '2026-08', projected_income: 30000, projected_expenses: 32000, pipeline_value: 25000 },
  { id: 'cf9', organisation_id: 'org1', month: '2026-09', projected_income: 48000, projected_expenses: 36000, pipeline_value: 50000 },
]

// ── Phase 3 Wave 2: Staffing & Utilisation Data ───────────

export const STAFF_ALLOCATIONS: StaffAllocation[] = [
  { id: 'sa1', user_id: 'u2', project_id: 'p1', stage: 3, hours_per_week: 16, start_date: '2026-01-06', end_date: '2026-04-30', role_on_project: 'Project Lead' },
  { id: 'sa2', user_id: 'u2', project_id: 'p3', stage: 4, hours_per_week: 12, start_date: '2025-10-01', end_date: '2026-04-15', role_on_project: 'Project Lead' },
  { id: 'sa3', user_id: 'u2', project_id: 'p5', stage: 5, hours_per_week: 4, start_date: '2026-01-01', end_date: '2026-05-01', role_on_project: 'Project Lead' },
  { id: 'sa4', user_id: 'u3', project_id: 'p2', stage: 2, hours_per_week: 20, start_date: '2025-12-01', end_date: '2026-06-30', role_on_project: 'Project Lead' },
  { id: 'sa5', user_id: 'u3', project_id: 'p4', stage: 1, hours_per_week: 12, start_date: '2026-01-10', end_date: '2026-04-30', role_on_project: 'Project Lead' },
  { id: 'sa6', user_id: 'u4', project_id: 'p1', stage: 3, hours_per_week: 24, start_date: '2026-02-01', end_date: '2026-05-30', role_on_project: 'Architect' },
  { id: 'sa7', user_id: 'u4', project_id: 'p3', stage: 4, hours_per_week: 8, start_date: '2025-11-01', end_date: '2026-04-15', role_on_project: 'Architect' },
  { id: 'sa8', user_id: 'u5', project_id: 'p2', stage: 2, hours_per_week: 28, start_date: '2026-01-01', end_date: '2026-06-30', role_on_project: 'Architectural Assistant' },
  { id: 'sa9', user_id: 'u5', project_id: 'p4', stage: 1, hours_per_week: 8, start_date: '2026-02-01', end_date: '2026-05-30', role_on_project: 'Architectural Assistant' },
  { id: 'sa10', user_id: 'u1', project_id: 'p1', stage: 3, hours_per_week: 2, start_date: '2025-09-01', end_date: '2026-06-30', role_on_project: 'Practice Lead / Review' },
  { id: 'sa11', user_id: 'u1', project_id: 'p2', stage: 2, hours_per_week: 3, start_date: '2025-11-15', end_date: '2027-03-01', role_on_project: 'Practice Lead / Review' },
  { id: 'sa12', user_id: 'u1', project_id: 'p4', stage: 1, hours_per_week: 4, start_date: '2026-01-10', end_date: '2026-06-30', role_on_project: 'Practice Lead / Client' },
]

export const STAFF_CAPACITIES: StaffCapacity[] = [
  { user_id: 'u1', name: 'Sarah Mitchell', role: 'Practice Owner', weekly_capacity_hours: 20, allocated_hours: 9, utilisation_percent: 45, status: 'under' },
  { user_id: 'u2', name: 'James Chen', role: 'Project Lead', weekly_capacity_hours: 37.5, allocated_hours: 32, utilisation_percent: 85, status: 'optimal' },
  { user_id: 'u3', name: 'Priya Sharma', role: 'Project Lead', weekly_capacity_hours: 37.5, allocated_hours: 32, utilisation_percent: 85, status: 'optimal' },
  { user_id: 'u4', name: 'Tom Davies', role: 'Architect', weekly_capacity_hours: 37.5, allocated_hours: 32, utilisation_percent: 85, status: 'optimal' },
  { user_id: 'u5', name: 'Amara Okafor', role: 'Architectural Assistant', weekly_capacity_hours: 37.5, allocated_hours: 36, utilisation_percent: 96, status: 'over' },
]

// ── Phase 3 Wave 3: Fee Recommendation Data ───────────────

export const FEE_RECOMMENDATIONS: FeeRecommendation[] = [
  {
    id: 'fr1', organisation_id: 'org1', project_type: 'Residential Extension', sector: 'residential',
    scale_estimate: 350000, procurement_route: 'traditional', complexity: 'medium',
    stage_scope: 'Stages 1-5 + 6', staffing_mix_notes: '1 project lead (60%), 1 architect (40%)',
    overhead_percent: 15, margin_percent: 20,
    recommended_fee_low: 42000, recommended_fee_high: 55000,
    recommended_stage_split: { '1': 8, '2': 15, '3': 20, '4': 25, '5': 25, '6': 7 },
    confidence_level: 'high', similar_project_ids: ['p1', 'p5'],
    notes: 'Based on 2 similar residential projects. Extension complexity is typical for listed property work.',
    created_at: '2026-03-01', created_by_user_id: 'u1'
  },
  {
    id: 'fr2', organisation_id: 'org1', project_type: 'Mixed-Use New Build', sector: 'mixed_use',
    scale_estimate: 8500000, procurement_route: 'design_and_build', complexity: 'high',
    stage_scope: 'Stages 0-4', staffing_mix_notes: '1 practice lead (10%), 1 project lead (50%), 2 architects (40%)',
    overhead_percent: 18, margin_percent: 22,
    recommended_fee_low: 145000, recommended_fee_high: 195000,
    recommended_stage_split: { '0': 5, '1': 10, '2': 25, '3': 30, '4': 30 },
    confidence_level: 'medium', similar_project_ids: ['p2'],
    notes: 'Limited comparable data. Only 1 similar mixed-use project in portfolio. D&B novation adds coordination cost.',
    created_at: '2026-02-15', created_by_user_id: 'u1'
  },
  {
    id: 'fr3', organisation_id: 'org1', project_type: 'Education Refurbishment', sector: 'education',
    scale_estimate: 2200000, procurement_route: 'traditional', complexity: 'high',
    stage_scope: 'Stages 2-5 + 6', staffing_mix_notes: '1 project lead (50%), 1 architect (50%)',
    overhead_percent: 15, margin_percent: 18,
    recommended_fee_low: 65000, recommended_fee_high: 80000,
    recommended_stage_split: { '2': 15, '3': 20, '4': 25, '5': 30, '6': 10 },
    confidence_level: 'high', similar_project_ids: ['p3'],
    notes: 'Good match with Weybridge School. Phased works in occupied buildings add 10-15% coordination overhead.',
    created_at: '2026-01-20', created_by_user_id: 'u1'
  },
]

// ── Phase 3 Wave 3: Fee Quote Data ────────────────────────

export const FEE_QUOTE_RECORDS: FeeQuoteRecord[] = [
  {
    id: 'fq-1',
    organisation_id: 'org-1',
    quote_mode: 'existing_project',
    related_project_id: 'p1',
    quote_reference: 'MA-Q-2025-001',
    quote_title: 'Riverside House Extension — Full Architectural Services',
    quote_template_type: 'full_service',
    status: 'accepted',
    client_name: 'David & Sarah Thornton',
    client_contact: 'David Thornton',
    issue_date: '2024-10-15',
    valid_until: '2024-11-15',
    fee_basis: 'Fixed fee by stage',
    total_fee: 48500,
    currency: 'GBP',
    prepared_by_user_id: 'u2',
    sent_at: '2024-10-15T10:00:00Z',
    sent_count: 1,
    viewed_count: 4,
    last_viewed_at: '2024-10-22T14:30:00Z',
    accepted_at: '2024-10-25T09:00:00Z',
    project_summary: 'Two-storey rear extension and loft conversion to Grade II listed property in Surrey.',
    scope_summary: 'Full architectural services from concept through to completion including design development, planning support, building regulations, and site administration.',
    terms_text: 'Services provided in accordance with RIBA Professional Services Contract 2020. Payment within 28 days of invoice. Fees exclude VAT.',
    exclusions_text: 'Structural engineering, M&E design, party wall surveys, measured surveys, CDM Principal Designer fees (unless separately agreed).',
    assumptions_text: 'Based on single residential extension up to 80m². Planning application to be straightforward with no listed building or conservation area constraints. One set of tender documents.',
    payment_terms_text: 'Stage 1-2: 25% on appointment. Stage 3: 20% on design completion. Stage 4: 30% on tender. Stage 5-6: 20% on practical completion. 5% on final account.',
    meetings_included_count: 12,
    meeting_type_notes: 'Includes 6 client meetings, 4 design team meetings, 2 site visits.',
    mileage_rate: 0.45,
    travel_billing_rule: 'Mileage charged at 45p/mile for site visits beyond 10 miles from studio.',
    expense_allowance: 1500,
    design_freeze_flag: true,
    deposit_required_flag: true,
    deposit_amount: 2500,
    cgi_render_flag: false,
    consultant_coordination_flag: true,
    brpd_role_flag: false,
    cdm_pd_role_flag: false,
    created_at: '2024-10-12T08:00:00Z',
    updated_at: '2024-10-25T09:00:00Z',
  },
  {
    id: 'fq-2',
    organisation_id: 'org-1',
    quote_mode: 'existing_project',
    related_project_id: 'p2',
    related_opportunity_id: 'opp-1',
    quote_reference: 'MA-Q-2025-002',
    quote_title: 'Clapham Mixed-Use — Architecture & Interior Design',
    quote_template_type: 'full_service',
    status: 'sent',
    client_name: 'Clapham Developments Ltd',
    client_contact: 'Sarah Green',
    issue_date: '2025-01-10',
    valid_until: '2025-02-10',
    fee_basis: 'Percentage of construction cost',
    total_fee: 185000,
    currency: 'GBP',
    prepared_by_user_id: 'u1',
    sent_at: '2025-01-10T16:00:00Z',
    sent_count: 1,
    viewed_count: 2,
    last_viewed_at: '2025-01-12T11:00:00Z',
    project_summary: 'New-build mixed-use development with 8 residential units and 2 commercial ground floor units in Clapham.',
    scope_summary: 'Full architectural services from strategic definition through to design stages, with consultant coordination for MEP and structural.',
    terms_text: 'RIBA Professional Services Contract 2020 with bespoke amendments. Payment 14 days from invoice. Fees exclusive of VAT.',
    exclusions_text: 'Structural engineering, MEP design, landscape architecture, acoustic consultancy, BREEAM assessment, party wall matters.',
    assumptions_text: 'Based on estimated construction cost of £2.8M. Mixed-use scheme of approximately 8 residential units and 2 commercial units. Full planning application required.',
    payment_terms_text: 'Monthly invoicing based on stage progress. 10% retainer on appointment.',
    meetings_included_count: 24,
    meeting_type_notes: 'Includes fortnightly client meetings, monthly design team, and quarterly stakeholder reviews.',
    mileage_rate: 0.45,
    travel_billing_rule: 'London site — no mileage. Expenses claimed for congestion charge and parking.',
    expense_allowance: 3500,
    design_freeze_flag: true,
    deposit_required_flag: true,
    deposit_amount: 15000,
    cgi_render_flag: false,
    consultant_coordination_flag: true,
    brpd_role_flag: false,
    cdm_pd_role_flag: false,
    created_at: '2025-01-05T10:00:00Z',
    updated_at: '2025-01-12T11:00:00Z',
  },
  {
    id: 'fq-3',
    organisation_id: 'org-1',
    quote_mode: 'standalone',
    quote_reference: 'MA-Q-2025-003',
    quote_title: 'Battersea Penthouse — Interior Architecture',
    quote_template_type: 'technical',
    status: 'viewed',
    client_name: 'Marcus Webb',
    client_contact: 'Marcus Webb',
    issue_date: '2025-01-08',
    valid_until: '2025-02-08',
    fee_basis: 'Fixed fee',
    total_fee: 32000,
    currency: 'GBP',
    prepared_by_user_id: 'u3',
    sent_at: '2025-01-08T14:00:00Z',
    sent_count: 1,
    viewed_count: 1,
    last_viewed_at: '2025-01-09T09:30:00Z',
    project_summary: 'Interior architecture for penthouse apartment, approximately 120m². Shell and core by others.',
    scope_summary: 'Spatial planning, material specifications, finishes design, design development, and installation administration.',
    terms_text: 'Standard RIBA terms apply. Payment within 21 days.',
    exclusions_text: 'Furniture procurement, art curation, AV/IT design, contractor management.',
    assumptions_text: 'Penthouse apartment approximately 120m². Interior architecture scope only — shell and core by others. Two design options at concept stage.',
    payment_terms_text: 'Three equal payments: on appointment, at design completion, at installation completion.',
    design_freeze_flag: false,
    deposit_required_flag: false,
    cgi_render_flag: false,
    consultant_coordination_flag: false,
    brpd_role_flag: false,
    cdm_pd_role_flag: false,
    created_at: '2025-01-06T08:00:00Z',
    updated_at: '2025-01-09T09:30:00Z',
  },
  {
    id: 'fq-4',
    organisation_id: 'org-1',
    quote_mode: 'standalone',
    related_opportunity_id: 'opp-3',
    quote_reference: 'MA-Q-2025-004',
    quote_title: 'Hackney Workspace Conversion — Feasibility & Planning',
    quote_template_type: 'planning',
    status: 'draft',
    client_name: 'East London Workspace Co',
    client_contact: 'Rachel Adams',
    issue_date: '2025-01-15',
    valid_until: '2025-02-15',
    fee_basis: 'Fixed fee by stage',
    total_fee: 28000,
    currency: 'GBP',
    prepared_by_user_id: 'u1',
    sent_count: 0,
    viewed_count: 0,
    project_summary: 'Feasibility and planning services for conversion of former light industrial unit to co-working space.',
    scope_summary: 'Feasibility study, planning strategy, design brief development, concept design, and planning application.',
    terms_text: 'RIBA Professional Services Contract 2020.',
    exclusions_text: 'Structural surveys, environmental assessments, planning consultant fees.',
    assumptions_text: 'Former light industrial unit approximately 450m². Change of use from B2 to E(g). Pre-application advice to be sought.',
    payment_terms_text: 'Stage-based invoicing on completion of each work stage.',
    design_freeze_flag: false,
    deposit_required_flag: false,
    cgi_render_flag: false,
    consultant_coordination_flag: false,
    brpd_role_flag: false,
    cdm_pd_role_flag: false,
    created_at: '2025-01-14T10:00:00Z',
    updated_at: '2025-01-14T10:00:00Z',
  },
  {
    id: 'fq-5',
    organisation_id: 'org-1',
    quote_mode: 'standalone',
    quote_reference: 'MA-Q-2024-018',
    quote_title: 'Richmond Garden Room',
    quote_template_type: 'planning',
    status: 'declined',
    client_name: 'Patricia Holmes',
    client_contact: 'Patricia Holmes',
    issue_date: '2024-12-01',
    valid_until: '2024-12-31',
    fee_basis: 'Fixed fee',
    total_fee: 8500,
    currency: 'GBP',
    prepared_by_user_id: 'u2',
    sent_at: '2024-12-01T09:00:00Z',
    sent_count: 1,
    viewed_count: 3,
    last_viewed_at: '2024-12-15T10:00:00Z',
    declined_at: '2024-12-18T14:00:00Z',
    project_summary: 'Single storey garden room under 15m² via permitted development.',
    scope_summary: 'Design development, planning drawings, and specifications for garden room.',
    terms_text: 'Standard terms.',
    exclusions_text: 'Structural design, landscaping.',
    assumptions_text: 'Single storey garden room under 15m². Permitted development.',
    payment_terms_text: '50% on appointment, 50% on completion of drawings.',
    design_freeze_flag: false,
    deposit_required_flag: false,
    cgi_render_flag: false,
    consultant_coordination_flag: false,
    brpd_role_flag: false,
    cdm_pd_role_flag: false,
    created_at: '2024-11-28T10:00:00Z',
    updated_at: '2024-12-18T14:00:00Z',
  },
  {
    id: 'fq-6',
    organisation_id: 'org-1',
    quote_mode: 'standalone',
    quote_reference: 'MA-Q-2024-015',
    quote_title: 'Fulham Loft Conversion',
    quote_template_type: 'technical',
    status: 'expired',
    client_name: 'James & Amy Chen',
    client_contact: 'James Chen',
    issue_date: '2024-09-15',
    valid_until: '2024-10-15',
    fee_basis: 'Fixed fee',
    total_fee: 14200,
    currency: 'GBP',
    prepared_by_user_id: 'u3',
    sent_at: '2024-09-15T11:00:00Z',
    sent_count: 1,
    viewed_count: 1,
    last_viewed_at: '2024-09-20T08:00:00Z',
    project_summary: 'Standard dormer loft conversion. No planning required.',
    scope_summary: 'Architectural design and building regulations technical documentation for loft conversion.',
    terms_text: 'Standard RIBA terms.',
    exclusions_text: 'Party wall surveys, structural engineering.',
    assumptions_text: 'Standard dormer loft conversion. No planning required.',
    payment_terms_text: 'Three stage payments: on appointment, mid-design, on completion.',
    design_freeze_flag: false,
    deposit_required_flag: false,
    cgi_render_flag: false,
    consultant_coordination_flag: false,
    brpd_role_flag: false,
    cdm_pd_role_flag: false,
    created_at: '2024-09-10T10:00:00Z',
    updated_at: '2024-10-16T00:00:00Z',
  },
]

export const FEE_QUOTE_LINE_ITEMS: FeeQuoteLineItem[] = [
  // fq-1: Riverside House Extension (4 stage items)
  {
    id: 'fqli-1',
    fee_quote_id: 'fq-1',
    sort_order: 1,
    line_type: 'stage_service',
    title: 'RIBA Stage 1-2 — Preparation & Concept Design',
    description: 'Site appraisal, brief development, concept design options, planning pre-application advice',
    related_stage: 2,
    quantity: 1,
    unit: 'stage',
    rate: 12125,
    amount: 12125,
    optional_flag: false,
    selected_by_default: true,
  },
  {
    id: 'fqli-2',
    fee_quote_id: 'fq-1',
    sort_order: 2,
    line_type: 'stage_service',
    title: 'RIBA Stage 3 — Spatial Coordination',
    description: 'Coordinated design layout, consultant integration, specification notes',
    related_stage: 3,
    quantity: 1,
    unit: 'stage',
    rate: 9700,
    amount: 9700,
    optional_flag: false,
    selected_by_default: true,
  },
  {
    id: 'fqli-3',
    fee_quote_id: 'fq-1',
    sort_order: 3,
    line_type: 'stage_service',
    title: 'RIBA Stage 4 — Technical Design',
    description: 'Technical design detailing, building regulations package, tender documents',
    related_stage: 4,
    quantity: 1,
    unit: 'stage',
    rate: 15200,
    amount: 15200,
    optional_flag: false,
    selected_by_default: true,
  },
  {
    id: 'fqli-4',
    fee_quote_id: 'fq-1',
    sort_order: 4,
    line_type: 'contract_admin',
    title: 'RIBA Stage 5-6 — Construction & Handover',
    description: 'Site administration, defect rectification, final completion',
    related_stage: 6,
    quantity: 1,
    unit: 'stage',
    rate: 11475,
    amount: 11475,
    optional_flag: false,
    selected_by_default: true,
  },
  // fq-2: Clapham Mixed-Use (5 stage items + 1 consultant + 1 optional)
  {
    id: 'fqli-5',
    fee_quote_id: 'fq-2',
    sort_order: 1,
    line_type: 'stage_service',
    title: 'RIBA Stage 0-1 — Strategic & Briefing',
    description: 'Project objectives, site survey, feasibility study',
    related_stage: 1,
    quantity: 1,
    unit: 'stage',
    rate: 24750,
    amount: 24750,
    optional_flag: false,
    selected_by_default: true,
  },
  {
    id: 'fqli-6',
    fee_quote_id: 'fq-2',
    sort_order: 2,
    line_type: 'stage_service',
    title: 'RIBA Stage 2 — Concept Design',
    description: 'Concept design options, pre-application consultation',
    related_stage: 2,
    quantity: 1,
    unit: 'stage',
    rate: 46250,
    amount: 46250,
    optional_flag: false,
    selected_by_default: true,
  },
  {
    id: 'fqli-7',
    fee_quote_id: 'fq-2',
    sort_order: 3,
    line_type: 'stage_service',
    title: 'RIBA Stage 3 — Spatial Coordination',
    description: 'Coordinated design, planning application submission',
    related_stage: 3,
    quantity: 1,
    unit: 'stage',
    rate: 55500,
    amount: 55500,
    optional_flag: false,
    selected_by_default: true,
  },
  {
    id: 'fqli-8',
    fee_quote_id: 'fq-2',
    sort_order: 4,
    line_type: 'stage_service',
    title: 'RIBA Stage 4 — Technical Design',
    description: 'Technical design to tender ready',
    related_stage: 4,
    quantity: 1,
    unit: 'stage',
    rate: 38500,
    amount: 38500,
    optional_flag: false,
    selected_by_default: true,
  },
  {
    id: 'fqli-9',
    fee_quote_id: 'fq-2',
    sort_order: 5,
    line_type: 'consultant_coordination',
    title: 'Interior Design Consultant — Specialist Coordination',
    description: 'Coordination with interior design consultant for residential units and commercial space',
    quantity: 1,
    unit: 'package',
    rate: 20000,
    amount: 20000,
    optional_flag: true,
    selected_by_default: true,
  },
  {
    id: 'fqli-10',
    fee_quote_id: 'fq-2',
    sort_order: 6,
    line_type: 'optional_service',
    title: 'Sustainability Strategy & BREEAM Assessment',
    description: 'Optional BREEAM assessment and green strategy documentation',
    quantity: 1,
    unit: 'package',
    rate: 8000,
    amount: 8000,
    optional_flag: true,
    selected_by_default: false,
  },
  // fq-3: Battersea Penthouse (3 service items)
  {
    id: 'fqli-11',
    fee_quote_id: 'fq-3',
    sort_order: 1,
    line_type: 'interior_design',
    title: 'Interior Architecture Design',
    description: 'Spatial planning, material specifications, finishes design',
    quantity: 1,
    unit: 'package',
    rate: 20000,
    amount: 20000,
    optional_flag: false,
    selected_by_default: true,
  },
  {
    id: 'fqli-12',
    fee_quote_id: 'fq-3',
    sort_order: 2,
    line_type: 'additional_service',
    title: 'Design Development & Coordination',
    description: 'Detailed coordination with contractors and specialist suppliers',
    quantity: 1,
    unit: 'package',
    rate: 8000,
    amount: 8000,
    optional_flag: false,
    selected_by_default: true,
  },
  {
    id: 'fqli-13',
    fee_quote_id: 'fq-3',
    sort_order: 3,
    line_type: 'additional_service',
    title: 'Installation Administration',
    description: 'Site visits during installation, quality assurance, snagging',
    quantity: 1,
    unit: 'package',
    rate: 4000,
    amount: 4000,
    optional_flag: false,
    selected_by_default: true,
  },
  // fq-4: Hackney Workspace Conversion (2 stage items)
  {
    id: 'fqli-14',
    fee_quote_id: 'fq-4',
    sort_order: 1,
    line_type: 'stage_service',
    title: 'Stage 0-1 — Feasibility & Strategic Planning',
    description: 'Feasibility study, planning strategy, design brief development',
    related_stage: 1,
    quantity: 1,
    unit: 'stage',
    rate: 14000,
    amount: 14000,
    optional_flag: false,
    selected_by_default: true,
  },
  {
    id: 'fqli-15',
    fee_quote_id: 'fq-4',
    sort_order: 2,
    line_type: 'stage_service',
    title: 'Stage 2-3 — Concept & Planning Application',
    description: 'Planning application design and submission',
    related_stage: 3,
    quantity: 1,
    unit: 'stage',
    rate: 14000,
    amount: 14000,
    optional_flag: false,
    selected_by_default: true,
  },
  // fq-5: Richmond Garden Room (2 items)
  {
    id: 'fqli-16',
    fee_quote_id: 'fq-5',
    sort_order: 1,
    line_type: 'additional_service',
    title: 'Architectural Design & Planning Drawings',
    description: 'Design development, planning drawings, specifications',
    quantity: 1,
    unit: 'package',
    rate: 5100,
    amount: 5100,
    optional_flag: false,
    selected_by_default: true,
  },
  {
    id: 'fqli-17',
    fee_quote_id: 'fq-5',
    sort_order: 2,
    line_type: 'additional_service',
    title: 'Building Regulations & Construction Details',
    description: 'Building regulations compliance, construction details, technical specification',
    quantity: 1,
    unit: 'package',
    rate: 3400,
    amount: 3400,
    optional_flag: false,
    selected_by_default: true,
  },
  // fq-6: Fulham Loft Conversion (2 items)
  {
    id: 'fqli-18',
    fee_quote_id: 'fq-6',
    sort_order: 1,
    line_type: 'additional_service',
    title: 'Architectural Design Package',
    description: 'Sketch designs, planning application drawings, specifications',
    quantity: 1,
    unit: 'package',
    rate: 8500,
    amount: 8500,
    optional_flag: false,
    selected_by_default: true,
  },
  {
    id: 'fqli-19',
    fee_quote_id: 'fq-6',
    sort_order: 2,
    line_type: 'additional_service',
    title: 'Building Regulations Technical Documentation',
    description: 'Building regulations drawings and specifications',
    quantity: 1,
    unit: 'package',
    rate: 5700,
    amount: 5700,
    optional_flag: false,
    selected_by_default: true,
  },
]

// ── Phase 4: Fee Quote Sections ──────────────────────────────

export const FEE_QUOTE_SECTIONS: FeeQuoteSection[] = [
  {
    id: 'fqs-1',
    fee_quote_id: 'fq-1',
    section_type: 'cover',
    title: 'Cover & Introduction',
    body_text: 'Architectural Services Quote for Riverside House Extension. This quote sets out the scope of services Mitchell Architecture will provide for your project.',
    sort_order: 1,
  },
  {
    id: 'fqs-2',
    fee_quote_id: 'fq-1',
    section_type: 'project_understanding',
    title: 'Our Understanding of Your Project',
    body_text: 'You are planning to add a two-storey rear extension and loft conversion to your Grade II listed property in Surrey. The works will provide additional living space whilst respecting the architectural character of the original building.',
    sort_order: 2,
  },
  {
    id: 'fqs-3',
    fee_quote_id: 'fq-1',
    section_type: 'scope_of_service',
    title: 'Scope of Architectural Services',
    body_text: 'We will provide full architectural services from concept through to completion, including design development, planning application support, building regulations coordination, and site administration.',
    sort_order: 3,
  },
  {
    id: 'fqs-4',
    fee_quote_id: 'fq-1',
    section_type: 'exclusions',
    title: 'Services Not Included',
    body_text: 'The following are specifically excluded from this quote: structural engineering design and calculations, MEP systems design, party wall surveyor services, measured surveys, CDM Principal Designer duties (unless separately agreed).',
    sort_order: 4,
  },
  {
    id: 'fqs-5',
    fee_quote_id: 'fq-1',
    section_type: 'terms_and_conditions',
    title: 'Terms & Conditions',
    body_text: 'Services will be provided in accordance with the RIBA Professional Services Contract 2020. Our professional indemnity insurance cover is £2,000,000 per occurrence.',
    sort_order: 5,
  },
  {
    id: 'fqs-6',
    fee_quote_id: 'fq-1',
    section_type: 'payment_terms',
    title: 'Payment Terms',
    body_text: 'We invoice monthly on account based on work undertaken. Payment is due within 28 days of the invoice date. All fees are exclusive of VAT.',
    sort_order: 6,
  },
  {
    id: 'fqs-7',
    fee_quote_id: 'fq-1',
    section_type: 'acceptance',
    title: 'Next Steps',
    body_text: 'To proceed, please sign and return this quote by 15th November 2024. We will then prepare our engagement letter and commence work.',
    sort_order: 7,
  },
  {
    id: 'fqs-8',
    fee_quote_id: 'fq-2',
    section_type: 'cover',
    title: 'Architectural Services Quote — Clapham Mixed-Use',
    body_text: 'This quote is for the provision of full architectural services for the proposed mixed-use development at the Clapham site, including 8 residential units and 2 commercial units.',
    sort_order: 1,
  },
  {
    id: 'fqs-9',
    fee_quote_id: 'fq-2',
    section_type: 'project_understanding',
    title: 'Project Overview',
    body_text: 'The project involves the design and delivery of a new-build mixed-use scheme comprising 8 residential apartments and 2 commercial ground floor units. Planning application is currently being prepared.',
    sort_order: 2,
  },
  {
    id: 'fqs-10',
    fee_quote_id: 'fq-2',
    section_type: 'scope_of_service',
    title: 'Services Scope',
    body_text: 'Full architectural services from strategic definition through to design stages, with option for continued involvement through to completion. Detailed coordination with MEP and structural consultants.',
    sort_order: 3,
  },
  {
    id: 'fqs-11',
    fee_quote_id: 'fq-2',
    section_type: 'exclusions',
    title: 'Exclusions',
    body_text: 'Not included: specialist engineering design, landscape architecture, BREEAM assessment (optional), party wall services, planning application submission by others.',
    sort_order: 4,
  },
]

// ── Phase 4: Fee Quote Views ─────────────────────────────────

export const FEE_QUOTE_VIEWS: FeeQuoteView[] = [
  { id: 'fqv-1', fee_quote_id: 'fq-1', viewer_identifier: 'david.thornton@gmail.com', viewed_at: '2024-10-16T09:00:00Z', source: 'email' },
  { id: 'fqv-2', fee_quote_id: 'fq-1', viewer_identifier: 'david.thornton@gmail.com', viewed_at: '2024-10-18T14:00:00Z', source: 'email' },
  { id: 'fqv-3', fee_quote_id: 'fq-1', viewer_identifier: 'sarah.thornton@gmail.com', viewed_at: '2024-10-20T11:00:00Z', source: 'direct_link' },
  { id: 'fqv-4', fee_quote_id: 'fq-1', viewer_identifier: 'david.thornton@gmail.com', viewed_at: '2024-10-22T14:30:00Z', source: 'portal' },
  { id: 'fqv-5', fee_quote_id: 'fq-2', viewer_identifier: 'sarah.green@claphamdevs.com', viewed_at: '2025-01-11T10:00:00Z', source: 'email' },
  { id: 'fqv-6', fee_quote_id: 'fq-2', viewer_identifier: 'sarah.green@claphamdevs.com', viewed_at: '2025-01-12T11:00:00Z', source: 'email' },
  { id: 'fqv-7', fee_quote_id: 'fq-3', viewer_identifier: 'marcus.webb@email.com', viewed_at: '2025-01-09T09:30:00Z', source: 'email' },
  { id: 'fqv-8', fee_quote_id: 'fq-5', viewer_identifier: 'patricia.holmes@email.com', viewed_at: '2024-12-05T16:00:00Z', source: 'email' },
  { id: 'fqv-9', fee_quote_id: 'fq-5', viewer_identifier: 'patricia.holmes@email.com', viewed_at: '2024-12-10T09:00:00Z', source: 'email' },
  { id: 'fqv-10', fee_quote_id: 'fq-5', viewer_identifier: 'patricia.holmes@email.com', viewed_at: '2024-12-15T10:00:00Z', source: 'direct_link' },
]

// ── Phase 4: Fee Quote Templates ─────────────────────────────

export const FEE_QUOTE_TEMPLATES: FeeQuoteTemplate[] = [
  {
    id: 'qt1', organisation_id: 'org1', name: 'Planning / Pre-App Quote',
    template_type: 'planning',
    description: 'For pre-application, planning application, and concept/Stage 2-3 support',
    suitable_for: ['pre-app', 'planning application', 'concept design', 'Stage 2-3'],
    default_sections: ['cover', 'project_understanding', 'scope_of_service', 'stage_breakdown', 'meetings_and_communication', 'expenses_and_travel', 'exclusions', 'terms_and_conditions', 'payment_terms', 'acceptance'],
    body_json: '{}', active_flag: true, created_at: '2026-01-01'
  },
  {
    id: 'qt2', organisation_id: 'org1', name: 'Technical / Delivery Quote',
    template_type: 'technical',
    description: 'For Stage 4 technical design, tender support, design coordination, working drawings',
    suitable_for: ['Stage 4 technical design', 'tender support', 'design coordination', 'working drawings'],
    default_sections: ['cover', 'project_understanding', 'scope_of_service', 'stage_breakdown', 'optional_extras', 'meetings_and_communication', 'expenses_and_travel', 'design_freeze_note', 'exclusions', 'terms_and_conditions', 'payment_terms', 'acceptance'],
    body_json: '{}', active_flag: true, created_at: '2026-01-01'
  },
  {
    id: 'qt3', organisation_id: 'org1', name: 'Full Appointment / Multidisciplinary',
    template_type: 'full_service',
    description: 'For multi-stage appointments covering architecture + interiors + CA or specialist services',
    suitable_for: ['multi-stage appointment', 'architecture + interiors', 'CA services', 'specialist services'],
    default_sections: ['cover', 'project_understanding', 'scope_of_service', 'stage_breakdown', 'optional_extras', 'consultant_coordination', 'meetings_and_communication', 'expenses_and_travel', 'design_freeze_note', 'exclusions', 'terms_and_conditions', 'payment_terms', 'acceptance'],
    body_json: '{}', active_flag: true, created_at: '2026-01-01'
  },
  {
    id: 'qt4', organisation_id: 'org1', name: 'BRPD Services Quote',
    template_type: 'brpd',
    description: 'For Building Regulations Principal Designer services, compliance coordination, dutyholder support',
    suitable_for: ['BRPD services', 'non-HRB and HRB', 'compliance coordination', 'dutyholder support', 'prescribed documents'],
    default_sections: ['cover', 'project_understanding', 'scope_of_service', 'stage_breakdown', 'meetings_and_communication', 'exclusions', 'terms_and_conditions', 'payment_terms', 'acceptance'],
    body_json: '{}', active_flag: true, created_at: '2026-01-01'
  },
  {
    id: 'qt5', organisation_id: 'org1', name: 'CDM Principal Designer Services',
    template_type: 'cdm_pd',
    description: 'For CDM PD appointment, design risk coordination, pre-construction information, H&S review',
    suitable_for: ['CDM PD appointment', 'design risk coordination', 'pre-construction information', 'H&S review'],
    default_sections: ['cover', 'project_understanding', 'scope_of_service', 'stage_breakdown', 'meetings_and_communication', 'exclusions', 'terms_and_conditions', 'payment_terms', 'acceptance'],
    body_json: '{}', active_flag: true, created_at: '2026-01-01'
  },
]

// ── Phase 4: Terms Library ───────────────────────────────────

export const TERMS_LIBRARY: TermsLibraryItem[] = [
  { id: 'tl-1', organisation_id: 'org-1', title: 'RIBA Standard Terms 2020', terms_text: 'Services provided in accordance with the RIBA Professional Services Contract 2020 (as amended). The Architect shall exercise reasonable skill, care and diligence.', category: 'contract', active_flag: true, created_at: '2024-01-01T10:00:00Z' },
  { id: 'tl-2', organisation_id: 'org-1', title: 'Payment Terms — 28 Days', terms_text: 'Invoices are payable within 28 days of the date of issue. Interest will be charged on overdue payments at 4% above the Bank of England base rate.', category: 'payment', active_flag: true, created_at: '2024-01-01T10:00:00Z' },
  { id: 'tl-3', organisation_id: 'org-1', title: 'Copyright & IP', terms_text: 'Copyright in all documents, drawings and designs produced remains with Mitchell Architecture Ltd until all fees have been paid in full. A licence to use is granted upon full payment.', category: 'copyright', active_flag: true, created_at: '2024-01-01T10:00:00Z' },
  { id: 'tl-4', organisation_id: 'org-1', title: 'PI Insurance', terms_text: 'The practice maintains Professional Indemnity Insurance of £2,000,000 for any one occurrence. Details available on request.', category: 'insurance', active_flag: true, created_at: '2024-01-01T10:00:00Z' },
]

// ── Phase 4: Exclusions Library ──────────────────────────────

export const EXCLUSIONS_LIBRARY: ExclusionsLibraryItem[] = [
  { id: 'el-1', organisation_id: 'org-1', title: 'Structural Engineering', exclusions_text: 'Structural engineering design, calculations and detailing are excluded and should be commissioned separately by the client.', active_flag: true, created_at: '2024-01-01T10:00:00Z' },
  { id: 'el-2', organisation_id: 'org-1', title: 'M&E Services', exclusions_text: 'Mechanical and electrical services design including heating, ventilation, electrical distribution and plumbing design.', active_flag: true, created_at: '2024-01-01T10:00:00Z' },
  { id: 'el-3', organisation_id: 'org-1', title: 'Surveys', exclusions_text: 'Measured surveys, topographic surveys, drainage surveys, asbestos surveys and any other specialist survey requirements.', active_flag: true, created_at: '2024-01-01T10:00:00Z' },
  { id: 'el-4', organisation_id: 'org-1', title: 'Party Wall', exclusions_text: 'Party wall surveyor fees and all costs associated with the Party Wall etc. Act 1996.', active_flag: true, created_at: '2024-01-01T10:00:00Z' },
  { id: 'el-5', organisation_id: 'org-1', title: 'CDM Principal Designer', exclusions_text: 'CDM Principal Designer duties under the Construction (Design and Management) Regulations 2015, unless separately agreed and included as an additional service.', active_flag: true, created_at: '2024-01-01T10:00:00Z' },
]

// ── Phase 4: Project Health Snapshots ────────────────────────

export const PROJECT_HEALTH_SNAPSHOTS: ProjectHealthSnapshot[] = [
  // Project p1 — Riverside House (6 months)
  { id: 'phs-1', project_id: 'p1', snapshot_date: '2024-09-30', health_score: 85, forecast_margin: 18, burn_ratio: 0.92, quote_review_flag: false, near_loss_flag: false, billing_risk_flag: false, reasons_json: [] },
  { id: 'phs-2', project_id: 'p1', snapshot_date: '2024-10-31', health_score: 82, forecast_margin: 16, burn_ratio: 0.95, quote_review_flag: false, near_loss_flag: false, billing_risk_flag: false, reasons_json: [] },
  { id: 'phs-3', project_id: 'p1', snapshot_date: '2024-11-30', health_score: 80, forecast_margin: 15, burn_ratio: 0.98, quote_review_flag: false, near_loss_flag: false, billing_risk_flag: false, reasons_json: [] },
  { id: 'phs-4', project_id: 'p1', snapshot_date: '2024-12-31', health_score: 78, forecast_margin: 12, burn_ratio: 1.02, quote_review_flag: false, near_loss_flag: false, billing_risk_flag: false, reasons_json: ['Scope creep on planning revision'] },
  { id: 'phs-5', project_id: 'p1', snapshot_date: '2025-01-31', health_score: 75, forecast_margin: 10, burn_ratio: 1.05, quote_review_flag: false, near_loss_flag: false, billing_risk_flag: false, reasons_json: ['Additional design coordination required'] },
  { id: 'phs-6', project_id: 'p1', snapshot_date: '2025-02-28', health_score: 76, forecast_margin: 11, burn_ratio: 1.04, quote_review_flag: false, near_loss_flag: false, billing_risk_flag: false, reasons_json: [] },
  { id: 'phs-7', project_id: 'p1', snapshot_date: '2025-03-31', health_score: 78, forecast_margin: 12, burn_ratio: 1.01, quote_review_flag: false, near_loss_flag: false, billing_risk_flag: false, reasons_json: [] },
  // Project p2 — Clapham Mixed-Use (5 months)
  { id: 'phs-8', project_id: 'p2', snapshot_date: '2024-11-30', health_score: 88, forecast_margin: 22, burn_ratio: 0.88, quote_review_flag: false, near_loss_flag: false, billing_risk_flag: false, reasons_json: [] },
  { id: 'phs-9', project_id: 'p2', snapshot_date: '2024-12-31', health_score: 85, forecast_margin: 20, burn_ratio: 0.92, quote_review_flag: false, near_loss_flag: false, billing_risk_flag: false, reasons_json: [] },
  { id: 'phs-10', project_id: 'p2', snapshot_date: '2025-01-31', health_score: 82, forecast_margin: 16, burn_ratio: 0.98, quote_review_flag: true, near_loss_flag: false, billing_risk_flag: false, reasons_json: ['Monitor stage 2 sign-off timing'] },
  { id: 'phs-11', project_id: 'p2', snapshot_date: '2025-02-28', health_score: 80, forecast_margin: 15, burn_ratio: 1.00, quote_review_flag: true, near_loss_flag: false, billing_risk_flag: false, reasons_json: ['Potential scope expansion on commercial fit-out'] },
  { id: 'phs-12', project_id: 'p2', snapshot_date: '2025-03-31', health_score: 79, forecast_margin: 14, burn_ratio: 1.01, quote_review_flag: true, near_loss_flag: false, billing_risk_flag: false, reasons_json: ['Consider variation order for interior design coordination'] },
  // Project p3 — Weybridge School (5 months)
  { id: 'phs-13', project_id: 'p3', snapshot_date: '2024-11-30', health_score: 72, forecast_margin: 8, burn_ratio: 1.08, quote_review_flag: true, near_loss_flag: true, billing_risk_flag: false, reasons_json: ['Behind programme on building control submission'] },
  { id: 'phs-14', project_id: 'p3', snapshot_date: '2024-12-31', health_score: 70, forecast_margin: 5, burn_ratio: 1.15, quote_review_flag: true, near_loss_flag: true, billing_risk_flag: false, reasons_json: ['Summer works window at risk', 'Technical coordination overruns'] },
  { id: 'phs-15', project_id: 'p3', snapshot_date: '2025-01-31', health_score: 68, forecast_margin: 2, burn_ratio: 1.22, quote_review_flag: true, near_loss_flag: true, billing_risk_flag: true, reasons_json: ['Critical: fee margin eroding', 'Programme pressure likely to cause further overruns'] },
  { id: 'phs-16', project_id: 'p3', snapshot_date: '2025-02-28', health_score: 72, forecast_margin: 8, burn_ratio: 1.10, quote_review_flag: true, near_loss_flag: true, billing_risk_flag: false, reasons_json: ['Slight recovery but remains at-risk'] },
  { id: 'phs-17', project_id: 'p3', snapshot_date: '2025-03-31', health_score: 75, forecast_margin: 11, burn_ratio: 1.05, quote_review_flag: false, near_loss_flag: false, billing_risk_flag: false, reasons_json: ['Programme catching up, likely to recover'] },
]

// ── Phase 4: Numbering Templates ─────────────────────────────

export const PROJECT_NUMBER_TEMPLATES: ProjectNumberTemplate[] = [
  { id: 'pnt-1', organisation_id: 'org-1', template_name: 'Standard', format_string: 'MA-{YEAR}-{SEQ:3}', active_flag: true, created_at: '2024-01-01T10:00:00Z' },
  { id: 'pnt-2', organisation_id: 'org-1', project_type: 'residential', template_name: 'Residential', format_string: 'MA-R-{YEAR}-{SEQ:3}', active_flag: true, created_at: '2024-01-01T10:00:00Z' },
  { id: 'pnt-3', organisation_id: 'org-1', project_type: 'commercial', template_name: 'Commercial', format_string: 'MA-C-{YEAR}-{SEQ:3}', active_flag: false, created_at: '2024-01-01T10:00:00Z' },
]

export const QUOTE_NUMBER_TEMPLATES: QuoteNumberTemplate[] = [
  { id: 'qnt-1', organisation_id: 'org-1', template_name: 'Standard Quote', format_string: 'MA-Q-{YEAR}-{SEQ:3}', active_flag: true, created_at: '2024-01-01T10:00:00Z' },
]

export const DRAWING_ISSUE_TEMPLATES: DrawingIssueTemplate[] = [
  { id: 'dit-1', organisation_id: 'org-1', issue_type: 'Planning', format_string: '{PROJECT}-PL-{SEQ:2}', active_flag: true, created_at: '2024-01-01T10:00:00Z' },
  { id: 'dit-2', organisation_id: 'org-1', issue_type: 'Construction', format_string: '{PROJECT}-CI-{SEQ:2}', active_flag: true, created_at: '2024-01-01T10:00:00Z' },
  { id: 'dit-3', organisation_id: 'org-1', issue_type: 'Tender', format_string: '{PROJECT}-TI-{SEQ:2}', active_flag: true, created_at: '2024-01-01T10:00:00Z' },
]

// ── Phase 3 Wave 3: Opportunities Data ────────────────────

export const OPPORTUNITIES: Opportunity[] = [
  {
    id: 'opp1', organisation_id: 'org1', title: 'Bermondsey Loft Conversion',
    client_name: 'Chen Family', sector: 'residential', estimated_value: 22000,
    status: 'won', expected_start_date: '2026-05-01', likelihood_percentage: 100,
    owner_user_id: 'u2', notes: 'Referral from Harris Family Trust. Small loft conversion. Quick turnaround.',
    linked_quote_ids: [], created_at: '2026-03-01', updated_at: '2026-03-20'
  },
  {
    id: 'opp2', organisation_id: 'org1', title: 'Hackney Arts Centre Extension',
    client_name: 'LB Hackney', sector: 'public', estimated_value: 120000,
    status: 'proposal_sent', expected_start_date: '2026-09-01', likelihood_percentage: 40,
    owner_user_id: 'u3', notes: 'Public competition entry. Strong concept but competitive field.',
    linked_quote_ids: ['fq4'], created_at: '2026-02-15', updated_at: '2026-03-18'
  },
  {
    id: 'opp3', organisation_id: 'org1', title: 'Richmond Riverside Apartments',
    client_name: 'Thames Vista Developments', sector: 'residential', estimated_value: 210000,
    status: 'qualifying', expected_start_date: '2026-11-01', likelihood_percentage: 25,
    owner_user_id: 'u1', notes: 'Early stage enquiry. 24-unit riverside scheme. Need to confirm planning viability.',
    linked_quote_ids: [], created_at: '2026-03-10', updated_at: '2026-03-15'
  },
  {
    id: 'opp4', organisation_id: 'org1', title: 'Peckham Community Kitchen',
    client_name: 'Peckham Food Co-op', sector: 'community', estimated_value: 35000,
    status: 'negotiation', expected_start_date: '2026-07-01', likelihood_percentage: 70,
    owner_user_id: 'u3', notes: 'Grant-funded community project. Fee negotiation in progress — reduced rate discussed.',
    linked_quote_ids: [], created_at: '2026-01-20', updated_at: '2026-03-12'
  },
  {
    id: 'opp5', organisation_id: 'org1', title: 'Battersea Office Fitout',
    client_name: 'Ark Studios', sector: 'commercial', estimated_value: 55000,
    status: 'lost', likelihood_percentage: 0,
    owner_user_id: 'u2', notes: 'Lost to competitor on price. Client chose lower fee with less experienced practice.',
    linked_quote_ids: [], created_at: '2025-11-01', updated_at: '2026-02-01'
  },
  {
    id: 'opp6', organisation_id: 'org1', title: 'Greenwich School Extension',
    client_name: 'RB Greenwich', sector: 'education', estimated_value: 95000,
    status: 'lead', expected_start_date: '2027-01-01', likelihood_percentage: 15,
    owner_user_id: 'u1', notes: 'Early enquiry via framework. Need to confirm scope and timeline.',
    linked_quote_ids: [], created_at: '2026-03-18', updated_at: '2026-03-18'
  },
]

// ── Lookup Helpers ──────────────────────────────────────────

export function getProjectTasks(projectId: string): Task[] {
  return ALL_TASKS.filter(t => t.project_id === projectId)
}

export function getUser(userId: string): User | undefined {
  return USERS.find(u => u.id === userId)
}

export function getProject(projectId: string): Project | undefined {
  return PROJECTS.find(p => p.id === projectId)
}

export function getProjectApprovals(projectId: string): ApprovalRequest[] {
  return APPROVALS.filter(a => a.project_id === projectId)
}

export function getProjectIssues(projectId: string): Issue[] {
  return ISSUES.filter(i => i.project_id === projectId)
}

export function getProjectChanges(projectId: string): Change[] {
  return CHANGES.filter(c => c.project_id === projectId)
}

export function getProjectRisks(projectId: string): RiskRegisterItem[] {
  return RISK_REGISTER.filter(r => r.project_id === projectId)
}

export function getProjectMeetings(projectId: string): Meeting[] {
  return MEETINGS.filter(m => m.project_id === projectId)
}

export function getMeetingActions(meetingId: string): MeetingAction[] {
  return MEETING_ACTIONS.filter(a => a.meeting_id === meetingId)
}

export function getProjectDesignRisks(projectId: string): DesignRisk[] {
  return DESIGN_RISKS.filter(r => r.project_id === projectId)
}

export function getProjectContractAdmin(projectId: string): ContractAdminRecord | undefined {
  return CONTRACT_ADMIN_RECORDS.find(c => c.project_id === projectId)
}

export function getProjectContractEvents(projectId: string): ContractEvent[] {
  return CONTRACT_EVENTS.filter(e => e.project_id === projectId)
}

export function getProjectPlanningRecords(projectId: string): PlanningRecord[] {
  return PLANNING_RECORDS.filter(p => p.project_id === projectId)
}

export function getProjectSiteConstraints(projectId: string): SiteConstraint[] {
  return SITE_CONSTRAINTS.filter(s => s.project_id === projectId)
}

export function getProjectTenders(projectId: string): TenderRecord[] {
  return TENDER_RECORDS.filter(t => t.project_id === projectId)
}

export function getTenderReturns(tenderRecordId: string): TenderReturn[] {
  return TENDER_RETURNS.filter(r => r.tender_record_id === tenderRecordId)
}

export function getTenderEvaluations(tenderReturnId: string): TenderEvaluation[] {
  return TENDER_EVALUATIONS.filter(e => e.tender_return_id === tenderReturnId)
}

export function getProjectSiteQueries(projectId: string): SiteQuery[] {
  return SITE_QUERIES.filter(q => q.project_id === projectId)
}

// ── Phase 2 Wave 3 Helpers ──────────────────────────────────

export function getProjectBuildingRegs(projectId: string): BuildingRegRecord[] {
  return BUILDING_REG_RECORDS.filter(r => r.project_id === projectId)
}

export function getBuildingInspections(buildingRegId: string): BuildingInspection[] {
  return BUILDING_INSPECTIONS.filter(i => i.building_reg_id === buildingRegId)
}

export function getProjectInspections(projectId: string): BuildingInspection[] {
  return BUILDING_INSPECTIONS.filter(i => i.project_id === projectId)
}

export function getProjectDutyholders(projectId: string): DutyholderRecord[] {
  return DUTYHOLDER_RECORDS.filter(d => d.project_id === projectId)
}

export function getProjectGateways(projectId: string): BRPDGateway[] {
  return BRPD_GATEWAYS.filter(g => g.project_id === projectId)
}

export function getProjectDocuments(projectId: string): DocumentRecord[] {
  return DOCUMENT_RECORDS.filter(d => d.project_id === projectId)
}

export function getProjectTransmittals(projectId: string): DocumentTransmittal[] {
  return DOCUMENT_TRANSMITTALS.filter(t => t.project_id === projectId)
}

// ── Phase 3 Helpers ─────────────────────────────────────────

export function getKnowledgeArticles(): KnowledgeArticle[] {
  return KNOWLEDGE_ARTICLES.filter(a => a.published_flag)
}

export function getKnowledgeArticlesByCategory(category: string): KnowledgeArticle[] {
  return KNOWLEDGE_ARTICLES.filter(a => a.published_flag && a.category === category)
}

export function getKnowledgeArticle(id: string): KnowledgeArticle | undefined {
  return KNOWLEDGE_ARTICLES.find(a => a.id === id)
}

export function getUserCPDRecords(userId: string): CPDRecord[] {
  return CPD_RECORDS.filter(r => r.user_id === userId)
}

export function getAllCPDRecords(): CPDRecord[] {
  return CPD_RECORDS
}

export function getUserCompetencies(userId: string): UserCompetency[] {
  return USER_COMPETENCIES.filter(c => c.user_id === userId)
}

export function getCompetency(id: string): Competency | undefined {
  return COMPETENCIES.find(c => c.id === id)
}

export function getAllCompetencies(): Competency[] {
  return COMPETENCIES
}

export function getUserTrainingPlans(userId: string): TrainingPlan[] {
  return TRAINING_PLANS.filter(p => p.user_id === userId)
}

export function getAllTrainingPlans(): TrainingPlan[] {
  return TRAINING_PLANS
}

export function getOrganisationSettings(): OrganisationSettings {
  return ORGANISATION_SETTINGS[0]
}

export function getJurisdictionPacks(): JurisdictionPack[] {
  return JURISDICTION_PACKS
}

export function getAISourcePermissions(): AISourcePermission[] {
  return AI_SOURCE_PERMISSIONS
}

export function getAILogs(): AILog[] {
  return AI_LOGS
}

// ── Phase 3 Wave 2 Helpers ──────────────────────────────────

export function getProjectDrawingIssues(projectId: string): DrawingIssueRecord[] {
  return DRAWING_ISSUE_RECORDS.filter(r => r.project_id === projectId)
}

export function getAllDrawingIssues(): DrawingIssueRecord[] {
  return DRAWING_ISSUE_RECORDS
}

export function getProjectCommercial(projectId: string): ProjectCommercial | undefined {
  return PROJECT_COMMERCIALS.find(c => c.project_id === projectId)
}

export function getAllProjectCommercials(): ProjectCommercial[] {
  return PROJECT_COMMERCIALS
}

export function getCashflowForecasts(): CashflowForecast[] {
  return CASHFLOW_FORECASTS
}

export function getStaffAllocations(): StaffAllocation[] {
  return STAFF_ALLOCATIONS
}

export function getUserAllocations(userId: string): StaffAllocation[] {
  return STAFF_ALLOCATIONS.filter(a => a.user_id === userId)
}

export function getProjectAllocations(projectId: string): StaffAllocation[] {
  return STAFF_ALLOCATIONS.filter(a => a.project_id === projectId)
}

export function getStaffCapacities(): StaffCapacity[] {
  return STAFF_CAPACITIES
}

// ── Phase 3 Wave 3 Helpers ──────────────────────────────────

export function getFeeRecommendations(): FeeRecommendation[] {
  return FEE_RECOMMENDATIONS
}

export function getFeeRecommendation(id: string): FeeRecommendation | undefined {
  return FEE_RECOMMENDATIONS.find(r => r.id === id)
}

export function getFeeQuoteRecords(): FeeQuoteRecord[] {
  return FEE_QUOTE_RECORDS
}

export function getFeeQuoteRecord(id: string): FeeQuoteRecord | undefined {
  return FEE_QUOTE_RECORDS.find(r => r.id === id)
}

export function getFeeQuoteLineItems(quoteId: string): FeeQuoteLineItem[] {
  return FEE_QUOTE_LINE_ITEMS.filter(i => i.fee_quote_id === quoteId).sort((a, b) => a.sort_order - b.sort_order)
}

export function getProjectFeeQuotes(projectId: string): FeeQuoteRecord[] {
  return FEE_QUOTE_RECORDS.filter(q => q.related_project_id === projectId)
}

// ── Phase 4 Helper Functions ─────────────────────────────────

export function getFeeQuoteSections(quoteId: string): FeeQuoteSection[] {
  return FEE_QUOTE_SECTIONS.filter(s => s.fee_quote_id === quoteId).sort((a, b) => a.sort_order - b.sort_order)
}

export function getFeeQuoteViews(quoteId: string): FeeQuoteView[] {
  return FEE_QUOTE_VIEWS.filter(v => v.fee_quote_id === quoteId)
}

export function getFeeQuoteTemplates(): FeeQuoteTemplate[] {
  return FEE_QUOTE_TEMPLATES.filter(t => t.active_flag)
}

export function getTermsLibrary(): TermsLibraryItem[] {
  return TERMS_LIBRARY.filter(t => t.active_flag)
}

export function getExclusionsLibrary(): ExclusionsLibraryItem[] {
  return EXCLUSIONS_LIBRARY.filter(e => e.active_flag)
}

export function getProjectHealthSnapshots(projectId: string): ProjectHealthSnapshot[] {
  return PROJECT_HEALTH_SNAPSHOTS.filter(s => s.project_id === projectId).sort((a, b) => new Date(a.snapshot_date).getTime() - new Date(b.snapshot_date).getTime())
}

export function getAllHealthSnapshots(): ProjectHealthSnapshot[] {
  return PROJECT_HEALTH_SNAPSHOTS
}

export function getProjectNumberTemplates(): ProjectNumberTemplate[] {
  return PROJECT_NUMBER_TEMPLATES
}

export function getQuoteNumberTemplates(): QuoteNumberTemplate[] {
  return QUOTE_NUMBER_TEMPLATES
}

export function getDrawingIssueTemplates(): DrawingIssueTemplate[] {
  return DRAWING_ISSUE_TEMPLATES
}

export function getOpportunities(): Opportunity[] {
  return OPPORTUNITIES
}

export function getOpportunity(id: string): Opportunity | undefined {
  return OPPORTUNITIES.find(o => o.id === id)
}

export function getOpportunityQuotes(opportunityId: string): FeeQuoteRecord[] {
  return FEE_QUOTE_RECORDS.filter(q => q.related_opportunity_id === opportunityId)
}

// ── Phase 3 Wave 4: AI Teammate Mock Data ──────────────────

const AI_SUGGESTED_PROMPTS: AISuggestedPrompt[] = [
  { id: 'sp-1', label: 'Portfolio risk summary', prompt: 'What are the top risks across my active projects?', scope: 'global', category: 'Risk' },
  { id: 'sp-2', label: 'Overdue tasks', prompt: 'Which tasks are overdue across all projects?', scope: 'global', category: 'Tasks' },
  { id: 'sp-3', label: 'Staffing gaps', prompt: 'Are there any staffing conflicts or over-allocations this month?', scope: 'global', category: 'Staffing' },
  { id: 'sp-4', label: 'Upcoming deadlines', prompt: 'What key milestones are coming up in the next 2 weeks?', scope: 'global', category: 'Planning' },
  { id: 'sp-5', label: 'Compliance check', prompt: 'Are all building reg submissions on track?', scope: 'global', category: 'Compliance' },
  { id: 'sp-6', label: 'Stage progress', prompt: 'What is the current stage progress and what tasks remain?', scope: 'project', category: 'Progress' },
  { id: 'sp-7', label: 'Project risks', prompt: 'What are the active risks and design risks on this project?', scope: 'project', category: 'Risk' },
  { id: 'sp-8', label: 'Contract dates', prompt: 'What are the key contract dates and upcoming deadlines?', scope: 'project', category: 'Contract' },
  { id: 'sp-9', label: 'Budget status', prompt: 'What is the current fee position and any commercial risks?', scope: 'project', category: 'Commercial' },
  { id: 'sp-10', label: 'Meeting actions', prompt: 'What outstanding actions are there from recent meetings?', scope: 'project', category: 'Meetings' },
]

const AI_CONVERSATIONS: AIConversation[] = [
  {
    id: 'conv-1',
    organisation_id: 'org-1',
    project_id: undefined,
    title: 'Portfolio risk overview',
    started_by_user_id: 'user-1',
    messages: [
      {
        id: 'msg-1',
        conversation_id: 'conv-1',
        role: 'user',
        content: 'What are the top risks across my active projects?',
        timestamp: '2025-01-15T09:00:00Z',
      },
      {
        id: 'msg-2',
        conversation_id: 'conv-1',
        role: 'assistant',
        content: 'Based on the current portfolio, I can see 3 key risk areas:\n\n1. **Riverside House Extension** — Stage 4 has 2 overdue required tasks (structural specification review and M&E coordination). The project lead James Chen flagged a resource conflict with the Clapham scheme.\n\n2. **Clapham Mixed-Use** — Planning condition discharge is 5 days overdue. There are outstanding design risk items around the party wall with No. 14 that need resolution before Stage 5 can commence.\n\n3. **Weybridge School Refurb** — Building regulations submission was returned with queries on fire strategy compartmentation. The re-submission deadline is in 8 days.\n\nWould you like me to drill into any of these?',
        sources: [
          { type: 'project', title: 'Riverside House Extension', reference_id: 'proj-1' },
          { type: 'project', title: 'Clapham Mixed-Use', reference_id: 'proj-2' },
          { type: 'risk', title: 'Fire strategy queries', reference_id: 'proj-3' },
        ],
        timestamp: '2025-01-15T09:00:05Z',
      },
      {
        id: 'msg-3',
        conversation_id: 'conv-1',
        role: 'user',
        content: 'Tell me more about the Clapham party wall issue.',
        timestamp: '2025-01-15T09:01:00Z',
      },
      {
        id: 'msg-4',
        conversation_id: 'conv-1',
        role: 'assistant',
        content: 'The party wall issue on Clapham Mixed-Use relates to the shared boundary with No. 14 Clapham High Street. Here are the details:\n\n- **Design Risk DR-002**: Party wall notice was served but the adjoining owner has appointed a surveyor who is requesting additional structural details about the proposed steel frame connection.\n- **Impact**: This is blocking the Stage 5 technical sign-off. The structural engineer needs to provide calculations showing load transfer won\'t affect the party wall.\n- **Timeline**: The Party Wall Act requires a 14-day response period. If not resolved, it could delay construction start by 3-4 weeks.\n- **Action Required**: Priya Sharma (project lead) needs to coordinate between the structural engineer and the adjoining owner\'s surveyor.\n\nI\'d recommend raising this at the next project review meeting scheduled for Friday.',
        sources: [
          { type: 'risk', title: 'Party wall — No. 14 boundary', reference_id: 'dr-2' },
          { type: 'project', title: 'Clapham Mixed-Use', reference_id: 'proj-2' },
        ],
        timestamp: '2025-01-15T09:01:05Z',
      },
    ],
    created_at: '2025-01-15T09:00:00Z',
    updated_at: '2025-01-15T09:01:05Z',
  },
  {
    id: 'conv-2',
    organisation_id: 'org-1',
    project_id: 'proj-1',
    title: 'Riverside stage progress',
    started_by_user_id: 'user-2',
    messages: [
      {
        id: 'msg-5',
        conversation_id: 'conv-2',
        role: 'user',
        content: 'What is the current stage progress for Riverside?',
        timestamp: '2025-01-14T14:30:00Z',
      },
      {
        id: 'msg-6',
        conversation_id: 'conv-2',
        role: 'assistant',
        content: 'Riverside House Extension is currently at **RIBA Stage 4 — Technical Design** with the following progress:\n\n- **Overall completion**: 68% (across all stages)\n- **Stage 4 completion**: 45% (9 of 20 tasks complete)\n- **Overdue tasks**: 2 (structural spec review, M&E coordination drawing)\n- **Blocked tasks**: 1 (waiting on structural engineer response)\n\nKey upcoming milestones:\n- Building regs submission — due in 12 days\n- Stage 4 sign-off meeting — scheduled 22 Jan\n- Client design freeze confirmation — awaiting\n\nThe main bottleneck is the structural specification, which is blocking 3 downstream tasks.',
        sources: [
          { type: 'project', title: 'Riverside House Extension', reference_id: 'proj-1' },
          { type: 'task', title: 'Structural spec review', reference_id: 'task-4-1' },
        ],
        timestamp: '2025-01-14T14:30:05Z',
      },
    ],
    created_at: '2025-01-14T14:30:00Z',
    updated_at: '2025-01-14T14:30:05Z',
  },
  {
    id: 'conv-3',
    organisation_id: 'org-1',
    project_id: undefined,
    title: 'Staffing conflicts check',
    started_by_user_id: 'user-1',
    messages: [
      {
        id: 'msg-7',
        conversation_id: 'conv-3',
        role: 'user',
        content: 'Are there any staffing conflicts this month?',
        timestamp: '2025-01-13T11:00:00Z',
      },
      {
        id: 'msg-8',
        conversation_id: 'conv-3',
        role: 'assistant',
        content: 'I can see two staffing concerns for January:\n\n1. **James Chen** is allocated at 110% capacity — he\'s splitting time between Riverside House (60%) and Weybridge School (50%). This is unsustainable and likely contributing to the overdue tasks on Riverside.\n\n2. **Tom Davies** has a gap from 20 Jan — his Dulwich Garden Studio project reaches Stage 6 handover, and he doesn\'t have a new project allocation lined up. Good opportunity to reassign him to help with the Clapham Stage 5 push.\n\nNo conflicts for Priya Sharma or Amara Okafor — both are at healthy utilisation levels (75-85%).',
        sources: [
          { type: 'project', title: 'Staff allocations overview', reference_id: 'staffing' },
        ],
        timestamp: '2025-01-13T11:00:05Z',
      },
    ],
    created_at: '2025-01-13T11:00:00Z',
    updated_at: '2025-01-13T11:00:05Z',
  },
]

// ── Phase 3 Wave 4: Integrations Mock Data ─────────────────

const INTEGRATIONS: Integration[] = [
  {
    id: 'int-1',
    organisation_id: 'org-1',
    provider: 'xero',
    display_name: 'Xero',
    description: 'Accounting & invoicing. Syncs fee invoices, purchase orders, and expense claims with project commercial data.',
    status: 'connected',
    connected_by_user_id: 'user-1',
    connected_at: '2024-11-01T10:00:00Z',
    last_sync_at: '2025-01-15T08:30:00Z',
    sync_frequency_minutes: 60,
    config: { company_name: 'Mitchell Architecture Ltd', tax_scheme: 'standard' },
    category: 'accounting',
  },
  {
    id: 'int-2',
    organisation_id: 'org-1',
    provider: 'quickbooks',
    display_name: 'QuickBooks',
    description: 'Alternative accounting integration. Syncs invoices, time tracking, and expense data.',
    status: 'disconnected',
    config: {},
    category: 'accounting',
  },
  {
    id: 'int-3',
    organisation_id: 'org-1',
    provider: 'outlook',
    display_name: 'Microsoft Outlook',
    description: 'Calendar & email. Syncs project meetings, deadlines, and milestone reminders to team calendars.',
    status: 'connected',
    connected_by_user_id: 'user-1',
    connected_at: '2024-10-15T09:00:00Z',
    last_sync_at: '2025-01-15T09:00:00Z',
    sync_frequency_minutes: 15,
    config: { calendar_name: 'Practice Calendar', sync_meetings: 'true', sync_deadlines: 'true' },
    category: 'calendar',
  },
  {
    id: 'int-4',
    organisation_id: 'org-1',
    provider: 'google_calendar',
    display_name: 'Google Calendar',
    description: 'Calendar sync for practices using Google Workspace. Syncs meetings and deadlines.',
    status: 'disconnected',
    config: {},
    category: 'calendar',
  },
  {
    id: 'int-5',
    organisation_id: 'org-1',
    provider: 'sharepoint',
    display_name: 'SharePoint',
    description: 'Document storage. Links project documents to SharePoint libraries for version control and collaboration.',
    status: 'error',
    connected_by_user_id: 'user-1',
    connected_at: '2024-12-01T14:00:00Z',
    last_sync_at: '2025-01-10T06:00:00Z',
    sync_frequency_minutes: 30,
    config: { site_url: 'https://mitchellarch.sharepoint.com', error_message: 'Authentication token expired. Please reconnect.' },
    category: 'storage',
  },
  {
    id: 'int-6',
    organisation_id: 'org-1',
    provider: 'dropbox',
    display_name: 'Dropbox Business',
    description: 'Cloud storage integration for drawing files, specifications, and project archives.',
    status: 'disconnected',
    config: {},
    category: 'storage',
  },
]

// ── Phase 3 Wave 4: Portal Mock Data ───────────────────────

const PORTAL_INVITES: PortalInvite[] = [
  {
    id: 'pinv-1',
    project_id: 'proj-1',
    email: 'david.thornton@gmail.com',
    name: 'David Thornton',
    organisation: 'Private Client',
    role: 'Client',
    access_level: 'approve',
    invited_by_user_id: 'user-2',
    accepted: true,
    invited_at: '2024-11-20T10:00:00Z',
    last_accessed_at: '2025-01-14T16:30:00Z',
  },
  {
    id: 'pinv-2',
    project_id: 'proj-1',
    email: 'mark.webb@webbstructural.co.uk',
    name: 'Mark Webb',
    organisation: 'Webb Structural Engineers',
    role: 'Structural Engineer',
    access_level: 'comment',
    invited_by_user_id: 'user-2',
    accepted: true,
    invited_at: '2024-11-20T10:05:00Z',
    last_accessed_at: '2025-01-12T09:15:00Z',
  },
  {
    id: 'pinv-3',
    project_id: 'proj-2',
    email: 'sarah.green@claphamdevs.com',
    name: 'Sarah Green',
    organisation: 'Clapham Developments Ltd',
    role: 'Client',
    access_level: 'approve',
    invited_by_user_id: 'user-3',
    accepted: true,
    invited_at: '2024-10-01T08:00:00Z',
    last_accessed_at: '2025-01-15T11:00:00Z',
  },
  {
    id: 'pinv-4',
    project_id: 'proj-2',
    email: 'raj.patel@lambethplanning.gov.uk',
    name: 'Raj Patel',
    organisation: 'Lambeth Planning',
    role: 'Planning Consultant',
    access_level: 'view_only',
    invited_by_user_id: 'user-3',
    accepted: false,
    invited_at: '2025-01-10T14:00:00Z',
  },
  {
    id: 'pinv-5',
    project_id: 'proj-3',
    email: 'helen.morris@surreycountycouncil.gov.uk',
    name: 'Helen Morris',
    organisation: 'Surrey County Council',
    role: 'Client',
    access_level: 'approve',
    invited_by_user_id: 'user-1',
    accepted: true,
    invited_at: '2024-09-15T10:00:00Z',
    last_accessed_at: '2025-01-08T14:45:00Z',
  },
]

const PORTAL_SHARED_ITEMS: PortalSharedItem[] = [
  {
    id: 'psi-1',
    project_id: 'proj-1',
    item_type: 'document',
    item_id: 'doc-1',
    title: 'Stage 3 Design Report',
    shared_at: '2025-01-05T10:00:00Z',
    shared_by_user_id: 'user-2',
    visible_to_portal_invite_ids: ['pinv-1', 'pinv-2'],
    requires_sign_off: true,
    signed_off_by: 'David Thornton',
    signed_off_at: '2025-01-07T16:00:00Z',
  },
  {
    id: 'psi-2',
    project_id: 'proj-1',
    item_type: 'drawing',
    item_id: 'dwg-1',
    title: 'Ground Floor GA Drawing Rev C',
    shared_at: '2025-01-10T09:30:00Z',
    shared_by_user_id: 'user-2',
    visible_to_portal_invite_ids: ['pinv-1', 'pinv-2'],
    requires_sign_off: false,
  },
  {
    id: 'psi-3',
    project_id: 'proj-1',
    item_type: 'approval',
    item_id: 'appr-1',
    title: 'Stage 4 Client Design Approval',
    shared_at: '2025-01-12T11:00:00Z',
    shared_by_user_id: 'user-2',
    visible_to_portal_invite_ids: ['pinv-1'],
    requires_sign_off: true,
  },
  {
    id: 'psi-4',
    project_id: 'proj-2',
    item_type: 'report',
    item_id: 'rpt-1',
    title: 'Planning Application Pack',
    shared_at: '2025-01-08T14:00:00Z',
    shared_by_user_id: 'user-3',
    visible_to_portal_invite_ids: ['pinv-3', 'pinv-4'],
    requires_sign_off: true,
    signed_off_by: 'Sarah Green',
    signed_off_at: '2025-01-09T10:30:00Z',
  },
  {
    id: 'psi-5',
    project_id: 'proj-2',
    item_type: 'meeting_minutes',
    item_id: 'mm-1',
    title: 'Design Team Meeting #12 Minutes',
    shared_at: '2025-01-14T17:00:00Z',
    shared_by_user_id: 'user-3',
    visible_to_portal_invite_ids: ['pinv-3'],
    requires_sign_off: false,
  },
  {
    id: 'psi-6',
    project_id: 'proj-3',
    item_type: 'document',
    item_id: 'doc-3',
    title: 'Feasibility Study & Options Appraisal',
    shared_at: '2024-12-20T10:00:00Z',
    shared_by_user_id: 'user-1',
    visible_to_portal_invite_ids: ['pinv-5'],
    requires_sign_off: true,
    signed_off_by: 'Helen Morris',
    signed_off_at: '2024-12-22T09:00:00Z',
  },
]

// ── Phase 3 Wave 4 Helpers ─────────────────────────────────

export function getAISuggestedPrompts(scope?: 'global' | 'project'): AISuggestedPrompt[] {
  if (scope) return AI_SUGGESTED_PROMPTS.filter(p => p.scope === scope)
  return AI_SUGGESTED_PROMPTS
}

export function getAIConversations(projectId?: string): AIConversation[] {
  if (projectId) return AI_CONVERSATIONS.filter(c => c.project_id === projectId)
  return AI_CONVERSATIONS.filter(c => !c.project_id)
}

export function getAIConversation(id: string): AIConversation | undefined {
  return AI_CONVERSATIONS.find(c => c.id === id)
}

export function getAllAIConversations(): AIConversation[] {
  return AI_CONVERSATIONS
}

export function getIntegrations(): Integration[] {
  return INTEGRATIONS
}

export function getIntegration(id: string): Integration | undefined {
  return INTEGRATIONS.find(i => i.id === id)
}

export function getIntegrationsByCategory(category: 'accounting' | 'calendar' | 'storage'): Integration[] {
  return INTEGRATIONS.filter(i => i.category === category)
}

export function getPortalInvites(projectId?: string): PortalInvite[] {
  if (projectId) return PORTAL_INVITES.filter(i => i.project_id === projectId)
  return PORTAL_INVITES
}

export function getPortalSharedItems(projectId?: string): PortalSharedItem[] {
  if (projectId) return PORTAL_SHARED_ITEMS.filter(i => i.project_id === projectId)
  return PORTAL_SHARED_ITEMS
}

export function getPortalItemsForInvite(inviteId: string): PortalSharedItem[] {
  return PORTAL_SHARED_ITEMS.filter(i => i.visible_to_portal_invite_ids.includes(inviteId))
}

// ── Phase 4 Wave 2: Health Engine Data ──────────────────────

const PROJECT_HEALTH_ALERTS: ProjectHealthAlert[] = [
  // p1 — Riverside House Extension
  { id: 'pha-1', project_id: 'p1', category: 'burn_rate', severity: 'warning', title: 'Stage 3 burn rate above budget', description: 'Detailed design hours are 12% over budgeted allocation. Current burn ratio 1.12 against stage budget.', metric_value: 1.12, threshold_value: 1.0, suggested_action: 'Review remaining scope items with project lead. Consider submitting a variation for additional design coordination.', acknowledged_flag: false, created_at: '2026-03-15T10:00:00Z' },
  { id: 'pha-2', project_id: 'p1', category: 'scope_creep', severity: 'info', title: 'Additional planning revision requested', description: 'Client requested minor amendments to planning drawings post-submission. 8 hours additional work estimated.', metric_value: 8, threshold_value: 0, suggested_action: 'Log as variation and confirm fee impact with client before proceeding.', acknowledged_flag: true, acknowledged_by_user_id: 'u2', acknowledged_at: '2026-03-16T09:00:00Z', created_at: '2026-03-14T14:00:00Z' },

  // p2 — Clapham Mixed-Use
  { id: 'pha-3', project_id: 'p2', category: 'billing_gap', severity: 'warning', title: 'Invoice gap: 6 weeks since last bill', description: 'Last invoice was raised on 2 Feb. Current WIP of £14,000 is unbilled. Practice cashflow may be impacted.', metric_value: 42, threshold_value: 30, suggested_action: 'Raise Stage 2 interim invoice this week. WIP should be billed monthly per agreement.', acknowledged_flag: false, created_at: '2026-03-10T11:00:00Z' },
  { id: 'pha-4', project_id: 'p2', category: 'programme_delay', severity: 'info', title: 'Pre-app meeting delayed by 2 weeks', description: 'LPA pushed pre-application meeting from 10 Mar to 24 Mar. No fee impact but programme is now 2 weeks behind.', metric_value: 14, threshold_value: 7, suggested_action: 'Update programme and notify client. Consider whether this affects Stage 2 completion date.', acknowledged_flag: true, acknowledged_by_user_id: 'u3', acknowledged_at: '2026-03-12T08:00:00Z', created_at: '2026-03-08T16:00:00Z' },

  // p3 — Weybridge School Refurb
  { id: 'pha-5', project_id: 'p3', category: 'margin_erosion', severity: 'critical', title: 'Forecast margin below 5%', description: 'Current forecast margin is 8% but trending down. Technical coordination overruns have consumed contingency. Risk of fee loss if trend continues.', metric_value: 8, threshold_value: 10, suggested_action: 'Urgent: review remaining scope and submit variation order for additional coordination works.', acknowledged_flag: false, created_at: '2026-03-05T09:00:00Z' },
  { id: 'pha-6', project_id: 'p3', category: 'fee_overrun', severity: 'critical', title: 'Stage 4 technical design 22% over budget', description: 'Stage 4 hours have exceeded budget by 22%. Multiple coordination issues with structural engineer and M&E consultant.', metric_value: 1.22, threshold_value: 1.0, suggested_action: 'Freeze non-essential design work. Raise formal variation for consultant coordination. Escalate to practice principal.', acknowledged_flag: false, created_at: '2026-03-01T11:00:00Z' },
  { id: 'pha-7', project_id: 'p3', category: 'near_loss', severity: 'critical', title: 'Project approaching loss-making territory', description: 'If current burn rate continues, project will become loss-making within 4 weeks. Immediate intervention required.', metric_value: 2, threshold_value: 5, suggested_action: 'Arrange fee review meeting with practice principal. Prepare fee impact assessment and variation request.', acknowledged_flag: false, created_at: '2026-02-28T14:00:00Z' },

  // p5 — Dulwich Home Studio
  { id: 'pha-8', project_id: 'p5', category: 'burn_rate', severity: 'warning', title: 'Small project approaching fee cap', description: 'Only £2,000 of agreed fee remaining with 25 hours of estimated work. Current hourly rate has dropped to £72/hr vs target £95/hr.', metric_value: 72, threshold_value: 95, suggested_action: 'Review remaining deliverables and prioritise. Consider whether Stage 6 site visits can be reduced.', acknowledged_flag: false, created_at: '2026-03-18T10:00:00Z' },

  // p6 — Southwark Workspace Conversion (on hold)
  { id: 'pha-9', project_id: 'p6', category: 'billing_gap', severity: 'warning', title: 'Unbilled WIP on paused project', description: 'Project is effectively paused but £5,000 of WIP remains unbilled from pre-pause work. Risk of write-off if not invoiced soon.', metric_value: 90, threshold_value: 60, suggested_action: 'Raise final pre-pause invoice immediately. Confirm with client whether project will resume.', acknowledged_flag: false, created_at: '2026-01-15T09:00:00Z' },
]

const BURN_BUDGET_METRICS: BurnBudgetMetric[] = [
  // p1 — Riverside House (Stage 0-3)
  { project_id: 'p1', stage: 0, stage_label: 'Strategic Definition', budgeted_hours: 20, actual_hours: 18, budgeted_fee: 2400, actual_fee_earned: 2400, burn_ratio: 0.90, variance_percent: -10 },
  { project_id: 'p1', stage: 1, stage_label: 'Preparation & Briefing', budgeted_hours: 40, actual_hours: 38, budgeted_fee: 4800, actual_fee_earned: 4800, burn_ratio: 0.95, variance_percent: -5 },
  { project_id: 'p1', stage: 2, stage_label: 'Concept Design', budgeted_hours: 80, actual_hours: 85, budgeted_fee: 9600, actual_fee_earned: 9600, burn_ratio: 1.06, variance_percent: 6 },
  { project_id: 'p1', stage: 3, stage_label: 'Spatial Coordination', budgeted_hours: 120, actual_hours: 134, budgeted_fee: 14400, actual_fee_earned: 14400, burn_ratio: 1.12, variance_percent: 12 },

  // p3 — Weybridge School (Stage 0-4)
  { project_id: 'p3', stage: 0, stage_label: 'Strategic Definition', budgeted_hours: 15, actual_hours: 14, budgeted_fee: 1800, actual_fee_earned: 1800, burn_ratio: 0.93, variance_percent: -7 },
  { project_id: 'p3', stage: 1, stage_label: 'Preparation & Briefing', budgeted_hours: 30, actual_hours: 28, budgeted_fee: 3600, actual_fee_earned: 3600, burn_ratio: 0.93, variance_percent: -7 },
  { project_id: 'p3', stage: 2, stage_label: 'Concept Design', budgeted_hours: 60, actual_hours: 62, budgeted_fee: 7200, actual_fee_earned: 7200, burn_ratio: 1.03, variance_percent: 3 },
  { project_id: 'p3', stage: 3, stage_label: 'Spatial Coordination', budgeted_hours: 100, actual_hours: 115, budgeted_fee: 12000, actual_fee_earned: 12000, burn_ratio: 1.15, variance_percent: 15 },
  { project_id: 'p3', stage: 4, stage_label: 'Technical Design', budgeted_hours: 200, actual_hours: 244, budgeted_fee: 24000, actual_fee_earned: 24000, burn_ratio: 1.22, variance_percent: 22 },
]

const QUOTE_PROJECT_LINKS: QuoteProjectLink[] = [
  { id: 'qpl-1', fee_quote_id: 'fq-1', project_id: 'p1', linked_at: '2025-09-01T10:00:00Z', linked_by_user_id: 'u1', auto_created_flag: true, project_creation_status: 'created' },
  { id: 'qpl-2', fee_quote_id: 'fq-2', project_id: 'p2', linked_at: '2025-11-15T14:00:00Z', linked_by_user_id: 'u1', auto_created_flag: false, project_creation_status: 'created' },
  { id: 'qpl-3', fee_quote_id: 'fq-3', project_id: undefined, linked_at: undefined, linked_by_user_id: undefined, auto_created_flag: false, project_creation_status: 'pending' },
  { id: 'qpl-4', fee_quote_id: 'fq-4', project_id: undefined, linked_at: undefined, linked_by_user_id: undefined, auto_created_flag: false, project_creation_status: 'pending' },
  { id: 'qpl-5', fee_quote_id: 'fq-5', project_id: undefined, linked_at: undefined, linked_by_user_id: undefined, auto_created_flag: false, project_creation_status: 'skipped' },
]

const QUOTE_CONVERSION_METRICS: QuoteConversionMetric[] = [
  { sector: 'Residential', total_quotes: 12, accepted_quotes: 5, win_rate: 41.7, total_value: 285000, won_value: 118000, avg_days_to_accept: 18, avg_quote_value: 23750 },
  { sector: 'Commercial', total_quotes: 6, accepted_quotes: 1, win_rate: 16.7, total_value: 420000, won_value: 85000, avg_days_to_accept: 32, avg_quote_value: 70000 },
  { sector: 'Education', total_quotes: 4, accepted_quotes: 2, win_rate: 50.0, total_value: 310000, won_value: 167000, avg_days_to_accept: 45, avg_quote_value: 77500 },
  { sector: 'Public', total_quotes: 3, accepted_quotes: 0, win_rate: 0.0, total_value: 390000, won_value: 0, avg_days_to_accept: 0, avg_quote_value: 130000 },
  { sector: 'Community', total_quotes: 2, accepted_quotes: 1, win_rate: 50.0, total_value: 65000, won_value: 35000, avg_days_to_accept: 22, avg_quote_value: 32500 },
]

// ── Phase 4 Wave 2: Helper Functions ────────────────────────

export function getProjectHealthAlerts(projectId: string): ProjectHealthAlert[] {
  return PROJECT_HEALTH_ALERTS.filter(a => a.project_id === projectId).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
}

export function getAllHealthAlerts(): ProjectHealthAlert[] {
  return PROJECT_HEALTH_ALERTS.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
}

export function getUnacknowledgedAlerts(projectId?: string): ProjectHealthAlert[] {
  const alerts = projectId ? PROJECT_HEALTH_ALERTS.filter(a => a.project_id === projectId) : PROJECT_HEALTH_ALERTS
  return alerts.filter(a => !a.acknowledged_flag).sort((a, b) => {
    const sevOrder = { critical: 0, warning: 1, info: 2 }
    return sevOrder[a.severity] - sevOrder[b.severity]
  })
}

export function getBurnBudgetMetrics(projectId: string): BurnBudgetMetric[] {
  return BURN_BUDGET_METRICS.filter(m => m.project_id === projectId).sort((a, b) => a.stage - b.stage)
}

export function getQuoteProjectLink(quoteId: string): QuoteProjectLink | undefined {
  return QUOTE_PROJECT_LINKS.find(l => l.fee_quote_id === quoteId)
}

export function getQuoteProjectLinks(): QuoteProjectLink[] {
  return QUOTE_PROJECT_LINKS
}

export function getQuoteConversionMetrics(): QuoteConversionMetric[] {
  return QUOTE_CONVERSION_METRICS
}

// ── Phase 4 Wave 3: BRPD Compliance & Drawing Workflow Data ─

export const COMPLIANCE_STATEMENTS: ComplianceStatement[] = [
  { id: 'cs1', project_id: 'p2', title: 'Fire Safety Strategy Compliance', description: 'Confirm fire safety strategy meets BS 9991 and Approved Document B requirements for higher-risk residential building.', regulation_ref: 'ADB Vol 2 / BS 9991:2015', responsible_dutyholder_id: 'dh7', status: 'approved', evidence_document_ids: ['doc8'], due_date: '2026-04-01', submitted_date: '2026-03-20', approved_date: '2026-03-28', approved_by_user_id: 'u1', created_at: '2026-02-01', updated_at: '2026-03-28' },
  { id: 'cs2', project_id: 'p2', title: 'Structural Stability Statement', description: 'Confirm structural design meets Building Regulations Part A and relevant Eurocodes.', regulation_ref: 'Part A / EN 1990-1999', responsible_dutyholder_id: 'dh7', status: 'under_review', evidence_document_ids: [], due_date: '2026-05-15', submitted_date: '2026-04-10', created_at: '2026-02-15', updated_at: '2026-04-10' },
  { id: 'cs3', project_id: 'p2', title: 'Accessibility Compliance', description: 'Demonstrate compliance with Part M including wheelchair-accessible units and common areas.', regulation_ref: 'Part M Vol 1 & 2', responsible_dutyholder_id: 'dh6', status: 'draft', evidence_document_ids: [], due_date: '2026-06-01', created_at: '2026-03-01', updated_at: '2026-03-01' },
  { id: 'cs4', project_id: 'p1', title: 'Energy Performance Statement', description: 'Confirm compliance with Part L conservation of fuel and power for domestic extension.', regulation_ref: 'Part L1B 2021', responsible_dutyholder_id: 'dh2', status: 'approved', evidence_document_ids: ['doc1', 'doc2'], due_date: '2026-02-28', submitted_date: '2026-02-20', approved_date: '2026-02-25', approved_by_user_id: 'u1', created_at: '2025-12-01', updated_at: '2026-02-25' },
  { id: 'cs5', project_id: 'p1', title: 'Party Wall Compliance', description: 'Confirm Party Wall Act obligations discharged. Awards in place for shared boundary works.', regulation_ref: 'Party Wall Act 1996', responsible_dutyholder_id: 'dh1', status: 'expired', evidence_document_ids: ['doc7'], due_date: '2026-01-15', submitted_date: '2026-01-10', approved_date: '2026-01-12', approved_by_user_id: 'u2', notes: 'Award expired — renewal required before Stage 5.', created_at: '2025-10-01', updated_at: '2026-03-15' },
  { id: 'cs6', project_id: 'p3', title: 'CDM Compliance Statement', description: 'Principal Designer compliance with CDM 2015 Regulations for education project.', regulation_ref: 'CDM 2015 Reg 9-12', responsible_dutyholder_id: 'dh4', status: 'approved', evidence_document_ids: ['doc4', 'doc5'], due_date: '2025-12-01', submitted_date: '2025-11-25', approved_date: '2025-11-30', approved_by_user_id: 'u1', created_at: '2025-09-01', updated_at: '2025-11-30' },
  { id: 'cs7', project_id: 'p3', title: 'Asbestos Management Compliance', description: 'Confirm asbestos survey completed and management plan in place per Control of Asbestos Regulations 2012.', regulation_ref: 'CAR 2012 / HSG 264', responsible_dutyholder_id: 'dh5', status: 'under_review', evidence_document_ids: ['doc5'], due_date: '2026-04-15', submitted_date: '2026-04-01', created_at: '2025-10-01', updated_at: '2026-04-01' },
]

export const BRPD_REQUIREMENTS: BRPDRequirement[] = [
  { id: 'br1', project_id: 'p2', gateway_number: 1, requirement_ref: 'GW1-REQ-001', title: 'Fire & Emergency File', description: 'Submit fire strategy and emergency evacuation plan to BSR.', status: 'in_progress', assigned_dutyholder_id: 'dh7', target_date: '2026-05-15', category: 'fire' },
  { id: 'br2', project_id: 'p2', gateway_number: 1, requirement_ref: 'GW1-REQ-002', title: 'Structural Design Information', description: 'Provide structural design basis and key design decisions.', status: 'not_started', assigned_dutyholder_id: 'dh7', target_date: '2026-05-15', category: 'structural' },
  { id: 'br3', project_id: 'p2', gateway_number: 1, requirement_ref: 'GW1-REQ-003', title: 'Principal Designer Competence', description: 'Evidence of Principal Designer competence and organisational capability.', status: 'evidenced', assigned_dutyholder_id: 'dh7', evidence_notes: 'ARB registration + PD training certificates uploaded.', target_date: '2026-04-01', completed_date: '2026-03-25', category: 'safety' },
  { id: 'br4', project_id: 'p2', gateway_number: 1, requirement_ref: 'GW1-REQ-004', title: 'Accessibility Strategy', description: 'Submit accessibility design strategy per Part M Volume 2.', status: 'not_started', assigned_dutyholder_id: 'dh6', target_date: '2026-05-30', category: 'accessibility' },
  { id: 'br5', project_id: 'p2', gateway_number: 2, requirement_ref: 'GW2-REQ-001', title: 'Construction Control Plan', description: 'Submit construction phase plan and control measures.', status: 'not_started', target_date: '2026-12-01', category: 'safety' },
  { id: 'br6', project_id: 'p2', gateway_number: 2, requirement_ref: 'GW2-REQ-002', title: 'Mandatory Occurrence Reporting', description: 'Establish mandatory occurrence reporting system for construction phase.', status: 'not_started', target_date: '2026-12-01', category: 'safety' },
  { id: 'br7', project_id: 'p2', gateway_number: 3, requirement_ref: 'GW3-REQ-001', title: 'Golden Thread Information', description: 'Complete golden thread of building information for handover to accountable person.', status: 'not_started', target_date: '2027-08-01', category: 'safety' },
  { id: 'br8', project_id: 'p2', gateway_number: 1, requirement_ref: 'GW1-REQ-005', title: 'Environmental Impact Assessment', description: 'Submit environmental impact assessment and sustainability statement.', status: 'verified', assigned_dutyholder_id: 'dh7', evidence_notes: 'BREEAM pre-assessment submitted. Rating: Very Good.', target_date: '2026-04-01', completed_date: '2026-03-20', verified_by_user_id: 'u1', category: 'environmental' },
]

export const BRPD_CHANGELOG: BRPDChangelogEntry[] = [
  { id: 'cl1', project_id: 'p2', change_type: 'dutyholder_change', title: 'Principal Designer appointed', description: 'Priya Sharma (Studio Mitchell) appointed as Principal Designer for Meridian Tower.', reference_id: 'dh7', changed_by_user_id: 'u1', changed_at: '2025-12-01', approved_flag: true, approved_by_user_id: 'u1' },
  { id: 'cl2', project_id: 'p2', change_type: 'gateway_update', title: 'Gateway 1 target date confirmed', description: 'BSR pre-application meeting held. Gateway 1 target date set to 01 Jun 2026.', reference_id: 'gw1', previous_value: 'TBC', new_value: '2026-06-01', changed_by_user_id: 'u3', changed_at: '2026-01-15', approved_flag: true, approved_by_user_id: 'u1' },
  { id: 'cl3', project_id: 'p2', change_type: 'compliance_update', title: 'Fire Safety Strategy approved', description: 'Fire safety strategy compliance statement reviewed and approved by Practice Director.', reference_id: 'cs1', previous_value: 'under_review', new_value: 'approved', changed_by_user_id: 'u1', changed_at: '2026-03-28', approved_flag: true, approved_by_user_id: 'u1' },
  { id: 'cl4', project_id: 'p2', change_type: 'evidence_upload', title: 'PD competence evidence uploaded', description: 'ARB registration certificate and Principal Designer training records uploaded.', reference_id: 'br3', changed_by_user_id: 'u3', changed_at: '2026-03-25', approved_flag: false },
  { id: 'cl5', project_id: 'p2', change_type: 'requirement_update', title: 'Environmental assessment verified', description: 'BREEAM pre-assessment submitted and verified. Rating: Very Good.', reference_id: 'br8', previous_value: 'evidenced', new_value: 'verified', changed_by_user_id: 'u1', changed_at: '2026-03-22', approved_flag: true, approved_by_user_id: 'u1' },
  { id: 'cl6', project_id: 'p2', change_type: 'document_revision', title: 'Concept Design Report drafted', description: 'Stage 2 concept design report uploaded as draft for internal review.', reference_id: 'doc8', changed_by_user_id: 'u3', changed_at: '2026-03-12', approved_flag: false },
  { id: 'cl7', project_id: 'p1', change_type: 'compliance_update', title: 'Party Wall compliance expired', description: 'Party Wall Act award has expired. Renewal required before construction works commence.', reference_id: 'cs5', previous_value: 'approved', new_value: 'expired', changed_by_user_id: 'u2', changed_at: '2026-03-15', approved_flag: false },
  { id: 'cl8', project_id: 'p1', change_type: 'dutyholder_change', title: 'Client duty briefing completed', description: 'William Harris completed client duty briefing under Building Safety Act.', reference_id: 'dh1', changed_by_user_id: 'u2', changed_at: '2025-09-01', approved_flag: true, approved_by_user_id: 'u2' },
  { id: 'cl9', project_id: 'p3', change_type: 'compliance_update', title: 'CDM Compliance Statement approved', description: 'CDM 2015 compliance statement reviewed and approved for education project.', reference_id: 'cs6', previous_value: 'under_review', new_value: 'approved', changed_by_user_id: 'u1', changed_at: '2025-11-30', approved_flag: true, approved_by_user_id: 'u1' },
  { id: 'cl10', project_id: 'p2', change_type: 'requirement_update', title: 'Structural design info requirement added', description: 'New requirement added for Gateway 1: structural design basis documentation.', reference_id: 'br2', changed_by_user_id: 'u3', changed_at: '2026-02-20', approved_flag: true, approved_by_user_id: 'u1' },
]

export const DRAWING_ISSUE_WORKFLOWS: DrawingIssueWorkflow[] = [
  { id: 'diw1', project_id: 'p1', drawing_issue_id: 'di3', drawing_ref: 'P1-SM-XX-00-DR-A-0100', drawing_title: 'Ground Floor GA', status: 'queried', issued_to_name: 'Peter Keane', issued_to_email: 'peter@bwbconsulting.co.uk', issued_date: '2026-02-15', response_due_date: '2026-03-01', escalated_flag: false, query_count: 2, created_by_user_id: 'u2' },
  { id: 'diw2', project_id: 'p1', drawing_issue_id: 'di1', drawing_ref: 'P1-SM-XX-00-DR-A-0100', drawing_title: 'Ground Floor GA', status: 'closed', issued_to_name: 'Planning Officer', issued_to_email: 'planning@richmond.gov.uk', issued_date: '2025-12-01', response_due_date: '2026-01-05', response_received_date: '2025-12-20', closed_date: '2026-01-10', escalated_flag: false, query_count: 1, created_by_user_id: 'u2' },
  { id: 'diw3', project_id: 'p3', drawing_issue_id: 'di8', drawing_ref: 'P3-SM-XX-00-DR-A-0100', drawing_title: 'Ground Floor Demolition', status: 'responded', issued_to_name: 'Mark Thomas', issued_to_email: 'm.thomas@westfield.co.uk', issued_date: '2026-01-15', response_due_date: '2026-01-29', response_received_date: '2026-01-25', escalated_flag: false, query_count: 0, created_by_user_id: 'u2' },
  { id: 'diw4', project_id: 'p3', drawing_issue_id: 'di10', drawing_ref: 'P3-SM-XX-00-DR-A-0101', drawing_title: 'Ground Floor Proposed', status: 'escalated', issued_to_name: 'Mark Thomas', issued_to_email: 'm.thomas@westfield.co.uk', issued_date: '2026-03-01', response_due_date: '2026-03-15', escalated_flag: true, escalated_to_user_id: 'u1', query_count: 3, created_by_user_id: 'u2' },
  { id: 'diw5', project_id: 'p5', drawing_issue_id: 'di12', drawing_ref: 'P5-SM-XX-00-DR-A-0100', drawing_title: 'Floor Plan & Roof Plan', status: 'issued', issued_to_name: 'Site Manager', issued_to_email: 'site@tbcbuilders.co.uk', issued_date: '2026-02-01', response_due_date: '2026-02-15', escalated_flag: false, query_count: 0, created_by_user_id: 'u2' },
  { id: 'diw6', project_id: 'p2', drawing_issue_id: 'di13', drawing_ref: 'P2-SM-XX-00-DR-A-0100', drawing_title: 'Typical Floor Plan', status: 'draft', issued_to_name: 'Paul Kensington', issued_to_email: 'pk@meridiandev.co.uk', issued_date: '2026-02-01', response_due_date: '2026-02-15', escalated_flag: false, query_count: 0, created_by_user_id: 'u3' },
]

export const DRAWING_EMAILS: DrawingEmail[] = [
  { id: 'de1', workflow_id: 'diw1', direction: 'outbound', from_name: 'Sarah Mitchell', from_email: 'sarah@studiomitchell.co.uk', to_name: 'Peter Keane', to_email: 'peter@bwbconsulting.co.uk', subject: 'Drawing Issue: P1-SM-XX-00-DR-A-0100 Rev W01', body_preview: 'Please find attached the working drawing issue for Ground Floor GA at Stage 3. Could you review the structural implications of the revised beam layout and confirm adequacy.', sent_at: '2026-02-15T10:30:00Z', has_attachment: true, attachment_names: ['P1-SM-XX-00-DR-A-0100-W01.pdf'] },
  { id: 'de2', workflow_id: 'diw1', direction: 'inbound', from_name: 'Peter Keane', from_email: 'peter@bwbconsulting.co.uk', to_name: 'Sarah Mitchell', to_email: 'sarah@studiomitchell.co.uk', subject: 'RE: Drawing Issue: P1-SM-XX-00-DR-A-0100 Rev W01', body_preview: 'Thank you for the issue. We have two queries: (1) the rear extension beam span appears to exceed our preliminary calcs — please confirm dimension, (2) the foundation detail at grid line C needs clarification.', sent_at: '2026-02-20T14:15:00Z', has_attachment: false },
  { id: 'de3', workflow_id: 'diw1', direction: 'outbound', from_name: 'Sarah Mitchell', from_email: 'sarah@studiomitchell.co.uk', to_name: 'Peter Keane', to_email: 'peter@bwbconsulting.co.uk', subject: 'RE: RE: Drawing Issue: P1-SM-XX-00-DR-A-0100 Rev W01', body_preview: 'Thanks Peter. (1) Beam span confirmed at 4.2m — we have adjusted to 3.8m in updated GA. (2) Foundation detail at grid C updated — see attached markup.', sent_at: '2026-02-22T09:00:00Z', has_attachment: true, attachment_names: ['P1-GFC-markup.pdf'] },
  { id: 'de4', workflow_id: 'diw2', direction: 'outbound', from_name: 'Sarah Mitchell', from_email: 'sarah@studiomitchell.co.uk', to_name: 'Planning Officer', to_email: 'planning@richmond.gov.uk', subject: 'Planning Submission: P1-SM-XX-00-DR-A-0100 Rev P01', body_preview: 'Please find attached the planning drawings for 14 Riverside Walk, Richmond. Application ref: 2025/3421/HOU.', sent_at: '2025-12-01T11:00:00Z', has_attachment: true, attachment_names: ['P1-SM-XX-00-DR-A-0100-P01.pdf', 'Design-Access-Statement.pdf'] },
  { id: 'de5', workflow_id: 'diw2', direction: 'inbound', from_name: 'Planning Officer', from_email: 'planning@richmond.gov.uk', to_name: 'Sarah Mitchell', to_email: 'sarah@studiomitchell.co.uk', subject: 'RE: Planning Submission 2025/3421/HOU', body_preview: 'Thank you for your submission. We have reviewed the proposals and note the following: rear elevation setback should be increased by 300mm to align with SPD guidance. Please submit amended drawings.', sent_at: '2025-12-20T16:30:00Z', has_attachment: false },
  { id: 'de6', workflow_id: 'diw4', direction: 'outbound', from_name: 'Sarah Mitchell', from_email: 'sarah@studiomitchell.co.uk', to_name: 'Mark Thomas', to_email: 'm.thomas@westfield.co.uk', subject: 'Drawing Issue: P3-SM-XX-00-DR-A-0101 Rev C02', body_preview: 'Please find the re-issued Ground Floor Proposed drawing. This supersedes C01 with updated classroom layout per the client change request approved 28 Feb.', sent_at: '2026-03-01T09:30:00Z', has_attachment: true, attachment_names: ['P3-SM-XX-00-DR-A-0101-C02.pdf'] },
  { id: 'de7', workflow_id: 'diw4', direction: 'inbound', from_name: 'Mark Thomas', from_email: 'm.thomas@westfield.co.uk', to_name: 'Sarah Mitchell', to_email: 'sarah@studiomitchell.co.uk', subject: 'RE: Drawing Issue: P3-SM-XX-00-DR-A-0101 Rev C02', body_preview: 'We have concerns about the revised layout. The relocated partition wall now clashes with the existing drainage run. This will require a site investigation.', sent_at: '2026-03-05T11:45:00Z', has_attachment: false },
  { id: 'de8', workflow_id: 'diw4', direction: 'outbound', from_name: 'Sarah Mitchell', from_email: 'sarah@studiomitchell.co.uk', to_name: 'Mark Thomas', to_email: 'm.thomas@westfield.co.uk', subject: 'RE: RE: Drawing Issue: P3-SM-XX-00-DR-A-0101 Rev C02', body_preview: 'Noted. We are looking into this now. Can you confirm the exact location of the drainage run? We may need to issue a site query.', sent_at: '2026-03-06T10:00:00Z', has_attachment: false },
  { id: 'de9', workflow_id: 'diw4', direction: 'inbound', from_name: 'Mark Thomas', from_email: 'm.thomas@westfield.co.uk', to_name: 'Sarah Mitchell', to_email: 'sarah@studiomitchell.co.uk', subject: 'RE: RE: RE: Drawing Issue C02 — URGENT', body_preview: 'We have now opened up the floor and confirmed the 150mm foul drain runs directly under the proposed partition at grid D4. Works are on hold pending your response.', sent_at: '2026-03-10T08:30:00Z', has_attachment: true, attachment_names: ['Site-Photo-DrainClash.jpg'] },
  { id: 'de10', workflow_id: 'diw3', direction: 'outbound', from_name: 'Sarah Mitchell', from_email: 'sarah@studiomitchell.co.uk', to_name: 'Mark Thomas', to_email: 'm.thomas@westfield.co.uk', subject: 'Drawing Issue: P3-SM-XX-00-DR-A-0100 Rev C01', body_preview: 'Construction issue drawings for Ground Floor Demolition. Please confirm receipt and review against existing conditions survey.', sent_at: '2026-01-15T09:00:00Z', has_attachment: true, attachment_names: ['P3-SM-XX-00-DR-A-0100-C01.pdf'] },
  { id: 'de11', workflow_id: 'diw3', direction: 'inbound', from_name: 'Mark Thomas', from_email: 'm.thomas@westfield.co.uk', to_name: 'Sarah Mitchell', to_email: 'sarah@studiomitchell.co.uk', subject: 'RE: Drawing Issue: P3-SM-XX-00-DR-A-0100 Rev C01', body_preview: 'Received and reviewed. Demolition sequence confirmed as acceptable. We will proceed as drawn. One note: please confirm asbestos clearance certificate before strip-out commences.', sent_at: '2026-01-25T14:00:00Z', has_attachment: false },
]

// ── Phase 4 Wave 3: Helper Functions ─────────────────────────

export function getProjectComplianceStatements(projectId: string): ComplianceStatement[] {
  return COMPLIANCE_STATEMENTS.filter(cs => cs.project_id === projectId)
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
}

export function getComplianceStatement(id: string): ComplianceStatement | undefined {
  return COMPLIANCE_STATEMENTS.find(cs => cs.id === id)
}

export function getProjectBRPDRequirements(projectId: string): BRPDRequirement[] {
  return BRPD_REQUIREMENTS.filter(r => r.project_id === projectId)
    .sort((a, b) => a.gateway_number - b.gateway_number || a.requirement_ref.localeCompare(b.requirement_ref))
}

export function getGatewayRequirements(projectId: string, gatewayNumber: 1 | 2 | 3): BRPDRequirement[] {
  return BRPD_REQUIREMENTS.filter(r => r.project_id === projectId && r.gateway_number === gatewayNumber)
    .sort((a, b) => a.requirement_ref.localeCompare(b.requirement_ref))
}

export function getProjectChangelog(projectId: string): BRPDChangelogEntry[] {
  return BRPD_CHANGELOG.filter(c => c.project_id === projectId)
    .sort((a, b) => new Date(b.changed_at).getTime() - new Date(a.changed_at).getTime())
}

export function getDrawingIssueWorkflows(projectId: string): DrawingIssueWorkflow[] {
  return DRAWING_ISSUE_WORKFLOWS.filter(w => w.project_id === projectId)
    .sort((a, b) => new Date(b.issued_date).getTime() - new Date(a.issued_date).getTime())
}

export function getDrawingIssueWorkflow(id: string): DrawingIssueWorkflow | undefined {
  return DRAWING_ISSUE_WORKFLOWS.find(w => w.id === id)
}

export function getWorkflowEmails(workflowId: string): DrawingEmail[] {
  return DRAWING_EMAILS.filter(e => e.workflow_id === workflowId)
    .sort((a, b) => new Date(a.sent_at).getTime() - new Date(b.sent_at).getTime())
}

export function getActiveDrawingWorkflows(projectId: string): DrawingIssueWorkflow[] {
  return DRAWING_ISSUE_WORKFLOWS.filter(w =>
    w.project_id === projectId && !['closed', 'draft'].includes(w.status)
  )
}

export function getEscalatedWorkflows(projectId: string): DrawingIssueWorkflow[] {
  return DRAWING_ISSUE_WORKFLOWS.filter(w => w.project_id === projectId && w.escalated_flag)
}

// ── Phase 4 Wave 4: Project Creation & Access Control Data ──

export const PROJECT_WIZARD_STEPS: WizardStep[] = [
  { number: 1, title: 'Project Identity', description: 'Name, reference, and client details', required: true, fields: ['name', 'client', 'project_ref'] },
  { number: 2, title: 'Project Type & Sector', description: 'Building type, sector classification, and scale', required: true, fields: ['sector', 'building_type', 'gross_internal_area'], help_text: 'Sector determines fee benchmarks and compliance templates.' },
  { number: 3, title: 'Site & Location', description: 'Address, local authority, and site constraints', required: true, fields: ['address', 'local_authority', 'conservation_area'] },
  { number: 4, title: 'RIBA Stage', description: 'Current stage and anticipated programme', required: true, fields: ['current_stage', 'target_completion_date'] },
  { number: 5, title: 'Project Team', description: 'Lead, team members, and resource allocation', required: true, fields: ['project_lead', 'team_members'] },
  { number: 6, title: 'Client Brief', description: 'Key requirements, aspirations, and constraints', required: false, fields: ['brief_summary', 'key_requirements', 'budget_range'] },
  { number: 7, title: 'Fee & Commercial', description: 'Fee basis, agreed fee, and payment terms', required: false, fields: ['fee_basis', 'agreed_fee', 'payment_schedule'], help_text: 'Link to an accepted fee quote if available.' },
  { number: 8, title: 'Compliance Setup', description: 'Building Safety Act, CDM, and regulatory requirements', required: false, fields: ['bsa_applicable', 'cdm_role', 'building_regs_route'] },
  { number: 9, title: 'Dutyholder Appointments', description: 'Principal Designer, Principal Contractor, and client duties', required: false, fields: ['dutyholders'], help_text: 'Required for higher-risk buildings under BSA 2022.' },
  { number: 10, title: 'Document Templates', description: 'Select numbering conventions and document templates', required: false, fields: ['numbering_template', 'drawing_issue_template'] },
  { number: 11, title: 'Integrations', description: 'Link accounting, calendar, and storage systems', required: false, fields: ['xero_link', 'calendar_link', 'storage_link'] },
  { number: 12, title: 'Review & Create', description: 'Review all details and create the project', required: true, fields: [] },
]

export const PROJECT_BRIEFS: ProjectBrief[] = [
  {
    id: 'pb1', project_id: 'p1', version: 1, status: 'issued',
    sections: [
      { id: 'pbs1', project_id: 'p1', section_number: 1, title: 'Project Overview', description: 'High-level summary of the project scope and objectives', content: 'Rear and side extension to a Victorian semi-detached house in Richmond. The project aims to create an open-plan kitchen/dining space with a new first-floor bedroom above. The design must be sympathetic to the conservation area setting.', status: 'approved', required: true, last_edited_by_user_id: 'u2', last_edited_at: '2025-10-01', approved_by_user_id: 'u1', approved_at: '2025-10-05' },
      { id: 'pbs2', project_id: 'p1', section_number: 2, title: 'Client Requirements', description: 'Detailed client needs and aspirations', content: 'Open-plan kitchen/dining/living at ground floor. Master bedroom with ensuite at first floor. Maximise natural light. Maintain existing garden access. Budget: £180,000–£220,000 construction cost.', status: 'approved', required: true, last_edited_by_user_id: 'u2', last_edited_at: '2025-10-01', approved_by_user_id: 'u1', approved_at: '2025-10-05' },
      { id: 'pbs3', project_id: 'p1', section_number: 3, title: 'Site Constraints', description: 'Physical, planning, and legal constraints', content: 'Conservation area — Article 4 direction applies. Party wall to eastern neighbour. Mature oak tree (TPO) in rear garden — root protection zone affects foundation design. Thames Water easement runs along western boundary.', status: 'approved', required: true, last_edited_by_user_id: 'u2', last_edited_at: '2025-10-02', approved_by_user_id: 'u1', approved_at: '2025-10-05' },
      { id: 'pbs4', project_id: 'p1', section_number: 4, title: 'Design Aspirations', description: 'Design quality, materials, and aesthetic goals', content: 'Contemporary extension with zinc standing-seam cladding. Large format glazing to garden elevation. Internal palette: exposed brickwork, engineered oak flooring, polished concrete worktops.', status: 'complete', required: false, last_edited_by_user_id: 'u2', last_edited_at: '2025-10-03' },
      { id: 'pbs5', project_id: 'p1', section_number: 5, title: 'Sustainability', description: 'Environmental targets and energy strategy', content: 'Target EPC A. Air source heat pump. Triple-glazed windows. Green roof to single-storey section. PV panels on south-facing roof slope.', status: 'draft', required: false, last_edited_by_user_id: 'u4', last_edited_at: '2025-11-15' },
      { id: 'pbs6', project_id: 'p1', section_number: 6, title: 'Programme & Budget', description: 'Key milestones, budget, and delivery targets', content: 'Planning submission: Dec 2025. Start on site: May 2026. Completion: Nov 2026. Construction budget: £200,000. Professional fees: £48,000 (inc. structural, M&E).', status: 'approved', required: true, last_edited_by_user_id: 'u2', last_edited_at: '2025-10-04', approved_by_user_id: 'u1', approved_at: '2025-10-05' },
    ],
    created_by_user_id: 'u2', created_at: '2025-10-01', updated_at: '2025-11-15', issued_date: '2025-10-06', issued_to: 'Harris Family Trust'
  },
  {
    id: 'pb2', project_id: 'p2', version: 1, status: 'draft',
    sections: [
      { id: 'pbs7', project_id: 'p2', section_number: 1, title: 'Project Overview', description: 'High-level summary of the project scope and objectives', content: '12-storey residential tower with ground-floor commercial. 85 apartments (mix of 1, 2, and 3-bed). Higher-risk building under Building Safety Act 2022.', status: 'complete', required: true, last_edited_by_user_id: 'u3', last_edited_at: '2026-01-15' },
      { id: 'pbs8', project_id: 'p2', section_number: 2, title: 'Client Requirements', description: 'Detailed client needs and aspirations', content: 'Maximise unit count within planning envelope. 20% affordable housing. Communal roof terrace. Underground parking for 40 vehicles. BREEAM Very Good minimum.', status: 'complete', required: true, last_edited_by_user_id: 'u3', last_edited_at: '2026-01-20' },
      { id: 'pbs9', project_id: 'p2', section_number: 3, title: 'Site Constraints', description: 'Physical, planning, and legal constraints', content: 'Brownfield site, former industrial use. Contamination investigation required. Adjacent to railway line — noise and vibration assessment needed. Flood Zone 2.', status: 'draft', required: true, last_edited_by_user_id: 'u3', last_edited_at: '2026-02-01' },
      { id: 'pbs10', project_id: 'p2', section_number: 4, title: 'Design Aspirations', description: 'Design quality, materials, and aesthetic goals', content: '', status: 'empty', required: false },
      { id: 'pbs11', project_id: 'p2', section_number: 5, title: 'Sustainability', description: 'Environmental targets and energy strategy', content: '', status: 'empty', required: false },
      { id: 'pbs12', project_id: 'p2', section_number: 6, title: 'Programme & Budget', description: 'Key milestones, budget, and delivery targets', content: 'Estimated construction cost: £18M. Professional fees: £165,000. Programme: 36 months overall.', status: 'draft', required: true, last_edited_by_user_id: 'u3', last_edited_at: '2026-02-10' },
    ],
    created_by_user_id: 'u3', created_at: '2026-01-10', updated_at: '2026-02-10'
  },
]

export const QUOTE_ACCOUNTING_LINKS: QuoteAccountingLink[] = [
  { id: 'qal1', fee_quote_id: 'fq1', provider: 'xero', external_ref: 'INV-2025-0142', external_invoice_id: 'xero_inv_8821', sync_status: 'synced', last_synced_at: '2026-03-18T10:30:00Z', auto_sync_enabled: true, mapped_fields: ['client_name', 'agreed_fee', 'payment_schedule', 'line_items'] },
  { id: 'qal2', fee_quote_id: 'fq2', provider: 'xero', external_ref: 'INV-2025-0198', sync_status: 'pending', auto_sync_enabled: true, mapped_fields: ['client_name', 'agreed_fee'] },
  { id: 'qal3', fee_quote_id: 'fq3', provider: 'quickbooks', external_ref: 'EST-3421', external_invoice_id: 'qb_est_3421', sync_status: 'synced', last_synced_at: '2026-03-10T14:00:00Z', auto_sync_enabled: false, mapped_fields: ['client_name', 'agreed_fee', 'line_items'] },
  { id: 'qal4', fee_quote_id: 'fq4', provider: 'xero', external_ref: 'INV-2026-0012', sync_status: 'failed', error_message: 'Xero contact not found. Please map the client manually.', auto_sync_enabled: true, mapped_fields: ['client_name', 'agreed_fee'] },
  { id: 'qal5', fee_quote_id: 'fq5', provider: 'xero', external_ref: 'INV-2026-0045', sync_status: 'not_linked', auto_sync_enabled: false, mapped_fields: [] },
]

export const ROLE_VISIBILITY_RULES: RoleVisibilityRule[] = [
  // Practice Owner — full access to everything
  { id: 'rv1', organisation_id: 'org1', role: 'practice_owner', feature_area: 'projects', can_view: true, can_edit: true, can_delete: true, can_export: true },
  { id: 'rv2', organisation_id: 'org1', role: 'practice_owner', feature_area: 'fee_quotes', can_view: true, can_edit: true, can_delete: true, can_export: true },
  { id: 'rv3', organisation_id: 'org1', role: 'practice_owner', feature_area: 'analytics', can_view: true, can_edit: true, can_delete: false, can_export: true },
  { id: 'rv4', organisation_id: 'org1', role: 'practice_owner', feature_area: 'ai_teammate', can_view: true, can_edit: true, can_delete: false, can_export: true },
  { id: 'rv5', organisation_id: 'org1', role: 'practice_owner', feature_area: 'admin', can_view: true, can_edit: true, can_delete: true, can_export: true },
  { id: 'rv6', organisation_id: 'org1', role: 'practice_owner', feature_area: 'integrations', can_view: true, can_edit: true, can_delete: true, can_export: false },
  // Project Lead — most access, no admin delete
  { id: 'rv7', organisation_id: 'org1', role: 'project_lead', feature_area: 'projects', can_view: true, can_edit: true, can_delete: false, can_export: true },
  { id: 'rv8', organisation_id: 'org1', role: 'project_lead', feature_area: 'fee_quotes', can_view: true, can_edit: true, can_delete: false, can_export: true },
  { id: 'rv9', organisation_id: 'org1', role: 'project_lead', feature_area: 'analytics', can_view: true, can_edit: false, can_delete: false, can_export: true },
  { id: 'rv10', organisation_id: 'org1', role: 'project_lead', feature_area: 'ai_teammate', can_view: true, can_edit: true, can_delete: false, can_export: false },
  { id: 'rv11', organisation_id: 'org1', role: 'project_lead', feature_area: 'admin', can_view: false, can_edit: false, can_delete: false, can_export: false, restriction_notes: 'Admin controls restricted to Practice Owners only.' },
  { id: 'rv12', organisation_id: 'org1', role: 'project_lead', feature_area: 'integrations', can_view: true, can_edit: false, can_delete: false, can_export: false, restriction_notes: 'Can view connected integrations but cannot modify.' },
  // Team Member — view-heavy, limited edit
  { id: 'rv13', organisation_id: 'org1', role: 'team_member', feature_area: 'projects', can_view: true, can_edit: true, can_delete: false, can_export: false, restriction_notes: 'Can edit tasks assigned to them only.' },
  { id: 'rv14', organisation_id: 'org1', role: 'team_member', feature_area: 'fee_quotes', can_view: false, can_edit: false, can_delete: false, can_export: false, restriction_notes: 'Fee data restricted to Project Leads and above.' },
  { id: 'rv15', organisation_id: 'org1', role: 'team_member', feature_area: 'analytics', can_view: true, can_edit: false, can_delete: false, can_export: false, restriction_notes: 'View-only access to project analytics.' },
  { id: 'rv16', organisation_id: 'org1', role: 'team_member', feature_area: 'ai_teammate', can_view: true, can_edit: true, can_delete: false, can_export: false },
  { id: 'rv17', organisation_id: 'org1', role: 'team_member', feature_area: 'admin', can_view: false, can_edit: false, can_delete: false, can_export: false },
  { id: 'rv18', organisation_id: 'org1', role: 'team_member', feature_area: 'integrations', can_view: false, can_edit: false, can_delete: false, can_export: false },
]

// ── Phase 4 Wave 4: Helper Functions ─────────────────────────

export function getProjectWizardSteps(): WizardStep[] {
  return PROJECT_WIZARD_STEPS
}

export function getProjectBrief(projectId: string): ProjectBrief | undefined {
  return PROJECT_BRIEFS.find(b => b.project_id === projectId)
}

export function getProjectBriefs(): ProjectBrief[] {
  return PROJECT_BRIEFS
}

export function getBriefSections(projectId: string): BriefSection[] {
  const brief = PROJECT_BRIEFS.find(b => b.project_id === projectId)
  return brief ? brief.sections.sort((a, b) => a.section_number - b.section_number) : []
}

export function getQuoteAccountingLinks(): QuoteAccountingLink[] {
  return QUOTE_ACCOUNTING_LINKS
}

export function getQuoteAccountingLink(feeQuoteId: string): QuoteAccountingLink | undefined {
  return QUOTE_ACCOUNTING_LINKS.find(l => l.fee_quote_id === feeQuoteId)
}

export function getAccountingLinksByProvider(provider: 'xero' | 'quickbooks'): QuoteAccountingLink[] {
  return QUOTE_ACCOUNTING_LINKS.filter(l => l.provider === provider)
}

export function getRoleVisibilityRules(role: string): RoleVisibilityRule[] {
  return ROLE_VISIBILITY_RULES.filter(r => r.role === role)
}

export function getAllVisibilityRules(): RoleVisibilityRule[] {
  return ROLE_VISIBILITY_RULES
}

export function getFeatureAccess(role: string, featureArea: string): RoleVisibilityRule | undefined {
  return ROLE_VISIBILITY_RULES.find(r => r.role === role && r.feature_area === featureArea)
}

// ── Leave & Holidays Data ──────────────────────────────────

export const LEAVE_RECORDS: LeaveRecord[] = [
  // Sarah Mitchell — on holiday soon
  { id: 'lv1', user_id: 'u1', leave_type: 'holiday', status: 'approved', start_date: '2026-04-27', end_date: '2026-05-01', days: 5, notes: 'Bank holiday week — family trip to Cornwall', approved_by_user_id: 'u1', approved_at: '2026-03-15', created_at: '2026-03-10' },
  { id: 'lv2', user_id: 'u1', leave_type: 'holiday', status: 'approved', start_date: '2026-08-10', end_date: '2026-08-21', days: 10, notes: 'Summer holiday', approved_by_user_id: 'u1', approved_at: '2026-02-20', created_at: '2026-02-18' },
  // James Cooper
  { id: 'lv3', user_id: 'u2', leave_type: 'holiday', status: 'approved', start_date: '2026-05-25', end_date: '2026-05-29', days: 5, notes: 'Half-term break', approved_by_user_id: 'u1', approved_at: '2026-04-01', created_at: '2026-03-28' },
  { id: 'lv4', user_id: 'u2', leave_type: 'sick', status: 'approved', start_date: '2026-04-07', end_date: '2026-04-08', days: 2, notes: 'Flu', approved_by_user_id: 'u1', approved_at: '2026-04-07', created_at: '2026-04-07' },
  { id: 'lv5', user_id: 'u2', leave_type: 'cpd', status: 'approved', start_date: '2026-06-12', end_date: '2026-06-12', days: 1, notes: 'RIBA CPD seminar — fire safety', approved_by_user_id: 'u1', approved_at: '2026-05-01', created_at: '2026-04-28' },
  // Priya Sharma
  { id: 'lv6', user_id: 'u3', leave_type: 'holiday', status: 'approved', start_date: '2026-04-20', end_date: '2026-04-24', days: 5, approved_by_user_id: 'u1', approved_at: '2026-03-10', created_at: '2026-03-08' },
  { id: 'lv7', user_id: 'u3', leave_type: 'holiday', status: 'pending', start_date: '2026-07-13', end_date: '2026-07-24', days: 10, notes: 'India trip', created_at: '2026-04-12' },
  // Tom Bradley
  { id: 'lv8', user_id: 'u4', leave_type: 'parental', status: 'approved', start_date: '2026-09-01', end_date: '2026-09-26', days: 20, notes: 'Paternity leave', approved_by_user_id: 'u1', approved_at: '2026-03-20', created_at: '2026-03-15' },
  { id: 'lv9', user_id: 'u4', leave_type: 'holiday', status: 'approved', start_date: '2026-05-05', end_date: '2026-05-09', days: 5, approved_by_user_id: 'u1', approved_at: '2026-04-10', created_at: '2026-04-08' },
  // Ella Chen
  { id: 'lv10', user_id: 'u5', leave_type: 'holiday', status: 'approved', start_date: '2026-06-02', end_date: '2026-06-06', days: 5, notes: 'Long weekend trip', approved_by_user_id: 'u1', approved_at: '2026-04-15', created_at: '2026-04-12' },
  { id: 'lv11', user_id: 'u5', leave_type: 'cpd', status: 'pending', start_date: '2026-05-15', end_date: '2026-05-16', days: 2, notes: 'Passivhaus training course', created_at: '2026-04-14' },
  { id: 'lv12', user_id: 'u5', leave_type: 'sick', status: 'approved', start_date: '2026-03-24', end_date: '2026-03-24', days: 1, approved_by_user_id: 'u1', approved_at: '2026-03-24', created_at: '2026-03-24' },
]

export const BANK_HOLIDAYS: BankHoliday[] = [
  { date: '2026-01-01', name: 'New Year\'s Day', region: 'all' },
  { date: '2026-04-03', name: 'Good Friday', region: 'all' },
  { date: '2026-04-06', name: 'Easter Monday', region: 'england-wales' },
  { date: '2026-05-04', name: 'Early May Bank Holiday', region: 'england-wales' },
  { date: '2026-05-25', name: 'Spring Bank Holiday', region: 'england-wales' },
  { date: '2026-08-31', name: 'Summer Bank Holiday', region: 'england-wales' },
  { date: '2026-12-25', name: 'Christmas Day', region: 'all' },
  { date: '2026-12-28', name: 'Boxing Day (substitute)', region: 'all' },
]

export const LEAVE_ENTITLEMENTS: LeaveEntitlement[] = [
  { user_id: 'u1', year: 2026, total_days: 28, used_days: 5, pending_days: 10, carried_over: 3 },
  { user_id: 'u2', year: 2026, total_days: 25, used_days: 2, pending_days: 6, carried_over: 0 },
  { user_id: 'u3', year: 2026, total_days: 25, used_days: 5, pending_days: 10, carried_over: 2 },
  { user_id: 'u4', year: 2026, total_days: 25, used_days: 0, pending_days: 25, carried_over: 0 },
  { user_id: 'u5', year: 2026, total_days: 25, used_days: 1, pending_days: 7, carried_over: 0 },
]

// ── Leave Helper Functions ──────────────────────────────────

export function getLeaveRecords(): LeaveRecord[] {
  return LEAVE_RECORDS.sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime())
}

export function getUserLeaveRecords(userId: string): LeaveRecord[] {
  return LEAVE_RECORDS.filter(l => l.user_id === userId)
    .sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime())
}

export function getPendingLeaveRequests(): LeaveRecord[] {
  return LEAVE_RECORDS.filter(l => l.status === 'pending')
    .sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime())
}

export function getUpcomingLeave(daysAhead: number = 30): LeaveRecord[] {
  const now = new Date()
  const cutoff = new Date(now.getTime() + daysAhead * 86400000)
  return LEAVE_RECORDS.filter(l =>
    l.status === 'approved' &&
    new Date(l.start_date) >= now &&
    new Date(l.start_date) <= cutoff
  ).sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime())
}

export function getBankHolidays(region: string = 'england-wales'): BankHoliday[] {
  return BANK_HOLIDAYS.filter(h => h.region === region || h.region === 'all')
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
}

export function getUpcomingBankHolidays(daysAhead: number = 90): BankHoliday[] {
  const now = new Date()
  const cutoff = new Date(now.getTime() + daysAhead * 86400000)
  return getBankHolidays().filter(h =>
    new Date(h.date) >= now && new Date(h.date) <= cutoff
  )
}

export function getLeaveEntitlement(userId: string, year: number = 2026): LeaveEntitlement | undefined {
  return LEAVE_ENTITLEMENTS.find(e => e.user_id === userId && e.year === year)
}

export function getLeaveEntitlements(): LeaveEntitlement[] {
  return LEAVE_ENTITLEMENTS
}

export function getTeamAvailability(date: string): { userId: string; available: boolean; reason?: string }[] {
  const d = new Date(date)
  return LEAVE_ENTITLEMENTS.map(e => {
    const userLeave = LEAVE_RECORDS.find(l =>
      l.user_id === e.user_id &&
      l.status === 'approved' &&
      new Date(l.start_date) <= d &&
      new Date(l.end_date) >= d
    )
    const bankHol = BANK_HOLIDAYS.find(h =>
      h.date === date && (h.region === 'england-wales' || h.region === 'all')
    )
    if (bankHol) return { userId: e.user_id, available: false, reason: bankHol.name }
    if (userLeave) return { userId: e.user_id, available: false, reason: userLeave.leave_type }
    return { userId: e.user_id, available: true }
  })
}

// ══════════════════════════════════════════════════════════════
// PHASE 5: TIMESHEETS
// ══════════════════════════════════════════════════════════════

export const TIMESHEET_ENTRIES: TimesheetEntry[] = [
  // Sarah - Week of 2026-05-18
  { id: 'ts1', user_id: 'u1', project_id: 'p1', date: '2026-05-18', hours: 6, description: 'Client coordination & stage review', stage: 3, task_category: 'planning_spatial', billable: true, status: 'approved', submitted_at: '2026-05-22', approved_by: 'u1', approved_at: '2026-05-22', created_at: '2026-05-18' },
  { id: 'ts2', user_id: 'u1', project_id: 'p2', date: '2026-05-19', hours: 4, description: 'Design risk workshop', stage: 2, task_category: 'concept_design', billable: true, status: 'approved', submitted_at: '2026-05-22', approved_by: 'u1', approved_at: '2026-05-22', created_at: '2026-05-19' },
  { id: 'ts3', user_id: 'u1', project_id: 'p1', date: '2026-05-19', hours: 3, description: 'BRPD documentation prep', stage: 3, task_category: 'planning_spatial', billable: true, status: 'approved', submitted_at: '2026-05-22', approved_by: 'u1', approved_at: '2026-05-22', created_at: '2026-05-19' },
  { id: 'ts4', user_id: 'u1', project_id: 'p3', date: '2026-05-20', hours: 7, description: 'Tender evaluation review', stage: 4, task_category: 'technical_design', billable: true, status: 'approved', submitted_at: '2026-05-22', approved_by: 'u1', approved_at: '2026-05-22', created_at: '2026-05-20' },
  // James - Week of 2026-05-18
  { id: 'ts5', user_id: 'u2', project_id: 'p1', date: '2026-05-18', hours: 8, description: 'Spatial coordination drawings', stage: 3, task_category: 'planning_spatial', billable: true, status: 'submitted', submitted_at: '2026-05-22', created_at: '2026-05-18' },
  { id: 'ts6', user_id: 'u2', project_id: 'p1', date: '2026-05-19', hours: 7.5, description: 'Coordination mark-ups', stage: 3, task_category: 'planning_spatial', billable: true, status: 'submitted', submitted_at: '2026-05-22', created_at: '2026-05-19' },
  { id: 'ts7', user_id: 'u2', project_id: 'p2', date: '2026-05-20', hours: 4, description: 'Concept sketches', stage: 2, task_category: 'concept_design', billable: true, status: 'submitted', submitted_at: '2026-05-22', created_at: '2026-05-20' },
  // Priya - Week of 2026-05-25 (current week - some missing)
  { id: 'ts8', user_id: 'u3', project_id: 'p4', date: '2026-05-25', hours: 6, description: 'Planning submission prep', stage: 3, task_category: 'planning_spatial', billable: true, status: 'draft', created_at: '2026-05-25' },
  { id: 'ts9', user_id: 'u3', project_id: 'p4', date: '2026-05-26', hours: 7, description: 'Heritage statement drafting', stage: 3, task_category: 'planning_spatial', billable: true, status: 'draft', created_at: '2026-05-26' },
  // Tom - hasn't submitted this week at all (missing timesheets alert)
  { id: 'ts10', user_id: 'u4', project_id: 'p5', date: '2026-05-18', hours: 7, description: 'Site survey documentation', stage: 5, task_category: 'construction_ca', billable: true, status: 'approved', submitted_at: '2026-05-22', approved_by: 'u1', approved_at: '2026-05-23', created_at: '2026-05-18' },
  { id: 'ts11', user_id: 'u4', project_id: 'p5', date: '2026-05-19', hours: 8, description: 'Construction monitoring', stage: 5, task_category: 'construction_ca', billable: true, status: 'approved', submitted_at: '2026-05-22', approved_by: 'u1', approved_at: '2026-05-23', created_at: '2026-05-19' },
  // Amara - partially done current week
  { id: 'ts12', user_id: 'u5', project_id: 'p2', date: '2026-05-25', hours: 5, description: 'Model updates', stage: 2, task_category: 'concept_design', billable: true, status: 'draft', created_at: '2026-05-25' },
  { id: 'ts13', user_id: 'u5', project_id: 'p3', date: '2026-05-25', hours: 2, description: 'Drawing issue coordination', stage: 4, task_category: 'technical_design', billable: false, status: 'draft', created_at: '2026-05-25' },
  { id: 'ts14', user_id: 'u5', project_id: 'p2', date: '2026-05-26', hours: 7, description: 'Render preparation', stage: 2, task_category: 'concept_design', billable: true, status: 'draft', created_at: '2026-05-26' },
  // Non-billable admin time
  { id: 'ts15', user_id: 'u1', project_id: 'p1', date: '2026-05-21', hours: 2, description: 'Practice management meeting', stage: 0, task_category: 'admin_cpd_office', billable: false, status: 'approved', submitted_at: '2026-05-22', approved_by: 'u1', approved_at: '2026-05-22', created_at: '2026-05-21' },
]

export function getTimesheetEntries(): TimesheetEntry[] { return TIMESHEET_ENTRIES }
export function getUserTimesheets(userId: string): TimesheetEntry[] {
  return TIMESHEET_ENTRIES.filter(t => t.user_id === userId)
}
export function getProjectTimesheets(projectId: string): TimesheetEntry[] {
  return TIMESHEET_ENTRIES.filter(t => t.project_id === projectId)
}
export function getMissingTimesheetUsers(): string[] {
  const currentWeekStart = '2026-05-25'
  const usersWithEntries = new Set(TIMESHEET_ENTRIES.filter(t => t.date >= currentWeekStart).map(t => t.user_id))
  return USERS.map(u => u.id).filter(id => !usersWithEntries.has(id))
}
export function getTimesheetWeekSummaries(weekStart: string): TimesheetWeekSummary[] {
  return USERS.map(u => {
    const entries = TIMESHEET_ENTRIES.filter(t => t.user_id === u.id && t.date >= weekStart && t.date < new Date(new Date(weekStart).getTime() + 7 * 86400000).toISOString().split('T')[0])
    const daysWorked = new Set(entries.map(e => e.date)).size
    return {
      user_id: u.id,
      week_start: weekStart,
      total_hours: entries.reduce((s, e) => s + e.hours, 0),
      billable_hours: entries.filter(e => e.billable).reduce((s, e) => s + e.hours, 0),
      submitted: entries.length > 0 && entries.every(e => e.status !== 'draft'),
      missing_days: Math.max(0, 5 - daysWorked),
    }
  })
}

// ══════════════════════════════════════════════════════════════
// PHASE 5: INVOICES
// ══════════════════════════════════════════════════════════════

export const INVOICES: Invoice[] = [
  {
    id: 'inv1', invoice_number: 'INV-2026-001', project_id: 'p1', client: 'Riverside Academy Trust',
    quote_id: 'fq1', amount: 28500, vat_amount: 5700, total_amount: 34200,
    status: 'paid', issued_date: '2026-03-01', due_date: '2026-03-31', paid_date: '2026-03-28',
    payment_reference: 'BACS-44821', xero_synced: true, xero_invoice_id: 'xero-inv-001',
    description: 'RIBA Stage 2 fee — Riverside Academy', line_items: [
      { id: 'il1', description: 'Concept Design fee', stage: 2, quantity: 1, unit_price: 28500, amount: 28500 }
    ], created_at: '2026-03-01', updated_at: '2026-03-28'
  },
  {
    id: 'inv2', invoice_number: 'INV-2026-002', project_id: 'p1', client: 'Riverside Academy Trust',
    amount: 35000, vat_amount: 7000, total_amount: 42000,
    status: 'overdue', issued_date: '2026-04-15', due_date: '2026-05-15',
    xero_synced: true, xero_invoice_id: 'xero-inv-002',
    description: 'RIBA Stage 3 fee (partial) — Riverside Academy', line_items: [
      { id: 'il2', description: 'Spatial Coordination fee (50%)', stage: 3, quantity: 1, unit_price: 35000, amount: 35000 }
    ], created_at: '2026-04-15', updated_at: '2026-05-15'
  },
  {
    id: 'inv3', invoice_number: 'INV-2026-003', project_id: 'p2', client: 'Heritage Homes PLC',
    amount: 12000, vat_amount: 2400, total_amount: 14400,
    status: 'sent', issued_date: '2026-05-20', due_date: '2026-06-20',
    xero_synced: true, xero_invoice_id: 'xero-inv-003',
    description: 'RIBA Stage 2 fee — The Old Rectory', line_items: [
      { id: 'il3', description: 'Concept Design fee', stage: 2, quantity: 1, unit_price: 12000, amount: 12000 }
    ], created_at: '2026-05-20', updated_at: '2026-05-20'
  },
  {
    id: 'inv4', invoice_number: 'INV-2026-004', project_id: 'p3', client: 'Malvern Hills Council',
    amount: 45000, vat_amount: 9000, total_amount: 54000,
    status: 'due', issued_date: '2026-05-01', due_date: '2026-06-01',
    xero_synced: false,
    description: 'RIBA Stage 4 progress — Civic Centre Extension', line_items: [
      { id: 'il4a', description: 'Technical Design fee (progress)', stage: 4, quantity: 1, unit_price: 40000, amount: 40000 },
      { id: 'il4b', description: 'Additional surveys', quantity: 1, unit_price: 5000, amount: 5000 }
    ], created_at: '2026-05-01', updated_at: '2026-05-01'
  },
  {
    id: 'inv5', invoice_number: 'INV-2026-005', project_id: 'p4', client: 'Worcester RFC',
    amount: 8500, vat_amount: 1700, total_amount: 10200,
    status: 'draft', due_date: '2026-06-30',
    xero_synced: false,
    description: 'RIBA Stage 3 fee — Clubhouse Refurbishment', line_items: [
      { id: 'il5', description: 'Spatial Coordination fee', stage: 3, quantity: 1, unit_price: 8500, amount: 8500 }
    ], created_at: '2026-05-28', updated_at: '2026-05-28'
  },
  {
    id: 'inv6', invoice_number: 'INV-2026-006', project_id: 'p5', client: 'Green Valley Developments',
    amount: 62000, vat_amount: 12400, total_amount: 74400,
    status: 'viewed', issued_date: '2026-05-22', due_date: '2026-06-22',
    xero_synced: true, xero_invoice_id: 'xero-inv-006',
    description: 'RIBA Stage 5 progress — Sustainable Housing Phase 2', line_items: [
      { id: 'il6a', description: 'Construction stage services (M3)', stage: 5, quantity: 1, unit_price: 50000, amount: 50000 },
      { id: 'il6b', description: 'Clerk of works visits', quantity: 4, unit_price: 3000, amount: 12000 }
    ], created_at: '2026-05-22', updated_at: '2026-05-24'
  },
]

export function getInvoices(): Invoice[] { return INVOICES }
export function getProjectInvoices(projectId: string): Invoice[] {
  return INVOICES.filter(i => i.project_id === projectId)
}
export function getOverdueInvoices(): Invoice[] {
  return INVOICES.filter(i => i.status === 'overdue')
}
export function getOpenInvoiceValue(): number {
  return INVOICES.filter(i => ['sent', 'viewed', 'due', 'overdue'].includes(i.status))
    .reduce((s, i) => s + i.total_amount, 0)
}
export function getInvoicesByStatus(status: string): Invoice[] {
  return INVOICES.filter(i => i.status === status)
}
export function getUnsyncedInvoices(): Invoice[] {
  return INVOICES.filter(i => !i.xero_synced && i.status !== 'draft')
}
export function getTotalInvoicedThisMonth(): number {
  return INVOICES.filter(i => i.issued_date && i.issued_date.startsWith('2026-05'))
    .reduce((s, i) => s + i.total_amount, 0)
}

// ══════════════════════════════════════════════════════════════
// PHASE 5: OVERHEADS
// ══════════════════════════════════════════════════════════════

export const OVERHEAD_ENTRIES: OverheadEntry[] = [
  { id: 'oh1', category: 'rent', description: 'Studio rent — Worcester High Street', amount: 3200, date: '2026-05-01', recurring: true, frequency: 'monthly' },
  { id: 'oh2', category: 'internet', description: 'Fibre broadband — BT Business', amount: 89, date: '2026-05-01', recurring: true, frequency: 'monthly' },
  { id: 'oh3', category: 'telephones', description: 'Mobile contracts (5 lines)', amount: 175, date: '2026-05-01', recurring: true, frequency: 'monthly' },
  { id: 'oh4', category: 'software', description: 'AutoCAD licenses (3)', amount: 450, date: '2026-05-01', recurring: true, frequency: 'monthly' },
  { id: 'oh5', category: 'software', description: 'Revit licenses (2)', amount: 380, date: '2026-05-01', recurring: true, frequency: 'monthly' },
  { id: 'oh6', category: 'software', description: 'Microsoft 365 Business', amount: 95, date: '2026-05-01', recurring: true, frequency: 'monthly' },
  { id: 'oh7', category: 'insurance', description: 'PI Insurance — annual premium', amount: 1850, date: '2026-04-01', recurring: true, frequency: 'quarterly' },
  { id: 'oh8', category: 'utilities', description: 'Electricity', amount: 285, date: '2026-05-01', recurring: true, frequency: 'monthly' },
  { id: 'oh9', category: 'utilities', description: 'Gas', amount: 120, date: '2026-05-01', recurring: true, frequency: 'monthly' },
  { id: 'oh10', category: 'printing', description: 'Large format plots — A0 tender set', amount: 340, date: '2026-05-15', recurring: false },
  { id: 'oh11', category: 'travel', description: 'Site visit mileage — May', amount: 280, date: '2026-05-28', recurring: false },
  { id: 'oh12', category: 'professional_fees', description: 'Accountancy retainer', amount: 450, date: '2026-05-01', recurring: true, frequency: 'monthly' },
  { id: 'oh13', category: 'office_admin', description: 'Stationery & supplies', amount: 65, date: '2026-05-10', recurring: false },
]

export function getOverheadEntries(): OverheadEntry[] { return OVERHEAD_ENTRIES }
export function getMonthlyOverheadTotal(): number {
  return OVERHEAD_ENTRIES.filter(e => e.date.startsWith('2026-05'))
    .reduce((s, e) => s + e.amount, 0)
}
export function getOverheadSummaries(): OverheadSummary[] {
  const categories: OverheadCategory[] = ['rent', 'internet', 'telephones', 'printing', 'software', 'insurance', 'utilities', 'office_admin', 'travel', 'professional_fees']
  return categories.map(cat => {
    const entries = OVERHEAD_ENTRIES.filter(e => e.category === cat)
    const monthly = entries.filter(e => e.date.startsWith('2026-05')).reduce((s, e) => s + e.amount, 0)
    return { category: cat, monthly_total: monthly, ytd_total: monthly * 5 }
  }).filter(s => s.monthly_total > 0)
}

// ══════════════════════════════════════════════════════════════
// PHASE 5: NEWS & REGULATIONS
// ══════════════════════════════════════════════════════════════

export const NEWS_ITEMS: NewsItem[] = [
  { id: 'news1', title: 'Building Safety Act — Secondary Legislation Update', summary: 'New secondary legislation clarifies duty holder responsibilities for higher-risk buildings under BSA 2022.', category: 'regulations', source: 'RIBA Journal', published_at: '2026-05-28', pinned: true, hidden: false },
  { id: 'news2', title: 'Part L 2025 Amendments Now in Force', summary: 'Updated conservation of fuel and power requirements took effect 28 May 2026, affecting all new applications.', category: 'regulations', source: 'GOV.UK', published_at: '2026-05-28', pinned: false, hidden: false },
  { id: 'news3', title: 'RIBA Plan of Work 2025 Published', summary: 'Updated Plan of Work introduces enhanced sustainability checkpoints at each stage gateway.', category: 'architecture', source: 'RIBA', published_at: '2026-05-25', pinned: false, hidden: false },
  { id: 'news4', title: 'Worcester City Centre Masterplan Consultation Opens', summary: 'Public consultation begins on the 30-year masterplan for Worcester city centre regeneration.', category: 'planning', source: 'Worcester News', published_at: '2026-05-22', pinned: false, hidden: false },
  { id: 'news5', title: 'Passivhaus Trust Publishes Social Housing Guidance', summary: 'New guidance document for achieving Passivhaus certification on social housing retrofit projects.', category: 'construction', source: 'Passivhaus Trust', published_at: '2026-05-20', pinned: false, hidden: false },
  { id: 'news6', title: 'Practice Insurance Premiums Expected to Rise 8%', summary: 'Broker survey indicates PI premiums increasing across the sector due to cladding-related claims.', category: 'architecture', source: 'AJ', published_at: '2026-05-18', pinned: false, hidden: false },
  { id: 'news7', title: 'New CPD requirements from ARB take effect January 2027', summary: 'ARB confirms 35-hour annual CPD requirement with mandatory competence areas.', category: 'regulations', source: 'ARB', published_at: '2026-05-15', pinned: false, hidden: false },
  { id: 'news8', title: 'Studio Mitchell Wins Worcester Design Award', summary: 'The practice received recognition for the Riverside Academy project at the annual Worcester Design Awards.', category: 'company', source: 'Internal', published_at: '2026-05-12', pinned: true, hidden: false },
]

export function getNewsItems(): NewsItem[] { return NEWS_ITEMS.filter(n => !n.hidden) }
export function getPinnedNews(): NewsItem[] { return NEWS_ITEMS.filter(n => n.pinned && !n.hidden) }
export function getNewsByCategory(category: string): NewsItem[] {
  return NEWS_ITEMS.filter(n => n.category === category && !n.hidden)
}

// ══════════════════════════════════════════════════════════════
// PHASE 5: PROJECT UPDATES FEED
// ══════════════════════════════════════════════════════════════

export const PROJECT_UPDATES: ProjectUpdate[] = [
  { id: 'pu1', project_id: 'p1', project_name: 'Riverside Academy', event_type: 'milestone', description: 'Stage 3 gateway review scheduled for 2 June', severity: 'info', timestamp: '2026-05-29T09:00:00', actor: 'Sarah Mitchell' },
  { id: 'pu2', project_id: 'p1', project_name: 'Riverside Academy', event_type: 'upload_missing', description: 'Structural consultant has not uploaded Stage 3 calcs — 5 days overdue', severity: 'warning', timestamp: '2026-05-28T14:30:00' },
  { id: 'pu3', project_id: 'p3', project_name: 'Civic Centre Extension', event_type: 'planning_due', description: 'Planning determination expected 4 June', severity: 'info', timestamp: '2026-05-28T10:00:00' },
  { id: 'pu4', project_id: 'p2', project_name: 'The Old Rectory', event_type: 'approval_returned', description: 'Heritage officer returned design approval with 3 conditions', severity: 'warning', timestamp: '2026-05-27T16:45:00', actor: 'Heritage England' },
  { id: 'pu5', project_id: 'p5', project_name: 'Sustainable Housing Ph.2', event_type: 'stage_blocked', description: 'Stage 5 progress blocked — awaiting revised structural details', severity: 'critical', timestamp: '2026-05-27T11:20:00' },
  { id: 'pu6', project_id: 'p4', project_name: 'Clubhouse Refurbishment', event_type: 'quote_accepted', description: 'Fee quote FQ-2026-004 accepted by Worcester RFC (£18,500)', severity: 'info', timestamp: '2026-05-26T15:00:00', actor: 'Client' },
  { id: 'pu7', project_id: 'p1', project_name: 'Riverside Academy', event_type: 'brpd_upload', description: 'Fire strategy document uploaded by fire consultant', severity: 'info', timestamp: '2026-05-26T09:30:00', actor: 'FireSafe Consulting' },
  { id: 'pu8', project_id: 'p3', project_name: 'Civic Centre Extension', event_type: 'invoice_issued', description: 'Invoice INV-2026-004 issued — £54,000 inc. VAT', severity: 'info', timestamp: '2026-05-25T14:00:00', actor: 'Sarah Mitchell' },
  { id: 'pu9', project_id: 'p5', project_name: 'Sustainable Housing Ph.2', event_type: 'site_query', description: 'SQ-015: Foundation detail query from contractor — unresolved', severity: 'warning', timestamp: '2026-05-24T10:15:00', actor: 'BuildRight Ltd' },
  { id: 'pu10', project_id: 'p2', project_name: 'The Old Rectory', event_type: 'drawing_issued', description: 'Drawing Issue DI-008 sent to structural engineer (6 drawings)', severity: 'info', timestamp: '2026-05-23T13:45:00', actor: 'James Chen' },
]

export function getProjectUpdates(): ProjectUpdate[] {
  return PROJECT_UPDATES.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
}
export function getCriticalUpdates(): ProjectUpdate[] {
  return PROJECT_UPDATES.filter(u => u.severity === 'critical' || u.severity === 'warning')
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
}

// ══════════════════════════════════════════════════════════════
// PHASE 5: EXECUTIVE DASHBOARD HELPERS
// ══════════════════════════════════════════════════════════════

export function getDashboardKPIs(): DashboardKPIs {
  const activeProjects = PROJECTS.filter(p => p.status === 'active').length
  const overdue = INVOICES.filter(i => i.status === 'overdue')
  const expiringQuotes = FEE_QUOTE_RECORDS.filter((q: FeeQuoteRecord) => q.status === 'sent' || q.status === 'viewed').length
  const missingTs = getMissingTimesheetUsers().length
  const pendingApprovals = APPROVALS.filter(a => a.status === 'pending').length
  const brpdDeadlines = BRPD_REQUIREMENTS ? BRPD_REQUIREMENTS.filter((r: BRPDRequirement) => r.status === 'in_progress' || r.status === 'not_started').length : 0

  return {
    active_projects: activeProjects,
    projects_at_risk: PROJECTS.filter(p => p.status === 'active').filter(p => {
      const tasks = getProjectTasks(p.id)
      const risks = ALL_TASKS.filter(t => t.project_id === p.id && t.status === 'blocked')
      return risks.length > 0 || tasks.filter(t => t.due_date && new Date(t.due_date) < new Date() && t.status !== 'done').length > 2
    }).length,
    missing_timesheets: missingTs,
    open_invoice_value: getOpenInvoiceValue(),
    quotes_expiring: expiringQuotes,
    brpd_deadlines: brpdDeadlines,
    approvals_waiting: pendingApprovals,
  }
}

export function getFeeRecoveryRate(): number {
  const totalBillable = TIMESHEET_ENTRIES.filter(t => t.billable).reduce((s, t) => s + t.hours, 0)
  const totalHours = TIMESHEET_ENTRIES.reduce((s, t) => s + t.hours, 0)
  return totalHours > 0 ? Math.round((totalBillable / totalHours) * 100) : 0
}

export function getPracticeRevenueThisMonth(): number {
  return INVOICES.filter(i => i.paid_date && i.paid_date.startsWith('2026-05'))
    .reduce((s, i) => s + i.total_amount, 0)
    + INVOICES.filter(i => i.issued_date && i.issued_date.startsWith('2026-05') && i.status !== 'draft')
    .reduce((s, i) => s + i.total_amount, 0)
}

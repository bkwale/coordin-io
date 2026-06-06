// ── Core Types ──────────────────────────────────────────────

export type Role = 'admin' | 'practice_owner' | 'project_lead' | 'team_member'

export type ProjectStatus = 'active' | 'paused' | 'completed' | 'archived'

export type TaskStatus = 'not_started' | 'in_progress' | 'done' | 'blocked'

export type RiskSeverity = 'low' | 'medium' | 'high'

export type HealthStatus = 'green' | 'amber' | 'red'

export type RIBAStage = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7

// ── Models ──────────────────────────────────────────────────

export interface User {
  id: string
  name: string
  email: string
  role: Role
  avatar_url?: string
  created_at: string
  updated_at: string
}

export interface Project {
  id: string
  name: string
  client: string
  description?: string
  start_date: string
  target_completion_date?: string
  current_stage: RIBAStage
  status: ProjectStatus
  project_lead_user_id?: string
  created_by_user_id: string
  created_at: string
  updated_at: string
  last_activity_at: string
}

export interface Task {
  id: string
  project_id: string
  title: string
  description?: string
  stage: RIBAStage
  status: TaskStatus
  owner_user_id?: string
  due_date?: string
  required_flag: boolean
  created_at: string
  updated_at: string
  expected_start_date?: string
  expected_end_date?: string
  category?: string
  fee_impact_flag?: boolean
  billing_milestone_flag?: boolean
}

export interface RiskAlert {
  id: string
  project_id: string
  task_id?: string
  title: string
  description: string
  severity: RiskSeverity
  source_type: string
  resolved_flag: boolean
  suggested_action?: string
  created_at: string
  updated_at: string
}

// ── Phase 2: Approval Types ─────────────────────────────────

export type ApprovalStatus = 'pending' | 'approved' | 'returned'

export interface ApprovalRequest {
  id: string
  project_id: string
  item_type: 'task' | 'document'
  item_id: string
  item_title: string
  submitted_by_user_id: string
  reviewer_user_id: string
  status: ApprovalStatus
  submitted_at: string
  reviewed_at?: string
  reviewer_comments?: string
  created_at: string
  updated_at: string
}

// ── Phase 2: Issues / Changes / Risks Types ─────────────────

export type IssueStatus = 'open' | 'in_progress' | 'resolved' | 'closed'
export type ChangeStatus = 'raised' | 'under_review' | 'approved' | 'rejected'
export type RiskRegisterStatus = 'open' | 'mitigated' | 'closed'
export type RiskProbability = 'low' | 'medium' | 'high'
export type RiskImpact = 'low' | 'medium' | 'high'

export interface Issue {
  id: string
  project_id: string
  issue_type: string
  title: string
  description: string
  owner_user_id: string
  status: IssueStatus
  raised_date: string
  resolved_date?: string
}

export interface Change {
  id: string
  project_id: string
  change_type: string
  title: string
  description: string
  initiated_by_user_id: string
  date_raised: string
  commercial_effect_note?: string
  programme_effect_note?: string
  approval_status: ChangeStatus
}

export interface RiskRegisterItem {
  id: string
  project_id: string
  risk_type: string
  title: string
  description: string
  probability: RiskProbability
  impact: RiskImpact
  owner_user_id: string
  mitigation: string
  status: RiskRegisterStatus
}

// ── Phase 2: Meeting Types ──────────────────────────────────

export type MeetingType = 'design_team' | 'client_review' | 'site_meeting' | 'consultant' | 'contractor' | 'other'
export type ActionStatus = 'open' | 'done' | 'overdue'

export interface Meeting {
  id: string
  project_id: string
  meeting_type: MeetingType
  title: string
  meeting_date: string
  location: string
  organiser_user_id: string
  notes?: string
}

export interface MeetingAction {
  id: string
  meeting_id: string
  task_id?: string
  action_description: string
  assigned_to_user_id: string
  due_date: string
  status: ActionStatus
}

// ── Phase 2 Wave 2: Design Risk Types ───────────────────────

export type DesignRiskReviewStatus = 'open' | 'under_review' | 'accepted' | 'closed'

export interface DesignRisk {
  id: string
  project_id: string
  stage_code: RIBAStage
  title: string
  description: string
  unusual_or_significant_flag: boolean
  mitigation: string
  residual_risk_note?: string
  owner_user_id: string
  review_status: DesignRiskReviewStatus
  created_at: string
  updated_at: string
}

// ── Phase 2 Wave 2: Contract Administration Types ───────────

export type ProcurementRoute = 'traditional' | 'design_and_build' | 'management' | 'construction_management'
export type ContractForm = 'JCT_SBC' | 'JCT_MW' | 'JCT_DB' | 'NEC3' | 'NEC4' | 'other'
export type ContractEventStatus = 'draft' | 'issued' | 'responded' | 'overdue' | 'closed'

export interface ContractAdminRecord {
  id: string
  project_id: string
  procurement_route: ProcurementRoute
  contract_form: ContractForm
  administrator_role: string
  key_dates_json: string
  notes?: string
}

export interface ContractEvent {
  id: string
  project_id: string
  event_type: string
  event_ref: string
  title: string
  description: string
  issue_date: string
  response_due_date: string
  status: ContractEventStatus
  created_by_user_id: string
  created_at: string
  updated_at: string
}

// ── Phase 2 Wave 2: Planning & Site Context Types ───────────

export interface PlanningRecord {
  id: string
  project_id: string
  record_type: string
  reference: string
  title: string
  description: string
  date_submitted?: string
  date_determined?: string
  status: string
  notes?: string
}

export interface SiteConstraint {
  id: string
  project_id: string
  constraint_type: string
  title: string
  description: string
  severity: RiskSeverity
  mitigation?: string
}

// ── Phase 2 Wave 2: Tender Types ────────────────────────────

export type TenderStatus = 'preparation' | 'issued' | 'returned' | 'evaluation' | 'awarded' | 'cancelled'

export interface TenderRecord {
  id: string
  project_id: string
  tender_name: string
  procurement_route: string
  itt_issue_date?: string
  return_date?: string
  status: TenderStatus
  notes?: string
}

export interface TenderReturn {
  id: string
  tender_record_id: string
  bidder_name: string
  return_date: string
  compliance_status: string
  price_summary: string
  notes?: string
}

export interface TenderEvaluation {
  id: string
  tender_return_id: string
  criterion_name: string
  weighting: number
  score: number
  evaluator_user_id: string
  notes?: string
}

// ── Phase 2 Wave 2: Site Query Types ────────────────────────

export type SiteQueryStatus = 'open' | 'responded' | 'closed'

export interface SiteQuery {
  id: string
  project_id: string
  title: string
  description: string
  raised_by_user_id: string
  owner_user_id: string
  due_date: string
  status: SiteQueryStatus
  response_notes?: string
  created_at: string
  updated_at: string
}

// ── Phase 2 Wave 3: Building Regulations Types ────────────────
export type BuildingRegStatus = 'not_submitted' | 'submitted' | 'in_progress' | 'approved' | 'rejected' | 'conditional'
export type BuildingRegRoute = 'full_plans' | 'building_notice' | 'initial_notice' | 'regularisation'

export interface BuildingRegRecord {
  id: string
  project_id: string
  submission_route: BuildingRegRoute
  reference: string
  title: string
  description: string
  submitted_date?: string
  decision_date?: string
  status: BuildingRegStatus
  inspector_name?: string
  inspection_notes?: string
  conditions?: string
  created_at: string
  updated_at: string
}

export type InspectionStatus = 'scheduled' | 'passed' | 'failed' | 'requires_revisit'

export interface BuildingInspection {
  id: string
  building_reg_id: string
  project_id: string
  inspection_type: string
  scheduled_date: string
  completed_date?: string
  status: InspectionStatus
  inspector_notes?: string
  follow_up_required: boolean
}

// ── Phase 2 Wave 3: BRPD / Dutyholder Coordination Types ─────
export type DutyholderRole = 'client' | 'principal_designer' | 'principal_contractor' | 'designer' | 'contractor'
export type ComplianceStatus = 'compliant' | 'non_compliant' | 'pending_review' | 'not_applicable'

export interface DutyholderRecord {
  id: string
  project_id: string
  role: DutyholderRole
  organisation_name: string
  contact_name: string
  contact_email?: string
  appointed_date: string
  competence_evidence?: string
  compliance_status: ComplianceStatus
  notes?: string
}

export interface BRPDGateway {
  id: string
  project_id: string
  gateway_number: 1 | 2 | 3
  title: string
  description: string
  target_date: string
  completed_date?: string
  status: 'not_started' | 'in_progress' | 'submitted' | 'passed' | 'failed'
  evidence_notes?: string
}

// ── Phase 2 Wave 3: Enhanced Documents Types ──────────────────
export type DocumentCategory = 'drawing' | 'specification' | 'report' | 'correspondence' | 'certificate' | 'schedule' | 'other'
export type DocumentStatus = 'draft' | 'for_review' | 'approved' | 'superseded' | 'archived'

export interface DocumentRecord {
  id: string
  project_id: string
  title: string
  document_ref: string
  category: DocumentCategory
  status: DocumentStatus
  revision: string
  stage: RIBAStage
  uploaded_by_user_id: string
  file_url?: string
  description?: string
  created_at: string
  updated_at: string
}

export interface DocumentTransmittal {
  id: string
  project_id: string
  transmittal_ref: string
  recipient: string
  issued_date: string
  document_ids: string[]
  purpose: 'for_information' | 'for_approval' | 'for_construction' | 'for_comment' | 'as_built'
  notes?: string
  status: 'draft' | 'issued' | 'acknowledged'
}

// ── Phase 3: Knowledge Base Types ────────────────────────────
export type KnowledgeCategory = 'lessons_learned' | 'office_procedure' | 'checklist' | 'reference_note' | 'fee_clause' | 'template' | 'guidance'

export interface KnowledgeArticle {
  id: string
  organisation_id: string
  title: string
  summary: string
  body_markdown: string
  category: KnowledgeCategory
  tags: string[]
  related_stage?: RIBAStage
  related_sector?: string
  related_contract_type?: string
  owner_user_id: string
  published_flag: boolean
  created_at: string
  updated_at: string
}

// ── Phase 3: CPD & Competence Types ──────────────────────────
export interface CPDRecord {
  id: string
  user_id: string
  title: string
  provider: string
  cpd_topic: string
  hours: number
  completion_date: string
  evidence_url?: string
  mandatory_flag: boolean
  notes?: string
}

export interface Competency {
  id: string
  organisation_id: string
  name: string
  category: string
  description: string
}

export interface UserCompetency {
  id: string
  user_id: string
  competency_id: string
  proficiency_level: 'none' | 'basic' | 'intermediate' | 'advanced' | 'expert'
  evidence_url?: string
  last_reviewed_at: string
}

export interface TrainingPlan {
  id: string
  user_id: string
  title: string
  objective: string
  due_date: string
  status: 'not_started' | 'in_progress' | 'completed' | 'overdue'
  manager_notes?: string
}

// ── Phase 3: Internationalisation Types ──────────────────────
export interface JurisdictionPack {
  id: string
  country: string
  region?: string
  language: string
  currency: string
  units: 'metric' | 'imperial'
  date_format: string
  stage_labels: Record<RIBAStage, string>
  terminology_notes?: string
  reference_guidance_notes?: string
}

export interface OrganisationSettings {
  id: string
  organisation_id: string
  default_currency: string
  default_units: 'metric' | 'imperial'
  date_format: string
  jurisdiction_pack_id?: string
  project_number_template?: string
  terminology_overrides?: Record<string, string>
}

// ── Phase 3: Admin Controls Types ────────────────────────────
export type AISourceCategory = 'project_data' | 'project_documents' | 'knowledge_base' | 'reference_uploads' | 'fee_data'

export interface AISourcePermission {
  id: string
  organisation_id: string
  source_category: AISourceCategory
  enabled: boolean
  updated_at: string
}

export interface AILog {
  id: string
  organisation_id: string
  user_id: string
  project_id?: string
  prompt: string
  response_summary: string
  source_categories_used: AISourceCategory[]
  confidence_level: 'high' | 'medium' | 'low'
  created_at: string
}

// ── Phase 3 Wave 2: Drawing Issue Intelligence Types ────────
export type DrawingIssueType = 'planning' | 'sketch' | 'working' | 'as_built' | 'tender' | 'construction' | 'custom'

export interface DrawingIssueRecord {
  id: string
  project_id: string
  drawing_ref: string
  drawing_title: string
  issue_type: DrawingIssueType
  stage: RIBAStage
  issued_date: string
  issued_to: string
  revision: string
  supersedes?: string
  notes?: string
  created_by_user_id: string
}

// ── Phase 3 Wave 2: Commercial Reporting Types ──────────────
export type CommercialHealthFlag = 'healthy' | 'watch' | 'at_risk' | 'critical'

export interface ProjectCommercial {
  id: string
  project_id: string
  agreed_fee: number
  fee_invoiced: number
  fee_paid: number
  wip_value: number
  expenses: number
  time_logged_hours: number
  estimated_hours_remaining: number
  approved_variations: number
  current_margin_percent: number
  forecast_margin_percent: number
  stage_overspend_flag: boolean
  health_flag: CommercialHealthFlag
  last_updated: string
}

export interface CashflowForecast {
  id: string
  organisation_id: string
  month: string
  projected_income: number
  projected_expenses: number
  actual_income?: number
  actual_expenses?: number
  pipeline_value: number
}

// ── Phase 3 Wave 2: Staffing & Utilisation Types ────────────
export interface StaffAllocation {
  id: string
  user_id: string
  project_id: string
  stage: RIBAStage
  hours_per_week: number
  start_date: string
  end_date: string
  role_on_project: string
}

export interface StaffCapacity {
  user_id: string
  name: string
  role: string
  weekly_capacity_hours: number
  allocated_hours: number
  utilisation_percent: number
  status: 'under' | 'optimal' | 'over'
}

export type UtilisationStatus = 'under' | 'optimal' | 'over'

// ── Phase 3 Wave 3: Fee Recommendation Types ────────────────
export interface FeeRecommendation {
  id: string
  organisation_id: string
  project_type: string
  sector: string
  scale_estimate: number
  procurement_route: string
  complexity: 'low' | 'medium' | 'high'
  stage_scope: string
  staffing_mix_notes: string
  overhead_percent: number
  margin_percent: number
  recommended_fee_low: number
  recommended_fee_high: number
  recommended_stage_split: Record<string, number>
  confidence_level: 'high' | 'medium' | 'low'
  similar_project_ids: string[]
  notes?: string
  created_at: string
  created_by_user_id: string
}

// ── Phase 3 Wave 3: Fee Quote Types ─────────────────────────
export type FeeQuoteStatus = 'draft' | 'internal_review' | 'ready_to_send' | 'sent' | 'viewed' | 'revised' | 'accepted' | 'declined' | 'expired' | 'superseded' | 'converted_to_project'

export type FeeQuoteOptionalStatus = 'follow_up_required' | 'awaiting_client_clarification' | 'awaiting_deposit'

export type QuoteMode = 'existing_project' | 'standalone'

export type QuoteTemplateType = 'planning' | 'technical' | 'full_service' | 'brpd' | 'cdm_pd'

export type QuoteLineType = 'stage_service' | 'additional_service' | 'optional_service' | 'consultant_coordination' | 'travel_mileage' | 'expense_allowance' | 'cgi_render' | 'contract_admin' | 'interior_design' | 'brpd_service' | 'cdm_pd_service' | 'other_custom'

export interface FeeQuoteRecord {
  id: string
  organisation_id: string
  quote_mode: QuoteMode
  related_project_id?: string
  related_opportunity_id?: string
  quote_reference: string
  quote_title: string
  quote_template_type: QuoteTemplateType
  status: FeeQuoteStatus
  optional_status?: FeeQuoteOptionalStatus
  client_name: string
  client_contact?: string
  issue_date: string
  valid_until: string
  fee_basis: string
  total_fee: number
  currency: string
  prepared_by_user_id: string
  sent_at?: string
  sent_count: number
  viewed_count: number
  last_viewed_at?: string
  accepted_at?: string
  accepted_by?: string
  declined_at?: string
  // Content fields
  project_summary?: string
  scope_summary?: string
  exclusions_text: string
  assumptions_text: string
  terms_text: string
  payment_terms_text: string
  acceptance_note?: string
  // Commercial assumptions
  meetings_included_count?: number
  meeting_type_notes?: string
  mileage_rate?: number
  travel_allowance?: number
  travel_billing_rule?: string
  site_visit_assumptions?: string
  expense_allowance?: number
  reimbursable_expenses_note?: string
  design_freeze_flag: boolean
  design_freeze_wording?: string
  variation_fee_note?: string
  deposit_required_flag: boolean
  deposit_amount?: number
  construction_stage_allowance?: string
  cgi_render_flag: boolean
  consultant_coordination_flag: boolean
  brpd_role_flag: boolean
  cdm_pd_role_flag: boolean
  dutyholder_coordination_note?: string
  design_risk_coordination_note?: string
  // Presentation
  logo_style_ref?: string
  accent_colour?: string
  cover_image_url?: string
  // Timestamps
  created_at: string
  updated_at: string
}

export interface FeeQuoteLineItem {
  id: string
  fee_quote_id: string
  sort_order: number
  line_type: QuoteLineType
  title: string
  description: string
  related_stage?: RIBAStage
  quantity?: number
  unit?: string
  rate?: number
  amount: number
  optional_flag: boolean
  selected_by_default: boolean
  image_url?: string
}


// ── Phase 4: Fee Quote Sections ──────────────────────────────
export type QuoteSectionType = 'cover' | 'project_understanding' | 'scope_of_service' | 'stage_breakdown' | 'optional_extras' | 'consultant_coordination' | 'programme_assumptions' | 'design_freeze_note' | 'meetings_and_communication' | 'expenses_and_travel' | 'exclusions' | 'terms_and_conditions' | 'payment_terms' | 'acceptance'

export interface FeeQuoteSection {
  id: string
  fee_quote_id: string
  section_type: QuoteSectionType
  title: string
  body_text: string
  sort_order: number
  image_url?: string
}

export interface FeeQuoteView {
  id: string
  fee_quote_id: string
  viewer_identifier: string
  viewed_at: string
  source: 'email' | 'portal' | 'direct_link'
}

export interface FeeQuoteTemplate {
  id: string
  organisation_id: string
  name: string
  template_type: QuoteTemplateType
  description: string
  suitable_for: string[]
  default_sections: QuoteSectionType[]
  body_json: string
  active_flag: boolean
  created_at: string
}

export interface TermsLibraryItem {
  id: string
  organisation_id: string
  title: string
  terms_text: string
  category: string
  active_flag: boolean
  created_at: string
}

export interface ExclusionsLibraryItem {
  id: string
  organisation_id: string
  title: string
  exclusions_text: string
  active_flag: boolean
  created_at: string
}

// ── Phase 4: Project Health Snapshots ────────────────────────
export interface ProjectHealthSnapshot {
  id: string
  project_id: string
  snapshot_date: string
  health_score: number
  forecast_margin: number
  burn_ratio: number
  quote_review_flag: boolean
  near_loss_flag: boolean
  billing_risk_flag: boolean
  reasons_json: string[]
}

// ── Phase 4: Task Schedule Metrics ──────────────────────────
export interface TaskScheduleMetric {
  id: string
  project_id: string
  task_id: string
  stage_code: RIBAStage
  category: string
  expected_start_date?: string
  expected_end_date?: string
  actual_completion_date?: string
  delay_days?: number
}

// ── Phase 4: Numbering Templates ────────────────────────────
export interface ProjectNumberTemplate {
  id: string
  organisation_id: string
  office_id?: string
  project_type?: string
  template_name: string
  format_string: string
  active_flag: boolean
  created_at: string
}

export interface QuoteNumberTemplate {
  id: string
  organisation_id: string
  template_name: string
  format_string: string
  active_flag: boolean
  created_at: string
}

export interface DrawingIssueTemplate {
  id: string
  organisation_id: string
  issue_type: string
  format_string: string
  active_flag: boolean
  created_at: string
}

// ── Phase 4 Wave 2: Health Engine Types ─────────────────────

export type HealthAlertSeverity = 'info' | 'warning' | 'critical'
export type HealthAlertCategory = 'burn_rate' | 'margin_erosion' | 'billing_gap' | 'scope_creep' | 'programme_delay' | 'near_loss' | 'fee_overrun'

export interface ProjectHealthAlert {
  id: string
  project_id: string
  category: HealthAlertCategory
  severity: HealthAlertSeverity
  title: string
  description: string
  metric_value: number
  threshold_value: number
  suggested_action: string
  acknowledged_flag: boolean
  acknowledged_by_user_id?: string
  acknowledged_at?: string
  created_at: string
}

export interface BurnBudgetMetric {
  project_id: string
  stage: RIBAStage
  stage_label: string
  budgeted_hours: number
  actual_hours: number
  budgeted_fee: number
  actual_fee_earned: number
  burn_ratio: number // actual / budgeted (>1 = overspend)
  variance_percent: number
}

export interface QuoteProjectLink {
  id: string
  fee_quote_id: string
  project_id?: string // null = not yet linked
  linked_at?: string
  linked_by_user_id?: string
  auto_created_flag: boolean
  project_creation_status: 'pending' | 'created' | 'skipped'
}

export interface QuoteConversionMetric {
  sector: string
  total_quotes: number
  accepted_quotes: number
  win_rate: number
  total_value: number
  won_value: number
  avg_days_to_accept: number
  avg_quote_value: number
}

// ── Phase 3 Wave 3: Opportunities / Proposals Types ─────────
export type OpportunityStatus = 'lead' | 'qualifying' | 'proposal_sent' | 'negotiation' | 'won' | 'lost' | 'dormant'

export interface Opportunity {
  id: string
  organisation_id: string
  title: string
  client_name: string
  sector: string
  estimated_value: number
  status: OpportunityStatus
  expected_start_date?: string
  likelihood_percentage: number
  owner_user_id: string
  notes?: string
  linked_quote_ids: string[]
  created_at: string
  updated_at: string
}

// ── Phase 3 Wave 4: AI Teammate Types ─────────────────────
export type AIMessageRole = 'user' | 'assistant' | 'system'

export interface AIConversation {
  id: string
  organisation_id: string
  project_id?: string // null = global, set = project-scoped
  title: string
  started_by_user_id: string
  messages: AIMessage[]
  created_at: string
  updated_at: string
}

export interface AIMessage {
  id: string
  conversation_id: string
  role: AIMessageRole
  content: string
  sources?: AISource[]
  timestamp: string
}

export interface AISource {
  type: 'project' | 'task' | 'document' | 'knowledge' | 'risk' | 'regulation'
  title: string
  reference_id: string
  url?: string
}

export interface AISuggestedPrompt {
  id: string
  label: string
  prompt: string
  scope: 'global' | 'project'
  category: string
}

// ── Phase 3 Wave 4: Integrations Types ────────────────────
export type IntegrationProvider = 'xero' | 'quickbooks' | 'outlook' | 'google_calendar' | 'sharepoint' | 'dropbox'
export type IntegrationStatus = 'connected' | 'disconnected' | 'error' | 'syncing'

export interface Integration {
  id: string
  organisation_id: string
  provider: IntegrationProvider
  display_name: string
  description: string
  status: IntegrationStatus
  connected_by_user_id?: string
  connected_at?: string
  last_sync_at?: string
  sync_frequency_minutes?: number
  config: Record<string, string>
  category: 'accounting' | 'calendar' | 'storage'
}

// ── Phase 3 Wave 4: External Collaboration Portal Types ───
export type PortalAccessLevel = 'view_only' | 'comment' | 'approve'

export interface PortalInvite {
  id: string
  project_id: string
  email: string
  name: string
  organisation: string
  role: string // e.g. 'Client', 'Structural Engineer', 'Planning Consultant'
  access_level: PortalAccessLevel
  invited_by_user_id: string
  accepted: boolean
  invited_at: string
  last_accessed_at?: string
}

export interface PortalSharedItem {
  id: string
  project_id: string
  item_type: 'document' | 'approval' | 'drawing' | 'report' | 'meeting_minutes'
  item_id: string
  title: string
  shared_at: string
  shared_by_user_id: string
  visible_to_portal_invite_ids: string[]
  requires_sign_off: boolean
  signed_off_by?: string
  signed_off_at?: string
}

// ── Computed / Dashboard Types ──────────────────────────────

export interface ProjectDashboard {
  project: Project
  lead?: User
  overall_completion: number
  stage_completion: number
  total_tasks: number
  tasks_by_status: Record<TaskStatus, number>
  overdue_tasks: Task[]
  required_outstanding: Task[]
  risks: RiskAlert[]
  health: HealthStatus
  next_actions: Task[]
}

export interface PracticeOverview {
  total_active: number
  projects_by_stage: Record<number, number>
  high_risk_count: number
  overdue_tasks_count: number
  project_summaries: ProjectSummary[]
}

export interface ProjectSummary {
  project: Project
  lead?: User
  completion: number
  stage_completion: number
  open_risks: number
  overdue_tasks: number
  health: HealthStatus
}

// ── Phase 4 Wave 3: BRPD Compliance & Drawing Workflow Types ─

export type ComplianceStatementStatus = 'draft' | 'under_review' | 'approved' | 'expired' | 'rejected'
export type BRPDRequirementStatus = 'not_started' | 'in_progress' | 'evidenced' | 'verified' | 'non_compliant'
export type BRPDChangeType = 'dutyholder_change' | 'gateway_update' | 'compliance_update' | 'document_revision' | 'requirement_update' | 'evidence_upload'
export type DrawingWorkflowStatus = 'draft' | 'issued' | 'queried' | 'responded' | 'closed' | 'escalated'
export type DrawingEmailDirection = 'outbound' | 'inbound'

export interface ComplianceStatement {
  id: string
  project_id: string
  title: string
  description: string
  regulation_ref: string
  responsible_dutyholder_id: string
  status: ComplianceStatementStatus
  evidence_document_ids: string[]
  due_date: string
  submitted_date?: string
  approved_date?: string
  approved_by_user_id?: string
  notes?: string
  created_at: string
  updated_at: string
}

export interface BRPDRequirement {
  id: string
  project_id: string
  gateway_number: 1 | 2 | 3
  requirement_ref: string
  title: string
  description: string
  status: BRPDRequirementStatus
  assigned_dutyholder_id?: string
  evidence_notes?: string
  target_date: string
  completed_date?: string
  verified_by_user_id?: string
  category: 'design' | 'safety' | 'fire' | 'structural' | 'accessibility' | 'environmental'
}

export interface BRPDChangelogEntry {
  id: string
  project_id: string
  change_type: BRPDChangeType
  title: string
  description: string
  reference_id?: string
  previous_value?: string
  new_value?: string
  changed_by_user_id: string
  changed_at: string
  approved_flag: boolean
  approved_by_user_id?: string
}

export interface DrawingIssueWorkflow {
  id: string
  project_id: string
  drawing_issue_id: string
  drawing_ref: string
  drawing_title: string
  status: DrawingWorkflowStatus
  issued_to_name: string
  issued_to_email: string
  issued_date: string
  response_due_date: string
  response_received_date?: string
  closed_date?: string
  escalated_flag: boolean
  escalated_to_user_id?: string
  query_count: number
  created_by_user_id: string
}

export interface DrawingEmail {
  id: string
  workflow_id: string
  direction: DrawingEmailDirection
  from_name: string
  from_email: string
  to_name: string
  to_email: string
  subject: string
  body_preview: string
  sent_at: string
  has_attachment: boolean
  attachment_names?: string[]
}

// ── Phase 4 Wave 4: Project Creation & Access Control Types ─

export type WizardStepStatus = 'not_started' | 'in_progress' | 'complete' | 'skipped'

export interface WizardStep {
  number: number
  title: string
  description: string
  required: boolean
  fields: string[]
  help_text?: string
}

export type BriefSectionStatus = 'empty' | 'draft' | 'complete' | 'approved'

export interface BriefSection {
  id: string
  project_id: string
  section_number: number
  title: string
  description: string
  content: string
  status: BriefSectionStatus
  required: boolean
  last_edited_by_user_id?: string
  last_edited_at?: string
  approved_by_user_id?: string
  approved_at?: string
}

export interface ProjectBrief {
  id: string
  project_id: string
  version: number
  status: 'draft' | 'issued' | 'superseded'
  sections: BriefSection[]
  created_by_user_id: string
  created_at: string
  updated_at: string
  issued_date?: string
  issued_to?: string
}

export type AccountingSyncStatus = 'synced' | 'pending' | 'failed' | 'not_linked'

export interface QuoteAccountingLink {
  id: string
  fee_quote_id: string
  provider: 'xero' | 'quickbooks'
  external_ref: string
  external_invoice_id?: string
  sync_status: AccountingSyncStatus
  last_synced_at?: string
  error_message?: string
  auto_sync_enabled: boolean
  mapped_fields: string[]
}

export type FeatureArea = 'projects' | 'fee_quotes' | 'analytics' | 'ai_teammate' | 'integrations' | 'portal' | 'admin' | 'knowledge' | 'cpd' | 'staffing'

export interface RoleVisibilityRule {
  id: string
  organisation_id: string
  role: 'practice_owner' | 'project_lead' | 'team_member'
  feature_area: FeatureArea
  can_view: boolean
  can_edit: boolean
  can_delete: boolean
  can_export: boolean
  restriction_notes?: string
}

// ── Leave & Holidays ────────────────────────────────────────

export type LeaveType = 'holiday' | 'sick' | 'cpd' | 'parental' | 'compassionate' | 'unpaid'
export type LeaveStatus = 'pending' | 'approved' | 'declined' | 'cancelled'

export interface LeaveRecord {
  id: string
  user_id: string
  leave_type: LeaveType
  status: LeaveStatus
  start_date: string
  end_date: string
  days: number
  half_day_start?: boolean
  half_day_end?: boolean
  notes?: string
  approved_by_user_id?: string
  approved_at?: string
  created_at: string
}

export interface LeaveEntitlement {
  user_id: string
  year: number
  total_days: number
  used_days: number
  pending_days: number
  carried_over: number
}

export interface BankHoliday {
  date: string
  name: string
  region: 'england-wales' | 'scotland' | 'northern-ireland' | 'all'
}

// ── Phase 5: Timesheets ─────────────────────────────────────

export type TimesheetStatus = 'draft' | 'submitted' | 'approved' | 'rejected'

export type TimesheetCategory = 'marketing_bid' | 'strategic_definition' | 'briefing' | 'concept_design' | 'planning_spatial' | 'technical_design' | 'tender' | 'construction_ca' | 'handover_use' | 'admin_cpd_office'

export interface TimesheetEntry {
  id: string
  user_id: string
  project_id: string
  task_id?: string
  date: string
  hours: number
  description?: string
  notes?: string
  stage: RIBAStage
  project_stage?: RIBAStage
  task_category: TimesheetCategory
  billable: boolean
  status: TimesheetStatus
  submitted_at?: string
  approved_by?: string
  approved_at?: string
  expected_start_date?: string
  expected_end_date?: string
  created_at: string
}

export interface TimesheetWeekSummary {
  user_id: string
  week_start: string
  total_hours: number
  billable_hours: number
  submitted: boolean
  missing_days: number
}

// ── Phase 5: Invoices ───────────────────────────────────────

export type InvoiceStatus = 'draft' | 'sent' | 'viewed' | 'due' | 'overdue' | 'paid' | 'void'

export interface Invoice {
  id: string
  invoice_number: string
  project_id: string
  client: string
  quote_id?: string
  amount: number
  vat_amount: number
  total_amount: number
  status: InvoiceStatus
  issued_date?: string
  due_date: string
  paid_date?: string
  payment_reference?: string
  xero_synced: boolean
  xero_invoice_id?: string
  description: string
  line_items: InvoiceLineItem[]
  created_at: string
  updated_at: string
}

export interface InvoiceLineItem {
  id: string
  description: string
  stage?: RIBAStage
  quantity: number
  unit_price: number
  amount: number
}

// ── Phase 5: Overheads ──────────────────────────────────────

export type OverheadCategory = 'rent' | 'internet' | 'telephones' | 'printing' | 'software' | 'insurance' | 'utilities' | 'office_admin' | 'travel' | 'professional_fees'

export interface OverheadEntry {
  id: string
  category: OverheadCategory
  description: string
  amount: number
  date: string
  recurring: boolean
  frequency?: 'monthly' | 'quarterly' | 'annual'
}

export interface OverheadSummary {
  category: OverheadCategory
  monthly_total: number
  ytd_total: number
  budget?: number
}

// ── Phase 5: News & Regulations ─────────────────────────────

export type NewsCategory = 'architecture' | 'construction' | 'regulations' | 'planning' | 'company'

export interface NewsItem {
  id: string
  title: string
  summary: string
  category: NewsCategory
  source: string
  url?: string
  published_at: string
  pinned: boolean
  hidden: boolean
}

// ── Phase 5: Dashboard Metrics ──────────────────────────────

export interface DashboardKPIs {
  active_projects: number
  projects_at_risk: number
  missing_timesheets: number
  open_invoice_value: number
  quotes_expiring: number
  brpd_deadlines: number
  approvals_waiting: number
}

export interface ProjectUpdate {
  id: string
  project_id: string
  project_name: string
  event_type: 'milestone' | 'upload_missing' | 'planning_due' | 'approval_returned' | 'stage_blocked' | 'drawing_issued' | 'brpd_upload' | 'site_query' | 'invoice_issued' | 'quote_accepted'
  description: string
  severity: 'info' | 'warning' | 'critical'
  timestamp: string
  actor?: string
}

// ── RIBA Stage Info ─────────────────────────────────────────

export const RIBA_STAGES: Record<RIBAStage, string> = {
  0: 'Strategic Definition',
  1: 'Preparation & Briefing',
  2: 'Concept Design',
  3: 'Spatial Coordination',
  4: 'Technical Design',
  5: 'Manufacturing & Construction',
  6: 'Handover',
  7: 'Use',
}

export const RIBA_STAGE_COLORS: Record<RIBAStage, string> = {
  0: '#6366f1', // indigo
  1: '#8b5cf6', // violet
  2: '#0ea5e9', // sky
  3: '#06b6d4', // cyan
  4: '#0c85f1', // brand blue
  5: '#f59e0b', // amber
  6: '#10b981', // emerald
  7: '#6b7280', // gray
}

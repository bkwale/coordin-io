// Mock data cleared — all data now comes from the database via Prisma

import { User, Project, Task, RIBAStage, ApprovalRequest, Issue, Change, RiskRegisterItem, Meeting, MeetingAction, DesignRisk, ContractAdminRecord, ContractEvent, PlanningRecord, SiteConstraint, TenderRecord, TenderReturn, TenderEvaluation, SiteQuery, BuildingRegRecord, BuildingInspection, DutyholderRecord, BRPDGateway, DocumentRecord, DocumentTransmittal, KnowledgeArticle, CPDRecord, Competency, UserCompetency, TrainingPlan, JurisdictionPack, OrganisationSettings, AISourcePermission, AILog, DrawingIssueRecord, ProjectCommercial, CashflowForecast, StaffAllocation, StaffCapacity, FeeRecommendation, FeeQuoteRecord, FeeQuoteLineItem, Opportunity, AISuggestedPrompt, AIConversation, Integration, PortalInvite, PortalSharedItem, FeeQuoteSection, FeeQuoteView, FeeQuoteTemplate, TermsLibraryItem, ExclusionsLibraryItem, ProjectHealthSnapshot, ProjectNumberTemplate, QuoteNumberTemplate, DrawingIssueTemplate, ProjectHealthAlert, BurnBudgetMetric, QuoteProjectLink, QuoteConversionMetric, ComplianceStatement, BRPDRequirement, BRPDChangelogEntry, DrawingIssueWorkflow, DrawingEmail, WizardStep, BriefSection, ProjectBrief, QuoteAccountingLink, RoleVisibilityRule, LeaveRecord, BankHoliday, LeaveEntitlement, TimesheetEntry, TimesheetWeekSummary, Invoice, OverheadEntry, OverheadSummary, OverheadCategory, NewsItem, DashboardKPIs, ProjectUpdate } from './types'
import { STAGE_TEMPLATES } from './stage-templates'

// Suppress unused-import warnings for types retained for downstream compatibility
void STAGE_TEMPLATES

// ── Empty Data Arrays ──────────────────────────────────────────

export const USERS: User[] = []
export const PROJECTS: Project[] = []
export const ALL_TASKS: Task[] = []
export const APPROVALS: ApprovalRequest[] = []
export const ISSUES: Issue[] = []
export const CHANGES: Change[] = []
export const RISK_REGISTER: RiskRegisterItem[] = []
export const MEETINGS: Meeting[] = []
export const MEETING_ACTIONS: MeetingAction[] = []
export const DESIGN_RISKS: DesignRisk[] = []
export const CONTRACT_ADMIN_RECORDS: ContractAdminRecord[] = []
export const CONTRACT_EVENTS: ContractEvent[] = []
export const PLANNING_RECORDS: PlanningRecord[] = []
export const SITE_CONSTRAINTS: SiteConstraint[] = []
export const TENDER_RECORDS: TenderRecord[] = []
export const TENDER_RETURNS: TenderReturn[] = []
export const TENDER_EVALUATIONS: TenderEvaluation[] = []
export const SITE_QUERIES: SiteQuery[] = []
export const BUILDING_REG_RECORDS: BuildingRegRecord[] = []
export const BUILDING_INSPECTIONS: BuildingInspection[] = []
export const DUTYHOLDER_RECORDS: DutyholderRecord[] = []
export const BRPD_GATEWAYS: BRPDGateway[] = []
export const DOCUMENT_RECORDS: DocumentRecord[] = []
export const DOCUMENT_TRANSMITTALS: DocumentTransmittal[] = []
export const KNOWLEDGE_ARTICLES: KnowledgeArticle[] = []
export const CPD_RECORDS: CPDRecord[] = []
export const COMPETENCIES: Competency[] = []
export const USER_COMPETENCIES: UserCompetency[] = []
export const TRAINING_PLANS: TrainingPlan[] = []
export const JURISDICTION_PACKS: JurisdictionPack[] = []
export const ORGANISATION_SETTINGS: OrganisationSettings[] = []
export const AI_SOURCE_PERMISSIONS: AISourcePermission[] = []
export const AI_LOGS: AILog[] = []
export const DRAWING_ISSUE_RECORDS: DrawingIssueRecord[] = []
export const PROJECT_COMMERCIALS: ProjectCommercial[] = []
export const CASHFLOW_FORECASTS: CashflowForecast[] = []
export const STAFF_ALLOCATIONS: StaffAllocation[] = []
export const STAFF_CAPACITIES: StaffCapacity[] = []
export const FEE_RECOMMENDATIONS: FeeRecommendation[] = []
export const FEE_QUOTE_RECORDS: FeeQuoteRecord[] = []
export const FEE_QUOTE_LINE_ITEMS: FeeQuoteLineItem[] = []
export const FEE_QUOTE_SECTIONS: FeeQuoteSection[] = []
export const FEE_QUOTE_VIEWS: FeeQuoteView[] = []
export const FEE_QUOTE_TEMPLATES: FeeQuoteTemplate[] = []
export const TERMS_LIBRARY: TermsLibraryItem[] = []
export const EXCLUSIONS_LIBRARY: ExclusionsLibraryItem[] = []
export const PROJECT_HEALTH_SNAPSHOTS: ProjectHealthSnapshot[] = []
export const PROJECT_NUMBER_TEMPLATES: ProjectNumberTemplate[] = []
export const QUOTE_NUMBER_TEMPLATES: QuoteNumberTemplate[] = []
export const DRAWING_ISSUE_TEMPLATES: DrawingIssueTemplate[] = []
export const OPPORTUNITIES: Opportunity[] = []
export const COMPLIANCE_STATEMENTS: ComplianceStatement[] = []
export const BRPD_REQUIREMENTS: BRPDRequirement[] = []
export const BRPD_CHANGELOG: BRPDChangelogEntry[] = []
export const DRAWING_ISSUE_WORKFLOWS: DrawingIssueWorkflow[] = []
export const DRAWING_EMAILS: DrawingEmail[] = []
export const PROJECT_WIZARD_STEPS: WizardStep[] = []
export const PROJECT_BRIEFS: ProjectBrief[] = []
export const QUOTE_ACCOUNTING_LINKS: QuoteAccountingLink[] = []
export const ROLE_VISIBILITY_RULES: RoleVisibilityRule[] = []
export const LEAVE_RECORDS: LeaveRecord[] = []
export const BANK_HOLIDAYS: BankHoliday[] = []
export const LEAVE_ENTITLEMENTS: LeaveEntitlement[] = []
export const TIMESHEET_ENTRIES: TimesheetEntry[] = []
export const INVOICES: Invoice[] = []
export const OVERHEAD_ENTRIES: OverheadEntry[] = []
export const NEWS_ITEMS: NewsItem[] = []
export const PROJECT_UPDATES: ProjectUpdate[] = []

// ── Lookup Helpers (return empty results) ──────────────────────

export function getProjectTasks(_projectId: string): Task[] { return [] }
export function getUser(_userId: string): User | undefined { return undefined }
export function getProject(_projectId: string): Project | undefined { return undefined }
export function getProjectApprovals(_projectId: string): ApprovalRequest[] { return [] }
export function getProjectIssues(_projectId: string): Issue[] { return [] }
export function getProjectChanges(_projectId: string): Change[] { return [] }
export function getProjectRisks(_projectId: string): RiskRegisterItem[] { return [] }
export function getProjectMeetings(_projectId: string): Meeting[] { return [] }
export function getMeetingActions(_meetingId: string): MeetingAction[] { return [] }
export function getProjectDesignRisks(_projectId: string): DesignRisk[] { return [] }
export function getProjectContractAdmin(_projectId: string): ContractAdminRecord | undefined { return undefined }
export function getProjectContractEvents(_projectId: string): ContractEvent[] { return [] }
export function getProjectPlanningRecords(_projectId: string): PlanningRecord[] { return [] }
export function getProjectSiteConstraints(_projectId: string): SiteConstraint[] { return [] }
export function getProjectTenders(_projectId: string): TenderRecord[] { return [] }
export function getTenderReturns(_tenderRecordId: string): TenderReturn[] { return [] }
export function getTenderEvaluations(_tenderReturnId: string): TenderEvaluation[] { return [] }
export function getProjectSiteQueries(_projectId: string): SiteQuery[] { return [] }
export function getProjectBuildingRegs(_projectId: string): BuildingRegRecord[] { return [] }
export function getBuildingInspections(_buildingRegId: string): BuildingInspection[] { return [] }
export function getProjectInspections(_projectId: string): BuildingInspection[] { return [] }
export function getProjectDutyholders(_projectId: string): DutyholderRecord[] { return [] }
export function getProjectGateways(_projectId: string): BRPDGateway[] { return [] }
export function getProjectDocuments(_projectId: string): DocumentRecord[] { return [] }
export function getProjectTransmittals(_projectId: string): DocumentTransmittal[] { return [] }
export function getKnowledgeArticles(): KnowledgeArticle[] { return [] }
export function getKnowledgeArticlesByCategory(_category: string): KnowledgeArticle[] { return [] }
export function getKnowledgeArticle(_id: string): KnowledgeArticle | undefined { return undefined }
export function getUserCPDRecords(_userId: string): CPDRecord[] { return [] }
export function getAllCPDRecords(): CPDRecord[] { return [] }
export function getUserCompetencies(_userId: string): UserCompetency[] { return [] }
export function getCompetency(_id: string): Competency | undefined { return undefined }
export function getAllCompetencies(): Competency[] { return [] }
export function getUserTrainingPlans(_userId: string): TrainingPlan[] { return [] }
export function getAllTrainingPlans(): TrainingPlan[] { return [] }
export function getOrganisationSettings(): OrganisationSettings {
  return {
    id: '',
    organisation_id: '',
    default_currency: 'GBP',
    default_units: 'metric',
    date_format: 'DD/MM/YYYY',
  }
}
export function getJurisdictionPacks(): JurisdictionPack[] { return [] }
export function getAISourcePermissions(): AISourcePermission[] { return [] }
export function getAILogs(): AILog[] { return [] }
export function getProjectDrawingIssues(_projectId: string): DrawingIssueRecord[] { return [] }
export function getAllDrawingIssues(): DrawingIssueRecord[] { return [] }
export function getProjectCommercial(_projectId: string): ProjectCommercial | undefined { return undefined }
export function getAllProjectCommercials(): ProjectCommercial[] { return [] }
export function getCashflowForecasts(): CashflowForecast[] { return [] }
export function getStaffAllocations(): StaffAllocation[] { return [] }
export function getUserAllocations(_userId: string): StaffAllocation[] { return [] }
export function getProjectAllocations(_projectId: string): StaffAllocation[] { return [] }
export function getStaffCapacities(): StaffCapacity[] { return [] }
export function getFeeRecommendations(): FeeRecommendation[] { return [] }
export function getFeeRecommendation(_id: string): FeeRecommendation | undefined { return undefined }
export function getFeeQuoteRecords(): FeeQuoteRecord[] { return [] }
export function getFeeQuoteRecord(_id: string): FeeQuoteRecord | undefined { return undefined }
export function getFeeQuoteLineItems(_quoteId: string): FeeQuoteLineItem[] { return [] }
export function getProjectFeeQuotes(_projectId: string): FeeQuoteRecord[] { return [] }
export function getFeeQuoteSections(_quoteId: string): FeeQuoteSection[] { return [] }
export function getFeeQuoteViews(_quoteId: string): FeeQuoteView[] { return [] }
export function getFeeQuoteTemplates(): FeeQuoteTemplate[] { return [] }
export function getTermsLibrary(): TermsLibraryItem[] { return [] }
export function getExclusionsLibrary(): ExclusionsLibraryItem[] { return [] }
export function getProjectHealthSnapshots(_projectId: string): ProjectHealthSnapshot[] { return [] }
export function getAllHealthSnapshots(): ProjectHealthSnapshot[] { return [] }
export function getProjectNumberTemplates(): ProjectNumberTemplate[] { return [] }
export function getQuoteNumberTemplates(): QuoteNumberTemplate[] { return [] }
export function getDrawingIssueTemplates(): DrawingIssueTemplate[] { return [] }
export function getOpportunities(): Opportunity[] { return [] }
export function getOpportunity(_id: string): Opportunity | undefined { return undefined }
export function getOpportunityQuotes(_opportunityId: string): FeeQuoteRecord[] { return [] }
export function getAISuggestedPrompts(_scope?: 'global' | 'project'): AISuggestedPrompt[] { return [] }
export function getAIConversations(_projectId?: string): AIConversation[] { return [] }
export function getAIConversation(_id: string): AIConversation | undefined { return undefined }
export function getAllAIConversations(): AIConversation[] { return [] }
export function getIntegrations(): Integration[] { return [] }
export function getIntegration(_id: string): Integration | undefined { return undefined }
export function getIntegrationsByCategory(_category: 'accounting' | 'calendar' | 'storage'): Integration[] { return [] }
export function getPortalInvites(_projectId?: string): PortalInvite[] { return [] }
export function getPortalSharedItems(_projectId?: string): PortalSharedItem[] { return [] }
export function getPortalItemsForInvite(_inviteId: string): PortalSharedItem[] { return [] }
export function getProjectHealthAlerts(_projectId: string): ProjectHealthAlert[] { return [] }
export function getAllHealthAlerts(): ProjectHealthAlert[] { return [] }
export function getUnacknowledgedAlerts(_projectId?: string): ProjectHealthAlert[] { return [] }
export function getBurnBudgetMetrics(_projectId: string): BurnBudgetMetric[] { return [] }
export function getQuoteProjectLink(_quoteId: string): QuoteProjectLink | undefined { return undefined }
export function getQuoteProjectLinks(): QuoteProjectLink[] { return [] }
export function getQuoteConversionMetrics(): QuoteConversionMetric[] { return [] }
export function getProjectComplianceStatements(_projectId: string): ComplianceStatement[] { return [] }
export function getComplianceStatement(_id: string): ComplianceStatement | undefined { return undefined }
export function getProjectBRPDRequirements(_projectId: string): BRPDRequirement[] { return [] }
export function getGatewayRequirements(_projectId: string, _gatewayNumber: 1 | 2 | 3): BRPDRequirement[] { return [] }
export function getProjectChangelog(_projectId: string): BRPDChangelogEntry[] { return [] }
export function getDrawingIssueWorkflows(_projectId: string): DrawingIssueWorkflow[] { return [] }
export function getDrawingIssueWorkflow(_id: string): DrawingIssueWorkflow | undefined { return undefined }
export function getWorkflowEmails(_workflowId: string): DrawingEmail[] { return [] }
export function getActiveDrawingWorkflows(_projectId: string): DrawingIssueWorkflow[] { return [] }
export function getEscalatedWorkflows(_projectId: string): DrawingIssueWorkflow[] { return [] }
export function getProjectWizardSteps(): WizardStep[] { return [] }
export function getProjectBrief(_projectId: string): ProjectBrief | undefined { return undefined }
export function getProjectBriefs(): ProjectBrief[] { return [] }
export function getBriefSections(_projectId: string): BriefSection[] { return [] }
export function getQuoteAccountingLinks(): QuoteAccountingLink[] { return [] }
export function getQuoteAccountingLink(_feeQuoteId: string): QuoteAccountingLink | undefined { return undefined }
export function getAccountingLinksByProvider(_provider: 'xero' | 'quickbooks'): QuoteAccountingLink[] { return [] }
export function getRoleVisibilityRules(_role: string): RoleVisibilityRule[] { return [] }
export function getAllVisibilityRules(): RoleVisibilityRule[] { return [] }
export function getFeatureAccess(_role: string, _featureArea: string): RoleVisibilityRule | undefined { return undefined }
export function getLeaveRecords(): LeaveRecord[] { return [] }
export function getUserLeaveRecords(_userId: string): LeaveRecord[] { return [] }
export function getPendingLeaveRequests(): LeaveRecord[] { return [] }
export function getUpcomingLeave(_daysAhead: number = 30): LeaveRecord[] { return [] }
export function getBankHolidays(_region: string = 'england-wales'): BankHoliday[] { return [] }
export function getUpcomingBankHolidays(_daysAhead: number = 90): BankHoliday[] { return [] }
export function getLeaveEntitlement(_userId: string, _year: number = 2026): LeaveEntitlement | undefined { return undefined }
export function getLeaveEntitlements(): LeaveEntitlement[] { return [] }
export function getTeamAvailability(_date: string): { userId: string; available: boolean; reason?: string }[] { return [] }
export function getTimesheetEntries(): TimesheetEntry[] { return [] }
export function getUserTimesheets(_userId: string): TimesheetEntry[] { return [] }
export function getProjectTimesheets(_projectId: string): TimesheetEntry[] { return [] }
export function getMissingTimesheetUsers(): string[] { return [] }
export function getTimesheetWeekSummaries(_weekStart: string): TimesheetWeekSummary[] { return [] }
export function getInvoices(): Invoice[] { return [] }
export function getProjectInvoices(_projectId: string): Invoice[] { return [] }
export function getOverdueInvoices(): Invoice[] { return [] }
export function getOpenInvoiceValue(): number { return 0 }
export function getInvoicesByStatus(_status: string): Invoice[] { return [] }
export function getUnsyncedInvoices(): Invoice[] { return [] }
export function getTotalInvoicedThisMonth(): number { return 0 }
export function getOverheadEntries(): OverheadEntry[] { return [] }
export function getMonthlyOverheadTotal(): number { return 0 }
export function getOverheadSummaries(): OverheadSummary[] { return [] }
export function getNewsItems(): NewsItem[] { return [] }
export function getPinnedNews(): NewsItem[] { return [] }
export function getNewsByCategory(_category: string): NewsItem[] { return [] }
export function getProjectUpdates(): ProjectUpdate[] { return [] }
export function getCriticalUpdates(): ProjectUpdate[] { return [] }
export function getDashboardKPIs(): DashboardKPIs {
  return {
    active_projects: 0,
    projects_at_risk: 0,
    missing_timesheets: 0,
    open_invoice_value: 0,
    quotes_expiring: 0,
    brpd_deadlines: 0,
    approvals_waiting: 0,
  }
}
export function getFeeRecoveryRate(): number { return 0 }
export function getPracticeRevenueThisMonth(): number { return 0 }

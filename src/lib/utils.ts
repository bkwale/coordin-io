import { HealthStatus, TaskStatus, RiskSeverity, ApprovalStatus, IssueStatus, ChangeStatus, RiskRegisterStatus, ActionStatus, RiskProbability, RiskImpact, MeetingType, DesignRiskReviewStatus, ContractEventStatus, TenderStatus, SiteQueryStatus, BuildingRegStatus, InspectionStatus, ComplianceStatus, DocumentStatus, KnowledgeCategory, DutyholderRole, DrawingIssueType, CommercialHealthFlag, UtilisationStatus, FeeQuoteStatus, OpportunityStatus, IntegrationStatus, QuoteSectionType, FeeQuoteRecord, HealthAlertSeverity, HealthAlertCategory, ComplianceStatementStatus, BRPDRequirementStatus, BRPDChangeType, DrawingWorkflowStatus, DrawingEmailDirection, WizardStepStatus, BriefSectionStatus, AccountingSyncStatus, FeatureArea, LeaveType, LeaveStatus, TimesheetStatus, InvoiceStatus, OverheadCategory, NewsCategory } from './types'

export function cn(...classes: (string | undefined | false | null)[]): string {
  return classes.filter(Boolean).join(' ')
}

export function healthColor(h: HealthStatus): string {
  switch (h) {
    case 'green': return 'bg-emerald-100 text-emerald-800'
    case 'amber': return 'bg-amber-100 text-amber-800'
    case 'red': return 'bg-red-100 text-red-800'
  }
}

export function healthDot(h: HealthStatus): string {
  switch (h) {
    case 'green': return 'bg-emerald-500'
    case 'amber': return 'bg-amber-500'
    case 'red': return 'bg-red-500'
  }
}

export function statusLabel(s: TaskStatus): string {
  switch (s) {
    case 'not_started': return 'Not Started'
    case 'in_progress': return 'In Progress'
    case 'done': return 'Done'
    case 'blocked': return 'Blocked'
  }
}

export function statusColor(s: TaskStatus): string {
  switch (s) {
    case 'not_started': return 'bg-slate-50 text-slate-500'
    case 'in_progress': return 'bg-blue-50 text-blue-600'
    case 'done': return 'bg-emerald-50 text-emerald-600'
    case 'blocked': return 'bg-red-50 text-red-600'
  }
}

export function severityColor(s: RiskSeverity): string {
  switch (s) {
    case 'low': return 'bg-slate-50 text-slate-500 border-slate-200'
    case 'medium': return 'bg-amber-50 text-amber-800 border-amber-200'
    case 'high': return 'bg-red-50 text-red-800 border-red-200'
  }
}

export function severityDot(s: RiskSeverity): string {
  switch (s) {
    case 'low': return 'bg-slate-400'
    case 'medium': return 'bg-amber-500'
    case 'high': return 'bg-red-500'
  }
}

export function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function daysUntil(dateStr: string): number {
  const now = new Date()
  const target = new Date(dateStr)
  const diff = Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  return diff === 0 ? 0 : diff // avoid -0
}

export function isOverdue(dateStr?: string): boolean {
  if (!dateStr) return false
  return new Date(dateStr) < new Date()
}

export function timeAgo(dateStr: string): string {
  const now = new Date()
  const date = new Date(dateStr)
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000)

  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  const weeks = Math.floor(days / 7)
  if (weeks < 4) return `${weeks}w ago`
  return formatDate(dateStr)
}

// ── Phase 2 Utilities ────────────────────────────────────────

export function approvalStatusColor(s: ApprovalStatus): string {
  switch (s) {
    case 'pending': return 'bg-amber-50 text-amber-600'
    case 'approved': return 'bg-emerald-50 text-emerald-600'
    case 'returned': return 'bg-red-50 text-red-600'
  }
}

export function approvalStatusLabel(s: ApprovalStatus): string {
  switch (s) {
    case 'pending': return 'Awaiting Review'
    case 'approved': return 'Approved'
    case 'returned': return 'Returned'
  }
}

export function issueStatusColor(s: IssueStatus): string {
  switch (s) {
    case 'open': return 'bg-red-50 text-red-600'
    case 'in_progress': return 'bg-blue-50 text-blue-600'
    case 'resolved': return 'bg-emerald-50 text-emerald-600'
    case 'closed': return 'bg-slate-50 text-slate-500'
  }
}

export function changeStatusColor(s: ChangeStatus): string {
  switch (s) {
    case 'raised': return 'bg-amber-50 text-amber-600'
    case 'under_review': return 'bg-blue-50 text-blue-600'
    case 'approved': return 'bg-emerald-50 text-emerald-600'
    case 'rejected': return 'bg-red-50 text-red-600'
  }
}

export function riskRegisterStatusColor(s: RiskRegisterStatus): string {
  switch (s) {
    case 'open': return 'bg-red-50 text-red-600'
    case 'mitigated': return 'bg-amber-50 text-amber-600'
    case 'closed': return 'bg-slate-50 text-slate-500'
  }
}

export function actionStatusColor(s: ActionStatus): string {
  switch (s) {
    case 'open': return 'bg-blue-50 text-blue-600'
    case 'done': return 'bg-emerald-50 text-emerald-600'
    case 'overdue': return 'bg-red-50 text-red-600'
  }
}

export function riskScoreColor(probability: RiskProbability, impact: RiskImpact): string {
  const score = { low: 1, medium: 2, high: 3 }
  const total = score[probability] * score[impact]
  if (total >= 6) return 'bg-red-500'
  if (total >= 3) return 'bg-amber-500'
  return 'bg-emerald-500'
}

export function meetingTypeLabel(t: MeetingType): string {
  switch (t) {
    case 'design_team': return 'Design Team'
    case 'client_review': return 'Client Review'
    case 'site_meeting': return 'Site Meeting'
    case 'consultant': return 'Consultant'
    case 'contractor': return 'Contractor'
    case 'other': return 'Other'
  }
}

export function meetingTypeColor(t: MeetingType): string {
  switch (t) {
    case 'design_team': return 'bg-brand-100 text-brand-700'
    case 'client_review': return 'bg-violet-50 text-violet-600'
    case 'site_meeting': return 'bg-amber-50 text-amber-600'
    case 'consultant': return 'bg-cyan-50 text-cyan-600'
    case 'contractor': return 'bg-orange-50 text-orange-600'
    case 'other': return 'bg-slate-50 text-slate-500'
  }
}

// ── Phase 2 Wave 2 Utilities ─────────────────────────────────

export function designRiskStatusColor(s: DesignRiskReviewStatus): string {
  switch (s) {
    case 'open': return 'bg-red-50 text-red-600'
    case 'under_review': return 'bg-amber-50 text-amber-600'
    case 'accepted': return 'bg-emerald-50 text-emerald-600'
    case 'closed': return 'bg-slate-50 text-slate-500'
  }
}

export function contractEventStatusColor(s: ContractEventStatus): string {
  switch (s) {
    case 'draft': return 'bg-slate-50 text-slate-500'
    case 'issued': return 'bg-blue-50 text-blue-600'
    case 'responded': return 'bg-emerald-50 text-emerald-600'
    case 'overdue': return 'bg-red-50 text-red-600'
    case 'closed': return 'bg-slate-100 text-slate-500'
  }
}

export function tenderStatusColor(s: TenderStatus): string {
  switch (s) {
    case 'preparation': return 'bg-slate-50 text-slate-500'
    case 'issued': return 'bg-blue-50 text-blue-600'
    case 'returned': return 'bg-amber-50 text-amber-600'
    case 'evaluation': return 'bg-violet-50 text-violet-600'
    case 'awarded': return 'bg-emerald-50 text-emerald-600'
    case 'cancelled': return 'bg-red-50 text-red-600'
  }
}

export function siteQueryStatusColor(s: SiteQueryStatus): string {
  switch (s) {
    case 'open': return 'bg-red-50 text-red-600'
    case 'responded': return 'bg-blue-50 text-blue-600'
    case 'closed': return 'bg-slate-50 text-slate-500'
  }
}

// ── Phase 2 Wave 3 Utilities ────────────────────────────────

export function buildingRegStatusColor(s: BuildingRegStatus): string {
  switch (s) {
    case 'not_submitted': return 'bg-slate-50 text-slate-500'
    case 'submitted': return 'bg-blue-50 text-blue-600'
    case 'in_progress': return 'bg-amber-50 text-amber-600'
    case 'approved': return 'bg-emerald-50 text-emerald-600'
    case 'rejected': return 'bg-red-50 text-red-600'
    case 'conditional': return 'bg-violet-50 text-violet-600'
  }
}

export function inspectionStatusColor(s: InspectionStatus): string {
  switch (s) {
    case 'scheduled': return 'bg-blue-50 text-blue-600'
    case 'passed': return 'bg-emerald-50 text-emerald-600'
    case 'failed': return 'bg-red-50 text-red-600'
    case 'requires_revisit': return 'bg-amber-50 text-amber-600'
  }
}

export function complianceStatusColor(s: ComplianceStatus): string {
  switch (s) {
    case 'compliant': return 'bg-emerald-50 text-emerald-600'
    case 'non_compliant': return 'bg-red-50 text-red-600'
    case 'pending_review': return 'bg-amber-50 text-amber-600'
    case 'not_applicable': return 'bg-slate-100 text-slate-500'
  }
}

export function documentStatusColor(s: DocumentStatus): string {
  switch (s) {
    case 'draft': return 'bg-slate-50 text-slate-500'
    case 'for_review': return 'bg-amber-50 text-amber-600'
    case 'approved': return 'bg-emerald-50 text-emerald-600'
    case 'superseded': return 'bg-violet-50 text-violet-600'
    case 'archived': return 'bg-slate-100 text-slate-500'
  }
}

export function knowledgeCategoryLabel(c: KnowledgeCategory): string {
  switch (c) {
    case 'lessons_learned': return 'Lessons Learned'
    case 'office_procedure': return 'Office Procedure'
    case 'checklist': return 'Checklist'
    case 'reference_note': return 'Reference Note'
    case 'fee_clause': return 'Fee Clause'
    case 'template': return 'Template'
    case 'guidance': return 'Guidance'
  }
}

export function knowledgeCategoryColor(c: KnowledgeCategory): string {
  switch (c) {
    case 'lessons_learned': return 'bg-amber-50 text-amber-600'
    case 'office_procedure': return 'bg-blue-50 text-blue-600'
    case 'checklist': return 'bg-emerald-50 text-emerald-600'
    case 'reference_note': return 'bg-violet-50 text-violet-600'
    case 'fee_clause': return 'bg-cyan-50 text-cyan-600'
    case 'template': return 'bg-orange-50 text-orange-600'
    case 'guidance': return 'bg-indigo-50 text-indigo-600'
  }
}

export function trainingPlanStatusColor(s: 'not_started' | 'in_progress' | 'completed' | 'overdue'): string {
  switch (s) {
    case 'not_started': return 'bg-slate-50 text-slate-500'
    case 'in_progress': return 'bg-blue-50 text-blue-600'
    case 'completed': return 'bg-emerald-50 text-emerald-600'
    case 'overdue': return 'bg-red-50 text-red-600'
  }
}

export function proficiencyLabel(l: 'none' | 'basic' | 'intermediate' | 'advanced' | 'expert'): string {
  return l.charAt(0).toUpperCase() + l.slice(1)
}

export function proficiencyColor(l: 'none' | 'basic' | 'intermediate' | 'advanced' | 'expert'): string {
  switch (l) {
    case 'none': return 'bg-slate-100 text-slate-500'
    case 'basic': return 'bg-amber-50 text-amber-600'
    case 'intermediate': return 'bg-blue-50 text-blue-600'
    case 'advanced': return 'bg-emerald-50 text-emerald-600'
    case 'expert': return 'bg-violet-50 text-violet-600'
  }
}

export function gatewayStatusColor(s: 'not_started' | 'in_progress' | 'submitted' | 'passed' | 'failed'): string {
  switch (s) {
    case 'not_started': return 'bg-slate-50 text-slate-500'
    case 'in_progress': return 'bg-blue-50 text-blue-600'
    case 'submitted': return 'bg-amber-50 text-amber-600'
    case 'passed': return 'bg-emerald-50 text-emerald-600'
    case 'failed': return 'bg-red-50 text-red-600'
  }
}

export function transmittalStatusColor(s: 'draft' | 'issued' | 'acknowledged'): string {
  switch (s) {
    case 'draft': return 'bg-slate-50 text-slate-500'
    case 'issued': return 'bg-blue-50 text-blue-600'
    case 'acknowledged': return 'bg-emerald-50 text-emerald-600'
  }
}

export function dutyholderRoleLabel(r: DutyholderRole): string {
  switch (r) {
    case 'client': return 'Client'
    case 'principal_designer': return 'Principal Designer'
    case 'principal_contractor': return 'Principal Contractor'
    case 'designer': return 'Designer'
    case 'contractor': return 'Contractor'
  }
}

// ── Phase 3 Wave 2 Utilities ────────────────────────────────

export function drawingIssueTypeLabel(t: DrawingIssueType): string {
  switch (t) {
    case 'planning': return 'Planning'
    case 'sketch': return 'Sketch'
    case 'working': return 'Working'
    case 'as_built': return 'As Built'
    case 'tender': return 'Tender'
    case 'construction': return 'Construction'
    case 'custom': return 'Custom'
  }
}

export function drawingIssueTypeColor(t: DrawingIssueType): string {
  switch (t) {
    case 'planning': return 'bg-indigo-50 text-indigo-600'
    case 'sketch': return 'bg-slate-50 text-slate-500'
    case 'working': return 'bg-blue-50 text-blue-600'
    case 'as_built': return 'bg-emerald-50 text-emerald-600'
    case 'tender': return 'bg-amber-50 text-amber-600'
    case 'construction': return 'bg-orange-50 text-orange-600'
    case 'custom': return 'bg-violet-50 text-violet-600'
  }
}

export function commercialHealthColor(h: CommercialHealthFlag): string {
  switch (h) {
    case 'healthy': return 'bg-emerald-50 text-emerald-600'
    case 'watch': return 'bg-amber-50 text-amber-600'
    case 'at_risk': return 'bg-orange-50 text-orange-600'
    case 'critical': return 'bg-red-50 text-red-600'
  }
}

export function commercialHealthDot(h: CommercialHealthFlag): string {
  switch (h) {
    case 'healthy': return 'bg-emerald-500'
    case 'watch': return 'bg-amber-500'
    case 'at_risk': return 'bg-orange-500'
    case 'critical': return 'bg-red-500'
  }
}

export function utilisationColor(s: UtilisationStatus): string {
  switch (s) {
    case 'under': return 'bg-blue-50 text-blue-600'
    case 'optimal': return 'bg-emerald-50 text-emerald-600'
    case 'over': return 'bg-red-50 text-red-600'
  }
}

export function formatCurrency(amount: number, currency: string = 'GBP'): string {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency, minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount)
}

export function formatPercent(value: number): string {
  return value.toFixed(1) + '%'
}

// ── Phase 3 Wave 3 Utilities ────────────────────────────────

export function feeQuoteStatusColor(s: FeeQuoteStatus): string {
  switch (s) {
    case 'draft': return 'bg-slate-50 text-slate-500'
    case 'sent': return 'bg-blue-50 text-blue-600'
    case 'viewed': return 'bg-indigo-50 text-indigo-600'
    case 'revised': return 'bg-amber-50 text-amber-600'
    case 'accepted': return 'bg-emerald-50 text-emerald-600'
    case 'declined': return 'bg-red-50 text-red-600'
    case 'expired': return 'bg-slate-100 text-slate-400'
    case 'superseded': return 'bg-violet-50 text-violet-600'
  }
}

export function feeQuoteStatusLabel(s: FeeQuoteStatus): string {
  switch (s) {
    case 'draft': return 'Draft'
    case 'sent': return 'Sent'
    case 'viewed': return 'Viewed'
    case 'revised': return 'Revised'
    case 'accepted': return 'Accepted'
    case 'declined': return 'Declined'
    case 'expired': return 'Expired'
    case 'superseded': return 'Superseded'
  }
}

export function opportunityStatusColor(s: OpportunityStatus): string {
  switch (s) {
    case 'lead': return 'bg-slate-50 text-slate-500'
    case 'qualifying': return 'bg-blue-50 text-blue-600'
    case 'proposal_sent': return 'bg-indigo-50 text-indigo-600'
    case 'negotiation': return 'bg-amber-50 text-amber-600'
    case 'won': return 'bg-emerald-50 text-emerald-600'
    case 'lost': return 'bg-red-50 text-red-600'
    case 'dormant': return 'bg-slate-100 text-slate-500'
  }
}

export function opportunityStatusLabel(s: OpportunityStatus): string {
  switch (s) {
    case 'lead': return 'Lead'
    case 'qualifying': return 'Qualifying'
    case 'proposal_sent': return 'Proposal Sent'
    case 'negotiation': return 'Negotiation'
    case 'won': return 'Won'
    case 'lost': return 'Lost'
    case 'dormant': return 'Dormant'
  }
}

export function confidenceBadgeColor(c: 'high' | 'medium' | 'low'): string {
  switch (c) {
    case 'high': return 'bg-emerald-50 text-emerald-600'
    case 'medium': return 'bg-amber-50 text-amber-600'
    case 'low': return 'bg-red-50 text-red-600'
  }
}

// ── Phase 4 Wave 1 Utilities ───────────────────────────────────

export function quoteSectionTypeLabel(s: QuoteSectionType): string {
  const labels: Record<QuoteSectionType, string> = {
    cover: 'Cover / Introduction',
    project_understanding: 'Project Understanding',
    scope_of_service: 'Scope of Service',
    stage_breakdown: 'Stage Breakdown',
    optional_extras: 'Optional Extras',
    consultant_coordination: 'Consultant Coordination',
    programme_assumptions: 'Programme Assumptions',
    design_freeze_note: 'Design Freeze Note',
    meetings_and_communication: 'Meetings & Communication',
    expenses_and_travel: 'Expenses & Travel',
    exclusions: 'Exclusions',
    terms_and_conditions: 'Terms & Conditions',
    payment_terms: 'Payment Terms',
    acceptance: 'Acceptance / Next Steps',
  }
  return labels[s]
}

export function numberingPreview(format: string, sampleSeq?: number): string {
  const year = new Date().getFullYear().toString()
  const shortYear = year.slice(-2)
  let result = format
    .replace('{YEAR}', year)
    .replace('{YY}', shortYear)
    .replace('{PROJECT}', 'MA-2025-001')

  const seqMatch = result.match(/\{SEQ:(\d+)\}/)
  if (seqMatch) {
    const pad = parseInt(seqMatch[1])
    const seq = (sampleSeq || 1).toString().padStart(pad, '0')
    result = result.replace(seqMatch[0], seq)
  }
  return result
}

export function quoteNeedsFollowUp(quote: { status: FeeQuoteStatus; sent_at?: string; viewed_count: number; valid_until: string }): boolean {
  if (quote.status === 'sent' && quote.viewed_count === 0) {
    const daysSinceSent = quote.sent_at ? Math.floor((Date.now() - new Date(quote.sent_at).getTime()) / 86400000) : 0
    return daysSinceSent > 3
  }
  if (quote.status === 'viewed') {
    const daysUntilExpiry = Math.floor((new Date(quote.valid_until).getTime() - Date.now()) / 86400000)
    return daysUntilExpiry < 7
  }
  return false
}

export function healthScoreColor(score: number): string {
  if (score >= 75) return 'text-emerald-600'
  if (score >= 50) return 'text-amber-600'
  return 'text-red-600'
}

export function healthScoreBg(score: number): string {
  if (score >= 75) return 'bg-emerald-100'
  if (score >= 50) return 'bg-amber-100'
  return 'bg-red-100'
}

// ── Phase 3 Wave 4 Utilities ───────────────────────────────

export function integrationStatusColor(s: IntegrationStatus): string {
  switch (s) {
    case 'connected': return 'bg-emerald-50 text-emerald-600'
    case 'disconnected': return 'bg-slate-100 text-slate-500'
    case 'error': return 'bg-red-50 text-red-600'
    case 'syncing': return 'bg-blue-50 text-blue-600'
  }
}

export function integrationStatusLabel(s: IntegrationStatus): string {
  switch (s) {
    case 'connected': return 'Connected'
    case 'disconnected': return 'Not Connected'
    case 'error': return 'Error'
    case 'syncing': return 'Syncing'
  }
}

export function integrationStatusDot(s: IntegrationStatus): string {
  switch (s) {
    case 'connected': return 'bg-emerald-500'
    case 'disconnected': return 'bg-slate-300'
    case 'error': return 'bg-red-500'
    case 'syncing': return 'bg-blue-500 animate-pulse'
  }
}

export function portalAccessLabel(level: 'view_only' | 'comment' | 'approve'): string {
  switch (level) {
    case 'view_only': return 'View Only'
    case 'comment': return 'Comment'
    case 'approve': return 'Approve'
  }
}

export function portalAccessColor(level: 'view_only' | 'comment' | 'approve'): string {
  switch (level) {
    case 'view_only': return 'bg-slate-50 text-slate-500'
    case 'comment': return 'bg-blue-50 text-blue-600'
    case 'approve': return 'bg-emerald-50 text-emerald-600'
  }
}

export function portalItemTypeIcon(type: 'document' | 'approval' | 'drawing' | 'report' | 'meeting_minutes'): string {
  switch (type) {
    case 'document': return '📄'
    case 'approval': return '✅'
    case 'drawing': return '📐'
    case 'report': return '📊'
    case 'meeting_minutes': return '📝'
  }
}

// ── Phase 4 Wave 2 Utilities ───────────────────────────────────

export function healthAlertSeverityColor(s: HealthAlertSeverity): string {
  switch (s) {
    case 'info': return 'bg-blue-50 text-blue-600'
    case 'warning': return 'bg-amber-50 text-amber-600'
    case 'critical': return 'bg-red-50 text-red-600'
  }
}

export function healthAlertSeverityDot(s: HealthAlertSeverity): string {
  switch (s) {
    case 'info': return 'bg-blue-500'
    case 'warning': return 'bg-amber-500'
    case 'critical': return 'bg-red-500'
  }
}

export function healthAlertCategoryLabel(c: HealthAlertCategory): string {
  const labels: Record<HealthAlertCategory, string> = {
    burn_rate: 'Burn Rate',
    margin_erosion: 'Margin Erosion',
    billing_gap: 'Billing Gap',
    scope_creep: 'Scope Creep',
    programme_delay: 'Programme Delay',
    near_loss: 'Near Loss',
    fee_overrun: 'Fee Overrun',
  }
  return labels[c]
}

export function healthAlertCategoryIcon(c: HealthAlertCategory): string {
  const icons: Record<HealthAlertCategory, string> = {
    burn_rate: '🔥',
    margin_erosion: '📉',
    billing_gap: '💰',
    scope_creep: '📐',
    programme_delay: '⏱',
    near_loss: '⚠',
    fee_overrun: '🚨',
  }
  return icons[c]
}

export function burnRatioColor(ratio: number): string {
  if (ratio <= 1.0) return 'text-emerald-600'
  if (ratio <= 1.1) return 'text-amber-600'
  return 'text-red-600'
}

export function burnRatioBg(ratio: number): string {
  if (ratio <= 1.0) return 'bg-emerald-100'
  if (ratio <= 1.1) return 'bg-amber-100'
  return 'bg-red-100'
}

export function varianceColor(variance: number): string {
  if (variance <= 0) return 'text-emerald-600'
  if (variance <= 10) return 'text-amber-600'
  return 'text-red-600'
}

export function formatBurnRatio(ratio: number): string {
  return ratio.toFixed(2) + 'x'
}

// ── Phase 4 Wave 3: BRPD Compliance & Drawing Workflow Utils ─

export function complianceStatementStatusColor(status: ComplianceStatementStatus): string {
  switch (status) {
    case 'draft': return 'bg-slate-100 text-slate-700'
    case 'under_review': return 'bg-blue-50 text-blue-600'
    case 'approved': return 'bg-emerald-50 text-emerald-600'
    case 'expired': return 'bg-amber-50 text-amber-600'
    case 'rejected': return 'bg-red-50 text-red-600'
  }
}

export function complianceStatementStatusLabel(status: ComplianceStatementStatus): string {
  switch (status) {
    case 'draft': return 'Draft'
    case 'under_review': return 'Under Review'
    case 'approved': return 'Approved'
    case 'expired': return 'Expired'
    case 'rejected': return 'Rejected'
  }
}

export function brpdRequirementStatusColor(status: BRPDRequirementStatus): string {
  switch (status) {
    case 'not_started': return 'bg-slate-100 text-slate-700'
    case 'in_progress': return 'bg-blue-50 text-blue-600'
    case 'evidenced': return 'bg-cyan-50 text-cyan-600'
    case 'verified': return 'bg-emerald-50 text-emerald-600'
    case 'non_compliant': return 'bg-red-50 text-red-600'
  }
}

export function brpdRequirementStatusLabel(status: BRPDRequirementStatus): string {
  switch (status) {
    case 'not_started': return 'Not Started'
    case 'in_progress': return 'In Progress'
    case 'evidenced': return 'Evidenced'
    case 'verified': return 'Verified'
    case 'non_compliant': return 'Non-Compliant'
  }
}

export function brpdChangeTypeLabel(changeType: BRPDChangeType): string {
  switch (changeType) {
    case 'dutyholder_change': return 'Dutyholder'
    case 'gateway_update': return 'Gateway'
    case 'compliance_update': return 'Compliance'
    case 'document_revision': return 'Document'
    case 'requirement_update': return 'Requirement'
    case 'evidence_upload': return 'Evidence'
  }
}

export function brpdChangeTypeColor(changeType: BRPDChangeType): string {
  switch (changeType) {
    case 'dutyholder_change': return 'bg-purple-100 text-purple-700'
    case 'gateway_update': return 'bg-blue-50 text-blue-600'
    case 'compliance_update': return 'bg-emerald-50 text-emerald-600'
    case 'document_revision': return 'bg-amber-50 text-amber-600'
    case 'requirement_update': return 'bg-cyan-50 text-cyan-600'
    case 'evidence_upload': return 'bg-slate-100 text-slate-700'
  }
}

export function drawingWorkflowStatusColor(status: DrawingWorkflowStatus): string {
  switch (status) {
    case 'draft': return 'bg-slate-100 text-slate-700'
    case 'issued': return 'bg-blue-50 text-blue-600'
    case 'queried': return 'bg-amber-50 text-amber-600'
    case 'responded': return 'bg-cyan-50 text-cyan-600'
    case 'closed': return 'bg-emerald-50 text-emerald-600'
    case 'escalated': return 'bg-red-50 text-red-600'
  }
}

export function drawingWorkflowStatusLabel(status: DrawingWorkflowStatus): string {
  switch (status) {
    case 'draft': return 'Draft'
    case 'issued': return 'Issued'
    case 'queried': return 'Queried'
    case 'responded': return 'Responded'
    case 'closed': return 'Closed'
    case 'escalated': return 'Escalated'
  }
}

export function drawingEmailDirectionLabel(direction: DrawingEmailDirection): string {
  return direction === 'outbound' ? 'Sent' : 'Received'
}

export function drawingEmailDirectionColor(direction: DrawingEmailDirection): string {
  return direction === 'outbound' ? 'bg-blue-50 text-blue-600' : 'bg-emerald-50 text-emerald-600'
}

export function requirementCategoryLabel(category: string): string {
  switch (category) {
    case 'design': return 'Design'
    case 'safety': return 'Safety'
    case 'fire': return 'Fire'
    case 'structural': return 'Structural'
    case 'accessibility': return 'Accessibility'
    case 'environmental': return 'Environmental'
    default: return category
  }
}

export function requirementCategoryColor(category: string): string {
  switch (category) {
    case 'design': return 'bg-indigo-50 text-indigo-600'
    case 'safety': return 'bg-red-50 text-red-600'
    case 'fire': return 'bg-orange-50 text-orange-600'
    case 'structural': return 'bg-slate-100 text-slate-700'
    case 'accessibility': return 'bg-purple-100 text-purple-700'
    case 'environmental': return 'bg-green-100 text-green-700'
    default: return 'bg-slate-100 text-slate-700'
  }
}

// ── Phase 4 Wave 4: Project Creation & Access Control Utils ─

export function wizardStepStatusColor(status: WizardStepStatus): string {
  switch (status) {
    case 'not_started': return 'bg-slate-50 text-slate-500'
    case 'in_progress': return 'bg-blue-50 text-blue-600'
    case 'complete': return 'bg-emerald-50 text-emerald-600'
    case 'skipped': return 'bg-amber-100 text-amber-600'
  }
}

export function wizardStepStatusLabel(status: WizardStepStatus): string {
  switch (status) {
    case 'not_started': return 'Not Started'
    case 'in_progress': return 'In Progress'
    case 'complete': return 'Complete'
    case 'skipped': return 'Skipped'
  }
}

export function briefSectionStatusColor(status: BriefSectionStatus): string {
  switch (status) {
    case 'empty': return 'bg-slate-100 text-slate-500'
    case 'draft': return 'bg-amber-50 text-amber-600'
    case 'complete': return 'bg-blue-50 text-blue-600'
    case 'approved': return 'bg-emerald-50 text-emerald-600'
  }
}

export function briefSectionStatusLabel(status: BriefSectionStatus): string {
  switch (status) {
    case 'empty': return 'Empty'
    case 'draft': return 'Draft'
    case 'complete': return 'Complete'
    case 'approved': return 'Approved'
  }
}

export function accountingSyncStatusColor(status: AccountingSyncStatus): string {
  switch (status) {
    case 'synced': return 'bg-emerald-50 text-emerald-600'
    case 'pending': return 'bg-blue-50 text-blue-600'
    case 'failed': return 'bg-red-50 text-red-600'
    case 'not_linked': return 'bg-slate-100 text-slate-500'
  }
}

export function accountingSyncStatusLabel(status: AccountingSyncStatus): string {
  switch (status) {
    case 'synced': return 'Synced'
    case 'pending': return 'Pending'
    case 'failed': return 'Failed'
    case 'not_linked': return 'Not Linked'
  }
}

export function featureAreaLabel(area: FeatureArea): string {
  switch (area) {
    case 'projects': return 'Projects'
    case 'fee_quotes': return 'Fee Quotes'
    case 'analytics': return 'Analytics'
    case 'ai_teammate': return 'AI Teammate'
    case 'integrations': return 'Integrations'
    case 'portal': return 'Portal'
    case 'admin': return 'Admin'
    case 'knowledge': return 'Knowledge Base'
    case 'cpd': return 'CPD & Training'
    case 'staffing': return 'Staffing'
  }
}

export function roleLabel(role: string): string {
  switch (role) {
    case 'practice_owner': return 'Practice Owner'
    case 'project_lead': return 'Project Lead'
    case 'team_member': return 'Team Member'
    case 'admin': return 'Admin'
    default: return role
  }
}

// ── Leave & Holidays Utils ──────────────────────────────────

export function leaveTypeColor(type: LeaveType): string {
  switch (type) {
    case 'holiday': return 'bg-blue-50 text-blue-600'
    case 'sick': return 'bg-red-50 text-red-600'
    case 'cpd': return 'bg-purple-100 text-purple-700'
    case 'parental': return 'bg-pink-100 text-pink-700'
    case 'compassionate': return 'bg-amber-50 text-amber-600'
    case 'unpaid': return 'bg-slate-50 text-slate-500'
  }
}

export function leaveTypeLabel(type: LeaveType): string {
  switch (type) {
    case 'holiday': return 'Holiday'
    case 'sick': return 'Sick'
    case 'cpd': return 'CPD'
    case 'parental': return 'Parental'
    case 'compassionate': return 'Compassionate'
    case 'unpaid': return 'Unpaid'
  }
}

export function leaveStatusColor(status: LeaveStatus): string {
  switch (status) {
    case 'pending': return 'bg-amber-50 text-amber-600'
    case 'approved': return 'bg-emerald-50 text-emerald-600'
    case 'declined': return 'bg-red-50 text-red-600'
    case 'cancelled': return 'bg-slate-100 text-slate-500'
  }
}

export function leaveStatusLabel(status: LeaveStatus): string {
  switch (status) {
    case 'pending': return 'Pending'
    case 'approved': return 'Approved'
    case 'declined': return 'Declined'
    case 'cancelled': return 'Cancelled'
  }
}

// ── Phase 5: Timesheet utils ────────────────────────────────

export function timesheetStatusColor(status: TimesheetStatus): string {
  switch (status) {
    case 'draft': return 'bg-slate-50 text-slate-500'
    case 'submitted': return 'bg-blue-50 text-blue-600'
    case 'approved': return 'bg-emerald-50 text-emerald-600'
    case 'rejected': return 'bg-red-50 text-red-600'
  }
}

export function timesheetStatusLabel(status: TimesheetStatus): string {
  switch (status) {
    case 'draft': return 'Draft'
    case 'submitted': return 'Submitted'
    case 'approved': return 'Approved'
    case 'rejected': return 'Rejected'
  }
}

// ── Phase 5: Invoice utils ──────────────────────────────────

export function invoiceStatusColor(status: InvoiceStatus): string {
  switch (status) {
    case 'draft': return 'bg-slate-50 text-slate-500'
    case 'sent': return 'bg-blue-50 text-blue-600'
    case 'viewed': return 'bg-indigo-50 text-indigo-600'
    case 'due': return 'bg-amber-50 text-amber-600'
    case 'overdue': return 'bg-red-50 text-red-600'
    case 'paid': return 'bg-emerald-50 text-emerald-600'
    case 'void': return 'bg-slate-100 text-slate-400'
  }
}

export function invoiceStatusLabel(status: InvoiceStatus): string {
  switch (status) {
    case 'draft': return 'Draft'
    case 'sent': return 'Sent'
    case 'viewed': return 'Viewed'
    case 'due': return 'Due'
    case 'overdue': return 'Overdue'
    case 'paid': return 'Paid'
    case 'void': return 'Void'
  }
}

// ── Phase 5: Overhead utils ─────────────────────────────────

export function overheadCategoryLabel(category: OverheadCategory): string {
  switch (category) {
    case 'rent': return 'Rent'
    case 'internet': return 'Internet'
    case 'telephones': return 'Telephones'
    case 'printing': return 'Printing'
    case 'software': return 'Software'
    case 'insurance': return 'Insurance'
    case 'utilities': return 'Utilities'
    case 'office_admin': return 'Office Admin'
    case 'travel': return 'Travel'
    case 'professional_fees': return 'Professional Fees'
  }
}

export function overheadCategoryColor(category: OverheadCategory): string {
  switch (category) {
    case 'rent': return 'bg-violet-50 text-violet-600'
    case 'internet': return 'bg-sky-50 text-sky-600'
    case 'telephones': return 'bg-cyan-50 text-cyan-600'
    case 'printing': return 'bg-amber-50 text-amber-600'
    case 'software': return 'bg-indigo-50 text-indigo-600'
    case 'insurance': return 'bg-rose-50 text-rose-600'
    case 'utilities': return 'bg-emerald-50 text-emerald-600'
    case 'office_admin': return 'bg-slate-50 text-slate-500'
    case 'travel': return 'bg-orange-50 text-orange-600'
    case 'professional_fees': return 'bg-blue-50 text-blue-600'
  }
}

// ── Phase 5: News utils ─────────────────────────────────────

export function newsCategoryLabel(category: NewsCategory): string {
  switch (category) {
    case 'architecture': return 'Architecture'
    case 'construction': return 'Construction'
    case 'regulations': return 'Regulations'
    case 'planning': return 'Planning'
    case 'company': return 'Company'
  }
}

export function newsCategoryColor(category: NewsCategory): string {
  switch (category) {
    case 'architecture': return 'bg-violet-50 text-violet-600'
    case 'construction': return 'bg-amber-50 text-amber-600'
    case 'regulations': return 'bg-red-50 text-red-600'
    case 'planning': return 'bg-sky-50 text-sky-600'
    case 'company': return 'bg-emerald-50 text-emerald-600'
  }
}

// ── Phase 5: Update severity utils ──────────────────────────

export function updateSeverityColor(severity: 'info' | 'warning' | 'critical'): string {
  switch (severity) {
    case 'info': return 'bg-blue-50 text-blue-600'
    case 'warning': return 'bg-amber-50 text-amber-600'
    case 'critical': return 'bg-red-50 text-red-600'
  }
}

export function updateSeverityDot(severity: 'info' | 'warning' | 'critical'): string {
  switch (severity) {
    case 'info': return 'bg-blue-400'
    case 'warning': return 'bg-amber-400'
    case 'critical': return 'bg-red-500'
  }
}


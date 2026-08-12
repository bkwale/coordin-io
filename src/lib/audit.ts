import { prisma } from './prisma'

interface AuditParams {
  organisationId: string
  actorId?: string
  action: string
  entityType: string
  entityId: string
  metadata?: Record<string, unknown>
  ipAddress?: string
}

/**
 * Record an audit event. Every material action in the system
 * must create an audit trail entry.
 */
export async function recordAuditEvent(params: AuditParams) {
  return prisma.auditEvent.create({
    data: {
      organisationId: params.organisationId,
      actorId: params.actorId ?? null,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      metadata: (params.metadata as Record<string, string | number | boolean>) ?? undefined,
      ipAddress: params.ipAddress ?? null,
    },
  })
}

// Common audit actions
export const AuditActions = {
  // Invitations
  INVITATION_CREATED: 'invitation.created',
  INVITATION_SENT: 'invitation.sent',
  INVITATION_ACTIVATED: 'invitation.activated',
  INVITATION_EXPIRED: 'invitation.expired',
  INVITATION_REVOKED: 'invitation.revoked',

  // Auth
  LOGIN: 'auth.login',
  FAILED_ACTIVATION: 'auth.failed_activation',

  // Onboarding
  ONBOARDING_ITEM_OPENED: 'onboarding.item_opened',
  ONBOARDING_ITEM_ACKNOWLEDGED: 'onboarding.item_acknowledged',
  ONBOARDING_COMPLETED: 'onboarding.completed',

  // Projects
  PROJECT_CREATED: 'project.created',
  PROJECT_UPDATED: 'project.updated',
  PROJECT_MEMBER_ADDED: 'project.member_added',
  PROJECT_MEMBER_UPDATED: 'project.member_updated',
  PROJECT_MEMBER_REMOVED: 'project.member_removed',

  // Tasks
  TASK_CREATED: 'task.created',
  TASK_ASSIGNED: 'task.assigned',
  TASK_STATUS_CHANGED: 'task.status_changed',
  TASK_REVIEWED: 'task.reviewed',

  // Documents
  DOCUMENT_UPLOADED: 'document.uploaded',
  DOCUMENT_DOWNLOADED: 'document.downloaded',
  DOCUMENT_REVIEWED: 'document.reviewed',
  DOCUMENT_APPROVED: 'document.approved',
  DOCUMENT_ISSUED: 'document.issued',
  DOCUMENT_SUPERSEDED: 'document.superseded',

  // CPD
  CPD_CREATED: 'cpd.created',
  CPD_SUBMITTED: 'cpd.submitted',
  CPD_VERIFIED: 'cpd.verified',
  CPD_RETURNED: 'cpd.returned',

  // Competency
  COMPETENCY_ASSESSED: 'competency.assessed',
  COMPETENCY_UPDATED: 'competency.updated',

  // Supervision
  SUPERVISION_RECORDED: 'supervision.recorded',
  SUPERVISION_UPDATED: 'supervision.updated',

  // Leave
  LEAVE_REQUESTED: 'leave.requested',
  LEAVE_SUBMITTED: 'leave.submitted',
  LEAVE_APPROVED: 'leave.approved',
  LEAVE_REJECTED: 'leave.rejected',
  LEAVE_WITHDRAWN: 'leave.withdrawn',

  // Expenses
  EXPENSE_CREATED: 'expense.created',
  EXPENSE_SUBMITTED: 'expense.submitted',
  EXPENSE_APPROVED: 'expense.approved',
  EXPENSE_REJECTED: 'expense.rejected',
  EXPENSE_WITHDRAWN: 'expense.withdrawn',

  // Requests (service requests)
  REQUEST_CREATED: 'request.created',
  REQUEST_SUBMITTED: 'request.submitted',
  REQUEST_APPROVED: 'request.approved',
  REQUEST_REJECTED: 'request.rejected',
  REQUEST_COMPLETED: 'request.completed',
  REQUEST_WITHDRAWN: 'request.withdrawn',

  // Assets
  ASSET_CREATED: 'asset.created',
  ASSET_ASSIGNED: 'asset.assigned',
  ASSET_RETURNED: 'asset.returned',
  ASSET_DAMAGED: 'asset.damaged',
  ASSET_LOST: 'asset.lost',
  ASSET_UPDATED: 'asset.updated',

  // Site — Observations
  OBSERVATION_CREATED: 'site.observation_created',
  OBSERVATION_UPDATED: 'site.observation_updated',
  OBSERVATION_ASSIGNED: 'site.observation_assigned',
  OBSERVATION_RESOLVED: 'site.observation_resolved',
  OBSERVATION_CLOSED: 'site.observation_closed',
  OBSERVATION_REOPENED: 'site.observation_reopened',

  // Site — Snags
  SNAG_CREATED: 'site.snag_created',
  SNAG_ASSIGNED: 'site.snag_assigned',
  SNAG_RECTIFICATION: 'site.snag_rectification',
  SNAG_VERIFIED: 'site.snag_verified',
  SNAG_CLOSED: 'site.snag_closed',
  SNAG_REOPENED: 'site.snag_reopened',

  // Permissions
  PERMISSION_DENIED: 'security.permission_denied',

  // Profile
  PROFILE_DEACTIVATED: 'profile.deactivated',

  // Commercial — Budgets
  BUDGET_CREATED: 'commercial.budget_created',
  BUDGET_UPDATED: 'commercial.budget_updated',
  BUDGET_APPROVED: 'commercial.budget_approved',
  BUDGET_DELETED: 'commercial.budget_deleted',

  // Commercial — Variations
  VARIATION_CREATED: 'commercial.variation_created',
  VARIATION_UPDATED: 'commercial.variation_updated',
  VARIATION_APPROVED: 'commercial.variation_approved',

  // Commercial — Purchase Orders
  PO_CREATED: 'commercial.po_created',
  PO_UPDATED: 'commercial.po_updated',

  // Commercial — Tenders
  TENDER_CREATED: 'commercial.tender_created',
  TENDER_UPDATED: 'commercial.tender_updated',
  TENDER_RETURN_ADDED: 'commercial.tender_return_added',

  // Commercial — Valuations
  VALUATION_CREATED: 'commercial.valuation_created',
  VALUATION_UPDATED: 'commercial.valuation_updated',

  // Commercial — Invoices
  INVOICE_CREATED: 'commercial.invoice_created',
  INVOICE_UPDATED: 'commercial.invoice_updated',

  // Commercial — Risks
  RISK_CREATED: 'commercial.risk_created',
  RISK_UPDATED: 'commercial.risk_updated',

  // Drawings
  DRAWING_CREATED: 'drawing.created',
  DRAWING_UPDATED: 'drawing.updated',
  DRAWING_REVISION_CREATED: 'drawing.revision_created',

  // Design Reviews
  DESIGN_REVIEW_CREATED: 'design_review.created',
  DESIGN_REVIEW_UPDATED: 'design_review.updated',
  DESIGN_REVIEW_COMMENT_CREATED: 'design_review.comment_created',

  // Audit trail
  AUDIT_EXPORTED: 'audit.exported',
} as const

/**
 * Action prefixes that HR-level users can see.
 * OWNER/ADMIN see everything; HR sees only these categories.
 */
export const HR_VISIBLE_PREFIXES = [
  'staffing.',
  'leave.',
  'expense.',
  'onboarding.',
  'invitation.',
  'asset.',
  'request.',
] as const

/**
 * Human-readable labels for audit actions.
 */
export const AUDIT_ACTION_LABELS: Record<string, string> = {
  // Invitations
  'invitation.created': 'Sent invitation',
  'invitation.sent': 'Resent invitation email',
  'invitation.activated': 'Invitation activated',
  'invitation.expired': 'Invitation expired',
  'invitation.revoked': 'Revoked invitation',

  // Auth
  'auth.login': 'Logged in',
  'auth.failed_activation': 'Failed account activation',

  // Onboarding
  'onboarding.item_opened': 'Opened onboarding item',
  'onboarding.item_acknowledged': 'Acknowledged onboarding item',
  'onboarding.completed': 'Completed onboarding',

  // Projects
  'project.created': 'Created project',
  'project.updated': 'Updated project',
  'project.member_added': 'Added team member to project',
  'project.member_updated': 'Changed team member role',
  'project.member_removed': 'Removed team member from project',

  // Tasks
  'task.created': 'Created task',
  'task.assigned': 'Assigned task',
  'task.status_changed': 'Changed task status',
  'task.reviewed': 'Reviewed task',

  // Documents
  'document.uploaded': 'Uploaded document',
  'document.downloaded': 'Downloaded document',
  'document.reviewed': 'Reviewed document',
  'document.approved': 'Approved document',
  'document.issued': 'Issued document',
  'document.superseded': 'Superseded document',

  // Staffing
  'staffing.employee_updated': 'Updated employee profile',
  'staffing.employee_profile_updated': 'Updated employee details',

  // Leave
  'leave.requested': 'Requested leave',
  'leave.submitted': 'Submitted leave request',
  'leave.approved': 'Approved leave request',
  'leave.rejected': 'Rejected leave request',
  'leave.withdrawn': 'Withdrew leave request',

  // Expenses
  'expense.created': 'Created expense claim',
  'expense.submitted': 'Submitted expense claim',
  'expense.approved': 'Approved expense claim',
  'expense.rejected': 'Rejected expense claim',
  'expense.withdrawn': 'Withdrew expense claim',

  // Requests
  'request.created': 'Created service request',
  'request.submitted': 'Submitted service request',
  'request.approved': 'Approved service request',
  'request.rejected': 'Rejected service request',
  'request.completed': 'Completed service request',
  'request.withdrawn': 'Withdrew service request',

  // Assets
  'asset.created': 'Created asset',
  'asset.assigned': 'Assigned asset',
  'asset.returned': 'Returned asset',
  'asset.damaged': 'Reported asset damaged',
  'asset.lost': 'Reported asset lost',
  'asset.updated': 'Updated asset',

  // CPD
  'cpd.created': 'Created CPD record',
  'cpd.submitted': 'Submitted CPD record',
  'cpd.verified': 'Verified CPD record',
  'cpd.returned': 'Returned CPD record',

  // Competency
  'competency.assessed': 'Assessed competency',
  'competency.updated': 'Updated competency',

  // Supervision
  'supervision.recorded': 'Recorded supervision session',
  'supervision.updated': 'Updated supervision session',

  // Site
  'site.observation_created': 'Created site observation',
  'site.observation_updated': 'Updated site observation',
  'site.observation_assigned': 'Assigned site observation',
  'site.observation_resolved': 'Resolved site observation',
  'site.observation_closed': 'Closed site observation',
  'site.observation_reopened': 'Reopened site observation',
  'site.snag_created': 'Created snag',
  'site.snag_assigned': 'Assigned snag',
  'site.snag_rectification': 'Submitted snag rectification',
  'site.snag_verified': 'Verified snag rectification',
  'site.snag_closed': 'Closed snag',
  'site.snag_reopened': 'Reopened snag',

  // Commercial
  'commercial.budget_created': 'Created budget',
  'commercial.budget_updated': 'Updated budget',
  'commercial.budget_approved': 'Approved budget',
  'commercial.budget_deleted': 'Deleted budget',
  'commercial.variation_created': 'Created variation',
  'commercial.variation_updated': 'Updated variation',
  'commercial.variation_approved': 'Approved variation',
  'commercial.po_created': 'Created purchase order',
  'commercial.po_updated': 'Updated purchase order',
  'commercial.tender_created': 'Created tender',
  'commercial.tender_updated': 'Updated tender',
  'commercial.tender_return_added': 'Added tender return',
  'commercial.valuation_created': 'Created valuation',
  'commercial.valuation_updated': 'Updated valuation',
  'commercial.invoice_created': 'Created invoice',
  'commercial.invoice_updated': 'Updated invoice',
  'commercial.risk_created': 'Created risk',
  'commercial.risk_updated': 'Updated risk',

  // Drawings
  'drawing.created': 'Created drawing',
  'drawing.updated': 'Updated drawing',
  'drawing.revision_created': 'Created drawing revision',

  // Design Reviews
  'design_review.created': 'Created design review',
  'design_review.updated': 'Updated design review',
  'design_review.comment_created': 'Added design review comment',

  // Security
  'security.permission_denied': 'Permission denied',

  // Profile
  'profile.deactivated': 'Deactivated profile',

  // Audit
  'audit.exported': 'Exported audit trail',
}

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

  // Site
  OBSERVATION_CREATED: 'site.observation_created',
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
} as const

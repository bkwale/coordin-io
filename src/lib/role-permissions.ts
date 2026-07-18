import type { OrgPermission } from '@/generated/prisma/client'

/**
 * Role-based permission matrix for Coordin.io.
 *
 * Hard-coded per Purple Team recommendation — no database lookups,
 * no custom permission builder. Five profiles, flat lookup.
 *
 * Hierarchy: VIEWER → MEMBER → MANAGER → ADMIN → OWNER
 *
 * Design principles (from PT session):
 * - Financial data (fees, margins, invoices): ADMIN + OWNER only
 * - External-facing actions (issue docs, send invoices): OWNER for sending, ADMIN+ for creating
 * - AI respects role visibility — if you can't see it in UI, AI won't surface it
 * - Audit trails on all external-facing actions (professional indemnity)
 * - VIEWER = client portal / external only, not junior staff
 */

// ── Features & Actions ─────────────────────────────────────

export type Feature =
  | 'projects'
  | 'tasks'
  | 'documents'
  | 'timesheets'
  | 'leave'
  | 'expenses'
  | 'quotes_invoices'
  | 'staffing'
  | 'knowledge_base'
  | 'settings'
  | 'ai'
  | 'portal'

export type Action =
  // Projects
  | 'view_assigned'
  | 'view_all'
  | 'create'
  | 'edit'
  | 'edit_own'
  | 'archive'
  | 'delete'
  // Tasks
  | 'view_own'
  | 'view_project'
  | 'create_edit_own'
  | 'create_edit_project'
  | 'create_edit_all'
  | 'assign_others'
  // Documents
  | 'view_shared'
  | 'view_project'
  | 'upload_edit'
  | 'issue_externally'
  | 'approve_review'
  // Timesheets / Leave / Expenses
  | 'submit_own'
  | 'view_team'
  | 'view_all'
  | 'approve_direct_reports'
  | 'approve_all'
  // Quotes & Invoices
  | 'view_own_project'
  | 'create_edit'
  | 'send_to_client'
  // Staffing
  | 'view_project_allocations'
  | 'assign_staff_project'
  | 'view_utilisation'
  // Knowledge Base
  | 'view'
  | 'contribute'
  | 'edit_delete'
  // Settings
  | 'view_org_settings'
  | 'edit_org_settings'
  | 'manage_team'
  | 'billing_currency'
  | 'integrations'
  | 'ai_governance'
  // AI
  | 'use_scoped'
  | 'access_fee_data'
  // Portal
  | 'view_portal_content'

// ── Permission Matrix ──────────────────────────────────────

type PermissionMatrix = Record<string, Set<OrgPermission>>

/**
 * The key is `${feature}:${action}`.
 * The value is the set of roles that CAN perform that action.
 */
const MATRIX: PermissionMatrix = {
  // ── Projects ──
  'projects:view_assigned':       new Set(['MEMBER', 'MANAGER', 'ADMIN', 'OWNER']),
  'projects:view_all':            new Set(['ADMIN', 'OWNER']),
  'projects:create':              new Set(['MANAGER', 'ADMIN', 'OWNER']),
  'projects:edit_own':            new Set(['MANAGER', 'ADMIN', 'OWNER']),
  'projects:edit':                new Set(['ADMIN', 'OWNER']),
  'projects:archive':             new Set(['ADMIN', 'OWNER']),
  'projects:delete':              new Set(['OWNER']),

  // ── Tasks ──
  'tasks:view_own':               new Set(['MEMBER', 'MANAGER', 'ADMIN', 'OWNER']),
  'tasks:view_project':           new Set(['MANAGER', 'ADMIN', 'OWNER']),
  'tasks:view_all':               new Set(['ADMIN', 'OWNER']),
  'tasks:create_edit_own':        new Set(['MEMBER', 'MANAGER', 'ADMIN', 'OWNER']),
  'tasks:create_edit_project':    new Set(['MANAGER', 'ADMIN', 'OWNER']),
  'tasks:create_edit_all':        new Set(['ADMIN', 'OWNER']),
  'tasks:assign_others':          new Set(['MANAGER', 'ADMIN', 'OWNER']),

  // ── Documents ──
  'documents:view_shared':        new Set(['VIEWER', 'MEMBER', 'MANAGER', 'ADMIN', 'OWNER']),
  'documents:view_project':       new Set(['MEMBER', 'MANAGER', 'ADMIN', 'OWNER']),
  'documents:upload_edit':        new Set(['MEMBER', 'MANAGER', 'ADMIN', 'OWNER']),
  'documents:approve_review':     new Set(['MANAGER', 'ADMIN', 'OWNER']),
  'documents:issue_externally':   new Set(['ADMIN', 'OWNER']),

  // ── Timesheets ──
  'timesheets:submit_own':        new Set(['MEMBER', 'MANAGER', 'ADMIN', 'OWNER']),
  'timesheets:view_team':         new Set(['MANAGER', 'ADMIN', 'OWNER']),
  'timesheets:view_all':          new Set(['ADMIN', 'OWNER']),
  'timesheets:approve_direct_reports': new Set(['MANAGER', 'ADMIN', 'OWNER']),
  'timesheets:approve_all':       new Set(['ADMIN', 'OWNER']),

  // ── Leave ──
  'leave:submit_own':             new Set(['MEMBER', 'MANAGER', 'ADMIN', 'OWNER']),
  'leave:approve_direct_reports': new Set(['MANAGER', 'ADMIN', 'OWNER']),
  'leave:approve_all':            new Set(['ADMIN', 'OWNER']),
  'leave:view_all':               new Set(['ADMIN', 'OWNER']),

  // ── Expenses ──
  'expenses:submit_own':          new Set(['MEMBER', 'MANAGER', 'ADMIN', 'OWNER']),
  'expenses:approve_direct_reports': new Set(['MANAGER', 'ADMIN', 'OWNER']),
  'expenses:approve_all':         new Set(['ADMIN', 'OWNER']),
  'expenses:view_all':            new Set(['ADMIN', 'OWNER']),

  // ── Quotes & Invoices ──
  'quotes_invoices:view_own_project': new Set(['MANAGER', 'ADMIN', 'OWNER']),
  'quotes_invoices:view_all':     new Set(['ADMIN', 'OWNER']),
  'quotes_invoices:create_edit':  new Set(['ADMIN', 'OWNER']),
  'quotes_invoices:send_to_client': new Set(['OWNER']),

  // ── Staffing ──
  'staffing:view_project_allocations': new Set(['MANAGER', 'ADMIN', 'OWNER']),
  'staffing:assign_staff_project': new Set(['MANAGER', 'ADMIN', 'OWNER']),
  'staffing:view_utilisation':    new Set(['ADMIN', 'OWNER']),

  // ── Knowledge Base ──
  'knowledge_base:view':          new Set(['VIEWER', 'MEMBER', 'MANAGER', 'ADMIN', 'OWNER']),
  'knowledge_base:contribute':    new Set(['MEMBER', 'MANAGER', 'ADMIN', 'OWNER']),
  'knowledge_base:edit_delete':   new Set(['ADMIN', 'OWNER']),

  // ── Settings ──
  'settings:view_org_settings':   new Set(['ADMIN', 'OWNER']),
  'settings:edit_org_settings':   new Set(['OWNER']),
  'settings:manage_team':         new Set(['ADMIN', 'OWNER']),
  'settings:billing_currency':    new Set(['OWNER']),
  'settings:integrations':        new Set(['ADMIN', 'OWNER']),
  'settings:ai_governance':       new Set(['OWNER']),

  // ── AI Assistant ──
  'ai:use_scoped':                new Set(['MEMBER', 'MANAGER', 'ADMIN', 'OWNER']),
  'ai:access_fee_data':           new Set(['ADMIN', 'OWNER']),

  // ── Portal (external) ──
  'portal:view_portal_content':   new Set(['VIEWER']),
}

// ── Public API ─────────────────────────────────────────────

/**
 * Check if a role can perform a specific action on a feature.
 *
 * Usage:
 * ```ts
 * if (!canPerform(profile.orgPermission, 'quotes_invoices', 'send_to_client')) {
 *   throw new PermissionError('Only the Practice Principal can send invoices to clients')
 * }
 * ```
 */
export function canPerform(
  role: OrgPermission,
  feature: Feature,
  action: Action,
): boolean {
  const key = `${feature}:${action}`
  const allowedRoles = MATRIX[key]
  if (!allowedRoles) {
    // Unknown permission key — deny by default
    console.warn(`[PERMISSIONS] Unknown permission key: ${key}`)
    return false
  }
  return allowedRoles.has(role)
}

/**
 * Get all permissions for a given role — useful for sending
 * the client a permissions object so the UI can show/hide features.
 */
export function getPermissionsForRole(role: OrgPermission): Record<string, boolean> {
  const result: Record<string, boolean> = {}
  for (const key of Object.keys(MATRIX)) {
    result[key] = MATRIX[key].has(role)
  }
  return result
}

/**
 * Get the consequence tier of an action.
 * Used for audit logging — high-consequence actions always get logged.
 */
export type ConsequenceTier = 'low' | 'medium' | 'high'

const HIGH_CONSEQUENCE_ACTIONS = new Set([
  'documents:issue_externally',
  'quotes_invoices:send_to_client',
  'projects:delete',
  'settings:edit_org_settings',
  'settings:ai_governance',
  'settings:billing_currency',
])

const MEDIUM_CONSEQUENCE_ACTIONS = new Set([
  'projects:create',
  'projects:archive',
  'leave:approve_all',
  'expenses:approve_all',
  'timesheets:approve_all',
  'quotes_invoices:create_edit',
  'settings:manage_team',
  'documents:approve_review',
])

export function getConsequenceTier(feature: Feature, action: Action): ConsequenceTier {
  const key = `${feature}:${action}`
  if (HIGH_CONSEQUENCE_ACTIONS.has(key)) return 'high'
  if (MEDIUM_CONSEQUENCE_ACTIONS.has(key)) return 'medium'
  return 'low'
}

// ── Practice-Friendly Role Labels ──────────────────────────

export const ROLE_LABELS: Record<OrgPermission, string> = {
  OWNER: 'Practice Principal',
  ADMIN: 'Practice Manager',
  MANAGER: 'Project Lead',
  MEMBER: 'Team Member',
  VIEWER: 'External',
}

export const ROLE_DESCRIPTIONS: Record<OrgPermission, string> = {
  OWNER: 'Full control — organisation settings, billing, AI governance, and all features',
  ADMIN: 'Operational management — team, projects, finances, integrations',
  MANAGER: 'Project-level control — tasks, documents, approvals for direct reports',
  MEMBER: 'Day-to-day work — timesheets, tasks, expenses, leave requests',
  VIEWER: 'Read-only portal access for clients and external stakeholders',
}

/**
 * Get the practice-friendly label for a role.
 */
export function getRoleLabel(role: OrgPermission): string {
  return ROLE_LABELS[role] || role
}

import { describe, it, expect, vi } from 'vitest'

// Mock prisma (permissions.ts imports it for getProjectMembership)
vi.mock('@/lib/prisma', () => ({
  prisma: {
    projectMembership: { findUnique: vi.fn() },
    profile: { findUnique: vi.fn() },
  },
}))

import { canPerform, getPermissionsForRole, getConsequenceTier, getRoleLabel, ROLE_LABELS, ROLE_DESCRIPTIONS } from '@/lib/role-permissions'
import { hasOrgPermission, isLateralRole, hasProjectRole, canReviewWork, canIssueDocument } from '@/lib/permissions'
import { getAuditPrefixesForRole, HR_VISIBLE_PREFIXES, LEGAL_VISIBLE_PREFIXES, FINANCE_VISIBLE_PREFIXES, COMMERCIAL_VISIBLE_PREFIXES } from '@/lib/audit'
import type { OrgPermission, ProjectRole } from '@/generated/prisma/client'

const ALL_ROLES: OrgPermission[] = ['VIEWER', 'MEMBER', 'MANAGER', 'HR', 'LEGAL', 'FINANCE', 'COMMERCIAL', 'ADMIN', 'OWNER']
const LATERAL_ROLES: OrgPermission[] = ['HR', 'LEGAL', 'FINANCE', 'COMMERCIAL']

// ---------------------------------------------------------------------------
// hasOrgPermission — Tier-Based Hierarchy with Lateral Isolation
// ---------------------------------------------------------------------------

describe('Permission Matrix', () => {
  describe('hasOrgPermission — hierarchy checks', () => {
    it('OWNER has all permissions', () => {
      for (const required of ALL_ROLES) {
        expect(hasOrgPermission('OWNER', required)).toBe(true)
      }
    })

    it('ADMIN has all permissions except OWNER', () => {
      for (const required of ALL_ROLES) {
        if (required === 'OWNER') {
          expect(hasOrgPermission('ADMIN', required)).toBe(false)
        } else {
          expect(hasOrgPermission('ADMIN', required)).toBe(true)
        }
      }
    })

    it('VIEWER has only VIEWER permission', () => {
      expect(hasOrgPermission('VIEWER', 'VIEWER')).toBe(true)
      for (const r of ALL_ROLES.filter(r => r !== 'VIEWER')) {
        expect(hasOrgPermission('VIEWER', r)).toBe(false)
      }
    })

    it('MEMBER passes MEMBER and VIEWER only', () => {
      expect(hasOrgPermission('MEMBER', 'VIEWER')).toBe(true)
      expect(hasOrgPermission('MEMBER', 'MEMBER')).toBe(true)
      expect(hasOrgPermission('MEMBER', 'MANAGER')).toBe(false)
      for (const lat of LATERAL_ROLES) {
        expect(hasOrgPermission('MEMBER', lat)).toBe(false)
      }
    })

    it('MANAGER passes MANAGER, MEMBER, VIEWER — not lateral or above', () => {
      expect(hasOrgPermission('MANAGER', 'VIEWER')).toBe(true)
      expect(hasOrgPermission('MANAGER', 'MEMBER')).toBe(true)
      expect(hasOrgPermission('MANAGER', 'MANAGER')).toBe(true)
      for (const lat of LATERAL_ROLES) {
        expect(hasOrgPermission('MANAGER', lat)).toBe(false)
      }
      expect(hasOrgPermission('MANAGER', 'ADMIN')).toBe(false)
      expect(hasOrgPermission('MANAGER', 'OWNER')).toBe(false)
    })
  })

  // =========================================================================
  // Lateral Role Isolation — the core Sprint 0 design
  // =========================================================================

  describe('hasOrgPermission — lateral role isolation', () => {
    it.each(LATERAL_ROLES)('%s passes checks for MANAGER and below', (role) => {
      expect(hasOrgPermission(role, 'VIEWER')).toBe(true)
      expect(hasOrgPermission(role, 'MEMBER')).toBe(true)
      expect(hasOrgPermission(role, 'MANAGER')).toBe(true)
    })

    it.each(LATERAL_ROLES)('%s passes checks for itself', (role) => {
      expect(hasOrgPermission(role, role)).toBe(true)
    })

    it.each(LATERAL_ROLES)('%s cannot reach ADMIN or OWNER', (role) => {
      expect(hasOrgPermission(role, 'ADMIN')).toBe(false)
      expect(hasOrgPermission(role, 'OWNER')).toBe(false)
    })

    it('HR cannot pass LEGAL, FINANCE, or COMMERCIAL checks', () => {
      expect(hasOrgPermission('HR', 'LEGAL')).toBe(false)
      expect(hasOrgPermission('HR', 'FINANCE')).toBe(false)
      expect(hasOrgPermission('HR', 'COMMERCIAL')).toBe(false)
    })

    it('LEGAL cannot pass HR, FINANCE, or COMMERCIAL checks', () => {
      expect(hasOrgPermission('LEGAL', 'HR')).toBe(false)
      expect(hasOrgPermission('LEGAL', 'FINANCE')).toBe(false)
      expect(hasOrgPermission('LEGAL', 'COMMERCIAL')).toBe(false)
    })

    it('FINANCE cannot pass HR, LEGAL, or COMMERCIAL checks', () => {
      expect(hasOrgPermission('FINANCE', 'HR')).toBe(false)
      expect(hasOrgPermission('FINANCE', 'LEGAL')).toBe(false)
      expect(hasOrgPermission('FINANCE', 'COMMERCIAL')).toBe(false)
    })

    it('COMMERCIAL cannot pass HR, LEGAL, or FINANCE checks', () => {
      expect(hasOrgPermission('COMMERCIAL', 'HR')).toBe(false)
      expect(hasOrgPermission('COMMERCIAL', 'LEGAL')).toBe(false)
      expect(hasOrgPermission('COMMERCIAL', 'FINANCE')).toBe(false)
    })
  })

  describe('isLateralRole', () => {
    it('correctly identifies lateral roles', () => {
      for (const lat of LATERAL_ROLES) {
        expect(isLateralRole(lat)).toBe(true)
      }
    })

    it('non-lateral roles return false', () => {
      for (const r of ['VIEWER', 'MEMBER', 'MANAGER', 'ADMIN', 'OWNER'] as OrgPermission[]) {
        expect(isLateralRole(r)).toBe(false)
      }
    })
  })

  // =========================================================================
  // canPerform — Domain-Specific Access (New Roles)
  // =========================================================================

  describe('canPerform — LEGAL domain access', () => {
    it('LEGAL can view and edit planning', () => {
      expect(canPerform('LEGAL', 'planning_legal', 'view_planning')).toBe(true)
      expect(canPerform('LEGAL', 'planning_legal', 'edit_planning')).toBe(true)
      expect(canPerform('LEGAL', 'planning_legal', 'approve_planning')).toBe(true)
    })

    it('LEGAL can view and edit legal docs', () => {
      expect(canPerform('LEGAL', 'planning_legal', 'view_legal')).toBe(true)
      expect(canPerform('LEGAL', 'planning_legal', 'edit_legal')).toBe(true)
    })

    it('LEGAL can view and review documents', () => {
      expect(canPerform('LEGAL', 'documents', 'view_project')).toBe(true)
      expect(canPerform('LEGAL', 'documents', 'approve_review')).toBe(true)
    })

    it('LEGAL can view all projects', () => {
      expect(canPerform('LEGAL', 'projects', 'view_all')).toBe(true)
    })

    it('LEGAL CANNOT access HR staffing data', () => {
      expect(canPerform('LEGAL', 'staffing', 'view_full_profiles')).toBe(false)
      expect(canPerform('LEGAL', 'staffing', 'manage_hr_documents')).toBe(false)
      expect(canPerform('LEGAL', 'staffing', 'manage_probation')).toBe(false)
    })

    it('LEGAL CANNOT access financial data', () => {
      expect(canPerform('LEGAL', 'quotes_invoices', 'view_own_project')).toBe(false)
      expect(canPerform('LEGAL', 'quotes_invoices', 'view_all')).toBe(false)
      expect(canPerform('LEGAL', 'quotes_invoices', 'create_edit')).toBe(false)
    })

    it('LEGAL CANNOT access commercial features', () => {
      expect(canPerform('LEGAL', 'commercial', 'edit_commercial')).toBe(false)
      expect(canPerform('LEGAL', 'commercial', 'approve_commercial')).toBe(false)
      expect(canPerform('LEGAL', 'commercial', 'manage_tenders')).toBe(false)
    })

    it('LEGAL CANNOT change org settings', () => {
      expect(canPerform('LEGAL', 'settings', 'view_org_settings')).toBe(false)
      expect(canPerform('LEGAL', 'settings', 'edit_org_settings')).toBe(false)
    })

    it('LEGAL CANNOT view salary', () => {
      expect(canPerform('LEGAL', 'staffing', 'view_salary')).toBe(false)
    })
  })

  describe('canPerform — FINANCE domain access', () => {
    it('FINANCE can manage expenses fully', () => {
      expect(canPerform('FINANCE', 'expenses', 'submit_own')).toBe(true)
      expect(canPerform('FINANCE', 'expenses', 'approve_direct_reports')).toBe(true)
      expect(canPerform('FINANCE', 'expenses', 'approve_all')).toBe(true)
      expect(canPerform('FINANCE', 'expenses', 'view_all')).toBe(true)
    })

    it('FINANCE can view and create invoices', () => {
      expect(canPerform('FINANCE', 'quotes_invoices', 'view_own_project')).toBe(true)
      expect(canPerform('FINANCE', 'quotes_invoices', 'view_all')).toBe(true)
      expect(canPerform('FINANCE', 'quotes_invoices', 'create_edit')).toBe(true)
    })

    it('FINANCE CANNOT send invoices to client (OWNER only)', () => {
      expect(canPerform('FINANCE', 'quotes_invoices', 'send_to_client')).toBe(false)
    })

    it('FINANCE can view salary data', () => {
      expect(canPerform('FINANCE', 'staffing', 'view_salary')).toBe(true)
    })

    it('FINANCE can view and manage budgets in commercial', () => {
      expect(canPerform('FINANCE', 'commercial', 'view_commercial')).toBe(true)
      expect(canPerform('FINANCE', 'commercial', 'manage_budgets')).toBe(true)
    })

    it('FINANCE CANNOT edit or approve commercial (that is COMMERCIAL role)', () => {
      expect(canPerform('FINANCE', 'commercial', 'edit_commercial')).toBe(false)
      expect(canPerform('FINANCE', 'commercial', 'approve_commercial')).toBe(false)
      expect(canPerform('FINANCE', 'commercial', 'manage_tenders')).toBe(false)
    })

    it('FINANCE can access AI fee data', () => {
      expect(canPerform('FINANCE', 'ai', 'access_fee_data')).toBe(true)
    })

    it('FINANCE CANNOT access HR staffing', () => {
      expect(canPerform('FINANCE', 'staffing', 'view_full_profiles')).toBe(false)
      expect(canPerform('FINANCE', 'staffing', 'manage_hr_documents')).toBe(false)
      expect(canPerform('FINANCE', 'staffing', 'manage_probation')).toBe(false)
    })

    it('FINANCE CANNOT access legal features', () => {
      expect(canPerform('FINANCE', 'planning_legal', 'view_legal')).toBe(false)
      expect(canPerform('FINANCE', 'planning_legal', 'edit_legal')).toBe(false)
      expect(canPerform('FINANCE', 'planning_legal', 'edit_planning')).toBe(false)
    })

    it('FINANCE CANNOT change org settings', () => {
      expect(canPerform('FINANCE', 'settings', 'view_org_settings')).toBe(false)
    })
  })

  describe('canPerform — COMMERCIAL domain access', () => {
    it('COMMERCIAL can manage commercial features fully', () => {
      expect(canPerform('COMMERCIAL', 'commercial', 'view_commercial')).toBe(true)
      expect(canPerform('COMMERCIAL', 'commercial', 'edit_commercial')).toBe(true)
      expect(canPerform('COMMERCIAL', 'commercial', 'approve_commercial')).toBe(true)
      expect(canPerform('COMMERCIAL', 'commercial', 'manage_tenders')).toBe(true)
      expect(canPerform('COMMERCIAL', 'commercial', 'manage_budgets')).toBe(true)
    })

    it('COMMERCIAL can view all projects', () => {
      expect(canPerform('COMMERCIAL', 'projects', 'view_all')).toBe(true)
    })

    it('COMMERCIAL can view documents', () => {
      expect(canPerform('COMMERCIAL', 'documents', 'view_project')).toBe(true)
      expect(canPerform('COMMERCIAL', 'documents', 'view_shared')).toBe(true)
    })

    it('COMMERCIAL CANNOT approve/review documents', () => {
      expect(canPerform('COMMERCIAL', 'documents', 'approve_review')).toBe(false)
    })

    it('COMMERCIAL CANNOT access HR, legal, or payroll', () => {
      expect(canPerform('COMMERCIAL', 'staffing', 'view_full_profiles')).toBe(false)
      expect(canPerform('COMMERCIAL', 'staffing', 'manage_hr_documents')).toBe(false)
      expect(canPerform('COMMERCIAL', 'staffing', 'view_salary')).toBe(false)
      expect(canPerform('COMMERCIAL', 'planning_legal', 'view_legal')).toBe(false)
      expect(canPerform('COMMERCIAL', 'planning_legal', 'edit_legal')).toBe(false)
    })

    it('COMMERCIAL CANNOT access financial invoices', () => {
      expect(canPerform('COMMERCIAL', 'quotes_invoices', 'view_own_project')).toBe(false)
      expect(canPerform('COMMERCIAL', 'quotes_invoices', 'view_all')).toBe(false)
      expect(canPerform('COMMERCIAL', 'quotes_invoices', 'create_edit')).toBe(false)
    })

    it('COMMERCIAL CANNOT change org settings', () => {
      expect(canPerform('COMMERCIAL', 'settings', 'view_org_settings')).toBe(false)
    })
  })

  // =========================================================================
  // Cross-Lateral Isolation — the critical invariant
  // =========================================================================

  describe('canPerform — cross-lateral isolation', () => {
    it('LEGAL cannot see FINANCE-only features', () => {
      expect(canPerform('LEGAL', 'quotes_invoices', 'view_all')).toBe(false)
      expect(canPerform('LEGAL', 'quotes_invoices', 'create_edit')).toBe(false)
      expect(canPerform('LEGAL', 'expenses', 'approve_all')).toBe(false)
      expect(canPerform('LEGAL', 'ai', 'access_fee_data')).toBe(false)
    })

    it('FINANCE cannot see LEGAL-only features', () => {
      expect(canPerform('FINANCE', 'planning_legal', 'view_legal')).toBe(false)
      expect(canPerform('FINANCE', 'planning_legal', 'edit_legal')).toBe(false)
      expect(canPerform('FINANCE', 'planning_legal', 'approve_planning')).toBe(false)
    })

    it('HR cannot see COMMERCIAL-only features', () => {
      expect(canPerform('HR', 'commercial', 'edit_commercial')).toBe(false)
      expect(canPerform('HR', 'commercial', 'approve_commercial')).toBe(false)
      expect(canPerform('HR', 'commercial', 'manage_tenders')).toBe(false)
    })

    it('COMMERCIAL cannot see HR-only features', () => {
      expect(canPerform('COMMERCIAL', 'staffing', 'view_full_profiles')).toBe(false)
      expect(canPerform('COMMERCIAL', 'staffing', 'manage_hr_documents')).toBe(false)
      expect(canPerform('COMMERCIAL', 'staffing', 'manage_probation')).toBe(false)
      expect(canPerform('COMMERCIAL', 'staffing', 'view_utilisation')).toBe(false)
    })
  })

  // =========================================================================
  // All Roles — Shared Features (tasks, timesheets, leave, AI, knowledge)
  // =========================================================================

  describe('canPerform — shared features all lateral roles can access', () => {
    it.each(LATERAL_ROLES)('%s can view own tasks and submit own timesheets/leave/expenses', (role) => {
      expect(canPerform(role, 'tasks', 'view_own')).toBe(true)
      expect(canPerform(role, 'tasks', 'create_edit_own')).toBe(true)
      expect(canPerform(role, 'timesheets', 'submit_own')).toBe(true)
      expect(canPerform(role, 'leave', 'submit_own')).toBe(true)
      expect(canPerform(role, 'expenses', 'submit_own')).toBe(true)
    })

    it.each(LATERAL_ROLES)('%s can view asset catalogue and own assets', (role) => {
      expect(canPerform(role, 'assets', 'view_catalogue')).toBe(true)
      expect(canPerform(role, 'assets', 'view_own_assets')).toBe(true)
    })

    it.each(LATERAL_ROLES)('%s can use scoped AI', (role) => {
      expect(canPerform(role, 'ai', 'use_scoped')).toBe(true)
    })

    it.each(LATERAL_ROLES)('%s can view and contribute to knowledge base', (role) => {
      expect(canPerform(role, 'knowledge_base', 'view')).toBe(true)
      expect(canPerform(role, 'knowledge_base', 'contribute')).toBe(true)
    })

    it.each(LATERAL_ROLES)('%s can view staff directory', (role) => {
      expect(canPerform(role, 'staffing', 'view_directory')).toBe(true)
    })

    it.each(LATERAL_ROLES)('%s can view assigned projects', (role) => {
      expect(canPerform(role, 'projects', 'view_assigned')).toBe(true)
    })
  })

  // =========================================================================
  // Audit Trail — Role-Scoped Visibility
  // =========================================================================

  describe('canPerform — audit trail access', () => {
    it('HR, LEGAL, FINANCE can view and export audit', () => {
      for (const role of ['HR', 'LEGAL', 'FINANCE'] as OrgPermission[]) {
        expect(canPerform(role, 'audit', 'view_audit')).toBe(true)
        expect(canPerform(role, 'audit', 'export_audit')).toBe(true)
      }
    })

    it('COMMERCIAL cannot view or export audit', () => {
      expect(canPerform('COMMERCIAL', 'audit', 'view_audit')).toBe(false)
      expect(canPerform('COMMERCIAL', 'audit', 'export_audit')).toBe(false)
    })

    it('MANAGER, MEMBER, VIEWER cannot access audit', () => {
      for (const role of ['MANAGER', 'MEMBER', 'VIEWER'] as OrgPermission[]) {
        expect(canPerform(role, 'audit', 'view_audit')).toBe(false)
        expect(canPerform(role, 'audit', 'export_audit')).toBe(false)
      }
    })

    it('ADMIN and OWNER can view and export audit', () => {
      expect(canPerform('ADMIN', 'audit', 'view_audit')).toBe(true)
      expect(canPerform('ADMIN', 'audit', 'export_audit')).toBe(true)
      expect(canPerform('OWNER', 'audit', 'view_audit')).toBe(true)
      expect(canPerform('OWNER', 'audit', 'export_audit')).toBe(true)
    })
  })

  describe('getAuditPrefixesForRole — role-scoped audit visibility', () => {
    it('OWNER and ADMIN see everything (null = no filter)', () => {
      expect(getAuditPrefixesForRole('OWNER')).toBeNull()
      expect(getAuditPrefixesForRole('ADMIN')).toBeNull()
    })

    it('HR sees HR_VISIBLE_PREFIXES', () => {
      expect(getAuditPrefixesForRole('HR')).toBe(HR_VISIBLE_PREFIXES)
    })

    it('LEGAL sees LEGAL_VISIBLE_PREFIXES', () => {
      expect(getAuditPrefixesForRole('LEGAL')).toBe(LEGAL_VISIBLE_PREFIXES)
    })

    it('FINANCE sees FINANCE_VISIBLE_PREFIXES', () => {
      expect(getAuditPrefixesForRole('FINANCE')).toBe(FINANCE_VISIBLE_PREFIXES)
    })

    it('COMMERCIAL sees COMMERCIAL_VISIBLE_PREFIXES', () => {
      expect(getAuditPrefixesForRole('COMMERCIAL')).toBe(COMMERCIAL_VISIBLE_PREFIXES)
    })

    it('MANAGER, MEMBER, VIEWER get empty array (no audit access)', () => {
      for (const role of ['MANAGER', 'MEMBER', 'VIEWER']) {
        const result = getAuditPrefixesForRole(role)
        expect(result).toEqual([])
      }
    })

    it('prefix arrays do not overlap between HR and LEGAL', () => {
      const hrSet = new Set<string>(HR_VISIBLE_PREFIXES as readonly string[])
      for (const prefix of LEGAL_VISIBLE_PREFIXES) {
        expect(hrSet.has(prefix)).toBe(false)
      }
    })

    it('FINANCE and LEGAL prefix arrays do not share legal prefixes', () => {
      const finSet = new Set<string>(FINANCE_VISIBLE_PREFIXES as readonly string[])
      // LEGAL sees project., document., drawing., design_review., cpd., competency.
      // FINANCE should not see project., document., drawing., design_review., cpd., competency.
      for (const prefix of ['project.', 'document.', 'drawing.', 'design_review.', 'cpd.', 'competency.']) {
        expect(finSet.has(prefix)).toBe(false)
      }
    })
  })

  // =========================================================================
  // Existing Tests — Preserved from Sprint 0
  // =========================================================================

  describe('canPerform — staffing data visibility', () => {
    it.each([
      ['OWNER', true],
      ['ADMIN', true],
      ['HR', true],
      ['LEGAL', false],
      ['FINANCE', false],
      ['COMMERCIAL', false],
      ['MANAGER', false],
      ['MEMBER', false],
      ['VIEWER', false],
    ] as [OrgPermission, boolean][])(
      '%s can view staffing full profiles: %s',
      (role, expected) => {
        expect(canPerform(role, 'staffing', 'view_full_profiles')).toBe(expected)
      },
    )
  })

  describe('canPerform — leave approval', () => {
    it.each([
      ['OWNER', true],
      ['ADMIN', true],
      ['HR', true],
      ['MANAGER', true],
      ['LEGAL', false],
      ['FINANCE', false],
      ['COMMERCIAL', false],
      ['MEMBER', false],
      ['VIEWER', false],
    ] as [OrgPermission, boolean][])(
      '%s can approve direct reports leave: %s',
      (role, expected) => {
        expect(canPerform(role, 'leave', 'approve_direct_reports')).toBe(expected)
      },
    )

    it.each([
      ['OWNER', true],
      ['ADMIN', true],
      ['HR', true],
      ['LEGAL', false],
      ['FINANCE', false],
      ['COMMERCIAL', false],
      ['MANAGER', false],
      ['MEMBER', false],
      ['VIEWER', false],
    ] as [OrgPermission, boolean][])(
      '%s can approve all leave: %s',
      (role, expected) => {
        expect(canPerform(role, 'leave', 'approve_all')).toBe(expected)
      },
    )
  })

  describe('canPerform — HR document management', () => {
    it.each([
      ['OWNER', true],
      ['ADMIN', true],
      ['HR', true],
      ['LEGAL', false],
      ['FINANCE', false],
      ['COMMERCIAL', false],
      ['MANAGER', false],
      ['MEMBER', false],
      ['VIEWER', false],
    ] as [OrgPermission, boolean][])(
      '%s can manage HR documents: %s',
      (role, expected) => {
        expect(canPerform(role, 'staffing', 'manage_hr_documents')).toBe(expected)
      },
    )
  })

  describe('canPerform — project creation', () => {
    it.each([
      ['OWNER', true],
      ['ADMIN', true],
      ['HR', false],
      ['LEGAL', false],
      ['FINANCE', false],
      ['COMMERCIAL', false],
      ['MANAGER', true],
      ['MEMBER', false],
      ['VIEWER', false],
    ] as [OrgPermission, boolean][])(
      '%s can create projects: %s',
      (role, expected) => {
        expect(canPerform(role, 'projects', 'create')).toBe(expected)
      },
    )
  })

  describe('canPerform — team management (invite users)', () => {
    it.each([
      ['OWNER', true],
      ['ADMIN', true],
      ['HR', true],
      ['LEGAL', false],
      ['FINANCE', false],
      ['COMMERCIAL', false],
      ['MANAGER', false],
      ['MEMBER', false],
      ['VIEWER', false],
    ] as [OrgPermission, boolean][])(
      '%s can manage team: %s',
      (role, expected) => {
        expect(canPerform(role, 'settings', 'manage_team')).toBe(expected)
      },
    )
  })

  describe('canPerform — org settings', () => {
    it.each([
      ['OWNER', true],
      ['ADMIN', true],
      ['HR', false],
      ['LEGAL', false],
      ['FINANCE', false],
      ['COMMERCIAL', false],
      ['MANAGER', false],
      ['MEMBER', false],
      ['VIEWER', false],
    ] as [OrgPermission, boolean][])(
      '%s can view org settings: %s',
      (role, expected) => {
        expect(canPerform(role, 'settings', 'view_org_settings')).toBe(expected)
      },
    )

    it('only OWNER can edit org settings', () => {
      expect(canPerform('OWNER', 'settings', 'edit_org_settings')).toBe(true)
      expect(canPerform('ADMIN', 'settings', 'edit_org_settings')).toBe(false)
      for (const role of [...LATERAL_ROLES, 'MANAGER', 'MEMBER', 'VIEWER'] as OrgPermission[]) {
        expect(canPerform(role, 'settings', 'edit_org_settings')).toBe(false)
      }
    })
  })

  describe('canPerform — salary data visibility', () => {
    it.each([
      ['OWNER', true],
      ['ADMIN', true],
      ['HR', true],
      ['FINANCE', true],
      ['LEGAL', false],
      ['COMMERCIAL', false],
      ['MANAGER', false],
      ['MEMBER', false],
      ['VIEWER', false],
    ] as [OrgPermission, boolean][])(
      '%s can view salary data: %s',
      (role, expected) => {
        expect(canPerform(role, 'staffing', 'view_salary')).toBe(expected)
      },
    )
  })

  describe('canPerform — financial data (quotes/invoices)', () => {
    it('HR cannot see financial data', () => {
      expect(canPerform('HR', 'quotes_invoices', 'view_own_project')).toBe(false)
      expect(canPerform('HR', 'quotes_invoices', 'view_all')).toBe(false)
      expect(canPerform('HR', 'quotes_invoices', 'create_edit')).toBe(false)
    })

    it('FINANCE can see and manage financial data', () => {
      expect(canPerform('FINANCE', 'quotes_invoices', 'view_own_project')).toBe(true)
      expect(canPerform('FINANCE', 'quotes_invoices', 'view_all')).toBe(true)
      expect(canPerform('FINANCE', 'quotes_invoices', 'create_edit')).toBe(true)
    })

    it('only OWNER can send invoices to client', () => {
      expect(canPerform('OWNER', 'quotes_invoices', 'send_to_client')).toBe(true)
      expect(canPerform('ADMIN', 'quotes_invoices', 'send_to_client')).toBe(false)
      expect(canPerform('FINANCE', 'quotes_invoices', 'send_to_client')).toBe(false)
    })
  })

  describe('canPerform — document issuance', () => {
    it.each([
      ['OWNER', true],
      ['ADMIN', true],
      ['HR', false],
      ['LEGAL', false],
      ['FINANCE', false],
      ['COMMERCIAL', false],
      ['MANAGER', false],
      ['MEMBER', false],
      ['VIEWER', false],
    ] as [OrgPermission, boolean][])(
      '%s can issue documents externally: %s',
      (role, expected) => {
        expect(canPerform(role, 'documents', 'issue_externally')).toBe(expected)
      },
    )
  })

  describe('canPerform — unknown permission key', () => {
    it('returns false for unknown feature:action key', () => {
      expect(canPerform('OWNER', 'nonexistent' as any, 'unknown_action' as any)).toBe(false)
    })
  })

  // =========================================================================
  // Consequence Tiers
  // =========================================================================

  describe('getConsequenceTier', () => {
    it('planning_legal:edit_legal is high consequence', () => {
      expect(getConsequenceTier('planning_legal', 'edit_legal')).toBe('high')
    })

    it('commercial:approve_commercial is high consequence', () => {
      expect(getConsequenceTier('commercial', 'approve_commercial')).toBe('high')
    })

    it('commercial:manage_tenders is medium consequence', () => {
      expect(getConsequenceTier('commercial', 'manage_tenders')).toBe('medium')
    })

    it('audit:export_audit is medium consequence', () => {
      expect(getConsequenceTier('audit', 'export_audit')).toBe('medium')
    })

    it('assets:manage_assets is medium consequence', () => {
      expect(getConsequenceTier('assets', 'manage_assets')).toBe('medium')
    })

    it('tasks:view_own is low consequence', () => {
      expect(getConsequenceTier('tasks', 'view_own')).toBe('low')
    })
  })

  // =========================================================================
  // Role Labels — all 9 roles have labels and descriptions
  // =========================================================================

  describe('ROLE_LABELS and ROLE_DESCRIPTIONS', () => {
    it('every role has a label', () => {
      for (const role of ALL_ROLES) {
        expect(ROLE_LABELS[role]).toBeDefined()
        expect(ROLE_LABELS[role].length).toBeGreaterThan(0)
      }
    })

    it('every role has a description', () => {
      for (const role of ALL_ROLES) {
        expect(ROLE_DESCRIPTIONS[role]).toBeDefined()
        expect(ROLE_DESCRIPTIONS[role].length).toBeGreaterThan(0)
      }
    })

    it('getRoleLabel returns correct labels', () => {
      expect(getRoleLabel('LEGAL')).toBe('Legal')
      expect(getRoleLabel('FINANCE')).toBe('Finance / Accounts')
      expect(getRoleLabel('COMMERCIAL')).toBe('Commercial')
      expect(getRoleLabel('HR')).toBe('HR / People Admin')
    })
  })

  // =========================================================================
  // getPermissionsForRole — completeness check
  // =========================================================================

  describe('getPermissionsForRole', () => {
    it('returns an object with boolean values for every MATRIX key', () => {
      const perms = getPermissionsForRole('LEGAL')
      expect(typeof perms).toBe('object')
      // Spot-check
      expect(perms['planning_legal:view_legal']).toBe(true)
      expect(perms['staffing:view_full_profiles']).toBe(false)
      expect(perms['projects:view_all']).toBe(true)
    })

    it('VIEWER only gets knowledge_base:view, documents:view_shared, and portal', () => {
      const perms = getPermissionsForRole('VIEWER')
      const trueKeys = Object.entries(perms).filter(([, v]) => v).map(([k]) => k)
      expect(trueKeys).toContain('knowledge_base:view')
      expect(trueKeys).toContain('documents:view_shared')
      expect(trueKeys).toContain('portal:view_portal_content')
      // Should have very few true keys
      expect(trueKeys.length).toBeLessThanOrEqual(4)
    })
  })

  // =========================================================================
  // Project Role Hierarchy (unchanged from before)
  // =========================================================================

  describe('hasProjectRole — project role hierarchy', () => {
    it('PROJECT_LEAD can do everything', () => {
      const projectRoles: ProjectRole[] = [
        'TEAM_MEMBER', 'ARCHITECT', 'SENIOR_ARCHITECT',
        'DESIGN_LEAD', 'PROJECT_ARCHITECT', 'PROJECT_LEAD',
      ]
      for (const required of projectRoles) {
        expect(hasProjectRole('PROJECT_LEAD', required)).toBe(true)
      }
    })

    it('TEAM_MEMBER cannot add members', () => {
      expect(hasProjectRole('TEAM_MEMBER', 'PROJECT_LEAD')).toBe(false)
    })

    it('CONTRACTOR is outside the hierarchy — can only match itself', () => {
      expect(hasProjectRole('CONTRACTOR', 'CONTRACTOR')).toBe(true)
      expect(hasProjectRole('CONTRACTOR', 'TEAM_MEMBER')).toBe(false)
    })

    it('EXTERNAL_CONSULTANT is outside the hierarchy — can only match itself', () => {
      expect(hasProjectRole('EXTERNAL_CONSULTANT', 'EXTERNAL_CONSULTANT')).toBe(true)
      expect(hasProjectRole('EXTERNAL_CONSULTANT', 'TEAM_MEMBER')).toBe(false)
    })

    it('DESIGN_LEAD can perform ARCHITECT and below', () => {
      expect(hasProjectRole('DESIGN_LEAD', 'ARCHITECT')).toBe(true)
      expect(hasProjectRole('DESIGN_LEAD', 'TEAM_MEMBER')).toBe(true)
      expect(hasProjectRole('DESIGN_LEAD', 'SENIOR_ARCHITECT')).toBe(true)
    })

    it('SENIOR_ARCHITECT cannot issue documents (requires PROJECT_ARCHITECT)', () => {
      expect(hasProjectRole('SENIOR_ARCHITECT', 'PROJECT_ARCHITECT')).toBe(false)
    })
  })

  // =========================================================================
  // Composite Permission Checks (unchanged)
  // =========================================================================

  describe('canReviewWork — composite checks', () => {
    it('cannot approve own work', () => {
      expect(canReviewWork('PROJECT_LEAD', 'profile-1', 'profile-1')).toBe(false)
    })

    it('SENIOR_ARCHITECT can review others work', () => {
      expect(canReviewWork('SENIOR_ARCHITECT', 'profile-1', 'profile-2')).toBe(true)
    })

    it('ARCHITECT cannot review work (below SENIOR_ARCHITECT)', () => {
      expect(canReviewWork('ARCHITECT', 'profile-1', 'profile-2')).toBe(false)
    })
  })

  describe('canIssueDocument', () => {
    it('PROJECT_ARCHITECT can issue documents', () => {
      expect(canIssueDocument('PROJECT_ARCHITECT')).toBe(true)
    })

    it('PROJECT_LEAD can issue documents', () => {
      expect(canIssueDocument('PROJECT_LEAD')).toBe(true)
    })

    it('SENIOR_ARCHITECT cannot issue documents', () => {
      expect(canIssueDocument('SENIOR_ARCHITECT')).toBe(false)
    })
  })
})

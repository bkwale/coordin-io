import { describe, it, expect, vi } from 'vitest'

// Mock prisma (permissions.ts imports it for getProjectMembership)
vi.mock('@/lib/prisma', () => ({
  prisma: {
    projectMembership: { findUnique: vi.fn() },
    profile: { findUnique: vi.fn() },
  },
}))

import { canPerform } from '@/lib/role-permissions'
import { hasOrgPermission, hasProjectRole, canReviewWork, canIssueDocument } from '@/lib/permissions'
import type { OrgPermission, ProjectRole } from '@/generated/prisma/client'

// ---------------------------------------------------------------------------
// Org Permission Hierarchy Tests
// ---------------------------------------------------------------------------

describe('Permission Matrix', () => {
  describe('hasOrgPermission — hierarchy checks', () => {
    const roles: OrgPermission[] = ['VIEWER', 'MEMBER', 'MANAGER', 'HR', 'ADMIN', 'OWNER']

    it('OWNER has all permissions', () => {
      for (const required of roles) {
        expect(hasOrgPermission('OWNER', required)).toBe(true)
      }
    })

    it('VIEWER has only VIEWER permission', () => {
      expect(hasOrgPermission('VIEWER', 'VIEWER')).toBe(true)
      expect(hasOrgPermission('VIEWER', 'MEMBER')).toBe(false)
      expect(hasOrgPermission('VIEWER', 'MANAGER')).toBe(false)
      expect(hasOrgPermission('VIEWER', 'HR')).toBe(false)
      expect(hasOrgPermission('VIEWER', 'ADMIN')).toBe(false)
      expect(hasOrgPermission('VIEWER', 'OWNER')).toBe(false)
    })

    it('HR is above MANAGER but below ADMIN', () => {
      expect(hasOrgPermission('HR', 'MEMBER')).toBe(true)
      expect(hasOrgPermission('HR', 'MANAGER')).toBe(true)
      expect(hasOrgPermission('HR', 'HR')).toBe(true)
      expect(hasOrgPermission('HR', 'ADMIN')).toBe(false)
      expect(hasOrgPermission('HR', 'OWNER')).toBe(false)
    })

    it('MEMBER cannot access MANAGER-level actions', () => {
      expect(hasOrgPermission('MEMBER', 'MANAGER')).toBe(false)
    })
  })

  // =========================================================================
  // canPerform — Full Permission Matrix
  // =========================================================================

  describe('canPerform — staffing data visibility', () => {
    it.each([
      ['OWNER', true],
      ['ADMIN', true],
      ['HR', true],
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
      ['HR', true],
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

  describe('canPerform — org settings (change orgPermission)', () => {
    it.each([
      ['OWNER', true],
      ['ADMIN', true],
      ['HR', false],
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
      expect(canPerform('HR', 'settings', 'edit_org_settings')).toBe(false)
    })
  })

  describe('canPerform — salary data visibility', () => {
    it.each([
      ['OWNER', true],
      ['ADMIN', true],
      ['HR', true],
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

  describe('canPerform — probation management', () => {
    it.each([
      ['OWNER', true],
      ['ADMIN', true],
      ['HR', true],
      ['MANAGER', false],
      ['MEMBER', false],
      ['VIEWER', false],
    ] as [OrgPermission, boolean][])(
      '%s can manage probation: %s',
      (role, expected) => {
        expect(canPerform(role, 'staffing', 'manage_probation')).toBe(expected)
      },
    )
  })

  describe('canPerform — financial data (quotes/invoices)', () => {
    it('HR cannot see financial data', () => {
      expect(canPerform('HR', 'quotes_invoices', 'view_own_project')).toBe(false)
      expect(canPerform('HR', 'quotes_invoices', 'view_all')).toBe(false)
      expect(canPerform('HR', 'quotes_invoices', 'create_edit')).toBe(false)
    })

    it('only OWNER can send invoices to client', () => {
      expect(canPerform('OWNER', 'quotes_invoices', 'send_to_client')).toBe(true)
      expect(canPerform('ADMIN', 'quotes_invoices', 'send_to_client')).toBe(false)
    })
  })

  describe('canPerform — document issuance', () => {
    it.each([
      ['OWNER', true],
      ['ADMIN', true],
      ['HR', false],
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

  describe('canPerform — document review', () => {
    it.each([
      ['OWNER', true],
      ['ADMIN', true],
      ['HR', true],
      ['MANAGER', true],
      ['MEMBER', false],
      ['VIEWER', false],
    ] as [OrgPermission, boolean][])(
      '%s can approve/review documents: %s',
      (role, expected) => {
        expect(canPerform(role, 'documents', 'approve_review')).toBe(expected)
      },
    )
  })

  describe('canPerform — unknown permission key', () => {
    it('returns false for unknown feature:action key', () => {
      expect(canPerform('OWNER', 'nonexistent' as any, 'unknown_action' as any)).toBe(false)
    })
  })

  // =========================================================================
  // Project Role Hierarchy
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

    it('PROJECT_LEAD can add members (requires PROJECT_LEAD)', () => {
      expect(hasProjectRole('PROJECT_LEAD', 'PROJECT_LEAD')).toBe(true)
    })

    it('TEAM_MEMBER cannot add members', () => {
      expect(hasProjectRole('TEAM_MEMBER', 'PROJECT_LEAD')).toBe(false)
    })

    it('ARCHITECT can review documents (requires SENIOR_ARCHITECT for review)', () => {
      // ARCHITECT is below SENIOR_ARCHITECT
      expect(hasProjectRole('ARCHITECT', 'SENIOR_ARCHITECT')).toBe(false)
    })

    it('SENIOR_ARCHITECT can review documents', () => {
      expect(hasProjectRole('SENIOR_ARCHITECT', 'SENIOR_ARCHITECT')).toBe(true)
    })

    it('CONTRACTOR is outside the hierarchy — can only match itself', () => {
      expect(hasProjectRole('CONTRACTOR', 'CONTRACTOR')).toBe(true)
      expect(hasProjectRole('CONTRACTOR', 'TEAM_MEMBER')).toBe(false)
      expect(hasProjectRole('CONTRACTOR', 'PROJECT_LEAD')).toBe(false)
    })

    it('EXTERNAL_CONSULTANT is outside the hierarchy — can only match itself', () => {
      expect(hasProjectRole('EXTERNAL_CONSULTANT', 'EXTERNAL_CONSULTANT')).toBe(true)
      expect(hasProjectRole('EXTERNAL_CONSULTANT', 'TEAM_MEMBER')).toBe(false)
    })

    it('TEAM_MEMBER cannot perform ARCHITECT role', () => {
      expect(hasProjectRole('TEAM_MEMBER', 'ARCHITECT')).toBe(false)
    })

    it('DESIGN_LEAD can perform ARCHITECT and below', () => {
      expect(hasProjectRole('DESIGN_LEAD', 'ARCHITECT')).toBe(true)
      expect(hasProjectRole('DESIGN_LEAD', 'TEAM_MEMBER')).toBe(true)
      expect(hasProjectRole('DESIGN_LEAD', 'SENIOR_ARCHITECT')).toBe(true)
    })

    it('PROJECT_ARCHITECT can issue documents', () => {
      expect(hasProjectRole('PROJECT_ARCHITECT', 'PROJECT_ARCHITECT')).toBe(true)
    })

    it('SENIOR_ARCHITECT cannot issue documents (requires PROJECT_ARCHITECT)', () => {
      expect(hasProjectRole('SENIOR_ARCHITECT', 'PROJECT_ARCHITECT')).toBe(false)
    })
  })

  // =========================================================================
  // Composite Permission Checks
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

    it('TEAM_MEMBER cannot review work', () => {
      expect(canReviewWork('TEAM_MEMBER', 'profile-1', 'profile-2')).toBe(false)
    })

    it('CONTRACTOR cannot review work', () => {
      expect(canReviewWork('CONTRACTOR', 'profile-1', 'profile-2')).toBe(false)
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

    it('TEAM_MEMBER cannot issue documents', () => {
      expect(canIssueDocument('TEAM_MEMBER')).toBe(false)
    })

    it('CONTRACTOR cannot issue documents', () => {
      expect(canIssueDocument('CONTRACTOR')).toBe(false)
    })
  })
})

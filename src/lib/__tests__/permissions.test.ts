import { describe, it, expect, vi } from 'vitest'

// Mock the prisma import so permissions.ts can load without a DB connection
vi.mock('../prisma', () => ({ prisma: {} }))

import { OrgPermission, ProjectRole } from '@/generated/prisma/client'
import {
  hasOrgPermission,
  hasProjectRole,
  canReviewWork,
  canIssueDocument,
} from '../permissions'

// ── hasOrgPermission ───────────────────────────────────────────

describe('hasOrgPermission', () => {
  const levels: OrgPermission[] = ['VIEWER', 'MEMBER', 'MANAGER', 'ADMIN', 'OWNER']

  it('every level satisfies itself', () => {
    for (const level of levels) {
      expect(hasOrgPermission(level, level)).toBe(true)
    }
  })

  it('higher levels satisfy lower requirements', () => {
    expect(hasOrgPermission('OWNER', 'VIEWER')).toBe(true)
    expect(hasOrgPermission('OWNER', 'MEMBER')).toBe(true)
    expect(hasOrgPermission('OWNER', 'MANAGER')).toBe(true)
    expect(hasOrgPermission('OWNER', 'ADMIN')).toBe(true)

    expect(hasOrgPermission('ADMIN', 'VIEWER')).toBe(true)
    expect(hasOrgPermission('ADMIN', 'MEMBER')).toBe(true)
    expect(hasOrgPermission('ADMIN', 'MANAGER')).toBe(true)

    expect(hasOrgPermission('MANAGER', 'VIEWER')).toBe(true)
    expect(hasOrgPermission('MANAGER', 'MEMBER')).toBe(true)

    expect(hasOrgPermission('MEMBER', 'VIEWER')).toBe(true)
  })

  it('lower levels cannot satisfy higher requirements', () => {
    expect(hasOrgPermission('VIEWER', 'MEMBER')).toBe(false)
    expect(hasOrgPermission('VIEWER', 'MANAGER')).toBe(false)
    expect(hasOrgPermission('VIEWER', 'ADMIN')).toBe(false)
    expect(hasOrgPermission('VIEWER', 'OWNER')).toBe(false)

    expect(hasOrgPermission('MEMBER', 'MANAGER')).toBe(false)
    expect(hasOrgPermission('MEMBER', 'ADMIN')).toBe(false)
    expect(hasOrgPermission('MEMBER', 'OWNER')).toBe(false)

    expect(hasOrgPermission('MANAGER', 'ADMIN')).toBe(false)
    expect(hasOrgPermission('MANAGER', 'OWNER')).toBe(false)

    expect(hasOrgPermission('ADMIN', 'OWNER')).toBe(false)
  })
})

// ── hasProjectRole ─────────────────────────────────────────────

describe('hasProjectRole', () => {
  const hierarchy: ProjectRole[] = [
    'TEAM_MEMBER',
    'ARCHITECT',
    'SENIOR_ARCHITECT',
    'DESIGN_LEAD',
    'PROJECT_ARCHITECT',
    'PROJECT_LEAD',
  ]

  it('every hierarchical role satisfies itself', () => {
    for (const role of hierarchy) {
      expect(hasProjectRole(role, role)).toBe(true)
    }
  })

  it('PROJECT_LEAD satisfies all lower roles', () => {
    for (const role of hierarchy) {
      expect(hasProjectRole('PROJECT_LEAD', role)).toBe(true)
    }
  })

  it('TEAM_MEMBER cannot satisfy any role above it', () => {
    expect(hasProjectRole('TEAM_MEMBER', 'ARCHITECT')).toBe(false)
    expect(hasProjectRole('TEAM_MEMBER', 'SENIOR_ARCHITECT')).toBe(false)
    expect(hasProjectRole('TEAM_MEMBER', 'DESIGN_LEAD')).toBe(false)
    expect(hasProjectRole('TEAM_MEMBER', 'PROJECT_ARCHITECT')).toBe(false)
    expect(hasProjectRole('TEAM_MEMBER', 'PROJECT_LEAD')).toBe(false)
  })

  it('ARCHITECT cannot satisfy SENIOR_ARCHITECT or above', () => {
    expect(hasProjectRole('ARCHITECT', 'SENIOR_ARCHITECT')).toBe(false)
    expect(hasProjectRole('ARCHITECT', 'DESIGN_LEAD')).toBe(false)
    expect(hasProjectRole('ARCHITECT', 'PROJECT_ARCHITECT')).toBe(false)
    expect(hasProjectRole('ARCHITECT', 'PROJECT_LEAD')).toBe(false)
  })

  it('ARCHITECT satisfies TEAM_MEMBER', () => {
    expect(hasProjectRole('ARCHITECT', 'TEAM_MEMBER')).toBe(true)
  })

  // ── External roles (outside hierarchy) ────────────────────

  it('EXTERNAL_CONSULTANT only matches itself', () => {
    expect(hasProjectRole('EXTERNAL_CONSULTANT', 'EXTERNAL_CONSULTANT')).toBe(true)
    expect(hasProjectRole('EXTERNAL_CONSULTANT', 'TEAM_MEMBER')).toBe(false)
    expect(hasProjectRole('EXTERNAL_CONSULTANT', 'PROJECT_LEAD')).toBe(false)
  })

  it('CONTRACTOR only matches itself', () => {
    expect(hasProjectRole('CONTRACTOR', 'CONTRACTOR')).toBe(true)
    expect(hasProjectRole('CONTRACTOR', 'TEAM_MEMBER')).toBe(false)
    expect(hasProjectRole('CONTRACTOR', 'PROJECT_LEAD')).toBe(false)
  })

  it('hierarchical roles satisfy external role requirements (external roles are below hierarchy)', () => {
    // EXTERNAL_CONSULTANT and CONTRACTOR are not in the hierarchy array,
    // so indexOf returns -1. Any hierarchical role (index >= 0) satisfies them.
    expect(hasProjectRole('PROJECT_LEAD', 'EXTERNAL_CONSULTANT')).toBe(true)
    expect(hasProjectRole('PROJECT_LEAD', 'CONTRACTOR')).toBe(true)
    expect(hasProjectRole('TEAM_MEMBER', 'EXTERNAL_CONSULTANT')).toBe(true)
    expect(hasProjectRole('TEAM_MEMBER', 'CONTRACTOR')).toBe(true)
  })
})

// ── canReviewWork ──────────────────────────────────────────────

describe('canReviewWork', () => {
  it('cannot approve own work regardless of role', () => {
    expect(canReviewWork('PROJECT_LEAD', 'user-1', 'user-1')).toBe(false)
    expect(canReviewWork('SENIOR_ARCHITECT', 'user-1', 'user-1')).toBe(false)
  })

  it('SENIOR_ARCHITECT can review others\' work', () => {
    expect(canReviewWork('SENIOR_ARCHITECT', 'author-1', 'reviewer-1')).toBe(true)
  })

  it('DESIGN_LEAD and above can review', () => {
    expect(canReviewWork('DESIGN_LEAD', 'author-1', 'reviewer-1')).toBe(true)
    expect(canReviewWork('PROJECT_ARCHITECT', 'author-1', 'reviewer-1')).toBe(true)
    expect(canReviewWork('PROJECT_LEAD', 'author-1', 'reviewer-1')).toBe(true)
  })

  it('ARCHITECT and TEAM_MEMBER cannot review', () => {
    expect(canReviewWork('ARCHITECT', 'author-1', 'reviewer-1')).toBe(false)
    expect(canReviewWork('TEAM_MEMBER', 'author-1', 'reviewer-1')).toBe(false)
  })
})

// ── canIssueDocument ───────────────────────────────────────────

describe('canIssueDocument', () => {
  it('PROJECT_ARCHITECT and above can issue', () => {
    expect(canIssueDocument('PROJECT_ARCHITECT')).toBe(true)
    expect(canIssueDocument('PROJECT_LEAD')).toBe(true)
  })

  it('DESIGN_LEAD and below cannot issue', () => {
    expect(canIssueDocument('DESIGN_LEAD')).toBe(false)
    expect(canIssueDocument('SENIOR_ARCHITECT')).toBe(false)
    expect(canIssueDocument('ARCHITECT')).toBe(false)
    expect(canIssueDocument('TEAM_MEMBER')).toBe(false)
  })

  it('external roles cannot issue', () => {
    expect(canIssueDocument('EXTERNAL_CONSULTANT')).toBe(false)
    expect(canIssueDocument('CONTRACTOR')).toBe(false)
  })
})

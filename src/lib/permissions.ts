import { OrgPermission, ProjectRole } from '@/generated/prisma/client'
import { prisma } from './prisma'

/**
 * Permission checks — org-scoped and project-scoped.
 * Every API route must call these before mutating data.
 */

// ── Org-level checks ────────────────────────────────────────

/**
 * Permission hierarchy with lateral role support.
 *
 * Tier 0: VIEWER
 * Tier 1: MEMBER
 * Tier 2: MANAGER
 * Tier 3 (lateral): HR, LEGAL, FINANCE, COMMERCIAL — peers, not ranked
 * Tier 4: ADMIN
 * Tier 5: OWNER
 *
 * Lateral roles:
 *   - Each passes checks that require MANAGER or below
 *   - Each passes checks that require itself (e.g. LEGAL passes 'LEGAL')
 *   - None passes checks that require a DIFFERENT lateral role
 *   - ADMIN and OWNER pass everything
 *
 * This ensures LEGAL cannot see FINANCE data and vice versa,
 * while both can do anything a MANAGER can do.
 */

const LATERAL_ROLES: Set<OrgPermission> = new Set(['HR', 'LEGAL', 'FINANCE', 'COMMERCIAL'])

const TIER_MAP: Record<OrgPermission, number> = {
  VIEWER: 0,
  MEMBER: 1,
  MANAGER: 2,
  HR: 3,
  LEGAL: 3,
  FINANCE: 3,
  COMMERCIAL: 3,
  ADMIN: 4,
  OWNER: 5,
}

export function hasOrgPermission(
  userPermission: OrgPermission,
  requiredPermission: OrgPermission
): boolean {
  const userTier = TIER_MAP[userPermission]
  const requiredTier = TIER_MAP[requiredPermission]

  // ADMIN and OWNER pass everything
  if (userTier >= 4) return userTier >= requiredTier

  // If required is a lateral role, user must either:
  //   - have that exact lateral role, OR
  //   - be ADMIN/OWNER (handled above)
  if (LATERAL_ROLES.has(requiredPermission)) {
    return userPermission === requiredPermission
  }

  // For non-lateral requirements (MANAGER, MEMBER, VIEWER),
  // any role at that tier or above passes
  return userTier >= requiredTier
}

/**
 * Check if a role is a lateral (department-scoped) role.
 */
export function isLateralRole(permission: OrgPermission): boolean {
  return LATERAL_ROLES.has(permission)
}

// ── Project-level checks ────────────────────────────────────

const PROJECT_ROLE_HIERARCHY: ProjectRole[] = [
  'TEAM_MEMBER',
  'ARCHITECT',
  'SENIOR_ARCHITECT',
  'DESIGN_LEAD',
  'PROJECT_ARCHITECT',
  'PROJECT_LEAD',
]

export function hasProjectRole(
  userRole: ProjectRole,
  requiredRole: ProjectRole
): boolean {
  // External roles are outside the hierarchy
  if (userRole === 'EXTERNAL_CONSULTANT' || userRole === 'CONTRACTOR') {
    return userRole === requiredRole
  }
  const userLevel = PROJECT_ROLE_HIERARCHY.indexOf(userRole)
  const requiredLevel = PROJECT_ROLE_HIERARCHY.indexOf(requiredRole)
  return userLevel >= requiredLevel
}

// ── Composite checks ────────────────────────────────────────

/**
 * Check if a user is a member of a specific project.
 * Returns the membership or null if not assigned.
 */
export async function getProjectMembership(profileId: string, projectId: string) {
  return prisma.projectMembership.findUnique({
    where: {
      projectId_profileId: {
        projectId,
        profileId,
      },
    },
  })
}

/**
 * Check if a user can view a project.
 * Org admins/owners can see all projects.
 * Members can only see assigned projects.
 */
export async function canViewProject(
  profileId: string,
  projectId: string,
  orgPermission: OrgPermission
): Promise<boolean> {
  // HR, Admins, and Owners see everything
  if (hasOrgPermission(orgPermission, 'HR')) {
    return true
  }
  // Everyone else needs an active membership
  const membership = await getProjectMembership(profileId, projectId)
  return membership !== null && membership.removedAt === null
}

/**
 * Check if a user can review/approve work.
 * Graduates cannot approve their own work.
 */
export function canReviewWork(
  reviewerRole: ProjectRole,
  authorProfileId: string,
  reviewerProfileId: string
): boolean {
  // Cannot approve own work
  if (authorProfileId === reviewerProfileId) return false
  // Must be at least Senior Architect level
  return hasProjectRole(reviewerRole, 'SENIOR_ARCHITECT')
}

/**
 * Check if a user can issue construction documents.
 * Graduates cannot issue externally unless explicitly authorised.
 */
export function canIssueDocument(projectRole: ProjectRole): boolean {
  return hasProjectRole(projectRole, 'PROJECT_ARCHITECT')
}

/**
 * Get the current user's profile from their Supabase auth ID.
 */
export async function getProfileByAuthId(authUserId: string) {
  return prisma.profile.findUnique({
    where: { authUserId },
    include: {
      organisation: true,
      office: true,
      corporateRole: true,
      employeeProfile: true,
    },
  })
}

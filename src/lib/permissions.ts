import { OrgPermission, ProjectRole } from '@/generated/prisma/client'
import { prisma } from './prisma'

/**
 * Permission checks — org-scoped and project-scoped.
 * Every API route must call these before mutating data.
 */

// ── Org-level checks ────────────────────────────────────────

const ORG_PERMISSION_HIERARCHY: OrgPermission[] = [
  'VIEWER',
  'MEMBER',
  'MANAGER',
  'ADMIN',
  'OWNER',
]

export function hasOrgPermission(
  userPermission: OrgPermission,
  requiredPermission: OrgPermission
): boolean {
  const userLevel = ORG_PERMISSION_HIERARCHY.indexOf(userPermission)
  const requiredLevel = ORG_PERMISSION_HIERARCHY.indexOf(requiredPermission)
  return userLevel >= requiredLevel
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
  // Admins and owners see everything
  if (hasOrgPermission(orgPermission, 'ADMIN')) {
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

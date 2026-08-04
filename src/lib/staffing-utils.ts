import type { OrgPermission } from '@/generated/prisma/client'
import { canPerform } from '@/lib/role-permissions'

/**
 * Check if a role has full staffing access (can see all employee details).
 * HR, ADMIN, OWNER can. MANAGER can see project allocations but not full profiles.
 */
export function hasFullStaffingAccess(role: OrgPermission): boolean {
  return canPerform(role, 'staffing', 'view_full_profiles')
}

/**
 * Check if a role can see the staffing dashboard at all (metrics, allocations).
 * MANAGER+ can see project allocations. MEMBER sees only the basic directory.
 */
export function hasStaffingDashboardAccess(role: OrgPermission): boolean {
  return canPerform(role, 'staffing', 'view_project_allocations')
}

/**
 * Check if a role can manage HR content (documents, probation, training).
 * HR, ADMIN, OWNER can. Replaces inline `isAdmin` checks throughout staffing routes.
 */
export function canManageHR(role: OrgPermission): boolean {
  return canPerform(role, 'staffing', 'manage_hr_documents')
}

/**
 * Check if a role can view utilisation/capacity metrics.
 * HR, ADMIN, OWNER can.
 */
export function canViewUtilisation(role: OrgPermission): boolean {
  return canPerform(role, 'staffing', 'view_utilisation')
}

/**
 * Map a raw Prisma profile to a MINIMAL directory entry.
 * This is what MEMBERs see: name, role, office, location. Nothing else.
 *
 * Query-then-strip pattern: routes query full data, then call this
 * to remove fields the caller's role must not see.
 */
export interface DirectoryEntry {
  id: string
  fullName: string
  jobTitle: string | null
  office: string | null
  officeCity: string | null
  officeCountry: string | null
  department: string | null
  role: string | null
}

/**
 * Strip a profile down to directory-only fields.
 * Used by routes that serve data to MEMBERs — query full, then strip.
 */
export function toDirectoryEntry(profile: {
  id: string
  fullName: string
  jobTitle: string | null
  office?: { name: string; city?: string | null; country?: string | null } | null
  department?: string | null
  corporateRole?: { name: string } | null
}): DirectoryEntry {
  return {
    id: profile.id,
    fullName: profile.fullName,
    jobTitle: profile.jobTitle,
    office: profile.office?.name ?? null,
    officeCity: profile.office?.city ?? null,
    officeCountry: profile.office?.country ?? null,
    department: profile.department ?? null,
    role: profile.corporateRole?.name ?? null,
  }
}

/**
 * Map a raw Prisma profile to the staffing API response shape.
 * Handles null relations gracefully — defaults to safe values.
 */
export interface StaffingProfileInput {
  id: string
  fullName: string
  email: string
  jobTitle: string | null
  status: string
  startDate: string | null
  officeId: string | null
  orgPermission: string
  department: string | null
  office: { name: string } | null
  corporateRole: { name: string } | null
  employeeProfile: { onboardingComplete: boolean; annualLeaveAllocation: number } | null
}

export interface StaffingEmployee {
  id: string
  fullName: string
  email: string
  jobTitle: string | null
  status: string
  startDate: string | null
  officeId: string | null
  orgPermission: string
  office: string | null
  department: string | null
  role: string | null
  onboardingComplete: boolean
  leaveAllocation: number
}

export function mapStaffingEmployee(profile: StaffingProfileInput): StaffingEmployee {
  return {
    id: profile.id,
    fullName: profile.fullName,
    email: profile.email,
    jobTitle: profile.jobTitle,
    status: profile.status,
    startDate: profile.startDate,
    officeId: profile.officeId,
    orgPermission: profile.orgPermission,
    office: profile.office?.name ?? null,
    department: profile.department ?? null,
    role: profile.corporateRole?.name ?? null,
    onboardingComplete: profile.employeeProfile?.onboardingComplete ?? false,
    leaveAllocation: profile.employeeProfile?.annualLeaveAllocation ?? 25,
  }
}

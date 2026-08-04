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
  office: { name: string } | null
  corporateRole: { department: string | null; title: string | null } | null
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
    department: profile.corporateRole?.department ?? null,
    role: profile.corporateRole?.title ?? null,
    onboardingComplete: profile.employeeProfile?.onboardingComplete ?? false,
    leaveAllocation: profile.employeeProfile?.annualLeaveAllocation ?? 25,
  }
}

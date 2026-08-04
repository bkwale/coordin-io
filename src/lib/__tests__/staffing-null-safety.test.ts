import { describe, it, expect } from 'vitest'

/**
 * Extract the staffing employee mapping logic
 * (mirrors /api/staffing/route.ts lines 242-257).
 *
 * Bug 1 root cause: employeeProfile was null for new members who had
 * not yet completed onboarding, causing a crash when accessing
 * .onboardingComplete and .annualLeaveAllocation.
 */
function mapStaffingEmployee(profile: {
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
  employeeProfile: {
    onboardingComplete: boolean
    annualLeaveAllocation: number
  } | null
}) {
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

// ── Full profile ──────────────────────────────────────────

const fullProfile = {
  id: 'profile-1',
  fullName: 'Jane Doe',
  email: 'jane@example.com',
  jobTitle: 'Senior Architect',
  status: 'ACTIVE',
  startDate: '2024-03-01',
  officeId: 'office-1',
  orgPermission: 'MEMBER',
  office: { name: 'London HQ' },
  corporateRole: { department: 'Design', title: 'Lead Architect' },
  employeeProfile: { onboardingComplete: true, annualLeaveAllocation: 28 },
}

describe('mapStaffingEmployee', () => {
  it('maps a full profile with all relations correctly', () => {
    const result = mapStaffingEmployee(fullProfile)

    expect(result).toEqual({
      id: 'profile-1',
      fullName: 'Jane Doe',
      email: 'jane@example.com',
      jobTitle: 'Senior Architect',
      status: 'ACTIVE',
      startDate: '2024-03-01',
      officeId: 'office-1',
      orgPermission: 'MEMBER',
      office: 'London HQ',
      department: 'Design',
      role: 'Lead Architect',
      onboardingComplete: true,
      leaveAllocation: 28,
    })
  })

  it('defaults onboardingComplete to false and leaveAllocation to 25 when employeeProfile is null (Bug 1)', () => {
    const result = mapStaffingEmployee({
      ...fullProfile,
      employeeProfile: null,
    })

    expect(result.onboardingComplete).toBe(false)
    expect(result.leaveAllocation).toBe(25)
  })

  it('maps office to null when office relation is null', () => {
    const result = mapStaffingEmployee({
      ...fullProfile,
      office: null,
    })

    expect(result.office).toBeNull()
  })

  it('maps department and role to null when corporateRole is null', () => {
    const result = mapStaffingEmployee({
      ...fullProfile,
      corporateRole: null,
    })

    expect(result.department).toBeNull()
    expect(result.role).toBeNull()
  })

  it('handles all nullable relations being null without crashing', () => {
    const result = mapStaffingEmployee({
      id: 'profile-2',
      fullName: 'New Starter',
      email: 'new@example.com',
      jobTitle: null,
      status: 'PENDING',
      startDate: null,
      officeId: null,
      orgPermission: 'MEMBER',
      office: null,
      corporateRole: null,
      employeeProfile: null,
    })

    expect(result.id).toBe('profile-2')
    expect(result.jobTitle).toBeNull()
    expect(result.startDate).toBeNull()
    expect(result.officeId).toBeNull()
    expect(result.office).toBeNull()
    expect(result.department).toBeNull()
    expect(result.role).toBeNull()
    expect(result.onboardingComplete).toBe(false)
    expect(result.leaveAllocation).toBe(25)
  })

  it('shows null for jobTitle, not "undefined" or NaN', () => {
    const result = mapStaffingEmployee({
      ...fullProfile,
      jobTitle: null,
    })

    expect(result.jobTitle).toBeNull()
    expect(result.jobTitle).not.toBe('undefined')
    expect(result.jobTitle).not.toBeNaN()
  })
})

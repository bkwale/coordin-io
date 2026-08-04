import { describe, it, expect } from 'vitest'
import { mapStaffingEmployee } from '@/lib/staffing-utils'

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
  department: 'Design',
  corporateRole: { name: 'Lead Architect' },
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

  it('maps role to null when corporateRole is null, department from profile', () => {
    const result = mapStaffingEmployee({
      ...fullProfile,
      department: null,
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
      department: null,
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

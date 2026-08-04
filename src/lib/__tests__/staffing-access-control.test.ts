import { describe, it, expect, vi } from 'vitest'

// Mock prisma so modules can load without a DB connection
vi.mock('../prisma', () => ({ prisma: {} }))

import type { OrgPermission } from '@/generated/prisma/client'
import {
  hasFullStaffingAccess,
  hasStaffingDashboardAccess,
  canManageHR,
  canViewUtilisation,
  toDirectoryEntry,
} from '../staffing-utils'

// ── hasFullStaffingAccess ──────────────────────────────────────

describe('hasFullStaffingAccess', () => {
  it('grants HR, ADMIN, OWNER', () => {
    expect(hasFullStaffingAccess('HR')).toBe(true)
    expect(hasFullStaffingAccess('ADMIN')).toBe(true)
    expect(hasFullStaffingAccess('OWNER')).toBe(true)
  })

  it('denies MEMBER, MANAGER, VIEWER', () => {
    expect(hasFullStaffingAccess('MEMBER')).toBe(false)
    expect(hasFullStaffingAccess('MANAGER')).toBe(false)
    expect(hasFullStaffingAccess('VIEWER')).toBe(false)
  })
})

// ── hasStaffingDashboardAccess ─────────────────────────────────

describe('hasStaffingDashboardAccess', () => {
  it('grants MANAGER, HR, ADMIN, OWNER', () => {
    expect(hasStaffingDashboardAccess('MANAGER')).toBe(true)
    expect(hasStaffingDashboardAccess('HR')).toBe(true)
    expect(hasStaffingDashboardAccess('ADMIN')).toBe(true)
    expect(hasStaffingDashboardAccess('OWNER')).toBe(true)
  })

  it('denies MEMBER and VIEWER', () => {
    expect(hasStaffingDashboardAccess('MEMBER')).toBe(false)
    expect(hasStaffingDashboardAccess('VIEWER')).toBe(false)
  })
})

// ── canManageHR ────────────────────────────────────────────────

describe('canManageHR', () => {
  it('grants HR, ADMIN, OWNER', () => {
    expect(canManageHR('HR')).toBe(true)
    expect(canManageHR('ADMIN')).toBe(true)
    expect(canManageHR('OWNER')).toBe(true)
  })

  it('denies MANAGER, MEMBER, VIEWER', () => {
    expect(canManageHR('MANAGER')).toBe(false)
    expect(canManageHR('MEMBER')).toBe(false)
    expect(canManageHR('VIEWER')).toBe(false)
  })
})

// ── canViewUtilisation ─────────────────────────────────────────

describe('canViewUtilisation', () => {
  it('grants HR, ADMIN, OWNER', () => {
    expect(canViewUtilisation('HR')).toBe(true)
    expect(canViewUtilisation('ADMIN')).toBe(true)
    expect(canViewUtilisation('OWNER')).toBe(true)
  })

  it('denies MANAGER, MEMBER, VIEWER', () => {
    expect(canViewUtilisation('MANAGER')).toBe(false)
    expect(canViewUtilisation('MEMBER')).toBe(false)
    expect(canViewUtilisation('VIEWER')).toBe(false)
  })
})

// ── toDirectoryEntry ───────────────────────────────────────────

describe('toDirectoryEntry', () => {
  it('maps full profile to directory-only fields', () => {
    const result = toDirectoryEntry({
      id: 'p1',
      fullName: 'Alice Smith',
      jobTitle: 'Senior Engineer',
      office: { name: 'London', city: 'London', country: 'UK' },
      department: 'Engineering',
      corporateRole: { name: 'Senior Engineer' },
    })

    expect(result).toEqual({
      id: 'p1',
      fullName: 'Alice Smith',
      jobTitle: 'Senior Engineer',
      office: 'London',
      officeCity: 'London',
      officeCountry: 'UK',
      department: 'Engineering',
      role: 'Senior Engineer',
    })
  })

  it('handles null office, department, corporateRole', () => {
    const result = toDirectoryEntry({
      id: 'p2',
      fullName: 'Bob Remote',
      jobTitle: null,
      office: null,
      department: null,
      corporateRole: null,
    })

    expect(result).toEqual({
      id: 'p2',
      fullName: 'Bob Remote',
      jobTitle: null,
      office: null,
      officeCity: null,
      officeCountry: null,
      department: null,
      role: null,
    })
  })

  it('handles office without city/country', () => {
    const result = toDirectoryEntry({
      id: 'p3',
      fullName: 'Carol Partial',
      jobTitle: 'PM',
      office: { name: 'Remote Hub' },
    })

    expect(result.office).toBe('Remote Hub')
    expect(result.officeCity).toBeNull()
    expect(result.officeCountry).toBeNull()
  })

  it('does NOT include email, phone, salary, or leave data', () => {
    const result = toDirectoryEntry({
      id: 'p4',
      fullName: 'Dave Secret',
      jobTitle: 'Accountant',
    })

    // These fields must not exist on the result
    expect(result).not.toHaveProperty('email')
    expect(result).not.toHaveProperty('phone')
    expect(result).not.toHaveProperty('salary')
    expect(result).not.toHaveProperty('startDate')
    expect(result).not.toHaveProperty('leaveAllocation')
    expect(result).not.toHaveProperty('emergencyContact')
  })
})

// ── HR role in hierarchy ───────────────────────────────────────

describe('HR role positioning in permission hierarchy', () => {
  const allRoles: OrgPermission[] = ['VIEWER', 'MEMBER', 'MANAGER', 'HR', 'ADMIN', 'OWNER']

  it('HR can do everything MANAGER can in staffing', () => {
    // MANAGER can view project allocations and assign staff
    expect(hasStaffingDashboardAccess('MANAGER')).toBe(true)
    expect(hasStaffingDashboardAccess('HR')).toBe(true)
  })

  it('HR can do things MANAGER cannot', () => {
    // HR can manage HR documents, probation, view full profiles — MANAGER cannot
    expect(canManageHR('HR')).toBe(true)
    expect(canManageHR('MANAGER')).toBe(false)

    expect(hasFullStaffingAccess('HR')).toBe(true)
    expect(hasFullStaffingAccess('MANAGER')).toBe(false)

    expect(canViewUtilisation('HR')).toBe(true)
    expect(canViewUtilisation('MANAGER')).toBe(false)
  })
})

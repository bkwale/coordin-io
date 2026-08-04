import { describe, it, expect } from 'vitest'
import { computeEffectiveHealth } from '@/lib/dashboard-health'
import { mapStaffingEmployee } from '@/lib/staffing-utils'
import { filterLeaveRequests } from '@/lib/leave-filters'
import { validateOnboardingCompletion } from '@/lib/onboarding-utils'
import { isValidTimesheetTransition, TIMESHEET_TRANSITIONS } from '@/lib/timesheet-transitions'

/**
 * Null-safety integration tests.
 *
 * These test the REAL extracted functions with null/empty/edge-case inputs
 * to verify the production code handles them gracefully.
 * Unlike the previous version, these test actual production code paths.
 */

const pastDate = new Date('2020-01-01')
const futureDate = new Date('2099-12-31')

describe('Null-safety — real function tests', () => {

  // ── Dashboard health with edge-case data ──────────────
  describe('computeEffectiveHealth edge cases', () => {
    it('null healthStatus with tasks defaults to GREY', () => {
      expect(computeEffectiveHealth({
        healthStatus: null,
        tasks: [{ status: 'IN_PROGRESS', dueDate: futureDate }],
      })).toBe('GREY')
    })

    it('null healthStatus with overdue tasks still returns GREY (not AMBER — AMBER requires GREEN)', () => {
      // AMBER rule: overdueTaskCount > 0 && healthStatus === 'GREEN'
      // null !== 'GREEN', so it falls through to healthStatus ?? 'GREY'
      // Use 5 tasks with 1 overdue (20% < 25%) to avoid hitting the RED threshold
      expect(computeEffectiveHealth({
        healthStatus: null,
        tasks: [
          { status: 'IN_PROGRESS', dueDate: futureDate },
          { status: 'IN_PROGRESS', dueDate: futureDate },
          { status: 'IN_PROGRESS', dueDate: futureDate },
          { status: 'IN_PROGRESS', dueDate: futureDate },
          { status: 'IN_PROGRESS', dueDate: pastDate },
        ],
      })).toBe('GREY')
    })

    it('tasks with null dueDates are never counted as overdue', () => {
      expect(computeEffectiveHealth({
        healthStatus: 'GREEN',
        tasks: [
          { status: 'IN_PROGRESS', dueDate: null },
          { status: 'IN_PROGRESS', dueDate: null },
          { status: 'IN_PROGRESS', dueDate: null },
        ],
      })).toBe('GREEN')
    })

    it('mix of null and past dueDates counts only non-null as overdue', () => {
      // 1 overdue out of 5 total = 20% (< 25% threshold, avoids RED)
      // overdueTaskCount > 0 && healthStatus === 'GREEN' → AMBER
      expect(computeEffectiveHealth({
        healthStatus: 'GREEN',
        tasks: [
          { status: 'IN_PROGRESS', dueDate: null },
          { status: 'IN_PROGRESS', dueDate: null },
          { status: 'IN_PROGRESS', dueDate: futureDate },
          { status: 'IN_PROGRESS', dueDate: futureDate },
          { status: 'IN_PROGRESS', dueDate: pastDate }, // 1 overdue
        ],
      })).toBe('AMBER') // 1 overdue + GREEN → AMBER
    })
  })

  // ── Staffing mapping with null relations ──────────────
  describe('mapStaffingEmployee null relations', () => {
    const baseProfile = {
      id: 'p1', fullName: 'Test', email: 'test@test.com',
      jobTitle: null, status: 'ACTIVE', startDate: null,
      officeId: null, orgPermission: 'MEMBER',
      office: null, corporateRole: null, employeeProfile: null,
    }

    it('all null relations produce safe defaults without crashing', () => {
      const result = mapStaffingEmployee(baseProfile)
      expect(result.office).toBeNull()
      expect(result.department).toBeNull()
      expect(result.role).toBeNull()
      expect(result.onboardingComplete).toBe(false)
      expect(result.leaveAllocation).toBe(25)
      expect(result.jobTitle).toBeNull()
    })

    it('null employeeProfile defaults leaveAllocation to 25, not NaN', () => {
      const result = mapStaffingEmployee(baseProfile)
      expect(typeof result.leaveAllocation).toBe('number')
      expect(Number.isNaN(result.leaveAllocation)).toBe(false)
      expect(result.leaveAllocation).toBe(25)
    })

    it('null employeeProfile defaults onboardingComplete to false, not undefined', () => {
      const result = mapStaffingEmployee(baseProfile)
      expect(typeof result.onboardingComplete).toBe('boolean')
      expect(result.onboardingComplete).toBe(false)
    })

    it('partial relations work — office present but corporateRole null', () => {
      const result = mapStaffingEmployee({
        ...baseProfile,
        office: { name: 'London' },
      })
      expect(result.office).toBe('London')
      expect(result.department).toBeNull()
    })
  })

  // ── Leave filtering edge cases ────────────────────────
  describe('filterLeaveRequests edge cases', () => {
    it('ACTIVE on empty array returns empty, not error', () => {
      expect(filterLeaveRequests([], 'ACTIVE')).toEqual([])
    })

    it('unknown filter value returns empty (no requests match)', () => {
      const requests = [{ status: 'DRAFT' }, { status: 'APPROVED' }]
      expect(filterLeaveRequests(requests, 'NONEXISTENT')).toEqual([])
    })

    it('ACTIVE excludes both WITHDRAWN and CANCELLED simultaneously', () => {
      const requests = [
        { status: 'APPROVED' },
        { status: 'WITHDRAWN' },
        { status: 'CANCELLED' },
        { status: 'DRAFT' },
      ]
      const result = filterLeaveRequests(requests, 'ACTIVE')
      expect(result).toHaveLength(2)
      expect(result.map(r => r.status)).toEqual(['APPROVED', 'DRAFT'])
    })
  })

  // ── Onboarding validation edge cases ──────────────────
  describe('validateOnboardingCompletion edge cases', () => {
    it('zero of everything is valid (no mandatory items)', () => {
      const result = validateOnboardingCompletion({
        totalPolicies: 0, acknowledgedPolicies: 0,
        totalTraining: 0, completedTraining: 0,
      })
      expect(result.valid).toBe(true)
      expect(result.missing).toEqual([])
    })

    it('acknowledged > total still valid (over-completed is fine)', () => {
      const result = validateOnboardingCompletion({
        totalPolicies: 3, acknowledgedPolicies: 5,
        totalTraining: 2, completedTraining: 4,
      })
      expect(result.valid).toBe(true)
    })

    it('exactly 0 acknowledged out of 1 total gives correct message', () => {
      const result = validateOnboardingCompletion({
        totalPolicies: 1, acknowledgedPolicies: 0,
        totalTraining: 0, completedTraining: 0,
      })
      expect(result.valid).toBe(false)
      expect(result.missing[0]).toBe('1 of 1 mandatory policies not acknowledged')
    })
  })

  // ── Timesheet transitions edge cases ──────────────────
  describe('timesheet transition edge cases', () => {
    it('unknown status has no valid transitions', () => {
      expect(isValidTimesheetTransition('NONEXISTENT', 'DRAFT')).toBe(false)
    })

    it('same status to same status is not a valid transition', () => {
      expect(isValidTimesheetTransition('DRAFT', 'DRAFT')).toBe(false)
      expect(isValidTimesheetTransition('APPROVED', 'APPROVED')).toBe(false)
    })

    it('all TIMESHEET_TRANSITIONS keys have at least one valid target', () => {
      for (const [from, targets] of Object.entries(TIMESHEET_TRANSITIONS)) {
        expect(targets.length).toBeGreaterThan(0)
        for (const to of targets) {
          expect(isValidTimesheetTransition(from, to)).toBe(true)
        }
      }
    })
  })
})

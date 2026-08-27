/**
 * Leave Policy Resolver
 *
 * Single source of truth for leave entitlements. Resolution order:
 * 1. Individual override (leavePolicyId on EmployeeProfile)
 * 2. Grade-based policy (matching employee's grade + leaveType)
 * 3. Org default policy (isDefault=true for that leaveType)
 *
 * If no policy is found at any level, returns null.
 */

import { modulesPrisma } from '@/lib/prisma-modules'

export interface ResolvedEntitlement {
  entitlementDays: number
  carryOverDays: number
  source: 'individual' | 'grade' | 'default'
  policyId: string
  policyName: string
}

/**
 * Resolve the leave entitlement for a specific employee, leave type, and year.
 *
 * @param organisationId - The organisation to resolve within
 * @param profileId - The employee's profile ID
 * @param leaveType - The leave type (e.g. 'ANNUAL', 'SICK')
 * @param _year - The year (reserved for future year-specific policies)
 * @returns The resolved entitlement with source, or null if no policy found
 */
export async function resolveLeaveEntitlement(
  organisationId: string,
  profileId: string,
  leaveType: string,
  _year: number,
): Promise<ResolvedEntitlement | null> {
  // 1. Load the employee profile to check for individual override and grade
  const employeeProfile = await modulesPrisma.employeeProfile.findFirst({
    where: {
      profile: {
        id: profileId,
        organisationId,
      },
    },
    select: {
      leavePolicyId: true,
      grade: true,
    },
  })

  if (!employeeProfile) {
    return null
  }

  // Step 1: Check for individual override
  if (employeeProfile.leavePolicyId) {
    const individualPolicy = await modulesPrisma.leavePolicy.findFirst({
      where: {
        id: employeeProfile.leavePolicyId,
        organisationId,
        leaveType,
      },
    })

    if (individualPolicy) {
      return {
        entitlementDays: individualPolicy.entitlementDays,
        carryOverDays: individualPolicy.carryOverDays,
        source: 'individual',
        policyId: individualPolicy.id,
        policyName: individualPolicy.name,
      }
    }
  }

  // Step 2: Check for grade-based policy
  if (employeeProfile.grade) {
    const gradePolicy = await modulesPrisma.leavePolicy.findFirst({
      where: {
        organisationId,
        leaveType,
        grade: employeeProfile.grade,
      },
      orderBy: { createdAt: 'desc' }, // Most recent matching grade policy wins
    })

    if (gradePolicy) {
      return {
        entitlementDays: gradePolicy.entitlementDays,
        carryOverDays: gradePolicy.carryOverDays,
        source: 'grade',
        policyId: gradePolicy.id,
        policyName: gradePolicy.name,
      }
    }
  }

  // Step 3: Fall back to org default
  const defaultPolicy = await modulesPrisma.leavePolicy.findFirst({
    where: {
      organisationId,
      leaveType,
      isDefault: true,
    },
  })

  if (defaultPolicy) {
    return {
      entitlementDays: defaultPolicy.entitlementDays,
      carryOverDays: defaultPolicy.carryOverDays,
      source: 'default',
      policyId: defaultPolicy.id,
      policyName: defaultPolicy.name,
    }
  }

  // No policy found at any level
  return null
}

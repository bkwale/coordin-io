import type { NextRequest } from 'next/server'
import { modulesPrisma } from '@/lib/prisma-modules'
import { success } from '@/lib/api-response'
import { withAuth } from '@/lib/with-auth'
import { requireString, optionalString, requireNumber, parseBody } from '@/lib/validation'
import { PermissionError, ValidationError, NotFoundError } from '@/lib/errors'

const LEAVE_TYPES = [
  'ANNUAL', 'SICK', 'COMPASSIONATE', 'PARENTAL', 'MATERNITY',
  'PATERNITY', 'STUDY', 'CPD_TRAINING', 'UNPAID', 'TOIL',
  'BUSINESS_TRAVEL', 'PUBLIC_HOLIDAY', 'OTHER',
] as const

function extractId(request: NextRequest): string {
  const segments = new URL(request.url).pathname.split('/')
  return segments[segments.length - 1]
}

/**
 * GET /api/leave-policies/[id] — Get a single leave policy.
 */
export const GET = withAuth(async (request: NextRequest, { profile }) => {
  const id = extractId(request)

  const policy = await modulesPrisma.leavePolicy.findFirst({
    where: {
      id,
      organisationId: profile.organisationId,
    },
  })

  if (!policy) {
    throw new NotFoundError('Leave policy not found')
  }

  return success({ policy })
})

/**
 * PATCH /api/leave-policies/[id] — Update a leave policy.
 * Requires HR, ADMIN, or OWNER permission.
 */
export const PATCH = withAuth(async (request: NextRequest, { profile }) => {
  if (!['ADMIN', 'OWNER', 'HR'].includes(profile.orgPermission)) {
    throw new PermissionError('Only administrators or HR can manage leave policies')
  }

  const id = extractId(request)
  const body = await parseBody(request)

  // Verify policy belongs to this org
  const existing = await modulesPrisma.leavePolicy.findFirst({
    where: { id, organisationId: profile.organisationId },
  })

  if (!existing) {
    throw new NotFoundError('Leave policy not found')
  }

  const data: Record<string, unknown> = {}

  if (body.name !== undefined) {
    data.name = requireString(body.name, 'Name', 200)
  }

  if (body.leaveType !== undefined) {
    const leaveType = requireString(body.leaveType, 'Leave type', 50)
    if (!LEAVE_TYPES.includes(leaveType as typeof LEAVE_TYPES[number])) {
      throw new ValidationError(`Invalid leave type: ${leaveType}`)
    }
    data.leaveType = leaveType
  }

  if (body.entitlementDays !== undefined) {
    data.entitlementDays = Math.round(
      requireNumber(body.entitlementDays, 'Entitlement days', { min: 0, max: 365 })
    )
  }

  if (body.carryOverDays !== undefined) {
    data.carryOverDays = Math.round(
      requireNumber(body.carryOverDays, 'Carry-over days', { min: 0, max: 365 })
    )
  }

  if (body.grade !== undefined) {
    data.grade = optionalString(body.grade, 'Grade', 100) ?? null
  }

  if (body.isDefault !== undefined) {
    data.isDefault = body.isDefault === true

    // If marking as default, unset other defaults for this leave type
    if (data.isDefault) {
      const leaveType = (data.leaveType as string) || existing.leaveType
      await modulesPrisma.leavePolicy.updateMany({
        where: {
          organisationId: profile.organisationId,
          leaveType,
          isDefault: true,
          id: { not: id },
        },
        data: { isDefault: false },
      })
    }
  }

  if (Object.keys(data).length === 0) {
    throw new ValidationError('No fields to update')
  }

  const policy = await modulesPrisma.leavePolicy.update({
    where: { id },
    data,
  })

  return success({ policy })
})

/**
 * DELETE /api/leave-policies/[id] — Delete a leave policy.
 * Requires HR, ADMIN, or OWNER permission.
 * Only allowed if no employees are assigned to this policy.
 */
export const DELETE = withAuth(async (request: NextRequest, { profile }) => {
  if (!['ADMIN', 'OWNER', 'HR'].includes(profile.orgPermission)) {
    throw new PermissionError('Only administrators or HR can manage leave policies')
  }

  const id = extractId(request)

  // Verify policy belongs to this org
  const existing = await modulesPrisma.leavePolicy.findFirst({
    where: { id, organisationId: profile.organisationId },
  })

  if (!existing) {
    throw new NotFoundError('Leave policy not found')
  }

  // Check if any employees are assigned to this policy
  const assignedCount = await modulesPrisma.employeeProfile.count({
    where: { leavePolicyId: id },
  })

  if (assignedCount > 0) {
    throw new ValidationError(
      `Cannot delete this policy — ${assignedCount} employee${assignedCount === 1 ? ' is' : 's are'} currently assigned to it. Reassign them first.`
    )
  }

  await modulesPrisma.leavePolicy.delete({
    where: { id },
  })

  return success({ deleted: true })
})

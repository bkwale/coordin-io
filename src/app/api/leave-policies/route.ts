import type { NextRequest } from 'next/server'
import { modulesPrisma } from '@/lib/prisma-modules'
import { success } from '@/lib/api-response'
import { withAuth } from '@/lib/with-auth'
import { requireString, optionalString, requireNumber, parseBody } from '@/lib/validation'
import { PermissionError, ValidationError } from '@/lib/errors'

const LEAVE_TYPES = [
  'ANNUAL', 'SICK', 'COMPASSIONATE', 'PARENTAL', 'MATERNITY',
  'PATERNITY', 'STUDY', 'CPD_TRAINING', 'UNPAID', 'TOIL',
  'BUSINESS_TRAVEL', 'PUBLIC_HOLIDAY', 'OTHER',
] as const

/**
 * GET /api/leave-policies — List leave policies for the organisation.
 *
 * Query params:
 *   leaveType: filter by leave type (e.g. ANNUAL)
 *   grade: filter by grade
 *   isDefault: filter by default flag ("true" or "false")
 */
export const GET = withAuth(async (request: NextRequest, { profile }) => {
  const url = new URL(request.url)
  const leaveType = url.searchParams.get('leaveType') || undefined
  const grade = url.searchParams.get('grade') || undefined
  const isDefaultParam = url.searchParams.get('isDefault')

  const where: Record<string, unknown> = {
    organisationId: profile.organisationId,
  }

  if (leaveType) {
    if (!LEAVE_TYPES.includes(leaveType as typeof LEAVE_TYPES[number])) {
      throw new ValidationError(`Invalid leave type: ${leaveType}`)
    }
    where.leaveType = leaveType
  }

  if (grade) {
    where.grade = grade
  }

  if (isDefaultParam === 'true') {
    where.isDefault = true
  } else if (isDefaultParam === 'false') {
    where.isDefault = false
  }

  const policies = await modulesPrisma.leavePolicy.findMany({
    where,
    orderBy: [{ leaveType: 'asc' }, { isDefault: 'desc' }, { name: 'asc' }],
  })

  return success({ policies })
})

/**
 * POST /api/leave-policies — Create a new leave policy.
 * Requires HR, ADMIN, or OWNER permission.
 */
export const POST = withAuth(async (request: NextRequest, { profile }) => {
  if (!['ADMIN', 'OWNER', 'HR'].includes(profile.orgPermission)) {
    throw new PermissionError('Only administrators or HR can manage leave policies')
  }

  const body = await parseBody(request)

  const name = requireString(body.name, 'Name', 200)
  const leaveType = requireString(body.leaveType, 'Leave type', 50)
  const entitlementDays = requireNumber(body.entitlementDays, 'Entitlement days', { min: 0, max: 365 })
  const carryOverDays = body.carryOverDays !== undefined && body.carryOverDays !== null
    ? requireNumber(body.carryOverDays, 'Carry-over days', { min: 0, max: 365 })
    : 0
  const grade = optionalString(body.grade, 'Grade', 100)
  const isDefault = body.isDefault === true

  if (!LEAVE_TYPES.includes(leaveType as typeof LEAVE_TYPES[number])) {
    throw new ValidationError(`Invalid leave type: ${leaveType}. Must be one of: ${LEAVE_TYPES.join(', ')}`)
  }

  // If marking as default, ensure no other default exists for this leave type
  // (or unset the existing one)
  if (isDefault) {
    await modulesPrisma.leavePolicy.updateMany({
      where: {
        organisationId: profile.organisationId,
        leaveType,
        isDefault: true,
      },
      data: { isDefault: false },
    })
  }

  const policy = await modulesPrisma.leavePolicy.create({
    data: {
      organisationId: profile.organisationId,
      name,
      leaveType,
      entitlementDays: Math.round(entitlementDays),
      carryOverDays: Math.round(carryOverDays),
      grade: grade ?? null,
      isDefault,
    },
  })

  return success({ policy }, 201)
})

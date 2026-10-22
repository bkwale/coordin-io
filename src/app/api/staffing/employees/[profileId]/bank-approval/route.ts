import { NextRequest } from 'next/server'
import { success } from '@/lib/api-response'
import { withAuth } from '@/lib/with-auth'
import { modulesPrisma } from '@/lib/prisma-modules'
import { recordAuditEvent } from '@/lib/audit'
import { requireString, optionalString, parseBody } from '@/lib/validation'
import { NotFoundError, PermissionError, ValidationError } from '@/lib/errors'
import { hasFullStaffingAccess } from '@/lib/staffing-utils'
import type { OrgPermission } from '@/generated/prisma/client'

/**
 * POST /api/staffing/employees/[profileId]/bank-approval
 *
 * Approve or reject an employee's bank details submission.
 * Only HR/Admin/Owner can perform this action.
 *
 * Body: { action: 'APPROVED' | 'REJECTED', reason?: string }
 */
export const POST = withAuth(async (request: NextRequest, { profile }) => {
  const profileId = request.url.match(/\/employees\/([^/?]+)\/bank-approval/)?.[1]
  if (!profileId) throw new NotFoundError('Employee not found')

  const hasHRAccess = hasFullStaffingAccess(profile.orgPermission as OrgPermission)
  if (!hasHRAccess) {
    throw new PermissionError('Only HR, Admin, or Owner can approve bank details')
  }

  // Verify the target exists and is in the same org
  const target = await modulesPrisma.profile.findUnique({
    where: { id: profileId },
    select: { organisationId: true, fullName: true },
  })
  if (!target) throw new NotFoundError('Employee not found')
  if (target.organisationId !== profile.organisationId) {
    throw new PermissionError('You do not have access to this employee')
  }

  const body = await parseBody(request)
  const action = requireString(body.action as unknown, 'action', 20)

  if (action !== 'APPROVED' && action !== 'REJECTED') {
    throw new ValidationError('Action must be APPROVED or REJECTED')
  }

  // Get current bank details to verify there's something to approve
  const confidential = await modulesPrisma.confidentialEmployeeData.findUnique({
    where: { profileId },
  })

  if (!confidential?.bankAccountNumber) {
    throw new ValidationError('No bank details have been submitted for this employee')
  }

  if (confidential.bankApprovalStatus !== 'PENDING') {
    throw new ValidationError(
      `Bank details are not pending approval (current status: ${confidential.bankApprovalStatus || 'none'})`
    )
  }

  const updateData: Record<string, unknown> = {
    bankApprovalStatus: action,
    bankApprovedBy: profile.id,
    bankApprovedAt: new Date(),
  }

  if (action === 'REJECTED') {
    const reason = optionalString(body.reason as unknown, 'reason', 500)
    updateData.bankRejectionReason = reason || 'No reason provided'
    // Clear verified status on rejection
    updateData.bankVerified = false
    updateData.bankVerifiedAt = null
  } else {
    updateData.bankRejectionReason = null
  }

  await modulesPrisma.confidentialEmployeeData.update({
    where: { profileId },
    data: updateData,
  })

  await recordAuditEvent({
    organisationId: profile.organisationId,
    actorId: profile.id,
    action: `staffing.bank_details_${action.toLowerCase()}`,
    entityType: 'profile',
    entityId: profileId,
    metadata: {
      employeeName: target.fullName,
      approvalAction: action,
      ...(action === 'REJECTED' ? { reason: updateData.bankRejectionReason } : {}),
    },
  })

  return success({
    approved: action === 'APPROVED',
    status: action,
    profileId,
  })
})

import { NextRequest } from 'next/server'
import { success } from '@/lib/api-response'
import { withAuth } from '@/lib/with-auth'
import { modulesPrisma } from '@/lib/prisma-modules'
import { recordAuditEvent } from '@/lib/audit'
import { NotFoundError, PermissionError } from '@/lib/errors'
import { canManageHR } from '@/lib/staffing-utils'
import { sendOnboardingEmail } from '@/lib/email'
import type { OrgPermission } from '@/generated/prisma/client'

/**
 * POST /api/staffing/employees/[profileId]/onboarding-email
 *
 * Send an onboarding reminder email to the employee.
 * Permission: HR, ADMIN, OWNER only.
 */
export const POST = withAuth(async (request: NextRequest, { profile }) => {
  // Permission check — HR+ only
  if (!canManageHR(profile.orgPermission as OrgPermission)) {
    throw new PermissionError('Only HR managers and admins can send onboarding emails')
  }

  // Extract profileId from URL
  const targetProfileId = request.url.match(/\/employees\/([^/?]+)/)?.[1]
  if (!targetProfileId) {
    throw new NotFoundError('Employee not found')
  }

  // Look up the employee
  const employee = await modulesPrisma.profile.findUnique({
    where: { id: targetProfileId },
    select: {
      id: true,
      fullName: true,
      email: true,
      organisationId: true,
      status: true,
    },
  })

  if (!employee || employee.organisationId !== profile.organisationId) {
    throw new NotFoundError('Employee not found in your organisation')
  }

  // Get org name for the email
  const org = await modulesPrisma.organisation.findUnique({
    where: { id: profile.organisationId },
    select: { name: true },
  })

  // Gather outstanding onboarding items (policies not yet acknowledged)
  const outstandingItems: string[] = []
  try {
    const policies = await modulesPrisma.policyDocument.findMany({
      where: { organisationId: profile.organisationId },
      select: { id: true, title: true },
    })

    if (policies.length > 0) {
      const acknowledged = await modulesPrisma.policyAcknowledgement.findMany({
        where: {
          profileId: targetProfileId,
          policyId: { in: policies.map((p: any) => p.id) },
        },
        select: { policyId: true },
      })
      const acknowledgedIds = new Set(acknowledged.map((a: any) => a.policyId))

      for (const policy of policies) {
        if (!acknowledgedIds.has(policy.id)) {
          outstandingItems.push(policy.title)
        }
      }
    }
  } catch {
    // If onboarding tables don't exist or query fails, proceed without items
  }

  // Send the email
  const emailResult = await sendOnboardingEmail({
    to: employee.email,
    employeeName: employee.fullName,
    organisationName: org?.name || 'your organisation',
    senderName: profile.fullName,
    outstandingItems: outstandingItems.length > 0 ? outstandingItems : undefined,
  })

  // Audit trail
  await recordAuditEvent({
    organisationId: profile.organisationId,
    actorId: profile.id,
    action: 'staffing.onboarding_email_sent',
    entityType: 'profile',
    entityId: targetProfileId,
    metadata: {
      employeeEmail: employee.email,
      employeeName: employee.fullName,
      emailSent: emailResult.success,
      emailError: emailResult.error || undefined,
      outstandingItems: outstandingItems.length,
    },
    ipAddress: request.headers.get('x-forwarded-for') || undefined,
  })

  if (!emailResult.success) {
    throw new Error(`Failed to send email: ${emailResult.error}`)
  }

  return success({
    sent: true,
    messageId: emailResult.messageId,
    outstandingItems: outstandingItems.length,
  })
})

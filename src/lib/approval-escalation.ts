import { prisma } from '@/lib/prisma'
import { createNotification, NOTIFICATION_EVENTS } from '@/lib/notifications'
import { recordAuditEvent, AuditActions } from '@/lib/audit'

/**
 * Escalation timeout checker for approval workflows.
 *
 * Finds all PENDING approval step instances where:
 * - escalationDueAt has passed
 * - The step has not already been escalated
 *
 * For each overdue step:
 * 1. Marks the step as ESCALATED
 * 2. Finds the next person in the escalation chain (the approver's manager,
 *    or falls back to any org ADMIN)
 * 3. Creates a new step instance for the escalated approver
 * 4. Sends notifications to both the original approver and the escalated-to person
 *
 * Designed to be called by a cron job (e.g., every hour).
 */
export async function processEscalations(): Promise<{
  processed: number
  escalated: number
  errors: number
}> {
  const now = new Date()

  // Find all overdue pending steps
  const overdueSteps = await prisma.approvalStepInstance.findMany({
    where: {
      status: 'PENDING',
      escalationDueAt: { lte: now },
    },
    include: {
      instance: {
        include: {
          route: { select: { name: true } },
          submitter: { select: { id: true, fullName: true } },
        },
      },
      approver: {
        select: {
          id: true,
          fullName: true,
          managerId: true,
          organisationId: true,
        },
      },
    },
  })

  let escalated = 0
  let errors = 0

  for (const step of overdueSteps) {
    try {
      // Skip if instance is no longer IN_PROGRESS
      if (step.instance.status !== 'IN_PROGRESS') continue

      // Find escalation target: the current approver's manager, or an org admin
      let escalateToId: string | null = null

      if (step.approver?.managerId) {
        escalateToId = step.approver.managerId
      }

      // Fallback: find any active ADMIN/OWNER in the org
      if (!escalateToId && step.approver?.organisationId) {
        const admin = await prisma.profile.findFirst({
          where: {
            organisationId: step.approver.organisationId,
            orgPermission: { in: ['ADMIN', 'OWNER'] },
            id: { not: step.approverId ?? undefined }, // Not the same person
          },
          select: { id: true },
        })
        escalateToId = admin?.id ?? null
      }

      if (!escalateToId) {
        // No one to escalate to — skip but log
        console.warn(`[escalation] No escalation target for step ${step.id}`)
        errors++
        continue
      }

      // Mark the step as ESCALATED and assign the new approver
      await prisma.approvalStepInstance.update({
        where: { id: step.id },
        data: {
          status: 'ESCALATED',
          escalatedToId: escalateToId,
          actionedAt: now,
        },
      })

      // Determine the next available stepOrder to avoid duplicates
      const maxStep = await prisma.approvalStepInstance.aggregate({
        where: { instanceId: step.instanceId },
        _max: { stepOrder: true },
      })
      const nextStepOrder = (maxStep._max.stepOrder ?? step.stepOrder) + 1

      // Create a new pending step for the escalated approver
      const newStep = await prisma.approvalStepInstance.create({
        data: {
          instanceId: step.instanceId,
          stepOrder: nextStepOrder,
          label: `${step.label} (escalated)`,
          approverId: escalateToId,
          status: 'PENDING',
          // Give the escalated step its own timeout (3 days default)
          escalationDueAt: step.escalationDueAt
            ? new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000)
            : null,
        },
      })

      // Update instance to point to the new escalated step
      await prisma.approvalInstance.update({
        where: { id: step.instanceId },
        data: { currentStepOrder: nextStepOrder },
      })

      // Notify the escalated-to person
      const submitterName = step.instance.submitter?.fullName ?? 'Someone'
      const routeName = step.instance.route?.name ?? 'Approval'

      await createNotification({
        profileId: escalateToId,
        type: NOTIFICATION_EVENTS.APPROVAL_ESCALATED,
        title: `Escalated: ${routeName} from ${submitterName}`,
        body: `This approval was escalated because the previous approver did not respond in time.`,
        linkUrl: `/approvals`,
      }).catch(() => {})

      // Notify the original approver that it was escalated away
      if (step.approverId) {
        await createNotification({
          profileId: step.approverId,
          type: NOTIFICATION_EVENTS.APPROVAL_ESCALATED,
          title: `Approval escalated: ${routeName}`,
          body: `Your pending approval for ${submitterName} was escalated due to timeout.`,
          linkUrl: `/approvals`,
        }).catch(() => {})
      }

      // Audit
      await recordAuditEvent({
        organisationId: step.approver?.organisationId ?? step.instance.organisationId,
        actorId: 'SYSTEM',
        action: 'approval.escalated',
        entityType: 'ApprovalStepInstance',
        entityId: step.id,
        metadata: {
          instanceId: step.instanceId,
          originalApproverId: step.approverId,
          escalatedToId: escalateToId,
          reason: 'timeout',
          newStepId: newStep.id,
        },
      })

      escalated++
    } catch (err) {
      console.error(`[escalation] Error processing step ${step.id}:`, err)
      errors++
    }
  }

  return { processed: overdueSteps.length, escalated, errors }
}

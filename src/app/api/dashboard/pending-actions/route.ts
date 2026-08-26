import type { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { success } from '@/lib/api-response'
import { withAuth } from '@/lib/with-auth'

/**
 * GET /api/dashboard/pending-actions — Returns counts and preview items
 * for pending policy acknowledgements, onboarding tasks, and approvals.
 */
export const GET = withAuth(async (_request: NextRequest, { profile }) => {
  const orgId = profile.organisationId
  const profileId = profile.id

  // ── 1. Unacknowledged policies ──────────────────────────────
  const mandatoryPolicies = await prisma.policyDocument.findMany({
    where: { organisationId: orgId, mandatory: true },
    select: {
      id: true,
      title: true,
      category: true,
      revision: true,
      acknowledgements: {
        where: { profileId, acknowledged: true },
        take: 1,
        select: { id: true },
      },
    },
    orderBy: { effectiveDate: 'asc' },
  })

  const unacknowledgedPolicies = mandatoryPolicies.filter(
    (p) => p.acknowledgements.length === 0,
  )

  const policiesCount = unacknowledgedPolicies.length
  const policiesPreview = unacknowledgedPolicies.slice(0, 3).map((p) => ({
    id: p.id,
    title: p.title,
    category: p.category,
  }))

  // ── 2. Incomplete onboarding tasks ──────────────────────────
  const onboardingAssignments = await prisma.onboardingAssignment.findMany({
    where: {
      profileId,
      organisationId: orgId,
      status: 'ACTIVE',
    },
    include: {
      tasks: {
        where: {
          status: { in: ['PENDING', 'IN_PROGRESS', 'OVERDUE'] },
        },
        select: {
          id: true,
          title: true,
          stage: true,
          status: true,
          dueDate: true,
        },
        orderBy: { sortOrder: 'asc' },
      },
    },
  })

  const incompleteTasks = onboardingAssignments.flatMap((a) => a.tasks)
  const onboardingCount = incompleteTasks.length
  const onboardingPreview = incompleteTasks.slice(0, 3).map((t) => ({
    id: t.id,
    title: t.title,
    stage: t.stage,
    status: t.status,
    dueDate: t.dueDate ? t.dueDate.toISOString() : null,
  }))

  // ── 3. Pending approvals (user is the current step approver) ─
  const pendingSteps = await prisma.approvalStepInstance.findMany({
    where: {
      approverId: profileId,
      status: 'PENDING',
      instance: {
        status: 'IN_PROGRESS',
        organisationId: orgId,
      },
    },
    include: {
      instance: {
        select: {
          id: true,
          requestType: true,
          entityId: true,
          submitter: {
            select: { id: true, fullName: true },
          },
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  })

  // Only include steps that match the current step order on the instance
  const activePendingSteps = []
  for (const step of pendingSteps) {
    const inst = await prisma.approvalInstance.findUnique({
      where: { id: step.instanceId },
      select: { currentStepOrder: true },
    })
    if (inst && step.stepOrder === inst.currentStepOrder) {
      activePendingSteps.push(step)
    }
  }

  const approvalsCount = activePendingSteps.length
  const approvalsPreview = activePendingSteps.slice(0, 3).map((s) => ({
    id: s.instance.id,
    type: s.instance.requestType,
    entityId: s.instance.entityId,
    submitterName: s.instance.submitter.fullName,
    label: s.label || s.instance.requestType.replace(/_/g, ' '),
  }))

  // ── Assemble response ───────────────────────────────────────
  const totalCount = policiesCount + onboardingCount + approvalsCount

  return success({
    totalCount,
    policies: {
      count: policiesCount,
      items: policiesPreview,
    },
    onboarding: {
      count: onboardingCount,
      items: onboardingPreview,
    },
    approvals: {
      count: approvalsCount,
      items: approvalsPreview,
    },
  })
})

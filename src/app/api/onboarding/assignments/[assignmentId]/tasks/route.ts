import { NextRequest } from 'next/server'
import { success } from '@/lib/api-response'
import { withAuth } from '@/lib/with-auth'
import { modulesPrisma } from '@/lib/prisma-modules'
import { requireString, optionalString, parseBody } from '@/lib/validation'
import { NotFoundError, PermissionError, ValidationError } from '@/lib/errors'
import { createNotification, NOTIFICATION_EVENTS } from '@/lib/notifications'

const STAGES = ['BEFORE_START', 'DAY_ONE', 'ROLE_SPECIFIC', 'PROBATION'] as const
const VALID_STATUSES = ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'OVERDUE', 'WAIVED']

/**
 * Helper to extract assignmentId from the URL.
 */
function getAssignmentId(url: string): string {
  const match = url.match(/\/assignments\/([^/]+)\/tasks/)
  return match?.[1] ?? ''
}

/**
 * Recalculate and update assignment progress.
 */
async function recalculateProgress(assignmentId: string): Promise<void> {
  const tasks = await modulesPrisma.onboardingTask.findMany({
    where: { assignmentId },
    select: { status: true },
  })

  const total = tasks.length
  const completed = tasks.filter(
    (t: { status: string }) => t.status === 'COMPLETED' || t.status === 'WAIVED'
  ).length

  const progress = total > 0 ? Math.round((completed / total) * 100) : 0
  const isComplete = total > 0 && completed === total

  await modulesPrisma.onboardingAssignment.update({
    where: { id: assignmentId },
    data: {
      progress,
      status: isComplete ? 'COMPLETED' : 'ACTIVE',
      completedAt: isComplete ? new Date() : null,
    },
  })
}

/**
 * GET /api/onboarding/assignments/[assignmentId]/tasks — List tasks grouped by stage.
 */
export const GET = withAuth(async (request: NextRequest, { profile }) => {
  const assignmentId = getAssignmentId(request.url)

  const assignment = await modulesPrisma.onboardingAssignment.findFirst({
    where: {
      id: assignmentId,
      organisationId: profile.organisationId,
    },
  })

  if (!assignment) {
    throw new NotFoundError('Assignment not found')
  }

  // Non-managers can only see their own assignment tasks
  const isManager = profile.orgPermission === 'ADMIN' || profile.orgPermission === 'OWNER' || profile.orgPermission === 'MANAGER'
  if (!isManager && assignment.profileId !== profile.id) {
    throw new PermissionError('You can only view your own onboarding tasks')
  }

  const tasks = await modulesPrisma.onboardingTask.findMany({
    where: { assignmentId },
    include: {
      templateItem: {
        select: {
          requiresEvidence: true,
          requiresApproval: true,
          responsibleRole: true,
          description: true,
        },
      },
    },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
  })

  // Look up assignee names
  const assigneeIds = [...new Set(
    tasks
      .map((t: { assigneeId: string | null }) => t.assigneeId)
      .filter((id: string | null): id is string => id !== null)
  )]
  const approverIds = [...new Set(
    tasks
      .map((t: { approvedById: string | null }) => t.approvedById)
      .filter((id: string | null): id is string => id !== null)
  )]
  const allIds = [...new Set([...assigneeIds, ...approverIds])]

  const people = allIds.length > 0
    ? await modulesPrisma.profile.findMany({
        where: { id: { in: allIds } },
        select: { id: true, fullName: true },
      })
    : []
  const peopleMap = new Map(people.map((p: { id: string; fullName: string }) => [p.id, p.fullName]))

  // Group by stage
  const groupedTasks: Record<string, unknown[]> = {}
  for (const stage of STAGES) {
    groupedTasks[stage] = []
  }

  for (const task of tasks as Array<{
    id: string
    stage: string
    title: string
    category: string | null
    status: string
    dueDate: Date | null
    assigneeId: string | null
    completedAt: Date | null
    completedById: string | null
    evidenceUrl: string | null
    evidenceNote: string | null
    approvedById: string | null
    approvedAt: Date | null
    comment: string | null
    sortOrder: number
    templateItem: {
      requiresEvidence: boolean
      requiresApproval: boolean
      responsibleRole: string | null
      description: string | null
    }
  }>) {
    const stageBucket = groupedTasks[task.stage] ?? (groupedTasks[task.stage] = [])
    stageBucket.push({
      id: task.id,
      title: task.title,
      category: task.category ?? 'Not provided',
      stage: task.stage,
      status: task.status,
      dueDate: task.dueDate,
      assigneeId: task.assigneeId,
      assigneeName: task.assigneeId ? (peopleMap.get(task.assigneeId) ?? 'Not provided') : 'Not provided',
      completedAt: task.completedAt,
      evidenceUrl: task.evidenceUrl ?? 'Not provided',
      evidenceNote: task.evidenceNote ?? 'Not provided',
      approvedById: task.approvedById,
      approvedByName: task.approvedById ? (peopleMap.get(task.approvedById) ?? 'Not provided') : 'Not provided',
      approvedAt: task.approvedAt,
      comment: task.comment ?? 'Not provided',
      responsibleRole: task.templateItem?.responsibleRole ?? 'Not provided',
      requiresEvidence: task.templateItem?.requiresEvidence ?? false,
      requiresApproval: task.templateItem?.requiresApproval ?? false,
      description: task.templateItem?.description ?? 'Not provided',
    })
  }

  return success({ tasks: groupedTasks, assignment })
})

/**
 * PATCH /api/onboarding/assignments/[assignmentId]/tasks — Update task status.
 *
 * Allows: complete, add evidence, approve, change status.
 * Recalculates assignment progress after each update.
 */
export const PATCH = withAuth(async (request: NextRequest, { profile }) => {
  const assignmentId = getAssignmentId(request.url)

  const assignment = await modulesPrisma.onboardingAssignment.findFirst({
    where: {
      id: assignmentId,
      organisationId: profile.organisationId,
    },
  })
  if (!assignment) {
    throw new NotFoundError('Assignment not found')
  }

  const isManager = profile.orgPermission === 'ADMIN' || profile.orgPermission === 'OWNER' || profile.orgPermission === 'MANAGER'
  const isOwnAssignment = assignment.profileId === profile.id

  if (!isManager && !isOwnAssignment) {
    throw new PermissionError('You can only update your own onboarding tasks')
  }

  const body = await parseBody(request)
  const taskId = requireString(body.taskId, 'taskId')

  const task = await modulesPrisma.onboardingTask.findFirst({
    where: { id: taskId, assignmentId },
    include: {
      templateItem: {
        select: { requiresEvidence: true, requiresApproval: true },
      },
    },
  })
  if (!task) {
    throw new NotFoundError('Task not found')
  }

  const updateData: Record<string, unknown> = {}

  // Status change
  if (body.status !== undefined) {
    const newStatus = requireString(body.status, 'status', 50)
    if (!VALID_STATUSES.includes(newStatus)) {
      throw new ValidationError(`status must be one of: ${VALID_STATUSES.join(', ')}`)
    }

    // Employees can only mark as IN_PROGRESS or COMPLETED
    if (!isManager && !['IN_PROGRESS', 'COMPLETED'].includes(newStatus)) {
      throw new PermissionError('You can only start or complete your own tasks')
    }

    // If completing, check evidence requirement
    if (newStatus === 'COMPLETED' && task.templateItem?.requiresEvidence) {
      const hasEvidence = task.evidenceUrl || body.evidenceUrl
      if (!hasEvidence) {
        throw new ValidationError('This task requires evidence before it can be completed')
      }
    }

    updateData.status = newStatus

    if (newStatus === 'COMPLETED') {
      updateData.completedAt = new Date()
      updateData.completedById = profile.id
    } else if (newStatus === 'PENDING' || newStatus === 'IN_PROGRESS') {
      updateData.completedAt = null
      updateData.completedById = null
    }
  }

  // Evidence
  if (body.evidenceUrl !== undefined) {
    updateData.evidenceUrl = optionalString(body.evidenceUrl, 'evidenceUrl', 2000) ?? null
  }
  if (body.evidenceNote !== undefined) {
    updateData.evidenceNote = optionalString(body.evidenceNote, 'evidenceNote', 2000) ?? null
  }

  // Comment
  if (body.comment !== undefined) {
    updateData.comment = optionalString(body.comment, 'comment', 2000) ?? null
  }

  // Approval (managers/admins only)
  if (body.approved === true) {
    if (!isManager) {
      throw new PermissionError('Only managers can approve tasks')
    }
    updateData.approvedById = profile.id
    updateData.approvedAt = new Date()
  }

  const updated = await modulesPrisma.onboardingTask.update({
    where: { id: taskId },
    data: updateData,
  })

  // Recalculate assignment progress
  await recalculateProgress(assignmentId)

  // Notify employee if task was approved
  if (body.approved === true && assignment.profileId !== profile.id) {
    await createNotification({
      profileId: assignment.profileId,
      type: NOTIFICATION_EVENTS.ONBOARDING_TASK_ASSIGNED,
      title: 'Onboarding task approved',
      body: `Your task "${task.title}" has been approved.`,
      linkUrl: '/onboarding',
    })
  }

  // Notify if assignment is now complete
  const updatedAssignment = await modulesPrisma.onboardingAssignment.findUnique({
    where: { id: assignmentId },
    select: { status: true, progress: true },
  })

  return success({ task: updated, assignment: updatedAssignment })
})

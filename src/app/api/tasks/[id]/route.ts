import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { recordAuditEvent, AuditActions } from '@/lib/audit'
import { success } from '@/lib/api-response'
import { PermissionError } from '@/lib/errors'
import { validateTaskTransition, isReviewerTransition } from '@/lib/task-transitions'
import { withTaskAccess } from '@/lib/with-task-access'
import { optionalString, optionalId, optionalEnum, optionalDate, optionalNumber, parseBody } from '@/lib/validation'
import type { TaskStatus } from '@/generated/prisma/client'

/**
 * GET /api/tasks/[id] — Task detail with checklist, comments, and relations.
 */
export const GET = withTaskAccess(async (_request: NextRequest, { taskId }) => {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: {
      owner: { select: { id: true, fullName: true } },
      reviewer: { select: { id: true, fullName: true } },
      project: { select: { id: true, name: true } },
      checklistItems: { orderBy: { sortOrder: 'asc' } },
      comments: {
        orderBy: { createdAt: 'asc' },
        include: {
          author: { select: { id: true, fullName: true } },
        },
      },
    },
  })

  return success({ task })
})

/**
 * PATCH /api/tasks/[id] — Update task fields, including status transitions.
 */
export const PATCH = withTaskAccess(async (request: NextRequest, { task: currentTask, taskId, profile }) => {
  const body = await parseBody(request)

  // Validate and build update data
  const data: Record<string, unknown> = {}

  if ('title' in body) data.title = optionalString(body.title, 'Title', 500)
  if ('description' in body) data.description = optionalString(body.description, 'Description', 5000)
  if ('instructions' in body) data.instructions = optionalString(body.instructions, 'Instructions', 5000)
  if ('stage' in body) data.stage = optionalString(body.stage, 'Stage', 100)
  if ('discipline' in body) data.discipline = optionalString(body.discipline, 'Discipline', 100)
  if ('block' in body) data.block = optionalString(body.block, 'Block', 100)
  if ('floor' in body) data.floor = optionalString(body.floor, 'Floor', 100)
  if ('priority' in body) data.priority = optionalEnum(body.priority, 'Priority', ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const)
  if ('dueDate' in body) data.dueDate = optionalDate(body.dueDate, 'Due date')
  if ('estimatedHours' in body) data.estimatedHours = optionalNumber(body.estimatedHours, 'Estimated hours', { min: 0, max: 10000 })

  // Validate IDs
  const ownerId = 'ownerId' in body ? optionalId(body.ownerId, 'Owner ID') : undefined
  const reviewerId = 'reviewerId' in body ? optionalId(body.reviewerId, 'Reviewer ID') : undefined
  const status = optionalEnum(body.status, 'Status', ['NOT_STARTED', 'IN_PROGRESS', 'READY_FOR_REVIEW', 'COMPLETED', 'BLOCKED', 'CHANGES_REQUIRED'] as const)

  // Validate status transition if changing status
  if (status && status !== currentTask.status) {
    validateTaskTransition(currentTask.status as TaskStatus, status as TaskStatus)

    // Reviewer transitions require the current user to be the task's reviewer
    if (isReviewerTransition(status as TaskStatus)) {
      if (currentTask.reviewerId !== profile.id) {
        throw new PermissionError('Only the assigned reviewer can complete or request changes')
      }
    }
  }

  // Validate ownerId / reviewerId are project members if provided
  if (ownerId) {
    const ownerMembership = await prisma.projectMembership.findUnique({
      where: { projectId_profileId: { projectId: currentTask.projectId, profileId: ownerId } },
    })
    if (!ownerMembership || ownerMembership.removedAt !== null) {
      throw new PermissionError('Owner must be a member of this project')
    }
  }

  if (reviewerId) {
    const reviewerMembership = await prisma.projectMembership.findUnique({
      where: { projectId_profileId: { projectId: currentTask.projectId, profileId: reviewerId } },
    })
    if (!reviewerMembership || reviewerMembership.removedAt !== null) {
      throw new PermissionError('Reviewer must be a member of this project')
    }
  }

  if (ownerId !== undefined) data.ownerId = ownerId
  if (reviewerId !== undefined) data.reviewerId = reviewerId
  if (status) {
    data.status = status
    if (status === 'COMPLETED') {
      data.completedAt = new Date()
    }
  }

  const task = await prisma.task.update({
    where: { id: taskId },
    data,
    include: {
      owner: { select: { id: true, fullName: true } },
      reviewer: { select: { id: true, fullName: true } },
    },
  })

  // Audit: status change
  if (status && status !== currentTask.status) {
    await recordAuditEvent({
      organisationId: profile.organisationId,
      actorId: profile.id,
      action: AuditActions.TASK_STATUS_CHANGED,
      entityType: 'task',
      entityId: task.id,
      metadata: { from: currentTask.status, to: status },
      ipAddress: request.headers.get('x-forwarded-for') || undefined,
    })
  }

  // Audit: assignment change
  if (ownerId !== undefined || reviewerId !== undefined) {
    await recordAuditEvent({
      organisationId: profile.organisationId,
      actorId: profile.id,
      action: AuditActions.TASK_ASSIGNED,
      entityType: 'task',
      entityId: task.id,
      metadata: {
        ...(ownerId !== undefined ? { ownerId } : {}),
        ...(reviewerId !== undefined ? { reviewerId } : {}),
      },
      ipAddress: request.headers.get('x-forwarded-for') || undefined,
    })
  }

  return success({ task })
})

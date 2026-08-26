import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { recordAuditEvent, AuditActions } from '@/lib/audit'
import { success } from '@/lib/api-response'
import { PermissionError, ValidationError } from '@/lib/errors'
import { createNotification, NOTIFICATION_EVENTS } from '@/lib/notifications'
import { validateTaskTransition, isReviewerTransition } from '@/lib/task-transitions'
import { withTaskAccess } from '@/lib/with-task-access'
import { canPerform } from '@/lib/role-permissions'
import { optionalString, optionalId, optionalEnum, optionalDate, optionalNumber, parseBody } from '@/lib/validation'
import type { TaskStatus } from '@/generated/prisma/client'

/**
 * GET /api/tasks/[id] — Task detail with checklist, comments, dependencies, and relations.
 */
export const GET = withTaskAccess(async (_request: NextRequest, { taskId }) => {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: {
      owner: { select: { id: true, fullName: true } },
      reviewer: { select: { id: true, fullName: true } },
      project: { select: { id: true, name: true, code: true } },
      milestone: { select: { id: true, title: true, status: true, dueDate: true } },
      checklistItems: {
        orderBy: { sortOrder: 'asc' },
        include: { assignee: { select: { id: true, fullName: true } } },
      },
      comments: {
        orderBy: { createdAt: 'asc' },
        include: {
          author: { select: { id: true, fullName: true } },
        },
      },
      dependsOn: {
        include: { dependsOn: { select: { id: true, title: true, status: true } } },
      },
      dependedOnBy: {
        include: { task: { select: { id: true, title: true, status: true } } },
      },
    },
  })

  // Compute stable task number within its project
  if (task) {
    const taskPosition = await prisma.task.count({
      where: {
        projectId: task.projectId,
        OR: [
          { createdAt: { lt: task.createdAt } },
          { createdAt: task.createdAt, id: { lt: task.id } },
        ],
      },
    })
    const prefix = task.project.code || 'T'
    const taskNumber = `${prefix}-${String(taskPosition + 1).padStart(3, '0')}`
    return success({ task: { ...task, taskNumber } })
  }

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
  if ('attachments' in body) data.attachments = typeof body.attachments === 'string' ? body.attachments : (body.attachments ? JSON.stringify(body.attachments) : null)
  if ('deliverable' in body) data.deliverable = optionalString(body.deliverable, 'Deliverable', 500)
  if ('sharepointUrl' in body) data.sharepointUrl = optionalString(body.sharepointUrl, 'SharePoint URL', 2000)

  // Validate IDs
  const ownerId = 'ownerId' in body ? optionalId(body.ownerId, 'Owner ID') : undefined
  const reviewerId = 'reviewerId' in body ? optionalId(body.reviewerId, 'Reviewer ID') : undefined
  const milestoneId = 'milestoneId' in body ? optionalId(body.milestoneId, 'Milestone ID') : undefined
  const status = optionalEnum(body.status, 'Status', ['NOT_STARTED', 'IN_PROGRESS', 'READY_FOR_REVIEW', 'COMPLETED', 'BLOCKED', 'CHANGES_REQUIRED'] as const)

  // Validate status transition if changing status
  if (status && status !== currentTask.status) {
    validateTaskTransition(currentTask.status as TaskStatus, status as TaskStatus)

    // Moving to READY_FOR_REVIEW requires a reviewer to be assigned
    if (status === 'READY_FOR_REVIEW') {
      const effectiveReviewerId = reviewerId !== undefined ? reviewerId : currentTask.reviewerId
      if (!effectiveReviewerId) {
        throw new ValidationError('A reviewer must be assigned before submitting for review')
      }
    }

    // Reviewer transitions require the current user to be the task's reviewer
    if (isReviewerTransition(status as TaskStatus)) {
      if (currentTask.reviewerId !== profile.id) {
        throw new PermissionError('Only the assigned reviewer can complete or request changes')
      }
    }
  }

  // Ensure ownerId / reviewerId are project members — auto-add if not
  for (const assigneeId of [ownerId, reviewerId].filter(Boolean) as string[]) {
    const membership = await prisma.projectMembership.findUnique({
      where: { projectId_profileId: { projectId: currentTask.projectId, profileId: assigneeId } },
    })
    if (!membership) {
      await prisma.projectMembership.create({
        data: { projectId: currentTask.projectId, profileId: assigneeId },
      })
    } else if (membership.removedAt !== null) {
      await prisma.projectMembership.update({
        where: { id: membership.id },
        data: { removedAt: null },
      })
    }
  }

  if (ownerId !== undefined) data.ownerId = ownerId
  if (reviewerId !== undefined) data.reviewerId = reviewerId
  if (milestoneId !== undefined) data.milestoneId = milestoneId
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

  // ── Notifications ──
  if (ownerId && ownerId !== profile.id) {
    await createNotification({
      profileId: ownerId,
      type: NOTIFICATION_EVENTS.TASK_ASSIGNED,
      title: `You were assigned a task: ${task.title}`,
      linkUrl: `/projects/${currentTask.projectId}/tasks/${task.id}`,
    }).catch(() => {})
  }
  if (reviewerId && reviewerId !== profile.id) {
    await createNotification({
      profileId: reviewerId,
      type: NOTIFICATION_EVENTS.TASK_ASSIGNED,
      title: `You were assigned as reviewer: ${task.title}`,
      linkUrl: `/projects/${currentTask.projectId}/tasks/${task.id}`,
    }).catch(() => {})
  }
  if (status && status !== currentTask.status) {
    if (status === 'READY_FOR_REVIEW' && currentTask.reviewerId) {
      await createNotification({
        profileId: currentTask.reviewerId,
        type: NOTIFICATION_EVENTS.TASK_STATUS_CHANGED,
        title: `Task ready for review: ${task.title}`,
        linkUrl: `/projects/${currentTask.projectId}/tasks/${task.id}`,
      }).catch(() => {})
    }
    if ((status === 'COMPLETED' || status === 'CHANGES_REQUIRED') && currentTask.ownerId && currentTask.ownerId !== profile.id) {
      await createNotification({
        profileId: currentTask.ownerId,
        type: NOTIFICATION_EVENTS.TASK_STATUS_CHANGED,
        title: `Task ${status === 'COMPLETED' ? 'completed' : 'needs changes'}: ${task.title}`,
        linkUrl: `/projects/${currentTask.projectId}/tasks/${task.id}`,
      }).catch(() => {})
    }
  }

  return success({ task })
})

/**
 * DELETE /api/tasks/[id] — Soft-delete (archive) a task.
 * Sets archivedAt timestamp. Only MANAGER+ or task owner can archive.
 */
export const DELETE = withTaskAccess(async (request: NextRequest, { task: currentTask, taskId, profile }) => {
  // Only task owner, project manager, or MANAGER+ can archive
  const isOwner = currentTask.ownerId === profile.id
  const isManager = canPerform(profile.orgPermission, 'tasks', 'create_edit_project')

  if (!isOwner && !isManager) {
    throw new PermissionError('Only the task owner or a manager can archive tasks')
  }

  if (currentTask.archivedAt) {
    throw new ValidationError('Task is already archived')
  }

  const task = await prisma.task.update({
    where: { id: taskId },
    data: { archivedAt: new Date() },
  })

  await recordAuditEvent({
    organisationId: profile.organisationId,
    actorId: profile.id,
    action: AuditActions.TASK_STATUS_CHANGED,
    entityType: 'task',
    entityId: task.id,
    metadata: { action: 'archived' },
    ipAddress: request.headers.get('x-forwarded-for') || undefined,
  })

  return success({ task })
})

import type { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { success } from '@/lib/api-response'
import { withProjectAccess } from '@/lib/with-project-access'
import { NotFoundError } from '@/lib/errors'
import { optionalString, optionalEnum, optionalDate, optionalId, parseBody } from '@/lib/validation'
import { recordAuditEvent, AuditActions } from '@/lib/audit'
import { createNotification, NOTIFICATION_EVENTS } from '@/lib/notifications'
import {
  calculateMilestoneStatus,
  buildMilestoneTaskSummary,
  type TaskStatusForCalc,
} from '@/lib/milestone-status'

/** Extract milestoneId from the URL path. */
function extractMilestoneId(url: string): string {
  const segments = new URL(url).pathname.split('/')
  const idx = segments.indexOf('milestones')
  const id = idx >= 0 ? segments[idx + 1] : undefined
  if (!id) throw new NotFoundError('Milestone ID is required')
  return id
}

/**
 * GET /api/projects/[id]/milestones/[milestoneId] — Milestone detail with
 * linked tasks and calculated status.
 */
export const GET = withProjectAccess(async (request: NextRequest, { projectId }) => {
  const milestoneId = extractMilestoneId(request.url)

  const milestone = await prisma.projectMilestone.findFirst({
    where: { id: milestoneId, projectId },
    include: {
      tasks: {
        where: { archivedAt: null },
        select: {
          id: true,
          title: true,
          status: true,
          priority: true,
          dueDate: true,
          owner: { select: { id: true, fullName: true } },
        },
        orderBy: { createdAt: 'asc' },
      },
    },
  })

  if (!milestone) throw new NotFoundError('Milestone not found')

  const taskStatuses = milestone.tasks.map((t) => t.status as TaskStatusForCalc)
  const calculatedStatus = calculateMilestoneStatus({
    currentStatus: milestone.status,
    dueDate: milestone.dueDate,
    taskStatuses,
  })
  const taskSummary = buildMilestoneTaskSummary(taskStatuses)

  return success({
    milestone: {
      ...milestone,
      status: calculatedStatus,
      storedStatus: milestone.status,
      taskSummary,
    },
  })
})

/**
 * PATCH /api/projects/[id]/milestones/[milestoneId] — Update a milestone.
 * Supports manual status override. Requires PROJECT_LEAD+.
 */
export const PATCH = withProjectAccess(async (request: NextRequest, { projectId, profile }) => {
  const milestoneId = extractMilestoneId(request.url)
  const body = await parseBody(request)

  // Verify milestone belongs to this project
  const existing = await prisma.projectMilestone.findFirst({
    where: { id: milestoneId, projectId },
  })
  if (!existing) throw new NotFoundError('Milestone not found')

  // Build update data — use 'in body' checks to distinguish "not sent" from "sent as null"
  const data: Record<string, unknown> = {}

  if ('title' in body) {
    const title = optionalString(body.title, 'Title', 200)
    if (title !== null) data.title = title
  }
  if ('description' in body) data.description = optionalString(body.description, 'Description', 2000)
  if ('status' in body) {
    const status = optionalEnum(body.status, 'Status', [
      'UPCOMING', 'DUE', 'OVERDUE', 'COMPLETED', 'CANCELLED',
    ] as const)
    if (status !== undefined) data.status = status
  }
  if ('completedDate' in body) data.completedDate = optionalDate(body.completedDate, 'Completed date')
  if ('dueDate' in body) {
    const dueDate = optionalDate(body.dueDate, 'Due date')
    if (dueDate !== null) data.dueDate = dueDate
  }
  if ('category' in body) {
    const category = optionalEnum(body.category, 'Category', [
      'DESIGN_FREEZE', 'PLANNING', 'CONSTRUCTION', 'OPERATOR_REVIEW',
      'STAGE_GATE', 'HANDOVER', 'CUSTOM',
    ] as const)
    data.category = category ?? null
  }
  if ('stage' in body) data.stage = optionalString(body.stage, 'Stage', 100)
  if ('ownerId' in body) data.ownerId = optionalId(body.ownerId, 'Owner ID')

  const status = data.status as string | undefined

  // Auto-set completedDate when status changes to COMPLETED
  if (status === 'COMPLETED' && !data.completedDate) {
    data.completedDate = new Date()
  }

  // Clear completedDate when moving away from COMPLETED
  if (status && status !== 'COMPLETED' && existing.status === 'COMPLETED') {
    data.completedDate = null
  }

  const milestone = await prisma.projectMilestone.update({
    where: { id: milestoneId },
    data,
  })

  await recordAuditEvent({
    organisationId: profile.organisationId,
    actorId: profile.id,
    action: AuditActions.PROJECT_UPDATED,
    entityType: 'ProjectMilestone',
    entityId: milestoneId,
    metadata: { action: 'milestone_updated', updatedFields: Object.keys(data) },
  })

  // When status changes to OVERDUE, notify project leads
  if (status === 'OVERDUE' && existing.status !== 'OVERDUE') {
    const leads = await prisma.projectMembership.findMany({
      where: {
        projectId,
        removedAt: null,
        projectRole: { in: ['PROJECT_LEAD', 'SENIOR_ARCHITECT'] },
      },
      select: { profileId: true },
    })

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { name: true },
    })

    for (const lead of leads) {
      await createNotification({
        profileId: lead.profileId,
        type: NOTIFICATION_EVENTS.PROJECT_MILESTONE_DUE,
        title: `Milestone delayed: ${milestone.title}`,
        body: `The milestone "${milestone.title}" on ${project?.name ?? 'project'} is now overdue.`,
        linkUrl: `/projects/${projectId}`,
      })
    }
  }

  return success({ milestone })
}, { minProjectRole: 'PROJECT_LEAD' })

/**
 * DELETE /api/projects/[id]/milestones/[milestoneId] — Remove a milestone.
 * Unlinks tasks (sets milestoneId=null) before deleting. Requires PROJECT_LEAD+.
 */
export const DELETE = withProjectAccess(async (request: NextRequest, { projectId, profile }) => {
  const milestoneId = extractMilestoneId(request.url)

  // Verify milestone belongs to this project
  const existing = await prisma.projectMilestone.findFirst({
    where: { id: milestoneId, projectId },
  })
  if (!existing) throw new NotFoundError('Milestone not found')

  // Unlink tasks + delete in a single transaction
  await prisma.$transaction([
    prisma.task.updateMany({
      where: { milestoneId },
      data: { milestoneId: null },
    }),
    prisma.projectMilestone.delete({
      where: { id: milestoneId },
    }),
  ])

  await recordAuditEvent({
    organisationId: profile.organisationId,
    actorId: profile.id,
    action: AuditActions.PROJECT_UPDATED,
    entityType: 'ProjectMilestone',
    entityId: milestoneId,
    metadata: { action: 'milestone_deleted', title: existing.title },
  })

  return success({ deleted: true })
}, { minProjectRole: 'PROJECT_LEAD' })

import type { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { success } from '@/lib/api-response'
import { withProjectAccess } from '@/lib/with-project-access'
import { NotFoundError } from '@/lib/errors'
import { optionalString, optionalEnum, optionalDate, parseBody } from '@/lib/validation'
import { createNotification, NOTIFICATION_EVENTS } from '@/lib/notifications'

/** Extract milestoneId from the URL path. */
function extractMilestoneId(url: string): string {
  const segments = new URL(url).pathname.split('/')
  const idx = segments.indexOf('milestones')
  const id = idx >= 0 ? segments[idx + 1] : undefined
  if (!id) throw new NotFoundError('Milestone ID is required')
  return id
}

/**
 * PATCH /api/projects/[id]/milestones/[milestoneId] — Update a milestone.
 * Requires PROJECT_LEAD+ role.
 */
export const PATCH = withProjectAccess(async (request: NextRequest, { projectId }) => {
  const milestoneId = extractMilestoneId(request.url)
  const body = await parseBody(request)

  // Verify milestone belongs to this project
  const existing = await prisma.projectMilestone.findFirst({
    where: { id: milestoneId, projectId },
  })
  if (!existing) throw new NotFoundError('Milestone not found')

  const title = optionalString(body.title, 'Title', 200)
  const description = optionalString(body.description, 'Description', 2000)
  const status = optionalEnum(body.status, 'Status', [
    'UPCOMING', 'DUE', 'OVERDUE', 'COMPLETED', 'CANCELLED',
  ] as const)
  const completedDate = optionalDate(body.completedDate, 'Completed date')
  const dueDate = optionalDate(body.dueDate, 'Due date')
  const category = optionalEnum(body.category, 'Category', [
    'DESIGN_FREEZE', 'PLANNING', 'CONSTRUCTION', 'OPERATOR_REVIEW',
    'STAGE_GATE', 'HANDOVER', 'CUSTOM',
  ] as const)

  // Build update data, skipping undefined fields
  const data: Record<string, unknown> = {}
  if (title !== null) data.title = title
  if (description !== null) data.description = description
  if (status !== undefined) data.status = status
  if (completedDate !== null) data.completedDate = completedDate
  if (dueDate !== null) data.dueDate = dueDate
  if (category !== undefined) data.category = category

  // Auto-set completedDate when status changes to COMPLETED
  if (status === 'COMPLETED' && !completedDate) {
    data.completedDate = new Date()
  }

  const milestone = await prisma.projectMilestone.update({
    where: { id: milestoneId },
    data,
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
 * Requires PROJECT_LEAD+ role.
 */
export const DELETE = withProjectAccess(async (request: NextRequest, { projectId }) => {
  const milestoneId = extractMilestoneId(request.url)

  // Verify milestone belongs to this project
  const existing = await prisma.projectMilestone.findFirst({
    where: { id: milestoneId, projectId },
  })
  if (!existing) throw new NotFoundError('Milestone not found')

  await prisma.projectMilestone.delete({
    where: { id: milestoneId },
  })

  return success({ deleted: true })
}, { minProjectRole: 'PROJECT_LEAD' })

import type { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { success } from '@/lib/api-response'
import { withProjectAccess } from '@/lib/with-project-access'
import { recordAuditEvent, AuditActions } from '@/lib/audit'
import { requireString, optionalString, optionalEnum, optionalId, requireDate, parseBody } from '@/lib/validation'
import {
  calculateMilestoneStatus,
  buildMilestoneTaskSummary,
  type TaskStatusForCalc,
} from '@/lib/milestone-status'

/**
 * GET /api/projects/[id]/milestones — List milestones with calculated status
 * and task progress summaries.
 */
export const GET = withProjectAccess(async (_request: NextRequest, { projectId }) => {
  const milestones = await prisma.projectMilestone.findMany({
    where: { projectId },
    include: {
      tasks: {
        where: { archivedAt: null },
        select: { id: true, title: true, status: true },
      },
    },
    orderBy: [{ sortOrder: 'asc' }, { dueDate: 'asc' }],
  })

  // Enrich each milestone with calculated status and task summary
  const enriched = milestones.map((m) => {
    const taskStatuses = m.tasks.map((t) => t.status as TaskStatusForCalc)
    const calculatedStatus = calculateMilestoneStatus({
      currentStatus: m.status,
      dueDate: m.dueDate,
      taskStatuses,
    })
    const taskSummary = buildMilestoneTaskSummary(taskStatuses)

    return {
      id: m.id,
      projectId: m.projectId,
      title: m.title,
      description: m.description,
      category: m.category,
      dueDate: m.dueDate,
      completedDate: m.completedDate,
      status: calculatedStatus,
      storedStatus: m.status,
      ownerId: m.ownerId,
      stage: m.stage,
      sortOrder: m.sortOrder,
      createdAt: m.createdAt,
      updatedAt: m.updatedAt,
      tasks: m.tasks,
      taskSummary,
    }
  })

  return success({ milestones: enriched })
})

/**
 * POST /api/projects/[id]/milestones — Create a new milestone.
 * Requires PROJECT_LEAD+ role.
 */
export const POST = withProjectAccess(async (request: NextRequest, { projectId, profile }) => {
  const body = await parseBody(request)

  const title = requireString(body.title, 'Title', 200)
  const description = optionalString(body.description, 'Description', 2000)
  const dueDate = requireDate(body.dueDate, 'Due date')
  const category = optionalEnum(body.category, 'Category', [
    'DESIGN_FREEZE', 'PLANNING', 'CONSTRUCTION', 'OPERATOR_REVIEW',
    'STAGE_GATE', 'HANDOVER', 'CUSTOM',
  ] as const)
  const stage = optionalString(body.stage, 'Stage', 100)
  const ownerId = optionalId(body.ownerId, 'Owner ID')

  // Determine sort order — place at end
  const lastMilestone = await prisma.projectMilestone.findFirst({
    where: { projectId },
    orderBy: { sortOrder: 'desc' },
    select: { sortOrder: true },
  })

  const milestone = await prisma.projectMilestone.create({
    data: {
      projectId,
      title,
      description,
      dueDate,
      category: category ?? null,
      stage: stage ?? undefined,
      ownerId: ownerId ?? undefined,
      sortOrder: (lastMilestone?.sortOrder ?? 0) + 1,
    },
  })

  await recordAuditEvent({
    organisationId: profile.organisationId,
    actorId: profile.id,
    action: AuditActions.PROJECT_UPDATED,
    entityType: 'ProjectMilestone',
    entityId: milestone.id,
    metadata: { action: 'milestone_created', title },
  })

  return success({ milestone }, 201)
}, { minProjectRole: 'PROJECT_LEAD' })

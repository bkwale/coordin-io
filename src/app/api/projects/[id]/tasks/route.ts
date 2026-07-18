import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { recordAuditEvent, AuditActions } from '@/lib/audit'
import { success } from '@/lib/api-response'
import { withProjectAccess } from '@/lib/with-project-access'
import { requireString, optionalString, optionalId, optionalEnum, optionalDate, optionalNumber, parseBody } from '@/lib/validation'

/**
 * GET /api/projects/[id]/tasks — List tasks for a project.
 *
 * By default returns tasks assigned to the current user (as owner or reviewer).
 * Pass ?all=true to see all project tasks (any member can use this).
 */
export const GET = withProjectAccess(async (request: NextRequest, { profile, projectId }) => {
  const url = new URL(request.url)
  const showAll = url.searchParams.get('all') === 'true'

  const where = showAll
    ? { projectId }
    : {
        projectId,
        OR: [
          { ownerId: profile.id },
          { reviewerId: profile.id },
        ],
      }

  const tasks = await prisma.task.findMany({
    where,
    include: {
      owner: { select: { id: true, fullName: true } },
      reviewer: { select: { id: true, fullName: true } },
      checklistItems: { select: { id: true, completed: true } },
    },
    orderBy: [
      { priority: 'desc' },
      { dueDate: 'asc' },
    ],
  })

  // Shape checklist counts for the response
  const shaped = tasks.map(({ checklistItems, ...task }) => ({
    ...task,
    checklist: {
      total: checklistItems.length,
      completed: checklistItems.filter((item) => item.completed).length,
    },
  }))

  return success({ tasks: shaped })
})

/**
 * POST /api/projects/[id]/tasks — Create a new task.
 * Any project member can create tasks.
 */
export const POST = withProjectAccess(async (request: NextRequest, { profile, projectId }) => {
  const body = await parseBody(request)

  const title = requireString(body.title, 'Title', 500)
  const description = optionalString(body.description, 'Description', 5000)
  const instructions = optionalString(body.instructions, 'Instructions', 5000)
  const ownerId = optionalId(body.ownerId, 'Owner ID')
  const reviewerId = optionalId(body.reviewerId, 'Reviewer ID')
  const stage = optionalEnum(body.stage, 'Stage', ['BRIEF', 'CONCEPT', 'SPATIAL_COORDINATION', 'WORKING_DRAWINGS', 'CONSTRUCTION', 'HANDOVER', 'OPERATIONS'] as const)
  const discipline = optionalString(body.discipline, 'Discipline', 100)
  const block = optionalString(body.block, 'Block', 100)
  const floor = optionalString(body.floor, 'Floor', 100)
  const priority = optionalEnum(body.priority, 'Priority', ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const)
  const dueDate = optionalDate(body.dueDate, 'Due date')
  const estimatedHours = optionalNumber(body.estimatedHours, 'Estimated hours', { min: 0, max: 10000 })

  const task = await prisma.task.create({
    data: {
      projectId,
      title,
      description,
      instructions,
      ownerId,
      reviewerId,
      stage: stage || null,
      discipline: discipline || null,
      block: block || null,
      floor: floor || null,
      priority: priority || 'MEDIUM',
      dueDate,
      estimatedHours,
    },
    include: {
      owner: { select: { id: true, fullName: true } },
      reviewer: { select: { id: true, fullName: true } },
    },
  })

  await recordAuditEvent({
    organisationId: profile.organisationId,
    actorId: profile.id,
    action: AuditActions.TASK_CREATED,
    entityType: 'task',
    entityId: task.id,
    metadata: { title: task.title, projectId },
    ipAddress: request.headers.get('x-forwarded-for') || undefined,
  })

  return success({ task }, 201)
})

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { success } from '@/lib/api-response'
import { NotFoundError, ValidationError, PermissionError } from '@/lib/errors'
import { withTaskAccess } from '@/lib/with-task-access'
import { requireId, optionalEnum, parseBody } from '@/lib/validation'

/**
 * GET /api/tasks/[id]/dependencies — List dependencies for a task.
 * Returns both tasks this task depends on and tasks that depend on this task.
 */
export const GET = withTaskAccess(async (_request: NextRequest, { taskId }) => {
  const [dependsOn, dependedOnBy] = await Promise.all([
    prisma.taskDependency.findMany({
      where: { taskId },
      include: { dependsOn: { select: { id: true, title: true, status: true } } },
    }),
    prisma.taskDependency.findMany({
      where: { dependsOnId: taskId },
      include: { task: { select: { id: true, title: true, status: true } } },
    }),
  ])

  return success({ dependsOn, dependedOnBy })
})

/**
 * POST /api/tasks/[id]/dependencies — Add a dependency.
 * Body: { dependsOnId, type? }
 */
export const POST = withTaskAccess(async (request: NextRequest, { taskId }) => {
  const body = await parseBody(request)
  const dependsOnId = requireId(body.dependsOnId, 'Depends-on task ID')
  const type = optionalEnum(body.type, 'Dependency type', ['BLOCKS', 'RELATED'] as const) || 'BLOCKS'

  // Cannot depend on self
  if (dependsOnId === taskId) {
    throw new ValidationError('A task cannot depend on itself')
  }

  // Verify target task exists and belongs to the same organisation
  const targetTask = await prisma.task.findUnique({
    where: { id: dependsOnId },
    select: { id: true, projectId: true, project: { select: { organisationId: true } } },
  })

  if (!targetTask) {
    throw new NotFoundError('Target task not found')
  }

  // Get source task's org to verify same-org boundary
  const sourceTask = await prisma.task.findUnique({
    where: { id: taskId },
    select: { project: { select: { organisationId: true } } },
  })

  if (targetTask.project.organisationId !== sourceTask?.project.organisationId) {
    throw new PermissionError('Cannot create dependency to a task in another organisation')
  }

  // Check for duplicate dependency
  const existing = await prisma.taskDependency.findUnique({
    where: { taskId_dependsOnId: { taskId, dependsOnId } },
  })

  if (existing) {
    throw new ValidationError('This dependency already exists')
  }

  // Prevent simple circular: A depends on B and B depends on A
  const reverse = await prisma.taskDependency.findUnique({
    where: { taskId_dependsOnId: { taskId: dependsOnId, dependsOnId: taskId } },
  })

  if (reverse) {
    throw new ValidationError('Circular dependency detected: the target task already depends on this task')
  }

  const dependency = await prisma.taskDependency.create({
    data: { taskId, dependsOnId, type },
    include: { dependsOn: { select: { id: true, title: true, status: true } } },
  })

  return success({ dependency }, 201)
})

/**
 * DELETE /api/tasks/[id]/dependencies — Remove a dependency.
 * Body: { dependsOnId }
 */
export const DELETE = withTaskAccess(async (request: NextRequest, { taskId }) => {
  const body = await parseBody(request)
  const dependsOnId = requireId(body.dependsOnId, 'Depends-on task ID')

  const existing = await prisma.taskDependency.findUnique({
    where: { taskId_dependsOnId: { taskId, dependsOnId } },
  })

  if (!existing) {
    throw new NotFoundError('Dependency not found')
  }

  await prisma.taskDependency.delete({
    where: { id: existing.id },
  })

  return success({ deleted: true })
})

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { recordAuditEvent, AuditActions } from '@/lib/audit'
import { success } from '@/lib/api-response'
import { withTaskAccess } from '@/lib/with-task-access'

/**
 * POST /api/tasks/[id]/duplicate — Duplicate a task.
 *
 * Copies: title (prefixed "Copy of"), description, instructions, stage,
 * discipline, block, floor, priority, dueDate, estimatedHours,
 * deliverable, sharepointUrl, milestoneId, checklist items.
 *
 * Does NOT copy: status (defaults to NOT_STARTED), ownerId, reviewerId,
 * comments, dependencies, archivedAt, completedAt, attachments.
 */
export const POST = withTaskAccess(async (request: NextRequest, { task: source, profile }) => {
  const duplicated = await prisma.$transaction(async (tx) => {
    // Create the duplicate task
    const newTask = await tx.task.create({
      data: {
        projectId: source.projectId,
        title: `Copy of ${source.title}`,
        description: source.description,
        instructions: source.instructions,
        stage: source.stage,
        discipline: source.discipline,
        block: source.block,
        floor: source.floor,
        priority: source.priority,
        dueDate: source.dueDate,
        estimatedHours: source.estimatedHours,
        deliverable: source.deliverable,
        sharepointUrl: source.sharepointUrl,
        milestoneId: source.milestoneId,
      },
      include: {
        owner: { select: { id: true, fullName: true } },
        reviewer: { select: { id: true, fullName: true } },
      },
    })

    // Duplicate checklist items (without completion state)
    const checklistItems = await tx.taskChecklistItem.findMany({
      where: { taskId: source.id },
      orderBy: { sortOrder: 'asc' },
    })

    if (checklistItems.length > 0) {
      await tx.taskChecklistItem.createMany({
        data: checklistItems.map((item) => ({
          taskId: newTask.id,
          label: item.label,
          mandatory: item.mandatory,
          sortOrder: item.sortOrder,
        })),
      })
    }

    return newTask
  })

  await recordAuditEvent({
    organisationId: profile.organisationId,
    actorId: profile.id,
    action: AuditActions.TASK_CREATED,
    entityType: 'task',
    entityId: duplicated.id,
    metadata: { duplicatedFrom: source.id, title: duplicated.title },
    ipAddress: request.headers.get('x-forwarded-for') || undefined,
  })

  return success({ task: duplicated }, 201)
})

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { success } from '@/lib/api-response'
import { NotFoundError, ValidationError } from '@/lib/errors'
import { withTaskAccess } from '@/lib/with-task-access'
import { requireString, requireId, optionalId, optionalDate, parseBody } from '@/lib/validation'

/**
 * POST /api/tasks/[id]/checklist — Add a checklist item.
 * Any project member can add items.
 */
export const POST = withTaskAccess(async (request: NextRequest, { taskId }) => {
  const body = await parseBody(request)
  const label = requireString(body.label, 'Checklist item label', 500)
  const mandatory = typeof body.mandatory === 'boolean' ? body.mandatory : true
  const assigneeId = optionalId(body.assigneeId, 'Assignee ID')
  const dueDate = optionalDate(body.dueDate, 'Due date')

  // Auto-set sortOrder to max + 1
  const maxItem = await prisma.taskChecklistItem.findFirst({
    where: { taskId },
    orderBy: { sortOrder: 'desc' },
    select: { sortOrder: true },
  })
  const nextSortOrder = (maxItem?.sortOrder ?? -1) + 1

  const item = await prisma.taskChecklistItem.create({
    data: {
      taskId,
      label,
      mandatory,
      sortOrder: nextSortOrder,
      assigneeId: assigneeId || null,
      dueDate: dueDate || null,
    },
    include: { assignee: { select: { id: true, fullName: true } } },
  })

  return success({ item }, 201)
})

/**
 * PATCH /api/tasks/[id]/checklist — Toggle checklist item completion.
 * Body: { itemId, completed }
 */
export const PATCH = withTaskAccess(async (request: NextRequest, { taskId }) => {
  const body = await parseBody(request)
  const itemId = requireId(body.itemId, 'Item ID')

  // Verify the checklist item belongs to this task
  const existing = await prisma.taskChecklistItem.findUnique({
    where: { id: itemId },
  })

  if (!existing || existing.taskId !== taskId) {
    throw new NotFoundError('Checklist item not found')
  }

  // Build update data
  const updateData: Record<string, unknown> = {}

  if (typeof body.completed === 'boolean') {
    updateData.completed = body.completed
    updateData.completedAt = body.completed ? new Date() : null
  }

  if ('assigneeId' in body) {
    updateData.assigneeId = optionalId(body.assigneeId, 'Assignee ID') || null
  }

  if ('dueDate' in body) {
    updateData.dueDate = optionalDate(body.dueDate, 'Due date') || null
  }

  if ('label' in body) {
    updateData.label = requireString(body.label, 'Label', 500)
  }

  if (Object.keys(updateData).length === 0) {
    throw new ValidationError('At least one field must be provided to update')
  }

  const item = await prisma.taskChecklistItem.update({
    where: { id: itemId },
    data: updateData,
    include: { assignee: { select: { id: true, fullName: true } } },
  })

  return success({ item })
})

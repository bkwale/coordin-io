import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { success } from '@/lib/api-response'
import { NotFoundError, ValidationError } from '@/lib/errors'
import { withTaskAccess } from '@/lib/with-task-access'
import { requireString, requireId, parseBody } from '@/lib/validation'

/**
 * POST /api/tasks/[id]/checklist — Add a checklist item.
 * Any project member can add items.
 */
export const POST = withTaskAccess(async (request: NextRequest, { taskId }) => {
  const body = await parseBody(request)
  const label = requireString(body.label, 'Checklist item label', 500)
  const mandatory = typeof body.mandatory === 'boolean' ? body.mandatory : true

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
    },
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

  if (typeof body.completed !== 'boolean') {
    throw new ValidationError('completed (boolean) is required')
  }
  const completed = body.completed

  // Verify the checklist item belongs to this task
  const existing = await prisma.taskChecklistItem.findUnique({
    where: { id: itemId },
  })

  if (!existing || existing.taskId !== taskId) {
    throw new NotFoundError('Checklist item not found')
  }

  const item = await prisma.taskChecklistItem.update({
    where: { id: itemId },
    data: {
      completed,
      completedAt: completed ? new Date() : null,
    },
  })

  return success({ item })
})

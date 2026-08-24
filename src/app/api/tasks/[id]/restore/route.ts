import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { recordAuditEvent, AuditActions } from '@/lib/audit'
import { success } from '@/lib/api-response'
import { ValidationError, PermissionError } from '@/lib/errors'
import { withTaskAccess } from '@/lib/with-task-access'
import { canPerform } from '@/lib/role-permissions'

/**
 * POST /api/tasks/[id]/restore — Restore an archived task.
 * Clears archivedAt timestamp.
 */
export const POST = withTaskAccess(async (request: NextRequest, { task: currentTask, taskId, profile }) => {
  // Only task owner, project manager, or MANAGER+ can restore
  const isOwner = currentTask.ownerId === profile.id
  const isManager = canPerform(profile.orgPermission, 'tasks', 'create_edit_project')

  if (!isOwner && !isManager) {
    throw new PermissionError('Only the task owner or a manager can restore tasks')
  }

  if (!currentTask.archivedAt) {
    throw new ValidationError('Task is not archived')
  }

  const task = await prisma.task.update({
    where: { id: taskId },
    data: { archivedAt: null },
    include: {
      owner: { select: { id: true, fullName: true } },
      reviewer: { select: { id: true, fullName: true } },
    },
  })

  await recordAuditEvent({
    organisationId: profile.organisationId,
    actorId: profile.id,
    action: AuditActions.TASK_STATUS_CHANGED,
    entityType: 'task',
    entityId: task.id,
    metadata: { action: 'restored' },
    ipAddress: request.headers.get('x-forwarded-for') || undefined,
  })

  return success({ task })
})

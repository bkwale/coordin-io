import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { success } from '@/lib/api-response'
import { withTaskAccess } from '@/lib/with-task-access'
import { requireString, parseBody } from '@/lib/validation'
import { NotFoundError, PermissionError, ValidationError } from '@/lib/errors'
import { recordAuditEvent, AuditActions } from '@/lib/audit'
import { canDeleteComment } from '@/lib/task-comments'

/**
 * POST /api/tasks/[id]/comments — Add a comment to a task.
 * Any project member can comment.
 */
export const POST = withTaskAccess(async (request: NextRequest, { taskId, profile }) => {
  const body = await parseBody(request)
  const content = requireString(body.content, 'Comment content', 2000)

  const comment = await prisma.taskComment.create({
    data: {
      taskId,
      authorId: profile.id,
      content,
    },
    include: {
      author: { select: { id: true, fullName: true } },
    },
  })

  return success({ comment }, 201)
})

/**
 * DELETE /api/tasks/[id]/comments?commentId=… — remove a comment from a task.
 * The author, or anyone who may edit the project's tasks. The comment is hidden, not erased, and the removal is audited.
 */
export const DELETE = withTaskAccess(async (request: NextRequest, { taskId, profile }) => {
  const commentId = new URL(request.url).searchParams.get('commentId') ?? ''
  if (!/^[a-z0-9_-]{8,40}$/i.test(commentId)) throw new ValidationError('Unknown comment')

  const comment = await prisma.taskComment.findFirst({ where: { id: commentId, taskId, deletedAt: null }, select: { id: true, authorId: true } })
  if (!comment) throw new NotFoundError('That comment is not on this task, or has already been deleted.')
  if (!canDeleteComment(profile, comment)) throw new PermissionError('You can only delete your own comments.')

  // deletedAt: null in the where clause, so two clicks cannot both "delete" it
  const res = await prisma.taskComment.updateMany({ where: { id: comment.id, taskId, deletedAt: null }, data: { deletedAt: new Date(), deletedBy: profile.id } })
  if (res.count === 0) throw new NotFoundError('That comment has already been deleted.')
  await recordAuditEvent({
    organisationId: profile.organisationId, actorId: profile.id, action: AuditActions.TASK_COMMENT_DELETED, entityType: 'task', entityId: taskId,
    metadata: { commentId: comment.id, authorId: comment.authorId, ownComment: comment.authorId === profile.id },
  })
  return success({ deleted: true })
})

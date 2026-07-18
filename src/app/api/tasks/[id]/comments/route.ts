import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { success } from '@/lib/api-response'
import { withTaskAccess } from '@/lib/with-task-access'
import { requireString, parseBody } from '@/lib/validation'

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

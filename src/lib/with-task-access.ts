import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getProfileByAuthId, canViewProject } from '@/lib/permissions'
import { AuthError, NotFoundError, PermissionError, formatAPIError } from '@/lib/errors'
import { prisma } from '@/lib/prisma'
import type { OrgPermission } from '@/generated/prisma/client'

/**
 * Context available inside a withTaskAccess handler.
 */
export interface TaskAccessContext {
  authUserId: string
  profile: NonNullable<Awaited<ReturnType<typeof getProfileByAuthId>>>
  task: Awaited<ReturnType<typeof prisma.task.findUnique>> & { project: { id: string; organisationId: string } }
  taskId: string
}

type TaskAccessHandler = (
  request: NextRequest,
  context: TaskAccessContext,
) => Promise<NextResponse>

/**
 * Higher-order function that wraps an API route handler with:
 * 1. Supabase session verification
 * 2. Profile lookup
 * 3. Task existence check (with project)
 * 4. Org boundary check
 * 5. Project membership verification (admins bypass)
 * 6. Consistent error handling
 *
 * Extracts taskId from URL path: /api/tasks/[taskId]/...
 */
export function withTaskAccess(handler: TaskAccessHandler) {
  return async (request: NextRequest): Promise<NextResponse> => {
    try {
      // 1. Verify Supabase session
      const supabase = createServerSupabaseClient()
      const { data: { user }, error: authError } = await supabase.auth.getUser()

      if (authError || !user) {
        throw new AuthError('Authentication required — please sign in')
      }

      // 2. Look up profile
      const profile = await getProfileByAuthId(user.id)

      if (!profile) {
        throw new AuthError(
          'No profile found for this account. Please contact your administrator.',
          'AUTH_REQUIRED',
        )
      }

      // 3. Extract taskId from URL
      const url = new URL(request.url)
      const segments = url.pathname.split('/')
      const tasksIdx = segments.indexOf('tasks')
      const taskId = tasksIdx >= 0 ? segments[tasksIdx + 1] : undefined

      if (!taskId) {
        throw new NotFoundError('Task ID is required')
      }

      // 4. Verify task exists and belongs to user's org
      const task = await prisma.task.findUnique({
        where: { id: taskId },
        include: { project: true },
      })

      if (!task || task.project.organisationId !== profile.organisationId) {
        throw new NotFoundError('Task not found')
      }

      // 5. Check project access (admins bypass)
      const canAccess = await canViewProject(
        profile.id,
        task.projectId,
        profile.orgPermission as OrgPermission,
      )
      if (!canAccess) {
        throw new PermissionError('You do not have access to this task')
      }

      // 6. Run the handler
      return await handler(request, {
        authUserId: user.id,
        profile,
        task: task as TaskAccessContext['task'],
        taskId,
      })
    } catch (err) {
      const formatted = formatAPIError(err)
      return NextResponse.json(formatted.body, { status: formatted.statusCode })
    }
  }
}

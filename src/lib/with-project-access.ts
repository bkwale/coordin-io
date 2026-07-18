import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getProfileByAuthId, getProjectMembership, hasOrgPermission } from '@/lib/permissions'
import { AuthError, PermissionError, NotFoundError, formatAPIError } from '@/lib/errors'
import { prisma } from '@/lib/prisma'
import type { OrgPermission, ProjectRole } from '@/generated/prisma/client'

/**
 * The context available inside a withProjectAccess handler.
 */
export interface ProjectAccessContext {
  /** Supabase auth user ID */
  authUserId: string
  /** The user's Coordin.io profile */
  profile: NonNullable<Awaited<ReturnType<typeof getProfileByAuthId>>>
  /** The project being accessed */
  project: { id: string; organisationId: string; name: string }
  /** The user's membership for this project (null if admin-level bypass) */
  membership: Awaited<ReturnType<typeof getProjectMembership>>
  /** The project ID extracted from the URL */
  projectId: string
}

interface WithProjectAccessOptions {
  /** Minimum project role required (default: any member) */
  minProjectRole?: ProjectRole
  /** Minimum org permission required (default: MEMBER) */
  requiredOrgPermission?: OrgPermission
}

type ProjectAccessHandler = (
  request: NextRequest,
  context: ProjectAccessContext,
) => Promise<NextResponse>

/**
 * Higher-order function that wraps an API route handler with:
 * 1. Supabase session verification
 * 2. Profile lookup
 * 3. Project existence check
 * 4. Project membership verification (admins bypass)
 * 5. Optional project role check
 * 6. Consistent error handling
 *
 * Extracts projectId from the URL path — expects /api/projects/[projectId]/...
 *
 * Usage:
 * ```ts
 * export const GET = withProjectAccess(async (request, { profile, project, membership }) => {
 *   // profile + project are guaranteed to exist
 *   return success({ tasks })
 * }, { minProjectRole: 'PROJECT_ARCHITECT' })
 * ```
 */
export function withProjectAccess(handler: ProjectAccessHandler, options: WithProjectAccessOptions = {}) {
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

      // 3. Extract projectId from URL
      const url = new URL(request.url)
      const segments = url.pathname.split('/')
      const projectsIdx = segments.indexOf('projects')
      const projectId = projectsIdx >= 0 ? segments[projectsIdx + 1] : undefined

      if (!projectId) {
        throw new NotFoundError('Project ID is required')
      }

      // 4. Verify project exists and belongs to user's org
      const project = await prisma.project.findFirst({
        where: {
          id: projectId,
          organisationId: profile.organisationId,
        },
        select: { id: true, organisationId: true, name: true },
      })

      if (!project) {
        throw new NotFoundError('Project not found')
      }

      // 5. Check project membership (admins/owners bypass)
      let membership: Awaited<ReturnType<typeof getProjectMembership>> = null

      if (hasOrgPermission(profile.orgPermission, 'ADMIN')) {
        // Admins can access all projects in their org — no membership needed
        membership = null
      } else {
        membership = await getProjectMembership(profile.id, projectId)

        if (!membership || membership.removedAt !== null) {
          throw new PermissionError(
            'You are not a member of this project',
          )
        }

        // 6. Check minimum project role if required
        if (options.minProjectRole) {
          const { hasProjectRole } = await import('@/lib/permissions')
          if (!hasProjectRole(membership.projectRole, options.minProjectRole)) {
            throw new PermissionError(
              `This action requires ${options.minProjectRole} role or above on this project`,
            )
          }
        }
      }

      // 7. Run the handler
      return await handler(request, {
        authUserId: user.id,
        profile,
        project,
        membership,
        projectId,
      })
    } catch (err) {
      const formatted = formatAPIError(err)
      return NextResponse.json(formatted.body, { status: formatted.statusCode })
    }
  }
}

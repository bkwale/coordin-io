import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getProfileByAuthId, hasOrgPermission } from '@/lib/permissions'
import { AuthError, PermissionError, formatAPIError } from '@/lib/errors'
import { checkRateLimit, RateLimitPresets } from '@/lib/rate-limit'
import type { OrgPermission } from '@/generated/prisma/client'

/**
 * The profile + auth data available inside a withAuth handler.
 */
export interface AuthContext {
  /** Supabase auth user ID */
  authUserId: string
  /** The user's Coordin.io profile with org, office, role, employee data */
  profile: Awaited<ReturnType<typeof getProfileByAuthId>> & { id: string }
}

interface WithAuthOptions {
  /** Minimum org permission required (default: any authenticated user) */
  requiredPermission?: OrgPermission
  /** Skip rate limiting for this route (default: false) */
  skipRateLimit?: boolean
}

type AuthHandler = (
  request: NextRequest,
  context: AuthContext,
) => Promise<NextResponse>

/**
 * Higher-order function that wraps an API route handler with:
 * 1. Supabase session verification
 * 2. Rate limiting (per user)
 * 3. Profile lookup
 * 4. Optional permission check
 * 5. Request timing (warns if >2s)
 * 6. Consistent error handling
 *
 * Usage:
 * ```ts
 * export const GET = withAuth(async (request, { profile }) => {
 *   // profile is guaranteed to exist here
 *   return success({ data: profile })
 * }, { requiredPermission: 'MANAGER' })
 * ```
 */
export function withAuth(handler: AuthHandler, options: WithAuthOptions = {}) {
  return async (request: NextRequest, routeContext?: unknown): Promise<NextResponse> => {
    const startMs = Date.now()

    try {
      // 1. Verify Supabase session
      const supabase = createServerSupabaseClient()
      const { data: { user }, error: authError } = await supabase.auth.getUser()

      if (authError || !user) {
        throw new AuthError('Authentication required — please sign in')
      }

      // 2. Rate limit check (per authenticated user)
      if (!options.skipRateLimit) {
        const rateLimitResponse = checkRateLimit(user.id, RateLimitPresets.standard)
        if (rateLimitResponse) return rateLimitResponse
      }

      // 3. Look up profile
      const profile = await getProfileByAuthId(user.id)

      if (!profile) {
        throw new AuthError(
          'No profile found for this account. Please contact your administrator.',
          'AUTH_REQUIRED',
        )
      }

      // 4. Check org-level permission if required
      if (options.requiredPermission) {
        if (!hasOrgPermission(profile.orgPermission, options.requiredPermission)) {
          throw new PermissionError(
            `This action requires ${options.requiredPermission} permission or above`,
          )
        }
      }

      // 5. Run the handler
      const response = await handler(request, { authUserId: user.id, profile })

      // 6. Log slow requests
      const durationMs = Date.now() - startMs
      if (durationMs > 2000) {
        console.warn(
          `[SLOW_REQUEST] ${request.method} ${new URL(request.url).pathname} took ${durationMs}ms (user: ${profile.id})`,
        )
      }

      return response
    } catch (err) {
      const durationMs = Date.now() - startMs
      if (durationMs > 2000) {
        console.warn(
          `[SLOW_REQUEST] ${request.method} ${new URL(request.url).pathname} took ${durationMs}ms (errored)`,
        )
      }

      const formatted = formatAPIError(err)
      return NextResponse.json(formatted.body, { status: formatted.statusCode })
    }
  }
}

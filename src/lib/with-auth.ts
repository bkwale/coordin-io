import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getProfileByAuthId, hasOrgPermission } from '@/lib/permissions'
import { canPerform, type Feature, type Action } from '@/lib/role-permissions'
import { AuthError, PermissionError, formatAPIError } from '@/lib/errors'
import { checkRateLimit, RateLimitPresets } from '@/lib/rate-limit'
import { prisma } from '@/lib/prisma'
import type { OrgPermission } from '@/generated/prisma/client'

const DEMO_COOKIE = 'coordin_demo_start'
const DEMO_DURATION_MS = 10 * 60 * 1000 // 10 minutes

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
  /**
   * @deprecated Use requiredCapability instead for feature:action checks.
   * Kept for backward compatibility — falls back to tier-based hierarchy check.
   */
  requiredPermission?: OrgPermission
  /** Feature:action capability check using the unified canPerform matrix */
  requiredCapability?: { feature: Feature; action: Action }
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
      // 0. Demo mode — cookie-based 10-minute pass (read-only, no Supabase session needed)
      const demoCookie = request.cookies.get(DEMO_COOKIE)?.value
      if (demoCookie) {
        const demoStart = parseInt(demoCookie, 10)
        if (!isNaN(demoStart) && Date.now() - demoStart < DEMO_DURATION_MS) {
          // Look up first ADMIN profile from CWA HOMES org for demo context
          const demoProfile = await prisma.profile.findFirst({
            where: {
              organisationId: 'd98a3d14-a3c7-4df7-a7ac-8e1065356e1a',
              orgPermission: 'ADMIN',
              status: 'ACTIVE',
            },
            include: {
              organisation: true,
              office: true,
              corporateRole: true,
              employeeProfile: true,
            },
          })

          if (demoProfile) {
            const response = await handler(request, {
              authUserId: 'demo-user',
              profile: demoProfile,
            })
            return response
          }
          // If no demo profile found, fall through to normal auth
        }
      }

      // 1. Verify Supabase session
      const supabase = await createServerSupabaseClient()
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

      // 3b. Block deactivated accounts
      if (profile.status === 'DEACTIVATED') {
        throw new AuthError(
          'Your account has been deactivated. Please contact your administrator.',
          'AUTH_REQUIRED',
        )
      }

      // 4. Check permissions — prefer capability check, fall back to tier check
      if (options.requiredCapability) {
        const { feature, action } = options.requiredCapability
        if (!canPerform(profile.orgPermission, feature, action)) {
          throw new PermissionError(
            `You do not have permission to perform ${feature}:${action}`,
          )
        }
      } else if (options.requiredPermission) {
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

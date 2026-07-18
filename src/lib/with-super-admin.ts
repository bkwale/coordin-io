import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { AuthError, PermissionError, formatAPIError } from '@/lib/errors'
import { checkRateLimit, RateLimitPresets } from '@/lib/rate-limit'

/**
 * Context available inside a withSuperAdmin handler.
 */
export interface SuperAdminContext {
  authUserId: string
  email: string
  name: string
}

type SuperAdminHandler = (
  request: NextRequest,
  context: SuperAdminContext,
) => Promise<NextResponse>

/**
 * Higher-order function that wraps an API route with platform-level
 * super admin verification. Checks the platform_admins table.
 *
 * Usage:
 * ```ts
 * export const GET = withSuperAdmin(async (request, { authUserId }) => {
 *   return NextResponse.json({ orgs: await prisma.organisation.findMany() })
 * })
 * ```
 */
export function withSuperAdmin(handler: SuperAdminHandler) {
  return async (request: NextRequest): Promise<NextResponse> => {
    try {
      // 1. Verify Supabase session
      const supabase = createServerSupabaseClient()
      const { data: { user }, error: authError } = await supabase.auth.getUser()

      if (authError || !user) {
        throw new AuthError('Authentication required — please sign in')
      }

      // 2. Rate limit
      const rateLimitResponse = checkRateLimit(user.id, RateLimitPresets.standard)
      if (rateLimitResponse) return rateLimitResponse

      // 3. Check platform_admins table
      const admin = await prisma.$queryRawUnsafe<
        Array<{ auth_user_id: string; email: string; name: string }>
      >(
        `SELECT auth_user_id, email, name FROM platform_admins WHERE auth_user_id = $1 LIMIT 1`,
        user.id,
      )

      if (!admin || admin.length === 0) {
        throw new PermissionError('Platform admin access required')
      }

      // 4. Run handler
      return await handler(request, {
        authUserId: user.id,
        email: admin[0].email,
        name: admin[0].name,
      })
    } catch (err) {
      const formatted = formatAPIError(err)
      return NextResponse.json(formatted.body, { status: formatted.statusCode })
    }
  }
}

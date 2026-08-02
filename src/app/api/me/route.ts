import { success } from '@/lib/api-response'
import { withAuth } from '@/lib/with-auth'

/**
 * GET /api/me — Return the current user's profile summary.
 *
 * Used by the frontend to determine user permissions and role
 * for rendering manager/admin-specific UI elements.
 */
export const GET = withAuth(async (_request, { profile }) => {
  return success({
    id: profile.id,
    fullName: profile.fullName,
    email: profile.email,
    jobTitle: profile.jobTitle,
    orgPermission: profile.orgPermission,
    managerId: profile.managerId,
    organisationId: profile.organisationId,
  })
})

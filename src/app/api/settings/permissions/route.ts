import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/with-auth'
import { getPermissionsForRole, getRoleLabel, ROLE_LABELS, ROLE_DESCRIPTIONS } from '@/lib/role-permissions'

/**
 * GET /api/settings/permissions — Get current user's permissions map + role info.
 * Used by the frontend to show/hide features based on role.
 */
export const GET = withAuth(async (_request: NextRequest, { profile }) => {
  const role = profile.orgPermission
  const permissions = getPermissionsForRole(role)

  return NextResponse.json({
    role,
    roleLabel: getRoleLabel(role),
    permissions,
    allRoles: Object.entries(ROLE_LABELS).map(([key, label]) => ({
      key,
      label,
      description: ROLE_DESCRIPTIONS[key as keyof typeof ROLE_DESCRIPTIONS],
    })),
  })
})

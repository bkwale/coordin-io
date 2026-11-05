import { PermissionError } from '@/lib/errors'
import { getProjectMembership, hasProjectRole } from '@/lib/permissions'
import type { ProjectRole } from '@/generated/prisma/client'

type Ctx = {
  profile: { id: string; orgPermission: string }
  projectId: string
  membership: { projectRole: ProjectRole; removedAt?: Date | null } | null
}

/**
 * Delivery write rights. withProjectAccess lets "view all" org roles (HR, Legal, Finance, Commercial)
 * into every project without a membership, and skips the project-role check for them. Viewing is fine;
 * recording gate decisions, frameworks or checklist evidence is not. Writers must be org ADMIN/OWNER
 * or a current project member with at least `min`.
 */
export async function deliveryRole(ctx: Ctx): Promise<{ isOrgAdmin: boolean; role: ProjectRole | null }> {
  const isOrgAdmin = ctx.profile.orgPermission === 'ADMIN' || ctx.profile.orgPermission === 'OWNER'
  let m = ctx.membership
  if (!m) m = await getProjectMembership(ctx.profile.id, ctx.projectId)
  const role = m && !m.removedAt ? m.projectRole : null
  return { isOrgAdmin, role }
}

export async function assertDeliveryWrite(ctx: Ctx, min: ProjectRole): Promise<{ isOrgAdmin: boolean; role: ProjectRole | null }> {
  const r = await deliveryRole(ctx)
  if (r.isOrgAdmin) return r
  if (!r.role || !hasProjectRole(r.role, min)) {
    throw new PermissionError(`This needs ${min.replace(/_/g, ' ').toLowerCase()} role or above on this project`)
  }
  return r
}

/** CWA approval items (Design Lead sign-off etc.) need DESIGN_LEAD or above — never inferred from org role alone. */
export function canApproveDelivery(r: { isOrgAdmin: boolean; role: ProjectRole | null }): boolean {
  return !!r.role && hasProjectRole(r.role, 'DESIGN_LEAD')
}

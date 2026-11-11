/**
 * The one exception to "nobody approves their own request" (decided by Wale, 11 Nov 2026):
 * the OWNER of a firm with no other active owner or admin, and no line manager, may approve their own
 * request — a one-partner practice can't work otherwise. Every use is written to the audit log.
 * Anything unexpected (lookup fails) means "no": the normal block applies.
 */

type Actor = { id: string; organisationId: string; orgPermission: unknown; managerId?: string | null }
type Db = { profile: { count: (args: any) => Promise<number> } }

export async function isSoleOwner(actor: Actor, db?: Db): Promise<boolean> {
  if (actor.orgPermission !== 'OWNER') return false
  try {
    // Loaded on demand so importing this file never opens a database connection
    const client = db ?? ((await import('./prisma')).prisma as unknown as Db)
    const others = await client.profile.count({
      where: {
        organisationId: actor.organisationId,
        id: { not: actor.id },
        status: 'ACTIVE',
        OR: [{ orgPermission: { in: ['OWNER', 'ADMIN'] } }, ...(actor.managerId ? [{ id: actor.managerId }] : [])],
      },
    })
    return others === 0
  } catch {
    return false
  }
}

export const SELF_APPROVED_ACTION = 'approval.self_approved_sole_owner'

/** Audit line for a sole owner acting on their own request. */
export async function recordSoleOwnerSelfApproval(actor: Actor, entityType: string, entityId: string, decision: string) {
  const { recordAuditEvent } = await import('./audit')
  await recordAuditEvent({
    organisationId: actor.organisationId, actorId: actor.id, action: SELF_APPROVED_ACTION, entityType, entityId,
    metadata: { decision, reason: 'Sole owner — no other owner, admin or line manager to approve' },
  })
}

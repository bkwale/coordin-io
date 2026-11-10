/**
 * Tenant guards. Every id that arrives in a URL or a body is checked against the caller's organisation
 * before it is read or written. A refusal is logged (without personal data) so cross-firm attempts are visible.
 */
import { prisma } from '@/lib/prisma'
import { NotFoundError, PermissionError, ValidationError } from '@/lib/errors'

function refuse(kind: string, id: string, organisationId: string): never {
  console.warn(JSON.stringify({ level: 'warn', event: 'tenant_refusal', kind, id: id.slice(0, 40), organisationId }))
  throw new NotFoundError(`${kind} not found`)
}

/** A person in this organisation (any status). */
export async function assertOrgProfile(profileId: string | null | undefined, organisationId: string, kind = 'Person'): Promise<void> {
  if (!profileId) return
  const p = await prisma.profile.findFirst({ where: { id: profileId, organisationId }, select: { id: true } })
  if (!p) refuse(kind, profileId, organisationId)
}

/** Several people at once (assignees, approvers, CC lists). */
export async function assertOrgProfiles(ids: Array<string | null | undefined>, organisationId: string, kind = 'Person'): Promise<void> {
  const unique = Array.from(new Set(ids.filter((x): x is string => typeof x === 'string' && x.length > 0)))
  if (!unique.length) return
  const found = await prisma.profile.count({ where: { id: { in: unique }, organisationId } })
  if (found !== unique.length) refuse(kind, unique.join(','), organisationId)
}

export async function assertOrgOffice(officeId: string | null | undefined, organisationId: string): Promise<void> {
  if (!officeId) return
  const o = await prisma.office.findFirst({ where: { id: officeId, organisationId }, select: { id: true } })
  if (!o) refuse('Office', officeId, organisationId)
}

export async function assertOrgRole(roleId: string | null | undefined, organisationId: string): Promise<void> {
  if (!roleId) return
  const r = await prisma.corporateRole.findFirst({ where: { id: roleId, organisationId }, select: { id: true } })
  if (!r) refuse('Role', roleId, organisationId)
}

export async function assertOrgProject(projectId: string | null | undefined, organisationId: string): Promise<void> {
  if (!projectId) return
  const p = await prisma.project.findFirst({ where: { id: projectId, organisationId }, select: { id: true } })
  if (!p) refuse('Project', projectId, organisationId)
}

/** Nobody approves, verifies or signs off their own request. */
export function assertNotSelf(actorProfileId: string, subjectProfileId: string | null | undefined, what: string): void {
  if (subjectProfileId && actorProfileId === subjectProfileId) throw new PermissionError(`You can't ${what} yourself — ask another approver`)
}

/** Role ceiling for granting access: only an OWNER grants OWNER/ADMIN/HR; nobody grants above their own level. */
const RANK: Record<string, number> = { VIEWER: 0, MEMBER: 1, MANAGER: 2, LEGAL: 2, FINANCE: 2, COMMERCIAL: 2, HR: 3, ADMIN: 4, OWNER: 5 }
export function assertCanGrant(actorRole: string, newRole: string): void {
  if (!(newRole in RANK)) throw new ValidationError(`Invalid permission level: ${newRole}`)
  if (['OWNER', 'ADMIN', 'HR'].includes(newRole) && actorRole !== 'OWNER') throw new PermissionError('Only the Practice Principal (Owner) can grant HR, Admin or Owner access')
  if (RANK[newRole] > (RANK[actorRole] ?? 0)) throw new PermissionError('You cannot grant more access than you have')
}

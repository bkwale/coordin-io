import type { NextRequest } from 'next/server'
import { withProjectAccess } from '@/lib/with-project-access'
import { success, error } from '@/lib/api-response'
import { ValidationError } from '@/lib/errors'
import { checkRateLimit } from '@/lib/rate-limit'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@/generated/prisma/client'
import { recordAuditEvent, AuditActions } from '@/lib/audit'
import { fetchBuilding, EhrError, type EhrBuilding } from '@/lib/ehr/client'
import { ehrToValues, fetchedLabel } from '@/lib/ehr/map'

export const dynamic = 'force-dynamic'

const view = (b: EhrBuilding | null) => (b ? { building: b, attribution: fetchedLabel(b), values: ehrToValues(b) } : { building: null, attribution: null, values: [] })

/** GET — the building record linked to this project (snapshot), if any. */
export const GET = withProjectAccess(async (_req: NextRequest, { projectId }) => {
  const p = await prisma.project.findUnique({ where: { id: projectId }, select: { ehrSnapshot: true } })
  return success(view((p?.ehrSnapshot as unknown as EhrBuilding) ?? null))
})

/** POST { ehrCode } — fetch from Ehitisregister and store as the project's snapshot. Lead only. */
export const POST = withProjectAccess(async (request: NextRequest, { projectId, profile, project }) => {
  const limited = await checkRateLimit(`ehr:${profile.id}`, { maxRequests: 10, windowMs: 60_000 })
  if (limited) return limited
  const body = await request.json().catch(() => ({}))
  const code = typeof body.ehrCode === 'string' ? body.ehrCode.trim() : ''
  try {
    const b = await fetchBuilding(code)
    await prisma.project.update({ where: { id: projectId }, data: { ehrCode: b.ehrCode, ehrSnapshot: b as unknown as object, ehrFetchedAt: new Date(b.fetchedAt) } })
    await recordAuditEvent({ organisationId: project.organisationId, actorId: profile.id, action: AuditActions.PROJECT_EHR_LINKED, entityType: 'project', entityId: projectId, metadata: { ehrCode: b.ehrCode, name: b.name, useCode: b.useCode, fetchedAt: b.fetchedAt } })
    return success(view(b))
  } catch (e) {
    if (e instanceof EhrError) return error(new ValidationError(e.message))
    return error(e)
  }
}, { minProjectRole: 'PROJECT_LEAD' })

/** DELETE — unlink. Lead only. */
export const DELETE = withProjectAccess(async (_req: NextRequest, { projectId, profile, project }) => {
  const p = await prisma.project.findUnique({ where: { id: projectId }, select: { ehrCode: true } })
  if (!p?.ehrCode) return error(new ValidationError('No building is linked'))
  await prisma.project.update({ where: { id: projectId }, data: { ehrCode: null, ehrSnapshot: Prisma.DbNull, ehrFetchedAt: null } })
  await recordAuditEvent({ organisationId: project.organisationId, actorId: profile.id, action: AuditActions.PROJECT_EHR_UNLINKED, entityType: 'project', entityId: projectId, metadata: { ehrCode: p.ehrCode } })
  return success(view(null))
}, { minProjectRole: 'PROJECT_LEAD' })

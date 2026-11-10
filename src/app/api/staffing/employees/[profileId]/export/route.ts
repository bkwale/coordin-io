import { NextResponse, type NextRequest } from 'next/server'
import { withAuth } from '@/lib/with-auth'
import { PermissionError, NotFoundError } from '@/lib/errors'
import { canManageHR } from '@/lib/staffing-utils'
import { exportPersonData } from '@/lib/gdpr'
import { recordAuditEvent } from '@/lib/audit'
import { checkRateLimit } from '@/lib/rate-limit'
import type { OrgPermission } from '@/generated/prisma/client'

export const dynamic = 'force-dynamic'

/** GET /api/staffing/employees/[profileId]/export — a person's own data, or HR/Admin on their behalf (subject access request). */
export const GET = withAuth(async (request: NextRequest, { profile }) => {
  const profileId = request.url.match(/\/employees\/([^/?]+)\/export/)?.[1]
  if (!profileId) throw new NotFoundError('Person not found')
  const isSelf = profileId === profile.id
  if (!isSelf && !canManageHR(profile.orgPermission as OrgPermission)) throw new PermissionError('Only the person themselves or HR can export this data')
  const rl = await checkRateLimit(`gdpr-export:${profile.id}`, { maxRequests: 10, windowMs: 3_600_000 })
  if (rl) return rl
  const data = await exportPersonData(profileId, profile.organisationId)
  await recordAuditEvent({ organisationId: profile.organisationId, actorId: profile.id, action: 'gdpr.data_exported', entityType: 'profile', entityId: profileId, metadata: { self: isSelf } })
  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: { 'content-type': 'application/json; charset=utf-8', 'content-disposition': `attachment; filename="coordin-personal-data-${profileId}.json"`, 'cache-control': 'private, no-store' },
  })
})

import type { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth } from '@/lib/with-auth'
import { success } from '@/lib/api-response'
import { parseBody, requireEnum, requireString } from '@/lib/validation'
import { NotFoundError, PermissionError, ValidationError } from '@/lib/errors'
import { anonymiseProfile } from '@/lib/gdpr'
import { invalidateCache, cacheKey } from '@/lib/cache'

/**
 * POST /api/staffing/employees/[profileId]/anonymise — irreversible.
 * Body: { reason: 'retention' | 'erasure_request', confirmName: <the person's current full name> }
 * ADMIN/OWNER for retention; OWNER only for an early erasure request.
 */
export const POST = withAuth(async (request: NextRequest, { profile }) => {
  const profileId = request.url.match(/\/employees\/([^/?]+)\/anonymise/)?.[1]
  if (!profileId) throw new NotFoundError('Person not found')
  const role = profile.orgPermission as string
  if (role !== 'ADMIN' && role !== 'OWNER') throw new PermissionError('Only an admin or owner can anonymise a record')
  const body = await parseBody(request)
  const reason = requireEnum(body.reason, 'reason', ['retention', 'erasure_request'] as const)
  if (reason === 'erasure_request' && role !== 'OWNER') throw new PermissionError('Only the owner can action an erasure request before the retention period ends')
  if (profileId === profile.id) throw new PermissionError("You can't anonymise your own record")
  const confirmName = requireString(body.confirmName, 'confirmName', 200)
  const target = await prisma.profile.findFirst({ where: { id: profileId, organisationId: profile.organisationId }, select: { fullName: true } })
  if (!target) throw new NotFoundError('Person not found')
  if (confirmName.trim() !== target.fullName.trim()) throw new ValidationError("Type the person's full name exactly to confirm")
  const result = await anonymiseProfile({ profileId, organisationId: profile.organisationId, actorId: profile.id, reason })
  await invalidateCache(cacheKey.staffingAll(profile.organisationId)).catch(() => {})
  return success(result)
})

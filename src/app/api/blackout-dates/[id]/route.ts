import type { NextRequest } from 'next/server'
import { modulesPrisma } from '@/lib/prisma-modules'
import { success } from '@/lib/api-response'
import { withAuth } from '@/lib/with-auth'
import { NotFoundError, PermissionError } from '@/lib/errors'

function extractId(url: string): string {
  const id = url.match(/\/blackout-dates\/([^/?]+)/)?.[1]
  if (!id) throw new NotFoundError('Blackout date ID is required')
  return id
}

/**
 * DELETE /api/blackout-dates/[id] — Delete a blackout date.
 * Requires ADMIN, OWNER, or HR.
 */
export const DELETE = withAuth(async (request: NextRequest, { profile }) => {
  if (!['ADMIN', 'OWNER', 'HR'].includes(profile.orgPermission)) {
    throw new PermissionError('Only administrators or HR can manage blackout dates')
  }

  const id = extractId(request.url)

  const existing = await modulesPrisma.blackoutDate.findFirst({
    where: { id, organisationId: profile.organisationId },
  })
  if (!existing) throw new NotFoundError('Blackout date not found')

  await modulesPrisma.blackoutDate.delete({ where: { id } })

  return success({ deleted: true })
})

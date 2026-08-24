import type { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { success } from '@/lib/api-response'
import { withAuth } from '@/lib/with-auth'
import { NotFoundError, PermissionError } from '@/lib/errors'

function extractId(url: string): string {
  const id = url.match(/\/external-links\/([^/?]+)/)?.[1]
  if (!id) throw new NotFoundError('Link ID is required')
  return id
}

/**
 * DELETE /api/external-links/[id] — Delete an external link.
 * Only the creator or an admin can delete.
 */
export const DELETE = withAuth(async (request: NextRequest, { profile }) => {
  const id = extractId(request.url)

  const link = await prisma.externalLink.findFirst({
    where: { id, organisationId: profile.organisationId },
  })
  if (!link) throw new NotFoundError('External link not found')

  const isCreator = link.createdById === profile.id
  const isAdmin = profile.orgPermission === 'ADMIN' || profile.orgPermission === 'OWNER'

  if (!isCreator && !isAdmin) {
    throw new PermissionError('Only the creator or an admin can delete this link')
  }

  await prisma.externalLink.delete({ where: { id } })

  return success({ deleted: true })
})

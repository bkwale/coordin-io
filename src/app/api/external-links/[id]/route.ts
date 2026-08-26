import type { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { success } from '@/lib/api-response'
import { withAuth } from '@/lib/with-auth'
import { NotFoundError, PermissionError, ValidationError } from '@/lib/errors'
import { requireString, requireEnum, parseBody } from '@/lib/validation'

const LINK_TYPES = ['SHAREPOINT_FOLDER', 'SHAREPOINT_DOCUMENT', 'EXTERNAL_URL'] as const

function extractId(url: string): string {
  const id = url.match(/\/external-links\/([^/?]+)/)?.[1]
  if (!id) throw new NotFoundError('Link ID is required')
  return id
}

/**
 * PATCH /api/external-links/[id] — Update an external link.
 * Only the creator or an admin can update.
 */
export const PATCH = withAuth(async (request: NextRequest, { profile }) => {
  const id = extractId(request.url)
  const body = await parseBody(request)

  const link = await prisma.externalLink.findFirst({
    where: { id, organisationId: profile.organisationId },
  })
  if (!link) throw new NotFoundError('External link not found')

  const isCreator = link.createdById === profile.id
  const isAdmin = profile.orgPermission === 'ADMIN' || profile.orgPermission === 'OWNER'

  if (!isCreator && !isAdmin) {
    throw new PermissionError('Only the creator or an admin can edit this link')
  }

  const data: Record<string, unknown> = {}
  if (body.label !== undefined) data.label = requireString(body.label, 'Label', 200)
  if (body.url !== undefined) {
    data.url = requireString(body.url, 'URL', 2000)
    try { new URL(data.url as string) } catch { throw new ValidationError('Invalid URL format') }
  }
  if (body.linkType !== undefined) data.linkType = requireEnum(body.linkType, 'Link type', LINK_TYPES)

  const updated = await prisma.externalLink.update({
    where: { id },
    data: data as { label?: string; url?: string; linkType?: typeof LINK_TYPES[number] },
    include: {
      createdBy: { select: { id: true, fullName: true } },
    },
  })

  return success({ link: updated })
})

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

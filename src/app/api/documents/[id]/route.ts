import type { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { success } from '@/lib/api-response'
import { withAuth } from '@/lib/with-auth'
import { NotFoundError, PermissionError } from '@/lib/errors'
import { canViewProject } from '@/lib/permissions'

/**
 * GET /api/documents/[id] — Document detail with full revision history.
 *
 * Uses withAuth (org-level), then manually verifies project access
 * via the document's projectId.
 */
export const GET = withAuth(async (request: NextRequest, { profile }) => {
  // Extract document ID from URL
  const url = new URL(request.url)
  const segments = url.pathname.split('/')
  const documentId = segments[segments.indexOf('documents') + 1]

  // Fetch document with all revisions and their reviews
  const doc = await prisma.document.findUnique({
    where: { id: documentId },
    include: {
      project: true,
      revisions: {
        orderBy: { createdAt: 'desc' },
        include: {
          reviews: {
            include: {
              reviewer: {
                select: { id: true, fullName: true, avatarUrl: true },
              },
            },
          },
          author: {
            select: { id: true, fullName: true, avatarUrl: true },
          },
        },
      },
    },
  })

  if (!doc || doc.project.organisationId !== profile.organisationId) {
    throw new NotFoundError('Document not found')
  }

  const canAccess = await canViewProject(profile.id, doc.projectId, profile.orgPermission)
  if (!canAccess) {
    throw new PermissionError('You do not have access to this document')
  }

  return success({ document: doc })
})

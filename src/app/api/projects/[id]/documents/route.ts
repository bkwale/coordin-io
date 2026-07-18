import type { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { success } from '@/lib/api-response'
import { withProjectAccess } from '@/lib/with-project-access'
import { recordAuditEvent, AuditActions } from '@/lib/audit'
import { requireString, optionalString, optionalEnum, parseBody } from '@/lib/validation'

/**
 * GET /api/projects/[id]/documents — Drawing Register view.
 *
 * Lists all documents for a project, each with its latest revision status.
 * Ordered by documentType then title.
 */
export const GET = withProjectAccess(async (_request: NextRequest, { projectId }) => {
  const documents = await prisma.document.findMany({
    where: { projectId },
    include: {
      revisions: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: {
          id: true,
          revision: true,
          status: true,
          authorId: true,
          issuePurpose: true,
          issueDate: true,
          supersededAt: true,
          createdAt: true,
        },
      },
    },
    orderBy: [
      { documentType: 'asc' },
      { title: 'asc' },
    ],
  })

  // Flatten: attach latestRevision as a top-level field per document
  const result = documents.map((doc) => {
    const { revisions, ...rest } = doc
    return {
      ...rest,
      latestRevision: revisions[0] ?? null,
    }
  })

  return success({ documents: result })
})

/**
 * POST /api/projects/[id]/documents — Create a new document entry.
 *
 * Any project member can create a document.
 * Body: { title, documentType?, discipline?, documentCode?, securityLevel? }
 */
export const POST = withProjectAccess(async (request: NextRequest, { profile, projectId }) => {
  const body = await parseBody(request)

  const title = requireString(body.title, 'Title', 500)
  const documentType = optionalEnum(body.documentType, 'Document type', ['DRAWING', 'SPECIFICATION', 'SCHEDULE', 'REPORT', 'PHOTOGRAPH', 'CORRESPONDENCE', 'CERTIFICATE', 'OTHER'] as const)
  const discipline = optionalString(body.discipline, 'Discipline', 100)
  const documentCode = optionalString(body.documentCode, 'Document code', 100)
  const securityLevel = optionalEnum(body.securityLevel, 'Security level', ['INTERNAL', 'CONSULTANT', 'CONTRACTOR', 'CLIENT_OPERATOR'] as const)

  const document = await prisma.document.create({
    data: {
      projectId,
      title,
      ...(documentType ? { documentType } : {}),
      ...(discipline ? { discipline } : {}),
      ...(documentCode ? { documentCode } : {}),
      ...(securityLevel ? { securityLevel } : {}),
    },
  })

  await recordAuditEvent({
    organisationId: profile.organisationId,
    actorId: profile.id,
    action: AuditActions.DOCUMENT_UPLOADED,
    entityType: 'Document',
    entityId: document.id,
    metadata: { title: document.title, documentType: document.documentType },
  })

  return success({ document }, 201)
})

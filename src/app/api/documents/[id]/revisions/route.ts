import type { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { success } from '@/lib/api-response'
import { withDocumentAccess } from '@/lib/with-document-access'
import { getNextRevisionCode, getRevisionPrefix } from '@/lib/revision-numbering'
import { recordAuditEvent, AuditActions } from '@/lib/audit'
import { requireString, optionalString, parseBody } from '@/lib/validation'

/**
 * POST /api/documents/[id]/revisions — Create a new revision for a document.
 *
 * Uses withDocumentAccess for auth + project access verification.
 * Auto-generates revision code using the revision-numbering module.
 * Supersedes the previous latest revision if one exists.
 * Wrapped in $transaction for atomicity.
 */
export const POST = withDocumentAccess(async (request: NextRequest, { documentId, profile, document: doc }) => {
  const body = await parseBody(request)
  const fileUrl = requireString(body.fileUrl, 'File URL', 2000)
  const issuePurpose = optionalString(body.issuePurpose, 'Issue purpose', 500)
  const isConstructionIssue = typeof body.isConstructionIssue === 'boolean' ? body.isConstructionIssue : false

  // Auto-generate revision code
  const prefix = getRevisionPrefix(isConstructionIssue)
  const revisionCode = await getNextRevisionCode(documentId, prefix)

  const now = new Date()

  // Use $transaction for atomicity: supersede + create + update document
  const revision = await prisma.$transaction(async (tx) => {
    // Supersede the previous latest revision
    const previousRevision = await tx.documentRevision.findFirst({
      where: { documentId, supersededAt: null },
      orderBy: { createdAt: 'desc' },
    })

    if (previousRevision) {
      await tx.documentRevision.update({
        where: { id: previousRevision.id },
        data: { supersededAt: now },
      })
    }

    // Create the new revision
    const newRevision = await tx.documentRevision.create({
      data: {
        documentId,
        revision: revisionCode,
        authorId: profile.id,
        fileUrl,
        issuePurpose,
        issueDate: isConstructionIssue ? now : null,
      },
    })

    // Update parent document's currentRevision
    await tx.document.update({
      where: { id: documentId },
      data: { currentRevision: revisionCode },
    })

    return { newRevision, previousRevision }
  })

  // Audit events (outside transaction — non-critical)
  if (revision.previousRevision) {
    await recordAuditEvent({
      organisationId: doc.project.organisationId,
      actorId: profile.id,
      action: AuditActions.DOCUMENT_SUPERSEDED,
      entityType: 'DocumentRevision',
      entityId: revision.previousRevision.id,
      metadata: { supersededBy: revisionCode },
    })
  }

  await recordAuditEvent({
    organisationId: doc.project.organisationId,
    actorId: profile.id,
    action: AuditActions.DOCUMENT_UPLOADED,
    entityType: 'DocumentRevision',
    entityId: revision.newRevision.id,
    metadata: {
      documentId,
      revision: revisionCode,
      isConstructionIssue,
    },
  })

  return success({ revision: revision.newRevision }, 201)
})

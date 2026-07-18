import type { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { success } from '@/lib/api-response'
import { PermissionError } from '@/lib/errors'
import { withRevisionAccess } from '@/lib/with-document-access'
import { canReviewWork, getProjectMembership } from '@/lib/permissions'
import { recordAuditEvent, AuditActions } from '@/lib/audit'
import { requireEnum, optionalString, parseBody } from '@/lib/validation'

const VALID_OUTCOMES = ['APPROVED', 'CHANGES_REQUIRED', 'REJECTED'] as const

/**
 * POST /api/document-revisions/[id]/review — Submit a review for a revision.
 *
 * Uses withRevisionAccess for auth + project access verification.
 * Enforces canReviewWork() — reviewer must be SENIOR_ARCHITECT+
 * and cannot review their own work.
 *
 * If APPROVED and the revision is construction-issued (starts with "C"),
 * the parent document status is updated to APPROVED_FOR_ISSUE — wrapped
 * in $transaction for atomicity.
 */
export const POST = withRevisionAccess(async (request: NextRequest, { revision, profile }) => {
  // Enforce review permissions: SENIOR_ARCHITECT+ and not self-review
  const membership = await getProjectMembership(profile.id, revision.document.projectId)

  if (membership) {
    if (!canReviewWork(membership.projectRole, revision.authorId, profile.id)) {
      throw new PermissionError(
        'You cannot review this document. Reviews require Senior Architect role or above, and you cannot review your own work.',
      )
    }
  }
  // Admins without membership can still review (they bypassed membership check in withRevisionAccess)

  // Parse and validate body
  const body = await parseBody(request)
  const outcome = requireEnum(body.outcome, 'Outcome', VALID_OUTCOMES)
  const comments = optionalString(body.comments, 'Comments', 2000)

  const now = new Date()
  const isConstructionIssue = revision.revision.startsWith('C')

  // Use $transaction for atomicity: create review + optionally update document status
  const review = await prisma.$transaction(async (tx) => {
    const newReview = await tx.documentReview.create({
      data: {
        revisionId: revision.id,
        reviewerId: profile.id,
        outcome,
        comments,
        reviewedAt: now,
      },
    })

    // If APPROVED and construction issue, update document status
    if (outcome === 'APPROVED' && isConstructionIssue) {
      await tx.document.update({
        where: { id: revision.documentId },
        data: { status: 'APPROVED_FOR_ISSUE' },
      })
    }

    return newReview
  })

  // Audit events (outside transaction — non-critical)
  if (outcome === 'APPROVED' && isConstructionIssue) {
    await recordAuditEvent({
      organisationId: revision.document.project.organisationId,
      actorId: profile.id,
      action: AuditActions.DOCUMENT_APPROVED,
      entityType: 'Document',
      entityId: revision.documentId,
      metadata: { revisionId: revision.id, revision: revision.revision },
    })
  }

  await recordAuditEvent({
    organisationId: revision.document.project.organisationId,
    actorId: profile.id,
    action: AuditActions.DOCUMENT_REVIEWED,
    entityType: 'DocumentReview',
    entityId: review.id,
    metadata: {
      revisionId: revision.id,
      outcome,
      documentId: revision.documentId,
    },
  })

  return success({ review }, 201)
})

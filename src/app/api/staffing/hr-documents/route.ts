import { NextRequest } from 'next/server'
import { success } from '@/lib/api-response'
import { withAuth } from '@/lib/with-auth'
import { modulesPrisma } from '@/lib/prisma-modules'
import { recordAuditEvent } from '@/lib/audit'
import { requireString, requireEnum, optionalString, optionalDate, parseBody } from '@/lib/validation'
import { PermissionError } from '@/lib/errors'
import { canManageHR } from '@/lib/staffing-utils'
import type { OrgPermission } from '@/generated/prisma/client'

const HR_DOCUMENT_TYPES = [
  'CONTRACT', 'OFFER_LETTER', 'RIGHT_TO_WORK', 'VISA', 'DBS_CHECK',
  'PROFESSIONAL_MEMBERSHIP', 'QUALIFICATION', 'TRAINING_CERTIFICATE',
  'PERFORMANCE_REVIEW', 'DISCIPLINARY', 'GRIEVANCE',
  'POLICY_ACKNOWLEDGEMENT', 'OTHER',
] as const

/**
 * GET /api/staffing/hr-documents — List HR documents.
 *
 * Permission: HR+ sees all documents; others see only their own.
 * Confidential documents are hidden from non-HR unless they're the subject.
 *
 * Query params:
 * - profileId: filter by employee
 * - type: filter by document type
 * - expiring: 'true' to show only docs expiring within 60 days
 */
export const GET = withAuth(async (request: NextRequest, { profile }) => {
  const url = new URL(request.url)
  const profileIdFilter = url.searchParams.get('profileId')
  const typeFilter = url.searchParams.get('type')
  const expiringOnly = url.searchParams.get('expiring') === 'true'

  // Query-then-strip: canManageHR replaces inline isAdmin check (HR, ADMIN, OWNER)
  const hasHRAccess = canManageHR(profile.orgPermission as OrgPermission)

  // Non-HR can only see their own documents
  if (!hasHRAccess && profileIdFilter && profileIdFilter !== profile.id) {
    throw new PermissionError('You can only view your own documents')
  }

  const where: Record<string, unknown> = {
    organisationId: profile.organisationId,
    ...(profileIdFilter
      ? { profileId: profileIdFilter }
      : hasHRAccess
        ? {}
        : { profileId: profile.id }),
  }

  // Non-HR cannot see confidential docs unless viewing their own
  if (!hasHRAccess && profileIdFilter !== profile.id) {
    where.isConfidential = false
  }

  if (typeFilter) {
    where.documentType = typeFilter
  }

  if (expiringOnly) {
    const in60Days = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000)
    where.expiryDate = { lte: in60Days, gte: new Date() }
  }

  const documents = await modulesPrisma.hRDocument.findMany({
    where,
    include: {
      profile: { select: { id: true, fullName: true, jobTitle: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
  })

  return success({ documents })
})

/**
 * POST /api/staffing/hr-documents — Upload/create an HR document record.
 *
 * Permission: HR+ only (HR, ADMIN, OWNER).
 */
export const POST = withAuth(async (request: NextRequest, { profile }) => {
  if (!canManageHR(profile.orgPermission as OrgPermission)) {
    throw new PermissionError('Only HR managers and admins can upload HR documents')
  }

  const body = await parseBody(request)

  const targetProfileId = requireString(body.profileId, 'profileId')
  const documentType = requireEnum(body.documentType, 'documentType', HR_DOCUMENT_TYPES)
  const title = requireString(body.title, 'title', 500)
  const description = optionalString(body.description, 'description', 2000)
  const fileUrl = optionalString(body.fileUrl, 'fileUrl', 2000)
  const isConfidential = body.isConfidential === true

  // Verify profile is in same org
  const targetProfile = await modulesPrisma.profile.findUnique({
    where: { id: targetProfileId },
    select: { organisationId: true },
  })
  if (!targetProfile || targetProfile.organisationId !== profile.organisationId) {
    throw new PermissionError('Employee not found in your organisation')
  }

  const expiryDate = optionalDate(body.expiryDate, 'expiryDate')

  const document = await modulesPrisma.hRDocument.create({
    data: {
      profileId: targetProfileId,
      organisationId: profile.organisationId,
      documentType,
      title,
      description: description ?? null,
      fileUrl: fileUrl ?? null,
      expiryDate,
      isConfidential,
      uploadedById: profile.id,
    },
    include: {
      profile: { select: { id: true, fullName: true } },
    },
  })

  await recordAuditEvent({
    organisationId: profile.organisationId,
    actorId: profile.id,
    action: 'staffing.hr_document_created',
    entityType: 'hr_document',
    entityId: document.id,
    metadata: { documentType, title, targetProfileId },
  })

  return success({ document }, 201)
})

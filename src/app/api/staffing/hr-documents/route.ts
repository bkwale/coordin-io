import { NextRequest } from 'next/server'
import { success } from '@/lib/api-response'
import { withAuth } from '@/lib/with-auth'
import { modulesPrisma } from '@/lib/prisma-modules'
import { recordAuditEvent } from '@/lib/audit'
import { requireString, requireEnum, optionalString, parseBody } from '@/lib/validation'
import { PermissionError } from '@/lib/errors'

const HR_DOCUMENT_TYPES = [
  'CONTRACT', 'OFFER_LETTER', 'RIGHT_TO_WORK', 'VISA', 'DBS_CHECK',
  'PROFESSIONAL_MEMBERSHIP', 'QUALIFICATION', 'TRAINING_CERTIFICATE',
  'PERFORMANCE_REVIEW', 'DISCIPLINARY', 'GRIEVANCE',
  'POLICY_ACKNOWLEDGEMENT', 'OTHER',
] as const

/**
 * GET /api/staffing/hr-documents — List HR documents.
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

  const isAdmin = profile.orgPermission === 'ADMIN' || profile.orgPermission === 'OWNER'

  // Non-admins can only see their own documents
  if (!isAdmin && profileIdFilter && profileIdFilter !== profile.id) {
    throw new PermissionError('You can only view your own documents')
  }

  const where: Record<string, unknown> = {
    organisationId: profile.organisationId,
    ...(profileIdFilter
      ? { profileId: profileIdFilter }
      : isAdmin
        ? {}
        : { profileId: profile.id }),
    // Non-admins cannot see confidential docs unless they are their own
    ...(!isAdmin && !profileIdFilter ? {} : {}),
  }

  if (!isAdmin && profileIdFilter !== profile.id) {
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
 * Admin/Owner only.
 */
export const POST = withAuth(async (request: NextRequest, { profile }) => {
  const isAdmin = profile.orgPermission === 'ADMIN' || profile.orgPermission === 'OWNER'
  if (!isAdmin) {
    throw new PermissionError('Only admins can upload HR documents')
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

  // Parse optional expiry date
  let expiryDate: Date | null = null
  if (body.expiryDate) {
    expiryDate = new Date(body.expiryDate)
    if (isNaN(expiryDate.getTime())) {
      expiryDate = null
    }
  }

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

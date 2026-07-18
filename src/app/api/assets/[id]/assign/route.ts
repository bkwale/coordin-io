import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { success } from '@/lib/api-response'
import { withAuth } from '@/lib/with-auth'
import { recordAuditEvent, AuditActions } from '@/lib/audit'
import { requireId, optionalString, parseBody } from '@/lib/validation'
import { NotFoundError, PermissionError, ConflictError } from '@/lib/errors'

/**
 * POST /api/assets/[id]/assign — Assign asset to a user.
 */
export const POST = withAuth(async (request: NextRequest, { profile }) => {
  const id = request.url.match(/\/assets\/([^/?]+)\/assign/)?.[1]
  if (!id) throw new NotFoundError('Asset not found')

  const isAdmin = profile.orgPermission === 'ADMIN' || profile.orgPermission === 'OWNER'
  if (!isAdmin) {
    throw new PermissionError('Only an admin can assign assets')
  }

  const body = await parseBody(request)
  const profileId = requireId(body.profileId, 'Profile ID')
  const notes = optionalString(body.notes, 'Notes', 500)

  // Verify asset exists and belongs to org
  const asset = await prisma.asset.findUnique({
    where: { id },
    select: { id: true, organisationId: true },
  })

  if (!asset || asset.organisationId !== profile.organisationId) {
    throw new NotFoundError('Asset not found')
  }

  // Check if already assigned
  const existing = await prisma.assetAssignment.findFirst({
    where: { assetId: id, returnedAt: null },
  })

  if (existing) {
    throw new ConflictError('Asset is already assigned. Return it before reassigning.')
  }

  // Verify target profile exists in same org
  const targetProfile = await prisma.profile.findUnique({
    where: { id: profileId },
    select: { id: true, organisationId: true },
  })

  if (!targetProfile || targetProfile.organisationId !== profile.organisationId) {
    throw new NotFoundError('Target profile not found in your organisation')
  }

  const assignment = await prisma.assetAssignment.create({
    data: {
      assetId: id,
      profileId,
      notes,
    },
    include: {
      asset: { select: { id: true, name: true, assetTag: true } },
      profile: { select: { id: true, fullName: true } },
    },
  })

  await recordAuditEvent({
    organisationId: profile.organisationId,
    actorId: profile.id,
    action: AuditActions.ASSET_ASSIGNED,
    entityType: 'asset',
    entityId: id,
    metadata: { assignedTo: profileId },
    ipAddress: request.headers.get('x-forwarded-for') || undefined,
  })

  return success({ assignment }, 201)
})

/**
 * PATCH /api/assets/[id]/assign — Return / mark asset as returned.
 */
export const PATCH = withAuth(async (request: NextRequest, { profile }) => {
  const id = request.url.match(/\/assets\/([^/?]+)\/assign/)?.[1]
  if (!id) throw new NotFoundError('Asset not found')

  const isAdmin = profile.orgPermission === 'ADMIN' || profile.orgPermission === 'OWNER'
  if (!isAdmin) {
    throw new PermissionError('Only an admin can return assets')
  }

  // Find the current active assignment
  const asset = await prisma.asset.findUnique({
    where: { id },
    select: { id: true, organisationId: true },
  })

  if (!asset || asset.organisationId !== profile.organisationId) {
    throw new NotFoundError('Asset not found')
  }

  const activeAssignment = await prisma.assetAssignment.findFirst({
    where: { assetId: id, returnedAt: null },
  })

  if (!activeAssignment) {
    throw new NotFoundError('No active assignment found for this asset')
  }

  const updated = await prisma.assetAssignment.update({
    where: { id: activeAssignment.id },
    data: { returnedAt: new Date() },
    include: {
      asset: { select: { id: true, name: true, assetTag: true } },
      profile: { select: { id: true, fullName: true } },
    },
  })

  await recordAuditEvent({
    organisationId: profile.organisationId,
    actorId: profile.id,
    action: AuditActions.ASSET_RETURNED,
    entityType: 'asset',
    entityId: id,
    metadata: { returnedBy: activeAssignment.profileId },
    ipAddress: request.headers.get('x-forwarded-for') || undefined,
  })

  return success({ assignment: updated })
})

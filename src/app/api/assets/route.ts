import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { success } from '@/lib/api-response'
import { withAuth } from '@/lib/with-auth'
import { recordAuditEvent, AuditActions } from '@/lib/audit'
import { requireString, optionalString, optionalDate, requireEnum, parseBody } from '@/lib/validation'
import { PermissionError } from '@/lib/errors'

const ASSET_CATEGORIES = [
  'LAPTOP', 'MONITOR', 'PHONE', 'TABLET', 'HELMET',
  'HI_VIS', 'PPE_OTHER', 'FURNITURE', 'SOFTWARE', 'OTHER',
] as const

/**
 * GET /api/assets — List organisation assets.
 *
 * ?assigned=true — only show currently assigned assets.
 * ?category=LAPTOP — filter by category.
 */
export const GET = withAuth(async (request: NextRequest, { profile }) => {
  const url = new URL(request.url)
  const assignedOnly = url.searchParams.get('assigned') === 'true'
  const category = url.searchParams.get('category')

  const where: Record<string, unknown> = {
    organisationId: profile.organisationId,
  }

  if (category) {
    where.category = category
  }

  if (assignedOnly) {
    where.assignments = {
      some: { returnedAt: null },
    }
  }

  const assets = await prisma.asset.findMany({
    where,
    include: {
      assignments: {
        where: { returnedAt: null },
        include: {
          profile: { select: { id: true, fullName: true } },
        },
        take: 1,
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  return success({ assets })
})

/**
 * POST /api/assets — Create a new asset (admin only).
 */
export const POST = withAuth(async (request: NextRequest, { profile }) => {
  const isAdmin = profile.orgPermission === 'ADMIN' || profile.orgPermission === 'OWNER'
  if (!isAdmin) {
    throw new PermissionError('Only an admin can create assets')
  }

  const body = await parseBody(request)

  const name = requireString(body.name, 'Name', 200)
  const assetTag = requireString(body.assetTag, 'Asset tag', 50)
  const category = requireEnum(body.category, 'Category', ASSET_CATEGORIES)
  const serialNumber = optionalString(body.serialNumber, 'Serial number', 100)
  const purchaseDate = optionalDate(body.purchaseDate, 'Purchase date')
  const warrantyExpiry = optionalDate(body.warrantyExpiry, 'Warranty expiry')

  const asset = await prisma.asset.create({
    data: {
      organisationId: profile.organisationId,
      name,
      assetTag,
      category,
      serialNumber,
      purchaseDate,
      warrantyExpiry,
    },
    include: {
      assignments: {
        where: { returnedAt: null },
        include: {
          profile: { select: { id: true, fullName: true } },
        },
        take: 1,
      },
    },
  })

  await recordAuditEvent({
    organisationId: profile.organisationId,
    actorId: profile.id,
    action: AuditActions.ASSET_CREATED,
    entityType: 'asset',
    entityId: asset.id,
    metadata: { name, assetTag, category },
    ipAddress: request.headers.get('x-forwarded-for') || undefined,
  })

  return success({ asset }, 201)
})

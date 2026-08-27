import { NextRequest } from 'next/server'
import { success } from '@/lib/api-response'
import { withAuth } from '@/lib/with-auth'
import { prisma } from '@/lib/prisma'
import { modulesPrisma } from '@/lib/prisma-modules'
import { requireString, optionalString, parseBody } from '@/lib/validation'
import { NotFoundError, PermissionError, ValidationError } from '@/lib/errors'
import { recordAuditEvent } from '@/lib/audit'

const ASSET_CONDITIONS = ['NEW', 'GOOD', 'REPAIR_REQUIRED', 'DAMAGED', 'LOST', 'RETIRED'] as const

function getAssetId(url: string): string {
  const match = url.match(/\/assets\/([^/]+)\/condition-history/)
  return match?.[1] ?? ''
}

/**
 * GET /api/assets/[id]/condition-history — Return condition history for an asset.
 *
 * Ordered by changedAt desc (most recent first).
 */
export const GET = withAuth(async (request: NextRequest, { profile }) => {
  const assetId = getAssetId(request.url)
  if (!assetId) throw new NotFoundError('Asset not found')

  // Verify asset exists and belongs to org
  const asset = await prisma.asset.findUnique({
    where: { id: assetId },
    select: { id: true, organisationId: true },
  })

  if (!asset || asset.organisationId !== profile.organisationId) {
    throw new NotFoundError('Asset not found')
  }

  const history = await modulesPrisma.assetConditionHistory.findMany({
    where: { assetId },
    orderBy: { changedAt: 'desc' },
  })

  return success({ history })
})

/**
 * POST /api/assets/[id]/condition-history — Add a new condition entry.
 *
 * Requires HR/ADMIN/OWNER permission.
 * Also updates the asset's current condition field.
 */
export const POST = withAuth(async (request: NextRequest, { profile }) => {
  const assetId = getAssetId(request.url)
  if (!assetId) throw new NotFoundError('Asset not found')

  const isAllowed = ['ADMIN', 'OWNER', 'HR'].includes(profile.orgPermission)
  if (!isAllowed) {
    throw new PermissionError('Only HR, Admin, or Owner can update asset condition')
  }

  // Verify asset exists and belongs to org
  const asset = await prisma.asset.findUnique({
    where: { id: assetId },
    select: { id: true, organisationId: true, condition: true },
  })

  if (!asset || asset.organisationId !== profile.organisationId) {
    throw new NotFoundError('Asset not found')
  }

  const body = await parseBody(request)

  const condition = requireString(body.condition, 'condition', 50)
  if (!ASSET_CONDITIONS.includes(condition as typeof ASSET_CONDITIONS[number])) {
    throw new ValidationError(`condition must be one of: ${ASSET_CONDITIONS.join(', ')}`)
  }

  const notes = optionalString(body.notes, 'notes', 2000)

  // Create history entry and update asset condition atomically
  const entry = await modulesPrisma.assetConditionHistory.create({
    data: {
      assetId,
      condition,
      changedBy: profile.id,
      notes: notes ?? null,
    },
  })

  // Update the asset's current condition (validated against ASSET_CONDITIONS above)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await prisma.asset.update({
    where: { id: assetId },
    data: { condition: condition as any },
  })

  await recordAuditEvent({
    organisationId: profile.organisationId,
    actorId: profile.id,
    action: 'asset.condition_changed',
    entityType: 'asset',
    entityId: assetId,
    metadata: { previousCondition: asset.condition, newCondition: condition, notes },
  })

  return success({ entry }, 201)
})

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { success } from '@/lib/api-response'
import { withAuth } from '@/lib/with-auth'
import { recordAuditEvent, AuditActions } from '@/lib/audit'
import { optionalString, optionalEnum, optionalDate, parseBody } from '@/lib/validation'
import { NotFoundError, PermissionError } from '@/lib/errors'
import { modulesPrisma } from '@/lib/prisma-modules'
import { createNotification, NOTIFICATION_EVENTS } from '@/lib/notifications'

const ASSET_CONDITIONS = ['NEW', 'GOOD', 'REPAIR_REQUIRED', 'DAMAGED', 'LOST', 'RETIRED'] as const

/**
 * GET /api/assets/[id] — Get a single asset.
 */
export const GET = withAuth(async (request: NextRequest, { profile }) => {
  const id = request.url.match(/\/assets\/([^/?]+)/)?.[1]
  if (!id) throw new NotFoundError('Asset not found')

  const asset = await prisma.asset.findUnique({
    where: { id },
    include: {
      assignments: {
        include: {
          profile: { select: { id: true, fullName: true } },
        },
        orderBy: { assignedAt: 'desc' },
      },
    },
  })

  if (!asset) {
    throw new NotFoundError('Asset not found')
  }

  // Org boundary
  if (asset.organisationId !== profile.organisationId) {
    throw new NotFoundError('Asset not found')
  }

  return success({ asset })
})

/**
 * PATCH /api/assets/[id] — Update asset details (admin only).
 */
export const PATCH = withAuth(async (request: NextRequest, { profile }) => {
  const id = request.url.match(/\/assets\/([^/?]+)/)?.[1]
  if (!id) throw new NotFoundError('Asset not found')

  const isAdmin = profile.orgPermission === 'ADMIN' || profile.orgPermission === 'OWNER'
  if (!isAdmin) {
    throw new PermissionError('Only an admin can update assets')
  }

  const body = await parseBody(request)

  const asset = await prisma.asset.findUnique({
    where: { id },
    select: { id: true, organisationId: true },
  })

  if (!asset) {
    throw new NotFoundError('Asset not found')
  }

  if (asset.organisationId !== profile.organisationId) {
    throw new NotFoundError('Asset not found')
  }

  const updateData: Record<string, unknown> = {}
  if (body.name !== undefined) updateData.name = optionalString(body.name, 'Name', 200) ?? undefined
  if (body.serialNumber !== undefined) updateData.serialNumber = optionalString(body.serialNumber, 'Serial number', 100)
  const newCondition = optionalEnum(body.condition, 'Condition', ASSET_CONDITIONS)
  if (newCondition) updateData.condition = newCondition
  if (body.purchaseDate !== undefined) updateData.purchaseDate = optionalDate(body.purchaseDate, 'Purchase date')
  if (body.warrantyExpiry !== undefined) updateData.warrantyExpiry = optionalDate(body.warrantyExpiry, 'Warranty expiry')

  // Capture previous condition before update for history tracking
  const previousAsset = newCondition
    ? await prisma.asset.findUnique({ where: { id }, select: { condition: true } })
    : null

  const updated = await prisma.asset.update({
    where: { id },
    data: updateData,
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

  // Auto-create condition history entry when condition changes
  if (newCondition && previousAsset && previousAsset.condition !== newCondition) {
    await modulesPrisma.assetConditionHistory.create({
      data: {
        assetId: id,
        condition: newCondition,
        changedBy: profile.id,
      },
    })
  }

  await recordAuditEvent({
    organisationId: profile.organisationId,
    actorId: profile.id,
    action: AuditActions.ASSET_UPDATED,
    entityType: 'asset',
    entityId: id,
    metadata: { ...(newCondition ? { condition: newCondition, previousCondition: previousAsset?.condition } : {}) },
    ipAddress: request.headers.get('x-forwarded-for') || undefined,
  })

  /* ── Assignment handling ──────────────────────────────── */
  // assignedTo: profileId string → assign; null / "" → unassign
  if (body.assignedTo !== undefined) {
    // Return any active assignment first
    await modulesPrisma.assetAssignment.updateMany({
      where: { assetId: id, returnedAt: null },
      data: { returnedAt: new Date() },
    })

    // Create new assignment if a profileId was provided
    if (body.assignedTo) {
      await modulesPrisma.assetAssignment.create({
        data: {
          assetId: id,
          profileId: body.assignedTo,
        },
      })
      // Notify new assignee
      const assigneeId = body.assignedTo as string
      if (assigneeId !== profile.id) {
        await createNotification({
          profileId: assigneeId,
          type: NOTIFICATION_EVENTS.TASK_ASSIGNED,
          title: `You were assigned an asset: ${updated.name}`,
          linkUrl: `/assets/${id}`,
        }).catch(() => {})
      }
    }

    // Audit the assignment change
    await recordAuditEvent({
      organisationId: profile.organisationId,
      actorId: profile.id,
      action: body.assignedTo ? AuditActions.ASSET_UPDATED : AuditActions.ASSET_UPDATED,
      entityType: 'asset',
      entityId: id,
      metadata: { assignmentAction: body.assignedTo ? 'assigned' : 'unassigned', assignedTo: body.assignedTo || null },
      ipAddress: request.headers.get('x-forwarded-for') || undefined,
    })

    // Re-fetch with updated assignments
    const refreshed = await prisma.asset.findUnique({
      where: { id },
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

    return success({ asset: refreshed })
  }

  return success({ asset: updated })
})

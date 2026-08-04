import { NextRequest } from 'next/server'
import { success } from '@/lib/api-response'
import { withAuth } from '@/lib/with-auth'
import { modulesPrisma } from '@/lib/prisma-modules'
import { recordAuditEvent } from '@/lib/audit'
import { optionalString, optionalDate, optionalNumber, parseBody } from '@/lib/validation'
import { NotFoundError, PermissionError } from '@/lib/errors'
import { canManageHR, hasStaffingDashboardAccess } from '@/lib/staffing-utils'
import type { OrgPermission } from '@/generated/prisma/client'

/**
 * GET /api/staffing/training/[id] — Single training record with completions.
 *
 * Permission: HR+ sees all; MANAGER sees all; MEMBER sees only if they have a completion.
 */
export const GET = withAuth(async (request: NextRequest, { profile }) => {
  const url = new URL(request.url)
  const id = url.pathname.split('/').pop()!

  const item = await modulesPrisma.trainingItem.findUnique({
    where: { id },
    include: {
      completions: {
        include: {
          profile: { select: { id: true, fullName: true, jobTitle: true } },
        },
        orderBy: { completedAt: 'desc' },
      },
    },
  })

  if (!item) {
    throw new NotFoundError('Training record not found')
  }

  const role = profile.orgPermission as OrgPermission
  const hasHRAccess = canManageHR(role)
  const hasDashboardAccess = hasStaffingDashboardAccess(role)

  // Non-HR/manager can only see if they have a completion for this item
  if (!hasHRAccess && !hasDashboardAccess) {
    const hasCompletion = (item.completions as Array<{ profileId: string }>)
      .some((c: { profileId: string }) => c.profileId === profile.id)
    if (!hasCompletion) {
      throw new PermissionError('You do not have access to this training record')
    }
  }

  // Parse metadata
  let metadata: Record<string, unknown> = {}
  if (item.description && (item.description as string).startsWith('{')) {
    try { metadata = JSON.parse(item.description as string) } catch { /* not JSON */ }
  }

  const record = {
    id: item.id,
    title: item.title,
    provider: (metadata.provider as string) || null,
    category: (metadata.category as string) || 'CPD',
    description: (metadata.notes as string) || null,
    mandatory: item.mandatory,
    durationMinutes: item.durationMinutes,
    contentUrl: item.contentUrl,
    cpdHours: (metadata.cpdHours as number) || 0,
    expiryDate: (metadata.expiryDate as string) || null,
    renewalDate: (metadata.renewalDate as string) || null,
    profileId: (metadata.profileId as string) || null,
    completions: item.completions,
    createdAt: item.createdAt,
  }

  return success({ record })
})

/**
 * PATCH /api/staffing/training/[id] — Update a training record.
 *
 * Permission: HR+ can update everything. MANAGER can approve/update.
 */
export const PATCH = withAuth(async (request: NextRequest, { profile }) => {
  const url = new URL(request.url)
  const id = url.pathname.split('/').pop()!

  const role = profile.orgPermission as OrgPermission
  if (!canManageHR(role) && !hasStaffingDashboardAccess(role)) {
    throw new PermissionError('Only HR managers and admins can update training records')
  }

  const existing = await modulesPrisma.trainingItem.findUnique({ where: { id } })
  if (!existing) {
    throw new NotFoundError('Training record not found')
  }

  const body = await parseBody(request)

  const title = optionalString(body.title, 'title', 200)
  const provider = optionalString(body.provider, 'provider', 200)
  const category = optionalString(body.category, 'category', 50)
  const cpdHours = optionalNumber(body.cpdHours, 'cpdHours', { min: 0, max: 1000 })
  const expiryDate = optionalDate(body.expiryDate, 'expiryDate')
  const renewalDate = optionalDate(body.renewalDate, 'renewalDate')
  const notes = optionalString(body.notes, 'notes', 2000)
  const certificateUrl = optionalString(body.certificateUrl, 'certificateUrl', 2000)

  // Parse existing metadata
  let existingMeta: Record<string, unknown> = {}
  if (existing.description && (existing.description as string).startsWith('{')) {
    try { existingMeta = JSON.parse(existing.description as string) } catch { /* not JSON */ }
  }

  // Merge metadata
  const updatedMeta = JSON.stringify({
    ...existingMeta,
    ...(provider !== null ? { provider } : {}),
    ...(category !== null ? { category } : {}),
    ...(cpdHours !== null ? { cpdHours } : {}),
    ...(expiryDate ? { expiryDate: expiryDate.toISOString() } : {}),
    ...(renewalDate ? { renewalDate: renewalDate.toISOString() } : {}),
    ...(notes !== null ? { notes } : {}),
  })

  const updateData: Record<string, unknown> = {
    description: updatedMeta,
  }
  if (title) updateData.title = title
  if (body.isMandatory !== undefined) updateData.mandatory = body.isMandatory === true
  if (cpdHours !== null) updateData.durationMinutes = Math.round(cpdHours * 60)
  if (certificateUrl) updateData.contentUrl = certificateUrl

  const updated = await modulesPrisma.trainingItem.update({
    where: { id },
    data: updateData,
  })

  await recordAuditEvent({
    organisationId: profile.organisationId,
    actorId: profile.id,
    action: 'staffing.training_updated',
    entityType: 'training_item',
    entityId: id,
    metadata: { title: title || (existing.title as string) },
  })

  return success({ trainingItem: updated })
})

/**
 * DELETE /api/staffing/training/[id] — Remove a training record.
 *
 * Permission: HR+ only (HR, ADMIN, OWNER).
 */
export const DELETE = withAuth(async (request: NextRequest, { profile }) => {
  const url = new URL(request.url)
  const id = url.pathname.split('/').pop()!

  if (!canManageHR(profile.orgPermission as OrgPermission)) {
    throw new PermissionError('Only HR managers and admins can delete training records')
  }

  const existing = await modulesPrisma.trainingItem.findUnique({ where: { id } })
  if (!existing) {
    throw new NotFoundError('Training record not found')
  }

  // Delete completions first (cascade)
  await modulesPrisma.trainingCompletion.deleteMany({
    where: { trainingId: id },
  })

  await modulesPrisma.trainingItem.delete({ where: { id } })

  await recordAuditEvent({
    organisationId: profile.organisationId,
    actorId: profile.id,
    action: 'staffing.training_deleted',
    entityType: 'training_item',
    entityId: id,
    metadata: { title: existing.title as string },
  })

  return success({ deleted: true })
})

import { NextRequest } from 'next/server'
import { success } from '@/lib/api-response'
import { withAuth } from '@/lib/with-auth'
import { modulesPrisma } from '@/lib/prisma-modules'
import { recordAuditEvent } from '@/lib/audit'
import {
  requireString, optionalString, optionalDate, optionalNumber,
  parseBody,
} from '@/lib/validation'
import { PermissionError } from '@/lib/errors'
import { createNotification, NOTIFICATION_EVENTS } from '@/lib/notifications'

const TRAINING_CATEGORIES = [
  'MANDATORY', 'PROFESSIONAL', 'CPD', 'HEALTH_SAFETY', 'COMPLIANCE',
] as const

/**
 * GET /api/staffing/training — List training records for the org.
 *
 * Admin/HR see all; employees see their own.
 * Supports ?profileId= filter.
 */
export const GET = withAuth(async (request: NextRequest, { profile }) => {
  const url = new URL(request.url)
  const profileIdFilter = url.searchParams.get('profileId')

  const isAdmin = profile.orgPermission === 'ADMIN' || profile.orgPermission === 'OWNER'
  const isManager = profile.orgPermission === 'MANAGER'

  // Non-admin/manager can only see their own
  if (!isAdmin && !isManager && profileIdFilter && profileIdFilter !== profile.id) {
    throw new PermissionError('You can only view your own training records')
  }

  // Build filter for completions
  const completionWhere: Record<string, unknown> = {}
  if (profileIdFilter) {
    completionWhere.profileId = profileIdFilter
  } else if (!isAdmin && !isManager) {
    completionWhere.profileId = profile.id
  }

  // Get training items with their completions
  const trainingItems = await modulesPrisma.trainingItem.findMany({
    include: {
      completions: {
        where: Object.keys(completionWhere).length > 0 ? completionWhere : undefined,
        include: {
          profile: { select: { id: true, fullName: true, jobTitle: true } },
        },
        orderBy: { completedAt: 'desc' },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 200,
  })

  // Build enriched records
  const now = new Date()
  const records = trainingItems.map((item: Record<string, unknown>) => {
    // Parse metadata from description if it's JSON
    let metadata: Record<string, unknown> = {}
    const description = item.description as string | null
    if (description && description.startsWith('{')) {
      try { metadata = JSON.parse(description) } catch { /* not JSON */ }
    }

    const completions = (item.completions || []) as Array<Record<string, unknown>>

    // Determine expiry status
    const expiryDate = metadata.expiryDate ? new Date(metadata.expiryDate as string) : null
    let expiryStatus = 'current'
    if (expiryDate) {
      if (expiryDate < now) {
        expiryStatus = 'expired'
      } else {
        const sixtyDaysFromNow = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000)
        if (expiryDate <= sixtyDaysFromNow) {
          expiryStatus = 'expiring'
        }
      }
    }

    return {
      id: item.id,
      title: item.title,
      provider: (metadata.provider as string) || null,
      category: (metadata.category as string) || 'CPD',
      description: (metadata.notes as string) || (description && !description.startsWith('{') ? description : null),
      mandatory: item.mandatory,
      durationMinutes: item.durationMinutes,
      contentUrl: item.contentUrl,
      cpdHours: (metadata.cpdHours as number) || (item.durationMinutes ? Math.round((item.durationMinutes as number) / 60 * 10) / 10 : 0),
      expiryDate: expiryDate?.toISOString() || null,
      renewalDate: (metadata.renewalDate as string) || null,
      expiryStatus,
      profileId: (metadata.profileId as string) || null,
      completions,
      completionCount: completions.length,
      createdAt: item.createdAt,
    }
  })

  return success({ records })
})

/**
 * POST /api/staffing/training — Create a new training record.
 *
 * Admin/HR only.
 */
export const POST = withAuth(async (request: NextRequest, { profile }) => {
  const isAdmin = profile.orgPermission === 'ADMIN' || profile.orgPermission === 'OWNER'
  if (!isAdmin) {
    throw new PermissionError('Only admins can create training records')
  }

  const body = await parseBody(request)

  const title = requireString(body.title, 'title', 200)
  const provider = optionalString(body.provider, 'provider', 200)
  const category = optionalString(body.category, 'category', 50) || 'CPD'
  const completedDate = optionalDate(body.completedDate, 'completedDate')
  const cpdHours = optionalNumber(body.cpdHours, 'cpdHours', { min: 0, max: 1000 })
  const isMandatory = body.isMandatory === true
  const certificateUrl = optionalString(body.certificateUrl, 'certificateUrl', 2000)
  const expiryDate = optionalDate(body.expiryDate, 'expiryDate')
  const renewalDate = optionalDate(body.renewalDate, 'renewalDate')
  const notes = optionalString(body.notes, 'notes', 2000)
  const targetProfileId = optionalString(body.profileId, 'profileId')

  // Validate category
  if (!TRAINING_CATEGORIES.includes(category as typeof TRAINING_CATEGORIES[number])) {
    // Allow it anyway but default to CPD
  }

  // Store metadata in the description field as JSON
  const metadata = JSON.stringify({
    provider,
    category,
    cpdHours: cpdHours ?? 0,
    expiryDate: expiryDate?.toISOString() || null,
    renewalDate: renewalDate?.toISOString() || null,
    notes,
    profileId: targetProfileId,
  })

  const durationMinutes = cpdHours ? Math.round(cpdHours * 60) : null

  const trainingItem = await modulesPrisma.trainingItem.create({
    data: {
      title,
      description: metadata,
      mandatory: isMandatory,
      durationMinutes,
      contentUrl: certificateUrl,
    },
  })

  // If a target profile and completedDate are provided, create the completion
  if (targetProfileId && completedDate) {
    await modulesPrisma.trainingCompletion.create({
      data: {
        profileId: targetProfileId,
        trainingId: trainingItem.id,
        completedAt: completedDate,
        certificateUrl,
      },
    })
  }

  // Check for expiring training — send notification
  if (expiryDate && targetProfileId) {
    const now = new Date()
    const sixtyDaysFromNow = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000)
    if (expiryDate <= sixtyDaysFromNow && expiryDate > now) {
      await createNotification({
        profileId: targetProfileId,
        type: NOTIFICATION_EVENTS.TRAINING_EXPIRING,
        title: `Training expiring: ${title}`,
        body: `Your "${title}" training certificate is expiring on ${expiryDate.toLocaleDateString('en-GB')}. Please arrange renewal.`,
        linkUrl: `/staffing/${targetProfileId}`,
      })
    }
  }

  await recordAuditEvent({
    organisationId: profile.organisationId,
    actorId: profile.id,
    action: 'staffing.training_created',
    entityType: 'training_item',
    entityId: trainingItem.id,
    metadata: { title, category, targetProfileId },
  })

  return success({ trainingItem }, 201)
})

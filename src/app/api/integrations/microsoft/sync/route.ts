import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { success } from '@/lib/api-response'
import { withAuth } from '@/lib/with-auth'
import { ValidationError, PermissionError, NotFoundError } from '@/lib/errors'
import { parseBody } from '@/lib/validation'
import { recordAuditEvent } from '@/lib/audit'

/**
 * POST /api/integrations/microsoft/sync — Trigger a manual sync.
 *
 * ADMIN/OWNER only. Body: { service?: 'calendar' | 'files' | 'mail' | 'all' }
 * Defaults to 'all' — syncs all enabled services.
 *
 * Phase 1: stub — marks sync as complete with a timestamp.
 * Phase 2: will call syncCalendarToOutlook, syncFilesToSharePoint, etc.
 */
export const POST = withAuth(async (request: NextRequest, { profile }) => {
  if (profile.orgPermission !== 'ADMIN' && profile.orgPermission !== 'OWNER') {
    throw new PermissionError('Only admins and owners can trigger syncs')
  }

  const connection = await prisma.microsoftConnection.findFirst({
    where: { organisationId: profile.organisationId, active: true },
  })

  if (!connection) {
    throw new NotFoundError('No active Microsoft connection — connect Microsoft first')
  }

  // Guard against concurrent syncs
  if (connection.lastSyncStatus === 'IN_PROGRESS') {
    throw new ValidationError('A sync is already in progress — please wait')
  }

  const body = await parseBody(request)
  const service = typeof body.service === 'string' ? body.service : 'all'

  // Mark sync as in progress
  await prisma.microsoftConnection.update({
    where: { id: connection.id },
    data: { lastSyncStatus: 'IN_PROGRESS', lastSyncError: null },
  })

  try {
    // Phase 1: stub — just mark as synced
    // Phase 2: call actual sync functions from sync-engine.ts
    const results: Record<string, { synced: number; failed: number; skipped: number }> = {}

    if (service === 'all' || service === 'calendar') {
      if (connection.syncCalendar) {
        results.calendar = { synced: 0, failed: 0, skipped: 0 }
      }
    }

    if (service === 'all' || service === 'files') {
      if (connection.syncFiles) {
        results.files = { synced: 0, failed: 0, skipped: 0 }
      }
    }

    if (service === 'all' || service === 'mail') {
      if (connection.syncMail) {
        results.mail = { synced: 0, failed: 0, skipped: 0 }
      }
    }

    await prisma.microsoftConnection.update({
      where: { id: connection.id },
      data: {
        lastSyncAt: new Date(),
        lastSyncStatus: 'SUCCESS',
        lastSyncError: null,
      },
    })

    await recordAuditEvent({
      organisationId: profile.organisationId,
      actorId: profile.id,
      action: 'microsoft.sync_completed',
      entityType: 'integration',
      entityId: connection.id,
      metadata: { service, results },
    })

    return success({ status: 'SUCCESS', results })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    await prisma.microsoftConnection.update({
      where: { id: connection.id },
      data: {
        lastSyncAt: new Date(),
        lastSyncStatus: 'FAILED',
        lastSyncError: message.slice(0, 500),
      },
    })

    throw err
  }
})

/**
 * PATCH /api/integrations/microsoft/sync — Update sync configuration.
 *
 * ADMIN/OWNER only. Body: { syncCalendar?, syncFiles?, syncMail?,
 *   sharepointSiteId?, sharepointSiteName?, sharepointSiteUrl? }
 */
export const PATCH = withAuth(async (request: NextRequest, { profile }) => {
  if (profile.orgPermission !== 'ADMIN' && profile.orgPermission !== 'OWNER') {
    throw new PermissionError('Only admins and owners can update sync settings')
  }

  const connection = await prisma.microsoftConnection.findFirst({
    where: { organisationId: profile.organisationId, active: true },
  })

  if (!connection) {
    throw new NotFoundError('No active Microsoft connection')
  }

  const body = await parseBody(request)

  const data: Record<string, unknown> = {}
  if (typeof body.syncCalendar === 'boolean') data.syncCalendar = body.syncCalendar
  if (typeof body.syncFiles === 'boolean') data.syncFiles = body.syncFiles
  if (typeof body.syncMail === 'boolean') data.syncMail = body.syncMail
  if (typeof body.sharepointSiteId === 'string') data.sharepointSiteId = body.sharepointSiteId || null
  if (typeof body.sharepointSiteName === 'string') data.sharepointSiteName = body.sharepointSiteName || null
  if (typeof body.sharepointSiteUrl === 'string') data.sharepointSiteUrl = body.sharepointSiteUrl || null

  if (Object.keys(data).length === 0) {
    throw new ValidationError('No valid fields to update')
  }

  const updated = await prisma.microsoftConnection.update({
    where: { id: connection.id },
    data,
    select: {
      id: true,
      syncCalendar: true,
      syncFiles: true,
      syncMail: true,
      sharepointSiteId: true,
      sharepointSiteName: true,
      sharepointSiteUrl: true,
    },
  })

  return success({ connection: updated })
})

/**
 * Microsoft Graph sync engine — calendar events + SharePoint files.
 *
 * Follows the same pattern as the Xero sync engine:
 *  - Per-service sync functions
 *  - Sync log tracking per entity
 *  - Full sync orchestrator
 */

import { prisma } from '@/lib/prisma'
import * as graph from './api-client'
import type { SyncResult, MsEvent } from './types'

/* ── Calendar Sync ────────────────────────────────────── */

/**
 * Sync project milestones → Outlook calendar events.
 *
 * For each milestone with a dueDate in the org's projects:
 *  - No existing sync log → create event in Outlook
 *  - Existing sync log → update event in Outlook
 *  - Cancelled/completed milestones → skip (future: delete event)
 */
export async function syncCalendarEvents(connectionId: string): Promise<SyncResult> {
  const result: SyncResult = { synced: 0, failed: 0, skipped: 0, errors: [] }

  const connection = await prisma.microsoftConnection.findUnique({
    where: { id: connectionId },
    select: {
      id: true,
      organisationId: true,
      active: true,
    },
  })

  if (!connection || !connection.active) {
    return { ...result, failed: 1, errors: [{ entityId: connectionId, message: 'Connection inactive or not found' }] }
  }

  // Fetch all milestones for this org's projects
  const milestones = await prisma.projectMilestone.findMany({
    where: {
      project: { organisationId: connection.organisationId },
      status: { notIn: ['CANCELLED'] },
    },
    include: {
      project: { select: { name: true, id: true } },
    },
  })

  for (const milestone of milestones) {
    try {
      // Check for existing sync log
      const existingLog = await prisma.microsoftSyncLog.findFirst({
        where: {
          connectionId,
          entityType: 'event',
          entityId: milestone.id,
          status: 'SUCCESS',
        },
        orderBy: { createdAt: 'desc' },
      })

      // Build the Outlook event payload
      const eventPayload: Partial<MsEvent> = {
        subject: `[${milestone.project.name}] ${milestone.title}`,
        body: {
          contentType: 'text',
          content: milestone.description || `Milestone for project: ${milestone.project.name}`,
        },
        start: {
          dateTime: milestone.dueDate.toISOString(),
          timeZone: 'UTC',
        },
        end: {
          dateTime: milestone.dueDate.toISOString(),
          timeZone: 'UTC',
        },
        isAllDay: true,
        showAs: 'busy',
        importance: milestone.priority === 'CRITICAL' ? 'high'
          : milestone.priority === 'HIGH' ? 'high'
          : 'normal',
      }

      if (existingLog?.msId) {
        // Update existing event
        await graph.updateEvent(connectionId, existingLog.msId, eventPayload)

        await prisma.microsoftSyncLog.create({
          data: {
            connectionId,
            direction: 'TO_MICROSOFT',
            service: 'CALENDAR',
            entityType: 'event',
            entityId: milestone.id,
            msId: existingLog.msId,
            action: 'update',
            status: 'SUCCESS',
          },
        })
      } else {
        // Create new event
        const created = await graph.createEvent(connectionId, eventPayload)

        await prisma.microsoftSyncLog.create({
          data: {
            connectionId,
            direction: 'TO_MICROSOFT',
            service: 'CALENDAR',
            entityType: 'event',
            entityId: milestone.id,
            msId: created.id || null,
            action: 'create',
            status: 'SUCCESS',
          },
        })
      }

      result.synced++
    } catch (err) {
      result.failed++
      result.errors.push({
        entityId: milestone.id,
        message: err instanceof Error ? err.message : 'Unknown error',
      })

      // Log the failure
      await prisma.microsoftSyncLog.create({
        data: {
          connectionId,
          direction: 'TO_MICROSOFT',
          service: 'CALENDAR',
          entityType: 'event',
          entityId: milestone.id,
          action: 'create',
          status: 'FAILED',
          error: err instanceof Error ? err.message : 'Unknown error',
        },
      }).catch(() => {}) // Don't fail the loop on log write errors
    }
  }

  return result
}

/* ── File Sync ────────────────────────────────────────── */

/**
 * Sync documents ↔ SharePoint/OneDrive.
 *
 * TODO: Wire into SharePoint document libraries once the
 * SharePoint site binding flow is built. Will need:
 *  - Upload new document revisions from Coordin → SharePoint
 *  - Download new files from SharePoint → Coordin document register
 *  - Sync metadata (revision numbers, authors, dates)
 */
export async function syncFiles(connectionId: string): Promise<SyncResult> {
  // Stub — returns empty result until SharePoint site binding is wired
  const connection = await prisma.microsoftConnection.findUnique({
    where: { id: connectionId },
    select: { active: true, sharepointSiteId: true },
  })

  if (!connection?.active) {
    return { synced: 0, failed: 1, skipped: 0, errors: [{ entityId: connectionId, message: 'Connection inactive' }] }
  }

  if (!connection.sharepointSiteId) {
    return { synced: 0, failed: 0, skipped: 1, errors: [{ entityId: connectionId, message: 'No SharePoint site bound — configure in Settings → Integrations' }] }
  }

  // TODO: Implement SharePoint document library sync
  return { synced: 0, failed: 0, skipped: 0, errors: [] }
}

/* ── Full Sync Orchestrator ───────────────────────────── */

export interface FullSyncResult {
  calendar?: SyncResult
  files?: SyncResult
  mail?: SyncResult
}

/**
 * Run all enabled syncs for a Microsoft connection.
 * Updates the connection's lastSyncAt and lastSyncStatus.
 */
export async function runFullSync(connectionId: string): Promise<FullSyncResult> {
  const connection = await prisma.microsoftConnection.findUnique({
    where: { id: connectionId },
    select: {
      id: true,
      active: true,
      syncCalendar: true,
      syncFiles: true,
      syncMail: true,
    },
  })

  if (!connection || !connection.active) {
    throw new Error('Microsoft connection not found or inactive')
  }

  // Mark sync as in progress
  await prisma.microsoftConnection.update({
    where: { id: connectionId },
    data: { lastSyncStatus: 'IN_PROGRESS' },
  })

  const results: FullSyncResult = {}
  let hasFailure = false
  let hasPartial = false

  try {
    // Calendar sync — milestones → Outlook events
    if (connection.syncCalendar) {
      results.calendar = await syncCalendarEvents(connectionId)
      if (results.calendar.failed > 0 && results.calendar.synced === 0) hasFailure = true
      if (results.calendar.failed > 0 && results.calendar.synced > 0) hasPartial = true
    }

    // File sync — documents ↔ SharePoint/OneDrive
    if (connection.syncFiles) {
      results.files = await syncFiles(connectionId)
      if (results.files.failed > 0 && results.files.synced === 0) hasFailure = true
      if (results.files.failed > 0 && results.files.synced > 0) hasPartial = true
    }

    // Mail sync — read-only, future implementation
    // if (connection.syncMail) { ... }

    // Determine overall status
    const status = hasFailure ? 'FAILED' as const
      : hasPartial ? 'PARTIAL' as const
      : 'SUCCESS' as const

    await prisma.microsoftConnection.update({
      where: { id: connectionId },
      data: {
        lastSyncAt: new Date(),
        lastSyncStatus: status,
        lastSyncError: hasFailure || hasPartial
          ? JSON.stringify(
              Object.entries(results)
                .filter(([, r]) => r && r.errors.length > 0)
                .map(([svc, r]) => ({ service: svc, errors: r!.errors.slice(0, 5) }))
            )
          : null,
      },
    })

    return results
  } catch (err) {
    // Unexpected top-level error
    await prisma.microsoftConnection.update({
      where: { id: connectionId },
      data: {
        lastSyncAt: new Date(),
        lastSyncStatus: 'FAILED',
        lastSyncError: err instanceof Error ? err.message : 'Unknown sync error',
      },
    })
    throw err
  }
}

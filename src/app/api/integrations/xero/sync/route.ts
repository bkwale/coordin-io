import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { success } from '@/lib/api-response'
import { withAuth } from '@/lib/with-auth'
import { ValidationError, PermissionError, NotFoundError } from '@/lib/errors'
import { isFeatureEnabled } from '@/lib/feature-flags'
import { parseBody } from '@/lib/validation'
import { syncInvoicesToXero, syncInboundInvoicesToXero, syncContactsToXero } from '@/lib/integrations/xero/sync-engine'
import { recordAuditEvent } from '@/lib/audit'
import type { SyncResult } from '@/lib/integrations/xero/types'

/**
 * POST /api/integrations/xero/sync — Trigger a manual sync.
 *
 * ADMIN/OWNER only. Body: { direction?: 'outbound' | 'inbound' | 'contacts' | 'all' }
 * Defaults to 'all' — syncs outbound invoices, inbound invoices, and contacts.
 */
export const POST = withAuth(async (request: NextRequest, { profile }) => {
  const enabled = await isFeatureEnabled(profile.organisationId, 'invoicing')
  if (!enabled) {
    throw new ValidationError('Invoicing is not enabled for your organisation')
  }

  if (profile.orgPermission !== 'ADMIN' && profile.orgPermission !== 'OWNER') {
    throw new PermissionError('Only admins and owners can trigger syncs')
  }

  const connection = await prisma.xeroConnection.findFirst({
    where: { organisationId: profile.organisationId, active: true },
  })

  if (!connection) {
    throw new NotFoundError('No active Xero connection — connect Xero first')
  }

  // Guard against concurrent syncs
  if (connection.lastSyncStatus === 'IN_PROGRESS') {
    throw new ValidationError('A sync is already in progress — please wait')
  }

  const body = await parseBody(request)
  const direction = typeof body.direction === 'string' ? body.direction : 'all'

  // Mark sync as in progress
  await prisma.xeroConnection.update({
    where: { id: connection.id },
    data: { lastSyncStatus: 'IN_PROGRESS', lastSyncError: null },
  })

  const results: Record<string, SyncResult> = {}

  try {
    if (direction === 'all' || direction === 'contacts') {
      if (connection.syncContacts) {
        results.contacts = await syncContactsToXero(connection.id, connection.organisationId)
      }
    }

    if (direction === 'all' || direction === 'outbound') {
      if (connection.syncOutbound) {
        results.outbound = await syncInvoicesToXero(connection.id, connection.organisationId)
      }
    }

    if (direction === 'all' || direction === 'inbound') {
      if (connection.syncInbound) {
        results.inbound = await syncInboundInvoicesToXero(connection.id, connection.organisationId)
      }
    }

    // Determine overall status
    const allResults = Object.values(results)
    const anyFailed = allResults.some((r) => r.failed > 0)
    const anySynced = allResults.some((r) => r.synced > 0)

    const overallStatus = anyFailed
      ? (anySynced ? 'PARTIAL' : 'FAILED')
      : (anySynced ? 'SUCCESS' : 'SUCCESS')

    await prisma.xeroConnection.update({
      where: { id: connection.id },
      data: {
        lastSyncAt: new Date(),
        lastSyncStatus: overallStatus as 'SUCCESS' | 'PARTIAL' | 'FAILED',
        lastSyncError: anyFailed
          ? allResults.flatMap((r) => r.errors.map((e) => e.message)).join('; ').slice(0, 500)
          : null,
      },
    })

    await recordAuditEvent({
      organisationId: profile.organisationId,
      actorId: profile.id,
      action: 'xero.sync_completed',
      entityType: 'integration',
      entityId: connection.id,
      metadata: { direction, status: overallStatus, results },
    })

    return success({ status: overallStatus, results })
  } catch (err) {
    // Mark sync as failed on unexpected error
    const message = err instanceof Error ? err.message : 'Unknown error'
    await prisma.xeroConnection.update({
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
 * PATCH /api/integrations/xero/sync — Update sync configuration.
 *
 * ADMIN/OWNER only. Body: { syncInbound?, syncOutbound?, syncContacts?, defaultAccountCode? }
 */
export const PATCH = withAuth(async (request: NextRequest, { profile }) => {
  const enabled = await isFeatureEnabled(profile.organisationId, 'invoicing')
  if (!enabled) {
    throw new ValidationError('Invoicing is not enabled for your organisation')
  }

  if (profile.orgPermission !== 'ADMIN' && profile.orgPermission !== 'OWNER') {
    throw new PermissionError('Only admins and owners can update sync settings')
  }

  const connection = await prisma.xeroConnection.findFirst({
    where: { organisationId: profile.organisationId, active: true },
  })

  if (!connection) {
    throw new NotFoundError('No active Xero connection')
  }

  const body = await parseBody(request)

  const data: Record<string, unknown> = {}
  if (typeof body.syncInbound === 'boolean') data.syncInbound = body.syncInbound
  if (typeof body.syncOutbound === 'boolean') data.syncOutbound = body.syncOutbound
  if (typeof body.syncContacts === 'boolean') data.syncContacts = body.syncContacts
  if (typeof body.defaultAccountCode === 'string') data.defaultAccountCode = body.defaultAccountCode || null

  if (Object.keys(data).length === 0) {
    throw new ValidationError('No valid fields to update')
  }

  const updated = await prisma.xeroConnection.update({
    where: { id: connection.id },
    data,
    select: {
      id: true,
      syncInbound: true,
      syncOutbound: true,
      syncContacts: true,
      defaultAccountCode: true,
    },
  })

  return success({ connection: updated })
})

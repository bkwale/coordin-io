import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { success } from '@/lib/api-response'
import { withAuth } from '@/lib/with-auth'
import { PermissionError, NotFoundError } from '@/lib/errors'
import { buildAuthUrl } from '@/lib/integrations/microsoft/oauth'
import { recordAuditEvent } from '@/lib/audit'

/**
 * GET /api/integrations/microsoft — Get Microsoft connection status for the org.
 *
 * ADMIN/OWNER/MANAGER only.
 */
export const GET = withAuth(async (_request: NextRequest, { profile }) => {
  if (!['ADMIN', 'OWNER', 'MANAGER'].includes(profile.orgPermission)) {
    throw new PermissionError('Only admins, owners and managers can view integrations')
  }

  const connection = await prisma.microsoftConnection.findFirst({
    where: { organisationId: profile.organisationId, active: true },
    select: {
      id: true,
      msTenantName: true,
      msTenantId: true,
      msUserEmail: true,
      syncCalendar: true,
      syncFiles: true,
      syncMail: true,
      sharepointSiteUrl: true,
      sharepointSiteName: true,
      lastSyncAt: true,
      lastSyncStatus: true,
      lastSyncError: true,
      connectedAt: true,
      connectedBy: { select: { id: true, fullName: true } },
    },
  })

  return success({
    connected: !!connection,
    connection,
    configRequired: !process.env.MS_CLIENT_ID,
  })
})

/**
 * POST /api/integrations/microsoft — Start the Microsoft OAuth flow (returns auth URL).
 *
 * ADMIN/OWNER only. Creates a pending connection row to store the code verifier.
 */
export const POST = withAuth(async (_request: NextRequest, { profile }) => {
  if (profile.orgPermission !== 'ADMIN' && profile.orgPermission !== 'OWNER') {
    throw new PermissionError('Only admins and owners can connect Microsoft')
  }

  if (!process.env.MS_CLIENT_ID || !process.env.MS_CLIENT_SECRET || !process.env.MS_REDIRECT_URI) {
    throw new PermissionError('Microsoft integration is not configured — contact your administrator')
  }

  const { url, state, codeVerifier } = await buildAuthUrl(profile.organisationId)

  // Clean up any stale pending connections
  await prisma.microsoftConnection.deleteMany({
    where: {
      organisationId: profile.organisationId,
      msTenantName: null,
      active: false,
    },
  })

  // Store state + codeVerifier in a pending connection row
  await prisma.microsoftConnection.create({
    data: {
      organisationId: profile.organisationId,
      msTenantId: `pending:${state}`,
      accessToken: codeVerifier, // temporarily store code verifier here
      refreshToken: '',
      tokenExpiresAt: new Date(Date.now() + 600_000), // 10min for flow completion
      scopes: [],
      active: false,
      connectedById: profile.id,
    },
  })

  await recordAuditEvent({
    organisationId: profile.organisationId,
    actorId: profile.id,
    action: 'microsoft.connect_started',
    entityType: 'integration',
    entityId: 'microsoft',
    metadata: {},
  })

  return success({ authUrl: url })
})

/**
 * DELETE /api/integrations/microsoft — Disconnect Microsoft from the org.
 *
 * ADMIN/OWNER only. Soft-deletes by setting active=false.
 */
export const DELETE = withAuth(async (_request: NextRequest, { profile }) => {
  if (profile.orgPermission !== 'ADMIN' && profile.orgPermission !== 'OWNER') {
    throw new PermissionError('Only admins and owners can disconnect Microsoft')
  }

  const connection = await prisma.microsoftConnection.findFirst({
    where: { organisationId: profile.organisationId, active: true },
  })

  if (!connection) {
    throw new NotFoundError('No active Microsoft connection found')
  }

  await prisma.microsoftConnection.update({
    where: { id: connection.id },
    data: {
      active: false,
      disconnectedAt: new Date(),
    },
  })

  await recordAuditEvent({
    organisationId: profile.organisationId,
    actorId: profile.id,
    action: 'microsoft.disconnected',
    entityType: 'integration',
    entityId: connection.id,
    metadata: { msTenantName: connection.msTenantName },
  })

  return success({ disconnected: true })
})

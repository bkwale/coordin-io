import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { success } from '@/lib/api-response'
import { withAuth } from '@/lib/with-auth'
import { ValidationError, PermissionError, NotFoundError } from '@/lib/errors'
import { isFeatureEnabled } from '@/lib/feature-flags'
import { buildAuthUrl } from '@/lib/integrations/xero/oauth'
import { recordAuditEvent } from '@/lib/audit'

/**
 * GET /api/integrations/xero — Get the Xero connection status for the org.
 *
 * ADMIN/OWNER only. Feature-gated on 'invoicing'.
 */
export const GET = withAuth(async (_request: NextRequest, { profile }) => {
  const enabled = await isFeatureEnabled(profile.organisationId, 'invoicing')
  if (!enabled) {
    throw new ValidationError('Invoicing is not enabled for your organisation')
  }

  if (profile.orgPermission !== 'ADMIN' && profile.orgPermission !== 'OWNER') {
    throw new PermissionError('Only admins and owners can manage integrations')
  }

  const connection = await prisma.xeroConnection.findFirst({
    where: { organisationId: profile.organisationId, active: true },
    select: {
      id: true,
      xeroTenantName: true,
      xeroTenantId: true,
      syncInbound: true,
      syncOutbound: true,
      syncContacts: true,
      defaultAccountCode: true,
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
    configRequired: !process.env.XERO_CLIENT_ID,
  })
})

/**
 * POST /api/integrations/xero — Start the Xero OAuth flow (returns auth URL).
 *
 * ADMIN/OWNER only. Feature-gated.
 */
export const POST = withAuth(async (_request: NextRequest, { profile }) => {
  const enabled = await isFeatureEnabled(profile.organisationId, 'invoicing')
  if (!enabled) {
    throw new ValidationError('Invoicing is not enabled for your organisation')
  }

  if (profile.orgPermission !== 'ADMIN' && profile.orgPermission !== 'OWNER') {
    throw new PermissionError('Only admins and owners can connect Xero')
  }

  if (!process.env.XERO_CLIENT_ID || !process.env.XERO_CLIENT_SECRET || !process.env.XERO_REDIRECT_URI) {
    throw new ValidationError('Xero integration is not configured — contact your administrator')
  }

  const { url, state, codeVerifier } = await buildAuthUrl(profile.organisationId)

  // Store state + codeVerifier temporarily for the callback to validate.
  // We use the existing XeroConnection table with a placeholder tenant ID.
  // On callback, we'll update with real tenant info.
  // Delete any pending (inactive, no tenant name) connection first.
  await prisma.xeroConnection.deleteMany({
    where: {
      organisationId: profile.organisationId,
      xeroTenantName: null,
      active: false,
    },
  })

  await prisma.xeroConnection.create({
    data: {
      organisationId: profile.organisationId,
      xeroTenantId: `pending:${state}`,
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
    action: 'xero.connect_started',
    entityType: 'integration',
    entityId: 'xero',
    metadata: {},
  })

  return success({ authUrl: url })
})

/**
 * DELETE /api/integrations/xero — Disconnect Xero from the org.
 *
 * ADMIN/OWNER only. Soft-deletes by setting active=false.
 */
export const DELETE = withAuth(async (_request: NextRequest, { profile }) => {
  const enabled = await isFeatureEnabled(profile.organisationId, 'invoicing')
  if (!enabled) {
    throw new ValidationError('Invoicing is not enabled for your organisation')
  }

  if (profile.orgPermission !== 'ADMIN' && profile.orgPermission !== 'OWNER') {
    throw new PermissionError('Only admins and owners can disconnect Xero')
  }

  const connection = await prisma.xeroConnection.findFirst({
    where: { organisationId: profile.organisationId, active: true },
  })

  if (!connection) {
    throw new NotFoundError('No active Xero connection found')
  }

  await prisma.xeroConnection.update({
    where: { id: connection.id },
    data: {
      active: false,
      disconnectedAt: new Date(),
    },
  })

  await recordAuditEvent({
    organisationId: profile.organisationId,
    actorId: profile.id,
    action: 'xero.disconnected',
    entityType: 'integration',
    entityId: connection.id,
    metadata: { xeroTenantName: connection.xeroTenantName },
  })

  return success({ disconnected: true })
})

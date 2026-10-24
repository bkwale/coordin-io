import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { exchangeCodeForTokens, fetchTenants } from '@/lib/integrations/xero/oauth'
import { recordAuditEvent } from '@/lib/audit'

/**
 * GET /api/integrations/xero/callback — OAuth 2.0 redirect handler.
 *
 * Xero redirects here after user grants access. We:
 * 1. Validate state matches a pending connection
 * 2. Exchange code for tokens
 * 3. Fetch connected tenants
 * 4. Activate the connection with real tenant info
 * 5. Redirect back to the integrations settings page
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const error = url.searchParams.get('error')

  // Base URL for redirects
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || url.origin

  // User denied access
  if (error) {
    return NextResponse.redirect(
      `${baseUrl}/settings?tab=integrations&xero=error&reason=${encodeURIComponent(error)}`,
    )
  }

  if (!code || !state) {
    return NextResponse.redirect(
      `${baseUrl}/settings?tab=integrations&xero=error&reason=missing_params`,
    )
  }

  try {
    // Find the pending connection using the state
    const pendingConnection = await prisma.xeroConnection.findFirst({
      where: {
        xeroTenantId: `pending:${state}`,
        active: false,
      },
    })

    if (!pendingConnection) {
      return NextResponse.redirect(
        `${baseUrl}/settings?tab=integrations&xero=error&reason=invalid_state`,
      )
    }

    // Check if the flow has expired (10min window)
    if (pendingConnection.tokenExpiresAt < new Date()) {
      await prisma.xeroConnection.delete({ where: { id: pendingConnection.id } })
      return NextResponse.redirect(
        `${baseUrl}/settings?tab=integrations&xero=error&reason=expired`,
      )
    }

    // The code verifier was stored in accessToken temporarily
    const codeVerifier = pendingConnection.accessToken

    // Exchange code for tokens
    const tokens = await exchangeCodeForTokens(code, codeVerifier)

    // Fetch connected Xero organisations
    const tenants = await fetchTenants(tokens.access_token)

    if (!tenants.length) {
      await prisma.xeroConnection.delete({ where: { id: pendingConnection.id } })
      return NextResponse.redirect(
        `${baseUrl}/settings?tab=integrations&xero=error&reason=no_tenants`,
      )
    }

    // Use the first tenant (most common case — single org)
    const tenant = tenants[0]

    // Deactivate any existing connection for this org+tenant pair
    await prisma.xeroConnection.updateMany({
      where: {
        organisationId: pendingConnection.organisationId,
        xeroTenantId: tenant.tenantId,
        active: true,
      },
      data: { active: false, disconnectedAt: new Date() },
    })

    // Activate the connection with real data
    await prisma.xeroConnection.update({
      where: { id: pendingConnection.id },
      data: {
        xeroTenantId: tenant.tenantId,
        xeroTenantName: tenant.tenantName,
        xeroTenantType: tenant.tenantType,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        tokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
        scopes: tokens.scope.split(' '),
        active: true,
        connectedAt: new Date(),
      },
    })

    // Audit trail
    try {
      await recordAuditEvent({
        organisationId: pendingConnection.organisationId,
        actorId: pendingConnection.connectedById,
        action: 'xero.connected',
        entityType: 'integration',
        entityId: pendingConnection.id,
        metadata: {
          xeroTenantId: tenant.tenantId,
          xeroTenantName: tenant.tenantName,
        },
      })
    } catch {
      console.error('[xero-callback] Audit event failed')
    }

    return NextResponse.redirect(
      `${baseUrl}/settings?tab=integrations&xero=connected&tenant=${encodeURIComponent(tenant.tenantName)}`,
    )
  } catch (err) {
    console.error('[xero-callback] OAuth flow failed:', err)
    return NextResponse.redirect(
      `${baseUrl}/settings?tab=integrations&xero=error&reason=exchange_failed`,
    )
  }
}

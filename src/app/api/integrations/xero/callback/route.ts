import { NextRequest, NextResponse } from 'next/server'
import { oauthStateMatches, clearOAuthState } from '@/lib/oauth-state'
import { sealSecret, openSecret } from '@/lib/secret-box'
import { prisma } from '@/lib/prisma'
import { exchangeCodeForTokens, fetchTenants } from '@/lib/integrations/xero/oauth'
import { recordAuditEvent } from '@/lib/audit'
import { captureError } from '@/lib/error-reporting'
import { planActivation } from '@/lib/integrations/activate-connection'

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

  // The state must come back to the same browser that started the flow
  if (!oauthStateMatches(request, 'xero', state)) {
    return NextResponse.redirect(
      `${baseUrl}/settings?tab=integrations&xero=error&reason=invalid_state`,
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
    const codeVerifier = openSecret(pendingConnection.accessToken)

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

    // If this firm connected the same Xero organisation before, the sign-in goes back into that row
    const previous = await prisma.xeroConnection.findFirst({
      where: { organisationId: pendingConnection.organisationId, xeroTenantId: tenant.tenantId },
      select: { id: true },
    })
    const plan = planActivation(pendingConnection.id, previous?.id)
    const live = {
      xeroTenantId: tenant.tenantId,
      xeroTenantName: tenant.tenantName,
      xeroTenantType: tenant.tenantType,
      accessToken: sealSecret(tokens.access_token),
      refreshToken: sealSecret(tokens.refresh_token),
      tokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
      scopes: tokens.scope.split(' '),
      active: true,
      connectedAt: new Date(),
      disconnectedAt: null,
      connectedById: pendingConnection.connectedById,
    }
    await prisma.$transaction(async (tx) => {
      if (plan.deletePendingId) await tx.xeroConnection.delete({ where: { id: plan.deletePendingId } })
      await tx.xeroConnection.update({ where: { id: plan.targetId }, data: live })
    })
    const connectionId = plan.targetId

    // Audit trail
    try {
      await recordAuditEvent({
        organisationId: pendingConnection.organisationId,
        actorId: pendingConnection.connectedById,
        action: 'xero.connected',
        entityType: 'integration',
        entityId: connectionId,
        metadata: {
          reconnected: plan.reuse,
          xeroTenantId: tenant.tenantId,
          xeroTenantName: tenant.tenantName,
        },
      })
    } catch {
      console.error('[xero-callback] Audit event failed')
    }

    // The state is single-use: clear its cookie
    return clearOAuthState(NextResponse.redirect(
      `${baseUrl}/settings?tab=integrations&xero=connected&tenant=${encodeURIComponent(tenant.tenantName)}`,
    ), 'xero')
  } catch (err) {
    console.error('[xero-callback] OAuth flow failed:', err)
    captureError(err, { source: 'api', route: '/api/integrations/xero/callback', code: 'XERO_CONNECT_FAILED' })
    return NextResponse.redirect(
      `${baseUrl}/settings?tab=integrations&xero=error&reason=exchange_failed`,
    )
  }
}

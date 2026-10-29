import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { exchangeCodeForTokens, fetchUserProfile } from '@/lib/integrations/microsoft/oauth'
import { recordAuditEvent } from '@/lib/audit'

/**
 * GET /api/integrations/microsoft/callback — OAuth 2.0 redirect handler.
 *
 * Microsoft redirects here after user grants access. We:
 * 1. Validate state matches a pending connection
 * 2. Exchange code for tokens
 * 3. Fetch user profile to capture tenant info
 * 4. Activate the connection with real tenant info
 * 5. Redirect back to the integrations settings page
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const error = url.searchParams.get('error')
  const errorDescription = url.searchParams.get('error_description')

  // Base URL for redirects
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || url.origin

  // User denied access or error from Microsoft
  if (error) {
    console.error('[microsoft-callback] OAuth error:', error, errorDescription)
    return NextResponse.redirect(
      `${baseUrl}/settings?tab=integrations&microsoft=error&reason=${encodeURIComponent(error)}`,
    )
  }

  if (!code || !state) {
    return NextResponse.redirect(
      `${baseUrl}/settings?tab=integrations&microsoft=error&reason=missing_params`,
    )
  }

  try {
    // Find the pending connection using the state
    const pendingConnection = await prisma.microsoftConnection.findFirst({
      where: {
        msTenantId: `pending:${state}`,
        active: false,
      },
    })

    if (!pendingConnection) {
      return NextResponse.redirect(
        `${baseUrl}/settings?tab=integrations&microsoft=error&reason=invalid_state`,
      )
    }

    // Check if the flow has expired (10min window)
    if (pendingConnection.tokenExpiresAt < new Date()) {
      await prisma.microsoftConnection.delete({ where: { id: pendingConnection.id } })
      return NextResponse.redirect(
        `${baseUrl}/settings?tab=integrations&microsoft=error&reason=expired`,
      )
    }

    // The code verifier was stored in accessToken temporarily
    const codeVerifier = pendingConnection.accessToken

    // Exchange code for tokens
    const tokens = await exchangeCodeForTokens(code, codeVerifier)

    // Fetch the authenticated user's profile to capture tenant info
    const userProfile = await fetchUserProfile(tokens.access_token)

    // Extract tenant ID from the id_token or use organisation from state
    // Microsoft encodes tenant ID in the token — we parse from the state prefix
    const organisationId = state.split(':')[0]

    // The Azure AD tenant ID comes from the token's tid claim
    // For now, derive it from the user profile's mail domain or use a placeholder
    // In production, decode the id_token JWT to get the 'tid' claim
    let tenantId = 'default'
    let tenantName = userProfile.displayName || 'Microsoft 365'

    // Try to extract tenant ID from the access_token JWT (it's a JWT with a tid claim)
    try {
      const tokenParts = tokens.access_token.split('.')
      if (tokenParts.length === 3) {
        const payload = JSON.parse(Buffer.from(tokenParts[1], 'base64url').toString())
        if (payload.tid) {
          tenantId = payload.tid
        }
        if (payload.tenant_region_scope) {
          tenantName = `${userProfile.displayName || 'Microsoft 365'} (${payload.tenant_region_scope})`
        }
      }
    } catch {
      // Token parsing failed — use defaults
      console.warn('[microsoft-callback] Could not parse tenant ID from token')
    }

    // Use the user's company name if available
    if (userProfile.companyName) {
      tenantName = userProfile.companyName
    }

    // Deactivate any existing connection for this org+tenant pair
    await prisma.microsoftConnection.updateMany({
      where: {
        organisationId: pendingConnection.organisationId,
        msTenantId: tenantId,
        active: true,
      },
      data: { active: false, disconnectedAt: new Date() },
    })

    // Activate the connection with real data
    await prisma.microsoftConnection.update({
      where: { id: pendingConnection.id },
      data: {
        msTenantId: tenantId,
        msTenantName: tenantName,
        msUserId: userProfile.id,
        msUserEmail: userProfile.mail || userProfile.userPrincipalName,
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
        action: 'microsoft.connected',
        entityType: 'integration',
        entityId: pendingConnection.id,
        metadata: {
          msTenantId: tenantId,
          msTenantName: tenantName,
          msUserEmail: userProfile.mail || userProfile.userPrincipalName,
        },
      })
    } catch {
      console.error('[microsoft-callback] Audit event failed')
    }

    return NextResponse.redirect(
      `${baseUrl}/settings?tab=integrations&microsoft=connected&tenant=${encodeURIComponent(tenantName)}`,
    )
  } catch (err) {
    console.error('[microsoft-callback] OAuth flow failed:', err)
    return NextResponse.redirect(
      `${baseUrl}/settings?tab=integrations&microsoft=error&reason=exchange_failed`,
    )
  }
}

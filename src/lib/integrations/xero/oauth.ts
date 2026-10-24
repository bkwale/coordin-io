/**
 * Xero OAuth 2.0 client — PKCE flow with offline_access.
 *
 * Handles authorization URL generation, token exchange, and token refresh.
 * Tokens are stored per-organisation in the XeroConnection table.
 */

import { prisma } from '@/lib/prisma'
import type { XeroTokenSet, XeroTenant } from './types'

/* ── Config ────────────────────────────────────────────── */

const XERO_AUTH_URL = 'https://login.xero.com/identity/connect/authorize'
const XERO_TOKEN_URL = 'https://identity.xero.com/connect/token'
const XERO_TENANTS_URL = 'https://api.xero.com/connections'

function getConfig() {
  const clientId = process.env.XERO_CLIENT_ID
  const clientSecret = process.env.XERO_CLIENT_SECRET
  const redirectUri = process.env.XERO_REDIRECT_URI

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error('Xero OAuth not configured — set XERO_CLIENT_ID, XERO_CLIENT_SECRET, XERO_REDIRECT_URI')
  }

  return { clientId, clientSecret, redirectUri }
}

/* ── Scopes ────────────────────────────────────────────── */

// Granular scopes (required for apps created after March 2, 2026)
const XERO_SCOPES = [
  'openid',
  'profile',
  'email',
  'offline_access',              // refresh tokens
  'accounting.transactions',     // invoices, credit notes, payments
  'accounting.contacts',         // contacts CRUD
  'accounting.settings.read',    // chart of accounts, tax rates (read-only)
].join(' ')

/* ── PKCE helpers ──────────────────────────────────────── */

async function generateCodeVerifier(): Promise<string> {
  const { randomBytes } = await import('crypto')
  return randomBytes(32).toString('base64url')
}

async function generateCodeChallenge(verifier: string): Promise<string> {
  const { createHash } = await import('crypto')
  return createHash('sha256').update(verifier).digest('base64url')
}

/* ── Authorization URL ─────────────────────────────────── */

export interface AuthUrlResult {
  url: string
  state: string
  codeVerifier: string
}

/**
 * Build the Xero authorization URL for the PKCE flow.
 * The caller must store `state` and `codeVerifier` in the session/DB
 * to validate the callback.
 */
export async function buildAuthUrl(organisationId: string): Promise<AuthUrlResult> {
  const { clientId, redirectUri } = getConfig()
  const { randomBytes } = await import('crypto')

  const state = `${organisationId}:${randomBytes(16).toString('hex')}`
  const codeVerifier = await generateCodeVerifier()
  const codeChallenge = await generateCodeChallenge(codeVerifier)

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: XERO_SCOPES,
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  })

  return {
    url: `${XERO_AUTH_URL}?${params.toString()}`,
    state,
    codeVerifier,
  }
}

/* ── Token Exchange ────────────────────────────────────── */

/**
 * Exchange an authorization code for tokens (initial OAuth callback).
 */
export async function exchangeCodeForTokens(
  code: string,
  codeVerifier: string,
): Promise<XeroTokenSet> {
  const { clientId, clientSecret, redirectUri } = getConfig()

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
    code_verifier: codeVerifier,
    client_id: clientId,
    client_secret: clientSecret,
  })

  const res = await fetch(XERO_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Xero token exchange failed (${res.status}): ${err}`)
  }

  return res.json() as Promise<XeroTokenSet>
}

/* ── Token Refresh ─────────────────────────────────────── */

/**
 * Refresh an expired access token using the stored refresh token.
 * Updates the XeroConnection row in-place and returns the new token set.
 */
export async function refreshAccessToken(connectionId: string): Promise<XeroTokenSet> {
  const { clientId, clientSecret } = getConfig()

  const connection = await prisma.xeroConnection.findUnique({
    where: { id: connectionId },
    select: { refreshToken: true },
  })

  if (!connection?.refreshToken) {
    throw new Error('No refresh token — Xero must be reconnected')
  }

  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: connection.refreshToken,
    client_id: clientId,
    client_secret: clientSecret,
  })

  const res = await fetch(XERO_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })

  if (!res.ok) {
    const err = await res.text()
    // Mark connection as needing re-auth
    await prisma.xeroConnection.update({
      where: { id: connectionId },
      data: { active: false, lastSyncError: `Token refresh failed: ${err}` },
    })
    throw new Error(`Xero token refresh failed (${res.status}): ${err}`)
  }

  const tokens: XeroTokenSet = await res.json()

  // Persist refreshed tokens
  await prisma.xeroConnection.update({
    where: { id: connectionId },
    data: {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      tokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
      lastSyncError: null,
    },
  })

  return tokens
}

/* ── Fetch Connected Tenants ───────────────────────────── */

/**
 * After token exchange, fetch the list of Xero organisations
 * the user granted access to.
 */
export async function fetchTenants(accessToken: string): Promise<XeroTenant[]> {
  const res = await fetch(XERO_TENANTS_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!res.ok) {
    throw new Error(`Failed to fetch Xero tenants (${res.status})`)
  }

  return res.json() as Promise<XeroTenant[]>
}

/* ── Get Valid Access Token ────────────────────────────── */

/**
 * Returns a valid access token for the given connection,
 * refreshing if expired or about to expire (60s buffer).
 */
export async function getValidAccessToken(connectionId: string): Promise<string> {
  const connection = await prisma.xeroConnection.findUnique({
    where: { id: connectionId },
    select: { accessToken: true, tokenExpiresAt: true, active: true },
  })

  if (!connection) throw new Error('Xero connection not found')
  if (!connection.active) throw new Error('Xero connection is inactive — reconnect required')

  const now = new Date()
  const bufferMs = 60_000 // refresh 60s before expiry

  if (connection.tokenExpiresAt && connection.tokenExpiresAt.getTime() - now.getTime() > bufferMs) {
    return connection.accessToken
  }

  // Token expired or about to — refresh
  const tokens = await refreshAccessToken(connectionId)
  return tokens.access_token
}

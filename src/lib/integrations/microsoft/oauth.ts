/**
 * Microsoft Graph OAuth 2.0 client — PKCE flow with offline_access.
 *
 * Handles authorization URL generation, token exchange, and token refresh.
 * Tokens are stored per-organisation in the MicrosoftConnection table.
 *
 * Uses /common authority to support any Azure AD tenant — when CWA
 * connects their Microsoft 365, the tenant ID is captured automatically.
 */

import { prisma } from '@/lib/prisma'
import type { MsTokenSet, MsUserProfile } from './types'

/* ── Config ────────────────────────────────────────────── */

const MS_AUTH_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize'
const MS_TOKEN_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0/token'
const MS_GRAPH_BASE = 'https://graph.microsoft.com/v1.0'

function getConfig() {
  const clientId = process.env.MS_CLIENT_ID
  const clientSecret = process.env.MS_CLIENT_SECRET
  const redirectUri = process.env.MS_REDIRECT_URI

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error('Microsoft OAuth not configured — set MS_CLIENT_ID, MS_CLIENT_SECRET, MS_REDIRECT_URI')
  }

  return { clientId, clientSecret, redirectUri }
}

/* ── Scopes ────────────────────────────────────────────── */

// Single token covers Outlook, SharePoint, OneDrive, Teams
const MS_SCOPES = [
  'openid',
  'profile',
  'email',
  'offline_access',             // refresh tokens
  'User.Read',                  // user profile
  'Calendars.ReadWrite',        // calendar events (milestones, leave, meetings)
  'Files.ReadWrite.All',        // OneDrive / SharePoint document libraries
  'Sites.ReadWrite.All',        // SharePoint sites
  'Mail.Read',                  // read-only mail access
  'ChannelMessage.Send',        // Teams channel messages
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
 * Build the Microsoft authorization URL for the PKCE flow.
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
    scope: MS_SCOPES,
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    // prompt=consent ensures all scopes are granted on first connect
    prompt: 'consent',
  })

  return {
    url: `${MS_AUTH_URL}?${params.toString()}`,
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
): Promise<MsTokenSet> {
  const { clientId, clientSecret, redirectUri } = getConfig()

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
    code_verifier: codeVerifier,
    client_id: clientId,
    client_secret: clientSecret,
  })

  const res = await fetch(MS_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Microsoft token exchange failed (${res.status}): ${err}`)
  }

  return res.json() as Promise<MsTokenSet>
}

/* ── Token Refresh ─────────────────────────────────────── */

/**
 * Refresh an expired access token using the stored refresh token.
 * Updates the MicrosoftConnection row in-place and returns the new token set.
 */
export async function refreshAccessToken(connectionId: string): Promise<MsTokenSet> {
  const { clientId, clientSecret } = getConfig()

  const connection = await prisma.microsoftConnection.findUnique({
    where: { id: connectionId },
    select: { refreshToken: true },
  })

  if (!connection?.refreshToken) {
    throw new Error('No refresh token — Microsoft must be reconnected')
  }

  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: connection.refreshToken,
    client_id: clientId,
    client_secret: clientSecret,
    scope: MS_SCOPES,
  })

  const res = await fetch(MS_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })

  if (!res.ok) {
    const err = await res.text()
    // Mark connection as needing re-auth
    await prisma.microsoftConnection.update({
      where: { id: connectionId },
      data: { active: false, lastSyncError: `Token refresh failed: ${err}` },
    })
    throw new Error(`Microsoft token refresh failed (${res.status}): ${err}`)
  }

  const tokens: MsTokenSet = await res.json()

  // Persist refreshed tokens
  await prisma.microsoftConnection.update({
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

/* ── Fetch User Profile ──────────────────────────────────── */

/**
 * After token exchange, fetch the authenticated user's profile
 * from Microsoft Graph. Used to capture tenant info and display name.
 */
export async function fetchUserProfile(accessToken: string): Promise<MsUserProfile> {
  const res = await fetch(`${MS_GRAPH_BASE}/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!res.ok) {
    throw new Error(`Failed to fetch Microsoft user profile (${res.status})`)
  }

  return res.json() as Promise<MsUserProfile>
}

/* ── Get Valid Access Token ────────────────────────────── */

/**
 * Returns a valid access token for the given connection,
 * refreshing if expired or about to expire (60s buffer).
 */
export async function getValidAccessToken(connectionId: string): Promise<string> {
  const connection = await prisma.microsoftConnection.findUnique({
    where: { id: connectionId },
    select: { accessToken: true, tokenExpiresAt: true, active: true },
  })

  if (!connection) throw new Error('Microsoft connection not found')
  if (!connection.active) throw new Error('Microsoft connection is inactive — reconnect required')

  const now = new Date()
  const bufferMs = 60_000 // refresh 60s before expiry

  if (connection.tokenExpiresAt && connection.tokenExpiresAt.getTime() - now.getTime() > bufferMs) {
    return connection.accessToken
  }

  // Token expired or about to — refresh
  const tokens = await refreshAccessToken(connectionId)
  return tokens.access_token
}

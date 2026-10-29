import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * POST /api/webhooks/microsoft — Microsoft Graph change notification receiver.
 *
 * Microsoft sends:
 *  1. Validation request (with ?validationToken=xxx) — must return the token as text/plain
 *  2. Change notifications — JSON body with subscription/change details
 *
 * Phase 1: handles validation only (registers webhook subscription).
 * Phase 2: will process calendar/file change events for incremental sync.
 */
export async function POST(request: NextRequest) {
  const url = new URL(request.url)
  const validationToken = url.searchParams.get('validationToken')

  // ── Validation handshake ──
  // Microsoft sends this when a new subscription is created.
  // We must echo the token back as text/plain within 10 seconds.
  if (validationToken) {
    return new NextResponse(validationToken, {
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
    })
  }

  // ── Change notification ──
  try {
    const body = await request.json()
    const notifications = body?.value

    if (!Array.isArray(notifications)) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
    }

    for (const notification of notifications) {
      const {
        subscriptionId,
        changeType,
        resource,
        clientState,
        tenantId,
      } = notification

      // Validate clientState matches our secret (prevents spoofed webhooks)
      const expectedSecret = process.env.MS_WEBHOOK_SECRET
      if (expectedSecret && clientState !== expectedSecret) {
        console.warn('[ms-webhook] Invalid clientState — potential spoofed webhook')
        continue
      }

      // Log the notification for now — Phase 2 will process these
      console.log('[ms-webhook] Change notification:', {
        subscriptionId,
        changeType,
        resource,
        tenantId,
      })

      // TODO Phase 2: Look up connection by tenantId, then:
      // - changeType: 'created' | 'updated' | 'deleted'
      // - resource: 'me/events('{id}')' for calendar, 'me/messages('{id}')' for mail
      // - Queue incremental sync for the affected resource
    }

    // Must return 202 Accepted within 30 seconds or Microsoft retries
    return new NextResponse(null, { status: 202 })
  } catch (err) {
    console.error('[ms-webhook] Failed to process notification:', err)
    // Still return 202 to prevent Microsoft from retrying
    return new NextResponse(null, { status: 202 })
  }
}

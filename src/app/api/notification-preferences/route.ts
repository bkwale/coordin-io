import type { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { success } from '@/lib/api-response'
import { withAuth } from '@/lib/with-auth'
import { ValidationError } from '@/lib/errors'
import { NOTIFICATION_EVENTS, type NotificationEvent } from '@/lib/notifications'

const ALL_EVENT_TYPES = new Set(Object.values(NOTIFICATION_EVENTS))

/**
 * Notification preference shape per event type:
 * { "task.assigned": { inApp: true, email: true }, ... }
 *
 * Missing keys default to enabled (opt-out model).
 */
interface EventPreference {
  inApp?: boolean
  email?: boolean
}

type PreferencesMap = Record<string, EventPreference>

// ── GET /api/notification-preferences ──────────────────
// Returns the user's current notification preferences merged
// with defaults (all enabled).

export const GET = withAuth(async (_request: NextRequest, { profile }) => {
  const stored: PreferencesMap =
    (profile.notificationPreferences as PreferencesMap) ?? {}

  // Build full map with defaults
  const preferences: PreferencesMap = {}
  for (const eventType of ALL_EVENT_TYPES) {
    preferences[eventType] = {
      inApp: stored[eventType]?.inApp ?? true,
      email: stored[eventType]?.email ?? true,
    }
  }

  return success({ preferences })
})

// ── PATCH /api/notification-preferences ────────────────
// Accepts partial updates: { preferences: { "task.assigned": { email: false } } }
// Merges with existing preferences.

export const PATCH = withAuth(async (request: NextRequest, { profile }) => {
  const body = await request.json()
  const incoming: PreferencesMap | undefined = body.preferences

  if (!incoming || typeof incoming !== 'object') {
    throw new ValidationError('Missing or invalid "preferences" object')
  }

  // Validate event types and preference values
  for (const [eventType, pref] of Object.entries(incoming)) {
    if (!ALL_EVENT_TYPES.has(eventType as NotificationEvent)) {
      throw new ValidationError(`Unknown event type: ${eventType}`)
    }
    if (typeof pref !== 'object' || pref === null) {
      throw new ValidationError(`Invalid preference for ${eventType}`)
    }
    if (pref.inApp !== undefined && typeof pref.inApp !== 'boolean') {
      throw new ValidationError(`inApp must be boolean for ${eventType}`)
    }
    if (pref.email !== undefined && typeof pref.email !== 'boolean') {
      throw new ValidationError(`email must be boolean for ${eventType}`)
    }
  }

  // Merge with existing
  const existing: PreferencesMap =
    (profile.notificationPreferences as PreferencesMap) ?? {}

  const merged: PreferencesMap = { ...existing }
  for (const [eventType, pref] of Object.entries(incoming)) {
    merged[eventType] = {
      ...(existing[eventType] ?? {}),
      ...pref,
    }
  }

  await prisma.profile.update({
    where: { id: profile.id },
    data: { notificationPreferences: JSON.parse(JSON.stringify(merged)) },
  })

  // Return full preferences with defaults
  const full: PreferencesMap = {}
  for (const eventType of ALL_EVENT_TYPES) {
    full[eventType] = {
      inApp: merged[eventType]?.inApp ?? true,
      email: merged[eventType]?.email ?? true,
    }
  }

  return success({ preferences: full })
})

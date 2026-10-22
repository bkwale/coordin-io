/**
 * Feature Flag System
 *
 * Features are defined in FEATURE_REGISTRY with defaults.
 * Database stores overrides only (no row = use default).
 * Check at 3 levels: API middleware, UI route guard, sidebar rendering.
 */

import { prisma } from './prisma'
import { cached, invalidateCache } from './cache'
import type { NextRequest } from 'next/server'

// ─── Feature Registry ───────────────────────────────────────────────
// Single source of truth for all toggleable features.
// `default: true` means the feature is ON for new orgs unless explicitly disabled.

export const FEATURE_REGISTRY = {
  staffing:         { label: 'People & HR',           default: true,  description: 'Employee profiles, onboarding, leave, expenses, timesheets' },
  projects:         { label: 'Projects & Tasks',      default: true,  description: 'Project management, tasks, milestones, documents' },
  commercial:       { label: 'Commercial & Fees',     default: false, description: 'Fee quotes, commercial analytics, cost tracking' },
  timesheets:       { label: 'Timesheets',            default: false, description: 'Weekly timesheet entry and approval workflow' },
  spend_management: { label: 'Spend Management',      default: false, description: 'Procurement requests, corporate cards, budgets' },
  helpdesk:         { label: 'Support Tickets',       default: false, description: 'Internal helpdesk and ticket management' },
  compliance:       { label: 'Compliance & HSE',      default: false, description: 'Compliance tracking, HSE observations, site inspections' },
  documents:        { label: 'Document Management',   default: true,  description: 'Drawing register, document control, transmittals' },
  approvals:        { label: 'Approval Workflows',    default: true,  description: 'Multi-step approval routing for leave, expenses, requests' },
} as const

export type FeatureKey = keyof typeof FEATURE_REGISTRY

// ─── Cache Key ──────────────────────────────────────────────────────

function featureCacheKey(orgId: string): string {
  return `features:${orgId}`
}

// ─── Get Features For Org ───────────────────────────────────────────

export async function getOrgFeatures(orgId: string): Promise<Record<FeatureKey, boolean>> {
  return cached<Record<FeatureKey, boolean>>(
    featureCacheKey(orgId),
    async () => {
      // Build defaults
      const result: Record<string, boolean> = {}
      for (const [key, config] of Object.entries(FEATURE_REGISTRY)) {
        result[key] = config.default
      }

      // Overlay DB overrides
      const overrides = await prisma.organisationFeature.findMany({
        where: { organisationId: orgId },
      })

      for (const override of overrides) {
        if (override.featureKey in FEATURE_REGISTRY) {
          result[override.featureKey] = override.enabled
        }
      }

      return result as Record<FeatureKey, boolean>
    },
    300 // 5 minutes
  )
}

// ─── Check Single Feature ───────────────────────────────────────────

export async function isFeatureEnabled(orgId: string, feature: FeatureKey): Promise<boolean> {
  const features = await getOrgFeatures(orgId)
  return features[feature] ?? FEATURE_REGISTRY[feature]?.default ?? false
}

// ─── Invalidate Cache ───────────────────────────────────────────────

export async function invalidateFeatureCache(orgId: string): Promise<void> {
  await invalidateCache(featureCacheKey(orgId))
}

// ─── API Middleware: requireFeature ─────────────────────────────────
// Wraps an API handler — returns 403 if the feature is not enabled for the org.

export function requireFeature(featureKey: FeatureKey) {
  return (handler: (req: NextRequest, ctx: { params: Promise<Record<string, string>> }) => Promise<Response>) => {
    return async (req: NextRequest, ctx: { params: Promise<Record<string, string>> }) => {
      // We need the org ID from the auth context
      // withAuth sets x-organisation-id header
      const orgId = req.headers.get('x-organisation-id')

      if (!orgId) {
        return Response.json(
          { error: 'Organisation context required' },
          { status: 401 }
        )
      }

      const enabled = await isFeatureEnabled(orgId, featureKey)
      if (!enabled) {
        return Response.json(
          { error: `Feature "${FEATURE_REGISTRY[featureKey].label}" is not enabled for your organisation` },
          { status: 403 }
        )
      }

      return handler(req, ctx)
    }
  }
}

// ─── Feature List With Metadata ─────────────────────────────────────
// Returns the full registry with current org state — used by admin UI.

export async function getOrgFeatureDetails(orgId: string) {
  const overrides = await prisma.organisationFeature.findMany({
    where: { organisationId: orgId },
    include: { enabledByProfile: { select: { fullName: true } } },
  })

  const overrideMap = new Map(overrides.map(o => [o.featureKey, o]))

  return Object.entries(FEATURE_REGISTRY).map(([key, config]) => {
    const override = overrideMap.get(key)
    return {
      key,
      label: config.label,
      description: config.description,
      default: config.default,
      enabled: override ? override.enabled : config.default,
      hasOverride: !!override,
      enabledAt: override?.enabledAt ?? null,
      enabledBy: override?.enabledByProfile?.fullName ?? null,
      config: override?.config ?? {},
    }
  })
}

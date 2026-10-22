import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/with-auth'
import { success } from '@/lib/api-response'
import { formatAPIError } from '@/lib/errors'
import { prisma } from '@/lib/prisma'
import {
  getOrgFeatureDetails,
  invalidateFeatureCache,
  FEATURE_REGISTRY,
  type FeatureKey,
} from '@/lib/feature-flags'
import { recordAuditEvent } from '@/lib/audit'

// ── GET /api/org/features ───────────────────────────────────────────
// Returns all features with their current state for the org.
// Any authenticated user can read feature state.

export const GET = withAuth(async (_request, { profile }) => {
  try {
    const features = await getOrgFeatureDetails(profile.organisationId)
    return success(features)
  } catch (err) {
    const formatted = formatAPIError(err)
    return NextResponse.json(formatted.body, { status: formatted.statusCode })
  }
})

// ── PATCH /api/org/features ─────────────────────────────────────────
// Toggle a feature on/off. Only OWNER and ADMIN can do this.
// Body: { featureKey: string, enabled: boolean }

export const PATCH = withAuth(
  async (request: NextRequest, { profile }) => {
    try {
      const body = await request.json()
      const { featureKey, enabled } = body

      // Validate featureKey
      if (!featureKey || !(featureKey in FEATURE_REGISTRY)) {
        return NextResponse.json(
          { error: `Unknown feature: ${featureKey}` },
          { status: 400 }
        )
      }

      if (typeof enabled !== 'boolean') {
        return NextResponse.json(
          { error: 'enabled must be a boolean' },
          { status: 400 }
        )
      }

      // Upsert the feature override
      const feature = await prisma.organisationFeature.upsert({
        where: {
          organisationId_featureKey: {
            organisationId: profile.organisationId,
            featureKey,
          },
        },
        update: {
          enabled,
          enabledAt: enabled ? new Date() : null,
          enabledBy: enabled ? profile.id : null,
        },
        create: {
          organisationId: profile.organisationId,
          featureKey,
          enabled,
          enabledAt: enabled ? new Date() : null,
          enabledBy: enabled ? profile.id : null,
        },
      })

      // Invalidate cache
      await invalidateFeatureCache(profile.organisationId)

      // Audit log
      await recordAuditEvent({
        organisationId: profile.organisationId,
        actorId: profile.id,
        action: enabled ? 'feature.enabled' : 'feature.disabled',
        entityType: 'organisation_feature',
        entityId: feature.id,
        metadata: {
          featureKey,
          enabled,
          label: FEATURE_REGISTRY[featureKey as FeatureKey].label,
        },
      })

      return success(feature)
    } catch (err) {
      const formatted = formatAPIError(err)
      return NextResponse.json(formatted.body, { status: formatted.statusCode })
    }
  },
  { requiredCapability: { feature: 'settings', action: 'edit_org_settings' } }
)
